// UI 상태 저장소. 게임 코드(main/fishing/touch)는 여기 함수들만 부르고, 화면은 Preact 컴포넌트가 그린다.
import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { S, itemCount } from '../state.ts';
import { send } from '../net.ts';
import { sfx, toggleMute, isMuted } from '../audio.ts';
import { isTyping } from './dom.ts';
import { BAITS, ITEMS, NO_BAIT } from '../../../shared/data/items.ts';
import type { FishRecord, Dish } from '../../../shared/types.ts';
import { ItemIcon, Icon } from './components/common.tsx';

export interface Toast {
  id: number;
  content: ComponentChildren;
  kind: string;
  icon: string | null;
  out?: boolean;
}
export interface ChatLine {
  id: number;
  from?: string;
  text: string;
  color?: string;
  sys?: boolean;
  kind?: string;
}

export const U = {
  ready: false,
  panel: null as string | null,
  panelArg: null as any,
  tabs: { bag: 'fish', shop: 'sell', dex: 'lake', cook: 'cook' } as Record<string, string>,
  toasts: [] as Toast[],
  chat: [] as ChatLine[],
  chatOpen: false,
  prompt: '',
  hint: '',
  region: '',
  baitOpen: false,
  playersOpen: false,
  muted: isMuted(),
  catchCard: null as null | { rec: FishRecord; flags: any },
  dishCard: null as null | { dish: Dish; isNew: boolean },
  tradeReqs: [] as { from: string; name: string; until: number }[],
  trade: null as any,
  leaderboard: null as any,
  toggleStation: () => {},
};

// ---------- 다시 그리기 ----------
const listeners = new Set<() => void>();
let pending = false;
export function bump() {
  if (pending) return;
  pending = true;
  queueMicrotask(() => {
    pending = false;
    for (const l of listeners) l();
  });
}
export function useUi() {
  const [, set] = useState(0);
  useEffect(() => {
    const l = () => set((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return U;
}
export const refreshHud = bump;
export const refreshPanel = bump;

// ---------- 알림 ----------
let seq = 0;
export function toast(content: ComponentChildren, kind = 'info', ms = 3200, icon: string | null = null) {
  const t: Toast = { id: ++seq, content, kind, icon };
  U.toasts = [...U.toasts.slice(-3), t];
  bump();
  setTimeout(() => {
    t.out = true;
    bump();
    setTimeout(() => {
      U.toasts = U.toasts.filter((x) => x !== t);
      bump();
    }, 400);
  }, ms);
}
export function itemsLine(items: Record<string, number>) {
  return (
    <span class="items">
      {Object.entries(items).map(([id, n]) => (
        <span key={id}>
          <ItemIcon id={id} />
          {`${ITEMS[id]?.name || id} ×${n}`}
        </span>
      ))}
    </span>
  );
}
export function toastItems(items: Record<string, number>, prefix = '', icon: string | null = null) {
  toast(
    <span>
      {prefix}
      {itemsLine(items)}
    </span>,
    'ok',
    prefix ? 4500 : 3200,
    icon,
  );
}
export { Icon };

export function chatLine(m: Omit<ChatLine, 'id'>) {
  U.chat = [...U.chat.slice(-99), { ...m, id: ++seq }];
  bump();
}
export function setPrompt(text: string) {
  if (U.prompt === (text || '')) return;
  U.prompt = text || '';
  bump();
}
export function setHint(text: string) {
  if (U.hint === (text || '')) return;
  U.hint = text || '';
  bump();
}
// 매 프레임 호출됨 — 바뀔 때만 다시 그림
export function updateHud(region: string) {
  if (U.region === region) return;
  U.region = region;
  bump();
}

// ---------- 패널 ----------
export function openPanel(name: string, force = false, arg: any = null) {
  if (S.tradeOpen && name !== 'trade' && !force) return toast('거래 중이에요. 먼저 거래를 끝내 주세요.', 'warn');
  if (U.panel === name && !force) return closePanel();
  if (name === 'shop' && !S.nearShop) return toast('상점 주인에게 가까이 가세요.', 'warn');
  U.panel = name;
  U.panelArg = arg;
  S.panelOpen = name;
  U.baitOpen = false;
  sfx.open();
  if (name === 'rank') send('leaderboard');
  bump();
}
export function closePanel(silent = false) {
  if (!U.panel) return;
  if (U.panel === 'trade' && U.trade && !silent) {
    send('tradeCancel');
    return;
  }
  U.panel = null;
  U.panelArg = null;
  S.panelOpen = null;
  bump();
}
export function panelName() {
  return U.panel;
}
export function setTab(key: string, id: string) {
  U.tabs[key] = id;
  sfx.click();
  bump();
}

// ---------- 미끼 ----------
export function baitList() {
  return [NO_BAIT, ...BAITS.filter((b) => itemCount(b.id) > 0)];
}
export function selectBait(id: string | null) {
  S.me.bait = id;
  send('bait', { id });
  sfx.click();
  bump();
}
export function cycleBait() {
  const list = baitList();
  const cur = list.findIndex((b) => b.id === (S.me.bait || null));
  selectBait(list[(cur + 1) % list.length].id);
}

// ---------- 기타 HUD ----------
export function togglePlayers() {
  U.playersOpen = !U.playersOpen;
  bump();
}
export function toggleBaitPop() {
  U.baitOpen = !U.baitOpen;
  bump();
}
export function toggleMuteUi() {
  U.muted = toggleMute();
  bump();
}
export function openChat() {
  U.chatOpen = true;
  bump();
}
export function closeChat() {
  U.chatOpen = false;
  bump();
}
export function showCatch(rec: FishRecord, flags: any) {
  U.catchCard = { rec, flags };
  bump();
}
export function closeCatch() {
  if (!U.catchCard && !U.dishCard) return;
  U.catchCard = null;
  U.dishCard = null;
  bump();
}

// 키보드 단축키 중 HUD 담당
export function hudKeys(e: KeyboardEvent) {
  if (e.code === 'Enter' && !isTyping()) {
    e.preventDefault();
    openChat();
    return true;
  }
  if (isTyping()) return false;
  if (e.code === 'KeyQ') {
    cycleBait();
    return true;
  }
  if (e.code === 'Tab') {
    e.preventDefault();
    togglePlayers();
    return true;
  }
  if (e.code === 'KeyM') {
    toggleMuteUi();
    return true;
  }
  return false;
}
