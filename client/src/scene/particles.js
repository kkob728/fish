import * as THREE from 'three';

const vert = /* glsl */ `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
uniform float uScale;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const frag = /* glsl */ `
varying float vAlpha;
varying vec3 vColor;
uniform float uSoft;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = mix(1.0 - smoothstep(0.35, 0.5, d), 1.0 - smoothstep(0.0, 0.5, d), uSoft);
  gl_FragColor = vec4(vColor, a * vAlpha);
  #include <colorspace_fragment>
}`;

// 파티클 하나하나를 CPU에서 굴리는 단순한 시스템 (수백~수천 개 수준)
export class Particles {
  constructor(capacity = 500, { additive = false, soft = 1 } = {}) {
    this.cap = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.grav = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);
    this.baseSize = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.alpha0 = new Float32Array(capacity);
    this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 300 }, uSoft: { value: soft } },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.geo = g;
  }
  setScale(px) {
    this.mat.uniforms.uScale.value = px;
  }
  // o: {x,y,z, vx,vy,vz, color:THREE.Color|hex, size, life, gravity, grow, drag}
  spawn(o) {
    const i = this.next;
    this.next = (this.next + 1) % this.cap;
    const k = i * 3;
    this.pos[k] = o.x; this.pos[k + 1] = o.y; this.pos[k + 2] = o.z;
    this.vel[k] = o.vx || 0; this.vel[k + 1] = o.vy || 0; this.vel[k + 2] = o.vz || 0;
    const c = o.color instanceof THREE.Color ? o.color : new THREE.Color(o.color ?? '#ffffff');
    this.col[k] = c.r; this.col[k + 1] = c.g; this.col[k + 2] = c.b;
    this.baseSize[i] = o.size ?? 1;
    this.size[i] = this.baseSize[i];
    this.life[i] = this.maxLife[i] = o.life ?? 1;
    this.grav[i] = o.gravity ?? 0;
    this.grow[i] = o.grow ?? 0;
    this.drag[i] = o.drag ?? 0;
    this.alpha[i] = o.alpha ?? 1;
    this.alpha0[i] = o.alpha ?? 1;
  }
  update(dt) {
    const a0 = this.alpha0;
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const k = i * 3;
      const dr = 1 - this.drag[i] * dt;
      this.vel[k] *= dr; this.vel[k + 2] *= dr;
      this.vel[k + 1] = this.vel[k + 1] * dr - this.grav[i] * dt;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      this.size[i] = this.baseSize[i] * (1 + this.grow[i] * t);
      this.alpha[i] = a0[i] * Math.min(1, (1 - t) * 3) * Math.min(1, t * 8 + 0.2);
    }
    const at = this.geo.attributes;
    at.position.needsUpdate = true;
    at.aSize.needsUpdate = true;
    at.aAlpha.needsUpdate = true;
    at.aColor.needsUpdate = true;
  }
}

export function createFx(scene) {
  const glow = new Particles(1800, { additive: true, soft: 1 });
  const puff = new Particles(900, { additive: false, soft: 1 });
  scene.add(glow.points, puff.points);
  const rnd = (a) => (Math.random() - 0.5) * a;
  return {
    glow,
    puff,
    setScale(px) {
      glow.setScale(px);
      puff.setScale(px);
    },
    update(dt) {
      glow.update(dt);
      puff.update(dt);
    },
    splash(x, z, strength = 1) {
      for (let i = 0; i < 18 * strength; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1 + Math.random() * 2.5 * strength;
        puff.spawn({ x, y: 0.1, z, vx: Math.cos(a) * sp, vy: 3 + Math.random() * 3 * strength, vz: Math.sin(a) * sp, color: '#e8f6ff', size: 0.25 + Math.random() * 0.2, life: 0.7, gravity: 12, alpha: 0.9 });
      }
      for (let i = 0; i < 6; i++) puff.spawn({ x: x + rnd(0.6), y: 0.05, z: z + rnd(0.6), color: '#ffffff', size: 0.6, grow: 2.5, life: 0.8, alpha: 0.5 });
    },
    ripple(x, z) {
      puff.spawn({ x, y: 0.05, z, color: '#ffffff', size: 0.5, grow: 3, life: 0.7, alpha: 0.35 });
    },
    sparkle(x, y, z, color = '#fff6b0', n = 30, spread = 1.2) {
      for (let i = 0; i < n; i++) {
        glow.spawn({ x: x + rnd(spread), y: y + rnd(spread), z: z + rnd(spread), vx: rnd(2), vy: 1 + Math.random() * 2, vz: rnd(2), color, size: 0.25 + Math.random() * 0.3, life: 0.8 + Math.random() * 0.8, gravity: 1.5, drag: 1 });
      }
    },
    burst(x, y, z, color, n = 60) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const b = Math.random() * Math.PI - Math.PI / 2;
        const sp = 3 + Math.random() * 5;
        glow.spawn({ x, y, z, vx: Math.cos(a) * Math.cos(b) * sp, vy: Math.sin(b) * sp + 2, vz: Math.sin(a) * Math.cos(b) * sp, color, size: 0.3 + Math.random() * 0.35, life: 1 + Math.random(), gravity: 3, drag: 1.5 });
      }
    },
  };
}
