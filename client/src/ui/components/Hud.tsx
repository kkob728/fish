// 화면 위의 상시 UI: 돈·레벨·시계·지역, 메뉴, 버프, 미끼 핫바, 안내, 알림, 채팅
import { useEffect, useRef, useState } from 'preact/hooks';
import { Icon, ItemIcon } from './common.tsx';
import { fmtMoney, fmtTime } from '../dom.ts';
import { BUFF_ICON, WEATHER_ICON, PHASE_ICON } from '../icons.ts';
import { S, itemCount } from '../../state.ts';
import { send, serverNow } from '../../net.ts';
import { ITEMS, NO_BAIT } from '../../../../shared/data/items.ts';
import { ROD, WEATHERS, gameHour, phaseOf } from '../../../../shared/data/core.ts';
import { levelInfo } from '../../../../shared/level.ts';
import { U, useUi, openPanel, togglePlayers, toggleBaitPop, toggleMuteUi, baitList, selectBait, closeChat } from '../store.tsx';

function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function Clock() {
  useTick(1000);
  const hour = gameHour(serverNow() + (window.__timeShift || 0));
  const hh = Math.floor(hour);
  const mm = Math.floor((hour - hh) * 6) * 10;
  const ph = phaseOf(hour);
  const wid = WEATHERS[S.weather.id] ? S.weather.id : 'clear';
  return (
    <div class="sign plank clock">
      <Icon name={PHASE_ICON[ph]} />
      {`${hh < 12 ? '오전' : '오후'} ${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, '0')}`}
      <span class="sep" />
      <Icon name={WEATHER_ICON[wid]} />
      {WEATHERS[wid].name}
    </div>
  );
}

function Buffs() {
  useTick(1000);
  const now = serverNow();
  return (
    <div class="buffs">
      {S.buffs
        .filter((b) => b.until > now)
        .map((b) => (
          <div key={b.id} class={`buffchip paper${b.global ? ' global' : ''}`} title={`${b.name}: ${b.desc}`}>
            <Icon name={BUFF_ICON[b.id] || 'sparkle'} />
            <span class="tm">{fmtTime((b.until - now) / 1000)}</span>
          </div>
        ))}
    </div>
  );
}

function BoatBar() {
  useTick(250);
  const ri = S.rideInfo;
  if (!ri) return null;
  return (
    <div class="boatbar plank">
      <Icon name="boat" />
      <b>{ri.name}</b>
      <span>{`${Math.round(Math.abs(ri.v) * 3.6)}km/h`}</span>
      <span class={`anc${ri.anchored ? ' on' : ''}`}>
        <Icon name="anchor" />
        {ri.anchored ? '닻 내림' : '항해 중'}
      </span>
      {!ri.captain && <span class="muted-l">손님</span>}
    </div>
  );
}

function Tile({ icon, k, title, onClick, children }: { icon: string; k?: string; title: string; onClick: () => void; children?: any }) {
  return (
    <button class="tile" onClick={onClick} title={title}>
      <Icon name={icon} />
      {k && <span class="keycap k">{k}</span>}
      {children}
    </button>
  );
}

function Hotbar() {
  const id = S.me.bait && itemCount(S.me.bait) > 0 ? S.me.bait : null;
  const b = id ? ITEMS[id] : NO_BAIT;
  const how = document.body.classList.contains('touch') ? '눌러서 변경' : 'Q 변경';
  return (
    <div class="hotbar plank">
      <div class="slot paper" onClick={toggleBaitPop} title="미끼 고르기">
        <ItemIcon id={id} />
      </div>
      <div class="info" onClick={toggleBaitPop}>
        <div class="nm">{b.name}</div>
        <div class="ct">{id ? `남은 개수 ${itemCount(id)}  ·  ${how}` : `미끼 없음  ·  ${how}`}</div>
      </div>
      <div class="rod">
        <Icon name="rod" />
        <span>{ROD[S.me.rod].name}</span>
      </div>
    </div>
  );
}

