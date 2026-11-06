// Surface dioramas, life on land: Devonian shore, Carboniferous swamp forest, end-Permian,
// Jurassic, Late Cretaceous, Paleogene jungle, Pliocene savanna.
import { PixBuf, hex } from '../gfx/pixbuf';
import { hash, clamp } from '../core/hash';
import { skyGradient, stars, sunDisc, moonDisc, ridge, water, pal, tn2, glow, rain, grade, bayer4, bayer8, lerpc, shade, ellipse, tintCircle } from './engine';
import { lycopsid, treefern, horsetail, conifer, cycad, palm, acacia, broadleaf, deadtree, grass, cloud, STY, type PlantStyle } from './flora';
import { drawSprite, spriteSize } from './spr';
import type { Ctx } from './scenesDeep';

const wrapX = (x: number, W: number) => ((x % W) + W) % W;
const silStyle = (c: string): PlantStyle => ({ trunk: hex(c), trunkDark: hex(c), leaf: hex(c), leafDark: hex(c), leafLight: hex(c), sil: hex(c) });

function lightShafts(b: PixBuf, x0: number, n: number, c: string, k: number, t: number, slant = 0.45) {
  const W = b.w, H = b.h, col = hex(c);
  for (let s = 0; s < n; s++) {
    const sx = x0 + s * 38 + hash(s * 3.3) * 20 + Math.sin(t * 0.15 + s) * 6;
    const w = 6 + hash(s * 7.1) * 14;
    for (let y = 0; y < H * 0.9; y++) {
      const fall = 1 - y / (H * 0.9);
      for (let j = 0; j < w; j++) {
        const x = Math.round(sx + y * slant + j);
        if (x < 0 || x >= W) continue;
        const a = fall * k * Math.sin((j / w) * Math.PI);
        if (a > bayer8(x, y)) { const i = y * W + x; b.u32[i] = lerpc(b.u32[i], col, 0.35); }
      }
    }
  }
}

