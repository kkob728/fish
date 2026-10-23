// 낚시: 캐스팅 → (가짜 입질) → 입질 → 챔질 → 파이팅 → 획득. 판정은 전부 서버가 함
import crypto from 'node:crypto';
import { getDb } from './db.ts';
import { ITEMS, NO_BAIT, FISH_BAG_LIMIT } from '../shared/data/items.ts';
import { ROD, RARITY, VARIANT } from '../shared/data/core.ts';
import { ZONES, zoneAt } from '../shared/world.ts';
import { BOATS } from '../shared/sea.ts';
import { SEA_SEED, SEA_SEED_CHANCE } from '../shared/data/crops.ts';
import { boats } from './boats.ts';
import { rollSpecies, rollVariant, rollSize, makeFishRecord, fightParams, minFightSeconds, biteWaitSeconds } from '../shared/fishing.ts';
import type { Effects } from '../shared/fishing.ts';
import { levelInfo, levelPerks, catchXp, MISS_XP } from '../shared/level.ts';
import type { FightMods } from '../shared/minigame.ts';
import type { FishSpecies } from '../shared/types.ts';
import { randInt } from '../shared/rng.ts';
import {
  type Session, type Handler, now, ctxNow, send, broadcast, sysChat, toast, sendMe, markDirty, hasItem, takeItem, effectsFor, applyBuff, addXp,
} from './core.ts';

export function clearFishing(s: Session, notifyOthers = true) {
  if (s.fs?.timers) s.fs.timers.forEach(clearTimeout);
  s.fs = null;
  if (notifyOthers) s.dirtyFish = true;
}

// 낚싯대 + 레벨 + 버프를 합친 파이팅 보정값 (클라이언트도 이 값으로 미니게임을 돌림)
function fightMods(s: Session, eff: Effects): FightMods {
  const pk = levelPerks(levelInfo(s.p.xp).level);
  return {
    tension: eff.tension,
    reel: eff.reel * pk.reelMult,
    zoneBonus: pk.zoneBonus + (eff.zoneBonus || 0),
    speedMult: pk.speedMult * (eff.speedMult || 1),
    gainMult: eff.gainMult || 1,
    lossMult: 1,
  };
}

const cast: Handler = (s, m) => {
  if (s.fs) return;
  if (s.trade) return toast(s, '거래 중에는 낚시할 수 없어요.', 'warn');
  const x = Number(m.x), z = Number(m.z);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return;
  const rod = ROD[s.p.rod];
  const dist = Math.hypot(x - s.x, z - s.z);
  if (dist > rod.range + 4) return send(s, 'castFail', { reason: '너무 멀리 던졌어요.' });
  const zone = zoneAt(x, z);
  if (!zone) return send(s, 'castFail', { reason: '찌가 땅에 떨어졌어요. 물 쪽으로 던지세요!' });
  const zdef = ZONES[zone];
  const boat = s.boat ? boats.get(s.boat) : null;
  if (boat && !boat.anchored) return send(s, 'castFail', { reason: '배가 움직이는 중이에요. 선장이 닻을 내려야 낚시할 수 있어요.' });
  if (zdef.boat && (!boat || boat.tier < zdef.boat)) {
    const need = BOATS[zdef.boat - 1];
    return send(s, 'castFail', { reason: `${zdef.name}은(는) ${need.name} 이상을 타고 와야 해요.` });
  }
  if (rod.tier < zdef.minRod) {
    const need = Object.values(ROD).find((r) => r.tier === zdef.minRod && !r.crafted);
    return send(s, 'castFail', { reason: `${zdef.name}은(는) ${need.name} 이상이 필요해요.` });
  }
  let baitId = m.bait || null;
  if (baitId && (!ITEMS[baitId]?.bait || !hasItem(s.p, baitId, 1))) baitId = null;
  s.p.bait = baitId;
  const bait = baitId ? ITEMS[baitId] : NO_BAIT;
  const eff = effectsFor(s, bait);

  const landMs = 700 + dist * 25;
  const waitMs = biteWaitSeconds() * eff.biteMult * 1000;
  const fs = { phase: 'wait', zone, bx: x, bz: z, baitId, timers: [] as ReturnType<typeof setTimeout>[], castAt: now() } as any;
  s.fs = fs;
  s.dirtyFish = true;
  send(s, 'castOk', { zone, x, z, land: landMs, bait: baitId });

  // 가짜 입질
  const nibbles = randInt(1, 4);
  for (let i = 0; i < nibbles; i++) {
    const at = landMs + 1500 + Math.random() * Math.max(500, waitMs - 2000);
    if (at < landMs + waitMs - 600) fs.timers.push(setTimeout(() => s.fs === fs && send(s, 'nibble'), at));
  }
  fs.timers.push(setTimeout(() => doBite(s, fs), landMs + waitMs));
};

