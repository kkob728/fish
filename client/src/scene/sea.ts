// 섬 밖 바다의 풍경: 작은 섬(지형 조각), 산호, 빙산·유빙, 해구의 바위 기둥, 등대, 부표, 조선소
import * as THREE from 'three';
import { part, merge, flatMat } from './util.ts';
import { terrainColor } from './terrain.ts';
import { sign } from './props.ts';
import { buildCharacter } from './character.ts';
import { buildBoat } from './boat.ts';
import { terrainHeight, PIER } from '../../../shared/world.ts';
import { ISLETS, ROCKS, BUOYS, SHIPYARD, DOCK } from '../../../shared/sea.ts';
import { mulberry32 } from '../../../shared/rng.ts';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);
const cone = (r, h, s = 7) => new THREE.ConeGeometry(r, h, s);
const SNOW = new THREE.Color('#f0f6fa');

// 작은 섬 하나의 지형 조각
function isletMesh(s) {
  const size = s.r * 3.6;
  const seg = Math.ceil(size / 1.6);
  const plane = new THREE.PlaneGeometry(size, size, seg, seg);
  plane.rotateX(-Math.PI / 2);
  plane.translate(s.x, 0, s.z);
  const p = plane.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, Math.max(terrainHeight(p.getX(i), p.getZ(i)), -10));
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
    const c = terrainColor(cx, cy, cz, nor.getY(i)).clone();
    if (s.id === 'frost' && cy > 0.5) c.lerp(SNOW, 0.85);
    if (s.id === 'gull' && cy > 0.4) c.set('#8c867c').offsetHSL(0, 0, ((cx * 7 + cz * 3) % 1) * 0.06);
    for (let k = 0; k < 3; k++) c.toArray(colors, (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 }));
  mesh.receiveShadow = true;
  return mesh;
}

function palm(x, z, s, rnd) {
  const y = terrainHeight(x, z);
  const lean = (rnd() - 0.5) * 0.4;
  const parts = [part(cyl(0.12, 0.18, 3.4, 6), '#9a7048', { pos: [0, 1.7, 0], rot: [lean, 0, 0] })];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(part(box(0.5, 0.05, 1.9), i % 2 ? '#3f9a3a' : '#5ab84a', { pos: [Math.sin(a) * 0.8, 3.35, Math.cos(a) * 0.8 + lean * 3.4], rot: [0.45, a, 0] }));
  }
  const m = new THREE.Mesh(merge(parts), flatMat());
  m.position.set(x, y, z);
  m.scale.setScalar(s);
  m.castShadow = true;
  return m;
}

