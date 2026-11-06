// Geographic overlay on the globe: historical cities (appear and vanish with their real dates)
// and voyages (Columbus 1492, Magellan–Elcano 1519–1522), drawn as crisp pixel labels and dotted routes.
import { PixBuf, hex, type RGBA } from '../gfx/pixbuf';
import type { PixelFont } from '../gfx/font';

export type Projector = (lat: number, lon: number) => { x: number; y: number; vis: number };

// [label, lat, lon, from year, to year]
const PLACES: [string, number, number, number, number][] = [
  // ordered by importance: when labels collide, the earlier one keeps its text
  ['Урук', 31.32, 45.64, -4000, 100],
  ['Мемфис', 29.85, 31.25, -3100, 640],
  ['Мохенджо-Даро', 27.33, 68.14, -2500, -1900],
  ['Вавилон', 32.54, 44.42, -1900, 100],
  ['Иньсюй', 36.1, 114.3, -1300, -1046],
  ['Рим', 41.9, 12.5, -753, 9999],
  ['Афины', 37.98, 23.73, -800, 9999],
  ['Александрия', 31.2, 29.92, -331, 9999],
  ['Чанъань', 34.27, 108.9, -202, 904],
  ['Константинополь', 41.01, 28.98, 330, 1453],
  ['Стамбул', 41.01, 28.98, 1453, 9999],
  ['Багдад', 33.31, 44.36, 762, 9999],
  ['Пекин', 39.9, 116.4, 1267, 9999],
  ['Теночтитлан', 19.43, -99.13, 1325, 1521],
  ['Мехико', 19.43, -99.13, 1521, 9999],
  ['Лондон', 51.5, -0.12, 50, 9999],
  ['Париж', 48.86, 2.35, 508, 9999],
  ['Москва', 55.75, 37.62, 1147, 9999],
  ['Новый Амстердам', 40.7, -74.0, 1624, 1664],
  ['Нью-Йорк', 40.7, -74.0, 1664, 9999],
  ['Эдо', 35.68, 139.69, 1603, 1868],
  ['Токио', 35.68, 139.69, 1868, 9999],
  ['Иерихон', 31.87, 35.44, -9000, -1500],
  ['Чатал-Хююк', 37.67, 32.83, -7400, -5600],
  ['Ур', 30.96, 46.1, -3800, -500],
  ['Карфаген', 36.85, 10.32, -814, 698],
  ['Паталипутра', 25.6, 85.1, -490, 600],
  ['Теотиуакан', 19.69, -98.84, -100, 550],
  ['Кордова', 37.88, -4.78, 756, 1236],
  ['Ангкор', 13.41, 103.87, 802, 1431],
  ['Киев', 50.45, 30.52, 882, 9999],
  ['Тимбукту', 16.77, -3.0, 1100, 1600],
  ['Куско', -13.53, -71.97, 1200, 9999],
  ['Петербург', 59.93, 30.33, 1703, 9999],
  ['Манчестер', 53.48, -2.24, 1760, 1900],
  ['Байконур', 45.96, 63.31, 1955, 9999],
  ['Канаверал', 28.5, -80.6, 1950, 9999],
];

const COLUMBUS: [number, number][] = [[37.2, -6.9], [28.1, -15.4], [26, -35], [25, -55], [24.1, -74.5]];
const MAGELLAN: [number, number][] = [
  [36.8, -6.4], [28.1, -15.4], [5, -25], [-8, -34], [-22.9, -43.2], [-35, -56], [-49.3, -67.7], [-53.5, -70.5], [-52.5, -76],
  [-40, -95], [-20, -130], [0, -160], [13.4, 144.8], [10.3, 123.9], [-1, 127.5], [-10, 105], [-34.4, 18.5], [-15, 5], [15, -23.6], [36.8, -6.4],
];

const C = { text: hex('#fff2d8'), out: hex('#07060e'), dot: hex('#ffd36a'), route: hex('#ffd36a'), route2: hex('#9ad0ff') };

function route(buf: PixBuf, proj: Projector, pts: [number, number][], progress: number, col: RGBA, phase: number) {
  // interpolate along the polyline (lat/lon linear per segment is fine at this scale)
  const segs = pts.length - 1;
  const total = progress * segs;
  let k = 0;
  for (let s = 0; s < segs && s < total; s++) {
    const [la0, lo0] = pts[s], [la1, lo1] = pts[s + 1];
    let dlo = lo1 - lo0;
    if (dlo > 180) dlo -= 360; else if (dlo < -180) dlo += 360;
    const n = 40;
    const end = Math.min(1, total - s);
    for (let i = 0; i <= n * end; i++) {
      const f = i / n;
      const p = proj(la0 + (la1 - la0) * f, lo0 + dlo * f);
      k++;
      if (p.vis < 0.05 || (k + phase) % 3 === 0) continue;
      buf.set(Math.round(p.x), Math.round(p.y), col);
    }
  }
  // the ship: current head
  const s = Math.min(segs - 1, Math.floor(total));
  const f = Math.min(1, total - s);
  const [la0, lo0] = pts[s], [la1, lo1] = pts[s + 1];
  let dlo = lo1 - lo0;
  if (dlo > 180) dlo -= 360; else if (dlo < -180) dlo += 360;
  const h = proj(la0 + (la1 - la0) * f, lo0 + dlo * f);
  if (h.vis > 0.05 && progress < 1) { buf.rect(Math.round(h.x) - 1, Math.round(h.y) - 1, 3, 3, C.out); buf.set(Math.round(h.x), Math.round(h.y), hex('#ffffff')); }
}

export function drawGeo(buf: PixBuf, font: PixelFont, proj: Projector, year: number, chapter: string, alpha: number, amb: number) {
  if (alpha < 0.5) return;
  const show = ['neolithic', 'cities', 'antiquity', 'medieval', 'discovery', 'industry', 'electric', 'space'];
  if (!show.includes(chapter)) return;
  const taken: [number, number, number, number][] = [];
  for (const [name, lat, lon, y0, y1] of PLACES) {
    if (year < y0 || year > y1) continue;
    if (chapter === 'space' && !(name === 'Байконур' || name === 'Канаверал')) continue;
    const p = proj(lat, lon);
    if (p.vis < 0.25) continue;
    const x = Math.round(p.x), y = Math.round(p.y);
    if (x < 4 || y < 50 || x > buf.w - 4 || y > buf.h - 60) continue;
    const label = name.toUpperCase();
    const w = font.measure(label);
    const lx = x + 4 + w > buf.w - 4 ? x - 4 - w : x + 4;
    const rect: [number, number, number, number] = [lx - 1, y - 9, w + 2, 11];
    if (taken.some((r) => !(rect[0] > r[0] + r[2] || rect[0] + rect[2] < r[0] || rect[1] > r[1] + r[3] || rect[1] + rect[3] < r[1]))) {
      // overlapping label: keep the marker only
      buf.rect(x - 1, y - 1, 3, 3, C.out); buf.set(x, y, C.dot);
      continue;
    }
    taken.push(rect);
    buf.rect(x - 1, y - 1, 3, 3, C.out);
    buf.set(x, y, C.dot);
    font.drawOutlined(buf, label, lx, y + 1, C.text, C.out);
  }
  if (chapter === 'discovery') {
    const ph = Math.floor(amb * 8);
    if (year >= 1492) route(buf, proj, COLUMBUS, Math.min(1, (year - 1492) / 0.6), C.route, ph);
    if (year >= 1519) route(buf, proj, MAGELLAN, Math.min(1, (year - 1519) / 3), C.route2, ph);
  }
}
