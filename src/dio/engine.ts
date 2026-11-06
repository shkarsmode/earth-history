// Software pixel renderer for the surface dioramas: dithered skies, shaded discs (Sun, Moon),
// parallax ridges, water with reflections, particles and palette sprites. Everything is a pure
// function of time, drawn straight into the RGBA PixBuf at the film's native pixel resolution.
import { PixBuf, rgba, hex, R, G, B, bayer4, bayer8, type RGBA } from '../gfx/pixbuf';
import { hash, clamp } from '../core/hash';

export { hex, rgba, bayer4, bayer8 };
export type { RGBA };

// ---------------- noise ----------------
export function vnoise(x: number, seed = 0): number {
  const i = Math.floor(x), f = x - i;
  const a = hash(i * 0.917 + seed * 13.13), b = hash((i + 1) * 0.917 + seed * 13.13);
  const s = f * f * (3 - 2 * f);
  return a + (b - a) * s;
}
export function fbm1(x: number, oct = 4, seed = 0): number {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, seed + i * 7); n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}
export function vnoise2(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const h = (i: number, j: number) => hash(i * 0.731 + j * 1.913 + seed * 5.17);
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = h(ix, iy), b = h(ix + 1, iy), c = h(ix, iy + 1), d = h(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
export function fbm2(x: number, y: number, oct = 4, seed = 0): number {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise2(x * f, y * f, seed + i * 3); n += a; a *= 0.5; f *= 2.07; }
  return s / n;
}

// fast tiled value noise (256×256 table) for per-pixel work
const NT = 256;
const NTAB = new Float32Array(NT * NT).map((_, i) => hash(i * 0.3719 + 0.113));
export function tn2(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const x0 = ix & 255, y0 = iy & 255, x1 = (x0 + 1) & 255, y1 = (y0 + 1) & 255;
  const a = NTAB[y0 * NT + x0], b = NTAB[y0 * NT + x1], c = NTAB[y1 * NT + x0], d = NTAB[y1 * NT + x1];
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
export function tfbm(x: number, y: number, oct = 3): number {
  let s = 0, a = 0.5, n = 0;
  for (let i = 0; i < oct; i++) { s += a * tn2(x, y); n += a; x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; a *= 0.5; }
  return s / n;
}

/** precomputed tiling texture of a scalar field (sampled with integer lookups) */
export interface STex { n: number; d: Float32Array }
const texCache = new Map<string, STex>();
export function stex(key: string, n: number, f: (x: number, y: number) => number): STex {
  let t = texCache.get(key);
  if (!t) { const d = new Float32Array(n * n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) d[y * n + x] = f(x, y); t = { n, d }; texCache.set(key, t); }
  return t;
}
export function samp(t: STex, x: number, y: number): number { const n = t.n; return t.d[(((Math.floor(y) % n) + n) % n) * n + (((Math.floor(x) % n) + n) % n)]; }

// ---------------- colour helpers ----------------
export function lerpc(a: RGBA, b: RGBA, t: number): RGBA {
  t = clamp(t);
  return rgba(R(a) + (R(b) - R(a)) * t, G(a) + (G(b) - G(a)) * t, B(a) + (B(b) - B(a)) * t);
}
export function shade(c: RGBA, k: number): RGBA {
  return rgba(Math.min(255, R(c) * k), Math.min(255, G(c) * k), Math.min(255, B(c) * k));
}
/** pick from a ramp (dark → light) with ordered dithering */
export function rampAt(ramp: RGBA[], v: number, x: number, y: number): RGBA {
  const n = ramp.length - 1;
  const f = clamp(v) * n;
  const i = Math.floor(f);
  if (i >= n) return ramp[n];
  return f - i > bayer4(x, y) ? ramp[i + 1] : ramp[i];
}
export const pal = (...hs: string[]) => hs.map((h) => hex(h));

// ---------------- sky ----------------
/** vertical gradient through colour stops (t in 0..1 from y0 to y1), dithered between stops */
export function skyGradient(buf: PixBuf, stops: [number, RGBA][], y0 = 0, y1 = buf.h) {
  const W = buf.w;
  for (let y = Math.max(0, y0); y < Math.min(buf.h, y1); y++) {
    const t = (y - y0) / Math.max(1, y1 - y0);
    let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const [ta, ca] = stops[k], [tb, cb] = stops[Math.min(k + 1, stops.length - 1)];
    const f = tb > ta ? clamp((t - ta) / (tb - ta)) : 0;
    const row = y * W;
    for (let x = 0; x < W; x++) buf.u32[row + x] = f > bayer8(x, y) ? cb : ca;
  }
}

export function stars(buf: PixBuf, n: number, seed: number, maxY: number, t: number, bright = 1) {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(hash(i * 1.37 + seed) * buf.w), y = Math.floor(hash(i * 2.91 + seed + 0.3) * maxY);
    const b = hash(i * 5.3 + seed);
    const tw = 0.6 + 0.4 * Math.sin(t * (1 + b * 3) + i);
    const v = Math.floor(clamp((0.35 + 0.65 * b * b) * tw * bright) * 255);
    if (v < 50) continue;
    const c = rgba(v, v, Math.min(255, v + 25));
    buf.set(x, y, c);
    if (b > 0.97 && bright > 0.6) { const d = rgba(v * 0.5, v * 0.5, v * 0.6); buf.set(x + 1, y, d); buf.set(x - 1, y, d); buf.set(x, y + 1, d); buf.set(x, y - 1, d); }
  }
}

/** shaded sphere: lit by direction (lx, ly) in screen space (lz toward viewer); ramp dark→light; optional surface texture */
export function sphere(
  buf: PixBuf, cx: number, cy: number, r: number, light: [number, number, number], ramp: RGBA[],
  tex?: (u: number, v: number) => number, glow?: RGBA, glowW = 0,
) {
  const [lx, ly, lz] = light;
  const ll = Math.hypot(lx, ly, lz) || 1;
  const x0 = Math.floor(cx - r - glowW - 1), x1 = Math.ceil(cx + r + glowW + 1);
  const y0 = Math.floor(cy - r - glowW - 1), y1 = Math.ceil(cy + r + glowW + 1);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = (x + 0.5 - cx) / r, dy = (y + 0.5 - cy) / r;
      const d2 = dx * dx + dy * dy;
      if (d2 > 1) {
        if (glow && glowW > 0) {
          const d = Math.sqrt(d2) * r - r;
          if (d < glowW && (1 - d / glowW) * 0.9 > bayer4(x, y) + 0.1) buf.set(x, y, glow);
        }
        continue;
      }
      const nz = Math.sqrt(1 - d2);
      let l = (dx * lx + dy * ly + nz * lz) / ll;
      l = clamp(l * 1.1 + 0.05);
      if (tex) l *= tex(dx, dy);
      buf.set(x, y, rampAt(ramp, l, x, y));
    }
  }
}

