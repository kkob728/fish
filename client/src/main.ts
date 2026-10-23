import * as THREE from 'three';
import { buildTerrain } from './scene/terrain.ts';
import { buildWater } from './scene/water.ts';
import { createSky } from './scene/sky.ts';
import { buildProps } from './scene/props.ts';
import { createFx } from './scene/particles.ts';
import { windUniform } from './scene/util.ts';
import { createLocalPlayer } from './game/player.ts';
import { createFishing } from './game/fishing.ts';
import { createRemotes } from './game/remote.ts';
import { connect, on, send, serverNow } from './net.ts';
import { S } from './state.ts';
import { h, ui, isTyping } from './ui/dom.ts';
import { U, bump, refreshHud, updateHud, toast, setPrompt, setHint, hudKeys, chatLine, openPanel, closePanel, panelName, closeCatch } from './ui/store.tsx';
import { mountUi } from './ui/App.tsx';
import { initAudio, sfx, updateAmbient } from './audio.ts';
import { setupTouch, IS_TOUCH } from './game/touch.ts';
import { createStations } from './game/stations.ts';
import { createFarms } from './game/farms.ts';
import { createBoats } from './game/boats.ts';
import { buildSea } from './scene/sea.ts';
import { DOCK } from '../../shared/sea.ts';
import { PLOT_COUNT, nearPlot } from '../../shared/data/crops.ts';
import { gameHour, phaseOf } from '../../shared/data/core.ts';
import { NODE_TYPES, POI, PIER, regionNameAt, terrainHeight, walkHeight } from '../../shared/world.ts';

// ---------- 렌더러 / 씬 ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, IS_TOUCH ? 1.25 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1500);
const fx = createFx(scene);
scene.add(buildTerrain());
const water = buildWater();
scene.add(water.mesh);
const sky = createSky(scene, { shadowSize: IS_TOUCH ? 1024 : 2048, onThunder: () => setTimeout(() => sfx.thunder(), 300 + Math.random() * 1200) });
const props = buildProps(scene, fx, { lite: IS_TOUCH });
const stations = createStations(scene, fx);
const farms = createFarms(scene, fx);
const sea = buildSea(scene);
const boats = createBoats({ scene, fx });

function resize() {
  const w = innerWidth, hh = innerHeight;
  renderer.setSize(w, hh, false);
  camera.aspect = w / hh;
  camera.updateProjectionMatrix();
  fx.setScale((hh * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360)));
}
addEventListener('resize', resize);
resize();

let player = null;
let touch = null;
let fishing = null;
const remotes = createRemotes({ scene, fx });

// ---------- 로그인 ----------
const COLORS = ['#e86a4a', '#f2a93b', '#ffd84a', '#6ec26a', '#3fb8c8', '#4a7ae8', '#9a6ae8', '#e86ab4'];
function loadTokens() {
  try {
    return JSON.parse(localStorage.getItem('fish.tokens') || '{}');
  } catch {
    return {};
  }
}
function saveToken(name, token) {
  try {
    const t = loadTokens();
    t[name.toLowerCase()] = token;
    localStorage.setItem('fish.tokens', JSON.stringify(t));
    localStorage.setItem('fish.name', name);
  } catch {}
}

let chosenColor = COLORS[Math.floor(Math.random() * COLORS.length)];
try {
  chosenColor = localStorage.getItem('fish.color') || chosenColor;
} catch {}
const nameIn = h('input', { maxLength: 12, placeholder: '2~12자', value: (() => { try { return localStorage.getItem('fish.name') || ''; } catch { return ''; } })() });
const errEl = h('div.err', '');
const goBtn = h('button.primary.go', '섬으로 가기');
const swatches = h(
  'div.swatches',
  COLORS.map((c) => h('div.swatch' + (c === chosenColor ? '.on' : ''), {
    style: { background: c },
    onclick: (e) => {
      chosenColor = c;
      [...swatches.children].forEach((s) => s.classList.remove('on'));
      e.target.classList.add('on');
    },
  })),
);
const loginEl = h(
  'div.login',
  h('div.login-sign.plank', h('h1', '물비늘 섬'), ['a', 'b', 'c', 'd'].map((k) => h('span.nail.' + k))),
  h(
    'div.login-card.paper',
    h('div.sub', '같이 낚싯대를 드리우는 작은 섬'),
    h('label', '이름'),
    nameIn,
    h('label', '모자 색'),
    swatches,
    goBtn,
    errEl,
    h('div.hint', '이름은 이 브라우저에 기억돼요. 다음에도 같은 이름으로 들어오면 이어서 할 수 있어요.'),
  ),
);
ui().append(loginEl);
nameIn.focus();
mountUi();

