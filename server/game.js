// 게임 월드 상태와 메시지 처리
import crypto from 'node:crypto';
import { getDb, login, validName, publicProfile, markDirty } from './db.js';
import { FISH_BY_ID } from '../shared/data/fish.js';
import { ITEMS, BAITS, NO_BAIT, RECIPE, SHOP_STOCK, FISH_BAG_LIMIT, ESSENCES } from '../shared/data/items.js';
import { ROD, RARITY, VARIANT, WEATHERS, BUFF_RADIUS, gameHour, phaseOf } from '../shared/data/core.js';
import { ZONES, zoneAt, gatherNodes, NODE_TYPES, POI, walkHeight, PIER } from '../shared/world.js';
import {
  combineEffects, rollSpecies, rollVariant, rollSize, makeFishRecord, fightParams, minFightSeconds, dismantleYield,
} from '../shared/fishing.js';
import { pickWeighted, randInt } from '../shared/rng.js';
import { createTradeSystem } from './trade.js';

const sessions = new Map(); // id -> session
const nodeState = new Map(); // nodeId -> respawnAt (0 = 사용 가능)
const NODES = gatherNodes();
const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));
let weather = { id: 'clear', until: 0 };
let globalBuffs = [];

const now = () => Date.now();
const ctxNow = () => ({ phase: phaseOf(gameHour(now())), weather: weather.id });

function send(s, t, data = {}) {
  if (s.ws.readyState === 1) s.ws.send(JSON.stringify({ t, ...data }));
}
function broadcast(t, data = {}, except = null) {
  const msg = JSON.stringify({ t, ...data });
  for (const s of sessions.values()) if (s !== except && s.ws.readyState === 1) s.ws.send(msg);
}
function sysChat(text, color, kind) {
  broadcast('chat', { sys: true, text, color, kind });
}
function toast(s, text, kind = 'info', extra = {}) {
  send(s, 'toast', { text, kind, ...extra });
}

function sendMe(s) {
  send(s, 'me', { me: publicProfile(s.p) });
}
function playerMeta(s) {
  return { id: s.p.id, name: s.p.name, color: s.p.color, rod: s.p.rod };
}

// ---------- 버프 ----------
function activeBuffs(s) {
  const t = now();
  s.buffs = s.buffs.filter((b) => b.until > t);
  globalBuffs = globalBuffs.filter((b) => b.until > t);
  return [...s.buffs, ...globalBuffs];
}
function sendBuffs(s) {
  const list = activeBuffs(s);
  s.buffSig = list.map((b) => b.id + b.until).join();
  send(s, 'buffs', {
    list: list.map((b) => ({ id: b.id, name: b.name, icon: b.icon, desc: b.desc, until: b.until, global: !!b.global })),
  });
}
function applyBuff(def, from) {
  const until = now() + def.duration * 1000;
  const buff = { id: def.id, name: def.name, icon: def.icon, desc: def.desc, effect: def.effect, until, global: !!def.global };
  if (def.global) {
    globalBuffs = globalBuffs.filter((b) => b.id !== def.id);
    globalBuffs.push(buff);
    for (const s of sessions.values()) sendBuffs(s);
    sysChat(`${from.p.name}님 덕분에 섬 전체에 [${def.name}] 효과가 퍼졌어요. ${def.desc}, ${Math.round(def.duration / 60)}분`, '#e0b8ff', 'buff');
    return;
  }
  let count = 0;
  for (const s of sessions.values()) {
    if (Math.hypot(s.x - from.x, s.z - from.z) > BUFF_RADIUS) continue;
    s.buffs = s.buffs.filter((b) => b.id !== def.id);
    s.buffs.push({ ...buff });
    sendBuffs(s);
    if (s !== from) toast(s, `${from.p.name}님 덕분에 [${def.name}] — ${def.desc}`, 'buff', { buff: def.id });
    count++;
  }
  toast(from, `주변 ${count}명에게 [${def.name}] — ${def.desc}`, 'buff', { buff: def.id });
}

function effectsFor(s, bait) {
  return combineEffects(ROD[s.p.rod], bait, activeBuffs(s));
}

// ---------- 아이템 ----------
function addItems(p, map) {
  for (const [id, n] of Object.entries(map)) p.items[id] = (p.items[id] || 0) + n;
}
function hasItem(p, id, n) {
  return (p.items[id] || 0) >= n;
}
function takeItem(p, id, n) {
  p.items[id] -= n;
  if (p.items[id] <= 0) delete p.items[id];
}
function itemsText(map) {
  return Object.entries(map).map(([id, n]) => `${ITEMS[id]?.icon || ''}${ITEMS[id]?.name || id} ×${n}`).join(', ');
}

