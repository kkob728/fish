import { h, ui, fmtMoney } from './dom.js';
import { ic, itemIc, BUFF_ICON, PHASE_ICON, WEATHER_ICON } from './icons.js';
import { S, itemCount } from '../state.js';
import { send, on, serverNow } from '../net.js';
import { toast, selectBait } from './hud.js';
import { stars } from './catchCard.js';
import { fishThumb } from '../scene/fishModel.js';
import { sfx } from '../audio.js';
import { FISH, FISH_BY_ID } from '../../../shared/data/fish.js';
import { ITEMS, MATERIALS, ESSENCES, BAITS, TACKLES, RECIPES, SHOP_STOCK, FISH_BAG_LIMIT } from '../../../shared/data/items.js';
import { RARITY, QUALITY, VARIANTS, VARIANT, RODS, ROD, WEATHERS, PHASES, formatKg, formatLen } from '../../../shared/data/core.js';
import { ZONES, ZONE_ORDER } from '../../../shared/world.js';
import { BEHAVIOR_NAME, BEHAVIOR_BY_SHAPE } from '../../../shared/minigame.js';

const TAG_NAME = { worm: '지렁이', insect: '곤충', paste: '떡밥', fruit: '열매', shrimp: '새우', shell: '조개', cut: '생선살', glow: '발광', fungus: '버섯', sulfur: '유황', lure: '루어', meat: '고기' };
const BEHAVIOR_BY_SHAPE_HINT = (f) => BEHAVIOR_NAME[BEHAVIOR_BY_SHAPE[f.look.shape] || 'mixed'];

let current = null;
const tabState = { bag: 'fish', shop: 'sell', dex: 'lake' };
const selected = new Set();
let fishSort = 'recent';
let dexDetail = null;

const essColor = (id) => (ITEMS[id]?.essence ? VARIANT[ITEMS[id].variant].color : undefined);
const iIc = (id) => itemIc(id, '', essColor(id));
const coinTxt = (n) => h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '3px' } }, ic('coin'), fmtMoney(n));
const rarBadge = (r) => h('span.rbadge', { style: { background: r.color } }, r.name);
const varBadge = (v) => h('span.vbadge', { style: { background: v.ink } }, v.name);

export function baitEffects(b) {
  const parts = [];
  if (b.tag === 'all') parts.push('모든 물고기가 좋아함');
  else if (b.tag) parts.push(`${TAG_NAME[b.tag]} 좋아하는 물고기가 잘 뭄`);
  if (b.bite !== 1) parts.push(b.bite < 1 ? `입질 ${Math.round((1 - b.bite) * 100)}% 빠름` : `입질 ${Math.round((b.bite - 1) * 100)}% 느림`);
  if (b.rarity) parts.push(`희귀 +${Math.round(b.rarity * 100)}%`);
  if (b.size) parts.push(`큰 개체 +${Math.round(b.size * 100)}%`);
  if (b.variant > 1) parts.push(`변이 ×${b.variant}`);
  return parts.join(' · ');
}

function panelShell(title, iconName, { tabs = null, tabKey = null } = {}) {
  const body = h('div.body');
  const foot = h('div.foot');
  const tabsEl = tabs
    ? h(
        'div.tabs',
        tabs.map(([id, label, icn]) =>
          h('button', {
            dataset: { id },
            onclick: () => {
              tabState[tabKey] = id;
              selected.clear();
              dexDetail = null;
              sfx.click();
              current?.render();
              body.scrollTop = 0;
            },
          }, icn && ic(icn), label),
        ),
      )
    : null;
  const el = h(
    'div.panel.paper',
    h('header.plank', h('h2', ic(iconName), title), h('span.nail.a'), h('span.nail.b')),
    h('button.x', { onclick: () => closePanel(), title: '닫기 (Esc)' }, ic('close')),
    tabsEl,
    body,
    foot,
  );
  return {
    el, body, foot, tabsEl,
    syncTabs(key) {
      if (!tabsEl) return;
      for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.id === tabState[key]);
    },
  };
}

function fishCard(rec) {
  const sp = FISH_BY_ID[rec.sp];
  const rar = RARITY[sp.rarity];
  const q = QUALITY[rec.q];
  const v = rec.v ? VARIANT[rec.v] : null;
  return h(
    'div.card.click' + (selected.has(rec.uid) ? '.sel' : ''),
    {
      onclick: () => {
        if (selected.has(rec.uid)) selected.delete(rec.uid);
        else selected.add(rec.uid);
        sfx.click();
        current?.render();
      },
      title: `${sp.name} · ${formatLen(rec.len)} · ${q.name}`,
    },
    v && h('span.vtag', varBadge(v)),
    rec.lock && h('span.lock', ic('lock')),
    h('img', { src: fishThumb(rec.sp, rec.v), alt: sp.name }),
    h('div.nm', { style: { color: rar.index >= 1 ? rar.color : 'var(--ink)' } }, sp.name),
    h('div.sub', h('span', formatKg(rec.w)), stars(q.stars)),
    h('div.sub', h('span', { style: { color: q.color } }, q.name), coinTxt(rec.price)),
  );
}

