// 텃밭 3D: 입구 팻말·허수아비, 밭마다 울타리·이름표·흙 두둑, 작물(단계별 모양)
import * as THREE from 'three';
import { part, merge, flatMat, textSprite } from './util.ts';
import { walkHeight } from '../../../shared/world.ts';
import { CROP, FARM, PLOT_COUNT, TILE, TILE_GRID, plotCenter, tilePos, tileActive, growthAt, stageOf, isWet } from '../../../shared/data/crops.ts';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 7) => new THREE.CylinderGeometry(rt, rb, h, s);
const ball = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s);
const LEAF = '#6aa84a';
const LEAF2 = '#86c25a';
const SPROUT = '#9ad46a';

// 둥글게 퍼진 잎 n장
function leaves(n, len, color, { y = 0.05, tilt = 0.9, w = 0.12, phase = 0 } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const a = phase + (i / n) * Math.PI * 2;
    return part(box(w, 0.03, len), color, { pos: [Math.sin(a) * len * 0.4, y + Math.sin(tilt) * len * 0.35, Math.cos(a) * len * 0.4], rot: [-tilt, a, 0] });
  });
}

function cropParts(id: string, stage: number) {
  const c = CROP[id];
  if (stage === 0) return [part(ball(0.035), '#e8d8a8', { pos: [-0.12, 0.1, 0.05] }), part(ball(0.035), '#e8d8a8', { pos: [0.1, 0.1, -0.08] }), part(ball(0.03), '#e8d8a8', { pos: [0.02, 0.1, 0.12] })];
  if (stage === 1) return [part(cyl(0.015, 0.015, 0.16), SPROUT, { pos: [0, 0.16, 0] }), ...leaves(2, 0.14, SPROUT, { y: 0.22, tilt: 0.5, w: 0.08 })];
  const ripe = stage === 3;
  const k = ripe ? 1 : 0.65;
  switch (c.look) {
    case 'root':
      return [...leaves(5, 0.42 * k, LEAF, { y: 0.12, tilt: 0.7, w: 0.14 }), part(ball(0.17 * k, 1), c.color, { pos: [0, 0.12, 0], scale: [1, 1.3, 1] })];
    case 'stalk':
      return Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return [part(cyl(0.035, 0.04, 0.75 * k), LEAF2, { pos: [Math.sin(a) * 0.1, 0.1 + 0.37 * k, Math.cos(a) * 0.1] }), part(cyl(0.042, 0.042, 0.14), '#f0f0e0', { pos: [Math.sin(a) * 0.1, 0.15, Math.cos(a) * 0.1] })];
      }).flat();
    case 'bulb':
      return [...leaves(4, 0.5 * k, LEAF2, { y: 0.15, tilt: 1.1, w: 0.06 }), part(ball(0.13 * k + 0.03, 1), c.color, { pos: [0, 0.12, 0] })];
    case 'bush': {
      const parts = [part(ball(0.32 * k, 0), LEAF, { pos: [0, 0.1 + 0.28 * k, 0], scale: [1, 0.85, 1] })];
      if (ripe) {
        const fruit = id === 'potato' ? '#f4f0ff' : c.color;
        for (let i = 0; i < 7; i++) {
          const a = i * 2.4;
          const y = 0.25 + (i % 3) * 0.14;
          parts.push(id === 'chili' ? part(cone(0.04, 0.16, 5), fruit, { pos: [Math.sin(a) * 0.3, y, Math.cos(a) * 0.3], rot: [Math.PI, 0, 0] }) : part(ball(0.05), fruit, { pos: [Math.sin(a) * 0.31, y + 0.05, Math.cos(a) * 0.31] }));
        }
      }
      return parts;
    }
    case 'grain':
      return Array.from({ length: 9 }, (_, i) => {
        const x = ((i % 3) - 1) * 0.16;
        const z = (Math.floor(i / 3) - 1) * 0.16;
        const col = ripe ? '#d8b84a' : LEAF2;
        return [part(cyl(0.012, 0.016, 0.7 * k), ripe ? '#b8a050' : LEAF, { pos: [x, 0.1 + 0.35 * k, z] }), part(box(0.05, 0.2, 0.05), col, { pos: [x + 0.05, 0.1 + 0.68 * k, z], rot: [0, 0, -0.5] })];
      }).flat();
    case 'tree': {
      const parts = [part(cyl(0.05, 0.07, 0.6 * k), '#7a5230', { pos: [0, 0.1 + 0.3 * k, 0] }), part(ball(0.4 * k, 0), LEAF, { pos: [0, 0.1 + 0.75 * k, 0] })];
      if (ripe) for (let i = 0; i < 6; i++) parts.push(part(ball(0.07), c.color, { pos: [Math.sin(i * 1.05) * 0.38, 0.7 + (i % 2) * 0.22, Math.cos(i * 1.05) * 0.38], scale: [1, 1.25, 1] }));
      return parts;
    }
    case 'tall': {
      const parts = [part(cyl(0.035, 0.05, 1.4 * k), LEAF, { pos: [0, 0.1 + 0.7 * k, 0] }), ...leaves(4, 0.55 * k, LEAF2, { y: 0.45 * k, tilt: 0.5, w: 0.1 }), ...leaves(3, 0.45 * k, LEAF2, { y: 0.9 * k, tilt: 0.4, w: 0.09, phase: 0.6 })];
      if (ripe) parts.push(part(cyl(0.06, 0.07, 0.3), c.color, { pos: [0.08, 0.95, 0.04], rot: [0, 0, -0.3] }), part(cone(0.07, 0.18, 5), LEAF2, { pos: [0.12, 0.8, 0.04], rot: [0, 0, -0.3 + Math.PI] }));
      return parts;
    }
    case 'vine': {
      const parts = [part(ball(0.2, 0), LEAF, { pos: [-0.25, 0.12, -0.2], scale: [1.2, 0.4, 1] }), part(ball(0.18, 0), LEAF2, { pos: [0.28, 0.12, 0.15], scale: [1.2, 0.4, 1] }), part(ball(0.16, 0), LEAF, { pos: [0.05, 0.12, -0.32], scale: [1.2, 0.4, 1] })];
      const r = (id === 'watermelon' ? 0.3 : 0.28) * (ripe ? 1 : 0.45);
      parts.push(part(ball(r, 1), ripe ? c.color : '#9ac85a', { pos: [0.02, 0.08 + r * 0.8, 0.05], scale: id === 'watermelon' ? [1.25, 0.95, 1] : [1.1, 0.8, 1.1] }));
      if (ripe && id === 'pumpkin') parts.push(part(cyl(0.03, 0.04, 0.12), '#6a5020', { pos: [0.02, 0.1 + r * 1.55, 0.05] }));
      return parts;
    }
    case 'flower': {
      const parts = [part(cyl(0.03, 0.04, 1.3 * k), LEAF, { pos: [0, 0.1 + 0.65 * k, 0] }), ...leaves(4, 0.3, LEAF2, { y: 0.5 * k, tilt: 0.6, w: 0.14 })];
      if (ripe) {
        parts.push(part(cyl(0.3, 0.3, 0.06, 12), c.color, { pos: [0, 1.38, 0.08], rot: [1.2, 0, 0] }));
        parts.push(part(cyl(0.15, 0.15, 0.08, 10), '#6a4020', { pos: [0, 1.39, 0.11], rot: [1.2, 0, 0] }));
      } else parts.push(part(ball(0.09), LEAF2, { pos: [0, 0.1 + 1.3 * k, 0] }));
      return parts;
    }
  }
  return [];
}

