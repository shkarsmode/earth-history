// Pixel HUD drawn into the overlay buffer: date, chapter, title cards, subtitles, timeline, controls.
import { PixBuf, hex, type RGBA, bayer4, withAlpha } from '../gfx/pixbuf';
import type { PixelFont } from '../gfx/font';
import { Director, SPEEDS } from '../core/director';
import { EONS } from '../story/chapters';
import { yearLabel } from '../story/format';
import { liveStats } from '../story/stats';
import { clamp } from '../core/hash';

const C = {
  white: hex('#f4f1e8'),
  shadow: hex('#07060e'),
  dim: hex('#8a90a8'),
  dimmer: hex('#4a4e66'),
  title: hex('#ffd36a'),
  forecast: hex('#d08aff'),
  panel: hex('#0b0a16'),
  panelEdge: hex('#2a2a44'),
  bar: hex('#14132a'),
  playhead: hex('#ffffff'),
};

export type HudHit = { kind: 'play' } | { kind: 'slower' } | { kind: 'faster' } | { kind: 'seek'; t: number } | { kind: 'scene' } | null;

export class Hud {
  mouseX = -1;
  mouseY = -1;
  lastMove = -100;
  dragging = false;
  hideUi = false;
  barAlpha = 1;

  constructor(readonly font: PixelFont) {}

  private barY(h: number) { return h - 14; }

  private tlRect(w: number) {
    const x0 = 62, x1 = w - 10;
    return { x0, x1 };
  }

  /** map an x on the timeline to film time (segments ∝ chapter durations) */
  timeAt(d: Director, w: number, x: number): number {
    const { x0, x1 } = this.tlRect(w);
    const f = clamp((x - x0) / (x1 - x0));
    return f * d.total;
  }

  hit(d: Director, w: number, h: number, x: number, y: number): HudHit {
    const by = this.barY(h);
    if (this.barAlpha > 0.2 && y >= by - 3 && y <= h) {
      if (x >= 4 && x < 16) return { kind: 'play' };
      if (x >= 18 && x < 26) return { kind: 'slower' };
      if (x >= 50 && x < 58) return { kind: 'faster' };
      const { x0, x1 } = this.tlRect(w);
      if (x >= x0 - 2 && x <= x1 + 2) return { kind: 'seek', t: this.timeAt(d, w, x) };
    }
    return { kind: 'scene' };
  }

