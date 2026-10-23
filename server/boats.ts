// 배: 조선소에서 사고 꾸미기, 부두에서 띄우기, 선장 조종, 함께 타기, 닻, 내리기.
// 위치는 선장 클라이언트가 보내고 서버는 속도·구역·충돌만 검사함
import { type Session, type Handler, sessions, now, world, send, broadcast, toast, sendMe, markDirty } from './core.ts';
import { clearFishing } from './fishing.ts';
import { terrainHeight, walkHeight, PIER } from '../shared/world.ts';
import { BOAT, BOAT_COLORS, DOCK, SHIPYARD, boatAllowed, seatWorld } from '../shared/sea.ts';

export interface Boat {
  owner: string;
  tier: number;
  color: string;
  name: string;
  x: number;
  z: number;
  ry: number;
  v: number;
  anchored: boolean;
  seats: (string | null)[]; // 자리마다 플레이어 id
  lastSt: number;
}
export const boats = new Map<string, Boat>();

const boatView = (b: Boat) => ({ owner: b.owner, tier: b.tier, color: b.color, name: b.name, x: b.x, z: b.z, ry: b.ry, v: b.v, anchored: b.anchored, seats: b.seats });
export const boatList = () => [...boats.values()].map(boatView);
const pushBoat = (b: Boat) => broadcast('boat', { boat: boatView(b) });
const isStorm = () => world.weather.id === 'storm';

// 탄 사람들의 위치를 배 위 자리로 맞춤
function placeRiders(b: Boat) {
  b.seats.forEach((id, i) => {
    const s = id && sessions.get(id);
    if (!s) return;
    const w = seatWorld(b, i);
    s.x = w.x;
    s.z = w.z;
    s.y = w.y;
    s.a = b.tier < 3 ? 5 : 0;
  });
}

// 가까운 걸을 수 있는 곳 (배에서 내릴 자리)
function landingSpot(x: number, z: number, maxR = 9) {
  for (let r = 1.5; r <= maxR; r += 1.5) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      const h = walkHeight(px, pz);
      if (h != null && h > -0.3) return { x: px, y: h, z: pz };
    }
  }
  return null;
}
const DOCK_LANDING = { x: PIER.x, y: PIER.deck, z: DOCK.z };

function unseat(s: Session, spot: { x: number; y: number; z: number }) {
  const b = s.boat ? boats.get(s.boat) : null;
  if (b) b.seats = b.seats.map((id) => (id === s.p.id ? null : id));
  if (s.fs) clearFishing(s);
  s.boat = null;
  s.seat = undefined;
  s.x = spot.x;
  s.y = spot.y;
  s.z = spot.z;
  s.a = 0;
  s.p.pos = { x: spot.x, z: spot.z };
  send(s, 'teleport', spot);
  send(s, 'ride', { owner: null });
}

// 배를 거둠: 탄 사람은 모두 spot 근처(없으면 부두 끝)에 내림
function stow(b: Boat, spot: { x: number; y: number; z: number } | null) {
  for (const id of b.seats) {
    const s = id && sessions.get(id);
    if (s) unseat(s, (spot && landingSpot(spot.x, spot.z, 4)) || spot || DOCK_LANDING);
  }
  boats.delete(b.owner);
  broadcast('boatGone', { owner: b.owner });
}

const nearShipyard = (s: Session) => Math.hypot(s.x - SHIPYARD.x, s.z - SHIPYARD.z) < 9;

const buyBoat: Handler = (s, m) => {
  if (!nearShipyard(s)) return toast(s, '조선소에 가까이 가야 해요.', 'warn');
  const tier = m.tier | 0;
  const spec = BOAT(tier);
  if (!spec) return;
  const cur = s.p.boat?.tier || 0;
  if (cur >= tier) return toast(s, '이미 그만한 배가 있어요.', 'warn');
  if (s.p.money < spec.price) return toast(s, '돈이 모자라요.', 'warn');
  if (boats.has(s.p.id)) return toast(s, '띄워 둔 배를 먼저 거둬 주세요.', 'warn');
  s.p.money -= spec.price;
  s.p.boat = { tier, color: s.p.boat?.color || BOAT_COLORS[0], name: s.p.boat?.name || `${s.p.name}호` };
  markDirty();
  sendMe(s);
  const josa = (spec.name.charCodeAt(spec.name.length - 1) - 0xac00) % 28 ? '을' : '를';
  toast(s, `${spec.name}${josa} 샀어요! 긴 부두 끝에서 E로 띄울 수 있어요.`, 'ok', { icon: 'boat' });
};