// ============ Devonian: the first forests and fish with legs ============
export function devonian(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h, hy = Math.round(H * 0.56);
  skyGradient(b, [[0, hex('#2e5a9e')], [0.55, hex('#7aa6d2')], [0.85, hex('#d8e2d6')], [1, hex('#f2e2b8')]], 0, hy);
  sunDisc(b, W * 0.78, hy - 22, 9, hex('#fffbe8'), hex('#fff0c8'), hex('#f2dcb0'), 3);
  cloud(b, W * 0.25 + t * 1.5, H * 0.14, 70, hex('#ffffff'), hex('#e2ecf4'), hex('#b8cce0'), 3);
  cloud(b, W * 0.6 + t * 1.0, H * 0.22, 46, hex('#f6fafc'), hex('#dce6f0'), hex('#b0c4d8'), 7);
  ridge(b, { base: hy - 12, amp: 12, freq: 0.012, seed: 61, fill: hex('#7a98a8'), edge: hex('#94b0be'), depth: 30 });
  // Archaeopteris woods on the far shore, the planet's first forests
  const far = ridge(b, { base: hy - 3, amp: 4, freq: 0.03, seed: 62, fill: hex('#5e7a5a'), edge: hex('#6e8a64') });
  for (let i = 0; i < 22; i++) { const x = hash(i * 2.3) * W; conifer(b, x, far[Math.round(clamp(x, 0, W - 1))] + 1, 22 + hash(i) * 20, silStyle(i % 2 ? '#56724e' : '#4e6a48'), i); }
  water(b, hy, hex('#3e6a6a'), 0.4, t, { ripple: 1, sparkle: hex('#fff6e0'), sparkleN: 40 });
  // morning mist over the lagoon
  for (let y = hy - 4; y < hy + 8; y++) for (let x = 0; x < W; x++) { const a2 = (1 - Math.abs(y - hy - 2) / 7) * 0.45 * tn2(x * 0.03 + t * 0.15, y * 0.2); if (a2 > bayer4(x, y)) b.set(x, y, hex('#dfe8e0')); }
  // muddy shore carpeted with the first low plants
  const shore = ridge(b, { base: H * 0.72, amp: 7, freq: 0.01, seed: 64, fill: hex('#5e4a32'), edge: hex('#8a7a52'),
    shadeFn: (x, y, d) => (d < 2 ? hex('#7a6a48') : tn2(x * 0.2, y * 0.3) > 0.62 ? hex('#3e5a2a') : tn2(x * 0.15 + 4, y * 0.2) > 0.7 ? hex('#4e6a32') : null) });
  // wet sand line with lapping foam
  for (let x = 0; x < W; x++) { const y = shore[x] - 1; if (tn2(x * 0.1, t * 0.6) > 0.55) b.set(x, y, hex('#e8eee0')); }
  for (let i = 0; i < 110; i++) { // Psilophyton/Rhynia-like forked stems
    const x = hash(i * 1.91) * W;
    const gy = shore[Math.round(clamp(x, 0, W - 1))] + 2 + Math.floor(hash(i * 3.1) * 26);
    const h = 5 + hash(i * 4.4) * 10;
    const sw = Math.sin(t * 1.2 + i) * 0.8;
    for (let y = 0; y < h; y++) b.set(Math.round(x + sw * y / h), gy - y, y < h * 0.5 ? hex('#4e7a2a') : hex('#6a9a34'));
    b.set(Math.round(x + sw - 1), Math.round(gy - h), hex('#a8c050')); b.set(Math.round(x + sw + 1), Math.round(gy - h), hex('#a8c050'));
    if (i % 3 === 0) b.set(Math.round(x + sw), Math.round(gy - h - 1), hex('#d8c060')); // sporangia
  }
  // two young Archaeopteris trees on the near bank
  conifer(b, W * 0.12, shore[Math.round(W * 0.12)] + 3, 58, STY.devonian, 70);
  conifer(b, W * 0.9, shore[Math.round(W * 0.9)] + 3, 46, STY.devonian, 71);
  // Tiktaalik propping itself at the waterline, fish in the shallows
  const tx = W * 0.45 + Math.sin(t * 0.3) * 8;
  drawSprite(b, 'tiktaalik', tx, shore[Math.round(clamp(tx, 0, W - 1))] + 2, t);
  for (let i = 0; i < 6; i++) drawSprite(b, 'fish', wrapX(hash(i * 5.5) * W + t * (8 + i * 3) * (i % 2 ? -1 : 1), W + 20) - 10, hy + 8 + i * 5, t + i, { tint: hex('#3e6a6a'), tintK: 0.45, flip: i % 2 === 1 });
  drawSprite(b, 'eurypterid', W * 0.7 + Math.sin(t * 0.2) * 10, hy + 26, t, { tint: hex('#3e6a6a'), tintK: 0.35 });
}

