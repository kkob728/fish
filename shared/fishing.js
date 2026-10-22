// 낚시 판정 로직 — 서버가 실제로 굴리고, 클라이언트는 미리보기에 사용
import { FISH } from './data/fish.js';
import { RARITY, RARITIES, VARIANTS, VARIANT, BASE_VARIANT_CHANCE, QUALITY, qualityOf } from './data/core.js';
import { pickWeighted } from './rng.js';

// 지역별 희귀도 종 수 — 희귀도 전체 가중치를 종 수로 나눠서 종이 많은 등급이 과하게 나오지 않게
const tierCount = {};
for (const f of FISH) {
  tierCount[f.zone] ??= {};
  tierCount[f.zone][f.rarity] = (tierCount[f.zone][f.rarity] || 0) + 1;
}

export function speciesAvailable(f, ctx) {
  if (f.time && !f.time.includes(ctx.phase)) return false;
  if (f.weather && !f.weather.includes(ctx.weather)) return false;
  return true;
}

// 현재 효과 합산: 낚싯대 + 미끼 + 버프
// buffs: [{effect:{...}}]
export function combineEffects(rod, bait, buffs = []) {
  const e = {
    luck: rod.luck,
    rarityBonus: bait.rarity || 0,
    sizeBonus: bait.size || 0,
    biteMult: bait.bite || 1,
    variantMult: bait.variant || 1,
    tension: rod.tension,
    reel: rod.reel,
    gatherBonus: 0,
    sellBonus: 0,
  };
  for (const b of buffs) {
    const ef = b.effect || {};
    if (ef.rarityBonus) e.rarityBonus += ef.rarityBonus;
    if (ef.sizeBonus) e.sizeBonus += ef.sizeBonus;
    if (ef.biteSpeed) e.biteMult *= 1 - ef.biteSpeed;
    if (ef.variantMult) e.variantMult *= 1 + ef.variantMult;
    if (ef.tensionBonus) e.tension *= 1 + ef.tensionBonus;
    if (ef.gatherBonus) e.gatherBonus += ef.gatherBonus;
    if (ef.sellBonus) e.sellBonus += ef.sellBonus;
  }
  return e;
}

// 현재 조건에서 각 종의 출현 확률 (도감/미리보기와 서버 판정이 같은 표를 씀)
export function catchTable(zone, bait, eff, ctx) {
  const entries = [];
  for (const f of FISH) {
    if (f.zone !== zone) continue;
    if (!speciesAvailable(f, ctx)) continue;
    const ti = RARITY[f.rarity].index;
    if (bait.bare && ti >= 2) continue; // 맨바늘은 고급까지만
    let w = RARITY[f.rarity].weight / tierCount[zone][f.rarity];
    w *= 1 + (eff.luck + eff.rarityBonus) * ti * 0.6;
    if (bait.tag === 'all') w *= 2;
    else if (bait.tag && f.likes.includes(bait.tag)) w *= 3;
    entries.push([f, w]);
  }
  return entries;
}

export function rollSpecies(zone, bait, eff, ctx, rand = Math.random) {
  return pickWeighted(catchTable(zone, bait, eff, ctx), rand);
}

export function variantChance(eff) {
  return Math.min(0.5, BASE_VARIANT_CHANCE * eff.variantMult * (1 + eff.luck * 0.5));
}

export function rollVariant(eff, ctx, rand = Math.random) {
  if (rand() >= variantChance(eff)) return null;
  const entries = VARIANTS.map((v) => {
    let w = v.weight;
    const c = v.cond || {};
    if (c.zone && c.zone[ctx.zone] != null) w *= c.zone[ctx.zone];
    if (c.phase && c.phase[ctx.phase] != null) w *= c.phase[ctx.phase];
    if (c.weather && c.weather[ctx.weather] != null) w *= c.weather[ctx.weather];
    return [v.id, w];
  });
  return pickWeighted(entries, rand);
}

export function rollSize(f, eff, rand = Math.random) {
  const p = Math.pow(rand(), 1.8 / (1 + Math.max(0, eff.sizeBonus)));
  const weight = f.minW * Math.pow(f.maxW / f.minW, p);
  return { p, weight: Math.round(weight * 1000) / 1000 };
}

export function fishLength(f, weight) {
  return f.len * Math.cbrt(weight / f.maxW);
}

// 지역별 값 배수 — 깊고 어려운 곳일수록 비싸다
export const ZONE_VALUE = { lake: 2, river: 2, coast: 2, swamp: 2.5, deep: 3, hotspring: 3 };
// 입질까지 기다리는 시간(초), 미끼/버프의 입질 배수를 곱해서 씀
export function biteWaitSeconds(rand = Math.random) {
  return 2.5 + rand() * 5.5;
}

export function fishPrice(f, p, variantId) {
  const q = qualityOf(p);
  const vm = variantId ? VARIANT[variantId].mult : 1;
  return Math.max(1, Math.round(f.price * (ZONE_VALUE[f.zone] || 1) * q.mult * vm * (0.85 + 0.3 * p)));
}

// 파이팅 난이도/검증은 minigame.js
export { fightParams, minFightSeconds } from './minigame.js';

export function makeFishRecord(f, size, variantId, extra = {}) {
  const q = qualityOf(size.p);
  return {
    sp: f.id,
    w: size.weight,
    p: Math.round(size.p * 10000) / 10000,
    q: q.id,
    v: variantId || null,
    len: Math.round(fishLength(f, size.weight) * 10) / 10,
    price: fishPrice(f, size.p, variantId),
    ...extra,
  };
}

// 손질 결과
export function dismantleYield(f, rec, rand = Math.random) {
  const ti = RARITY[f.rarity].index;
  const out = {};
  out.fishmeat = Math.max(1, Math.round(1 + rec.p * 3 + ti * 0.5));
  out.scale = 1 + Math.floor(rand() * 2) + (ti >= 1 ? 1 : 0);
  out.guts = 1 + (rand() < rec.p ? 1 : 0);
  const shiny = [0, 0, 1, 2, 3, 5][ti];
  if (shiny) out.shinyscale = shiny;
  if (rec.v) out[`ess_${rec.v}`] = 1;
  return out;
}

export { RARITIES, QUALITY };
