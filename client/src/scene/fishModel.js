import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FISH_BY_ID } from '../../../shared/data/fish.js';
import { VARIANT } from '../../../shared/data/core.js';
import { mulberry32 } from '../../../shared/rng.js';

// 모양 프리셋: H/W = 최대 높이/폭(몸길이 1 기준), peak = 가장 두꺼운 지점, tailMin = 꼬리자루 두께, nose = 머리 뭉툭함
const BASE = {
  minnow: { H: 0.22, W: 0.12, peak: 0.55, tailMin: 0.12, nose: 0.75, tail: 'fork', dorsal: 'mid' },
  carp: { H: 0.33, W: 0.18, peak: 0.55, tailMin: 0.14, nose: 0.6, tail: 'fork', dorsal: 'long', barbels: 2 },
  perch: { H: 0.38, W: 0.14, peak: 0.55, tailMin: 0.14, nose: 0.7, tail: 'trunc', dorsal: 'spiky' },
  catfish: { H: 0.2, W: 0.24, peak: 0.72, tailMin: 0.1, nose: 0.35, tail: 'round', dorsal: 'small', whiskers: true },
  eel: { H: 0.085, W: 0.075, peak: 0.6, tailMin: 0.02, nose: 0.6, tail: 'none', dorsal: 'fringe', noAnal: true },
  flat: { H: 0.07, W: 0.36, peak: 0.5, tailMin: 0.12, nose: 0.5, tail: 'round', dorsal: 'edge', flat: true, noAnal: true },
  tuna: { H: 0.27, W: 0.21, peak: 0.5, tailMin: 0.06, nose: 0.75, tail: 'lunate', dorsal: 'twin', finlets: true },
  shark: { H: 0.2, W: 0.18, peak: 0.55, tailMin: 0.08, nose: 0.85, tail: 'hetero', dorsal: 'tall', pect: 2.4 },
  sunfish: { H: 0.75, W: 0.14, peak: 0.45, tailMin: 0.62, nose: 0.5, tail: 'clavus', dorsal: 'blade', noAnal: true },
  angler: { H: 0.3, W: 0.34, peak: 0.72, tailMin: 0.12, nose: 0.3, tail: 'round', dorsal: 'small', lure: true, mouth: true },
  pike: { H: 0.15, W: 0.12, peak: 0.45, tailMin: 0.12, nose: 0.95, tail: 'fork', dorsal: 'back' },
  salmon: { H: 0.25, W: 0.14, peak: 0.55, tailMin: 0.12, nose: 0.75, tail: 'fork', dorsal: 'mid', adipose: true },
  arowana: { H: 0.22, W: 0.1, peak: 0.6, tailMin: 0.14, nose: 0.7, tail: 'round', dorsal: 'back', barbels: 1 },
  dragon: { H: 0.1, W: 0.1, peak: 0.75, tailMin: 0.14, nose: 0.55, tail: 'fan', dorsal: 'spines', horns: true, whiskers: true, noAnal: true },
  gar: { H: 0.12, W: 0.1, peak: 0.5, tailMin: 0.12, nose: 1.4, tail: 'round', dorsal: 'back' },
  oarfish: { H: 0.12, W: 0.03, peak: 0.85, tailMin: 0.02, nose: 0.6, tail: 'none', dorsal: 'crest', noAnal: true },
  goby: { H: 0.2, W: 0.18, peak: 0.7, tailMin: 0.14, nose: 0.45, tail: 'round', dorsal: 'twin', bugEyes: true },
  sturgeon: { H: 0.17, W: 0.17, peak: 0.5, tailMin: 0.08, nose: 0.95, tail: 'hetero', dorsal: 'back', scutes: true, barbels: 2 },
  veil: { H: 0.33, W: 0.17, peak: 0.55, tailMin: 0.14, nose: 0.6, tail: 'veil', dorsal: 'sail', barbels: 2 },
  flying: { H: 0.2, W: 0.13, peak: 0.55, tailMin: 0.12, nose: 0.75, tail: 'fork', dorsal: 'mid', pect: 5 },
  hammerhead: { H: 0.2, W: 0.18, peak: 0.55, tailMin: 0.08, nose: 0.6, tail: 'hetero', dorsal: 'tall', pect: 2.4, hammer: true },
  ray: { ray: true },
};

function prof(t, sh) {
  if (t < sh.peak) {
    const u = t / sh.peak;
    return sh.tailMin + (1 - sh.tailMin) * Math.pow(Math.sin((u * Math.PI) / 2), 0.9);
  }
  const u = (t - sh.peak) / (1 - sh.peak);
  return Math.pow(Math.max(0, Math.cos((u * Math.PI) / 2)), sh.nose);
}

function bodyGeometry(sh) {
  const S = 20, R = 12;
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= S; i++) {
    const t = i / S;
    const r = Math.max(prof(t, sh), i === S ? 0 : 0.02);
    for (let j = 0; j <= R; j++) {
      const th = (j / R) * Math.PI * 2;
      pos.push(t - 0.5, Math.cos(th) * sh.H * r, Math.sin(th) * sh.W * r);
      uv.push(t, j / R);
    }
  }
  for (let i = 0; i < S; i++) {
    for (let j = 0; j < R; j++) {
      const a = i * (R + 1) + j;
      const b = a + R + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const c = pos.length / 3;
  pos.push(-0.5, 0, 0);
  uv.push(0, 0.5);
  for (let j = 0; j < R; j++) idx.push(c, j + 1, j);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const topAt = (t, sh) => sh.H * prof(t, sh) * 0.96;

function shapeGeo(points, z = 0, curve = false) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    if (curve && p.length === 4) s.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else s.lineTo(p[0], p[1]);
  }
  const g = new THREE.ShapeGeometry(s, 6);
  g.translate(0, 0, z);
  return g;
}

