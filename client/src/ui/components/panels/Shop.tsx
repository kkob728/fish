// 상점: 팔기 / 낚시 재료 / 식재료 / 조리 도구 / 레시피 / 낚싯대
import { Panel, Section, Icon, ItemIcon, Coin, Empty } from '../common.tsx';
import { FishGrid, SelectionFoot, ItemRows, RodRows, DishList, BuffNote, MoneyTag, useSelection, activeBuff } from '../parts.tsx';
import { DISH_ICON } from '../../icons.ts';
import { S, itemCount } from '../../../state.ts';
import { send } from '../../../net.ts';
import { U, closePanel, setTab } from '../../store.tsx';
import { ITEMS, MATERIALS, ESSENCES, SHOP_STOCK } from '../../../../../shared/data/items.ts';
import { PRODUCE, SEEDS } from '../../../../../shared/data/crops.ts';
import { TOOLS, RECIPES as COOK_RECIPES, FOOD_EFFECTS } from '../../../../../shared/data/cooking.ts';

const SHOP_TABS: [string, string, string][] = [
  ['sell', '팔기', 'coin'],
  ['buy', '낚시 재료', 'worm'],
  ['food', '식재료', 'flour'],
  ['seed', '씨앗', 'sprout'],
  ['tool', '조리 도구', 'pot'],
  ['recipe', '레시피', 'book'],
  ['rod', '낚싯대', 'rod'],
];

const stockCat = (id: string) => (ITEMS[id].seed ? 'seed' : ITEMS[id].food ? 'food' : 'buy');
function Stock({ cat }: { cat: string }) {
  return (
    <div class="list">
      {SHOP_STOCK.filter((st) => stockCat(st.id) === cat).map((st) => {
        const it = ITEMS[st.id];
        return (
          <div key={st.id} class="row-item">
            <ItemIcon id={st.id} />
            <div class="grow">
              <div class="nm">
                {it.name}
                <span class="cnt">{`가진 것 ${itemCount(st.id)}`}</span>
              </div>
              <div class="sub">{it.desc}</div>
            </div>
            {[1, 5, 10].map((n) => (
              <button key={n} class="small" disabled={S.me.money < st.price * n} onClick={() => send('buy', { id: st.id, n })}>
                {`${n}개 `}
                <Coin n={st.price * n} />
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Tools() {
  return (
    <div class="list">
      {TOOLS.map((t) => {
        const tier = S.me.tools?.[t.id] || 0;
        const price = tier < 3 ? t.prices[tier] : null;
        return (
          <div key={t.id} class="row-item">
            <Icon name={t.id} />
            <div class="grow">
              <div class="nm">
                {t.name}
                <span class="cnt">{tier ? `${tier}단계` : '없음'}</span>
              </div>
              <div class="sub">{`${t.desc} · 단계가 오르면 요리 판정이 넉넉해져요`}</div>
            </div>
            {price == null ? (
              <span class="muted">최고 단계</span>
            ) : (
              <button class={tier ? 'small' : 'primary'} disabled={S.me.money < price} onClick={() => send('buyTool', { id: t.id })}>
                {tier ? '올리기 ' : '사기 '}
                <Coin n={price} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Recipes() {
  const known = new Set(S.me.recipes || []);
  return (
    <div class="list">
      {COOK_RECIPES.filter((r) => !r.hidden && r.buy != null && r.buy > 0).map((r) => (
        <div key={r.id} class={`row-item${known.has(r.id) ? ' no' : ''}`}>
          <Icon name={DISH_ICON[r.tool]} />
          <div class="grow">
            <div class="nm">
              {r.name}
              <span class="cnt">{FOOD_EFFECTS[r.effect].name}</span>
            </div>
            <div class="sub">{r.desc}</div>
          </div>
          {known.has(r.id) ? (
            <span class="muted">알고 있음</span>
          ) : (
            <button class="small" disabled={S.me.money < r.buy} onClick={() => send('buyRecipe', { id: r.id })}>
              <Coin n={r.buy} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

const FOOT_NOTE = {
  buy: '직접 채집하면 공짜예요. 지렁이와 귀뚜라미는 풀밭, 새우는 해변에 있어요.',
  food: '조개, 새우, 해초, 버섯, 산딸기는 채집해서도 요리에 쓸 수 있어요.',
  seed: '씨앗은 캠프 동쪽 바람결 텃밭에 심어요. 텃밭에서 기른 채소로 요리하면 별이 잘 나와요.',
  tool: '조리대(G)를 깔면 가진 도구가 모두 올라가요.',
  recipe: '레시피를 사면 재료 조합이 요리 도감에 적혀요. 사지 않아도 맞는 재료를 넣으면 발견할 수 있어요.',
  rod: '좋은 낚싯대일수록 찌 구간이 넓어 대어를 잡기 쉽고, 새 낚시터가 열려요.',
};

export function ShopPanel() {
  const selection = useSelection();
  const tab = U.tabs.shop;
  let body, foot;
  if (!S.nearShop) body = <Empty>상점 주인에게서 너무 멀어졌어요.</Empty>;
  else if (tab === 'sell') {
    const dishes = S.me.dishes || [];
    body = (
      <>
        {activeBuff('artisan') && <BuffNote icon="vase">장인의 손길: 지금은 20% 더 비싸게 팔려요</BuffNote>}
        <FishGrid selection={selection} />
        <Section>재료 팔기</Section>
        <ItemRows ids={[...MATERIALS, ...ESSENCES].map((m) => m.id)} sell empty="팔 재료가 없어요." />
        <Section>텃밭 작물·씨앗 팔기</Section>
        <ItemRows ids={[...PRODUCE, ...SEEDS].map((m) => m.id)} sell empty="팔 작물이 없어요." />
        <Section>요리 팔기 (물고기보다 훨씬 비싸요)</Section>
        <DishList sell eat={false} />
        {dishes.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            <button class="small wood" onClick={() => send('sellDish', { uids: dishes.map((d) => d.uid) })}>
              요리 전부 팔기
            </button>
          </div>
        )}
      </>
    );
    foot = <SelectionFoot selection={selection} sell />;
  } else {
    body = tab === 'buy' || tab === 'food' || tab === 'seed' ? <Stock cat={tab} /> : tab === 'tool' ? <Tools /> : tab === 'recipe' ? <Recipes /> : <RodRows shop />;
    foot = <span class="muted">{FOOT_NOTE[tab]}</span>;
  }
  return (
    <Panel
      title="바다네 낚시 상점"
      icon="shop"
      tabs={SHOP_TABS}
      tab={tab}
      onTab={(id) => {
        setTab('shop', id);
        selection.clear();
      }}
      onClose={() => closePanel()}
      foot={
        S.nearShop && (
          <>
            <MoneyTag />
            {foot}
          </>
        )
      }
    >
      {body}
    </Panel>
  );
}
