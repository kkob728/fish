// 섬 바깥 바다: 배로만 갈 수 있는 낚시 구역, 작은 섬, 빙산·바위, 배 종류. 서버와 클라이언트가 똑같이 계산한다.
import { mulberry32, smoothstep, lerp } from './rng.ts';

export const SEA = {
  limit: 680, // 어떤 배든 갈 수 있는 끝
  near: 440, // 나룻배 한계 = 먼바다 시작
  reef: { x: 170, z: 320, r: 78 },
  ice: { x: -60, z: -500, r: 125 },
  trench: { x: -530, z: 150, r: 115 },
};

// 배를 띄우는 곳: 긴 부두 끝 오른쪽
export const DOCK = { x: 66.8, z: 219, ry: 0 };
// 조선소: 부두 들머리 옆 모래톱
export const SHIPYARD = { x: 72, z: 133 };

export interface Islet {
  id: string;
  name: string;
  x: number;
  z: number;
  r: number;
  h: number;
}
export const ISLETS: Islet[] = [
  { id: 'coral', name: '산호섬', x: 186, z: 338, r: 15, h: 2.2 },
  { id: 'lighthouse', name: '등대섬', x: 300, z: 30, r: 17, h: 4.5 },
  { id: 'gull', name: '갈매기 바위섬', x: -330, z: 330, r: 12, h: 3.2 },
  { id: 'frost', name: '서리섬', x: -10, z: -470, r: 14, h: 3 },
];

// 지형 높이에 바다 지형을 더함: 작은 섬은 솟고, 산호초는 얕음
export function seaHeight(x: number, z: number, h: number) {
  const rd = Math.hypot(x - SEA.reef.x, z - SEA.reef.z);
  if (rd < SEA.reef.r) h = Math.max(h, lerp(-3.2, h, smoothstep(SEA.reef.r * 0.6, SEA.reef.r, rd)));
  for (const s of ISLETS) {
    const d = Math.hypot(x - s.x, z - s.z);
    if (d > s.r * 1.7) continue;
    const t = d / s.r;
    const prof = t < 1 ? lerp(s.h, 0.35, smoothstep(0.3, 1, t)) : lerp(0.35, -9, smoothstep(1, 1.6, t));
    h = Math.max(h, prof);
  }
  return h;
}
export const isletAt = (x: number, z: number, pad = 0) => ISLETS.find((s) => Math.hypot(x - s.x, z - s.z) < s.r * 1.25 + pad) || null;

// 배로만 가는 낚시 구역
export function seaZone(x: number, z: number): 'reef' | 'ice' | 'trench' | 'open' | null {
  if (Math.hypot(x - SEA.reef.x, z - SEA.reef.z) < SEA.reef.r) return 'reef';
  if (Math.hypot(x - SEA.ice.x, z - SEA.ice.z) < SEA.ice.r) return 'ice';
  if (Math.hypot(x - SEA.trench.x, z - SEA.trench.z) < SEA.trench.r) return 'trench';
  if (Math.hypot(x, z) > SEA.near) return 'open';
  return null;
}

// ---------- 장애물 (배가 지나갈 수 없음) ----------
export interface Rock {
  x: number;
  z: number;
  r: number;
  kind: 'iceberg' | 'floe' | 'spire' | 'coral';
}
function scatter(kind: Rock['kind'], n: number, seed: number, c: { x: number; z: number; r: number }, rMin: number, rMax: number, gap: number) {
  const rnd = mulberry32(seed);
  const out: Rock[] = [];
  let tries = 0;
  while (out.length < n && tries++ < 4000) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * c.r * 0.95;
    const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
    const r = rMin + rnd() * (rMax - rMin);
    if (ISLETS.some((s) => Math.hypot(x - s.x, z - s.z) < s.r * 1.8 + r)) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r + gap)) continue;
    out.push({ x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, r: Math.round(r * 10) / 10, kind });
  }
  return out;
}
export const ROCKS: Rock[] = [
  ...scatter('iceberg', 9, 501, SEA.ice, 5, 11, 14),
  ...scatter('floe', 26, 502, SEA.ice, 2, 4.5, 6),
  ...scatter('spire', 12, 503, SEA.trench, 2.5, 6, 16),
  ...scatter('coral', 22, 504, SEA.reef, 1.2, 2.6, 5),
];
// 부표: 부두에서 각 구역으로 가는 길잡이
export const BUOYS = [
  { x: 90, z: 262, c: '#f05a3a' },
  { x: 130, z: 290, c: '#f05a3a' },
  { x: 232, z: 120, c: '#f0c040' },
  { x: 40, z: 300, c: '#f0f0f0' },
  { x: -180, z: 280, c: '#f0f0f0' },
  { x: -380, z: 200, c: '#40324a' },
  { x: -230, z: -330, c: '#a8e0ff' },
  { x: 480, z: 120, c: '#f0c040' },
];

