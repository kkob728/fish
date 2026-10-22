// 요리 UI: 조리대 패널(요리하기/진열대/요리 도감), 다른 사람 진열대, 요리 미니게임, 결과 카드
import { h, ui, fmtMoney } from './dom.js';
import { ic, itemIc, DISH_ICON } from './icons.js';
import { panelShell, registerPanel, openPanel, closePanel, refreshPanel, tabState, panelArgument } from './panels.js';
import { dishRow, dishEffectText } from './dishes.js';
import { stars } from './catchCard.js';
import { toast } from './hud.js';
import { S, itemCount } from '../state.js';
import { send, on } from '../net.js';
import { sfx } from '../audio.js';
import { fishThumb } from '../scene/fishModel.js';
import { FISH_BY_ID } from '../../../shared/data/fish.js';
import { ITEMS } from '../../../shared/data/items.js';
import { RARITY, QUALITY, VARIANT, formatKg } from '../../../shared/data/core.js';
import {
  TOOLS, TOOL, TOOL_STEPS, TOOL_TOLERANCE, RECIPES, RECIPE_BY_ID, MYSTERY, FOODS, EXTRA_FOOD_TAGS, TAG_NAME, FOOD_EFFECTS,
  fishTags, ingredientTags, matchRecipe,
} from '../../../shared/data/cooking.js';

let sel = { tool: null, ings: [] }; // ings: {kind:'fish', uid} | {kind:'item', id}
const selCount = (id) => sel.ings.filter((g) => g.kind === 'item' && g.id === id).length;
const myRecipes = () => S.me.recipes || ['grilled'];

function tagsOf(g) {
  if (g.kind === 'fish') {
    const f = S.me.fish.find((x) => x.uid === g.uid);
    return f ? fishTags(f) : [];
  }
  return ingredientTags(g.id) || [];
}

function preview() {
  if (!sel.tool || !sel.ings.length) return { text: '재료를 넣어 보세요', kind: 'none' };
  const r = matchRecipe(sel.tool, sel.ings.map(tagsOf));
  if (!r) return { text: MYSTERY[sel.tool].name, kind: 'mystery' };
  if (myRecipes().includes(r.id)) return { text: r.name, kind: 'known', r };
  return { text: '처음 보는 요리가 될 것 같아요…', kind: 'unknown' };
}

const needsText = (r) => r.needs.map(([t, n]) => `${TAG_NAME[t] || (t.startsWith('sp:') ? FISH_BY_ID[t.slice(3)]?.name : t)}${n > 1 ? ` ${n}` : ''}`).join(' + ') + (r.no.length ? `  (${r.no.map((t) => TAG_NAME[t]).join(', ')} 빼고)` : '');

// ---------- 조리대 패널 ----------
function cookPanel() {
  const shell = panelShell('조리대', 'station', { tabs: [['cook', '요리하기', 'pot'], ['display', '진열대', 'coin'], ['book', '요리 도감', 'book']], tabKey: 'cook' });
  const owned = () => TOOLS.filter((t) => (S.me.tools?.[t.id] || 0) > 0);
  if (!sel.tool || !(S.me.tools?.[sel.tool] > 0)) sel.tool = owned()[0]?.id || null;
  return {
    el: shell.el,
    render() {
      shell.body.replaceChildren();
      shell.foot.replaceChildren();
      shell.syncTabs('cook');
      const tab = tabState.cook;
      // 사라진 재료 정리
      sel.ings = sel.ings.filter((g) => (g.kind === 'fish' ? S.me.fish.some((f) => f.uid === g.uid) : selCount(g.id) <= itemCount(g.id)));
      if (tab === 'cook') renderCook(shell);
      else if (tab === 'display') renderDisplay(shell);
      else renderBook(shell);
    },
  };
}

