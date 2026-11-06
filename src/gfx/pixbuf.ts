// Software RGBA pixel buffer (top-down rows) used for the HUD and the surface dioramas.
// Colors are packed little-endian ABGR uint32 so they can be written straight into ImageData.

export type RGBA = number;

export const rgba = (r: number, g: number, b: number, a = 255): RGBA =>
  (((a & 255) << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0;

export function hex(h: string, a = 255): RGBA {
  const s = h.startsWith('#') ? h.slice(1) : h;
  const n = parseInt(s.length === 3 ? s.split('').map((c) => c + c).join('') : s, 16);
  return rgba((n >> 16) & 255, (n >> 8) & 255, n & 255, a);
}

export const R = (c: RGBA) => c & 255;
export const G = (c: RGBA) => (c >>> 8) & 255;
export const B = (c: RGBA) => (c >>> 16) & 255;
export const A = (c: RGBA) => (c >>> 24) & 255;

export function mixc(a: RGBA, b: RGBA, t: number): RGBA {
  const u = 1 - t;
  return rgba(R(a) * u + R(b) * t, G(a) * u + G(b) * t, B(a) * u + B(b) * t, A(a) * u + A(b) * t);
}

export function withAlpha(c: RGBA, a: number): RGBA {
  return ((c & 0x00ffffff) | ((a & 255) << 24)) >>> 0;
}

// 4x4 and 8x8 ordered-dither thresholds in [0,1)
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const B8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22, 3, 35,
  11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
];
export const BAYER8 = B8.map((v) => (v + 0.5) / 64);
export const bayer4 = (x: number, y: number) => BAYER4[(y & 3) * 4 + (x & 3)];
export const bayer8 = (x: number, y: number) => BAYER8[(y & 7) * 8 + (x & 7)];

export class PixBuf {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;
  readonly u32: Uint32Array;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    const ab = new ArrayBuffer(w * h * 4);
    this.data = new Uint8ClampedArray(ab);
    this.u32 = new Uint32Array(ab);
  }

  clear(c: RGBA = 0) {
    this.u32.fill(c);
  }

  set(x: number, y: number, c: RGBA) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.u32[y * this.w + x] = c;
  }

  get(x: number, y: number): RGBA {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.u32[y * this.w + x];
  }

  // alpha-composite one pixel (a = 0..1)
  blend(x: number, y: number, c: RGBA, a: number) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = y * this.w + x;
    if (a >= 1) {
      this.u32[i] = c | 0xff000000;
      return;
    }
    const d = this.u32[i];
    const da = A(d) / 255;
    const oa = a + da * (1 - a);
    const k = oa > 0 ? a / oa : 0;
    this.u32[i] = rgba(R(d) + (R(c) - R(d)) * k, G(d) + (G(c) - G(d)) * k, B(d) + (B(c) - B(d)) * k, oa * 255);
  }

  rect(x: number, y: number, w: number, h: number, c: RGBA) {
    let x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.w, (x + w) | 0), y1 = Math.min(this.h, (y + h) | 0);
    if (x1 <= x0 || y1 <= y0) return;
    for (let yy = y0; yy < y1; yy++) this.u32.fill(c, yy * this.w + x0, yy * this.w + x1);
  }

  // dithered translucent rectangle (keeps hard pixels: each pixel is either covered or not)
  ditherRect(x: number, y: number, w: number, h: number, c: RGBA, a: number) {
    const x0 = Math.max(0, x | 0), y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.w, (x + w) | 0), y1 = Math.min(this.h, (y + h) | 0);
    for (let yy = y0; yy < y1; yy++)
      for (let xx = x0; xx < x1; xx++) if (bayer4(xx, yy) < a) this.u32[yy * this.w + xx] = c;
  }

  hline(x0: number, x1: number, y: number, c: RGBA) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    this.rect(x0, y, x1 - x0 + 1, 1, c);
  }

  vline(x: number, y0: number, y1: number, c: RGBA) {
    if (y1 < y0) [y0, y1] = [y1, y0];
    this.rect(x, y0, 1, y1 - y0 + 1, c);
  }

  // Bresenham line
  line(x0: number, y0: number, x1: number, y1: number, c: RGBA) {
    x0 |= 0; y0 |= 0; x1 |= 0; y1 |= 0;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 4096; n++) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // pixel-art box with 1px border
  frame(x: number, y: number, w: number, h: number, fill: RGBA, border: RGBA) {
    this.rect(x + 1, y + 1, w - 2, h - 2, fill);
    this.rect(x + 1, y, w - 2, 1, border);
    this.rect(x + 1, y + h - 1, w - 2, 1, border);
    this.rect(x, y + 1, 1, h - 2, border);
    this.rect(x + w - 1, y + 1, 1, h - 2, border);
  }

  // filled disc with crisp pixel edge
  disc(cx: number, cy: number, r: number, c: RGBA) {
    const r2 = r * r;
    const y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r);
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      const s = r2 - dy * dy;
      if (s < 0) continue;
      const dx = Math.sqrt(s);
      const xa = Math.round(cx - dx), xb = Math.round(cx + dx);
      if (xb > xa) this.rect(xa, y, xb - xa, 1, c);
    }
  }

  blit(src: PixBuf, dx: number, dy: number) {
    for (let y = 0; y < src.h; y++) {
      const ty = y + dy;
      if (ty < 0 || ty >= this.h) continue;
      for (let x = 0; x < src.w; x++) {
        const tx = x + dx;
        if (tx < 0 || tx >= this.w) continue;
        const c = src.u32[y * src.w + x];
        if (c >>> 24) this.u32[ty * this.w + tx] = c;
      }
    }
  }
}
