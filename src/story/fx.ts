// Per-chapter choreography: overrides of the planet state, camera and scripted events.
import * as THREE from 'three';
import type { Where } from '../core/director';
import type { PlanetState } from './planetState';
import type { Shot } from '../planet/planetScene';
import type { Events } from '../planet/events';
import { clamp, hash, sramp, smooth, win } from '../core/hash';

const THEIA_HIT = 14; // seconds into the "theia" chapter
const CHICX_HIT = 9.5; // seconds into the "chicxulub" chapter

const DC = new THREE.Vector3(1, 0.32, 0.5).normalize(); // impact direction (world) for Theia
const DISK_N = new THREE.Vector3(0.16, 1, 0.34).normalize();

function diskBasis(ev: Events) {
  ev.disk.n.copy(DISK_N);
  ev.disk.e1.copy(DC).addScaledVector(DISK_N, -DC.dot(DISK_N)).normalize();
  ev.disk.e2.crossVectors(DISK_N, ev.disk.e1).normalize();
}

/** world position of the forming Moon at debris-time t */
function moonletPos(t: number, ev: Events): THREE.Vector3 {
  const r = 4.0;
  const th = 0.9 + 0.2 * t;
  return ev.disk.e1.clone().multiplyScalar(Math.cos(th) * r).addScaledVector(ev.disk.e2, Math.sin(th) * r);
}