function renderCook(shell) {
  const body = shell.body;
  body.append(h('div.section-title', '조리 도구'));
  body.append(
    h(
      'div.seg',
      { style: { flexWrap: 'wrap', gap: '6px' } },
      TOOLS.map((t) => {
        const tier = S.me.tools?.[t.id] || 0;
        return h(
          'button.small' + (sel.tool === t.id ? '.wood' : ''),
          { disabled: !tier, title: tier ? `${t.desc} · ${tier}단계` : '상점에서 살 수 있어요', onclick: () => { sel.tool = t.id; sfx.click(); openPanelRefresh(); } },
          ic(t.id),
          `${t.name}${tier ? ` ${tier}단계` : ' (없음)'}`,
        );
      }),
    ),
  );
  if (!sel.tool) {
    body.append(h('div.empty', '조리 도구가 없어요. 상점에서 사 오세요.'));
    return;
  }
  // 재료 칸
  const slots = [];
  for (let i = 0; i < 5; i++) {
    const g = sel.ings[i];
    if (!g) {
      slots.push(h('div.slot-cell.empty-slot', '+'));
      continue;
    }
    const remove = () => { sel.ings.splice(i, 1); sfx.click(); openPanelRefresh(); };
    if (g.kind === 'fish') {
      const f = S.me.fish.find((x) => x.uid === g.uid);
      slots.push(h('div.slot-cell', { onclick: remove, title: '빼기' }, h('img', { src: fishThumb(f.sp, f.v) }), h('span', FISH_BY_ID[f.sp].name)));
    } else slots.push(h('div.slot-cell', { onclick: remove, title: '빼기' }, itemIc(g.id), h('span', ITEMS[g.id].name)));
  }
  const pv = preview();
  body.append(h('div.section-title', '재료 (최대 5개, 눌러서 빼기)'), h('div.slots', slots));
  body.append(
    h('div.preview' + (pv.kind === 'known' ? '.known' : pv.kind === 'unknown' ? '.unknown' : ''), ic(pv.kind === 'known' ? DISH_ICON[sel.tool] : pv.kind === 'unknown' ? 'sparkle' : 'help'),
      h('span', pv.kind === 'known' ? `완성 예상: ${pv.text}` : pv.text),
      pv.r ? h('span.muted', `  ${FOOD_EFFECTS[pv.r.effect].name}`) : null),
  );
  // 재료 고르기
  const add = (g) => {
    if (sel.ings.length >= 5) return toast('재료는 5개까지 넣을 수 있어요.', 'warn');
    sel.ings.push(g);
    sfx.click();
    openPanelRefresh();
  };
  const fishList = S.me.fish.filter((f) => !f.lock && !sel.ings.some((g) => g.uid === f.uid));
  body.append(h('div.section-title', '물고기'));
  body.append(
    fishList.length
      ? h('div.pick-grid', fishList.map((f) => {
          const sp = FISH_BY_ID[f.sp];
          return h('div.card.click.mini-card', { onclick: () => add({ kind: 'fish', uid: f.uid }) }, f.v && h('span.vtag', h('span.vbadge', { style: { background: VARIANT[f.v].ink } }, VARIANT[f.v].name)), h('img', { src: fishThumb(f.sp, f.v) }), h('div.nm', { style: { color: RARITY[sp.rarity].index ? RARITY[sp.rarity].color : 'var(--ink)' } }, sp.name), h('div.sub', formatKg(f.w), stars(QUALITY[f.q].stars)));
        }))
      : h('div.empty', { style: { padding: '8px' } }, '쓸 수 있는 물고기가 없어요. (잠긴 물고기는 빠져요)'),
  );
  const itemIds = [...FOODS.map((f) => f.id), ...Object.keys(EXTRA_FOOD_TAGS)].filter((id) => itemCount(id) - selCount(id) > 0);
  body.append(h('div.section-title', '식재료'));
  body.append(
    itemIds.length
      ? h('div.pick-items', itemIds.map((id) => h('button.small.food-btn', { onclick: () => add({ kind: 'item', id }), title: (ingredientTags(id) || []).map((t) => TAG_NAME[t]).join(', ') }, itemIc(id), `${ITEMS[id].name} ${itemCount(id) - selCount(id)}`)))
      : h('div.empty', { style: { padding: '8px' } }, '식재료가 없어요. 상점에서 사거나 채집해 보세요.'),
  );
  shell.foot.append(
    h('span.muted', '아는 레시피는 미리 보여요. 모르는 조합도 넣어 보면 새 요리를 발견할 수 있어요.'),
    h('span', { style: { flex: 1 } }),
    h('button.small', { disabled: !sel.ings.length, onclick: () => { sel.ings = []; openPanelRefresh(); } }, '비우기'),
    h('button.primary', { disabled: !sel.ings.length, onclick: () => send('cookStart', { tool: sel.tool, ings: sel.ings }) }, ic(sel.tool), '요리 시작'),
  );
}

