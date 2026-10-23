// glTF(.glb) 모델 불러오기. 지금은 모든 모델을 코드로 만들지만, 나중에 만든 모델 파일을
// client/public/models/ 에 넣으면 여기로 불러와서 바꿔 끼울 수 있음
//
//   const boat = modelOr('/models/rowboat.glb', () => buildRowboat());  // 파일이 없거나 실패하면 코드 모델 그대로
//   scene.add(boat);
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';

const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Object3D | null>>();

function prepare(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return root;
}

// 원본은 캐시에 두고 매번 복제본을 줌 (뼈대가 있는 모델도 안전하게 복제)
export async function loadModel(url: string): Promise<THREE.Object3D | null> {
  if (!cache.has(url)) {
    cache.set(
      url,
      loader
        .loadAsync(url)
        .then((g) => prepare(g.scene))
        .catch((e) => {
          console.warn('[models] 불러오기 실패, 코드 모델을 씀:', url, e?.message || e);
          return null;
        }),
    );
  }
  const src = await cache.get(url);
  return src ? cloneSkinned(src) : null;
}

// 바로 쓸 수 있는 그룹을 돌려줌: 처음엔 코드 모델을 담고, 파일을 다 불러오면 바꿔 끼움
export function modelOr(url: string, fallback: () => THREE.Object3D, opts: { scale?: number } = {}) {
  const holder = new THREE.Group();
  const fb = fallback();
  holder.add(fb);
  loadModel(url).then((m) => {
    if (!m) return;
    if (opts.scale) m.scale.setScalar(opts.scale);
    holder.remove(fb);
    holder.add(m);
  });
  return holder;
}

export function preloadModels(urls: string[]) {
  return Promise.all(urls.map((u) => loadModel(u)));
}
