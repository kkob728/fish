// 섬 지형/지역/채집 노드 — 서버와 클라이언트가 똑같이 계산한다.
import { fbm, mulberry32, smoothstep, lerp, clamp } from './rng.ts';

export const WORLD_SIZE = 520; // 지형 메시 한 변 길이
export const WATER_LEVEL = 0;

export const POI = {
  spawn: { x: 15, z: 44 },
  camp: { x: 15, z: 35 },
  shop: { x: 4, z: 28 },
  workbench: { x: 27, z: 29 },
  board: { x: 15, z: 22 },
  lake: { x: 0, z: -95, r: 44 },
  swamp: { x: -112, z: 18, r: 56 },
  hotspring: { x: -98, z: -98, r: 13 },
  mountain: { x: -95, z: -95 },
};

const CANYON_END = { x: -48, z: -52 };
export const PIER = { x: 62, z0: 128, z1: 228, half: 2.4, deck: 1.4 };
export const DEEP_RADIUS = 208;

export const RIVER = [
  [36, -86],
  [66, -72],
  [92, -40],
  [118, -8],
  [150, 14],
  [200, 26],
];
const RIVER_HALF = 6.5;

function distToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export function riverDist(x, z) {
  let d = Infinity;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i];
    const [bx, bz] = RIVER[i + 1];
    d = Math.min(d, distToSegment(x, z, ax, az, bx, bz));
  }
  return d;
}

export function shoreRadius(x, z) {
  const n = fbm(x * 0.008 + 3.1, z * 0.008 - 1.7, 3, 11);
  return 166 + (n - 0.5) * 44;
}

// 지형 높이 (물 위/아래 포함)
export function terrainHeight(x, z) {
  const d = Math.hypot(x, z);
  const s = shoreRadius(x, z) - d; // 해안선으로부터 내륙 쪽 거리

  const hills = 2.4 + fbm(x * 0.018, z * 0.018, 4, 3) * 6.5;
  let h;
  if (s < 0) {
    h = 0.6 + s * 0.2 - Math.max(0, -s - 25) * 0.18;
    h = Math.max(h, -26);
  } else {
    h = 0.6 + (hills - 0.6) * smoothstep(0, 34, s);
  }

  // 북서쪽 산
  const mdx = x - POI.mountain.x;
  const mdz = z - POI.mountain.z;
  const md2 = mdx * mdx + mdz * mdz;
  const ridge = fbm(x * 0.05, z * 0.05, 3, 21);
  h += (26 + ridge * 10) * Math.exp(-md2 / (2 * 42 * 42)) * smoothstep(-10, 20, s);

  // 화산 온천 분화구: 웅덩이 + 둘레의 평평한 테라스 + 동남쪽 협곡 입구
  const hs = POI.hotspring;
  const hr = Math.hypot(x - hs.x, z - hs.z);
  const terrace = lerp(-2.6, 1.2, smoothstep(hs.r - 3, hs.r + 2, hr));
  const preCanyon = h;
  h = Math.min(h, lerp(terrace, h, smoothstep(24, 38, hr)));
  const cdx = CANYON_END.x - hs.x, cdz = CANYON_END.z - hs.z;
  const ct = clamp(((x - hs.x) * cdx + (z - hs.z) * cdz) / (cdx * cdx + cdz * cdz), 0, 1);
  const cd = Math.hypot(x - (hs.x + cdx * ct), z - (hs.z + cdz * ct));
  if (cd < 12 && hr > hs.r + 2) {
    const floor = lerp(1.2, preCanyon, Math.pow(ct, 1.6));
    h = Math.min(h, lerp(floor, h, smoothstep(5, 11, cd)));
  }

  // 호수
  const lr = Math.hypot(x - POI.lake.x, z - POI.lake.z);
  const lakeR = POI.lake.r + (fbm(x * 0.04, z * 0.04, 2, 5) - 0.5) * 16;
  h = Math.min(h, lerp(-5.5, h, smoothstep(lakeR * 0.62, lakeR * 1.05, lr)));

  // 늪 — 물웅덩이가 섞인 평지
  const sr = Math.hypot(x - POI.swamp.x, z - POI.swamp.z);
  const swampBlend = smoothstep(POI.swamp.r, POI.swamp.r - 20, sr);
  if (swampBlend > 0) {
    const sh = (fbm(x * 0.06, z * 0.06, 3, 9) - 0.47) * 3.8;
    h = lerp(h, sh, swampBlend);
  }

  // 강
  const rd = riverDist(x, z);
  if (rd < RIVER_HALF * 2.5) {
    h = Math.min(h, lerp(-2.4, h, smoothstep(RIVER_HALF * 0.55, RIVER_HALF * 1.7, rd)));
  }

  // 캠프 평탄화
  const cr = Math.hypot(x - POI.camp.x, z - POI.camp.z);
  h = lerp(h, 3.0, smoothstep(30, 17, cr));

  return h;
}

