// 요리 데이터: 식재료, 조리 도구, 레시피, 요리 효과
import { FISH_BY_ID } from './fish.ts';
import { RARITY } from './core.ts';

// ---------- 식재료 (상점 판매) ----------
// tags: 레시피가 요구하는 성질. value: 요리 가치 계산용 원가
export const FOODS = [
  { id: 'rice', name: '쌀', tags: ['grain', 'rice'], value: 8, price: 12, desc: '초밥과 죽의 기본.' },
  { id: 'radish', name: '무', tags: ['veg', 'radish'], value: 6, price: 9, desc: '탕에 넣으면 시원해진다.' },
  { id: 'greenonion', name: '대파', tags: ['veg', 'aroma'], value: 5, price: 8, desc: '향을 더한다.' },
  { id: 'garlic', name: '마늘', tags: ['aroma'], value: 5, price: 8, desc: '비린내를 잡는다.' },
  { id: 'chili', name: '고춧가루', tags: ['spice'], value: 8, price: 12, desc: '얼큰한 맛의 핵심.' },
  { id: 'soy', name: '간장', tags: ['sauce', 'soy'], value: 8, price: 12, desc: '조림과 구이 양념.' },
  { id: 'doenjang', name: '된장', tags: ['sauce', 'doenjang'], value: 8, price: 12, desc: '구수한 찌개 맛.' },
  { id: 'oil', name: '식용유', tags: ['oil'], value: 10, price: 14, desc: '튀김에 꼭 필요하다.' },
  { id: 'lemon', name: '레몬', tags: ['acid', 'fruit'], value: 9, price: 13, desc: '상큼한 산미.' },
  { id: 'vinegar', name: '식초', tags: ['acid'], value: 6, price: 9, desc: '새콤한 맛.' },
  { id: 'gim', name: '김', tags: ['gim'], value: 6, price: 9, desc: '김밥과 롤에.' },
  { id: 'potato', name: '감자', tags: ['veg', 'potato'], value: 6, price: 9, desc: '튀겨도 조려도 좋다.' },
  { id: 'tofu', name: '두부', tags: ['tofu'], value: 9, price: 13, desc: '찌개의 단골.' },
  { id: 'egg', name: '달걀', tags: ['egg'], value: 7, price: 10, desc: '반죽과 튀김옷에.' },
  { id: 'sugar', name: '설탕', tags: ['sweet'], value: 5, price: 8, desc: '단짠의 단.' },
].map((f) => ({ ...f, food: true }));

// 기존 재료 중 요리에 쓸 수 있는 것
export const EXTRA_FOOD_TAGS = {
  flour: ['grain', 'flour'],
  corn: ['veg', 'grain'],
  clam: ['shell'],
  shrimp: ['shrimp', 'shell'],
  seaweed: ['seaweed'],
  mushroom: ['veg', 'mushroom'],
  berry: ['fruit', 'sweet'],
};

export const TAG_NAME = {
  fish: '생선', white: '흰살 생선', red: '붉은살 생선', eel: '장어류', fresh: '민물고기', sea: '바닷고기', big: '큰 생선(5kg 이상)',
  legend: '전설 이상 물고기', grain: '곡물', rice: '쌀', flour: '밀가루', veg: '채소', radish: '무', aroma: '향신 채소', spice: '고춧가루',
  sauce: '장류', soy: '간장', doenjang: '된장', oil: '기름', acid: '신맛', fruit: '과일', gim: '김', potato: '감자', tofu: '두부',
  egg: '달걀', sweet: '단맛', shell: '조개·새우', shrimp: '새우', seaweed: '해초', mushroom: '버섯',
};

