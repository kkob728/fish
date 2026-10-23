// 물물교환
import { useState } from 'preact/hooks';
import { Panel, Icon, ItemIcon, Grow } from '../common.tsx';
import { S, itemCount } from '../../../state.ts';
import { send } from '../../../net.ts';
import { fishThumb } from '../../../scene/fishModel.ts';
import { fmtMoney } from '../../dom.ts';
import { U } from '../../store.tsx';
import { FISH_BY_ID } from '../../../../../shared/data/fish.ts';
import { ITEMS, MATERIALS, ESSENCES, BAITS, TACKLES } from '../../../../../shared/data/items.ts';
import { VARIANT, formatKg } from '../../../../../shared/data/core.ts';
import { FOODS } from '../../../../../shared/data/cooking.ts';
import { PRODUCE, SEEDS } from '../../../../../shared/data/crops.ts';

interface Offer {
  items: Record<string, number>;
  fish: string[];
  dishes: string[];
  money: number;
}
const myOffer = (): Offer => {
  const m = U.trade.mine;
  return { items: { ...m.items }, fish: [...m.fish], dishes: [...(m.dishes || [])], money: m.money };
};
const push = (fn: (o: Offer) => void) => {
  const o = myOffer();
  fn(o);
  send('tradeOffer', o);
};
const fishLabel = (f) => `${f.v ? VARIANT[f.v].name + ' ' : ''}${FISH_BY_ID[f.sp].name} ${formatKg(f.w)}`;
const dishLabel = (d) => `${d.name} ${'★'.repeat(d.stars)}`;
const stateLbl = (lk, cf) => (cf ? '확정' : lk ? '준비 완료' : '고르는 중');

function Mini({ icon, children, action }: { icon: any; children: any; action?: any }) {
  return (
    <div class="mini">
      {icon}
      <span class="grow">{children}</span>
      {action}
    </div>
  );
}

// 한쪽이 올린 것. editable이면 내 쪽(빼기 버튼)
function OfferList({ off, fishRecs, dishRecs, editable, locked }) {
  const out = [];
  const rm = (fn: (o: Offer) => void, key: string) => (
    <button key={key} class="tiny" disabled={locked} onClick={() => push(fn)}>
      빼기
    </button>
  );
  for (const [id, n] of Object.entries(off.items) as [string, number][])
    out.push(
      <Mini key={id} icon={<ItemIcon id={id} />} action={editable && rm((o) => (n - 1 <= 0 ? delete o.items[id] : (o.items[id] = n - 1)), id)}>
        {`${ITEMS[id].name} ×${n}`}
      </Mini>,
    );
  for (const f of fishRecs)
    out.push(
      <Mini key={f.uid} icon={<img src={fishThumb(f.sp, f.v)} style={{ width: '44px', height: '22px', objectFit: 'contain' }} />} action={editable && rm((o) => (o.fish = o.fish.filter((u) => u !== f.uid)), f.uid)}>
        {fishLabel(f)}
      </Mini>,
    );
  for (const d of dishRecs)
    out.push(
      <Mini key={d.uid} icon={<Icon name="dishPot" />} action={editable && rm((o) => (o.dishes = o.dishes.filter((u) => u !== d.uid)), d.uid)}>
        {dishLabel(d)}
      </Mini>,
    );
  if (off.money)
    out.push(
      <Mini key="money" icon={<Icon name="coin" />}>
        {fmtMoney(off.money)}
      </Mini>,
    );
  if (!out.length)
    out.push(
      <div key="empty" class="muted" style={{ fontSize: '13px', padding: '6px' }}>
        비어 있어요
      </div>,
    );
  return <div class="trade-offer">{out}</div>;
}

const PICK_TABS = [['mat', '재료'], ['bait', '미끼'], ['fish', '물고기'], ['dish', '요리']];