// ---------- 배 ----------
export interface BoatSpec {
  tier: number;
  id: string;
  name: string;
  price: number;
  seats: number;
  speed: number; // 최고 속도 m/s
  turn: number; // 회전 rad/s
  len: number; // 선체 길이 (충돌 반지름 계산)
  storm: boolean; // 폭풍에도 나갈 수 있음
  desc: string;
}
export const BOATS: BoatSpec[] = [
  { tier: 1, id: 'rowboat', name: '나룻배', price: 3000, seats: 2, speed: 6.5, turn: 1.3, len: 3.6, storm: false, desc: '노를 저어 산호초까지 갈 수 있어요.' },
  { tier: 2, id: 'motorboat', name: '통통배', price: 20000, seats: 4, speed: 11, turn: 1.0, len: 5.6, storm: false, desc: '먼바다와 얼음 바다까지 나가요.' },
  { tier: 3, id: 'trawler', name: '원양 어선', price: 90000, seats: 6, speed: 13.5, turn: 0.75, len: 9, storm: true, desc: '해구까지 어디든. 폭풍에도 끄떡없어요.' },
];
export const BOAT = (tier: number) => BOATS[tier - 1];
export const BOAT_COLORS = ['#c0503a', '#e8a040', '#f0e0b0', '#4a8a5a', '#3a7ab8', '#2a3a5a', '#8a5aa8', '#f0f0ec'];
export const ZONE_BOAT: Record<string, number> = { reef: 1, open: 2, ice: 2, trench: 3 };

// 이 배가 갈 수 있는 곳인가 (구역 제한)
export function boatAllowed(tier: number, x: number, z: number) {
  const d = Math.hypot(x, z);
  if (d > SEA.limit) return false;
  if (tier < 2 && d > SEA.near) return false;
  if (tier < 3 && Math.hypot(x - SEA.trench.x, z - SEA.trench.z) < SEA.trench.r) return false;
  return true;
}
// 배가 부딪히는 곳인가 (얕은 물, 섬, 빙산, 바위). terrain은 world.ts의 terrainHeight
export function boatBlocked(terrain: (x: number, z: number) => number, x: number, z: number, radius = 1.2) {
  if (terrain(x, z) > -0.7) return true;
  for (const r of ROCKS) if (r.kind !== 'coral' && Math.hypot(x - r.x, z - r.z) < r.r + radius) return true;
  return false;
}
// 자리 위치 (배 기준, +z가 뱃머리). 0번은 선장
export function seatOffset(tier: number, i: number) {
  const SEATS = [
    [[0, -0.7], [0, 0.8]],
    [[0, -1.6], [-0.55, 0.2], [0.55, 0.2], [0, 1.6]],
    [[0, 1.5], [-1.0, 2.6], [1.0, 2.6], [-1.0, -2.0], [1.0, -2.0], [0, 3.3]],
  ][tier - 1];
  const [x, z] = SEATS[Math.min(i, SEATS.length - 1)];
  return { x, z };
}
// 앉는 면(나룻배·통통배) / 서는 갑판(원양 어선) 높이, 수면 기준
export const DECK_Y = [0.2, 0.38, 0.44];
export const SIT_DROP = 0.78; // 앉으면 몸 기준점이 앉는 면보다 이만큼 아래
export function seatWorld(b: { tier: number; x: number; z: number; ry: number }, i: number) {
  const o = seatOffset(b.tier, i);
  const c = Math.cos(b.ry), s = Math.sin(b.ry);
  return { x: b.x + o.x * c + o.z * s, z: b.z - o.x * s + o.z * c, y: DECK_Y[b.tier - 1] - (b.tier < 3 ? SIT_DROP : 0) };
}
