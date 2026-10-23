// UI 뿌리: #ui 안에 HUD, 열린 패널, 카드, 알림을 그림
import { render } from 'preact';
import { useUi } from './store.tsx';
import { Hud, Toasts } from './components/Hud.tsx';
import { Cards } from './components/Cards.tsx';
import { BagPanel, CraftPanel } from './components/panels/Bag.tsx';
import { ShopPanel } from './components/panels/Shop.tsx';
import { DexPanel } from './components/panels/Dex.tsx';
import { RankPanel, HelpPanel } from './components/panels/Info.tsx';
import { TradePanel } from './components/panels/Trade.tsx';
import { CookPanel, StallPanel } from './components/panels/Cook.tsx';
import { FarmPanel } from './components/panels/Farm.tsx';
import { ShipyardPanel } from './components/panels/Shipyard.tsx';
import { initUiEvents } from './events.tsx';

const PANELS = { bag: BagPanel, craft: CraftPanel, shop: ShopPanel, dex: DexPanel, rank: RankPanel, help: HelpPanel, trade: TradePanel, cook: CookPanel, stall: StallPanel, farm: FarmPanel, shipyard: ShipyardPanel };

function App() {
  const ui = useUi();
  const P = ui.ready && ui.panel ? PANELS[ui.panel] : null;
  return (
    <>
      <Hud />
      {P && <P key={ui.panel + (ui.panelArg ?? '')} />}
      {ui.ready && <Cards />}
      <Toasts />
    </>
  );
}

export function mountUi() {
  const root = document.createElement('div');
  root.id = 'app';
  document.getElementById('ui').append(root);
  render(<App />, root);
  initUiEvents();
}
