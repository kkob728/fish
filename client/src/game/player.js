import * as THREE from 'three';
import { buildCharacter } from '../scene/character.js';
import { walkHeight, terrainHeight, POI } from '../../../shared/world.js';
import { send } from '../net.js';
import { isTyping } from '../ui/dom.js';

const COLLIDERS = [
  { x: POI.shop.x, z: POI.shop.z, r: 3.3 },
  { x: POI.workbench.x, z: POI.workbench.z, r: 1.4 },
  { x: POI.board.x, z: POI.board.z, r: 1.0 },
  { x: POI.camp.x, z: POI.camp.z, r: 1.2 },
  { x: POI.camp.x + 7, z: POI.camp.z + 9, r: 0.35 },
];

export function createLocalPlayer({ scene, camera, canvas, me, start }) {
  const char = buildCharacter(me.color, { name: me.name, nameColor: '#ffe9a8' });
  char.setRod(me.rod);
  scene.add(char.root);
  const pos = new THREE.Vector3(start.x, start.y, start.z);
  let vy = 0;
  let yaw = 0;
  let camYaw = Math.PI * 0.15;
  let camPitch = 0.38;
  let camDist = 9;
  let camCur = null;
  let pitchCur = null;
  const camTarget = pos.clone();
  const keys = new Set();
  let dragging = false;
  let lastX = 0, lastY = 0;
  let sendT = 0;
  let animState = 'idle';
  let moving = false;

  addEventListener('keydown', (e) => {
    if (isTyping()) return;
    keys.add(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 2 || e.button === 1) {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    camYaw -= (e.clientX - lastX) * 0.006;
    camPitch = Math.min(1.35, Math.max(-0.1, camPitch + (e.clientY - lastY) * 0.005));
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener('pointerup', (e) => {
    if (e.button === 2 || e.button === 1) dragging = false;
  });
  canvas.addEventListener('wheel', (e) => {
    camDist = Math.min(26, Math.max(3.5, camDist * (1 + Math.sign(e.deltaY) * 0.1)));
  }, { passive: true });

  function collide(x, z) {
    for (const c of COLLIDERS) {
      const dx = x - c.x, dz = z - c.z;
      const d = Math.hypot(dx, dz);
      if (d < c.r + 0.35) {
        const k = (c.r + 0.35) / (d || 1);
        x = c.x + dx * k;
        z = c.z + dz * k;
      }
    }
    return [x, z];
  }

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();

  return {
    char,
    pos,
    get yaw() {
      return yaw;
    },
    get camYaw() {
      return camYaw;
    },
    get moving() {
      return moving;
    },
    forward() {
      return new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw));
    },
    teleport(x, y, z) {
      pos.set(x, y, z);
      vy = 0;
    },
    setAnim(s) {
      animState = s;
    },
    // locked: 파이팅 중엔 이동 불가, faceCam: 캐스팅 충전 중엔 카메라 방향을 봄
    update(dt, { locked = false, faceCam = false, anim = null } = {}) {
      forward.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
      right.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
      move.set(0, 0, 0);
      if (!locked && !isTyping()) {
        if (keys.has('KeyW') || keys.has('ArrowUp')) move.add(forward);
        if (keys.has('KeyS') || keys.has('ArrowDown')) move.sub(forward);
        if (keys.has('KeyD') || keys.has('ArrowRight')) move.add(right);
        if (keys.has('KeyA') || keys.has('ArrowLeft')) move.sub(right);
      }
      moving = move.lengthSq() > 0;
      const run = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const ground0 = walkHeight(pos.x, pos.z) ?? pos.y;
      const inWater = ground0 < -0.1 && terrainHeight(pos.x, pos.z) < -0.1 && pos.y < 0.2;
      const speed = (run ? 9 : 5.2) * (inWater ? 0.55 : 1);
      if (moving) {
        move.normalize().multiplyScalar(speed * dt);
        let nx = pos.x + move.x, nz = pos.z + move.z;
        [nx, nz] = collide(nx, nz);
        if (walkHeight(nx, nz) != null) {
          pos.x = nx;
          pos.z = nz;
        } else if (walkHeight(nx, pos.z) != null) pos.x = nx;
        else if (walkHeight(pos.x, nz) != null) pos.z = nz;
        const targetYaw = Math.atan2(move.x, move.z);
        let d = targetYaw - yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        yaw += d * Math.min(1, dt * 14);
      }
      if (faceCam) {
        const targetYaw = Math.atan2(forward.x, forward.z);
        let d = targetYaw - yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        yaw += d * Math.min(1, dt * 16);
      }
      const ground = walkHeight(pos.x, pos.z) ?? pos.y;
      const grounded = pos.y <= ground + 0.02;
      if (grounded && keys.has('Space') && !locked && !isTyping()) vy = 6.5;
      vy -= 22 * dt;
      pos.y += vy * dt;
      if (pos.y <= ground) {
        pos.y = ground;
        vy = 0;
      }

      char.root.position.copy(pos);
      char.root.rotation.y = yaw;
      const st = anim || (moving ? (run ? 'run' : 'walk') : 'idle');
      char.animate(st, dt);
      animState = st;

      // 카메라
      camTarget.lerp(new THREE.Vector3(pos.x, pos.y + 1.6, pos.z), 1 - Math.exp(-dt * 10));
      // 지형에 가리면 먼저 카메라를 위로 올리고, 그래도 가리면 앞으로 당김
      const clearDist = (pitch) => {
        const cp = Math.cos(pitch);
        const ox = Math.sin(camYaw) * cp, oy = Math.sin(pitch), oz = Math.cos(camYaw) * cp;
        for (let i = 1; i <= 10; i++) {
          const d = (camDist * i) / 10;
          if (terrainHeight(camTarget.x + ox * d, camTarget.z + oz * d) + 0.5 > camTarget.y + oy * d) return (camDist * (i - 1)) / 10;
        }
        return camDist;
      };
      let pitch = camPitch;
      let dist = clearDist(pitch);
      while (dist < camDist && pitch < 1.25) {
        pitch += 0.12;
        dist = clearDist(pitch);
      }
      if (dist < camDist) {
        pitch = camPitch;
        dist = Math.max(1.6, clearDist(camPitch));
      }
      const k = Math.min(1, dt * 5);
      camCur = camCur == null ? dist : dist < camCur ? dist : camCur + (dist - camCur) * k;
      pitchCur = pitchCur == null ? pitch : pitchCur + (pitch - pitchCur) * k;
      const cp = Math.cos(pitchCur);
      camera.position.set(
        camTarget.x + Math.sin(camYaw) * cp * camCur,
        camTarget.y + Math.sin(pitchCur) * camCur,
        camTarget.z + Math.cos(camYaw) * cp * camCur,
      );
      const minY = Math.max(terrainHeight(camera.position.x, camera.position.z), 0) + 0.6;
      if (camera.position.y < minY) camera.position.y = minY;
      camera.lookAt(camTarget);

      sendT -= dt;
      if (sendT <= 0) {
        sendT = 0.1;
        const a = { idle: 0, walk: 1, run: 2, charge: 3 }[st] ?? 0;
        send('st', { x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2), ry: +yaw.toFixed(2), a: grounded ? a : 4 });
      }
    },
  };
}
