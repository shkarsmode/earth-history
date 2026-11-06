// What the planet looks like in a given year. Chapter scripts may override fields for events.
import { col, num, Ga, Ma, ka, type RGB } from './tracks';

export interface PlanetState {
  lava: number; crust: number; ocean: number; seaLevel: number;
  veg: number; arid: number; iceLat: number; iceAge: number; redBeds: number; modern: number; grassland: number;
  city: number; cityGrow: [number, number, number, number]; fires: number; solar: number;
  oceanDeep: RGB; oceanShallow: RGB; rock: RGB; vegColor: RGB;
  haze: number; hazeColor: RGB; atmo: number; atmoColor: RGB; twilight: RGB;
  cloudCover: number; cloudScale: number; cloudColor: RGB; cloudShade: RGB; storm: number;
  plateW: number; detach: number;
  proc: [number, number, number, number]; procCenter: [number, number, number]; procOffset: [number, number, number];
  scorch: number;
  moonDist: number; moonMaria: number; moonLava: number; moonCraters: number;
  sunScale: number;
  meteors: number;
  satellites: number; // count of satellites drawn (scaled)
}

// ---- tracks (years are calendar years; Ga/Ma/ka convert "ago" to calendar) ----
const T = {
  lava: num([[Ga(4.52), 1], [Ga(4.47), 1], [Ga(4.43), 0.75], [Ga(4.40), 0.06], [Ga(4.25), 0.0]]),
  crust: num([[Ga(4.50), 0], [Ga(4.46), 0.55], [Ga(4.41), 1]]),
  ocean: num([[Ga(4.405), 0], [Ga(4.385), 1]]),
  seaLevel: num([
    [Ma(541), 0.05], [Ma(460), 0.07], [Ma(360), 0.04], [Ma(300), 0.02], [Ma(250), -0.005], [Ma(200), 0.015], [Ma(150), 0.04],
    [Ma(95), 0.075], [Ma(66), 0.045], [Ma(35), 0.025], [Ma(10), 0.01], [Ma(3), 0.0], [2026, 0], [2100, 0.0006], [2500, 0.002], [5000, 0.006],
  ]),
  veg: num([
    [Ma(475), 0], [Ma(430), 0.12], [Ma(400), 0.3], [Ma(380), 0.6], [Ma(330), 0.85], [Ma(290), 0.7], [Ma(262), 0.45], [Ma(252.2), 0.42],
    [Ma(251.8), 0.18], [Ma(245), 0.3], [Ma(201), 0.55], [Ma(150), 0.72], [Ma(100), 0.82], [Ma(56), 0.95], [Ma(20), 0.8], [2026, 0.8],
  ]),
  arid: num([[Ga(3.0), 0.3], [Ma(320), 0.25], [Ma(270), 0.65], [Ma(230), 0.6], [Ma(180), 0.35], [Ma(100), 0.25], [Ma(20), 0.35], [2026, 0.35]]),
  iceLat: num([
    [Ga(2.47), 90], [Ga(2.42), 30], [Ga(2.30), 32], [Ga(2.22), 90],
    [Ma(722), 90], [Ma(715), 0], [Ma(662), 0], [Ma(658), 90], [Ma(652), 90], [Ma(646), 0], [Ma(637), 0], [Ma(627), 90],
    [Ma(447), 90], [Ma(444), 62], [Ma(441), 90],
    [Ma(340), 90], [Ma(325), 58], [Ma(275), 60], [Ma(262), 90],
    [Ma(36), 90], [Ma(33), 74], [Ma(14), 70], [Ma(3.2), 68], [Ma(2.6), 66], [2026, 66], [2100, 74], [2500, 76], [5000, 74],
  ]),
  redBeds: num([[Ga(2.45), 0], [Ga(2.25), 1], [Ma(500), 0.7], [Ma(270), 0.9], [Ma(150), 0.5], [2026, 0.4]]),
  modern: num([[Ma(8), 0], [Ma(2.5), 0.35], [Ma(0.5), 0.75], [ka(12), 1], [2026, 1]]),
  grassland: num([[Ma(25), 0], [Ma(8), 0.7], [2026, 0.8]]),
  fires: num([[ka(60), 0], [ka(12), 0.15], [-3000, 0.45], [1000, 0.7], [1800, 1], [1900, 0.5], [1960, 0]]),
  city: num([[1875, 0], [1895, 1]]),
  cg0: num([[1880, 0.03], [1900, 0.12], [1920, 0.28], [1950, 0.55], [1970, 0.85], [2000, 1]]),
  cg1: num([[1900, 0.0], [1930, 0.08], [1960, 0.3], [1985, 0.55], [2000, 0.75], [2015, 1]]),
  cg2: num([[1920, 0.0], [1950, 0.08], [1980, 0.32], [2000, 0.6], [2020, 0.9], [2050, 1]]),
  cg3: num([[1950, 0.0], [1980, 0.08], [2000, 0.18], [2026, 0.33], [2060, 0.7], [2100, 1]]),
  solar: num([[2026, 0], [2060, 0.35], [2100, 0.65], [2500, 1]]),
  oceanDeep: col([[Ga(4.4), '#173f3a'], [Ga(2.5), '#1a4a4e'], [Ga(1.8), '#1a4470'], [Ma(600), '#1b3f86'], [2026, '#1c3f8c']]),
  oceanShallow: col([[Ga(4.4), '#4f9a78'], [Ga(2.5), '#3f9a8a'], [Ga(1.8), '#3a8aa8'], [Ma(600), '#3a86cc'], [2026, '#46a0dc']]),
  rock: col([[Ga(4.4), '#3d3537'], [Ga(3.0), '#5b5650'], [Ga(2.3), '#8a5a46'], [Ma(500), '#86664e'], [Ma(250), '#9a6a4a'], [2026, '#8a7458']]),
  vegColor: col([[Ma(470), '#3e5a2c'], [Ma(380), '#2f5a2c'], [Ma(300), '#285a2e'], [Ma(150), '#356a30'], [Ma(50), '#2f7a34'], [2026, '#3a7a36']]),
  haze: num([
    [Ga(4.5), 0], [Ga(4.47), 0.55], [Ga(4.40), 0.4], [Ga(4.3), 0.12], [Ga(3.2), 0.12], [Ga(2.8), 0.32], [Ga(2.47), 0.3], [Ga(2.38), 0.02],
    [Ma(252.4), 0.0], [Ma(252.1), 0.35], [Ma(251.6), 0.2], [Ma(250.5), 0.0],
  ]),
  hazeColor: col([[Ga(4.45), '#9c8a78'], [Ga(4.2), '#a08a6a'], [Ga(3.2), '#c8823e'], [Ga(2.4), '#c8823e'], [Ga(2.3), '#9aa7b8'], [Ma(253), '#9a6a3a'], [Ma(251), '#9a6a3a']]),
  atmo: num([[Ga(4.5), 1.6], [Ga(4.3), 1.3], [Ga(2.4), 1.15], [Ma(600), 1.0], [2026, 1.0]]),
  atmoColor: col([[Ga(4.5), '#c87a4a'], [Ga(4.3), '#a89a8a'], [Ga(3.3), '#d29050'], [Ga(2.45), '#d29050'], [Ga(2.25), '#6a98e8'], [2026, '#5f9bff']]),
  twilight: col([[Ga(4.5), '#ff7a3a'], [2026, '#ff8a4a']]),
  cloudCover: num([
    [Ga(4.47), 0.0], [Ga(4.44), 0.85], [Ga(4.40), 1.0], [Ga(4.30), 0.6], [Ga(4.0), 0.5], [Ga(3.5), 0.5], [Ga(2.4), 0.48],
    [Ma(720), 0.42], [Ma(630), 0.58], [Ma(330), 0.62], [Ma(270), 0.45], [Ma(150), 0.58], [2026, 0.56],
  ]),
  cloudColor: col([[Ga(4.45), '#d6cfc6'], [Ga(4.3), '#e8eef4'], [2026, '#f4f8ff']]),
  cloudShade: col([[Ga(4.45), '#5a5450'], [Ga(4.3), '#6a7486'], [2026, '#6c7a92']]),
  storm: num([[Ga(4.45), 0], [Ga(4.40), 1], [Ga(4.2), 0.4], [Ga(3.8), 0.15], [2026, 0.08]]),
  plateW: num([[Ma(668), 0], [Ma(650), 1]]),
  detach: num([[Ma(25), 1], [Ma(2), 0]]),
  procScale: num([[Ga(4.4), 3.6], [Ga(3.0), 3.0], [Ga(2.2), 1.9], [Ga(1.2), 1.6], [Ma(700), 1.6]]),
  procThresh: num([[Ga(4.4), 0.62], [Ga(3.6), 0.5], [Ga(2.8), 0.36], [Ga(2.2), 0.28], [Ga(1.9), 0.22], [Ga(1.5), 0.26], [Ga(1.1), 0.24], [Ma(700), 0.24]]),
  procBias: num([[Ga(2.2), 0], [Ga(1.9), 0.55], [Ga(1.5), 0.05], [Ga(1.15), 0.6], [Ma(780), 0.6], [Ma(700), 0.3]]),
  moonDist: num([[Ga(4.51), 3.8], [Ga(4.505), 6], [Ga(4.49), 12], [Ga(4.45), 20], [Ga(4.0), 34], [Ga(3.0), 45], [Ga(2.0), 50], [Ga(1.4), 53.5], [Ma(620), 58.2], [Ma(70), 60.0], [2026, 60.3]]),
  moonMaria: num([[Ga(3.95), 0], [Ga(3.1), 1]]),
  moonLava: num([[Ga(4.51), 1], [Ga(4.48), 0.5], [Ga(4.40), 0.1], [Ga(4.3), 0]]),
  moonCraters: num([[Ga(4.45), 0.15], [Ga(3.8), 1]]),
  meteors: num([[Ga(4.15), 0], [Ga(4.08), 1], [Ga(3.85), 1], [Ga(3.75), 0]]),
  satellites: num([[1957.7, 0], [1958, 1], [1970, 120], [1990, 300], [2010, 500], [2019, 800], [2026, 1800], [2100, 2600], [5000, 2800]]),
};

