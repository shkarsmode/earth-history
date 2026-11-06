// Surface dioramas, the human story: Ice-Age camp, first farms, Mesopotamian ziggurat,
// industrial town, a night launch to the Moon, the city of 2026, and a city of the future.
import { PixBuf, hex, type RGBA } from '../gfx/pixbuf';
import { hash, clamp } from '../core/hash';
import { skyGradient, stars, sunDisc, moonDisc, ridge, water, pal, tn2, glow, grade, bayer4, bayer8, lerpc, shade, ellipse, tintCircle, poly, rampAt } from './engine';
import { palm, broadleaf, conifer, grass, cloud, STY, type PlantStyle } from './flora';
import { drawSprite } from './spr';
import { rocket, locomotive, wagon, airliner, drone, reedboat, caravel } from './machines';
import type { Ctx } from './scenesDeep';

const wrapX = (x: number, W: number) => ((x % W) + W) % W;
const silStyle = (c: string): PlantStyle => ({ trunk: hex(c), trunkDark: hex(c), leaf: hex(c), leafDark: hex(c), leafLight: hex(c), sil: hex(c) });

function fire(b: PixBuf, x: number, y: number, s: number, t: number) {
  // flickering pixel flames
  const F = pal('#7a1a08', '#d8401a', '#ff8a2a', '#ffd060', '#fff6c0');
  for (let k = 0; k < 7; k++) {
    const fx = x + (k - 3) * s * 0.9;
    const h = s * (2.2 + 1.6 * tn2(k * 3.1, t * 6)) * (1 - Math.abs(k - 3) / 4.5);
    for (let j = 0; j < h; j++) {
      const f = j / h;
      const w = Math.max(0, Math.round((1 - f) * s * 0.9));
      const sway = Math.round(Math.sin(t * 9 + k + j * 0.4) * f * 1.5);
      for (let i = -w; i <= w; i++) b.set(Math.round(fx + i + sway), Math.round(y - j), rampAt(F, 1 - f * 0.85 - Math.abs(i) / (w + 1) * 0.3, Math.round(fx + i), Math.round(y - j)));
    }
  }
  // embers
  for (let i = 0; i < 18; i++) {
    const ph = (t * 0.8 + hash(i * 3.3)) % 1;
    b.set(Math.round(x + Math.sin(ph * 9 + i) * 6 + (hash(i) - 0.5) * 8), Math.round(y - s * 3 - ph * 40), ph < 0.5 ? hex('#ffd060') : hex('#d8401a'));
  }
}

