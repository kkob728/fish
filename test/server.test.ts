// 서버 통합 테스트: 가짜 소켓 두 개로 접속 → 낚시 → 도구 → 요리 → 진열 판매 → 거래 → 저장/불러오기
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'fish-test-'));
process.env.DATA_DIR = DATA;
delete process.env.DATABASE_URL;

const db = await import('../server/db.ts');
const { onConnection } = await import('../server/game.ts');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const realNow = Date.now;
let timeShift = 0;
Date.now = () => realNow() + timeShift; // 최소 소요 시간 검증을 빨리 넘기기 위함

type Sock = EventEmitter & { log: any[]; msg: (t: string, d?: object) => void; last: (t: string) => any; wait: (t: string, ms?: number) => Promise<any> };
function connect(name: string, token: string | null = null): Sock {
  const ws = new EventEmitter() as Sock & { readyState: number; send: (s: string) => void; close: () => void };
  ws.readyState = 1;
  ws.log = [];
  ws.send = (s) => {
    const m = JSON.parse(s);
    if (m.t !== 'snap') ws.log.push(m);
  };
  ws.close = () => {};
  onConnection(ws as any);
  ws.msg = (t, d = {}) => ws.emit('message', Buffer.from(JSON.stringify({ t, ...d })));
  ws.last = (t) => ws.log.filter((m) => m.t === t).pop();
  // 종류별로 아직 안 읽은 다음 메시지를 순서대로 돌려줌
  const cursor: Record<string, number> = {};
  ws.wait = async (t, ms = 20000) => {
    for (let i = 0; i < ms / 20; i++) {
      const list = ws.log.filter((m) => m.t === t);
      const at = cursor[t] ?? 0;
      if (list.length > at) {
        cursor[t] = list.length;
        return list[list.length - 1];
      }
      await sleep(20);
    }
    throw new Error(`${name}: ${t} 를 기다리다 시간 초과`);
  };
  ws.msg('hello', { name, token, color: '#336699' });
  return ws;
}
const player = (name: string) => Object.values(db.getDb().players).find((p) => p.name === name);

let A: Sock, B: Sock;
before(async () => {
  await db.loadDb();
});

test('접속: 새 닉네임 생성, 토큰으로만 재접속, 위치 복원', async () => {
  A = connect('테스트A');
  const w = await A.wait('welcome');
  assert.ok(w.token && w.me.money > 0);
  const p = player('테스트A');
  p.pos = { x: 15, z: 154 }; // 남쪽 해변
  p.items.chum = 10;
  p.items.landing_net = 2;
  p.items.shrimp = 4;
  A.emit('close');
  const thief = connect('테스트A');
  assert.equal((await thief.wait('loginFail')).t, 'loginFail');
  A = connect('테스트A', w.token);
  const w2 = await A.wait('welcome');
  assert.equal(Math.round(w2.pos.z), 154);
});

async function catchOne(sock: Sock, { tackle = null as string | null } = {}) {
  const realRandom = Math.random;
  Math.random = () => 0.01; // 입질 대기 최소, 가짜 입질 없음
  sock.msg('cast', { x: 15, z: 166, bait: 'chum' });
  assert.ok(await sock.wait('castOk'));
  await sock.wait('bite');
  Math.random = realRandom;
  sock.msg('hook');
  const fight = await sock.wait('fight');
  assert.ok(fight.mods.tension >= 100 && fight.mods.reel >= 1);
  if (tackle) {
    sock.msg('tackle', { id: tackle });
    await sock.wait('tackleOk');
    sock.msg('tackle', { id: tackle }); // 두 번째는 거절
    await sock.wait('toast');
  }
  timeShift += 120000;
  sock.msg('fightEnd', { ok: true });
  return sock.wait('caught');
}

test('낚시: 캐스팅 → 입질 → 챔질 → 파이팅 → 획득, 경험치와 도감', async () => {
  const c = await catchOne(A);
  const p = player('테스트A');
  assert.equal(p.fish.length, 1);
  assert.ok(p.xp > 0 && p.dex[c.fish.sp].n === 1);
  assert.ok(c.isNew && c.bonus > 0);
});

test('파이팅 도구: 쓰면 줄어들고 한 번만 쓸 수 있음', async () => {
  await catchOne(A, { tackle: 'landing_net' });
  assert.equal(player('테스트A').items.landing_net, 1);
});