const CENTER_A: [number, number, number] = [0.42, 0.36, 0.83];
const CENTER_B: [number, number, number] = [-0.3, -0.25, 0.92];

/** Pleistocene glacial cycles: 0 = interglacial, 1 = glacial maximum. */
export function iceAgeAt(y: number): number {
  const ago = 2026 - y;
  if (ago > 2.6e6 || ago < 9000) return 0;
  if (ago > 1.0e6) {
    const ph = (ago / 41000) * Math.PI * 2;
    return 0.25 + 0.22 * Math.sin(ph);
  }
  // ~100 kyr sawtooth: slow build-up, fast terminations (ice gone ≈ 9, 130, 243, 337, 424 ka);
  // maximum ≈ 10% of the cycle before each termination (Last Glacial Maximum ≈ 21 ka)
  const term = [9e3, 130e3, 243e3, 337e3, 424e3, 533e3, 621e3, 712e3, 790e3, 866e3, 960e3, 1.0e6];
  for (let i = 0; i < term.length - 1; i++) {
    const a = term[i], b = term[i + 1];
    if (ago >= a && ago < b) {
      const span = b - a;
      const x = (ago - a) / span; // 0 at termination (young end), 1 at the start of the build-up
      if (x < 0.1) return (x / 0.1) * 1.0 * (i === 0 ? 1 : 0.9); // rapid melt (looking backward: rising)
      return Math.max(0, (1 - (x - 0.1) / 0.9) * (i === 0 ? 1 : 0.9) - 0.05 * Math.sin(x * 25));
    }
  }
  return 0.3;
}

