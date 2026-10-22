import { h, ui, fmtMoney, fmtTime, isTyping } from './dom.js';
import { ic, itemIc, BUFF_ICON, WEATHER_ICON, PHASE_ICON } from './icons.js';
import { S, itemCount } from '../state.js';
import { send, on, serverNow } from '../net.js';
import { BAITS, ITEMS, NO_BAIT } from '../../../shared/data/items.js';
import { ROD, WEATHERS, PHASES, gameHour, phaseOf } from '../../../shared/data/core.js';
import { levelInfo } from '../../../shared/level.js';
import { sfx, toggleMute, isMuted } from '../audio.js';

let levelEl, toastsEl, moneyEl, clockEl, regionEl, buffsEl, hotbar, baitPop, promptEl, hintEl, chatEl, chatLog, chatInput, playersPop, onlineCnt, muteBtn;
let openPanelFn = () => {};

const TOAST_ICON = { warn: 'close', ok: 'sparkle', info: 'fish', buff: 'sparkle' };

// text: 문자열 또는 DOM 노드
export function toast(text, kind = 'info', ms = 3200, iconName = null) {
  if (!toastsEl) return;
  const icon = iconName ? ic(iconName) : kind === 'warn' ? null : null;
  const t = h('div.toast.paper.' + kind, icon, text);
  toastsEl.append(t);
  while (toastsEl.children.length > 4) toastsEl.firstChild.remove();
  setTimeout(() => {
    t.style.transition = 'opacity .4s, transform .4s';
    t.style.opacity = '0';
    t.style.transform = 'translateY(-6px)';
    setTimeout(() => t.remove(), 400);
  }, ms);
}

// 아이템 묶음 표시용 노드
export function itemsNode(items) {
  return h('span.items', Object.entries(items).map(([id, n]) => h('span', itemIc(id), `${ITEMS[id]?.name || id} ×${n}`)));
}

const SYS_COLOR = { catch: '#ffe08a', join: '#b8f0a0', leave: '#d8d0c0', weather: '#a8d8ff', buff: '#ffd36a', trade: '#b8f0a0', record: '#ffd36a', rod: '#ffd36a', variant: null };
export function chatLine({ from, text, color, sys, kind }) {
  if (!chatLog) return;
  const ln = sys
    ? h('div.ln.sys', { style: { color: color || SYS_COLOR[kind] || '#f3e6c4' } }, text)
    : h('div.ln', h('b', { style: { color: color || '#fff' } }, from), '  ', text);
  const atBottom = chatLog.scrollTop + chatLog.clientHeight >= chatLog.scrollHeight - 30;
  chatLog.append(ln);
  while (chatLog.children.length > 100) chatLog.firstChild.remove();
  if (atBottom) chatLog.scrollTop = chatLog.scrollHeight;
}

export function setPrompt(text, key = 'E') {
  if (!promptEl) return;
  if (!text) {
    promptEl.style.display = 'none';
    return;
  }
  if (promptEl.dataset.t !== text) {
    promptEl.dataset.t = text;
    promptEl.replaceChildren(h('span.keycap', key), text);
  }
  promptEl.style.display = '';
}

export function setHint(text) {
  if (hintEl && hintEl.textContent !== (text || '')) hintEl.textContent = text || '';
}

function baitList() {
  return [NO_BAIT, ...BAITS.filter((b) => itemCount(b.id) > 0)];
}

export function cycleBait() {
  const list = baitList();
  const cur = list.findIndex((b) => b.id === (S.me.bait || null));
  selectBait(list[(cur + 1) % list.length].id);
}
export function selectBait(id) {
  S.me.bait = id;
  send('bait', { id });
  sfx.click();
  renderBait();
}

function renderBait() {
  if (!hotbar || !S.me) return;
  const id = S.me.bait && itemCount(S.me.bait) > 0 ? S.me.bait : null;
  const b = id ? ITEMS[id] : NO_BAIT;
  hotbar.querySelector('.slot').replaceChildren(itemIc(id));
  hotbar.querySelector('.nm').textContent = b.name;
  hotbar.querySelector('.ct').textContent = id ? `남은 개수 ${itemCount(id)}  ·  Q 변경` : '미끼 없음  ·  Q 변경';
  hotbar.querySelector('.rod span').textContent = ROD[S.me.rod].name;
}

function toggleBaitPop() {
  if (baitPop) {
    baitPop.remove();
    baitPop = null;
    return;
  }
  baitPop = h(
    'div.bait-pop.paper',
    baitList().map((b) =>
      h(
        'div.bait-opt' + ((S.me.bait || null) === b.id ? '.on' : ''),
        { onclick: () => { selectBait(b.id); toggleBaitPop(); } },
        itemIc(b.id),
        h('div', h('b', b.name), h('span.muted', { style: { fontSize: '12px' } }, b.bare ? '느림 · 고급까지만' : `${itemCount(b.id)}개`)),
      ),
    ),
  );
  ui().append(baitPop);
}

function renderPlayers() {
  if (!playersPop) return;
  playersPop.replaceChildren(
    h('div.t', `섬에 있는 사람 ${S.players.size + 1}명`),
    h('div.mini', h('span.dot', { style: { background: S.me.color } }), h('span.grow', `${S.me.name} (나)`)),
    ...[...S.players.values()].map((p) =>
      h('div.mini', h('span.dot', { style: { background: p.color } }), h('span.grow', p.name), h('button.tiny', { onclick: () => send('tradeReq', { to: p.id }) }, '거래')),
    ),
  );
}
export function togglePlayers() {
  if (playersPop) {
    playersPop.remove();
    playersPop = null;
  } else {
    playersPop = h('div.players-pop.paper');
    ui().append(playersPop);
    renderPlayers();
  }
}

