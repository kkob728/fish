import * as THREE from 'three';
import { terrainHeight, WORLD_SIZE, POI, riverDist, shoreRadius, PIER } from '../../../shared/world.ts';
import { fbm, hash2, clamp } from '../../../shared/rng.ts';
import { FARM, PLOT_PITCH, inFarm } from '../../../shared/data/crops.ts';

const C = (hex) => new THREE.Color(hex);
const PAL = {
  grassA: C('#86c65a'),
  grassB: C('#5fae4c'),
  grassC: C('#9fd06a'),
  dirt: C('#c9a878'),
  sand: C('#eedba2'),
  sandWet: C('#cdbb88'),
  seabed: C('#3d6470'),
  rock: C('#8c867c'),
  rockDark: C('#5e5650'),
  swamp: C('#6c7a3c'),
  mud: C('#5a4e32'),
  ochre: C('#a8744a'),
  sulfur: C('#d8c25a'),
  snowish: C('#c9c2b6'),
};

const tmp = new THREE.Color();
function terrainColor(x, h, z, ny) {
  const n = fbm(x * 0.05, z * 0.05, 2, 77);
  const j = hash2(Math.floor(x * 3), Math.floor(z * 3), 5) * 0.08 - 0.04;
  const dSwamp = Math.hypot(x - POI.swamp.x, z - POI.swamp.z);
  const dHot = Math.hypot(x - POI.hotspring.x, z - POI.hotspring.z);
  const dMount = Math.hypot(x - POI.mountain.x, z - POI.mountain.z);
  const dCamp = Math.hypot(x - POI.camp.x, z - POI.camp.z);
  const inland = shoreRadius(x, z) - Math.hypot(x, z);

  if (h < -0.15) {
    tmp.copy(PAL.sandWet).lerp(PAL.seabed, clamp(-h / 9, 0, 1));
    if (dSwamp < POI.swamp.r) tmp.lerp(PAL.mud, 0.6);
    if (dHot < 24) tmp.lerp(PAL.ochre, 0.6);
  } else if (dHot < 22) {
    tmp.copy(PAL.ochre).lerp(PAL.sulfur, n > 0.58 ? 0.6 : 0.1);
  } else if (dSwamp < POI.swamp.r + 2) {
    tmp.copy(PAL.swamp).lerp(PAL.mud, clamp((0.6 - h) * 0.8 + (n - 0.5), 0, 1));
  } else if (ny < 0.72) {
    tmp.copy(PAL.rock).lerp(PAL.rockDark, n);
  } else if (inland < 14 && h < 1.6 && !(Math.abs(x - PIER.x) < 3 && z < PIER.z0 + 30)) {
    tmp.copy(PAL.sand);
  } else if (riverDist(x, z) < 8.5 && h < 1.2) {
    tmp.copy(PAL.sandWet).lerp(PAL.rock, 0.3);
  } else if (dMount < 60 && h > 13) {
    tmp.copy(PAL.rock).lerp(PAL.snowish, clamp((h - 22) / 10, 0, 1));
    if (h < 18) tmp.lerp(PAL.grassB, 0.35);
  } else {
    tmp.copy(PAL.grassA).lerp(PAL.grassB, n).lerp(PAL.grassC, clamp((h - 5) / 6, 0, 0.5));
    if (dCamp < 24) tmp.lerp(PAL.dirt, clamp((24 - dCamp) / 8, 0, 1) * (n > 0.45 ? 0.95 : 0.6));
    // 텃밭: 짧게 깎은 풀 + 캠프에서 이어지는 흙길과 밭 사이 고랑길
    if (inFarm(x, z, 1)) tmp.lerp(PAL.grassC, 0.35);
    const westLane = FARM.x - FARM.w / 2 + 1.6;
    const onPath =
      (Math.abs(z - FARM.z) < 1.6 && x > POI.camp.x + 12 && x < westLane + 1) ||
      (inFarm(x, z, 0) && Math.abs(x - westLane) < 1.3) ||
      (inFarm(x, z, 0) && x > westLane && (Math.abs(z - (FARM.z - PLOT_PITCH / 2)) < 1.1 || Math.abs(z - (FARM.z + PLOT_PITCH / 2)) < 1.1));
    if (onPath) tmp.lerp(PAL.dirt, 0.75);
  }
  tmp.offsetHSL(0, 0, j);
  return tmp;
}

export function buildTerrain() {
  const SEG = 210;
  const plane = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEG, SEG);
  plane.rotateX(-Math.PI / 2);
  const p = plane.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, terrainHeight(p.getX(i), p.getZ(i)));
  const geo = plane.toNonIndexed();
  plane.dispose();
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) {
    const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
    const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
    const c = terrainColor(cx, cy, cz, nor.getY(i));
    for (let k = 0; k < 3; k++) c.toArray(colors, (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';

  // 지형 바깥 바다 바닥
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ color: '#1d3a52' }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -27;
  const group = new THREE.Group();
  group.add(mesh, floor);
  return group;
}

// 물 셰이더용 텍스처: RGB = 지역별 물빛, A = 수심(0..10m)
const ZONE_TINT = {
  lake: C('#2c86c0'),
  river: C('#2a9fa6'),
  coast: C('#1a8fc4'),
  swamp: C('#4e5c26'),
  deep: C('#0b2c70'),
  hotspring: C('#d58a4a'),
};
function tintAt(x, z) {
  if (Math.hypot(x - POI.hotspring.x, z - POI.hotspring.z) < 26) return ZONE_TINT.hotspring;
  if (Math.hypot(x - POI.lake.x, z - POI.lake.z) < 62) return ZONE_TINT.lake;
  if (Math.hypot(x - POI.swamp.x, z - POI.swamp.z) < POI.swamp.r + 6) return ZONE_TINT.swamp;
  const d = Math.hypot(x, z);
  if (riverDist(x, z) < 14 && d < shoreRadius(x, z) + 4) return ZONE_TINT.river;
  if (d > 200) return tmp.copy(ZONE_TINT.coast).lerp(ZONE_TINT.deep, clamp((d - 190) / 30, 0, 1));
  return ZONE_TINT.coast;
}

export const WATER_TEX_SIZE = 256;
export function buildWaterData() {
  const N = WATER_TEX_SIZE;
  const data = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1) - 0.5) * WORLD_SIZE;
      const z = (j / (N - 1) - 0.5) * WORLD_SIZE;
      const h = terrainHeight(x, z);
      const c = tintAt(x, z);
      const k = (j * N + i) * 4;
      data[k] = Math.round(c.r * 255);
      data[k + 1] = Math.round(c.g * 255);
      data[k + 2] = Math.round(c.b * 255);
      data[k + 3] = Math.round(clamp(-h / 10, 0, 1) * 255);
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
