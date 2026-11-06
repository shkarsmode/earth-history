// Surface dioramas, deep time: magma ocean, hydrothermal vent, stromatolites, Snowball Earth,
// Ediacaran and Cambrian sea floors.
import { PixBuf, hex, type RGBA } from '../gfx/pixbuf';
import { hash, clamp } from '../core/hash';
import {
  stex, samp,
  skyGradient, stars, moonDisc, sunDisc, ridge, water, pal, rampAt, lerpc, tn2, tfbm, fbm1, ellipse, glow, poly, rain, grade,
  bayer4, bayer8, shade, sphere, tintCircle,
} from './engine';
import { drawSprite } from './spr';

export interface Ctx { amb: number; year: number; u: number }

const wrapX = (x: number, W: number) => ((x % W) + W) % W;

// ============ Hadean magma ocean under a giant hot Moon ============
const LAVA = pal('#140405', '#3a0a07', '#7a1a0a', '#c23a10', '#f2741c', '#ffb53a', '#fff0a0');
export function magma(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h, hy = Math.round(H * 0.6);
  skyGradient(b, [[0, hex('#0e0306')], [0.45, hex('#260808')], [0.78, hex('#561409')], [1, hex('#a3360f')]], 0, hy);
  stars(b, 60, 3, hy * 0.45, c.amb, 0.45);
  // giant Moon, still glowing from its own formation
  const mx = W * 0.7, my = H * 0.26, mr = H * 0.16;
  moonDisc(b, mx, my, mr, [-0.7, -0.15, 0.7], { ramp: pal('#2a0806', '#5a160a', '#9a3412', '#d4652a', '#f6a04a', '#ffd88a'), glow: hex('#6a1c0c') });
  // steam / ash clouds drifting, lit from below by the lava
  const CL = stex('magmaClouds', 256, (x, y) => tfbm(x * 0.04, y * 0.12, 3));
  for (let y = 0; y < hy; y++) {
    const band = Math.exp(-Math.pow((y - hy * 0.55) / (hy * 0.16), 2));
    if (band < 0.05) continue;
    for (let x = 0; x < W; x++) {
      const n = samp(CL, (x + t * 4) * 0.5, y * 0.5);
      const v = n * band;
      if (v > 0.42) b.set(x, y, v > 0.5 ? (y > hy * 0.6 ? hex('#8a2e12') : hex('#4a160c')) : hex('#2e0c08'));
    }
  }
  // distant volcanic cones
  const cones = [0.12, 0.33, 0.52, 0.86].map((f, i) => ({ x: f * W, h: 26 + 18 * hash(i * 3.1), w: 34 + 20 * hash(i * 5.3) }));
  const tops = ridge(b, {
    base: hy - 4, amp: 5, freq: 0.03, seed: 4, fill: hex('#1a0605'), edge: hex('#4a140a'),
    peaks: (x) => { let p = 0; for (const k of cones) { const d = Math.abs(x - k.x) / k.w; if (d < 1) p = Math.max(p, k.h * (1 - d) * (1 - 0.25 * Math.max(0, 0.18 - d) / 0.18)); } return p; },
  });
  // lava rivers down the cones + fountains
  for (const [i, k] of cones.entries()) {
    const top = tops[Math.max(0, Math.min(W - 1, Math.round(k.x)))];
    for (let s = 0; s < 3; s++) {
      let x = k.x + (s - 1) * 2, y = top + 1;
      for (let j = 0; j < 40 && y < hy; j++) {
        x += (hash(i * 31 + s * 7 + j) - 0.5) * 1.6 + (s - 1) * 0.5;
        y += 1;
        const ph = (j * 0.15 - t * 1.2) % 1;
        b.set(Math.round(x), y, ph < -0.6 || (ph > 0 && ph < 0.4) ? hex('#ffb53a') : hex('#c23a10'));
      }
    }
    for (let p = 0; p < 26; p++) {
      const life = 1.4 + hash(i * 9 + p) * 0.8;
      const ph = ((t + hash(p * 3.3 + i)) % life) / life;
      const vx = (hash(p * 1.9 + i * 2) - 0.5) * 18, vy = 22 + 14 * hash(p * 7.7 + i);
      const px = k.x + vx * ph * life, py = top - vy * ph * life + 30 * ph * ph * life * life * 0.5;
      if (py < hy) b.set(Math.round(px), Math.round(py), ph < 0.4 ? hex('#fff0a0') : ph < 0.7 ? hex('#ffb53a') : hex('#c23a10'));
    }
    glow(b, k.x, top, 9, hex('#c23a10'), 0.5);
  }
  // the magma sea: perspective crack network, palette-cycled
  const LV = stex('magmaSea', 512, (x, y) => {
    const u = x / 512 * 40, v = y / 512 * 40;
    const c1 = 1 - Math.abs(tn2(u * 1.3 + 50, v * 1.3) * 2 - 1), c2 = 1 - Math.abs(tn2(u * 3.1, v * 3.1 + 80) * 2 - 1);
    return Math.max(c1 > 0.88 ? (c1 - 0.88) * 7 : 0, c2 > 0.93 ? (c2 - 0.93) * 9 : 0) + 0.18 * tn2(u * 0.7, v * 0.7) - 0.05;
  });
  for (let y = hy; y < H; y++) {
    const d = y - hy + 1;
    const z = 70 / d;
    const wz = (z * 0.6 + t * 0.35) * 12.8;
    const haze = Math.max(0, 0.35 - d / (H - hy) * 0.6) * 0.5;
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const wx = (x - W / 2) * z * 0.018 * 12.8;
      const heat = samp(LV, wx, wz) + haze + 0.12 * Math.sin(t * 2.4 + wx * 0.16 + wz * 0.08);
      b.u32[row + x] = rampAt(LAVA, heat < 0 ? 0 : heat > 1 ? 1 : heat, x, y);
    }
  }
  // sparks rising from the sea
  for (let i = 0; i < 90; i++) {
    const life = 2 + hash(i * 2.2) * 2;
    const ph = ((t * 0.9 + hash(i * 7.1) * life) % life) / life;
    const x0 = hash(i * 3.7) * W, y0 = hy + 10 + hash(i * 5.9) * (H - hy - 10);
    const x = x0 + Math.sin(ph * 6 + i) * 3, y = y0 - ph * 50;
    if (y < 0) continue;
    b.set(Math.round(x), Math.round(y), ph < 0.3 ? hex('#fff0a0') : ph < 0.7 ? hex('#f2741c') : hex('#7a1a0a'));
  }
  // lightning in the steam (deterministic)
  const slot = Math.floor(t * 2.3);
  if (hash(slot * 1.13) > 0.8 && (t * 2.3) % 1 < 0.25) {
    let x = hash(slot * 4.4) * W, y = hy * 0.35;
    for (let k = 0; k < 30 && y < hy - 4; k++) { const nx = x + (hash(slot * 9 + k) - 0.5) * 8; b.line(x, y, nx, y + 3, hex('#fff6e0')); x = nx; y += 3; }
  }
}

