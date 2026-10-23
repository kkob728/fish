// 물고기 도감
import { useState } from 'preact/hooks';
import { Panel, Icon, ItemIcon, Coin, RarBadge, VarBadge } from '../common.tsx';
import { TAG_NAME } from '../parts.tsx';
import { BUFF_ICON, PHASE_ICON, WEATHER_ICON } from '../../icons.ts';
import { S } from '../../../state.ts';
import { sfx } from '../../../audio.ts';
import { fishThumb } from '../../../scene/fishModel.ts';
import { U, closePanel, setTab } from '../../store.tsx';
import { FISH, FISH_BY_ID } from '../../../../../shared/data/fish.ts';
import { BAITS } from '../../../../../shared/data/items.ts';
import { RARITY, VARIANTS, VARIANT, RODS, WEATHERS, PHASES, formatKg } from '../../../../../shared/data/core.ts';
import { ZONES, ZONE_ORDER } from '../../../../../shared/world.ts';
import { BEHAVIOR_NAME, BEHAVIOR_BY_SHAPE } from '../../../../../shared/minigame.ts';

const DEX_TABS: [string, string, string?][] = [...ZONE_ORDER.map((z): [string, string] => [z, ZONES[z].name]), ['variant', '변이', 'sparkle']];
const chip = { display: 'inline-flex', alignItems: 'center', gap: '2px', marginRight: '6px' };

function Conds({ f }) {
  const out = [
    ...(f.time || []).map((p) => (
      <span key={p} style={chip}>
        <Icon name={PHASE_ICON[p]} />
        {PHASES[p].name}
      </span>
    )),
    ...(f.weather || []).map((w) => (
      <span key={w} style={chip}>
        <Icon name={WEATHER_ICON[w]} />
        {WEATHERS[w].name}
      </span>
    )),
  ];
  return <span>{out.length ? out : '언제나'}</span>;
}

function BaitsFor({ f }) {
  const list = BAITS.filter((b) => b.tag && (b.tag === 'all' || f.likes.includes(b.tag)));
  if (!list.length) return <span>-</span>;
  return (
    <span>
      {list.map((b) => (
        <span key={b.id} title={b.name} style={{ ...chip, marginRight: '8px' }}>
          <ItemIcon id={b.id} />
          {b.name}
        </span>
      ))}
    </span>
  );
}

