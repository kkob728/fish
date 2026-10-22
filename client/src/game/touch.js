// 모바일 터치 조작: 왼쪽 엄지 = 이동 조이스틱, 오른쪽 엄지 = 시점(두 손가락 = 줌), 행동 버튼 = 낚시
import { h, ui } from '../ui/dom.js';
import { ic } from '../ui/icons.js';
import { S } from '../state.js';
import { openChat } from '../ui/hud.js';

export const IS_TOUCH = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

const ACTION_LABEL = {
  idle: ['rod', '던지기'],
  charge: ['rod', '놓으면 던짐'],
  cast: ['close', '회수'],
  wait: ['close', '회수'],
  bite: ['sparkle', '챔질!'],
  hooking: ['sparkle', '챔질!'],
  fight: ['fish', '누르고 감기'],
  landing: ['fish', '감는 중'],
  result: ['bag', '확인'],
};

export function setupTouch({ canvas, player, fishing, onInteract }) {
  if (!IS_TOUCH) return null;
  document.body.classList.add('touch');

  // 화면 꺼짐/스크롤/확대 방지
  canvas.style.touchAction = 'none';
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  const knob = h('div.knob');
  const joy = h('div.joy.passthru', knob);
  const actLabel = h('span.lbl', '던지기');
  const actIcon = h('span');
  const actBtn = h('button.act-btn.plank', actIcon, actLabel);
  const useBtn = h('button.use-btn.paper', h('span.keycap', 'E'), h('span.lbl', ''));
  const jumpBtn = h('button.jump-btn.paper', '점프');
  const chatBtn = h('button.chat-btn.paper', '채팅');
  const fullBtn = h('button.full-btn.paper', '전체화면');
  const rotateHint = h('div.rotate-hint', h('div.plank', '휴대폰을 가로로 돌려 주세요'));
  ui().append(joy, actBtn, useBtn, jumpBtn, chatBtn, fullBtn, rotateHint);
  joy.style.display = 'none';
  useBtn.style.display = 'none';

  // 행동 버튼 = 마우스 왼쪽 버튼과 같은 역할
  const down = (e) => {
    e.preventDefault();
    actBtn.classList.add('down');
    fishing.press();
  };
  const up = (e) => {
    e.preventDefault();
    actBtn.classList.remove('down');
    fishing.release();
  };
  actBtn.addEventListener('pointerdown', down);
  actBtn.addEventListener('pointerup', up);
  actBtn.addEventListener('pointercancel', up);
  actBtn.addEventListener('pointerleave', (e) => actBtn.classList.contains('down') && up(e));
  useBtn.addEventListener('click', () => onInteract());
  jumpBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    player.jump();
  });
  chatBtn.addEventListener('click', () => openChat());
  fullBtn.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        await screen.orientation?.lock?.('landscape').catch(() => {});
      } else await document.exitFullscreen();
    } catch {}
  });
  if (!document.documentElement.requestFullscreen) fullBtn.style.display = 'none';

  // 캔버스 터치: 왼쪽 = 조이스틱, 오른쪽 = 시점 회전, 두 손가락 = 줌
  const R = 56;
  let joyId = null, joyX = 0, joyY = 0;
  const look = new Map(); // id -> {x, y}
  let pinchDist = 0;

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (joyId === null && t.clientX < innerWidth * 0.42) {
        joyId = t.identifier;
        joyX = t.clientX;
        joyY = t.clientY;
        joy.style.display = '';
        joy.style.left = `${joyX}px`;
        joy.style.top = `${joyY}px`;
        knob.style.transform = 'translate(-50%, -50%)';
      } else {
        look.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    }
    if (look.size === 2) {
      const [a, b] = [...look.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        let dx = t.clientX - joyX, dy = t.clientY - joyY;
        const d = Math.hypot(dx, dy);
        if (d > R) {
          dx = (dx / d) * R;
          dy = (dy / d) * R;
        }
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        player.setStick(dx / R, dy / R);
      } else if (look.has(t.identifier)) {
        const prev = look.get(t.identifier);
        if (look.size === 1) player.rotateCamera((t.clientX - prev.x) * 1.3, (t.clientY - prev.y) * 1.3);
        look.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    }
    if (look.size === 2) {
      const [a, b] = [...look.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0) player.zoomCamera(pinchDist / d);
      pinchDist = d;
    }
  }, { passive: false });

  const end = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === joyId) {
        joyId = null;
        joy.style.display = 'none';
        player.setStick(0, 0);
      }
      look.delete(t.identifier);
    }
    if (look.size < 2) pinchDist = 0;
  };
  canvas.addEventListener('touchend', end);
  canvas.addEventListener('touchcancel', end);

  let lastSig = '';
  return {
    update({ fishingState, interact }) {
      const [icon, label] = ACTION_LABEL[fishingState] || ACTION_LABEL.idle;
      const sig = `${icon}|${label}`;
      if (sig !== lastSig) {
        lastSig = sig;
        actIcon.replaceChildren(ic(icon));
        actLabel.textContent = label;
        actBtn.classList.toggle('alert', fishingState === 'bite');
      }
      const showUse = !!interact && fishingState === 'idle' && !S.panelOpen;
      useBtn.style.display = showUse ? '' : 'none';
      if (showUse) useBtn.querySelector('.lbl').textContent = interact.label;
      // 패널이 열려 있으면 조작 버튼 숨김
      const hidden = !!S.panelOpen || S.cooking;
      actBtn.style.display = jumpBtn.style.display = hidden ? 'none' : '';
    },
  };
}