const boatStyle: Handler = (s, m) => {
  if (!s.p.boat) return;
  if (!nearShipyard(s)) return toast(s, '조선소에 가까이 가야 해요.', 'warn');
  const color = BOAT_COLORS.includes(m.color) ? m.color : s.p.boat.color;
  const name = String(m.name ?? s.p.boat.name).trim().slice(0, 10);
  if (!/^[\p{L}\p{N} _-]{1,10}$/u.test(name)) return toast(s, '배 이름은 1~10자의 한글, 영문, 숫자만 쓸 수 있어요.', 'warn');
  s.p.boat.color = color;
  s.p.boat.name = name;
  markDirty();
  sendMe(s);
  const b = boats.get(s.p.id);
  if (b) {
    b.color = color;
    b.name = name;
    pushBoat(b);
  }
  toast(s, '배를 새로 꾸몄어요.', 'ok', { icon: 'boat' });
};

const launch: Handler = (s) => {
  const own = s.p.boat;
  if (!own) return toast(s, '배가 없어요. 부두 들머리의 조선소에서 살 수 있어요.', 'warn');
  if (s.boat) return;
  if (s.fs || s.trade || s.cook) return;
  if (Math.hypot(s.x - DOCK.x, s.z - DOCK.z) > 12) return toast(s, '긴 부두 끝에서 띄울 수 있어요.', 'warn');
  const moored = boats.get(s.p.id);
  if (moored) {
    if (moored.seats.some(Boolean)) return toast(s, '내 배에 다른 사람이 타고 있어요.', 'warn');
    boats.delete(s.p.id);
    broadcast('boatGone', { owner: s.p.id });
  }
  if (isStorm() && !BOAT(own.tier).storm) return toast(s, '폭풍이 불어서 작은 배는 나갈 수 없어요. 원양 어선은 괜찮아요.', 'warn');
  const b: Boat = { owner: s.p.id, tier: own.tier, color: own.color, name: own.name, x: DOCK.x, z: DOCK.z, ry: DOCK.ry, v: 0, anchored: false, seats: Array(BOAT(own.tier).seats).fill(null), lastSt: now() };
  b.seats[0] = s.p.id;
  boats.set(s.p.id, b);
  s.boat = s.p.id;
  s.seat = 0;
  placeRiders(b);
  pushBoat(b);
  send(s, 'ride', { owner: b.owner, seat: 0 });
};

// 선장이 보내는 배 위치
const boatSt: Handler = (s, m) => {
  const b = s.boat ? boats.get(s.boat) : null;
  if (!b || s.seat !== 0) return;
  const x = Number(m.x), z = Number(m.z), ry = Number(m.ry), v = Number(m.v);
  if (![x, z, ry, v].every(Number.isFinite)) return;
  const t = now();
  const dt = Math.max(0.05, (t - b.lastSt) / 1000);
  b.lastSt = t;
  const spec = BOAT(b.tier);
  const ok = !b.anchored && Math.hypot(x - b.x, z - b.z) <= spec.speed * 1.6 * dt + 3 && boatAllowed(b.tier, x, z) && terrainHeight(x, z) < -0.3;
  if (!ok) {
    if (b.anchored && Math.hypot(x - b.x, z - b.z) < 0.5) {
      b.ry = ry;
      return placeRiders(b);
    }
    return send(s, 'boatFix', { x: b.x, z: b.z, ry: b.ry });
  }
  b.x = x;
  b.z = z;
  b.ry = ry;
  b.v = Math.max(-spec.speed, Math.min(spec.speed, v));
  placeRiders(b);
};