function tailGeo(sh) {
  const x0 = -0.49;
  const S = sh.flat ? sh.W * 0.45 : Math.max(sh.H * 0.85, 0.08);
  const L = 0.2;
  switch (sh.tail) {
    case 'fork': return shapeGeo([[x0 + 0.04, 0.01], [x0 - L, S], [x0 - L * 0.55, 0], [x0 - L, -S], [x0 + 0.04, -0.01]]);
    case 'trunc': return shapeGeo([[x0 + 0.04, S * 0.3], [x0 - L * 0.9, S * 0.95], [x0 - L * 0.8, 0], [x0 - L * 0.9, -S * 0.95], [x0 + 0.04, -S * 0.3]]);
    case 'round': {
      const pts = [[x0 + 0.04, 0]];
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI * (0.62 + (i / 8) * 0.76);
        pts.push([x0 + Math.cos(a) * L, Math.sin(a) * S * 0.9]);
      }
      return shapeGeo(pts);
    }
    case 'lunate': return shapeGeo([[x0 + 0.04, 0.01], [x0 - L * 0.55, S * 1.25], [x0 - L * 0.45, S * 0.35, x0 - L * 0.3, 0], [x0 - L * 0.45, -S * 0.35], [x0 - L * 0.55, -S * 1.25], [x0 + 0.04, -0.01]]);
    case 'hetero': return shapeGeo([[x0 + 0.05, 0.02], [x0 - L * 1.2, S * 1.5], [x0 - L * 0.45, 0], [x0 - L * 0.5, -S * 0.7], [x0 + 0.05, -0.02]]);
    case 'clavus': {
      const pts = [[x0 + 0.06, S * 0.62]];
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI * (0.5 + i / 10);
        const rr = (i % 2 ? 0.85 : 1) * 0.1;
        pts.push([x0 + Math.cos(a) * rr, Math.sin(a) * S * 0.62]);
      }
      pts.push([x0 + 0.06, -S * 0.62]);
      return shapeGeo(pts);
    }
    case 'fan': {
      const pts = [[x0 + 0.04, 0]];
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI * (0.55 + (i / 10) * 0.9);
        const rr = (i % 2 ? 0.75 : 1) * 0.22;
        pts.push([x0 + Math.cos(a) * rr, Math.sin(a) * 0.16]);
      }
      return shapeGeo(pts);
    }
    case 'veil': return shapeGeo([[x0 + 0.04, 0.02], [x0 - 0.15, S * 0.9, x0 - 0.42, S * 1.1], [x0 - 0.3, S * 0.3, x0 - 0.38, 0], [x0 - 0.3, -S * 0.3, x0 - 0.42, -S * 1.1], [x0 - 0.15, -S * 0.9, x0 + 0.04, -0.02]], 0, true);
    default: return null;
  }
}

function finAlong(sh, t0, t1, h, { down = false, spikes = 0, sweep = 0.3 } = {}) {
  const n = Math.max(6, spikes * 2);
  const pts = [];
  const sgn = down ? -1 : 1;
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n;
    pts.push([t - 0.5, sgn * topAt(t, sh) * 0.92]);
  }
  for (let i = n; i >= 0; i--) {
    const t = t0 + ((t1 - t0) * i) / n;
    const u = i / n;
    let hh = h * Math.sin(Math.PI * Math.pow(u, 0.7 + sweep));
    if (spikes && i % 2 === 1) hh *= 0.55;
    pts.push([t - 0.5 - hh * sweep * 0.5, sgn * (topAt(t, sh) * 0.92 + hh)]);
  }
  return shapeGeo(pts);
}

function dorsalGeos(sh) {
  const out = [];
  switch (sh.dorsal) {
    case 'mid': out.push(finAlong(sh, 0.42, 0.64, 0.12)); break;
    case 'long': out.push(finAlong(sh, 0.3, 0.7, 0.1, { sweep: 0.1 })); break;
    case 'spiky': out.push(finAlong(sh, 0.28, 0.76, 0.15, { spikes: 7, sweep: 0.05 })); break;
    case 'small': out.push(finAlong(sh, 0.5, 0.6, 0.06)); break;
    case 'twin': out.push(finAlong(sh, 0.5, 0.62, 0.09), finAlong(sh, 0.3, 0.4, 0.07)); break;
    case 'tall': out.push(finAlong(sh, 0.47, 0.62, 0.22, { sweep: 0.8 })); break;
    case 'back': out.push(finAlong(sh, 0.15, 0.32, 0.1)); break;
    case 'fringe': out.push(finAlong(sh, 0.04, 0.82, 0.035, { sweep: 0 })); break;
    case 'spines': out.push(finAlong(sh, 0.08, 0.88, 0.06, { spikes: 14, sweep: 0.2 })); break;
    case 'blade': out.push(finAlong(sh, 0.32, 0.5, 0.45, { sweep: 0.6 }), finAlong(sh, 0.32, 0.5, 0.45, { sweep: 0.6, down: true })); break;
    case 'crest': out.push(finAlong(sh, 0.02, 0.86, 0.05, { sweep: 0 }), finAlong(sh, 0.84, 0.97, 0.25, { spikes: 5, sweep: 0.9 })); break;
    case 'sail': out.push(finAlong(sh, 0.3, 0.74, 0.3, { sweep: 0.5 })); break;
    case 'edge': {
      for (const s of [-1, 1]) {
        const pts = [];
        for (let i = 0; i <= 10; i++) { const t = 0.08 + i * 0.077; pts.push([t - 0.5, s * sh.W * prof(t, sh) * 0.95]); }
        for (let i = 10; i >= 0; i--) { const t = 0.08 + i * 0.077; pts.push([t - 0.5, s * (sh.W * prof(t, sh) * 0.95 + 0.05 * Math.sin((i / 10) * Math.PI))]); }
        const g = shapeGeo(pts);
        g.rotateX(Math.PI / 2);
        out.push(g);
      }
      break;
    }
  }
  if (!sh.noAnal) out.push(finAlong(sh, 0.22, 0.36, 0.07, { down: true }));
  if (sh.adipose) out.push(finAlong(sh, 0.2, 0.25, 0.04));
  if (sh.finlets) for (let i = 0; i < 4; i++) { out.push(finAlong(sh, 0.08 + i * 0.04, 0.1 + i * 0.04, 0.035)); out.push(finAlong(sh, 0.08 + i * 0.04, 0.1 + i * 0.04, 0.035, { down: true })); }
  return out;
}

