// Procedural pixel plants. Each takes a seed so the same plant is drawn identically every frame.
// `sil` draws a flat silhouette (distant layers), otherwise 2–3 shades with a darker outline side.
import { PixBuf, hex, type RGBA } from '../gfx/pixbuf';
import { hash } from '../core/hash';
import { ellipse, shade, bayer4 } from './engine';

export interface PlantStyle { trunk: RGBA; trunkDark: RGBA; leaf: RGBA; leafDark: RGBA; leafLight: RGBA; sil?: RGBA }

const col = (s: PlantStyle, c: RGBA) => s.sil ?? c;

function blob(b: PixBuf, cx: number, cy: number, rx: number, ry: number, s: PlantStyle, seed: number) {
  // leafy clump: dark base, mid, light top-left; ragged edge
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    const d = dx * dx + dy * dy;
    const jag = (hash(seed + x * 0.37 + y * 1.91) - 0.5) * 0.35;
    if (d + jag > 1) continue;
    let c = s.leaf;
    if (dx + dy > 0.45) c = s.leafDark;
    else if (dx + dy < -0.55 && d < 0.7) c = s.leafLight;
    if (hash(seed * 3 + x * 1.7 + y * 2.3) > 0.9) c = c === s.leaf ? s.leafDark : s.leaf;
    b.set(x, y, col(s, c));
  }
}

/** Lepidodendron-like lycopsid: tall column with diamond bark and a forked crown */
export function lycopsid(b: PixBuf, x: number, base: number, h: number, w: number, s: PlantStyle, seed: number, sway = 0) {
  const top = base - h;
  for (let y = Math.round(top); y < base; y++) {
    const f = (y - top) / h;
    const hw = w * (0.75 + 0.35 * f) + (f > 0.93 ? (f - 0.93) * 40 : 0);
    for (let xx = Math.round(x - hw); xx <= Math.round(x + hw); xx++) {
      const e = (xx - (x - hw)) / (2 * hw);
      const diamond = (Math.abs(((xx + (Math.floor(y / 3) % 2) * 2) % 4) - 2) + Math.abs((y % 3) - 1)) < 1.5;
      let c = e < 0.3 ? s.trunk : e > 0.72 ? s.trunkDark : diamond ? s.trunkDark : s.trunk;
      if (e < 0.12) c = shade(s.trunk, 1.15);
      b.set(xx, y, col(s, c));
    }
  }
  // dichotomous crown
  const forks = (px: number, py: number, ang: number, len: number, depth: number) => {
    const ex = px + Math.sin(ang) * len + sway * (3 - depth), ey = py - Math.cos(ang) * len;
    const n = Math.ceil(len);
    for (let i = 0; i <= n; i++) { const fx = px + (ex - px) * (i / n), fy = py + (ey - py) * (i / n); b.set(Math.round(fx), Math.round(fy), col(s, s.trunkDark)); if (depth > 1) b.set(Math.round(fx) + 1, Math.round(fy), col(s, s.trunk)); }
    if (depth <= 0) { blob(b, ex, ey, 3 + len * 0.18, 2 + len * 0.12, s, seed + px); return; }
    forks(ex, ey, ang - 0.45 - hash(seed + depth) * 0.2, len * 0.72, depth - 1);
    forks(ex, ey, ang + 0.45 + hash(seed + depth + 9) * 0.2, len * 0.72, depth - 1);
  };
  forks(x, top + 1, -0.1, h * 0.12 + 4, 2);
}

/** tree fern / seed fern: thin trunk, crown of arching fronds */
export function treefern(b: PixBuf, x: number, base: number, h: number, s: PlantStyle, seed: number, sway = 0) {
  for (let y = Math.round(base - h); y < base; y++) { b.set(Math.round(x), y, col(s, s.trunk)); b.set(Math.round(x) + 1, y, col(s, s.trunkDark)); if (y % 4 === 0) b.set(Math.round(x) - 1, y, col(s, s.trunkDark)); }
  const n = 7;
  for (let k = 0; k < n; k++) {
    const a = -1.4 + (k / (n - 1)) * 2.8 + (hash(seed + k) - 0.5) * 0.2;
    const len = h * 0.42 + hash(seed + k * 3) * 6;
    let px = x, py = base - h;
    for (let i = 0; i < len; i++) {
      const f = i / len;
      px += Math.sin(a) * 1;
      py += -Math.cos(a) * 1 + f * 1.6 + sway * 0.1;
      const c = f < 0.5 ? s.leaf : s.leafDark;
      b.set(Math.round(px), Math.round(py), col(s, c));
      if (i % 2 === 0 && f > 0.15) { b.set(Math.round(px), Math.round(py) + 1, col(s, s.leafLight)); b.set(Math.round(px), Math.round(py) - 1, col(s, s.leaf)); }
    }
  }
}