export function onPier(x, z) {
  return Math.abs(x - PIER.x) <= PIER.half && z >= PIER.z0 && z <= PIER.z1;
}

// 플레이어가 서 있을 높이. 걸을 수 없으면 null
export function walkHeight(x, z) {
  const h = terrainHeight(x, z);
  if (onPier(x, z)) return Math.max(h, PIER.deck);
  if (h < -0.75) return null;
  if (Math.hypot(x, z) > 240) return null;
  return Math.max(h, -0.75);
}

export const ZONES = {
  lake: { id: 'lake', name: '잔잔한 호수', minRod: 1, color: '#6fc3ff' },
  river: { id: 'river', name: '굽이치는 강', minRod: 1, color: '#7fe0d0' },
  coast: { id: 'coast', name: '모래 해안', minRod: 1, color: '#ffd88a' },
  swamp: { id: 'swamp', name: '안개 늪', minRod: 2, color: '#9fbf6a' },
  deep: { id: 'deep', name: '심해', minRod: 3, color: '#5a78ff' },
  hotspring: { id: 'hotspring', name: '화산 온천', minRod: 4, color: '#ff8a5a' },
};
export const ZONE_ORDER = ['lake', 'river', 'coast', 'swamp', 'deep', 'hotspring'];

export function isWater(x, z) {
  return terrainHeight(x, z) < WATER_LEVEL - 0.15;
}

// 물 위 한 지점이 어느 낚시 지역인가. 물이 아니면 null
export function zoneAt(x, z) {
  if (!isWater(x, z)) return null;
  if (Math.hypot(x - POI.hotspring.x, z - POI.hotspring.z) < 26) return 'hotspring';
  if (Math.hypot(x - POI.lake.x, z - POI.lake.z) < 62) return 'lake';
  const d = Math.hypot(x, z);
  if (riverDist(x, z) < RIVER_HALF * 2.2 && d < shoreRadius(x, z) + 4) return 'river';
  if (Math.hypot(x - POI.swamp.x, z - POI.swamp.z) < POI.swamp.r + 6) return 'swamp';
  if (d > DEEP_RADIUS) return 'deep';
  return 'coast';
}

// 플레이어 위치 기준 지역 이름(HUD 표시용) — 땅 위면 가장 가까운 지역 느낌으로
export function regionNameAt(x, z) {
  if (onPier(x, z)) return '긴 부두';
  if (Math.hypot(x - POI.camp.x, z - POI.camp.z) < 30) return '물비늘 캠프';
  if (Math.hypot(x - POI.hotspring.x, z - POI.hotspring.z) < 34) return ZONES.hotspring.name;
  if (Math.hypot(x - POI.lake.x, z - POI.lake.z) < 64) return ZONES.lake.name;
  if (Math.hypot(x - POI.swamp.x, z - POI.swamp.z) < POI.swamp.r + 8) return ZONES.swamp.name;
  if (riverDist(x, z) < 20) return ZONES.river.name;
  if (Math.hypot(x - POI.mountain.x, z - POI.mountain.z) < 60) return '불씨 산';
  const s = shoreRadius(x, z) - Math.hypot(x, z);
  if (s < 22) return ZONES.coast.name;
  return '초원';
}

