// 조선소: 배 사기·바꾸기, 색과 이름 꾸미기
import { useState } from 'preact/hooks';
import { Panel, Section, Icon, Coin } from '../common.tsx';
import { MoneyTag } from '../parts.tsx';
import { S } from '../../../state.ts';
import { send } from '../../../net.ts';
import { closePanel } from '../../store.tsx';
import { ZONES } from '../../../../../shared/world.ts';
import { BOATS, BOAT_COLORS, ZONE_BOAT } from '../../../../../shared/sea.ts';

const zonesFor = (tier: number) => ['deep', ...Object.keys(ZONE_BOAT).filter((z) => ZONE_BOAT[z] <= tier)].map((z) => ZONES[z].name).join(', ');

export function ShipyardPanel() {
  const own = S.me.boat;
  const [color, setColor] = useState(own?.color || BOAT_COLORS[0]);
  const [name, setName] = useState(own?.name || `${S.me.name}호`);
  return (
    <Panel
      title="물비늘 조선소"
      icon="boat"
      onClose={() => closePanel()}
      foot={
        <>
          <MoneyTag />
          <span class="muted">배는 긴 부두 끝에서 E로 띄워요. 더 좋은 배를 사면 지금 배와 바꿔 드려요.</span>
        </>
      }
    >
      <Section>배 고르기</Section>
      <div class="list">
        {BOATS.map((b) => {
          const have = (own?.tier || 0) >= b.tier;
          const cur = own?.tier === b.tier;
          return (
            <div key={b.id} class={`row-item${have && !cur ? ' no' : ''}`}>
              <Icon name="boat" />
              <div class="grow">
                <div class="nm">
                  {b.name}
                  <span class="cnt">{`${b.seats}인승 · 최고 ${Math.round(b.speed * 3.6)}km/h${b.storm ? ' · 폭풍에도 출항' : ''}`}</span>
                </div>
                <div class="sub">{b.desc}</div>
                <div class="sub">{`갈 수 있는 낚시터: ${zonesFor(b.tier)}`}</div>
              </div>
              {cur ? (
                <span class="muted">타는 배</span>
              ) : have ? (
                <span class="muted">더 좋은 배가 있어요</span>
              ) : (
                <button class="primary" disabled={S.me.money < b.price} onClick={() => send('buyBoat', { tier: b.tier })}>
                  {own ? '바꾸기 ' : '사기 '}
                  <Coin n={b.price} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {own && (
        <>
          <Section>내 배 꾸미기</Section>
          <div class="boat-style">
            <div class="swatches">
              {BOAT_COLORS.map((c) => (
                <div key={c} class={`swatch${color === c ? ' on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} />
              ))}
            </div>
            <input maxLength={10} value={name} onInput={(e) => setName(e.currentTarget.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="배 이름 (10자까지)" />
            <button class="wood" disabled={color === own.color && name === own.name} onClick={() => send('boatStyle', { color, name })}>
              꾸미기
            </button>
          </div>
        </>
      )}
    </Panel>
  );
}
