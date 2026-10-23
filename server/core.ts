// 서버 공용 상태와 도우미: 접속 세션, 메시지 보내기, 아이템, 버프, 날씨, 경험치
import { publicProfile, markDirty } from './db.ts';
import { ITEMS, NO_BAIT } from '../shared/data/items.ts';
import { ROD, BUFF_RADIUS, gameHour, phaseOf } from '../shared/data/core.ts';
import { FOOD_EFFECTS } from '../shared/data/cooking.ts';
import { combineEffects } from '../shared/fishing.ts';
import { levelInfo } from '../shared/level.ts';
import type { Profile, Buff, Item } from '../shared/types.ts';

export interface Session {
  ws: { readyState: number; send: (s: string) => void; close: () => void };
  p: Profile;
  x: number;
  y: number;
  z: number;
  ry: number;
  a: number;
  fs: any; // 낚시 진행 상태 (fishing.ts)
  buffs: Buff[];
  trade: any;
  cook?: any;
  dirtyFish: boolean;
  buffSig?: string;
  lastChat?: number;
  lastState?: number;
  showUntil?: number;
  showFish?: unknown;
}
export type Handler = (s: Session, m: any) => void;

export const sessions = new Map<string, Session>();
export const now = () => Date.now();

// ---------- 날씨 (weather.ts 가 바꿈) ----------
export const world = { weather: { id: 'clear', until: 0 } };
export const ctxNow = () => ({ phase: phaseOf(gameHour(now())), weather: world.weather.id });

// ---------- 메시지 ----------
export function send(s: Session, t: string, data: object = {}) {
  if (s.ws.readyState === 1) s.ws.send(JSON.stringify({ t, ...data }));
}
export function broadcast(t: string, data: object = {}, except: Session | null = null) {
  const msg = JSON.stringify({ t, ...data });
  for (const s of sessions.values()) if (s !== except && s.ws.readyState === 1) s.ws.send(msg);
}
export function sysChat(text: string, color?: string | null, kind?: string) {
  broadcast('chat', { sys: true, text, color, kind });
}
export function toast(s: Session, text: string, kind = 'info', extra: object = {}) {
  send(s, 'toast', { text, kind, ...extra });
}
export function sendMe(s: Session) {
  send(s, 'me', { me: publicProfile(s.p) });
}
export function playerMeta(s: Session) {
  return { id: s.p.id, name: s.p.name, color: s.p.color, rod: s.p.rod };
}
export { markDirty };

// ---------- 아이템 ----------
export function addItems(p: Profile, map: Record<string, number>) {
  for (const [id, n] of Object.entries(map)) p.items[id] = (p.items[id] || 0) + n;
}
export function hasItem(p: Profile, id: string, n: number) {
  return (p.items[id] || 0) >= n;
}
export function takeItem(p: Profile, id: string, n: number) {
  p.items[id] -= n;
  if (p.items[id] <= 0) delete p.items[id];
}

// ---------- 버프 ----------
let globalBuffs: Buff[] = [];

// 먹은 요리 효과
export function foodBuff(p: Profile): Buff | null {
  const f = p.food;
  if (!f || f.until <= now()) return null;
  return { id: 'food', name: f.name, icon: 'food', desc: FOOD_EFFECTS[f.type].fmt(f.value), effect: f.effect, until: f.until, food: true };
}
export function activeBuffs(s: Session): Buff[] {
  const t = now();
  s.buffs = s.buffs.filter((b) => b.until > t);
  globalBuffs = globalBuffs.filter((b) => b.until > t);
  const food = foodBuff(s.p);
  return food ? [...s.buffs, ...globalBuffs, food] : [...s.buffs, ...globalBuffs];
}
export function sendBuffs(s: Session) {
  const list = activeBuffs(s);
  s.buffSig = list.map((b) => b.id + b.until).join();
  send(s, 'buffs', {
    list: list.map((b) => ({ id: b.id, name: b.name, icon: b.icon, desc: b.desc, until: b.until, global: !!b.global, food: !!b.food })),
  });
}
export function applyBuff(def: { id: string; name: string; icon: string; desc: string; duration: number; effect: Buff['effect']; global?: boolean }, from: Session) {
  const until = now() + def.duration * 1000;
  const buff: Buff = { id: def.id, name: def.name, icon: def.icon, desc: def.desc, effect: def.effect, until, global: !!def.global };
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
export function effectsFor(s: Session, bait: Item) {
  return combineEffects(ROD[s.p.rod], bait, activeBuffs(s));
}
export function sellMult(s: Session) {
  return 1 + effectsFor(s, NO_BAIT).sellBonus;
}

// ---------- 경험치 ----------
export function addXp(s: Session, amount: number) {
  const p = s.p;
  const before = levelInfo(p.xp).level;
  p.xp = (p.xp || 0) + Math.round(amount * (1 + (effectsFor(s, NO_BAIT).xpBonus || 0)));
  const after = levelInfo(p.xp).level;
  if (after > before) {
    send(s, 'levelUp', { level: after });
    if (after % 5 === 0) sysChat(`${p.name}님이 낚시 레벨 ${after}에 올랐어요!`, null, 'record');
  }
}

export const itemName = (id: string) => ITEMS[id]?.name || id;