// ---------- 채집 노드 ----------
export const NODE_TYPES = {
  dirt: { name: '흙더미', verb: '파기', respawn: [60, 100], drops: [['worm', 1, 3, 1], ['grub', 1, 1, 0.25]] },
  log: { name: '썩은 통나무', verb: '뒤지기', respawn: [80, 130], drops: [['grub', 1, 2, 1], ['mushroom', 1, 1, 0.3]] },
  grass: { name: '풀숲', verb: '헤치기', respawn: [60, 100], drops: [['cricket', 1, 2, 1], ['worm', 1, 1, 0.2]] },
  berry: { name: '산딸기 덤불', verb: '따기', respawn: [90, 140], drops: [['berry', 2, 3, 1]] },
  tiderock: { name: '갯바위', verb: '줍기', respawn: [80, 130], drops: [['clam', 1, 2, 1], ['shrimp', 1, 1, 0.35]] },
  seaweed: { name: '해초 더미', verb: '걷기', respawn: [70, 110], drops: [['seaweed', 1, 2, 1], ['shrimp', 1, 1, 0.5]] },
  mushroom: { name: '늪 버섯', verb: '따기', respawn: [80, 130], drops: [['mushroom', 1, 2, 1]] },
  firefly: { name: '반딧불이 떼', verb: '잡기', respawn: [90, 150], drops: [['firefly', 1, 2, 1]], nightOnly: true },
  moss: { name: '이끼 바위', verb: '긁기', respawn: [80, 130], drops: [['moss', 1, 2, 1]] },
  sulfur: { name: '유황 분출구', verb: '캐기', respawn: [100, 150], drops: [['sulfur', 1, 2, 1]] },
};

function sampleNodes(type, count, seed, predicate) {
  const rnd = mulberry32(seed);
  const out = [];
  let tries = 0;
  while (out.length < count && tries < 20000) {
    tries++;
    const x = (rnd() - 0.5) * 440;
    const z = (rnd() - 0.5) * 440;
    const h = terrainHeight(x, z);
    if (!predicate(x, z, h)) continue;
    if (out.some((n) => Math.hypot(n.x - x, n.z - z) < 9)) continue;
    out.push({ x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, y: Math.max(h, 0) });
  }
  return out.map((p, i) => ({ id: `${type}_${i}`, type, ...p }));
}

const inland = (x, z) => shoreRadius(x, z) - Math.hypot(x, z);
const distTo = (p, x, z) => Math.hypot(x - p.x, z - p.z);
const notCamp = (x, z) => distTo(POI.camp, x, z) > 20;
const notSwamp = (x, z) => distTo(POI.swamp, x, z) > POI.swamp.r + 4;
const notMountain = (x, z) => distTo(POI.mountain, x, z) > 50;

let _nodes = null;
export function gatherNodes() {
  if (_nodes) return _nodes;
  const meadow = (x, z, h) => h > 1.4 && h < 9 && notCamp(x, z) && notSwamp(x, z) && notMountain(x, z) && inland(x, z) > 18;
  _nodes = [
    ...sampleNodes('dirt', 16, 101, (x, z, h) => meadow(x, z, h) && Math.hypot(x, z) < 140),
    ...sampleNodes('log', 9, 102, (x, z, h) => meadow(x, z, h) && riverDist(x, z) > 12),
    ...sampleNodes('grass', 13, 103, meadow),
    ...sampleNodes('berry', 9, 104, (x, z, h) => meadow(x, z, h) && distTo(POI.lake, x, z) < 110),
    ...sampleNodes('tiderock', 9, 105, (x, z, h) => h > -0.3 && h < 1.2 && inland(x, z) < 8 && z > 40),
    ...sampleNodes('seaweed', 7, 106, (x, z, h) => h > 0.05 && h < 0.9 && inland(x, z) < 10 && z > 20 && notSwamp(x, z)),
    ...sampleNodes('mushroom', 9, 107, (x, z, h) => h > 0.1 && distTo(POI.swamp, x, z) < POI.swamp.r - 2),
    ...sampleNodes('firefly', 7, 108, (x, z, h) => h > 0.1 && h < 3 && (distTo(POI.swamp, x, z) < POI.swamp.r || (riverDist(x, z) < 14 && riverDist(x, z) > 7))),
    ...sampleNodes('moss', 7, 109, (x, z, h) => h > 0.5 && ((riverDist(x, z) < 15 && riverDist(x, z) > 7) || (distTo(POI.mountain, x, z) < 55 && distTo(POI.hotspring, x, z) > 26))),
    ...sampleNodes('sulfur', 6, 110, (x, z, h) => h > 0.3 && distTo(POI.hotspring, x, z) > 14 && distTo(POI.hotspring, x, z) < 30),
  ];
  return _nodes;
}