export function planetAt(y: number): PlanetState {
  const ia = iceAgeAt(y);
  return {
    lava: T.lava(y), crust: T.crust(y), ocean: T.ocean(y),
    seaLevel: T.seaLevel(y) - 0.125 * ia,
    veg: T.veg(y), arid: T.arid(y) + 0.15 * ia, iceLat: T.iceLat(y) - 10 * ia, iceAge: ia, redBeds: T.redBeds(y),
    modern: T.modern(y), grassland: T.grassland(y),
    city: T.city(y), cityGrow: [T.cg0(y), T.cg1(y), T.cg2(y), T.cg3(y)], fires: T.fires(y), solar: T.solar(y),
    oceanDeep: T.oceanDeep(y), oceanShallow: T.oceanShallow(y), rock: T.rock(y), vegColor: T.vegColor(y),
    haze: T.haze(y), hazeColor: T.hazeColor(y), atmo: T.atmo(y), atmoColor: T.atmoColor(y), twilight: T.twilight(y),
    cloudCover: T.cloudCover(y), cloudScale: 1, cloudColor: T.cloudColor(y), cloudShade: T.cloudShade(y), storm: T.storm(y),
    plateW: T.plateW(y), detach: T.detach(y),
    proc: [T.procScale(y), T.procThresh(y), T.procBias(y), 0.7],
    procCenter: (y < Ga(1.5) ? CENTER_A : CENTER_B),
    procOffset: [((y - Ga(4.5)) / 1e9) * 1.3, ((y - Ga(4.5)) / 1e9) * -0.7, ((y - Ga(4.5)) / 1e9) * 0.9],
    scorch: 0,
    moonDist: T.moonDist(y), moonMaria: T.moonMaria(y), moonLava: T.moonLava(y), moonCraters: T.moonCraters(y),
    sunScale: 1,
    meteors: T.meteors(y),
    satellites: Math.round(T.satellites(y)),
  };
}

export { Ga, Ma, ka };
