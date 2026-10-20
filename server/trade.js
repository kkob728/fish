// 플레이어 간 거래: 요청 → 수락 → 양쪽 제안 → 양쪽 잠금 → 양쪽 확정 → 서버가 한 번에 교환
import { ITEMS } from '../shared/data/items.js';

export function createTradeSystem(ctx) {
  const { sessions, send, toast, sendMe, markDirty, hasItem, takeItem, addItems, FISH_BAG_LIMIT, sysChat } = ctx;
  const pending = new Map(); // targetId -> { fromId, until }

  const emptyOffer = () => ({ items: {}, fish: [], money: 0 });
  const other = (tr, s) => (tr.a === s ? tr.b : tr.a);

  function sendState(tr) {
    for (const s of [tr.a, tr.b]) {
      const o = other(tr, s);
      const theirs = tr.offer.get(o);
      send(s, 'tradeState', {
        partner: { id: o.p.id, name: o.p.name },
        mine: tr.offer.get(s),
        theirs: { ...theirs, fishRecs: theirs.fish.map((uid) => o.p.fish.find((f) => f.uid === uid)).filter(Boolean) },
        locked: { me: !!tr.locked.get(s), them: !!tr.locked.get(o) },
        confirmed: { me: !!tr.confirmed.get(s), them: !!tr.confirmed.get(o) },
      });
    }
  }

  function close(tr, reason) {
    for (const s of [tr.a, tr.b]) {
      s.trade = null;
      send(s, 'tradeClosed', { reason });
    }
  }

  function validOffer(s, off) {
    for (const [id, n] of Object.entries(off.items)) if (!hasItem(s.p, id, n)) return false;
    for (const uid of off.fish) if (!s.p.fish.some((f) => f.uid === uid)) return false;
    return off.money >= 0 && off.money <= s.p.money;
  }

  function execute(tr) {
    const { a, b } = tr;
    const oa = tr.offer.get(a);
    const ob = tr.offer.get(b);
    if (!validOffer(a, oa) || !validOffer(b, ob)) return close(tr, '제안한 물건이 더 이상 없어서 거래가 취소됐어요.');
    if (a.p.fish.length - oa.fish.length + ob.fish.length > FISH_BAG_LIMIT || b.p.fish.length - ob.fish.length + oa.fish.length > FISH_BAG_LIMIT) {
      return close(tr, '물고기 가방 공간이 부족해서 거래가 취소됐어요.');
    }
    const move = (from, to, off) => {
      for (const [id, n] of Object.entries(off.items)) {
        takeItem(from.p, id, n);
        addItems(to.p, { [id]: n });
      }
      const moving = from.p.fish.filter((f) => off.fish.includes(f.uid));
      from.p.fish = from.p.fish.filter((f) => !off.fish.includes(f.uid));
      for (const f of moving) to.p.fish.push({ ...f, lock: false });
      from.p.money -= off.money;
      to.p.money += off.money;
    };
    move(a, b, oa);
    move(b, a, ob);
    markDirty();
    sendMe(a);
    sendMe(b);
    for (const s of [a, b]) {
      s.trade = null;
      send(s, 'tradeDone', { partner: other(tr, s).p.name });
    }
    sysChat(`${a.p.name}님과 ${b.p.name}님이 물물교환을 했어요.`, null, 'trade');
  }

  return {
    request(s, m) {
      const target = sessions.get(m.to);
      if (!target || target === s) return;
      if (s.trade || target.trade) return toast(s, '상대가 이미 거래 중이에요.', 'warn');
      if (s.fs) return toast(s, '낚시 중에는 거래할 수 없어요.', 'warn');
      if (Math.hypot(target.x - s.x, target.z - s.z) > 20) return toast(s, '거래하려면 가까이 가야 해요. (20m 이내)', 'warn');
      pending.set(target.p.id, { fromId: s.p.id, until: Date.now() + 20000 });
      send(target, 'tradeReq', { from: s.p.id, name: s.p.name });
      toast(s, `${target.p.name}님에게 거래를 요청했어요.`, 'info');
    },
    respond(s, m) {
      const pend = pending.get(s.p.id);
      if (!pend || pend.fromId !== m.from || pend.until < Date.now()) return;
      pending.delete(s.p.id);
      const from = sessions.get(m.from);
      if (!from) return;
      if (!m.accept) return toast(from, `${s.p.name}님이 거래를 거절했어요.`, 'warn');
      if (s.trade || from.trade) return;
      if (s.fs || from.fs) return toast(s, '낚시 중에는 거래할 수 없어요.', 'warn');
      const tr = { a: from, b: s, offer: new Map([[from, emptyOffer()], [s, emptyOffer()]]), locked: new Map(), confirmed: new Map() };
      s.trade = tr;
      from.trade = tr;
      sendState(tr);
    },
    offer(s, m) {
      const tr = s.trade;
      if (!tr) return;
      const items = {};
      if (m.items && typeof m.items === 'object') {
        for (const [id, raw] of Object.entries(m.items)) {
          const n = Math.floor(Number(raw));
          if (ITEMS[id] && n > 0 && hasItem(s.p, id, n)) items[id] = n;
        }
      }
      const fish = Array.isArray(m.fish) ? [...new Set(m.fish)].filter((uid) => s.p.fish.some((f) => f.uid === uid)).slice(0, 30) : [];
      const money = Math.max(0, Math.min(s.p.money, Math.floor(Number(m.money) || 0)));
      tr.offer.set(s, { items, fish, money });
      tr.locked.clear();
      tr.confirmed.clear();
      sendState(tr);
    },
    lock(s, m) {
      const tr = s.trade;
      if (!tr) return;
      tr.locked.set(s, !!m.lock);
      tr.confirmed.clear();
      sendState(tr);
    },
    confirm(s) {
      const tr = s.trade;
      if (!tr || !tr.locked.get(tr.a) || !tr.locked.get(tr.b)) return;
      tr.confirmed.set(s, true);
      if (tr.confirmed.get(tr.a) && tr.confirmed.get(tr.b)) execute(tr);
      else sendState(tr);
    },
    cancel(s) {
      if (s.trade) close(s.trade, `${s.p.name}님이 거래를 취소했어요.`);
    },
    onLeave(s) {
      pending.delete(s.p.id);
      if (s.trade) close(s.trade, '상대가 접속을 종료했어요.');
    },
  };
}
