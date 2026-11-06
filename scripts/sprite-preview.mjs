// Sprite sheet preview: renders every sprite of src/dio/sprites.ts (all frames side by side, in
// definition order, labelled) at 4x on a mid-grey and on a dark panel, and checks the data.
//
//   node scripts/sprite-preview.mjs [--scale 4] [--only trex,mammoth] [--out .snaps/sprites-sheet.png]
//
// The red tick under each frame marks the anchor (default bottom-centre).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePNG } from './png.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ---------- args ----------
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
};
const SCALE = Math.max(1, parseInt(opt('scale', '4'), 10) || 4);
const ONLY = opt('only', '') ? opt('only', '').split(',').map((s) => s.trim()).filter(Boolean) : null;
const OUT = path.resolve(root, opt('out', '.snaps/sprites-sheet.png'));

// ---------- load the TS data without a TS toolchain ----------
function loadSprites() {
  let src = fs.readFileSync(path.join(root, 'src/dio/sprites.ts'), 'utf8');
  src = src.replace(/export\s+interface\s+\w+\s*\{[\s\S]*?\n\}/g, '');
  src = src.replace(/:\s*Record<string,\s*SpriteDef>/g, '');
  src = src.replace(/export\s+const\s+SPRITES/, 'const SPRITES');
  return new Function(src + '\nreturn SPRITES;')();
}

// ---------- validation ----------
function validate(sprites) {
  const problems = [];
  const notes = [];
  for (const [key, s] of Object.entries(sprites)) {
    const bad = (m) => problems.push(`${key}: ${m}`);
    if (!s.pal || typeof s.pal !== 'object') { bad('missing pal'); continue; }
    for (const [ch, col] of Object.entries(s.pal)) {
      if (ch === '.' || ch === ' ') bad(`'${ch}' must not be in pal`);
      if (ch.length !== 1) bad(`pal key '${ch}' is not one char`);
      if (!/^#[0-9a-fA-F]{6}$/.test(col)) bad(`pal '${ch}' = '${col}' is not #rrggbb`);
    }
    if (!Array.isArray(s.frames) || !s.frames.length) { bad('no frames'); continue; }
    const h = s.frames[0].length;
    const w = s.frames[0][0]?.length ?? 0;
    const used = new Set();
    s.frames.forEach((f, fi) => {
      if (f.length !== h) bad(`frame ${fi} has ${f.length} rows, expected ${h}`);
      f.forEach((row, y) => {
        if (row.length !== w) bad(`frame ${fi} row ${y} has length ${row.length}, expected ${w}`);
        for (const ch of row) {
          if (ch === '.' || ch === ' ') continue;
          if (!(ch in s.pal)) bad(`frame ${fi} row ${y}: char '${ch}' not in pal`);
          used.add(ch);
        }
      });
    });
    const unused = Object.keys(s.pal).filter((c) => !used.has(c));
    if (unused.length) notes.push(`${key}: unused pal ${unused.join('')}`);
    const n = Object.keys(s.pal).length;
    if (n > 10) notes.push(`${key}: ${n} colours`);
    // floating specks: opaque pixels with no opaque 8-neighbour
    s.frames.forEach((f, fi) => {
      const op = (x, y) => y >= 0 && y < f.length && x >= 0 && x < w && f[y][x] !== '.' && f[y][x] !== ' ';
      for (let y = 0; y < f.length; y++)
        for (let x = 0; x < w; x++) {
          if (!op(x, y)) continue;
          let nb = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && op(x + dx, y + dy)) nb++;
          if (!nb) notes.push(`${key}: frame ${fi} isolated pixel at ${x},${y}`);
        }
    });
  }
  return { problems, notes };
}

// ---------- tiny 3x5 font ----------
const GLYPHS = {
  a: ['.#.', '#.#', '###', '#.#', '#.#'], b: ['##.', '#.#', '##.', '#.#', '##.'], c: ['.##', '#..', '#..', '#..', '.##'],
  d: ['##.', '#.#', '#.#', '#.#', '##.'], e: ['###', '#..', '##.', '#..', '###'], f: ['###', '#..', '##.', '#..', '#..'],
  g: ['.##', '#..', '#.#', '#.#', '.##'], h: ['#.#', '#.#', '###', '#.#', '#.#'], i: ['###', '.#.', '.#.', '.#.', '###'],
  j: ['..#', '..#', '..#', '#.#', '.#.'], k: ['#.#', '#.#', '##.', '#.#', '#.#'], l: ['#..', '#..', '#..', '#..', '###'],
  m: ['#.#', '###', '###', '#.#', '#.#'], n: ['##.', '#.#', '#.#', '#.#', '#.#'], o: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  p: ['##.', '#.#', '##.', '#..', '#..'], q: ['.#.', '#.#', '#.#', '##.', '.##'], r: ['##.', '#.#', '##.', '#.#', '#.#'],
  s: ['.##', '#..', '.#.', '..#', '##.'], t: ['###', '.#.', '.#.', '.#.', '.#.'], u: ['#.#', '#.#', '#.#', '#.#', '###'],
  v: ['#.#', '#.#', '#.#', '#.#', '.#.'], w: ['#.#', '#.#', '###', '###', '#.#'], x: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  y: ['#.#', '#.#', '.#.', '.#.', '.#.'], z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'], 7: ['###', '..#', '.#.', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'],
  _: ['...', '...', '...', '...', '###'], '-': ['...', '...', '###', '...', '...'], ':': ['...', '.#.', '...', '.#.', '...'],
  '.': ['...', '...', '...', '...', '.#.'], '/': ['..#', '..#', '.#.', '#..', '#..'], '×': ['...', '#.#', '.#.', '#.#', '...'],
  ' ': ['...', '...', '...', '...', '...'], '(': ['.#.', '#..', '#..', '#..', '.#.'], ')': ['.#.', '..#', '..#', '..#', '.#.'],
  '=': ['...', '###', '...', '###', '...'], '+': ['...', '.#.', '###', '.#.', '...'], '#': ['#.#', '###', '#.#', '###', '#.#'],
};
const FONT = Object.fromEntries(Object.entries(GLYPHS).map(([k, rows]) => [k, rows.join('')]));

