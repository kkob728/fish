import * as THREE from 'three';
import { part, merge, flatMat, textTexture, textSprite, addWind } from './util.ts';
import { buildCharacter } from './character.ts';
import { propPlacements, gatherNodes, NODE_TYPES, POI, PIER, terrainHeight, ZONES, walkHeight, shoreRadius, riverDist } from '../../../shared/world.ts';
import { mulberry32, fbm } from '../../../shared/rng.ts';
import { ROD } from '../../../shared/data/core.ts';

const cyl = (rt, rb, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const cone = (r, h, s = 7) => new THREE.ConeGeometry(r, h, s);
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);

const TEMPLATES = {
  tree: () =>
    merge([
      part(cyl(0.16, 0.26, 1.8), '#7a5230', { pos: [0, 0.9, 0] }),
      part(ico(1.15), '#4f9a3a', { pos: [0, 2.3, 0] }),
      part(ico(0.85), '#5fae45', { pos: [0.55, 2.75, 0.2] }),
      part(ico(0.75), '#468a35', { pos: [-0.5, 2.55, -0.35] }),
    ]),
  pine: () =>
    merge([
      part(cyl(0.13, 0.2, 1.2), '#6a4428', { pos: [0, 0.6, 0] }),
      part(cone(1.25, 1.7), '#2f6e3a', { pos: [0, 1.75, 0] }),
      part(cone(0.98, 1.5), '#367a42', { pos: [0, 2.6, 0] }),
      part(cone(0.66, 1.3), '#3e874a', { pos: [0, 3.35, 0] }),
    ]),
  palm: () => {
    const parts = [];
    for (let i = 0; i < 6; i++) parts.push(part(cyl(0.13, 0.16, 0.7), i % 2 ? '#9a7448' : '#8a6438', { pos: [i * i * 0.025, 0.35 + i * 0.66, 0], rot: [0, 0, -i * 0.05] }));
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      parts.push(part(boxG(1.9, 0.05, 0.42), i % 2 ? '#4caf50' : '#3f9a45', { pos: [0.9 + Math.cos(a) * 0.85, 4.05, Math.sin(a) * 0.85], rot: [0, -a, -0.45] }));
    }
    parts.push(part(ico(0.18), '#6a4a28', { pos: [0.95, 3.9, 0.15] }));
    return merge(parts);
  },
  deadtree: () =>
    merge([
      part(cyl(0.12, 0.24, 2.8), '#4a4038', { pos: [0, 1.4, 0] }),
      part(cyl(0.05, 0.09, 1.2), '#4a4038', { pos: [0.4, 2.2, 0], rot: [0, 0, -0.9] }),
      part(cyl(0.04, 0.08, 1), '#4a4038', { pos: [-0.35, 1.8, 0.1], rot: [0.3, 0, 0.9] }),
      part(ico(0.35), '#5a6a3a', { pos: [0.8, 2.6, 0] }),
    ]),
  bush: () =>
    merge([
      part(ico(0.7), '#4e9a40', { pos: [0, 0.4, 0], scale: [1, 0.8, 1] }),
      part(ico(0.5), '#5aac48', { pos: [0.5, 0.35, 0.2] }),
      part(ico(0.45), '#438a38', { pos: [-0.4, 0.3, -0.2] }),
    ]),
  rock: () => merge([part(new THREE.DodecahedronGeometry(0.8, 0), '#8c8a84', { pos: [0, 0.25, 0], scale: [1, 0.7, 0.9] })]),
  reed: () => {
    const parts = [];
    const r = mulberry32(9);
    for (let i = 0; i < 6; i++) {
      const x = (r() - 0.5) * 0.6;
      const z = (r() - 0.5) * 0.6;
      const h = 1 + r() * 0.6;
      parts.push(part(cone(0.03, h, 4), '#8aa050', { pos: [x, h / 2, z] }));
      if (i % 2 === 0) parts.push(part(cyl(0.05, 0.05, 0.26, 5), '#6a4a2a', { pos: [x, h * 0.8, z] }));
    }
    return merge(parts);
  },
  lily: () =>
    merge([
      part(cyl(0.55, 0.55, 0.03, 9), '#4a8a3a', { pos: [0, 0, 0] }),
      part(cone(0.12, 0.18, 5), '#f6a8c8', { pos: [0.15, 0.1, 0.1] }),
    ]),
  mushroomProp: () =>
    merge([
      part(cyl(0.09, 0.12, 0.5), '#efe6d2', { pos: [0, 0.25, 0] }),
      part(new THREE.SphereGeometry(0.35, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#a04a8a', { pos: [0, 0.48, 0] }),
      part(cyl(0.05, 0.07, 0.3), '#efe6d2', { pos: [0.3, 0.15, 0.1] }),
      part(new THREE.SphereGeometry(0.18, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#c05a3a', { pos: [0.3, 0.29, 0.1] }),
    ]),
};
const FLOWER_COLORS = ['#ffe066', '#ff8fb0', '#ffffff', '#a8b8ff'];
const flowerTemplate = (c) =>
  merge([part(cyl(0.015, 0.015, 0.35, 3), '#4a8a3a', { pos: [0, 0.17, 0] }), part(ico(0.09), c, { pos: [0, 0.37, 0] })]);

const SWAY = { tree: 0.03, pine: 0.02, palm: 0.035, bush: 0.05, reed: 0.12, flower: 0.15 };
const SHADOW = new Set(['tree', 'pine', 'palm', 'deadtree', 'rock']);

function buildVegetation(group, tuftCount = 6000) {
  const placements = propPlacements();
  const byKind: Record<string, any[]> = {};
  for (const p of placements) {
    const key = p.kind === 'flower' ? `flower${p.c}` : p.kind;
    (byKind[key] ??= []).push(p);
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  for (const [key, list] of Object.entries(byKind)) {
    const kind = key.startsWith('flower') ? 'flower' : key;
    const geo = kind === 'flower' ? flowerTemplate(FLOWER_COLORS[Number(key.slice(6))]) : TEMPLATES[kind]();
    const mat = flatMat();
    if (SWAY[kind]) addWind(mat, SWAY[kind]);
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach((p, i) => {
      q.setFromAxisAngle(up, p.r);
      m4.compose(new THREE.Vector3(p.x, p.y - 0.05, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
      im.setMatrixAt(i, m4);
    });
    im.castShadow = SHADOW.has(kind);
    im.receiveShadow = kind === 'rock';
    group.add(im);
  }

  // 풀 덤불
  const r = mulberry32(31);
  const tufts = [];
  while (tufts.length < tuftCount) {
    const x = (r() - 0.5) * 380;
    const z = (r() - 0.5) * 380;
    const h = terrainHeight(x, z);
    if (h < 1.3 || h > 12) continue;
    if (Math.hypot(x - POI.swamp.x, z - POI.swamp.z) < POI.swamp.r) continue;
    if (Math.hypot(x - POI.camp.x, z - POI.camp.z) < 16) continue;
    if (Math.hypot(x - POI.hotspring.x, z - POI.hotspring.z) < 24) continue;
    if (shoreRadius(x, z) - Math.hypot(x, z) < 12) continue;
    if (fbm(x * 0.04, z * 0.04, 2, 3) < 0.42) continue;
    tufts.push([x, h, z, r() * 6.28, 0.6 + r() * 0.7]);
  }
  const blade = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    const g = new THREE.BufferGeometry();
    const w = 0.09;
    g.setAttribute('position', new THREE.Float32BufferAttribute([-w, 0, 0, w, 0, 0, 0, 0.55, 0], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute([0.3, 0.55, 0.22, 0.3, 0.55, 0.22, 0.62, 0.85, 0.4], 3));
    g.rotateY(a);
    g.translate(Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08);
    blade.push(g);
  }
  const tuftGeo = merge(blade);
  const tuftMat = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 1 }), 0.25);
  const tim = new THREE.InstancedMesh(tuftGeo, tuftMat, tufts.length);
  tufts.forEach(([x, y, z, rot, s], i) => {
    q.setFromAxisAngle(up, rot);
    m4.compose(new THREE.Vector3(x, y - 0.03, z), q, new THREE.Vector3(s, s, s));
    tim.setMatrixAt(i, m4);
  });
  group.add(tim);
}

function sign(lines, { w = 2.2, h = 1.1, pos, rotY = 0, post = true }) {
  const g = new THREE.Group();
  const tex = textTexture(lines, { w: 512, h: Math.round(512 * (h / w)), size: lines.length > 1 ? 70 : 84 });
  const board = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), [
    ...Array(4).fill(new THREE.MeshStandardMaterial({ color: '#6b4a2a', flatShading: true })),
    new THREE.MeshStandardMaterial({ map: tex }),
    new THREE.MeshStandardMaterial({ map: tex }),
  ]);
  board.position.y = post ? 1.5 : 0;
  board.castShadow = true;
  g.add(board);
  if (post) {
    const p = new THREE.Mesh(cyl(0.07, 0.08, 1.6), new THREE.MeshStandardMaterial({ color: '#5a3c22', flatShading: true }));
    p.position.y = 0.8;
    g.add(p);
  }
  g.position.set(pos[0], pos[1] ?? terrainHeight(pos[0], pos[2]), pos[2]);
  g.rotation.y = rotY;
  return g;
}

function faceTo(fromX, fromZ, toX, toZ) {
  return Math.atan2(toX - fromX, toZ - fromZ);
}

function buildCamp(group, fx, glows) {
  const mat = flatMat();
  const yAt = (x, z) => terrainHeight(x, z);

  // 상점
  const shop = new THREE.Group();
  shop.add(
    new THREE.Mesh(
      merge([
        part(boxG(6.4, 0.3, 5.2), '#8a6a44', { pos: [0, 0.15, 0] }),
        part(boxG(6.4, 2.8, 0.25), '#c49a64', { pos: [0, 1.6, -2.5] }),
        part(boxG(0.25, 2.8, 5.2), '#b88c58', { pos: [-3.1, 1.6, 0] }),
        part(boxG(0.25, 2.8, 5.2), '#b88c58', { pos: [3.1, 1.6, 0] }),
        part(boxG(5.6, 1.0, 0.6), '#9a7044', { pos: [0, 0.8, 1.6] }),
        part(boxG(5.8, 0.1, 0.8), '#6a4a2a', { pos: [0, 1.33, 1.6] }),
        part(cyl(0.12, 0.12, 3, 6), '#7a5232', { pos: [-2.9, 1.6, 2.4] }),
        part(cyl(0.12, 0.12, 3, 6), '#7a5232', { pos: [2.9, 1.6, 2.4] }),
        part(cone(5.2, 1.9, 4), '#d0584a', { pos: [0, 3.95, 0], rot: [0, Math.PI / 4, 0], scale: [1, 1, 0.82] }),
        // 진열 물고기 상자
        part(boxG(0.8, 0.3, 0.5), '#3a7ab8', { pos: [-1.6, 1.53, 1.6] }),
        part(boxG(0.8, 0.3, 0.5), '#e8a83a', { pos: [1.5, 1.53, 1.6] }),
        part(cyl(0.25, 0.25, 0.6, 8), '#7aa8c0', { pos: [2.4, 0.6, -1.8] }),
      ]),
      mat,
    ),
  );
  shop.children[0].castShadow = true;
  shop.children[0].receiveShadow = true;
  const shopSign = sign(['낚시 상점'], { w: 3.2, h: 0.9, pos: [0, 3.25, 2.62], post: false });
  shop.add(shopSign);
  const keeper = buildCharacter('#3a8a5a', { npc: true, name: '상점 주인 바다', nameColor: '#ffe08a' });
  keeper.root.position.set(0, 0.3, 0.5);
  shop.add(keeper.root);
  shop.position.set(POI.shop.x, yAt(POI.shop.x, POI.shop.z), POI.shop.z);
  shop.rotation.y = faceTo(POI.shop.x, POI.shop.z, POI.camp.x, POI.camp.z + 6);
  group.add(shop);

  // 제작대
  const wb = new THREE.Group();
  wb.add(
    new THREE.Mesh(
      merge([
        part(boxG(2.6, 0.16, 1.3), '#a0784a', { pos: [0, 0.95, 0] }),
        ...[[-1.15, -0.5], [1.15, -0.5], [-1.15, 0.5], [1.15, 0.5]].map(([x, z]) => part(boxG(0.14, 0.95, 0.14), '#6a4a2a', { pos: [x, 0.47, z] })),
        part(cyl(0.18, 0.18, 0.36, 8), '#9ad0e0', { pos: [-0.8, 1.21, -0.2] }),
        part(cyl(0.19, 0.19, 0.06, 8), '#c04a3a', { pos: [-0.8, 1.42, -0.2] }),
        part(boxG(0.5, 0.06, 0.12), '#c0c0c8', { pos: [0.3, 1.07, 0.25], rot: [0, 0.4, 0] }),
        part(boxG(0.14, 0.06, 0.4), '#7a5232', { pos: [0.6, 1.07, 0.1], rot: [0, 0.4, 0] }),
        part(ico(0.15), '#e05a7a', { pos: [0.75, 1.12, -0.35] }),
        part(ico(0.12), '#7ac05a', { pos: [0.5, 1.1, -0.4] }),
        part(boxG(2.6, 1.2, 0.1), '#8a6a44', { pos: [0, 1.6, -0.65] }),
      ]),
      mat,
    ),
  );
  wb.children[0].castShadow = true;
  const wbSign = sign(['제작대'], { w: 1.6, h: 0.5, pos: [0, 2.35, -0.6], post: false });
  wb.add(wbSign);
  wb.position.set(POI.workbench.x, yAt(POI.workbench.x, POI.workbench.z), POI.workbench.z);
  wb.rotation.y = faceTo(POI.workbench.x, POI.workbench.z, POI.camp.x, POI.camp.z + 4);
  group.add(wb);

  // 게시판
  const board = new THREE.Group();
  board.add(
    new THREE.Mesh(
      merge([
        part(cyl(0.1, 0.12, 2.6), '#5a3c22', { pos: [-1.3, 1.3, 0] }),
        part(cyl(0.1, 0.12, 2.6), '#5a3c22', { pos: [1.3, 1.3, 0] }),
        part(boxG(3.2, 0.12, 0.6), '#a0503a', { pos: [0, 2.7, 0], rot: [0.2, 0, 0] }),
      ]),
      mat,
    ),
  );
  const bTex = textTexture([{ text: '물비늘 게시판', size: 64 }, { text: '랭킹 · 기록', size: 44 }], { w: 512, h: 300, bg: '#3e5a3a', border: '#5a3c22' });
  const bMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.4), new THREE.MeshStandardMaterial({ map: bTex }));
  bMesh.position.set(0, 1.7, 0.08);
  board.add(bMesh);
  board.position.set(POI.board.x, yAt(POI.board.x, POI.board.z), POI.board.z);
  board.rotation.y = faceTo(POI.board.x, POI.board.z, POI.camp.x, POI.camp.z);
  group.add(board);

  // 모닥불
  const fire = new THREE.Group();
  const stones = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    stones.push(part(new THREE.DodecahedronGeometry(0.22, 0), '#7a7670', { pos: [Math.cos(a) * 0.8, 0.12, Math.sin(a) * 0.8] }));
  }
  stones.push(part(cyl(0.1, 0.1, 1.3, 5), '#5a3a20', { pos: [0, 0.18, 0], rot: [0, 0.5, Math.PI / 2] }));
  stones.push(part(cyl(0.1, 0.1, 1.3, 5), '#5a3a20', { pos: [0, 0.22, 0], rot: [0, -0.7, Math.PI / 2] }));
  fire.add(new THREE.Mesh(merge(stones), mat));
  const flame = new THREE.Mesh(cone(0.45, 1.1, 6), new THREE.MeshBasicMaterial({ color: '#ffb040', transparent: true, opacity: 0.9 }));
  flame.position.y = 0.7;
  const flame2 = new THREE.Mesh(cone(0.28, 0.8, 6), new THREE.MeshBasicMaterial({ color: '#fff0a0' }));
  flame2.position.y = 0.6;
  fire.add(flame, flame2);
  const fireLight = new THREE.PointLight('#ff9a40', 6, 18, 1.6);
  fireLight.position.y = 1.4;
  fire.add(fireLight);
  const fx0 = POI.camp.x, fz0 = POI.camp.z;
  fire.position.set(fx0, yAt(fx0, fz0), fz0);
  group.add(fire);
  // 통나무 벤치
  for (const a of [0.4, 2.2, 4.1]) {
    const b = new THREE.Mesh(part(cyl(0.28, 0.28, 2.2, 7), '#7a5232', { rot: [0, 0, Math.PI / 2] }), mat);
    const bx = fx0 + Math.cos(a) * 3, bz = fz0 + Math.sin(a) * 3;
    b.position.set(bx, yAt(bx, bz) + 0.25, bz);
    b.rotation.y = -a + Math.PI / 2;
    b.castShadow = true;
    group.add(b);
  }

  // 이정표
  const post = new THREE.Group();
  const postX = POI.camp.x + 7, postZ = POI.camp.z + 9;
  post.position.set(postX, yAt(postX, postZ), postZ);
  const pole = new THREE.Mesh(part(cyl(0.09, 0.1, 3.4), '#5a3c22', { pos: [0, 1.7, 0] }), mat);
  post.add(pole);
  const dests = [
    ['잔잔한 호수', POI.lake, 1],
    ['굽이치는 강', { x: 92, z: -40 }, 1],
    ['안개 늪', POI.swamp, 2],
    ['긴 부두 · 심해', { x: PIER.x, z: PIER.z0 }, 3],
    ['화산 온천', POI.hotspring, 4],
    ['모래 해안', { x: 20, z: 160 }, 1],
  ];
  (dests as [string, { x: number; z: number }, number][]).forEach(([name, p, tier], i) => {
    const ang = Math.atan2(p.x - postX, p.z - postZ);
    const rodName = Object.values(ROD).find((r) => r.tier === tier && !r.crafted).name.replace(' 낚싯대', '');
    const tex = textTexture([{ text: name, size: 56 }, { text: tier > 1 ? `${rodName} 낚싯대 이상` : '누구나', size: 34, color: tier > 1 ? '#ffd0a0' : '#c8f0c0' }], { w: 512, h: 150 });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 0.06), [
      ...Array(4).fill(new THREE.MeshStandardMaterial({ color: '#6b4a2a' })),
      new THREE.MeshStandardMaterial({ map: tex }),
      new THREE.MeshStandardMaterial({ map: tex, side: THREE.FrontSide }),
    ]);
    const holder = new THREE.Group();
    holder.position.y = 3.1 - i * 0.48;
    holder.rotation.y = ang - Math.PI / 2;
    arm.position.x = 0.95;
    arm.castShadow = true;
    holder.add(arm);
    post.add(holder);
  });
  group.add(post);

  // 랜턴 (밤에 빛남)
  const lanternSpots = [
    [POI.camp.x - 12, POI.camp.z - 8], [POI.camp.x + 13, POI.camp.z - 9], [POI.camp.x - 10, POI.camp.z + 12],
    [POI.camp.x + 14, POI.camp.z + 12], [PIER.x - 2.6, PIER.z0 + 18], [PIER.x + 2.6, PIER.z0 + 50],
    [PIER.x - 2.6, PIER.z0 + 80], [PIER.x + 2.6, PIER.z1 - 1], [PIER.x - 2.6, PIER.z1 - 1],
  ];
  const lampMat = new THREE.MeshStandardMaterial({ color: '#ffe6a0', emissive: '#ffb84a', emissiveIntensity: 0.3 });
  for (const [x, z] of lanternSpots) {
    const l = new THREE.Group();
    l.add(new THREE.Mesh(merge([part(cyl(0.06, 0.08, 2.4, 5), '#3a3030', { pos: [0, 1.2, 0] }), part(boxG(0.5, 0.06, 0.06), '#3a3030', { pos: [0.2, 2.35, 0] })]), mat));
    const lamp = new THREE.Mesh(boxG(0.26, 0.34, 0.26), lampMat);
    lamp.position.set(0.4, 2.1, 0);
    l.add(lamp);
    const wh = walkHeight(x, z) ?? terrainHeight(x, z);
    l.position.set(x, wh, z);
    group.add(l);
    glows.push({ x: x + 0.4, y: wh + 2.1, z });
  }

  return {
    shopKeeper: keeper,
    update(dt, t, night) {
      const f = 0.85 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07;
      flame.scale.set(f, f * (1 + Math.sin(t * 9) * 0.1), f);
      flame2.scale.setScalar(f);
      fireLight.intensity = (3 + night * 9) * f;
      lampMat.emissiveIntensity = 0.3 + night * 2.2;
      if (Math.random() < dt * 14) {
        fx.glow.spawn({ x: fx0 + (Math.random() - 0.5) * 0.6, y: fire.position.y + 0.8, z: fz0 + (Math.random() - 0.5) * 0.6, vx: (Math.random() - 0.5) * 0.6, vy: 1.6 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 0.6, color: '#ffa040', size: 0.12 + Math.random() * 0.12, life: 1.2 + Math.random(), drag: 0.5 });
      }
      keeper.animate('idle', dt);
    },
  };
}

