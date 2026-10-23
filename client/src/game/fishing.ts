import * as THREE from 'three';
import { send, on } from '../net.ts';
import { S, itemCount } from '../state.ts';
import { h, ui, isTyping } from '../ui/dom.ts';
import { ic, itemIc } from '../ui/icons.ts';
import { toast } from '../ui/hud.ts';
import { showCatch } from '../ui/catchCard.ts';
import { zoneAt, ZONES } from '../../../shared/world.ts';
import { ROD, RARITIES } from '../../../shared/data/core.ts';
import { ITEMS, TACKLES } from '../../../shared/data/items.ts';
import { createFight } from '../../../shared/minigame.ts';
import { makeFish, displayScale } from '../scene/fishModel.ts';
import { sfx } from '../audio.ts';

export function makeBobber() {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e8352a', roughness: 0.4 }));
  const bot = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f6f2ea', roughness: 0.4 }));
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4), new THREE.MeshStandardMaterial({ color: '#ffe04a', emissive: '#ffb020', emissiveIntensity: 0.4 }));
  ant.position.y = 0.16;
  g.add(top, bot, ant);
  return g;
}

export function makeLine() {
  const N = 24;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#f0f0f0', transparent: true, opacity: 0.75 }));
  line.frustumCulled = false;
  line.userData.N = N;
  return line;
}

const _tip = new THREE.Vector3();
export function updateLine(line, tip, end, sag) {
  const N = line.userData.N;
  const arr = line.geometry.attributes.position.array;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    arr[i * 3] = tip.x + (end.x - tip.x) * t;
    arr[i * 3 + 1] = tip.y + (end.y - tip.y) * t - Math.sin(Math.PI * t) * sag;
    arr[i * 3 + 2] = tip.z + (end.z - tip.z) * t;
  }
  line.geometry.attributes.position.needsUpdate = true;
}

const LOST_MSG = {
  miss: '챔질이 늦었어요. 미끼만 뺏겼네요.',
  early: '너무 일찍 챔질했어요.',
  snap: '줄이 끊어졌어요!',
  escape: '물고기가 바늘을 털고 달아났어요.',
  timeout: '물고기가 지쳐서… 아니, 당신이 지쳤어요.',
  nothing: '아무것도 물지 않았어요.',
};

function fishIconSvg(color) {
  return `<svg viewBox="0 0 32 32"><path d="M4 16c4-6 12-8 18-4l5-4v16l-5-4c-6 4-14 2-18-4z" fill="${color}" stroke="#3b2614" stroke-width="2.2" stroke-linejoin="round"/><circle cx="10" cy="15" r="1.7" fill="#3b2614"/><circle cx="14" cy="12" r="1.5" fill="#fff" opacity=".7"/></svg>`;
}

