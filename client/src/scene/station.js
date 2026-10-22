// 야외 조리대 3D: 가진 조리 도구가 올라간 나무 테이블 + 진열 선반 + 이름표
import * as THREE from 'three';
import { part, merge, flatMat, textSprite } from './util.js';
import { walkHeight } from '../../../shared/world.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
const PLATE_COLOR = { board: '#f08a7a', grill: '#c8823a', pot: '#e8743a', fryer: '#e8b84a' };

function toolMesh(id) {
  switch (id) {
    case 'board':
      return merge([part(box(0.7, 0.06, 0.45), '#d8a868', { pos: [0, 0.03, 0] }), part(box(0.05, 0.02, 0.32), '#d8dfe4', { pos: [0.2, 0.08, 0], rot: [0, 0.5, 0] })]);
    case 'grill':
      return merge([
        part(box(0.7, 0.18, 0.45), '#3a3434', { pos: [0, 0.09, 0] }),
        ...[-0.24, -0.12, 0, 0.12, 0.24].map((x) => part(box(0.03, 0.02, 0.44), '#8a8080', { pos: [x, 0.19, 0] })),
        part(box(0.6, 0.02, 0.36), '#ff7a2a', { pos: [0, 0.16, 0] }),
      ]);
    case 'pot':
      return merge([part(cyl(0.24, 0.2, 0.3), '#9aa3ab', { pos: [0, 0.15, 0] }), part(cyl(0.22, 0.22, 0.02), '#e8743a', { pos: [0, 0.28, 0] }), part(box(0.6, 0.03, 0.04), '#5a5a60', { pos: [0, 0.27, 0] })]);
    case 'fryer':
      return merge([part(cyl(0.26, 0.22, 0.26), '#5a5a60', { pos: [0, 0.13, 0] }), part(cyl(0.23, 0.23, 0.02), '#f2c14e', { pos: [0, 0.25, 0] })]);
  }
  return null;
}

export function buildStation(st) {
  const g = new THREE.Group();
  const mat = flatMat();
  // 테이블과 진열 선반
  const table = new THREE.Mesh(
    merge([
      part(box(2.4, 0.12, 0.9), '#b07a44', { pos: [0, 0.86, 0] }),
      ...[[-1.1, -0.38], [1.1, -0.38], [-1.1, 0.38], [1.1, 0.38]].map(([x, z]) => part(box(0.1, 0.86, 0.1), '#6a4424', { pos: [x, 0.43, z] })),
      part(box(1.8, 0.08, 0.5), '#9a6a3a', { pos: [0, 0.35, -0.95] }),
      part(box(1.8, 0.08, 0.5), '#9a6a3a', { pos: [0, 0.75, -0.95] }),
      ...[-0.85, 0.85].map((x) => part(box(0.08, 0.8, 0.08), '#6a4424', { pos: [x, 0.4, -0.95] })),
      part(box(0.08, 1.6, 0.08), '#6a4424', { pos: [-1.15, 1.7, 0.4] }),
      part(box(1.2, 0.5, 0.05), '#f4e8c8', { pos: [-0.6, 2.25, 0.4] }),
    ]),
    mat,
  );
  table.castShadow = true;
  table.receiveShadow = true;
  g.add(table);

  const tools = new THREE.Group();
  g.add(tools);
  const slots = { board: [-0.75, 0.32], grill: [0.25, 0.1], pot: [-0.15, -0.25], fryer: [0.8, -0.22] };
  const plates = new THREE.Group();
  plates.position.set(0, 0.42, -0.95);
  g.add(plates);
  let tag = null;

  function setTools(toolsMap) {
    tools.clear();
    for (const [id, tier] of Object.entries(toolsMap || {})) {
      if (!(tier > 0)) continue;
      const geo = toolMesh(id);
      if (!geo) continue;
      const m = new THREE.Mesh(geo, mat);
      const [x, z] = slots[id];
      m.position.set(x, 0.92, z);
      m.castShadow = true;
      tools.add(m);
    }
  }
  function setDisplay(list) {
    plates.clear();
    (list || []).slice(0, 6).forEach((d, i) => {
      const plate = new THREE.Mesh(merge([part(cyl(0.16, 0.13, 0.03, 12), '#f4f1e8'), part(new THREE.SphereGeometry(0.1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), PLATE_COLOR[d.tool] || '#e8a060', { pos: [0, 0.015, 0], scale: [1, 0.6, 1] })]), mat);
      plate.position.set(-0.6 + (i % 3) * 0.6, i < 3 ? 0 : 0.4, 0);
      plates.add(plate);
    });
  }
  function setName(name, count) {
    if (tag) {
      g.remove(tag);
      tag.material.map.dispose();
      tag.material.dispose();
    }
    tag = textSprite([{ text: count ? `${name}의 조리대 · 진열 ${count}` : `${name}의 조리대`, color: '#ffe9a8', size: 44 }], { scale: 0.7 });
    tag.position.set(0, 2.9, 0);
    g.add(tag);
  }

  const api = {
    group: g,
    owner: st.owner,
    data: st,
    set(next) {
      api.data = next;
      g.position.set(next.x, walkHeight(next.x, next.z) ?? 0, next.z);
      g.rotation.y = next.ry || 0;
      setTools(next.tools);
      setDisplay(next.display.map((d) => ({ ...d, tool: d.tool })));
      setName(next.name, next.display.length);
    },
    update(dt, fx) {
      const st2 = api.data;
      // 석쇠 연기, 요리 중이면 김이 많이
      if (st2.tools?.grill && Math.random() < dt * (st2.cooking ? 8 : 1.5)) {
        const p = new THREE.Vector3(0.25, 1.15, 0.1).applyMatrix4(g.matrixWorld);
        fx.puff.spawn({ x: p.x, y: p.y, z: p.z, vy: 0.8, color: '#d8d8d8', size: 0.5, grow: 2, life: 1.6, alpha: 0.25 });
      }
      if (st2.cooking && Math.random() < dt * 10) {
        const p = new THREE.Vector3(-0.15, 1.25, -0.25).applyMatrix4(g.matrixWorld);
        fx.puff.spawn({ x: p.x + (Math.random() - 0.5) * 0.3, y: p.y, z: p.z, vy: 1.1, color: '#f4f4f0', size: 0.6, grow: 2.5, life: 1.4, alpha: 0.35 });
      }
    },
    dispose() {
      g.traverse((o) => o.geometry?.dispose());
    },
  };
  api.set(st);
  return api;
}
