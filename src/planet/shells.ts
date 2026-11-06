// Cloud deck, atmosphere ring, Moon, sky (Milky Way, Sun) and star shaders.
import { GLSL_COMMON } from './glsl';
import { CLOUD_GLSL, EARTH_VS } from './earthShader';

export const CLOUD_FS = /* glsl */ `
precision highp float;
${GLSL_COMMON}
${CLOUD_GLSL}
in vec3 vObj;
in vec3 vWorldN;
in vec3 vWorldP;
out highp vec4 fragColor;
uniform vec3 uSunDir;
uniform vec3 uSunObj;
uniform vec3 uCloudColor;
uniform vec3 uCloudShade;
uniform vec3 uTwilight;
uniform float uStorm;
uniform float uTime;
uniform float uCloudAlpha;
uniform float uSoot;          // impact winter: clouds turn brown-black
void main() {
  vec3 n = normalize(vObj);
  float d = cloudDensity(n);
  float th = bayer8(gl_FragCoord.xy);
  float a = smoothstep(0.14, 0.24, d) * uCloudAlpha;
  if (a <= th) discard;
  vec3 N = normalize(vWorldN);
  float ndl = dot(N, normalize(uSunDir));
  float toward = cloudDensity(normalize(n + uSunObj * 0.035));
  float self = smoothstep(0.0, 0.5, toward - d + 0.15);
  float lit = clamp(ndl * 1.3 + 0.12, 0.0, 1.0) * (1.0 - 0.45 * self);
  float band = qband(lit, 3.0, th, 0.4);
  vec3 col = mix(uCloudShade * 0.1, uCloudColor, band);
  col = mix(col, mix(uCloudShade, uCloudColor, 0.55), step(0.3, band) * step(band, 0.7));
  float tw = smoothstep(-0.05, 0.0, ndl) * (1.0 - smoothstep(0.0, 0.06, ndl));
  col = mix(col, uTwilight * (0.55 + 0.45 * band), step(th, tw * 0.6));
  if (uSoot > 0.0) col = mix(col, vec3(0.16, 0.12, 0.1) * (0.4 + 0.6 * band), step(th, uSoot));
  // lightning in thick storm cells on the night side
  if (uStorm > 0.0 && d > 0.45) {
    vec3 cell = floor(n * 26.0);
    float slot = floor(uTime * 9.0 + hash13(cell) * 37.0);
    float fl = step(1.0 - 0.018 * uStorm, hash13(cell + slot * 0.137));
    float night = 1.0 - smoothstep(-0.1, 0.05, ndl);
    col = mix(col, vec3(0.85, 0.9, 1.0), fl * night * step(0.3, hash13(floor(n * 140.0) + slot)));
  }
  fragColor = vec4(col, 1.0);
}
`;

// Atmosphere: only the ring outside the planet disc (the on-disc tint lives in the surface shader)
export const ATMO_FS = /* glsl */ `
precision highp float;
${GLSL_COMMON}
in vec3 vObj;
in vec3 vWorldN;
in vec3 vWorldP;
out highp vec4 fragColor;
uniform vec3 uSunDir;
uniform vec3 uAtmoColor;
uniform vec3 uTwilight;
uniform float uAtmo;
uniform float uAtmoH;
uniform vec3 uCenter;
uniform float uFlash;
void main() {
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorldP - ro);
  float t = dot(uCenter - ro, rd);
  vec3 cp = ro + rd * t - uCenter;
  float b = length(cp);
  if (b < 1.0 || t < 0.0) discard;
  float h = (b - 1.0) / uAtmoH;
  float dens = exp(-h * 2.6) * (1.0 - smoothstep(0.85, 1.0, h));
  vec3 cn = cp / b;
  float sl = dot(cn, normalize(uSunDir));
  float lit = smoothstep(-0.35, 0.35, sl);
  float fwd = pow(max(dot(rd, normalize(uSunDir)), 0.0), 6.0);   // forward scattering when the Sun is behind the planet
  float I = dens * (0.05 + 0.95 * lit + 1.6 * fwd) * uAtmo + uFlash * dens;
  float th = bayer8(gl_FragCoord.xy);
  float q = qband(clamp(I * 1.15, 0.0, 1.0), 3.0, th, 0.6);
  if (q <= 0.0) discard;
  vec3 col = mix(uAtmoColor * 0.45, min(uAtmoColor * 1.25 + 0.12, vec3(1.0)), q);
  float tw = 1.0 - smoothstep(0.0, 0.4, abs(sl + 0.05));
  col = mix(col, uTwilight * (0.6 + 0.4 * q), step(th, tw * 0.7));
  fragColor = vec4(col, 1.0);
}
`;