// ---------- 날씨 ----------
function rollWeather(first = false) {
  const prev = weather.id;
  let id;
  do {
    id = pickWeighted(Object.entries(WEATHERS).map(([k, w]) => [k, w.weight]));
  } while (!first && id === prev && Math.random() < 0.7);
  weather = { id, until: now() + randInt(4, 9) * 60 * 1000 };
  broadcast('weather', { weather });
  if (!first && id !== prev) sysChat(`날씨가 ${WEATHERS[id].name}(으)로 바뀌었어요.`, null, 'weather');
  setTimeout(() => rollWeather(), weather.until - now());
}

// ---------- 낚시 ----------
function clearFishing(s, notifyOthers = true) {
  if (s.fs?.timers) s.fs.timers.forEach(clearTimeout);
  s.fs = null;
  if (notifyOthers) s.dirtyFish = true;
}

function handleCast(s, m) {
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
  const waitMs = (5 + Math.random() * 11) * eff.biteMult * 1000;
  const fs = { phase: 'wait', zone, bx: x, bz: z, baitId, timers: [], castAt: now() };
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
}

function doBite(s, fs) {
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
  fs.phase = 'bite';
  fs.fish = { f, size, variant };
  fs.fp = fp;
  fs.eff = eff;
  fs.biteAt = now();
  s.dirtyFish = true;
  send(s, 'bite', { window: fp.hookWindow });
  fs.timers.push(
    setTimeout(() => {
      if (s.fs !== fs || fs.phase !== 'bite') return;
      send(s, 'lost', { reason: 'miss' });
      clearFishing(s);
    }, (fp.hookWindow + 0.45) * 1000),
  );
}

function handleHook(s) {
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
  send(s, 'fight', { fp: fs.fp, tension: fs.eff.tension, reel: fs.eff.reel, p: size.p, tier: RARITY[f.rarity].index });
  fs.timers.push(
    setTimeout(() => {
      if (s.fs !== fs) return;
      send(s, 'lost', { reason: 'timeout' });
      clearFishing(s);
    }, 120000),
  );
}

function handleFightEnd(s, m) {
  const fs = s.fs;
  if (!fs || fs.phase !== 'fight') return;
  const elapsed = (now() - fs.fightAt) / 1000;
  if (!m.ok) {
    send(s, 'lost', { reason: m.reason === 'snap' ? 'snap' : 'escape' });
    return clearFishing(s);
  }
  if (elapsed < minFightSeconds(fs.fp, fs.eff.reel) * 0.8) {
    send(s, 'lost', { reason: 'escape' });
    return clearFishing(s);
  }
  const { f, size, variant } = fs.fish;
  clearFishing(s);
  grantFish(s, f, size, variant);
}

