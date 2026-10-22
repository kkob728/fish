import * as THREE from 'three';
import { clamp, lerp, mulberry32 } from '../../../shared/rng.js';

// 시간대별 하늘 키프레임: [시각, 위쪽, 지평선, 태양광 색, 밝기]
const KEYS = [
  [0, '#050a20', '#141d46', '#5a6ea8', 0.34],
  [4.6, '#0a1236', '#28305a', '#6a78b0', 0.36],
  [5.6, '#3a4f8f', '#f2a27e', '#ffb07a', 0.62],
  [7.0, '#4a8ad8', '#bfe0f8', '#fff0d6', 1.0],
  [12, '#3a86e0', '#cbe9ff', '#ffffff', 1.05],
  [16.4, '#4a88d0', '#d8e6f0', '#fff0d0', 1.0],
  [17.9, '#40508f', '#ff9a5a', '#ff9a60', 0.72],
  [19.2, '#141c48', '#3a3a6a', '#7080c0', 0.42],
  [24, '#050a20', '#141d46', '#5a6ea8', 0.34],
].map(([h, a, b, c, l]) => ({ h, top: new THREE.Color(a), hor: new THREE.Color(b), sun: new THREE.Color(c), light: l }));

const WEATHER_FX = {
  clear: { dark: 1, desat: 0, fogNear: 90, fogFar: 560, rain: 0, clouds: 0.35, cloudDark: 0 },
  cloudy: { dark: 0.86, desat: 0.35, fogNear: 70, fogFar: 420, rain: 0, clouds: 0.85, cloudDark: 0.25 },
  rain: { dark: 0.72, desat: 0.5, fogNear: 40, fogFar: 260, rain: 0.6, clouds: 1, cloudDark: 0.5 },
  fog: { dark: 0.84, desat: 0.65, fogNear: 6, fogFar: 78, rain: 0, clouds: 0.6, cloudDark: 0.2 },
  storm: { dark: 0.5, desat: 0.6, fogNear: 25, fogFar: 200, rain: 1, clouds: 1, cloudDark: 0.75 },
};