function doBite(s: Session, fs: any) {
  if (s.fs !== fs) return;
  const bait = fs.baitId && hasItem(s.p, fs.baitId, 1) ? ITEMS[fs.baitId] : NO_BAIT;
  const eff = effectsFor(s, bait);
  const ctx = { ...ctxNow(), zone: fs.zone };
  const f = rollSpecies(fs.zone, bait, eff, ctx);
  if (!f) {
    send(s, 'lost', { reason: 'nothing' });
    return clearFishing(s);
  }
  if (!bait.bare) {
    takeItem(s.p, bait.id, 1);
    sendMe(s);
  }
  const size = rollSize(f, eff);
  const variant = rollVariant(eff, ctx);
  const fp = fightParams(f, size.p);
  Object.assign(fs, {
    phase: 'bite',
    fish: { f, size, variant },
    fp,
    eff,
    biteAt: now(),
    mods: fightMods(s, eff),
    hookWindow: fp.hookWindow + levelPerks(levelInfo(s.p.xp).level).hookBonus,
    used: [],
  });
  s.dirtyFish = true;
  send(s, 'bite', { window: fs.hookWindow });
  fs.timers.push(
    setTimeout(() => {
      if (s.fs !== fs || fs.phase !== 'bite') return;
      send(s, 'lost', { reason: 'miss' });
      clearFishing(s);
    }, (fs.hookWindow + 0.45) * 1000),
  );
}

const hook: Handler = (s) => {
  const fs = s.fs;
  if (!fs) return;
  if (fs.phase === 'wait') {
    send(s, 'lost', { reason: 'early' });
    return clearFishing(s);
  }
  if (fs.phase !== 'bite') return;
  fs.phase = 'fight';
  fs.fightAt = now();
  s.dirtyFish = true;
  const { f, size } = fs.fish;
  send(s, 'fight', { fp: fs.fp, mods: fs.mods, p: size.p, tier: RARITY[f.rarity].index });
  fs.timers.push(
    setTimeout(() => {
      if (s.fs !== fs) return;
      send(s, 'lost', { reason: 'timeout' });
      clearFishing(s);
    }, 120000),
  );
};

const fightEnd: Handler = (s, m) => {
  const fs = s.fs;
  if (!fs || fs.phase !== 'fight') return;
  const elapsed = (now() - fs.fightAt) / 1000;
  if (!m.ok) {
    addXp(s, MISS_XP);
    send(s, 'lost', { reason: m.reason === 'snap' ? 'snap' : 'escape' });
    return clearFishing(s);
  }
  if (elapsed < minFightSeconds(fs.fp, fs.mods, fs.used) * 0.8) {
    send(s, 'lost', { reason: 'escape' });
    return clearFishing(s);
  }
  const { f, size, variant } = fs.fish;
  clearFishing(s);
  grantFish(s, f, size, variant, fs.zone);
};