/** horsetail (Calamites): segmented stems with whorls */
export function horsetail(b: PixBuf, x: number, base: number, h: number, s: PlantStyle, seed: number, sway = 0) {
  for (let y = 0; y < h; y++) {
    const px = Math.round(x + sway * (y / h) * (y / h) * 2);
    b.set(px, Math.round(base - y), col(s, y % 5 === 0 ? s.trunkDark : s.trunk));
    if (y % 5 === 0 && y > 3) { for (let k = 1; k <= 3 + (h - y) / 8; k++) { b.set(px - k, Math.round(base - y + k * 0.5), col(s, s.leaf)); b.set(px + k, Math.round(base - y + k * 0.5), col(s, s.leafDark)); } }
  }
}

/** Araucaria-like conifer: tall bare trunk, flat tiers of foliage at the top */
export function conifer(b: PixBuf, x: number, base: number, h: number, s: PlantStyle, seed: number) {
  const top = base - h;
  for (let y = Math.round(top); y < base; y++) { const hw = 1 + (y - top) / h * 1.5; for (let xx = Math.round(x - hw); xx <= Math.round(x + hw); xx++) b.set(xx, y, col(s, xx < x ? s.trunk : s.trunkDark)); }
  const tiers = 4;
  for (let k = 0; k < tiers; k++) {
    const ty = top + k * h * 0.07 + 2;
    const tw = h * (0.12 + k * 0.05) * (0.85 + hash(seed + k) * 0.3);
    blob(b, x + (hash(seed + k * 7) - 0.5) * 4, ty, tw, 2.5 + k * 0.5, s, seed + k * 13);
  }
}

/** cycad: stout trunk with a rosette of stiff fronds */
export function cycad(b: PixBuf, x: number, base: number, sz: number, s: PlantStyle, seed: number) {
  const th = sz * 0.6;
  for (let y = Math.round(base - th); y < base; y++) for (let xx = Math.round(x - sz * 0.18); xx <= Math.round(x + sz * 0.18); xx++) b.set(xx, y, col(s, (xx + y) % 3 === 0 ? s.trunkDark : s.trunk));
  for (let k = 0; k < 9; k++) {
    const a = -1.5 + (k / 8) * 3;
    let px = x, py = base - th;
    for (let i = 0; i < sz * 0.8; i++) { px += Math.sin(a) * 1.1; py -= Math.cos(a) * 0.9 - i * 0.025; b.set(Math.round(px), Math.round(py), col(s, i % 2 ? s.leaf : s.leafDark)); }
  }
}

export function palm(b: PixBuf, x: number, base: number, h: number, s: PlantStyle, seed: number, sway = 0) {
  let px = x;
  const lean = (hash(seed) - 0.5) * 0.5;
  for (let y = 0; y < h; y++) { px += lean * (y / h); b.set(Math.round(px), Math.round(base - y), col(s, y % 3 === 0 ? s.trunkDark : s.trunk)); b.set(Math.round(px) + 1, Math.round(base - y), col(s, s.trunkDark)); }
  const tx = px, ty = base - h;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + hash(seed + k);
    let fx = tx, fy = ty;
    const len = h * 0.45;
    for (let i = 0; i < len; i++) { fx += Math.cos(a) * 1.1; fy += Math.sin(a) * 0.45 + (i / len) * 1.4 + sway * 0.05; b.set(Math.round(fx), Math.round(fy), col(s, i < len * 0.5 ? s.leaf : s.leafDark)); if (i % 2) b.set(Math.round(fx), Math.round(fy) + 1, col(s, s.leafDark)); }
  }
}

export function acacia(b: PixBuf, x: number, base: number, sz: number, s: PlantStyle, seed: number) {
  const h = sz * 0.9;
  for (let y = 0; y < h; y++) { const px = x + Math.sin(y * 0.15 + seed) * 1.5; b.set(Math.round(px), Math.round(base - y), col(s, s.trunk)); }
  for (const dx of [-1, 1]) { let px = x, py = base - h * 0.6; for (let i = 0; i < sz * 0.4; i++) { px += dx; py -= 0.6; b.set(Math.round(px), Math.round(py), col(s, s.trunkDark)); } }
  // flat umbrella crown
  for (let y = Math.round(base - h - 4); y <= base - h + 2; y++) {
    const f = (y - (base - h - 4)) / 6;
    const hw = sz * (0.55 + 0.25 * Math.sin(f * Math.PI));
    for (let xx = Math.round(x - hw); xx <= Math.round(x + hw); xx++) {
      if (hash(seed + xx * 0.7 + y * 1.3) > 0.88) continue;
      b.set(xx, y, col(s, y < base - h - 2 ? s.leafLight : y > base - h ? s.leafDark : s.leaf));
    }
  }
}

export function broadleaf(b: PixBuf, x: number, base: number, sz: number, s: PlantStyle, seed: number, flowers?: RGBA) {
  const h = sz * 0.8;
  for (let y = 0; y < h; y++) for (let k = -1; k <= 1; k++) b.set(Math.round(x + k), Math.round(base - y), col(s, k < 1 ? s.trunk : s.trunkDark));
  const n = 4;
  for (let k = 0; k < n; k++) blob(b, x + (hash(seed + k) - 0.5) * sz * 0.9, base - h - (hash(seed + k * 5) - 0.3) * sz * 0.5, sz * 0.35 + hash(seed + k * 2) * sz * 0.15, sz * 0.25, s, seed + k * 17);
  if (flowers && !s.sil) for (let k = 0; k < sz * 1.5; k++) {
    const fx = x + (hash(seed + k * 3.3) - 0.5) * sz * 1.3, fy = base - h - (hash(seed + k * 7.7) - 0.2) * sz * 0.6;
    b.set(Math.round(fx), Math.round(fy), flowers);
  }
}

