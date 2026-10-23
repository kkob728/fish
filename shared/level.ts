// 낚시 레벨: 잡을 때마다 경험치, 레벨이 오르면 파이팅이 조금씩 쉬워진다
import { RARITY } from './data/core.ts';

export const MAX_LEVEL = 30;

// 레벨 l → l+1 에 필요한 경험치
export function xpToNext(l) {
  return Math.round(12 * Math.pow(l, 1.5) + 18);
}

export function levelInfo(xp = 0) {
  let l = 1;
  let rest = xp;
  while (l < MAX_LEVEL && rest >= xpToNext(l)) {
    rest -= xpToNext(l);
    l++;
  }
  return { level: l, into: rest, need: l >= MAX_LEVEL ? 0 : xpToNext(l) };
}

const TIER_XP = [5, 10, 20, 45, 100, 250];
const QUALITY_XP = { small: 1, normal: 1.2, large: 1.5, trophy: 2, monster: 3 };
export function catchXp(f, rec) {
  return Math.round(TIER_XP[RARITY[f.rarity].index] * (QUALITY_XP[rec.q] || 1) * (rec.v ? 2 : 1));
}
export const MISS_XP = 1;

// 레벨 보너스 — 30레벨에서 찌 구간 +14.5%p, 물고기 속도 -20%, 챔질 여유 +0.29초, 감기 +29%
export function levelPerks(level) {
  const k = Math.max(0, Math.min(MAX_LEVEL, level) - 1);
  return {
    zoneBonus: 0.005 * k,
    speedMult: 1 - (0.2 * k) / (MAX_LEVEL - 1),
    hookBonus: 0.01 * k,
    reelMult: 1 + 0.01 * k,
  };
}

