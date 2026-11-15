export const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp sampler2D;

uniform vec2 uSize;
uniform vec3 uEye;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uFwd;
uniform float uFocal;
uniform vec3 uBg;

uniform sampler2D uNightWorld;
uniform sampler2D uNightEurope;
uniform sampler2D uNightPoland;
uniform mat3x2 uNightWorldM;
uniform mat3x2 uNightEuropeM;
uniform mat3x2 uNightPolandM;
uniform vec3 uOcean;
uniform vec3 uLand;
uniform float uLightGain;
uniform float uLights;
uniform float uWindowInSwath;

uniform sampler2D uCloudWorld;
uniform sampler2D uCloudEurope;
uniform sampler2D uCloudWide;
uniform sampler2D uCloudDetail;
uniform mat3x2 uCloudWorldM;
uniform mat3x2 uCloudEuropeM;
uniform mat3x2 uCloudWideM;
uniform mat3x2 uCloudDetailM;
uniform float uDay;
uniform vec3 uSun;
uniform float uSunMode;
uniform float uTwilight;

uniform sampler2D uStripWide;
uniform sampler2D uStripCore;
uniform mat3x2 uStripWideM;
uniform mat3x2 uStripCoreM;
uniform vec3 uStripStart;
uniform vec3 uStripPole;
uniform vec2 uTearKm;
uniform mat3x2 uPassM;
uniform float uTear;
uniform float uSwathShow;

uniform sampler2D uWindow;
uniform mat3x2 uWindowM;
uniform vec2 uPaintRange;
uniform float uPaint;
uniform float uWindowShow;

uniform sampler2D uCoverage;
uniform float uCoverDay;
uniform float uCoverShow;
uniform vec3 uCoverColor;
uniform float uCoverAlpha;
uniform float uFreshAlpha;
uniform float uFreshDays;

uniform vec3 uLimbColor;
uniform float uLimbShow;

out vec4 outColor;

const float PI = 3.141592653589793;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const float EARTH_KM = 6371.0;

float inside01(vec2 uv, float feather) {
  vec2 d = min(uv, 1.0 - uv);
  return clamp(min(d.x, d.y) / feather, 0.0, 1.0);
}

vec4 bspline(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  return vec4(x, y, z, 6.0 - x - y - z) / 6.0;
}

vec4 bicubicGrad(sampler2D sam, vec2 uv, vec2 gx, vec2 gy) {
  vec2 size = vec2(textureSize(sam, 0));
  vec2 st = uv * size - 0.5;
  vec2 f = fract(st);
  st -= f;
  vec4 xc = bspline(f.x);
  vec4 yc = bspline(f.y);
  vec4 c = st.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 o = (c + vec4(xc.yw, yc.yw) / s) / size.xxyy;
  vec4 a = textureGrad(sam, o.xz, gx, gy);
  vec4 b = textureGrad(sam, o.yz, gx, gy);
  vec4 d = textureGrad(sam, o.xw, gx, gy);
  vec4 e = textureGrad(sam, o.yw, gx, gy);
  float sx = s.x / (s.x + s.y);
  float sy = s.z / (s.z + s.w);
  return mix(mix(e, d, sx), mix(b, a, sx), sy);
}

vec3 sampleNight(vec2 ll, vec2 dllx, vec2 dlly) {
  vec2 uvW = uNightWorldM * vec3(ll, 1.0);
  vec2 gx = mat2(uNightWorldM) * dllx;
  vec2 gy = mat2(uNightWorldM) * dlly;
  vec3 c = textureGrad(uNightWorld, uvW, gx, gy).rgb;
  vec2 uvE = uNightEuropeM * vec3(ll, 1.0);
  vec3 e = textureGrad(uNightEurope, uvE, mat2(uNightEuropeM) * dllx, mat2(uNightEuropeM) * dlly).rgb;
  c = mix(c, e, inside01(uvE, 0.03));
  vec2 uvP = uNightPolandM * vec3(ll, 1.0);
  vec3 p = bicubicGrad(uNightPoland, uvP, mat2(uNightPolandM) * dllx, mat2(uNightPolandM) * dlly).rgb;
  c = mix(c, p, inside01(uvP, 0.05));
  float l = dot(c, LUMA);
  vec3 base = mix(uLand, mix(uOcean, uLand, smoothstep(0.018, 0.075, l)), uLights);
  float lit = smoothstep(0.07, 0.42, l);
  return mix(base, c * uLightGain, lit * uLights);
}

vec3 sampleClouds(vec2 ll, vec2 dllx, vec2 dlly, out float coverage) {
  vec2 uvG = uCloudWorldM * vec3(ll, 1.0);
  vec2 uvE = uCloudEuropeM * vec3(ll, 1.0);
  vec2 uvW = uCloudWideM * vec3(ll, 1.0);
  vec2 uvD = uCloudDetailM * vec3(ll, 1.0);
  vec3 g = textureGrad(uCloudWorld, uvG, mat2(uCloudWorldM) * dllx, mat2(uCloudWorldM) * dlly).rgb;
  vec3 e = textureGrad(uCloudEurope, uvE, mat2(uCloudEuropeM) * dllx, mat2(uCloudEuropeM) * dlly).rgb;
  vec3 w = textureGrad(uCloudWide, uvW, mat2(uCloudWideM) * dllx, mat2(uCloudWideM) * dlly).rgb;
  vec3 d = textureGrad(uCloudDetail, uvD, mat2(uCloudDetailM) * dllx, mat2(uCloudDetailM) * dlly).rgb;
  float inEurope = inside01(uvE, 0.05);
  float worldData = smoothstep(0.015, 0.05, max(max(g.r, g.g), g.b));
  coverage = max(worldData, inEurope);
  vec3 c = mix(g, e, inEurope);
  c = mix(c, w, inside01(uvW, 0.03));
  return mix(c, d, inside01(uvD, 0.04));
}

