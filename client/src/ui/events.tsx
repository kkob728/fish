// 화면(UI)을 바꾸는 서버 이벤트를 한곳에 모음. 3D 쪽 처리는 main.ts에 있음
import { on, send } from '../net.ts';
import { S } from '../state.ts';
import { sfx } from '../audio.ts';
import { BUFF_ICON } from './icons.ts';
import { runCookGame } from './cookgame.ts';
import { clearCookSelection } from './components/panels/Cook.tsx';
import { U, bump, toast, toastItems, itemsLine, chatLine, openPanel, closePanel } from './store.tsx';
import { ItemIcon, Icon } from './components/common.tsx';
import { ITEMS, RECIPE } from '../../../shared/data/items.ts';
import { CROP } from '../../../shared/data/crops.ts';

// 받침에 맞춰 을/를
const eulReul = (w: string) => w + ((w.charCodeAt(w.length - 1) - 0xac00) % 28 ? '을' : '를');

export function initUiEvents() {
  for (const t of ['me', 'join', 'leave', 'buffs', 'station', 'records', 'farm', 'farms']) on(t, bump);

  on('chat', (m) => {
    chatLine(m);
    if (!m.sys) sfx.chat();
  });
  on('toast', (m) => {
    toast(m.text, m.kind, 3600, m.icon || (m.kind === 'buff' ? BUFF_ICON[m.buff] || 'sparkle' : null));
    if (m.kind === 'buff') sfx.buff();
  });
  on('levelUp', (m) => {
    toast(`낚시 레벨 ${m.level}! 찌 구간이 넓어지고 물고기가 조금 느려졌어요.`, 'ok', 4500, 'star');
    sfx.buff();
  });
  on('gathered', (m) => {
    toast(itemsLine(m.items), 'ok');
    sfx.gather();
  });
  on('crafted', (m) => {
    const out = RECIPE[m.id]?.out;
    toast(
      <span>
        <span class="items">
          <span>
            <ItemIcon id={out?.id || null} />
            {`${out?.id ? ITEMS[out.id].name : '낚싯대'} 완성`}
          </span>
        </span>
        {m.n > 1 ? ` (${m.n}번)` : ''}
      </span>,
      'ok',
    );
    sfx.craft();
  });
  on('sold', (m) => {
    toast(
      <span class="items">
        <span>
          <Icon name="coin" />
          {`+${m.total.toLocaleString()}`}
        </span>
        {`${m.count}개 판매`}
      </span>,
      'ok',
    );
    sfx.coin();
  });
  on('dismantled', (m) => {
    toastItems(m.items, '손질해서 얻음  ', 'knife');
    sfx.craft();
  });
  on('farmDone', (m) => {
    if (m.act === 'plant') {
      toast(`${eulReul(CROP[m.crop].name)} ${m.n}칸에 심었어요.`, 'ok', 2600, 'sprout');
      sfx.gather();
    } else if (m.act === 'water') {
      toast(`${m.n}칸에 물을 줬어요.`, 'info', 2200, 'water');
      sfx.splash(0.6);
    } else {
      toastItems(m.items, '수확!  ', 'sickle');
      sfx.craft();
    }
  });
  on('caught', (m) => {
    if (!m.seed) return;
    setTimeout(() => {
      toast(`물고기 뱃속에서 ${ITEMS[m.seed].name}이 나왔어요! 텃밭에 심어 보세요.`, 'ok', 5000, 'sprout');
      sfx.buff();
    }, 1200);
  });
  on('leaderboard', (m) => {
    U.leaderboard = m;
    bump();
  });

  // ---------- 거래 ----------
  on('tradeReq', (m) => {
    const req = { from: m.from, name: m.name, until: Date.now() + 20000 };
    U.tradeReqs = [...U.tradeReqs, req];
    sfx.open();
    bump();
    setTimeout(() => {
      U.tradeReqs = U.tradeReqs.filter((r) => r !== req);
      bump();
    }, 20000);
  });
  on('tradeState', (m) => {
    U.trade = m;
    S.tradeOpen = true;
    if (U.panel !== 'trade') openPanel('trade', true);
    else bump();
  });
  const endTrade = (msg: string, kind: string) => {
    U.trade = null;
    S.tradeOpen = false;
    if (U.panel === 'trade') closePanel(true);
    toast(msg, kind, 3200, kind === 'ok' ? 'trade' : null);
  };
  on('tradeClosed', (m) => endTrade(m.reason || '거래가 끝났어요.', 'warn'));
  on('tradeDone', (m) => {
    endTrade(`${m.partner}님과 거래했어요.`, 'ok');
    sfx.coin();
  });

  // ---------- 요리 ----------
  on('cookGo', async (m) => {
    closePanel(true);
    sfx.open();
    const scores = await runCookGame(m.tool, m.tier);
    if (!scores) {
      send('cookCancel');
      toast('요리를 그만뒀어요. 재료는 돌려받았어요.', 'warn');
      return;
    }
    send('cookFinish', { cid: m.cid, scores });
  });
  on('cooked', (m) => {
    clearCookSelection();
    sfx.catch(Math.min(5, m.dish.stars), !!m.dish.v);
    U.catchCard = null;
    U.dishCard = { dish: m.dish, isNew: m.isNew };
    bump();
    if (m.autoSold) toast('요리 가방이 가득 차서 바로 팔았어요.', 'warn');
  });
}