// ---------- 물고기 → 요리 태그 ----------
const RED = new Set(['mackerel', 'tuna', 'yellowtail', 'spanishmackerel', 'sardine', 'saury', 'salmon', 'masu', 'horsemackerel', 'taimen', 'lenok']);
const EEL_SHAPES = new Set(['eel', 'oarfish', 'dragon']);
const FRESH_ZONES = new Set(['lake', 'river', 'swamp', 'hotspring']);
export function fishTags(rec) {
  const f = FISH_BY_ID[rec.sp];
  const t = ['fish', RED.has(f.id) ? 'red' : 'white', FRESH_ZONES.has(f.zone) ? 'fresh' : 'sea'];
  if (EEL_SHAPES.has(f.look.shape)) t.push('eel');
  if (rec.w >= 5) t.push('big');
  if (RARITY[f.rarity].index >= 4) t.push('legend');
  t.push(`sp:${f.id}`);
  return t;
}

// ---------- 조리 도구 ----------
// 등급(1~3)이 오르면 미니게임 판정 구간이 넓어짐
export const TOOLS = [
  { id: 'board', name: '도마', desc: '회, 무침, 초밥', prices: [300, 1500, 6000] },
  { id: 'grill', name: '석쇠', desc: '구이, 꼬치', prices: [0, 1500, 6000] },
  { id: 'pot', name: '냄비', desc: '탕, 찌개, 조림, 죽', prices: [800, 3000, 10000] },
  { id: 'fryer', name: '튀김솥', desc: '튀김, 까스', prices: [1500, 5000, 15000] },
];
export const TOOL = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
export const STARTER_TOOLS = { grill: 1 };
export const TOOL_TOLERANCE = [0, 1, 1.25, 1.5];

// 도구별 미니게임 단계
export const TOOL_STEPS = {
  board: [
    { type: 'timing', name: '손질', hint: '움직이는 칼이 빨간 선에 올 때 누르세요 (4번)', presses: 4, zone: 0.14, speed: 1.25, mode: 'pingpong' },
    { type: 'timing', name: '담기', hint: '가운데에 맞춰 누르세요', presses: 1, zone: 0.12, speed: 1.6, mode: 'pingpong' },
  ],
  grill: [
    { type: 'sweep', name: '앞면 굽기', hint: '노릇노릇해질 때 눌러서 뒤집기', zone: 0.16, at: 0.68, duration: 3.2 },
    { type: 'sweep', name: '뒷면 굽기', hint: '조금 더 빨리 익어요', zone: 0.14, at: 0.7, duration: 2.4 },
  ],
  pot: [
    { type: 'hold', name: '불 조절', hint: '누르면 불이 세져요. 바늘을 초록 구간에 유지하세요', duration: 5, band: 0.2 },
    { type: 'timing', name: '간 맞추기', hint: '딱 맞을 때 누르세요', presses: 1, zone: 0.1, speed: 1.9, mode: 'pingpong' },
  ],
  fryer: [
    { type: 'hold', name: '기름 온도', hint: '높은 온도를 꾸준히 유지하세요', duration: 4, band: 0.15, high: true },
    { type: 'sweep', name: '건지기', hint: '황금빛일 때 건지세요', zone: 0.12, at: 0.62, duration: 1.9 },
  ],
};
// 서버 검증: 최소 소요 시간(초)
export const TOOL_MIN_SECONDS = { board: 2.2, grill: 4, pot: 5.5, fryer: 4.5 };

