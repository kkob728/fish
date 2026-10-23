// 텃밭 작물: 씨앗(상점 판매) → 실제 시간으로 자람 → 거두면 수확물
// 수확물은 요리 재료(텃밭 채소는 상점 것보다 품질이 좋음), 미끼 재료, 팔기용 작물로 나뉨

export interface Crop {
  id: string;
  name: string;
  kind: 'food' | 'bait' | 'sale' | 'special';
  from?: string; // 특별 작물: 씨앗이 나오는 바다 구역
  seed: number; // 씨앗 값
  min: number; // 물을 잘 줬을 때 다 자라는 데 걸리는 분
  yield: [number, number];
  out: string; // 거두면 나오는 아이템
  color: string; // 열매/잎 색 (아이콘·모델)
  look: 'root' | 'stalk' | 'bulb' | 'bush' | 'grain' | 'tree' | 'tall' | 'vine' | 'flower';
  desc: string;
}

export const CROPS: Crop[] = [
  { id: 'greenonion', name: '대파', kind: 'food', seed: 6, min: 10, yield: [2, 4], out: 'g_greenonion', color: '#7cbf55', look: 'stalk', desc: '금방 자라요.' },
  { id: 'radish', name: '무', kind: 'food', seed: 8, min: 15, yield: [2, 3], out: 'g_radish', color: '#f0f0e0', look: 'root', desc: '탕을 시원하게.' },
  { id: 'potato', name: '감자', kind: 'food', seed: 8, min: 20, yield: [2, 4], out: 'g_potato', color: '#c8a060', look: 'bush', desc: '튀겨도 조려도 좋아요.' },
  { id: 'garlic', name: '마늘', kind: 'food', seed: 8, min: 25, yield: [3, 5], out: 'g_garlic', color: '#f0e8d8', look: 'bulb', desc: '비린내를 잡아요.' },
  { id: 'chili', name: '고추', kind: 'food', seed: 10, min: 35, yield: [3, 5], out: 'g_chili', color: '#d8354a', look: 'bush', desc: '말려서 고춧가루 대신 써요.' },
  { id: 'rice', name: '벼', kind: 'food', seed: 12, min: 45, yield: [3, 5], out: 'g_rice', color: '#e8c860', look: 'grain', desc: '갓 찧은 쌀이 나와요.' },
  { id: 'lemon', name: '레몬', kind: 'food', seed: 15, min: 60, yield: [2, 4], out: 'g_lemon', color: '#f2e04e', look: 'tree', desc: '작은 레몬 나무.' },
  { id: 'berry', name: '산딸기', kind: 'bait', seed: 4, min: 15, yield: [3, 5], out: 'berry', color: '#d8354a', look: 'bush', desc: '열매 경단 재료.' },
  { id: 'corn', name: '옥수수', kind: 'bait', seed: 4, min: 20, yield: [3, 5], out: 'corn', color: '#f2c14e', look: 'tall', desc: '떡밥 재료.' },
  { id: 'sunflower', name: '해바라기', kind: 'sale', seed: 20, min: 25, yield: [1, 2], out: 'g_sunflower', color: '#f2c14e', look: 'flower', desc: '상점에 팔아요.' },
  { id: 'pumpkin', name: '호박', kind: 'sale', seed: 30, min: 40, yield: [1, 1], out: 'g_pumpkin', color: '#e8862a', look: 'vine', desc: '팔거나 요리에 써요.' },
  { id: 'watermelon', name: '수박', kind: 'sale', seed: 60, min: 70, yield: [1, 1], out: 'g_watermelon', color: '#4a9a3a', look: 'vine', desc: '오래 걸리지만 비싸요.' },
  // 특별 작물: 상점에서 팔지 않고, 바다 구역에서 물고기를 낚으면 가끔 씨앗이 딸려 나옴
  { id: 'seagrape', name: '바다포도', kind: 'special', from: 'reef', seed: 40, min: 30, yield: [2, 4], out: 'g_seagrape', color: '#3ac0a0', look: 'bush', desc: '산호초 물고기 뱃속에서 나온 씨앗.' },
  { id: 'stormpepper', name: '폭풍 고추', kind: 'special', from: 'open', seed: 60, min: 40, yield: [2, 4], out: 'g_stormpepper', color: '#8a3af0', look: 'bush', desc: '먼바다에서 건진 보랏빛 씨앗.' },
  { id: 'frostmelon', name: '서리 멜론', kind: 'special', from: 'ice', seed: 120, min: 60, yield: [1, 1], out: 'g_frostmelon', color: '#a8e0f8', look: 'vine', desc: '얼음 바다에서 얼어붙은 채 건진 씨앗.' },
  { id: 'glowbulb', name: '심해 등불꽃', kind: 'special', from: 'trench', seed: 200, min: 70, yield: [1, 1], out: 'g_glowbulb', color: '#60f0e0', look: 'flower', desc: '해구 바닥의 빛을 머금은 씨앗.' },
];
export const CROP: Record<string, Crop> = Object.fromEntries(CROPS.map((c) => [c.id, c]));

