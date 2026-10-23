// 조리대 패널(요리하기 / 진열대 / 요리 도감)과 다른 사람 진열대
import { useRef, useState } from 'preact/hooks';
import { Panel, Section, Icon, ItemIcon, Stars, VarBadge, Empty, Grow, Coin } from '../common.tsx';
import { DishRow, MoneyTag } from '../parts.tsx';
import { DISH_ICON } from '../../icons.ts';
import { S, itemCount } from '../../../state.ts';
import { send } from '../../../net.ts';
import { sfx } from '../../../audio.ts';
import { fishThumb } from '../../../scene/fishModel.ts';
import { fmtMoney } from '../../dom.ts';
import { U, closePanel, setTab, toast } from '../../store.tsx';
import { FISH_BY_ID } from '../../../../../shared/data/fish.ts';
import { ITEMS } from '../../../../../shared/data/items.ts';
import { RARITY, QUALITY, VARIANT, formatKg } from '../../../../../shared/data/core.ts';
import { TOOLS, RECIPES, MYSTERY, COOKABLE_IDS, TAG_NAME, FOOD_EFFECTS, fishTags, ingredientTags, matchRecipe } from '../../../../../shared/data/cooking.ts';
import type { Dish } from '../../../../../shared/types.ts';

type Ing = { kind: 'fish'; uid: string } | { kind: 'item'; id: string };
// 패널을 닫았다 열어도 고른 재료는 남음. 요리가 끝나면 비움
const sel: { tool: string | null; ings: Ing[] } = { tool: null, ings: [] };
export function clearCookSelection() {
  sel.ings = [];
}
const selCount = (id: string) => sel.ings.filter((g) => g.kind === 'item' && g.id === id).length;
const myRecipes = () => S.me.recipes || ['grilled'];
const tagsOf = (g: Ing) => {
  if (g.kind === 'fish') {
    const f = S.me.fish.find((x) => x.uid === g.uid);
    return f ? fishTags(f) : [];
  }
  return ingredientTags(g.id) || [];
};

function preview() {
  if (!sel.tool || !sel.ings.length) return { text: '재료를 넣어 보세요', kind: 'none', r: null };
  const r = matchRecipe(sel.tool, sel.ings.map(tagsOf));
  if (!r) return { text: MYSTERY[sel.tool].name, kind: 'mystery', r: null };
  if (myRecipes().includes(r.id)) return { text: r.name, kind: 'known', r };
  return { text: '처음 보는 요리가 될 것 같아요…', kind: 'unknown', r: null };
}

const needsText = (r) =>
  r.needs.map(([t, n]) => `${TAG_NAME[t] || (t.startsWith('sp:') ? FISH_BY_ID[t.slice(3)]?.name : t)}${n > 1 ? ` ${n}` : ''}`).join(' + ') +
  (r.no.length ? `  (${r.no.map((t) => TAG_NAME[t]).join(', ')} 빼고)` : '');

