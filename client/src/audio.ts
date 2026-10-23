// WebAudio로 합성하는 효과음 — 에셋 파일 없음
let ctx = null;
let master = null;
let muted = false;
let ambient = null;

try {
  muted = localStorage.getItem('fish.muted') === '1';
} catch {}

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.55;
  master.connect(ctx.destination);
  startAmbient();
}

export function isMuted() {
  return muted;
}
export function toggleMute() {
  muted = !muted;
  try {
    localStorage.setItem('fish.muted', muted ? '1' : '0');
  } catch {}
  if (master) master.gain.value = muted ? 0 : 0.55;
  return muted;
}

let noiseBuf = null;
function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  return s;
}

function env(node, t, a, peak, d) {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(freq, { type = 'sine', dur = 0.2, vol = 0.3, at = 0, slide = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  env(g, t, 0.01, vol, dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function burst({ dur = 0.3, vol = 0.4, freq = 1200, q = 0.7, type = 'lowpass', at = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const n = noise();
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, t, 0.005, vol, dur);
  n.connect(f).connect(g).connect(master);
  n.start(t, Math.random());
  n.stop(t + dur + 0.05);
}

export const sfx = {
  click: () => tone(880, { type: 'triangle', dur: 0.06, vol: 0.12 }),
  open: () => { tone(520, { type: 'triangle', dur: 0.08, vol: 0.12 }); tone(780, { type: 'triangle', dur: 0.1, vol: 0.1, at: 0.05 }); },
  whoosh: () => burst({ dur: 0.35, vol: 0.25, freq: 900, type: 'bandpass', q: 0.8 }),
  splash: (s = 1) => { burst({ dur: 0.25 * s, vol: 0.35 * s, freq: 1400 }); burst({ dur: 0.5, vol: 0.15 * s, freq: 500, at: 0.04 }); },
  plop: () => tone(420, { dur: 0.12, vol: 0.22, slide: -260 }),
  bite: () => { tone(300, { dur: 0.15, vol: 0.35, slide: -200 }); burst({ dur: 0.2, vol: 0.3, freq: 1000 }); tone(1320, { type: 'square', dur: 0.08, vol: 0.08, at: 0.05 }); },
  reelTick: () => burst({ dur: 0.03, vol: 0.08, freq: 3500, type: 'highpass' }),
  snap: () => { tone(900, { type: 'sawtooth', dur: 0.25, vol: 0.2, slide: -700 }); burst({ dur: 0.1, vol: 0.3, freq: 4000, type: 'highpass' }); },
  lose: () => { tone(400, { type: 'triangle', dur: 0.2, vol: 0.18 }); tone(300, { type: 'triangle', dur: 0.3, vol: 0.18, at: 0.15 }); },
  gather: () => { tone(660, { type: 'triangle', dur: 0.08, vol: 0.14 }); tone(990, { type: 'triangle', dur: 0.12, vol: 0.12, at: 0.06 }); },
  coin: () => { tone(988, { type: 'square', dur: 0.07, vol: 0.07 }); tone(1319, { type: 'square', dur: 0.2, vol: 0.07, at: 0.07 }); },
  craft: () => { burst({ dur: 0.08, vol: 0.2, freq: 2500, type: 'bandpass' }); tone(700, { type: 'triangle', dur: 0.15, vol: 0.12, at: 0.08 }); },
  buff: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'sine', dur: 0.4, vol: 0.12, at: i * 0.06 })),
  chat: () => tone(1200, { type: 'sine', dur: 0.05, vol: 0.05 }),
  thunder: () => { burst({ dur: 2.2, vol: 0.5, freq: 160 }); burst({ dur: 1.2, vol: 0.3, freq: 90, at: 0.3 }); },
  catch: (tier = 0, variant = false) => {
    const scales = [[523, 659, 784], [523, 659, 784, 1047], [587, 740, 880, 1175], [523, 659, 784, 988, 1319], [440, 554, 659, 880, 1109, 1319], [392, 523, 659, 784, 1047, 1319, 1568]];
    const notes = scales[Math.min(tier, 5)];
    notes.forEach((f, i) => tone(f, { type: tier >= 3 ? 'triangle' : 'sine', dur: 0.35, vol: 0.16, at: i * 0.08 }));
    if (variant) [1568, 1976, 2349, 2637].forEach((f, i) => tone(f, { type: 'sine', dur: 0.5, vol: 0.06, at: 0.4 + i * 0.07 }));
  },
};

// 바다 소리 + 비 소리
function startAmbient() {
  const n = noise();
  n.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 420;
  const g = ctx.createGain();
  g.gain.value = 0.05;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.12;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.035;
  lfo.connect(lfoGain).connect(g.gain);
  n.connect(f).connect(g).connect(master);
  n.start();
  lfo.start();

  const r = noise();
  r.loop = true;
  const rf = ctx.createBiquadFilter();
  rf.type = 'highpass';
  rf.frequency.value = 1500;
  const rg = ctx.createGain();
  rg.gain.value = 0;
  r.connect(rf).connect(rg).connect(master);
  r.start();
  ambient = { wave: g, rain: rg, nextChirp: 0 };
}

// 매 프레임: 비 세기와 낮/밤에 따라 배경음 조절, 새/귀뚜라미 소리
export function updateAmbient(dt, { rain = 0, night = 0, nearWater = 0.5 }) {
  if (!ambient || muted) return;
  ambient.rain.gain.value = rain * 0.12;
  ambient.wave.gain.value = 0.02 + nearWater * 0.06;
  ambient.nextChirp -= dt;
  if (ambient.nextChirp <= 0 && rain < 0.3) {
    ambient.nextChirp = 1.5 + Math.random() * 4;
    if (night > 0.5) {
      for (let i = 0; i < 3; i++) tone(4200 + Math.random() * 200, { type: 'sine', dur: 0.04, vol: 0.02, at: i * 0.07 });
    } else {
      const base = 2200 + Math.random() * 1200;
      tone(base, { type: 'sine', dur: 0.12, vol: 0.025, slide: 600 });
      tone(base * 1.2, { type: 'sine', dur: 0.1, vol: 0.02, at: 0.15, slide: -400 });
    }
  }
}