const geoCache = new Map<string, THREE.BufferGeometry>();
function cropGeo(id: string, stage: number) {
  const key = `${id}:${stage}`;
  if (!geoCache.has(key)) geoCache.set(key, merge(cropParts(id, stage)));
  return geoCache.get(key);
}

const MAT = flatMat();
const SOIL_DRY = new THREE.MeshStandardMaterial({ color: '#9a6a3e', roughness: 1, flatShading: true });
const SOIL_WET = new THREE.MeshStandardMaterial({ color: '#5e3c22', roughness: 0.75, flatShading: true });
const SOIL_GEO = (() => {
  const g = new THREE.BoxGeometry(TILE - 0.18, 0.16, TILE - 0.18, 2, 1, 2);
  g.translate(0, 0.02, 0);
  return g;
})();
const HALF = (TILE_GRID * TILE) / 2 + 0.3;

function fenceGeo() {
  const parts = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = -HALF + (i / (n - 1)) * HALF * 2;
    for (const [x, z] of [[t, -HALF], [t, HALF], [-HALF, t], [HALF, t]]) parts.push(part(box(0.12, 0.6, 0.12), '#8a5a32', { pos: [x, 0.3, z] }));
  }
  for (const y of [0.22, 0.46]) {
    parts.push(part(box(HALF * 2, 0.06, 0.05), '#b07a44', { pos: [0, y, -HALF] }), part(box(HALF * 2, 0.06, 0.05), '#b07a44', { pos: [0, y, HALF] }));
    parts.push(part(box(0.05, 0.06, HALF * 2), '#b07a44', { pos: [HALF, y, 0] }));
    // 서쪽(캠프 쪽) 울타리는 가운데를 비워 드나드는 문으로
    parts.push(part(box(0.05, 0.06, HALF - 0.6), '#b07a44', { pos: [-HALF, y, -(HALF + 0.6) / 2] }), part(box(0.05, 0.06, HALF - 0.6), '#b07a44', { pos: [-HALF, y, (HALF + 0.6) / 2] }));
  }
  return merge(parts);
}
const FENCE = fenceGeo();
const STAKES = merge([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => part(box(0.1, 0.45, 0.1), '#8a5a32', { pos: [x * (HALF - 0.2), 0.22, z * (HALF - 0.2)] })));
const SIGN = merge([part(box(0.1, 1.1, 0.1), '#6a4424', { pos: [0, 0.55, 0] }), part(box(0.9, 0.45, 0.06), '#d9a46a', { pos: [0, 1.05, 0] })]);

