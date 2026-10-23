// 게임 전체에서 쓰는 데이터 모양 — 서버·클라이언트 공용
import type { Farm } from './data/crops.ts';
export type RarityId = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export type QualityId = 'small' | 'normal' | 'large' | 'trophy' | 'monster';
export type PhaseId = 'dawn' | 'day' | 'dusk' | 'night';
export type WeatherId = 'clear' | 'cloudy' | 'rain' | 'fog' | 'storm';
export type ToolId = 'board' | 'grill' | 'pot' | 'fryer';

export interface FishLook {
  shape: string;
  c1: string;
  c2: string;
  pat: string;
  pc: string;
  fin: string;
}

export interface FishSpecies {
  id: string;
  name: string;
  zone: string;
  rarity: RarityId;
  minW: number;
  maxW: number;
  price: number;
  likes: string[];
  len: number;
  look: FishLook;
  time: PhaseId[] | null;
  weather: WeatherId[] | null;
  desc: string;
}

/** 잡은 물고기 한 마리 */
export interface FishRecord {
  uid?: string;
  sp: string;
  w: number;
  p: number;
  q: QualityId;
  v: string | null;
  len: number;
  price: number;
  t?: number;
  by?: string;
  lock?: boolean;
}

/** 재료·미끼·도구·식재료 공통 아이템 정의 */
export interface Item {
  id: string;
  name: string;
  value: number;
  icon?: string;
  desc?: string;
  // 미끼
  bait?: boolean;
  bare?: boolean;
  tag?: string | null;
  bite?: number;
  rarity?: number;
  size?: number;
  variant?: number;
  // 파이팅 도구
  tackle?: boolean;
  key?: string;
  // 정수
  essence?: boolean;
  vid?: string;
  // 식재료
  food?: boolean;
  tags?: string[] | null;
  price?: number;
  // 텃밭
  seed?: string; // 씨앗이면 작물 id
  home?: boolean; // 텃밭 수확물
}

/** 버프·미끼·낚싯대 효과 (부분 집합으로 씀) */
export interface EffectMap {
  rarityBonus?: number;
  sizeBonus?: number;
  biteSpeed?: number;
  variantMult?: number;
  tensionBonus?: number;
  gatherBonus?: number;
  sellBonus?: number;
  zoneBonus?: number;
  slow?: number;
  gain?: number;
  xpBonus?: number;
}

export interface Buff {
  id: string;
  name: string;
  icon?: string;
  desc: string;
  effect: EffectMap;
  until: number;
  global?: boolean;
  food?: boolean;
}

export interface FishingContext {
  phase: PhaseId | string;
  weather: WeatherId | string;
  zone?: string;
}

export interface Dish {
  uid: string;
  rid: string;
  name: string;
  tool: ToolId;
  stars: number;
  dur: number;
  effect: string;
  power: number;
  eff: EffectMap;
  value: number;
  v: string | null;
  by?: string;
  t?: number;
  price?: number;
}

export interface FoodState {
  rid: string;
  name: string;
  type: string;
  value: number;
  effect: EffectMap;
  until: number;
}

export interface DexEntry {
  n: number;
  maxW: number;
  v: string[];
}

export interface Profile {
  id: string;
  name: string;
  tokenHash: string;
  color: string;
  created: number;
  money: number;
  earned: number;
  rods: string[];
  rod: string;
  bait: string | null;
  items: Record<string, number>;
  fish: FishRecord[];
  dex: Record<string, DexEntry>;
  stats: { catches: number; best: (FishRecord & { sp: string }) | null };
  xp: number;
  pos: { x: number; z: number } | null;
  tools?: Partial<Record<ToolId, number>>;
  recipes?: string[];
  dishes?: Dish[];
  food?: FoodState | null;
  farm?: Farm | null;
}

export type PublicProfile = Omit<Profile, 'tokenHash'>;

export interface DbShape {
  players: Record<string, Profile>;
  names: Record<string, string>;
  records: Record<string, { w: number; name: string; v: string | null; t: number; q: QualityId }>;
}
