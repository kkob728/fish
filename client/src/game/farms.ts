// 섬의 텃밭들: 서버가 보낸 밭 정보를 3D에 반영하고, 자라는 모습을 주기적으로 갱신
import { on, serverNow } from '../net.ts';
import { S } from '../state.ts';
import { buildFarm, type FarmView } from '../scene/farm.ts';
import { PLOT_COUNT, tilePos, tileActive } from '../../../shared/data/crops.ts';

export function createFarms(scene, fx) {
  const { plots } = buildFarm(scene);

  function set(v: FarmView) {
    // 같은 사람이 다른 밭에 있던 기록이 있으면 지움
    for (const [plot, f] of S.farms) if (f.owner === v.owner && plot !== v.plot) clear(plot);
    S.farms.set(v.plot, v);
    plots[v.plot].set(v, serverNow());
  }
  function clear(plot: number) {
    S.farms.delete(plot);
    plots[plot].set(null, serverNow());
  }
  function reset(list: FarmView[]) {
    for (let i = 0; i < PLOT_COUNT; i++) if (S.farms.has(i)) clear(i);
    for (const v of list || []) set(v);
  }

  on('farm', (m) => set(m.farm));
  on('farms', (m) => reset(m.list));
  // 물 주기·수확 효과
  on('farmDone', (m) => {
    const f = S.me?.farm && S.farms.get(S.me.farm.plot);
    if (!f || m.act === 'plant') return;
    const color = m.act === 'water' ? '#8fd0ff' : '#fff2a0';
    for (let k = 0; k < 16; k++) {
      if (!tileActive(f.size, k)) continue;
      const p = tilePos(f.plot, k);
      fx.sparkle(p.x, plots[f.plot].group.position.y + 0.4, p.z, color, m.act === 'water' ? 5 : 3, 0.8);
    }
  });

  let t = 0;
  return {
    reset,
    update(dt: number) {
      t += dt;
      const now = serverNow();
      for (const p of plots) p.sparkle(fx, now);
      if (t < 1) return;
      t = 0;
      for (const p of plots) p.refresh(now);
    },
  };
}