function nameTag(text: string, color = '#ffe9a8') {
  const s = textSprite([{ text, color, size: 46 }], { scale: 0.45 });
  return s;
}
function disposeTag(s) {
  if (!s) return;
  s.parent?.remove(s);
  s.material.map.dispose();
  s.material.dispose();
}

export type FarmView = { plot: number; owner: string; name: string; color: string; size: number; tiles: any[] };

function buildPlot(i: number) {
  const g = new THREE.Group();
  const c = plotCenter(i);
  g.position.set(c.x, walkHeight(c.x, c.z) ?? FARM.h, c.z);
  const fence = new THREE.Mesh(FENCE, MAT);
  fence.castShadow = true;
  const stakes = new THREE.Mesh(STAKES, MAT);
  const sign = new THREE.Mesh(SIGN, MAT);
  sign.position.set(-HALF - 0.1, 0, -HALF + 0.6);
  sign.rotation.y = Math.PI / 2;
  sign.castShadow = true;
  g.add(fence, stakes, sign);
  const beds = new THREE.Group();
  g.add(beds);
  const soil: THREE.Mesh[] = [];
  const crops: THREE.Mesh[] = [];
  for (let k = 0; k < TILE_GRID * TILE_GRID; k++) {
    const p = tilePos(i, k);
    const s = new THREE.Mesh(SOIL_GEO, SOIL_DRY);
    s.position.set(p.x - c.x, 0, p.z - c.z);
    s.receiveShadow = true;
    const m = new THREE.Mesh(undefined, MAT);
    m.position.copy(s.position);
    m.rotation.y = (k * 1.7) % (Math.PI * 2);
    m.castShadow = true;
    m.visible = false;
    soil.push(s);
    crops.push(m);
    beds.add(s, m);
  }
  let tag = null;
  let data: FarmView | null = null;
  let sig = '';

  function refresh(now: number) {
    const size = data ? data.size : 0;
    let next = `${data?.owner || ''}|${size}`;
    const states = [];
    for (let k = 0; k < crops.length; k++) {
      const t = data?.tiles[k];
      const on = !!data && tileActive(size, k);
      const st = on && t ? `${t.c}${stageOf(growthAt(t, now))}${isWet(t, now) ? 'w' : ''}` : on ? 'e' : '-';
      states.push(st);
    }
    next += states.join(',');
    if (next === sig) return;
    sig = next;
    fence.visible = !!data;
    stakes.visible = !data;
    for (let k = 0; k < crops.length; k++) {
      const t = data?.tiles[k];
      const on = !!data && tileActive(size, k);
      soil[k].visible = on;
      soil[k].material = on && t && isWet(t, now) ? SOIL_WET : SOIL_DRY;
      if (on && t) {
        crops[k].geometry = cropGeo(t.c, stageOf(growthAt(t, now)));
        crops[k].visible = true;
      } else crops[k].visible = false;
    }
  }

  return {
    group: g,
    set(v: FarmView | null, now: number) {
      const label = v ? `${v.name}의 텃밭` : '빈 텃밭 · 빌릴 수 있어요';
      if (!data || !v || data.name !== v.name) {
        disposeTag(tag);
        tag = nameTag(label, v ? '#ffe9a8' : '#d8f0b8');
        tag.position.set(-HALF - 0.1, 1.9, -HALF + 0.6);
        g.add(tag);
      }
      data = v;
      sig = '';
      refresh(now);
    },
    refresh,
    // 다 자란 작물이 가끔 반짝임
    sparkle(fx, now: number) {
      if (!data) return;
      for (let k = 0; k < crops.length; k++) {
        const t = data.tiles[k];
        if (!t || !crops[k].visible || growthAt(t, now) < 1 || Math.random() > 0.006) continue;
        const p = tilePos(i, k);
        fx.sparkle(p.x, g.position.y + 0.9, p.z, '#fff2a0', 4, 0.6);
      }
    },
  };
}

