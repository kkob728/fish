// 텃밭 돌보기: 칸을 눌러 심기 / 물 주기 / 거두기, 한꺼번에 하기, 밭 넓히기
import { useEffect, useState } from 'preact/hooks';
import { Panel, Section, Icon, ItemIcon, Coin, Empty, Grow } from '../common.tsx';
import { S, itemCount } from '../../../state.ts';
import { send, serverNow } from '../../../net.ts';
import { sfx } from '../../../audio.ts';
import { closePanel } from '../../store.tsx';
import { ITEMS } from '../../../../../shared/data/items.ts';
import { CROPS, CROP, PLOT_SIZES, EXPAND_PRICE, TILE_GRID, tileActive, growthAt, isWet, minutesLeft, seedOf } from '../../../../../shared/data/crops.ts';

let picked: string | null = null; // 고른 작물 (패널을 닫아도 기억)
const KIND_NAME = { food: '요리 재료', bait: '미끼 재료', sale: '팔기용', special: '바다에서 온 특별 작물' };

function useTick(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function TileCell({ i, f, now, onClick }) {
  if (!tileActive(f.size, i))
    return (
      <div class="ftile off" title="밭을 넓히면 쓸 수 있어요">
        <Icon name="fence" />
      </div>
    );
  const t = f.tiles[i];
  if (!t)
    return (
      <div class="ftile empty click" onClick={onClick} title={picked ? `${CROP[picked].name} 심기` : '씨앗을 고르고 누르면 심어요'}>
        +
      </div>
    );
  const crop = CROP[t.c];
  const g = growthAt(t, now);
  const wet = isWet(t, now);
  const ripe = g >= 1;
  return (
    <div class={`ftile click${wet ? ' wet' : ''}${ripe ? ' ripe' : ''}`} onClick={onClick} title={ripe ? '눌러서 거두기' : '눌러서 물 주기'}>
      <ItemIcon id={crop.out} />
      <div class="fnm">{crop.name}</div>
      {ripe ? (
        <div class="fst">다 자람!</div>
      ) : (
        <>
          <div class="fbar">
            <div style={{ width: `${g * 100}%` }} />
          </div>
          <div class="fst">{wet ? `약 ${minutesLeft(t, now)}분` : '목말라요'}</div>
        </>
      )}
      {wet && !ripe && (
        <span class="fdrop">
          <Icon name="water" />
        </span>
      )}
    </div>
  );
}

export function FarmPanel() {
  useTick(1000);
  const [, redraw] = useState(0);
  const plot = S.me.farm?.plot;
  const f = plot != null ? S.farms.get(plot) : null;
  if (!f) {
    return (
      <Panel title="텃밭" icon="sprout" onClose={() => closePanel()}>
        <Empty>아직 텃밭이 없어요. 텃밭의 빈 밭 팻말 앞에서 E를 눌러 빌려 보세요.</Empty>
      </Panel>
    );
  }
  const now = serverNow();
  const owned = CROPS.filter((c) => itemCount(seedOf(c.id)) > 0);
  if (picked && itemCount(seedOf(picked)) <= 0) picked = null;
  if (!picked && owned.length) picked = owned[0].id;
  const active = f.tiles.map((_, i) => i).filter((i) => tileActive(f.size, i));
  const empties = active.filter((i) => !f.tiles[i]);
  const growing = active.filter((i) => f.tiles[i] && growthAt(f.tiles[i], now) < 1);
  const thirsty = growing.filter((i) => !isWet(f.tiles[i], now));
  const ripe = active.filter((i) => f.tiles[i] && growthAt(f.tiles[i], now) >= 1);
  const next = PLOT_SIZES[PLOT_SIZES.indexOf(f.size) + 1];

  const clickTile = (i: number) => {
    const t = f.tiles[i];
    if (!t) {
      if (!picked) return;
      send('farmPlant', { crop: picked, tiles: [i] });
    } else if (growthAt(t, now) >= 1) send('farmHarvest', { tiles: [i] });
    else send('farmWater', { tiles: [i] });
    sfx.click();
  };

  return (
    <Panel
      title="내 텃밭"
      icon="sprout"
      onClose={() => closePanel()}
      foot={
        <>
          <span class="muted">{`${f.size}칸 · 물은 한 번에 20분, 마른 땅은 40% 속도 · 비가 오면 저절로 젖어요`}</span>
          <Grow />
          {next && (
            <button class="small" disabled={S.me.money < EXPAND_PRICE[next]} onClick={() => send('farmExpand')}>
              <Icon name="fence" />
              {`${next}칸으로 넓히기 `}
              <Coin n={EXPAND_PRICE[next]} />
            </button>
          )}
        </>
      }
    >
      <div class="farm-wrap">
        <div>
          <div class="farm-grid">
            {Array.from({ length: TILE_GRID * TILE_GRID }, (_, i) => (
              <TileCell key={i} i={i} f={f} now={now} onClick={() => clickTile(i)} />
            ))}
          </div>
          <div class="farm-acts">
            <button class="small wood" disabled={!picked || !empties.length} onClick={() => send('farmPlant', { crop: picked })}>
              <Icon name="sprout" />
              {`빈 칸 ${empties.length}곳 심기`}
            </button>
            <button class="small" disabled={!thirsty.length} onClick={() => send('farmWater', {})}>
              <Icon name="water" />
              {`물 주기 ${thirsty.length}`}
            </button>
            <button class="primary" disabled={!ripe.length} onClick={() => send('farmHarvest', {})}>
              <Icon name="sickle" />
              {`거두기 ${ripe.length}`}
            </button>
          </div>
        </div>
        <div class="farm-seeds">
          <Section>가진 씨앗</Section>
          {!owned.length ? (
            <Empty pad="10px">씨앗이 없어요. 캠프 상점의 씨앗 칸에서 살 수 있어요.</Empty>
          ) : (
            <div class="list">
              {owned.map((c) => (
                <div
                  key={c.id}
                  class={`row-item click${picked === c.id ? ' picked' : ''}`}
                  onClick={() => {
                    picked = c.id;
                    sfx.click();
                    redraw((n) => n + 1);
                  }}
                >
                  <ItemIcon id={seedOf(c.id)} />
                  <div class="grow">
                    <div class="nm">
                      {c.name}
                      <span class="cnt">{`${itemCount(seedOf(c.id))}개`}</span>
                    </div>
                    <div class="sub">{`${c.min}분 · ${c.yield[0]}~${c.yield[1]}개 → ${ITEMS[c.out].name} · ${KIND_NAME[c.kind]}`}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
