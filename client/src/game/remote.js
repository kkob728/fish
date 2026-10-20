import * as THREE from 'three';
import { buildCharacter } from '../scene/character.js';
import { makeBobber, makeLine, updateLine } from './fishing.js';
import { makeFish, displayScale } from '../scene/fishModel.js';
import { serverNow } from '../net.js';

const ANIM = ['idle', 'walk', 'run', 'charge', 'idle'];
const _tip = new THREE.Vector3();

export function createRemotes({ scene, fx }) {
  const list = new Map();

  function ensure(meta) {
    let r = list.get(meta.id);
    if (r) return r;
    const char = buildCharacter(meta.color, { name: meta.name });
    char.setRod(meta.rod);
    scene.add(char.root);
    const bobber = makeBobber();
    const line = makeLine();
    bobber.visible = line.visible = false;
    scene.add(bobber, line);
    r = { meta, char, buf: [], bobber, line, fish: null, fishUntil: 0, lastF: 0 };
    list.set(meta.id, r);
    return r;
  }

  function remove(id) {
    const r = list.get(id);
    if (!r) return;
    scene.remove(r.char.root, r.bobber, r.line);
    if (r.fish) r.fish.dispose();
    list.delete(id);
  }

  return {
    list,
    add: ensure,
    remove,
    meta(m) {
      const r = list.get(m.id);
      if (!r) return ensure(m);
      r.meta = m;
      r.char.setRod(m.rod);
    },
    snapshot(time, entries, myId) {
      for (const [id, x, y, z, ry, a, f, bx, bz] of entries) {
        if (id === myId) continue;
        const r = list.get(id);
        if (!r) continue;
        r.buf.push({ t: time, x, y, z, ry, a, f, bx, bz });
        if (r.buf.length > 30) r.buf.shift();
      }
    },
    showCatch(id, rec) {
      const r = list.get(id);
      if (!r) return;
      if (r.fish) {
        r.char.holder.remove(r.fish.group);
        r.fish.dispose();
      }
      r.fish = makeFish(rec.sp, rec.v, { fx, wiggle: 0.12 });
      r.fish.group.scale.setScalar(displayScale(rec.len));
      r.fish.group.rotation.y = Math.PI / 2;
      r.char.holder.add(r.fish.group);
      r.fishUntil = performance.now() + 4000;
      const p = r.char.root.position;
      fx.sparkle(p.x, p.y + 2.4, p.z, '#fff6b0', 30, 1.5);
    },
    nearest(pos, maxDist = 20) {
      let best = null, bd = maxDist;
      for (const r of list.values()) {
        const d = r.char.root.position.distanceTo(pos);
        if (d < bd) {
          bd = d;
          best = r;
        }
      }
      return best;
    },
    update(dt, t) {
      const renderT = serverNow() - 150;
      for (const r of list.values()) {
        const b = r.buf;
        if (!b.length) continue;
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
        const root = r.char.root;
        root.position.set(s0.x + (s1.x - s0.x) * k, s0.y + (s1.y - s0.y) * k, s0.z + (s1.z - s0.z) * k);
        let d = s1.ry - s0.ry;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        root.rotation.y = s0.ry + d * k;
        const f = s1.f;
        let anim = ANIM[s1.a] || 'idle';
        if (f === 2) anim = 'wait';
        else if (f === 3) anim = 'bite';
        else if (f === 4) anim = 'fight';
        const showing = r.fish && performance.now() < r.fishUntil;
        if (showing) anim = 'show';
        else if (r.fish) {
          r.char.holder.remove(r.fish.group);
          r.fish.dispose();
          r.fish = null;
        }
        if (r.lastF < 2 && f >= 2) r.char.triggerCast();
        if (r.lastF >= 2 && f < 2 && f !== 5) fx.ripple(r.bobber.position.x, r.bobber.position.z);
        r.lastF = f;
        r.char.animate(anim, dt);
        r.fish?.update(dt);

        const fishing = f >= 2 && f <= 4;
        r.bobber.visible = r.line.visible = fishing;
        if (fishing) {
          let y = Math.sin(t * 2.2 + root.position.x) * 0.04;
          let ox = 0, oz = 0;
          if (f === 3) y = -0.3;
          if (f === 4) {
            ox = Math.sin(t * 7) * 0.3;
            oz = Math.cos(t * 5.3) * 0.3;
            y = -0.15;
            if (Math.random() < dt * 4) fx.ripple(s1.bx + ox, s1.bz + oz);
          }
          r.bobber.position.set(s1.bx + ox, y, s1.bz + oz);
          r.char.rodTip.getWorldPosition(_tip);
          updateLine(r.line, _tip, r.bobber.position, f === 2 ? 0.3 : 0.02);
        }
      }
    },
  };
}
