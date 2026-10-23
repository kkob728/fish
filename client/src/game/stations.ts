// 섬에 깔린 조리대들 (내 것 + 다른 플레이어 것)
import { on } from '../net.ts';
import { S } from '../state.ts';
import { buildStation } from '../scene/station.ts';

export function createStations(scene, fx) {
  const map = new Map(); // owner -> station api

  function set(st) {
    S.stations.set(st.owner, st);
    let s = map.get(st.owner);
    if (!s) {
      s = buildStation(st);
      scene.add(s.group);
      map.set(st.owner, s);
    } else s.set(st);
  }
  function remove(owner) {
    S.stations.delete(owner);
    const s = map.get(owner);
    if (!s) return;
    scene.remove(s.group);
    s.dispose();
    map.delete(owner);
  }

  on('station', (m) => set(m.station));
  on('stationGone', (m) => remove(m.owner));

  return {
    reset(list) {
      for (const o of [...map.keys()]) remove(o);
      for (const st of list || []) set(st);
    },
    update(dt) {
      for (const s of map.values()) s.update(dt, fx);
    },
  };
}
