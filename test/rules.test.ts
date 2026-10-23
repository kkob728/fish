// 낚시 판정, 미니게임, 레벨, 요리 조합 규칙
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, NO_BAIT } from '../shared/data/items.ts';
import { ROD, RARITY, QUALITIES, qualityOf } from '../shared/data/core.ts';
import { FISH_BY_ID } from '../shared/data/fish.ts';
import { combineEffects, catchTable, rollSize, makeFishRecord, fishPrice, dismantleYield } from '../shared/fishing.ts';
import { createFight, minFightSeconds, zoneSize } from '../shared/minigame.ts';
import { levelInfo, levelPerks, xpToNext, MAX_LEVEL } from '../shared/level.ts';
import { matchRecipe, dishStars, dishDuration } from '../shared/data/cooking.ts';
import { mulberry32 } from '../shared/rng.ts';

const ctx = { phase: 'day', weather: 'clear' };

test('맨바늘은 고급 이하만, 미끼를 쓰면 희귀 이상도 나옴', () => {
  const bare = catchTable('lake', NO_BAIT, combineEffects(ROD.bamboo, NO_BAIT), ctx);
  assert.ok(bare.length > 0);
  assert.ok(bare.every(([f]) => RARITY[f.rarity].index <= 1));
  const worm = ITEMS.worm_bait;
  const baited = catchTable('lake', worm, combineEffects(ROD.bamboo, worm), ctx);
  assert.ok(baited.some(([f]) => RARITY[f.rarity].index >= 2));
});

test('시간·날씨 조건: 이무기는 비 오는 밤에만', () => {
  const bait = ITEMS.myth_lure;
  const eff = combineEffects(ROD.keel, bait);
  const has = (c) => catchTable('lake', bait, eff, c).some(([f]) => f.id === 'imugi');
  assert.equal(has({ phase: 'day', weather: 'clear' }), false);
  assert.equal(has({ phase: 'night', weather: 'rain' }), true);
});

test('크기·품질·가격: 범위 안이고 큰 개체일수록 비쌈', () => {
  const f = FISH_BY_ID.carp;
  const rand = mulberry32(1);
  for (let i = 0; i < 500; i++) {
    const size = rollSize(f, { sizeBonus: 0 }, rand);
    assert.ok(size.weight >= f.minW - 1e-6 && size.weight <= f.maxW + 1e-6);
    const rec = makeFishRecord(f, size, null);
    assert.equal(rec.q, qualityOf(size.p).id);
  }
  assert.ok(fishPrice(f, 0.99, null) > fishPrice(f, 0.1, null));
  assert.ok(fishPrice(f, 0.5, 'nebula') > fishPrice(f, 0.5, null) * 5);
  assert.equal(QUALITIES.length, 5);
});

test('손질: 희귀 이상은 빛나는 비늘, 변이는 정수를 줌', () => {
  const rec = { sp: 'mandarin', w: 1, p: 0.5, q: 'normal' as const, v: 'moon', len: 30, price: 100 };
  const y = dismantleYield(FISH_BY_ID.mandarin, rec, mulberry32(2));
  assert.ok(y.fishmeat >= 1 && y.shinyscale >= 1 && y.ess_moon === 1);
});

// 미니게임을 완벽하게 따라가는 플레이어
function perfectPlay(d: number, behavior: string, mods) {
  const f = createFight({ d, behavior }, mods, mulberry32(7));
  let t = 0;
  while (!f.state.result && t < 120) {
    const s = f.state;
    f.step(1 / 60, s.v < (s.fy - (s.y + s.zone / 2)) * 6);
    t += 1 / 60;
  }
  return { result: f.state.result, t };
}

test('미니게임: 잘하면 일반 물고기를 잡고, 최소 시간보다 빨리 끝나지 않음', () => {
  const mods = { tension: 100, reel: 1 };
  const r = perfectPlay(0.15, 'mixed', mods);
  assert.equal(r.result, 'win');
  assert.ok(r.t >= minFightSeconds({ d: 0.15 }, mods) * 0.99);
});

test('미니게임: 아무것도 안 하면 결국 놓침', () => {
  const f = createFight({ d: 0.5, behavior: 'dart' }, { tension: 100, reel: 1 }, mulberry32(3));
  let t = 0;
  while (!f.state.result && t < 120) {
    f.step(1 / 60, false);
    t += 1 / 60;
  }
  assert.equal(f.state.result, 'lose');
});

test('파이팅 도구: 뜰채는 진행도 +25%, 종류당 한 번만', () => {
  const f = createFight({ d: 0.3, behavior: 'mixed' }, { tension: 100, reel: 1 }, mulberry32(4));
  const before = f.state.progress;
  assert.equal(f.useTackle('landing_net'), true);
  assert.ok(Math.abs(f.state.progress - before - 0.25) < 1e-9);
  assert.equal(f.useTackle('landing_net'), false);
  assert.ok(minFightSeconds({ d: 0.3 }, { tension: 100, reel: 1 }, ['landing_net']) < minFightSeconds({ d: 0.3 }, { tension: 100, reel: 1 }));
});

test('낚싯대·레벨: 좋을수록 찌 구간이 넓고 물고기가 느림', () => {
  assert.ok(zoneSize(ROD.keel.tension) > zoneSize(ROD.bamboo.tension));
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(xpToNext(1)).level, 2);
  assert.equal(levelInfo(1e9).level, MAX_LEVEL);
  const p30 = levelPerks(30);
  assert.ok(p30.zoneBonus > 0.1 && p30.speedMult < 0.85 && levelPerks(1).zoneBonus === 0);
});

test('요리 조합: 대표 레시피가 맞게 고름', () => {
  const sea = ['fish', 'white', 'sea'];
  const fresh = ['fish', 'white', 'fresh'];
  const eel = ['fish', 'white', 'fresh', 'eel'];
  const name = (tool, lists) => matchRecipe(tool, lists)?.id ?? null;
  assert.equal(name('pot', [sea, ['spice'], ['veg', 'radish']]), 'maeuntang');
  assert.equal(name('pot', [sea, ['veg', 'radish'], ['aroma']]), 'jiri');
  assert.equal(name('pot', [fresh, ['grain', 'rice']]), 'eojuk');
  assert.equal(name('board', [sea, ['grain', 'rice'], ['acid', 'fruit']]), 'sushi');
  assert.equal(name('board', [sea, sea]), 'moreum');
  assert.equal(name('grill', [eel, ['sauce', 'soy'], ['sweet']]), 'eelgrill');
  assert.equal(name('pot', [['shell'], ['sweet']]), null);
  assert.ok(dishStars(1, 5) === 5 && dishStars(0, 1) === 1);
  assert.ok(dishDuration(100) > dishDuration(1) && dishDuration(0) >= 120);
});
