// 재료와 미끼, 제작 레시피, 상점 목록
import { FOODS } from './cooking.js';

export const MATERIALS = [
  // 채집
  { id: 'worm', name: '지렁이', icon: '🪱', value: 4, desc: '흙더미를 파면 나온다.' },
  { id: 'grub', name: '굼벵이', icon: '🐛', value: 5, desc: '썩은 통나무 속에 산다.' },
  { id: 'cricket', name: '귀뚜라미', icon: '🦗', value: 5, desc: '풀숲에서 뛰어다닌다.' },
  { id: 'berry', name: '산딸기', icon: '🍓', value: 3, desc: '달콤한 숲의 열매.' },
  { id: 'clam', name: '조개', icon: '🐚', value: 6, desc: '갯바위에 붙어 있다.' },
  { id: 'shrimp', name: '새우', icon: '🦐', value: 8, desc: '갯바위와 해초 사이에 숨어 있다.' },
  { id: 'seaweed', name: '해초', icon: '🌿', value: 3, desc: '해변에 밀려온 해초.' },
  { id: 'mushroom', name: '늪 버섯', icon: '🍄', value: 6, desc: '습한 늪에서 자란다.' },
  { id: 'firefly', name: '반딧불이', icon: '✨', value: 12, desc: '밤에만 늪과 강가에 나타난다.' },
  { id: 'moss', name: '이끼', icon: '🟩', value: 5, desc: '강가와 산의 바위에 낀다.' },
  { id: 'sulfur', name: '유황', icon: '🟨', value: 10, desc: '온천 분출구 주변의 노란 결정.' },
  // 상점
  { id: 'flour', name: '밀가루', icon: '🌾', value: 2, desc: '상점에서 판다.' },
  { id: 'corn', name: '옥수수', icon: '🌽', value: 2, desc: '상점에서 판다.' },
  { id: 'crumbs', name: '빵가루', icon: '🍞', value: 4, desc: '상점에서 판다.' },
  // 손질
  { id: 'fishmeat', name: '생선살', icon: '🥩', value: 5, desc: '물고기를 손질하면 얻는다.' },
  { id: 'scale', name: '비늘', icon: '🔹', value: 3, desc: '물고기를 손질하면 얻는다.' },
  { id: 'guts', name: '내장', icon: '🫀', value: 2, desc: '냄새가 고약하지만 물고기는 좋아한다.' },
  { id: 'shinyscale', name: '빛나는 비늘', icon: '💠', value: 40, desc: '희귀 이상 물고기에서 나온다.' },
];

export const ESSENCES = [
  { id: 'ess_moss', variant: 'moss', name: '이끼 정수', icon: '🔮', value: 150 },
  { id: 'ess_moon', variant: 'moon', name: '달빛 정수', icon: '🔮', value: 220 },
  { id: 'ess_ember', variant: 'ember', name: '잿불 정수', icon: '🔮', value: 220 },
  { id: 'ess_shadow', variant: 'shadow', name: '그림자 정수', icon: '🔮', value: 260 },
  { id: 'ess_ghost', variant: 'ghost', name: '유령 정수', icon: '🔮', value: 300 },
  { id: 'ess_storm', variant: 'storm', name: '뇌전 정수', icon: '🔮', value: 360 },
  { id: 'ess_crystal', variant: 'crystal', name: '수정 정수', icon: '🔮', value: 450 },
  { id: 'ess_celadon', variant: 'celadon', name: '청자 정수', icon: '🔮', value: 550 },
  { id: 'ess_nebula', variant: 'nebula', name: '성운 정수', icon: '🔮', value: 1500 },
].map((e) => ({ ...e, desc: `${e.name.replace(' 정수', '')} 변이 물고기를 손질하면 나온다.`, essence: true }));