/** the Moon seen from the ground: maria + craters, phase lighting */
export function moonDisc(buf: PixBuf, cx: number, cy: number, r: number, light: [number, number, number], opts: { hot?: number; ramp?: RGBA[]; glow?: RGBA } = {}) {
  const ramp = opts.ramp ?? pal('#141420', '#3a3a4c', '#6e6e7e', '#a4a2a8', '#d6d2cc', '#f2eee4');
  const tex = (u: number, v: number) => {
    // familiar near-side maria arrangement (rough)
    const m1 = Math.hypot(u + 0.25, v + 0.35) < 0.33 ? 1 : 0; // Imbrium
    const m2 = Math.hypot(u - 0.18, v + 0.3) < 0.2 ? 1 : 0; // Serenitatis
    const m3 = Math.hypot(u - 0.32, v + 0.02) < 0.26 ? 1 : 0; // Tranquillitatis
    const m4 = Math.hypot(u - 0.62, v + 0.25) < 0.14 ? 1 : 0; // Crisium
    const m5 = Math.hypot(u + 0.5, v + 0.05) < 0.3 ? 1 : 0; // Procellarum
    const m6 = Math.hypot(u + 0.12, v - 0.38) < 0.18 ? 1 : 0; // Nubium
    const n = fbm2(u * 6 + 3, v * 6 + 7, 3, 4);
    const maria = Math.max(m1, m2, m3, m4, m5, m6) * (n > 0.35 ? 1 : 0.5);
    const crater = vnoise2(u * 14, v * 14, 9) > 0.82 ? 0.85 : 1;
    return (1 - 0.32 * maria) * crater;
  };
  sphere(buf, cx, cy, r, light, ramp, tex, opts.glow, opts.glow ? Math.max(2, r * 0.25) : 0);
}

