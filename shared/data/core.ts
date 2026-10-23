// 희귀도, 품질 등급, 변이, 낚싯대, 시간/날씨

export const RARITIES = [
  { id: 'common', name: '일반', color: '#8a8f94', weight: 600 },
  { id: 'uncommon', name: '고급', color: '#4f9a3a', weight: 250 },
  { id: 'rare', name: '희귀', color: '#2f78c4', weight: 100 },
  { id: 'epic', name: '영웅', color: '#8a4ac8', weight: 22 },
  { id: 'legendary', name: '전설', color: '#d9781a', weight: 7 },
  { id: 'mythic', name: '신화', color: '#d23f9a', weight: 1.5 },
];
export const RARITY = Object.fromEntries(RARITIES.map((r, i) => [r.id, { ...r, index: i }]));

// 개체 크기 백분위(p) → 품질 등급
export const QUALITIES = [
  { id: 'small', name: '소형', max: 0.4, mult: 0.8, color: '#8a8f94', stars: 1 },
  { id: 'normal', name: '보통', max: 0.72, mult: 1.0, color: '#6b5a44', stars: 2 },
  { id: 'large', name: '대형', max: 0.9, mult: 1.4, color: '#2f78c4', stars: 3 },
  { id: 'trophy', name: '대물', max: 0.98, mult: 2.2, color: '#c8932a', stars: 4 },
  { id: 'monster', name: '괴물급', max: 1.01, mult: 4.0, color: '#d0463a', stars: 5 },
];
export function qualityOf(p) {
  return QUALITIES.find((q) => p < q.max) || QUALITIES[QUALITIES.length - 1];
}
export const QUALITY = Object.fromEntries(QUALITIES.map((q) => [q.id, q]));

// 특수 변이 — 어떤 종에든 붙을 수 있음
// cond: 조건별 출현 가중치 배수, buff: 잡았을 때 주변 플레이어에게 거는 파티 버프
export const VARIANTS = [
  {
    id: 'moss', name: '이끼', color: '#7dc35a', ink: '#3f7a2c', mult: 1.8, weight: 30,
    desc: '몸 위에 작은 숲이 자랐다.',
    cond: { zone: { swamp: 3 }, weather: { rain: 2 } },
    buff: { id: 'gather', name: '풍성한 채집', icon: '🌿', duration: 180, effect: { gatherBonus: 1 }, desc: '채집량 +1' },
  },
  {
    id: 'moon', name: '달빛', color: '#bcd8ff', ink: '#4a6aa8', mult: 2.5, weight: 22,
    desc: '달빛을 머금어 은은하게 빛난다.',
    cond: { phase: { night: 3, day: 0.3 } },
    buff: { id: 'moonblessing', name: '달의 가호', icon: '🌙', duration: 180, effect: { rarityBonus: 0.2 }, desc: '희귀 이상 확률 +20%' },
  },
  {
    id: 'ember', name: '잿불', color: '#ff7a2a', ink: '#c8501a', mult: 2.5, weight: 20,
    desc: '비늘 틈으로 불씨가 새어 나온다.',
    cond: { zone: { hotspring: 4 } },
    buff: { id: 'fire', name: '불꽃 의지', icon: '🔥', duration: 180, effect: { tensionBonus: 0.2 }, desc: '줄 최대 텐션 +20%' },
  },
  {
    id: 'shadow', name: '그림자', color: '#6a4a8a', ink: '#5a3a7a', mult: 3, weight: 16,
    desc: '빛을 삼키는 칠흑의 몸.',
    cond: { weather: { fog: 3 }, phase: { night: 1.5 } },
    buff: { id: 'calm', name: '고요한 물', icon: '🌫️', duration: 180, effect: { biteSpeed: 0.25 }, desc: '입질 대기 -25%' },
  },
  {
    id: 'ghost', name: '유령', color: '#a8fff0', ink: '#2a9a8a', mult: 3.5, weight: 12,
    desc: '손에 쥐어도 반쯤 비쳐 보인다.',
    cond: { phase: { night: 2.5, day: 0.2 }, weather: { fog: 2 } },
    buff: null,
  },
  {
    id: 'storm', name: '뇌전', color: '#ffe84a', ink: '#a8820a', mult: 4, weight: 8,
    desc: '몸 안에서 번개가 튄다.',
    cond: { weather: { storm: 6, rain: 1.5, clear: 0.5 } },
    buff: { id: 'thrill', name: '전율', icon: '⚡', duration: 120, effect: { biteSpeed: 0.35 }, desc: '입질 대기 -35%' },
  },
  {
    id: 'crystal', name: '수정', color: '#9ff0ff', ink: '#2a8aa8', mult: 5, weight: 6,
    desc: '투명한 결정으로 된 비늘.',
    cond: { weather: { clear: 2 } },
    buff: { id: 'clearwater', name: '맑은 물결', icon: '💎', duration: 180, effect: { sizeBonus: 0.3 }, desc: '크기 보너스 +0.3' },
  },
  {
    id: 'celadon', name: '청자', color: '#7ec8a8', ink: '#3a8a6a', mult: 6, weight: 4,
    desc: '도공이 빚은 듯한 비취빛 빙열 무늬.',
    cond: { phase: { day: 2, night: 0.4 } },
    buff: { id: 'artisan', name: '장인의 손길', icon: '🏺', duration: 180, effect: { sellBonus: 0.2 }, desc: '판매가 +20%' },
  },
  {
    id: 'nebula', name: '성운', color: '#c78bff', ink: '#7a3ac8', mult: 12, weight: 1,
    desc: '비늘 속에 은하가 소용돌이친다.',
    cond: { phase: { night: 2 } },
    buff: { id: 'starblessing', name: '별의 축복', icon: '🌌', duration: 300, effect: { variantMult: 1 }, desc: '변이 확률 ×2 (서버 전체)', global: true },
  },
];
export const VARIANT = Object.fromEntries(VARIANTS.map((v) => [v.id, v]));
export const BASE_VARIANT_CHANCE = 0.025;
export const BUFF_RADIUS = 45;

