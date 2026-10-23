// WebSocket 연결 + 서버 시각 동기화 + 이벤트 버스
const listeners = new Map();

type Handler = (m: any) => void;
const _typed: Map<string, Set<Handler>> = listeners as any;
export function on(type: string, fn: Handler) {
  if (!listeners.has(type)) listeners.set(type, new Set());
  listeners.get(type).add(fn);
  return () => listeners.get(type).delete(fn);
}
export function emit(type: string, data?: any) {
  const set = listeners.get(type);
  if (set) for (const fn of set) fn(data);
}

let ws = null;
let clockOffset = 0;
let pingTimer = null;
let wantOpen = false;
let helloPayload = null;

export function serverNow() {
  return Date.now() + clockOffset;
}

export function send(t, data = {}) {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify({ t, ...data }));
}

function wsUrl() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/ws`;
}

export function connect(hello) {
  helloPayload = hello;
  wantOpen = true;
  open();
}

// 백그라운드 탭에선 타이머가 늦어지므로 화면 복귀/네트워크 복구 때도 바로 재연결
function reconnectNow() {
  if (wantOpen && (!ws || ws.readyState === WebSocket.CLOSED)) open();
}
document.addEventListener('visibilitychange', () => !document.hidden && reconnectNow());
addEventListener('focus', reconnectNow);
addEventListener('online', reconnectNow);

function open() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  ws = new WebSocket(wsUrl());
  ws.onopen = () => {
    emit('net:open');
    send('hello', helloPayload);
    clearInterval(pingTimer);
    pingTimer = setInterval(() => send('ping', { c: Date.now() }), 10000);
  };
  ws.onmessage = (ev) => {
    let m;
    try {
      m = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (m.t === 'welcome') clockOffset = m.serverTime - Date.now();
    if (m.t === 'pong') {
      const rtt = Date.now() - m.c;
      clockOffset = m.server + rtt / 2 - Date.now();
    }
    if (m.t === 'welcome' && m.token) helloPayload = { ...helloPayload, token: m.token };
    if (m.t === 'kicked' || m.t === 'loginFail') wantOpen = false;
    emit(m.t, m);
  };
  ws.onclose = () => {
    clearInterval(pingTimer);
    emit('net:close');
    if (wantOpen) setTimeout(open, 2000);
  };
}
