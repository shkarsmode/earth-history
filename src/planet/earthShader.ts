// The Earth surface shader. Everything that changes over 4.5 billion years is driven by uniforms:
// magma ocean, crust, oceans and their tint, deep-time procedural continents, tectonic plates
// (rotated Natural Earth outlines), vegetation, deserts, ice, sea level, night lights and impacts.
// Output is pixel art: banded light with ordered dithering, crisp binary coastlines.
import { GLSL_COMMON } from './glsl';

export const CLOUD_GLSL = /* glsl */ `
uniform float uCloudCover;   // 0..1 (1 = overcast)
uniform float uCloudTime;    // advection clock
uniform float uCloudScale;
uniform vec4 uCyclones[6];   // xyz = centre (planet frame), w = strength (signed: rotation sense)

vec3 rotAxis(vec3 p, vec3 a, float ang) {
  float c = cos(ang), s = sin(ang);
  return p * c + cross(a, p) * s + a * dot(a, p) * (1.0 - c);
}

float cloudDensity(vec3 n) {
  vec3 p = n;
  for (int i = 0; i < 6; i++) {
    vec4 cy = uCyclones[i];
    if (cy.w == 0.0) continue;
    float d = distance(n, cy.xyz);
    float ang = cy.w * exp(-d * d * 30.0) * 7.0;
    p = rotAxis(p, cy.xyz, ang);
  }
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float alat = abs(lat);
  // slow global drift + a bounded, oscillating zonal shear (never accumulates into streaks)
  float wind = mix(-1.0, 1.0, smoothstep(0.35, 0.6, alat)) * (1.0 - smoothstep(1.1, 1.4, alat));
  float a = uCloudTime * 0.012 + 0.18 * wind * sin(uCloudTime * 0.021);
  vec3 q = vec3(p.x * cos(a) - p.z * sin(a), p.y, p.x * sin(a) + p.z * cos(a));
  float s = uCloudScale;
  vec3 w = vec3(snoise(q * 2.0 * s + 3.1), snoise(q * 2.0 * s + 7.7), snoise(q * 2.0 * s + 11.3));
  float f = fbm(q * 3.0 * s + w * 0.35 + vec3(uCloudTime * 0.003, uCloudTime * 0.004, -uCloudTime * 0.002), 5);
  f += 0.12 * fbm(q * 7.0 * s + vec3(uCloudTime * 0.01), 2);
  // ITCZ + mid-latitude storm tracks, dry subtropical highs
  float zon = 0.22 * exp(-pow(alat / 0.11, 2.0)) + 0.24 * exp(-pow((alat - 0.95) / 0.22, 2.0)) - 0.2 * exp(-pow((alat - 0.42) / 0.14, 2.0));
  return f + zon + (uCloudCover - 0.55) * 1.35;
}
`;

export const EARTH_VS = /* glsl */ `
out vec3 vObj;
out vec3 vWorldN;
out vec3 vWorldP;
void main() {
  vObj = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldP = wp.xyz;
  vWorldN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const EARTH_FS = /* glsl */ `
precision highp float;
precision highp int;
${GLSL_COMMON}
${CLOUD_GLSL}

in vec3 vObj;
in vec3 vWorldN;
in vec3 vWorldP;
out highp vec4 fragColor;

uniform float uTime;
uniform vec3 uSunDir;        // world
uniform vec3 uSunObj;        // planet frame
uniform sampler2D tPlates;
uniform sampler2D tDay;
uniform sampler2D tNight;
uniform sampler2D tTopo;
uniform vec2 uPlatesSize;
uniform mat3 uPlateM[16];
uniform vec4 uPlateCap[16];
uniform float uPlateA[16];
uniform float uDetach;
uniform float uPlateW;

uniform vec4 uProc;          // x scale, y threshold, z supercontinent bias, w warp
uniform vec3 uProcCenter;
uniform vec3 uProcOffset;

