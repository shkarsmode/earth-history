// Bitmap font built at runtime from a pixel web font: every glyph is rasterized once at the
// font's native pixel size and thresholded, so text lands exactly on the low-res pixel grid.
import { PixBuf, type RGBA } from './pixbuf';

export interface Glyph {
  ox: number; // bitmap offset from pen x
  oy: number; // bitmap offset from baseline (negative = above)
  w: number;
  h: number;
  adv: number;
  bits: Uint8Array;
}

export const CHARSET =
  ' АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789' +
  '.,:;!?-–—()«»"\'/+×%°·…№<>[]=*#&~_|';

export class PixelFont {
  readonly glyphs = new Map<string, Glyph>();
  constructor(
    readonly family: string,
    readonly size: number,
    readonly ascent: number, // cap height in px
    readonly lineHeight: number,
    readonly tracking: number,
  ) {}

  glyph(ch: string): Glyph | undefined {
    return this.glyphs.get(ch) ?? this.glyphs.get(FALLBACK[ch] ?? '?');
  }

  measure(text: string): number {
    let w = 0;
    for (const ch of text) {
      const g = this.glyph(ch);
      w += (g ? g.adv : this.size >> 1) + this.tracking;
    }
    return Math.max(0, w - this.tracking);
  }

  draw(buf: PixBuf, text: string, x: number, baseline: number, color: RGBA, shadow?: RGBA): number {
    let pen = x | 0;
    const by = baseline | 0;
    for (const ch of text) {
      const g = this.glyph(ch);
      if (!g) { pen += (this.size >> 1) + this.tracking; continue; }
      for (let j = 0; j < g.h; j++) {
        for (let i = 0; i < g.w; i++) {
          if (!g.bits[j * g.w + i]) continue;
          const px = pen + g.ox + i, py = by + g.oy + j;
          if (shadow !== undefined) {
            buf.set(px + 1, py + 1, shadow);
          }
          buf.set(px, py, color);
        }
      }
      pen += g.adv + this.tracking;
    }
    return pen;
  }

  // 1px outline all around (for text over busy pictures)
  drawOutlined(buf: PixBuf, text: string, x: number, baseline: number, color: RGBA, outline: RGBA): number {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      this.draw(buf, text, x + dx, baseline + dy, outline);
    }
    return this.draw(buf, text, x, baseline, color);
  }

  wrap(text: string, maxW: number): string[] {
    const out: string[] = [];
    for (const para of text.split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const cand = line ? line + ' ' + w : w;
        if (this.measure(cand) <= maxW || !line) line = cand;
        else { out.push(line); line = w; }
      }
      out.push(line);
    }
    return out;
  }
}

const FALLBACK: Record<string, string> = { '₂': '2', '≈': '~', '−': '-', '→': '>', '‑': '-', ' ': ' ', 'ё': 'е' };

export async function buildFont(family: string, size: number, opts: { tracking?: number; lineHeight?: number; oversample?: number } = {}): Promise<PixelFont> {
  // Rasterize at k× the native size and sample the centre of every k×k cell: immune to the
  // sub-pixel glyph offsets that otherwise smear 1-px gaps shut (м, ш, Ж …).
  const k = opts.oversample ?? 4;
  const big = size * k;
  const spec = `${size}px "${family}"`;
  const bigSpec = `${big}px "${family}"`;
  try { await document.fonts.load(spec, CHARSET); await document.fonts.load(bigSpec, CHARSET); } catch { /* rasterize whatever is available */ }
  const padC = size * 2; // pen origin in cells
  const cells = size * 4;
  const cw = cells * k, ch = cells * k;
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.font = bigSpec;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  const capM = ctx.measureText('H');
  const ascent = Math.round((capM.actualBoundingBoxAscent || big * 0.7) / k);
  const font = new PixelFont(family, size, ascent, opts.lineHeight ?? Math.ceil(size * 1.5), opts.tracking ?? 0);
  for (const chr of CHARSET) {
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = '#fff';
    ctx.fillText(chr, padC * k, padC * k);
    const img = ctx.getImageData(0, 0, cw, ch).data;
    const on = (cx: number, cy: number) => img[((cy * k + (k >> 1)) * cw + cx * k + (k >> 1)) * 4 + 3] >= 128;
    let minX = cells, minY = cells, maxX = -1, maxY = -1;
    for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
      if (on(x, y)) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    const adv = Math.round(ctx.measureText(chr).width / k);
    if (maxX < 0) {
      font.glyphs.set(chr, { ox: 0, oy: 0, w: 0, h: 0, adv, bits: new Uint8Array(0) });
      continue;
    }
    const w = maxX - minX + 1, h = maxY - minY + 1;
    const bits = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) bits[y * w + x] = on(x + minX, y + minY) ? 1 : 0;
    font.glyphs.set(chr, { ox: minX - padC, oy: minY - padC, w, h, adv, bits });
  }
  return font;
}
