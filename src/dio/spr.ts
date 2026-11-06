// Palette sprites: baked once from character grids (src/dio/sprites.ts) into RGBA frames.
import { PixBuf, hex, R, G, B, type RGBA, bayer4 } from '../gfx/pixbuf';

interface SpriteDef {
  pal: Record<string, string>;
  frames: string[][];
  ax?: number;
  ay?: number;
  fps?: number;
}
interface Baked { w: number; h: number; frames: Uint32Array[]; ax: number; ay: number; fps: number }

// sprite sheets are optional at build time (glob returns {} when files are absent); several files merge
const mods = import.meta.glob(['./sprites.ts', './sprites2.ts'], { eager: true }) as Record<string, { SPRITES?: Record<string, SpriteDef> }>;
const DEFS: Record<string, SpriteDef> = Object.assign({}, ...Object.values(mods).map((m) => m.SPRITES ?? {}));
const cache = new Map<string, Baked | null>();

function bake(name: string): Baked | null {
  if (cache.has(name)) return cache.get(name)!;
  const d = DEFS[name];
  if (!d || !d.frames.length) { cache.set(name, null); return null; }
  const h = d.frames[0].length;
  const w = Math.max(...d.frames[0].map((r) => r.length));
  const pal: Record<string, RGBA> = {};
  for (const [k, v] of Object.entries(d.pal)) pal[k] = hex(v);
  const frames = d.frames.map((rows) => {
    const a = new Uint32Array(w * h);
    rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) { const ch = row[x]; if (ch !== '.' && ch !== ' ' && pal[ch] !== undefined) a[y * w + x] = pal[ch]; } });
    return a;
  });
  const b: Baked = { w, h, frames, ax: d.ax ?? Math.floor(w / 2), ay: d.ay ?? h, fps: d.fps ?? 4 };
  cache.set(name, b);
  return b;
}

export const hasSprite = (name: string) => !!bake(name);
export function spriteSize(name: string): [number, number] { const b = bake(name); return b ? [b.w, b.h] : [0, 0]; }

export interface SprOpts {
  flip?: boolean; // face left
  frame?: number; // explicit frame, otherwise animated by t
  tint?: RGBA;
  tintK?: number; // 0..1 blend toward tint (fog / night)
  sil?: RGBA; // draw as a flat silhouette
  alpha?: number; // dithered transparency 0..1
}

/** draw sprite with its anchor at (x, y); animated with time t */
export function drawSprite(buf: PixBuf, name: string, x: number, y: number, t: number, o: SprOpts = {}): boolean {
  const b = bake(name);
  if (!b) return false;
  const fi = o.frame !== undefined ? o.frame % b.frames.length : Math.floor(t * b.fps) % b.frames.length;
  const f = b.frames[(fi + b.frames.length) % b.frames.length];
  const ox = Math.round(x - (o.flip ? b.w - b.ax : b.ax)), oy = Math.round(y - b.ay);
  const k = o.tintK ?? 0;
  const tr = o.tint !== undefined ? R(o.tint) : 0, tg = o.tint !== undefined ? G(o.tint) : 0, tb = o.tint !== undefined ? B(o.tint) : 0;
  for (let j = 0; j < b.h; j++) {
    const py = oy + j;
    if (py < 0 || py >= buf.h) continue;
    for (let i = 0; i < b.w; i++) {
      const c = f[j * b.w + (o.flip ? b.w - 1 - i : i)];
      if (!c) continue;
      const px = ox + i;
      if (px < 0 || px >= buf.w) continue;
      if (o.alpha !== undefined && o.alpha < 1 && bayer4(px, py) >= o.alpha) continue;
      let out = c;
      if (o.sil !== undefined) out = o.sil;
      else if (k > 0 && o.tint !== undefined) {
        out = ((255 << 24) | ((B(c) + (tb - B(c)) * k) << 16) | ((G(c) + (tg - G(c)) * k) << 8) | (R(c) + (tr - R(c)) * k)) >>> 0;
      }
      buf.u32[py * buf.w + px] = out;
    }
  }
  return true;
}