vec2 wrapDelta(vec2 d) {
  return vec2(d.x - 360.0 * floor(d.x / 360.0 + 0.5), d.y);
}

float hash(vec2 q) {
  return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 q) {
  vec2 i = floor(q);
  vec2 f = fract(q);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x);
  float b = mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x);
  return mix(a, b, u.y);
}

float fbm(vec2 q) {
  float sum = 0.0;
  float amp = 0.5;
  for (int k = 0; k < 4; k++) {
    sum += amp * noise(q);
    q = q * 2.07 + vec2(3.1, 1.7);
    amp *= 0.5;
  }
  return sum;
}

void main() {
  vec2 px = gl_FragCoord.xy - 0.5 * uSize;
  vec3 dir = normalize(uFwd + (px.x / uFocal) * uRight + (px.y / uFocal) * uUp);
  float b = dot(uEye, dir);
  float c = dot(uEye, uEye) - 1.0;
  float disc = b * b - c;
  float closest = sqrt(max(0.0, dot(uEye, uEye) - b * b));
  float pixelWorld = max(-b, 1e-6) / uFocal;
  float cover = clamp((1.0 - closest) / pixelWorld + 0.5, 0.0, 1.0);
  if (cover <= 0.0 || b >= 0.0) {
    outColor = vec4(uBg, 1.0);
    return;
  }
  float t = disc > 0.0 ? -b - sqrt(disc) : -b;
  vec3 p = normalize(uEye + t * dir);
  vec2 ll = vec2(degrees(atan(p.y, p.x)), degrees(asin(clamp(p.z, -1.0, 1.0))));
  vec2 dllx = wrapDelta(dFdx(ll));
  vec2 dlly = wrapDelta(dFdy(ll));

  vec3 col = sampleNight(ll, dllx, dlly);

  vec3 cov = texture(uCoverage, vec2((ll.x + 180.0) / 360.0, (90.0 - ll.y) / 180.0)).rgb;
  float firstDay = (cov.r * 255.0 - 1.0) / 254.0 * 12.0;
  float covered = step(0.5 / 255.0, cov.r) * step(firstDay, uCoverDay) * step(0.5, cov.g);
  float fresh = covered * (1.0 - smoothstep(0.0, uFreshDays, uCoverDay - firstDay));
  col = mix(col, uCoverColor, uCoverShow * (uCoverAlpha * covered + uFreshAlpha * fresh));

  float cloudIn;
  vec3 day = sampleClouds(ll, dllx, dlly, cloudIn);
  float sunlit = mix(1.0, smoothstep(-uTwilight, uTwilight, dot(p, uSun)), uSunMode);
  col = mix(col, day, uDay * cloudIn * sunlit);

  vec2 ca = uPassM * vec3(ll, 1.0);

  vec2 uvSW = uStripWideM * vec3(ll, 1.0);
  vec2 uvSC = uStripCoreM * vec3(ll, 1.0);
  vec4 sw = textureGrad(uStripWide, uvSW, mat2(uStripWideM) * dllx, mat2(uStripWideM) * dlly);
  vec4 sc = textureGrad(uStripCore, uvSC, mat2(uStripCoreM) * dllx, mat2(uStripCoreM) * dlly);
  float coreW = sc.a * inside01(uvSC, 0.01);
  float stripAlpha = max(sw.a * inside01(uvSW, 0.002), coreW);
  vec3 stripRgb = mix(sw.rgb, sc.rgb, clamp(coreW / max(stripAlpha, 1e-4), 0.0, 1.0));

  vec2 uvWin = uWindowM * vec3(ll, 1.0);
  vec4 win = bicubicGrad(uWindow, uvWin, mat2(uWindowM) * dllx, mat2(uWindowM) * dlly);
  float inWin = inside01(uvWin, 0.004);
  vec3 radar = mix(stripRgb, win.rgb, inWin * uWindowInSwath);
  float radarAlpha = max(stripAlpha, inWin * uWindowInSwath);

  float cloudLuma = dot(day, LUMA);
  float alongKm = atan(dot(p, cross(uStripPole, uStripStart)), dot(p, uStripStart)) * EARTH_KM;
  float acrossKm = asin(clamp(dot(p, uStripPole), -1.0, 1.0)) * EARTH_KM;
  float ragged = fbm(vec2(acrossKm, alongKm) / 70.0) - 0.5;
  float threshold = alongKm + (cloudLuma - 0.82) * 90.0 + ragged * 170.0;
  float front = mix(uTearKm.x, uTearKm.y, uTear);
  float soft = max(4.0, 2.5 * fwidth(alongKm));
  float open = smoothstep(threshold - soft, threshold + 0.2 * soft, front);
  float rim = smoothstep(threshold - 10.0 * soft, threshold - soft, front) * (1.0 - open);
  col *= 1.0 - 0.2 * rim * radarAlpha * uSwathShow * step(0.001, uTear);
  col = mix(col, radar, uSwathShow * open * radarAlpha);

  float along = (ca.y - uPaintRange.x) / (uPaintRange.y - uPaintRange.x);
  float fwa = max(fwidth(along), 1e-6);
  float painted = clamp((uPaint - along) / fwa + 0.5, 0.0, 1.0);
  col = mix(col, win.rgb, uWindowShow * inWin * painted);

  float limb = clamp(1.0 - abs(1.0 - closest) / (1.25 * pixelWorld), 0.0, 1.0);
  col = mix(col, uLimbColor, uLimbShow * limb);

  outColor = vec4(mix(uBg, col, cover), 1.0);
}
`