// ============ Carboniferous swamp forest ============
export function carbon(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h, wy = Math.round(H * 0.74);
  skyGradient(b, [[0, hex('#1e3a2c')], [0.5, hex('#4a6e50')], [0.85, hex('#9ab88c')], [1, hex('#b8d0a4')]], 0, wy);
  const sway = Math.sin(t * 0.6) * 1.5;
  // far misty trunks
  for (let i = 0; i < 26; i++) { const x = hash(i * 3.7) * (W + 40) - 20; lycopsid(b, x, wy, 90 + hash(i * 1.1) * 60, 2 + hash(i) * 2, silStyle('#7a9a7a'), i, sway * 0.3); }
  lightShafts(b, -60, 9, '#e8f2c0', 0.5, t);
  for (let i = 0; i < 16; i++) { const x = hash(i * 5.3 + 9) * (W + 40) - 20; lycopsid(b, x, wy + 2, 110 + hash(i * 2.2) * 70, 3 + hash(i * 1.5) * 2, silStyle('#4e6e52'), i + 50, sway * 0.6); }
  // fog at the water
  for (let y = wy - 14; y < wy + 4; y++) for (let x = 0; x < W; x++) { const a = (1 - Math.abs(y - wy + 5) / 10) * 0.5 * (0.6 + 0.4 * tn2(x * 0.03 + t * 0.2, y * 0.1)); if (a > bayer4(x, y)) b.set(x, y, hex('#a8c098')); }
  water(b, wy, hex('#1c3424'), 0.55, t, { ripple: 1 });
  // near detailed trees and undergrowth
  const near = [0.06, 0.3, 0.78, 0.96];
  for (const [i, f] of near.entries()) lycopsid(b, f * W, H + 4, H * (0.72 + hash(i) * 0.14), 5 + hash(i * 2) * 3, STY.carbonNear, i * 7 + 100, sway);
  for (let i = 0; i < 6; i++) treefern(b, hash(i * 7.7 + 3) * W, H - 6 - hash(i) * 10, 30 + hash(i * 3) * 20, STY.carbonMid, i + 200, sway);
  for (let i = 0; i < 14; i++) horsetail(b, hash(i * 2.9 + 1) * W, H - hash(i * 1.3) * 8, 18 + hash(i * 4.1) * 26, STY.carbonNear, i + 300, sway);
  // floating mats
  for (let i = 0; i < 40; i++) { const x = wrapX(hash(i * 1.7) * W + t * 1.2, W), y = wy + 3 + hash(i * 3.3) * (H - wy - 12); b.hline(Math.round(x), Math.round(x + 2 + hash(i) * 4), Math.round(y), hex('#3e6a2e')); }
  // Meganeura patrolling
  const mx = wrapX(t * 34, W + 80) - 40, my = H * 0.42 + Math.sin(t * 1.7) * 14;
  drawSprite(b, 'meganeura', mx, my, t * 3, {});
  drawSprite(b, 'meganeura', wrapX(W - t * 22, W + 80) - 40, H * 0.28 + Math.cos(t * 1.3) * 10, t * 3 + 0.5, { flip: true, tint: hex('#4a6e50'), tintK: 0.5 });
}