const anchor: Handler = (s, m) => {
  const b = s.boat ? boats.get(s.boat) : null;
  if (!b || s.seat !== 0) return;
  const on = !!m.on;
  if (b.anchored === on) return;
  b.anchored = on;
  b.v = 0;
  // 닻을 올리면 배 위에서 하던 낚시는 끝남
  if (!on)
    for (const id of b.seats) {
      const r = id && sessions.get(id);
      if (r?.fs) {
        clearFishing(r);
        send(r, 'lost', { reason: 'boat' });
      }
    }
  pushBoat(b);
};

const board: Handler = (s, m) => {
  if (s.boat || s.fs || s.trade) return;
  const b = boats.get(m.owner);
  if (!b) return;
  if (Math.hypot(s.x - b.x, s.z - b.z) > 7) return toast(s, '배에 더 가까이 가야 해요.', 'warn');
  const seat = b.owner === s.p.id ? (b.seats[0] ? -1 : 0) : b.seats.indexOf(null, 1);
  if (seat < 0) return toast(s, '자리가 꽉 찼어요.', 'warn');
  b.seats[seat] = s.p.id;
  s.boat = b.owner;
  s.seat = seat;
  placeRiders(b);
  pushBoat(b);
  send(s, 'ride', { owner: b.owner, seat });
  const cap = sessions.get(b.owner);
  if (cap && cap !== s) toast(cap, `${s.p.name}님이 배에 탔어요.`, 'info', { icon: 'boat' });
};

const leave: Handler = (s) => {
  const b = s.boat ? boats.get(s.boat) : null;
  if (!b) return;
  const spot = landingSpot(s.x, s.z);
  if (!spot) return toast(s, '육지나 부두 가까이 가야 내릴 수 있어요.', 'warn');
  if (s.seat === 0 && Math.hypot(b.x - DOCK.x, b.z - DOCK.z) < 30) {
    stow(b, spot);
    toast(s, '배를 거두고 내렸어요.', 'info', { icon: 'boat' });
  } else if (s.seat === 0) {
    b.anchored = true;
    b.v = 0;
    unseat(s, spot);
    pushBoat(b);
    toast(s, '배를 묶어 두고 내렸어요. 다시 타려면 배 옆에서 E를 누르세요.', 'info', { icon: 'boat' });
  } else {
    unseat(s, spot);
    pushBoat(b);
  }
};

// 접속이 끊기면: 선장이면 배를 거두고, 손님이면 자리만 비움
export function boatsOnLeave(s: Session) {
  // 내리고 묶어 둔 내 배도 거둠
  const own = boats.get(s.p.id);
  if (own && s.boat !== own.owner) stow(own, null);
  const b = s.boat ? boats.get(s.boat) : null;
  if (!b) return;
  if (b.owner === s.p.id) stow(b, null);
  else {
    b.seats = b.seats.map((id) => (id === s.p.id ? null : id));
    pushBoat(b);
  }
  s.boat = null;
}

// 폭풍이 오면 작은 배 선장에게 알림 (속도는 클라이언트가 줄임)
export function boatsOnWeather() {
  if (!isStorm()) return;
  for (const b of boats.values()) {
    if (BOAT(b.tier).storm) continue;
    for (const id of b.seats) {
      const r = id && sessions.get(id);
      if (r) toast(r, '폭풍이에요! 작은 배는 느려지고 많이 흔들려요. 항구로 돌아가는 게 좋아요.', 'warn', { icon: 'storm' });
    }
  }
}

// 스냅샷용: [주인, x, z, ry, v, 닻]
export const boatSnap = () => [...boats.values()].map((b) => [b.owner, Math.round(b.x * 100) / 100, Math.round(b.z * 100) / 100, Math.round(b.ry * 100) / 100, Math.round(b.v * 10) / 10, b.anchored ? 1 : 0]);

export const boatHandlers: Record<string, Handler> = { buyBoat, boatStyle, boatLaunch: launch, boatSt, boatAnchor: anchor, boatBoard: board, boatLeave: leave };