function pectoralGeos(sh) {
  const out = [];
  const k = sh.pect || 1;
  const t = sh.flat ? 0.66 : 0.68;
  for (const s of [-1, 1]) {
    const L = 0.09 * k, Hh = 0.04 * Math.min(k, 2.5);
    const g = shapeGeo([[0, 0], [-L * 0.3, Hh], [-L, Hh * 0.6], [-L * 0.9, -Hh * 0.2], [0, -0.01]]);
    g.rotateX(Math.PI / 2);
    g.rotateY(s * (k > 3 ? 0.25 : 0.6));
    g.rotateX(s * (k > 3 ? 0.15 : 0.5));
    g.translate(t - 0.5, -sh.H * prof(t, sh) * (k > 3 ? -0.05 : 0.35), s * sh.W * prof(t, sh) * 0.9);
    out.push(g);
  }
  return out;
}

function eyePositions(sh) {
  const t = sh.flat ? 0.8 : sh.mouth ? 0.84 : 0.86;
  const r = prof(t, sh);
  const e = Math.max(0.024, Math.min(0.06, sh.H * 0.13));
  if (sh.hammer) return { e: 0.03, pts: [[0.47, 0.02, sh.W * 3.1], [0.47, 0.02, -sh.W * 3.1]] };
  if (sh.flat) return { e, pts: [[t - 0.5, sh.H * r * 0.9, 0.05], [t - 0.53, sh.H * r * 0.9, -0.04]] };
  const y = sh.bugEyes ? sh.H * r * 0.85 : sh.H * r * 0.32;
  const z = sh.W * r * (sh.bugEyes ? 0.55 : 0.82);
  return { e, pts: [[t - 0.5, y, z], [t - 0.5, y, -z]] };
}