function sortedFish() {
  const list = [...(S.me.fish || [])];
  const ri = (r) => RARITY[FISH_BY_ID[r.sp].rarity].index;
  if (fishSort === 'value') list.sort((a, b) => b.price - a.price);
  else if (fishSort === 'weight') list.sort((a, b) => b.w - a.w);
  else if (fishSort === 'rarity') list.sort((a, b) => ri(b) - ri(a) || b.price - a.price);
  else list.reverse();
  return list;
}

function fishGrid(body) {
  const list = sortedFish();
  body.append(
    h(
      'div',
      { style: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' } },
      h('span.title', { style: { fontSize: '16px' } }, `물고기 ${list.length} / ${FISH_BAG_LIMIT}`),
      h('span', { style: { flex: 1 } }),
      h('div.seg', [['recent', '최근'], ['value', '가치'], ['weight', '무게'], ['rarity', '희귀도']].map(([v, l]) => h('button.tiny' + (fishSort === v ? '.wood' : ''), { onclick: () => { fishSort = v; current?.render(); } }, l))),
    ),
  );
  for (const uid of [...selected]) if (!S.me.fish.some((f) => f.uid === uid)) selected.delete(uid);
  if (!list.length) {
    body.append(h('div.empty', '아직 잡은 물고기가 없어요.', h('br'), '물가에서 왼쪽 버튼을 꾹 눌렀다 떼서 던져 보세요.'));
    return;
  }
  body.append(h('div.grid', list.map((r) => fishCard(r))));
}

function selectionFoot(foot, { sell }) {
  const sel = S.me.fish.filter((f) => selected.has(f.uid));
  const usable = sel.filter((f) => !f.lock);
  const total = usable.reduce((a, f) => a + f.price, 0);
  foot.append(
    h('span.title', `${sel.length}마리 고름`),
    usable.length ? coinTxt(total) : null,
    h('span', { style: { flex: 1 } }),
    h('button.small', { onclick: () => { S.me.fish.filter((f) => !f.lock).forEach((f) => selected.add(f.uid)); current.render(); } }, '전부 고르기'),
    h('button.small', { disabled: !sel.length, onclick: () => { selected.clear(); current.render(); } }, '고르기 취소'),
    h('button.small', { disabled: !sel.length, onclick: () => { const lock = !sel.every((f) => f.lock); sel.forEach((f) => send('lock', { uid: f.uid, lock })); } }, ic('lock'), '잠금'),
    h('button.small.wood', { disabled: !usable.length, title: '미끼 재료로 손질해요', onclick: () => { send('dismantle', { uids: usable.map((f) => f.uid) }); selected.clear(); } }, ic('knife'), '손질'),
    sell
      ? h('button.primary', { disabled: !usable.length, onclick: () => { send('sellFish', { uids: usable.map((f) => f.uid) }); selected.clear(); } }, ic('coin'), '팔기')
      : h('button.small', { disabled: true, title: '캠프의 상점 주인에게 가면 팔 수 있어요' }, '판매는 상점에서'),
  );
}

function itemRows(body, ids, { sell = false, empty = '없음' } = {}) {
  const rows = ids.filter((id) => itemCount(id) > 0);
  if (!rows.length) {
    body.append(h('div.empty', { style: { padding: '12px' } }, empty));
    return;
  }
  body.append(
    h(
      'div.list',
      rows.map((id) => {
        const it = ITEMS[id];
        return h(
          'div.row-item',
          iIc(id),
          h('div.grow', h('div.nm', { style: it.essence ? { color: VARIANT[it.variant].ink } : null }, it.name, h('span.cnt', `${itemCount(id)}개`)), h('div.sub', it.bait ? baitEffects(it) : it.desc)),
          it.bait && h('button.small' + (S.me.bait === id ? '.wood' : ''), { onclick: () => { selectBait(id); current?.render(); } }, S.me.bait === id ? '쓰는 중' : '쓰기'),
          sell && h('button.small', { onclick: () => send('sellItem', { id, n: 1 }) }, '1개 ', coinTxt(it.value)),
          sell && h('button.small', { onclick: () => send('sellItem', { id, n: itemCount(id) }) }, '전부 ', coinTxt(it.value * itemCount(id))),
        );
      }),
    ),
  );
}

function rodRows(body, { shop }) {
  body.append(
    h(
      'div.list',
      RODS.filter((r) => shop || S.me.rods.includes(r.id)).map((r) => {
        const owned = S.me.rods.includes(r.id);
        const equipped = S.me.rod === r.id;
        const zones = ZONE_ORDER.filter((z) => ZONES[z].minRod <= r.tier).map((z) => ZONES[z].name);
        return h(
          'div.row-item' + (!owned && shop && (r.crafted || S.me.money < r.price) ? '.no' : ''),
          ic('rod'),
          h(
            'div.grow',
            h('div.nm', r.name, r.crafted && h('span.cnt', '제작 전용')),
            h('div.sub', `찌 구간 ${Math.round((0.2 + (r.tension - 100) * 0.001) * 100)}% · 감기 ×${r.reel} · 행운 +${Math.round(r.luck * 100)}% · 사거리 ${r.range}m`),
            h('div.sub', `갈 수 있는 곳: ${zones.join(', ')}`),
          ),
          owned
            ? h('button' + (equipped ? '.small' : '.primary'), { disabled: equipped, onclick: () => send('equipRod', { id: r.id }) }, equipped ? '들고 있음' : '들기')
            : shop && !r.crafted
              ? h('button.primary', { disabled: S.me.money < r.price, onclick: () => send('buyRod', { id: r.id }) }, coinTxt(r.price))
              : null,
        );
      }),
    ),
  );
}

// ---------- 가방 ----------
function bagPanel() {
  const shell = panelShell('가방', 'bag', { tabs: [['fish', '물고기', 'fish'], ['mat', '재료', 'worm'], ['bait', '미끼·도구', 'hook'], ['rod', '낚싯대', 'rod']], tabKey: 'bag' });
  return {
    el: shell.el,
    render() {
      shell.body.replaceChildren();
      shell.foot.replaceChildren();
      shell.syncTabs('bag');
      const tab = tabState.bag;
      if (tab === 'fish') {
        fishGrid(shell.body);
        selectionFoot(shell.foot, { sell: S.nearShop });
      } else if (tab === 'mat') {
        shell.body.append(h('div.section-title', '재료'));
        itemRows(shell.body, MATERIALS.map((m) => m.id), { sell: S.nearShop, empty: '재료가 없어요. 반짝이는 곳에서 E로 채집하거나 물고기를 손질해 보세요.' });
        shell.body.append(h('div.section-title', '변이 정수'));
        itemRows(shell.body, ESSENCES.map((m) => m.id), { sell: S.nearShop, empty: '변이 물고기를 손질하면 정수가 나와요.' });
        shell.foot.append(h('span.muted', S.nearShop ? '상점 앞이라 재료도 팔 수 있어요.' : '재료는 상점 앞에서 팔 수 있어요.'));
      } else if (tab === 'bait') {
        shell.body.append(h('div.section-title', '미끼'));
        itemRows(shell.body, BAITS.map((b) => b.id), { empty: '미끼가 없어요. 제작(C)에서 만들어 보세요.' });
        shell.body.append(h('div.section-title', '파이팅 도구'));
        itemRows(shell.body, TACKLES.map((t) => t.id), { sell: S.nearShop, empty: '파이팅 도구가 없어요. 상점에서 사거나 제작할 수 있어요.' });
        shell.foot.append(h('span.muted', '미끼는 물고기가 물었을 때 하나씩 써요. 파이팅 도구는 파이팅 중에 1~4 키로 써요.'));
      } else {
        rodRows(shell.body, { shop: false });
      }
    },
  };
}

// ---------- 제작 ----------
function essenceTotal() {
  return ESSENCES.reduce((a, e) => a + itemCount(e.id), 0);
}
function maxCraft(r) {
  let n = Infinity;
  for (const i of r.in) n = Math.min(n, Math.floor((i.tag === 'essence' ? essenceTotal() : itemCount(i.id)) / i.n));
  if (r.money) n = Math.min(n, Math.floor(S.me.money / r.money));
  if (r.out.rod) n = Math.min(n, S.me.rods.includes(r.out.rod) ? 0 : 1);
  return n;
}
function craftPanel() {
  const shell = panelShell('제작대', 'hammer');
  const isTackle = (r) => ITEMS[r.out.id]?.tackle;
  const groups = [['기본 미끼', RECIPES.slice(0, 8)], ['고급 미끼', RECIPES.slice(8, 14)], ['파이팅 도구', RECIPES.filter(isTackle)], ['특별한 것', RECIPES.slice(14).filter((r) => !isTackle(r))]];
  return {
    el: shell.el,
    render() {
      shell.body.replaceChildren();
      shell.foot.replaceChildren();
      for (const [title, list] of groups) {
        shell.body.append(h('div.section-title', title));
        shell.body.append(
          h(
            'div.list',
            list.map((r) => {
              const max = maxCraft(r);
              const outName = r.out.rod ? ROD[r.out.rod].name : ITEMS[r.out.id].name;
              const ings = r.in.map((i) => {
                const have = i.tag === 'essence' ? essenceTotal() : itemCount(i.id);
                return h('span.ing' + (have < i.n ? '.miss' : ''), i.tag === 'essence' ? itemIc('ess_moss', '', '#c78bff') : iIc(i.id), `${i.tag === 'essence' ? '아무 정수' : ITEMS[i.id].name} ${have}/${i.n}`);
              });
              if (r.money) ings.push(h('span.ing' + (S.me.money < r.money ? '.miss' : ''), ic('coin'), fmtMoney(r.money)));
              return h(
                'div.row-item' + (max <= 0 ? '.no' : ''),
                r.out.rod ? ic('rod') : iIc(r.out.id),
                h(
                  'div.grow',
                  h('div.nm', outName, r.out.n && h('span.cnt', `${r.out.n}개 · 가진 것 ${itemCount(r.out.id)}`)),
                  h('div.sub', ings),
                  h('div.sub', r.out.rod ? '가장 넓은 찌 구간 · 감기 ×2 · 행운 +40%' : ITEMS[r.out.id].tackle ? ITEMS[r.out.id].desc : baitEffects(ITEMS[r.out.id])),
                ),
                h('button.small', { disabled: max < 1, onclick: () => send('craft', { id: r.id, n: 1 }) }, '1번'),
                !r.out.rod && h('button.small', { disabled: max < 5, onclick: () => send('craft', { id: r.id, n: 5 }) }, '5번'),
                !r.out.rod && h('button.small.wood', { disabled: max < 1, onclick: () => send('craft', { id: r.id, n: max }) }, max > 0 ? `${max}번` : '최대'),
              );
            }),
          ),
        );
      }
      shell.foot.append(h('span.muted', '재료 얻는 법: 채집(E), 물고기 손질(가방), 상점, 다른 낚시꾼과 거래(T)'));
    },
  };
}

// ---------- 상점 ----------
function shopPanel() {
  const shell = panelShell('바다네 낚시 상점', 'shop', { tabs: [['sell', '팔기', 'coin'], ['buy', '재료 사기', 'flour'], ['rod', '낚싯대', 'rod']], tabKey: 'shop' });
  return {
    el: shell.el,
    render() {
      shell.body.replaceChildren();
      shell.foot.replaceChildren();
      shell.syncTabs('shop');
      if (!S.nearShop) {
        shell.body.append(h('div.empty', '상점 주인에게서 너무 멀어졌어요.'));
        return;
      }
      const sellBuff = S.buffs.find((b) => b.id === 'artisan' && b.until > serverNow());
      if (tabState.shop === 'sell') {
        if (sellBuff) shell.body.append(h('div.toast.paper.buff', { style: { marginBottom: '12px', animation: 'none' } }, ic('vase'), '장인의 손길: 지금은 20% 더 비싸게 팔려요'));
        fishGrid(shell.body);
        shell.body.append(h('div.section-title', '재료 팔기'));
        itemRows(shell.body, [...MATERIALS, ...ESSENCES].map((m) => m.id), { sell: true, empty: '팔 재료가 없어요.' });
        selectionFoot(shell.foot, { sell: true });
      } else if (tabState.shop === 'buy') {
        shell.body.append(
          h(
            'div.list',
            SHOP_STOCK.map((st) => {
              const it = ITEMS[st.id];
              return h(
                'div.row-item',
                iIc(st.id),
                h('div.grow', h('div.nm', it.name, h('span.cnt', `가진 것 ${itemCount(st.id)}`)), h('div.sub', it.desc)),
                [1, 5, 10].map((n) => h('button.small', { disabled: S.me.money < st.price * n, onclick: () => send('buy', { id: st.id, n }) }, `${n}개 `, coinTxt(st.price * n))),
              );
            }),
          ),
        );
        shell.foot.append(h('span.muted', '직접 채집하면 공짜예요. 지렁이와 귀뚜라미는 풀밭, 새우는 해변에 있어요.'));
      } else {
        rodRows(shell.body, { shop: true });
        shell.foot.append(h('span.muted', '좋은 낚싯대일수록 찌 구간이 넓어 대어를 잡기 쉽고, 새 낚시터가 열려요.'));
      }
      shell.foot.prepend(h('span.coin-tag.plank', ic('coin'), fmtMoney(S.me.money)));
    },
  };
}

// ---------- 도감 ----------
function condNodes(f) {
  const out = [];
  if (f.time) f.time.forEach((p) => out.push(h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '2px', marginRight: '6px' } }, ic(PHASE_ICON[p]), PHASES[p].name)));
  if (f.weather) f.weather.forEach((w) => out.push(h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '2px', marginRight: '6px' } }, ic(WEATHER_ICON[w]), WEATHERS[w].name)));
  return out.length ? out : ['언제나'];
}
function baitsFor(f) {
  const list = BAITS.filter((b) => b.tag && (b.tag === 'all' || f.likes.includes(b.tag)));
  return list.length ? list.map((b) => h('span', { title: b.name, style: { display: 'inline-flex', alignItems: 'center', gap: '2px', marginRight: '8px' } }, iIc(b.id), b.name)) : ['-'];
}
function dexPanel() {
  const tabs = [...ZONE_ORDER.map((z) => [z, ZONES[z].name]), ['variant', '변이', 'sparkle']];
  const shell = panelShell('물고기 도감', 'book', { tabs, tabKey: 'dex' });
  return {
    el: shell.el,
    render() {
      shell.body.replaceChildren();
      shell.foot.replaceChildren();
      shell.syncTabs('dex');
      const dex = S.me.dex || {};
      const total = Object.keys(dex).length;
      shell.foot.append(
        h('div', { style: { flex: 1 } }, h('span.title', `모은 종류 ${total} / ${FISH.length}`), h('div.progress-line', h('div', { style: { width: `${(total / FISH.length) * 100}%` } }))),
        h('span.muted', '처음 잡는 종은 기본가 3배 보너스'),
      );
      if (tabState.dex === 'variant') {
        const got = new Set(Object.values(dex).flatMap((d) => d.v || []));
        shell.body.append(h('div.muted', { style: { marginBottom: '12px' } }, '변이는 어떤 물고기에게든 낮은 확률로 붙어요. 미끼, 버프, 낚싯대의 행운으로 확률을 올릴 수 있어요.'));
        shell.body.append(
          h(
            'div.list',
            VARIANTS.map((v) => {
              const c = v.cond || {};
              const conds = [
                ...Object.entries(c.zone || {}).filter(([, k]) => k > 1).map(([z]) => ZONES[z].name),
                ...Object.entries(c.phase || {}).filter(([, k]) => k > 1).map(([p]) => PHASES[p].name),
                ...Object.entries(c.weather || {}).filter(([, k]) => k > 1).map(([w]) => WEATHERS[w].name),
              ];
              return h(
                'div.row-item' + (got.has(v.id) ? '' : '.no'),
                ic(v.buff ? BUFF_ICON[v.buff.id] : 'fog'),
                h(
                  'div.grow',
                  h('div.nm', varBadge(v), h('span.cnt', `가치 ×${v.mult}${got.has(v.id) ? ' · 발견함' : ' · 아직 못 봄'}`)),
                  h('div.sub', `${v.desc}  잘 나오는 때: ${conds.length ? conds.join(', ') : '아주 드묾'}`),
                  h('div.sub', v.buff ? `잡으면 [${v.buff.name}] ${v.buff.desc}, ${Math.round(v.buff.duration / 60)}분${v.buff.global ? ', 섬 전체' : ', 주변 45m'}` : '특별한 효과 없음'),
                ),
              );
            }),
          ),
        );
        return;
      }
      if (dexDetail) {
        const f = FISH_BY_ID[dexDetail];
        const d = dex[f.id];
        const rec = S.records[f.id];
        const rar = RARITY[f.rarity];
        const hidden = !d && rar.index >= 4;
        const img = h('img', { src: fishThumb(f.id), style: d ? null : { filter: 'brightness(0) opacity(0.35)' } });
        shell.body.append(
          h('button.small', { onclick: () => { dexDetail = null; current.render(); }, style: { marginBottom: '12px' } }, '목록으로'),
          h(
            'div.dex-detail',
            h(
              'div',
              h('div.pic', img),
              h('div.var-grid', VARIANTS.map((v) => {
                const has = d?.v?.includes(v.id);
                return h('span.var-chip' + (has ? '.got' : ''), { style: { background: v.ink }, onclick: has ? () => (img.src = fishThumb(f.id, v.id)) : null }, v.name);
              })),
            ),
            h(
              'div',
              h('div.title', { style: { fontSize: '30px', color: rar.index >= 1 ? rar.color : 'var(--ink)' } }, hidden ? '???' : f.name),
              h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, rarBadge(rar), h('span.muted', ZONES[f.zone].name)),
              h('p', { style: { margin: '10px 0 0', color: 'var(--ink-soft)' } }, d ? f.desc : '아직 잡지 못했어요.'),
              h(
                'div.kv',
                h('span.k', '나오는 때'), h('span', condNodes(f)),
                h('span.k', '좋아하는 것'), h('span', f.likes.map((t) => TAG_NAME[t]).join(', ')),
                h('span.k', '맞는 미끼'), h('span', baitsFor(f)),
                h('span.k', '움직임'), h('span', `${BEHAVIOR_BY_SHAPE_HINT(f)}형`),
                h('span.k', '크기'), h('span', `${formatKg(f.minW)} ~ ${formatKg(f.maxW)}`),
                h('span.k', '기본 가치'), h('span', coinTxt(f.price)),
                h('span.k', '내 기록'), h('span', d ? `${d.n}마리 · 최대 ${formatKg(d.maxW)}` : '-'),
                h('span.k', '섬 최대어'), h('span', rec ? `${formatKg(rec.w)} · ${rec.name}${rec.v ? ` (${VARIANT[rec.v].name})` : ''}` : '기록 없음'),
              ),
            ),
          ),
        );
        return;
      }
      const list = FISH.filter((f) => f.zone === tabState.dex);
      const got = list.filter((f) => dex[f.id]).length;
      const z = ZONES[tabState.dex];
      const rodName = RODS.find((r) => r.tier === z.minRod && !r.crafted).name;
      shell.body.append(h('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: '12px' } }, h('span.title', { style: { fontSize: '17px' } }, `${z.name}  ${got} / ${list.length}`), h('span.muted', `${rodName} 이상`)));
      shell.body.append(
        h(
          'div.dex-grid',
          list.map((f) => {
            const d = dex[f.id];
            const rar = RARITY[f.rarity];
            const hidden = !d && rar.index >= 4;
            return h(
              'div.dex-cell' + (d ? '' : '.unk'),
              { onclick: () => { dexDetail = f.id; sfx.click(); current.render(); } },
              h('span.no', String(FISH.indexOf(f) + 1).padStart(2, '0')),
              h('span.dot', { style: { background: rar.color } }),
              h('img', { src: fishThumb(f.id) }),
              h('div.nm', { style: { color: d ? 'var(--ink)' : 'var(--ink-soft)' } }, hidden ? '???' : f.name),
            );
          }),
        ),
      );
    },
  };
}

// ---------- 랭킹 ----------
let lbData = null;
function rankPanel() {
  const shell = panelShell('물비늘 게시판', 'trophy');
  send('leaderboard');
  const table = (title, rows, fmt) =>
    h('div', h('div.section-title', title), rows.length
      ? h('table.rank', rows.map((r, i) => h('tr' + (i === 0 ? '.top1' : ''), h('td.n', i + 1), h('td', h('span.dot', { style: { background: r.color, marginRight: '6px' } }), r.name), h('td', { style: { textAlign: 'right' } }, fmt(r)))))
      : h('div.empty', { style: { padding: '10px' } }, '아직 기록이 없어요'));
  return {
    el: shell.el,
    render() {
      shell.body.replaceChildren();
      if (!lbData) {
        shell.body.append(h('div.empty', '게시판을 읽는 중…'));
        return;
      }
      shell.body.append(
        h(
          'div.rank-cols',
          table('가장 값진 한 마리', lbData.best, (r) => `${r.fish.v ? VARIANT[r.fish.v].name + ' ' : ''}${FISH_BY_ID[r.fish.sp].name} · ${fmtMoney(r.fish.price)}`),
          table('번 돈', lbData.earned, (r) => coinTxt(r.v)),
          table('도감 수집', lbData.dex, (r) => `${r.v} / ${FISH.length}`),
          table('잡은 마릿수', lbData.catches, (r) => `${r.v}마리`),
        ),
      );
      const recs = Object.entries(S.records)
        .map(([id, r]) => ({ f: FISH_BY_ID[id], r }))
        .filter((x) => x.f)
        .sort((a, b) => RARITY[b.f.rarity].index - RARITY[a.f.rarity].index || b.r.w - a.r.w);
      shell.body.append(h('div.section-title', `종류별 섬 최대어 (${recs.length}종)`));
      shell.body.append(
        recs.length
          ? h('table.rank', recs.map(({ f, r }) => h('tr', h('td', { style: { color: RARITY[f.rarity].index ? RARITY[f.rarity].color : 'var(--ink)', fontFamily: 'var(--font-title)' } }, f.name), h('td', formatKg(r.w), r.v ? h('span', { style: { marginLeft: '6px' } }, varBadge(VARIANT[r.v])) : ''), h('td', { style: { textAlign: 'right' } }, r.name))))
          : h('div.empty', '아직 아무도 낚지 않았어요'),
      );
    },
  };
}
on('leaderboard', (m) => {
  lbData = m;
  if (current?.name === 'rank') current.render();
});

// ---------- 도움말 ----------
function helpPanel() {
  const shell = panelShell('낚시 안내서', 'help');
  const k = (key, label) => h('span', h('span.keycap', key), label);
  shell.body.append(
    h(
      'div.help',
      h('div.section-title', '조작'),
      h('div.row', k('W A S D', '이동'), k('Shift', '달리기'), k('Space', '점프'), k('우클릭 드래그', '시점'), k('휠', '줌')),
      h('div.row', k('E', '채집 · 상점 · 제작대'), k('Q', '미끼 바꾸기'), k('T', '가까운 사람과 거래'), k('Tab', '접속자')),
      h('div.row', k('I', '가방'), k('C', '제작'), k('K', '도감'), k('L', '랭킹'), k('Enter', '채팅'), k('M', '소리')),
      h('div.section-title', '낚는 법'),
      h('div', '1. 물을 바라보고 왼쪽 버튼을 꾹 눌러 힘을 모았다가 떼요. 초록 고리가 뜨는 곳에 던질 수 있어요.'),
      h('div', '2. 찌가 살짝 흔들리는 건 간보는 거예요. 찌가 쑥 들어가고 머리 위에 느낌표가 뜨면 바로 클릭!'),
      h('div', '3. 오른쪽 게이지에서 물고기가 위아래로 도망가요. 누르고 있으면 초록 구간이 올라가고, 떼면 내려가요. 초록 구간으로 물고기를 덮고 있으면 오른쪽 막대가 차요. 꽉 채우면 잡혀요.'),
      h('div', '4. 희귀한 물고기일수록 빠르고 변덕스러워요. 낚싯대가 좋을수록 초록 구간이 넓어져요.'),
      h('div', '5. 파이팅 중에 1~4 키로 도구를 쓸 수 있어요. 뜰채(진행도 +25%), 진정 떡밥(물고기 느려짐), 큰 찌(구간 넓어짐), 질긴 낚싯줄(덜 떨어짐). 종류마다 한 번씩만 써요.'),
      h('div', '6. 잡을 때마다 낚시 레벨 경험치가 쌓여요. 레벨이 오를수록 찌 구간이 넓어지고 물고기가 느려져요.'),
      h('div.section-title', '더 큰 물고기를 위해'),
      h('div', '같은 종이라도 개체마다 크기가 달라요. 클수록 품질(소형, 보통, 대형, 대물, 괴물급)과 값이 올라가요.'),
      h('div', '아주 드물게 변이(이끼, 달빛, 잿불, 그림자, 유령, 뇌전, 수정, 청자, 성운)가 붙어요. 잡으면 주변 사람들에게도 좋은 효과가 퍼져요.'),
      h('div', '미끼는 직접 만들어요. 반짝이는 곳에서 E로 재료를 모으고, 물고기를 손질하면 생선살, 비늘, 정수가 나와요.'),
      h('div', '물고기마다 좋아하는 먹이와 나오는 시간, 날씨가 달라요. 도감에서 확인해 보세요.'),
    ),
  );
  return { el: shell.el, render() {} };
}

// ---------- 거래 ----------
let tradeState = null;
let myOffer = { items: {}, fish: [], money: 0 };
let tradePick = 'mat';
const pushOffer = () => send('tradeOffer', myOffer);
function tradePanel() {
  const shell = panelShell('물물교환', 'trade');
  shell.el.querySelector('.x').onclick = () => send('tradeCancel');
  return {
    el: shell.el,
    render() {
      const ts = tradeState;
      shell.body.replaceChildren();
      shell.foot.replaceChildren();
      if (!ts) return;
      const offerList = (off, recs) => {
        const out = [];
        for (const [id, n] of Object.entries(off.items)) {
          out.push(h('div.mini', iIc(id), h('span.grow', `${ITEMS[id].name} ×${n}`), recs ? null : h('button.tiny', { disabled: ts.locked.me, onclick: () => { const v = (myOffer.items[id] || 0) - 1; if (v <= 0) delete myOffer.items[id]; else myOffer.items[id] = v; pushOffer(); } }, '빼기')));
        }
        const fishRecs = recs || off.fish.map((uid) => S.me.fish.find((f) => f.uid === uid)).filter(Boolean);
        for (const f of fishRecs) {
          const sp = FISH_BY_ID[f.sp];
          out.push(h('div.mini', h('img', { src: fishThumb(f.sp, f.v), style: { width: '44px', height: '22px', objectFit: 'contain' } }), h('span.grow', `${f.v ? VARIANT[f.v].name + ' ' : ''}${sp.name} ${formatKg(f.w)}`), recs ? null : h('button.tiny', { disabled: ts.locked.me, onclick: () => { myOffer.fish = myOffer.fish.filter((u) => u !== f.uid); pushOffer(); } }, '빼기')));
        }
        if (off.money) out.push(h('div.mini', ic('coin'), h('span.grow', fmtMoney(off.money))));
        if (!out.length) out.push(h('div.muted', { style: { fontSize: '13px', padding: '6px' } }, '비어 있어요'));
        return out;
      };
      const stateLbl = (lk, cf) => (cf ? '확정' : lk ? '준비 완료' : '고르는 중');
      const pick = h('div.trade-pick');
      const pickTabs = h('div.seg', [['mat', '재료'], ['bait', '미끼'], ['fish', '물고기']].map(([id, l]) => h('button.tiny' + (tradePick === id ? '.wood' : ''), { onclick: () => { tradePick = id; current.render(); } }, l)));
      if (tradePick === 'fish') {
        for (const f of S.me.fish.filter((f) => !myOffer.fish.includes(f.uid))) {
          pick.append(h('div.mini', h('span.grow', `${f.v ? VARIANT[f.v].name + ' ' : ''}${FISH_BY_ID[f.sp].name} ${formatKg(f.w)}`), h('button.tiny', { disabled: ts.locked.me, onclick: () => { myOffer.fish.push(f.uid); pushOffer(); } }, '올리기')));
        }
      } else {
        const ids = tradePick === 'bait' ? BAITS.map((b) => b.id) : [...MATERIALS, ...ESSENCES].map((m) => m.id);
        for (const id of ids) {
          const left = itemCount(id) - (myOffer.items[id] || 0);
          if (left <= 0) continue;
          const add = (n) => { myOffer.items[id] = (myOffer.items[id] || 0) + Math.min(n, left); pushOffer(); };
          pick.append(h('div.mini', iIc(id), h('span.grow', `${ITEMS[id].name} (${left})`), h('button.tiny', { disabled: ts.locked.me, onclick: () => add(1) }, '+1'), h('button.tiny', { disabled: ts.locked.me, onclick: () => add(5) }, '+5'), h('button.tiny', { disabled: ts.locked.me, onclick: () => add(left) }, '전부')));
        }
      }
      if (!pick.children.length) pick.append(h('div.muted', { style: { fontSize: '13px' } }, '올릴 수 있는 게 없어요'));
      const moneyIn = h('input', { type: 'number', min: 0, max: S.me.money, value: myOffer.money || '', placeholder: '0', disabled: ts.locked.me, style: { width: '110px', padding: '4px 8px' } });
      moneyIn.addEventListener('change', () => { myOffer.money = Math.max(0, Math.min(S.me.money, Math.floor(Number(moneyIn.value) || 0))); pushOffer(); });
      moneyIn.addEventListener('keydown', (e) => e.stopPropagation());

      shell.body.append(
        h(
          'div.trade-cols',
          h('div.trade-side', h('h3', '내가 줄 것', h('span.state' + (ts.locked.me ? '.on' : ''), stateLbl(ts.locked.me, ts.confirmed.me))), h('div.trade-offer', offerList(ts.mine)), h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } }, ic('coin'), moneyIn, h('span.muted', `가진 돈 ${fmtMoney(S.me.money)}`)), pickTabs, pick),
          h('div.trade-side', h('h3', `${ts.partner.name}님이 줄 것`, h('span.state' + (ts.locked.them ? '.on' : ''), stateLbl(ts.locked.them, ts.confirmed.them))), h('div.trade-offer', offerList(ts.theirs, ts.theirs.fishRecs))),
        ),
      );
      shell.foot.append(
        h('span.muted', '둘 다 준비하고 둘 다 확정하면 바꿔요. 내용이 바뀌면 준비가 풀려요.'),
        h('span', { style: { flex: 1 } }),
        h('button.danger.small', { onclick: () => send('tradeCancel') }, '그만두기'),
        h('button.wood', { onclick: () => send('tradeLock', { lock: !ts.locked.me }) }, ts.locked.me ? '준비 풀기' : '준비 완료'),
        h('button.primary', { disabled: !(ts.locked.me && ts.locked.them) || ts.confirmed.me }, '바꾸기'),
      );
      shell.foot.lastChild.onclick = () => send('tradeConfirm');
    },
  };
}