// ============ Ice Age night: campfire, cave art, mammoths, aurora ============
export function iceage(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h, hy = Math.round(H * 0.6);
  skyGradient(b, [[0, hex('#04060e')], [0.6, hex('#0c162a')], [1, hex('#1e2c46')]], 0, hy);
  stars(b, 220, 31, hy, c.amb, 1);
  // aurora curtains
  for (let x = 0; x < W; x++) {
    const fold = tn2(x * 0.011 + t * 0.04, 2);
    const s = clamp((fold - 0.12) * 1.9) * (0.4 + 0.6 * tn2(x * 0.35, t * 0.6));
    if (s < 0.05) continue;
    const top = Math.round(H * 0.05 + fold * 34 + Math.sin(x * 0.03 + t * 0.3) * 6);
    const len = 22 + s * 70;
    for (let j = 0; j < len; j++) {
      const f = j / len;
      const a = s * (f < 0.12 ? f / 0.12 : 1 - (f - 0.12) / 0.88);
      if (a > bayer8(x, top + j) * 0.9) b.set(x, top + j, f < 0.08 ? hex('#c870d0') : f < 0.3 ? hex('#9affc8') : f < 0.6 ? hex('#3ad890') : hex('#1a7a64'));
    }
  }
  moonDisc(b, W * 0.15, H * 0.16, 11, [0.2, -0.2, 1], {});
  // distant glacier front
  ridge(b, { base: hy - 12, amp: 10, freq: 0.02, seed: 121, sharp: 0.8, fill: hex('#8aa0c0'), edge: hex('#c8dcf0'), depth: 34,
    shadeFn: (x, y, d) => (d > 2 && tn2(x * 0.3, y * 0.2) > 0.7 ? hex('#6e86aa') : null) });
  const steppe = ridge(b, { base: hy + 4, amp: 5, freq: 0.012, seed: 122, fill: hex('#5e6e8e'), edge: hex('#8a9cba'), depth: Math.round(H * 0.3),
    shadeFn: (x, y, d) => (tn2(x * 0.2, y * 0.3) > 0.72 ? hex('#4e5e7e') : null) });
  // mammoths crossing in the moonlight
  for (let i = 0; i < 4; i++) {
    const x = wrapX(W * 0.35 + i * 52 + t * 5, W + 120) - 60;
    drawSprite(b, 'mammoth', x, steppe[Math.round(clamp(x, 0, W - 1))] + 8 + (i % 2) * 3, t * 0.8 + i * 0.5, { tint: hex('#1e2c46'), tintK: 0.55 });
  }
  // snowy foreground
  const fg = ridge(b, { base: H * 0.74, amp: 4, freq: 0.01, seed: 123, fill: hex('#7a8aa8'), edge: hex('#a8b8d0'),
    shadeFn: (x, y, d) => (tn2(x * 0.15, y * 0.2) > 0.7 ? hex('#6a7a98') : null) });
  // cave on the left: rock arch with ochre hand stencils
  const cx = W * 0.12;
  for (let y = Math.round(H * 0.38); y < H; y++) for (let x = 0; x < W * 0.34; x++) {
    const dx = (x - cx) / (W * 0.13), dy = (y - H * 0.95) / (H * 0.42);
    const inside = dx * dx + dy * dy < 1;
    const outer = (x - W * 0.04) / (W * 0.3);
    const rockTop = H * 0.38 + Math.pow(Math.max(0, outer), 2) * H * 0.4 + tn2(x * 0.1, 3) * 10;
    if (y < rockTop) continue;
    if (inside) b.set(x, y, hex('#0c0a0c'));
    else b.set(x, y, tn2(x * 0.15, y * 0.15) > 0.6 ? hex('#3a3236') : hex('#2a2428'));
  }
  // hand stencils on the outer wall (lit by fire)
  for (let k = 0; k < 3; k++) {
    const hx = W * 0.2 + k * 10, hyy = H * 0.68 + (k % 2) * 7;
    ellipse(b, hx, hyy, 4, 5, hex('#8a3a1e'));
    ellipse(b, hx, hyy + 1, 2, 2.6, hex('#3a2a28'));
    for (let f = -2; f <= 2; f++) b.vline(Math.round(hx + f * 1.2), Math.round(hyy - 5), Math.round(hyy - 2), hex('#3a2a28'));
  }
  // campfire with people
  const fx = W * 0.44, fy = fg[Math.round(W * 0.44)] + 3;
  tintCircle(b, fx, fy - 4, 78, hex('#ff8a3a'), 0.8);
  glow(b, fx, fy - 6, 16, hex('#ff9a40'), 0.35);
  drawSprite(b, 'human_sit', fx - 16, fy + 1, t, {});
  drawSprite(b, 'human_sit', fx + 15, fy + 1, t, { flip: true });
  drawSprite(b, 'human_spear', fx + 30, fy, t * 0.5, { flip: true });
  b.hline(Math.round(fx - 6), Math.round(fx + 6), Math.round(fy), hex('#3a2014'));
  fire(b, fx, fy - 1, 3.4, c.amb);
  // light snow
  for (let i = 0; i < 120; i++) { const y = (hash(i * 1.9) * H + t * 8) % H, x = wrapX(hash(i * 3.3) * W + Math.sin(t * 0.8 + i) * 5, W); b.set(Math.round(x), Math.round(y), hex('#c8d8f0')); }
}

// ============ First farms ============
export function farm(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h, hy = Math.round(H * 0.5);
  skyGradient(b, [[0, hex('#6a9ad0')], [0.7, hex('#c8d4d8')], [1, hex('#f2dcae')]], 0, hy);
  sunDisc(b, W * 0.82, hy - 26, 9, hex('#fffbe8'), hex('#ffe8b0'), hex('#f8d090'), 3);
  cloud(b, W * 0.3 + t * 2, H * 0.12, 70, hex('#ffffff'), hex('#eef0f2'), hex('#c8ccd8'), 31);
  ridge(b, { base: hy, amp: 12, freq: 0.01, seed: 131, fill: hex('#8a9a7a'), edge: hex('#a0ae8a'), depth: 50 });
  // patchwork fields on the hills
  const hills = ridge(b, { base: hy + 18, amp: 10, freq: 0.008, seed: 132, fill: hex('#7a9a4a'), edge: hex('#94b05a'), depth: Math.round(H * 0.36),
    shadeFn: (x, y) => { const p = Math.floor(tn2(Math.floor(x / 26) * 3.1, Math.floor(y / 9) * 2.3) * 4); return p === 0 ? hex('#c8a84a') : p === 1 ? hex('#8a6a3e') : p === 2 ? hex('#6a8a3a') : null; } });
  // village of mud-brick houses with hearth smoke
  const vx0 = W * 0.42;
  for (let i = 0; i < 9; i++) {
    const x = vx0 + (i % 5) * 18 + (hash(i) - 0.5) * 6, w = 12 + hash(i * 3) * 6, h = 8 + hash(i * 7) * 4;
    const by = hills[Math.round(clamp(x, 0, W - 1))] + 6 + Math.floor(i / 5) * 8;
    b.rect(Math.round(x), Math.round(by - h), Math.round(w), Math.round(h), hex('#c49a6a'));
    b.rect(Math.round(x + w - 3), Math.round(by - h), 3, Math.round(h), hex('#a07a52'));
    b.rect(Math.round(x), Math.round(by - h - 1), Math.round(w), 1, hex('#e0bc8a'));
    b.rect(Math.round(x + 3), Math.round(by - 5), 3, 5, hex('#3a2a20'));
    if (i % 3 === 0) for (let p = 0; p < 30; p++) { const ph = (t * 0.25 + hash(p + i * 9)) % 1; b.set(Math.round(x + 4 + ph * 14 + Math.sin(ph * 6 + p) * 2), Math.round(by - h - 2 - ph * 30), ph < 0.5 ? hex('#d8d8d0') : hex('#b8c0c8')); }
  }
  // wheat field foreground
  const fg = ridge(b, { base: H * 0.72, amp: 3, freq: 0.01, seed: 133, fill: hex('#b08a3a'), edge: hex('#d0a84a') });
  for (let x = 0; x < W; x++) for (let k = 0; k < 3; k++) {
    if (hash(x * 1.7 + k * 0.3) > 0.85) continue;
    const gy = fg[x] + 4 + k * 12 + Math.floor(hash(x + k * 5) * 10);
    const h = 9 + hash(x * 2.1 + k) * 6;
    const sw = Math.sin(t * 1.4 + x * 0.08) * 1.5;
    for (let y = 0; y < h; y++) b.set(Math.round(x + sw * (y / h)), gy - y, y > h - 3 ? hex('#f0d070') : hex('#c8a040'));
  }
  drawSprite(b, 'farmer', W * 0.3, fg[Math.round(W * 0.3)] + 12, t * 1.2);
  drawSprite(b, 'farmer', W * 0.56, fg[Math.round(W * 0.56)] + 16, t * 1.2 + 0.5, { flip: true });
  for (let i = 0; i < 4; i++) drawSprite(b, 'goat', W * 0.7 + i * 14 + Math.sin(t * 0.3 + i) * 3, hills[Math.round(W * 0.7)] + 18 + (i % 2) * 3, t + i, { flip: i % 2 === 0 });
  drawSprite(b, 'cow', W * 0.18, hills[Math.round(W * 0.18)] + 16, t * 0.6);
}

