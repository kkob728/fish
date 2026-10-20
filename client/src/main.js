import * as THREE from 'three';
import { buildTerrain } from './scene/terrain.js';
import { buildWater } from './scene/water.js';
import { createSky } from './scene/sky.js';
import { buildProps } from './scene/props.js';
import { createFx } from './scene/particles.js';
import { windUniform } from './scene/util.js';
import { createLocalPlayer } from './game/player.js';
import { createFishing } from './game/fishing.js';
import { createRemotes } from './game/remote.js';
import { connect, on, send, serverNow } from './net.js';
import { S } from './state.js';
import { h, ui, isTyping } from './ui/dom.js';
import { initHud, refreshHud, updateHud, toast, setPrompt, setHint, hudKeys, chatLine, itemsNode } from './ui/hud.js';
import { ic, itemIc } from './ui/icons.js';
import { openPanel, closePanel, refreshPanel, panelName } from './ui/panels.js';
import { closeCatch } from './ui/catchCard.js';
import { initAudio, sfx, updateAmbient } from './audio.js';
import { gameHour, phaseOf } from '../../shared/data/core.js';
import { ITEMS, RECIPE } from '../../shared/data/items.js';
import { NODE_TYPES, POI, regionNameAt, terrainHeight } from '../../shared/world.js';

// ---------- 렌더러 / 씬 ----------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
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
const sky = createSky(scene, { onThunder: () => setTimeout(() => sfx.thunder(), 300 + Math.random() * 1200) });
const props = buildProps(scene, fx);

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
  for (const [id, until] of Object.entries(m.nodes || {})) {
    const n = props.nodes.get(id);
    if (n) n.until = until;
  }
  if (!joined) {
    joined = true;
    loginEl.remove();
    player = createLocalPlayer({ scene, camera, canvas, me: m.me, start: m.pos });
    fishing = createFishing({ scene, fx, player, canvas, camera });
    initHud({ openPanel });
    if (import.meta.env.DEV) window.__game = { player, fishing, S, send, remotes, props, camera, terrainHeight, sky };
    chatLine({ sys: true, text: '물비늘 섬에 온 걸 환영해요. 처음이라면 H 키로 도움말을 펼쳐 보세요.', color: '#ffe08a' });
    toast('물가에서 왼쪽 버튼을 꾹 눌렀다 떼면 낚싯대를 던져요.', 'info', 6000, 'rod');
  } else {
    player.teleport(m.pos.x, m.pos.y, m.pos.z);
  }
  refreshHud();
});

on('me', (m) => {
  S.me = m.me;
  player?.char.setRod(m.me.rod);
  refreshHud();
  refreshPanel();
});
on('snap', (m) => remotes.snapshot(m.time, m.p, S.myId));
on('join', (m) => {
  S.players.set(m.player.id, m.player);
  remotes.add(m.player);
  refreshHud();
});
on('leave', (m) => {
  S.players.delete(m.id);
  remotes.remove(m.id);
  refreshHud();
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
  toast(itemsNode(m.items), 'ok');
  sfx.gather();
  const n = props.nodes.get(m.id);
  if (n) fx.sparkle(n.def.x, n.group.position.y + 1, n.def.z, '#fff2a0', 20, 1);
});
on('crafted', (m) => {
  toast(h('span', h('span.items', h('span', itemIc(RECIPE[m.id]?.out.id), `${RECIPE[m.id]?.out.id ? ITEMS[RECIPE[m.id].out.id].name : '낚싯대'} 완성`)), m.n > 1 ? ` (${m.n}번)` : ''), 'ok');
  sfx.craft();
});
on('sold', (m) => {
  toast(h('span.items', h('span', ic('coin'), `+${m.total.toLocaleString()}`), `${m.count}개 판매`), 'ok');
  sfx.coin();
});
on('dismantled', (m) => {
  toast(h('span', '손질해서 얻음  ', itemsNode(m.items)), 'ok', 4500, 'knife');
  sfx.craft();
});

// ---------- 상호작용 ----------
let currentInteract = null;
function findInteract() {
  const p = player.pos;
  let best = null, bd = Infinity;
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
  for (const it of props.interactables) {
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
}

addEventListener('keydown', (e) => {
  if (!player) return;
  if (e.code === 'Escape') {
    closeCatch();
    if (panelName()) closePanel();
    document.activeElement?.blur?.();
    return;
  }
  if (hudKeys(e)) return;
  if (isTyping() || e.repeat) return;
  const map = { KeyI: 'bag', KeyC: 'craft', KeyK: 'dex', KeyL: 'rank', KeyH: 'help' };
  if (map[e.code]) return openPanel(map[e.code]);
  if (S.panelOpen) return;
  if (e.code === 'KeyE') interact();
  if (e.code === 'KeyT') {
    const r = remotes.nearest(player.pos, 20);
    if (r) send('tradeReq', { to: r.meta.id });
    else toast('20m 안에 다른 낚시꾼이 없어요. Tab으로 접속자 목록을 볼 수 있어요.', 'warn');
  }
});

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

  if (player) {
    fishing.cancelIfMoving();
    player.update(dt, { locked: fishing.locked, faceCam: fishing.state === 'charge', anim: fishing.anim });
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

  const env = sky.update(dt, t, hour, focus, camera.position);
  water.uniforms.uTime.value = t;
  water.uniforms.uSunDir.value.copy(sky.sunDir);
  water.uniforms.uSunColor.value.copy(sunCol.copy(env.sunColor).multiplyScalar(1 - env.night * 0.85));
  water.uniforms.uSkyColor.value.copy(env.skyColor);
  water.uniforms.uLight.value = Math.max(0.28, env.light);
  windUniform.value = t * (1 + env.rain);
  props.update(dt, t, { night: env.night, phase }, now);
  fx.update(dt);

  if (player) {
    regionT -= dt;
    if (regionT <= 0) {
      regionT = 0.5;
      regionName = regionNameAt(player.pos.x, player.pos.z);
      S.nearShop = Math.hypot(player.pos.x - POI.shop.x, player.pos.z - POI.shop.z) < 8.5;
      if (panelName() === 'shop' && !S.nearShop) closePanel();
    }
    currentInteract = S.panelOpen ? null : findInteract();
    setPrompt(currentInteract && fishing.state === 'idle' ? currentInteract.label : '');
    setHint(fishing.state === 'wait' ? '찌가 쑥 들어가면 클릭!' : '');
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