let joined = false;
function doLogin() {
  const name = nameIn.value.trim();
  if (!/^[\p{L}\p{N}_]{2,12}$/u.test(name)) {
    errEl.textContent = '이름은 2~12자의 한글, 영문, 숫자만 쓸 수 있어요.';
    return;
  }
  errEl.textContent = '배를 타고 가는 중…';
  goBtn.disabled = true;
  try {
    localStorage.setItem('fish.color', chosenColor);
  } catch {}
  initAudio();
  connect({ name, token: loadTokens()[name.toLowerCase()] || null, color: chosenColor });
}
goBtn.addEventListener('click', doLogin);
nameIn.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') doLogin();
});

let connOverlay = null;
function showConn(text) {
  if (!connOverlay) {
    connOverlay = h('div.conn', h('div.plank', text));
    ui().append(connOverlay);
  } else connOverlay.firstChild.textContent = text;
}
function hideConn() {
  connOverlay?.remove();
  connOverlay = null;
}

// ---------- 서버 메시지 ----------
on('loginFail', (m) => {
  errEl.textContent = m.reason;
  goBtn.disabled = false;
});
let kicked = false;
on('kicked', (m) => {
  kicked = true;
  showConn(`${m.reason} (새로고침하면 다시 접속해요)`);
});
on('net:close', () => {
  if (kicked) return;
  if (joined) showConn('연결이 끊겼어요. 다시 연결하는 중…');
  else {
    errEl.textContent = '서버에 연결할 수 없어요. 서버가 켜져 있는지 확인하세요.';
    goBtn.disabled = false;
  }
});

on('welcome', (m) => {
  hideConn();
  saveToken(m.me.name, m.token);
  S.me = m.me;
  S.myId = m.me.id;
  S.records = m.records || {};
  S.weather = m.weather;
  sky.setWeather(m.weather.id);
  for (const r of [...remotes.list.keys()]) remotes.remove(r);
  S.players.clear();
  for (const p of m.players) {
    S.players.set(p.id, p);
    remotes.add(p);
  }
  stations.reset(m.stations);
  farms.reset(m.farms);
  boats.reset(m.boats);
  S.ride = null;
  for (const [id, until] of Object.entries(m.nodes || {})) {
    const n = props.nodes.get(id);
    if (n) n.until = until;
  }
  if (!joined) {
    joined = true;
    loginEl.remove();
    player = createLocalPlayer({ scene, camera, canvas, me: m.me, start: m.pos });
    fishing = createFishing({ scene, fx, player, canvas, camera });
    touch = setupTouch({ canvas, player, fishing, onInteract: interact });
    // 배 위에서는 점프 버튼이 닻 (손님은 아무 일 없음)
    player.setJumpHook(() => (S.ride ? (fishing.state === 'idle' && boats.toggleAnchor(), true) : false));
    U.toggleStation = toggleStation;
    U.ready = true;
    if (import.meta.env.DEV) window.__game = { player, fishing, S, send, remotes, props, camera, terrainHeight, sky };
    chatLine({ sys: true, text: IS_TOUCH ? '물비늘 섬에 온 걸 환영해요. 처음이라면 오른쪽 위 ? 버튼으로 도움말을 펼쳐 보세요.' : '물비늘 섬에 온 걸 환영해요. 처음이라면 H 키로 도움말을 펼쳐 보세요.', color: '#ffe08a' });
    toast(IS_TOUCH ? '물을 보고 던지기 버튼을 꾹 눌렀다 떼면 낚싯대를 던져요.' : '물가에서 왼쪽 버튼을 꾹 눌렀다 떼면 낚싯대를 던져요.', 'info', 6000, 'rod');
  } else {
    player.teleport(m.pos.x, m.pos.y, m.pos.z);
  }
  refreshHud();
});