test('땅에 던지면 실패', async () => {
  A.msg('cast', { x: 15, z: 148, bait: 'chum' });
  const f = await A.wait('castFail');
  assert.ok(f.reason);
});

test('요리: 조리대 깔기 → 너무 빠르면 거절 → 요리 완성 → 먹기', async () => {
  A.msg('placeStation', { x: 15, z: 151, ry: 0 });
  await A.wait('station');
  const fish = player('테스트A').fish[0];
  A.msg('cookStart', { tool: 'grill', ings: [{ kind: 'fish', uid: fish.uid }] });
  let go = await A.wait('cookGo');
  A.msg('cookFinish', { cid: go.cid, scores: [1, 1] });
  assert.match((await A.wait('toast')).text, /빨리/);
  assert.ok(player('테스트A').fish.some((f) => f.uid === fish.uid), '거절되면 재료를 돌려받음');
  A.msg('cookStart', { tool: 'grill', ings: [{ kind: 'fish', uid: fish.uid }] });
  go = await A.wait('cookGo');
  timeShift += 60000;
  A.msg('cookFinish', { cid: go.cid, scores: [0.95, 0.9] });
  const cooked = await A.wait('cooked');
  assert.equal(cooked.dish.rid, 'grilled');
  assert.ok(cooked.dish.stars >= 3 && cooked.dish.value > fish.price);
  A.msg('eatDish', { uid: cooked.dish.uid });
  const buffs = await A.wait('buffs');
  assert.ok(buffs.list.some((b) => b.id === 'food'));
});

test('진열 판매: 다른 플레이어가 사면 돈이 옮겨감', async () => {
  A.msg('cookStart', { tool: 'grill', ings: [{ kind: 'item', id: 'shrimp' }, { kind: 'item', id: 'shrimp' }] });
  const go = await A.wait('cookGo');
  timeShift += 60000;
  A.msg('cookFinish', { cid: go.cid, scores: [0.6, 0.6] });
  const dish = (await A.wait('cooked')).dish;
  assert.equal(dish.rid, 'clamgrill');
  A.msg('displayDish', { uid: dish.uid, price: 77 });
  await A.wait('station');

  B = connect('테스트B');
  await B.wait('welcome');
  const pb = player('테스트B');
  pb.pos = { x: 17, z: 152 };
  pb.money = 500;
  B.emit('close');
  B = connect('테스트B', B.last('welcome').token);
  const wb = await B.wait('welcome');
  assert.ok(wb.stations.some((s) => s.display.length === 1), '접속하면 다른 사람 진열대가 보임');
  const before = { a: player('테스트A').money, b: player('테스트B').money };
  B.msg('buyDisplay', { owner: player('테스트A').id, uid: dish.uid });
  await B.wait('toast');
  assert.equal(player('테스트B').money, before.b - 77);
  assert.equal(player('테스트A').money, before.a + 77);
  assert.ok(player('테스트B').dishes.some((d) => d.uid === dish.uid));
});

test('거래: 양쪽 준비 → 양쪽 확정하면 한 번에 교환', async () => {
  A.msg('tradeReq', { to: player('테스트B').id });
  const req = await B.wait('tradeReq');
  B.msg('tradeRespond', { from: req.from, accept: true });
  await A.wait('tradeState');
  A.msg('tradeOffer', { items: { chum: 3 }, fish: [], dishes: [], money: 0 });
  B.msg('tradeOffer', { items: {}, fish: [], dishes: [], money: 10 });
  await sleep(20);
  A.msg('tradeLock', { lock: true });
  B.msg('tradeLock', { lock: true });
  A.msg('tradeConfirm');
  B.msg('tradeConfirm');
  await A.wait('tradeDone');
  assert.equal(player('테스트B').items.chum, 3);
});