function buildPier(group) {
  const len = PIER.z1 - PIER.z0;
  const n = Math.floor(len / 0.55);
  const plank = new THREE.BoxGeometry(PIER.half * 2 + 0.2, 0.12, 0.5);
  const mat = new THREE.MeshStandardMaterial({ color: '#a8804e', flatShading: true, roughness: 0.9 });
  const im = new THREE.InstancedMesh(plank, mat, n);
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  for (let i = 0; i < n; i++) {
    m4.makeTranslation(PIER.x + Math.sin(i * 7.1) * 0.04, PIER.deck - 0.06, PIER.z0 + i * 0.55 + 0.25);
    im.setMatrixAt(i, m4);
    im.setColorAt(i, col.set('#a8804e').offsetHSL(0, 0, Math.sin(i * 3.7) * 0.05));
  }
  im.receiveShadow = true;
  im.castShadow = true;
  group.add(im);
  const posts = [];
  for (let z = PIER.z0 + 2; z < PIER.z1; z += 4.5) {
    for (const s of [-1, 1]) {
      const bottom = Math.min(terrainHeight(PIER.x + s * PIER.half, z), PIER.deck - 0.5);
      const h = PIER.deck + 0.6 - bottom;
      posts.push(part(cyl(0.16, 0.18, h, 6), '#6a4a2a', { pos: [PIER.x + s * PIER.half, bottom + h / 2, z] }));
    }
  }
  // 난간 로프
  for (const s of [-1, 1]) posts.push(part(boxG(0.05, 0.05, len), '#d8c8a0', { pos: [PIER.x + s * PIER.half, PIER.deck + 0.5, PIER.z0 + len / 2] }));
  const pm = new THREE.Mesh(merge(posts), flatMat());
  pm.castShadow = true;
  group.add(pm);
  // 끝에 작은 보트
  const boat = new THREE.Mesh(
    merge([
      part(boxG(1.4, 0.5, 3.6), '#c0503a', { pos: [0, 0.1, 0] }),
      part(boxG(1.2, 0.1, 3.4), '#8a6a44', { pos: [0, 0.32, 0] }),
      part(boxG(1.3, 0.12, 0.3), '#8a6a44', { pos: [0, 0.4, 0.4] }),
    ]),
    flatMat(),
  );
  boat.position.set(PIER.x + 4.5, 0.05, PIER.z1 - 12);
  boat.rotation.y = 0.15;
  boat.castShadow = true;
  group.add(boat);
  group.add(sign(['긴 부두', '끝까지 가면 심해 (카본 이상)'], { w: 2.6, h: 1.2, pos: [PIER.x + 3.4, undefined, PIER.z0 + 14], rotY: -Math.PI / 2 }));
  return boat;
}