// ============ Hydrothermal vent: the cradle of life? ============
export function vent(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h;
  skyGradient(b, [[0, hex('#010306')], [0.55, hex('#03101c')], [1, hex('#072033')]], 0, H);
  // distant rift wall
  ridge(b, { base: H * 0.58, amp: 26, freq: 0.008, seed: 11, sharp: 0.5, fill: hex('#061019'), edge: hex('#0b1c2a') });
  ridge(b, { base: H * 0.7, amp: 16, freq: 0.014, seed: 12, sharp: 0.3, fill: hex('#08131c'), edge: hex('#10222e') });
  const floor = ridge(b, { base: H * 0.86, amp: 8, freq: 0.02, seed: 13, fill: hex('#0b0d11'), edge: hex('#1c2026'),
    shadeFn: (x, y, d) => (d > 1 && tn2(x * 0.2, y * 0.2) > 0.72 ? hex('#151a20') : null) });
  // chimney clusters: a mound with several knobbly spires
  const clusters = [{ x: 0.24, s: 1.0 }, { x: 0.6, s: 1.25 }, { x: 0.86, s: 0.7 }];
  const mouths: [number, number][] = [];
  for (const [ci, cl] of clusters.entries()) {
    const cx = Math.round(cl.x * W);
    const base = floor[Math.max(0, Math.min(W - 1, cx))] + 2;
    // mound
    for (let y = Math.round(base - 22 * cl.s); y <= base; y++) {
      const f = (base - y) / (22 * cl.s);
      const hw = 46 * cl.s * Math.sqrt(1 - f) + (tn2(ci * 7, y * 0.2) - 0.5) * 6;
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        const n = tn2(x * 0.18, y * 0.22 + ci * 5);
        b.set(x, y, n > 0.7 ? hex('#4a2c16') : n > 0.55 ? hex('#2a1e18') : hex('#17130f'));
      }
    }
    // spires
    const nsp = 3 + ci;
    for (let k = 0; k < nsp; k++) {
      const sx = cx + (k - (nsp - 1) / 2) * 16 * cl.s + (hash(ci * 13 + k) - 0.5) * 8;
      const h = (40 + hash(ci * 7 + k * 3) * 70) * cl.s;
      const top = base - 18 * cl.s - h;
      for (let y = Math.round(top); y < base - 10; y++) {
        const f = (y - top) / h;
        const hw = 2.5 + 4 * f * cl.s + (tn2(sx * 0.3, y * 0.35) - 0.5) * 3.2 + (Math.sin(y * 0.45 + k) > 0.75 ? 1.5 : 0);
        for (let x = Math.round(sx - hw); x <= Math.round(sx + hw); x++) {
          const e = (x - (sx - hw)) / (2 * hw);
          const n = tn2(x * 0.4 + k * 3, y * 0.3);
          let col = e < 0.25 ? hex('#3a3026') : e > 0.8 ? hex('#100e0c') : hex('#1e1a16');
          if (n > 0.74) col = hex('#6e3e18'); // iron-sulphide crust
          else if (n > 0.68 && e > 0.3) col = hex('#8a7428'); // sulphur
          if (f > 0.75 && tn2(x * 0.9, y * 0.9 + t) > 0.8) col = hex('#d8d0b0'); // white microbial mats near the warm base
          b.set(x, y, col);
        }
      }
      mouths.push([sx, top]);
      glow(b, sx, top + 1, 4, hex('#c0501c'), 0.8);
      b.hline(Math.round(sx - 1), Math.round(sx + 1), Math.round(top), hex('#ffc060'));
    }
    glow(b, cx, base - 8, 30 * cl.s, hex('#3a1408'), 0.35);
  }
  // billowing black smoke: big soft puffs rising and drifting with the current
  for (const [mi, [mx, my]] of mouths.entries()) {
    for (let p = 0; p < 34; p++) {
      const life = 7 + hash(mi * 3 + p) * 3;
      const ph = ((t * 0.55 + hash(mi * 11 + p * 1.7) * life) % life) / life;
      const y = my - ph * (my + 30);
      const x = mx + ph * 26 * Math.sin(t * 0.15 + mi) + (tn2(mi * 4 + p, t * 0.3 + ph * 4) - 0.5) * 18 * ph;
      const r = 1.5 + ph * 9;
      const col = ph < 0.12 ? hex('#4a3e34') : ph < 0.45 ? hex('#16141a') : hex('#0a0d14');
      for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) {
        const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y) / r;
        if (d < 1 && (1 - d) * 1.4 > bayer4(xx, yy) * (0.6 + ph)) b.set(xx, yy, col);
      }
    }
  }
  // drifting particles (marine snow), dim
  for (let i = 0; i < 60; i++) {
    const y = (hash(i * 1.9) * H + t * 2.5) % H, x = wrapX(hash(i * 3.3) * W + Math.sin(t * 0.5 + i) * 4, W);
    b.set(Math.round(x), Math.round(y), hex('#16303e'));
  }
  // shrimp-like specks? no — only shimmering warm water above the mouths
  for (const [mx, my] of mouths) for (let k = 0; k < 6; k++) {
    const ph = (t * 1.3 + k * 0.17) % 1;
    b.set(Math.round(mx + Math.sin(t * 5 + k) * 1.5), Math.round(my - 2 - ph * 8), hex('#7a3a1a'));
  }
}

