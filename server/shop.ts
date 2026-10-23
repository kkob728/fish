// 상점·제작·가방: 팔기, 사기, 낚싯대, 손질, 잠금, 미끼 선택
import { FISH_BY_ID } from '../shared/data/fish.ts';
import { ITEMS, RECIPE, SHOP_STOCK, ESSENCES } from '../shared/data/items.ts';
import type { CraftRecipe } from '../shared/data/items.ts';
import { ROD } from '../shared/data/core.ts';
import { POI } from '../shared/world.ts';
import { dismantleYield } from '../shared/fishing.ts';
import type { Profile } from '../shared/types.ts';
import {
  type Session, type Handler, send, broadcast, sysChat, toast, sendMe, markDirty, playerMeta, addItems, hasItem, takeItem, sellMult,
} from './core.ts';

export function nearShop(s: Session) {
  return Math.hypot(s.x - POI.shop.x, s.z - POI.shop.z) < 9;
}

// ---------- 제작 ----------
function essenceTotal(p: Profile) {
  return ESSENCES.reduce((a, e) => a + (p.items[e.id] || 0), 0);
}
function canCraft(p: Profile, r: CraftRecipe) {
  if (r.money && p.money < r.money) return false;
  if (r.out.rod && p.rods.includes(r.out.rod)) return false;
  return r.in.every((i) => (i.tag === 'essence' ? essenceTotal(p) >= i.n : hasItem(p, i.id, i.n)));
}
const craft: Handler = (s, m) => {
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
};

// ---------- 상점 ----------
const needShop = (s: Session, verb: string) => {
  if (nearShop(s)) return false;
  toast(s, `상점 주인에게 가야 ${verb} 수 있어요.`, 'warn');
  return true;
};

const sellFish: Handler = (s, m) => {
  if (needShop(s, '팔') || s.trade) return;
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
};
const sellItem: Handler = (s, m) => {
  if (needShop(s, '팔')) return;
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
};
const buy: Handler = (s, m) => {
  if (needShop(s, '살')) return;
  const st = SHOP_STOCK.find((x) => x.id === m.id);
  const n = Math.max(1, Math.min(99, Math.floor(Number(m.n) || 1)));
  if (!st) return;
  if (s.p.money < st.price * n) return toast(s, '돈이 부족해요.', 'warn');
  s.p.money -= st.price * n;
  addItems(s.p, { [st.id]: n });
  markDirty();
  sendMe(s);
  toast(s, `${ITEMS[st.id].name} ${n}개를 샀어요.`, 'ok');
};
const buyRod: Handler = (s, m) => {
  if (needShop(s, '살')) return;
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
};
const equipRod: Handler = (s, m) => {
  if (!s.p.rods.includes(m.id) || s.fs) return;
  s.p.rod = m.id;
  markDirty();
  sendMe(s);
  broadcast('meta', { player: playerMeta(s) });
};

// ---------- 가방 ----------
const dismantle: Handler = (s, m) => {
  if (s.trade) return;
  const uids = new Set(Array.isArray(m.uids) ? m.uids : []);
  const got: Record<string, number> = {};
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
};
const lock: Handler = (s, m) => {
  const f = s.p.fish.find((x) => x.uid === m.uid);
  if (!f) return;
  f.lock = !!m.lock;
  markDirty();
  sendMe(s);
};
const bait: Handler = (s, m) => {
  if (m.id === null || ITEMS[m.id]?.bait) {
    s.p.bait = m.id;
    markDirty();
  }
};

export const shopHandlers: Record<string, Handler> = { craft, sellFish, sellItem, buy, buyRod, equipRod, dismantle, lock, bait };
