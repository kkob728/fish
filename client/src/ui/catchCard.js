import * as THREE from 'three';
import { h, ui, fmtMoney } from './dom.js';
import { ic } from './icons.js';
import { makeFish } from '../scene/fishModel.js';
import { createFx } from '../scene/particles.js';
import { FISH_BY_ID } from '../../../shared/data/fish.js';
import { RARITY, QUALITY, VARIANT, formatKg, formatLen } from '../../../shared/data/core.js';

let renderer = null, scene = null, camera = null, fx = null;
let card = null, fish = null, raf = 0, closeTimer = 0;

function ensureRenderer() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#40506a', 1.8));
  const d = new THREE.DirectionalLight('#ffffff', 2.4);
  d.position.set(2, 3, 4);
  scene.add(d);
  camera = new THREE.PerspectiveCamera(32, 2, 0.05, 50);
  fx = createFx(scene);
  fx.setScale(260);
}

export function stars(n) {
  return h('span.stars', Array.from({ length: 5 }, (_, i) => ic(i < n ? 'star' : 'starEmpty')));
}

export function closeCatch() {
  cancelAnimationFrame(raf);
  clearTimeout(closeTimer);
  if (fish) {
    scene.remove(fish.group);
    fish.dispose();
    fish = null;
  }
  card?.remove();
  card = null;
}

export function showCatch(rec, flags = {}) {
  closeCatch();
  ensureRenderer();
  const sp = FISH_BY_ID[rec.sp];
  const rar = RARITY[sp.rarity];
  const q = QUALITY[rec.q];
  const v = rec.v ? VARIANT[rec.v] : null;
  const canvas = renderer.domElement;
  const stamps = [];
  if (flags.isNew) stamps.push(h('span.stamp', { style: { color: '#2f78c4' } }, ic('book'), `도감 등록! 보너스 ${fmtMoney(flags.bonus)}`));
  if (flags.isRecord) stamps.push(h('span.stamp', { style: { color: '#c8932a' } }, ic('trophy'), '서버 최대어 기록'));
  if (flags.autoSold) stamps.push(h('span.stamp', { style: { color: '#8a5a2a' } }, ic('coin'), '가방이 가득 차 바로 판매'));

  card = h(
    'div.catch.paper',
    { onclick: (e) => e.target === card && closeCatch() },
    h('div.banner', { style: { background: v ? v.ink : rar.color } }, v ? `${v.name} 변이!` : `${rar.name} 물고기`),
    canvas,
    h('div.name', { style: { color: v ? v.ink : rar.index >= 2 ? rar.color : 'var(--ink)' } }, v ? `${v.name} ${sp.name}` : sp.name),
    h('div.sub', h('span', { style: { color: q.color } }, q.name), stars(q.stars)),
    h('div.stats', h('div', '무게', h('b', formatKg(rec.w))), h('div', '길이', h('b', formatLen(rec.len))), h('div', '가치', h('b', fmtMoney(rec.price)))),
    stamps.length ? h('div.flags', stamps) : null,
    h('div.desc', v ? `${v.desc}${v.buff ? `  주변 낚시꾼들에게 [${v.buff.name}] 효과가 퍼졌어요.` : ''}` : sp.desc),
    h('button.primary', { onclick: closeCatch }, '가방에 넣기'),
  );
  ui().append(card);
  const w = canvas.clientWidth || 380;
  renderer.setSize(w, 190, false);
  camera.aspect = w / 190;
  camera.updateProjectionMatrix();

  fish = makeFish(rec.sp, rec.v, { fx, wiggle: 0.08 });
  const isRay = sp.look.shape === 'ray';
  fish.group.scale.setScalar(isRay ? 0.8 : 1);
  scene.add(fish.group);
  camera.position.set(0, isRay ? 1.0 : 0.25, isRay ? 1.6 : 1.9);
  camera.lookAt(0, 0, 0);

  let last = performance.now();
  let t = 0;
  const loop = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    fish.group.rotation.y = Math.sin(t * 0.6) * 0.6 + (isRay ? 0 : 0.2);
    fish.group.position.y = Math.sin(t * 1.4) * 0.03;
    fish.update(dt);
    fx.update(dt);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  };
  loop();
  closeTimer = setTimeout(closeCatch, 9000);
}
