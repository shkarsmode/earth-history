// Keyframe tracks over calendar years. Every look of the planet is a pure function of the year,
// so any moment of the film can be rendered directly (scrubbing, debug snapshots, determinism).

export type Key<T> = [number, T];

const smooth = (x: number) => x * x * (3 - 2 * x);

function locate(keys: Key<unknown>[], y: number): [number, number] {
  if (y <= keys[0][0]) return [0, 0];
  const last = keys.length - 1;
  if (y >= keys[last][0]) return [last, 0];
  let lo = 0, hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (keys[mid][0] <= y) lo = mid; else hi = mid;
  }
  const t = (y - keys[lo][0]) / (keys[hi][0] - keys[lo][0]);
  return [lo, smooth(t)];
}

export function num(keys: Key<number>[]): (y: number) => number {
  return (y) => {
    const [i, t] = locate(keys, y);
    if (t === 0) return keys[i][1];
    return keys[i][1] + (keys[i + 1][1] - keys[i][1]) * t;
  };
}

export type RGB = [number, number, number];
export const hx = (h: string): RGB => {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

export function col(keys: Key<string>[]): (y: number) => RGB {
  const ks = keys.map(([y, c]) => [y, hx(c)] as Key<RGB>);
  return (y) => {
    const [i, t] = locate(ks, y);
    const a = ks[i][1];
    if (t === 0) return [a[0], a[1], a[2]];
    const b = ks[i + 1][1];
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  };
}

export const Ga = (v: number) => -v * 1e9 + 2026;
export const Ma = (v: number) => -v * 1e6 + 2026;
export const ka = (v: number) => -v * 1e3 + 2026;