// ============ End-Permian: the Siberian Traps ============
export function permian(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h, hy = Math.round(H * 0.55);
  skyGradient(b, [[0, hex('#1a0806')], [0.5, hex('#3e120a')], [0.85, hex('#7a2a10')], [1, hex('#a84a1a')]], 0, hy);
  sunDisc(b, W * 0.78, H * 0.2, 9, hex('#e8603a'), hex('#b8401e'), hex('#6a2010'), 2.2);
  // ash clouds
  for (let y = 0; y < hy; y += 1) { const ry = y * 0.04; for (let x = 0; x < W; x++) { const n = tn2((x + t * 6) * 0.015, ry); if (n > 0.6) b.u32[y * W + x] = n > 0.7 ? 0xff080e2a : 0xff0c1a4a; } }
  // fissure eruption: a curtain of fire along the horizon
  const ground = ridge(b, { base: hy, amp: 3, freq: 0.02, seed: 71, fill: hex('#1c0a06'), edge: hex('#3a140a'), depth: 6 });
  for (let x = 0; x < W; x++) {
    const act = tn2(x * 0.05, 3) > 0.48 ? 1 : 0;
    if (!act) continue;
    const h = 6 + tn2(x * 0.3, t * 3) * 16;
    for (let y = 0; y < h; y++) { const f = y / h; b.set(x, ground[x] - y, f < 0.3 ? hex('#fff0a0') : f < 0.6 ? hex('#ffa030') : hex('#d8401a')); }
  }
  // smoke columns rising from the fissure
  for (let p = 0; p < 500; p++) {
    const ph = ((t * 0.1 + hash(p * 1.31)) % 1);
    const x0 = hash(p * 2.2) * W;
    const x = x0 + ph * 40 + (tn2(p * 0.1, t * 0.2) - 0.5) * 20 * ph;
    const y = hy - 10 - ph * hy;
    if (y > 0) b.set(Math.round(x), Math.round(y), ph < 0.3 ? hex('#2a1410') : hex('#3a1a12'));
  }
  // lava plain with flows
  for (let y = hy + 1; y < H; y++) {
    const d = y - hy;
    const z = 50 / d;
    for (let x = 0; x < W; x++) {
      const wx = (x - W / 2) * z * 0.02, wz = z * 0.5;
      const flow = tn2(wx * 2 + 20, wz * 2 + t * 0.15);
      const ridgeN = 1 - Math.abs(flow * 2 - 1);
      let col = (Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? hex('#2a1610') : hex('#24120c');
      if (ridgeN > 0.86) col = ridgeN > 0.94 ? hex('#ffb040') : hex('#c8401a');
      else if (tn2(wx * 6, wz * 6) > 0.72) col = hex('#3e2014');
      b.u32[y * W + x] = col;
    }
  }
  // a dark basalt ridge in the foreground with faintly glowing cracks, dead Glossopteris trees
  const fg = ridge(b, { base: H * 0.76, amp: 6, freq: 0.015, seed: 72, fill: hex('#1a0c0a'), edge: hex('#4a1e12'),
    shadeFn: (x, y, d) => (d > 1 && tn2(x * 0.3, y * 0.4) > 0.8 ? (tn2(x * 0.3 + t * 0.5, y) > 0.55 ? hex('#a83a14') : hex('#3a1a10')) : null) });
  for (let i = 0; i < 6; i++) { const x = hash(i * 4.4) * W; deadtree(b, x, fg[Math.round(clamp(x, 0, W - 1))] + 2, 34 + hash(i * 2) * 30, hex('#100604'), i * 5); }
  const lx = W * 0.3 + t * 3;
  drawSprite(b, 'lystrosaurus', lx, fg[Math.round(clamp(lx, 0, W - 1))] + 4, t, { tint: hex('#3a140a'), tintK: 0.3 });
  // falling ash
  for (let i = 0; i < 300; i++) { const y = (hash(i * 1.9) * H + t * (10 + hash(i) * 10)) % H, x = wrapX(hash(i * 3.3) * W + Math.sin(t + i) * 6 + t * 4, W); b.set(Math.round(x), Math.round(y), hash(i * 7) > 0.6 ? hex('#8a7a70') : hex('#5a4a44')); }
  grade(b, hex('#5a1a08'), 0.12);
}

// ============ Jurassic: giants by the river ============
export function jurassic(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h, hy = Math.round(H * 0.58);
  skyGradient(b, [[0, hex('#3a72c8')], [0.55, hex('#7cb0e2')], [1, hex('#dcecdc')]], 0, hy);
  cloud(b, W * 0.18 + t * 2, H * 0.14, 80, hex('#ffffff'), hex('#e6eef6'), hex('#b8c8dc'), 11);
  cloud(b, W * 0.62 + t * 1.4, H * 0.1, 60, hex('#ffffff'), hex('#e6eef6'), hex('#b8c8dc'), 12);
  // smoking volcano far away
  const vx = W * 0.82;
  ridge(b, { base: hy - 12, amp: 8, freq: 0.01, seed: 81, fill: hex('#8aa6c0'), edge: hex('#a0bad0'),
    peaks: (x) => { const d = Math.abs(x - vx) / 60; return d < 1 ? 46 * (1 - d) * (1 - 0.3 * Math.max(0, 0.15 - d) / 0.15) : 0; } });
  for (let p = 0; p < 160; p++) { const ph = (t * 0.08 + hash(p * 1.7)) % 1; const x = vx - ph * 50 + (tn2(p * 0.2, t * 0.2) - 0.5) * 16 * ph; const y = hy - 58 - ph * 60; b.set(Math.round(x), Math.round(y), ph < 0.4 ? hex('#9aa4b0') : hex('#b8c4d0')); }
  // conifer forest (blue-green, misty)
  const fr = ridge(b, { base: hy - 2, amp: 4, freq: 0.03, seed: 82, fill: hex('#4a7a6a'), edge: hex('#5e8e78') });
  for (let i = 0; i < 30; i++) { const x = hash(i * 2.1 + 5) * W; conifer(b, x, fr[Math.round(clamp(x, 0, W - 1))], 30 + hash(i * 1.7) * 26, silStyle(i % 2 ? '#3e6e5e' : '#467a68'), i + 400); }
  water(b, hy, hex('#3a6a8a'), 0.42, t, { ripple: 1, sparkle: hex('#ffffff'), sparkleN: 25, bottom: Math.round(H * 0.72) });
  const bank = ridge(b, { base: H * 0.76, amp: 4, freq: 0.012, seed: 84, fill: hex('#5a7a32'), edge: hex('#7a9a44'),
    shadeFn: (x, y, d) => (tn2(x * 0.2, y * 0.2) > 0.66 ? hex('#4a6a2a') : tn2(x * 0.25 + 3, y * 0.3) > 0.78 ? hex('#6e5a38') : null) });
  // sauropods wading / walking along the far bank
  for (let i = 0; i < 3; i++) {
    const x = wrapX(W * (0.15 + i * 0.32) + t * 4, W + 160) - 80;
    drawSprite(b, 'sauropod', x, Math.round(H * 0.7) - i * 3, t * 0.8 + i, { tint: hex('#7cb0e2'), tintK: 0.18 + i * 0.08 });
  }
  // pterosaurs
  for (let i = 0; i < 3; i++) drawSprite(b, 'pterosaur', wrapX(W * 0.2 + i * 70 + t * (18 + i * 4), W + 60) - 30, H * (0.18 + i * 0.07) + Math.sin(t + i) * 4, t * 1.5 + i);
  // near bank: big conifers framing the view, cycads and tree ferns
  conifer(b, W * 0.04, bank[Math.round(W * 0.04)] + 6, 120, STY.jurassic, 450);
  conifer(b, W * 0.97, bank[Math.round(W * 0.97)] + 6, 104, STY.jurassic, 451);
  for (let i = 0; i < 7; i++) { const x = W * (0.12 + i * 0.13) + (hash(i * 3.3 + 7) - 0.5) * 20; cycad(b, x, bank[Math.round(clamp(x, 0, W - 1))] + 8 + hash(i) * 6, 16 + hash(i * 2) * 10, STY.jurassic, i + 500); }
  for (let i = 0; i < 6; i++) { const x = hash(i * 5.7 + 2) * W; treefern(b, x, bank[Math.round(clamp(x, 0, W - 1))] + 14, 30 + hash(i * 4) * 20, STY.jurassic, i + 600, Math.sin(t * 0.7) * 1.5); }
  grass(b, bank, 0, W, 0.5, 6, [hex('#4e7a2a'), hex('#6a9a34'), hex('#3a5e22')], t, 7);
}

// ============ Late Cretaceous: flowers, Triceratops, T. rex — and a new star ============
export function cretaceous(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h, hy = Math.round(H * 0.6);
  skyGradient(b, [[0, hex('#3a4a8a')], [0.45, hex('#a8708a')], [0.8, hex('#f0a060')], [1, hex('#f8d090')]], 0, hy);
  sunDisc(b, W * 0.2, hy - 18, 10, hex('#fff4d0'), hex('#ffd890'), hex('#f0a060'), 3);
  // the asteroid: a growing point of light with a short tail (last moments of the Mesozoic)
  const ast = clamp((c.u - 0.75) / 0.25);
  if (ast > 0) {
    const ax = W * 0.74 - ast * 10, ay = H * 0.14 + ast * 6;
    for (let k = 0; k < 4 + ast * 14; k++) b.set(Math.round(ax + k * 0.8), Math.round(ay - k * 0.45), k < 3 ? hex('#ffffff') : hex('#ffd0a0'));
    glow(b, ax, ay, 3 + ast * 5, hex('#fff0d0'), 0.8);
  }
  ridge(b, { base: hy - 10, amp: 10, freq: 0.01, seed: 91, fill: hex('#8a6a8a'), edge: hex('#a8809a') });
  const plain = ridge(b, { base: hy, amp: 3, freq: 0.03, seed: 92, fill: hex('#6a6a3a'), edge: hex('#8a8444') });
  for (let i = 0; i < 26; i++) { const x = hash(i * 1.3 + 9) * W; broadleaf(b, x, plain[Math.round(clamp(x, 0, W - 1))], 10 + hash(i) * 8, silStyle(i % 2 ? '#5a5a3a' : '#646640'), i + 700); }
  // grassland-less ground: ferns & low flowering shrubs
  const fg = ridge(b, { base: H * 0.76, amp: 5, freq: 0.01, seed: 93, fill: hex('#4e5e2a'), edge: hex('#6a7a34'),
    shadeFn: (x, y, d) => (tn2(x * 0.2, y * 0.2) > 0.68 ? hex('#3e4e22') : tn2(x * 0.4 + 2, y * 0.4) > 0.86 ? hex('#e88aa8') : null) });
  // Triceratops herd in the middle distance
  for (let i = 0; i < 4; i++) drawSprite(b, 'triceratops', wrapX(W * 0.45 + i * 46 + t * 2, W + 120) - 60, Math.round(H * 0.72) + (i % 2) * 4, t + i * 0.7, { tint: hex('#f0a060'), tintK: 0.2 });
  // magnolia-like flowering trees
  for (let i = 0; i < 4; i++) broadleaf(b, hash(i * 7.3 + 1) * W, fg[Math.round(clamp(hash(i * 7.3 + 1) * W, 0, W - 1))] + 2, 26 + hash(i) * 10, STY.cretaceous, i + 800, i % 2 ? hex('#f6d6e6') : hex('#ffffff'));
  // T. rex stalking in the foreground
  const tx = W * 0.25 + t * 6;
  drawSprite(b, 'trex', tx, fg[Math.round(clamp(tx, 0, W - 1))] + 16, t * 0.9);
  grass(b, fg, 0, W, 0.35, 5, [hex('#5a7a2a'), hex('#4a6a22')], t, 9);
}

// ============ Paleogene: the age of mammals begins ============
export function paleogene(b: PixBuf, t: number, c: Ctx) {
  // Eocene hothouse: a steamy rainforest river, the first horses and primates' world
  const W = b.w, H = b.h, hy = Math.round(H * 0.5);
  skyGradient(b, [[0, hex('#4a7ab0')], [0.55, hex('#9ac0c8')], [1, hex('#e2e8c0')]], 0, hy);
  sunDisc(b, W * 0.7, H * 0.16, 9, hex('#fffbe8'), hex('#fff2c0'), hex('#f0e0a8'), 3);
  cloud(b, W * 0.3 + t * 1.5, H * 0.12, 90, hex('#ffffff'), hex('#e6eef2'), hex('#bccad6'), 21);
  ridge(b, { base: hy - 6, amp: 10, freq: 0.012, seed: 101, fill: hex('#6a9a8a'), edge: hex('#80ae9a'), depth: 30 });
  // dense canopy on the far bank, layered: misty, then saturated
  const far = ridge(b, { base: hy + 2, amp: 7, freq: 0.05, seed: 102, fill: hex('#4e8a62'), edge: hex('#62a070'), depth: 30 });
  for (let i = 0; i < 26; i++) { const x = hash(i * 2.7 + 3) * W; palm(b, x, far[Math.round(clamp(x, 0, W - 1))] + 3, 18 + hash(i) * 14, silStyle('#3e7a52'), i + 900); }
  const near = ridge(b, { base: hy + 14, amp: 6, freq: 0.04, seed: 104, fill: hex('#2e6a3a'), edge: hex('#3e8044'), depth: 30 });
  for (let i = 0; i < 9; i++) { const x = hash(i * 4.3 + 1) * W; broadleaf(b, x, near[Math.round(clamp(x, 0, W - 1))] + 4, 16 + hash(i) * 10, silStyle('#2a5e34'), i + 920); }
  // humid haze over the river
  for (let y = hy + 10; y < hy + 24; y++) for (let x = 0; x < W; x++) { const a2 = (1 - Math.abs(y - hy - 17) / 7) * 0.4 * tn2(x * 0.03 + t * 0.12, y * 0.2); if (a2 > bayer4(x, y)) b.set(x, y, hex('#d8e8d0')); }
  const ry = Math.round(H * 0.62);
  water(b, ry, hex('#3a6a5a'), 0.42, t, { ripple: 1, sparkle: hex('#f0f6e8'), sparkleN: 24, bottom: Math.round(H * 0.74) });
  // lily pads and floating leaves
  for (let i = 0; i < 26; i++) { const x = wrapX(hash(i * 1.7) * W + t * 1.5, W), y = ry + 3 + hash(i * 3.3) * (H * 0.74 - ry - 6); ellipse(b, x, y, 2 + hash(i) * 2, 1, hex('#4e8a3a')); if (i % 5 === 0) b.set(Math.round(x), Math.round(y) - 1, hex('#f0c0d8')); }
  const fg = ridge(b, { base: H * 0.76, amp: 4, freq: 0.012, seed: 103, fill: hex('#4a6a2e'), edge: hex('#628a3a') });
  for (let i = 0; i < 4; i++) broadleaf(b, hash(i * 9.1 + 4) * W, fg[Math.round(clamp(hash(i * 9.1 + 4) * W, 0, W - 1))] + 3, 30 + hash(i) * 12, STY.tropic, i + 950, i % 2 ? hex('#f6e080') : undefined);
  for (let i = 0; i < 3; i++) palm(b, hash(i * 4.7 + 8) * W, H + 2, 60 + hash(i) * 30, STY.tropic, i + 980, Math.sin(t * 0.6) * 2);
  // early horses at the water's edge, a small mammal in the undergrowth, birds
  for (let i = 0; i < 3; i++) { const x = wrapX(W * 0.3 + i * 30 + t * 6, W + 40) - 20; drawSprite(b, 'eohippus', x, fg[Math.round(clamp(x, 0, W - 1))] + 6, t * 1.2 + i); }
  drawSprite(b, 'smallmammal', W * 0.62 + Math.sin(t) * 6, fg[Math.round(W * 0.62)] + 10, t * 2);
  for (let i = 0; i < 5; i++) drawSprite(b, 'bird', wrapX(t * (20 + i * 5) + i * 90, W + 20) - 10, H * (0.15 + i * 0.04), t * 2 + i);
  grass(b, fg, 0, W, 0.5, 5, [hex('#4e7a2e'), hex('#6a9a3a')], t, 11);
}

// ============ Pliocene savanna: walking upright ============
export function savanna(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h, hy = Math.round(H * 0.62);
  skyGradient(b, [[0, hex('#4a5aa0')], [0.4, hex('#c07a6a')], [0.75, hex('#f0a858')], [1, hex('#fcd890')]], 0, hy);
  sunDisc(b, W * 0.62, hy - 8, 13, hex('#fff6d8'), hex('#ffd890'), hex('#f8b060'), 3);
  // snow-capped volcano (Kilimanjaro-like)
  const vx = W * 0.28;
  ridge(b, { base: hy - 4, amp: 4, freq: 0.01, seed: 111, fill: hex('#7a6a8a'), edge: hex('#9a849e'),
    peaks: (x) => { const d = Math.abs(x - vx) / 110; return d < 1 ? 60 * Math.pow(1 - d, 1.4) : 0; },
    shadeFn: (x, y, d) => (Math.abs(x - vx) < 30 && y < hy - 46 && d < 12 ? hex('#f0e6ee') : null) });
  const plain = ridge(b, { base: hy + 2, amp: 2, freq: 0.03, seed: 112, fill: hex('#a07a3a'), edge: hex('#c09448') });
  for (let i = 0; i < 9; i++) { const x = hash(i * 3.9 + 2) * W; acacia(b, x, plain[Math.round(clamp(x, 0, W - 1))] + 1, 10 + hash(i) * 8, silStyle('#4a3a2e'), i + 1000); }
  const fg = ridge(b, { base: H * 0.76, amp: 3, freq: 0.01, seed: 113, fill: hex('#b88a3e'), edge: hex('#d0a450'),
    shadeFn: (x, y, d) => (tn2(x * 0.3, y * 0.3) > 0.7 ? hex('#a0783a') : null) });
  acacia(b, W * 0.82, fg[Math.round(W * 0.82)] + 2, 40, STY.savanna, 1100);
  grass(b, fg, 0, W, 0.75, 9, [hex('#c8a050'), hex('#d8b460'), hex('#a8843a')], t, 13);
  // a small group walking on two legs (drawn over the grass so their stride shows)
  for (let i = 0; i < 3; i++) {
    const x = W * 0.36 + i * 13 + t * 5;
    drawSprite(b, 'hominin', x, fg[Math.round(clamp(x, 0, W - 1))] + 2 - (i === 1 ? 0 : 1), t * 1.4 + i * 0.6, { tint: hex('#3a2a20'), tintK: 0.3 });
  }
  for (let i = 0; i < 4; i++) drawSprite(b, 'bird', wrapX(t * 14 + i * 60, W + 20) - 10, H * (0.2 + i * 0.03), t * 2 + i, { sil: hex('#3a2a30') });
}


// ============ Pangaea's interior: an Early Permian desert oasis ============
export function pangaeaDesert(b: PixBuf, t: number, c: Ctx) {
  const W = b.w, H = b.h, hy = Math.round(H * 0.56);
  skyGradient(b, [[0, hex('#5a8ac4')], [0.6, hex('#a8c4d8')], [1, hex('#f2dcb0')]], 0, hy);
  sunDisc(b, W * 0.24, H * 0.14, 10, hex('#fffbe8'), hex('#fff0c0'), hex('#f8dca0'), 3);
  // red sandstone mesas on the horizon
  ridge(b, { base: hy - 2, amp: 4, freq: 0.02, seed: 181, fill: hex('#b8664a'), edge: hex('#d8845a'),
    peaks: (x) => { let p = 0; for (const [cx, w, h] of [[0.2, 50, 26], [0.58, 70, 34], [0.9, 40, 20]] as const) { const d = Math.abs(x - cx * W); if (d < w) p = Math.max(p, d < w * 0.75 ? h : h * (1 - (d - w * 0.75) / (w * 0.25))); } return p; },
    shadeFn: (x, y, d) => (d % 6 === 0 && d > 0 ? hex('#a05a40') : x % 9 < 2 && d > 3 ? hex('#a8603e') : null) });
  // heat shimmer band
  for (let y = hy - 2; y < hy + 6; y++) for (let x = 0; x < W; x++) if (tn2(x * 0.08 + t * 2, y * 0.6) > 0.72) b.set(x, y, hex('#f0d8b0'));
  // dunes
  const dunes = ridge(b, { base: hy + 18, amp: 10, freq: 0.012, seed: 182, fill: hex('#d8935a'), edge: hex('#f0b070'),
    shadeFn: (x, y, d) => (tn2(x * 0.05, y * 0.05) > 0.62 ? hex('#c07a48') : (d < 3 ? hex('#e8a868') : null)) });
  // oasis with seed ferns and early conifers (Walchia)
  const ox = W * 0.68;
  for (let y = 0; y < 8; y++) b.hline(Math.round(ox - 40 + y * 2), Math.round(ox + 40 - y * 2), dunes[Math.round(ox)] + 2 + y, y < 2 ? hex('#6aa0b8') : hex('#4a8098'));
  for (let i = 0; i < 6; i++) conifer(b, ox - 50 + i * 20 + hash(i) * 6, dunes[Math.round(clamp(ox - 50 + i * 20, 0, W - 1))] + 3, 22 + hash(i * 3) * 14, STY.devonian, i + 1400);
  for (let i = 0; i < 5; i++) treefern(b, ox - 40 + i * 18, dunes[Math.round(clamp(ox - 40 + i * 18, 0, W - 1))] + 6, 14 + hash(i) * 6, STY.devonian, i + 1450, Math.sin(t * 0.7) * 1);
  // dimetrodons: one walking, one basking with its sail to the sun
  const fg = ridge(b, { base: H * 0.76, amp: 5, freq: 0.01, seed: 183, fill: hex('#c8844e'), edge: hex('#e09a5a'),
    shadeFn: (x, y) => (tn2(x * 0.2, y * 0.3) > 0.7 ? hex('#b87444') : null) });
  const dx = W * 0.3 + t * 5;
  drawSprite(b, 'dimetrodon', dx, fg[Math.round(clamp(dx, 0, W - 1))] + 4, t);
  drawSprite(b, 'dimetrodon', W * 0.84, fg[Math.round(W * 0.84)] + 5, 0, { frame: 0, flip: true });
  // wind-blown sand
  for (let i = 0; i < 90; i++) { const y = hy + 10 + hash(i * 1.7) * (H - hy - 10); const x = wrapX(hash(i * 2.9) * W + t * (50 + 30 * hash(i)), W); b.set(Math.round(x), Math.round(y), hex('#f0c890')); }
}
