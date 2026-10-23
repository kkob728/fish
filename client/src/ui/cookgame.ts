// 요리 미니게임: 도구마다 단계(타이밍 / 쓸기 / 불 조절)를 차례로 진행하고 단계별 점수(0~1)를 돌려줌
// 매 프레임 움직이는 화면이라 Preact 대신 DOM을 직접 다룸
import { h, ui } from './dom.ts';
import { ic } from './icons.ts';
import { S } from '../state.ts';
import { sfx } from '../audio.ts';
import { TOOL, TOOL_STEPS, TOOL_TOLERANCE } from '../../../shared/data/cooking.ts';

const verdict = (s) => (s >= 0.9 ? '완벽!' : s >= 0.6 ? '좋아요!' : s >= 0.3 ? '아쉬워요' : '실패…');

export function runCookGame(tool: string, tier: number): Promise<number[] | null> {
  return new Promise((resolve) => {
    const steps = TOOL_STEPS[tool];
    const tol = TOOL_TOLERANCE[tier] || 1;
    const scores = [];
    const title = h('div.cg-title');
    const hint = h('div.cg-hint');
    const area = h('div.cg-area');
    const fb = h('div.cg-fb');
    const box = h('div.cookgame.paper', h('div.cg-head', ic(tool), h('span', `${TOOL[tool].name}로 요리 중`), h('span.cg-step')), title, hint, area, fb);
    const bg = h('div.cookgame-bg', box);
    ui().append(bg);
    S.cooking = true;
    let holding = false;
    let pressCb = null;
    let raf = 0;
    let aborted = false;
    const press = (e?: any) => {
      if (e?.target?.closest?.('button')) return;
      holding = true;
      pressCb?.();
    };
    const releaseFn = () => (holding = false);
    bg.addEventListener('pointerdown', press);
    addEventListener('pointerup', releaseFn);
    const onKey = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) press();
      }
      if (e.code === 'Escape') {
        aborted = true;
        finish();
      }
    };
    const onKeyUp = (e) => e.code === 'Space' && releaseFn();
    addEventListener('keydown', onKey, true);
    addEventListener('keyup', onKeyUp);

    function finish() {
      cancelAnimationFrame(raf);
      bg.remove();
      removeEventListener('pointerup', releaseFn);
      removeEventListener('keydown', onKey, true);
      removeEventListener('keyup', onKeyUp);
      S.cooking = false;
      resolve(aborted ? null : scores);
    }

    let si = 0;
    function nextStep() {
      if (si >= steps.length) return setTimeout(finish, 500);
      const st = steps[si];
      box.querySelector('.cg-step').textContent = `${si + 1} / ${steps.length}`;
      title.textContent = st.name;
      hint.textContent = st.hint + (document.body.classList.contains('touch') ? ' (화면을 터치)' : ' (클릭 또는 Space)');
      fb.textContent = '';
      area.replaceChildren();
      const done = (score) => {
        scores.push(score);
        fb.textContent = verdict(score);
        fb.className = 'cg-fb ' + (score >= 0.6 ? 'good' : 'bad');
        score >= 0.6 ? sfx.gather() : sfx.lose();
        pressCb = null;
        cancelAnimationFrame(raf);
        si++;
        setTimeout(nextStep, 700);
      };
      if (st.type === 'timing') stepTiming(st, done);
      else if (st.type === 'sweep') stepSweep(st, done);
      else stepHold(st, done);
    }

    function bar() {
      const track = h('div.cg-track');
      area.append(track);
      return track;
    }

    function stepTiming(st, done) {
      const track = bar();
      const zoneEl = h('div.cg-zone');
      const marker = h('div.cg-marker');
      track.append(zoneEl, marker);
      const w = Math.min(0.5, st.zone * tol);
      let center = 0;
      const place = () => {
        center = w / 2 + 0.05 + Math.random() * (0.9 - w);
        zoneEl.style.left = `${(center - w / 2) * 100}%`;
        zoneEl.style.width = `${w * 100}%`;
      };
      place();
      const sub = [];
      let t = Math.random();
      let last = performance.now();
      let pos = 0;
      pressCb = () => {
        const dist = Math.abs(pos - center);
        const s = dist <= w / 2 ? 1 - (dist / (w / 2)) * 0.2 : Math.max(0, 0.8 - (dist - w / 2) / 0.2);
        sub.push(s);
        sfx.reelTick();
        fb.textContent = verdict(s);
        if (sub.length >= st.presses) done(sub.reduce((a, b) => a + b, 0) / sub.length);
        else place();
      };
      const loop = () => {
        const now = performance.now();
        t += ((now - last) / 1000) * st.speed * 0.5;
        last = now;
        pos = 1 - Math.abs(((t % 2) + 2) % 2 - 1);
        marker.style.left = `${pos * 100}%`;
        raf = requestAnimationFrame(loop);
      };
      loop();
    }

    function stepSweep(st, done) {
      const track = bar();
      track.classList.add('sweep');
      const w = Math.min(0.4, st.zone * tol);
      const zoneEl = h('div.cg-zone');
      zoneEl.style.left = `${(st.at - w / 2) * 100}%`;
      zoneEl.style.width = `${w * 100}%`;
      const marker = h('div.cg-marker');
      track.append(zoneEl, marker);
      const start = performance.now();
      let pos = 0;
      pressCb = () => {
        const dist = Math.abs(pos - st.at);
        done(dist <= w / 2 ? 1 - (dist / (w / 2)) * 0.2 : Math.max(0, 0.8 - (dist - w / 2) / 0.18));
      };
      const loop = () => {
        pos = (performance.now() - start) / 1000 / st.duration;
        marker.style.left = `${Math.min(1, pos) * 100}%`;
        if (pos >= 1.05) {
          fb.textContent = '타 버렸어요!';
          return done(0);
        }
        raf = requestAnimationFrame(loop);
      };
      loop();
    }

    function stepHold(st, done) {
      const col = h('div.cg-col');
      const band = h('div.cg-band');
      const needle = h('div.cg-needle');
      const meter = h('div.cg-meter');
      const meterFill = h('div');
      meter.append(meterFill);
      col.append(band, needle);
      area.append(h('div.cg-holdwrap', col, h('div.cg-holdinfo', h('div', '초록 구간 안에 있던 시간'), meter)));
      const bw = Math.min(0.45, st.band * tol);
      let v = 0.2, inside = 0, t = 0;
      let last = performance.now();
      pressCb = () => {};
      const loop = () => {
        const now = performance.now();
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        t += dt;
        v += (holding ? 0.85 : -0.7) * dt;
        v = Math.max(0, Math.min(1, v));
        const c = st.high ? 0.72 + 0.13 * Math.sin(t * 1.3) : 0.5 + 0.25 * Math.sin(t * 0.9);
        band.style.bottom = `${(c - bw / 2) * 100}%`;
        band.style.height = `${bw * 100}%`;
        needle.style.bottom = `${v * 100}%`;
        const ok = Math.abs(v - c) <= bw / 2;
        band.classList.toggle('on', ok);
        if (ok) inside += dt;
        meterFill.style.width = `${Math.min(1, inside / (st.duration * 0.85)) * 100}%`;
        if (t >= st.duration) return done(Math.min(1, inside / (st.duration * 0.85)));
        raf = requestAnimationFrame(loop);
      };
      loop();
    }

    nextStep();
  });
}