  draw(buf: PixBuf, d: Director, realNow: number) {
    buf.clear(0);
    const W = buf.w, H = buf.h;
    const f = this.font;
    const where = d.locate();
    const ch = where.ch;
    const year = d.year();
    const eon = EONS[ch.eon];
    const eonCol = hex(eon.color);

    // auto-hide the control bar while playing
    const idle = realNow - this.lastMove;
    const wantBar = !this.hideUi && (!d.playing || idle < 2.5 || this.dragging || this.mouseY > H - 24);
    this.barAlpha += ((wantBar ? 1 : 0) - this.barAlpha) * 0.2;

    if (this.hideUi) return;

    // ---- top-left: date, chapter, eon ----
    const dateText = ch.y0 === ch.y1 && (ch.id === 'theia' || ch.id === 'moon') ? 'около 4,5 млрд лет назад' : yearLabel(year);
    const dateCol = ch.forecast ? C.forecast : C.white;
    f.drawOutlined(buf, dateText.toUpperCase(), 8, 15, dateCol, C.shadow);
    f.drawOutlined(buf, ch.title.toUpperCase(), 8, 27, C.title, C.shadow);
    f.drawOutlined(buf, (ch.forecast ? 'ПРОГНОЗ · СЦЕНАРИЙ' : eon.name.toUpperCase()), 8, 39, ch.forecast ? C.forecast : eonCol, C.shadow);
    {
      let y = 53;
      for (const s of [...(ch.stats ?? []), ...liveStats(year)]) { f.drawOutlined(buf, s, 8, y, ch.forecast ? C.forecast : C.dim, C.shadow); y += 11; }
    }
    if (ch.clock) {
      const c = ch.clock(where.u);
      if (c) f.drawOutlined(buf, c, 8, ch.stats ? 53 + ch.stats.length * 11 : 53, C.dim, C.shadow);
    }

    // ---- top-right: forecast badge, speed/pause ----
    let rx = W - 8;
    if (ch.forecast && Math.floor(realNow * 1.5) % 2 === 0) {
      const t = 'ПРОГНОЗ';
      const tw = f.measure(t);
      buf.frame(rx - tw - 6, 5, tw + 8, 13, hex('#2a1238'), C.forecast);
      f.draw(buf, t, rx - tw - 2, 15, C.forecast);
      rx -= tw + 14;
    }
    if (!d.playing || d.speed !== 1) {
      const t = !d.playing ? 'ПАУЗА' : `×${fmtSpeed(d.speed)}`;
      const tw = f.measure(t);
      f.drawOutlined(buf, t, rx - tw, 15, C.white, C.shadow);
    }

    // ---- title card at chapter start ----
    const tl = where.tl;
    if (tl < 4.2) {
      const a = tl < 0.4 ? tl / 0.4 : tl > 3.2 ? 1 - (tl - 3.2) / 1.0 : 1;
      this.titleCard(buf, ch.title.toUpperCase(), (ch.forecast ? 'ПРОГНОЗ · СЦЕНАРИЙ' : eon.name.toUpperCase()), dateText, eonCol, ch.forecast ? C.forecast : C.title, a);
    }

    // ---- subtitles ----
    const sub = d.subtitle();
    const barH = this.barAlpha > 0.05 ? 18 : 4;
    if (sub) {
      const maxW = Math.min(W - 24, 456);
      const lines = f.wrap(sub.text, maxW);
      const shown = Math.floor(sub.age * 45);
      let left = shown;
      const lh = 11;
      let y = H - barH - 8 - (lines.length - 1) * lh;
      const fade = sub.left < 0.35 ? sub.left / 0.35 : 1;
      if (fade > 0.05) {
        // soft translucent band behind the subtitle so it reads on snow, flashes and lava alike
        let wMax = 0;
        for (const line of lines) wMax = Math.max(wMax, f.measure(line));
        const bx = Math.round((W - wMax) / 2) - 6, by0 = y - 10, bh = lines.length * lh + 5;
        for (let yy = by0; yy < by0 + bh; yy++) for (let xx = bx; xx < bx + wMax + 12; xx++) {
          const edge = Math.min(xx - bx, bx + wMax + 11 - xx, yy - by0, by0 + bh - 1 - yy);
          buf.blend(xx, yy, C.shadow, edge < 2 ? 0.22 * fade : 0.42 * fade);
        }
        for (const line of lines) {
          const part = left >= line.length ? line : line.slice(0, Math.max(0, left));
          left -= line.length + 1;
          const lw = f.measure(line);
          const x = Math.round((W - lw) / 2);
          if (part.length) f.drawOutlined(buf, part, x, y, fade > 0.5 ? C.white : C.dim, C.shadow);
          y += lh;
        }
      }
    }

    // ---- control bar ----
    if (this.barAlpha > 0.05) this.drawBar(buf, d, realNow);
  }

  private titleCard(buf: PixBuf, title: string, eon: string, date: string, eonCol: RGBA, titleCol: RGBA, a: number) {
    const f = this.font;
    const W = buf.w, H = buf.h;
    const cy = Math.round(H * 0.42);
    const tw = f.measure(title) + title.length * 2;
    // dithered fade-in/out of the whole card
    const tmp = new PixBuf(W, 40);
    const x = Math.round((W - tw) / 2);
    const drawSpaced = (b: PixBuf, s: string, x0: number, y0: number, c: RGBA) => {
      let px = x0;
      for (const chh of s) {
        f.drawOutlined(b, chh, px, y0, c, C.shadow);
        px += (f.glyph(chh)?.adv ?? 8) + 2;
      }
    };
    const ew = f.measure(eon);
    f.drawOutlined(tmp, eon, Math.round((W - ew) / 2), 9, eonCol, C.shadow);
    drawSpaced(tmp, title, x, 23, titleCol);
    const lineY = 28;
    const lw = Math.min(W - 40, tw + 40);
    for (let i = 0; i < lw; i++) if (i % 2 === 0) tmp.set(Math.round((W - lw) / 2) + i, lineY, withAlpha(titleCol, 255));
    const dw = f.measure(date.toUpperCase());
    f.drawOutlined(tmp, date.toUpperCase(), Math.round((W - dw) / 2), 39, C.white, C.shadow);
    for (let yy = 0; yy < tmp.h; yy++) for (let xx = 0; xx < W; xx++) {
      const c = tmp.u32[yy * W + xx];
      if (c >>> 24 && bayer4(xx, yy) < a) buf.set(xx, cy - 22 + yy, c);
    }
  }

