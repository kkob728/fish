// 게임 데이터 저장소 — 메모리에 들고 있다가 디바운스로 통째로 저장
// DATABASE_URL 이 있으면 Postgres(예: Neon), 없으면 data/db.json 파일
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { STARTER_ITEMS } from '../shared/data/items.js';

function fileBackend() {
  const dir = path.resolve(process.env.DATA_DIR || 'data');
  const file = path.join(dir, 'db.json');
  return {
    name: `파일 (${file})`,
    async load() {
      fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(file)) return null;
      try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (e) {
        const bad = file + '.corrupt-' + Date.now();
        fs.copyFileSync(file, bad);
        console.error(`[db] db.json 을 읽지 못했습니다. ${bad} 로 백업하고 새로 시작합니다.`, e.message);
        return null;
      }
    },
    async save(json) {
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, json);
      fs.renameSync(tmp, file);
    },
  };
}

async function postgresBackend(url) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url, max: 2, idleTimeoutMillis: 30000 });
  pool.on('error', (e) => console.error('[db] Postgres 연결 오류', e.message));
  await pool.query('CREATE TABLE IF NOT EXISTS fish_store (id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  return {
    name: 'Postgres',
    async load() {
      const r = await pool.query("SELECT data FROM fish_store WHERE id = 'main'");
      return r.rows[0]?.data ?? null;
    },
    async save(json) {
      await pool.query(
        "INSERT INTO fish_store (id, data, updated_at) VALUES ('main', $1::jsonb, now()) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()",
        [json],
      );
    },
  };
}

let backend = null;
let db = { players: {}, names: {}, records: {} };
let saveTimer = null;
let saving = null;
let pendingSave = false;

export async function loadDb() {
  backend = process.env.DATABASE_URL ? await postgresBackend(process.env.DATABASE_URL) : fileBackend();
  const data = await backend.load();
  if (data) db = data;
  db.players ??= {};
  db.names ??= {};
  db.records ??= {};
  console.log(`[db] ${backend.name}에서 플레이어 ${Object.keys(db.players).length}명 불러옴`);
  return db;
}

export function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (saving) {
    pendingSave = true;
    return saving;
  }
  saving = backend
    .save(JSON.stringify(db))
    .catch((e) => {
      console.error('[db] 저장 실패', e.message);
      pendingSave = true;
    })
    .finally(() => {
      saving = null;
      if (pendingSave) {
        pendingSave = false;
        markDirty();
      }
    });
  return saving;
}

// 종료 직전: 진행 중인 저장을 기다린 뒤 마지막 상태를 한 번 더 저장
export async function flushDb() {
  if (saving) await saving;
  clearTimeout(saveTimer);
  saveTimer = null;
  await backend.save(JSON.stringify(db));
}

export function markDirty() {
  if (saveTimer) return;
  saveTimer = setTimeout(saveNow, 5000);
}

export function getDb() {
  return db;
}

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

export function validName(name) {
  return typeof name === 'string' && /^[\p{L}\p{N}_]{2,12}$/u.test(name);
}

// 로그인 또는 신규 생성. 반환: { player, token } 또는 { error }
export function login(name, token, color) {
  const key = name.toLowerCase();
  const existingId = db.names[key];
  if (existingId) {
    const p = db.players[existingId];
    if (!token || hashToken(token) !== p.tokenHash) {
      return { error: '이미 사용 중인 닉네임입니다. (이 브라우저에서 만든 닉네임이 아니에요)' };
    }
    if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) p.color = color;
    return { player: p, token };
  }
  const newToken = crypto.randomBytes(24).toString('hex');
  const id = crypto.randomBytes(6).toString('hex');
  const p = {
    id,
    name,
    tokenHash: hashToken(newToken),
    color: /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#e86a4a',
    created: Date.now(),
    money: 50,
    earned: 0,
    rods: ['bamboo'],
    rod: 'bamboo',
    bait: 'worm_bait',
    items: { ...STARTER_ITEMS },
    fish: [],
    dex: {},
    stats: { catches: 0, best: null },
    xp: 0,
    pos: null,
  };
  db.players[id] = p;
  db.names[key] = id;
  markDirty();
  return { player: p, token: newToken };
}

export function publicProfile(p) {
  const { tokenHash, ...rest } = p;
  return rest;
}