// ---------- 요리 효과 ----------
export const FOOD_EFFECTS = {
  zone: { name: '찌 구간', fmt: (v) => `찌 구간 +${Math.round(v * 100)}%p`, base: 0.08 },
  slow: { name: '물고기 둔화', fmt: (v) => `물고기 속도 -${Math.round(v * 100)}%`, base: 0.15 },
  bite: { name: '입질 속도', fmt: (v) => `입질 ${Math.round(v * 100)}% 빠름`, base: 0.3 },
  rare: { name: '희귀 확률', fmt: (v) => `희귀 확률 +${Math.round(v * 100)}%`, base: 0.25 },
  size: { name: '큰 개체', fmt: (v) => `큰 개체 +${Math.round(v * 100)}%`, base: 0.25 },
  variant: { name: '변이 확률', fmt: (v) => `변이 확률 ×${(1 + v).toFixed(1)}`, base: 0.8 },
  xp: { name: '경험치', fmt: (v) => `경험치 +${Math.round(v * 100)}%`, base: 0.3 },
  sell: { name: '판매가', fmt: (v) => `판매가 +${Math.round(v * 100)}%`, base: 0.15 },
  gain: { name: '감기 속도', fmt: (v) => `감기 속도 +${Math.round(v * 100)}%`, base: 0.15 },
};
// 별(1~5) → 효과 배율
export const starPower = (stars) => 0.4 + 0.15 * stars;
// 재료량(kg 환산) → 지속 시간(초)
export function dishDuration(mass) {
  return Math.round(Math.min(1200, Math.max(120, 120 + 90 * Math.log2(1 + mass))));
}
// 효과를 서버 버프 effect 형식으로
export function effectFor(type, stars, bonus = 1) {
  const v = FOOD_EFFECTS[type].base * starPower(stars) * bonus;
  switch (type) {
    case 'zone': return { value: v, effect: { zoneBonus: v } };
    case 'slow': return { value: v, effect: { slow: v } };
    case 'bite': return { value: v, effect: { biteSpeed: v } };
    case 'rare': return { value: v, effect: { rarityBonus: v } };
    case 'size': return { value: v, effect: { sizeBonus: v } };
    case 'variant': return { value: v, effect: { variantMult: v } };
    case 'xp': return { value: v, effect: { xpBonus: v } };
    case 'sell': return { value: v, effect: { sellBonus: v } };
    case 'gain': return { value: v, effect: { gain: v } };
  }
  return { value: 0, effect: {} };
}