// 미끼: tag가 물고기의 likes와 맞으면 출현 가중치 ×3 (tag 'all'은 모두에게 ×2)
// bite: 입질 대기 배수(작을수록 빠름), rarity: 희귀도 보너스, size: 크기 보너스, variant: 변이 확률 배수
export const BAITS = [
  { id: 'worm_bait', name: '지렁이 미끼', icon: '🪱', tag: 'worm', bite: 1.0, rarity: 0, size: 0, variant: 1, value: 6 },
  { id: 'paste', name: '떡밥', icon: '🟤', tag: 'paste', bite: 0.85, rarity: 0, size: 0, variant: 1, value: 3 },
  { id: 'insect_bait', name: '곤충 미끼', icon: '🦗', tag: 'insect', bite: 1.0, rarity: 0.05, size: 0, variant: 1, value: 6 },
  { id: 'berry_ball', name: '열매 경단', icon: '🍓', tag: 'fruit', bite: 0.95, rarity: 0.05, size: 0, variant: 1, value: 4 },
  { id: 'shrimp_bait', name: '새우 미끼', icon: '🦐', tag: 'shrimp', bite: 1.0, rarity: 0.05, size: 0.05, variant: 1, value: 10 },
  { id: 'shell_bait', name: '조개살 미끼', icon: '🐚', tag: 'shell', bite: 1.0, rarity: 0.08, size: 0.05, variant: 1, value: 7 },
  { id: 'cut_bait', name: '생선 토막', icon: '🍖', tag: 'cut', bite: 1.0, rarity: 0.05, size: 0.15, variant: 1, value: 6 },
  { id: 'chum', name: '냄새 폭탄', icon: '💩', tag: 'cut', bite: 0.45, rarity: 0, size: 0, variant: 1, value: 8 },
  { id: 'firefly_lure', name: '반딧불 루어', icon: '🌟', tag: 'glow', bite: 1.0, rarity: 0.2, size: 0.05, variant: 1.2, value: 20 },
  { id: 'spore_bait', name: '포자 미끼', icon: '🍄', tag: 'fungus', bite: 1.0, rarity: 0.1, size: 0, variant: 1.1, value: 8 },
  { id: 'sulfur_bait', name: '유황 경단', icon: '🟨', tag: 'sulfur', bite: 1.0, rarity: 0.1, size: 0.05, variant: 1.1, value: 10 },
  { id: 'silver_spoon', name: '은빛 스푼', icon: '🥄', tag: 'lure', bite: 1.05, rarity: 0.25, size: 0.1, variant: 1, value: 25 },
  { id: 'big_meat', name: '대물 미끼', icon: '🍗', tag: 'meat', bite: 1.3, rarity: 0.1, size: 0.5, variant: 1, value: 20 },
  { id: 'abyss_lure', name: '심해 발광 미끼', icon: '🔦', tag: 'glow', bite: 1.0, rarity: 0.35, size: 0.15, variant: 1.3, value: 50 },
  { id: 'odd_bait', name: '기묘한 미끼', icon: '🌀', tag: null, bite: 1.1, rarity: 0.05, size: 0, variant: 4, value: 160 },
  { id: 'myth_lure', name: '전설 유인구', icon: '🏮', tag: 'all', bite: 1.0, rarity: 0.6, size: 0.3, variant: 1.5, value: 900 },
].map((b) => ({ ...b, bait: true }));

export const NO_BAIT = { id: null, name: '맨바늘', icon: '🪝', tag: null, bite: 1.6, rarity: 0, size: 0, variant: 1, bare: true };

// 파이팅 소모품 — 파이팅 중 한 종류당 한 번씩 사용
export const TACKLES = [
  { id: 'landing_net', name: '뜰채', icon: '', key: '1', value: 40, desc: '진행도를 즉시 25% 채워요.' },
  { id: 'calm_bait', name: '진정 떡밥', icon: '', key: '2', value: 30, desc: '5초 동안 물고기가 40% 느려져요.' },
  { id: 'big_float', name: '큰 찌', icon: '', key: '3', value: 35, desc: '6초 동안 찌 구간이 30% 넓어져요.' },
  { id: 'tough_line', name: '질긴 낚싯줄', icon: '', key: '4', value: 45, desc: '이번 파이팅 동안 진행도가 절반만 떨어져요.' },
].map((t) => ({ ...t, tackle: true }));

export const ITEMS = Object.fromEntries([...MATERIALS, ...ESSENCES, ...BAITS, ...TACKLES, ...FOODS].map((i) => [i.id, i]));