// ============ Mesopotamia: ziggurat, river, writing ============
export function ziggurat(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h, hy = Math.round(H * 0.56);
  skyGradient(b, [[0, hex('#4a86c8')], [0.6, hex('#9cc0d8')], [1, hex('#f0dcb0')]], 0, hy);
  sunDisc(b, W * 0.18, H * 0.14, 9, hex('#fffef0'), hex('#fff0c0'), hex('#f8e0a0'), 3);
  ridge(b, { base: hy - 2, amp: 4, freq: 0.01, seed: 141, fill: hex('#c8a878'), edge: hex('#dcbc8a') });
  // ziggurat: three stepped tiers + shrine + stairway
  const zx = W * 0.58, zb = hy + 6;
  const tiers = [[90, 18], [64, 15], [40, 12]];
  let y = zb;
  for (const [i, [w, h]] of tiers.entries()) {
    for (let j = 0; j < h; j++) {
      const yy = y - j;
      for (let x = Math.round(zx - w / 2 - (h - j) * 0.15); x <= Math.round(zx + w / 2 + (h - j) * 0.15); x++) {
        const rel = (x - (zx - w / 2)) / w;
        let col = rel > 0.7 ? hex('#a87a4a') : hex('#c8985e');
        if ((yy + (Math.floor(x / 6) % 2) * 2) % 4 === 0) col = shade(col, 0.88); // brick courses
        if (j % 6 === 5 && x % 5 === 0) col = shade(col, 0.75); // drainage holes
        b.set(x, yy, col);
      }
    }
    b.hline(Math.round(zx - w / 2), Math.round(zx + w / 2), y - h, hex('#e8c08a'));
    y -= h;
    if (i === 0) {
      // central stairway
      for (let s = 0; s < 18 + 15; s++) b.hline(Math.round(zx - 5), Math.round(zx + 5), zb - s, s % 2 ? hex('#b88a54') : hex('#d8b07a'));
    }
  }
  b.rect(Math.round(zx - 9), y - 10, 18, 10, hex('#e8e0d0'));
  b.rect(Math.round(zx + 3), y - 10, 6, 10, hex('#c8c0b0'));
  b.rect(Math.round(zx - 2), y - 6, 4, 6, hex('#4a3a2a'));
  b.rect(Math.round(zx - 10), y - 11, 20, 1, hex('#5a7ab0'));
  // city walls & houses
  for (let i = 0; i < 18; i++) { const x = hash(i * 2.3) * W, w = 10 + hash(i) * 12, h = 6 + hash(i * 5) * 6; if (Math.abs(x - zx) < 55) continue; b.rect(Math.round(x), hy + 6 - Math.round(h), Math.round(w), Math.round(h), hex('#d0a878')); b.rect(Math.round(x + w - 2), hy + 6 - Math.round(h), 2, Math.round(h), hex('#a88458')); }
  b.rect(0, hy + 6, W, 3, hex('#b08a5a'));
  // the river with date palms and reed boats
  water(b, hy + 9, hex('#3a7a8a'), 0.5, t, { ripple: 1, sparkle: hex('#ffffff'), sparkleN: 30, bottom: Math.round(H * 0.74) });
  reedboat(b, wrapX(W * 0.2 + t * 6, W + 40) - 20, Math.round(H * 0.7), t);
  reedboat(b, wrapX(W * 0.8 - t * 4, W + 40) - 20, Math.round(H * 0.66), t + 1.3);
  const bank = ridge(b, { base: H * 0.8, amp: 3, freq: 0.01, seed: 143, fill: hex('#a89060'), edge: hex('#c0a874') });
  for (let i = 0; i < 9; i++) palm(b, hash(i * 3.7 + 1) * W, bank[Math.round(clamp(hash(i * 3.7 + 1) * W, 0, W - 1))] + 2, 36 + hash(i) * 22, STY.tropic, i + 1200, Math.sin(t * 0.5) * 1.2);
  for (let i = 0; i < 3; i++) drawSprite(b, 'farmer', wrapX(W * 0.4 + i * 22 + t * 4, W + 30) - 15, Math.round(H * 0.79), t + i * 0.3);
  // a scribe's clay tablet in the corner: cuneiform wedges
  const px = W - 58, py = Math.round(H * 0.6);
  b.frame(px, py, 44, 32, hex('#b89a70'), hex('#7a5e40'));
  for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) if (hash(r * 7 + k) > 0.25) { const x = px + 5 + k * 6, yy = py + 5 + r * 5; b.set(x, yy, hex('#5a4028')); b.set(x + 1, yy, hex('#5a4028')); b.set(x, yy + 1, hex('#7a5e40')); }
}

