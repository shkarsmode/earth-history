// Schematic plate tectonics for the last ~650 Myr.
// Each plate is a set of modern Natural Earth outlines (see scripts/build-assets.mjs) that is rotated
// on the sphere. Pangaea is assembled from conjugate coastline points (Horn's quaternion fit), the
// break-up interpolates every plate back to today along its own timeline, and older configurations
// (Gondwana, Laurentia, Baltica, Siberia …) are placed by hand after common reconstructions
// (Scotese PALEOMAP, Blakey). It is a schematic: shapes are modern coastlines.
import * as THREE from 'three';

export const PLATE = { AF: 0, AR: 1, MG: 2, IN: 3, EUW: 4, EUE: 5, EA: 6, NA: 7, CA: 8, SA: 9, AN: 10, AU: 11, NZ: 12, IS: 13, CIM: 14, OC: 15 } as const;
export const PLATE_COUNT = 16;

const D2R = Math.PI / 180;
export function dir(lat: number, lon: number): THREE.Vector3 {
  const la = lat * D2R, lo = lon * D2R;
  return new THREE.Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
}
export function lonLat(v: THREE.Vector3): [number, number] {
  return [Math.atan2(v.x, v.z) / D2R, Math.asin(Math.max(-1, Math.min(1, v.y))) / D2R];
}

const I = () => new THREE.Quaternion();

/** rotation about an axis through (lat, lon) by deg (right-hand rule) */
export function euler(lat: number, lon: number, deg: number): THREE.Quaternion {
  return new THREE.Quaternion().setFromAxisAngle(dir(lat, lon), deg * D2R);
}

/** moves point a=(lat,lon) to b along a great circle, then spins about b by `spin` degrees */
export function place(a: [number, number], b: [number, number], spin = 0): THREE.Quaternion {
  const va = dir(a[0], a[1]), vb = dir(b[0], b[1]);
  const q = new THREE.Quaternion().setFromUnitVectors(va, vb);
  const s = new THREE.Quaternion().setFromAxisAngle(vb, spin * D2R);
  return s.multiply(q);
}

/** Horn's method: best rotation taking points a_i onto b_i (lat/lon pairs) */
export function fit(pairs: [[number, number], [number, number]][]): THREE.Quaternion {
  let Sxx = 0, Sxy = 0, Sxz = 0, Syx = 0, Syy = 0, Syz = 0, Szx = 0, Szy = 0, Szz = 0;
  for (const [a, b] of pairs) {
    const p = dir(a[0], a[1]), r = dir(b[0], b[1]);
    Sxx += p.x * r.x; Sxy += p.x * r.y; Sxz += p.x * r.z;
    Syx += p.y * r.x; Syy += p.y * r.y; Syz += p.y * r.z;
    Szx += p.z * r.x; Szy += p.z * r.y; Szz += p.z * r.z;
  }
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ];
  const k = N.flat().reduce((s, v) => s + Math.abs(v), 0) + 1;
  let v = [1, 0.1, 0.1, 0.1];
  for (let it = 0; it < 400; it++) {
    const w = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) w[i] += (N[i][j] + (i === j ? k : 0)) * v[j];
    const len = Math.hypot(...w);
    v = w.map((x) => x / len);
  }
  return new THREE.Quaternion(v[1], v[2], v[3], v[0]).normalize();
}

const mul = (a: THREE.Quaternion, b: THREE.Quaternion) => new THREE.Quaternion().multiplyQuaternions(a, b);
function interp(keys: [number, number][], x: number): number {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (x <= keys[i + 1][0]) return keys[i][1] + ((keys[i + 1][1] - keys[i][1]) * (x - keys[i][0])) / (keys[i + 1][0] - keys[i][0]);
  }
  return keys[keys.length - 1][1];
}
const slerp = (a: THREE.Quaternion, b: THREE.Quaternion, t: number) => a.clone().slerp(b, Math.max(0, Math.min(1, t)));
const sm = (x: number) => { const c = Math.max(0, Math.min(1, x)); return c * c * (3 - 2 * c); };