// ============ Archean shore: stromatolites under an orange sky ============
export function stromatolites(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h, hy = Math.round(H * 0.52);
  skyGradient(b, [[0, hex('#4a2010')], [0.4, hex('#8a4418')], [0.75, hex('#d0782e')], [1, hex('#f2b26a')]], 0, hy);
  // faint young Sun low over the sea, haze rings
  sunDisc(b, W * 0.3, hy - 26, 7, hex('#fff2c8'), hex('#ffd890'), hex('#f0a050'), 4);
  // the Moon, a third bigger than today, pale in the haze
  moonDisc(b, W * 0.78, H * 0.17, H * 0.055, [-0.8, 0.3, 0.6], { ramp: pal('#8a4a26', '#a8643a', '#c8865a', '#e6b080', '#f6d0a4', '#fff0d0') });
  // hazy volcanic islands
  ridge(b, { base: hy - 3, amp: 9, freq: 0.02, seed: 21, sharp: 0.5, fill: hex('#7a3e1e'), edge: hex('#9a5428'), depth: 40,
    peaks: (x) => { const d = Math.abs(x - W * 0.62) / 50; return d < 1 ? 22 * (1 - d) * (1 - d) : 0; } });
  // smoke from the volcanic island
  for (let p = 0; p < 140; p++) {
    const ph = ((t * 0.15 + hash(p * 1.7)) % 1);
    const x = W * 0.62 + ph * 60 + (tn2(p * 0.2, t * 0.2) - 0.5) * 14 * ph;
    const y = hy - 25 - ph * 40;
    b.set(Math.round(x), Math.round(y), ph < 0.5 ? hex('#6a3a24') : hex('#8a5030'));
  }
  // sea: green-tinted (dissolved iron) reflecting the orange sky
  water(b, hy, hex('#3a6a56'), 0.45, t, { ripple: 1, sparkle: hex('#ffd890'), sparkleN: 50 });
  // tidal flat foreground
  const flat = ridge(b, { base: H * 0.76, amp: 5, freq: 0.012, seed: 27, fill: hex('#6a5432'), edge: hex('#8a7448'),
    shadeFn: (x, y, d) => (d < 3 ? hex('#7a6440') : tn2(x * 0.15, y * 0.3) > 0.68 ? hex('#4e4a2a') : tn2(x * 0.3 + 5, y * 0.5) > 0.8 ? hex('#3e5a32') : null) });
  // stromatolite domes: layered cabbage-like mounds
  const domes: [number, number, number, number][] = [];
  for (let i = 0; i < 14; i++) {
    const x = hash(i * 2.7) * W, row = hash(i * 5.1);
    const baseY = row < 0.5 ? hy + 6 + row * 30 : flat[Math.max(0, Math.min(W - 1, Math.round(x)))] + 2 + (row - 0.5) * 30;
    const r = 6 + hash(i * 9.3) * 12 * (0.6 + (baseY - hy) / (H - hy));
    domes.push([x, baseY, r, row]);
  }
  for (const [k, fx] of [0.12, 0.47, 0.83].entries()) domes.push([fx * W, flat[Math.round(fx * W)] + 10 + k * 3, 20 + k * 3, 1]);
  domes.sort((a, b2) => a[1] - b2[1]);
  for (const [x, by, r] of domes) {
    const h = r * 0.9;
    for (let y = Math.round(by - h); y <= by; y++) {
      const f = (by - y) / h;
      const hw = r * Math.sqrt(Math.max(0, 1 - f * f)) * (1 + 0.08 * Math.sin(y * 1.3));
      for (let xx = Math.round(x - hw); xx <= Math.round(x + hw); xx++) {
        const band = Math.floor((by - y + Math.sin(xx * 0.4) * 0.8) / 2) % 3;
        const lit = (xx - x) / Math.max(1, hw) < -0.2 ? 1 : (xx - x) / Math.max(1, hw) > 0.5 ? -1 : 0;
        let col = band === 0 ? hex('#8a7a4a') : band === 1 ? hex('#6e5e36') : hex('#5a6a38');
        if (lit > 0) col = shade(col, 1.18);
        if (lit < 0) col = shade(col, 0.75);
        if (y === Math.round(by - h) || Math.abs(xx - x) >= hw - 0.6) col = shade(col, 0.6);
        b.set(xx, y, col);
      }
    }
    // wet waterline + oxygen bubbles
    b.hline(Math.round(x - r), Math.round(x + r), Math.round(by), hex('#a8c0a0'));
    for (let k = 0; k < 3; k++) {
      const ph = ((t * 0.6 + hash(x + k)) % 1);
      b.set(Math.round(x + (hash(x * 3 + k) - 0.5) * r), Math.round(by - h - ph * 14), hex('#d8f0e0'));
    }
  }
  // lapping foam lines
  for (let i = 0; i < 5; i++) {
    const y = Math.round(flat[0] + 0) - 1;
    const ph = (t * 0.25 + i * 0.2) % 1;
    for (let x = 0; x < W; x++) if (tn2(x * 0.08 + i * 30, ph * 3) > 0.62) b.set(x, Math.round(y - ph * 3), hex('#e8e0c0'));
  }
}

