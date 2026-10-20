import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// 색이 칠해진 부품 지오메트리를 하나로 합친다 (로우폴리 + vertexColors)
export function part(geo, color, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo;
  g.deleteAttribute('uv');
  const m = new THREE.Matrix4().compose(
    new THREE.Vector3(...pos),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)),
    new THREE.Vector3(...scale),
  );
  g.applyMatrix4(m);
  const c = new THREE.Color(color);
  const arr = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < arr.length; i += 3) c.toArray(arr, i);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

export function merge(parts) {
  const g = mergeGeometries(parts, false);
  g.computeVertexNormals();
  return g;
}

export const flatMat = (opts = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0, ...opts });

export function textTexture(lines, { w = 512, h = 256, bg = '#6b4a2a', fg = '#fff4d6', font = 'Jua', size = 64, border = '#3e2a16' } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d');
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = border;
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    // 나뭇결
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    for (let y = 20; y < h; y += 22) {
      ctx.beginPath();
      ctx.moveTo(14, y + Math.sin(y) * 3);
      ctx.bezierCurveTo(w * 0.3, y + 5, w * 0.6, y - 5, w - 14, y + 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const arr = Array.isArray(lines) ? lines : [lines];
  arr.forEach((ln, i) => {
    const s = typeof ln === 'object' ? ln.size || size : i === 0 ? size : size * 0.6;
    const text = typeof ln === 'object' ? ln.text : ln;
    ctx.font = `${s}px ${font}, 'Noto Sans KR', sans-serif`;
    if (!bg) {
      ctx.lineWidth = s * 0.16;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.strokeText(text, w / 2, h / 2 + (i - (arr.length - 1) / 2) * s * 1.15);
    }
    if (typeof ln === 'object' && ln.color) ctx.fillStyle = ln.color;
    ctx.fillText(text, w / 2, h / 2 + (i - (arr.length - 1) / 2) * s * 1.15);
    ctx.fillStyle = fg;
  });
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function textSprite(lines, opts = {}) {
  const tex = textTexture(lines, { bg: null, w: 512, h: 128, size: 56, ...opts });
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
  const sp = new THREE.Sprite(mat);
  const sc = opts.scale || 1;
  sp.scale.set(4 * sc, 1 * sc, 1);
  return sp;
}

// 잎/풀 흔들림 — 인스턴스 위치마다 위상이 달라짐
export const windUniform = { value: 0 };
export function addWind(mat, strength = 0.06) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWind = windUniform;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sway = sin(uWind * 1.6 + ip.x * 0.3 + ip.z * 0.2) * ${strength.toFixed(3)} * max(position.y, 0.0);
        transformed.x += sway;
        transformed.z += sway * 0.6;`,
      );
  };
  return mat;
}