// 수확물 아이템. home: 텃밭에서 길러 요리 품질이 좋음
export const PRODUCE = [
  { id: 'g_greenonion', name: '텃밭 대파', tags: ['veg', 'aroma'], value: 6, desc: '갓 뽑은 대파.' },
  { id: 'g_radish', name: '텃밭 무', tags: ['veg', 'radish'], value: 8, desc: '물이 많고 달다.' },
  { id: 'g_potato', name: '텃밭 감자', tags: ['veg', 'potato'], value: 8, desc: '포슬포슬하다.' },
  { id: 'g_garlic', name: '텃밭 마늘', tags: ['aroma'], value: 6, desc: '알이 굵다.' },
  { id: 'g_chili', name: '텃밭 고추', tags: ['spice'], value: 9, desc: '맵고 향긋하다.' },
  { id: 'g_rice', name: '햅쌀', tags: ['grain', 'rice'], value: 10, desc: '갓 찧은 쌀.' },
  { id: 'g_lemon', name: '텃밭 레몬', tags: ['acid', 'fruit'], value: 11, desc: '향이 진하다.' },
  { id: 'g_sunflower', name: '해바라기', tags: null, value: 60, desc: '꽃집에서 좋아한다.' },
  { id: 'g_pumpkin', name: '호박', tags: ['veg', 'sweet'], value: 150, desc: '크고 단 호박.' },
  { id: 'g_watermelon', name: '수박', tags: ['fruit', 'sweet'], value: 340, desc: '줄무늬가 선명한 수박.' },
  { id: 'g_seagrape', name: '바다포도', tags: ['seaweed', 'fruit'], value: 45, desc: '톡톡 터지는 초록 알갱이.' },
  { id: 'g_stormpepper', name: '폭풍 고추', tags: ['spice', 'veg'], value: 70, desc: '혀가 번쩍할 만큼 맵다.' },
  { id: 'g_frostmelon', name: '서리 멜론', tags: ['fruit', 'sweet'], value: 800, desc: '속살이 살얼음처럼 시원하다.' },
  { id: 'g_glowbulb', name: '심해 등불꽃', tags: null, value: 1500, desc: '어둠 속에서 은은하게 빛나는 꽃. 수집가들이 탐낸다.' },
].map((p) => ({ ...p, home: true, food: !!p.tags }));

export const SEEDS = CROPS.map((c) => ({ id: `seed_${c.id}`, name: `${c.name} 씨앗`, value: Math.max(1, Math.floor(c.seed / 2)), seed: c.id, desc: `${c.min}분 · ${c.desc}` }));
// 바다 구역 → 그 구역에서 나오는 특별 씨앗
export const SEA_SEED: Record<string, string> = Object.fromEntries(CROPS.filter((c) => c.from).map((c) => [c.from, `seed_${c.id}`]));
export const SEA_SEED_CHANCE = 0.07;
export const seedOf = (cropId: string) => `seed_${cropId}`;