// ============ Age of sail: a caravel at sunset ============
export function voyage(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h, hy = Math.round(H * 0.58);
  skyGradient(b, [[0, hex('#24264e')], [0.45, hex('#7a4a7a')], [0.75, hex('#e0786a')], [1, hex('#ffc890')]], 0, hy);
  stars(b, 40, 71, hy * 0.3, c.amb, 0.5);
  // long lit cloud streaks
  for (let k = 0; k < 6; k++) {
    const y = Math.round(H * (0.12 + k * 0.07)), x0 = (hash(k * 3.1) * W + t * (2 + k)) % (W + 160) - 80, len = 80 + hash(k) * 120;
    for (let x = Math.round(x0); x < x0 + len; x++) {
      const f = (x - x0) / len;
      const th = Math.round(2 * Math.sin(f * Math.PI));
      for (let j = 0; j <= th; j++) b.set(x, y + j, j === 0 ? hex('#ffb0a0') : hex('#b0607a'));
    }
  }
  const sx = W * 0.62;
  sunDisc(b, sx, hy - 4, 12, hex('#fff2c8'), hex('#ffd090'), hex('#f09070'), 3);
  b.rect(0, hy - 2, W, 2, hex('#a85a6a'));
  // distant headland
  ridge(b, { base: hy - 1, amp: 2, freq: 0.02, seed: 171, fill: hex('#4a2e4a'), edge: hex('#6a3e5a'), depth: 14,
    peaks: (x) => { const d = (x - W * 0.12) / 60; return d > -1 && d < 1 ? 10 * (1 - d * d) : 0; } });
  water(b, hy, hex('#2a3a6a'), 0.5, t, { ripple: 1 });
  // glitter path under the sun
  for (let y = hy + 1; y < H; y++) {
    const spread = 3 + (y - hy) * 0.35;
    for (let k = 0; k < 3; k++) {
      const x = Math.round(sx + (hash(y * 7.3 + k + Math.floor(t * 6)) - 0.5) * spread * 2);
      if (hash(y * 1.3 + k * 9 + Math.floor(t * 5)) > 0.45) b.hline(x, x + 1 + Math.floor((y - hy) / 30), y, (y - hy) % 3 ? hex('#ffd890') : hex('#fff0c0'));
    }
  }
  // wave crests
  for (let y = hy + 4; y < H; y += 5) for (let x = 0; x < W; x++) if (tn2(x * 0.05 + t * 0.4 + y, y * 0.3) > 0.72) b.set(x, y, hex('#7a7aa8'));
  // the caravel, bobbing on the swell
  const cx = W * 0.4 + Math.sin(t * 0.08) * 20, cy = hy + 34 + Math.sin(t * 1.3) * 1.5;
  caravel(b, cx, cy, t);
  for (let i = 0; i < 5; i++) drawSprite(b, 'bird', wrapX(W * 0.3 + i * 40 + t * (10 + i * 2), W + 20) - 10, H * (0.25 + (i % 3) * 0.05) + Math.sin(t * 2 + i) * 3, t * 2 + i, { sil: hex('#2a1a2e') });
}