on('tradeReq', (m) => {
  const box = h(
    'div.modal.paper',
    h('div.t', ic('trade'), '거래 요청'),
    h('div', { style: { marginTop: '6px' } }, `${m.name}님이 물물교환을 하자고 해요.`),
    h('div.btns', h('button.primary', { onclick: () => { send('tradeRespond', { from: m.from, accept: true }); box.remove(); } }, '좋아요'), h('button', { onclick: () => { send('tradeRespond', { from: m.from, accept: false }); box.remove(); } }, '다음에요')),
  );
  ui().append(box);
  sfx.open();
  setTimeout(() => box.remove(), 20000);
});
on('tradeState', (m) => {
  const opening = !tradeState;
  tradeState = m;
  S.tradeOpen = true;
  myOffer = { items: { ...m.mine.items }, fish: [...m.mine.fish], money: m.mine.money };
  if (opening || current?.name !== 'trade') openPanel('trade', true);
  else current.render();
});
function endTrade(msg, kind) {
  tradeState = null;
  S.tradeOpen = false;
  if (current?.name === 'trade') closePanel(true);
  toast(msg, kind, 3200, kind === 'ok' ? 'trade' : null);
}
on('tradeClosed', (m) => endTrade(m.reason || '거래가 끝났어요.', 'warn'));
on('tradeDone', (m) => {
  endTrade(`${m.partner}님과 거래했어요.`, 'ok');
  sfx.coin();
});

