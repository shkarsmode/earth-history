// Procedural pixel machines: rocket, steam locomotive and wagons, airliner, drone, reed boat, caravel.
// Drawn from rectangles and polygons straight onto the pixel grid (anchor = bottom centre).
import { PixBuf, hex, type RGBA } from '../gfx/pixbuf';
import { poly, ellipse } from './engine';

const OUT = hex('#1a1426');

/** Saturn-V-like rocket, ~9×60 px. (x, y) = bottom centre. */
export function rocket(b: PixBuf, x: number, y: number) {
  x = Math.round(x); y = Math.round(y);
  const L = hex('#f2f0ea'), M = hex('#c8c6c8'), D = hex('#7a7884'), K = hex('#24222a');
  const sec = (y0: number, h: number, hw: number, band?: number[]) => {
    for (let j = 0; j < h; j++) {
      const yy = y0 - j;
      for (let i = -hw; i <= hw; i++) {
        let c = i < 0 ? L : i < hw ? M : D;
        if (band && band.includes(j)) c = i <= 0 ? K : hex('#3a3842');
        b.set(x + i, yy, c);
      }
      b.set(x - hw - 1, yy, OUT); b.set(x + hw + 1, yy, OUT);
    }
  };
  sec(y - 1, 22, 4, [3, 4, 12, 13]); // first stage with roll-pattern bands
  sec(y - 23, 14, 3, [2, 3]); // second stage
  sec(y - 37, 10, 2, [1]); // third stage
  for (let j = 0; j < 4; j++) for (let i = -1; i <= 1; i++) b.set(x + i, y - 47 - j, i < 1 ? L : M); // command module
  for (let j = 0; j < 6; j++) b.set(x, y - 51 - j, j % 2 ? K : D); // escape tower
  // fins and engine bells
  poly(b, [[x - 5, y - 6], [x - 8, y], [x - 4, y]], K);
  poly(b, [[x + 5, y - 6], [x + 9, y], [x + 4, y]], K);
  for (let i = -3; i <= 3; i += 2) b.set(x + i, y, D);
}

/** early steam locomotive facing right, ~42×18 px */
export function locomotive(b: PixBuf, x: number, y: number, t: number) {
  x = Math.round(x - 21); y = Math.round(y);
  const G = hex('#2e5a3a'), GL = hex('#4a7a52'), K = hex('#1c1a1e'), R2 = hex('#a8302a'), BR = hex('#c89a3a');
  // frame
  b.rect(x, y - 6, 42, 2, K);
  // boiler (cylinder with highlight)
  for (let j = 0; j < 8; j++) for (let i = 10; i < 38; i++) b.set(x + i, y - 7 - j, j === 6 ? GL : j === 0 ? hex('#1e3e28') : G);
  for (let i = 14; i < 36; i += 7) b.rect(x + i, y - 15, 1, 8, BR); // brass bands
  // smokebox front + chimney
  b.rect(x + 36, y - 15, 4, 9, K);
  b.rect(x + 33, y - 22, 4, 7, K); b.rect(x + 32, y - 23, 6, 2, K);
  b.rect(x + 22, y - 18, 3, 3, BR); // steam dome
  // cab
  b.rect(x + 1, y - 18, 10, 12, G); b.rect(x, y - 19, 12, 2, K);
  b.rect(x + 3, y - 16, 5, 4, hex('#e8c860'));
  // buffer beam
  b.rect(x + 40, y - 7, 2, 3, R2);
  // wheels with turning spokes
  const wheel = (cx: number, r: number) => {
    ellipse(b, x + cx, y - r, r, r, K);
    ellipse(b, x + cx, y - r, r - 1, r - 1, R2);
    const a = t * 6;
    for (let k = 0; k < 2; k++) { const ang = a + (k * Math.PI) / 2; for (let s = -r + 1; s < r; s++) b.set(Math.round(x + cx + Math.cos(ang) * s), Math.round(y - r + Math.sin(ang) * s), K); }
  };
  wheel(8, 4); wheel(20, 6); wheel(33, 4);
  b.rect(x + 8, y - 5 + Math.round(Math.sin(t * 6) * 1), 26, 1, hex('#8a8a90')); // coupling rod
}

export function wagon(b: PixBuf, x: number, y: number, t: number, kind = 0) {
  x = Math.round(x - 13); y = Math.round(y);
  const body = kind ? hex('#6a3a2a') : hex('#3a4a6a'), hi = kind ? hex('#8a5038') : hex('#5a6a8a');
  b.rect(x, y - 13, 26, 8, body); b.rect(x, y - 13, 26, 1, hi); b.rect(x - 1, y - 14, 28, 1, OUT);
  if (!kind) for (let i = 3; i < 24; i += 6) b.rect(x + i, y - 11, 4, 3, hex('#e8d890'));
  else for (let j = 0; j < 3; j++) b.rect(x + 2 + j * 8, y - 16, 6, 3, hex('#2a2426')); // coal heaps
  b.rect(x, y - 5, 26, 1, OUT);
  for (const cx of [5, 20]) { ellipse(b, x + cx, y - 3, 3, 3, OUT); b.set(x + cx, y - 3, hex('#8a8a90')); b.set(Math.round(x + cx + Math.cos(t * 6) * 2), Math.round(y - 3 + Math.sin(t * 6) * 2), hex('#8a8a90')); }
}