// ============ Snowball Earth ============
export function snowball(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h, hy = Math.round(H * 0.55);
  skyGradient(b, [[0, hex('#6a8eb8')], [0.5, hex('#9cbcda')], [1, hex('#e6f2fa')]], 0, hy);
  // pale Sun with sun dogs (ice-crystal halo)
  const sx = W * 0.35, sy = hy - 40;
  sunDisc(b, sx, sy, 5, hex('#ffffff'), hex('#f4fbff'), hex('#cfe4f4'), 3);
  for (let a = 0; a < 360; a += 1.5) {
    const r = 30, x = sx + Math.cos((a * Math.PI) / 180) * r, y = sy + Math.sin((a * Math.PI) / 180) * r;
    if (bayer4(Math.round(x), Math.round(y)) < 0.6) b.set(Math.round(x), Math.round(y), hex('#eaf6ff'));
  }
  b.rect(Math.round(sx - 31), Math.round(sy - 1), 3, 3, hex('#fff4e0'));
  b.rect(Math.round(sx + 29), Math.round(sy - 1), 3, 3, hex('#fff4e0'));
  // volcano breaking through the ice, ash + CO₂ plume
  const vx = W * 0.72;
  ridge(b, { base: hy - 2, amp: 5, freq: 0.02, seed: 33, fill: hex('#b6cce0'), edge: hex('#e2eef8'),
    peaks: (x) => { const d = Math.abs(x - vx) / 70; return d < 1 ? 42 * (1 - d) * (1 - 0.3 * Math.max(0, 0.12 - d) / 0.12) : 0; },
    shadeFn: (x, y, d) => (Math.abs(x - vx) < 70 && d > 2 && tn2(x * 0.3, y * 0.3) > 0.55 ? hex('#4a4650') : null) });
  for (let p = 0; p < 420; p++) {
    const ph = ((t * 0.12 + hash(p * 1.31)) % 1);
    const x = vx + ph * 120 + (tn2(p * 0.15, t * 0.15) - 0.5) * 30 * (0.3 + ph);
    const y = hy - 44 - ph * 70 + Math.sin(ph * 4 + p) * 3;
    if (y < 0 || x > W) continue;
    b.set(Math.round(x), Math.round(y), ph < 0.25 ? hex('#3a3436') : ph < 0.6 ? hex('#5a5658') : hex('#8a8c94'));
    if (ph < 0.6) b.set(Math.round(x) + 1, Math.round(y), hex('#4a4648'));
  }
  glow(b, vx, hy - 43, 5, hex('#e86a2a'), 0.8);
  // ice plains with pressure ridges and crevasses
  for (let layer = 0; layer < 3; layer++) {
    const base = hy + 8 + layer * 26;
    ridge(b, { base, amp: 6 + layer * 2, freq: 0.03 + layer * 0.01, seed: 40 + layer, sharp: 0.7, scroll: t * (2 + layer * 4),
      fill: layer === 0 ? hex('#c8dcea') : layer === 1 ? hex('#d8e8f4') : hex('#eef6fc'),
      edge: hex('#ffffff'),
      shadeFn: (x, y, d) => {
        if (d > 2 && d < 6 && tn2((x + t * (2 + layer * 4)) * 0.1, y * 0.4 + layer * 10) > 0.75) return hex('#7aa6cc');
        if (d > 1 && tn2((x + t * (2 + layer * 4)) * 0.05, y * 0.15) > 0.8) return hex('#a6c6de');
        return null;
      } });
  }
  // blowing snow
  for (let i = 0; i < 260; i++) {
    const y = hash(i * 1.7) * H;
    const x = wrapX(hash(i * 2.9) * W - t * (60 + 40 * hash(i)), W);
    b.set(Math.round(x), Math.round(y + Math.sin(t * 3 + i) * 2), hex('#ffffff'));
    if (i % 3 === 0) b.set(Math.round(x) + 1, Math.round(y + Math.sin(t * 3 + i) * 2), hex('#e8f2fa'));
  }
}