function BaitPop() {
  return (
    <div class="bait-pop paper">
      {baitList().map((b) => (
        <div
          key={b.id ?? 'bare'}
          class={`bait-opt${(S.me.bait || null) === b.id ? ' on' : ''}`}
          onClick={() => {
            selectBait(b.id);
            toggleBaitPop();
          }}
        >
          <ItemIcon id={b.id} />
          <div>
            <b>{b.name}</b>
            <span class="muted" style={{ fontSize: '12px' }}>
              {!b.id ? '느림 · 고급까지만' : `${itemCount(b.id)}개`}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Players() {
  return (
    <div class="players-pop paper">
      <div class="t">{`섬에 있는 사람 ${S.players.size + 1}명`}</div>
      <div class="mini">
        <span class="dot" style={{ background: S.me.color }} />
        <span class="grow">{`${S.me.name} (나)`}</span>
      </div>
      {[...S.players.values()].map((p) => (
        <div key={p.id} class="mini">
          <span class="dot" style={{ background: p.color }} />
          <span class="grow">{p.name}</span>
          <button class="tiny" onClick={() => send('tradeReq', { to: p.id })}>
            거래
          </button>
        </div>
      ))}
    </div>
  );
}

const SYS_COLOR = { catch: '#ffe08a', join: '#b8f0a0', leave: '#d8d0c0', weather: '#a8d8ff', buff: '#ffd36a', trade: '#b8f0a0', record: '#ffd36a', rod: '#ffd36a' };

function Chat() {
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const el = logRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [U.chat.length]);
  useEffect(() => {
    if (U.chatOpen) inputRef.current?.focus();
    else inputRef.current?.blur();
  }, [U.chatOpen]);
  return (
    <div class={`chat${U.chatOpen ? ' open' : ''}`}>
      <div
        class="chat-log"
        ref={logRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 30;
        }}
      >
        {U.chat.map((m) =>
          m.sys ? (
            <div key={m.id} class="ln sys" style={{ color: m.color || SYS_COLOR[m.kind] || '#f3e6c4' }}>
              {m.text}
            </div>
          ) : (
            <div key={m.id} class="ln">
              <b style={{ color: m.color || '#fff' }}>{m.from}</b>
              {'  '}
              {m.text}
            </div>
          ),
        )}
      </div>
      <input
        ref={inputRef}
        maxLength={120}
        placeholder="할 말을 쓰고 Enter (Esc 취소)"
        onKeyDown={(e) => {
          e.stopPropagation();
          const el = e.currentTarget;
          if (e.key === 'Enter') {
            const v = el.value.trim();
            if (v) send('chat', { text: v });
            el.value = '';
            closeChat();
          } else if (e.key === 'Escape') closeChat();
        }}
      />
    </div>
  );
}

export function Hud() {
  const ui = useUi();
  if (!ui.ready || !S.me) return null;
  const lv = levelInfo(S.me.xp || 0);
  return (
    <>
      <div class="hud-tl">
        <div class="sign plank money">
          <Icon name="coin" />
          <span>{fmtMoney(S.me.money)}</span>
        </div>
        <div class="sign plank level" title="낚시 레벨: 오를수록 찌 구간이 넓어지고 물고기가 느려져요">
          <span class="lv">{`Lv ${lv.level}`}</span>
          <div class="xpbar">
            <div style={{ width: lv.need ? `${(lv.into / lv.need) * 100}%` : '100%' }} />
          </div>
        </div>
        <Clock />
        <div class="ribbon paper">
          <Icon name="pin" />
          <span>{ui.region}</span>
        </div>
      </div>
      <div class="hud-tr">
        <div class="menu">
          <Tile icon="bag" k="I" title="가방" onClick={() => openPanel('bag')} />
          <Tile icon="hammer" k="C" title="제작" onClick={() => openPanel('craft')} />
          <Tile icon="station" k="G" title="조리대 깔기/거두기" onClick={() => ui.toggleStation()} />
          <Tile icon="book" k="K" title="도감" onClick={() => openPanel('dex')} />
          <Tile icon="trophy" k="L" title="랭킹" onClick={() => openPanel('rank')} />
          <Tile icon="help" k="H" title="도움말" onClick={() => openPanel('help')} />
          <Tile icon="people" k="Tab" title="접속자" onClick={togglePlayers}>
            <span class="cnt">{S.players.size + 1}</span>
          </Tile>
          <Tile icon={ui.muted ? 'mute' : 'sound'} k="M" title="소리" onClick={toggleMuteUi} />
        </div>
        <Buffs />
      </div>
      <Hotbar />
      <BoatBar />
      {ui.baitOpen && <BaitPop />}
      {ui.playersOpen && <Players />}
      {ui.prompt && (
        <div class="prompt paper">
          <span class="keycap">E</span>
          {ui.prompt}
        </div>
      )}
      <div class="hint-line passthru">{ui.hint}</div>
      <Chat />
    </>
  );
}

export function Toasts() {
  const ui = useUi();
  return (
    <div class="toasts">
      {ui.toasts.map((t) => (
        <div key={t.id} class={`toast paper ${t.kind}`} style={t.out ? { opacity: 0, transform: 'translateY(-6px)', transition: 'opacity .4s, transform .4s' } : undefined}>
          {t.icon && <Icon name={t.icon} />}
          {t.content}
        </div>
      ))}
    </div>
  );
}