on('me', (m) => {
  S.me = m.me;
  player?.char.setRod(m.me.rod);
});
on('snap', (m) => remotes.snapshot(m.time, m.p, S.myId));
on('join', (m) => {
  S.players.set(m.player.id, m.player);
  remotes.add(m.player);
});
on('leave', (m) => {
  S.players.delete(m.id);
  remotes.remove(m.id);
});
on('meta', (m) => {
  if (m.player.id === S.myId) return;
  S.players.set(m.player.id, m.player);
  remotes.meta(m.player);
});
on('catchShow', (m) => remotes.showCatch(m.id, m.fish));
on('weather', (m) => {
  S.weather = m.weather;
  sky.setWeather(m.weather.id);
});
on('buffs', (m) => {
  S.buffs = m.list;
});
on('node', (m) => {
  const n = props.nodes.get(m.id);
  if (n) n.until = m.until;
});
on('records', (m) => Object.assign(S.records, m.records));
on('teleport', (m) => player?.teleport(m.x, m.y, m.z));

on('gathered', (m) => {
  const n = props.nodes.get(m.id);
  if (n) fx.sparkle(n.def.x, n.group.position.y + 1, n.def.z, '#fff2a0', 20, 1);
});
// ---------- 상호작용 ----------
let currentInteract = null;
// 배에서 내릴 수 있는 땅이 가까이 있는지 (0.3초마다 계산)
let landT = 0, canLand = false;
function landNear(x, z) {
  for (let r = 1.5; r <= 9; r += 1.5)
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      const h = walkHeight(x + Math.cos(a) * r, z + Math.sin(a) * r);
      if (h != null && h > -0.3) return true;
    }
  return false;
}

function findInteract() {
  const p = player.pos;
  let best = null, bd = Infinity;
  // 배에 타고 있으면 내리기만
  if (S.ride) {
    if (!canLand) return null;
    const atDock = Math.hypot(p.x - DOCK.x, p.z - DOCK.z) < 30;
    return { kind: 'leave', label: S.ride.seat !== 0 ? '배에서 내리기' : atDock ? '배 거두고 내리기' : '배 묶어 두고 내리기' };
  }
  // 부두 끝: 내 배 띄우기 / 가까운 배 타기
  const near = boats.nearest(p.x, p.z, 6);
  if (near) {
    const used = near.seats.filter(Boolean).length;
    return { kind: 'board', owner: near.owner, label: near.owner === S.myId ? `내 배 ${near.name} 타기` : `${near.name} 타기 (${used}/${near.seats.length})` };
  }
  if (S.me.boat && Math.abs(p.x - PIER.x) < 4 && Math.abs(p.z - DOCK.z) < 9) return { kind: 'launch', label: S.boats.has(S.myId) ? `${S.me.boat.name} 부두로 불러와 띄우기` : `${S.me.boat.name} 띄우기` };
  const now = serverNow();
  const phase = phaseOf(gameHour(now));
  for (const n of props.nodes.values()) {
    if (n.until > now) continue;
    const t = NODE_TYPES[n.def.type];
    if (t.nightOnly && phase !== 'night') continue;
    const d = Math.hypot(n.def.x - p.x, n.def.z - p.z);
    if (d < 3.2 && d < bd) {
      bd = d;
      best = { kind: 'node', id: n.def.id, label: `${t.name} ${t.verb}` };
    }
  }
  for (const st of S.stations.values()) {
    const d = Math.hypot(st.x - p.x, st.z - p.z);
    if (d < 3.6 && d < bd) {
      bd = d;
      best = st.owner === S.myId ? { kind: 'cook', label: '요리하기' } : { kind: 'stall', owner: st.owner, label: `${st.name}님의 진열대 보기` };
    }
  }
  // 텃밭: 내 밭이면 돌보기, 밭이 없으면 빈 밭 빌리기
  if (!best) {
    for (let i = 0; i < PLOT_COUNT; i++) {
      if (!nearPlot(i, p.x, p.z, 1.2)) continue;
      const f = S.farms.get(i);
      if (f && f.owner === S.myId) best = { kind: 'farm', label: '텃밭 돌보기' };
      else if (!f && !S.me.farm) best = { kind: 'claim', plot: i, label: '빈 텃밭 빌리기' };
      if (best) bd = 2.5;
      break;
    }
  }
  for (const it of [...props.interactables, ...sea.interactables]) {
    const d = Math.hypot(it.x - p.x, it.z - p.z);
    if (d < it.r && d < bd) {
      bd = d;
      best = it;
    }
  }
  return best;
}

