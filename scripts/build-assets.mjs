// Builds the static assets the film needs (run once: `npm run assets`; outputs are committed).
//  1. copies public-domain NASA Earth textures shipped inside the three-globe package
//  2. rasterizes Natural Earth country polygons (world-atlas) into a tectonic-plate map:
//     R = plate id (255 = open ocean), G = signed distance to the coast (128 ± km/20),
//     B = distance from the plate's own edge inside its land (km/10). 2048×1024 equirectangular.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { encodePNG } from './png.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = (p) => path.join(root, 'public', p);
fs.mkdirSync(out('tex'), { recursive: true });

// ---------- 1. textures ----------
const globe = path.join(root, 'node_modules', 'three-globe', 'example', 'img');
for (const [src, dst] of [
  ['earth-day.jpg', 'tex/earth-day.jpg'],
  ['earth-blue-marble.jpg', 'tex/earth-bm.jpg'],
  ['earth-night.jpg', 'tex/earth-night.jpg'],
  ['earth-topology.png', 'tex/earth-topo.png'],
]) {
  fs.copyFileSync(path.join(globe, src), out(dst));
  console.log('copied', dst);
}

// ---------- 2. plate map ----------
const W = 2048, H = 1024;
const KM_PER_PX = (40075 / W); // along the equator / along a meridian (360° ↔ W, 180° ↔ H)

const P = { AF: 0, AR: 1, MG: 2, IN: 3, EUW: 4, EUE: 5, EA: 6, NA: 7, CA: 8, SA: 9, AN: 10, AU: 11, NZ: 12, IS: 13, CIM: 14, OC: 15 };

const NAME = {
  // Africa
  ...Object.fromEntries([
    'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cameroon', 'Central African Rep.', 'Chad', 'Congo',
    'Dem. Rep. Congo', "Côte d'Ivoire", 'Djibouti', 'Egypt', 'Eq. Guinea', 'Eritrea', 'eSwatini', 'Ethiopia', 'Gabon', 'Gambia',
    'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Malawi', 'Mali', 'Mauritania', 'Morocco',
    'Mozambique', 'Namibia', 'Niger', 'Nigeria', 'Rwanda', 'São Tomé and Principe', 'Senegal', 'Sierra Leone', 'Somalia',
    'Somaliland', 'South Africa', 'S. Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'W. Sahara', 'Zambia', 'Zimbabwe',
  ].map((n) => [n, P.AF])),
  ...Object.fromEntries(['Saudi Arabia', 'Yemen', 'Oman', 'United Arab Emirates', 'Qatar', 'Bahrain', 'Kuwait', 'Jordan', 'Iraq', 'Syria', 'Israel', 'Palestine', 'Lebanon'].map((n) => [n, P.AR])),
  Madagascar: P.MG,
  ...Object.fromEntries(['India', 'Pakistan', 'Bangladesh', 'Nepal', 'Bhutan', 'Sri Lanka', 'Siachen Glacier'].map((n) => [n, P.IN])),
  ...Object.fromEntries([
    'Albania', 'Andorra', 'Austria', 'Belarus', 'Belgium', 'Bosnia and Herz.', 'Bulgaria', 'Croatia', 'Czechia', 'Denmark', 'Estonia',
    'Finland', 'France', 'Germany', 'Greece', 'Hungary', 'Ireland', 'Isle of Man', 'Italy', 'Kosovo', 'Latvia', 'Liechtenstein',
    'Lithuania', 'Luxembourg', 'Macedonia', 'Malta', 'Moldova', 'Monaco', 'Montenegro', 'Netherlands', 'Norway', 'Poland', 'Portugal',
    'Romania', 'San Marino', 'Serbia', 'Slovakia', 'Slovenia', 'Spain', 'Sweden', 'Switzerland', 'Ukraine', 'United Kingdom', 'Vatican',
    'Åland', 'Jersey', 'Guernsey',
  ].map((n) => [n, P.EUW])),
  ...Object.fromEntries(['Kazakhstan', 'Uzbekistan', 'Turkmenistan', 'Kyrgyzstan', 'Tajikistan', 'Mongolia'].map((n) => [n, P.EUE])),
  ...Object.fromEntries([
    'China', 'Taiwan', 'Hong Kong', 'Macao', 'North Korea', 'South Korea', 'Japan', 'Vietnam', 'Laos', 'Cambodia', 'Thailand', 'Myanmar',
    'Malaysia', 'Singapore', 'Brunei', 'Philippines', 'Indonesia', 'Timor-Leste',
  ].map((n) => [n, P.EA])),
  ...Object.fromEntries(['United States of America', 'Canada', 'Mexico', 'Greenland', 'Bahamas', 'St. Pierre and Miquelon', 'Turks and Caicos Is.', 'Belize'].map((n) => [n, P.NA])),
  ...Object.fromEntries([
    'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Costa Rica', 'Panama', 'Cuba', 'Haiti', 'Dominican Rep.', 'Jamaica',
    'Puerto Rico', 'Cayman Is.', 'U.S. Virgin Is.', 'British Virgin Is.', 'Anguilla', 'St. Kitts and Nevis', 'Antigua and Barb.',
    'Montserrat', 'Dominica', 'Saint Lucia', 'St. Vin. and Gren.', 'Grenada', 'Barbados', 'St-Martin', 'St-Barthélemy', 'Sint Maarten',
    'Aruba', 'Curaçao',
  ].map((n) => [n, P.CA])),
  ...Object.fromEntries(['Argentina', 'Bolivia', 'Brazil', 'Chile', 'Colombia', 'Ecuador', 'Guyana', 'Paraguay', 'Peru', 'Suriname', 'Uruguay', 'Venezuela', 'Falkland Is.', 'Trinidad and Tobago', 'S. Geo. and the Is.'].map((n) => [n, P.SA])),
  Antarctica: P.AN,
  ...Object.fromEntries(['Australia', 'Papua New Guinea', 'Ashmore and Cartier Is.'].map((n) => [n, P.AU])),
  ...Object.fromEntries(['New Zealand', 'New Caledonia', 'Norfolk Island'].map((n) => [n, P.NZ])),
  Iceland: P.IS,
  ...Object.fromEntries(['Turkey', 'Iran', 'Afghanistan', 'Georgia', 'Armenia', 'Azerbaijan', 'Cyprus', 'N. Cyprus'].map((n) => [n, P.CIM])),
};