export function airliner(b: PixBuf, x: number, y: number, blink: boolean) {
  x = Math.round(x - 11); y = Math.round(y);
  const W = hex('#e8ecf2'), S = hex('#9aa4b8'), B2 = hex('#3a6ab8');
  b.rect(x + 2, y - 4, 19, 3, W); b.rect(x + 2, y - 2, 19, 1, S);
  b.set(x + 21, y - 3, W); b.set(x + 1, y - 3, W);
  b.rect(x + 3, y - 3, 17, 1, B2); // cheat line
  for (let i = 6; i < 19; i += 2) b.set(x + i, y - 4, hex('#5a6a8a')); // windows
  poly(b, [[x + 2, y - 4], [x + 5, y - 4], [x + 3, y - 9], [x + 1, y - 9]], W); // tail fin
  b.rect(x + 9, y - 2, 6, 1, S); b.rect(x + 12, y - 1, 3, 1, S); // wing
  b.rect(x + 11, y, 3, 1, hex('#5a6070')); // engine
  if (blink) { b.set(x + 1, y - 9, hex('#ff3a3a')); b.set(x + 12, y + 1, hex('#ffffff')); }
}

export function drone(b: PixBuf, x: number, y: number, t: number) {
  x = Math.round(x); y = Math.round(y);
  b.rect(x - 1, y - 1, 3, 2, hex('#2a2e3a'));
  const spin = Math.floor(t * 20) % 2;
  b.hline(x - 4, x - 2, y - 2 + spin * 0, hex('#9aa4b8')); b.hline(x + 2, x + 4, y - 2, hex('#9aa4b8'));
  b.set(x, y + 1, Math.floor(t * 3) % 2 ? hex('#3af08a') : hex('#1a6a3a'));
}

/** Mesopotamian reed boat with a rower, ~22×8 */
export function reedboat(b: PixBuf, x: number, y: number, t: number) {
  x = Math.round(x); y = Math.round(y);
  for (let i = -11; i <= 11; i++) {
    const f = i / 11;
    const top = Math.round(-3 - (Math.abs(f) > 0.75 ? (Math.abs(f) - 0.75) * 18 : 0));
    for (let j = top; j <= 0; j++) b.set(x + i, y + j, j === top ? hex('#e0c47a') : (i + j) % 3 === 0 ? hex('#a8823e') : hex('#c8a258'));
  }
  // rower
  b.rect(x - 1, y - 9, 2, 5, hex('#5a3a28')); b.rect(x - 1, y - 11, 2, 2, hex('#3a2418'));
  const oar = Math.sin(t * 2.4) * 3;
  b.line(x, y - 7, Math.round(x + 5 + oar), y + 2, hex('#6a4a2a'));
}

/** caravel with lateen and square sails bearing a red cross, ~34×34 */
export function caravel(b: PixBuf, x: number, y: number, t: number) {
  x = Math.round(x); y = Math.round(y + Math.sin(t * 1.3) * 1);
  const H1 = hex('#6a3e22'), H2 = hex('#4a2a18'), SAIL = hex('#efe4c8'), SAILD = hex('#cbbd9e'), RED = hex('#b8302a');
  // hull with raised stern castle
  poly(b, [[x - 16, y - 7], [x + 17, y - 6], [x + 13, y], [x - 12, y]], H1);
  poly(b, [[x - 17, y - 12], [x - 8, y - 12], [x - 8, y - 7], [x - 16, y - 7]], H1);
  b.hline(x - 15, x + 15, y - 4, H2); b.hline(x - 13, x + 13, y - 1, H2);
  for (let i = -10; i <= 10; i += 4) b.set(x + i, y - 5, hex('#1e1410')); // gun ports / oar holes
  // masts
  b.vline(x + 4, y - 34, y - 7, H2); b.vline(x - 6, y - 28, y - 7, H2); b.vline(x + 13, y - 22, y - 6, H2);
  // main square sail with a cross
  for (let j = 0; j < 14; j++) { const bulge = Math.round(Math.sin((j / 13) * Math.PI) * 2); for (let i = -6; i <= 6 + bulge; i++) b.set(x + 4 + i, y - 30 + j, i > 3 ? SAILD : SAIL); }
  b.rect(x + 3, y - 28, 2, 10, RED); b.rect(x - 1, y - 24, 10, 2, RED);
  // lateen sails (triangles)
  poly(b, [[x - 6, y - 28], [x - 15, y - 11], [x - 6, y - 11]], SAIL);
  poly(b, [[x + 13, y - 22], [x + 19, y - 9], [x + 13, y - 9]], SAILD);
  // pennant
  const f = Math.sin(t * 4) > 0 ? 1 : 0;
  b.hline(x + 5, x + 9 + f, y - 34, RED);
}
