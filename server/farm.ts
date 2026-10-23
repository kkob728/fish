// 텃밭: 밭 빌리기, 심기, 물 주기, 거두기, 넓히기. 자라는 정도는 시각만 저장해 두고 필요할 때 계산
import { getDb } from './db.ts';
import { type Session, type Handler, now, world, send, broadcast, toast, sendMe, markDirty, addItems, hasItem, takeItem } from './core.ts';
import { ITEMS } from '../shared/data/items.ts';
import { randInt } from '../shared/rng.ts';
import {
  CROP, PLOT_COUNT, PLOT_SIZES, EXPAND_PRICE, TILE_GRID, type Farm, type Tile,
  WATER_MS, emptyFarm, tileActive, nearPlot, advanceTile, growthAt, seedOf,
} from '../shared/data/crops.ts';
import type { Profile } from '../shared/types.ts';

const RAINY = new Set(['rain', 'storm']);
const rainUntil = () => (RAINY.has(world.weather.id) ? world.weather.until : 0);

// 밭 번호 → 주인 id (처음 쓸 때 저장된 프로필에서 만듦)
let ownerMap: Map<number, string> | null = null;
function owners() {
  if (!ownerMap) {
    ownerMap = new Map();
    for (const p of Object.values(getDb().players)) if (p.farm) ownerMap.set(p.farm.plot, p.id);
  }
  return ownerMap;
}

function farmView(p: Profile) {
  const f = p.farm;
  return { plot: f.plot, owner: p.id, name: p.name, color: p.color, size: f.size, tiles: f.tiles };
}
export function farmList() {
  const db = getDb();
  return [...owners().values()].map((id) => db.players[id]).filter((p) => p?.farm).map(farmView);
}
const pushFarm = (p: Profile) => broadcast('farm', { farm: farmView(p) });

// 칸 번호 목록 검사: 내 밭의 쓸 수 있는 칸만
function tileList(f: Farm, raw): number[] {
  const all = Array.from({ length: TILE_GRID * TILE_GRID }, (_, i) => i).filter((i) => tileActive(f.size, i));
  if (!Array.isArray(raw)) return all;
  return [...new Set(raw.map((x) => x | 0))].filter((i) => all.includes(i));
}

function needFarm(s: Session) {
  const f = s.p.farm;
  if (!f) {
    toast(s, '먼저 텃밭을 빌려야 해요.', 'warn');
    return null;
  }
  if (!nearPlot(f.plot, s.x, s.z, 4)) {
    toast(s, '내 텃밭 가까이 가야 해요.', 'warn');
    return null;
  }
  return f;
}

const claim: Handler = (s, m) => {
  if (s.p.farm) return toast(s, '이미 텃밭이 있어요.', 'warn');
  const plot = m.plot | 0;
  if (plot < 0 || plot >= PLOT_COUNT) return;
  if (owners().has(plot)) return toast(s, '이미 주인이 있는 밭이에요.', 'warn');
  if (!nearPlot(plot, s.x, s.z, 4)) return toast(s, '그 밭 가까이 가야 해요.', 'warn');
  s.p.farm = emptyFarm(plot);
  owners().set(plot, s.p.id);
  markDirty();
  sendMe(s);
  pushFarm(s.p);
  toast(s, '텃밭을 빌렸어요! 상점에서 씨앗을 사 와서 심어 보세요.', 'ok', { icon: 'sprout' });
};

const plant: Handler = (s, m) => {
  const f = needFarm(s);
  if (!f) return;
  const crop = CROP[m.crop];
  if (!crop) return;
  const seed = seedOf(crop.id);
  const t = now();
  let n = 0;
  for (const i of tileList(f, m.tiles)) {
    if (f.tiles[i]) continue;
    if (!hasItem(s.p, seed, 1)) break;
    takeItem(s.p, seed, 1);
    f.tiles[i] = { c: crop.id, p: 0, at: t, wet: rainUntil() };
    n++;
  }
  if (!n) return toast(s, hasItem(s.p, seed, 1) ? '심을 빈 칸이 없어요.' : `${ITEMS[seed].name}이 없어요. 상점에서 살 수 있어요.`, 'warn');
  markDirty();
  sendMe(s);
  pushFarm(s.p);
  send(s, 'farmDone', { act: 'plant', n, crop: crop.id });
};

const water: Handler = (s, m) => {
  const f = needFarm(s);
  if (!f) return;
  const t = now();
  let n = 0;
  for (const i of tileList(f, m.tiles)) {
    const tile = f.tiles[i];
    if (!tile || growthAt(tile, t) >= 1) continue;
    advanceTile(tile, t);
    tile.wet = Math.max(tile.wet, t + WATER_MS);
    n++;
  }
  if (!n) return toast(s, '물 줄 작물이 없어요.', 'warn');
  markDirty();
  pushFarm(s.p);
  send(s, 'farmDone', { act: 'water', n });
};

const harvest: Handler = (s, m) => {
  const f = needFarm(s);
  if (!f) return;
  const t = now();
  const got: Record<string, number> = {};
  for (const i of tileList(f, m.tiles)) {
    const tile = f.tiles[i];
    if (!tile || growthAt(tile, t) < 1) continue;
    const crop = CROP[tile.c];
    got[crop.out] = (got[crop.out] || 0) + randInt(crop.yield[0], crop.yield[1]);
    f.tiles[i] = null;
  }
  if (!Object.keys(got).length) return toast(s, '아직 다 자란 작물이 없어요.', 'warn');
  addItems(s.p, got);
  markDirty();
  sendMe(s);
  pushFarm(s.p);
  send(s, 'farmDone', { act: 'harvest', items: got });
};

const expand: Handler = (s) => {
  const f = needFarm(s);
  if (!f) return;
  const next = PLOT_SIZES[PLOT_SIZES.indexOf(f.size) + 1];
  if (!next) return toast(s, '이미 가장 넓은 밭이에요.', 'warn');
  const price = EXPAND_PRICE[next];
  if (s.p.money < price) return toast(s, '돈이 모자라요.', 'warn');
  s.p.money -= price;
  f.size = next;
  markDirty();
  sendMe(s);
  pushFarm(s.p);
  toast(s, `밭이 ${next}칸으로 넓어졌어요.`, 'ok', { icon: 'sprout' });
};

// 비가 오기 시작하면 모든 밭(접속하지 않은 사람 것도)에 물기가 생김
export function onWeather() {
  const until = rainUntil();
  if (!until) return;
  const t = now();
  const db = getDb();
  for (const id of owners().values()) {
    const f = db.players[id]?.farm;
    if (!f) continue;
    for (const tile of f.tiles as Tile[]) {
      if (!tile) continue;
      advanceTile(tile, t);
      tile.wet = Math.max(tile.wet, until);
    }
  }
  markDirty();
  broadcast('farms', { list: farmList() });
}

export const farmHandlers: Record<string, Handler> = { farmClaim: claim, farmPlant: plant, farmWater: water, farmHarvest: harvest, farmExpand: expand };