// ---------- 장식 배치 (클라이언트 전용이지만 결정적) ----------
export function propPlacements() {
  const rnd = mulberry32(777);
  const props = [];
  for (let gx = -230; gx < 230; gx += 7) {
    for (let gz = -230; gz < 230; gz += 7) {
      const x = gx + (rnd() - 0.5) * 6;
      const z = gz + (rnd() - 0.5) * 6;
      const h = terrainHeight(x, z);
      const r = rnd();
      const dens = fbm(x * 0.03, z * 0.03, 2, 55);
      if (onPier(x, z) || Math.abs(x - PIER.x) < 6 && z > 110) continue;
      if (distTo(POI.camp, x, z) < 28) continue;
      if (distTo(POI.hotspring, x, z) < 20) continue;
      const ins = inland(x, z);
      if (h < -0.2) {
        if (h > -4 && r < 0.03) props.push({ kind: 'rock', x, z, y: h, s: 0.8 + rnd() * 1.6, r: rnd() * 6.28 });
        if (distTo(POI.swamp, x, z) < POI.swamp.r && r > 0.9) props.push({ kind: 'lily', x, z, y: 0.02, s: 0.6 + rnd() * 0.8, r: rnd() * 6.28 });
        continue;
      }
      const inSwamp = distTo(POI.swamp, x, z) < POI.swamp.r;
      const onMountain = distTo(POI.mountain, x, z) < 55;
      if (inSwamp) {
        if (r < 0.16) props.push({ kind: 'deadtree', x, z, y: h, s: 0.8 + rnd() * 0.7, r: rnd() * 6.28 });
        else if (r < 0.3) props.push({ kind: 'reed', x, z, y: h, s: 0.8 + rnd() * 0.6, r: rnd() * 6.28 });
        else if (r < 0.36) props.push({ kind: 'mushroomProp', x, z, y: h, s: 0.7 + rnd() * 0.8, r: rnd() * 6.28 });
        continue;
      }
      if (ins < 12 && h < 2.2 && z > -20) {
        if (r < 0.05) props.push({ kind: 'palm', x, z, y: h, s: 0.8 + rnd() * 0.5, r: rnd() * 6.28 });
        else if (r < 0.09) props.push({ kind: 'rock', x, z, y: h, s: 0.5 + rnd(), r: rnd() * 6.28 });
        continue;
      }
      if (riverDist(x, z) < 9) {
        if (r < 0.12) props.push({ kind: 'reed', x, z, y: h, s: 0.7 + rnd() * 0.5, r: rnd() * 6.28 });
        continue;
      }
      if (onMountain && h > 9) {
        if (r < 0.22 * dens * 2) props.push({ kind: 'pine', x, z, y: h, s: 0.8 + rnd() * 0.7, r: rnd() * 6.28 });
        else if (r < 0.32) props.push({ kind: 'rock', x, z, y: h, s: 0.8 + rnd() * 1.8, r: rnd() * 6.28 });
        continue;
      }
      if (dens > 0.52 && r < (dens - 0.4) * 1.1) {
        props.push({ kind: rnd() < 0.35 ? 'pine' : 'tree', x, z, y: h, s: 0.75 + rnd() * 0.65, r: rnd() * 6.28 });
      } else if (r < 0.07) {
        props.push({ kind: 'bush', x, z, y: h, s: 0.6 + rnd() * 0.6, r: rnd() * 6.28 });
      } else if (r < 0.1) {
        props.push({ kind: 'rock', x, z, y: h, s: 0.4 + rnd() * 0.8, r: rnd() * 6.28 });
      } else if (r < 0.22) {
        props.push({ kind: 'flower', x, z, y: h, s: 0.6 + rnd() * 0.6, r: rnd() * 6.28, c: Math.floor(rnd() * 4) });
      }
    }
  }
  return props;
}