function tile(iconName, key, title, onclick) {
  return h('button.tile', { onclick, title }, ic(iconName), key && h('span.keycap.k', key));
}

export function initHud({ openPanel }) {
  openPanelFn = openPanel;
  const root = ui();
  moneyEl = h('span', '0');
  clockEl = h('div.sign.plank.clock');
  regionEl = h('span', '');
  root.append(
    h(
      'div.hud-tl',
      h('div.sign.plank.money', ic('coin'), moneyEl),
      (levelEl = h('div.sign.plank.level', { title: '낚시 레벨: 오를수록 찌 구간이 넓어지고 물고기가 느려져요' })),
      clockEl,
      h('div.ribbon.paper', ic('pin'), regionEl),
    ),
  );

  buffsEl = h('div.buffs');
  onlineCnt = h('span.cnt', '1');
  const peopleBtn = tile('people', 'Tab', '접속자', togglePlayers);
  peopleBtn.append(onlineCnt);
  muteBtn = tile(isMuted() ? 'mute' : 'sound', 'M', '소리', () => setMuteIcon(toggleMute()));
  root.append(
    h(
      'div.hud-tr',
      h(
        'div.menu',
        tile('bag', 'I', '가방', () => openPanelFn('bag')),
        tile('hammer', 'C', '제작', () => openPanelFn('craft')),
        tile('book', 'K', '도감', () => openPanelFn('dex')),
        tile('trophy', 'L', '랭킹', () => openPanelFn('rank')),
        tile('help', 'H', '도움말', () => openPanelFn('help')),
        peopleBtn,
        muteBtn,
      ),
      buffsEl,
    ),
  );

  hotbar = h(
    'div.hotbar.plank',
    h('div.slot.paper', { onclick: toggleBaitPop, title: '미끼 고르기' }),
    h('div.info', { onclick: toggleBaitPop }, h('div.nm', ''), h('div.ct', '')),
    h('div.rod', ic('rod'), h('span', '')),
  );
  root.append(hotbar);

  promptEl = h('div.prompt.paper');
  promptEl.style.display = 'none';
  hintEl = h('div.hint-line.passthru', '');
  toastsEl = h('div.toasts');
  root.append(promptEl, hintEl, toastsEl);

  chatLog = h('div.chat-log');
  chatInput = h('input', { maxLength: 120, placeholder: '할 말을 쓰고 Enter (Esc 취소)' });
  chatEl = h('div.chat', chatLog, chatInput);
  root.append(chatEl);
  chatInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      const v = chatInput.value.trim();
      if (v) send('chat', { text: v });
      chatInput.value = '';
      closeChat();
    } else if (e.key === 'Escape') closeChat();
  });

  on('chat', (m) => {
    chatLine(m);
    if (!m.sys) sfx.chat();
  });
  on('toast', (m) => {
    toast(m.text, m.kind, 3600, m.kind === 'buff' ? BUFF_ICON[m.buff] || 'sparkle' : null);
    if (m.kind === 'buff') sfx.buff();
  });
  renderBait();
}

function setMuteIcon(muted) {
  muteBtn.replaceChildren(ic(muted ? 'mute' : 'sound'), h('span.keycap.k', 'M'));
}

export function openChat() {
  chatEl.classList.add('open');
  chatInput.focus();
}
function closeChat() {
  chatEl.classList.remove('open');
  chatInput.blur();
}

export function refreshHud() {
  if (!S.me) return;
  moneyEl.textContent = fmtMoney(S.me.money);
  const lv = levelInfo(S.me.xp || 0);
  levelEl.replaceChildren(h('span.lv', `Lv ${lv.level}`), h('div.xpbar', h('div', { style: { width: lv.need ? `${(lv.into / lv.need) * 100}%` : '100%' } })));
  renderBait();
  if (playersPop) renderPlayers();
  onlineCnt.textContent = String(S.players.size + 1);
}

let clockSig = '';
export function updateHud(regionName) {
  const now = serverNow();
  const hour = gameHour(now + (window.__timeShift || 0));
  const hh = Math.floor(hour);
  const mm = Math.floor((hour - hh) * 6) * 10;
  const ph = phaseOf(hour);
  const wid = WEATHERS[S.weather.id] ? S.weather.id : 'clear';
  const ampm = hh < 12 ? '오전' : '오후';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const sig = `${ph}|${ampm}${h12}:${mm}|${wid}`;
  if (sig !== clockSig) {
    clockSig = sig;
    clockEl.replaceChildren(ic(PHASE_ICON[ph]), `${ampm} ${h12}:${String(mm).padStart(2, '0')}`, h('span.sep'), ic(WEATHER_ICON[wid]), WEATHERS[wid].name);
  }
  if (regionEl.textContent !== regionName) regionEl.textContent = regionName;
  // 버프
  const list = S.buffs.filter((b) => b.until > now);
  const bsig = list.map((b) => b.id).join();
  if (buffsEl.dataset.sig !== bsig) {
    buffsEl.dataset.sig = bsig;
    buffsEl.replaceChildren(...list.map((b) => h('div.buff.paper' + (b.global ? '.global' : ''), { title: `${b.name}: ${b.desc}` }, ic(BUFF_ICON[b.id] || 'sparkle'), h('span.tm', ''))));
  }
  [...buffsEl.children].forEach((el, i) => {
    const b = list[i];
    if (b) el.querySelector('.tm').textContent = fmtTime((b.until - now) / 1000);
  });
}

export function hudKeys(e) {
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
    setMuteIcon(toggleMute());
    return true;
  }
  return false;
}