// ============ underwater sea floor (Ediacaran / Cambrian) ============
function underwater(b: PixBuf, t: number, top: string, bottom: string, floorCol: string, floorEdge: string) {
  const W = b.w, H = b.h;
  skyGradient(b, [[0, hex(top)], [1, hex(bottom)]], 0, H);
  // surface ripple line + light shafts
  for (let x = 0; x < W; x++) if (tn2(x * 0.08 + t * 0.5, t * 0.3) > 0.55) b.set(x, 2 + Math.round(Math.sin(x * 0.2 + t) * 1), hex('#cfeef0'));
  for (let s = 0; s < 6; s++) {
    const x0 = (hash(s * 3.1) * W * 1.2 + Math.sin(t * 0.2 + s) * 20) - W * 0.1;
    const w = 8 + hash(s * 7) * 18;
    for (let y = 0; y < H * 0.85; y++) {
      const x = x0 + y * 0.35;
      for (let k = 0; k < w; k++) {
        const a = (1 - y / (H * 0.85)) * 0.35 * Math.sin((k / w) * Math.PI);
        if (a > bayer8(Math.round(x + k), y)) { const i = y * W + Math.round(x + k); if (Math.round(x + k) >= 0 && Math.round(x + k) < W) b.u32[i] = lerpc(b.u32[i], hex('#bfe8e0'), 0.25); }
      }
    }
  }
  return ridge(b, { base: H * 0.83, amp: 7, freq: 0.015, seed: 51, fill: hex(floorCol), edge: hex(floorEdge),
    shadeFn: (x, y, d) => (tn2(x * 0.25, y * 0.25) > 0.7 ? shade(hex(floorCol), 0.8) : tn2(x * 0.5 + 9, y * 0.5) > 0.82 ? shade(hex(floorCol), 1.15) : null) });
}