// ---------- raster ----------
function makeCanvas(w, h) {
  return { w, h, px: new Uint8Array(w * h * 4) };
}
function hexRGB(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function fill(cv, x, y, w, h, rgb) {
  const x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(cv.w, x + w), y1 = Math.min(cv.h, y + h);
  for (let j = y0; j < y1; j++)
    for (let i = x0; i < x1; i++) {
      const o = (j * cv.w + i) * 4;
      cv.px[o] = rgb[0]; cv.px[o + 1] = rgb[1]; cv.px[o + 2] = rgb[2]; cv.px[o + 3] = 255;
    }
}
function text(cv, str, x, y, s, rgb) {
  let pen = x;
  for (const ch of String(str).toLowerCase()) {
    const g = FONT[ch] ?? FONT[' '];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '#') fill(cv, pen + i * s, y + j * s, s, s, rgb);
    pen += 4 * s;
  }
  return pen;
}
const textW = (str, s) => String(str).length * 4 * s - s;
function blit(cv, frame, pal, x, y, s) {
  for (let j = 0; j < frame.length; j++)
    for (let i = 0; i < frame[j].length; i++) {
      const ch = frame[j][i];
      if (ch === '.' || ch === ' ' || !pal[ch]) continue;
      fill(cv, x + i * s, y + j * s, s, s, hexRGB(pal[ch]));
    }
}

// ---------- layout ----------
const COL = {
  sheet: [52, 52, 58],
  label: [230, 228, 220],
  dim: [150, 150, 160],
  grey: [127, 127, 127],
  greyBox: [137, 137, 137],
  dark: [22, 20, 28],
  darkBox: [32, 30, 40],
  anchor: [220, 60, 60],
};

const sprites = loadSprites();
const { problems, notes } = validate(sprites);
for (const p of problems) console.error('ERROR', p);
for (const n of notes) console.log('note ', n);

const keys = Object.keys(sprites).filter((k) => !ONLY || ONLY.includes(k));
const S = SCALE;
const FS = 2; // label font scale
const PAD = 6, GAP = Math.max(4, S * 2), M = 12;
const LABEL_H = 5 * FS + 6;
const NUM_H = 5 * FS + 4;

const cards = keys.map((key) => {
  const s = sprites[key];
  const h = s.frames[0].length, w = s.frames[0][0].length, n = s.frames.length;
  const stripW = n * w * S + (n - 1) * GAP;
  const panelW = stripW + 2 * PAD, panelH = h * S + 2 * PAD + NUM_H;
  const label = `${key} ${w}×${h} f${n}` + (s.fps ? ` fps${s.fps}` : '');
  const cw = Math.max(panelW * 2 + 4, textW(label, FS));
  return { key, s, w, h, n, panelW, panelH, label, cw, ch: LABEL_H + panelH };
});

const SHEET_W = Math.max(1200, ...cards.map((c) => c.cw + 2 * M));
let cx = M, cy = M, rowH = 0;
for (const c of cards) {
  if (cx + c.cw > SHEET_W - M && cx > M) { cx = M; cy += rowH + M; rowH = 0; }
  c.x = cx; c.y = cy;
  cx += c.cw + M;
  rowH = Math.max(rowH, c.ch);
}
const SHEET_H = cy + rowH + M;
const cv = makeCanvas(SHEET_W, SHEET_H);
fill(cv, 0, 0, SHEET_W, SHEET_H, COL.sheet);

for (const c of cards) {
  text(cv, c.label, c.x, c.y, FS, COL.label);
  const py = c.y + LABEL_H;
  [[COL.grey, COL.greyBox], [COL.dark, COL.darkBox]].forEach(([bg, box], pi) => {
    const px = c.x + pi * (c.panelW + 4);
    fill(cv, px, py, c.panelW, c.panelH, bg);
    for (let f = 0; f < c.n; f++) {
      const fx = px + PAD + f * (c.w * S + GAP), fy = py + PAD;
      fill(cv, fx, fy, c.w * S, c.h * S, box);
      blit(cv, c.s.frames[f], c.s.pal, fx, fy, S);
      const ax = c.s.ax ?? c.w / 2, ay = c.s.ay ?? c.h;
      fill(cv, fx + Math.round(ax * S) - 1, fy + Math.round(ay * S) + 1, 2, 3, COL.anchor);
      if (pi === 0) text(cv, String(f), fx, fy + c.h * S + 5, FS, [40, 40, 48]);
    }
  });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, encodePNG(SHEET_W, SHEET_H, cv.px));
console.log(`${keys.length} sprites -> ${path.relative(root, OUT)} (${SHEET_W}x${SHEET_H})` + (problems.length ? `, ${problems.length} ERRORS` : ''));
if (problems.length) process.exitCode = 1;
