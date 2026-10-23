// 이동 보고, 채팅, 랭킹, 날씨
import { getDb } from './db.ts';
import { WEATHERS } from '../shared/data/core.ts';
import { pickWeighted, randInt } from '../shared/rng.ts';
import { type Handler, now, world, send, broadcast, sysChat } from './core.ts';
import { onWeather } from './farm.ts';
import { boatsOnWeather } from './boats.ts';

const state: Handler = (s, m) => {
  const x = Number(m.x), z = Number(m.z), y = Number(m.y), ry = Number(m.ry);
  if (![x, y, z, ry].every(Number.isFinite)) return;
  if (Math.abs(x) > 700 || Math.abs(z) > 700) return;
  // 배에 탄 사람은 위치를 배가 정함. 바라보는 방향만 받음
  if (s.boat) {
    s.ry = ry;
    return;
  }
  const t = now();
  const dt = Math.max(0.05, (t - (s.lastState || t)) / 1000);
  s.lastState = t;
  // 순간이동 방지: 아주 큰 점프는 되돌림
  if (Math.hypot(x - s.x, z - s.z) > 14 * dt + 6) {
    send(s, 'teleport', { x: s.x, y: s.y, z: s.z });
    return;
  }
  s.x = x;
  s.y = y;
  s.z = z;
  s.ry = ry;
  s.a = m.a | 0;
  s.p.pos = { x, z };
};

const chat: Handler = (s, m) => {
  const text = String(m.text || '').trim().slice(0, 120);
  if (!text) return;
  const t = now();
  if (t - (s.lastChat || 0) < 700) return;
  s.lastChat = t;
  broadcast('chat', { from: s.p.name, color: s.p.color, text, id: s.p.id });
};

const leaderboard: Handler = (s) => {
  const players = Object.values(getDb().players);
  const top = (fn: (p: (typeof players)[number]) => number, n = 10) =>
    players.map((p) => ({ name: p.name, color: p.color, v: fn(p) })).filter((x) => x.v).sort((a, b) => b.v - a.v).slice(0, n);
  send(s, 'leaderboard', {
    earned: top((p) => p.earned),
    dex: top((p) => Object.keys(p.dex).length),
    best: players
      .filter((p) => p.stats.best)
      .map((p) => ({ name: p.name, color: p.color, fish: p.stats.best }))
      .sort((a, b) => b.fish.price - a.fish.price)
      .slice(0, 10),
    catches: top((p) => p.stats.catches),
  });
};

export const socialHandlers: Record<string, Handler> = {
  st: state,
  chat,
  leaderboard,
  ping: (s, m) => send(s, 'pong', { c: m.c, server: now() }),
};

// 4~9분마다 날씨가 바뀜
export function rollWeather(first = false) {
  const prev = world.weather.id;
  let id: string;
  do {
    id = pickWeighted(Object.entries(WEATHERS).map(([k, w]) => [k, w.weight]));
  } while (!first && id === prev && Math.random() < 0.7);
  world.weather = { id, until: now() + randInt(4, 9) * 60 * 1000 };
  broadcast('weather', { weather: world.weather });
  if (!first && id !== prev) sysChat(`날씨가 ${WEATHERS[id].name}(으)로 바뀌었어요.`, null, 'weather');
  onWeather();
  boatsOnWeather();
  setTimeout(() => rollWeather(), world.weather.until - now());
}