function renderDisplay(shell) {
  const body = shell.body;
  const st = S.stations.get(S.myId);
  body.append(h('div.section-title', `진열 중 (${st?.display.length || 0}/6)`));
  if (!st?.display.length) body.append(h('div.empty', { style: { padding: '10px' } }, '아직 진열한 요리가 없어요. 아래에서 가격을 정해 올려 보세요.'));
  else body.append(h('div.list', st.display.map((d) => dishRow(d, h('span.title', { style: { display: 'inline-flex', alignItems: 'center', gap: '3px' } }, ic('coin'), fmtMoney(d.price)), h('button.small', { onclick: () => send('undisplayDish', { uid: d.uid }) }, '내리기')))));
  body.append(h('div.section-title', '내 요리'));
  const dishes = S.me.dishes || [];
  if (!dishes.length) body.append(h('div.empty', { style: { padding: '10px' } }, '요리가 없어요.'));
  else
    body.append(
      h(
        'div.list',
        dishes.map((d) => {
          const price = h('input', { type: 'number', min: 1, value: Math.round(d.value * 1.3), style: { width: '96px', padding: '3px 8px' } });
          price.addEventListener('keydown', (e) => e.stopPropagation());
          return dishRow(d, price, h('button.small.wood', { disabled: (st?.display.length || 0) >= 6, onclick: () => send('displayDish', { uid: d.uid, price: Number(price.value) }) }, '진열'));
        }),
      ),
    );
  shell.foot.append(h('span.muted', '진열대는 조리대를 깔아 두고 접속해 있는 동안 열려요. 다른 사람이 가까이 와서 사 갈 수 있어요.'));
}

function renderBook(shell) {
  const body = shell.body;
  const known = new Set(myRecipes());
  const total = RECIPES.length;
  for (const t of TOOLS) {
    body.append(h('div.section-title', ic(t.id), t.name));
    body.append(
      h(
        'div.list',
        RECIPES.filter((r) => r.tool === t.id).map((r) => {
          const k = known.has(r.id);
          if (!k && r.hidden) return h('div.row-item.no', ic('help'), h('div.grow', h('div.nm', '숨은 요리 ???'), h('div.sub', '특별한 물고기로만 만들 수 있다는 소문이…')));
          return h(
            'div.row-item' + (k ? '' : '.no'),
            ic(k ? DISH_ICON[r.tool] : 'help'),
            h('div.grow', h('div.nm', k ? r.name : '???', h('span.cnt', FOOD_EFFECTS[r.effect].name)), h('div.sub', k ? `${needsText(r)} — ${r.desc}` : r.buy != null ? `상점에서 레시피를 살 수 있어요 (${fmtMoney(r.buy)})` : '직접 재료를 조합해서 찾아보세요')),
          );
        }),
      ),
    );
  }
  shell.foot.append(h('span.title', `알아낸 요리 ${RECIPES.filter((r) => known.has(r.id)).length} / ${total}`));
}

// 같은 패널을 다시 그림 (스크롤 유지)
function openPanelRefresh() {
  if (S.panelOpen === 'cook') refreshPanel();
}

// ---------- 다른 사람 진열대 ----------
function stallPanel() {
  const owner = panelArgument();
  const shell = panelShell('진열대', 'coin');
  return {
    el: shell.el,
    render() {
      shell.body.replaceChildren();
      shell.foot.replaceChildren();
      const st = S.stations.get(owner);
      if (!st) {
        shell.body.append(h('div.empty', '조리대가 사라졌어요.'));
        return;
      }
      shell.el.querySelector('h2').replaceChildren(ic('station'), `${st.name}님의 진열대`);
      if (!st.display.length) shell.body.append(h('div.empty', '진열된 요리가 없어요.'));
      else shell.body.append(h('div.list', st.display.map((d) => dishRow({ ...d, value: 0 }, h('button.primary', { disabled: S.me.money < d.price, onclick: () => send('buyDisplay', { owner, uid: d.uid }) }, ic('coin'), fmtMoney(d.price))))));
      shell.foot.append(h('span.coin-tag.plank', ic('coin'), fmtMoney(S.me.money)), h('span.muted', '산 요리는 가방의 요리 칸에 들어가요. 먹으면 낚시가 쉬워져요.'));
    },
  };
}

registerPanel('cook', cookPanel);
registerPanel('stall', stallPanel);
on('station', () => {
  if (S.panelOpen === 'cook' || S.panelOpen === 'stall') refreshPanel();
});

