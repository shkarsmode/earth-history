// Scripted events drawn around the planet: Theia and the debris disk that becomes the Moon,
// meteor showers, the Chicxulub asteroid and its ejecta, satellites, the Apollo trajectory,
// internet arcs and the spread of people out of Africa. All positions are pure functions of time.
import * as THREE from 'three';
import { GLSL_COMMON } from './glsl';
import { SHELL_VS, MOON_FS } from './shells';
import { hash } from '../core/hash';
import { dir } from '../story/plates';

export interface Events {
  theia: { on: boolean; pos: THREE.Vector3; r: number; heat: number };
  debris: { on: boolean; mode: number; t: number; accrete: number; fade: number };
  moon: { on: boolean; pos: THREE.Vector3; scale: number; lava: number };
  disk: { n: THREE.Vector3; e1: THREE.Vector3; e2: THREE.Vector3 };
  impacts: { dirW: THREE.Vector3; age: number; crater: number; shock: number; glow: number; flash: number }[];
  meteors: number; // shower intensity 0..1
  meteorT: number; // clock for the shower
  asteroid: { on: boolean; pos: THREE.Vector3; from: THREE.Vector3; glow: number };
  flash: number;
  flashColor: [number, number, number];
  shake: number;
  sats: number;
  stations: number;
  apollo: number; // 0..1 along the trajectory, <0 hidden
  net: number; // internet arcs 0..1
  ai: number; // data-centre glow 0..1
  migration: number; // thousands of years ago reached by the human dispersal (<0 hidden)
  moonBase: number;
  traps: number; // Siberian Traps eruption intensity 0..1
}

export function emptyEvents(): Events {
  return {
    theia: { on: false, pos: new THREE.Vector3(), r: 0.53, heat: 0.6 },
    debris: { on: false, mode: 0, t: 0, accrete: 0, fade: 1 },
    moon: { on: false, pos: new THREE.Vector3(), scale: 0, lava: 1 },
    disk: { n: new THREE.Vector3(0.12, 1, 0.3).normalize(), e1: new THREE.Vector3(1, 0, 0), e2: new THREE.Vector3(0, 0, -1) },
    impacts: [],
    meteors: 0,
    meteorT: 0,
    asteroid: { on: false, pos: new THREE.Vector3(), from: new THREE.Vector3(), glow: 0 },
    flash: 0,
    flashColor: [1, 1, 1],
    shake: 0,
    sats: 0,
    stations: 0,
    apollo: -1,
    net: 0,
    ai: 0,
    migration: -1,
    moonBase: 0,
    traps: 0,
  };
}