export const MOON_FS = /* glsl */ `
precision highp float;
${GLSL_COMMON}
in vec3 vObj;
in vec3 vWorldN;
in vec3 vWorldP;
out highp vec4 fragColor;
uniform vec3 uSunDir;
uniform float uMaria;
uniform float uLava;
uniform float uCraters;
uniform float uTime;
uniform vec3 uEarthDir;   // world direction to Earth (earthshine)
uniform float uGlow;      // proto-Moon heat glow
uniform vec4 uMare[24];   // lat, lon, radius (deg), darkness

float mareMask(vec3 n) {
  float m = 0.0;
  for (int i = 0; i < 24; i++) {
    vec4 mr = uMare[i];
    if (mr.z <= 0.0) continue;
    vec3 c = lonLatToDir(vec2(mr.y, mr.x) * 0.0174533);
    float d = acos(clamp(dot(n, c), -1.0, 1.0)) * 57.2958;
    float e = 1.0 - smoothstep(mr.z * 0.75, mr.z * 1.05, d + fbm(n * 9.0, 3) * mr.z * 0.35);
    m = max(m, e * mr.w);
  }
  return m;
}

void main() {
  vec3 n = normalize(vObj);
  vec3 N = normalize(vWorldN);
  vec3 L = normalize(uSunDir);
  float th = bayer8(gl_FragCoord.xy);
  float ndl = dot(N, L);
  // highlands
  float g = fbm(n * 6.0, 4);
  vec3 alb = mix(vec3(0.62, 0.6, 0.58), vec3(0.78, 0.76, 0.72), smoothstep(-0.4, 0.5, g));
  // craters
  vec3 v1 = voronoi3(n * 14.0);
  float rim = smoothstep(0.08, 0.0, abs(v1.x - 0.32)) * step(0.55, v1.z);
  float bowl = step(v1.x, 0.3) * step(0.55, v1.z);
  vec3 v2 = voronoi3(n * 40.0 + 3.0);
  float bowl2 = step(v2.x, 0.25) * step(0.6, v2.z);
  alb *= 1.0 - uCraters * (0.18 * bowl + 0.12 * bowl2) ;
  alb += uCraters * 0.12 * rim;
  // small craters for close-ups (rim lit toward the Sun, bowl shadowed away from it)
  vec3 v3 = voronoi3(n * 120.0 + 11.0);
  if (v3.z > 0.55 && v3.x < 0.42) {
    float side = dot(normalize(uSunDir), N);
    float inner = smoothstep(0.42, 0.25, v3.x);
    alb *= 1.0 - uCraters * 0.22 * inner * (0.6 + 0.4 * side);
    alb += uCraters * 0.1 * (1.0 - inner) * step(0.3, v3.x);
  }
  // maria
  float m = mareMask(n) * uMaria;
  alb = mix(alb, vec3(0.3, 0.31, 0.33) + 0.04 * g, step(th, m * 1.4) * step(0.15, m));
  // Tycho & Copernicus rays (bright ejecta)
  float rays = 0.0;
  {
    vec3 ty = lonLatToDir(vec2(-11.2, -43.3) * 0.0174533);
    float d = acos(clamp(dot(n, ty), -1.0, 1.0));
    vec3 axis = normalize(cross(ty, n) + 1e-5);
    float ang = atan(dot(axis, vec3(0.0, 1.0, 0.0)), dot(axis, vec3(1.0, 0.0, 0.0)));
    rays += step(0.82, hash11(floor(ang * 14.0) + 3.0)) * (1.0 - smoothstep(0.1, 0.7, d)) * step(0.03, d);
    rays += 1.0 - smoothstep(0.015, 0.03, d);
  }
  alb = mix(alb, vec3(0.86, 0.85, 0.82), step(th, rays * 0.5 * uMaria));
  // lighting
  float band = qdither(clamp(ndl * 1.25 + 0.05, 0.0, 1.0), 4.0, th);
  vec3 col = alb * mix(vec3(0.04, 0.045, 0.07), vec3(1.0), band);
  // earthshine on the night side
  float es = max(dot(N, normalize(uEarthDir)), 0.0) * (1.0 - band);
  col += alb * vec3(0.06, 0.08, 0.12) * step(th, es * 0.8);
  // molten proto-Moon
  if (uLava > 0.0) {
    vec3 vor = voronoi3(n * 6.0 + vec3(uTime * 0.03));
    float crack = 1.0 - smoothstep(0.0, 0.1 + 0.3 * uLava, vor.y - vor.x);
    float heat = uLava * (0.45 + 0.55 * crack) * (0.8 + 0.2 * fbm(n * 5.0 + uTime * 0.05, 3));
    float h = qdither(clamp(heat + uGlow * 0.3, 0.0, 1.0), 4.0, th);
    vec3 lc = h < 0.3 ? vec3(0.35, 0.06, 0.03) : h < 0.6 ? vec3(0.86, 0.3, 0.08) : vec3(1.0, 0.72, 0.3);
    col = mix(col * (1.0 - uLava * 0.6), lc, step(0.25, h));
  }
  fragColor = vec4(col, 1.0);
}
`;

