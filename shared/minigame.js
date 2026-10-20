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
export function gainRate(fp, reel) {
  return (0.22 * reel) / (0.7 + fp.d);
}
export function lossRate(fp) {
  return 0.1 + fp.d * 0.12;
}
export const START_PROGRESS = 0.3;

// 물고기를 계속 덮고 있어도 걸리는 최소 시간(초) — 서버 검증용
export function minFightSeconds(fp, reel) {
  return (1 - START_PROGRESS) / gainRate(fp, reel);
}

export function createFight(fp, { tension, reel }, rand = Math.random) {
  const zone = zoneSize(tension);
  const gain = gainRate(fp, reel);
  const loss = lossRate(fp);
  const d = fp.d;
  const s = {
    zone,
    y: 0, // 찌 구간 아래쪽 끝 (0..1-zone)
    v: 0,
    fy: 0.25 + rand() * 0.3,
    fv: 0,
    target: 0.5,
    timer: 0.6,
    t: 0,
    progress: START_PROGRESS,
    inZone: false,
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
    step(dt, holding) {
      if (s.result) return s;
      s.t += dt;
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
      // 물고기
      if (fp.behavior === 'smooth') {
        s.target = 0.5 + 0.38 * Math.sin(s.t * (0.7 + d * 1.5)) + 0.08 * Math.sin(s.t * 3.3 + 1);
      } else {
        s.timer -= dt;
        if (s.timer <= 0) pickTarget();
      }
      const stiff = (fp.behavior === 'dart' ? 10 : 5) + d * 14;
      s.fv += (s.target - s.fy) * stiff * dt;
      s.fv *= Math.max(0, 1 - dt * (4.2 - d * 1.6));
      if (rand() < d * dt * 2.5) s.fv += (rand() - 0.5) * d * 1.5;
      const cap = 0.35 + d * 0.9;
      s.fv = Math.max(-cap, Math.min(cap, s.fv));
      s.fy += s.fv * dt;
      if (s.fy < 0.02) { s.fy = 0.02; s.fv = Math.abs(s.fv) * 0.4; }
      if (s.fy > 0.98) { s.fy = 0.98; s.fv = -Math.abs(s.fv) * 0.4; }
      // 진행도
      s.inZone = s.fy >= s.y && s.fy <= s.y + zone;
      s.progress += (s.inZone ? gain : -loss) * dt;
      if (s.progress >= 1) { s.progress = 1; s.result = 'win'; }
      if (s.progress <= 0) { s.progress = 0; s.result = 'lose'; }
      return s;
    },
  };
}
