// 요리 한 줄 표시 (가방·상점·거래·조리대에서 공통)
import { h, fmtMoney } from './dom.ts';
import { ic, DISH_ICON } from './icons.ts';
import { stars } from './catchCard.ts';
import { FOOD_EFFECTS } from '../../../shared/data/cooking.ts';
import { VARIANT } from '../../../shared/data/core.ts';

export function dishEffectText(d) {
  return `${FOOD_EFFECTS[d.effect]?.fmt(d.power) || ''} · ${Math.round(d.dur / 60)}분`;
}

export function dishRow(d, ...actions) {
  return h(
    'div.row-item',
    ic(DISH_ICON[d.tool] || 'dishPot'),
    h(
      'div.grow',
      h('div.nm', { style: d.v ? { color: VARIANT[d.v].ink } : null }, d.name, stars(d.stars)),
      h('div.sub', dishEffectText(d), d.value ? h('span', { style: { marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '2px' } }, ic('coin'), fmtMoney(d.value)) : null),
    ),
    ...actions,
  );
}