function plateOf(name, lon, lat) {
  switch (name) {
    case 'Russia': return lon >= 60 || lon < -150 ? P.EUE : P.EUW;
    case 'United States of America': return lon < -150 && lat < 30 ? P.OC : P.NA;
    case 'France': if (lon > -10 && lon < 20 && lat > 40) return P.EUW; if (lon < -50 && lat < 8) return P.SA; if (lon < -55) return P.CA; return P.OC;
    case 'Netherlands': return lon < -40 ? P.CA : P.EUW;
    case 'Norway': return lat < 0 || lon < -5 ? P.OC : P.EUW;
    case 'Spain': if (lon < -12 && lat < 30) return P.OC; if (lat < 36.2 && lon > -6 && lon < 0) return P.AF; return P.EUW;
    case 'Portugal': return lon < -14 ? P.OC : P.EUW;
    case 'Chile': return lon < -80 ? P.OC : P.SA;
    case 'Ecuador': return lon < -85 ? P.OC : P.SA;
    case 'Colombia': return lon < -78.5 && lat > 10 ? P.CA : P.SA;
    case 'Mexico': return lon < -108 && lat < 20 ? P.OC : P.NA;
    case 'Japan': return lat < 30 && lon > 135 ? P.OC : P.EA;
    case 'Australia': return lon > 155 && lat < -29 ? P.OC : P.AU;
    case 'New Zealand': return lon < 0 && lat > -35 ? P.OC : P.NZ;
    case 'Indonesia': case 'Timor-Leste': return lon > 130.8 && lat < -0.5 ? P.AU : P.EA;
    case 'India': return lon > 91.5 && lat < 15 ? P.EA : P.IN;
    case 'Brazil': return lon > -34.6 ? P.OC : P.SA;
    case 'South Africa': return lat < -40 ? P.OC : P.AF;
    case 'Yemen': return P.AR;
    case 'Equatorial Guinea': return P.AF;
  }
  const p = NAME[name];
  if (p === undefined) return P.OC; // small oceanic islands and territories
  return p;
}