export function ediacara(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h;
  const fl = underwater(b, t, '#3a7a8a', '#0e3440', '#9a8a5e', '#b8a874');
  // microbial mat patches
  for (let x = 0; x < W; x++) { const y = fl[x]; if (tn2(x * 0.06, 3) > 0.5) { b.set(x, y, hex('#6a7a3e')); b.set(x, y + 1, hex('#5a6a34')); } }
  // fronds (Charnia-like) at several depths; procedural fallback if no sprite
  for (let i = 0; i < 16; i++) {
    const x = hash(i * 4.1) * W, depth = hash(i * 2.3);
    const by = fl[Math.max(0, Math.min(W - 1, Math.round(x)))] - 1 - depth * 20;
    const h = 14 + depth * 22;
    const sway = Math.sin(t * 0.8 + i) * 2;
    if (!drawSprite(b, 'charnia', x, by, t + i * 0.3, { tint: hex('#0e3440'), tintK: 0.45 * (1 - depth) })) {
      for (let y = 0; y < h; y++) {
        const f = y / h;
        const cx = x + sway * f * f;
        const hw = Math.sin(f * Math.PI) * (2 + depth * 2);
        for (let k = -hw; k <= hw; k++) b.set(Math.round(cx + k), Math.round(by - y), (Math.round(k + y) % 2 === 0) ? hex('#c8a87a') : hex('#a8885e'));
      }
    }
  }
  // Dickinsonia discs on the floor
  for (let i = 0; i < 7; i++) {
    const x = hash(i * 8.3 + 1) * W;
    const y = fl[Math.max(0, Math.min(W - 1, Math.round(x)))] + 4 + hash(i * 1.9) * 12;
    if (!drawSprite(b, 'dickinsonia', x, y, t)) {
      ellipse(b, x, y, 6, 2.5, hex('#c89a6a'));
      for (let k = -5; k <= 5; k += 2) b.vline(Math.round(x + k), Math.round(y - 2), Math.round(y + 2), hex('#9a6e48'));
    }
  }
  // marine snow
  for (let i = 0; i < 90; i++) {
    const y = (hash(i * 1.9) * H + t * 4) % H, x = wrapX(hash(i * 3.3) * W + Math.sin(t * 0.5 + i) * 4, W);
    b.set(Math.round(x), Math.round(y), hex('#9ccfd0'));
  }
}