export function applyFx(w: Where, year: number, s: PlanetState, shot: Shot, ev: Events, tAmb: number) {
  const { ch, tl, u } = w;
  ev.sats = s.satellites;
  switch (ch.id) {
    case 'theia': {
      diskBasis(ev);
      s.cloudCover = 0;
      s.ocean = 0;
      const after = tl - THEIA_HIT;
      if (after < 0) {
        s.lava = 0.4; s.crust = 0.85;
        const f = Math.pow(1 - tl / THEIA_HIT, 1.5);
        const C = DC.clone().multiplyScalar(1.46);
        const S = new THREE.Vector3(6.8, 2.6, -1.8);
        ev.theia.on = true;
        ev.theia.pos.copy(C).lerp(S, f);
        ev.theia.r = 0.53;
        ev.theia.heat = 0.22 + 0.5 * sramp(tl, THEIA_HIT - 2.5, THEIA_HIT);
      } else {
        const m = clamp(after / 2.2);
        ev.theia.on = m < 1;
        ev.theia.pos.copy(DC).multiplyScalar(1.46 * (1 - 0.5 * m));
        ev.theia.r = 0.53 * Math.pow(1 - m, 0.7);
        ev.theia.heat = 1;
        s.lava = 0.4 + 0.6 * sramp(after, 0, 3);
        s.crust = 0.85 - 0.75 * sramp(after, 0, 4);
        s.haze = 0.3 * sramp(after, 1, 6);
        s.hazeColor = [0.9, 0.45, 0.2];
        ev.flash = Math.pow(Math.max(0, 1 - after / 2.6), 2) * 0.8;
        ev.flashColor = [1, 0.95, 0.82];
        ev.shake = Math.max(0, 1 - after / 3);
        ev.impacts.push({ dirW: DC.clone(), age: after, crater: 0.55, shock: Math.min(2.5, after * 0.9), glow: 1, flash: Math.max(0, 1 - after / 4) });
        ev.debris.on = true;
        ev.debris.mode = 0;
        ev.debris.t = after;
        ev.debris.accrete = 0;
      }
      break;
    }
    case 'moon': {
      diskBasis(ev);
      s.cloudCover = 0;
      s.ocean = 0;
      s.lava = 1; s.crust = 0.15 + 0.2 * u;
      s.haze = 0.3; s.hazeColor = [0.9, 0.45, 0.2];
      const dt = tl + (30 - THEIA_HIT);
      const acc = sramp(tl, 3, 22);
      ev.debris.on = true;
      ev.debris.mode = 0;
      ev.debris.t = dt;
      ev.debris.accrete = acc;
      ev.moon.on = true;
      ev.moon.pos.copy(moonletPos(dt, ev));
      ev.moon.scale = 0.2727 * Math.cbrt(Math.max(0.0001, acc));
      ev.moon.lava = 1;
      ev.impacts.push({ dirW: DC.clone(), age: 16 + tl, crater: 0.55, shock: 0, glow: Math.max(0, 0.6 - tl / 30), flash: 0 });
      break;
    }
    case 'magma': {
      // glide the newborn Moon from its formation orbit to the regular placement
      if (tl < 4) {
        diskBasis(ev);
        const endPos = moonletPos(28 + 30 - THEIA_HIT, ev);
        ev.moon.on = true;
        const mAz = (shot.moonAz * Math.PI) / 180, mEl = (shot.moonEl * Math.PI) / 180;
        const reg = new THREE.Vector3(Math.sin(mAz) * Math.cos(mEl), Math.sin(mEl), -Math.cos(mAz) * Math.cos(mEl)).multiplyScalar(s.moonDist);
        ev.moon.pos.copy(endPos).lerp(reg, smooth(tl / 4));
        ev.moon.scale = 0.2727;
        ev.moon.lava = 1;
      }
      break;
    }
    case 'oceans': {
      s.storm = Math.max(s.storm, 0.8);
      break;
    }
    case 'bombard': {
      ev.meteors = win(u, 0.02, 0.97, 0.06);
      ev.meteorT = tl;
      // the latest hits glow on the surface
      const rate = 2.6 * ev.meteors;
      if (rate > 0) {
        for (let i = Math.floor(tl * rate); i >= 0 && ev.impacts.length < 4; i--) {
          const ts = i / rate + hash(i * 1.7) * 0.3 + 0.72;
          const age = tl - ts;
          if (age < 0) continue;
          if (age > 3) break;
          const a = hash(i * 3.1) * Math.PI * 2, b = Math.acos(0.25 + 0.75 * hash(i * 5.7));
          ev.impacts.push({ dirW: new THREE.Vector3(Math.sin(b) * Math.cos(a), Math.sin(b) * Math.sin(a), Math.cos(b)), age, crater: 0.03 + 0.03 * hash(i), shock: 0, glow: 1 - age / 3, flash: 0 });
        }
      }
      break;
    }
    case 'permian': {
      ev.traps = sramp(u, 0.03, 0.25) * (1 - 0.4 * sramp(u, 0.85, 1));
      s.oceanDeep = mix3(s.oceanDeep, [0.12, 0.22, 0.2], sramp(u, 0.3, 0.7));
      s.oceanShallow = mix3(s.oceanShallow, [0.3, 0.45, 0.32], sramp(u, 0.3, 0.7));
      s.atmoColor = mix3(s.atmoColor, [0.85, 0.55, 0.35], sramp(u, 0.2, 0.6));
      s.veg *= 1 - 0.6 * sramp(u, 0.4, 0.9);
      break;
    }
    case 'chicxulub': {
      const after = tl - CHICX_HIT;
      const yuc = new THREE.Vector3(0, 0, 1); // the shot centres Yucatán on the camera axis until the impact
      if (after < 0) {
        const S = new THREE.Vector3(-3.6, 2.4, 0.6);
        const f = Math.pow(1 - tl / CHICX_HIT, 1.25);
        ev.asteroid.on = true;
        ev.asteroid.pos.copy(yuc).multiplyScalar(1.004).lerp(S, f);
        ev.asteroid.glow = sramp(tl, CHICX_HIT - 0.5, CHICX_HIT);
      } else {
        ev.flash = Math.pow(Math.max(0, 1 - after / 2.4), 2) * 0.85;
        ev.flashColor = [1, 0.97, 0.9];
        ev.shake = Math.max(0, 1 - after / 2.5);
        ev.impacts.push({ dirW: yuc.clone(), age: after, crater: 0.03, shock: Math.min(2.6, after * 0.32), glow: Math.max(0, 1 - after / 8), flash: Math.max(0, 1 - after / 7) });
        ev.debris.on = true;
        ev.debris.mode = 1;
        ev.debris.t = after;
        ev.debris.fade = 1 - sramp(after, 12, 19);
        s.scorch = 0.88 * sramp(after, 3, 10);
        s.haze = Math.max(s.haze, 0.25 * sramp(after, 2, 8));
        s.hazeColor = [0.28, 0.2, 0.16];
      }
      break;
    }
    case 'cenozoic': {
      s.scorch = 0.88 * (1 - sramp(tl, 0, 6));
      s.haze = 0.25 * (1 - sramp(tl, 0, 6));
      s.hazeColor = [0.28, 0.2, 0.16];
      break;
    }
    case 'sapiens': case 'iceages': {
      const ka = (2026 - year) / 1000;
      if (ch.id === 'sapiens') ev.migration = ka;
      break;
    }
    case 'space': {
      ev.apollo = year >= 1968.9 ? clamp((year - 1968.9) / 0.9) : -1;
      break;
    }
    case 'internet': {
      ev.net = sramp(year, 1988, 2008);
      break;
    }
    case 'ai': {
      ev.net = 1;
      ev.ai = sramp(year, 2016, 2025);
      break;
    }
    case 'f2100': case 'f3000': case 'f5000': {
      ev.net = 1;
      ev.ai = 1;
      ev.stations = Math.round(2 + 40 * sramp(year, 2030, 3000) + 100 * sramp(year, 3000, 5000));
      ev.moonBase = sramp(year, 2035, 2150);
      break;
    }
  }
  if (ch.id === 'neolithic' || ch.id === 'cities') ev.migration = 11.7;
  // camera shake (deterministic)
  if (ev.shake > 0) {
    const k = Math.floor(tAmb * 30);
    shot.ox += (hash(k * 1.3) - 0.5) * 0.03 * ev.shake;
    shot.oy += (hash(k * 2.7 + 0.5) - 0.5) * 0.03 * ev.shake;
  }
}

function mix3(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
