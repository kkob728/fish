// 패널 여러 곳에서 쓰는 목록 조각: 물고기 칸, 아이템 줄, 낚싯대 줄, 요리 줄
import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Icon, ItemIcon, Coin, Stars, VarBadge, Empty, Grow } from './common.tsx';
import { DISH_ICON } from '../icons.ts';
import { S, itemCount } from '../../state.ts';
import { send, serverNow } from '../../net.ts';
import { sfx } from '../../audio.ts';
import { fishThumb } from '../../scene/fishModel.ts';
import { selectBait } from '../store.tsx';
import { FISH_BY_ID } from '../../../../shared/data/fish.ts';
import { ITEMS, FISH_BAG_LIMIT } from '../../../../shared/data/items.ts';
import { RARITY, QUALITY, VARIANT, RODS, formatKg, formatLen } from '../../../../shared/data/core.ts';
import { ZONES, ZONE_ORDER } from '../../../../shared/world.ts';
import { FOOD_EFFECTS } from '../../../../shared/data/cooking.ts';
import type { FishRecord, Dish } from '../../../../shared/types.ts';

export const TAG_NAME = { worm: '지렁이', insect: '곤충', paste: '떡밥', fruit: '열매', shrimp: '새우', shell: '조개', cut: '생선살', glow: '발광', fungus: '버섯', sulfur: '유황', lure: '루어', meat: '고기' };

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

export const activeBuff = (id: string) => S.buffs.find((b) => b.id === id && b.until > serverNow());

// 고른 물고기 uid 묶음 (바꾸면 다시 그림)
export function useSelection() {
  const [sel, setSel] = useState(() => new Set<string>());
  // 사라진 물고기 정리
  for (const uid of sel) if (!S.me.fish.some((f) => f.uid === uid)) sel.delete(uid);
  return {
    sel,
    toggle(uid: string) {
      const n = new Set(sel);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      sfx.click();
      setSel(n);
    },
    set(uids: string[]) {
      setSel(new Set(uids));
    },
    clear() {
      setSel(new Set());
    },
  };
}
export type Selection = ReturnType<typeof useSelection>;

// ---------- 물고기 ----------
export function FishCard({ rec, sel, onClick }: { rec: FishRecord; sel?: boolean; onClick: () => void }) {
  const sp = FISH_BY_ID[rec.sp];
  const rar = RARITY[sp.rarity];
  const q = QUALITY[rec.q];
  const v = rec.v ? VARIANT[rec.v] : null;
  return (
    <div class={`card click${sel ? ' sel' : ''}`} onClick={onClick} title={`${sp.name} · ${formatLen(rec.len)} · ${q.name}`}>
      {v && (
        <span class="vtag">
          <VarBadge v={v} />
        </span>
      )}
      {rec.lock && (
        <span class="lock">
          <Icon name="lock" />
        </span>
      )}
      <img src={fishThumb(rec.sp, rec.v)} alt={sp.name} />
      <div class="nm" style={{ color: rar.index >= 1 ? rar.color : 'var(--ink)' }}>
        {sp.name}
      </div>
      <div class="sub">
        <span>{formatKg(rec.w)}</span>
        <Stars n={q.stars} />
      </div>
      <div class="sub">
        <span style={{ color: q.color }}>{q.name}</span>
        <Coin n={rec.price} />
      </div>
    </div>
  );
}

const SORTS = [['recent', '최근'], ['value', '가치'], ['weight', '무게'], ['rarity', '희귀도']];
let lastSort = 'recent';

