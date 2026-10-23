// 접속 처리와 메시지 분배. 기능별 처리는 각 모듈(fishing/gather/shop/social/cooking/trade)에 있음
import { getDb, login, validName, publicProfile, markDirty } from './db.ts';
import { POI, walkHeight, PIER } from '../shared/world.ts';
import { type Session, type Handler, sessions, world, now, send, broadcast, sysChat, playerMeta, activeBuffs, sendBuffs } from './core.ts';
import { fishingHandlers, clearFishing } from './fishing.ts';
import { gatherHandlers, depletedNodes, NODES } from './gather.ts';
import { shopHandlers } from './shop.ts';
import { socialHandlers, rollWeather } from './social.ts';
import { cooking, cookingHandlers } from './cooking.ts';
import { trade, tradeHandlers } from './trade.ts';
import { farmHandlers, farmList } from './farm.ts';

const HANDLERS: Record<string, Handler> = {
  ...socialHandlers,
  ...fishingHandlers,
  ...gatherHandlers,
  ...shopHandlers,
  ...cookingHandlers,
  ...tradeHandlers,
  ...farmHandlers,
};

export function onConnection(ws) {
  let s: Session | null = null;
  const helloTimeout = setTimeout(() => !s && ws.close(), 15000);

  ws.on('message', (raw) => {
    let m;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (!m || typeof m.t !== 'string') return;
    if (!s) {
      if (m.t === 'hello') s = hello(ws, m, helloTimeout);
      return;
    }
    const h = HANDLERS[m.t];
    if (!h) return;
    try {
      h(s, m);
    } catch (e) {
      console.error('[game] handler error', m.t, e);
    }
  });
  ws.on('close', () => {
    clearTimeout(helloTimeout);
    if (s) onClose(s);
  });
  ws.on('error', () => {});
}

function hello(ws, m, helloTimeout): Session | null {
  const name = String(m.name || '').trim();
  if (!validName(name)) {
    ws.send(JSON.stringify({ t: 'loginFail', reason: '닉네임은 2~12자의 한글/영문/숫자만 가능해요.' }));
    return null;
  }
  const res = login(name, m.token, m.color);
  if (res.error) {
    ws.send(JSON.stringify({ t: 'loginFail', reason: res.error }));
    return null;
  }
  const p = res.player;
  cooking.ensure(p);
  for (const other of sessions.values()) {
    if (other.p.id === p.id) {
      send(other, 'kicked', { reason: '다른 곳에서 같은 닉네임으로 접속했어요.' });
      other.ws.close();
      onClose(other);
    }
  }
  clearTimeout(helloTimeout);
  let pos = p.pos;
  if (!pos || walkHeight(pos.x, pos.z) == null) pos = { x: POI.spawn.x, z: POI.spawn.z };
  const s: Session = { ws, p, x: pos.x, z: pos.z, y: walkHeight(pos.x, pos.z) ?? 3, ry: 0, a: 0, fs: null, buffs: [], trade: null, dirtyFish: false };
  sessions.set(p.id, s);
  send(s, 'welcome', {
    token: res.token,
    me: publicProfile(p),
    players: [...sessions.values()].filter((o) => o !== s).map(playerMeta),
    nodes: depletedNodes(),
    weather: world.weather,
    serverTime: now(),
    records: getDb().records,
    stations: cooking.list(),
    farms: farmList(),
    pos: { x: s.x, y: s.y, z: s.z },
  });
  sendBuffs(s);
  broadcast('join', { player: playerMeta(s) }, s);
  sysChat(`${p.name}님이 섬에 왔어요.`, null, 'join');
  return s;
}

function onClose(s: Session) {
  if (sessions.get(s.p.id) !== s) return;
  clearFishing(s, false);
  trade.onLeave(s);
  cooking.onLeave(s);
  sessions.delete(s.p.id);
  markDirty();
  broadcast('leave', { id: s.p.id });
  sysChat(`${s.p.name}님이 섬을 떠났어요.`, null, 'leave');
}

// 10Hz 위치·낚시 상태 스냅샷
const PHASE_CODE = { wait: 2, bite: 3, fight: 4 };
function snapshot() {
  const t = now();
  const list = [];
  for (const s of sessions.values()) {
    const fs = s.fs;
    list.push([
      s.p.id,
      Math.round(s.x * 100) / 100,
      Math.round(s.y * 100) / 100,
      Math.round(s.z * 100) / 100,
      Math.round(s.ry * 100) / 100,
      s.a,
      fs ? PHASE_CODE[fs.phase] : s.showUntil > t ? 5 : 0,
      fs ? Math.round(fs.bx * 10) / 10 : 0,
      fs ? Math.round(fs.bz * 10) / 10 : 0,
    ]);
  }
  if (list.length) broadcast('snap', { time: t, p: list });
}

export function startGame() {
  rollWeather(true);
  setInterval(snapshot, 100);
  // 버프 만료 정리 + 클라이언트 동기화
  setInterval(() => {
    for (const s of sessions.values()) {
      const sig = activeBuffs(s).map((b) => b.id + b.until).join();
      if (sig !== s.buffSig) sendBuffs(s);
    }
  }, 3000);
  console.log(`[game] 채집 노드 ${NODES.length}개, 부두 ${PIER.z0}~${PIER.z1}`);
}

export function onlineCount() {
  return sessions.size;
}