const topo = require(path.join(root, 'node_modules', 'world-atlas', 'countries-50m.json'));
const { feature } = require('topojson-client');
const fc = feature(topo, topo.objects.countries);

const id = new Uint8Array(W * H).fill(255);
const unknown = new Set();

function fillPolygon(rings, name) {
  const rows = Array.from({ length: H }, () => []);
  for (const raw of rings) {
    if (raw.every(([, lat]) => lat < -89.9)) continue; // degenerate ring lying on the pole line
    const southPolar = raw.some(([, lat]) => lat < -60);
    // A ring that jumps across the antimeridian around the south pole (Antarctica) is closed
    // through the pole: (180, a) -> (180, -90) -> (-180, -90) -> (-180, b).
    const ring = [];
    for (let i = 0; i < raw.length; i++) {
      if (i > 0 && southPolar && Math.abs(raw[i][0] - raw[i - 1][0]) > 180) {
        const s = Math.sign(raw[i - 1][0]);
        ring.push([s * 180, raw[i - 1][1]], [s * 180, -90], [-s * 180, -90], [-s * 180, raw[i][1]]);
      }
      ring.push(raw[i]);
    }
    const pts = ring.map(([lon, lat]) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H]);
    if (!southPolar) {
      for (let i = 1; i < pts.length; i++) {
        let dx = pts[i][0] - pts[i - 1][0];
        if (dx > W / 2) pts[i][0] -= W;
        else if (dx < -W / 2) pts[i][0] += W;
      }
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      if (y0 === y1) continue;
      const ya = Math.min(y0, y1), yb = Math.max(y0, y1);
      const r0 = Math.max(0, Math.ceil(ya - 0.5)), r1 = Math.min(H - 1, Math.ceil(yb - 0.5) - 1);
      for (let r = r0; r <= r1; r++) {
        const yc = r + 0.5;
        rows[r].push(x0 + ((yc - y0) * (x1 - x0)) / (y1 - y0));
      }
    }
  }
  for (let r = 0; r < H; r++) {
    const xs = rows[r];
    if (xs.length < 2) continue;
    xs.sort((a, b) => a - b);
    const lat = 90 - ((r + 0.5) / H) * 180;
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const a = Math.ceil(xs[k] - 0.5), b = Math.ceil(xs[k + 1] - 0.5) - 1;
      for (let x = a; x <= b; x++) {
        const xx = ((x % W) + W) % W;
        const lon = ((xx + 0.5) / W) * 360 - 180;
        id[r * W + xx] = plateOf(name, lon, lat);
      }
    }
  }
}

for (const f of fc.features) {
  const name = f.properties?.name ?? '?';
  if (NAME[name] === undefined && plateOf(name, 0, 0) === P.OC) unknown.add(name);
  const g = f.geometry;
  if (!g) continue;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  for (const rings of polys) fillPolygon(rings, name);
}
console.log('oceanic/unknown territories:', [...unknown].join(', '));

// ---------- nearest-seed propagation (two-pass, 8-neighbour, wraps in x) ----------
const COS = new Float32Array(H).map((_, y) => Math.max(0.05, Math.cos(((90 - ((y + 0.5) / H) * 180) * Math.PI) / 180)));