export function FishGrid({ selection }: { selection: Selection }) {
  const [sort, setSort] = useState(lastSort);
  const list = [...(S.me.fish || [])];
  const ri = (r: FishRecord) => RARITY[FISH_BY_ID[r.sp].rarity].index;
  if (sort === 'value') list.sort((a, b) => b.price - a.price);
  else if (sort === 'weight') list.sort((a, b) => b.w - a.w);
  else if (sort === 'rarity') list.sort((a, b) => ri(b) - ri(a) || b.price - a.price);
  else list.reverse();
  return (
    <>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
        <span class="title" style={{ fontSize: '16px' }}>{`물고기 ${list.length} / ${FISH_BAG_LIMIT}`}</span>
        <Grow />
        <div class="seg">
          {SORTS.map(([v, l]) => (
            <button
              key={v}
              class={`tiny${sort === v ? ' wood' : ''}`}
              onClick={() => {
                lastSort = v;
                setSort(v);
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      {list.length ? (
        <div class="grid">
          {list.map((r) => (
            <FishCard key={r.uid} rec={r} sel={selection.sel.has(r.uid)} onClick={() => selection.toggle(r.uid)} />
          ))}
        </div>
      ) : (
        <Empty>
          아직 잡은 물고기가 없어요.
          <br />
          물가에서 왼쪽 버튼을 꾹 눌렀다 떼서 던져 보세요.
        </Empty>
      )}
    </>
  );
}

export function SelectionFoot({ selection, sell }: { selection: Selection; sell: boolean }) {
  const sel = S.me.fish.filter((f) => selection.sel.has(f.uid));
  const usable = sel.filter((f) => !f.lock);
  const total = usable.reduce((a, f) => a + f.price, 0);
  const uids = usable.map((f) => f.uid);
  return (
    <>
      <span class="title">{`${sel.length}마리 고름`}</span>
      {usable.length > 0 && <Coin n={total} />}
      <Grow />
      <button class="small" onClick={() => selection.set(S.me.fish.filter((f) => !f.lock).map((f) => f.uid))}>
        전부 고르기
      </button>
      <button class="small" disabled={!sel.length} onClick={selection.clear}>
        고르기 취소
      </button>
      <button
        class="small"
        disabled={!sel.length}
        onClick={() => {
          const lock = !sel.every((f) => f.lock);
          sel.forEach((f) => send('lock', { uid: f.uid, lock }));
        }}
      >
        <Icon name="lock" />
        잠금
      </button>
      <button
        class="small wood"
        disabled={!usable.length}
        title="미끼 재료로 손질해요"
        onClick={() => {
          send('dismantle', { uids });
          selection.clear();
        }}
      >
        <Icon name="knife" />
        손질
      </button>
      {sell ? (
        <button
          class="primary"
          disabled={!usable.length}
          onClick={() => {
            send('sellFish', { uids });
            selection.clear();
          }}
        >
          <Icon name="coin" />
          팔기
        </button>
      ) : (
        <button class="small" disabled title="캠프의 상점 주인에게 가면 팔 수 있어요">
          판매는 상점에서
        </button>
      )}
    </>
  );
}

// ---------- 아이템 ----------
export function ItemRows({ ids, sell = false, empty = '없음' }: { ids: string[]; sell?: boolean; empty?: string }) {
  const rows = ids.filter((id) => itemCount(id) > 0);
  if (!rows.length) return <Empty pad="12px">{empty}</Empty>;
  return (
    <div class="list">
      {rows.map((id) => {
        const it = ITEMS[id];
        const n = itemCount(id);
        return (
          <div key={id} class="row-item">
            <ItemIcon id={id} />
            <div class="grow">
              <div class="nm" style={it.essence ? { color: VARIANT[it.vid].ink } : undefined}>
                {it.name}
                <span class="cnt">{`${n}개`}</span>
              </div>
              <div class="sub">{it.bait ? baitEffects(it) : it.desc}</div>
            </div>
            {it.bait && (
              <button class={`small${S.me.bait === id ? ' wood' : ''}`} onClick={() => selectBait(id)}>
                {S.me.bait === id ? '쓰는 중' : '쓰기'}
              </button>
            )}
            {sell && (
              <button class="small" onClick={() => send('sellItem', { id, n: 1 })}>
                {'1개 '}
                <Coin n={it.value} />
              </button>
            )}
            {sell && (
              <button class="small" onClick={() => send('sellItem', { id, n })}>
                {'전부 '}
                <Coin n={it.value * n} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------- 낚싯대 ----------
export function RodRows({ shop }: { shop: boolean }) {
  return (
    <div class="list">
      {RODS.filter((r) => shop || S.me.rods.includes(r.id)).map((r) => {
        const owned = S.me.rods.includes(r.id);
        const equipped = S.me.rod === r.id;
        const zones = ZONE_ORDER.filter((z) => ZONES[z].minRod <= r.tier && !ZONES[z].boat).map((z) => ZONES[z].name);
        return (
          <div key={r.id} class={`row-item${!owned && shop && (r.crafted || S.me.money < r.price) ? ' no' : ''}`}>
            <Icon name="rod" />
            <div class="grow">
              <div class="nm">
                {r.name}
                {r.crafted && <span class="cnt">제작 전용</span>}
              </div>
              <div class="sub">{`찌 구간 ${Math.round((0.2 + (r.tension - 100) * 0.001) * 100)}% · 감기 ×${r.reel} · 행운 +${Math.round(r.luck * 100)}% · 사거리 ${r.range}m`}</div>
              <div class="sub">{`갈 수 있는 곳: ${zones.join(', ')}`}</div>
            </div>
            {owned ? (
              <button class={equipped ? 'small' : 'primary'} disabled={equipped} onClick={() => send('equipRod', { id: r.id })}>
                {equipped ? '들고 있음' : '들기'}
              </button>
            ) : shop && !r.crafted ? (
              <button class="primary" disabled={S.me.money < r.price} onClick={() => send('buyRod', { id: r.id })}>
                <Coin n={r.price} />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ---------- 요리 ----------
export function dishEffectText(d: Pick<Dish, 'effect' | 'power' | 'dur'>) {
  return `${FOOD_EFFECTS[d.effect]?.fmt(d.power) || ''} · ${Math.round(d.dur / 60)}분`;
}

export function DishRow({ d, children }: { d: Dish; children?: ComponentChildren }) {
  return (
    <div class="row-item">
      <Icon name={DISH_ICON[d.tool] || 'dishPot'} />
      <div class="grow">
        <div class="nm" style={d.v ? { color: VARIANT[d.v].ink } : undefined}>
          {d.name}
          <Stars n={d.stars} />
        </div>
        <div class="sub">
          {dishEffectText(d)}
          {d.value ? (
            <span style={{ marginLeft: '8px' }}>
              <Coin n={d.value} />
            </span>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

// 가방의 요리 칸, 상점의 요리 팔기에서 공통
export function DishList({ sell, eat }: { sell: boolean; eat: boolean }) {
  const dishes = S.me.dishes || [];
  if (!dishes.length) return <Empty pad="10px">{eat ? '요리가 없어요. 조리대를 깔고(G) 요리해 보세요.' : '팔 요리가 없어요.'}</Empty>;
  return (
    <div class="list">
      {dishes.map((d) => (
        <DishRow key={d.uid} d={d}>
          {eat && (
            <button class="small wood" onClick={() => send('eatDish', { uid: d.uid })}>
              먹기
            </button>
          )}
          {sell && (
            <button class="small" onClick={() => send('sellDish', { uids: [d.uid] })}>
              팔기
            </button>
          )}
        </DishRow>
      ))}
    </div>
  );
}

export function BuffNote({ icon, children }: { icon: string; children: ComponentChildren }) {
  return (
    <div class="toast paper buff" style={{ marginBottom: '12px', animation: 'none' }}>
      <Icon name={icon} />
      {children}
    </div>
  );
}

export function MoneyTag() {
  return (
    <span class="coin-tag plank">
      <Icon name="coin" />
      {Math.floor(S.me.money).toLocaleString()}
    </span>
  );
}