/** piecewise slerp over keyframes [timeMa, rotation] (times ascending) */
function keyed(keys: [number, THREE.Quaternion][], T: number): THREE.Quaternion {
  if (T <= keys[0][0]) return keys[0][1].clone();
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, q0] = keys[i], [t1, q1] = keys[i + 1];
    if (T <= t1) return slerp(q0, q1, (T - t0) / (t1 - t0));
  }
  return keys[keys.length - 1][1].clone();
}

// ---------------- Pangaea fit (relative to Africa held at its present position) ----------------
const FIT_SA = fit([
  [[-3.0, -39.5], [4.8, -2.0]],
  [[-5.5, -35.3], [4.0, 8.0]],
  [[-13.0, -38.5], [-4.5, 11.8]],
  [[-23.0, -42.5], [-12.0, 13.5]],
  [[-28.0, -48.6], [-20.0, 13.0]],
  [[-38.0, -57.5], [-34.0, 18.3]],
]);
const FIT_NA = fit([
  [[45.5, -61.0], [35.6, -6.2]],
  [[43.5, -66.0], [32.0, -9.3]],
  [[41.0, -70.0], [28.5, -11.0]],
  [[35.2, -75.5], [21.5, -17.0]],
  [[31.0, -81.2], [15.5, -17.2]],
  [[26.0, -80.1], [10.5, -15.0]],
]);
// Europe onto North America (closing the North Atlantic; Greenland rides with North America)
const FIT_EU_NA = fit([
  [[62.5, 5.5], [69.0, -24.0]],
  [[67.5, 12.5], [74.0, -19.5]],
  [[58.5, -5.0], [64.5, -38.0]],
  [[53.5, -10.0], [55.5, -56.0]],
  [[43.2, -9.2], [47.5, -51.5]],
  [[37.0, -9.0], [44.0, -55.5]],
]);
const FIT_MG = fit([
  [[-12.0, 49.3], [-0.5, 42.8]],
  [[-16.0, 44.0], [-3.5, 40.5]],
  [[-25.6, 45.1], [-10.0, 40.4]],
]);
const FIT_AN = fit([
  [[-70.5, 2.0], [-31.5, 30.0]],
  [[-69.5, 15.0], [-25.5, 33.8]],
  [[-73.0, -15.0], [-34.6, 24.0]],
  [[-69.0, 33.0], [-19.5, 35.5]],
]);
const FIT_AR = fit([
  [[15.0, 42.8], [15.5, 39.6]],
  [[12.8, 45.0], [11.4, 43.2]],
  [[14.5, 49.0], [11.2, 49.2]],
  [[27.0, 35.5], [27.2, 33.8]],
  [[21.5, 39.1], [19.8, 37.3]],
]);

function inFrame(q: THREE.Quaternion, p: [number, number]): [number, number] {
  return lonLat(dir(p[0], p[1]).applyQuaternion(q)).reverse() as [number, number];
}
// India: west coast onto Madagascar's east coast (in the Africa frame), east coast onto Antarctica (Lambert ↔ Mahanadi)
const FIT_IN = fit([
  [[15.0, 73.8], inFrame(FIT_MG, [-15.0, 50.3])],
  [[10.0, 76.2], inFrame(FIT_MG, [-20.5, 48.6])],
  [[8.1, 77.5], inFrame(FIT_MG, [-24.8, 47.2])],
  [[20.3, 86.7], inFrame(FIT_AN, [-69.5, 76.5])],
  [[16.0, 81.6], inFrame(FIT_AN, [-67.3, 61.0])],
]);
// Australia's south coast onto Wilkes Land (in the Africa frame through Antarctica)
const FIT_AU = fit([
  [[-34.4, 115.1], inFrame(FIT_AN, [-65.8, 102.0])],
  [[-32.0, 128.0], inFrame(FIT_AN, [-66.6, 119.0])],
  [[-35.6, 137.6], inFrame(FIT_AN, [-66.8, 138.0])],
  [[-43.6, 146.8], inFrame(FIT_AN, [-69.2, 157.0])],
]);
// Zealandia between eastern Australia and Marie Byrd Land
const FIT_NZ = fit([
  [[-34.4, 172.7], inFrame(FIT_AU, [-31.0, 159.5])],
  [[-41.3, 174.8], inFrame(FIT_AN, [-73.5, -165.0])],
  [[-46.6, 168.3], inFrame(FIT_AN, [-75.0, -142.0])],
]);