// ---------- 레시피 ----------
// needs: [태그, 개수] — 재료들이 가진 태그로 충족. no: 들어가면 안 되는 태그. pri: 여러 개 맞을 때 우선순위
// mult: 재료 원가 대비 가치 배수. buy: 상점 레시피 가격 (없으면 발견해야만 알 수 있음)
const R = (id, name, tool, needs, opt) => ({ id, name, tool, needs, no: opt.no || [], pri: opt.pri || needs.length, mult: opt.mult || 2, effect: opt.effect, buy: opt.buy ?? null, desc: opt.desc || '', hidden: !!opt.hidden });
export const RECIPES = [
  // 도마
  R('sashimi', '생선회', 'board', [['sea', 1]], { effect: 'zone', mult: 1.8, buy: 200, desc: '갓 잡은 바닷고기를 얇게.' }),
  R('moreum', '모둠회', 'board', [['sea', 2]], { effect: 'zone', mult: 2.2, buy: 600, pri: 3, desc: '여러 생선을 한 접시에.' }),
  R('mulhoe', '물회', 'board', [['fish', 1], ['spice', 1], ['acid', 1]], { effect: 'bite', mult: 2.3, buy: 700, desc: '얼음 동동 새콤 매콤.' }),
  R('hoemuchim', '회무침', 'board', [['fish', 1], ['veg', 1], ['spice', 1]], { effect: 'rare', mult: 2.2, buy: 600, desc: '채소와 버무린 매콤한 회.' }),
  R('sushi', '생선초밥', 'board', [['fish', 1], ['rice', 1], ['acid', 1]], { effect: 'zone', mult: 2.5, buy: 900, desc: '새콤한 밥 위에 생선 한 점.' }),
  R('roll', '생선 김초밥', 'board', [['fish', 1], ['rice', 1], ['gim', 1]], { effect: 'size', mult: 2.4, buy: 800, desc: '김으로 돌돌 만 초밥.' }),
  R('ceviche', '세비체', 'board', [['fish', 1], ['acid', 1], ['veg', 1]], { effect: 'variant', mult: 2.3, no: ['spice'], desc: '레몬에 절인 남쪽 바다 요리.' }),
  R('salmonbowl', '붉은살 덮밥', 'board', [['red', 1], ['rice', 1], ['soy', 1]], { effect: 'gain', mult: 2.4, buy: 900, pri: 4, desc: '간장에 절인 붉은살 생선 덮밥.' }),
  // 석쇠
  R('grilled', '생선구이', 'grill', [['fish', 1]], { effect: 'slow', mult: 1.7, buy: 0, desc: '소금만 뿌려 구운 기본 중의 기본.' }),
  R('wholegrill', '통구이', 'grill', [['big', 1]], { effect: 'size', mult: 2, pri: 2, desc: '큰 생선을 통째로.' }),
  R('eelgrill', '장어구이', 'grill', [['eel', 1], ['soy', 1], ['sweet', 1]], { effect: 'gain', mult: 2.6, buy: 1200, pri: 4, desc: '달콤짭짤한 양념 장어.' }),
  R('redgrill', '등푸른 생선구이', 'grill', [['red', 1], ['aroma', 1]], { effect: 'xp', mult: 2.1, buy: 500, pri: 3, desc: '고소한 기름이 자글자글.' }),
  R('skewer', '생선꼬치', 'grill', [['fish', 1], ['veg', 1], ['mushroom', 1]], { effect: 'bite', mult: 2.2, buy: 600, pri: 4, desc: '채소와 번갈아 꽂은 꼬치.' }),
  R('clamgrill', '조개구이', 'grill', [['shell', 2]], { effect: 'sell', mult: 2, buy: 300, no: ['fish'], desc: '탁탁 입을 여는 조개.' }),
  R('mushroomgrill', '버섯구이', 'grill', [['mushroom', 2]], { effect: 'xp', mult: 2, buy: 200, no: ['fish'], desc: '늪 버섯의 숨은 맛.' }),
  // 냄비
  R('maeuntang', '매운탕', 'pot', [['fish', 1], ['spice', 1], ['veg', 1]], { effect: 'slow', mult: 2.4, buy: 800, pri: 4, desc: '낚시꾼의 소울푸드.' }),
  R('jiri', '맑은 지리탕', 'pot', [['fish', 1], ['radish', 1], ['aroma', 1]], { effect: 'zone', mult: 2.3, buy: 800, no: ['spice'], pri: 4, desc: '맑고 시원한 국물.' }),
  R('jorim', '생선조림', 'pot', [['fish', 1], ['soy', 1], ['veg', 1]], { effect: 'rare', mult: 2.3, buy: 700, no: ['spice'], desc: '밥도둑.' }),
  R('eojuk', '어죽', 'pot', [['fresh', 1], ['rice', 1]], { effect: 'xp', mult: 2.1, buy: 500, desc: '민물고기를 푹 고아 쑨 죽.' }),
  R('doenjangjjigae', '해물된장찌개', 'pot', [['shell', 1], ['doenjang', 1], ['tofu', 1]], { effect: 'gain', mult: 2.3, buy: 700, desc: '구수한 바다 냄새.' }),
  R('miyeokguk', '미역국', 'pot', [['seaweed', 1], ['soy', 1]], { effect: 'bite', mult: 2, buy: 300, desc: '든든한 한 그릇.' }),
  R('eomuktang', '어묵탕', 'pot', [['white', 1], ['flour', 1], ['radish', 1]], { effect: 'sell', mult: 2.3, buy: 700, pri: 4, desc: '직접 빚은 어묵이 둥둥.' }),
  R('bouillabaisse', '부야베스', 'pot', [['fish', 2], ['shell', 1], ['aroma', 1]], { effect: 'variant', mult: 2.7, pri: 5, desc: '항구 마을의 해물 스튜.' }),
  R('chueotang', '추어탕', 'pot', [['eel', 1], ['fresh', 1], ['doenjang', 1]], { effect: 'slow', mult: 2.6, pri: 5, desc: '기운이 펄펄 나는 보양식.' }),
  // 튀김솥
  R('fishcutlet', '생선까스', 'fryer', [['white', 1], ['flour', 1], ['egg', 1], ['oil', 1]], { effect: 'gain', mult: 2.4, buy: 900, desc: '바삭한 튀김옷.' }),
  R('fishnchips', '피시앤칩스', 'fryer', [['white', 1], ['potato', 1], ['flour', 1], ['oil', 1]], { effect: 'sell', mult: 2.5, buy: 1000, pri: 5, desc: '바다 건너 온 국민 간식.' }),
  R('shrimptempura', '새우튀김', 'fryer', [['shrimp', 1], ['flour', 1], ['oil', 1]], { effect: 'bite', mult: 2.3, buy: 600, desc: '통통한 새우 한 마리.' }),
  R('vegtempura', '모둠 채소튀김', 'fryer', [['veg', 2], ['flour', 1], ['oil', 1]], { effect: 'xp', mult: 2, buy: 400, no: ['fish'], desc: '바삭바삭 채소들.' }),
  R('friedfish', '통생선 튀김', 'fryer', [['fish', 1], ['oil', 1]], { effect: 'size', mult: 2, buy: 400, desc: '통째로 튀겨 뼈까지 바삭.' }),
  // 숨은 요리 (전설·신화 물고기)
  R('legendsashimi', '전설어 사시미', 'board', [['legend', 1]], { effect: 'rare', mult: 3, pri: 8, hidden: true, desc: '평생 한 번 먹을까 말까.' }),
  R('legendgrill', '전설어 숯불구이', 'grill', [['legend', 1]], { effect: 'variant', mult: 3, pri: 8, hidden: true, desc: '향만으로 사람들이 모여든다.' }),
  R('legendstew', '전설 보양탕', 'pot', [['legend', 1], ['aroma', 1]], { effect: 'zone', mult: 3.2, pri: 9, hidden: true, desc: '한 숟갈에 기운이 넘친다.' }),
  R('imugistew', '이무기 보양탕', 'pot', [['sp:imugi', 1], ['aroma', 1], ['doenjang', 1]], { effect: 'slow', mult: 4, pri: 12, hidden: true, desc: '용이 되지 못한 한이 녹아 있다.' }),
  R('dragonfeast', '용궁 정찬', 'board', [['sp:coraldragon', 1], ['rice', 1], ['gim', 1]], { effect: 'rare', mult: 4, pri: 12, hidden: true, desc: '용왕의 식탁에 오르던 요리.' }),
  R('phoenixgrill', '불사조 숯불구이', 'grill', [['sp:phoenixcarp', 1], ['soy', 1]], { effect: 'variant', mult: 4, pri: 12, hidden: true, desc: '불꽃이 꺼지지 않는 구이.' }),
];
export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));