export const RODS = [
  { id: 'bamboo', tier: 1, name: '대나무 낚싯대', price: 0, tension: 100, reel: 1.0, luck: 0, range: 18, color: '#c8a85a' },
  { id: 'fiber', tier: 2, name: '유리섬유 낚싯대', price: 2000, tension: 125, reel: 1.15, luck: 0.05, range: 21, color: '#e8e8e0' },
  { id: 'carbon', tier: 3, name: '카본 낚싯대', price: 8000, tension: 155, reel: 1.3, luck: 0.1, range: 24, color: '#2a2a30' },
  { id: 'titanium', tier: 4, name: '티타늄 낚싯대', price: 25000, tension: 195, reel: 1.5, luck: 0.15, range: 27, color: '#a8b8c8' },
  { id: 'keel', tier: 5, name: '용골 낚싯대', price: 80000, tension: 250, reel: 1.75, luck: 0.25, range: 30, color: '#f0e8d0' },
  { id: 'nebula', tier: 5, name: '성운 낚싯대', price: null, tension: 300, reel: 2.0, luck: 0.4, range: 32, color: '#c78bff', crafted: true },
];
export const ROD = Object.fromEntries(RODS.map((r) => [r.id, r]));

// ---------- 시간 ----------
export const DAY_LENGTH_MS = 24 * 60 * 1000; // 게임 하루 = 24분
export const PHASES = {
  dawn: { name: '새벽', icon: '🌅' },
  day: { name: '낮', icon: '☀️' },
  dusk: { name: '저녁', icon: '🌇' },
  night: { name: '밤', icon: '🌙' },
};
// 서버 시작 시각 기준이 아닌 고정 epoch 기준 — 모든 클라이언트가 서버 시각 오프셋만 맞추면 됨
export function gameHour(now) {
  return (((now / DAY_LENGTH_MS) * 24 + 8) % 24 + 24) % 24; // epoch 0 = 오전 8시
}
export function phaseOf(hour) {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19) return 'dusk';
  return 'night';
}

export const WEATHERS = {
  clear: { name: '맑음', icon: '☀️', weight: 42 },
  cloudy: { name: '흐림', icon: '☁️', weight: 22 },
  rain: { name: '비', icon: '🌧️', weight: 18 },
  fog: { name: '안개', icon: '🌫️', weight: 12 },
  storm: { name: '폭풍', icon: '⛈️', weight: 6 },
};

export function formatKg(kg) {
  if (kg >= 100) return `${Math.round(kg).toLocaleString()} kg`;
  if (kg >= 1) return `${kg.toFixed(2)} kg`;
  return `${Math.round(kg * 1000)} g`;
}
export function formatLen(cm) {
  if (cm >= 100) return `${(cm / 100).toFixed(2)} m`;
  return `${cm.toFixed(1)} cm`;
}