// ============ Industrial revolution ============
export function industry(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h, hy = Math.round(H * 0.66);
  skyGradient(b, [[0, hex('#3a3a46')], [0.5, hex('#6a5e5a')], [1, hex('#c09070')]], 0, hy);
  sunDisc(b, W * 0.7, H * 0.3, 10, hex('#f8d8a8'), hex('#e0a878'), hex('#a87a62'), 2);
  // yards and canals below the skyline
  b.rect(0, hy, W, H - hy, hex('#2e2a2e'));
  for (let y = hy + 2; y < H; y += 4) for (let x = (y * 7) % 9; x < W; x += 9) b.set(x, y, hex('#3a3436'));
  // far factories (silhouettes) with chimneys
  for (let i = 0; i < 14; i++) {
    const x = hash(i * 3.1) * W, w = 26 + hash(i) * 30, h = 18 + hash(i * 2) * 20;
    b.rect(Math.round(x), hy - Math.round(h), Math.round(w), Math.round(h), hex('#4a4246'));
    for (let k = 0; k < w; k += 8) poly(b, [[x + k, hy - h], [x + k + 4, hy - h - 5], [x + k + 8, hy - h]], hex('#4a4246'));
  }
  const chimneys: [number, number][] = [];
  for (let i = 0; i < 9; i++) { const x = Math.round(hash(i * 5.7 + 2) * W), h = 50 + hash(i * 1.3) * 50; b.rect(x, Math.round(hy - h), 5, Math.round(h), hex('#5a3a32')); b.rect(x + 3, Math.round(hy - h), 2, Math.round(h), hex('#3e2622')); b.rect(x - 1, Math.round(hy - h), 7, 2, hex('#3e2622')); chimneys.push([x + 2, hy - h]); }
  // smoke
  for (const [ci, [cx, cy]] of chimneys.entries()) for (let p = 0; p < 40; p++) {
    const life = 6;
    const ph = ((t * 0.5 + hash(ci * 9 + p) * life) % life) / life;
    const x = cx + ph * 60 + (tn2(ci * 3 + p * 0.3, t * 0.3) - 0.5) * 12 * ph;
    const y = cy - ph * 50;
    const r = 1 + ph * 6;
    const col = ph < 0.3 ? hex('#2a2626') : hex('#4a4446');
    for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) if (Math.hypot(xx - x, yy - y) < r && bayer4(xx, yy) < 0.7 - ph * 0.4) b.set(xx, yy, col);
  }
  // near brick mills with glowing windows
  for (let i = 0; i < 4; i++) {
    const x = i * W * 0.27 - 10, w = W * 0.2, h = 40 + hash(i * 9) * 14;
    b.rect(Math.round(x), Math.round(hy + 18 - h), Math.round(w), Math.round(h), hex('#7a3e2e'));
    for (let wy = 0; wy < 3; wy++) for (let wx = 0; wx < w / 10 - 1; wx++) {
      const lit = hash(i * 31 + wx * 3 + wy * 7) > 0.35;
      b.rect(Math.round(x + 5 + wx * 10), Math.round(hy + 22 - h + wy * 12), 5, 7, lit ? hex('#ffc060') : hex('#2a1e1e'));
      if (lit) b.rect(Math.round(x + 5 + wx * 10), Math.round(hy + 22 - h + wy * 12), 5, 1, hex('#fff0b0'));
    }
    for (let k = 0; k < w; k += 3) if ((k / 3) % 2) b.set(Math.round(x + k), Math.round(hy + 18 - h), hex('#5a2a20'));
  }
  // railway viaduct with a steam train: piers every 28 px, arches in between
  const vy = Math.round(H * 0.62);
  for (let x = 0; x < W; x++) {
    const k = ((x % 28) + 28) % 28;
    const arch = k >= 6 ? Math.sqrt(Math.max(0, 1 - Math.pow((k - 17) / 11, 2))) * 14 : 0;
    for (let yy = vy; yy < H; yy++) {
      if (k >= 6 && yy > vy + 18 - arch) continue;
      b.set(x, yy, yy === vy ? hex('#8a7a70') : yy < vy + 4 ? hex('#5a4a44') : k < 2 ? hex('#5a4844') : hex('#4a3a36'));
    }
  }
  const tx = wrapX(t * 26, W + 200) - 100;
  locomotive(b, tx, vy, t);
  wagon(b, tx - 35, vy, t, 1);
  wagon(b, tx - 63, vy, t, 0);
  wagon(b, tx - 91, vy, t, 0);
  for (let p = 0; p < 50; p++) { const ph = (t * 1.2 + hash(p * 3.1)) % 1; const x = tx + 14 - ph * 40, y = vy - 18 - ph * 22 + Math.sin(p) * 2; const r = 1 + ph * 4; ellipse(b, x, y, r, r * 0.8, ph < 0.5 ? hex('#e8e4e0') : hex('#b8b0ac')); }
  // street, lamps, workers
  const st = Math.round(H * 0.8);
  b.rect(0, st, W, H - st, hex('#3a3436'));
  for (let y = st + 3; y < H; y += 3) for (let x = (y % 2) * 2; x < W; x += 5) b.set(x, y, hex('#4a4446'));
  for (let i = 0; i < 5; i++) { const lx = 30 + i * 100; b.vline(lx, st - 26, st, hex('#1e1a1c')); b.rect(lx - 2, st - 30, 5, 4, hex('#ffe08a')); glow(b, lx, st - 28, 10, hex('#ffd060'), 0.35); }
  for (let i = 0; i < 4; i++) drawSprite(b, 'worker', wrapX(W * 0.1 + i * 70 + t * (8 + i), W + 20) - 10, st + 2, t * 1.5 + i, { flip: i % 2 === 1 });
  grade(b, hex('#5a4a3a'), 0.08);
}

