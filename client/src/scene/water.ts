import * as THREE from 'three';
import { WORLD_SIZE } from '../../../shared/world.ts';
import { buildWaterData, SEA_TEX_WORLD } from './terrain.ts';

const vertex = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal2;
#include <fog_pars_vertex>
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  float a = wp.x * 0.15 + uTime * 1.1;
  float b = wp.z * 0.21 + uTime * 0.9;
  float c = (wp.x + wp.z) * 0.35 + uTime * 1.7;
  wp.y += sin(a) * 0.06 + sin(b) * 0.05 + sin(c) * 0.025;
  float dx = cos(a) * 0.009 + cos(c) * 0.00875;
  float dz = cos(b) * 0.0105 + cos(c) * 0.00875;
  vNormal2 = normalize(vec3(-dx * 4.0, 1.0, -dz * 4.0));
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const fragment = /* glsl */ `
uniform sampler2D uMap;
uniform sampler2D uMapFar;
uniform float uWorld;
uniform float uWorldFar;
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform float uLight;
varying vec3 vWorld;
varying vec3 vNormal2;
#include <fog_pars_fragment>

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main() {
  vec2 uv = vWorld.xz / uWorld + 0.5;
  vec4 t = texture2D(uMap, clamp(uv, 0.0, 1.0));
  // 섬 지도 바깥은 먼 바다 지도, 그것도 벗어나면 깊은 바다
  float near = 1.0 - step(1.0, max(abs(uv.x - 0.5), abs(uv.y - 0.5)) * 2.0);
  vec2 uvf = vWorld.xz / uWorldFar + 0.5;
  vec4 tf = texture2D(uMapFar, clamp(uvf, 0.0, 1.0));
  float outside = step(1.0, max(abs(uvf.x - 0.5), abs(uvf.y - 0.5)) * 2.0);
  t = mix(mix(tf, vec4(0.04, 0.17, 0.44, 1.0), outside), t, near);
  float depth = t.a * 10.0;
  vec3 deepCol = t.rgb;

  vec2 q = vWorld.xz * 0.55;
  float n1 = noise(q + uTime * 0.45) - 0.5;
  float n2 = noise(q * 1.7 - uTime * 0.35) - 0.5;
  vec3 N = normalize(vNormal2 + vec3(n1, 0.0, n2) * 0.22);
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);

  vec3 shallow = mix(vec3(0.5, 0.88, 0.84), deepCol, 0.35);
  float dt = smoothstep(0.0, 3.5, depth);
  vec3 col = mix(shallow, deepCol, dt);
  col = mix(col, uSkyColor, fres * 0.5);
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 140.0);
  col *= uLight;
  col += uSunColor * spec * 1.4;

  float edge = 0.35 + 0.15 * sin(uTime * 1.5 + vWorld.x * 0.3 + vWorld.z * 0.2);
  float foam = (1.0 - smoothstep(0.0, edge, depth)) * step(0.42, noise(vWorld.xz * 2.2 + uTime * 0.6));
  foam *= 1.0 - outside;
  col = mix(col, vec3(0.95) * max(uLight, 0.35), foam * 0.85);
  float alpha = max(mix(0.5, 0.92, dt), foam);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

export function buildWater() {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uMap: { value: null },
      uWorld: { value: WORLD_SIZE },
      uMapFar: { value: null },
      uWorldFar: { value: SEA_TEX_WORLD },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: new THREE.Color('#ffffff') },
      uSkyColor: { value: new THREE.Color('#9fd0ff') },
      uLight: { value: 1 },
    },
  ]);
  uniforms.uMap.value = buildWaterData();
  uniforms.uMapFar.value = buildWaterData(192, SEA_TEX_WORLD);
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vertex, fragmentShader: fragment, transparent: true, fog: true });
  // 카메라를 따라다니는 물 (먼 바다까지 끝없이 보이게)
  const geo = new THREE.PlaneGeometry(1200, 1200, 220, 220);
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 1;
  mesh.name = 'water';
  return { mesh, uniforms };
}