function grantFish(s, f, size, variant) {
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
  markDirty();
  sendMe(s);
  send(s, 'caught', { fish: rec, isNew, bonus, isRecord, autoSold });
  s.showUntil = now() + 4000;
  s.showFish = rec;
  broadcast('catchShow', { id: p.id, fish: rec }, s);
  if (isRecord) broadcast('records', { records: { [f.id]: db.records[f.id] } });

  // 알림
  const vName = variant ? `[${VARIANT[variant].name}] ` : '';
  const big = rarity.index >= 4 || variant || rec.q === 'monster';
  if (big) {
    // 채팅은 어두운 외곽선 위 밝은 글씨라 밝은 색을 씀
    const CHAT_COLOR = ['#e8e4dc', '#a8f090', '#9ccfff', '#dcb0ff', '#ffc070', '#ffa0dc'];
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

// ---------- 채집 ----------
function handleGather(s, m) {
  const node = NODE_BY_ID[m.id];
  if (!node) return;
  if (Math.hypot(node.x - s.x, node.z - s.z) > 5) return toast(s, '너무 멀어요.', 'warn');
  const type = NODE_TYPES[node.type];
  if (type.nightOnly && ctxNow().phase !== 'night') return toast(s, '반딧불이는 밤에만 나와요.', 'warn');
  if ((nodeState.get(node.id) || 0) > now()) return toast(s, '이미 누군가 가져갔어요. 잠시 후 다시 생겨요.', 'warn');
  const got = {};
  for (const [id, a, b, chance] of type.drops) {
    if (Math.random() < chance) got[id] = (got[id] || 0) + randInt(a, b);
  }
  const eff = effectsFor(s, NO_BAIT);
  if (eff.gatherBonus) {
    const first = type.drops[0][0];
    got[first] = (got[first] || 0) + eff.gatherBonus;
  }
  addItems(s.p, got);
  const until = now() + randInt(type.respawn[0], type.respawn[1]) * 1000;
  nodeState.set(node.id, until);
  broadcast('node', { id: node.id, until });
  markDirty();
  sendMe(s);
  send(s, 'gathered', { id: node.id, items: got });
}

// ---------- 제작 ----------
function essenceTotal(p) {
  return ESSENCES.reduce((a, e) => a + (p.items[e.id] || 0), 0);
}
function canCraft(p, r) {
  if (r.money && p.money < r.money) return false;
  if (r.out.rod && p.rods.includes(r.out.rod)) return false;
  return r.in.every((i) => (i.tag === 'essence' ? essenceTotal(p) >= i.n : hasItem(p, i.id, i.n)));
}
function handleCraft(s, m) {
  const r = RECIPE[m.id];
  if (!r) return;
  const p = s.p;
  const times = Math.max(1, Math.min(r.out.rod ? 1 : 99, Math.floor(Number(m.n) || 1)));
  let made = 0;
  for (let i = 0; i < times; i++) {
    if (!canCraft(p, r)) break;
    for (const inp of r.in) {
      if (inp.tag === 'essence') {
        let need = inp.n;
        // 싼 정수부터 소모
        for (const e of ESSENCES) {
          while (need > 0 && hasItem(p, e.id, 1)) {
            takeItem(p, e.id, 1);
            need--;
          }
        }
      } else takeItem(p, inp.id, inp.n);
    }
    if (r.money) p.money -= r.money;
    if (r.out.rod) {
      p.rods.push(r.out.rod);
      sysChat(`${p.name}님이 ${ROD[r.out.rod].name}을(를) 만들었어요!`, '#e0b8ff', 'rod');
    } else addItems(p, { [r.out.id]: r.out.n });
    made++;
  }
  if (!made) return toast(s, '재료가 부족해요.', 'warn');
  markDirty();
  sendMe(s);
  send(s, 'crafted', { id: r.id, n: made });
}

// ---------- 상점 / 가방 ----------
function nearShop(s) {
  return Math.hypot(s.x - POI.shop.x, s.z - POI.shop.z) < 9;
}
function sellMult(s) {
  return 1 + effectsFor(s, NO_BAIT).sellBonus;
}
function handleSellFish(s, m) {
  if (!nearShop(s)) return toast(s, '상점 주인에게 가야 팔 수 있어요.', 'warn');
  if (s.trade) return;
  const uids = new Set(Array.isArray(m.uids) ? m.uids : []);
  const mult = sellMult(s);
  let total = 0, count = 0;
  s.p.fish = s.p.fish.filter((f) => {
    if (!uids.has(f.uid) || f.lock) return true;
    total += Math.round(f.price * mult);
    count++;
    return false;
  });
  if (!count) return;
  s.p.money += total;
  s.p.earned += total;
  markDirty();
  sendMe(s);
  send(s, 'sold', { count, total });
}
function handleSellItem(s, m) {
  if (!nearShop(s)) return toast(s, '상점 주인에게 가야 팔 수 있어요.', 'warn');
  const it = ITEMS[m.id];
  const n = Math.floor(Number(m.n) || 0);
  if (!it || n <= 0 || !hasItem(s.p, it.id, n)) return;
  takeItem(s.p, it.id, n);
  const total = Math.round(it.value * n * sellMult(s));
  s.p.money += total;
  s.p.earned += total;
  markDirty();
  sendMe(s);
  send(s, 'sold', { count: n, total });
}
function handleBuy(s, m) {
  if (!nearShop(s)) return toast(s, '상점 주인에게 가야 살 수 있어요.', 'warn');
  const st = SHOP_STOCK.find((x) => x.id === m.id);
  const n = Math.max(1, Math.min(99, Math.floor(Number(m.n) || 1)));
  if (!st) return;
  if (s.p.money < st.price * n) return toast(s, '돈이 부족해요.', 'warn');
  s.p.money -= st.price * n;
  addItems(s.p, { [st.id]: n });
  markDirty();
  sendMe(s);
  toast(s, `${ITEMS[st.id].name} ${n}개를 샀어요.`, 'ok');
}
function handleBuyRod(s, m) {
  if (!nearShop(s)) return toast(s, '상점 주인에게 가야 살 수 있어요.', 'warn');
  const rod = ROD[m.id];
  if (!rod || rod.crafted || s.p.rods.includes(rod.id)) return;
  if (s.p.money < rod.price) return toast(s, '돈이 부족해요.', 'warn');
  s.p.money -= rod.price;
  s.p.rods.push(rod.id);
  s.p.rod = rod.id;
  markDirty();
  sendMe(s);
  broadcast('meta', { player: playerMeta(s) });
  toast(s, `${rod.name}을(를) 손에 넣었어요.`, 'ok');
  if (rod.tier >= 4) sysChat(`${s.p.name}님이 ${rod.name}을(를) 장만했어요!`, null, 'rod');
}
function handleEquipRod(s, m) {
  if (!s.p.rods.includes(m.id) || s.fs) return;
  s.p.rod = m.id;
  markDirty();
  sendMe(s);
  broadcast('meta', { player: playerMeta(s) });
}
function handleDismantle(s, m) {
  if (s.trade) return;
  const uids = new Set(Array.isArray(m.uids) ? m.uids : []);
  const got = {};
  s.p.fish = s.p.fish.filter((rec) => {
    if (!uids.has(rec.uid) || rec.lock) return true;
    const y = dismantleYield(FISH_BY_ID[rec.sp], rec);
    for (const [k, v] of Object.entries(y)) got[k] = (got[k] || 0) + v;
    return false;
  });
  if (!Object.keys(got).length) return;
  addItems(s.p, got);
  markDirty();
  sendMe(s);
  send(s, 'dismantled', { items: got });
}
function handleLock(s, m) {
  const f = s.p.fish.find((x) => x.uid === m.uid);
  if (!f) return;
  f.lock = !!m.lock;
  markDirty();
  sendMe(s);
}
function handleSelectBait(s, m) {
  if (m.id === null || (ITEMS[m.id]?.bait)) {
    s.p.bait = m.id;
    markDirty();
  }
}

// ---------- 채팅 ----------
function handleChat(s, m) {
  const text = String(m.text || '').trim().slice(0, 120);
  if (!text) return;
  const t = now();
  if (t - (s.lastChat || 0) < 700) return;
  s.lastChat = t;
  broadcast('chat', { from: s.p.name, color: s.p.color, text, id: s.p.id });
}

// ---------- 랭킹 ----------
function handleLeaderboard(s) {
  const players = Object.values(getDb().players);
  const top = (fn, n = 10) => players.map((p) => ({ name: p.name, color: p.color, v: fn(p) })).filter((x) => x.v).sort((a, b) => b.v - a.v).slice(0, n);
  send(s, 'leaderboard', {
    earned: top((p) => p.earned),
    dex: top((p) => Object.keys(p.dex).length),
    best: players
      .filter((p) => p.stats.best)
      .map((p) => ({ name: p.name, color: p.color, fish: p.stats.best }))
      .sort((a, b) => b.fish.price - a.fish.price)
      .slice(0, 10),
    catches: top((p) => p.stats.catches),
  });
}

// ---------- 이동 ----------
function handleState(s, m) {
  const x = Number(m.x), z = Number(m.z), y = Number(m.y), ry = Number(m.ry);
  if (![x, y, z, ry].every(Number.isFinite)) return;
  if (Math.abs(x) > 260 || Math.abs(z) > 260) return;
  const t = now();
  const dt = Math.max(0.05, (t - (s.lastState || t)) / 1000);
  s.lastState = t;
  // 순간이동 방지: 아주 큰 점프는 무시
  if (Math.hypot(x - s.x, z - s.z) > 14 * dt + 6) {
    send(s, 'teleport', { x: s.x, y: s.y, z: s.z });
    return;
  }
  s.x = x; s.y = y; s.z = z; s.ry = ry;
  s.a = m.a | 0;
  s.p.pos = { x, z };
}

const trade = createTradeSystem({ sessions, send, toast, sendMe, markDirty, hasItem, takeItem, addItems, itemsText, FISH_BAG_LIMIT, sysChat });

const HANDLERS = {
  st: handleState,
  cast: handleCast,
  hook: handleHook,
  fightEnd: handleFightEnd,
  cancel: (s) => s.fs && s.fs.phase !== 'fight' && clearFishing(s),
  gather: handleGather,
  craft: handleCraft,
  sellFish: handleSellFish,
  sellItem: handleSellItem,
  buy: handleBuy,
  buyRod: handleBuyRod,
  equipRod: handleEquipRod,
  dismantle: handleDismantle,
  lock: handleLock,
  bait: handleSelectBait,
  chat: handleChat,
  leaderboard: handleLeaderboard,
  tradeReq: trade.request,
  tradeRespond: trade.respond,
  tradeOffer: trade.offer,
  tradeLock: trade.lock,
  tradeConfirm: trade.confirm,
  tradeCancel: trade.cancel,
  ping: (s, m) => send(s, 'pong', { c: m.c, server: now() }),
};

// ---------- 연결 ----------
export function onConnection(ws) {
  let s = null;
  const helloTimeout = setTimeout(() => !s && ws.close(), 15000);

  ws.on('message', (raw) => {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (!m || typeof m.t !== 'string') return;
    if (!s) {
      if (m.t !== 'hello') return;
      const name = String(m.name || '').trim();
      if (!validName(name)) return ws.send(JSON.stringify({ t: 'loginFail', reason: '닉네임은 2~12자의 한글/영문/숫자만 가능해요.' }));
      const res = login(name, m.token, m.color);
      if (res.error) return ws.send(JSON.stringify({ t: 'loginFail', reason: res.error }));
      const p = res.player;
      for (const other of sessions.values()) {
        if (other.p.id === p.id) {
          send(other, 'kicked', { reason: '다른 곳에서 같은 닉네임으로 접속했어요.' });
          other.ws.close();
          onClose(other);
        }
      }
      clearTimeout(helloTimeout);
      let pos = p.pos;
      if (!pos || walkHeight(pos.x, pos.z) == null) pos = { x: POI.spawn.x, z: POI.spawn.z };
      s = { ws, p, x: pos.x, z: pos.z, y: walkHeight(pos.x, pos.z) ?? 3, ry: 0, a: 0, fs: null, buffs: [], trade: null, dirtyFish: false };
      sessions.set(p.id, s);
      const t = now();
      send(s, 'welcome', {
        token: res.token,
        me: publicProfile(p),
        players: [...sessions.values()].filter((o) => o !== s).map(playerMeta),
        nodes: Object.fromEntries([...nodeState.entries()].filter(([, u]) => u > t)),
        weather,
        serverTime: t,
        records: getDb().records,
        pos: { x: s.x, y: s.y, z: s.z },
      });
      sendBuffs(s);
      broadcast('join', { player: playerMeta(s) }, s);
      sysChat(`${p.name}님이 섬에 왔어요.`, null, 'join');
      return;
    }
    const h = HANDLERS[m.t];
    if (h) {
      try {
        h(s, m);
      } catch (e) {
        console.error('[game] handler error', m.t, e);
      }
    }
  });
  ws.on('close', () => {
    clearTimeout(helloTimeout);
    if (s) onClose(s);
  });
  ws.on('error', () => {});
}

function onClose(s) {
  if (sessions.get(s.p.id) !== s) return;
  clearFishing(s, false);
  trade.onLeave(s);
  sessions.delete(s.p.id);
  markDirty();
  broadcast('leave', { id: s.p.id });
  sysChat(`${s.p.name}님이 섬을 떠났어요.`, null, 'leave');
}

const PHASE_CODE = { wait: 2, bite: 3, fight: 4 };
function snapshot() {
  const t = now();
  const list = [];
  for (const s of sessions.values()) {
    const fs = s.fs;
    const show = s.showUntil > t ? 5 : 0;
    list.push([
      s.p.id,
      Math.round(s.x * 100) / 100,
      Math.round(s.y * 100) / 100,
      Math.round(s.z * 100) / 100,
      Math.round(s.ry * 100) / 100,
      s.a,
      fs ? PHASE_CODE[fs.phase] : show,
      fs ? Math.round(fs.bx * 10) / 10 : 0,
      fs ? Math.round(fs.bz * 10) / 10 : 0,
    ]);
  }
  if (list.length) broadcast('snap', { time: t, p: list });
}

export function startGame() {
  rollWeather(true);
  setInterval(snapshot, 100);
  // 버프 만료 정리 + 클라 동기화
  setInterval(() => {
    for (const s of sessions.values()) {
      const sig = activeBuffs(s).map((b) => b.id + b.until).join();
      if (sig !== s.buffSig) sendBuffs(s);
    }
  }, 3000);
  console.log(`[game] 채집 노드 ${NODES.length}개, 부두 ${PIER.z0}~${PIER.z1}`);
}

export function onlineCount() {
  return sessions.size;
}