function lighthouse(x, z) {
  const y = terrainHeight(x, z);
  const g = new THREE.Group();
  const stripes = [];
  for (let i = 0; i < 5; i++) stripes.push(part(cyl(1.3 - i * 0.12, 1.4 - i * 0.12, 1.8, 10), i % 2 ? '#d8402a' : '#f4f0e8', { pos: [0, 0.9 + i * 1.8, 0] }));
  const body = new THREE.Mesh(
    merge([
      ...stripes,
      part(cyl(1.1, 1.1, 0.2, 10), '#3a3a40', { pos: [0, 9.1, 0] }),
      part(cyl(0.7, 0.7, 1.3, 8), '#e8f4ff', { pos: [0, 9.85, 0] }),
      part(cone(0.95, 1.0, 8), '#d8402a', { pos: [0, 11.0, 0] }),
      part(box(1.2, 1.5, 1.6), '#f4f0e8', { pos: [2.0, 0.75, 0] }),
      part(box(1.4, 0.15, 1.8), '#5a4a3a', { pos: [2.0, 1.55, 0] }),
    ]),
    flatMat(),
  );
  body.castShadow = true;
  g.add(body);
  // 밤에 도는 빛줄기
  const beamMat = new THREE.MeshBasicMaterial({ color: '#fff4c0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beamGeo = new THREE.ConeGeometry(4, 60, 12, 1, true);
  beamGeo.translate(0, -30, 0);
  beamGeo.rotateZ(Math.PI / 2);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.position.y = 9.9;
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff4c0' }));
  lamp.position.y = 9.9;
  g.add(beam, lamp);
  g.position.set(x, y, z);
  return { group: g, beam, beamMat, lamp };
}

function rockMesh(r, rnd) {
  const y0 = 0;
  switch (r.kind) {
    case 'iceberg': {
      const m = new THREE.Mesh(
        merge([
          part(new THREE.DodecahedronGeometry(r.r, 0), '#eef8fc', { pos: [0, r.r * 0.15, 0], scale: [1, 0.7 + rnd() * 0.5, 1] }),
          part(new THREE.DodecahedronGeometry(r.r * 0.55, 0), '#d8f0fa', { pos: [r.r * 0.35, r.r * 0.65, -r.r * 0.2] }),
          part(cyl(r.r * 1.15, r.r * 1.15, 0.3, 9), '#a8dcf0', { pos: [0, -0.1, 0] }),
        ]),
        flatMat({ roughness: 0.4 }),
      );
      m.position.set(r.x, y0, r.z);
      m.rotation.y = rnd() * 6.28;
      m.castShadow = true;
      return m;
    }
    case 'floe': {
      const m = new THREE.Mesh(merge([part(cyl(r.r, r.r * 1.05, 0.45, 6 + Math.floor(rnd() * 3)), '#f4fbff', { pos: [0, 0.05, 0] })]), flatMat({ roughness: 0.5 }));
      m.position.set(r.x, y0, r.z);
      m.rotation.y = rnd() * 6.28;
      m.receiveShadow = true;
      return m;
    }
    case 'spire': {
      const h = 8 + rnd() * 14;
      const m = new THREE.Mesh(
        merge([
          part(cone(r.r, h, 6), '#2a2836', { pos: [0, h / 2 - 1, 0] }),
          part(cone(r.r * 0.6, h * 0.6, 5), '#3a3648', { pos: [r.r * 0.7, h * 0.3 - 1, r.r * 0.3] }),
          part(ico(0.35), '#60f0e0', { pos: [0, h - 1.4, 0] }),
          part(ico(0.25), '#60f0e0', { pos: [r.r * 0.6, h * 0.55, r.r * 0.4] }),
        ]),
        flatMat({ emissive: new THREE.Color('#0a1a20') }),
      );
      m.position.set(r.x, y0, r.z);
      m.rotation.y = rnd() * 6.28;
      m.castShadow = true;
      return m;
    }
    default: {
      // 산호: 수면 바로 아래위로 알록달록
      const cols = ['#f07a8a', '#f0a040', '#b070e0', '#f0e060', '#60d0c0'];
      const parts = [];
      for (let i = 0; i < 5; i++) {
        const a = rnd() * 6.28, d = rnd() * r.r;
        const c = cols[Math.floor(rnd() * cols.length)];
        parts.push(i % 2 ? part(ico(0.4 + rnd() * 0.4, 0), c, { pos: [Math.cos(a) * d, -0.25 + rnd() * 0.3, Math.sin(a) * d], scale: [1, 0.7, 1] }) : part(cone(0.18, 1.1, 5), c, { pos: [Math.cos(a) * d, -0.1, Math.sin(a) * d], rot: [rnd() * 0.5, 0, rnd() * 0.5] }));
      }
      const m = new THREE.Mesh(merge(parts), flatMat());
      m.position.set(r.x, 0, r.z);
      return m;
    }
  }
}

function buoy(c) {
  const m = new THREE.Mesh(
    merge([part(cyl(0.45, 0.55, 0.8, 8), c, { pos: [0, 0.2, 0] }), part(cyl(0.08, 0.08, 1.4, 5), '#3a3a40', { pos: [0, 1.2, 0] }), part(cone(0.3, 0.5, 4), c, { pos: [0, 2.0, 0] }), part(cyl(0.48, 0.48, 0.15, 8), '#f0f0f0', { pos: [0, 0.45, 0] })]),
    flatMat(),
  );
  m.castShadow = true;
  return m;
}

// 조선소: 부두 들머리 옆 나무 창고 + 받침 위의 배 + 목수
function shipyard() {
  const g = new THREE.Group();
  const y = terrainHeight(SHIPYARD.x, SHIPYARD.z);
  const shed = new THREE.Mesh(
    merge([
      part(box(6, 3.2, 5), '#a8784a', { pos: [2.4, 1.6, 0] }),
      part(box(6.6, 0.2, 3.2), '#6a4424', { pos: [2.4, 3.6, -1.3], rot: [0.5, 0, 0] }),
      part(box(6.6, 0.2, 3.2), '#6a4424', { pos: [2.4, 3.6, 1.3], rot: [-0.5, 0, 0] }),
      part(box(0.1, 2.4, 2.6), '#4a3020', { pos: [-0.62, 1.2, 0] }),
      // 받침대
      part(box(0.3, 0.7, 0.3), '#6a4424', { pos: [-3, 0.35, -1] }),
      part(box(0.3, 0.7, 0.3), '#6a4424', { pos: [-3, 0.35, 1] }),
      part(box(0.3, 0.7, 0.3), '#6a4424', { pos: [-5, 0.35, -1] }),
      part(box(0.3, 0.7, 0.3), '#6a4424', { pos: [-5, 0.35, 1] }),
      // 나무판과 통
      part(box(0.9, 0.12, 2.4), '#c89a62', { pos: [1.0, 0.1, 3.4], rot: [0, 0.3, 0] }),
      part(cyl(0.4, 0.4, 0.9, 8), '#8a5a32', { pos: [4.6, 0.45, 3.2] }),
    ]),
    flatMat(),
  );
  shed.castShadow = true;
  shed.receiveShadow = true;
  g.add(shed);
  const demo = buildBoat({ tier: 1, color: '#e8a040', name: '' });
  demo.group.position.set(-4, 0.95, 0);
  demo.group.rotation.y = Math.PI / 2;
  g.add(demo.group);
  g.add(sign(['물비늘 조선소', '배 사기 · 꾸미기'], { w: 3, h: 1.2, pos: [-0.75, 3.5, 2.6], post: false, rotY: -Math.PI / 2 }));
  const npc = buildCharacter('#4a7ab8', { npc: true, name: '목수 돌돌', nameColor: '#ffe08a' });
  npc.root.position.set(-1.6, 0, 1.2);
  npc.root.rotation.y = -Math.PI / 2;
  g.add(npc.root);
  g.position.set(SHIPYARD.x, y, SHIPYARD.z);
  return { group: g, npc };
}

export function buildSea(scene: THREE.Scene) {
  const root = new THREE.Group();
  scene.add(root);
  const rnd = mulberry32(909);
  for (const s of ISLETS) {
    root.add(isletMesh(s));
    if (s.id === 'coral') for (let i = 0; i < 4; i++) root.add(palm(s.x + Math.cos(i * 1.7) * s.r * 0.45, s.z + Math.sin(i * 1.7) * s.r * 0.45, 0.8 + rnd() * 0.4, rnd));
    if (s.id === 'gull')
      for (let i = 0; i < 6; i++) {
        const a = rnd() * 6.28, d = rnd() * s.r * 0.7;
        const x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
        const m = new THREE.Mesh(merge([part(new THREE.DodecahedronGeometry(1.2 + rnd() * 1.6, 0), '#7a746c')]), flatMat());
        m.position.set(x, terrainHeight(x, z), z);
        m.castShadow = true;
        root.add(m);
      }
  }
  const lh = ISLETS.find((s) => s.id === 'lighthouse');
  const light = lighthouse(lh.x - 2, lh.z);
  root.add(light.group);
  root.add(sign([lh.name], { pos: [lh.x - 8, undefined, lh.z + 6], rotY: -1.2 }));

  for (const r of ROCKS) root.add(rockMesh(r, rnd));
  const buoys = BUOYS.map((b) => {
    const m = buoy(b.c);
    m.position.set(b.x, 0, b.z);
    root.add(m);
    return m;
  });
  const yard = shipyard();
  root.add(yard.group);
  root.add(sign(['배 띄우는 곳', 'E로 내 배 띄우기'], { w: 2.4, h: 1.1, pos: [PIER.x + PIER.half - 0.2, 1.4, DOCK.z - 4], rotY: -Math.PI / 2 }));

  return {
    interactables: [{ kind: 'shipyard', x: SHIPYARD.x - 1.6, z: SHIPYARD.z + 1.2, r: 4.5, label: '조선소 이용하기' }],
    update(dt: number, t: number, env: { night: number }) {
      yard.npc.animate('idle', dt);
      for (let i = 0; i < buoys.length; i++) {
        buoys[i].position.y = Math.sin(t * 1.3 + i) * 0.12 - 0.1;
        buoys[i].rotation.z = Math.sin(t * 1.1 + i * 2) * 0.08;
      }
      light.beam.rotation.y = t * 0.8;
      light.beamMat.opacity = env.night * 0.22;
      (light.lamp.material as THREE.MeshBasicMaterial).color.setScalar(0.6 + env.night * 0.4);
    },
  };
}