function propagate(isSeed, x0 = 0, x1 = W - 1, y0 = 0, y1 = H - 1, full = true) {
  const n = W * H;
  const sx = new Int32Array(n).fill(-1), sy = new Int32Array(n).fill(-1);
  const d2 = new Float32Array(n).fill(Infinity);
  for (let y = y0; y <= y1; y++) for (let xr = x0; xr <= x1; xr++) {
    const x = ((xr % W) + W) % W, i = y * W + x;
    if (isSeed(i)) { sx[i] = x; sy[i] = y; d2[i] = 0; }
  }
  const tryN = (i, x, y, nx, ny) => {
    if (ny < 0 || ny >= H) return;
    nx = ((nx % W) + W) % W;
    const j = ny * W + nx;
    if (sx[j] < 0) return;
    let dx = Math.abs(sx[j] - x); if (dx > W / 2) dx = W - dx;
    const dy = sy[j] - y;
    const c = COS[y];
    const dd = dx * c * dx * c + dy * dy;
    if (dd < d2[i]) { d2[i] = dd; sx[i] = sx[j]; sy[i] = sy[j]; }
  };
  for (let it = 0; it < 2; it++) {
    for (let y = y0; y <= y1; y++) for (let xr = x0; xr <= x1; xr++) {
      const x = ((xr % W) + W) % W, i = y * W + x;
      tryN(i, x, y, x - 1, y); tryN(i, x, y, x - 1, y - 1); tryN(i, x, y, x, y - 1); tryN(i, x, y, x + 1, y - 1);
    }
    for (let y = y1; y >= y0; y--) for (let xr = x1; xr >= x0; xr--) {
      const x = ((xr % W) + W) % W, i = y * W + x;
      tryN(i, x, y, x + 1, y); tryN(i, x, y, x + 1, y + 1); tryN(i, x, y, x, y + 1); tryN(i, x, y, x - 1, y + 1);
    }
  }
  return { sx, sy, d2 };
}

console.time('sdf');
const land = (i) => id[i] !== 255;
const toOcean = propagate((i) => !land(i));
const toLand = propagate((i) => land(i));
const rgba = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) {
  let plate = 255, g;
  if (land(i)) {
    plate = id[i];
    g = Math.sqrt(toOcean.d2[i]) * KM_PER_PX;
  } else {
    const d = Math.sqrt(toLand.d2[i]) * KM_PER_PX;
    g = -d;
    if (d < 600 && toLand.sx[i] >= 0) plate = id[toLand.sy[i] * W + toLand.sx[i]];
  }
  rgba[i * 4] = plate;
  rgba[i * 4 + 1] = Math.max(1, Math.min(255, Math.round(128 + g / 20)));
  rgba[i * 4 + 2] = 0;
  rgba[i * 4 + 3] = 255;
}
// per-plate inside distance (distance to the plate's own edge, for clean edges when plates separate)
for (let k = 0; k < 16; k++) {
  let minX = W, maxX = -1, minY = H, maxY = -1, cnt = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (id[y * W + x] === k) { cnt++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  if (!cnt) continue;
  const wide = maxX - minX > W / 2;
  const r = propagate((i) => id[i] !== k, wide ? 0 : minX - 2, wide ? W - 1 : maxX + 2, Math.max(0, minY - 2), Math.min(H - 1, maxY + 2));
  for (let y = minY; y <= maxY; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (id[i] !== k) continue;
    rgba[i * 4 + 2] = Math.max(1, Math.min(255, Math.round((Math.sqrt(r.d2[i]) * KM_PER_PX) / 10)));
  }
  console.log('plate', k, 'pixels', cnt);
}
console.timeEnd('sdf');
fs.writeFileSync(out('tex/plates.png'), encodePNG(W, H, rgba));
console.log('wrote tex/plates.png');

// debug preview: colour by plate
const prev = new Uint8Array(W * H * 4);
const PAL = [[230, 160, 60], [200, 120, 90], [250, 220, 120], [240, 90, 60], [90, 160, 230], [60, 110, 200], [220, 80, 160], [80, 200, 120], [160, 220, 90], [60, 170, 80], [230, 230, 240], [240, 120, 40], [120, 220, 200], [255, 255, 255], [170, 110, 220], [255, 0, 255]];
for (let i = 0; i < W * H; i++) {
  const p = rgba[i * 4], g = rgba[i * 4 + 1];
  let c;
  if (id[i] !== 255) c = PAL[id[i]];
  else if (p !== 255) c = PAL[p].map((v) => v * 0.35 + 10 * (g - 100) / 28);
  else c = [10, 20, 50];
  prev[i * 4] = c[0]; prev[i * 4 + 1] = c[1]; prev[i * 4 + 2] = c[2]; prev[i * 4 + 3] = 255;
}
fs.mkdirSync(path.join(root, '.snaps'), { recursive: true });
fs.writeFileSync(path.join(root, '.snaps', 'plates-preview.png'), encodePNG(W, H, prev));