// ---------- 패널 관리 ----------
const BUILDERS = { bag: bagPanel, craft: craftPanel, shop: shopPanel, dex: dexPanel, rank: rankPanel, help: helpPanel, trade: tradePanel };

export function openPanel(name, force = false) {
  if (S.tradeOpen && name !== 'trade' && !force) {
    toast('거래 중이에요. 먼저 거래를 끝내 주세요.', 'warn');
    return;
  }
  if (current?.name === name && !force) return closePanel();
  if (current) closePanel(true);
  if (name === 'shop' && !S.nearShop) return toast('상점 주인에게 가까이 가세요.', 'warn');
  const p = BUILDERS[name]();
  p.name = name;
  const rawRender = p.render;
  p.render = () => {
    const body = p.el.querySelector('.body');
    const st = body?.scrollTop || 0;
    const tab = JSON.stringify(tabState) + dexDetail;
    rawRender();
    if (body && tab === p.lastTab) body.scrollTop = st;
    p.lastTab = tab;
  };
  current = p;
  ui().append(p.el);
  p.render();
  S.panelOpen = name;
  sfx.open();
}

export function closePanel(silent = false) {
  if (!current) return;
  if (current.name === 'trade' && tradeState && !silent) {
    send('tradeCancel');
    return;
  }
  current.el.remove();
  current = null;
  S.panelOpen = null;
  selected.clear();
  dexDetail = null;
}

export function refreshPanel() {
  if (current) current.render();
}

export function panelName() {
  return current?.name || null;
}