test('텃밭: 빌리기 → 심기 → 물 주기 → 거두기, 마른 땅은 느림, 비가 오면 물기, 넓히기', async () => {
  const core = await import('../server/core.ts');
  const farm = await import('../server/farm.ts');
  const { plotCenter, growthAt } = await import('../shared/data/crops.ts');
  const p = player('테스트A');
  const sess = core.sessions.get(p.id);
  // 멀리서는 못 빌림
  sess.x = 0;
  sess.z = 0;
  A.msg('farmClaim', { plot: 0 });
  assert.match((await A.wait('toast')).text, /가까이/);
  const c = plotCenter(0);
  sess.x = c.x;
  sess.z = c.z;
  A.msg('farmClaim', { plot: 0 });
  const f0 = await A.wait('farm');
  assert.equal(f0.farm.plot, 0);
  assert.equal(p.farm.size, 6);
  // 다른 사람은 같은 밭을 못 빌림
  const sb = core.sessions.get(player('테스트B').id);
  sb.x = c.x;
  sb.z = c.z;
  B.msg('farmClaim', { plot: 0 });
  assert.match((await B.wait('toast')).text, /주인/);

  // 씨앗 없이 심기 → 거절, 씨앗이 있으면 빈 칸에 하나씩
  A.msg('farmPlant', { crop: 'radish' });
  assert.match((await A.wait('toast')).text, /씨앗/);
  p.items.seed_radish = 4;
  p.items.seed_watermelon = 2;
  A.msg('farmPlant', { crop: 'radish' });
  assert.equal((await A.wait('farmDone')).n, 4);
  assert.equal(p.items.seed_radish || 0, 0);
  A.msg('farmPlant', { crop: 'watermelon', tiles: [5] });
  await A.wait('farmDone');
  assert.equal(p.farm.tiles[5].c, 'watermelon');

  // 무에만 물 주기 → 15분 뒤 무는 다 자라고, 마른 수박은 40% 속도
  A.msg('farmWater', { tiles: [0, 1, 2, 4] });
  await A.wait('farmDone');
  const t0 = Date.now();
  timeShift += 16 * 60000;
  assert.equal(growthAt(p.farm.tiles[0], Date.now()), 1);
  const wm = growthAt(p.farm.tiles[5], Date.now());
  assert.ok(Math.abs(wm - (16 * 0.4) / 70) < 0.01, `마른 수박 ${wm}`);
  A.msg('farmHarvest');
  const h = await A.wait('farmDone');
  assert.ok(h.items.g_radish >= 8 && h.items.g_radish <= 12);
  assert.ok(p.farm.tiles[5], '덜 자란 수박은 남음');
  assert.equal(p.farm.tiles[0], null);

  // 비가 오면 접속 여부와 상관없이 물기가 생김
  core.world.weather = { id: 'rain', until: Date.now() + 5 * 60000 };
  farm.onWeather();
  assert.ok(p.farm.tiles[5].wet > Date.now());
  core.world.weather = { id: 'clear', until: Date.now() + 60000 };
  assert.ok(Date.now() - t0 > 0);

  // 넓히기: 돈이 들고 칸이 늘어남
  p.money = 5000;
  A.msg('farmExpand');
  await A.wait('farm');
  assert.equal(p.farm.size, 9);
  assert.equal(p.money, 5000 - 1200);
  p.items.seed_radish = 10;
  A.msg('farmPlant', { crop: 'radish' });
  assert.equal((await A.wait('farmDone')).n, 8, '9칸 중 수박 1칸 빼고');
});

