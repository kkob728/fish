// 잡은 물고기 카드 안에서 빙글 도는 3D 물고기. 렌더러는 하나를 계속 다시 씀
import * as THREE from 'three';
import { makeFish } from './fishModel.ts';
import { createFx } from './particles.ts';
import { FISH_BY_ID } from '../../../shared/data/fish.ts';

let renderer: THREE.WebGLRenderer = null, scene: THREE.Scene = null, camera: THREE.PerspectiveCamera = null, fx = null;

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

// host 안에 캔버스를 붙이고 돌림. 돌려받은 함수로 정리
export function mountCatchView(host: HTMLElement, spId: string, variant: string | null) {
  ensureRenderer();
  const canvas = renderer.domElement;
  host.append(canvas);
  const w = canvas.clientWidth || 380;
  renderer.setSize(w, 190, false);
  camera.aspect = w / 190;
  camera.updateProjectionMatrix();

  const sp = FISH_BY_ID[spId];
  const fish = makeFish(spId, variant, { fx, wiggle: 0.08 });
  const isRay = sp.look.shape === 'ray';
  fish.group.scale.setScalar(isRay ? 0.8 : 1);
  scene.add(fish.group);
  camera.position.set(0, isRay ? 1.0 : 0.25, isRay ? 1.6 : 1.9);
  camera.lookAt(0, 0, 0);

  let raf = 0;
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

  return () => {
    cancelAnimationFrame(raf);
    scene.remove(fish.group);
    fish.dispose();
    canvas.remove();
  };
}
