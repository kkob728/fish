// 요리: 조리대 깔기/거두기, 조리(재료 → 미니게임 → 요리), 먹기, 상점 판매, 진열 판매, 도구·레시피 구매
import crypto from 'node:crypto';
import { FISH_BY_ID } from '../shared/data/fish.ts';
import { ITEMS } from '../shared/data/items.ts';
import { QUALITY, VARIANT } from '../shared/data/core.ts';
import {
  TOOL, TOOL_MIN_SECONDS, RECIPE_BY_ID, MYSTERY, FOOD_EFFECTS, DISH_LIMIT, STARTER_TOOLS,
  fishTags, ingredientTags, matchRecipe, dishStars, dishDuration, effectFor,
} from '../shared/data/cooking.ts';
import { walkHeight, terrainHeight } from '../shared/world.ts';
import type { Profile, Dish } from '../shared/types.ts';
import { type Handler, type Session, sessions, now, send, broadcast, sysChat, toast, sendMe, markDirty, sendBuffs, hasItem, takeItem, addItems, addXp, sellMult } from './core.ts';
import { nearShop } from './shop.ts';

function createCooking() {
  const stations = new Map<string, any>(); // ownerId -> station

  const uid = () => crypto.randomBytes(5).toString('hex');
  const pub = (st) => ({
    owner: st.owner, name: st.name, x: st.x, z: st.z, ry: st.ry, tools: st.tools, cooking: st.cooking,
    display: st.display.map((d) => ({ uid: d.uid, rid: d.rid, name: d.name, tool: d.tool, stars: d.stars, price: d.price, v: d.v || null, effect: d.effect, power: d.power, dur: d.dur, value: d.value })),
  });
  const pushStation = (st) => broadcast('station', { station: pub(st) });

  function ensure(p: Profile) {
    p.tools ??= { ...STARTER_TOOLS };
    p.recipes ??= ['grilled'];
    p.dishes ??= [];
  }

  function stationOf(s) {
    return stations.get(s.p.id);
  }
  function nearStation(s, st, r = 6) {
    return st && Math.hypot(s.x - st.x, s.z - st.z) <= r;
  }

  function returnDisplay(st) {
    const owner = sessions.get(st.owner);
    if (!owner) return;
    for (const d of st.display) {
      const { price, ...dish } = d;
      owner.p.dishes.push(dish);
    }
    st.display = [];
  }

  function refundCook(s) {
    const c = s.cook;
    if (!c) return;
    for (const f of c.fish) s.p.fish.push(f);
    addItems(s.p, c.items);
    s.cook = null;
    const st = stationOf(s);
    if (st) {
      st.cooking = false;
      pushStation(st);
    }
  }

  return {
    ensure,
    list: () => [...stations.values()].map(pub),

    place(s, m) {
      ensure(s.p);
      if (s.fs || s.trade) return;
      const x = Number(m.x), z = Number(m.z);
      if (!Number.isFinite(x) || !Number.isFinite(z)) return;
      if (Math.hypot(x - s.x, z - s.z) > 4.5) return toast(s, '조리대는 가까이에만 깔 수 있어요.', 'warn');
      const h = walkHeight(x, z);
      if (h == null || terrainHeight(x, z) < -0.2) return toast(s, '여기엔 조리대를 깔 수 없어요. 마른 땅을 찾아 주세요.', 'warn');
      const old = stationOf(s);
      if (old) {
        if (s.cook) return toast(s, '요리 중에는 옮길 수 없어요.', 'warn');
        returnDisplay(old);
      }
      const st = { owner: s.p.id, name: s.p.name, x, z, ry: Number(m.ry) || 0, tools: { ...s.p.tools }, display: [], cooking: false };
      stations.set(s.p.id, st);
      pushStation(st);
      sendMe(s);
    },
    pick(s) {
      const st = stationOf(s);
      if (!st) return;
      if (s.cook) return toast(s, '요리 중에는 거둘 수 없어요.', 'warn');
      returnDisplay(st);
      stations.delete(s.p.id);
      broadcast('stationGone', { owner: s.p.id });
      markDirty();
      sendMe(s);
    },

    start(s, m) {
      ensure(s.p);
      const p = s.p;
      const st = stationOf(s);
      if (!st) return toast(s, '먼저 조리대를 깔아 주세요.', 'warn');
      if (!nearStation(s, st)) return toast(s, '조리대 가까이에서 요리해 주세요.', 'warn');
      if (s.cook || s.fs || s.trade) return;
      const tool = TOOL[m.tool] ? m.tool : null;
      if (!tool || !(p.tools[tool] > 0)) return toast(s, '그 조리 도구가 없어요.', 'warn');
      const list = Array.isArray(m.ings) ? m.ings.slice(0, 5) : [];
      if (!list.length) return toast(s, '재료를 하나 이상 넣어 주세요.', 'warn');
      // 재료 확인
      const fishUids = [];
      const items: Record<string, number> = {};
      for (const g of list) {
        if (g?.kind === 'fish') {
          if (fishUids.includes(g.uid)) return;
          const f = p.fish.find((x) => x.uid === g.uid);
          if (!f || f.lock) return toast(s, '잠긴 물고기나 없는 물고기는 넣을 수 없어요.', 'warn');
          fishUids.push(g.uid);
        } else if (g?.kind === 'item' && ingredientTags(g.id)) {
          items[g.id] = (items[g.id] || 0) + 1;
        } else return;
      }
      for (const [id, n] of Object.entries(items)) if (!hasItem(p, id, n)) return toast(s, `${ITEMS[id].name}이(가) 모자라요.`, 'warn');
      // 재료 꺼내기 (취소하면 돌려줌)
      const fish = p.fish.filter((f) => fishUids.includes(f.uid));
      p.fish = p.fish.filter((f) => !fishUids.includes(f.uid));
      for (const [id, n] of Object.entries(items)) takeItem(p, id, n);

      const tagLists = [...fish.map(fishTags), ...Object.entries(items).flatMap(([id, n]) => Array(n).fill(ingredientTags(id)))];
      const recipe = matchRecipe(tool, tagLists);
      const mass = fish.reduce((a, f) => a + f.w, 0) + Object.entries(items).reduce((a, [id, n]) => a + n * (ITEMS[id].home ? 0.4 : 0.25), 0);
      const value = fish.reduce((a, f) => a + f.price, 0) + Object.entries(items).reduce((a, [id, n]) => a + (ITEMS[id].value || 5) * n, 0);
      // 재료 품질: 물고기는 품질 별, 텃밭 수확물은 별 5개. 둘 다 없으면 보통(3)
      const starList = [...fish.map((f) => QUALITY[f.q].stars), ...Object.entries(items).flatMap(([id, n]) => (ITEMS[id].home ? Array(n).fill(5) : []))];
      const ingStars = starList.length ? starList.reduce((a, b) => a + b, 0) / starList.length : 3;
      const variant = fish.map((f) => f.v).filter(Boolean).sort((a, b) => VARIANT[b].mult - VARIANT[a].mult)[0] || null;
      s.cook = { id: uid(), tool, startAt: now(), recipe, mass, value, ingStars, variant, fish, items };
      st.cooking = true;
      pushStation(st);
      sendMe(s);
      send(s, 'cookGo', { cid: s.cook.id, tool, tier: p.tools[tool] });
    },

    finish(s, m) {
      const c = s.cook;
      if (!c || m.cid !== c.id) return;
      const p = s.p;
      const elapsed = (now() - c.startAt) / 1000;
      const scores = Array.isArray(m.scores) ? m.scores.map((x) => Math.max(0, Math.min(1, Number(x) || 0))) : [];
      if (elapsed < TOOL_MIN_SECONDS[c.tool] * 0.7 || !scores.length) {
        refundCook(s);
        sendMe(s);
        return toast(s, '요리가 너무 빨리 끝났어요. 다시 해 주세요.', 'warn');
      }
      const score = scores.reduce((a, b) => a + b, 0) / scores.length;
      const stars = dishStars(score, c.ingStars);
      const r = c.recipe || MYSTERY[c.tool];
      const legend = c.recipe?.hidden;
      const { value: power, effect } = effectFor(r.effect, stars, (c.variant ? 1.25 : 1) * (legend ? 1.4 : 1));
      const dish: Dish = {
        uid: uid(),
        rid: r.id,
        name: c.variant ? `${VARIANT[c.variant].name} ${r.name}` : r.name,
        tool: c.tool,
        stars,
        dur: dishDuration(c.mass),
        effect: r.effect,
        power,
        eff: effect,
        value: Math.max(5, Math.round(c.value * r.mult * (0.5 + 0.18 * stars))),
        v: c.variant,
        by: p.name,
        t: now(),
      };
      let isNew = false;
      if (c.recipe && !p.recipes.includes(c.recipe.id)) {
        p.recipes.push(c.recipe.id);
        isNew = true;
      }
      s.cook = null;
      const st = stationOf(s);
      if (st) {
        st.cooking = false;
        pushStation(st);
      }
      let autoSold = false;
      if (p.dishes.length >= DISH_LIMIT) {
        p.money += dish.value;
        p.earned += dish.value;
        autoSold = true;
      } else p.dishes.push(dish);
      addXp(s, 4 + stars * 2);
      markDirty();
      sendMe(s);
      send(s, 'cooked', { dish, isNew, autoSold, score });
      if (legend) sysChat(`${p.name}님이 ${dish.name}을(를) 만들었어요! 맛있는 냄새가 섬에 퍼져요.`, '#ffc070', 'catch');
    },

    cancel(s) {
      if (!s.cook) return;
      refundCook(s);
      sendMe(s);
    },

    eat(s, m) {
      ensure(s.p);
      const p = s.p;
      const d = p.dishes.find((x) => x.uid === m.uid);
      if (!d) return;
      p.dishes = p.dishes.filter((x) => x !== d);
      p.food = { rid: d.rid, name: d.name, type: d.effect, value: d.power, effect: d.eff, until: now() + d.dur * 1000 };
      markDirty();
      sendMe(s);
      sendBuffs(s);
      toast(s, `${d.name}을(를) 먹었어요. ${FOOD_EFFECTS[d.effect].fmt(d.power)}, ${Math.round(d.dur / 60)}분`, 'buff', { buff: 'food' });
    },

    sell(s, m) {
      ensure(s.p);
      if (!nearShop(s)) return toast(s, '상점 주인에게 가야 팔 수 있어요.', 'warn');
      const uids = new Set(Array.isArray(m.uids) ? m.uids : []);
      const mult = sellMult(s);
      let total = 0, count = 0;
      s.p.dishes = s.p.dishes.filter((d) => {
        if (!uids.has(d.uid)) return true;
        total += Math.round(d.value * mult);
        count++;
        return false;
      });
      if (!count) return;
      s.p.money += total;
      s.p.earned += total;
      markDirty();
      sendMe(s);
      send(s, 'sold', { count, total });
    },

    display(s, m) {
      ensure(s.p);
      const st = stationOf(s);
      if (!st) return toast(s, '조리대를 깔아야 진열할 수 있어요.', 'warn');
      if (st.display.length >= 6) return toast(s, '진열대는 6칸까지예요.', 'warn');
      const price = Math.floor(Number(m.price));
      if (!(price >= 1 && price <= 9999999)) return toast(s, '가격을 확인해 주세요.', 'warn');
      const d = s.p.dishes.find((x) => x.uid === m.uid);
      if (!d) return;
      s.p.dishes = s.p.dishes.filter((x) => x !== d);
      st.display.push({ ...d, price });
      pushStation(st);
      markDirty();
      sendMe(s);
    },
    undisplay(s, m) {
      const st = stationOf(s);
      if (!st) return;
      const d = st.display.find((x) => x.uid === m.uid);
      if (!d) return;
      st.display = st.display.filter((x) => x !== d);
      const { price, ...dish } = d;
      s.p.dishes.push(dish);
      pushStation(st);
      sendMe(s);
    },
    buyDisplay(s, m) {
      ensure(s.p);
      const st = stations.get(m.owner);
      if (!st || st.owner === s.p.id) return;
      if (!nearStation(s, st)) return toast(s, '조리대 가까이에서 살 수 있어요.', 'warn');
      const d = st.display.find((x) => x.uid === m.uid);
      if (!d) return toast(s, '이미 팔렸어요.', 'warn');
      if (s.p.money < d.price) return toast(s, '돈이 부족해요.', 'warn');
      if (s.p.dishes.length >= DISH_LIMIT) return toast(s, '요리 가방이 가득 찼어요.', 'warn');
      const owner = sessions.get(st.owner);
      if (!owner) return;
      st.display = st.display.filter((x) => x !== d);
      const { price, ...dish } = d;
      s.p.money -= price;
      owner.p.money += price;
      owner.p.earned += price;
      s.p.dishes.push(dish);
      pushStation(st);
      markDirty();
      sendMe(s);
      sendMe(owner);
      toast(s, `${dish.name}을(를) 샀어요.`, 'ok');
      toast(owner, `${s.p.name}님이 ${dish.name}을(를) ${price.toLocaleString()}에 사 갔어요!`, 'ok');
    },

    buyTool(s, m) {
      ensure(s.p);
      if (!nearShop(s)) return toast(s, '상점 주인에게 가야 살 수 있어요.', 'warn');
      const t = TOOL[m.id];
      if (!t) return;
      const next = (s.p.tools[t.id] || 0) + 1;
      if (next > 3) return toast(s, '이미 최고 등급이에요.', 'warn');
      const price = t.prices[next - 1];
      if (s.p.money < price) return toast(s, '돈이 부족해요.', 'warn');
      s.p.money -= price;
      s.p.tools[t.id] = next;
      const st = stationOf(s);
      if (st) {
        st.tools = { ...s.p.tools };
        pushStation(st);
      }
      markDirty();
      sendMe(s);
      toast(s, next === 1 ? `${t.name}을(를) 샀어요.` : `${t.name}을(를) ${next}단계로 올렸어요. 판정이 넉넉해져요.`, 'ok');
    },
    buyRecipe(s, m) {
      ensure(s.p);
      if (!nearShop(s)) return toast(s, '상점 주인에게 가야 살 수 있어요.', 'warn');
      const r = RECIPE_BY_ID[m.id];
      if (!r || r.hidden || r.buy == null || s.p.recipes.includes(r.id)) return;
      if (s.p.money < r.buy) return toast(s, '돈이 부족해요.', 'warn');
      s.p.money -= r.buy;
      s.p.recipes.push(r.id);
      markDirty();
      sendMe(s);
      toast(s, `레시피 [${r.name}]을(를) 배웠어요.`, 'ok');
    },

    // 거래용: 요리 주고받기
    takeDishes(p, uids) {
      const out = p.dishes.filter((d) => uids.includes(d.uid));
      p.dishes = p.dishes.filter((d) => !uids.includes(d.uid));
      return out;
    },

    onLeave(s) {
      if (s.cook) refundCook(s);
      const st = stationOf(s);
      if (st) {
        returnDisplay(st);
        stations.delete(s.p.id);
        broadcast('stationGone', { owner: s.p.id });
      }
    },
  };
}

export const cooking = createCooking();
export const cookingHandlers: Record<string, Handler> = {
  placeStation: cooking.place,
  pickStation: cooking.pick,
  cookStart: cooking.start,
  cookFinish: cooking.finish,
  cookCancel: cooking.cancel,
  eatDish: cooking.eat,
  sellDish: cooking.sell,
  displayDish: cooking.display,
  undisplayDish: cooking.undisplay,
  buyDisplay: cooking.buyDisplay,
  buyTool: cooking.buyTool,
  buyRecipe: cooking.buyRecipe,
};
export type { Session };