export function createFishing({ scene, fx, player, canvas, camera }) {
  const bobber = makeBobber();
  const line = makeLine();
  bobber.visible = line.visible = false;
  scene.add(bobber, line);

  const marker = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.75, 24), new THREE.MeshBasicMaterial({ color: '#6ee07a', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  marker.renderOrder = 6;
  scene.add(marker);

  // ---------- DOM ----------
  const castLbl = h('div.lbl.paper');
  const castEl = h('div.cast-gauge.passthru', h('div.bar.plank', h('div.track', h('div.fill'))), castLbl);
  const castFill = castEl.querySelector('.fill');
  const biteEl = h('div.bite-bubble.passthru', h('div.b', '!'));

  const zoneEl = h('div.zone');
  const fishEl = h('div.fish');
  const progFill = h('div.f');
  const reelTag = h('div.tag.paper', '');
  const reelHint = h('div.hint', '누르면 올라가요');
  const reelEl = h(
    'div.reel.passthru',
    h('div.frame.plank', h('div.water', zoneEl, fishEl), reelTag, reelHint),
    h('div.prog.plank', h('div.t', progFill)),
  );
  // 파이팅 소모품 버튼 (1~4)
  const tackleBtns = {};
  const tackleEl = h(
    'div.tackles',
    TACKLES.map((t) => {
      const cnt = h('span.cnt', '0');
      const b = h('button.tackle.paper', { title: `${t.name}: ${t.desc}`, onclick: () => useTackle(t.id) }, itemIc(t.id), cnt, h('span.keycap.k', t.key));
      tackleBtns[t.id] = { b, cnt };
      return b;
    }),
  );
  castEl.style.display = biteEl.style.display = reelEl.style.display = tackleEl.style.display = 'none';
  ui().append(castEl, biteEl, reelEl, tackleEl);

  function refreshTackles() {
    for (const t of TACKLES) {
      const n = itemCount(t.id);
      const used = fight?.sim.state.used.includes(t.id);
      tackleBtns[t.id].cnt.textContent = String(n);
      tackleBtns[t.id].b.disabled = !n || used || !fight || fight.ended;
      tackleBtns[t.id].b.classList.toggle('used', !!used);
    }
  }
  function useTackle(id) {
    if (state !== 'fight' || !fight || fight.ended) return;
    if (fight.sim.state.used.includes(id) || !itemCount(id)) return;
    send('tackle', { id });
  }

  let state = 'idle';
  let power = 0, powerDir = 1;
  let target = null;
  const bob = new THREE.Vector3();
  let fly = null;
  let holding = false;
  let nibbleT = 0;
  let fight = null; // { sim, tier, ended, tick }
  let showFish = null;
  let showT = 0;
  let stateT = 0;
  const headPos = new THREE.Vector3();

  function setState(s) {
    state = s;
    stateT = 0;
    castEl.style.display = s === 'charge' ? '' : 'none';
    biteEl.style.display = s === 'bite' ? '' : 'none';
    reelEl.style.display = s === 'fight' ? '' : 'none';
    tackleEl.style.display = s === 'fight' ? '' : 'none';
    marker.visible = s === 'charge';
    if (s === 'idle') bobber.visible = line.visible = false;
  }

  function currentBait() {
    const id = S.me?.bait;
    return id && itemCount(id) > 0 ? id : null;
  }

  function computeTarget() {
    const rod = ROD[S.me.rod];
    const f = player.forward();
    const dist = 3 + power * (rod.range - 3);
    return { x: player.pos.x + f.x * dist, z: player.pos.z + f.z * dist };
  }

  function press() {
    if (S.panelOpen || S.cooking || isTyping()) return;
    if (state === 'idle') {
      if (S.tradeOpen) return toast('거래 중에는 낚시할 수 없어요.', 'warn');
      power = 0;
      powerDir = 1;
      setState('charge');
    } else if (state === 'wait' || state === 'cast') {
      send('cancel');
      sfx.whoosh();
      setState('idle');
    } else if (state === 'bite') {
      send('hook');
      setState('hooking');
    } else if (state === 'fight') {
      holding = true;
    } else if (state === 'result') {
      endShow();
    }
  }
  function release() {
    holding = false;
    if (state !== 'charge') return;
    target = computeTarget();
    const zone = zoneAt(target.x, target.z);
    if (!zone) {
      toast(document.body.classList.contains('touch') ? '물 쪽을 바라보고 던지세요. 화면 오른쪽을 밀어서 방향을 바꿀 수 있어요.' : '물 쪽을 바라보고 던지세요. 마우스 오른쪽 드래그로 방향을 바꿀 수 있어요.', 'warn');
      return setState('idle');
    }
    const z = ZONES[zone];
    if (ROD[S.me.rod].tier < z.minRod) {
      const need = Object.values(ROD).find((r) => r.tier === z.minRod && !r.crafted);
      toast(`${z.name}은(는) ${need.name} 이상이 필요해요.`, 'warn');
      return setState('idle');
    }
    send('cast', { x: +target.x.toFixed(2), z: +target.z.toFixed(2), bait: currentBait() });
    player.char.triggerCast();
    sfx.whoosh();
    setState('cast');
  }

  canvas.addEventListener('pointerdown', (e) => {
    // 터치는 조이스틱/시점용 — 낚시는 화면의 행동 버튼으로
    if (e.button === 0 && e.pointerType !== 'touch') press();
  });
  addEventListener('pointerup', (e) => {
    if (e.button === 0) release();
  });
  // 파이팅 중엔 스페이스로도 감을 수 있게
  addEventListener('keydown', (e) => {
    if (state !== 'fight' || isTyping()) return;
    if (e.code === 'Space') {
      holding = true;
      e.preventDefault();
    }
    const t = TACKLES.find((x) => e.code === `Digit${x.key}`);
    if (t && !e.repeat) useTackle(t.id);
  });
  addEventListener('keyup', (e) => {
    if (e.code === 'Space' && state === 'fight') holding = false;
  });

  // ---------- 서버 이벤트 ----------
  on('castOk', (m) => {
    player.char.rodTip.getWorldPosition(_tip);
    fly = { from: _tip.clone(), to: new THREE.Vector3(m.x, 0, m.z), t: 0, dur: m.land / 1000 };
    bob.copy(fly.from);
    bobber.visible = line.visible = true;
    setState('cast');
  });
  on('castFail', (m) => {
    toast(m.reason, 'warn');
    setState('idle');
  });
  on('nibble', () => {
    if (state !== 'wait') return;
    nibbleT = 0.25;
    sfx.plop();
    fx.ripple(bob.x, bob.z);
  });
  on('bite', () => {
    if (state !== 'wait' && state !== 'cast') return;
    setState('bite');
    sfx.bite();
    fx.splash(bob.x, bob.z, 0.7);
  });
  on('fight', (m) => {
    const rar = RARITIES[m.tier];
    fight = { sim: createFight(m.fp, m.mods), tier: m.tier, ended: false, tick: 0, wasIn: true };
    reelTag.textContent = m.tier >= 2 ? `${rar.name}급 손맛!` : '걸렸다!';
    reelTag.style.color = m.tier >= 2 ? rar.color : 'var(--ink)';
    fishEl.innerHTML = fishIconSvg(m.tier >= 2 ? rar.color : '#6aa0c8');
    zoneEl.style.height = `${fight.sim.state.zone * 100}%`;
    holding = false;
    setState('fight');
    refreshTackles();
    fx.splash(bob.x, bob.z, 1);
    sfx.splash(1);
  });
  on('tackleOk', (m) => {
    if (!fight || fight.ended) return;
    fight.sim.useTackle(m.id);
    sfx.craft();
    refreshTackles();
  });
  on('me', () => state === 'fight' && refreshTackles());
  on('lost', (m) => {
    if (fight) fight.ended = true;
    toast(LOST_MSG[m.reason] || '놓쳤어요.', 'warn');
    if (m.reason === 'snap') sfx.snap();
    else sfx.lose();
    setState('idle');
  });
  on('caught', (m) => {
    const rec = m.fish;
    setState('result');
    showT = 4.5;
    bobber.visible = line.visible = false;
    if (showFish) {
      player.char.holder.remove(showFish.group);
      showFish.dispose();
    }
    showFish = makeFish(rec.sp, rec.v, { fx, wiggle: 0.12 });
    showFish.group.scale.setScalar(displayScale(rec.len));
    showFish.group.rotation.y = Math.PI / 2;
    player.char.holder.add(showFish.group);
    const tier = RARITIES.findIndex((r) => r.id === showFish.species.rarity);
    player.char.root.updateMatrixWorld();
    const wp = new THREE.Vector3();
    player.char.holder.getWorldPosition(wp);
    fx.burst(wp.x, wp.y, wp.z, RARITIES[tier].color, 30 + tier * 25);
    if (rec.v) fx.sparkle(wp.x, wp.y, wp.z, '#ffffff', 60, 2);
    fx.splash(bob.x, bob.z, 1.2);
    sfx.catch(tier, !!rec.v);
    showCatch(rec, m);
  });

  function endShow() {
    if (showFish) {
      player.char.holder.remove(showFish.group);
      showFish.dispose();
      showFish = null;
    }
    setState('idle');
  }

  function updateFight(dt) {
    const f = fight;
    if (!f || f.ended) return;
    const s = f.sim.step(dt, holding);
    zoneEl.style.bottom = `${s.y * 100}%`;
    zoneEl.style.height = `${s.zone * 100}%`;
    zoneEl.classList.toggle('wide', s.t < s.wideUntil);
    fishEl.classList.toggle('slow', s.t < s.slowUntil);
    zoneEl.classList.toggle('off', !s.inZone);
    fishEl.style.bottom = `${s.fy * 100}%`;
    fishEl.style.transform = `translate(-50%, 50%) scaleX(${s.fv > 0.05 ? -1 : 1}) rotate(${Math.max(-30, Math.min(30, s.fv * -25))}deg)`;
    const p = s.progress;
    progFill.style.height = `${p * 100}%`;
    progFill.style.background = p < 0.25 ? '#d0563f' : p < 0.6 ? '#f2c14e' : '#74b84a';
    reelEl.classList.toggle('shake', !s.inZone);
    reelHint.textContent = s.inZone ? (holding ? '감는 중!' : '좋아요, 계속 덮어요') : '물고기를 놓치고 있어요!';
    if (f.wasIn !== s.inZone) {
      f.wasIn = s.inZone;
      if (!s.inZone) fx.splash(bob.x, bob.z, 0.5);
    }
    if (s.inZone) {
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = 0.08;
        sfx.reelTick();
      }
    }
    if (s.result) {
      f.ended = true;
      send('fightEnd', s.result === 'win' ? { ok: true } : { ok: false, reason: 'escape' });
      reelEl.style.display = 'none';
      if (s.result === 'win') setState('landing');
    }
  }

  return {
    press,
    release,
    get state() {
      return state;
    },
    get locked() {
      return ['fight', 'charge', 'hooking', 'landing', 'bite'].includes(state);
    },
    get anim() {
      if (state === 'charge') return 'charge';
      if (state === 'wait' || state === 'cast') return 'wait';
      if (state === 'bite' || state === 'hooking') return 'bite';
      if (state === 'fight' || state === 'landing') return 'fight';
      if (state === 'result') return 'show';
      return null;
    },
    cancelIfMoving() {
      if ((state === 'wait' || state === 'cast') && player.moving) {
        send('cancel');
        setState('idle');
      }
    },
    update(dt, t) {
      stateT += dt;
      if (state === 'charge') {
        power += powerDir * dt * 0.9;
        if (power >= 1) { power = 1; powerDir = -1; }
        if (power <= 0) { power = 0; powerDir = 1; }
        castFill.style.width = `${power * 100}%`;
        const tg = computeTarget();
        const zone = zoneAt(tg.x, tg.z);
        const okTier = zone && ROD[S.me.rod].tier >= ZONES[zone].minRod;
        marker.position.set(tg.x, 0.06, tg.z);
        marker.material.color.set(zone ? (okTier ? '#8fe05a' : '#ffb347') : '#ff5a4a');
        marker.scale.setScalar(1 + Math.sin(t * 8) * 0.08);
        const sig = `${zone}|${okTier}|${currentBait()}`;
        if (castLbl.dataset.sig !== sig) {
          castLbl.dataset.sig = sig;
          const bait = currentBait();
          castLbl.classList.toggle('bad', !zone || !okTier);
          castLbl.replaceChildren(
            ...(zone
              ? [itemIc(bait), `${ZONES[zone].name}${okTier ? '' : ' · 낚싯대 등급 부족'}`]
              : [ic('close'), '여긴 땅이에요. 물 쪽을 보세요']),
          );
        }
      }
      if (state === 'bite') {
        headPos.copy(player.pos);
        headPos.y += 3.35;
        headPos.project(camera);
        biteEl.style.left = `${(headPos.x * 0.5 + 0.5) * innerWidth}px`;
        biteEl.style.top = `${(-headPos.y * 0.5 + 0.5) * innerHeight}px`;
      }
      player.char.rodTip.getWorldPosition(_tip);
      if (fly) {
        fly.t += dt;
        const k = Math.min(1, fly.t / fly.dur);
        bob.lerpVectors(fly.from, fly.to, k);
        bob.y += Math.sin(Math.PI * k) * (3 + fly.from.distanceTo(fly.to) * 0.25);
        if (k >= 1) {
          fly = null;
          bob.set(target?.x ?? bob.x, 0, target?.z ?? bob.z);
          fx.splash(bob.x, bob.z, 0.6);
          sfx.splash(0.6);
          if (state === 'cast') setState('wait');
        }
      } else if (bobber.visible) {
        let y = Math.sin(t * 2.2) * 0.04;
        if (state === 'wait' && nibbleT > 0) {
          nibbleT -= dt;
          y -= 0.12 * Math.sin((nibbleT / 0.25) * Math.PI);
        }
        if (state === 'bite' || state === 'hooking') y = -0.3 + Math.sin(t * 40) * 0.05;
        let ox = 0, oz = 0;
        if ((state === 'fight' || state === 'landing') && fight) {
          const s = fight.sim.state;
          const amp = s.inZone ? 0.15 : 0.45;
          ox = Math.sin(t * 7) * amp;
          oz = Math.cos(t * 5.3) * amp;
          y = -0.15 + Math.sin(t * 20) * 0.05;
          if (Math.random() < dt * (s.inZone ? 3 : 10)) fx.ripple(bob.x + ox, bob.z + oz);
          if (target) {
            const k = 1 - Math.min(1, Math.max(0, s.progress));
            bob.x = player.pos.x + (target.x - player.pos.x) * (0.25 + k * 0.75);
            bob.z = player.pos.z + (target.z - player.pos.z) * (0.25 + k * 0.75);
          }
        }
        bobber.position.set(bob.x + ox, y, bob.z + oz);
      }
      if (fly) bobber.position.copy(bob);
      if (line.visible) {
        const taut = state === 'fight' || state === 'landing' || state === 'bite';
        updateLine(line, _tip, bobber.position, taut ? 0.02 : 0.25 + _tip.distanceTo(bobber.position) * 0.02);
      }
      if (state === 'fight') updateFight(dt);
      if (state === 'result') {
        showT -= dt;
        showFish?.update(dt);
        if (showT <= 0) endShow();
      }
      if (state === 'hooking' && stateT > 3) setState('idle');
      if (state === 'landing' && stateT > 4) setState('idle');
    },
  };
}