function CookTab({ redraw }: { redraw: () => void }) {
  const change = (fn: () => void) => {
    fn();
    sfx.click();
    redraw();
  };
  const add = (g: Ing) => {
    if (sel.ings.length >= 5) return toast('재료는 5개까지 넣을 수 있어요.', 'warn');
    change(() => sel.ings.push(g));
  };
  const pv = preview();
  const fishList = S.me.fish.filter((f) => !f.lock && !sel.ings.some((g) => g.kind === 'fish' && g.uid === f.uid));
  const itemIds = COOKABLE_IDS.filter((id) => itemCount(id) - selCount(id) > 0);
  return (
    <>
      <Section>조리 도구</Section>
      <div class="seg" style={{ flexWrap: 'wrap', gap: '6px' }}>
        {TOOLS.map((t) => {
          const tier = S.me.tools?.[t.id] || 0;
          return (
            <button
              key={t.id}
              class={`small${sel.tool === t.id ? ' wood' : ''}`}
              disabled={!tier}
              title={tier ? `${t.desc} · ${tier}단계` : '상점에서 살 수 있어요'}
              onClick={() => change(() => (sel.tool = t.id))}
            >
              <Icon name={t.id} />
              {`${t.name}${tier ? ` ${tier}단계` : ' (없음)'}`}
            </button>
          );
        })}
      </div>
      {!sel.tool ? (
        <Empty>조리 도구가 없어요. 상점에서 사 오세요.</Empty>
      ) : (
        <>
          <Section>재료 (최대 5개, 눌러서 빼기)</Section>
          <div class="slots">
            {[0, 1, 2, 3, 4].map((i) => {
              const g = sel.ings[i];
              if (!g)
                return (
                  <div key={i} class="slot-cell empty-slot">
                    +
                  </div>
                );
              const remove = () => change(() => sel.ings.splice(i, 1));
              if (g.kind === 'fish') {
                const f = S.me.fish.find((x) => x.uid === g.uid);
                return (
                  <div key={i} class="slot-cell" onClick={remove} title="빼기">
                    <img src={fishThumb(f.sp, f.v)} />
                    <span>{FISH_BY_ID[f.sp].name}</span>
                  </div>
                );
              }
              return (
                <div key={i} class="slot-cell" onClick={remove} title="빼기">
                  <ItemIcon id={g.id} />
                  <span>{ITEMS[g.id].name}</span>
                </div>
              );
            })}
          </div>
          <div class={`preview${pv.kind === 'known' ? ' known' : pv.kind === 'unknown' ? ' unknown' : ''}`}>
            <Icon name={pv.kind === 'known' ? DISH_ICON[sel.tool] : pv.kind === 'unknown' ? 'sparkle' : 'help'} />
            <span>{pv.kind === 'known' ? `완성 예상: ${pv.text}` : pv.text}</span>
            {pv.r && <span class="muted">{`  ${FOOD_EFFECTS[pv.r.effect].name}`}</span>}
          </div>
          <Section>물고기</Section>
          {fishList.length ? (
            <div class="pick-grid">
              {fishList.map((f) => {
                const sp = FISH_BY_ID[f.sp];
                return (
                  <div key={f.uid} class="card click mini-card" onClick={() => add({ kind: 'fish', uid: f.uid })}>
                    {f.v && (
                      <span class="vtag">
                        <VarBadge v={VARIANT[f.v]} />
                      </span>
                    )}
                    <img src={fishThumb(f.sp, f.v)} />
                    <div class="nm" style={{ color: RARITY[sp.rarity].index ? RARITY[sp.rarity].color : 'var(--ink)' }}>
                      {sp.name}
                    </div>
                    <div class="sub">
                      {formatKg(f.w)}
                      <Stars n={QUALITY[f.q].stars} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty pad="8px">쓸 수 있는 물고기가 없어요. (잠긴 물고기는 빠져요)</Empty>
          )}
          <Section>식재료</Section>
          {itemIds.length ? (
            <div class="pick-items">
              {itemIds.map((id) => (
                <button key={id} class={`small food-btn${ITEMS[id].home ? ' home' : ''}`} onClick={() => add({ kind: 'item', id })} title={(ingredientTags(id) || []).map((t) => TAG_NAME[t]).join(', ') + (ITEMS[id].home ? ' · 텃밭산: 요리 별이 잘 나와요' : '')}>
                  <ItemIcon id={id} />
                  {`${ITEMS[id].name} ${itemCount(id) - selCount(id)}`}
                </button>
              ))}
            </div>
          ) : (
            <Empty pad="8px">식재료가 없어요. 상점에서 사거나 채집해 보세요.</Empty>
          )}
        </>
      )}
    </>
  );
}

function DisplayRow({ d, full }: { d: Dish; full: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <DishRow d={d}>
      <input ref={ref} type="number" min={1} defaultValue={String(Math.round(d.value * 1.3))} style={{ width: '96px', padding: '3px 8px' }} onKeyDown={(e) => e.stopPropagation()} />
      <button class="small wood" disabled={full} onClick={() => send('displayDish', { uid: d.uid, price: Number(ref.current?.value) })}>
        진열
      </button>
    </DishRow>
  );
}

function DisplayTab() {
  const st = S.stations.get(S.myId);
  const shown = st?.display || [];
  const dishes = S.me.dishes || [];
  return (
    <>
      <Section>{`진열 중 (${shown.length}/6)`}</Section>
      {!shown.length ? (
        <Empty pad="10px">아직 진열한 요리가 없어요. 아래에서 가격을 정해 올려 보세요.</Empty>
      ) : (
        <div class="list">
          {shown.map((d) => (
            <DishRow key={d.uid} d={d}>
              <span class="title">
                <Coin n={d.price} />
              </span>
              <button class="small" onClick={() => send('undisplayDish', { uid: d.uid })}>
                내리기
              </button>
            </DishRow>
          ))}
        </div>
      )}
      <Section>내 요리</Section>
      {!dishes.length ? (
        <Empty pad="10px">요리가 없어요.</Empty>
      ) : (
        <div class="list">
          {dishes.map((d) => (
            <DisplayRow key={d.uid} d={d} full={shown.length >= 6} />
          ))}
        </div>
      )}
    </>
  );
}

function BookTab() {
  const known = new Set(myRecipes());
  return (
    <>
      {TOOLS.map((t) => (
        <div key={t.id}>
          <Section>
            <Icon name={t.id} />
            {t.name}
          </Section>
          <div class="list">
            {RECIPES.filter((r) => r.tool === t.id).map((r) => {
              const k = known.has(r.id);
              if (!k && r.hidden)
                return (
                  <div key={r.id} class="row-item no">
                    <Icon name="help" />
                    <div class="grow">
                      <div class="nm">숨은 요리 ???</div>
                      <div class="sub">특별한 물고기로만 만들 수 있다는 소문이…</div>
                    </div>
                  </div>
                );
              return (
                <div key={r.id} class={`row-item${k ? '' : ' no'}`}>
                  <Icon name={k ? DISH_ICON[r.tool] : 'help'} />
                  <div class="grow">
                    <div class="nm">
                      {k ? r.name : '???'}
                      <span class="cnt">{FOOD_EFFECTS[r.effect].name}</span>
                    </div>
                    <div class="sub">{k ? `${needsText(r)} — ${r.desc}` : r.buy != null ? `상점에서 레시피를 살 수 있어요 (${fmtMoney(r.buy)})` : '직접 재료를 조합해서 찾아보세요'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

const COOK_TABS: [string, string, string][] = [
  ['cook', '요리하기', 'pot'],
  ['display', '진열대', 'coin'],
  ['book', '요리 도감', 'book'],
];

export function CookPanel() {
  const [, setN] = useState(0);
  const redraw = () => setN((n) => n + 1);
  const tab = U.tabs.cook;
  if (!sel.tool || !(S.me.tools?.[sel.tool] > 0)) sel.tool = TOOLS.find((t) => (S.me.tools?.[t.id] || 0) > 0)?.id || null;
  // 사라진 재료 정리
  sel.ings = sel.ings.filter((g) => (g.kind === 'fish' ? S.me.fish.some((f) => f.uid === g.uid) : selCount(g.id) <= itemCount(g.id)));
  let foot;
  if (tab === 'cook')
    foot = (
      <>
        <span class="muted">아는 레시피는 미리 보여요. 모르는 조합도 넣어 보면 새 요리를 발견할 수 있어요.</span>
        <Grow />
        <button
          class="small"
          disabled={!sel.ings.length}
          onClick={() => {
            sel.ings = [];
            redraw();
          }}
        >
          비우기
        </button>
        <button class="primary" disabled={!sel.ings.length || !sel.tool} onClick={() => send('cookStart', { tool: sel.tool, ings: sel.ings })}>
          {sel.tool && <Icon name={sel.tool} />}
          요리 시작
        </button>
      </>
    );
  else if (tab === 'display') foot = <span class="muted">진열대는 조리대를 깔아 두고 접속해 있는 동안 열려요. 다른 사람이 가까이 와서 사 갈 수 있어요.</span>;
  else foot = <span class="title">{`알아낸 요리 ${RECIPES.filter((r) => myRecipes().includes(r.id)).length} / ${RECIPES.length}`}</span>;
  return (
    <Panel title="조리대" icon="station" tabs={COOK_TABS} tab={tab} onTab={(id) => setTab('cook', id)} onClose={() => closePanel()} foot={foot}>
      {tab === 'cook' ? <CookTab redraw={redraw} /> : tab === 'display' ? <DisplayTab /> : <BookTab />}
    </Panel>
  );
}

export function StallPanel() {
  const owner = U.panelArg;
  const st = S.stations.get(owner);
  return (
    <Panel
      title={st ? `${st.name}님의 진열대` : '진열대'}
      icon={st ? 'station' : 'coin'}
      onClose={() => closePanel()}
      foot={
        st && (
          <>
            <MoneyTag />
            <span class="muted">산 요리는 가방의 요리 칸에 들어가요. 먹으면 낚시가 쉬워져요.</span>
          </>
        )
      }
    >
      {!st ? (
        <Empty>조리대가 사라졌어요.</Empty>
      ) : !st.display.length ? (
        <Empty>진열된 요리가 없어요.</Empty>
      ) : (
        <div class="list">
          {st.display.map((d) => (
            <DishRow key={d.uid} d={{ ...d, value: 0 }}>
              <button class="primary" disabled={S.me.money < d.price} onClick={() => send('buyDisplay', { owner, uid: d.uid })}>
                <Coin n={d.price} />
              </button>
            </DishRow>
          ))}
        </div>
      )}
    </Panel>
  );
}
