import * as THREE from 'three';
import { part, merge, flatMat, textSprite } from './util.ts';
import { ROD } from '../../../shared/data/core.ts';

const SKIN = '#f2c79a';

function box(w: number, h: number, d: number, color: string, pos: number[], rot?: number[]) {
  return part(new THREE.BoxGeometry(w, h, d), color, { pos, rot });
}

export function buildCharacter(color = '#e86a4a', { name = '', npc = false, nameColor = '#ffffff' } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // 몸 전체 흔들림용
  root.add(body);
  const mat = flatMat({ roughness: 0.8 });

  const col = new THREE.Color(color);
  const dark = col.clone().multiplyScalar(0.7);

  // 몸통 (조끼 + 셔츠)
  const torso = new THREE.Mesh(
    merge([
      box(0.6, 0.66, 0.34, '#f4efe2', [0, 1.14, 0]),
      box(0.64, 0.5, 0.37, color, [0, 1.2, 0]),
      box(0.22, 0.4, 0.38, '#f4efe2', [0, 1.26, 0.005]),
      box(0.42, 0.42, 0.2, npc ? '#d8c8a0' : '#8a6a42', [0, 1.18, -0.27]),
      box(0.62, 0.08, 0.36, '#4a3a2a', [0, 0.84, 0]),
    ]),
    mat,
  );
  torso.castShadow = true;
  body.add(torso);

  // 머리
  const head = new THREE.Group();
  head.position.set(0, 1.62, 0);
  const headMesh = new THREE.Mesh(
    merge([
      part(new THREE.IcosahedronGeometry(0.27, 1), SKIN, { pos: [0, 0.16, 0] }),
      box(0.05, 0.08, 0.02, '#1d1d24', [-0.09, 0.19, 0.25]),
      box(0.05, 0.08, 0.02, '#1d1d24', [0.09, 0.19, 0.25]),
      box(0.07, 0.035, 0.02, '#f08a8a', [-0.16, 0.1, 0.23]),
      box(0.07, 0.035, 0.02, '#f08a8a', [0.16, 0.1, 0.23]),
      part(new THREE.CylinderGeometry(0.2, 0.26, 0.2, 8), color, { pos: [0, 0.38, 0] }),
      part(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 10), dark.getStyle(), { pos: [0, 0.29, 0] }),
      part(new THREE.CylinderGeometry(0.205, 0.205, 0.05, 8), '#f4efe2', { pos: [0, 0.32, 0] }),
    ]),
    mat,
  );
  headMesh.castShadow = true;
  head.add(headMesh);
  body.add(head);

  // 팔 (어깨 피벗)
  function arm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.4, 1.42, 0);
    const m = new THREE.Mesh(
      merge([
        box(0.17, 0.32, 0.19, color, [0, -0.14, 0]),
        box(0.15, 0.3, 0.17, '#f4efe2', [0, -0.42, 0]),
        part(new THREE.IcosahedronGeometry(0.09, 0), SKIN, { pos: [0, -0.62, 0] }),
      ]),
      mat,
    );
    m.castShadow = true;
    pivot.add(m);
    const hand = new THREE.Object3D();
    hand.position.set(0, -0.62, 0);
    pivot.add(hand);
    body.add(pivot);
    return { pivot, hand };
  }
  const armL = arm(-1);
  const armR = arm(1);

  // 다리 (엉덩이 피벗)
  function leg(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.15, 0.82, 0);
    const m = new THREE.Mesh(
      merge([box(0.22, 0.64, 0.24, npc ? '#5a4a3a' : '#3b4a6a', [0, -0.34, 0]), box(0.24, 0.16, 0.34, '#3a2a20', [0, -0.74, 0.04])]),
      mat,
    );
    m.castShadow = true;
    pivot.add(m);
    body.add(pivot);
    return pivot;
  }
  const legL = leg(-1);
  const legR = leg(1);

  // 낚싯대 — 오른손에 들고 팔과 직각(+z) 방향
  const rod = new THREE.Group();
  rod.position.copy(armR.hand.position);
  armR.pivot.add(rod);
  const rodMat = new THREE.MeshStandardMaterial({ color: '#c8a85a', roughness: 0.5, metalness: 0.2, flatShading: true });
  const ROD_LEN = 2.3;
  const rodMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, ROD_LEN, 5), rodMat);
  rodMesh.rotation.x = Math.PI / 2;
  rodMesh.position.z = ROD_LEN / 2 - 0.25;
  rodMesh.castShadow = true;
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8), new THREE.MeshStandardMaterial({ color: '#2a2a30', metalness: 0.6, roughness: 0.4 }));
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.06, -0.05, 0.05);
  const tip = new THREE.Object3D();
  tip.position.set(0, 0, ROD_LEN - 0.25);
  rod.add(rodMesh, reel, tip);
  rod.visible = !npc;

  // 들어 올린 물고기 위치
  const holder = new THREE.Group();
  holder.position.set(0, 2.35, 0.35);
  body.add(holder);

  let tag = null;
  function setName(n, c = nameColor) {
    if (tag) {
      root.remove(tag);
      tag.material.map.dispose();
      tag.material.dispose();
    }
    if (!n) return;
    tag = textSprite([{ text: n, color: c, size: 54 }], { scale: 0.75 });
    tag.position.y = 2.55;
    tag.renderOrder = 10;
    root.add(tag);
  }
  setName(name);

  const anim = { phase: 0, castT: 0, t: 0, lean: 0 };
  const lerpA = (cur, target, k) => cur + (target - cur) * k;

  return {
    root,
    rodTip: tip,
    holder,
    setName,
    setRod(rodId) {
      const r = ROD[rodId] || ROD.bamboo;
      rodMat.color.set(r.color);
      rodMat.emissive.set(rodId === 'nebula' ? '#6a2aa0' : '#000000');
    },
    triggerCast() {
      anim.castT = 1;
    },
    // state: idle | walk | run | charge | wait | bite | fight | show, speed: 0..1
    animate(state, dt, speed = 0) {
      anim.t += dt;
      const k = 1 - Math.exp(-dt * 12);
      let aR = 0, aL = 0, lL = 0, lR = 0, bob = 0, lean = 0, armRz = 0;
      if (state === 'walk' || state === 'run') {
        anim.phase += dt * (state === 'run' ? 11 : 7.5);
        const s = Math.sin(anim.phase);
        const amp = state === 'run' ? 0.85 : 0.55;
        lL = s * amp;
        lR = -s * amp;
        aL = -s * amp * 0.8;
        aR = s * amp * 0.5 - 0.35;
        bob = Math.abs(Math.cos(anim.phase)) * (state === 'run' ? 0.09 : 0.05);
        lean = state === 'run' ? 0.12 : 0.04;
      } else {
        bob = Math.sin(anim.t * 2) * 0.012;
        aR = -0.4;
      }
      rod.visible = !npc && state !== 'show';
      if (state === 'charge') {
        aR = -2.7;
        aL = -0.6;
        lean = -0.1;
      } else if (state === 'wait' || state === 'bite') {
        aR = -0.75 + (state === 'bite' ? Math.sin(anim.t * 30) * 0.08 : 0);
        aL = -0.5;
        armRz = 0.15;
      } else if (state === 'fight') {
        aR = -1.05 + Math.sin(anim.t * 25) * 0.06;
        aL = -0.95;
        armRz = 0.2;
        lean = -0.2;
      } else if (state === 'show') {
        aR = -2.9;
        aL = -2.9;
        armRz = -0.25;
      }
      if (anim.castT > 0) {
        anim.castT = Math.max(0, anim.castT - dt * 3.2);
        aR = -0.6 - anim.castT * 2.2;
      }
      armR.pivot.rotation.x = anim.castT > 0 ? aR : lerpA(armR.pivot.rotation.x, aR, k);
      armR.pivot.rotation.z = lerpA(armR.pivot.rotation.z, armRz, k);
      armL.pivot.rotation.x = lerpA(armL.pivot.rotation.x, aL, k);
      armL.pivot.rotation.z = lerpA(armL.pivot.rotation.z, state === 'show' ? 0.25 : -0.05, k);
      legL.rotation.x = lerpA(legL.rotation.x, lL, k);
      legR.rotation.x = lerpA(legR.rotation.x, lR, k);
      anim.lean = lerpA(anim.lean, lean, k);
      body.rotation.x = anim.lean;
      body.position.y = bob;
      head.rotation.x = -anim.lean * 0.6 + (state === 'show' ? -0.25 : 0);
    },
  };
}