uniform float uLava;         // magma ocean 0..1
uniform float uCrust;        // crust coverage over magma 0..1
uniform float uOcean;        // water present 0..1
uniform float uSeaLevel;     // km relative to today
uniform float uVeg;          // land vegetation 0..1
uniform float uArid;
uniform float uIceLat;       // degrees: ice beyond this latitude (90 = none, 0 = snowball)
uniform float uIceAge;       // 0..1 Pleistocene ice sheets on N. America / Europe
uniform float uRedBeds;      // oxidized red land after the Great Oxidation
uniform float uModern;       // blend to observed modern colours
uniform float uCity;         // electric lights 0..1
uniform vec4 uCityGrow;      // regional electrification: x = west (Eur/N.Am), y = USSR/E.Asia, z = S.Asia/LatAm, w = Africa
uniform float uFires;        // pre-electric settlement glow 0..1
uniform float uGrassland;    // grasses (late Cenozoic)
uniform vec3 uOceanDeep;
uniform vec3 uOceanShallow;
uniform vec3 uRock;
uniform vec3 uVegColor;
uniform vec3 uHazeColor;
uniform float uHaze;
uniform vec3 uAtmoColor;
uniform float uAtmo;
uniform float uCloudShadow;
uniform float uScorch;       // post-impact soot / firestorms 0..1
uniform vec4 uImpact[4];     // xyz dir (planet frame), w = age seconds (<0 inactive)
uniform vec4 uImpactR[4];    // x = crater radius (rad), y = shock radius (rad), z = glow, w = flash
uniform vec4 uTraps;         // xyz present-day dir of the traps, w = intensity
uniform float uTrapsPlate;   // plate index carrying the traps
uniform float uMeteorGlow;   // bombardment fresh-crater glow amount
uniform float uSolar;        // future: solar farms in deserts
uniform float uDayStyle;     // 0 = blue marble, 1 = stylised relief map

float gLod = 0.0;
float hgtFromTopo(vec2 uv) {
  float t = textureLod(tTopo, uv, max(gLod - 1.0, 0.0)).r;
  return pow(t, 1.5) * 6.85; // km (calibrated: Tibet 4.9, Sahara 0.45, Denver 1.6)
}

// tectonic plates: returns x = coast metric (km, + inland), y = plate index, z = inside distance, w = presence
vec4 plateSample(vec3 n, out vec3 qOut) {
  vec4 res = vec4(-4000.0, -1.0, 0.0, 0.0);
  qOut = n;
  float best = -1e9;
  for (int k = 0; k < 16; k++) {
    float a = uPlateA[k];
    if (a <= 0.0) continue;
    if (dot(n, uPlateCap[k].xyz) < uPlateCap[k].w) continue;
    vec3 q = uPlateM[k] * n;
    vec2 uv = dirToUV(q);
    ivec2 ip = ivec2(int(fract(uv.x) * uPlatesSize.x), int(clamp(uv.y, 0.0, 0.9999) * uPlatesSize.y));
    float id = texelFetch(tPlates, ip, 0).r * 255.0;
    if (abs(id - float(k)) > 0.5) continue;
    vec3 s = texture(tPlates, uv).rgb * 255.0;
    float sdf = (s.g - 128.0) * 20.0;
    float inD = s.b * 10.0;
    float m = sdf > 0.0 ? mix(sdf, min(sdf, inD), uDetach) : sdf;
    m -= (1.0 - a) * 700.0;
    if (m > best) { best = m; res = vec4(m, float(k), inD, a); qOut = q; }
  }
  return res;
}

// deep-time continents: warped noise drifting with time
float procField(vec3 n) {
  vec3 p = n * uProc.x + uProcOffset;
  vec3 w = vec3(snoise(p * 0.6 + 11.0), snoise(p * 0.6 + 23.0), snoise(p * 0.6 + 37.0));
  float e = fbm(p + w * uProc.w, 6);
  e += uProc.z * (dot(n, uProcCenter) - 0.25);
  return e - uProc.y;
}

uniform float uFlat;          // 1 = flat map view (debug): uniform light, no limb effects