function Picker({ mine, locked }: { mine: Offer; locked: boolean }) {
  const [pick, setPick] = useState('mat');
  const rows = [];
  if (pick === 'dish') {
    for (const d of (S.me.dishes || []).filter((d) => !mine.dishes.includes(d.uid)))
      rows.push(
        <Mini key={d.uid} icon={<Icon name="dishPot" />} action={<button class="tiny" disabled={locked} onClick={() => push((o) => o.dishes.push(d.uid))}>올리기</button>}>
          {dishLabel(d)}
        </Mini>,
      );
  } else if (pick === 'fish') {
    for (const f of S.me.fish.filter((f) => !mine.fish.includes(f.uid)))
      rows.push(
        <Mini key={f.uid} icon={null} action={<button class="tiny" disabled={locked} onClick={() => push((o) => o.fish.push(f.uid))}>올리기</button>}>
          {fishLabel(f)}
        </Mini>,
      );
  } else {
    const ids = pick === 'bait' ? [...BAITS, ...TACKLES].map((b) => b.id) : [...MATERIALS, ...ESSENCES, ...FOODS, ...PRODUCE, ...SEEDS].map((m) => m.id);
    for (const id of ids) {
      const left = itemCount(id) - (mine.items[id] || 0);
      if (left <= 0) continue;
      const add = (n: number) => push((o) => (o.items[id] = (o.items[id] || 0) + Math.min(n, left)));
      rows.push(
        <Mini
          key={id}
          icon={<ItemIcon id={id} />}
          action={
            <>
              <button class="tiny" disabled={locked} onClick={() => add(1)}>+1</button>
              <button class="tiny" disabled={locked} onClick={() => add(5)}>+5</button>
              <button class="tiny" disabled={locked} onClick={() => add(left)}>전부</button>
            </>
          }
        >
          {`${ITEMS[id].name} (${left})`}
        </Mini>,
      );
    }
  }
  return (
    <>
      <div class="seg">
        {PICK_TABS.map(([id, l]) => (
          <button key={id} class={`tiny${pick === id ? ' wood' : ''}`} onClick={() => setPick(id)}>
            {l}
          </button>
        ))}
      </div>
      <div class="trade-pick">
        {rows.length ? (
          rows
        ) : (
          <div class="muted" style={{ fontSize: '13px' }}>
            올릴 수 있는 게 없어요
          </div>
        )}
      </div>
    </>
  );
}

export function TradePanel() {
  const ts = U.trade;
  if (!ts) return null;
  const mine = myOffer();
  const locked = ts.locked.me;
  const myFish = mine.fish.map((uid) => S.me.fish.find((f) => f.uid === uid)).filter(Boolean);
  const myDishes = mine.dishes.map((uid) => (S.me.dishes || []).find((d) => d.uid === uid)).filter(Boolean);
  return (
    <Panel
      title="물물교환"
      icon="trade"
      onClose={() => send('tradeCancel')}
      foot={
        <>
          <span class="muted">둘 다 준비하고 둘 다 확정하면 바꿔요. 내용이 바뀌면 준비가 풀려요.</span>
          <Grow />
          <button class="danger small" onClick={() => send('tradeCancel')}>
            그만두기
          </button>
          <button class="wood" onClick={() => send('tradeLock', { lock: !locked })}>
            {locked ? '준비 풀기' : '준비 완료'}
          </button>
          <button class="primary" disabled={!(locked && ts.locked.them) || ts.confirmed.me} onClick={() => send('tradeConfirm')}>
            바꾸기
          </button>
        </>
      }
    >
      <div class="trade-cols">
        <div class="trade-side">
          <h3>
            내가 줄 것<span class={`state${locked ? ' on' : ''}`}>{stateLbl(locked, ts.confirmed.me)}</span>
          </h3>
          <OfferList off={mine} fishRecs={myFish} dishRecs={myDishes} editable locked={locked} />
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Icon name="coin" />
            <input
              key={mine.money}
              type="number"
              min={0}
              max={S.me.money}
              defaultValue={mine.money ? String(mine.money) : ''}
              placeholder="0"
              disabled={locked}
              style={{ width: '110px', padding: '4px 8px' }}
              onKeyDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                const v = Math.max(0, Math.min(S.me.money, Math.floor(Number(e.currentTarget.value) || 0)));
                push((o) => (o.money = v));
              }}
            />
            <span class="muted">{`가진 돈 ${fmtMoney(S.me.money)}`}</span>
          </div>
          <Picker mine={mine} locked={locked} />
        </div>
        <div class="trade-side">
          <h3>
            {`${ts.partner.name}님이 줄 것`}
            <span class={`state${ts.locked.them ? ' on' : ''}`}>{stateLbl(ts.locked.them, ts.confirmed.them)}</span>
          </h3>
          <OfferList off={ts.theirs} fishRecs={ts.theirs.fishRecs || []} dishRecs={ts.theirs.dishRecs || []} editable={false} locked />
        </div>
      </div>
    </Panel>
  );
}