function interact() {
  const it = currentInteract;
  if (!it) return;
  if (it.kind === 'node') send('gather', { id: it.id });
  else if (it.kind === 'shop') openPanel('shop');
  else if (it.kind === 'craft') openPanel('craft');
  else if (it.kind === 'board') openPanel('rank');
  else if (it.kind === 'cook') openPanel('cook');
  else if (it.kind === 'stall') openPanel('stall', false, it.owner);
  else if (it.kind === 'farm') openPanel('farm');
  else if (it.kind === 'claim') send('farmClaim', { plot: it.plot });
  else if (it.kind === 'shipyard') openPanel('shipyard');
  else if (it.kind === 'launch') send('boatLaunch');
  else if (it.kind === 'board') send('boatBoard', { owner: it.owner });
  else if (it.kind === 'leave') send('boatLeave');
}

addEventListener('keydown', (e) => {
  if (!player) return;
  if (e.code === 'Escape') {
    closeCatch();
    if (panelName()) closePanel();
    (document.activeElement as HTMLElement | null)?.blur?.();
    return;
  }
  if (hudKeys(e)) return;
  if (isTyping() || e.repeat) return;
  if (e.code === 'Space' && S.ride && fishing.state === 'idle' && !S.panelOpen) {
    e.preventDefault();
    boats.toggleAnchor();
    return;
  }
  const map = { KeyI: 'bag', KeyC: 'craft', KeyK: 'dex', KeyL: 'rank', KeyH: 'help' };
  if (map[e.code]) return openPanel(map[e.code]);
  if (S.panelOpen) return;
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyG') toggleStation();
  if (e.code === 'KeyT') {
    const r = remotes.nearest(player.pos, 20);
    if (r) send('tradeReq', { to: r.meta.id });
    else toast('20m 안에 다른 낚시꾼이 없어요. Tab으로 접속자 목록을 볼 수 있어요.', 'warn');
  }
});

// 조리대 깔기/거두기: 내 조리대가 가까우면 거두고, 아니면 바라보는 방향 앞에 깜
function toggleStation() {
  if (!player || fishing.state !== 'idle') return;
  if (S.ride) return toast('배 위에서는 조리대를 깔 수 없어요.', 'warn');
  const mine = S.stations.get(S.myId);
  if (mine && Math.hypot(mine.x - player.pos.x, mine.z - player.pos.z) < 8) {
    send('pickStation');
    toast('조리대를 거뒀어요.', 'info', 2500, 'station');
    return;
  }
  const yaw = player.yaw;
  send('placeStation', { x: +(player.pos.x + Math.sin(yaw) * 2.4).toFixed(2), z: +(player.pos.z + Math.cos(yaw) * 2.4).toFixed(2), ry: +(yaw + Math.PI).toFixed(3) });
}

// ---------- 루프 ----------
const clock = new THREE.Clock();
let t = 0;
const focus = new THREE.Vector3();
const sunCol = new THREE.Color();
let regionT = 0, regionName = '';