// ============ 1969: night launch ============
export function launch(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h, hy = Math.round(H * 0.7);
  const lift = Math.max(0, t - 2.2);
  const rise = lift * lift * 3.2; // px
  const flame = t > 1 ? 1 : 0;
  skyGradient(b, [[0, hex('#060a1c')], [0.6, hex('#1a2448')], [0.9, hex('#6a3a4a')], [1, hex('#d0704a')]], 0, hy);
  stars(b, 140, 41, hy * 0.7, c.amb, 0.9);
  water(b, hy, hex('#0e1a30'), 0.55, t, { ripple: 1, bottom: H });
  const ground = ridge(b, { base: hy + 10, amp: 2, freq: 0.02, seed: 151, fill: hex('#0e1218'), edge: hex('#1e242c') });
  // launch tower (lattice)
  const px = Math.round(W * 0.55), tb = hy + 8, th = 120;
  for (let y = tb - th; y < tb; y++) { b.set(px - 14, y, hex('#a84a2a')); b.set(px - 6, y, hex('#a84a2a')); if ((y - tb) % 8 === 0) b.hline(px - 14, px - 6, y, hex('#a84a2a')); if ((y - tb) % 8 < 8) b.set(px - 14 + ((y - tb) % 8), y, hex('#7a3420')); }
  for (let k = 0; k < 4; k++) b.hline(px - 6, px - 2, tb - 30 - k * 24, hex('#a84a2a'));
  // rocket rising
  const ry = tb - rise;
  if (flame) {
    // exhaust column
    const fl = 26 + Math.sin(c.amb * 30) * 3 + Math.min(40, lift * 10);
    for (let j = 0; j < fl; j++) {
      const f = j / fl, w = Math.max(1, Math.round(3 + f * 4 - f * f * 6));
      for (let i = -w; i <= w; i++) b.set(px + i, Math.round(ry + 2 + j), f < 0.2 ? hex('#ffffff') : f < 0.5 ? hex('#ffe890') : f < 0.8 ? hex('#ff9a3a') : hex('#c8401a'));
    }
    glow(b, px, ry + 10, 34, hex('#ffb060'), 0.55);
    tintCircle(b, px, tb, 120, hex('#ff9a50'), 0.6);
  }
  rocket(b, px, ry);
  // billowing smoke at the pad
  for (let p = 0; p < 70; p++) {
    const ph = ((t * 0.4 + hash(p * 1.7)) % 1) * Math.min(1, t / 2);
    const side = hash(p * 3.3) > 0.5 ? 1 : -1;
    const x = px + side * (8 + ph * 110 * hash(p * 5.1)), y = tb - 2 - ph * 26 * hash(p * 7.7);
    const r = 3 + ph * 12;
    const lit = Math.hypot(x - px, y - tb) < 50;
    ellipse(b, x, y, r, r * 0.7, lit ? hex('#f0c8a0') : hex('#b8b0b8'));
    ellipse(b, x - r * 0.3, y - r * 0.3, r * 0.6, r * 0.4, lit ? hex('#fff0d8') : hex('#d8d4dc'));
  }
  // spectators on the causeway
  for (let i = 0; i < 26; i++) { const x = 10 + i * 9 + Math.round(hash(i) * 4); const h = 6 + Math.round(hash(i * 3) * 3); b.rect(x, H - 8 - h, 3, h, hex('#05060a')); b.rect(x, H - 10 - h, 3, 2, hex('#05060a')); }
  b.rect(0, H - 8, W, 8, hex('#05060a'));
}

