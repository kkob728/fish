// 바다 위의 배들: 서버 정보로 그리고, 내가 선장이면 직접 조종(위치는 내가 정해서 서버에 보냄)
import { on, send, serverNow } from '../net.ts';
import { S } from '../state.ts';
import { sfx } from '../audio.ts';
import { toast } from '../ui/store.tsx';
import { buildBoat } from '../scene/boat.ts';
import { terrainHeight, ZONES } from '../../../shared/world.ts';
import { BOAT, boatAllowed, boatBlocked, seatWorld, ZONE_BOAT } from '../../../shared/sea.ts';

type View = ReturnType<typeof buildBoat>;
interface Entry {
  data: any; // 서버가 보낸 배 정보 {owner,tier,color,name,x,z,ry,v,anchored,seats}
  view: View;
  buf: { t: number; x: number; z: number; ry: number; v: number }[];
  x: number;
  z: number;
  ry: number;
  v: number;
  bob: number;
}

export function createBoats({ scene, fx }) {
  const list = new Map<string, Entry>();
  let sendT = 0;
  let warnT = 0;

  function set(d) {
    S.boats.set(d.owner, d);
    let e = list.get(d.owner);
    if (!e) {
      const view = buildBoat(d);
      scene.add(view.group);
      e = { data: d, view, buf: [], x: d.x, z: d.z, ry: d.ry, v: d.v, bob: 0 };
      list.set(d.owner, e);
    } else {
      e.view.set(d);
      e.data = d;
      // 내가 모는 배는 위치를 내 것으로 유지
      if (!isCaptainOf(d.owner)) Object.assign(e, { x: d.x, z: d.z, ry: d.ry });
    }
  }
  function remove(owner: string) {
    S.boats.delete(owner);
    const e = list.get(owner);
    if (!e) return;
    scene.remove(e.view.group);
    e.view.dispose();
    list.delete(owner);
  }
  const isCaptainOf = (owner: string) => S.ride?.owner === owner && S.ride.seat === 0;

  on('boat', (m) => set(m.boat));
  on('boatGone', (m) => remove(m.owner));
  on('ride', (m) => {
    S.ride = m.owner ? { owner: m.owner, seat: m.seat } : null;
    if (m.owner && m.seat === 0) {
      toast('W/S로 속도, A/D로 방향을 바꿔요. Space로 닻을 내리면 낚시할 수 있어요.', 'info', 6000, 'boat');
      sfx.splash(0.8);
    }
  });
  on('boatFix', (m) => {
    const e = S.ride && list.get(S.ride.owner);
    if (!e) return;
    Object.assign(e, { x: m.x, z: m.z, ry: m.ry, v: 0 });
  });
  on('snap', (m) => {
    for (const [owner, x, z, ry, v] of m.b || []) {
      const e = list.get(owner);
      if (!e || isCaptainOf(owner)) continue;
      e.buf.push({ t: m.time, x, z, ry, v });
      if (e.buf.length > 30) e.buf.shift();
    }
  });

  function warn(text: string) {
    if (warnT > 0) return;
    warnT = 2.5;
    toast(text, 'warn', 2400, 'boat');
  }

  // 선장 조종: input.y 앞뒤(-1..1), input.x 좌우(-1..1)
  function drive(e: Entry, dt: number, input: { x: number; y: number }) {
    const spec = BOAT(e.data.tier);
    const rough = S.weather.id === 'storm' && !spec.storm;
    const max = spec.speed * (rough ? 0.6 : 1);
    if (e.data.anchored) {
      e.v *= Math.exp(-dt * 3);
      if (Math.abs(input.y) > 0.3) warn('닻이 내려져 있어요. Space(휴대폰은 점프 버튼)로 닻을 올리세요.');
    } else {
      const target = input.y >= 0 ? input.y * max : input.y * max * 0.35;
      e.v += (target - e.v) * Math.min(1, dt * (Math.abs(target) > Math.abs(e.v) ? 0.7 : 1.4));
      const grip = Math.min(1, Math.max(0.25, Math.abs(e.v) / 3));
      e.ry -= input.x * spec.turn * dt * grip * (e.v < -0.1 ? -1 : 1);
    }
    if (rough) e.ry += Math.sin(serverNow() / 900) * dt * 0.08;
    const nx = e.x + Math.sin(e.ry) * e.v * dt;
    const nz = e.z + Math.cos(e.ry) * e.v * dt;
    if (boatBlocked(terrainHeight, nx, nz, spec.len * 0.32)) {
      if (Math.abs(e.v) > 2) {
        sfx.snap();
        warn('쿵! 무언가에 부딪혔어요.');
      }
      e.v = -e.v * 0.25;
    } else if (!boatAllowed(e.data.tier, nx, nz)) {
      e.v = 0;
      const nextTier = Math.min(3, e.data.tier + 1);
      warn(`${spec.name}으로는 더 멀리 못 가요. ${BOAT(nextTier).name}이 필요해요.`);
    } else {
      e.x = nx;
      e.z = nz;
    }
    sendT -= dt;
    if (sendT <= 0) {
      sendT = 0.1;
      send('boatSt', { x: +e.x.toFixed(2), z: +e.z.toFixed(2), ry: +e.ry.toFixed(3), v: +e.v.toFixed(2) });
    }
  }

  function interpolate(e: Entry) {
    const b = e.buf;
    if (!b.length) return;
    const renderT = serverNow() - 150;
    let s0 = b[0], s1 = b[b.length - 1];
    for (let i = 0; i < b.length - 1; i++) {
      if (b[i].t <= renderT && b[i + 1].t >= renderT) {
        s0 = b[i];
        s1 = b[i + 1];
        break;
      }
    }
    const span = s1.t - s0.t;
    const k = span > 0 ? Math.min(1, Math.max(0, (renderT - s0.t) / span)) : 1;
    e.x = s0.x + (s1.x - s0.x) * k;
    e.z = s0.z + (s1.z - s0.z) * k;
    let d = s1.ry - s0.ry;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    e.ry = s0.ry + d * k;
    e.v = s1.v;
  }

  return {
    list,
    reset(all) {
      for (const o of [...list.keys()]) remove(o);
      for (const d of all || []) set(d);
    },
    toggleAnchor() {
      const e = S.ride && list.get(S.ride.owner);
      if (!e || S.ride.seat !== 0) return false;
      if (!e.data.anchored && Math.abs(e.v) > 1.5) {
        warn('속도를 줄인 다음 닻을 내리세요.');
        return true;
      }
      send('boatAnchor', { on: !e.data.anchored });
      sfx.splash(0.6);
      return true;
    },
    // 가까운 배 (타기용)
    nearest(x: number, z: number, maxD = 6) {
      let best = null, bd = maxD;
      for (const e of list.values()) {
        const d = Math.hypot(e.x - x, e.z - z);
        if (d < bd) {
          bd = d;
          best = e.data;
        }
      }
      return best;
    },
    update(dt: number, input: { x: number; y: number }) {
      warnT -= dt;
      const rough = S.weather.id === 'storm';
      for (const e of list.values()) {
        if (isCaptainOf(e.data.owner)) drive(e, dt, input);
        else interpolate(e);
        e.view.group.position.set(e.x, 0, e.z);
        e.view.group.rotation.y = e.ry;
        e.bob = e.view.update(dt, { v: e.v, anchored: e.data.anchored, rough: rough && !BOAT(e.data.tier).storm });
        // 뱃머리 물보라와 꼬리 물살
        if (Math.abs(e.v) > 1.5 && Math.random() < dt * Math.abs(e.v) * 1.5) {
          const L = BOAT(e.data.tier).len / 2;
          const bx = e.x - Math.sin(e.ry) * L, bz = e.z - Math.cos(e.ry) * L;
          fx.puff.spawn({ x: bx + (Math.random() - 0.5), y: 0.1, z: bz + (Math.random() - 0.5), vy: 0.2, color: '#f4fbff', size: 0.9, grow: 2, life: 1.2, alpha: 0.5 });
          if (Math.random() < 0.3) fx.ripple(e.x + Math.sin(e.ry) * L, e.z + Math.cos(e.ry) * L);
        }
      }
      if (S.ride) {
        const e = list.get(S.ride.owner);
        if (e) S.rideInfo = { v: e.v, anchored: e.data.anchored, name: e.data.name, tier: e.data.tier, captain: S.ride.seat === 0 };
      } else S.rideInfo = null;
    },
    // 내가 탄 자리의 위치 (플레이어를 여기에 둠)
    ridePose() {
      const e = S.ride && list.get(S.ride.owner);
      if (!e) return null;
      const w = seatWorld({ tier: e.data.tier, x: e.x, z: e.z, ry: e.ry }, S.ride.seat);
      return { x: w.x, y: w.y + e.bob, z: w.z, ry: e.ry, seated: e.data.tier < 3, follow: S.ride.seat === 0 && Math.abs(e.v) > 1, cam: [7, 10, 14][e.data.tier - 1] };
    },
  };
}

// 이 구역에서 낚시하려면 필요한 배 (없으면 null)
export function boatNeedFor(zone: string) {
  const need = ZONE_BOAT[zone];
  if (!need) return null;
  const b = S.ride ? S.boats.get(S.ride.owner) : null;
  if (b && b.tier >= need) return null;
  return `${ZONES[zone].name}은(는) ${BOAT(need).name} 이상을 타고 와야 해요.`;
}
