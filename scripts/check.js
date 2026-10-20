// 데이터 무결성 + 확률 시뮬레이션
import { FISH } from '../shared/data/fish.js';
import { ITEMS, RECIPES, BAITS, NO_BAIT } from '../shared/data/items.js';
import { ROD, RARITIES, VARIANT } from '../shared/data/core.js';
import { combineEffects, rollSpecies, rollVariant, rollSize, makeFishRecord, catchTable } from '../shared/fishing.js';
import { ZONE_ORDER } from '../shared/world.js';

let errors = 0;
const err = (m) => { errors++; console.error('ERR', m); };
const ids = new Set();
for (const f of FISH) {
  if (ids.has(f.id)) err('dup fish ' + f.id);
  ids.add(f.id);
  if (!ZONE_ORDER.includes(f.zone)) err('zone ' + f.id);
  if (!RARITIES.find((r) => r.id === f.rarity)) err('rarity ' + f.id);
  if (!(f.minW < f.maxW)) err('weight ' + f.id);
}
for (const r of RECIPES) {
  for (const i of r.in) if (i.id && !ITEMS[i.id]) err('recipe in ' + r.id + ' ' + i.id);
  if (r.out.id && !ITEMS[r.out.id]) err('recipe out ' + r.id);
}
console.log('species', FISH.length, Object.fromEntries(ZONE_ORDER.map((z) => [z, FISH.filter((f) => f.zone === z).length])));

const ctx = { phase: 'day', weather: 'clear', zone: 'lake' };
for (const [rodId, baitId] of [['bamboo', 'worm_bait'], ['bamboo', null], ['keel', 'myth_lure']]) {
  const bait = baitId ? ITEMS[baitId] : NO_BAIT;
  const eff = combineEffects(ROD[rodId], bait, []);
  const tiers = {}; const q = {}; let v = 0; let money = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) {
    const f = rollSpecies('lake', bait, eff, ctx);
    const rec = makeFishRecord(f, rollSize(f, eff), rollVariant(eff, ctx));
    tiers[f.rarity] = (tiers[f.rarity] || 0) + 1; q[rec.q] = (q[rec.q] || 0) + 1; if (rec.v) v++; money += rec.price;
  }
  const pct = (o) => Object.fromEntries(Object.entries(o).map(([k, c]) => [k, (100 * c / N).toFixed(2) + '%']));
  console.log(rodId, baitId, pct(tiers), pct(q), 'variant', (100 * v / N).toFixed(2) + '%', 'avg$', (money / N).toFixed(0));
}
process.exit(errors ? 1 : 0);
