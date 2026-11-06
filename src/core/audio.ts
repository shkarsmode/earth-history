// Optional procedural soundtrack (off by default, M toggles): a slow ambient pad whose chord follows
// the eon, a filtered-noise bed (lava rumble, wind, rain, city) and booms for the big impacts.
// Everything is driven by film time, so the same moment always sounds the same.
import type { Director } from './director';
import { hash } from './hash';

const CHORDS: Record<string, number[]> = {
  hadean: [73.42, 110.0, 155.56],
  archean: [73.42, 110.0, 174.61],
  proterozoic: [55.0, 82.41, 123.47, 246.94],
  paleozoic: [73.42, 110.0, 164.81, 185.0],
  mesozoic: [49.0, 73.42, 123.47, 220.0],
  cenozoic: [65.41, 98.0, 164.81, 246.94],
  history: [87.31, 130.81, 220.0, 329.63],
  forecast: [58.27, 87.31, 146.83, 329.63],
};

// noise bed per diorama / chapter: [lowpass Hz, gain]
const BED: Record<string, [number, number]> = {
  magma: [180, 0.5], theia: [120, 0.25], moon: [140, 0.2], vent: [220, 0.35], stromatolites: [900, 0.12], snowball: [1800, 0.22],
  ediacara: [500, 0.15], cambrian: [500, 0.15], devonian: [1000, 0.12], carbon: [1400, 0.12], permian: [260, 0.45], jurassic: [1200, 0.1],
  cretaceous: [1000, 0.1], paleogene: [1600, 0.12], savanna: [1300, 0.1], iceage: [2200, 0.18], farm: [1500, 0.08], ziggurat: [1500, 0.08],
  industry: [400, 0.3], launch: [160, 0.6], city2026: [700, 0.15], future: [1600, 0.08],
};

export class Soundtrack {
  enabled = false;
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private pad: { osc: OscillatorNode[]; gain: GainNode }[] = [];
  private noiseFilter!: BiquadFilterNode;
  private noiseGain!: GainNode;
  private lastT = -1;

  private init() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // a little space: feedback delay
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    const wet = ctx.createGain();
    wet.gain.value = 0.3;
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(ctx.destination);
    this.master.connect(ctx.destination);
    this.master.connect(delay);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.connect(this.master);
    for (let v = 0; v < 4; v++) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(lp);
      const osc = [0, 1].map((k) => {
        const o = ctx.createOscillator();
        o.type = k ? 'triangle' : 'sine';
        o.frequency.value = 110;
        o.detune.value = k ? 7 : -5;
        o.connect(gain);
        o.start();
        return o;
      });
      this.pad.push({ osc, gain });
    }
    // noise bed
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = hash(i * 0.0137 + 0.5) * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this.noiseFilter = ctx.createBiquadFilter();
    this.noiseFilter.type = 'lowpass';
    this.noiseFilter.frequency.value = 400;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0;
    src.connect(this.noiseFilter).connect(this.noiseGain).connect(this.master);
    src.start();
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled && !this.ctx) this.init();
    if (this.ctx) {
      if (this.enabled) this.ctx.resume();
      this.master.gain.setTargetAtTime(this.enabled ? 0.5 : 0, this.ctx.currentTime, 0.3);
    }
  }

  private boom(strength: number) {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, now);
    o.frequency.exponentialRampToValueAtTime(24, now + 2.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.9 * strength, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 3.5 * strength + 0.4);
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + 4.5);
    // crackle burst through the noise bed
    this.noiseGain.gain.cancelScheduledValues(now);
    this.noiseGain.gain.setValueAtTime(0.9 * strength, now);
    this.noiseFilter.frequency.setValueAtTime(2400, now);
    this.noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 2);
  }

  update(d: Director, dioId: string | null, dioMix: number) {
    if (!this.ctx || !this.enabled) { this.lastT = d.t; return; }
    const ctx = this.ctx, now = ctx.currentTime;
    const w = d.locate();
    const chord = CHORDS[w.ch.eon] ?? CHORDS.history;
    this.pad.forEach((v, i) => {
      const f = chord[i];
      v.gain.gain.setTargetAtTime(f ? 0.06 / (1 + i * 0.4) : 0, now, 1.2);
      if (f) v.osc.forEach((o) => o.frequency.setTargetAtTime(f, now, 1.5));
    });
    const key = dioMix > 0.5 && dioId ? dioId : w.ch.id;
    const bed = BED[key] ?? [600, 0.06];
    this.noiseFilter.frequency.setTargetAtTime(bed[0], now, 0.8);
    this.noiseGain.gain.setTargetAtTime(bed[1] * 0.35, now, 0.8);
    // scripted booms when the film crosses an impact moment (only while playing forward)
    const crossed = (ci: number, tl: number) => {
      const t0 = d.starts[ci] + tl;
      return this.lastT < t0 && d.t >= t0 && d.t - this.lastT < 1;
    };
    const ci = (id: string) => d.chapters.findIndex((c) => c.id === id);
    if (crossed(ci('theia'), 14)) this.boom(1);
    if (crossed(ci('chicxulub'), 9.5)) this.boom(1);
    this.lastT = d.t;
  }
}