void main() {
  vec3 n = normalize(vObj);
  vec3 N = normalize(vWorldN);
  vec3 V = normalize(cameraPosition - vWorldP);
  vec3 L = normalize(uSunDir);
  if (uFlat > 0.5) { V = N; L = N; }
  vec2 fc = gl_FragCoord.xy;
  float th = bayer8(fc);
  float th4 = bayer4(fc);
  float ndl = uFlat > 0.5 ? 0.75 : dot(N, L);
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float alat = abs(lat) * 57.2958;
  gLod = log2(max(length(fwidth(n)) * 4096.0 / TAU, 0.001));

  // ---------------- geography ----------------
  vec3 q = n;
  vec4 ps = vec4(-4000.0, -1.0, 0.0, 0.0);
  if (uPlateW > 0.0) ps = plateSample(n, q);
  vec2 quv = dirToUV(q);
  float hgtPlate;
  float sdf = ps.x;
  if (ps.y >= 0.0 && sdf > 0.0) {
    hgtPlate = 0.02 + hgtFromTopo(quv);
  } else {
    float off = max(0.0, -sdf);
    float shelf = 0.02 + off / 160.0 * 0.11;
    hgtPlate = -(off < 170.0 ? shelf : 0.13 + (off - 170.0) / 300.0 * 3.5);
    hgtPlate = max(hgtPlate, -4.2);
    if (ps.y < 0.0) hgtPlate = -4.2;
    // observed bathymetry shading near the present day
    if (uModern > 0.0 && ps.y >= 0.0) {
      vec3 bm = textureLod(tDay, quv, gLod).rgb;
      float shallow = smoothstep(0.17, 0.42, bm.b - bm.r * 0.3) * uModern;
      hgtPlate = mix(hgtPlate, -0.04, shallow * step(off, 400.0) * 0.6);
    }
  }
  float pf = procField(n);
  float hgtProc = pf > 0.0 ? 0.05 + pf * 3.0 : pf * 9.0;
  float hgt = mix(hgtProc, hgtPlate, uPlateW);
  if (uPlateW > 0.0 && uPlateW < 1.0) hgt = mix(hgtProc, hgtPlate, smoothstep(0.0, 1.0, uPlateW + (th - 0.5) * 0.15));
  float relief = hgt - uSeaLevel;
  bool isLand = relief > 0.0 || uOcean <= 0.0;

  // ---------------- materials ----------------
  vec3 albedo;
  vec3 emit = vec3(0.0);
  float spec = 0.0;
  float iceCover = 0.0;
  float detail = fbm(n * 38.0, 3);
  float mid = fbm(n * 9.0, 4);

  // ice line (paleo-latitude), ragged by noise; land glaciates a bit more readily, mountains too
  float iceEdge = uIceLat >= 89.0 ? 999.0 : uIceLat + mid * 7.0 + detail * 2.0;

  if (isLand) {
    float inland = clamp((uPlateW > 0.5 ? sdf : relief * 600.0) / 1600.0, 0.0, 1.0);
    // climate belts on the paleo-latitude
    float wet = (1.0 - smoothstep(8.0, 22.0, alat)) * 1.05 + smoothstep(34.0, 48.0, alat) * (1.0 - smoothstep(62.0, 78.0, alat)) * 0.85;
    wet += 0.35 * mid - inland * 0.75 - uArid * 0.6;
    float cold = smoothstep(52.0, 72.0, alat);
    vec3 sand = mix(rgb(218, 182, 116), rgb(186, 92, 54), uRedBeds);
    vec3 dry = mix(uRock, sand, 0.35 + 0.35 * smoothstep(-0.2, 0.4, detail));
    float veg = uVeg * smoothstep(-0.05, 0.45, wet);
    vec3 forest = uVegColor * (0.8 + 0.25 * detail);
    vec3 grass = mix(uVegColor * 1.35, rgb(150, 150, 70), 0.5);
    vec3 plants = mix(grass, forest, smoothstep(0.25, 0.75, wet + 0.2 * detail));
    plants = mix(plants, mix(rgb(176, 160, 84), rgb(126, 136, 62), smoothstep(0.1, 0.4, wet)), uGrassland * (1.0 - smoothstep(0.35, 0.8, wet)));
    albedo = mix(dry, plants, veg);
    albedo = mix(albedo, mix(rgb(106, 104, 88), rgb(78, 88, 70), uVeg), cold * 0.8);
    float elev = max(relief, 0.0);
    albedo = mix(albedo, uRock * 1.05 + 0.04, smoothstep(1.4, 3.2, elev) * 0.85);
    // observed colours near the present
    if (uModern > 0.0 && ps.y >= 0.0) {
      vec3 obs = textureLod(tDay, quv, gLod).rgb;
      // winter snow in the source map: show summer vegetation instead where it is not glacier/high mountain
      float snowy = smoothstep(0.62, 0.85, luma(obs)) * (1.0 - smoothstep(0.08, 0.2, max(max(obs.r, obs.g), obs.b) - min(min(obs.r, obs.g), obs.b)));
      float glacier = smoothstep(1.4, 2.4, elev) + step(70.0, alat) * 0.0;
      bool keepIce = (alat > 59.0 && ps.y == 7.0 && q.x < -0.18 && q.z > 0.1) || ps.y == 10.0 || elev > 2.6;
      vec3 summer = mix(rgb(52, 82, 44), rgb(96, 100, 70), smoothstep(58.0, 70.0, alat));
      if (!keepIce) obs = mix(obs, summer, snowy);
      albedo = mix(albedo, obs, uModern);
    }
    albedo = snapLand(albedo, th4);
    // ice on land
    float landIce = smoothstep(iceEdge - 4.0, iceEdge + 1.0, alat + 6.0 + elev * 3.0);
    // Pleistocene ice sheets (present-day geography): Laurentide, Cordilleran, Fennoscandian, Patagonian
    if (uIceAge > 0.0) {
      vec2 ll = dirToLonLat(q) * 57.2958;
      float bNA = 41.0 + 6.0 * smoothstep(-80.0, -125.0, ll.x) + 4.0 * smoothstep(-70.0, -55.0, ll.x);
      float sheetNA = step(-170.0, ll.x) * step(ll.x, -50.0) * smoothstep(bNA, bNA + 3.0, ll.y + mid * 3.0);
      sheetNA *= 1.0 - step(ll.x, -141.0) * step(ll.y, 69.0) * step(-168.0, ll.x); // ice-free Beringia / interior Alaska
      float bEU = 51.5 + 4.0 * smoothstep(20.0, 60.0, ll.x) + 12.0 * smoothstep(60.0, 90.0, ll.x);
      float sheetEU = step(-12.0, ll.x) * step(ll.x, 95.0) * smoothstep(bEU, bEU + 3.0, ll.y + mid * 3.0);
      float sheetPat = step(-76.0, ll.x) * step(ll.x, -68.0) * smoothstep(-40.0, -43.0, ll.y);
      float alps = smoothstep(1.2, 2.0, elev) * 0.9;
      landIce = max(landIce, uIceAge * max(max(sheetNA, sheetEU), max(sheetPat, alps)));
    }
    iceCover = landIce;
    // magma ocean overrides everything early on
  } else {
    // ---------------- water ----------------
    float depth = clamp(-relief / 4.0, 0.0, 1.0);
    float shelfT = 1.0 - smoothstep(0.0, 0.16, -relief);
    float sh = qband(shelfT * 0.9, 2.0, th4, 0.5);
    albedo = mix(uOceanDeep, uOceanShallow, sh);
    albedo = mix(albedo, uOceanDeep * 0.78, step(th4, smoothstep(0.45, 0.9, depth)) * (1.0 - sh));
    spec = 1.0;
    float seaIce = smoothstep(iceEdge + 1.0, iceEdge + 5.0, alat);
    iceCover = seaIce;
  }

  // ice (land sheets + sea ice + snowball)
  if (iceCover > 0.0) {
    vec3 ice = mix(rgb(196, 222, 238), rgb(246, 251, 255), smoothstep(-0.3, 0.5, detail));
    ice = mix(ice, rgb(150, 190, 218), smoothstep(0.55, 0.75, abs(mid)) * 0.6);
    float cov = step(th, iceCover);
    albedo = mix(albedo, ice, cov);
    spec *= 1.0 - cov;
  }

  // ---------------- magma ocean ----------------
  float lavaHeat = 0.0;
  if (uLava > 0.0) {
    vec3 lw = vec3(snoise(n * 2.0 + uTime * 0.02), snoise(n * 2.0 + 5.0 - uTime * 0.017), snoise(n * 2.0 + 9.0));
    vec3 v1 = voronoi3(n * 3.2 + lw * 0.35 + vec3(0.0, uTime * 0.008, 0.0));
    float rift1 = 1.0 - smoothstep(0.0, 0.04 + 0.14 * (1.0 - uCrust), v1.y - v1.x);
    vec3 v2 = voronoi3(n * 9.0 + lw * 0.6);
    float rift2 = (1.0 - smoothstep(0.0, 0.05, v2.y - v2.x)) * (1.0 - uCrust * 0.6);
    float flow = fbm(n * 5.0 + lw * 1.2 + vec3(uTime * 0.03, 0.0, 0.0), 4);
    float open = smoothstep(0.1, 0.35, flow * 0.6 + 0.5 - uCrust * 0.85 + (v1.z - 0.5) * 0.5);
    lavaHeat = uLava * clamp(max(max(rift1 * 0.95, rift2 * 0.7), open * (0.75 + 0.35 * flow)), 0.0, 1.0);
    vec3 crustCol = mix(rgb(34, 26, 28), rgb(62, 48, 46), smoothstep(-0.3, 0.4, detail));
    albedo = mix(albedo, crustCol, uLava);
    spec *= 1.0 - uLava;
  }

  // ---------------- volcanic traps (Siberian, end-Permian) ----------------
  float trapsGlow = 0.0;
  if (uTraps.w > 0.0 && abs(ps.y - uTrapsPlate) < 0.5) {
    float d = acos(clamp(dot(q, normalize(uTraps.xyz)), -1.0, 1.0));
    float region = 1.0 - smoothstep(0.12, 0.3, d + 0.05 * mid);
    if (region > 0.0) {
      vec3 vor = voronoi3(q * 45.0 + vec3(uTime * 0.05));
      float fiss = 1.0 - smoothstep(0.0, 0.09, vor.y - vor.x);
      float core = 1.0 - smoothstep(0.0, 0.18, d);
      albedo = mix(albedo, rgb(30, 22, 22), region * uTraps.w);
      trapsGlow = region * uTraps.w * (fiss * (0.65 + 0.35 * sin(uTime * 3.0 + vor.z * 20.0)) + 0.2 + 0.5 * core * step(0.55, vor.z));
    }
    // ash veil spreading from the eruption
    float veil = (1.0 - smoothstep(0.2, 0.9, d)) * uTraps.w * 0.6;
    albedo = mix(albedo, rgb(70, 52, 44), step(th, veil * (0.6 + 0.4 * mid)));
  }

  // ---------------- impacts: craters, fire rings ----------------
  float impGlow = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 im = uImpact[i];
    if (im.w < 0.0) continue;
    vec4 r = uImpactR[i];
    float d = acos(clamp(dot(n, normalize(im.xyz)), -1.0, 1.0));
    float crater = 1.0 - smoothstep(r.x * 0.7, r.x, d);
    albedo = mix(albedo, rgb(40, 30, 28), crater * 0.85);
    impGlow += crater * r.z * (0.7 + 0.3 * sin(uTime * 7.0 + d * 90.0));
    float ring = 1.0 - smoothstep(0.0, 0.03 + r.y * 0.06, abs(d - r.y));
    impGlow += ring * r.w * step(0.001, r.y);
  }

  // ---------------- lighting (banded pixel-art) ----------------
  float wrap = clamp(ndl * 1.25 + 0.08, 0.0, 1.0);
  float band = qband(wrap, 4.0, th, 0.35);
  // cloud shadows: sample the cloud deck displaced toward the sun
  if (uCloudShadow > 0.0 && ndl > -0.1) {
    float cd = cloudDensity(normalize(n + uSunObj * 0.018));
    float sh = step(0.12 + th * 0.12, cd) * uCloudShadow;
    band *= 1.0 - 0.45 * sh;
  }
  vec3 shadowTint = mix(vec3(0.42, 0.42, 0.62), vec3(0.6, 0.45, 0.45), uLava);
  vec3 col = albedo * mix(shadowTint * 0.18, vec3(1.0), band);
  // warm terminator
  float tw = smoothstep(-0.045, 0.0, ndl) * (1.0 - smoothstep(0.0, 0.05, ndl));
  col = mix(col, col * vec3(1.25, 0.8, 0.62) + vec3(0.05, 0.015, 0.0), step(th, tw * 0.55) * (1.0 - uLava));

  // ocean sun glint (quantized blob)
  if (spec > 0.0 && uOcean > 0.0 && uFlat < 0.5) {
    vec3 Hh = normalize(L + V);
    float g = pow(max(dot(N, Hh), 0.0), 700.0) * step(0.0, ndl);
    float gq = qband(clamp(g * 2.2, 0.0, 1.0), 3.0, th, 0.5);
    col = mix(col, mix(uOceanShallow * 1.6, vec3(1.0, 0.97, 0.88), gq), gq * 0.95);
  }

  float night = 1.0 - smoothstep(-0.12, 0.06, ndl);

  // ---------------- emission ----------------
  if (lavaHeat > 0.0) {
    float h = qdither(lavaHeat, 5.0, th);
    vec3 lc = h < 0.21 ? rgb(70, 12, 8) : h < 0.41 ? rgb(150, 30, 12) : h < 0.61 ? rgb(222, 74, 20) : h < 0.81 ? rgb(255, 150, 40) : rgb(255, 228, 140);
    col = mix(col, lc, step(0.05, h));
  }
  if (trapsGlow > 0.0) {
    float h = qdither(clamp(trapsGlow, 0.0, 1.0), 4.0, th);
    vec3 lc = h < 0.3 ? rgb(120, 24, 10) : h < 0.6 ? rgb(230, 80, 20) : rgb(255, 190, 70);
    col = mix(col, lc, step(0.2, h));
  }
  if (impGlow > 0.0) {
    float h = qdither(clamp(impGlow, 0.0, 1.0), 4.0, th);
    vec3 lc = h < 0.3 ? rgb(150, 34, 12) : h < 0.6 ? rgb(250, 110, 30) : rgb(255, 236, 170);
    col = mix(col, lc, step(0.2, h));
  }
  // night lights (electric) from the observed night map, grown region by region
  if ((uCity > 0.0 || uFires > 0.0) && isLand && ps.y >= 0.0) {
    float raw = textureLod(tNight, quv, max(gLod - 0.5, 0.0)).r;
    vec2 ll = dirToLonLat(q) * 57.2958;
    float west = step(-130.0, ll.x) * step(ll.x, -50.0) * step(15.0, ll.y) + step(-12.0, ll.x) * step(ll.x, 40.0) * step(35.0, ll.y);
    float east = step(40.0, ll.x) * step(35.0, ll.y) + step(100.0, ll.x) * step(ll.x, 146.0) * step(18.0, ll.y) * step(ll.y, 46.0);
    float south = step(60.0, ll.x) * step(ll.x, 100.0) * step(ll.y, 35.0) + step(-120.0, ll.x) * step(ll.x, -30.0) * step(ll.y, 33.0) + step(95.0, ll.x) * step(ll.y, 18.0);
    float africa = step(-20.0, ll.x) * step(ll.x, 55.0) * step(ll.y, 36.0);
    float grow = clamp(west * uCityGrow.x + east * uCityGrow.y + south * uCityGrow.z + africa * uCityGrow.w, 0.0, 1.0);
    if (west + east + south + africa < 0.5) grow = uCityGrow.z;
    float lights = smoothstep(0.015, 0.22, raw) * uCity * grow;
    float l = qdither(clamp(lights * 1.3, 0.0, 1.0), 3.0, th);
    vec3 lc = l < 0.4 ? rgb(170, 110, 40) : l < 0.7 ? rgb(255, 196, 92) : rgb(255, 242, 196);
    col = mix(col, lc, step(0.3, l) * night);
    // pre-electric fires: sparse warm specks where people concentrate
    float fireMask = smoothstep(0.02, 0.2, raw) * uFires * step(0.86, hash13(floor(q * 300.0)));
    col = mix(col, rgb(255, 150, 60), step(0.5, fireMask) * night * step(th, 0.7));
  }
  // future solar farms in sunny deserts
  if (uSolar > 0.0 && isLand && alat < 34.0 && alat > 12.0 && uModern > 0.5) {
    float farm = step(0.92 - uSolar * 0.08, hash13(floor(q * 220.0))) * smoothstep(0.35, 0.1, uVeg * 0.0 + 0.2);
    col = mix(col, mix(rgb(30, 46, 92), rgb(120, 170, 230), step(0.6, band)), farm * step(0.2, band));
  }

  // ---------------- atmosphere on the disc ----------------
  float fres = 1.0 - max(dot(N, V), 0.0);
  float rim = pow(fres, 2.6) * uAtmo;
  float lightRim = clamp(ndl * 1.6 + 0.12, 0.0, 1.0);
  col = mix(col, uAtmoColor * (0.35 + 0.65 * lightRim), step(th, rim * 0.85) * step(0.02, lightRim));
  if (uHaze > 0.0) {
    float hz = uHaze * (0.55 + 0.45 * fres);
    vec3 hc = uHazeColor * mix(0.16, 1.0, qdither(wrap, 3.0, th4));
    col = mix(col, hc, step(th, hz));
  }
  if (uScorch > 0.0) {
    float sc = uScorch * (0.7 + 0.3 * mid);
    col = mix(col, rgb(36, 26, 22) * (0.5 + 0.5 * band), step(th, sc * 0.9));
    float fire = step(0.75, hash13(floor(n * 160.0 + floor(uTime * 4.0)))) * uScorch * night;
    col = mix(col, rgb(255, 120, 40), step(0.5, fire) * step(th, 0.6));
  }
  fragColor = vec4(col, 1.0);
}
`;