function Variants() {
  const got = new Set(Object.values(S.me.dex || {}).flatMap((d) => d.v || []));
  return (
    <>
      <div class="muted" style={{ marginBottom: '12px' }}>
        변이는 어떤 물고기에게든 낮은 확률로 붙어요. 미끼, 버프, 낚싯대의 행운으로 확률을 올릴 수 있어요.
      </div>
      <div class="list">
        {VARIANTS.map((v) => {
          const c: any = v.cond || {};
          const conds = [
            ...Object.entries(c.zone || {}).filter(([, k]) => (k as number) > 1).map(([z]) => ZONES[z].name),
            ...Object.entries(c.phase || {}).filter(([, k]) => (k as number) > 1).map(([p]) => PHASES[p].name),
            ...Object.entries(c.weather || {}).filter(([, k]) => (k as number) > 1).map(([w]) => WEATHERS[w].name),
          ];
          const has = got.has(v.id);
          return (
            <div key={v.id} class={`row-item${has ? '' : ' no'}`}>
              <Icon name={v.buff ? BUFF_ICON[v.buff.id] : 'fog'} />
              <div class="grow">
                <div class="nm">
                  <VarBadge v={v} />
                  <span class="cnt">{`가치 ×${v.mult}${has ? ' · 발견함' : ' · 아직 못 봄'}`}</span>
                </div>
                <div class="sub">{`${v.desc}  잘 나오는 때: ${conds.length ? conds.join(', ') : '아주 드묾'}`}</div>
                <div class="sub">
                  {v.buff ? `잡으면 [${v.buff.name}] ${v.buff.desc}, ${Math.round(v.buff.duration / 60)}분${v.buff.global ? ', 섬 전체' : ', 주변 45m'}` : '특별한 효과 없음'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Detail({ id, onBack }: { id: string; onBack: () => void }) {
  const [view, setView] = useState<string | null>(null);
  const f = FISH_BY_ID[id];
  const d = S.me.dex?.[f.id];
  const rec = S.records[f.id];
  const rar = RARITY[f.rarity];
  const hidden = !d && rar.index >= 4;
  return (
    <>
      <button class="small" onClick={onBack} style={{ marginBottom: '12px' }}>
        목록으로
      </button>
      <div class="dex-detail">
        <div>
          <div class="pic">
            <img src={fishThumb(f.id, view)} style={d ? undefined : { filter: 'brightness(0) opacity(0.35)' }} />
          </div>
          <div class="var-grid">
            {VARIANTS.map((v) => {
              const has = d?.v?.includes(v.id);
              return (
                <span key={v.id} class={`var-chip${has ? ' got' : ''}`} style={{ background: v.ink }} onClick={has ? () => setView(view === v.id ? null : v.id) : undefined}>
                  {v.name}
                </span>
              );
            })}
          </div>
        </div>
        <div>
          <div class="title" style={{ fontSize: '30px', color: rar.index >= 1 ? rar.color : 'var(--ink)' }}>
            {hidden ? '???' : f.name}
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <RarBadge r={rar} />
            <span class="muted">{ZONES[f.zone].name}</span>
          </div>
          <p style={{ margin: '10px 0 0', color: 'var(--ink-soft)' }}>{d ? f.desc : '아직 잡지 못했어요.'}</p>
          <div class="kv">
            <span class="k">나오는 때</span>
            <Conds f={f} />
            <span class="k">좋아하는 것</span>
            <span>{f.likes.map((t) => TAG_NAME[t]).join(', ')}</span>
            <span class="k">맞는 미끼</span>
            <BaitsFor f={f} />
            <span class="k">움직임</span>
            <span>{`${BEHAVIOR_NAME[BEHAVIOR_BY_SHAPE[f.look.shape] || 'mixed']}형`}</span>
            <span class="k">크기</span>
            <span>{`${formatKg(f.minW)} ~ ${formatKg(f.maxW)}`}</span>
            <span class="k">기본 가치</span>
            <span>
              <Coin n={f.price} />
            </span>
            <span class="k">내 기록</span>
            <span>{d ? `${d.n}마리 · 최대 ${formatKg(d.maxW)}` : '-'}</span>
            <span class="k">섬 최대어</span>
            <span>{rec ? `${formatKg(rec.w)} · ${rec.name}${rec.v ? ` (${VARIANT[rec.v].name})` : ''}` : '기록 없음'}</span>
          </div>
        </div>
      </div>
    </>
  );
}

function ZoneGrid({ zone, onPick }: { zone: string; onPick: (id: string) => void }) {
  const dex = S.me.dex || {};
  const list = FISH.filter((f) => f.zone === zone);
  const got = list.filter((f) => dex[f.id]).length;
  const z = ZONES[zone];
  const rodName = RODS.find((r) => r.tier === z.minRod && !r.crafted).name;
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span class="title" style={{ fontSize: '17px' }}>{`${z.name}  ${got} / ${list.length}`}</span>
        <span class="muted">{`${rodName} 이상`}</span>
      </div>
      <div class="dex-grid">
        {list.map((f) => {
          const d = dex[f.id];
          const rar = RARITY[f.rarity];
          return (
            <div key={f.id} class={`dex-cell${d ? '' : ' unk'}`} onClick={() => onPick(f.id)}>
              <span class="no">{String(FISH.indexOf(f) + 1).padStart(2, '0')}</span>
              <span class="dot" style={{ background: rar.color }} />
              <img src={fishThumb(f.id)} />
              <div class="nm" style={{ color: d ? 'var(--ink)' : 'var(--ink-soft)' }}>
                {!d && rar.index >= 4 ? '???' : f.name}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function DexPanel() {
  const [detail, setDetail] = useState<string | null>(null);
  const tab = U.tabs.dex;
  const total = Object.keys(S.me.dex || {}).length;
  return (
    <Panel
      title="물고기 도감"
      icon="book"
      tabs={DEX_TABS}
      tab={tab}
      bodyKey={detail ? `${tab}:${detail}` : tab}
      onTab={(id) => {
        setTab('dex', id);
        setDetail(null);
      }}
      onClose={() => closePanel()}
      foot={
        <>
          <div style={{ flex: 1 }}>
            <span class="title">{`모은 종류 ${total} / ${FISH.length}`}</span>
            <div class="progress-line">
              <div style={{ width: `${(total / FISH.length) * 100}%` }} />
            </div>
          </div>
          <span class="muted">처음 잡는 종은 기본가 3배 보너스</span>
        </>
      }
    >
      {tab === 'variant' ? (
        <Variants />
      ) : detail ? (
        <Detail id={detail} onBack={() => setDetail(null)} />
      ) : (
        <ZoneGrid
          zone={tab}
          onPick={(id) => {
            sfx.click();
            setDetail(id);
          }}
        />
      )}
    </Panel>
  );
}
