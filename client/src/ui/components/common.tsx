// 여러 화면에서 쓰는 작은 컴포넌트들
import type { ComponentChildren } from 'preact';
import { svg, itemSvg } from '../icons.ts';
import { fmtMoney } from '../dom.ts';
import { ITEMS } from '../../../../shared/data/items.ts';
import { VARIANT } from '../../../../shared/data/core.ts';

export function Icon({ name, cls = '' }: { name: string; cls?: string }) {
  return <span class={`ico ${cls}`} dangerouslySetInnerHTML={{ __html: svg(name) }} />;
}
export function ItemIcon({ id, cls = '', color }: { id: string | null; cls?: string; color?: string }) {
  const it = id ? ITEMS[id] : null;
  color ??= it?.essence ? VARIANT[it.vid].color : undefined;
  return <span class={`ico ${cls}`} dangerouslySetInnerHTML={{ __html: itemSvg(id, color) }} />;
}
export function Coin({ n }: { n: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
      <Icon name="coin" />
      {fmtMoney(n)}
    </span>
  );
}
export function Stars({ n }: { n: number }) {
  return (
    <span class="stars">
      {[0, 1, 2, 3, 4].map((i) => (
        <Icon key={i} name={i < n ? 'star' : 'starEmpty'} />
      ))}
    </span>
  );
}
export function RarBadge({ r }: { r: { color: string; name: string } }) {
  return (
    <span class="rbadge" style={{ background: r.color }}>
      {r.name}
    </span>
  );
}
export function VarBadge({ v }: { v: { ink: string; name: string } }) {
  return (
    <span class="vbadge" style={{ background: v.ink }}>
      {v.name}
    </span>
  );
}
export function Empty({ children, pad }: { children: ComponentChildren; pad?: string }) {
  return (
    <div class="empty" style={pad ? { padding: pad } : undefined}>
      {children}
    </div>
  );
}
export function Section({ children }: { children: ComponentChildren }) {
  return <div class="section-title">{children}</div>;
}
export const Grow = () => <span style={{ flex: 1 }} />;

// 나무 판자 제목 + 종이 패널
export function Panel({
  title,
  icon,
  tabs,
  tab,
  onTab,
  onClose,
  foot,
  bodyKey,
  children,
}: {
  title: ComponentChildren;
  icon: string;
  tabs?: [string, string, string?][];
  tab?: string;
  onTab?: (id: string) => void;
  onClose: () => void;
  foot?: ComponentChildren;
  bodyKey?: string;
  children: ComponentChildren;
}) {
  return (
    <div class="panel paper">
      <header class="plank">
        <h2>
          <Icon name={icon} />
          {title}
        </h2>
        <span class="nail a" />
        <span class="nail b" />
      </header>
      <button class="x" onClick={onClose} title="닫기 (Esc)">
        <Icon name="close" />
      </button>
      {tabs && (
        <div class="tabs">
          {tabs.map(([id, label, icn]) => (
            <button key={id} class={tab === id ? 'on' : ''} onClick={() => onTab?.(id)}>
              {icn && <Icon name={icn} />}
              {label}
            </button>
          ))}
        </div>
      )}
      <div class="body" key={bodyKey ?? tab}>
        {children}
      </div>
      {foot && <div class="foot">{foot}</div>}
    </div>
  );
}
