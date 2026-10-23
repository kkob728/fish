// 게임 데이터 무결성: id 중복, 참조 누락, 태그 오타 등
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FISH } from '../shared/data/fish.ts';
import { ITEMS, RECIPES, SHOP_STOCK, BAITS, ESSENCES, TACKLES } from '../shared/data/items.ts';
import { RARITY, VARIANTS, ROD } from '../shared/data/core.ts';
import { ZONE_ORDER } from '../shared/world.ts';
import { RECIPES as COOK, FOODS, EXTRA_FOOD_TAGS, TAG_NAME, FOOD_EFFECTS, TOOLS, TOOL_STEPS, fishTags } from '../shared/data/cooking.ts';

test('물고기: id 중복 없음, 지역·희귀도·무게 범위가 올바름', () => {
  const ids = new Set<string>();
  for (const f of FISH) {
    assert.ok(!ids.has(f.id), `중복 id ${f.id}`);
    ids.add(f.id);
    assert.ok(ZONE_ORDER.includes(f.zone), `${f.id} 지역`);
    assert.ok(RARITY[f.rarity], `${f.id} 희귀도`);
    assert.ok(f.minW > 0 && f.minW < f.maxW, `${f.id} 무게`);
    assert.ok(f.likes.length > 0, `${f.id} 좋아하는 미끼`);
  }
  for (const z of ZONE_ORDER) assert.ok(FISH.filter((f) => f.zone === z).length >= 10, `${z} 어종 수`);
});

test('아이템: 제작 레시피·상점 목록이 존재하는 아이템만 참조', () => {
  for (const r of RECIPES) {
    for (const i of r.in) if (i.id) assert.ok(ITEMS[i.id], `제작 ${r.id} 재료 ${i.id}`);
    if (r.out.id) assert.ok(ITEMS[r.out.id], `제작 ${r.id} 결과`);
    if (r.out.rod) assert.ok(ROD[r.out.rod], `제작 ${r.id} 낚싯대`);
  }
  for (const s of SHOP_STOCK) assert.ok(ITEMS[s.id] && s.price > 0, `상점 ${s.id}`);
  for (const b of BAITS) assert.ok(b.bite > 0, `미끼 ${b.id}`);
  for (const t of TACKLES) assert.ok(t.key, `도구 ${t.id} 단축키`);
  for (const e of ESSENCES) assert.ok(VARIANTS.some((v) => v.id === e.vid), `정수 ${e.id}`);
});

test('요리: 레시피 태그와 효과가 모두 정의됨', () => {
  const tools = new Set(TOOLS.map((t) => t.id));
  for (const r of COOK) {
    assert.ok(tools.has(r.tool), `${r.id} 도구`);
    assert.ok(FOOD_EFFECTS[r.effect], `${r.id} 효과`);
    for (const [tag] of r.needs) {
      if (tag.startsWith('sp:')) assert.ok(FISH.some((f) => f.id === tag.slice(3)), `${r.id} 물고기 ${tag}`);
      else assert.ok(TAG_NAME[tag], `${r.id} 태그 ${tag}`);
    }
  }
  for (const f of FOODS) for (const t of f.tags) assert.ok(TAG_NAME[t], `식재료 ${f.id} 태그 ${t}`);
  for (const [id, tags] of Object.entries(EXTRA_FOOD_TAGS)) {
    assert.ok(ITEMS[id], `채집 식재료 ${id}`);
    for (const t of tags) assert.ok(TAG_NAME[t], `${id} 태그 ${t}`);
  }
  for (const t of TOOLS) assert.ok(TOOL_STEPS[t.id]?.length, `${t.id} 미니게임`);
  // 모든 물고기가 요리 태그를 만들 수 있음
  for (const f of FISH) assert.ok(fishTags({ sp: f.id, w: 1, p: 0.5, q: 'normal', v: null, len: 10, price: 1 }).includes('fish'));
});
