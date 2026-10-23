// 배 3D: 나룻배 / 통통배 / 원양 어선. 선체 띠 색과 이름을 바꿀 수 있음
import * as THREE from 'three';
import { part, merge, flatMat, textSprite } from './util.ts';
import { DECK_Y } from '../../../shared/sea.ts';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);
const WOOD = '#9a6a3e';
const WOOD_D = '#6a4424';
const DECK = '#c89a62';

// 뱃머리가 뾰족한 선체: 직사각형 몸통 + 쐐기 모양 앞부분
function hull(len: number, w: number, h: number, color: string, stripe: string) {
  const body = len * 0.72;
  const bow = len - body;
  const wedge = new THREE.CylinderGeometry(w / 2, w / 2, h, 3, 1);
  // 삼각기둥을 눕혀 뱃머리로
  wedge.rotateY(Math.PI / 6);
  wedge.scale(1, 1, (bow / (w / 2)) * 0.62);
  return [
    part(box(w, h, body), color, { pos: [0, h / 2, -bow / 2] }),
    part(wedge, color, { pos: [0, h / 2, body / 2 - bow / 2 + bow * 0.2] }),
    part(box(w + 0.04, h * 0.22, body), stripe, { pos: [0, h * 0.72, -bow / 2] }),
  ];
}

function rowboat(stripe: string) {
  return merge([
    ...hull(3.6, 1.35, 0.55, WOOD, stripe),
    part(box(1.15, 0.06, 2.4), DECK, { pos: [0, 0.3, -0.35] }),
    part(box(1.2, 0.08, 0.3), WOOD_D, { pos: [0, 0.45, -0.7] }),
    part(box(1.2, 0.08, 0.3), WOOD_D, { pos: [0, 0.45, 0.8] }),
    // 노
    part(box(0.06, 0.06, 2.0), '#d8b888', { pos: [-0.85, 0.55, -0.5], rot: [0.15, 0.35, 0] }),
    part(box(0.06, 0.06, 2.0), '#d8b888', { pos: [0.85, 0.55, -0.5], rot: [0.15, -0.35, 0] }),
  ]);
}

function motorboat(stripe: string) {
  return merge([
    ...hull(5.6, 2.0, 0.85, '#f0ece0', stripe),
    part(box(1.8, 0.06, 3.9), DECK, { pos: [0, 0.5, -0.6] }),
    // 조타실
    part(box(1.4, 1.1, 1.2), '#f4f0e4', { pos: [0, 1.05, -1.25] }),
    part(box(1.5, 0.1, 1.35), stripe, { pos: [0, 1.65, -1.25] }),
    part(box(1.2, 0.4, 0.05), '#8ac8e8', { pos: [0, 1.25, -0.63] }),
    part(cyl(0.16, 0.16, 0.6), '#5a5a60', { pos: [0.4, 1.95, -1.5] }),
    // 엔진
    part(box(0.5, 0.6, 0.5), '#3a3a40', { pos: [0, 0.75, -2.75] }),
    part(box(0.12, 0.5, 0.12), '#3a3a40', { pos: [0, 0.3, -3.05] }),
    // 의자
    part(box(0.45, 0.3, 0.45), WOOD_D, { pos: [-0.55, 0.65, 0.2] }),
    part(box(0.45, 0.3, 0.45), WOOD_D, { pos: [0.55, 0.65, 0.2] }),
    part(box(0.45, 0.3, 0.45), WOOD_D, { pos: [0, 0.65, 1.6] }),
  ]);
}

