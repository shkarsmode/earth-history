// Live counters shown in the human chapters: world population and atmospheric CO2.
// Population: HYDE / UN WPP 2024 (medium variant to 2100); after 2100 — the film's scenario.
// CO2: ice cores (pre-1958) and Mauna Loa; after 2026 — the film's scenario (labelled as a forecast).
import { fmtNum } from './format';

function lin(keys: [number, number][]): (y: number) => number {
  return (y) => {
    if (y <= keys[0][0]) return keys[0][1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [x0, v0] = keys[i], [x1, v1] = keys[i + 1];
      if (y <= x1) return v0 + ((v1 - v0) * (y - x0)) / (x1 - x0);
    }
    return keys[keys.length - 1][1];
  };
}

export const population = lin([
  [-10000, 0.0044], [-5000, 0.005], [-3000, 0.03], [-1000, 0.1], [1, 0.23], [1000, 0.275], [1500, 0.46], [1700, 0.6], [1800, 0.98],
  [1900, 1.65], [1950, 2.5], [1975, 4.07], [2000, 6.15], [2022, 8.0], [2026, 8.3], [2050, 9.7], [2084, 10.3], [2100, 10.2],
  [2200, 9.4], [2300, 8.5], [3000, 8.0], [5000, 8.0],
]);

export const co2 = lin([
  [1750, 278], [1800, 283], [1850, 285], [1900, 296], [1950, 311], [1970, 325], [1990, 354], [2000, 369], [2010, 389], [2020, 414],
  [2026, 429], [2050, 470], [2070, 485], [2100, 470], [2200, 430], [2500, 380], [3000, 340], [5000, 300],
]);

export function liveStats(year: number): string[] {
  const out: string[] = [];
  if (year >= -10000) {
    const p = population(year);
    out.push(`Людей ≈ ${p >= 1 ? fmtNum(p, 1) + ' млрд' : fmtNum(p * 1000, p < 0.1 ? 1 : 0) + ' млн'}`);
  }
  if (year >= 1750) out.push(`CO2 ≈ ${Math.round(co2(year))} ppm`);
  return out;
}
