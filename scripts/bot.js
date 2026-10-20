// 서버 스모크 테스트용 봇: node scripts/bot.js [port]
import WebSocket from 'ws';
const port = process.argv[2] || 3000;
const ws = new WebSocket(`ws://localhost:${port}/ws`);
const sendm = (t, d = {}) => ws.send(JSON.stringify({ t, ...d }));
let me, pos, done = false;
const log = (...a) => console.log('[bot]', ...a);
ws.on('open', () => sendm('hello', { name: 'bot' + Math.floor(Math.random() * 1000), color: '#33aa66' }));
ws.on('message', (raw) => {
  const m = JSON.parse(raw);
  if (m.t === 'snap') return;
  if (m.t === 'welcome') {
    me = m.me; pos = m.pos;
    log('welcome', me.name, 'money', me.money, 'items', JSON.stringify(me.items), 'weather', m.weather.id);
    // 캠프에서 호수쪽으로 순간이동은 막히니 상태만 보내고, 캠프 근처에서 던지기 테스트: 땅이면 실패해야 함
    sendm('cast', { x: pos.x + 3, z: pos.z, bait: 'worm_bait' });
    sendm('craft', { id: 'paste', n: 2 });
    sendm('buy', { id: 'flour', n: 2 });
  } else if (m.t === 'castFail') {
    log('castFail OK:', m.reason);
    // 걸어서 해안까지 이동 시뮬레이션 (남쪽으로)
    let z = pos.z; const x = pos.x;
    const iv = setInterval(() => {
      z += 1.0; sendm('st', { x, y: 1, z, ry: 0, a: 1 });
      if (z > 150) { clearInterval(iv); log('at shore z=', z); sendm('cast', { x, z: z + 12, bait: 'worm_bait' }); }
    }, 100);
  } else if (m.t === 'castOk') log('castOk zone', m.zone);
  else if (m.t === 'nibble') log('nibble');
  else if (m.t === 'bite') { log('bite window', m.window); setTimeout(() => sendm('hook'), 200); }
  else if (m.t === 'fight') { log('fight tier', m.tier, 'p', m.p.toFixed(2)); setTimeout(() => sendm('fightEnd', { ok: true }), 6000); }
  else if (m.t === 'caught') { log('CAUGHT', JSON.stringify(m.fish), 'new', m.isNew, 'bonus', m.bonus); sendm('dismantle', { uids: [m.fish.uid] }); }
  else if (m.t === 'dismantled') { log('dismantled ->', JSON.stringify(m.items)); sendm('leaderboard'); }
  else if (m.t === 'leaderboard') { log('leaderboard earned', JSON.stringify(m.dex)); done = true; ws.close(); }
  else if (m.t === 'me') { me = m.me; }
  else log(m.t, JSON.stringify(m).slice(0, 160));
});
ws.on('close', () => { log('closed', done ? 'OK' : 'INCOMPLETE'); process.exit(done ? 0 : 1); });
setTimeout(() => { log('timeout'); process.exit(1); }, 60000);