// ---------------- absolute motion ----------------
// Africa's own drift in the palaeomagnetic frame (approximate): north-ward ~12°/200 Myr with a slow spin
const AF_KEYS: [number, THREE.Quaternion][] = [
  [0, I()],
  [66, place([2, 17], [-6, 12], -6)],
  [130, place([2, 17], [-10, 10], -10)],
  [200, place([2, 17], [-12, 8], -18)],
  [250, place([2, 17], [-16, 6], -24)],
  [300, place([2, 17], [-24, 4], -34)],
  [360, place([2, 17], [-34, 6], -40)],
  [400, place([2, 17], [-45, 8], -55)],
  [450, place([2, 17], [-52, 10], -75)],
  [500, place([2, 17], [-48, 20], -85)],
  [550, place([2, 17], [-40, 30], -95)],
  [650, place([2, 17], [-30, 45], -110)],
];

// Laurentia (N. America) on its own before Pangaea (equatorial, rotated clockwise)
const NA_OLD: [number, THREE.Quaternion][] = [
  [330, I()], // placeholder: replaced by the Pangaea fit (see naAbs)
  [380, place([45, -100], [-8, -35], 25)],
  [420, place([45, -100], [-10, -40], 35)],
  [450, place([45, -100], [-5, -50], 55)],
  [500, place([45, -100], [0, -40], 75)],
  [550, place([45, -100], [5, -20], 85)],
  [650, place([45, -100], [10, 10], 95)],
];
// Baltica (Europe) before joining Laurentia (~420 Ma)
const EU_OLD: [number, THREE.Quaternion][] = [
  [420, I()],
  [450, place([55, 25], [-25, 10], -40)],
  [500, place([55, 25], [-45, 15], -100)],
  [550, place([55, 25], [-55, 25], -140)],
  [650, place([55, 25], [-50, 40], -160)],
];
// Siberia (+Kazakhstania) before the Urals closed (~280 Ma)
const EUE_OLD: [number, THREE.Quaternion][] = [
  [280, I()],
  [330, place([60, 100], [48, 70], -20)],
  [400, place([60, 100], [25, 70], -60)],
  [450, place([60, 100], [10, 80], -120)],
  [500, place([60, 100], [0, 90], -170)],
  [650, place([60, 100], [-5, 110], -180)],
];
// North + South China blocks in the eastern Tethys until they dock (~160 Ma)
const EA_OLD: [number, THREE.Quaternion][] = [
  [160, I()],
  [200, place([30, 110], [25, 95], 10)],
  [250, place([30, 110], [12, 105], 25)],
  [320, place([30, 110], [0, 110], 40)],
  [420, place([30, 110], [-12, 120], 60)],
  [650, place([30, 110], [-25, 125], 70)],
];

function naAbs(T: number, af: THREE.Quaternion): THREE.Quaternion {
  // Atlantic closing: separation starts ~190 Ma, Pangaea fit before that
  const f = sm(T / 190);
  const rel = slerp(I(), FIT_NA, f);
  const pangaea = mul(af, rel);
  if (T <= 330) return pangaea;
  const old = keyed(NA_OLD.slice(1), Math.max(T, 380));
  if (T >= 380) return old;
  return slerp(pangaea, old, sm((T - 330) / 50));
}