const tackle: Handler = (s, m) => {
  const fs = s.fs;
  const it = ITEMS[m.id];
  if (!fs || fs.phase !== 'fight' || !it?.tackle) return;
  if (fs.used.includes(it.id)) return toast(s, '이번 파이팅에서 이미 썼어요.', 'warn');
  if (!hasItem(s.p, it.id, 1)) return toast(s, `${it.name}이(가) 없어요.`, 'warn');
  takeItem(s.p, it.id, 1);
  fs.used.push(it.id);
  markDirty();
  sendMe(s);
  send(s, 'tackleOk', { id: it.id });
};

// 채팅은 어두운 외곽선 위 밝은 글씨라 밝은 색을 씀
const CHAT_COLOR = ['#e8e4dc', '#a8f090', '#9ccfff', '#dcb0ff', '#ffc070', '#ffa0dc'];

function grantFish(s: Session, f: FishSpecies, size: { p: number; weight: number }, variant: string | null, zone: string) {
  const p = s.p;
  const rec = makeFishRecord(f, size, variant, { uid: crypto.randomBytes(5).toString('hex'), t: now(), by: p.name });
  const rarity = RARITY[f.rarity];

  // 도감
  const isNew = !p.dex[f.id];
  const d = (p.dex[f.id] ??= { n: 0, maxW: 0, v: [] });
  d.n++;
  if (rec.w > d.maxW) d.maxW = rec.w;
  if (variant && !d.v.includes(variant)) d.v.push(variant);
  let bonus = 0;
  if (isNew) {
    bonus = f.price * 3;
    p.money += bonus;
  }

  p.stats.catches++;
  addXp(s, catchXp(f, rec));
  if (!p.stats.best || rec.price > p.stats.best.price) p.stats.best = { ...rec };

  // 서버 종별 최대어 기록
  const db = getDb();
  const prevRec = db.records[f.id];
  const isRecord = !prevRec || rec.w > prevRec.w;
  if (isRecord) db.records[f.id] = { w: rec.w, name: p.name, v: variant, t: rec.t, q: rec.q };

  let autoSold = false;
  if (p.fish.length >= FISH_BAG_LIMIT) {
    p.money += rec.price;
    p.earned += rec.price;
    autoSold = true;
  } else {
    p.fish.push(rec);
  }
  // 바다 구역에서는 가끔 물고기 뱃속에서 특별한 씨앗이 나옴
  let seed: string | null = null;
  if (SEA_SEED[zone] && Math.random() < SEA_SEED_CHANCE) {
    seed = SEA_SEED[zone];
    p.items[seed] = (p.items[seed] || 0) + 1;
  }
  markDirty();
  sendMe(s);
  send(s, 'caught', { fish: rec, isNew, bonus, isRecord, autoSold, seed });
  s.showUntil = now() + 4000;
  s.showFish = rec;
  broadcast('catchShow', { id: p.id, fish: rec }, s);
  if (isRecord) broadcast('records', { records: { [f.id]: db.records[f.id] } });

  const vName = variant ? `[${VARIANT[variant].name}] ` : '';
  if (rarity.index >= 4 || variant || rec.q === 'monster') {
    sysChat(
      `${p.name}님이 ${vName}${f.name}을(를) 낚았어요! ${rarity.name} · ${rec.w >= 1 ? rec.w.toFixed(2) + 'kg' : Math.round(rec.w * 1000) + 'g'}`,
      variant ? VARIANT[variant].color : CHAT_COLOR[rarity.index],
      'catch',
    );
  } else if (isRecord && prevRec) {
    sysChat(`${p.name}님이 ${f.name} 섬 최대어 기록을 새로 썼어요. (${rec.w.toFixed(2)}kg)`, null, 'record');
  }
  if (variant && VARIANT[variant].buff) applyBuff(VARIANT[variant].buff, s);
}

export const fishingHandlers: Record<string, Handler> = {
  cast,
  hook,
  fightEnd,
  tackle,
  cancel: (s) => s.fs && s.fs.phase !== 'fight' && clearFishing(s),
};