// ---------- 밭 배치 ----------
// 캠프 동쪽 평지에 4×3 = 12개 밭. 밭 하나는 최대 4×4칸
export const FARM = { x: 61, z: 36, w: 38, d: 30, h: 6 };
export const PLOT_COLS = 4;
export const PLOT_ROWS = 3;
export const PLOT_COUNT = PLOT_COLS * PLOT_ROWS;
export const PLOT_PITCH = 8.6;
export const TILE = 1.5;
export const TILE_GRID = 4;
export const PLOT_SIZES = [6, 9, 12, 16];
export const EXPAND_PRICE: Record<number, number> = { 9: 1200, 12: 3500, 16: 8000 };

export function plotCenter(i: number) {
  const c = i % PLOT_COLS;
  const r = Math.floor(i / PLOT_COLS);
  return { x: FARM.x + (c - (PLOT_COLS - 1) / 2) * PLOT_PITCH, z: FARM.z + (r - (PLOT_ROWS - 1) / 2) * PLOT_PITCH };
}
export function tilePos(plot: number, idx: number) {
  const p = plotCenter(plot);
  const c = idx % TILE_GRID;
  const r = Math.floor(idx / TILE_GRID);
  return { x: p.x + (c - (TILE_GRID - 1) / 2) * TILE, z: p.z + (r - (TILE_GRID - 1) / 2) * TILE };
}
// 밭 크기별로 쓸 수 있는 칸: 6=3×2, 9=3×3, 12=4×3, 16=4×4
export function tileActive(size: number, idx: number) {
  const c = idx % TILE_GRID;
  const r = Math.floor(idx / TILE_GRID);
  const cols = size >= 12 ? 4 : 3;
  const rows = size === 6 ? 2 : size === 16 ? 4 : 3;
  return c < cols && r < rows;
}
export function inFarm(x: number, z: number, pad = 0) {
  return Math.abs(x - FARM.x) < FARM.w / 2 + pad && Math.abs(z - FARM.z) < FARM.d / 2 + pad;
}
// 그 밭 안(또는 가장자리 근처)에 서 있는지
export function nearPlot(plot: number, x: number, z: number, pad = 2.5) {
  const p = plotCenter(plot);
  const half = (TILE_GRID * TILE) / 2 + pad;
  return Math.abs(x - p.x) < half && Math.abs(z - p.z) < half;
}

// ---------- 자라기 ----------
// 칸 상태: c 작물, p 자란 정도(0~1), at 마지막 계산 시각, wet 물기가 마르는 시각
export interface Tile {
  c: string;
  p: number;
  at: number;
  wet: number;
}
export interface Farm {
  plot: number;
  size: number;
  tiles: (Tile | null)[];
}
export const WATER_MS = 20 * 60 * 1000; // 물 한 번에 20분
export const DRY_RATE = 0.4; // 마른 땅에서는 40% 속도

export function growthAt(t: Tile, now: number) {
  if (!t || t.p >= 1) return t ? 1 : 0;
  const crop = CROP[t.c];
  const dt = Math.max(0, now - t.at);
  const wetMs = Math.max(0, Math.min(now, t.wet) - t.at);
  const eff = Math.min(dt, wetMs) + Math.max(0, dt - wetMs) * DRY_RATE;
  return Math.min(1, t.p + eff / (crop.min * 60000));
}
export function advanceTile(t: Tile, now: number) {
  if (!t) return;
  t.p = growthAt(t, now);
  t.at = now;
}
export const isWet = (t: Tile, now: number) => !!t && t.wet > now;
// 0 씨앗, 1 새싹, 2 자라는 중, 3 다 자람
export const stageOf = (g: number) => (g >= 1 ? 3 : g >= 0.5 ? 2 : g >= 0.15 ? 1 : 0);
// 물을 계속 줬을 때 남은 분
export function minutesLeft(t: Tile, now: number) {
  const g = growthAt(t, now);
  return Math.ceil((1 - g) * CROP[t.c].min);
}
export function emptyFarm(plot: number): Farm {
  return { plot, size: 6, tiles: Array(TILE_GRID * TILE_GRID).fill(null) };
}
