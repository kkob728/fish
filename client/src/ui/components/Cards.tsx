// 화면 가운데 뜨는 카드: 잡은 물고기, 완성한 요리, 거래 요청
import { useEffect, useRef } from 'preact/hooks';
import { Icon, Stars } from './common.tsx';
import { DISH_ICON } from '../icons.ts';
import { fmtMoney } from '../dom.ts';
import { send } from '../../net.ts';
import { mountCatchView } from '../../scene/catchView.ts';
import { U, useUi, closeCatch, bump } from '../store.tsx';
import { FISH_BY_ID } from '../../../../shared/data/fish.ts';
import { RARITY, QUALITY, VARIANT, formatKg, formatLen } from '../../../../shared/data/core.ts';
import { FOOD_EFFECTS, RECIPE_BY_ID } from '../../../../shared/data/cooking.ts';

function CatchCard() {
  const { rec, flags } = U.catchCard;
  const viewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const stop = mountCatchView(viewRef.current, rec.sp, rec.v);
    const timer = setTimeout(closeCatch, 9000);
    return () => {
      stop();
      clearTimeout(timer);
    };
  }, [rec]);
  const sp = FISH_BY_ID[rec.sp];
  const rar = RARITY[sp.rarity];
  const q = QUALITY[rec.q];
  const v = rec.v ? VARIANT[rec.v] : null;
  const stamps = [];
  if (flags.isNew)
    stamps.push(
      <span key="new" class="stamp" style={{ color: '#2f78c4' }}>
        <Icon name="book" />
        {`도감 등록! 보너스 ${fmtMoney(flags.bonus)}`}
      </span>,
    );
  if (flags.isRecord)
    stamps.push(
      <span key="rec" class="stamp" style={{ color: '#c8932a' }}>
        <Icon name="trophy" />
        서버 최대어 기록
      </span>,
    );
  if (flags.autoSold)
    stamps.push(
      <span key="sold" class="stamp" style={{ color: '#8a5a2a' }}>
        <Icon name="coin" />
        가방이 가득 차 바로 판매
      </span>,
    );
  return (
    <div class="catch paper" onClick={(e) => e.target === e.currentTarget && closeCatch()}>
      <div class="banner" style={{ background: v ? v.ink : rar.color }}>
        {v ? `${v.name} 변이!` : `${rar.name} 물고기`}
      </div>
      <div class="cv" ref={viewRef} />
      <div class="name" style={{ color: v ? v.ink : rar.index >= 2 ? rar.color : 'var(--ink)' }}>
        {v ? `${v.name} ${sp.name}` : sp.name}
      </div>
      <div class="sub">
        <span style={{ color: q.color }}>{q.name}</span>
        <Stars n={q.stars} />
      </div>
      <div class="stats">
        <div>
          무게<b>{formatKg(rec.w)}</b>
        </div>
        <div>
          길이<b>{formatLen(rec.len)}</b>
        </div>
        <div>
          가치<b>{fmtMoney(rec.price)}</b>
        </div>
      </div>
      {stamps.length > 0 && <div class="flags">{stamps}</div>}
      <div class="desc">{v ? `${v.desc}${v.buff ? `  주변 낚시꾼들에게 [${v.buff.name}] 효과가 퍼졌어요.` : ''}` : sp.desc}</div>
      <button class="primary" onClick={closeCatch}>
        가방에 넣기
      </button>
    </div>
  );
}

function DishCard() {
  const { dish: d, isNew } = U.dishCard;
  return (
    <div class="catch paper dishcard">
      <div class="banner" style={{ background: d.v ? VARIANT[d.v].ink : '#c8723a' }}>
        {isNew ? '새 요리 발견!' : '요리 완성'}
      </div>
      <div class="dish-pic">
        <Icon name={DISH_ICON[d.tool] || 'dishPot'} />
      </div>
      <div class="name" style={{ color: d.v ? VARIANT[d.v].ink : 'var(--ink)' }}>
        {d.name}
      </div>
      <div class="sub">
        <Stars n={d.stars} />
      </div>
      <div class="stats">
        <div>
          효과<b>{FOOD_EFFECTS[d.effect].fmt(d.power)}</b>
        </div>
        <div>
          지속<b>{`${Math.round(d.dur / 60)}분`}</b>
        </div>
        <div>
          가치<b>{fmtMoney(d.value)}</b>
        </div>
      </div>
      {isNew && (
        <div class="flags">
          <span class="stamp" style={{ color: '#2f78c4' }}>
            <Icon name="book" />
            요리 도감에 기록했어요
          </span>
        </div>
      )}
      <div class="desc">{RECIPE_BY_ID[d.rid]?.desc || '무슨 맛인지 알 수 없지만 먹을 수는 있다.'}</div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
        <button
          class="primary"
          onClick={() => {
            send('eatDish', { uid: d.uid });
            closeCatch();
          }}
        >
          바로 먹기
        </button>
        <button onClick={closeCatch}>가방에 넣기</button>
      </div>
    </div>
  );
}

function TradeRequest({ req }: { req: (typeof U.tradeReqs)[number] }) {
  const answer = (accept: boolean) => {
    send('tradeRespond', { from: req.from, accept });
    U.tradeReqs = U.tradeReqs.filter((r) => r !== req);
    bump();
  };
  return (
    <div class="modal paper">
      <div class="t">
        <Icon name="trade" />
        거래 요청
      </div>
      <div style={{ marginTop: '6px' }}>{`${req.name}님이 물물교환을 하자고 해요.`}</div>
      <div class="btns">
        <button class="primary" onClick={() => answer(true)}>
          좋아요
        </button>
        <button onClick={() => answer(false)}>다음에요</button>
      </div>
    </div>
  );
}

export function Cards() {
  const ui = useUi();
  return (
    <>
      {ui.catchCard && <CatchCard key={ui.catchCard.rec.uid} />}
      {ui.dishCard && <DishCard key={ui.dishCard.dish.uid} />}
      {ui.tradeReqs.map((r) => (
        <TradeRequest key={r.from + r.until} req={r} />
      ))}
    </>
  );
}