// ============ 2026: the networked city ============
export function city2026(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h;
  skyGradient(b, [[0, hex('#04060e')], [0.55, hex('#0e1430')], [0.85, hex('#2a1e44')], [1, hex('#5a2e4a')]], 0, H);
  stars(b, 60, 51, H * 0.4, c.amb, 0.55);
  moonDisc(b, W * 0.8, H * 0.15, 10, [-0.5, -0.2, 0.8], {});
  // satellites crossing
  for (let i = 0; i < 6; i++) { const ph = (t * 0.05 + hash(i * 3.1)) % 1; b.set(Math.round(ph * W), Math.round(H * 0.08 + hash(i * 7) * H * 0.25 + ph * 20), hex('#c8d0e0')); }
  // three layers of towers
  const layers = [
    { n: 34, hmin: 40, hmax: 110, base: H * 0.78, col: '#1a1630', win: 0.15, wc: '#5a4a7a' },
    { n: 22, hmin: 60, hmax: 150, base: H * 0.88, col: '#100e1e', win: 0.35, wc: '#ffd890' },
    { n: 12, hmin: 70, hmax: 190, base: H, col: '#08070e', win: 0.5, wc: '#ffe6a8' },
  ];
  for (const [li, L] of layers.entries()) {
    for (let i = 0; i < L.n; i++) {
      const x = Math.round(hash(i * 3.3 + li * 17) * (W + 40) - 20), w = 14 + Math.round(hash(i * 1.7 + li) * (12 + li * 8)), h = L.hmin + hash(i * 5.1 + li * 3) * (L.hmax - L.hmin);
      const top = Math.round(L.base - h);
      b.rect(x, top, w, Math.round(h), hex(L.col));
      if (hash(i * 9 + li) > 0.6) { b.vline(x + (w >> 1), top - 10, top, hex(L.col)); if (Math.floor(c.amb * 1.5 + i) % 2 === 0) b.set(x + (w >> 1), top - 10, hex('#ff3a3a')); }
      // window grid
      for (let wy = top + 3; wy < L.base - 2; wy += 3 + li) for (let wx = x + 2; wx < x + w - 2; wx += 3) {
        const h2 = hash(wx * 0.37 + wy * 1.31 + li * 7.7);
        if (h2 < L.win * (0.7 + 0.3 * Math.sin(c.amb * 0.3 + i))) b.set(wx, wy, hex(L.wc));
        else if (li === 2 && h2 > 0.985) b.set(wx, wy, hex('#7ad8ff'));
      }
    }
  }
  // data centre with cyan light strips (the age of AI)
  const dx = Math.round(W * 0.34), dw = 70, dy = Math.round(H * 0.66);
  b.rect(dx, dy, dw, H - dy, hex('#0c1218'));
  for (let k = 0; k < 6; k++) { const on = (Math.floor(c.amb * 4) + k) % 6 !== 0; b.hline(dx + 4, dx + dw - 4, dy + 4 + k * 4, on ? hex('#3ae8f0') : hex('#1a6a7a')); }
  glow(b, dx + dw / 2, dy + 12, 40, hex('#1a8a9a'), 0.25);
  // airliner and drones
  airliner(b, wrapX(t * 20, W + 60) - 30, H * 0.22, Math.floor(c.amb * 2) % 2 === 0);
  for (let i = 0; i < 5; i++) drone(b, W * (0.15 + i * 0.17) + Math.sin(t * 0.7 + i) * 12, H * (0.45 + (i % 3) * 0.06) + Math.cos(t + i) * 4, c.amb + i * 0.3);
  // street light streaks
  const sy = H - 5;
  for (let i = 0; i < 30; i++) { const x = wrapX(hash(i * 2.2) * W + t * (40 + hash(i) * 30) * (i % 2 ? 1 : -1), W); b.hline(Math.round(x), Math.round(x + 4), sy + (i % 2), i % 2 ? hex('#ff4a3a') : hex('#fff4d0')); }
}