export function cambrian(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h;
  const fl = underwater(b, t, '#2e8a9a', '#0a3040', '#8a7a52', '#a8986a');
  // sponges, algae
  for (let i = 0; i < 22; i++) {
    const x = hash(i * 6.1) * W;
    const by = fl[Math.max(0, Math.min(W - 1, Math.round(x)))];
    const kind = hash(i * 2.9);
    if (kind < 0.4) { // tube sponge
      const h = 10 + hash(i) * 20;
      for (let y = 0; y < h; y++) { b.hline(Math.round(x - 2), Math.round(x + 2), Math.round(by - y), y > h - 2 ? hex('#3a2a20') : hex('#d8904a')); b.set(Math.round(x - 2), Math.round(by - y), hex('#a86a3a')); }
    } else if (kind < 0.75) { // algae fronds
      for (let s = 0; s < 4; s++) {
        let px = x + s * 2, py = by;
        for (let y = 0; y < 16 + s * 3; y++) { px += Math.sin(t * 1.2 + y * 0.3 + s + i) * 0.4; py -= 1; b.set(Math.round(px), Math.round(py), y % 4 === 0 ? hex('#6a9a3a') : hex('#4a7a2e')); }
      }
    } else ellipse(b, x, by - 2, 4, 3, hex('#b84a5a')); // anemone-like
  }
  // trilobites crawling
  for (let i = 0; i < 9; i++) {
    const speed = 4 + hash(i) * 6;
    const x = wrapX(hash(i * 3.7) * W + t * speed * (i % 2 ? 1 : -1), W + 40) - 20;
    const y = fl[Math.max(0, Math.min(W - 1, Math.round(x)))] + 3 + hash(i * 1.3) * 14;
    if (!drawSprite(b, 'trilobite', x, y, t + i, { flip: i % 2 === 0 })) ellipse(b, x, y - 2, 6, 3, hex('#7a5a3a'));
  }
  // jellyfish drifting
  for (let i = 0; i < 4; i++) {
    const x = hash(i * 9.1) * W + Math.sin(t * 0.2 + i) * 20, y = H * 0.2 + hash(i * 4.4) * H * 0.3 + Math.sin(t * 0.7 + i) * 6;
    drawSprite(b, 'jellyfish', x, y, t + i * 0.5);
  }
  // Anomalocaris sweeping across
  const ax = wrapX(t * 26, W + 120) - 60;
  if (!drawSprite(b, 'anomalocaris', ax, H * 0.45 + Math.sin(t * 0.9) * 8, t)) ellipse(b, ax, H * 0.45, 14, 4, hex('#a8503a'));
  drawSprite(b, 'hallucigenia', W * 0.7, fl[Math.round(W * 0.7)] + 6, t);
  for (let i = 0; i < 70; i++) {
    const y = (hash(i * 1.9) * H + t * 4) % H, x = wrapX(hash(i * 3.3) * W + Math.sin(t * 0.5 + i) * 4, W);
    b.set(Math.round(x), Math.round(y), hex('#a8e0e0'));
  }
}

export { grade, rain, poly, sphere, tintCircle, fbm1 };