function seedOf(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

// ---------- 텍스처 ----------
function mixHex(a, b, t) {
  return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

function drawPattern(ctx, W, H, look, rnd) {
  const half = H / 2;
  const mirror = (fn) => {
    fn();
    ctx.save();
    ctx.translate(0, H);
    ctx.scale(1, -1);
    fn();
    ctx.restore();
  };
  ctx.fillStyle = look.pc;
  ctx.strokeStyle = look.pc;
  const circles = (n, rmin, rmax, ymin, ymax, alpha = 0.85) => {
    const list = [];
    for (let i = 0; i < n; i++) list.push([W * (0.08 + rnd() * 0.8), half * (ymin + rnd() * (ymax - ymin)), rmin + rnd() * (rmax - rmin)]);
    mirror(() => {
      ctx.globalAlpha = alpha;
      for (const [x, y, r] of list) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  };
  switch (look.pat) {
    case 'bands': {
      const n = 5 + Math.floor(rnd() * 3);
      mirror(() => {
        ctx.globalAlpha = 0.8;
        for (let k = 0; k < n; k++) ctx.fillRect(W * (0.12 + (k / n) * 0.75), 0, W * 0.045, half * 0.75);
        ctx.globalAlpha = 1;
      });
      break;
    }
    case 'stripes':
      mirror(() => {
        for (let k = 0; k < 4; k++) ctx.fillRect(W * 0.04, half * (0.15 + k * 0.17), W * 0.86, 2.5);
      });
      break;
    case 'lateral': case 'finlets':
      mirror(() => ctx.fillRect(W * 0.04, half * 0.48, W * 0.86, half * 0.1));
      break;
    case 'spots': circles(30, 2.5, 5.5, 0.05, 0.7); break;
    case 'dots': circles(55, 1.3, 2.4, 0.05, 0.85, 0.95); break;
    case 'blotch': {
      for (let b = 0; b < 10; b++) {
        const cx = W * (0.1 + rnd() * 0.8), cy = half * (0.05 + rnd() * 0.55);
        const sub = [];
        for (let i = 0; i < 4; i++) sub.push([cx + (rnd() - 0.5) * 16, cy + (rnd() - 0.5) * 10, 5 + rnd() * 7]);
        mirror(() => {
          ctx.globalAlpha = 0.6;
          for (const [x, y, r] of sub) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
          ctx.globalAlpha = 1;
        });
      }
      break;
    }
    case 'patches': {
      for (let b = 0; b < 4; b++) {
        const cx = W * (0.15 + rnd() * 0.7), cy = half * (0.05 + rnd() * 0.45);
        const sub = [];
        for (let i = 0; i < 5; i++) sub.push([cx + (rnd() - 0.5) * 30, cy + (rnd() - 0.5) * 14, 9 + rnd() * 10]);
        mirror(() => { for (const [x, y, r] of sub) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); } });
      }
      break;
    }
    case 'cracks': drawCracks(ctx, W, H, look.pc, rnd, 2.2); break;
    case 'parr': {
      mirror(() => {
        ctx.globalAlpha = 0.7;
        for (let k = 0; k < 8; k++) { ctx.beginPath(); ctx.ellipse(W * (0.15 + k * 0.09), half * 0.5, 6, 11, 0, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      });
      break;
    }
    case 'wavy':
      mirror(() => {
        ctx.lineWidth = 2.5;
        for (let k = 0; k < 9; k++) {
          ctx.beginPath();
          const x0 = W * (0.1 + k * 0.085);
          for (let y = 0; y < half * 0.6; y += 3) ctx.lineTo(x0 + Math.sin(y * 0.25 + k) * 5, y);
          ctx.stroke();
        }
      });
      break;
  }
}

function drawCracks(ctx, W, H, color, rnd, width = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  for (let k = 0; k < 14; k++) {
    let x = rnd() * W, y = rnd() * H;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 4 + Math.floor(rnd() * 6);
    for (let s = 0; s < steps; s++) {
      x += (rnd() - 0.5) * 34;
      y += (rnd() - 0.5) * 22;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function scalesOverlay(ctx, W, H, alpha = 0.08) {
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 6) {
    for (let x = (y / 6) % 2 ? 0 : 3; x < W; x += 6) {
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

const TEX_W = 256, TEX_H = 128;
function baseCanvas(look, seed, { c1 = look.c1, c2 = look.c2, pattern = true } = {}) {
  const cv = document.createElement('canvas');
  cv.width = TEX_W;
  cv.height = TEX_H;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, TEX_H);
  g.addColorStop(0, c1);
  g.addColorStop(0.2, mixHex(c1, c2, 0.3));
  g.addColorStop(0.5, c2);
  g.addColorStop(0.8, mixHex(c1, c2, 0.3));
  g.addColorStop(1, c1);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  if (pattern) drawPattern(ctx, TEX_W, TEX_H, look, mulberry32(seed));
  scalesOverlay(ctx, TEX_W, TEX_H);
  // 머리 쪽 살짝 어둡게
  const hg = ctx.createLinearGradient(TEX_W * 0.8, 0, TEX_W, 0);
  hg.addColorStop(0, 'rgba(0,0,0,0)');
  hg.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, TEX_W, TEX_H);
  return cv;
}

function canvasTex(cv) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- 셰이더 주입 (꼬리 흔들기, 변이 효과) ----------
function patchMaterial(mat, uniforms, opts = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime; uniform float uAmp; uniform float uMode;
        varying vec3 vObjPos;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vObjPos = position;
        float tailW = pow(max(0.0, 0.55 - position.x), 1.5);
        float wv = sin(uTime * 9.0 + position.x * 7.0) * uAmp * tailW;
        if (uMode < 0.5) transformed.z += wv;
        else if (uMode < 1.5) transformed.y += wv;
        else transformed.y += sin(uTime * 3.0 - abs(position.z) * 2.5) * uAmp * 2.0 * abs(position.z);`,
      );
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\nuniform float uTime;\nvarying vec3 vObjPos;\n${opts.fragHead || ''}`);
    if (opts.fragColor) sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${opts.fragColor}`);
  };
  mat.customProgramCacheKey = () => opts.key || 'fish';
}

const NEBULA_HEAD = `
float nh(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
float nn(vec3 p) { vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(nh(i), nh(i+vec3(1,0,0)), f.x), mix(nh(i+vec3(0,1,0)), nh(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(nh(i+vec3(0,0,1)), nh(i+vec3(1,0,1)), f.x), mix(nh(i+vec3(0,1,1)), nh(i+vec3(1,1,1)), f.x), f.y), f.z); }`;
const NEBULA_COLOR = `
{
  vec3 p = vObjPos * 7.0 + vec3(uTime * 0.25, 0.0, uTime * 0.1);
  float n = nn(p) * 0.6 + nn(p * 2.3) * 0.3 + nn(p * 5.1) * 0.1;
  vec3 c = mix(vec3(0.12, 0.05, 0.35), vec3(0.15, 0.25, 0.8), smoothstep(0.3, 0.6, n));
  c = mix(c, vec3(0.9, 0.3, 0.75), smoothstep(0.62, 0.8, n));
  float s = nh(floor(vObjPos * 70.0));
  float star = step(0.975, s) * (0.6 + 0.4 * sin(uTime * 4.0 + s * 80.0));
  diffuseColor.rgb = c * 0.6;
  totalEmissiveRadiance = c * 0.9 + vec3(star * 2.0);
}`;
const RIM_COLOR = (hex, power = 2.2, k = 1.4) => {
  const c = new THREE.Color(hex);
  return `{ float rim = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), ${power.toFixed(2)});
  totalEmissiveRadiance += vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)}) * rim * ${k.toFixed(2)}; }`;
};

const baseCanvasCache = new Map();
function getBaseCanvas(sp) {
  if (!baseCanvasCache.has(sp.id)) baseCanvasCache.set(sp.id, baseCanvas(sp.look, seedOf(sp.id)));
  return baseCanvasCache.get(sp.id);
}

function variantCanvas(sp, variant) {
  const seed = seedOf(sp.id + variant);
  const rnd = mulberry32(seed);
  const look = sp.look;
  switch (variant) {
    case 'moss': {
      const cv = baseCanvas(look, seedOf(sp.id));
      const ctx = cv.getContext('2d');
      for (let i = 0; i < 70; i++) {
        const x = rnd() * TEX_W, y = (rnd() < 0.5 ? rnd() * 0.3 : 1 - rnd() * 0.3) * TEX_H;
        ctx.fillStyle = ['#4a8a2a', '#6aaa3a', '#3a6a22'][i % 3];
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.arc(x, y, 3 + rnd() * 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return { map: cv };
    }
    case 'moon': {
      const cv = baseCanvas(look, seedOf(sp.id), { c1: '#8aa4d8', c2: '#f0f6ff' });
      return { map: cv };
    }
    case 'ember': {
      const cv = baseCanvas(look, seedOf(sp.id), { c1: '#1e1410', c2: '#4a2a1e', pattern: false });
      const em = document.createElement('canvas');
      em.width = TEX_W;
      em.height = TEX_H;
      const ectx = em.getContext('2d');
      ectx.fillStyle = '#000';
      ectx.fillRect(0, 0, TEX_W, TEX_H);
      drawCracks(ectx, TEX_W, TEX_H, '#ff7a20', rnd, 3);
      drawCracks(cv.getContext('2d'), TEX_W, TEX_H, '#ff9a40', mulberry32(seed), 3);
      return { map: cv, emissiveMap: em };
    }
    case 'shadow': return { map: baseCanvas({ ...look, pc: '#2a1a3a' }, seedOf(sp.id), { c1: '#08060c', c2: '#1a1424' }) };
    case 'ghost': return { map: baseCanvas({ ...look, pc: '#ffffff' }, seedOf(sp.id), { c1: '#a8f0e8', c2: '#f0fffc' }) };
    case 'storm': {
      const cv = baseCanvas({ ...look, pc: '#5a5a40' }, seedOf(sp.id), { c1: '#3a3a30', c2: '#8a8a70' });
      const em = document.createElement('canvas');
      em.width = TEX_W;
      em.height = TEX_H;
      const ectx = em.getContext('2d');
      ectx.fillStyle = '#000';
      ectx.fillRect(0, 0, TEX_W, TEX_H);
      drawCracks(ectx, TEX_W, TEX_H, '#fff27a', rnd, 2);
      drawCracks(cv.getContext('2d'), TEX_W, TEX_H, '#ffe84a', mulberry32(seed), 2);
      return { map: cv, emissiveMap: em };
    }
    case 'crystal': return { map: baseCanvas({ ...look, pc: '#e8ffff' }, seedOf(sp.id), { c1: '#a8ecff', c2: '#eaffff' }) };
    case 'celadon': {
      const cv = baseCanvas({ ...look, pat: 'none' }, seedOf(sp.id), { c1: '#6fb89a', c2: '#d4efe2', pattern: false });
      const ctx = cv.getContext('2d');
      ctx.strokeStyle = 'rgba(30,70,55,0.55)';
      ctx.lineWidth = 0.8;
      for (let k = 0; k < 120; k++) {
        let x = rnd() * TEX_W, y = rnd() * TEX_H;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 3; s++) { x += (rnd() - 0.5) * 18; y += (rnd() - 0.5) * 12; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      // 구름무늬 상감
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        const x = TEX_W * (0.2 + k * 0.18), y = TEX_H * 0.22;
        for (const yy of [y, TEX_H - y]) {
          ctx.beginPath();
          ctx.arc(x, yy, 7, Math.PI, 0);
          ctx.arc(x + 12, yy, 5, Math.PI, 0);
          ctx.stroke();
        }
      }
      return { map: cv };
    }
    case 'nebula': return { map: getBaseCanvas(sp) };
    default: return { map: getBaseCanvas(sp) };
  }
}

function makeMaterials(sp, variant, uniforms) {
  const vc = variant ? variantCanvas(sp, variant) : { map: getBaseCanvas(sp) };
  const map = canvasTex(vc.map);
  const finColor = new THREE.Color(sp.look.fin);
  let body, fin;
  const finBase = { side: THREE.DoubleSide, transparent: true, opacity: 0.9, roughness: 0.6, flatShading: true };
  switch (variant) {
    case 'moss':
      body = new THREE.MeshStandardMaterial({ map, roughness: 0.9, flatShading: true });
      fin = new THREE.MeshStandardMaterial({ ...finBase, color: finColor.clone().lerp(new THREE.Color('#5a9a3a'), 0.6) });
      break;
    case 'moon':
      body = new THREE.MeshStandardMaterial({ map, roughness: 0.2, metalness: 0.65, emissive: '#5070c0', emissiveIntensity: 0.55, flatShading: true });
      fin = new THREE.MeshStandardMaterial({ ...finBase, color: '#cfe0ff', emissive: '#6080d0', emissiveIntensity: 0.6, opacity: 0.75 });
      break;
    case 'ember':
      body = new THREE.MeshStandardMaterial({ map, emissiveMap: canvasTex(vc.emissiveMap), emissive: '#ffffff', emissiveIntensity: 2, roughness: 0.85, flatShading: true });
      fin = new THREE.MeshStandardMaterial({ ...finBase, color: '#3a1a10', emissive: '#ff4a10', emissiveIntensity: 0.7 });
      break;
    case 'shadow':
      body = new THREE.MeshStandardMaterial({ map, roughness: 0.5, flatShading: true });
      fin = new THREE.MeshStandardMaterial({ ...finBase, color: '#140c1e', opacity: 0.8 });
      patchMaterial(body, uniforms, { key: 'shadow', fragColor: RIM_COLOR('#9a5aff', 2.2, 1.6) });
      patchMaterial(fin, uniforms, { key: 'shadowfin', fragColor: RIM_COLOR('#9a5aff', 1.5, 1) });
      return { body, fin };
    case 'ghost':
      body = new THREE.MeshStandardMaterial({ map, transparent: true, opacity: 0.42, depthWrite: false, emissive: '#40d0c0', emissiveIntensity: 0.5, roughness: 0.3, flatShading: true });
      fin = new THREE.MeshStandardMaterial({ ...finBase, color: '#c0fff4', opacity: 0.3, depthWrite: false, emissive: '#40d0c0', emissiveIntensity: 0.5 });
      patchMaterial(body, uniforms, { key: 'ghost', fragColor: RIM_COLOR('#a0fff0', 1.8, 1.2) });
      patchMaterial(fin, uniforms, { key: 'ghostfin' });
      return { body, fin };
    case 'storm':
      body = new THREE.MeshStandardMaterial({ map, emissiveMap: canvasTex(vc.emissiveMap), emissive: '#ffffff', emissiveIntensity: 1.5, roughness: 0.4, metalness: 0.3, flatShading: true });
      fin = new THREE.MeshStandardMaterial({ ...finBase, color: '#5a5a40', emissive: '#ffe84a', emissiveIntensity: 0.4 });
      break;
    case 'crystal':
      body = new THREE.MeshPhysicalMaterial({ map, transparent: true, opacity: 0.62, roughness: 0.04, metalness: 0.05, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.6, emissive: '#3ab0d0', emissiveIntensity: 0.3, flatShading: true });
      fin = new THREE.MeshPhysicalMaterial({ ...finBase, color: '#d8ffff', opacity: 0.45, roughness: 0.05, iridescence: 1, emissive: '#3ab0d0', emissiveIntensity: 0.3 });
      break;
    case 'celadon':
      body = new THREE.MeshPhysicalMaterial({ map, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, flatShading: false });
      fin = new THREE.MeshPhysicalMaterial({ ...finBase, color: '#b8e6d0', opacity: 0.85, roughness: 0.15, clearcoat: 1 });
      break;
    case 'nebula':
      body = new THREE.MeshStandardMaterial({ map, roughness: 0.3, emissive: '#ffffff', flatShading: true });
      fin = new THREE.MeshStandardMaterial({ ...finBase, color: '#ffffff', opacity: 0.75, emissive: '#ffffff' });
      patchMaterial(body, uniforms, { key: 'nebula', fragHead: NEBULA_HEAD, fragColor: NEBULA_COLOR });
      patchMaterial(fin, uniforms, { key: 'nebulafin', fragHead: NEBULA_HEAD, fragColor: NEBULA_COLOR });
      return { body, fin };
    default:
      body = new THREE.MeshStandardMaterial({ map, roughness: 0.45, metalness: 0.12, flatShading: true });
      fin = new THREE.MeshStandardMaterial({ ...finBase, color: finColor });
  }
  patchMaterial(body, uniforms, { key: 'b' });
  patchMaterial(fin, uniforms, { key: 'f' });
  return { body, fin };
}

function rayGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0.5, 0);
  s.quadraticCurveTo(0.25, 0.55, -0.05, 0.95);
  s.quadraticCurveTo(-0.15, 0.4, -0.35, 0);
  s.quadraticCurveTo(-0.15, -0.4, -0.05, -0.95);
  s.quadraticCurveTo(0.25, -0.55, 0.5, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 1, curveSegments: 6 });
  g.translate(0, 0, -0.025);
  g.rotateX(-Math.PI / 2);
  // UV: 위에서 본 x,z로
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) + 0.5, p.getY(i) > 0 ? 0.1 : 0.5);
  return g;
}

const _fxPos = new THREE.Vector3();

// 물고기 3D 모델 생성. 반환: { group, update(dt), dispose(), length }
export function makeFish(spId, variant = null, { fx = null, wiggle = 0.05 } = {}) {
  const sp = FISH_BY_ID[spId];
  const sh = BASE[sp.look.shape] || BASE.minnow;
  const uniforms = { uTime: { value: Math.random() * 10 }, uAmp: { value: wiggle }, uMode: { value: sh.flat ? 1 : sh.ray ? 2 : 0 } };
  const { body: bodyMat, fin: finMat } = makeMaterials(sp, variant, uniforms);
  const group = new THREE.Group();
  const disposables = [bodyMat, finMat];

  const add = (geo, mat) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    group.add(m);
    disposables.push(geo);
    return m;
  };

  const darkMat = new THREE.MeshStandardMaterial({ color: '#111116', roughness: 0.2 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: '#f4f4f0', roughness: 0.3 });
  disposables.push(darkMat, whiteMat);
  patchMaterial(darkMat, uniforms, { key: 'd' });
  patchMaterial(whiteMat, uniforms, { key: 'w' });

  if (sh.ray) {
    add(rayGeometry(), bodyMat);
    const tail = new THREE.CylinderGeometry(0.004, 0.015, 0.8, 4);
    tail.rotateZ(Math.PI / 2);
    tail.translate(-0.72, 0, 0);
    add(tail, finMat);
    for (const s of [-1, 1]) {
      const horn = new THREE.ConeGeometry(0.035, 0.18, 4);
      horn.rotateZ(-Math.PI / 2);
      horn.translate(0.55, 0, s * 0.12);
      add(horn, finMat);
      const eye = new THREE.SphereGeometry(0.025, 6, 4);
      eye.translate(0.4, 0.05, s * 0.16);
      add(eye, darkMat);
    }
  } else {
    add(bodyGeometry(sh), bodyMat);
    const fins = [];
    const tg = tailGeo(sh);
    if (tg && sh.flat) tg.rotateX(Math.PI / 2);
    if (tg) fins.push(tg);
    fins.push(...dorsalGeos(sh), ...pectoralGeos(sh));
    for (const f of fins) f.deleteAttribute('uv');
    add(mergeGeometries(fins.map((f) => (f.index ? f.toNonIndexed() : f))), finMat);

    const { e, pts } = eyePositions(sh);
    const whites = [], pupils = [];
    for (const [x, y, z] of pts) {
      const w = new THREE.SphereGeometry(e, 8, 6);
      w.translate(x, y, z);
      whites.push(w);
      const p = new THREE.SphereGeometry(e * 0.62, 8, 6);
      const out = sh.flat ? [0, e * 0.5, 0] : [0, 0, Math.sign(z) * e * 0.5];
      p.translate(x + e * 0.15 + out[0], y + out[1], z + out[2]);
      pupils.push(p);
    }
    add(mergeGeometries(whites), whiteMat);
    add(mergeGeometries(pupils), darkMat);

    const extras = [];
    const headX = 0.5;
    if (sh.barbels || sh.whiskers) {
      const n = sh.whiskers ? 2 : sh.barbels;
      const len = sh.whiskers ? (sp.look.shape === 'dragon' ? 0.5 : 0.22) : 0.07;
      for (let i = 0; i < n; i++) {
        for (const s of [-1, 1]) {
          const c = new THREE.CylinderGeometry(0.004, 0.008, len, 4);
          c.translate(0, -len / 2, 0);
          c.rotateZ(-1.9 - i * 0.3);
          c.rotateX(s * 0.6);
          c.translate(headX - 0.04, -sh.H * 0.12 - i * 0.01, s * sh.W * 0.3);
          extras.push(c);
        }
      }
    }
    if (sh.horns) {
      for (const s of [-1, 1]) {
        const c = new THREE.ConeGeometry(0.018, 0.12, 5);
        c.rotateZ(1.0);
        c.translate(headX - 0.13, sh.H * 0.9, s * 0.04);
        extras.push(c);
      }
    }
    if (sh.hammer) {
      const hm = new THREE.BoxGeometry(0.08, sh.H * 0.35, sh.W * 6.4);
      hm.translate(0.46, 0.02, 0);
      extras.push(hm);
    }
    if (sh.scutes) {
      for (let i = 0; i < 9; i++) {
        const t = 0.18 + i * 0.075;
        const c = new THREE.ConeGeometry(0.018, 0.04, 4);
        c.translate(t - 0.5, topAt(t, sh) + 0.01, 0);
        extras.push(c);
      }
    }
    if (sh.mouth) {
      const m = new THREE.BoxGeometry(0.06, 0.03, sh.W * 1.3);
      m.translate(headX - 0.04, -sh.H * 0.05, 0);
      extras.push(m);
    }
    if (extras.length) add(mergeGeometries(extras.map((g) => (g.index ? g.toNonIndexed() : g))), finMat);

    if (sh.lure) {
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0.3, sh.H * 0.85, 0), new THREE.Vector3(0.5, sh.H * 1.9, 0), new THREE.Vector3(0.66, sh.H * 1.2, 0));
      add(new THREE.TubeGeometry(curve, 8, 0.008, 4), finMat);
      const bulbMat = new THREE.MeshStandardMaterial({ color: sp.look.pc, emissive: sp.look.pc, emissiveIntensity: 2.5 });
      patchMaterial(bulbMat, uniforms, { key: 'bulb' });
      disposables.push(bulbMat);
      const bulb = new THREE.SphereGeometry(0.035, 8, 6);
      bulb.translate(0.66, sh.H * 1.2, 0);
      add(bulb, bulbMat);
    }
    if (variant === 'moss') {
      const bumps = [];
      const r = mulberry32(seedOf(sp.id));
      for (let i = 0; i < 9; i++) {
        const t = 0.2 + r() * 0.6;
        const b = new THREE.IcosahedronGeometry(0.02 + r() * 0.025, 0);
        b.translate(t - 0.5, topAt(t, sh) * 0.95, (r() - 0.5) * sh.W * 0.8);
        bumps.push(b);
      }
      const mm = new THREE.MeshStandardMaterial({ color: '#4f9a35', flatShading: true });
      patchMaterial(mm, uniforms, { key: 'moss' });
      disposables.push(mm);
      add(mergeGeometries(bumps), mm);
    }
  }

  // 변이 파티클
  const vdef = variant ? VARIANT[variant] : null;
  let emitT = 0;
  const update = (dt) => {
    uniforms.uTime.value += dt;
    const t = uniforms.uTime.value;
    if (variant === 'ember') bodyMat.emissiveIntensity = 1.6 + Math.sin(t * 3) * 0.6;
    if (variant === 'storm') bodyMat.emissiveIntensity = Math.random() < 0.06 ? 4 : 1 + Math.sin(t * 20) * 0.3;
    if (variant === 'ghost') bodyMat.opacity = 0.35 + Math.sin(t * 2.3) * 0.12 + (Math.random() < 0.02 ? -0.2 : 0);
    if (!fx || !vdef || !group.visible) return;
    emitT += dt;
    const every = 0.06;
    while (emitT > every) {
      emitT -= every;
      group.getWorldPosition(_fxPos);
      const s = group.scale.x;
      const rx = (Math.random() - 0.5) * s * 0.9;
      const ry = (Math.random() - 0.5) * s * 0.25;
      const rz = (Math.random() - 0.5) * s * 0.25;
      const x = _fxPos.x + rx, y = _fxPos.y + ry, z = _fxPos.z + rz;
      const sz = Math.max(0.08, s * 0.08);
      switch (variant) {
        case 'moss': if (Math.random() < 0.3) fx.puff.spawn({ x, y, z, vy: -0.5, color: '#6aaa3a', size: sz, life: 0.8, gravity: 2 }); break;
        case 'moon': fx.glow.spawn({ x, y, z, vy: 0.3, color: '#cfe0ff', size: sz * 1.2, life: 0.9 }); break;
        case 'ember': fx.glow.spawn({ x, y, z, vx: (Math.random() - 0.5) * 0.4, vy: 1 + Math.random(), color: Math.random() < 0.5 ? '#ff7a20' : '#ffc040', size: sz, life: 1, drag: 0.5 }); break;
        case 'shadow': fx.puff.spawn({ x, y, z, vy: 0.4, color: '#1a1022', size: sz * 3, grow: 2, life: 1.2, alpha: 0.5 }); break;
        case 'ghost': if (Math.random() < 0.5) fx.glow.spawn({ x, y, z, vy: 0.6, color: '#80fff0', size: sz * 2, grow: 1, life: 1.4, alpha: 0.4 }); break;
        case 'storm': if (Math.random() < 0.6) fx.glow.spawn({ x, y, z, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4, vz: (Math.random() - 0.5) * 4, color: '#fff27a', size: sz * 0.8, life: 0.25, drag: 4 }); break;
        case 'crystal': if (Math.random() < 0.5) fx.glow.spawn({ x, y, z, color: '#e8ffff', size: sz * 1.5, life: 0.5 }); break;
        case 'celadon': if (Math.random() < 0.25) fx.glow.spawn({ x, y, z, vy: 0.2, color: '#b8f0d8', size: sz, life: 1 }); break;
        case 'nebula': fx.glow.spawn({ x, y, z, vx: (Math.random() - 0.5) * 0.5, vy: 0.3, vz: (Math.random() - 0.5) * 0.5, color: ['#c78bff', '#6a8aff', '#ff8ad8', '#ffffff'][Math.floor(Math.random() * 4)], size: sz * 1.1, life: 1.4 }); break;
      }
    }
  };

  return {
    group,
    species: sp,
    update,
    setWiggle(a) {
      uniforms.uAmp.value = a;
    },
    dispose() {
      for (const d of disposables) d.dispose?.();
      bodyMat.map?.dispose();
      bodyMat.emissiveMap?.dispose();
    },
  };
}

// 실제 길이(cm) → 화면 표시 크기(m). 손에 들 때는 과하게 크지 않게 제한
export function displayScale(lenCm, max = 2.6) {
  return Math.min(max, Math.max(0.22, lenCm / 100));
}

// ---------- 썸네일 ----------
let thumbRenderer = null, thumbScene = null, thumbCam = null;
const thumbCache = new Map();
export function fishThumb(spId, variant = null) {
  const key = spId + (variant || '');
  if (thumbCache.has(key)) return thumbCache.get(key);
  if (!thumbRenderer) {
    thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    thumbRenderer.setSize(200, 100, false);
    thumbRenderer.outputColorSpace = THREE.SRGBColorSpace;
    thumbScene = new THREE.Scene();
    thumbScene.add(new THREE.HemisphereLight('#ffffff', '#445566', 2.2));
    const d = new THREE.DirectionalLight('#ffffff', 2);
    d.position.set(1, 2, 3);
    thumbScene.add(d);
    thumbCam = new THREE.PerspectiveCamera(30, 2, 0.1, 20);
    thumbCam.position.set(0.1, 0.25, 2.1);
    thumbCam.lookAt(0, 0, 0);
  }
  const f = makeFish(spId, variant, { wiggle: 0 });
  const sh = BASE[f.species.look.shape];
  if (sh?.ray) f.group.rotation.set(0.75, Math.PI / 2 - 0.25, 0);
  else f.group.rotation.set(sh?.flat ? 1.0 : 0, 0.12, 0);
  // 화면에 꽉 차게 맞추기 (가로 1.85, 세로 0.85 안쪽)
  f.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(f.group);
  const size = box.getSize(new THREE.Vector3());
  const s = Math.min(1.85 / Math.max(size.x, 0.01), 0.85 / Math.max(size.y, 0.01), 1.6);
  f.group.scale.setScalar(s);
  const ctr = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
  f.group.position.set(-ctr.x, -ctr.y, -ctr.z);
  f.update(0.016);
  thumbScene.add(f.group);
  thumbRenderer.render(thumbScene, thumbCam);
  const url = thumbRenderer.domElement.toDataURL('image/png');
  thumbScene.remove(f.group);
  f.dispose();
  thumbCache.set(key, url);
  return url;
}