// ============ A city of the future (scenario) ============
export function future(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h, hy = Math.round(H * 0.7);
  skyGradient(b, [[0, hex('#1a2a5a')], [0.5, hex('#4a6aa8')], [0.85, hex('#e0a8a0')], [1, hex('#ffe0b0')]], 0, hy);
  stars(b, 50, 61, H * 0.25, c.amb, 0.5);
  // orbital ring arcing across the sky with stations
  for (let x = -20; x < W + 20; x++) {
    const f = (x / W - 0.5) * 2;
    const y = Math.round(H * 0.2 + f * f * H * 0.18);
    b.set(x, y, hex('#e8f0ff'));
    if (bayer4(x, y + 1) < 0.5) b.set(x, y + 1, hex('#9ab0d8'));
    if (x % 40 === 0) { b.rect(x - 1, y - 1, 3, 3, hex('#fff6d0')); }
  }
  moonDisc(b, W * 0.84, H * 0.1, 9, [-0.9, -0.1, 0.4], {});
  for (let k = 0; k < 6; k++) b.set(Math.round(W * 0.84 + 2 + hash(k) * 5), Math.round(H * 0.1 + (hash(k * 3) - 0.5) * 10), hex('#ffe08a')); // lunar settlements on the night side
  b.set(Math.round(W * 0.9), Math.round(H * 0.32), hex('#ff7a4a')); // Mars
  sunDisc(b, W * 0.5, hy - 6, 11, hex('#fffbe8'), hex('#ffe6b8'), hex('#f8c8a0'), 3);
  // far hills and a lake reflecting the dawn
  ridge(b, { base: hy - 4, amp: 6, freq: 0.012, seed: 160, fill: hex('#5a7a9a'), edge: hex('#7a9ab8') });
  water(b, hy, hex('#4a6a9a'), 0.45, t, { ripple: 1, sparkle: hex('#fff0d8'), sparkleN: 24 });
  // wind turbines on the far hills
  for (let i = 0; i < 6; i++) {
    const x = Math.round(W * (0.06 + i * 0.07)), by = hy - 3, th = 16;
    b.vline(x, by - th, by, hex('#8a9ab8'));
    for (let k = 0; k < 3; k++) { const a2 = c.amb * 2 + i + (k * Math.PI * 2) / 3; for (let r = 0; r < 6; r++) b.set(Math.round(x + Math.cos(a2) * r), Math.round(by - th + Math.sin(a2) * r), hex('#c8d4e8')); }
  }
  // the city: varied eco-towers, backlit by the dawn (rim light on the sun side, warm windows, green terraces)
  const sunX = W * 0.5;
  const kinds = ['spire', 'dome', 'terrace', 'ring', 'twist', 'spire', 'terrace', 'dome', 'ring'];
  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i];
    const cx = Math.round(W * 0.07 + i * W * 0.107 + (hash(i) - 0.5) * 12);
    const w = 18 + Math.round(hash(i * 2) * 10), h = 70 + hash(i * 3) * 100;
    const base = hy, top = Math.round(base - h);
    for (let y = top; y < base; y++) {
      const f = (y - top) / h;
      let hw = w / 2;
      if (kind === 'spire') hw = (w / 2) * (0.35 + 0.65 * Math.min(1, f * 1.6));
      if (kind === 'terrace') hw = (w / 2) * (0.55 + 0.45 * Math.floor(f * 5) / 4);
      if (kind === 'twist') hw = (w / 2) * (0.8 + 0.2 * Math.sin(f * 14));
      if (kind === 'dome' && f < 0.12) hw = (w / 2) * Math.sqrt(Math.max(0, 1 - Math.pow(1 - f / 0.12, 2)));
      const x0 = Math.round(cx - hw), x1 = Math.round(cx + hw);
      for (let x = x0; x <= x1; x++) {
        const e = (x - x0) / Math.max(1, x1 - x0);
        let col = e < 0.5 ? hex('#2e3a62') : hex('#252e50');
        const towardSun = cx < sunX ? e > 0.85 : e < 0.15;
        if (towardSun) col = hex('#e8b890');
        // windows: warm at dawn, a few dark
        if (!towardSun && (y - top) % 4 === 2 && (x - x0) % 3 === 1 && hash(x * 0.71 + y * 1.37 + i) > 0.35) col = hex('#ffd89a');
        // green terraces every ~11 px
        if ((y - top) % 11 === 0 || (kind === 'terrace' && (y - top) % Math.round(h / 5) === 0)) col = hash(x + y) > 0.3 ? hex('#4a9a4a') : hex('#7ac85a');
        b.set(x, y, col);
      }
      if ((y - top) % 11 === 0) { b.set(x0 - 1, y + 1, hex('#3a7a3a')); b.set(x1 + 1, y + 1, hex('#3a7a3a')); }
    }
    if (kind === 'spire') b.vline(cx, top - 10, top, hex('#c8d4e8'));
    if (kind === 'ring') { const ry = top + Math.round(h * 0.18); b.hline(cx - w, cx + w, ry, hex('#e8eef8')); b.hline(cx - w + 1, cx + w - 1, ry + 1, hex('#8a9ac8')); }
    if (kind === 'dome') b.hline(cx - 2, cx + 2, top + 1, hex('#bfe8ff'));
  }
  // small flyers between the towers
  for (let i = 0; i < 8; i++) { const x = wrapX(hash(i * 3.3) * W + t * (12 + i * 3) * (i % 2 ? 1 : -1), W); b.set(Math.round(x), Math.round(H * (0.35 + (i % 4) * 0.06)), hex('#ffffff')); }
  // shuttle climbing to the ring
  const sh = (t * 0.12) % 1;
  const sx = W * 0.3 + sh * W * 0.25, sy = hy - sh * hy * 0.8;
  for (let k = 0; k < 40; k++) { const f = k / 40; const x = sx - f * W * 0.25 * Math.min(1, sh * 4), y = sy + f * hy * 0.8 * Math.min(1, sh * 4); if (y < hy && f < sh * 4) b.set(Math.round(x), Math.round(y), f < 0.1 ? hex('#ffffff') : hex('#e8d8e8')); }
  glow(b, sx, sy, 3, hex('#fff0d0'), 0.9);
  // parkland foreground with a maglev line
  const fg = ridge(b, { base: H * 0.86, amp: 4, freq: 0.01, seed: 161, fill: hex('#3e7a3a'), edge: hex('#5a9a4a'),
    shadeFn: (x, y) => (tn2(x * 0.2, y * 0.2) > 0.7 ? hex('#2e6a32') : null) });
  b.rect(0, Math.round(H * 0.78), W, 2, hex('#d8e0e8'));
  const mx = wrapX(t * 90, W + 120) - 60;
  b.rect(Math.round(mx), Math.round(H * 0.78) - 5, 50, 5, hex('#f0f4f8'));
  b.rect(Math.round(mx), Math.round(H * 0.78) - 3, 50, 1, hex('#3ad0f0'));
  for (let i = 0; i < 6; i++) broadleaf(b, hash(i * 5.3 + 2) * W, fg[Math.round(clamp(hash(i * 5.3 + 2) * W, 0, W - 1))] + 4, 18 + hash(i) * 10, STY.tropic, i + 1300);
  grass(b, fg, 0, W, 0.5, 5, [hex('#4e8a3a'), hex('#6aa44a')], t, 17);
}