const domeVert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const domeFrag = /* glsl */ `
uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uNight; uniform float uFlash; uniform float uTime;
varying vec3 vDir;
float h3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
void main() {
  vec3 d = normalize(vDir);
  float t = clamp(d.y * 1.4 + 0.05, 0.0, 1.0);
  vec3 col = mix(uHor, uTop, pow(t, 0.7));
  if (d.y < 0.0) col = uHor * 0.9;
  float sd = dot(d, uSunDir);
  col += uSunCol * (smoothstep(0.9993, 0.9997, sd) * 2.0 + pow(max(sd, 0.0), 60.0) * 0.35) * (1.0 - uNight);
  float md = dot(d, -uSunDir);
  col += vec3(0.9, 0.93, 1.0) * smoothstep(0.9990, 0.9994, md) * uNight;
  col += vec3(0.4, 0.45, 0.6) * pow(max(md, 0.0), 40.0) * 0.25 * uNight;
  vec3 cell = floor(d * 260.0);
  float s = h3(cell);
  float tw = 0.6 + 0.4 * sin(uTime * 3.0 + s * 50.0);
  col += vec3(step(0.9975, s) * tw) * uNight * smoothstep(0.0, 0.25, d.y);
  col += vec3(0.7, 0.75, 1.0) * uFlash;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

function makeCloud(rnd) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff', flatShading: true, transparent: true, opacity: 0.92 });
  const n = 3 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(6 + rnd() * 8, 0), mat);
    m.position.set((i - n / 2) * 9 + rnd() * 4, rnd() * 3, rnd() * 8 - 4);
    m.scale.y = 0.55;
    g.add(m);
  }
  g.userData.mat = mat;
  return g;
}

export function createSky(scene, opts = {}) {
  const uniforms = {
    uTop: { value: new THREE.Color() },
    uHor: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunCol: { value: new THREE.Color() },
    uNight: { value: 0 },
    uFlash: { value: 0 },
    uTime: { value: 0 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(900, 32, 16),
    new THREE.ShaderMaterial({ uniforms, vertexShader: domeVert, fragmentShader: domeFrag, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  scene.add(dome);

  const hemi = new THREE.HemisphereLight('#cfe8ff', '#5a6a3a', 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffffff', 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(opts.shadowSize || 2048);
  const sc = sun.shadow.camera;
  sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 260;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.04;
  scene.add(sun, sun.target);

  scene.fog = new THREE.Fog('#bfe0f8', 90, 560);

  // 구름
  const rnd = mulberry32(42);
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    const c = makeCloud(rnd);
    c.position.set((rnd() - 0.5) * 800, 95 + rnd() * 50, (rnd() - 0.5) * 800);
    c.userData.speed = 2 + rnd() * 3;
    c.userData.rank = rnd();
    scene.add(c);
    clouds.push(c);
  }

  // 비
  const RAIN = 2600;
  const rainPos = new Float32Array(RAIN * 6);
  const rainSeed = new Float32Array(RAIN * 3);
  for (let i = 0; i < RAIN; i++) {
    rainSeed[i * 3] = (Math.random() - 0.5) * 90;
    rainSeed[i * 3 + 1] = Math.random() * 45;
    rainSeed[i * 3 + 2] = (Math.random() - 0.5) * 90;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: '#b8c8e0', transparent: true, opacity: 0 });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);

  const cur = { ...WEATHER_FX.clear };
  let weatherId = 'clear';
  let flash = 0;
  let nextFlash = 5;
  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3();
  const MOON_COLOR = new THREE.Color('#8fa4d8');
  const WHITE = new THREE.Color('#ffffff');
  const tmpA = new THREE.Color();
  const tmpB = new THREE.Color();
  const tmpC = new THREE.Color();
  const grey = new THREE.Color('#8a929c');

  function sample(hour) {
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].h <= hour) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const t = clamp((hour - a.h) / (b.h - a.h), 0, 1);
    tmpA.copy(a.top).lerp(b.top, t);
    tmpB.copy(a.hor).lerp(b.hor, t);
    tmpC.copy(a.sun).lerp(b.sun, t);
    return lerp(a.light, b.light, t);
  }

  return {
    sunDir,
    get flash() {
      return flash;
    },
    setWeather(id) {
      weatherId = WEATHER_FX[id] ? id : 'clear';
    },
    update(dt, time, hour, focus, camPos) {
      const target = WEATHER_FX[weatherId];
      const k = 1 - Math.exp(-dt * 0.5);
      for (const key of Object.keys(cur)) cur[key] = lerp(cur[key], target[key], k);

      let light = sample(hour);
      const ang = ((hour - 6) / 12) * Math.PI;
      sunDir.set(Math.cos(ang), Math.sin(ang), 0.35).normalize();
      const night = clamp(-sunDir.y * 4 + 0.15, 0, 1);

      // 날씨: 어둡게 + 회색으로
      light *= cur.dark;
      tmpA.lerp(grey, cur.desat * 0.7).multiplyScalar(lerp(1, cur.dark, 0.8));
      tmpB.lerp(grey, cur.desat * 0.8).multiplyScalar(lerp(1, cur.dark, 0.6));

      // 번개
      if (weatherId === 'storm') {
        nextFlash -= dt;
        if (nextFlash <= 0) {
          flash = 1;
          nextFlash = 4 + Math.random() * 9;
          opts.onThunder?.();
        }
      }
      flash = Math.max(0, flash - dt * 2.5);
      const fl = flash > 0.6 || (flash > 0.2 && flash < 0.35) ? flash : 0;

      uniforms.uTop.value.copy(tmpA);
      uniforms.uHor.value.copy(tmpB);
      uniforms.uSunDir.value.copy(sunDir);
      uniforms.uSunCol.value.copy(tmpC);
      uniforms.uNight.value = night;
      uniforms.uFlash.value = fl * 0.6;
      uniforms.uTime.value = time;
      dome.position.copy(camPos);

      // 해가 지면 달빛으로
      const isDay = sunDir.y > -0.05;
      const lightDir = isDay ? sunDir : moonDir.copy(sunDir).negate();
      sun.position.copy(focus).addScaledVector(lightDir, 120);
      sun.target.position.copy(focus);
      sun.color.copy(isDay ? tmpC : MOON_COLOR);
      sun.intensity = (isDay ? 2.4 * clamp(sunDir.y * 3 + 0.2, 0, 1) : 0.55) * cur.dark + fl * 2;
      hemi.intensity = (0.35 + light * 0.75) + fl * 1.5;
      hemi.color.copy(tmpA).lerp(WHITE, 0.45);
      hemi.groundColor.setRGB(0.25 * light, 0.27 * light, 0.18 * light);

      scene.fog.color.copy(tmpB);
      const nightFog = lerp(1, 0.7, night);
      scene.fog.near = cur.fogNear * nightFog;
      scene.fog.far = cur.fogFar * nightFog;

      // 구름
      for (const c of clouds) {
        c.position.x += c.userData.speed * dt * (1 + cur.rain);
        if (c.position.x > focus.x + 420) c.position.x -= 840;
        if (c.position.x < focus.x - 420) c.position.x += 840;
        c.visible = c.userData.rank < cur.clouds;
        const shade = lerp(1, 0.35, cur.cloudDark) * clamp(light, 0.25, 1);
        c.userData.mat.color.setRGB(shade, shade, shade * 1.03);
      }

      // 빗줄기
      rainMat.opacity = cur.rain * 0.55;
      rain.visible = cur.rain > 0.02;
      if (rain.visible) {
        const fall = time * 38;
        for (let i = 0; i < RAIN; i++) {
          const sx = rainSeed[i * 3];
          const sz = rainSeed[i * 3 + 2];
          const y = 45 - ((rainSeed[i * 3 + 1] + fall) % 45);
          const x = camPos.x + sx;
          const z = camPos.z + sz;
          const j = i * 6;
          rainPos[j] = x; rainPos[j + 1] = camPos.y - 12 + y; rainPos[j + 2] = z;
          rainPos[j + 3] = x + 0.12; rainPos[j + 4] = camPos.y - 12 + y + 1.1; rainPos[j + 5] = z;
        }
        rainGeo.attributes.position.needsUpdate = true;
      }
      return { light: clamp(light + fl, 0, 1.5), night, skyColor: tmpB, sunColor: tmpC, rain: cur.rain };
    },
  };
}