// 텃밭 전체: 입구 팻말, 허수아비, 물통 + 밭 12개
export function buildFarm(scene: THREE.Scene) {
  const root = new THREE.Group();
  scene.add(root);
  const y = FARM.h;
  // 입구 팻말 (캠프 쪽)
  const gate = new THREE.Mesh(
    merge([part(box(0.16, 2.2, 0.16), '#6a4424', { pos: [0, 1.1, -1.4] }), part(box(0.16, 2.2, 0.16), '#6a4424', { pos: [0, 1.1, 1.4] }), part(box(0.2, 0.7, 3.2), '#c08a52', { pos: [0, 2.15, 0] })]),
    MAT,
  );
  gate.position.set(FARM.x - FARM.w / 2 - 1.5, walkHeight(FARM.x - FARM.w / 2 - 1.5, FARM.z) ?? y, FARM.z);
  gate.castShadow = true;
  const gateTag = nameTag('바람결 텃밭', '#fff4d6');
  gateTag.position.set(gate.position.x - 0.2, gate.position.y + 3.0, gate.position.z);
  // 허수아비
  const crow = new THREE.Mesh(
    merge([
      part(box(0.1, 1.8, 0.1), '#6a4424', { pos: [0, 0.9, 0] }),
      part(box(1.4, 0.1, 0.1), '#6a4424', { pos: [0, 1.35, 0] }),
      part(box(0.55, 0.65, 0.3), '#c8553d', { pos: [0, 1.25, 0] }),
      part(ball(0.22, 1), '#e8d4a8', { pos: [0, 1.8, 0] }),
      part(cone(0.38, 0.32, 8), '#d8b84a', { pos: [0, 2.06, 0] }),
      part(box(0.3, 0.22, 0.08), '#7cbf55', { pos: [-0.55, 1.3, 0] }),
      part(box(0.3, 0.22, 0.08), '#7cbf55', { pos: [0.55, 1.3, 0] }),
    ]),
    MAT,
  );
  crow.position.set(FARM.x, y, FARM.z - FARM.d / 2 + 1.2);
  crow.castShadow = true;
  // 물통
  const barrel = new THREE.Mesh(merge([part(cyl(0.45, 0.4, 0.9, 10), '#8a5a32', { pos: [0, 0.45, 0] }), part(cyl(0.4, 0.4, 0.02, 10), '#4a86c5', { pos: [0, 0.86, 0] }), part(cyl(0.47, 0.47, 0.06, 10), '#5a5a60', { pos: [0, 0.2, 0] }), part(cyl(0.47, 0.47, 0.06, 10), '#5a5a60', { pos: [0, 0.7, 0] })]), MAT);
  barrel.position.set(FARM.x - FARM.w / 2 + 0.2, y, FARM.z + 3.2);
  barrel.castShadow = true;
  root.add(gate, gateTag, crow, barrel);

  const plots = Array.from({ length: PLOT_COUNT }, (_, i) => {
    const p = buildPlot(i);
    root.add(p.group);
    p.set(null, Date.now());
    return p;
  });
  return { plots };
}