  private drawBar(buf: PixBuf, d: Director, realNow: number) {
    const f = this.font;
    const W = buf.w, H = buf.h;
    const by = this.barY(H);
    const a = this.barAlpha;
    // backdrop
    for (let y = by - 4; y < H; y++) for (let x = 0; x < W; x++) if (bayer4(x, y) < a * 0.85) buf.set(x, y, C.bar);
    const icon = C.white;
    // play / pause
    if (d.playing) { buf.rect(6, by, 2, 7, icon); buf.rect(10, by, 2, 7, icon); }
    else for (let i = 0; i < 4; i++) buf.rect(7 + i, by + i, 1, 7 - 2 * i, icon);
    // speed: [-] ×N [+]
    buf.rect(19, by + 3, 5, 1, icon);
    const st = `×${fmtSpeed(d.speed)}`;
    const sw = f.measure(st.replace('×', 'x'));
    f.draw(buf, st, 38 - Math.round(sw / 2), by + 7, C.white);
    buf.rect(51, by + 3, 5, 1, icon);
    buf.rect(53, by + 1, 1, 5, icon);
    // timeline segments
    const { x0, x1 } = this.tlRect(W);
    const span = x1 - x0;
    const where = d.locate();
    const hoverT = this.mouseY >= by - 4 && this.mouseX >= x0 && this.mouseX <= x1 ? this.timeAt(d, W, this.mouseX) : -1;
    const hoverCi = hoverT >= 0 ? d.locate(hoverT).ci : -1;
    for (let i = 0; i < d.chapters.length; i++) {
      const ch = d.chapters[i];
      const sx = x0 + Math.round((d.starts[i] / d.total) * span);
      const ex = x0 + Math.round(((d.starts[i] + ch.dur) / d.total) * span) - 1;
      const c = hex(EONS[ch.eon].color);
      const on = i === where.ci || i === hoverCi;
      const dimC = mixDark(c, on ? 0 : 0.55);
      buf.rect(sx, by + 2, Math.max(1, ex - sx), 3, dimC);
      if (on) buf.rect(sx, by + 1, Math.max(1, ex - sx), 5, dimC);
    }
    // eon labels under hover, playhead
    const px = x0 + Math.round((d.t / d.total) * span);
    buf.rect(px, by - 1, 1, 9, C.playhead);
    buf.rect(px - 1, by - 2, 3, 1, C.playhead);
    if (hoverCi >= 0) {
      const ch = d.chapters[hoverCi];
      const label = `${ch.title} · ${d.chapters[hoverCi].y0 === d.chapters[hoverCi].y1 ? 'около 4,5 млрд лет назад' : yearLabel(d.yearOf(ch, 0))}`;
      const lw = f.measure(label);
      let lx = clamp(this.mouseX - Math.round(lw / 2), 4, W - lw - 4);
      buf.frame(lx - 4, by - 18, lw + 8, 14, C.panel, C.panelEdge);
      f.draw(buf, label, lx, by - 8, hex(EONS[ch.eon].color));
    }
  }
}

function mixDark(c: RGBA, k: number): RGBA {
  const r = c & 255, g = (c >>> 8) & 255, b = (c >>> 16) & 255;
  const m = 1 - k;
  return ((255 << 24) | ((b * m + 14 * k) << 16) | ((g * m + 13 * k) << 8) | (r * m + 24 * k)) >>> 0;
}

export function fmtSpeed(s: number): string {
  if (s >= 1) return String(s);
  return String(s).replace('0.', '0,');
}

export { SPEEDS };