test('배: 조선소에서 사고 꾸미기 → 부두에서 띄우기 → 함께 타기 → 구역 제한 → 닻 내리고 낚시 → 내리기', async () => {
  const core = await import('../server/core.ts');
  const { boats } = await import('../server/boats.ts');
  const { SHIPYARD, DOCK, SEA } = await import('../shared/sea.ts');
  const pa = player('테스트A');
  const sa = core.sessions.get(pa.id);
  const sb = core.sessions.get(player('테스트B').id);
  const at = (s, x, z) => {
    s.x = x;
    s.z = z;
  };
  // 조선소에서 사기
  at(sa, 0, 0);
  A.msg('buyBoat', { tier: 1 });
  assert.match((await A.wait('toast')).text, /조선소/);
  at(sa, SHIPYARD.x, SHIPYARD.z);
  pa.money = 5000;
  A.msg('buyBoat', { tier: 1 });
  await A.wait('toast');
  assert.equal(pa.boat.tier, 1);
  assert.equal(pa.money, 2000);
  A.msg('boatStyle', { color: '#3a7ab8', name: '물비늘호' });
  await A.wait('toast');
  assert.equal(pa.boat.name, '물비늘호');

  // 부두 끝에서 띄우기, B가 함께 탐
  A.msg('boatLaunch');
  assert.match((await A.wait('toast')).text, /부두 끝/);
  at(sa, DOCK.x - 4, DOCK.z);
  A.msg('boatLaunch');
  assert.equal((await A.wait('ride')).owner, pa.id);
  at(sb, DOCK.x - 4, DOCK.z + 1);
  B.msg('boatBoard', { owner: pa.id });
  assert.equal((await B.wait('ride')).seat, 1);
  const boat = boats.get(pa.id);
  assert.deepEqual(boat.seats, [pa.id, player('테스트B').id]);

  // 순간이동은 되돌림, 정상 이동은 받아들이고 손님 위치도 따라감
  A.msg('boatSt', { x: DOCK.x, z: DOCK.z + 200, ry: 0, v: 6 });
  await A.wait('boatFix');
  timeShift += 1000;
  A.msg('boatSt', { x: DOCK.x, z: DOCK.z + 5, ry: 0, v: 6 });
  await sleep(20);
  assert.equal(boat.z, DOCK.z + 5);
  assert.ok(Math.abs(sb.z - boat.z) < 2);

  // 나룻배는 먼바다로 못 나감
  boat.x = 0;
  boat.z = SEA.near - 2;
  timeShift += 1000;
  A.msg('boatSt', { x: 0, z: SEA.near + 3, ry: 0, v: 6 });
  await A.wait('boatFix');

  // 산호초 한가운데로 옮겨서: 움직이는 중엔 못 던지고, 닻을 내리면 됨
  boat.x = SEA.reef.x - 30;
  boat.z = SEA.reef.z - 30;
  timeShift += 1000;
  A.msg('boatSt', { x: boat.x + 2, z: boat.z, ry: 0, v: 2 });
  await sleep(20);
  B.msg('cast', { x: sb.x + 6, z: sb.z, bait: null });
  assert.match((await B.wait('castFail')).reason, /닻/);
  A.msg('boatAnchor', { on: true });
  await A.wait('boat');
  B.msg('cast', { x: sb.x + 6, z: sb.z, bait: null });
  assert.equal((await B.wait('castOk')).zone, 'reef');
  // 닻을 올리면 손님 낚시는 끝남
  A.msg('boatAnchor', { on: false });
  assert.equal((await B.wait('lost')).reason, 'boat');

  // 바다 한가운데서는 못 내림, 부두 옆에서 선장이 내리면 모두 내리고 배는 사라짐
  A.msg('boatLeave');
  assert.match((await A.wait('toast')).text, /육지/);
  // 작은 섬 옆에서 선장이 내리면 배는 닻을 내린 채 남고, 다시 타면 선장 자리로
  const { ISLETS } = await import('../shared/sea.ts');
  const isl = ISLETS[0];
  boat.x = isl.x;
  boat.z = isl.z - isl.r - 7;
  boat.anchored = false;
  timeShift += 1000;
  A.msg('boatSt', { x: boat.x, z: boat.z + 0.5, ry: 0, v: 0 });
  await sleep(20);
  A.msg('boatLeave');
  await A.wait('teleport');
  assert.equal(sa.boat, null);
  assert.ok(boats.has(pa.id) && boat.anchored);
  assert.equal(sb.boat, pa.id, '손님은 그대로 탐');
  A.msg('boatBoard', { owner: pa.id });
  assert.equal((await A.wait('ride')).seat, 0);
  boat.x = DOCK.x;
  boat.z = DOCK.z;
  timeShift += 1000;
  A.msg('boatSt', { x: DOCK.x, z: DOCK.z + 0.5, ry: 0, v: 0 });
  await sleep(20);
  A.msg('boatLeave');
  await A.wait('boatGone');
  assert.equal(boats.has(pa.id), false);
  assert.equal(sa.boat, null);
  assert.equal(sb.boat, null);
});

test('저장 후 다시 불러와도 진행 상황이 남음', async () => {
  await db.flushDb();
  const before = JSON.stringify(player('테스트A').dishes);
  await db.loadDb();
  assert.equal(JSON.stringify(player('테스트A').dishes), before);
  assert.ok(player('테스트A').xp > 0);
  assert.equal(player('테스트A').farm.size, 9);
  Date.now = realNow;
  fs.rmSync(DATA, { recursive: true, force: true });
  setTimeout(() => process.exit(0), 50); // 서버 타이머 정리
});