function trawler(stripe: string) {
  const rail = [];
  for (const s of [-1, 1]) rail.push(part(box(0.06, 0.06, 6.4), '#e8e4d8', { pos: [s * 1.45, 1.65, -0.2] }));
  for (let z = -3.2; z <= 3; z += 1.6) for (const s of [-1, 1]) rail.push(part(box(0.06, 0.5, 0.06), '#e8e4d8', { pos: [s * 1.45, 1.4, z] }));
  return merge([
    ...hull(9, 3.1, 1.25, '#2a3a5a', stripe),
    part(box(2.9, 0.08, 6.6), '#a8846a', { pos: [0, 1.15, -0.9] }),
    // 선실
    part(box(2.2, 1.6, 2.0), '#f0ece0', { pos: [0, 1.95, -0.2] }),
    part(box(2.4, 0.14, 2.2), stripe, { pos: [0, 2.8, -0.2] }),
    part(box(1.9, 0.5, 0.05), '#8ac8e8', { pos: [0, 2.2, 0.81] }),
    part(box(0.05, 0.5, 1.5), '#8ac8e8', { pos: [1.11, 2.2, -0.2] }),
    part(box(0.05, 0.5, 1.5), '#8ac8e8', { pos: [-1.11, 2.2, -0.2] }),
    // 돛대와 크레인
    part(cyl(0.09, 0.11, 4.2), '#d8d8d8', { pos: [0, 4.9, -0.4] }),
    part(box(1.6, 0.08, 0.08), '#d8d8d8', { pos: [0, 5.8, -0.4] }),
    part(cyl(0.07, 0.07, 3.4), '#e8a040', { pos: [0, 2.9, -3.0], rot: [0.75, 0, 0] }),
    part(cyl(0.3, 0.3, 0.5), '#5a5a60', { pos: [0, 1.45, -3.6] }),
    // 구명튜브
    part(new THREE.TorusGeometry(0.28, 0.08, 5, 10), '#f05a3a', { pos: [1.12, 2.0, -0.6], rot: [0, Math.PI / 2, 0] }),
    ...rail,
  ]);
}

const MAT = flatMat();
const ANCHOR_BUOY = merge([part(new THREE.SphereGeometry(0.22, 8, 5), '#f07a2a'), part(cyl(0.03, 0.03, 0.5), '#3a3a3a', { pos: [0, 0.3, 0] })]);

export function buildBoat(data: { tier: number; color: string; name: string }) {
  const g = new THREE.Group();
  const tilt = new THREE.Group(); // 흔들림
  g.add(tilt);
  let mesh: THREE.Mesh = null;
  let tag = null;
  const buoy = new THREE.Mesh(ANCHOR_BUOY, MAT);
  buoy.visible = false;
  g.add(buoy);
  let tier = 0, color = '', name = '';

  function set(d) {
    if (d.tier !== tier || d.color !== color) {
      if (mesh) {
        tilt.remove(mesh);
        mesh.geometry.dispose();
      }
      const geo = d.tier === 1 ? rowboat(d.color) : d.tier === 2 ? motorboat(d.color) : trawler(d.color);
      mesh = new THREE.Mesh(geo, MAT);
      mesh.castShadow = true;
      mesh.position.y = -[0.3, 0.42, 0.75][d.tier - 1];
      tilt.add(mesh);
    }
    if (d.name !== name || d.tier !== tier) {
      if (tag) {
        tilt.remove(tag);
        tag.material.map.dispose();
        tag.material.dispose();
      }
      tag = textSprite([{ text: d.name, color: '#e8f6ff', size: 46 }], { scale: 0.55 });
      tag.position.set(0, [1.6, 2.7, 6.4][d.tier - 1], 0);
      tilt.add(tag);
    }
    tier = d.tier;
    color = d.color;
    name = d.name;
  }
  set(data);

  let t = Math.random() * 10;
  return {
    group: g,
    set,
    // 물결에 흔들리기. v: 속도, rough: 폭풍이면 크게
    update(dt: number, { v = 0, anchored = false, rough = false } = {}) {
      t += dt;
      const amp = (rough ? 2.6 : 1) * (tier === 3 ? 0.5 : 1);
      tilt.position.y = Math.sin(t * 1.4) * 0.06 * amp;
      tilt.rotation.z = Math.sin(t * 1.1) * 0.035 * amp;
      tilt.rotation.x = Math.sin(t * 0.9 + 1) * 0.025 * amp - Math.min(0.06, Math.abs(v) * 0.006);
      buoy.visible = anchored;
      if (anchored) buoy.position.set(1.6 + tier * 0.6, 0.05 + Math.sin(t * 2) * 0.04, -1);
      return tilt.position.y;
    },
    deckY: () => DECK_Y[tier - 1],
    dispose() {
      mesh?.geometry.dispose();
      if (tag) {
        tag.material.map.dispose();
        tag.material.dispose();
      }
    },
  };
}