// ---------- 요리 미니게임 ----------
const verdict = (s) => (s >= 0.9 ? '완벽!' : s >= 0.6 ? '좋아요!' : s >= 0.3 ? '아쉬워요' : '실패…');

function runCookGame(tool, tier) {
  return new Promise((resolve) => {
    const steps = TOOL_STEPS[tool];
    const tol = TOOL_TOLERANCE[tier] || 1;
    const scores = [];
    const title = h('div.cg-title');
    const hint = h('div.cg-hint');
    const area = h('div.cg-area');
    const fb = h('div.cg-fb');
    const box = h('div.cookgame.paper', h('div.cg-head', ic(tool), h('span', `${TOOL[tool].name}로 요리 중`), h('span.cg-step')), title, hint, area, fb);
    const bg = h('div.cookgame-bg', box);
    ui().append(bg);
    S.cooking = true;
    let holding = false;
    let pressCb = null;
    let raf = 0;
    let aborted = false;
    const press = (e) => {
      if (e?.target?.closest?.('button')) return;
      holding = true;
      pressCb?.();
    };
    const releaseFn = () => (holding = false);
    bg.addEventListener('pointerdown', press);
    addEventListener('pointerup', releaseFn);
    const onKey = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) press();
      }
      if (e.code === 'Escape') {
        aborted = true;
        finish();
      }
    };
    const onKeyUp = (e) => e.code === 'Space' && releaseFn();
    addEventListener('keydown', onKey, true);
    addEventListener('keyup', onKeyUp);

    function finish() {
      cancelAnimationFrame(raf);
      bg.remove();
      removeEventListener('pointerup', releaseFn);
      removeEventListener('keydown', onKey, true);
      removeEventListener('keyup', onKeyUp);
      S.cooking = false;
      resolve(aborted ? null : scores);
    }

    let si = 0;
    function nextStep() {
      if (si >= steps.length) return setTimeout(finish, 500);
      const st = steps[si];
      box.querySelector('.cg-step').textContent = `${si + 1} / ${steps.length}`;
      title.textContent = st.name;
      hint.textContent = st.hint + (document.body.classList.contains('touch') ? ' (화면을 터치)' : ' (클릭 또는 Space)');
      fb.textContent = '';
      area.replaceChildren();
      const done = (score) => {
        scores.push(score);
        fb.textContent = verdict(score);
        fb.className = 'cg-fb ' + (score >= 0.6 ? 'good' : 'bad');
        score >= 0.6 ? sfx.gather() : sfx.lose();
        pressCb = null;
        cancelAnimationFrame(raf);
        si++;
        setTimeout(nextStep, 700);
      };
      if (st.type === 'timing') stepTiming(st, done);
      else if (st.type === 'sweep') stepSweep(st, done);
      else stepHold(st, done);
    }

    function bar() {
      const track = h('div.cg-track');
      area.append(track);
      return track;
    }

    function stepTiming(st, done) {
      const track = bar();
      const zoneEl = h('div.cg-zone');
      const marker = h('div.cg-marker');
      track.append(zoneEl, marker);
      const w = Math.min(0.5, st.zone * tol);
      let center = 0;
      const place = () => {
        center = w / 2 + 0.05 + Math.random() * (0.9 - w);
        zoneEl.style.left = `${(center - w / 2) * 100}%`;
        zoneEl.style.width = `${w * 100}%`;
      };
      place();
      const sub = [];
      let t = Math.random();
      let last = performance.now();
      let pos = 0;
      pressCb = () => {
        const dist = Math.abs(pos - center);
        const s = dist <= w / 2 ? 1 - (dist / (w / 2)) * 0.2 : Math.max(0, 0.8 - (dist - w / 2) / 0.2);
        sub.push(s);
        sfx.reelTick();
        fb.textContent = verdict(s);
        if (sub.length >= st.presses) done(sub.reduce((a, b) => a + b, 0) / sub.length);
        else place();
      };
      const loop = () => {
        const now = performance.now();
        t += ((now - last) / 1000) * st.speed * 0.5;
        last = now;
        pos = 1 - Math.abs(((t % 2) + 2) % 2 - 1);
        marker.style.left = `${pos * 100}%`;
        raf = requestAnimationFrame(loop);
      };
      loop();
    }

    function stepSweep(st, done) {
      const track = bar();
      track.classList.add('sweep');
      const w = Math.min(0.4, st.zone * tol);
      const zoneEl = h('div.cg-zone');
      zoneEl.style.left = `${(st.at - w / 2) * 100}%`;
      zoneEl.style.width = `${w * 100}%`;
      const marker = h('div.cg-marker');
      track.append(zoneEl, marker);
      const start = performance.now();
      let pos = 0;
      pressCb = () => {
        const dist = Math.abs(pos - st.at);
        done(dist <= w / 2 ? 1 - (dist / (w / 2)) * 0.2 : Math.max(0, 0.8 - (dist - w / 2) / 0.18));
      };
      const loop = () => {
        pos = (performance.now() - start) / 1000 / st.duration;
        marker.style.left = `${Math.min(1, pos) * 100}%`;
        if (pos >= 1.05) {
          fb.textContent = '타 버렸어요!';
          return done(0);
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
    }

    function stepHold(st, done) {
      const col = h('div.cg-col');
      const band = h('div.cg-band');
      const needle = h('div.cg-needle');
      const meter = h('div.cg-meter');
      const meterFill = h('div');
      meter.append(meterFill);
      col.append(band, needle);
      area.append(h('div.cg-holdwrap', col, h('div.cg-holdinfo', h('div', '초록 구간 안에 있던 시간'), meter)));
      const bw = Math.min(0.45, st.band * tol);
      let v = 0.2, inside = 0, t = 0;
      let last = performance.now();
      pressCb = () => {};
      const loop = () => {
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        t += dt;
        v += (holding ? 0.85 : -0.7) * dt;
        v = Math.max(0, Math.min(1, v));
        const c = st.high ? 0.72 + 0.13 * Math.sin(t * 1.3) : 0.5 + 0.25 * Math.sin(t * 0.9);
        band.style.bottom = `${(c - bw / 2) * 100}%`;
        band.style.height = `${bw * 100}%`;
        needle.style.bottom = `${v * 100}%`;
        const ok = Math.abs(v - c) <= bw / 2;
        band.classList.toggle('on', ok);
        if (ok) inside += dt;
        meterFill.style.width = `${Math.min(1, inside / (st.duration * 0.85)) * 100}%`;
        if (t >= st.duration) return done(Math.min(1, inside / (st.duration * 0.85)));
        raf = requestAnimationFrame(loop);
      };
      loop();
    }

    nextStep();
  });
}

