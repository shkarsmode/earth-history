// Film clock: film time ↔ chapter ↔ calendar year, playback speed, camera keyframes, subtitles.
import { CHAPTERS, type Chapter, type CamKey } from '../story/chapters';
import { DEFAULT_SHOT, type Shot } from '../planet/planetScene';
import { clamp, smooth } from './hash';

export const SPEEDS = [0.05, 0.1, 0.25, 0.5, 1, 2, 4, 8, 16, 32];
const SHOT_KEYS: (keyof Shot)[] = ['rh', 'lat', 'lon', 'phase', 'tilt', 'roll', 'ox', 'oy', 'fov', 'moonAz', 'moonEl', 'moonVis'];
const BLEND = 3.0; // seconds of camera blend at each chapter start

export interface Where {
  ci: number;
  ch: Chapter;
  u: number; // local progress 0..1
  tl: number; // seconds into the chapter
}

export class Director {
  readonly chapters = CHAPTERS;
  readonly starts: number[] = [];
  readonly total: number;
  t = 0; // film time (s)
  amb = 0; // ambient time (s): clouds, lava, twinkle — keeps running while paused
  speedIdx = 4;
  playing = true;

  constructor() {
    let acc = 0;
    for (const c of this.chapters) {
      this.starts.push(acc);
      acc += c.dur;
    }
    this.total = acc;
  }

  get speed() { return SPEEDS[this.speedIdx]; }

  tick(dt: number) {
    dt = Math.min(dt, 0.25);
    this.amb += dt;
    if (this.playing) {
      this.t += dt * this.speed;
      if (this.t >= this.total) { this.t = this.total; this.playing = false; }
    }
  }

  seek(t: number) { this.t = clamp(t, 0, this.total); }

  locate(t = this.t): Where {
    t = clamp(t, 0, this.total);
    let ci = this.chapters.length - 1;
    for (let i = 0; i < this.starts.length; i++) {
      if (t < this.starts[i] + this.chapters[i].dur) { ci = i; break; }
    }
    const ch = this.chapters[ci];
    const tl = t - this.starts[ci];
    return { ci, ch, u: clamp(tl / ch.dur), tl };
  }

  yearOf(ch: Chapter, u: number): number {
    if (ch.y0 === ch.y1) return ch.y0;
    if (ch.ykeys) {
      const k = ch.ykeys;
      for (let i = 0; i < k.length - 1; i++) if (u <= k[i + 1][0]) return k[i][1] + ((k[i + 1][1] - k[i][1]) * (u - k[i][0])) / (k[i + 1][0] - k[i][0]);
      return k[k.length - 1][1];
    }
    if (ch.map === 'log') {
      const a0 = 2026 - ch.y0, a1 = 2026 - ch.y1;
      if (a0 > 0 && a1 > 0) return 2026 - Math.exp(Math.log(a0) + (Math.log(a1) - Math.log(a0)) * u);
    }
    return ch.y0 + (ch.y1 - ch.y0) * u;
  }

  year(t = this.t): number {
    const w = this.locate(t);
    return this.yearOf(w.ch, w.u);
  }

  chapterShot(ch: Chapter, u: number): Shot {
    const keys = ch.cam;
    const full: Shot[] = [];
    let prev: Shot = { ...DEFAULT_SHOT };
    for (const k of keys) {
      const s = { ...prev };
      for (const f of SHOT_KEYS) if (k[f] !== undefined) (s as any)[f] = k[f];
      full.push(s);
      prev = s;
    }
    if (u <= keys[0].u) return { ...full[0] };
    for (let i = 0; i < keys.length - 1; i++) {
      if (u <= keys[i + 1].u) {
        const x = smooth((u - keys[i].u) / Math.max(1e-6, keys[i + 1].u - keys[i].u));
        return mixShot(full[i], full[i + 1], x);
      }
    }
    return { ...full[full.length - 1] };
  }

  shot(t = this.t): Shot {
    const w = this.locate(t);
    const cur = this.chapterShot(w.ch, w.u);
    if (w.ci > 0 && w.tl < BLEND) {
      const pc = this.chapters[w.ci - 1];
      const prev = this.chapterShot(pc, 1);
      const x = smooth(w.tl / BLEND);
      return mixShot(prev, cur, x, true);
    }
    return cur;
  }

  subtitle(t = this.t): { text: string; age: number; left: number } | null {
    const w = this.locate(t);
    const subs = w.ch.subs;
    let cur = -1;
    for (let i = 0; i < subs.length; i++) if (w.u >= subs[i][0]) cur = i;
    if (cur < 0) return null;
    const startT = subs[cur][0] * w.ch.dur;
    const endT = cur + 1 < subs.length ? subs[cur + 1][0] * w.ch.dur : w.ch.dur;
    return { text: subs[cur][1], age: w.tl - startT, left: endT - w.tl };
  }

  nextChapter(dir: number) {
    const w = this.locate();
    let ci = w.ci + dir;
    if (dir < 0 && w.tl > 2) ci = w.ci;
    ci = clamp(ci, 0, this.chapters.length - 1);
    this.t = this.starts[ci] + 0.001;
  }
}

export function mixShot(a: Shot, b: Shot, x: number, wrapLon = false): Shot {
  const o = { ...a };
  for (const f of SHOT_KEYS) {
    let av = a[f], bv = b[f];
    if (f === 'lon' && wrapLon) {
      let d = ((bv - av) % 360 + 540) % 360 - 180;
      bv = av + d;
    }
    (o as any)[f] = av + (bv - av) * x;
  }
  return o;
}

export type { CamKey };
