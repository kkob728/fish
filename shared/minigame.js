// 파이팅 미니게임 (스타듀식 추적 바)
// 세로 게이지 안에서 물고기가 움직이고, 플레이어는 누르면 올라가고 떼면 떨어지는 '찌 구간'으로 물고기를 덮어야 한다.
// 덮고 있으면 진행도가 오르고, 놓치면 내려간다. 클라이언트가 이 코드로 돌리고, 서버는 최소 소요 시간만 검증한다.
import { RARITY } from './data/core.js';

export const BEHAVIOR_BY_SHAPE = {
  eel: 'smooth', dragon: 'smooth', oarfish: 'smooth', veil: 'smooth',
  tuna: 'dart', shark: 'dart', hammerhead: 'dart', pike: 'dart', gar: 'dart',
  catfish: 'sinker', flat: 'sinker', sturgeon: 'sinker', angler: 'sinker', sunfish: 'sinker', goby: 'sinker',
  ray: 'floater', flying: 'floater', arowana: 'floater',
};
export const BEHAVIOR_NAME = { mixed: '변덕', dart: '돌진', sinker: '바닥', floater: '수면', smooth: '유영' };

export function fightParams(f, p) {
  const ti = RARITY[f.rarity].index;
  const d = Math.min(1, 0.1 + ti * 0.15 + p * 0.2);
  return {
    tier: ti,
    d,
    behavior: BEHAVIOR_BY_SHAPE[f.look.shape] || 'mixed',
    hookWindow: Math.max(0.35, 0.85 - ti * 0.09),
  };
}

// 낚싯대 텐션이 높을수록 찌 구간이 넓다
export function zoneSize(tension) {
  return Math.min(0.42, Math.max(0.12, 0.2 + (tension - 100) * 0.001));
}
// mods: { tension, reel, zoneBonus, speedMult, gainMult, lossMult } — 낚싯대·레벨·음식 효과를 합친 값
export function gainRate(fp, mods) {
  return (0.22 * mods.reel * (mods.gainMult || 1)) / (0.7 + fp.d);
}
export function lossRate(fp, mods = {}) {
  return (0.1 + fp.d * 0.12) * (mods.lossMult || 1);
}
export const START_PROGRESS = 0.3;

// 파이팅 소모품 효과
export const TACKLE_EFFECT = {
  landing_net: { progress: 0.25 },
  calm_bait: { slow: 5, slowMult: 0.6 },
  big_float: { wide: 6, wideMult: 1.3 },
  tough_line: { lossMult: 0.5 },
};

// 물고기를 계속 덮고 있어도 걸리는 최소 시간(초) — 서버 검증용
export function minFightSeconds(fp, mods, usedTackles = []) {
  const bonus = usedTackles.reduce((a, id) => a + (TACKLE_EFFECT[id]?.progress || 0), 0);
  return Math.max(0, 1 - START_PROGRESS - bonus) / gainRate(fp, mods);
}

export function createFight(fp, mods, rand = Math.random) {
  const baseZone = Math.min(0.6, zoneSize(mods.tension) + (mods.zoneBonus || 0));
  const gain = gainRate(fp, mods);
  let lossMult = 1;
  const d = fp.d;
  const s = {
    zone: baseZone,
    y: 0, // 찌 구간 아래쪽 끝 (0..1-zone)
    v: 0,
    fy: 0.25 + rand() * 0.3,
    fv: 0,
    target: 0.5,
    timer: 0.6,
    t: 0,
    progress: START_PROGRESS,
    inZone: false,
    slowUntil: 0,
    wideUntil: 0,
    used: [],
    result: null, // 'win' | 'lose'
  };

  function pickTarget() {
    const r = rand();
    switch (fp.behavior) {
      case 'dart': {
        const dir = s.fy > 0.6 ? -1 : s.fy < 0.4 ? 1 : rand() < 0.5 ? -1 : 1;
        s.target = s.fy + dir * (0.3 + rand() * 0.45);
        break;
      }
      case 'sinker':
        s.target = r < 0.15 + d * 0.15 ? 0.7 + rand() * 0.25 : 0.04 + rand() * rand() * 0.55;
        break;
      case 'floater':
        s.target = r < 0.15 + d * 0.15 ? 0.05 + rand() * 0.3 : 0.96 - rand() * rand() * 0.55;
        break;
      default:
        s.target = 0.05 + r * 0.9;
    }
    s.target = Math.min(0.97, Math.max(0.03, s.target));
    s.timer = (0.5 + rand() * 1.4) * (1.4 - d * 0.7);
  }

  return {
    state: s,
    useTackle(id) {
      const e = TACKLE_EFFECT[id];
      if (!e || s.used.includes(id) || s.result) return false;
      s.used.push(id);
      if (e.progress) s.progress = Math.min(0.999, s.progress + e.progress);
      if (e.slow) s.slowUntil = s.t + e.slow;
      if (e.wide) s.wideUntil = s.t + e.wide;
      if (e.lossMult) lossMult *= e.lossMult;
      return true;
    },
    step(dt, holding) {
      if (s.result) return s;
      s.t += dt;
      const wide = s.t < s.wideUntil;
      const zone = Math.min(0.65, baseZone * (wide ? TACKLE_EFFECT.big_float.wideMult : 1));
      s.zone = zone;
      const speed = (mods.speedMult || 1) * (s.t < s.slowUntil ? TACKLE_EFFECT.calm_bait.slowMult : 1);
      // 플레이어 찌 구간
      s.v += (holding ? 3.6 : -3.0) * dt;
      s.v = Math.max(-1.7, Math.min(1.7, s.v));
      s.y += s.v * dt;
      if (s.y < 0) {
        s.y = 0;
        s.v = s.v < -0.4 ? -s.v * 0.3 : 0;
      }
      if (s.y > 1 - zone) {
        s.y = 1 - zone;
        s.v = 0;
      }
      // 물고기 (속도 배수는 움직임 시간 자체를 늦춘다)
      const fdt = dt * speed;
      if (fp.behavior === 'smooth') {
        s.ft = (s.ft || 0) + fdt;
        s.target = 0.5 + 0.38 * Math.sin(s.ft * (0.7 + d * 1.5)) + 0.08 * Math.sin(s.ft * 3.3 + 1);
      } else {
        s.timer -= fdt;
        if (s.timer <= 0) pickTarget();
      }
      const stiff = (fp.behavior === 'dart' ? 10 : 5) + d * 14;
      s.fv += (s.target - s.fy) * stiff * fdt;
      s.fv *= Math.max(0, 1 - fdt * (4.2 - d * 1.6));
      if (rand() < d * fdt * 2.5) s.fv += (rand() - 0.5) * d * 1.5;
      const cap = 0.35 + d * 0.9;
      s.fv = Math.max(-cap, Math.min(cap, s.fv));
      s.fy += s.fv * fdt;
      if (s.fy < 0.02) { s.fy = 0.02; s.fv = Math.abs(s.fv) * 0.4; }
      if (s.fy > 0.98) { s.fy = 0.98; s.fv = -Math.abs(s.fv) * 0.4; }
      // 진행도
      s.inZone = s.fy >= s.y && s.fy <= s.y + zone;
      s.progress += (s.inZone ? gain : -lossRate(fp, mods) * lossMult) * dt;
      if (s.progress >= 1) { s.progress = 1; s.result = 'win'; }
      if (s.progress <= 0) { s.progress = 0; s.result = 'lose'; }
      return s;
    },
  };
}