// Full-screen sky: deep space gradient, Milky Way dust band, the Sun with pixel corona.
export const SKY_VS = /* glsl */ `
out vec2 vNdc;
void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;

export const SKY_FS = /* glsl */ `
precision highp float;
${GLSL_COMMON}
in vec2 vNdc;
out highp vec4 fragColor;
uniform mat4 uInvViewProj;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform vec2 uSunPx;       // sun centre in pixels (may be off-screen)
uniform float uSunR;       // sun disc radius in pixels
uniform float uSunVis;     // 1 if in front of the camera
uniform vec3 uGalPole;     // Milky Way pole direction
uniform float uMilky;
uniform vec3 uSpace;       // base space colour
uniform float uTime;
uniform vec3 uNebula;      // tint (protoplanetary / impact glow)
void main() {
  vec4 wp = uInvViewProj * vec4(vNdc, 1.0, 1.0);
  vec3 rd = normalize(wp.xyz / wp.w - uCamPos);
  vec2 fc = gl_FragCoord.xy;
  float th = bayer8(fc);
  vec3 col = uSpace;
  // Milky Way band with dust lanes
  float gb = dot(rd, normalize(uGalPole));
  float band = exp(-gb * gb * 22.0);
  float dust = fbm(rd * 6.0, 4);
  float lane = smoothstep(0.02, 0.22, abs(gb + dust * 0.08 - 0.02));
  float clump = 0.55 + 0.6 * fbm(rd * 3.0 + 4.0, 4);
  float glow = band * clump * mix(0.25, 1.0, lane) * uMilky;
  float gq = qband(clamp(glow * 1.1, 0.0, 1.0), 4.0, th, 0.8);
  vec3 mw = gq > 0.7 ? vec3(0.23, 0.21, 0.32) : gq > 0.45 ? vec3(0.15, 0.14, 0.24) : vec3(0.09, 0.085, 0.16);
  col = mix(col, mw, step(0.2, gq));
  // faint coloured nebulae
  float nb = fbm(rd * 2.2 + 9.0, 4);
  float nb2 = fbm(rd * 2.6 + 21.0, 4);
  col = mix(col, vec3(0.16, 0.06, 0.14), step(th, smoothstep(0.25, 0.6, nb) * 0.55));
  col = mix(col, vec3(0.05, 0.09, 0.18), step(th, smoothstep(0.28, 0.62, nb2) * 0.5));
  col += uNebula * qdither(clamp(nb * 0.5 + 0.5, 0.0, 1.0), 3.0, th);
  // Sun: disc + dithered corona rings + 4 rays, in exact screen pixels
  if (uSunVis > 0.5) {
    vec2 d = fc - uSunPx;
    float r = length(d);
    float R = uSunR;
    if (r < R) col = vec3(1.0, 0.98, 0.9);
    else {
      float c1 = 1.0 - smoothstep(R, R * 2.3, r);
      float c2 = 1.0 - smoothstep(R, R * 5.0, r);
      float ray = max(1.0 - smoothstep(0.0, 1.0, min(abs(d.x), abs(d.y))), 0.0) * (1.0 - smoothstep(R, R * 7.0, r));
      float diag = max(1.0 - smoothstep(0.0, 1.0, abs(abs(d.x) - abs(d.y))), 0.0) * (1.0 - smoothstep(R, R * 3.5, r));
      float I = c1 * 0.9 + c2 * 0.35 + ray * 0.8 + diag * 0.4;
      float q = qdither(clamp(I, 0.0, 1.0), 4.0, th);
      vec3 sc = q > 0.7 ? vec3(1.0, 0.93, 0.7) : q > 0.45 ? vec3(1.0, 0.78, 0.4) : vec3(0.75, 0.42, 0.2);
      col = mix(col, sc, step(0.2, q));
    }
  }
  fragColor = vec4(col, 1.0);
}
`;

export const STAR_VS = /* glsl */ `
in float aSize;
in vec3 aColor;
in float aPhase;
uniform float uTime;
uniform float uStarBright;
out vec3 vColor;
out float vSize;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.75 + 0.25 * sin(uTime * (1.3 + aPhase * 2.1) + aPhase * 40.0);
  vColor = aColor * tw * uStarBright;
  vSize = aSize;
  gl_PointSize = aSize;
}
`;

export const STAR_FS = /* glsl */ `
precision highp float;
in vec3 vColor;
in float vSize;
out highp vec4 fragColor;
void main() {
  if (vSize > 2.5) {
    // 3x3 plus-shaped star: drop the corners
    vec2 p = floor(gl_PointCoord * 3.0);
    if (p.x != 1.0 && p.y != 1.0) discard;
    float centre = (p.x == 1.0 && p.y == 1.0) ? 1.0 : 0.55;
    fragColor = vec4(vColor * centre, 1.0);
    return;
  }
  fragColor = vec4(vColor, 1.0);
}
`;

export { EARTH_VS as SHELL_VS };