on('cookGo', async (m) => {
  closePanel(true);
  sfx.open();
  const scores = await runCookGame(m.tool, m.tier);
  if (!scores) {
    send('cookCancel');
    toast('요리를 그만뒀어요. 재료는 돌려받았어요.', 'warn');
    return;
  }
  send('cookFinish', { cid: m.cid, scores });
});

// ---------- 결과 카드 ----------
on('cooked', (m) => {
  const d = m.dish;
  sel.ings = [];
  sfx.catch(Math.min(5, d.stars), !!d.v);
  const card = h(
    'div.catch.paper.dishcard',
    h('div.banner', { style: { background: d.v ? VARIANT[d.v].ink : '#c8723a' } }, m.isNew ? '새 요리 발견!' : '요리 완성'),
    h('div.dish-pic', ic(DISH_ICON[d.tool] || 'dishPot')),
    h('div.name', { style: { color: d.v ? VARIANT[d.v].ink : 'var(--ink)' } }, d.name),
    h('div.sub', stars(d.stars)),
    h('div.stats', h('div', '효과', h('b', FOOD_EFFECTS[d.effect].fmt(d.power))), h('div', '지속', h('b', `${Math.round(d.dur / 60)}분`)), h('div', '가치', h('b', fmtMoney(d.value)))),
    m.isNew ? h('div.flags', h('span.stamp', { style: { color: '#2f78c4' } }, ic('book'), '요리 도감에 기록했어요')) : null,
    h('div.desc', RECIPE_BY_ID[d.rid]?.desc || '무슨 맛인지 알 수 없지만 먹을 수는 있다.'),
    h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center' } },
      h('button.primary', { onclick: () => { send('eatDish', { uid: d.uid }); card.remove(); } }, '바로 먹기'),
      h('button', { onclick: () => card.remove() }, '가방에 넣기')),
  );
  ui().append(card);
  if (m.autoSold) toast('요리 가방이 가득 차서 바로 팔았어요.', 'warn');
});

export function openCook() {
  openPanel('cook');
}
export function openStall(owner) {
  openPanel('stall', false, owner);
}
export { dishEffectText };