// 제작: in 항목은 { id, n } 또는 { tag: 'essence', n } (아무 정수)
export const RECIPES = [
  { id: 'worm_bait', in: [{ id: 'worm', n: 1 }], out: { id: 'worm_bait', n: 2 } },
  { id: 'paste', in: [{ id: 'flour', n: 1 }, { id: 'corn', n: 1 }], out: { id: 'paste', n: 5 } },
  { id: 'insect_bait', in: [{ id: 'cricket', n: 1 }, { id: 'grub', n: 1 }], out: { id: 'insect_bait', n: 3 } },
  { id: 'berry_ball', in: [{ id: 'berry', n: 2 }, { id: 'flour', n: 1 }], out: { id: 'berry_ball', n: 4 } },
  { id: 'shrimp_bait', in: [{ id: 'shrimp', n: 1 }], out: { id: 'shrimp_bait', n: 2 } },
  { id: 'shell_bait', in: [{ id: 'clam', n: 1 }, { id: 'seaweed', n: 1 }], out: { id: 'shell_bait', n: 3 } },
  { id: 'cut_bait', in: [{ id: 'fishmeat', n: 2 }], out: { id: 'cut_bait', n: 3 } },
  { id: 'chum', in: [{ id: 'guts', n: 2 }, { id: 'crumbs', n: 1 }], out: { id: 'chum', n: 2 } },
  { id: 'firefly_lure', in: [{ id: 'firefly', n: 1 }, { id: 'scale', n: 2 }], out: { id: 'firefly_lure', n: 2 } },
  { id: 'spore_bait', in: [{ id: 'mushroom', n: 1 }, { id: 'moss', n: 1 }], out: { id: 'spore_bait', n: 3 } },
  { id: 'sulfur_bait', in: [{ id: 'sulfur', n: 1 }, { id: 'guts', n: 1 }, { id: 'flour', n: 1 }], out: { id: 'sulfur_bait', n: 3 } },
  { id: 'silver_spoon', in: [{ id: 'shinyscale', n: 1 }, { id: 'scale', n: 4 }], out: { id: 'silver_spoon', n: 3 } },
  { id: 'big_meat', in: [{ id: 'fishmeat', n: 4 }, { id: 'guts', n: 2 }], out: { id: 'big_meat', n: 2 } },
  { id: 'abyss_lure', in: [{ id: 'shinyscale', n: 2 }, { id: 'shrimp', n: 1 }, { id: 'firefly', n: 1 }], out: { id: 'abyss_lure', n: 2 } },
  { id: 'odd_bait', in: [{ tag: 'essence', n: 1 }, { id: 'fishmeat', n: 2 }], out: { id: 'odd_bait', n: 2 } },
  { id: 'myth_lure', in: [{ tag: 'essence', n: 3 }, { id: 'shinyscale', n: 5 }, { id: 'big_meat', n: 1 }], out: { id: 'myth_lure', n: 1 } },
  { id: 'landing_net', in: [{ id: 'seaweed', n: 4 }, { id: 'scale', n: 3 }], out: { id: 'landing_net', n: 1 } },
  { id: 'calm_bait', in: [{ id: 'paste', n: 2 }, { id: 'moss', n: 1 }], out: { id: 'calm_bait', n: 1 } },
  { id: 'big_float', in: [{ id: 'shinyscale', n: 1 }, { id: 'scale', n: 2 }], out: { id: 'big_float', n: 2 } },
  { id: 'tough_line', in: [{ id: 'seaweed', n: 3 }, { id: 'guts', n: 2 }], out: { id: 'tough_line', n: 1 } },
  {
    id: 'rod_nebula',
    in: [{ id: 'ess_nebula', n: 1 }, { id: 'ess_crystal', n: 2 }, { id: 'ess_storm', n: 2 }, { id: 'shinyscale', n: 30 }],
    money: 30000,
    out: { rod: 'nebula' },
  },
];
export const RECIPE = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

export const SHOP_STOCK = [
  { id: 'flour', price: 6 },
  { id: 'corn', price: 6 },
  { id: 'crumbs', price: 10 },
  { id: 'worm', price: 18 },
  { id: 'cricket', price: 18 },
  { id: 'shrimp', price: 28 },
  { id: 'landing_net', price: 120 },
  { id: 'calm_bait', price: 90 },
  { id: 'big_float', price: 100 },
  { id: 'tough_line', price: 140 },
  ...FOODS.map((f) => ({ id: f.id, price: f.price })),
];

export const FISH_BAG_LIMIT = 60;
export const STARTER_ITEMS = { worm_bait: 10, paste: 10, flour: 3, corn: 3, landing_net: 2, calm_bait: 2 };