function zoneSigns(group) {
  const lakeR = POI.lake.r + 14;
  group.add(sign([ZONES.lake.name], { pos: [POI.lake.x + 18, undefined, POI.lake.z + lakeR], rotY: Math.PI }));
  group.add(sign([ZONES.swamp.name, '유리섬유 이상'], { pos: [POI.swamp.x + POI.swamp.r - 2, undefined, POI.swamp.z + 6], rotY: Math.PI / 2 }));
  group.add(sign([ZONES.hotspring.name, '티타늄 이상'], { pos: [POI.hotspring.x + 20, undefined, POI.hotspring.z + 20], rotY: Math.PI / 4 }));
  group.add(sign([ZONES.river.name], { pos: [74, undefined, -52], rotY: -2.3 }));
}

// ---------- 채집 노드 ----------
const NODE_MESH = {
  dirt: () => merge([part(new THREE.SphereGeometry(0.6, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#7a5a3a', { scale: [1, 0.55, 1] }), part(ico(0.1), '#d88a8a', { pos: [0.2, 0.3, 0.1] }), part(ico(0.08), '#d88a8a', { pos: [-0.2, 0.28, -0.1] })]),
  log: () => merge([part(cyl(0.32, 0.36, 2.2, 7), '#6a4a30', { pos: [0, 0.3, 0], rot: [0, 0, Math.PI / 2] }), part(cyl(0.3, 0.3, 0.02, 7), '#a8885a', { pos: [1.11, 0.3, 0], rot: [0, 0, Math.PI / 2] }), part(ico(0.18), '#5a8a3a', { pos: [-0.3, 0.6, 0.1] })]),
  grass: () => {
    const ps = [];
    for (let i = 0; i < 9; i++) ps.push(part(cone(0.06, 1 + (i % 3) * 0.3, 4), i % 2 ? '#7ab84a' : '#9ad060', { pos: [Math.cos(i * 2.3) * 0.35, 0.5, Math.sin(i * 2.3) * 0.35] }));
    return merge(ps);
  },
  berry: () => merge([part(ico(0.65), '#3f8a3a', { pos: [0, 0.5, 0], scale: [1, 0.8, 1] }), ...[0, 1, 2, 3, 4].map((i) => part(ico(0.08), '#e0304a', { pos: [Math.cos(i * 1.3) * 0.55, 0.5 + (i % 2) * 0.2, Math.sin(i * 1.3) * 0.5] }))]),
  tiderock: () => merge([part(new THREE.DodecahedronGeometry(0.7, 0), '#7a7a80', { pos: [0, 0.3, 0], scale: [1.3, 0.6, 1] }), part(cone(0.12, 0.12, 6), '#f0e0d0', { pos: [0.3, 0.7, 0.2], rot: [1.2, 0, 0] }), part(cone(0.1, 0.1, 6), '#e8c0a0', { pos: [-0.3, 0.68, -0.1], rot: [1.4, 0.5, 0] })]),
  seaweed: () => {
    const ps = [];
    for (let i = 0; i < 6; i++) ps.push(part(boxG(0.12, 0.05, 1.2), i % 2 ? '#2a7a4a' : '#3a8a3a', { pos: [Math.cos(i) * 0.3, 0.05 + i * 0.02, Math.sin(i) * 0.3], rot: [0, i * 1.1, 0] }));
    return merge(ps);
  },
  mushroom: () => TEMPLATES.mushroomProp(),
  moss: () => merge([part(new THREE.DodecahedronGeometry(0.75, 0), '#7a7a74', { pos: [0, 0.35, 0], scale: [1, 0.8, 1] }), part(new THREE.DodecahedronGeometry(0.62, 0), '#5aa04a', { pos: [0, 0.62, 0], scale: [1.1, 0.35, 1.1] })]),
  sulfur: () => merge([part(new THREE.DodecahedronGeometry(0.6, 0), '#6a5a50', { pos: [0, 0.2, 0], scale: [1, 0.5, 1] }), ...[0, 1, 2, 3].map((i) => part(new THREE.OctahedronGeometry(0.18, 0), '#f0d84a', { pos: [Math.cos(i * 1.6) * 0.3, 0.55, Math.sin(i * 1.6) * 0.3], scale: [0.7, 1.4, 0.7] }))]),
};

function buildNodes(group) {
  const nodes = new Map();
  const mats = {};
  const geos = {};
  const sparkTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,230,1)');
    g.addColorStop(0.25, 'rgba(255,240,160,0.8)');
    g.addColorStop(1, 'rgba(255,220,120,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(cv);
    return t;
  })();
  const sparkMat = new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const n of gatherNodes()) {
    const g = new THREE.Group();
    g.position.set(n.x, n.type === 'seaweed' || n.type === 'tiderock' ? Math.max(terrainHeight(n.x, n.z), -0.2) : terrainHeight(n.x, n.z), n.z);
    let mesh = null;
    if (n.type === 'firefly') {
      const pts = new THREE.Group();
      for (let i = 0; i < 8; i++) {
        const s = new THREE.Sprite(sparkMat.clone());
        s.material.color.set('#c8ff80');
        s.scale.setScalar(0.35);
        s.userData.ph = i * 0.9;
        pts.add(s);
      }
      g.add(pts);
      g.userData.flies = pts;
    } else {
      geos[n.type] ??= NODE_MESH[n.type]();
      mats[n.type] ??= flatMat();
      mesh = new THREE.Mesh(geos[n.type], mats[n.type]);
      mesh.castShadow = true;
      mesh.rotation.y = (n.x * 13.7) % 6.28;
      g.add(mesh);
    }
    const sp = new THREE.Sprite(sparkMat);
    sp.scale.setScalar(0.7);
    sp.position.y = 1.6;
    g.add(sp);
    g.userData.spark = sp;
    group.add(g);
    nodes.set(n.id, { def: n, group: g, until: 0 });
  }
  return nodes;
}

export function buildProps(scene, fx, { lite = false } = {}) {
  const group = new THREE.Group();
  scene.add(group);
  buildVegetation(group, lite ? 1800 : 6000);
  const glows = [];
  const camp = buildCamp(group, fx, glows);
  const boat = buildPier(group);
  zoneSigns(group);
  const nodes = buildNodes(group);

  const interactables = [
    { kind: 'shop', x: POI.shop.x, z: POI.shop.z, r: 7.5, label: '상점 이용하기' },
    { kind: 'craft', x: POI.workbench.x, z: POI.workbench.z, r: 3.6, label: '제작대 사용하기' },
    { kind: 'board', x: POI.board.x, z: POI.board.z, r: 3.6, label: '랭킹 게시판 보기' },
  ];

  return {
    nodes,
    interactables,
    update(dt, t, env, nowMs) {
      camp.update(dt, t, env.night);
      boat.position.y = 0.05 + Math.sin(t * 1.3) * 0.06;
      boat.rotation.z = Math.sin(t * 1.1) * 0.03;
      // 랜턴 불빛 입자
      if (env.night > 0.3 && Math.random() < dt * 4) {
        const g = glows[Math.floor(Math.random() * glows.length)];
        fx.glow.spawn({ x: g.x, y: g.y, z: g.z, color: '#ffd080', size: 1.4, life: 0.6, alpha: 0.35 * env.night });
      }
      // 온천 김
      if (Math.random() < dt * 5) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * POI.hotspring.r;
        fx.puff.spawn({ x: POI.hotspring.x + Math.cos(a) * r, y: 0.2, z: POI.hotspring.z + Math.sin(a) * r, vx: 0.3, vy: 1.2 + Math.random(), vz: 0.1, color: '#f4eee8', size: 1.2 + Math.random() * 1.5, grow: 2, life: 3, alpha: 0.11 });
      }
      // 늪 반딧불 장식
      if (env.night > 0.5 && Math.random() < dt * 6) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * POI.swamp.r;
        const x = POI.swamp.x + Math.cos(a) * r, z = POI.swamp.z + Math.sin(a) * r;
        fx.glow.spawn({ x, y: Math.max(0, terrainHeight(x, z)) + 0.5 + Math.random() * 2, z, vx: (Math.random() - 0.5) * 0.5, vy: 0.1, vz: (Math.random() - 0.5) * 0.5, color: '#c8ff70', size: 0.25, life: 3, alpha: 0.9 });
      }
      for (const n of nodes.values()) {
        const avail = n.until <= nowMs && (!NODE_TYPES[n.def.type].nightOnly || env.phase === 'night');
        n.group.visible = avail;
        if (!avail) continue;
        n.group.userData.spark.position.y = 1.5 + Math.sin(t * 2 + n.def.x) * 0.15;
        n.group.userData.spark.material.opacity = 0.6 + Math.sin(t * 3 + n.def.z) * 0.3;
        if (n.group.userData.flies) {
          for (const s of n.group.userData.flies.children) {
            const ph = s.userData.ph + t * 0.8;
            s.position.set(Math.sin(ph * 1.3) * 1.2, 0.8 + Math.sin(ph * 2.1) * 0.5, Math.cos(ph * 0.9) * 1.2);
          }
        }
      }
    },
  };
}
