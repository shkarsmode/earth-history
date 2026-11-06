// Shared GLSL: hashing, simplex noise, fbm, voronoi, ordered dithering, lat/lon helpers.

export const GLSL_COMMON = /* glsl */ `
#define PI 3.14159265359
#define TAU 6.28318530718

float hash11(float p) { p = fract(p * .1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 hash33(vec3 p3) { p3 = fract(p3 * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }

// 3D simplex noise — Ashima Arts / Stefan Gustavson (MIT)
vec4 permute4(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = permute4(permute4(permute4(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

float fbm(vec3 p, int oct) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= oct) break;
    s += a * snoise(p);
    p = p * 2.03 + vec3(1.7, -2.1, 3.3);
    a *= 0.5;
  }
  return s;
}

// ridged multifractal (mountain chains, lava channels)
float ridged(vec3 p, int oct) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    float n = 1.0 - abs(snoise(p));
    s += a * n * n;
    p = p * 2.07 + vec3(-3.1, 1.3, 2.9);
    a *= 0.5;
  }
  return s;
}

// 3D cellular noise: x = F1, y = F2, z = cell id hash
vec3 voronoi3(vec3 p) {
  vec3 ip = floor(p), fp = fract(p);
  float d1 = 8.0, d2 = 8.0, id = 0.0;
  for (int k = -1; k <= 1; k++)
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec3 g = vec3(float(i), float(j), float(k));
    vec3 o = hash33(ip + g);
    vec3 r = g + o - fp;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; id = hash13(ip + g + 7.31); }
    else if (d < d2) d2 = d;
  }
  return vec3(sqrt(d1), sqrt(d2), id);
}

// 8x8 Bayer threshold in [0,1): bit-reverse(interleave(x^y, y)) / 64
float bayer8(vec2 p) {
  int x = int(p.x) & 7, y = int(p.y) & 7;
  int xy = x ^ y;
  int v = ((xy & 1) << 5) | ((y & 1) << 4) | ((xy & 2) << 2) | ((y & 2) << 1) | ((xy & 4) >> 1) | ((y & 4) >> 2);
  return (float(v) + 0.5) / 64.0;
}
float bayer4(vec2 p) {
  int x = int(p.x) & 3, y = int(p.y) & 3;
  int xy = x ^ y;
  int v = ((xy & 1) << 3) | ((y & 1) << 2) | ((xy & 2) >> 0) | ((y & 2) >> 1);
  return (float(v) + 0.5) / 16.0;
}

// quantize v (0..1) to n steps with ordered dithering between steps
float qdither(float v, float n, float th) { return clamp(floor(v * n + th) / n, 0.0, 1.0); }
// quantize to n steps, dithering only inside a narrow zone (w) around each step: clean pixel-art bands
float qband(float v, float n, float th, float w) {
  float x = clamp(v, 0.0, 1.0) * n;
  float i = floor(x);
  float t = clamp((x - i - 0.5) / w + 0.5, 0.0, 1.0);
  return clamp((i + step(th, t)) / n, 0.0, 1.0);
}

// snap a colour to a small hand-picked land palette (dithered between the two nearest entries)
const int LANDPAL_N = 15;
const vec3 LANDPAL[15] = vec3[15](
  vec3(0.122, 0.239, 0.169), vec3(0.184, 0.369, 0.204), vec3(0.290, 0.498, 0.231), vec3(0.478, 0.604, 0.290),
  vec3(0.561, 0.541, 0.310), vec3(0.702, 0.604, 0.361), vec3(0.851, 0.718, 0.478), vec3(0.925, 0.843, 0.627),
  vec3(0.690, 0.376, 0.227), vec3(0.498, 0.267, 0.188), vec3(0.420, 0.329, 0.251), vec3(0.490, 0.455, 0.439),
  vec3(0.659, 0.627, 0.596), vec3(0.435, 0.439, 0.353), vec3(0.262, 0.243, 0.255)
);
vec3 snapLand(vec3 c, float th) {
  float d1 = 1e9, d2 = 1e9; vec3 c1 = c, c2 = c;
  for (int i = 0; i < LANDPAL_N; i++) {
    vec3 e = c - LANDPAL[i];
    float d = dot(e * vec3(1.0, 1.25, 0.8), e);
    if (d < d1) { d2 = d1; c2 = c1; d1 = d; c1 = LANDPAL[i]; }
    else if (d < d2) { d2 = d; c2 = LANDPAL[i]; }
  }
  float r = sqrt(d1) / (sqrt(d1) + sqrt(d2) + 1e-5); // 0 = exactly c1, 0.5 = halfway
  return (r > 0.32 && th < (r - 0.32) * 2.6) ? c2 : c1;
}

// planet frame: +Y = north pole, lon 0 at +Z, lon +90E at +X
vec2 dirToLonLat(vec3 d) { return vec2(atan(d.x, d.z), asin(clamp(d.y, -1.0, 1.0))); }
vec3 lonLatToDir(vec2 ll) { return vec3(cos(ll.y) * sin(ll.x), sin(ll.y), cos(ll.y) * cos(ll.x)); }
vec2 dirToUV(vec3 d) { vec2 ll = dirToLonLat(d); return vec2(ll.x / TAU + 0.5, 0.5 - ll.y / PI); }

vec3 rgb(float r, float g, float b) { return vec3(r, g, b) / 255.0; }
vec3 rgb(int r, int g, int b) { return vec3(float(r), float(g), float(b)) / 255.0; }
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
`;