// 레시피를 못 맞췄을 때 나오는 요리
export const MYSTERY = {
  board: { id: 'mystery_board', name: '정체불명의 회', effect: 'zone', mult: 1.1 },
  grill: { id: 'mystery_grill', name: '정체불명의 구이', effect: 'slow', mult: 1.1 },
  pot: { id: 'mystery_pot', name: '정체불명의 국', effect: 'bite', mult: 1.1 },
  fryer: { id: 'mystery_fryer', name: '정체불명의 튀김', effect: 'xp', mult: 1.1 },
};

// 재료 목록(각 재료의 태그 배열들)으로 맞는 레시피 찾기
export function matchRecipe(tool, tagLists) {
  const all = tagLists.flat();
  const count = (tag) => tagLists.filter((t) => t.includes(tag)).length;
  let best = null;
  for (const r of RECIPES) {
    if (r.tool !== tool) continue;
    if (r.no.some((t) => all.includes(t))) continue;
    if (!r.needs.every(([tag, n]) => count(tag) >= n)) continue;
    if (!best || r.pri > best.pri) best = r;
  }
  return best;
}

// 별점: 미니게임 점수(0~1 평균)와 재료 품질(1~5)
export function dishStars(score, ingredientStars) {
  const g = score < 0.2 ? 1 : score < 0.45 ? 2 : score < 0.7 ? 3 : score < 0.9 ? 4 : 5;
  return Math.max(1, Math.min(5, Math.round(g * 0.75 + ingredientStars * 0.25)));
}

export const DISH_LIMIT = 40;
export const FOOD_BY_ID = Object.fromEntries(FOODS.map((f) => [f.id, f]));
export function ingredientTags(id) {
  return FOOD_BY_ID[id]?.tags || EXTRA_FOOD_TAGS[id] || null;
}
