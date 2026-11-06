// Deterministic hashing / pseudo-random helpers — no Math.random anywhere in the film.

/** hash of a number → [0, 1) */
export function hash(x: number): number {
  let n = Math.floor(x * 1000) | 0;
  n = (n ^ 61) ^ (n >>> 16);
  n = Math.imul(n, 9);
  n ^= n >>> 4;
  n = Math.imul(n, 0x27d4eb2d);
  n ^= n >>> 15;
  n = Math.imul(n ^ (n >>> 13), 0x5bd1e995);
  n ^= n >>> 15;
  return (n >>> 0) / 4294967296;
}

/** seeded PRNG (mulberry32) for building fixed procedural content */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x: number, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smooth = (x: number) => { const c = clamp(x); return c * c * (3 - 2 * c); };
export const smoother = (x: number) => { const c = clamp(x); return c * c * c * (c * (c * 6 - 15) + 10); };
/** 0→1 between a and b */
export const ramp = (x: number, a: number, b: number) => clamp((x - a) / (b - a));
export const sramp = (x: number, a: number, b: number) => smooth((x - a) / (b - a));
/** 0 → 1 → 0 window with soft edges */
export const win = (x: number, a: number, b: number, fade = 0.05) => sramp(x, a, a + fade) * (1 - sramp(x, b - fade, b));