export function sunDisc(buf: PixBuf, cx: number, cy: number, r: number, core: RGBA, mid: RGBA, outer: RGBA, glowR = 3) {
  const R2 = r * glowR;
  for (let y = Math.floor(cy - R2); y <= cy + R2; y++) for (let x = Math.floor(cx - R2); x <= cx + R2; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d < r) buf.set(x, y, core);
    else if (d < r * 1.35) { if (bayer4(x, y) < 0.85) buf.set(x, y, mid); }
    else if (d < R2) { const a = 1 - (d - r * 1.35) / (R2 - r * 1.35); if (a * a * 0.7 > bayer8(x, y)) buf.set(x, y, outer); }
  }
}

// ---------------- terrain ----------------
export interface RidgeOpts {
  base: number; // y of the mean ridge line
  amp: number;
  freq: number; // features per pixel
  oct?: number;
  seed?: number;
  scroll?: number; // horizontal offset in pixels
  fill: RGBA;
  edge?: RGBA; // 1-px highlight on the crest
  shadeFn?: (x: number, y: number, depth: number) => RGBA | null; // texture below the crest
  sharp?: number; // 0 = rolling hills, 1 = jagged mountains
  peaks?: (x: number) => number; // extra height
  depth?: number; // only fill this many rows below the crest (layers hidden behind nearer ones)
}
export function ridge(buf: PixBuf, o: RidgeOpts): Int16Array {
  const W = buf.w, H = buf.h;
  const tops = new Int16Array(W);
  for (let x = 0; x < W; x++) {
    const wx = (x + (o.scroll ?? 0)) * o.freq;
    let h = fbm1(wx, o.oct ?? 4, o.seed ?? 0);
    if (o.sharp) h = h * (1 - o.sharp) + o.sharp * (1 - Math.abs(fbm1(wx * 0.7, 3, (o.seed ?? 0) + 3) * 2 - 1));
    let top = Math.round(o.base - (h - 0.5) * 2 * o.amp - (o.peaks ? o.peaks(x + (o.scroll ?? 0)) : 0));
    top = Math.max(-1, Math.min(H, top));
    tops[x] = top;
    const yEnd = Math.min(H, o.depth !== undefined ? top + o.depth : H);
    for (let y = Math.max(0, top); y < yEnd; y++) {
      let c = o.fill;
      if (o.shadeFn) { const s = o.shadeFn(x, y, y - top); if (s !== null) c = s; }
      buf.u32[y * W + x] = c;
    }
    if (o.edge && top >= 0 && top < H) buf.u32[top * W + x] = o.edge;
  }
  return tops;
}

