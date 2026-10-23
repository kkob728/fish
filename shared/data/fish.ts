// 어종 목록
// F(id, 이름, 지역, 희귀도, [최소kg, 최대kg], 기본가, 좋아하는 미끼 태그, 최대 길이(cm), 외형, 옵션)
// 외형: [모양, 등 색, 배 색, 무늬, 무늬 색, 지느러미 색]
// 옵션: time(출현 시간대), weather(출현 날씨), desc(도감 설명)

import type { FishSpecies, RarityId, PhaseId, WeatherId } from '../types.ts';

type FishOpt = { time?: PhaseId[]; weather?: WeatherId[]; desc?: string };
function F(id: string, name: string, zone: string, rarity: RarityId, w: [number, number], price: number, likes: string[], len: number, v: string[], opt: FishOpt = {}): FishSpecies {
  const [shape, c1, c2, pat = 'none', pc = '#000000', fin = null] = v;
  return {
    id, name, zone, rarity,
    minW: w[0], maxW: w[1],
    price, likes, len,
    look: { shape, c1, c2, pat, pc, fin: fin || c1 },
    time: opt.time || null,
    weather: opt.weather || null,
    desc: opt.desc || '',
  };
}

export const FISH: FishSpecies[] = [
  // ───── 잔잔한 호수 ─────
  F('crucian', '붕어', 'lake', 'common', [0.1, 1.2], 12, ['worm', 'paste'], 35, ['carp', '#6b6a3a', '#d9cf9a'], { desc: '어디서나 볼 수 있는 호수의 터줏대감.' }),
  F('chub', '피라미', 'lake', 'common', [0.02, 0.12], 8, ['worm', 'insect'], 15, ['minnow', '#7a8fa0', '#e8eef0', 'bands', '#c06a8a'], { desc: '산란기엔 몸에 분홍빛 띠가 생긴다.' }),
  F('bluegill', '블루길', 'lake', 'common', [0.05, 0.6], 9, ['worm', 'insect'], 25, ['perch', '#3d5a6a', '#e0a050', 'bands', '#2a3a4a', '#2a4050'], { desc: '아가미 뚜껑의 검푸른 점이 특징.' }),
  F('barbel', '버들치', 'lake', 'common', [0.02, 0.15], 8, ['worm', 'fruit'], 15, ['minnow', '#8a7a5a', '#e0d8c0', 'spots', '#5a4a30'], { desc: '맑은 물을 좋아하는 작은 물고기.' }),
  F('bagrid', '동자개', 'lake', 'uncommon', [0.1, 0.6], 40, ['worm', 'cut'], 30, ['catfish', '#b08a30', '#f0d890', 'blotch', '#5a4010'], { desc: '잡으면 "빠각빠각" 소리를 낸다.' }),
  F('carp', '잉어', 'lake', 'uncommon', [1, 14], 45, ['paste', 'fruit', 'worm'], 100, ['carp', '#8a6a2a', '#e8d090', 'none', '#000', '#a07030'], { desc: '수염 네 가닥, 힘센 민물의 왕.' }),
  F('bass', '배스', 'lake', 'uncommon', [0.4, 5], 55, ['lure', 'insect', 'cut'], 60, ['perch', '#4a6a2a', '#e8e8c0', 'blotch', '#2a3a1a'], { desc: '입이 커서 무엇이든 삼킨다.' }),
  F('catfish', '메기', 'lake', 'uncommon', [0.5, 12], 50, ['worm', 'cut'], 100, ['catfish', '#3a3a30', '#c8c0a0', 'spots', '#22221a'], { desc: '긴 수염으로 진흙 속 먹이를 찾는다.' }),
  F('mandarin', '쏘가리', 'lake', 'rare', [0.3, 3], 160, ['insect', 'cut', 'lure'], 50, ['perch', '#c8a040', '#f0e0b0', 'spots', '#4a3010'], { desc: '표범 무늬를 두른 민물의 사냥꾼.' }),
  F('koi', '비단잉어', 'lake', 'rare', [1, 12], 220, ['paste', 'fruit'], 90, ['carp', '#f4f0e8', '#ffffff', 'patches', '#e04020', '#f0e8e0'], { desc: '누군가 풀어 준 비단잉어가 야생에서 자랐다.' }),
  F('sturgeon', '철갑상어', 'lake', 'epic', [5, 60], 650, ['worm', 'cut', 'shell'], 250, ['sturgeon', '#5a6070', '#d0d0d0', 'none', '#000', '#4a5060'], { desc: '공룡 시대부터 살아온 갑옷 입은 물고기.' }),
  F('oldcarp', '백년 잉어', 'lake', 'legendary', [15, 45], 2400, ['paste', 'fruit'], 160, ['carp', '#d0d0c4', '#fffff0', 'none', '#000', '#e8e0c8'], { time: ['dawn', 'day'], desc: '수염이 하얗게 센 호수의 주인. 낮에만 모습을 보인다.' }),
  F('imugi', '이무기', 'lake', 'mythic', [60, 180], 12000, ['meat', 'glow'], 900, ['dragon', '#2a4a5a', '#a8c8c0', 'spots', '#6a9a8a', '#4a8a7a'], { time: ['night'], weather: ['rain', 'storm'], desc: '천 년을 채우지 못해 용이 되지 못한 뱀. 비 오는 밤에만 나타난다.' }),

  // ───── 굽이치는 강 ─────
  F('darkchub', '갈겨니', 'river', 'common', [0.02, 0.15], 8, ['insect', 'worm'], 18, ['minnow', '#5a6a80', '#e8e0d0', 'stripes', '#20283a'], { desc: '눈 위가 붉은 여울의 은빛 물고기.' }),
  F('gudgeon', '모래무지', 'river', 'common', [0.05, 0.3], 10, ['worm', 'paste'], 22, ['minnow', '#c8b088', '#f0e8d8', 'spots', '#7a6040'], { desc: '위험하면 모래 속으로 숨는다.' }),
  F('loach', '미꾸라지', 'river', 'common', [0.01, 0.08], 9, ['worm'], 18, ['eel', '#6a5a3a', '#c8b890', 'spots', '#3a3020'], { desc: '미끌미끌, 손에서 자꾸 빠져나간다.' }),
  F('aucha', '꺽지', 'river', 'common', [0.05, 0.35], 12, ['insect', 'worm'], 25, ['perch', '#5a5030', '#a89060', 'bands', '#3a3018'], { desc: '아가미에 파란 점이 있는 바위틈 물고기.' }),
  F('masu', '산천어', 'river', 'uncommon', [0.1, 1.2], 55, ['insect', 'fruit'], 35, ['salmon', '#6a7a8a', '#f0f0f0', 'parr', '#4a5060'], { desc: '바다로 가지 않고 강에 남은 송어.' }),
  F('sweetfish', '은어', 'river', 'uncommon', [0.05, 0.3], 60, ['fungus', 'insect'], 25, ['minnow', '#8a9a70', '#f0f0e0', 'lateral', '#e0c040'], { desc: '수박 향이 나는 맑은 강의 은빛 물고기.' }),
  F('skygazer', '끄리', 'river', 'uncommon', [0.2, 2], 50, ['lure', 'insect', 'cut'], 45, ['minnow', '#6a7a90', '#e0e8f0', 'bands', '#8a90c0'], { desc: '입이 ㄹ자로 굽은 강의 포식자.' }),
  F('lenok', '열목어', 'river', 'rare', [0.5, 5], 180, ['insect', 'lure'], 70, ['salmon', '#8a6a4a', '#e8d8c0', 'spots', '#3a2010', '#a05030'], { desc: '눈에 열이 많아 찬물만 찾는다는 물고기.' }),
  F('salmon', '연어', 'river', 'rare', [2, 15], 240, ['shrimp', 'cut', 'lure'], 100, ['salmon', '#5a7090', '#e8e8e8', 'spots', '#2a3040'], { desc: '태어난 강으로 돌아오는 여행자.' }),
  F('pike', '강꼬치고기', 'river', 'epic', [2, 18], 700, ['lure', 'cut'], 120, ['pike', '#5a7040', '#e8e8c0', 'dots', '#c8d090'], { desc: '오리 부리 같은 주둥이의 매복 사냥꾼.' }),
  F('lamprey', '칠성장어', 'river', 'epic', [0.3, 2.5], 520, ['cut', 'meat'], 70, ['eel', '#4a4a40', '#9a9a88', 'dots', '#d8d8c0'], { time: ['night', 'dusk'], desc: '눈 뒤에 일곱 개의 구멍. 밤에만 거슬러 오른다.' }),
  F('taimen', '타이멘', 'river', 'legendary', [10, 50], 3000, ['meat', 'cut', 'lure'], 180, ['salmon', '#7a4a3a', '#e8c8b0', 'spots', '#2a1a10', '#c04020'], { desc: '먼 북쪽 강에서 흘러온 강의 늑대.' }),
  F('habaek', '하백의 전령', 'river', 'mythic', [20, 80], 15000, ['glow', 'shrimp', 'meat'], 220, ['veil', '#3ac0e0', '#e0fff8', 'dots', '#ffffff', '#9ff0ff'], { weather: ['rain'], desc: '강의 신 하백이 보낸 사자. 비 오는 날에만 모습을 드러낸다.' }),

  // ───── 모래 해안 ─────
  F('goby', '망둥어', 'coast', 'common', [0.05, 0.4], 9, ['worm', 'shrimp'], 20, ['goby', '#8a7a5a', '#e0d8c0', 'spots', '#5a4a30'], { desc: '아무거나 덥석 무는 해안의 개구쟁이.' }),
  F('greenling', '노래미', 'coast', 'common', [0.1, 1], 12, ['shrimp', 'worm', 'shell'], 40, ['perch', '#6a5030', '#c0a080', 'blotch', '#4a3018'], { desc: '갯바위 근처를 맴도는 얼룩 물고기.' }),
  F('halfbeak', '학공치', 'coast', 'common', [0.05, 0.3], 11, ['shrimp', 'paste'], 35, ['gar', '#6a8a9a', '#f0f0f0', 'lateral', '#3a5a6a'], { desc: '아래턱만 길게 튀어나온 날씬한 물고기.' }),
  F('horsemackerel', '전갱이', 'coast', 'common', [0.1, 0.8], 12, ['shrimp', 'cut'], 40, ['minnow', '#6a8090', '#e8e8e8', 'lateral', '#c8c890'], { desc: '떼 지어 다니는 등 푸른 생선.' }),
  F('rockfish', '우럭', 'coast', 'uncommon', [0.3, 3], 50, ['shrimp', 'cut', 'shell'], 50, ['perch', '#4a4a40', '#9a9888', 'blotch', '#2a2a22'], { desc: '바위틈에 숨어 먹이를 노린다.' }),
  F('mackerel', '고등어', 'coast', 'uncommon', [0.2, 1.2], 45, ['cut', 'lure', 'shrimp'], 45, ['tuna', '#3a7a7a', '#f0f0f0', 'wavy', '#1a3a40'], { desc: '등에 물결무늬를 새긴 바다의 국민 생선.' }),
  F('flounder', '도다리', 'coast', 'uncommon', [0.2, 2], 60, ['worm', 'shell'], 40, ['flat', '#7a6a4a', '#f0f0e8', 'spots', '#4a3a2a'], { desc: '두 눈이 오른쪽으로 몰린 납작이.' }),
  F('seabream', '참돔', 'coast', 'rare', [0.5, 9], 280, ['shrimp', 'shell'], 90, ['perch', '#e06070', '#f8d0d0', 'dots', '#60c0ff', '#e07080'], { desc: '푸른 점을 흩뿌린 바다의 여왕.' }),
  F('seabass', '농어', 'coast', 'rare', [1, 12], 200, ['lure', 'cut', 'shrimp'], 100, ['salmon', '#6a7a80', '#f0f0f0', 'dots', '#3a4a50'], { desc: '파도치는 날 더 잘 무는 은빛 사냥꾼.' }),
  F('knifejaw', '돌돔', 'coast', 'epic', [0.5, 6], 650, ['shell', 'shrimp'], 60, ['perch', '#d0d0c0', '#f0f0e8', 'bands', '#202020'], { desc: '조개도 부수는 이빨. 갯바위 낚시꾼의 꿈.' }),
  F('halibut', '대왕 넙치', 'coast', 'epic', [3, 60], 520, ['cut', 'shell'], 150, ['flat', '#5a5040', '#f8f8f0', 'spots', '#3a3020'], { desc: '바닥에 붙으면 모래와 구별할 수 없다.' }),
  F('manta', '대왕 쥐가오리', 'coast', 'legendary', [100, 1200], 3500, ['shrimp', 'glow'], 500, ['ray', '#2a3040', '#f0f0f0', 'none', '#000', '#2a3040'], { desc: '수면 위로 날아오르는 바다의 망토.' }),
  F('coraldragon', '산호용', 'coast', 'mythic', [15, 60], 16000, ['shrimp', 'shell', 'glow'], 300, ['dragon', '#ff7a60', '#ffd0b0', 'dots', '#ffe066', '#ffb080'], { time: ['day'], weather: ['clear'], desc: '맑은 낮 산호초 위를 유영하는 용왕의 막내.' }),

  // ───── 안개 늪 ─────
  F('ricefish', '송사리', 'swamp', 'common', [0.005, 0.03], 6, ['insect', 'paste'], 5, ['minnow', '#b0b090', '#f0f0e0'], { desc: '손가락만 한 늪의 꼬마.' }),
  F('paradisefish', '버들붕어', 'swamp', 'common', [0.01, 0.06], 8, ['insect', 'worm'], 8, ['perch', '#6a5a7a', '#c09080', 'bands', '#c04040', '#c04040'], { desc: '거품으로 집을 짓는 화려한 물고기.' }),
  F('bitterling', '납자루', 'swamp', 'common', [0.01, 0.05], 8, ['paste', 'worm'], 9, ['carp', '#8a8aa0', '#f0e0e0', 'lateral', '#e06090'], { desc: '조개 속에 알을 낳는다.' }),
  F('mudskipper', '짱뚱어', 'swamp', 'common', [0.02, 0.15], 10, ['worm', 'insect'], 18, ['goby', '#6a6a50', '#a8a890', 'dots', '#a0e0ff'], { desc: '물 밖에서도 폴짝폴짝 뛰어다닌다.' }),
  F('snakehead', '가물치', 'swamp', 'uncommon', [0.5, 8], 70, ['cut', 'lure', 'insect'], 90, ['pike', '#3a4030', '#b0b090', 'blotch', '#1a2010'], { desc: '공기를 마시며 진흙 속에서도 버틴다.' }),
  F('swampeel', '드렁허리', 'swamp', 'uncommon', [0.1, 1], 55, ['worm', 'cut'], 60, ['eel', '#6a5a30', '#c0a870', 'spots', '#3a3018'], { desc: '논두렁에 구멍을 뚫는 뱀 같은 물고기.' }),
  F('sleeper', '동사리', 'swamp', 'uncommon', [0.05, 0.4], 45, ['worm', 'insect'], 20, ['goby', '#5a5040', '#a89878', 'blotch', '#2a2418'], { desc: '꼼짝 않고 있다가 순식간에 덮친다.' }),
  F('arowana', '아로와나', 'swamp', 'rare', [1, 6], 260, ['insect', 'lure'], 90, ['arowana', '#a8b0a0', '#f0f0e0', 'none', '#000', '#c04030'], { desc: '수면 위 벌레를 뛰어올라 낚아챈다.' }),
  F('lungfish', '폐어', 'swamp', 'rare', [2, 15], 220, ['worm', 'fungus'], 120, ['eel', '#6a6a50', '#b0a888', 'spots', '#3a3a28'], { desc: '물이 마르면 진흙 속에서 몇 년을 잔다.' }),
  F('gar', '앨리게이터 가아', 'swamp', 'epic', [10, 70], 750, ['cut', 'meat'], 250, ['gar', '#6a6a4a', '#d0c8a0', 'spots', '#3a3a20'], { desc: '악어 주둥이에 갑옷 비늘을 두른 괴어.' }),
  F('darkcloud', '먹구름 가물치', 'swamp', 'legendary', [12, 35], 2800, ['meat', 'cut', 'lure'], 150, ['pike', '#1a1a24', '#4a4a5a', 'blotch', '#000000', '#22222c'], { weather: ['fog', 'rain', 'cloudy'], desc: '흐린 날 수면 아래를 덮는 거대한 그림자.' }),
  F('dokkaebi', '도깨비 메기', 'swamp', 'mythic', [30, 120], 14000, ['meat', 'fungus', 'glow'], 280, ['catfish', '#4a3a6a', '#b0a0d0', 'spots', '#e0ff60', '#6a5a9a'], { time: ['night'], desc: '도깨비불을 수염에 달고 다니며 낚시꾼을 홀린다.' }),

  // ───── 심해 ─────
  F('sardine', '정어리', 'deep', 'common', [0.03, 0.2], 8, ['shrimp', 'paste'], 20, ['minnow', '#3a5a8a', '#e8f0f8', 'dots', '#1a2a4a'], { desc: '수만 마리가 떼를 지어 은빛 구름을 만든다.' }),
  F('saury', '꽁치', 'deep', 'common', [0.08, 0.25], 9, ['shrimp', 'cut'], 35, ['gar', '#3a4a8a', '#e0e8f0'], { desc: '가을 바다의 칼처럼 날씬한 생선.' }),
  F('filefish', '쥐치', 'deep', 'common', [0.1, 0.8], 10, ['shell', 'shrimp'], 30, ['perch', '#9a8a6a', '#e0d8c0', 'spots', '#6a5a3a'], { desc: '거친 껍질을 벗기면 맛이 좋다.' }),
  F('blackrockfish', '볼락', 'deep', 'common', [0.1, 0.8], 13, ['shrimp', 'lure', 'cut'], 30, ['perch', '#6a3a3a', '#c09080', 'blotch', '#3a1a1a'], { desc: '눈이 커서 밤바다에서도 잘 본다.' }),
  F('cutlass', '갈치', 'deep', 'uncommon', [0.3, 3], 60, ['cut', 'lure', 'glow'], 150, ['oarfish', '#c8d0d8', '#f0f0f8', 'none', '#000', '#e0e8f0'], { time: ['night', 'dusk'], desc: '서서 헤엄치는 은빛 칼. 밤에 올라온다.' }),
  F('yellowtail', '방어', 'deep', 'uncommon', [2, 15], 75, ['cut', 'lure', 'shrimp'], 100, ['tuna', '#3a5a7a', '#f0f0f0', 'lateral', '#f0d040', '#d0c040'], { desc: '겨울이 제철인 힘센 회유어.' }),
  F('spanishmackerel', '삼치', 'deep', 'uncommon', [1, 8], 65, ['cut', 'lure'], 100, ['tuna', '#5a7a9a', '#e8eef4', 'spots', '#2a4060'], { desc: '빠르고 이빨이 날카로운 등 푸른 생선.' }),
  F('sunfish', '개복치', 'deep', 'rare', [50, 800], 300, ['shrimp', 'shell'], 300, ['sunfish', '#8a96a0', '#e8ecef'], { desc: '거대한 몸집에 비해 마음이 몹시 여리다.' }),
  F('angler', '아귀', 'deep', 'rare', [2, 30], 250, ['cut', 'glow'], 100, ['angler', '#5a4a3a', '#a89070', 'spots', '#3a2a1a'], { time: ['night', 'dusk'], desc: '머리 위 등불로 먹이를 꾄다.' }),
  F('tuna', '참다랑어', 'deep', 'epic', [30, 400], 900, ['cut', 'meat', 'lure'], 300, ['tuna', '#1a2a5a', '#e0e8f0', 'finlets', '#f0d040', '#304070'], { desc: '바다를 가로지르는 근육 덩어리.' }),
  F('hammerhead', '귀상어', 'deep', 'epic', [40, 300], 850, ['meat', 'cut'], 400, ['hammerhead', '#6a7480', '#e8e8e8'], { desc: '망치 머리로 바닥의 먹이를 탐지한다.' }),
  F('oarfish', '산갈치', 'deep', 'legendary', [20, 250], 3200, ['glow', 'shrimp'], 800, ['oarfish', '#c8ccd8', '#f0f0f8', 'dots', '#8a9ab0', '#e03040'], { desc: '대지진의 전조라 불리는 은빛 리본.' }),
  F('whiteshark', '백상아리', 'deep', 'legendary', [300, 1800], 4000, ['meat', 'cut'], 600, ['shark', '#6a7480', '#f0f0f0'], { desc: '바다의 정점. 줄을 잡은 손이 떨린다.' }),
  F('abyssal', '심연의 등불', 'deep', 'mythic', [200, 900], 20000, ['glow', 'meat'], 400, ['angler', '#10141e', '#3a3a5a', 'dots', '#60ffd0', '#1a2030'], { time: ['night'], desc: '칠흑 같은 바다 밑에서 거짓 별빛으로 먹이를 꾄다.' }),

  // ───── 화산 온천 ─────
  F('doctorfish', '닥터피쉬', 'hotspring', 'common', [0.01, 0.05], 10, ['paste', 'fungus'], 10, ['minnow', '#8a8a80', '#d8d8d0'], { desc: '발을 담그면 각질을 뜯어 먹는다.' }),
  F('sulfurgoby', '유황 망둑', 'hotspring', 'common', [0.02, 0.15], 12, ['worm', 'sulfur'], 15, ['goby', '#a09040', '#e8e0a0', 'spots', '#706020'], { desc: '유황 냄새가 몸에 배어 있다.' }),
  F('steamchub', '김서림 피라미', 'hotspring', 'common', [0.02, 0.1], 11, ['insect', 'sulfur'], 15, ['minnow', '#c0b0a8', '#f8f0e8', 'bands', '#ff8060'], { desc: '뜨거운 물에서 붉게 달아오른 피라미.' }),
  F('pebblecarp', '조약돌 붕어', 'hotspring', 'common', [0.2, 1.5], 14, ['paste', 'sulfur'], 30, ['carp', '#7a7068', '#c8c0b8', 'spots', '#5a5048'], { desc: '온천 바닥의 조약돌과 똑같이 생겼다.' }),
  F('lavascorp', '화산석 쏨뱅이', 'hotspring', 'uncommon', [0.2, 2], 70, ['cut', 'sulfur'], 35, ['perch', '#6a2a20', '#c06040', 'blotch', '#2a0a08'], { desc: '가시에 독이 있다. 맨손으로 잡지 말 것.' }),
  F('charcat', '숯검정 메기', 'hotspring', 'uncommon', [1, 10], 65, ['worm', 'cut', 'sulfur'], 90, ['catfish', '#2a2420', '#6a5a50', 'spots', '#ff6020'], { desc: '수염 끝이 불씨처럼 붉다.' }),
  F('steamflyer', '증기 날치', 'hotspring', 'uncommon', [0.1, 0.6], 75, ['shrimp', 'insect'], 30, ['flying', '#6a90b0', '#f0f0f0', 'none', '#000', '#c0e0ff'], { desc: '수증기를 타고 수면 위를 활공한다.' }),
  F('magmacarp', '마그마 잉어', 'hotspring', 'rare', [2, 12], 300, ['sulfur', 'paste'], 80, ['carp', '#c03010', '#ffb040', 'cracks', '#ffe060', '#ff6020'], { desc: '비늘 사이로 용암이 흐른다.' }),
  F('obsidianeel', '흑요석 장어', 'hotspring', 'rare', [1, 8], 280, ['sulfur', 'cut'], 120, ['eel', '#141418', '#3a3a48', 'none', '#000', '#2a2a38'], { desc: '유리처럼 매끈하고 검게 빛난다.' }),
  F('ventsturgeon', '열수구 철갑어', 'hotspring', 'epic', [10, 80], 900, ['sulfur', 'shell', 'meat'], 260, ['sturgeon', '#4a3a30', '#b08060', 'spots', '#ff8040'], { desc: '열수구 옆에서 수백 년을 살았다.' }),
  F('redscale', '적룡 비늘고기', 'hotspring', 'legendary', [10, 40], 3800, ['sulfur', 'meat', 'glow'], 160, ['arowana', '#c02020', '#ffb080', 'none', '#000', '#ffd040'], { desc: '용암 속을 헤엄쳤다는 전설의 붉은 비늘.' }),
  F('phoenixcarp', '불사조 잉어', 'hotspring', 'mythic', [8, 30], 18000, ['sulfur', 'fruit', 'glow'], 140, ['veil', '#ff6020', '#ffe080', 'dots', '#fff0a0', '#ff2040'], { time: ['dawn', 'dusk'], desc: '해가 뜨고 질 때 온천에서 다시 태어난다는 불꽃 지느러미.' }),
];

export const FISH_BY_ID: Record<string, FishSpecies> = Object.fromEntries(FISH.map((f) => [f.id, f]));