export function deadtree(b: PixBuf, x: number, base: number, h: number, c: RGBA, seed: number) {
  const br = (px: number, py: number, ang: number, len: number, d: number) => {
    const ex = px + Math.sin(ang) * len, ey = py - Math.cos(ang) * len;
    const n = Math.ceil(len);
    for (let i = 0; i <= n; i++) b.set(Math.round(px + (ex - px) * i / n), Math.round(py + (ey - py) * i / n), c);
    if (d <= 0) return;
    br(ex, ey, ang - 0.5 - hash(seed + d) * 0.3, len * 0.65, d - 1);
    br(ex, ey, ang + 0.4 + hash(seed + d + 3) * 0.3, len * 0.6, d - 1);
  };
  for (let y = 0; y < h * 0.5; y++) { b.set(Math.round(x), Math.round(base - y), c); b.set(Math.round(x) + 1, Math.round(base - y), c); }
  br(x, base - h * 0.5, -0.1, h * 0.35, 3);
}

/** a strip of grass / reeds along the ground line, swaying */
export function grass(b: PixBuf, tops: Int16Array | number, x0: number, x1: number, density: number, h: number, cs: RGBA[], t: number, seed: number) {
  for (let x = x0; x < x1; x++) {
    if (hash(seed + x * 0.731) > density) continue;
    const gy = typeof tops === 'number' ? tops : tops[Math.max(0, Math.min(tops.length - 1, x))];
    const hh = h * (0.5 + hash(seed + x * 1.37));
    const sw = Math.sin(t * 1.5 + x * 0.12) * 1.2;
    const c = cs[Math.floor(hash(seed + x * 2.9) * cs.length)];
    for (let y = 0; y < hh; y++) b.set(Math.round(x + sw * (y / hh) * (y / hh)), gy - y, c);
  }
}

/** puffy pixel cloud */
export function cloud(b: PixBuf, cx: number, cy: number, w: number, light: RGBA, mid: RGBA, dark: RGBA, seed: number) {
  const n = 5 + Math.floor(w / 12);
  for (let k = 0; k < n; k++) {
    const px = cx + (k / (n - 1) - 0.5) * w, r = w * (0.12 + 0.12 * Math.sin((k / (n - 1)) * Math.PI)) * (0.8 + hash(seed + k) * 0.4);
    ellipse(b, px, cy - r * 0.3, r, r * 0.8, mid);
  }
  for (let k = 0; k < n; k++) {
    const px = cx + (k / (n - 1) - 0.5) * w, r = w * (0.12 + 0.12 * Math.sin((k / (n - 1)) * Math.PI)) * (0.8 + hash(seed + k) * 0.4);
    ellipse(b, px - r * 0.2, cy - r * 0.5, r * 0.7, r * 0.55, light);
  }
  for (let x = Math.round(cx - w * 0.55); x < cx + w * 0.55; x++) if (bayer4(x, Math.round(cy)) < 0.8) b.set(x, Math.round(cy + 1), dark);
}

export const STY = {
  carbonNear: { trunk: hex('#5a5434'), trunkDark: hex('#363420'), leaf: hex('#3e7a2e'), leafDark: hex('#264e22'), leafLight: hex('#6aa046') },
  carbonMid: { trunk: hex('#3e4a34'), trunkDark: hex('#2a3428'), leaf: hex('#2e5a30'), leafDark: hex('#1e3e24'), leafLight: hex('#3e6e3a') },
  jurassic: { trunk: hex('#6a4a2e'), trunkDark: hex('#3e2a1a'), leaf: hex('#3a6a2a'), leafDark: hex('#244a1e'), leafLight: hex('#5e8e3a') },
  cretaceous: { trunk: hex('#5e4028'), trunkDark: hex('#3a2616'), leaf: hex('#4a7a2a'), leafDark: hex('#2e5420'), leafLight: hex('#7aa040') },
  tropic: { trunk: hex('#6a5034'), trunkDark: hex('#40301e'), leaf: hex('#2e7a30'), leafDark: hex('#1c5222'), leafLight: hex('#5aa846') },
  savanna: { trunk: hex('#4a3020'), trunkDark: hex('#2a1a12'), leaf: hex('#6a7a2a'), leafDark: hex('#46561e'), leafLight: hex('#94a03a') },
  devonian: { trunk: hex('#5a4a30'), trunkDark: hex('#3a301e'), leaf: hex('#4a6a2a'), leafDark: hex('#2e4a1e'), leafLight: hex('#6e8e3a') },
} satisfies Record<string, PlantStyle>;