/** Rotations present-day -> palaeo for every plate at time T (millions of years ago). */
export function plateRotations(T: number): THREE.Quaternion[] {
  T = Math.max(0, T);
  const out: THREE.Quaternion[] = Array.from({ length: PLATE_COUNT }, I);
  const af = keyed(AF_KEYS, T);
  out[PLATE.AF] = af;
  // Arabia: Red Sea / Gulf of Aden open ~25 Ma
  out[PLATE.AR] = mul(af, slerp(I(), FIT_AR, sm(T / 25)));
  // South America: South Atlantic opens ~135 Ma
  out[PLATE.SA] = mul(af, slerp(I(), FIT_SA, sm(Math.pow(T / 135, 0.85))));
  // East Gondwana leaves Africa ~180-160 Ma
  const anRel = slerp(I(), FIT_AN, sm(Math.pow(T / 175, 0.9)));
  out[PLATE.AN] = mul(af, anRel);
  // Madagascar: slides south from Somalia ~165-120 Ma, then fixed to Africa
  out[PLATE.MG] = mul(af, slerp(I(), FIT_MG, sm((T - 115) / 50)));
  // India: rides with Madagascar (which carries it away from Africa/Antarctica) until 88 Ma,
  // then races north (fast until the collision with Asia ~50 Ma, slow indentation since)
  if (T >= 88) {
    out[PLATE.IN] = mul(out[PLATE.MG], mul(FIT_MG.clone().invert(), FIT_IN));
  } else {
    const q88 = mul(keyed(AF_KEYS, 88), mul(FIT_MG.clone().invert(), FIT_IN));
    out[PLATE.IN] = slerp(I(), q88, interp([[0, 0], [20, 0.06], [40, 0.15], [50, 0.24], [66, 0.58], [88, 1]], T));
  }
  // Australia: stays with Antarctica until ~85 Ma, fast northward drift after ~45 Ma
  const auWithAN = mul(out[PLATE.AN], mul(FIT_AN.clone().invert(), FIT_AU));
  const auSep = T >= 85 ? 1 : T > 45 ? 0.8 + 0.2 * (T - 45) / 40 : 0.8 * (T / 45);
  out[PLATE.AU] = slerp(I(), auWithAN, sm(auSep));
  // Zealandia: rifts from Australia/Antarctica ~85 Ma
  const nzWith = mul(out[PLATE.AN], mul(FIT_AN.clone().invert(), FIT_NZ));
  out[PLATE.NZ] = slerp(I(), nzWith, sm((T - 30) / 55));
  // North America and Europe
  const na = naAbs(T, af);
  out[PLATE.NA] = na;
  out[PLATE.CA] = na;
  out[PLATE.IS] = na;
  // Europe rides with North America until the North Atlantic opens (~55 Ma); before 420 Ma Baltica is separate
  const euWithNA = mul(na, slerp(I(), FIT_EU_NA, sm(T / 58)));
  if (T <= 420) out[PLATE.EUW] = euWithNA;
  else out[PLATE.EUW] = slerp(euWithNA, keyed(EU_OLD.slice(1), Math.max(T, 450)), sm((T - 420) / 30));
  // Siberia joins Baltica at the Urals (~280 Ma)
  const euePangaea = out[PLATE.EUW].clone();
  out[PLATE.EUE] = T <= 280 ? euePangaea : slerp(euePangaea, keyed(EUE_OLD.slice(1), Math.max(T, 330)), sm((T - 280) / 50));
  // China blocks dock by ~160 Ma
  const eaDocked = out[PLATE.EUE].clone();
  out[PLATE.EA] = T <= 160 ? eaDocked : slerp(eaDocked, keyed(EA_OLD.slice(1), Math.max(T, 200)), sm((T - 160) / 40));
  if (T > 200) out[PLATE.EA] = keyed(EA_OLD.slice(1), T);
  // Cimmerian blocks (Turkey, Iran, Afghanistan): rift from Gondwana ~280 Ma, dock with Eurasia ~200 Ma
  const cimDocked = out[PLATE.EUW].clone();
  const cimGondwana = mul(out[PLATE.AR], place([33, 50], [26, 50], 0));
  if (T <= 200) out[PLATE.CIM] = cimDocked;
  else if (T >= 280) out[PLATE.CIM] = cimGondwana;
  else out[PLATE.CIM] = slerp(cimGondwana, cimDocked, sm((280 - T) / 80));
  out[PLATE.OC] = I();
  return out;
}

/** presence (0..1) of plates that did not exist as land in the past */
export function plateAlpha(T: number): number[] {
  const a = new Array(PLATE_COUNT).fill(1);
  a[PLATE.CA] = sm((60 - T) / 57); // Central America / Antilles emerge; Panama closes ~3 Ma
  a[PLATE.IS] = sm((16 - T) / 6);
  a[PLATE.OC] = sm((30 - T) / 25);
  return a;
}