// ---------------- water ----------------
/** mirror the picture above `hy` into the water below, tinted and rippled */
export function water(buf: PixBuf, hy: number, tint: RGBA, k: number, t: number, opts: { ripple?: number; sparkle?: RGBA; sparkleN?: number; bottom?: number } = {}) {
  const W = buf.w, H = opts.bottom ?? buf.h;
  const src = buf.u32.slice(0, hy * W);
  const rip = opts.ripple ?? 1;
  for (let y = hy; y < H; y++) {
    const d = y - hy;
    const persp = 1 + d * 0.08;
    for (let x = 0; x < W; x++) {
      const wob = Math.round(Math.sin(y * 0.9 + t * 2.2 + Math.sin(x * 0.05 + t) * 1.5) * rip * Math.min(1, d / 6));
      let sy = hy - 1 - Math.floor(d * 1.0);
      let sx = x + wob;
      if (sy < 0) sy = 0;
      if (sx < 0) sx = 0; else if (sx >= W) sx = W - 1;
      const c = src[sy * W + sx];
      const kk = Math.min(0.9, k + d * 0.004 * persp);
      buf.u32[y * W + x] = (bayer4(x, y) < 0.5 ? lerpc(c, tint, kk) : lerpc(c, tint, kk + 0.08));
    }
  }
  if (opts.sparkle) {
    const n = opts.sparkleN ?? 40;
    for (let i = 0; i < n; i++) {
      const y = hy + 1 + Math.floor(hash(i * 3.3) * (H - hy - 1));
      const x = Math.floor(((hash(i * 1.7) * W + t * (6 + hash(i) * 10)) % W + W) % W);
      if ((Math.sin(t * 3 + i) + 1) * 0.5 > 0.6) { buf.hline(x, x + 1 + Math.floor(hash(i * 9) * 3), y, opts.sparkle); }
    }
  }
}

// ---------------- particles ----------------
export function particles(buf: PixBuf, n: number, fn: (i: number) => [number, number, RGBA] | null) {
  for (let i = 0; i < n; i++) {
    const p = fn(i);
    if (p) buf.set(p[0], p[1], p[2]);
  }
}

/** falling streaks (rain) */
export function rain(buf: PixBuf, n: number, t: number, c: RGBA, slant = 0.4, speed = 220, len = 4) {
  const H = buf.h, W = buf.w;
  for (let i = 0; i < n; i++) {
    const ph = hash(i * 1.31);
    const y = ((ph * (H + 40) + t * speed * (0.8 + 0.4 * hash(i * 2.2))) % (H + 40)) - 20;
    const x = ((hash(i * 4.7) * (W + 60) + y * slant) % (W + 60)) - 30;
    for (let k = 0; k < len; k++) buf.set(Math.round(x - k * slant), Math.round(y - k), c);
  }
}

// ---------------- shapes ----------------
export function poly(buf: PixBuf, pts: [number, number][], c: RGBA) {
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(buf.h - 1, Math.ceil(maxY)); y++) {
    const yc = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      if ((y0 <= yc && y1 > yc) || (y1 <= yc && y0 > yc)) xs.push(x0 + ((yc - y0) * (x1 - x0)) / (y1 - y0));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) buf.rect(Math.round(xs[k]), y, Math.round(xs[k + 1]) - Math.round(xs[k]), 1, c);
  }
}

export function ellipse(buf: PixBuf, cx: number, cy: number, rx: number, ry: number, c: RGBA) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const dx = Math.sqrt(1 - dy * dy) * rx;
    const a = Math.round(cx - dx), b = Math.round(cx + dx);
    if (b > a) buf.rect(a, y, b - a, 1, c);
  }
}

/** soft dithered glow (light pools, fire) */
export function glow(buf: PixBuf, cx: number, cy: number, r: number, c: RGBA, strength = 0.7) {
  for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
    if (d >= 1) continue;
    const a = (1 - d) * (1 - d) * strength;
    if (a > bayer4(x, y)) buf.set(x, y, c);
  }
}

/** additive-ish tint over existing pixels inside a radius (for light falloff on the ground) */
export function tintCircle(buf: PixBuf, cx: number, cy: number, r: number, c: RGBA, k: number) {
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(buf.h - 1, cy + r); y++) for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(buf.w - 1, cx + r); x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
    if (d >= 1) continue;
    const a = (1 - d) * k;
    if (a > bayer4(x, y) * 0.9) { const i = y * buf.w + x; buf.u32[i] = lerpc(buf.u32[i], c, 0.45); }
  }
}

/** darken/tint the whole frame (night, eclipse, smoke) with ordered dithering of the strength */
export function grade(buf: PixBuf, c: RGBA, k: number) {
  if (k <= 0) return;
  const W = buf.w;
  for (let y = 0; y < buf.h; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    buf.u32[i] = lerpc(buf.u32[i], c, k + (bayer4(x, y) - 0.5) * 0.08);
  }
}
