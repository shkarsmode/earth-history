// Russian date formatting. Years are astronomical calendar years (…, -1, 0, 1, …, 2026, …);
// deep time is expressed as years before 2026.
export const NOW = 2026;

const nbsp = ' ';

export function fmtNum(v: number, digits = 0): string {
  const s = v.toFixed(digits);
  const [i, f] = s.split('.');
  const ii = i.replace(/\B(?=(\d{3})+(?!\d))/g, nbsp);
  return f ? `${ii},${f}` : ii;
}

export function agoLabel(y: number): string {
  const ago = NOW - y;
  if (ago >= 1e9) return `${fmtNum(ago / 1e9, 2)} млрд лет назад`;
  if (ago >= 1e8) return `${fmtNum(ago / 1e6, 0)} млн лет назад`;
  if (ago >= 1e7) return `${fmtNum(ago / 1e6, 1)} млн лет назад`;
  if (ago >= 1e6) return `${fmtNum(ago / 1e6, 2)} млн лет назад`;
  if (ago >= 1e5) return `${fmtNum(ago / 1e3, 0)} тыс. лет назад`;
  return `${fmtNum(ago / 1e3, 1)} тыс. лет назад`;
}

export function yearLabel(y: number): string {
  if (NOW - y >= 12000) return agoLabel(y);
  // y is continuous time (1957.76 = October 1957), so a CE date shows the calendar year it falls in
  const yr = y >= 1 ? Math.floor(y) : Math.round(y);
  if (yr <= 0) return `${fmtNum(1 - yr)} г. до н. э.`;
  if (yr < 1000) return `${yr} г. н. э.`;
  return `${yr} г.`;
}

export function popLabel(billions: number): string {
  if (billions >= 1) return `${fmtNum(billions, 1)} млрд`;
  return `${fmtNum(billions * 1000, 0)} млн`;
}