let lastFrameAt = 0;
let rafId = 0;
function frame() {
  lastFrameAt = performance.now();
  const dt = Math.min(0.05, clock.getDelta());
  t += dt;
  const now = serverNow();
  const hour = gameHour(now + (window.__timeShift || 0));
  const phase = phaseOf(hour);

  const driving = player && S.ride?.seat === 0 && !S.panelOpen && fishing.state === 'idle';
  boats.update(dt, driving ? player.moveInput() : { x: 0, y: 0 });
  if (player) {
    fishing.cancelIfMoving();
    player.update(dt, { locked: fishing.locked, faceCam: fishing.state === 'charge', anim: fishing.anim, ride: boats.ridePose() });
    fishing.update(dt, t);
    focus.copy(player.pos);
  } else {
    // 로그인 화면: 캠프 주변을 천천히 도는 카메라
    const a = t * 0.05;
    camera.position.set(POI.camp.x + Math.cos(a) * 70, 38, POI.camp.z + Math.sin(a) * 70);
    camera.lookAt(POI.camp.x, 2, POI.camp.z - 20);
    focus.set(POI.camp.x, 0, POI.camp.z);
  }
  remotes.update(dt, t);
  stations.update(dt);
  farms.update(dt);

  const env = sky.update(dt, t, hour, focus, camera.position);
  water.uniforms.uTime.value = t;
  const cell = 1200 / 220;
  water.mesh.position.set(Math.round(camera.position.x / cell) * cell, 0, Math.round(camera.position.z / cell) * cell);
  water.uniforms.uSunDir.value.copy(sky.sunDir);
  water.uniforms.uSunColor.value.copy(sunCol.copy(env.sunColor).multiplyScalar(1 - env.night * 0.85));
  water.uniforms.uSkyColor.value.copy(env.skyColor);
  water.uniforms.uLight.value = Math.max(0.28, env.light);
  windUniform.value = t * (1 + env.rain);
  props.update(dt, t, { night: env.night, phase }, now);
  sea.update(dt, t, { night: env.night });
  fx.update(dt);

  if (player) {
    regionT -= dt;
    if (regionT <= 0) {
      regionT = 0.5;
      regionName = regionNameAt(player.pos.x, player.pos.z);
      const near = Math.hypot(player.pos.x - POI.shop.x, player.pos.z - POI.shop.z) < 8.5;
      if (near !== S.nearShop) {
        S.nearShop = near;
        bump();
      }
      if (panelName() === 'shop' && !S.nearShop) closePanel();
      canLand = !!S.ride && landNear(player.pos.x, player.pos.z);
    }
    currentInteract = S.panelOpen ? null : findInteract();
    touch?.update({ fishingState: fishing.state, interact: currentInteract });
    setPrompt(currentInteract && fishing.state === 'idle' ? currentInteract.label : '');
    const ri = S.rideInfo;
    setHint(
      fishing.state === 'wait'
        ? '찌가 쑥 들어가면 클릭!'
        : ri && fishing.state === 'idle'
          ? ri.captain
            ? ri.anchored
              ? 'Space 닻 올리기 · 지금은 낚시할 수 있어요'
              : 'W/S 속도 · A/D 방향 · Space 닻 내리기'
            : ri.anchored
              ? '닻을 내렸어요. 낚시할 수 있어요'
              : '배가 움직이는 중이에요'
          : '',
    );
    updateHud(regionName);
    const nearWater = terrainHeight(player.pos.x, player.pos.z) < 1.8 ? 1 : 0.3;
    updateAmbient(dt, { rain: env.rain, night: env.night, nearWater });
  }

  renderer.render(scene, camera);
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(frame);
}
frame();
// 개발용: 화면이 가려져 rAF가 멈춰도 루프가 돌도록 (자동 테스트용)
if (import.meta.env.DEV) setInterval(() => performance.now() - lastFrameAt > 50 && frame(), 20);
