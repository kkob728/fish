// 채집: 맵의 노드에서 재료를 캐면 일정 시간 뒤 다시 생김 (먼저 캐는 사람이 가져감)
import { NO_BAIT } from '../shared/data/items.ts';
import { gatherNodes, NODE_TYPES } from '../shared/world.ts';
import { randInt } from '../shared/rng.ts';
import { type Handler, now, ctxNow, send, broadcast, toast, sendMe, markDirty, addItems, effectsFor } from './core.ts';

export const NODES = gatherNodes();
const NODE_BY_ID = Object.fromEntries(NODES.map((n) => [n.id, n]));
const nodeState = new Map<string, number>(); // nodeId -> 다시 생기는 시각

// 접속할 때 보낼, 아직 다시 안 생긴 노드들
export function depletedNodes() {
  const t = now();
  return Object.fromEntries([...nodeState.entries()].filter(([, u]) => u > t));
}

const gather: Handler = (s, m) => {
  const node = NODE_BY_ID[m.id];
  if (!node) return;
  if (Math.hypot(node.x - s.x, node.z - s.z) > 5) return toast(s, '너무 멀어요.', 'warn');
  const type = NODE_TYPES[node.type];
  if (type.nightOnly && ctxNow().phase !== 'night') return toast(s, '반딧불이는 밤에만 나와요.', 'warn');
  if ((nodeState.get(node.id) || 0) > now()) return toast(s, '이미 누군가 가져갔어요. 잠시 후 다시 생겨요.', 'warn');
  const got: Record<string, number> = {};
  for (const [id, a, b, chance] of type.drops) {
    if (Math.random() < chance) got[id] = (got[id] || 0) + randInt(a, b);
  }
  const eff = effectsFor(s, NO_BAIT);
  if (eff.gatherBonus) {
    const first = type.drops[0][0];
    got[first] = (got[first] || 0) + eff.gatherBonus;
  }
  addItems(s.p, got);
  const until = now() + randInt(type.respawn[0], type.respawn[1]) * 1000;
  nodeState.set(node.id, until);
  broadcast('node', { id: node.id, until });
  markDirty();
  sendMe(s);
  send(s, 'gathered', { id: node.id, items: got });
};

export const gatherHandlers: Record<string, Handler> = { gather };
