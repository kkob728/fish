// 가방 · 제작대
import { Panel, Section, Grow, Icon, ItemIcon, Coin } from '../common.tsx';
import { FishGrid, SelectionFoot, ItemRows, RodRows, DishList, BuffNote, useSelection, activeBuff, baitEffects } from '../parts.tsx';
import { S, itemCount } from '../../../state.ts';
import { send } from '../../../net.ts';
import { U, closePanel, setTab } from '../../store.tsx';
import { ITEMS, MATERIALS, ESSENCES, BAITS, TACKLES, RECIPES } from '../../../../../shared/data/items.ts';
import { ROD } from '../../../../../shared/data/core.ts';
import { FOODS } from '../../../../../shared/data/cooking.ts';

const BAG_TABS: [string, string, string][] = [
  ['fish', '물고기', 'fish'],
  ['mat', '재료', 'worm'],
  ['bait', '미끼·도구', 'hook'],
  ['dish', '요리', 'dishPot'],
  ['rod', '낚싯대', 'rod'],
];

export function BagPanel() {
  const selection = useSelection();
  const tab = U.tabs.bag;
  const sell = S.nearShop;
  let body, foot;
  if (tab === 'fish') {
    body = <FishGrid selection={selection} />;
    foot = <SelectionFoot selection={selection} sell={sell} />;
  } else if (tab === 'mat') {
    body = (
      <>
        <Section>재료</Section>
        <ItemRows ids={MATERIALS.map((m) => m.id)} sell={sell} empty="재료가 없어요. 반짝이는 곳에서 E로 채집하거나 물고기를 손질해 보세요." />
        <Section>변이 정수</Section>
        <ItemRows ids={ESSENCES.map((m) => m.id)} sell={sell} empty="변이 물고기를 손질하면 정수가 나와요." />
        <Section>식재료</Section>
        <ItemRows ids={FOODS.map((m) => m.id)} sell={sell} empty="식재료가 없어요. 상점의 식재료 칸에서 살 수 있어요." />
      </>
    );
    foot = <span class="muted">{sell ? '상점 앞이라 재료도 팔 수 있어요.' : '재료는 상점 앞에서 팔 수 있어요.'}</span>;
  } else if (tab === 'bait') {
    body = (
      <>
        <Section>미끼</Section>
        <ItemRows ids={BAITS.map((b) => b.id)} empty="미끼가 없어요. 제작(C)에서 만들어 보세요." />
        <Section>파이팅 도구</Section>
        <ItemRows ids={TACKLES.map((t) => t.id)} sell={sell} empty="파이팅 도구가 없어요. 상점에서 사거나 제작할 수 있어요." />
      </>
    );
    foot = <span class="muted">미끼는 물고기가 물었을 때 하나씩 써요. 파이팅 도구는 파이팅 중에 1~4 키로 써요.</span>;
  } else if (tab === 'dish') {
    const food = activeBuff('food');
    const dishes = S.me.dishes || [];
    body = (
      <>
        {food && <BuffNote icon="dishPot">{`먹은 요리: ${food.name} — ${food.desc}`}</BuffNote>}
        <DishList sell={sell} eat />
      </>
    );
    foot = (
      <>
        <span class="muted">{`요리 ${dishes.length}/40 · 먹으면 효과가 생기고, 새로 먹으면 바뀌어요.`}</span>
        <Grow />
        {sell && dishes.length > 0 && (
          <button class="primary" onClick={() => send('sellDish', { uids: dishes.map((d) => d.uid) })}>
            <Icon name="coin" />
            요리 전부 팔기
          </button>
        )}
      </>
    );
  } else body = <RodRows shop={false} />;

  return (
    <Panel
      title="가방"
      icon="bag"
      tabs={BAG_TABS}
      tab={tab}
      onTab={(id) => {
        setTab('bag', id);
        selection.clear();
      }}
      onClose={() => closePanel()}
      foot={foot}
    >
      {body}
    </Panel>
  );
}

// ---------- 제작 ----------
const essenceTotal = () => ESSENCES.reduce((a, e) => a + itemCount(e.id), 0);
function maxCraft(r) {
  let n = Infinity;
  for (const i of r.in) n = Math.min(n, Math.floor((i.tag === 'essence' ? essenceTotal() : itemCount(i.id)) / i.n));
  if (r.money) n = Math.min(n, Math.floor(S.me.money / r.money));
  if (r.out.rod) n = Math.min(n, S.me.rods.includes(r.out.rod) ? 0 : 1);
  return n;
}
const isTackle = (r) => ITEMS[r.out.id]?.tackle;
const CRAFT_GROUPS: [string, typeof RECIPES][] = [
  ['기본 미끼', RECIPES.slice(0, 8)],
  ['고급 미끼', RECIPES.slice(8, 14)],
  ['파이팅 도구', RECIPES.filter(isTackle)],
  ['특별한 것', RECIPES.slice(14).filter((r) => !isTackle(r))],
];

function CraftRow({ r }) {
  const max = maxCraft(r);
  const out = r.out.rod ? null : ITEMS[r.out.id];
  return (
    <div class={`row-item${max <= 0 ? ' no' : ''}`}>
      {r.out.rod ? <Icon name="rod" /> : <ItemIcon id={r.out.id} />}
      <div class="grow">
        <div class="nm">
          {r.out.rod ? ROD[r.out.rod].name : out.name}
          {r.out.n && <span class="cnt">{`${r.out.n}개 · 가진 것 ${itemCount(r.out.id)}`}</span>}
        </div>
        <div class="sub">
          {r.in.map((i) => {
            const ess = i.tag === 'essence';
            const have = ess ? essenceTotal() : itemCount(i.id);
            return (
              <span key={i.id || i.tag} class={`ing${have < i.n ? ' miss' : ''}`}>
                <ItemIcon id={ess ? 'ess_moss' : i.id} color={ess ? '#c78bff' : undefined} />
                {`${ess ? '아무 정수' : ITEMS[i.id].name} ${have}/${i.n}`}
              </span>
            );
          })}
          {r.money ? (
            <span class={`ing${S.me.money < r.money ? ' miss' : ''}`}>
              <Coin n={r.money} />
            </span>
          ) : null}
        </div>
        <div class="sub">{r.out.rod ? '가장 넓은 찌 구간 · 감기 ×2 · 행운 +40%' : out.tackle ? out.desc : baitEffects(out)}</div>
      </div>
      <button class="small" disabled={max < 1} onClick={() => send('craft', { id: r.id, n: 1 })}>
        1번
      </button>
      {!r.out.rod && (
        <button class="small" disabled={max < 5} onClick={() => send('craft', { id: r.id, n: 5 })}>
          5번
        </button>
      )}
      {!r.out.rod && (
        <button class="small wood" disabled={max < 1} onClick={() => send('craft', { id: r.id, n: max })}>
          {max > 0 ? `${max}번` : '최대'}
        </button>
      )}
    </div>
  );
}

export function CraftPanel() {
  return (
    <Panel title="제작대" icon="hammer" onClose={() => closePanel()} foot={<span class="muted">재료 얻는 법: 채집(E), 물고기 손질(가방), 상점, 다른 낚시꾼과 거래(T)</span>}>
      {CRAFT_GROUPS.map(([title, list]) => (
        <div key={title}>
          <Section>{title}</Section>
          <div class="list">
            {list.map((r) => (
              <CraftRow key={r.id} r={r} />
            ))}
          </div>
        </div>
      ))}
    </Panel>
  );
}