// ---------------- debris / ejecta particles (positions computed on the GPU) ----------------
const DEBRIS_VS = /* glsl */ `
in vec4 aSeed;
uniform float uT;
uniform float uMode;      // 0 = Theia debris disk, 1 = ballistic ejecta over the globe
uniform float uAccrete;
uniform float uFade;
uniform vec3 uE1;
uniform vec3 uE2;
uniform vec3 uN;
uniform vec3 uMoonPos;
uniform float uMoonR;
uniform vec3 uImp;        // impact direction (mode 1), unit
uniform vec3 uImpU;
uniform vec3 uImpW;
out vec3 vCol;
out float vAlive;

vec3 rotA(vec3 p, vec3 a, float ang) { float c = cos(ang), s = sin(ang); return p * c + cross(a, p) * s + a * dot(a, p) * (1.0 - c); }

vec3 heatCol(float h) {
  if (h > 0.82) return vec3(1.0, 0.97, 0.86);
  if (h > 0.62) return vec3(1.0, 0.82, 0.42);
  if (h > 0.42) return vec3(1.0, 0.52, 0.16);
  if (h > 0.24) return vec3(0.78, 0.24, 0.09);
  if (h > 0.1) return vec3(0.45, 0.16, 0.1);
  return vec3(0.34, 0.28, 0.26);
}

void main() {
  float r1 = aSeed.x, r2 = aSeed.y, r3 = aSeed.z, r4 = aSeed.w;
  vec3 p;
  vAlive = 1.0;
  float size = r3 > 0.985 ? 2.0 : 1.0;
  if (uMode < 0.5) {
    float t = uT;
    float rc = mix(1.25, 7.2, pow(r1, 1.5));
    float launch = r4 * 1.6;
    float tt = max(t - launch, 0.0);
    if (t < launch) vAlive = 0.0;
    float grow = 1.0 - exp(-tt * (0.55 + r3 * 0.5));
    float r = mix(1.03, rc, grow);
    float om = 1.6 * pow(rc, -1.5) * (1.0 + 2.0 * (1.0 - grow));
    float th = (r2 - 0.5) * 1.0 + om * tt + 0.8 * grow;
    float zc = (r3 - 0.5) * 1.1 * exp(-tt * 0.22) * r + (r4 - 0.5) * 0.04 * r;
    p = (uE1 * cos(th) + uE2 * sin(th)) * r + uN * zc;
    float outer = step(2.9, rc);
    float acc = outer * clamp((uAccrete * 1.6 - r1 * 0.55 - r4 * 0.2) * 2.5, 0.0, 1.0);
    acc = acc * acc * (3.0 - 2.0 * acc);
    p = mix(p, uMoonPos + (aSeed.wzy - 0.5) * uMoonR * 2.2 * (1.0 - acc), acc);
    float fall = (1.0 - outer) * clamp((uAccrete * 1.4 - r2 * 0.7) * 2.0, 0.0, 1.0);
    p = mix(p, normalize(p) * 0.98, fall);
    if (acc > 0.97 || fall > 0.97) vAlive = 0.0;
    float heat = exp(-t / 16.0) * (0.72 + 0.28 * r3) - acc * 0.2;
    vCol = heatCol(heat);
  } else {
    float t = uT;
    float az = r1 * 6.2831853;
    float range = 0.04 + 1.5 * r2 * r2;
    float tf = 1.5 + 6.0 * sqrt(r2);
    float launch = r4 * 0.6;
    float tt = max(t - launch, 0.0);
    if (t < launch) vAlive = 0.0;
    float f = clamp(tt / tf, 0.0, 1.0);
    vec3 tang = normalize(cos(az) * uImpU + sin(az) * uImpW);
    vec3 axis = normalize(cross(uImp, tang));
    vec3 d = rotA(uImp, axis, range * f);
    float h = (0.02 + 0.22 * r2) * sin(3.14159 * f);
    p = d * (1.0 + h + 0.004);
    if (f < 1.0) vCol = heatCol(0.95 - f * 0.4);
    else {
      float burn = exp(-(tt - tf) / (6.0 + 6.0 * r3));
      float flick = step(0.5, fract(sin((r1 + floor(uT * 6.0) * 0.13) * 43758.5)));
      vCol = mix(vec3(0.5, 0.12, 0.05), vec3(1.0, 0.55, 0.15), flick) * step(0.15, burn);
      if (burn < 0.15 || r3 < 0.45) vAlive = 0.0;
      size = 1.0;
    }
    if (uFade < r3) vAlive = 0.0;
  }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = size;
  if (vAlive < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

const POINT_FS = /* glsl */ `
precision highp float;
in vec3 vCol;
in float vAlive;
out highp vec4 fragColor;
void main() {
  if (vAlive < 0.5) discard;
  fragColor = vec4(vCol, 1.0);
}
`;

// ---------------- satellites (orbit computed on the GPU) ----------------
const SAT_VS = /* glsl */ `
in vec4 aSeed;
in float aIdx;
uniform float uCount;
uniform float uTime;
uniform float uStations;
out vec3 vCol;
out float vAlive;
void main() {
  vAlive = aIdx < uCount ? 1.0 : 0.0;
  float kind = aSeed.w;
  float r = 1.05 + aSeed.x * 0.12;            // LEO
  if (kind > 0.93) r = 3.1;                    // GNSS
  if (kind > 0.975) r = 6.6;                   // geostationary ring
  float inc = (kind > 0.975) ? 0.0 : mix(0.3, 1.7, aSeed.y);
  float node = aSeed.z * 6.2831853;
  float om = 0.55 * pow(r, -1.5);
  float ph = aSeed.x * 91.7 + uTime * om;
  vec3 p = vec3(cos(ph), 0.0, sin(ph)) * r;
  // incline about x, then rotate the node about y
  p = vec3(p.x, p.z * sin(inc), p.z * cos(inc));
  p = vec3(p.x * cos(node) + p.z * sin(node), p.y, -p.x * sin(node) + p.z * cos(node));
  vCol = kind > 0.975 ? vec3(0.7, 0.85, 1.0) : vec3(0.85, 0.88, 0.95);
  float big = 1.0;
  if (aIdx < uStations) { big = 2.0; vCol = vec3(1.0, 0.9, 0.6); }
  if (aIdx == 0.0) { vCol = vec3(1.0, 0.4, 0.3); }
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = big;
  if (vAlive < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

// city coordinates for internet / AI arcs and the human dispersal
const HUBS: [number, number][] = [
  [40.7, -74.0], [37.4, -122.1], [39.0, -77.5], [47.6, -122.3], [51.5, -0.1], [50.1, 8.7], [52.4, 4.9], [48.9, 2.35], [55.75, 37.6],
  [35.7, 139.7], [37.5, 127.0], [31.2, 121.5], [39.9, 116.4], [22.3, 114.2], [1.35, 103.8], [19.1, 72.9], [12.97, 77.6], [25.2, 55.3],
  [-23.5, -46.6], [-33.9, 151.2], [-33.9, 18.4], [6.5, 3.4], [30.0, 31.2], [19.4, -99.1], [43.7, -79.4], [-34.6, -58.4], [53.3, -6.3],
];
const ARCS: [number, number][] = [
  [0, 4], [0, 1], [1, 9], [4, 5], [5, 8], [4, 15], [9, 14], [14, 15], [14, 19], [11, 13], [9, 10], [0, 18], [18, 25], [20, 4], [21, 4],
  [22, 5], [17, 15], [3, 9], [2, 0], [6, 0], [23, 2], [24, 0], [26, 0], [12, 9], [16, 14], [7, 22], [13, 14], [10, 12],
];
// out of Africa: [lat, lon, thousand years ago when reached]
const MIGRATION: [number, number, number][] = [
  [9, 38, 300], [-3, 36, 280], [-25, 28, 200], [12, 30, 150], [31, -7, 300], [24, 45, 110], [31, 35, 100], [20, 57, 75], [23, 70, 65],
  [20, 80, 60], [13, 100, 55], [0, 110, 52], [-6, 140, 50], [-25, 134, 48], [-33, 150, 45], [35, 40, 50], [45, 25, 45], [48, 10, 43],
  [52, 0, 40], [44, -2, 41], [42, 90, 42], [35, 105, 40], [40, 120, 38], [36, 138, 35], [55, 60, 40], [62, 100, 32], [65, 140, 28],
  [66, -165, 22], [62, -150, 18], [55, -130, 16], [45, -120, 15], [38, -100, 14.5], [33, -110, 14], [20, -100, 14], [8, -80, 13.5],
  [-5, -75, 13.2], [-15, -60, 13], [-30, -65, 12.6], [-45, -70, 12.2], [-52, -70, 12], [38, -80, 13.5], [45, -75, 13],
];

export class EventLayer {
  readonly group = new THREE.Group(); // world-space objects
  readonly surface = new THREE.Group(); // attached to the rotating Earth
  readonly theia: THREE.Mesh;
  readonly theiaMat: THREE.ShaderMaterial;
  readonly debris: THREE.Points;
  readonly debrisMat: THREE.ShaderMaterial;
  readonly meteorLines: THREE.LineSegments;
  readonly asteroid: THREE.Points;
  readonly sats: THREE.Points;
  readonly satMat: THREE.ShaderMaterial;
  readonly apollo: THREE.LineSegments;
  readonly net: THREE.LineSegments;
  readonly people: THREE.Points;
  private meteorPos: Float32Array;
  private netBase!: Float32Array;
  private peopleBase!: Float32Array;
  private meteorCol: Float32Array;

  constructor(moonFsMat: THREE.ShaderMaterial) {
    // Theia: a molten proto-planet (moon shader in lava mode)
    this.theiaMat = moonFsMat.clone();
    this.theiaMat.uniforms = THREE.UniformsUtils.clone(moonFsMat.uniforms);
    this.theiaMat.uniforms.uSunDir = moonFsMat.uniforms.uSunDir;
    this.theia = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), this.theiaMat);
    this.theia.visible = false;
    this.group.add(this.theia);

    // debris
    const N = 70000;
    const seed = new Float32Array(N * 4);
    for (let i = 0; i < N * 4; i++) seed[i] = hash(i * 0.731 + 0.17);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.debrisMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: DEBRIS_VS,
      fragmentShader: POINT_FS,
      uniforms: {
        uT: { value: 0 }, uMode: { value: 0 }, uAccrete: { value: 0 }, uFade: { value: 1 },
        uE1: { value: new THREE.Vector3(1, 0, 0) }, uE2: { value: new THREE.Vector3(0, 0, -1) }, uN: { value: new THREE.Vector3(0, 1, 0) },
        uMoonPos: { value: new THREE.Vector3() }, uMoonR: { value: 0.27 },
        uImp: { value: new THREE.Vector3(0, 1, 0) }, uImpU: { value: new THREE.Vector3(1, 0, 0) }, uImpW: { value: new THREE.Vector3(0, 0, 1) },
      },
    });
    this.debris = new THREE.Points(g, this.debrisMat);
    this.debris.frustumCulled = false;
    this.debris.visible = false;
    this.group.add(this.debris);

    // meteors (line segments, rebuilt every frame)
    const M = 48;
    this.meteorPos = new Float32Array(M * 2 * 3 * 3);
    this.meteorCol = new Float32Array(M * 2 * 3 * 3);
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(this.meteorPos, 3));
    mg.setAttribute('color', new THREE.BufferAttribute(this.meteorCol, 3));
    this.meteorLines = new THREE.LineSegments(mg, new THREE.LineBasicMaterial({ vertexColors: true }));
    this.meteorLines.frustumCulled = false;
    this.group.add(this.meteorLines);

    // asteroid head (2 px) + glow
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    this.asteroid = new THREE.Points(ag, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, color: 0xfff2cc }));
    this.asteroid.frustumCulled = false;
    this.asteroid.visible = false;
    this.group.add(this.asteroid);

    // satellites
    const S = 9000;
    const sSeed = new Float32Array(S * 4), sIdx = new Float32Array(S);
    for (let i = 0; i < S; i++) {
      for (let k = 0; k < 4; k++) sSeed[i * 4 + k] = hash(i * 1.913 + k * 0.371 + 5.5);
      sIdx[i] = i;
    }
    sSeed[0] = 0.5; sSeed[1] = 0.62; sSeed[2] = 0.3; sSeed[3] = 0.1; // Sputnik: LEO, ~65° inclination
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(S * 3), 3));
    sg.setAttribute('aSeed', new THREE.BufferAttribute(sSeed, 4));
    sg.setAttribute('aIdx', new THREE.BufferAttribute(sIdx, 1));
    this.satMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: SAT_VS,
      fragmentShader: POINT_FS,
      uniforms: { uCount: { value: 0 }, uTime: { value: 0 }, uStations: { value: 0 } },
    });
    this.sats = new THREE.Points(sg, this.satMat);
    this.sats.frustumCulled = false;
    this.surface.add(this.sats);

    // Apollo free-return trajectory (dashed), drawn in world space
    const AP = 120;
    const apg = new THREE.BufferGeometry();
    apg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(AP * 2 * 3), 3));
    apg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(AP * 2 * 3), 3));
    this.apollo = new THREE.LineSegments(apg, new THREE.LineBasicMaterial({ vertexColors: true }));
    this.apollo.frustumCulled = false;
    this.apollo.visible = false;
    this.group.add(this.apollo);

    // internet arcs (great-circle arcs lifted above the surface), on the rotating Earth
    const SEG = 24;
    const npos = new Float32Array(ARCS.length * SEG * 2 * 3);
    const ncol = new Float32Array(ARCS.length * SEG * 2 * 3);
    ARCS.forEach(([a, b], k) => {
      const A = dir(HUBS[a][0], HUBS[a][1]), B = dir(HUBS[b][0], HUBS[b][1]);
      const ang = A.angleTo(B);
      for (let s = 0; s < SEG; s++) {
        for (let e = 0; e < 2; e++) {
          const f = (s + e) / SEG;
          const p = slerpV(A, B, f).multiplyScalar(1.004 + Math.sin(Math.PI * f) * ang * 0.08);
          npos.set([p.x, p.y, p.z], ((k * SEG + s) * 2 + e) * 3);
        }
      }
    });
    this.netBase = npos.slice();
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(npos, 3));
    ng.setAttribute('color', new THREE.BufferAttribute(ncol, 3));
    this.net = new THREE.LineSegments(ng, new THREE.LineBasicMaterial({ vertexColors: true }));
    this.net.frustumCulled = false;
    this.net.visible = false;
    this.surface.add(this.net);

    // people spreading out of Africa: points on the surface
    const PN = MIGRATION.length * 6;
    const ppos = new Float32Array(PN * 3);
    MIGRATION.forEach(([la, lo], i) => {
      for (let k = 0; k < 6; k++) {
        const p = dir(la + (hash(i * 7 + k) - 0.5) * 6, lo + (hash(i * 11 + k + 0.5) - 0.5) * 8).multiplyScalar(1.003);
        ppos.set([p.x, p.y, p.z], (i * 6 + k) * 3);
      }
    });
    this.peopleBase = ppos.slice();
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
    pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(PN * 3), 3));
    this.people = new THREE.Points(pg, new THREE.PointsMaterial({ size: 1, sizeAttenuation: false, vertexColors: true }));
    this.people.frustumCulled = false;
    this.people.visible = false;
    this.surface.add(this.people);
  }

  update(ev: Events, earthQ: THREE.Quaternion, moonPos: THREE.Vector3, tAmb: number) {
    // Theia
    this.theia.visible = ev.theia.on;
    if (ev.theia.on) {
      this.theia.position.copy(ev.theia.pos);
      this.theia.scale.setScalar(ev.theia.r);
      this.theia.lookAt(0, 0, 0);
      const u = this.theiaMat.uniforms;
      u.uLava.value = ev.theia.heat;
      u.uMaria.value = 0;
      u.uCraters.value = 0.6;
      u.uTime.value = tAmb;
      u.uGlow.value = ev.theia.heat;
      (u.uEarthDir.value as THREE.Vector3).copy(ev.theia.pos).negate().normalize();
    }
    // debris
    this.debris.visible = ev.debris.on;
    if (ev.debris.on) {
      const u = this.debrisMat.uniforms;
      u.uT.value = ev.debris.t;
      u.uMode.value = ev.debris.mode;
      u.uAccrete.value = ev.debris.accrete;
      u.uFade.value = ev.debris.fade;
      (u.uE1.value as THREE.Vector3).copy(ev.disk.e1);
      (u.uE2.value as THREE.Vector3).copy(ev.disk.e2);
      (u.uN.value as THREE.Vector3).copy(ev.disk.n);
      (u.uMoonPos.value as THREE.Vector3).copy(moonPos);
      u.uMoonR.value = Math.max(0.05, ev.moon.scale);
      if (ev.debris.mode === 1 && ev.impacts[0]) {
        const I = ev.impacts[0].dirW.clone().normalize();
        const U = new THREE.Vector3(0, 1, 0).cross(I).normalize();
        const Wv = I.clone().cross(U).normalize();
        (u.uImp.value as THREE.Vector3).copy(I);
        (u.uImpU.value as THREE.Vector3).copy(U);
        (u.uImpW.value as THREE.Vector3).copy(Wv);
      }
    }
    // meteors
    this.updateMeteors(ev);
    // asteroid
    this.asteroid.visible = ev.asteroid.on;
    if (ev.asteroid.on) {
      const a = this.asteroid.geometry.getAttribute('position') as THREE.BufferAttribute;
      a.setXYZ(0, ev.asteroid.pos.x, ev.asteroid.pos.y, ev.asteroid.pos.z);
      a.needsUpdate = true;
    }
    // satellites
    this.satMat.uniforms.uCount.value = ev.sats;
    this.satMat.uniforms.uTime.value = tAmb;
    this.satMat.uniforms.uStations.value = ev.stations;
    this.sats.visible = ev.sats > 0;
    // Apollo
    this.updateApollo(ev, earthQ, moonPos);
    // internet arcs with travelling pulses
    this.net.visible = ev.net > 0;
    if (ev.net > 0) {
      const col = this.net.geometry.getAttribute('color') as THREE.BufferAttribute;
      const npos = this.net.geometry.getAttribute('position') as THREE.BufferAttribute;
      const SEG = 24;
      for (let k = 0; k < ARCS.length; k++) {
        const on = hash(k * 3.3 + 1) < ev.net * 1.1;
        const pulse = (tAmb * 0.35 + hash(k * 9.1)) % 1;
        for (let s = 0; s < SEG; s++) {
          const f = s / SEG;
          const d = Math.abs(f - pulse);
          const bright = on ? (d < 0.06 ? 1 : 0.32) : 0;
          const c = ev.ai > 0.5 && d < 0.06 ? [0.6, 1, 0.95] : [0.35 * bright + 0.1 * bright, 0.75 * bright, 1.0 * bright];
          for (let e = 0; e < 2; e++) {
            const vi = (k * SEG + s) * 2 + e;
            col.setXYZ(vi, c[0], c[1], c[2]);
            const b = this.netBase;
            if (on) npos.setXYZ(vi, b[vi * 3], b[vi * 3 + 1], b[vi * 3 + 2]); else npos.setXYZ(vi, 0, 0, 0);
          }
        }
      }
      col.needsUpdate = true;
      npos.needsUpdate = true;
    }
    // people
    this.people.visible = ev.migration >= 0;
    if (ev.migration >= 0) {
      const col = this.people.geometry.getAttribute('color') as THREE.BufferAttribute;
      const ppos = this.people.geometry.getAttribute('position') as THREE.BufferAttribute;
      const b = this.peopleBase;
      MIGRATION.forEach(([, , ka], i) => {
        for (let k = 0; k < 6; k++) {
          const reached = ev.migration <= ka - k * 0.4;
          const flick = hash(i * 13 + k + Math.floor(tAmb * 3)) > 0.3 ? 1 : 0.6;
          const c = reached ? [1.0 * flick, 0.62 * flick, 0.25 * flick] : [0, 0, 0];
          const vi = i * 6 + k;
          col.setXYZ(vi, c[0], c[1], c[2]);
          if (reached) ppos.setXYZ(vi, b[vi * 3], b[vi * 3 + 1], b[vi * 3 + 2]); else ppos.setXYZ(vi, 0, 0, 0);
        }
      });
      col.needsUpdate = true;
      ppos.needsUpdate = true;
    }
  }

  private updateMeteors(ev: Events) {
    const pos = this.meteorPos, col = this.meteorCol;
    pos.fill(0); col.fill(0);
    const M = 48;
    if (ev.meteors > 0) {
      const rate = 2.6 * ev.meteors;
      const t = ev.meteorT;
      const i0 = Math.floor((t - 1) * rate);
      let slot = 0;
      for (let i = i0; i <= Math.floor(t * rate) && slot < M; i++) {
        const ts = i / rate + hash(i * 1.7) * 0.3;
        const dur = 0.9;
        const f = (t - ts) / dur;
        if (f < 0 || f > 1) continue;
        // target on the visible hemisphere
        const a = hash(i * 3.1) * Math.PI * 2, b = Math.acos(0.25 + 0.75 * hash(i * 5.7));
        const hit = new THREE.Vector3(Math.sin(b) * Math.cos(a), Math.sin(b) * Math.sin(a), Math.cos(b));
        const from = hit.clone().multiplyScalar(1).add(new THREE.Vector3(hash(i * 2.3) - 0.2, hash(i * 4.1) - 0.1, 0.3).normalize().multiplyScalar(2.2));
        const head = from.clone().lerp(hit, Math.min(1, f * 1.25));
        const tail = from.clone().lerp(hit, Math.max(0, f * 1.25 - 0.22));
        const mid = tail.clone().lerp(head, 0.55);
        const base = slot * 2 * 3 * 3;
        const seg = (k: number, A: THREE.Vector3, B: THREE.Vector3, c1: number[], c2: number[]) => {
          pos.set([A.x, A.y, A.z, B.x, B.y, B.z], base + k * 6);
          col.set([...c1, ...c2], base + k * 6);
        };
        if (f < 0.8) {
          seg(0, tail, mid, [0.5, 0.18, 0.08], [1, 0.55, 0.2]);
          seg(1, mid, head, [1, 0.55, 0.2], [1, 0.95, 0.8]);
        }
        slot++;
      }
    }
    (this.meteorLines.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    (this.meteorLines.geometry.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    this.meteorLines.visible = ev.meteors > 0;
  }

  private updateApollo(ev: Events, earthQ: THREE.Quaternion, moonPos: THREE.Vector3) {
    this.apollo.visible = ev.apollo >= 0;
    if (ev.apollo < 0) return;
    const pos = this.apollo.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = this.apollo.geometry.getAttribute('color') as THREE.BufferAttribute;
    const start = dir(28.5, -80.6).applyQuaternion(earthQ).multiplyScalar(1.02); // Cape Canaveral
    const m = moonPos.clone();
    const side = new THREE.Vector3().crossVectors(m, new THREE.Vector3(0, 1, 0)).normalize();
    const c1 = start.clone().multiplyScalar(2.5).add(side.clone().multiplyScalar(3));
    const c2 = m.clone().add(side.clone().multiplyScalar(-6)).add(new THREE.Vector3(0, 2, 0));
    const P = (f: number) => {
      const u = 1 - f;
      return start.clone().multiplyScalar(u * u * u).add(c1.clone().multiplyScalar(3 * u * u * f)).add(c2.clone().multiplyScalar(3 * u * f * f)).add(m.clone().multiplyScalar(f * f * f));
    };
    const N = pos.count / 2;
    for (let i = 0; i < N; i++) {
      const f0 = i / N, f1 = (i + 0.5) / N;
      const a = P(f0), b = P(f1);
      pos.setXYZ(i * 2, a.x, a.y, a.z);
      pos.setXYZ(i * 2 + 1, b.x, b.y, b.z);
      const shown = f0 <= ev.apollo;
      const head = Math.abs(f0 - ev.apollo) < 1.5 / N;
      const c = head ? [1, 1, 1] : shown ? [0.95, 0.75, 0.3] : [0, 0, 0];
      col.setXYZ(i * 2, c[0], c[1], c[2]);
      col.setXYZ(i * 2 + 1, c[0], c[1], c[2]);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }
}

function slerpV(a: THREE.Vector3, b: THREE.Vector3, t: number): THREE.Vector3 {
  const ang = a.angleTo(b);
  if (ang < 1e-5) return a.clone();
  const s = Math.sin(ang);
  return a.clone().multiplyScalar(Math.sin((1 - t) * ang) / s).add(b.clone().multiplyScalar(Math.sin(t * ang) / s));
}

export { MOON_FS, SHELL_VS, GLSL_COMMON };
