// The orbital view: Earth, clouds, atmosphere ring, Moon, Sun and stars, rendered at pixel-art resolution.
import * as THREE from 'three';
import { EARTH_VS, EARTH_FS } from './earthShader';
import { CLOUD_FS, ATMO_FS, MOON_FS, SKY_VS, SKY_FS, STAR_VS, STAR_FS, SHELL_VS } from './shells';
import type { PlanetState } from '../story/planetState';
import { plateRotations, plateAlpha, PLATE_COUNT, dir } from '../story/plates';
import { hash } from '../core/hash';
import { EventLayer, type Events } from './events';

export interface Shot {
  rh: number; // planet radius as a fraction of the screen height
  lat: number; // planet point facing the camera (deg)
  lon: number;
  phase: number; // sun angle from the view direction (deg): 0 = full disc lit, 90 = half, 160 = crescent
  tilt: number; // sun direction around the view axis (deg): 0 = light from the right, 90 = from above
  roll: number; // planet roll on screen (deg)
  ox: number; // planet centre offset (fraction of half-width), + = right
  oy: number; // + = up
  fov: number;
  moonAz: number; // Moon direction relative to the view (deg): az 0 = straight behind Earth, + = right
  moonEl: number;
  moonVis: number;
}

export const DEFAULT_SHOT: Shot = { rh: 0.36, lat: 15, lon: 20, phase: 55, tilt: 20, roll: 0, ox: 0, oy: 0, fov: 30, moonAz: 14, moonEl: 4, moonVis: 1 };

export interface PlateInfo { center: THREE.Vector3; cosR: number }

const MARIA: [number, number, number, number][] = [
  // lat, lon, radius°, darkness — the familiar near side
  [40, -50, 12, 1], [22, -58, 15, 1], [3, -52, 13, 1], [-12, -42, 9, 1], // Oceanus Procellarum
  [33, -16, 16, 1], // Imbrium
  [56, -20, 6, 0.9], [57, 0, 6, 0.9], [56, 20, 6, 0.9], [58, -40, 5, 0.9], // Frigoris
  [28, 17.5, 10, 1], // Serenitatis
  [8.5, 31, 12, 1], // Tranquillitatis
  [17, 59, 8, 1], // Crisium
  [-8, 51, 10, 1], // Fecunditatis
  [-15, 35, 5, 1], // Nectaris
  [-21, -17, 10, 1], // Nubium
  [-24, -39, 6, 1], // Humorum
  [13, 4, 4, 0.9], // Vaporum
  [-10, -23, 5, 0.9], // Cognitum
  [7, -31, 6, 0.9], // Insularum
  [51.6, -9.4, 1.8, 1], // Plato
];

export class PlanetScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.01, 3000);
  readonly earth: THREE.Mesh;
  readonly clouds: THREE.Mesh;
  readonly atmo: THREE.Mesh;
  readonly moon: THREE.Mesh;
  readonly sky: THREE.Mesh;
  readonly stars: THREE.Points;
  readonly earthMat: THREE.ShaderMaterial;
  readonly cloudMat: THREE.ShaderMaterial;
  readonly atmoMat: THREE.ShaderMaterial;
  readonly moonMat: THREE.ShaderMaterial;
  readonly skyMat: THREE.ShaderMaterial;
  readonly starMat: THREE.ShaderMaterial;
  readonly sunDir = new THREE.Vector3(1, 0, 0);
  readonly earthGroup = new THREE.Group();
  plates: PlateInfo[];
  readonly events: EventLayer;
  W = 480;
  H = 270;

  constructor(tex: { plates: THREE.Texture; day: THREE.Texture; night: THREE.Texture; topo: THREE.Texture }, plates: PlateInfo[]) {
    this.plates = plates;
    const cyclones = Array.from({ length: 6 }, () => new THREE.Vector4(0, 0, 0, 0));
    const cloudUniforms = {
      uCloudCover: { value: 0.55 },
      uCloudTime: { value: 0 },
      uCloudScale: { value: 1 },
      uCyclones: { value: cyclones },
    };
    this.earthMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: EARTH_VS,
      fragmentShader: EARTH_FS,
      uniforms: {
        ...cloudUniforms,
        uTime: { value: 0 },
        uSunDir: { value: this.sunDir },
        uSunObj: { value: new THREE.Vector3(1, 0, 0) },
        tPlates: { value: tex.plates },
        tDay: { value: tex.day },
        tNight: { value: tex.night },
        tTopo: { value: tex.topo },
        uPlatesSize: { value: new THREE.Vector2(2048, 1024) },
        uPlateM: { value: Array.from({ length: PLATE_COUNT }, () => new THREE.Matrix3()) },
        uPlateCap: { value: Array.from({ length: PLATE_COUNT }, () => new THREE.Vector4(0, 1, 0, -1)) },
        uPlateA: { value: new Array(PLATE_COUNT).fill(1) },
        uDetach: { value: 0 },
        uPlateW: { value: 1 },
        uProc: { value: new THREE.Vector4(2, 0.3, 0, 0.7) },
        uProcCenter: { value: new THREE.Vector3(0, 0, 1) },
        uProcOffset: { value: new THREE.Vector3() },
        uLava: { value: 0 },
        uCrust: { value: 1 },
        uOcean: { value: 1 },
        uSeaLevel: { value: 0 },
        uVeg: { value: 0.8 },
        uArid: { value: 0.3 },
        uIceLat: { value: 66 },
        uIceAge: { value: 0 },
        uRedBeds: { value: 0.4 },
        uModern: { value: 1 },
        uCity: { value: 0 },
        uCityGrow: { value: new THREE.Vector4() },
        uFires: { value: 0 },
        uGrassland: { value: 0.8 },
        uOceanDeep: { value: new THREE.Color() },
        uOceanShallow: { value: new THREE.Color() },
        uRock: { value: new THREE.Color() },
        uVegColor: { value: new THREE.Color() },
        uHazeColor: { value: new THREE.Color() },
        uHaze: { value: 0 },
        uAtmoColor: { value: new THREE.Color() },
        uAtmo: { value: 1 },
        uCloudShadow: { value: 1 },
        uScorch: { value: 0 },
        uImpact: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 1, 0, -1)) },
        uImpactR: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
        uTraps: { value: new THREE.Vector4() },
        uTrapsPlate: { value: 5 },
        uMeteorGlow: { value: 0 },
        uSolar: { value: 0 },
        uDayStyle: { value: 0 },
        uFlat: { value: 0 },
      },
    });
    this.cloudMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: SHELL_VS,
      fragmentShader: CLOUD_FS,
      uniforms: {
        ...cloudUniforms,
        uSunDir: { value: this.sunDir },
        uSunObj: this.earthMat.uniforms.uSunObj,
        uCloudColor: { value: new THREE.Color() },
        uCloudShade: { value: new THREE.Color() },
        uTwilight: { value: new THREE.Color() },
        uStorm: { value: 0 },
        uTime: { value: 0 },
        uCloudAlpha: { value: 1 },
        uSoot: { value: 0 },
        uAurora: { value: 0 },
      },
    });
    this.atmoMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: SHELL_VS,
      fragmentShader: ATMO_FS,
      uniforms: {
        uSunDir: { value: this.sunDir },
        uAtmoColor: { value: new THREE.Color() },
        uTwilight: { value: new THREE.Color() },
        uAtmo: { value: 1 },
        uAtmoH: { value: 0.045 },
        uCenter: { value: new THREE.Vector3() },
        uFlash: { value: 0 },
      },
      depthWrite: false,
    });
    this.moonMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: SHELL_VS,
      fragmentShader: MOON_FS,
      uniforms: {
        uSunDir: { value: this.sunDir },
        uMaria: { value: 1 },
        uLava: { value: 0 },
        uCraters: { value: 1 },
        uTime: { value: 0 },
        uEarthDir: { value: new THREE.Vector3() },
        uGlow: { value: 0 },
        uBase: { value: 0 },
        uMare: { value: Array.from({ length: 24 }, (_, i) => (MARIA[i] ? new THREE.Vector4(...MARIA[i]) : new THREE.Vector4(0, 0, 0, 0))) },
      },
    });
    this.skyMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: SKY_VS,
      fragmentShader: SKY_FS,
      uniforms: {
        uInvViewProj: { value: new THREE.Matrix4() },
        uCamPos: { value: new THREE.Vector3() },
        uSunDir: { value: this.sunDir },
        uSunPx: { value: new THREE.Vector2() },
        uSunR: { value: 3 },
        uSunVis: { value: 0 },
        uGalPole: { value: new THREE.Vector3(0.35, 0.8, 0.45).normalize() },
        uMilky: { value: 1 },
        uSpace: { value: new THREE.Color('#05040c') },
        uTime: { value: 0 },
        uNebula: { value: new THREE.Color(0, 0, 0) },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    this.starMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: STAR_VS,
      fragmentShader: STAR_FS,
      uniforms: { uTime: { value: 0 }, uStarBright: { value: 1 } },
      depthTest: false,
      depthWrite: false,
    });
    this.stars = makeStars(this.starMat);
    this.stars.renderOrder = -9;
    this.scene.add(this.stars);

    const sphere = new THREE.SphereGeometry(1, 192, 96);
    this.earth = new THREE.Mesh(sphere, this.earthMat);
    this.clouds = new THREE.Mesh(sphere, this.cloudMat);
    this.clouds.scale.setScalar(1.012);
    this.atmo = new THREE.Mesh(sphere, this.atmoMat);
    this.atmo.scale.setScalar(1.045);
    this.atmo.renderOrder = 5;
    this.earthGroup.add(this.earth, this.clouds);
    this.scene.add(this.earthGroup, this.atmo);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), this.moonMat);
    this.moon.scale.setScalar(0.2727);
    this.scene.add(this.moon);
    this.events = new EventLayer(this.moonMat);
    this.scene.add(this.events.group);
    this.earthGroup.add(this.events.surface);
  }

  setSize(w: number, h: number) {
    this.W = w;
    this.H = h;
    this.camera.aspect = w / h;
  }

  /** Apply era state + camera shot. tFilm drives scripted motion, tAmb drives ambient motion. */
  update(s: PlanetState, shot: Shot, year: number, tAmb: number, ev: Events) {
    const u = this.earthMat.uniforms;
    // ---------- camera & orientation ----------
    const cam = this.camera;
    cam.fov = shot.fov;
    const tanHalf = Math.tan((shot.fov * Math.PI) / 360);
    const alpha = Math.atan(2 * shot.rh * tanHalf);
    const dist = Math.max(1.06, 1 / Math.sin(alpha));
    cam.position.set(0, 0, dist);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
    cam.setViewOffset(this.W, this.H, (-shot.ox * this.W) / 2, (shot.oy * this.H) / 2, this.W, this.H);
    cam.near = Math.max(0.005, Math.min((dist - 1.1) * 0.5, 0.08));
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    const f = dir(shot.lat, shot.lon);
    let up = new THREE.Vector3(0, 1, 0).sub(f.clone().multiplyScalar(f.y));
    if (up.lengthSq() < 1e-6) up = new THREE.Vector3(0, 0, -1);
    up.normalize();
    const r = new THREE.Vector3().crossVectors(up, f).normalize();
    const worldToPlanet = new THREE.Matrix4().makeBasis(r, up, f);
    const planetToWorld = worldToPlanet.clone().transpose();
    const roll = new THREE.Matrix4().makeRotationZ((shot.roll * Math.PI) / 180);
    planetToWorld.premultiply(roll);
    this.earthGroup.quaternion.setFromRotationMatrix(planetToWorld);
    this.earthGroup.updateMatrixWorld(true);

    const ph = (shot.phase * Math.PI) / 180, tl = (shot.tilt * Math.PI) / 180;
    this.sunDir.set(Math.sin(ph) * Math.cos(tl), Math.sin(ph) * Math.sin(tl), Math.cos(ph)).normalize();
    const invQ = this.earthGroup.quaternion.clone().invert();
    (u.uSunObj.value as THREE.Vector3).copy(this.sunDir).applyQuaternion(invQ);

    // ---------- plates ----------
    const Tma = Math.max(0, (2026 - year) / 1e6);
    const rots = plateRotations(Tma);
    const alphas = plateAlpha(Tma);
    const m4 = new THREE.Matrix4();
    for (let k = 0; k < PLATE_COUNT; k++) {
      const q = rots[k];
      m4.makeRotationFromQuaternion(q.clone().invert());
      (u.uPlateM.value as THREE.Matrix3[])[k].setFromMatrix4(m4);
      const info = this.plates[k];
      const c = info.center.clone().applyQuaternion(q);
      (u.uPlateCap.value as THREE.Vector4[])[k].set(c.x, c.y, c.z, info.cosR);
      (u.uPlateA.value as number[])[k] = alphas[k];
    }

    // ---------- era uniforms ----------
    u.uTime.value = tAmb;
    u.uDetach.value = s.detach;
    u.uPlateW.value = s.plateW;
    (u.uProc.value as THREE.Vector4).set(...s.proc);
    (u.uProcCenter.value as THREE.Vector3).set(...s.procCenter).normalize();
    (u.uProcOffset.value as THREE.Vector3).set(...s.procOffset);
    u.uLava.value = s.lava;
    u.uCrust.value = s.crust;
    u.uOcean.value = s.ocean;
    u.uSeaLevel.value = s.seaLevel;
    u.uVeg.value = s.veg;
    u.uArid.value = s.arid;
    u.uIceLat.value = s.iceLat;
    u.uIceAge.value = s.iceAge;
    u.uRedBeds.value = s.redBeds;
    u.uModern.value = s.modern;
    u.uCity.value = s.city;
    (u.uCityGrow.value as THREE.Vector4).set(...s.cityGrow);
    u.uFires.value = s.fires;
    u.uGrassland.value = s.grassland;
    u.uSolar.value = s.solar;
    (u.uOceanDeep.value as THREE.Color).setRGB(...s.oceanDeep);
    (u.uOceanShallow.value as THREE.Color).setRGB(...s.oceanShallow);
    (u.uRock.value as THREE.Color).setRGB(...s.rock);
    (u.uVegColor.value as THREE.Color).setRGB(...s.vegColor);
    (u.uHazeColor.value as THREE.Color).setRGB(...s.hazeColor);
    u.uHaze.value = s.haze;
    (u.uAtmoColor.value as THREE.Color).setRGB(...s.atmoColor);
    u.uAtmo.value = s.atmo;
    u.uScorch.value = s.scorch;
    u.uCloudCover.value = s.cloudCover;
    u.uCloudTime.value = tAmb * 1.0;
    u.uCloudShadow.value = s.ocean > 0 ? 1 : 0;
    const cy = u.uCyclones.value as THREE.Vector4[];
    for (let i = 0; i < 6; i++) {
      const la = (hash(i * 3.1 + 1) - 0.5) * 100, lo = hash(i * 7.7 + 2) * 360;
      const v = dir(la, lo + tAmb * 0.6);
      cy[i].set(v.x, v.y, v.z, (la > 0 ? 1 : -1) * (0.35 + 0.25 * hash(i + 9)) * (s.ocean > 0.5 ? 1 : 0));
    }

    const cu = this.cloudMat.uniforms;
    (cu.uCloudColor.value as THREE.Color).setRGB(...s.cloudColor);
    (cu.uCloudShade.value as THREE.Color).setRGB(...s.cloudShade);
    (cu.uTwilight.value as THREE.Color).setRGB(...s.twilight);
    cu.uStorm.value = s.storm;
    cu.uTime.value = tAmb;
    cu.uCloudAlpha.value = s.cloudCover > 0.02 ? 1 : 0;
    cu.uSoot.value = s.scorch;
    cu.uAurora.value = year > -3.6e9 ? 0.85 : 0;
    this.clouds.visible = s.cloudCover > 0.02 || year > -3.6e9;

    const au = this.atmoMat.uniforms;
    (au.uAtmoColor.value as THREE.Color).setRGB(...s.atmoColor);
    (au.uTwilight.value as THREE.Color).setRGB(...s.twilight);
    au.uAtmo.value = s.atmo;

    // ---------- Moon ----------
    const mAz = (shot.moonAz * Math.PI) / 180, mEl = (shot.moonEl * Math.PI) / 180;
    const md = new THREE.Vector3(Math.sin(mAz) * Math.cos(mEl), Math.sin(mEl), -Math.cos(mAz) * Math.cos(mEl));
    this.moon.position.copy(md.multiplyScalar(s.moonDist));
    this.moon.lookAt(0, 0, 0);
    this.moon.visible = shot.moonVis > 0.5;
    const mu = this.moonMat.uniforms;
    mu.uMaria.value = s.moonMaria;
    mu.uLava.value = s.moonLava;
    mu.uGlow.value = 0;
    this.moon.scale.setScalar(0.2727);
    if (ev.moon.on) {
      if (ev.moon.camRel) ev.moon.pos.set(0, ev.moon.camRel[0], dist - ev.moon.camRel[1]);
      this.moon.position.copy(ev.moon.pos);
      this.moon.lookAt(0, 0, 0);
      this.moon.scale.setScalar(Math.max(0.0001, ev.moon.scale));
      this.moon.visible = ev.moon.scale > 0.003;
      mu.uLava.value = ev.moon.lava;
      mu.uGlow.value = ev.moon.lava * 0.6;
    }
    mu.uCraters.value = s.moonCraters;
    mu.uTime.value = tAmb;
    mu.uBase.value = ev.moonBase;
    (mu.uEarthDir.value as THREE.Vector3).copy(this.moon.position).negate().normalize();

    // ---------- events ----------
    const imp = u.uImpact.value as THREE.Vector4[];
    const impR = u.uImpactR.value as THREE.Vector4[];
    for (let i = 0; i < 4; i++) {
      const e = ev.impacts[i];
      if (e) {
        const d = e.dirW.clone().applyQuaternion(invQ).normalize();
        imp[i].set(d.x, d.y, d.z, e.age);
        impR[i].set(e.crater, e.shock, e.glow, e.flash);
      } else imp[i].w = -1;
    }
    const tp = dir(67.5, 94);
    (u.uTraps.value as THREE.Vector4).set(tp.x, tp.y, tp.z, ev.traps);
    u.uTrapsPlate.value = 5;
    au.uFlash.value = ev.flash * 0.6;
    this.events.update(ev, this.earthGroup.quaternion, this.moon.position, tAmb);

    // ---------- sky ----------
    const sk = this.skyMat.uniforms;
    const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    (sk.uInvViewProj.value as THREE.Matrix4).copy(vp).invert();
    (sk.uCamPos.value as THREE.Vector3).copy(cam.position);
    const sp = cam.position.clone().add(this.sunDir.clone().multiplyScalar(1000)).project(cam);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    sk.uSunVis.value = fwd.dot(this.sunDir) > 0 ? 1 : 0;
    (sk.uSunPx.value as THREE.Vector2).set((sp.x * 0.5 + 0.5) * this.W, (sp.y * 0.5 + 0.5) * this.H);
    sk.uSunR.value = Math.max(2, Math.round(this.H * 0.012 * s.sunScale));
    sk.uTime.value = tAmb;
    this.starMat.uniforms.uTime.value = tAmb;
  }
}

function makeStars(mat: THREE.ShaderMaterial): THREE.Points {
  const N = 5200;
  const pos = new Float32Array(N * 3), size = new Float32Array(N), color = new Float32Array(N * 3), phase = new Float32Array(N);
  const gal = new THREE.Vector3(0.35, 0.8, 0.45).normalize();
  let i = 0, k = 0;
  while (i < N) {
    k++;
    const u = hash(k * 1.37) * 2 - 1, th = hash(k * 2.71 + 0.5) * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const v = new THREE.Vector3(s * Math.cos(th), u, s * Math.sin(th));
    // concentrate part of the stars along the Milky Way
    const g = v.dot(gal);
    const inBand = Math.exp(-g * g * 40);
    if (hash(k * 5.3 + 1.1) > 0.35 + 0.65 * inBand && i > N * 0.45) continue;
    pos.set([v.x * 900, v.y * 900, v.z * 900], i * 3);
    const b = hash(k * 9.1 + 3.3);
    size[i] = b > 0.992 ? 3 : 1;
    const temp = hash(k * 4.4 + 7.7);
    const c = temp < 0.12 ? [1.0, 0.72, 0.52] : temp < 0.3 ? [1.0, 0.9, 0.72] : temp < 0.75 ? [0.95, 0.95, 1.0] : [0.72, 0.82, 1.0];
    const br = size[i] > 2 ? 1 : 0.25 + 0.75 * Math.pow(hash(k * 6.6 + 2.2), 3);
    color.set([c[0] * br, c[1] * br, c[2] * br], i * 3);
    phase[i] = hash(k * 3.9 + 0.7);
    i++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

/** Present-day centre and angular radius of every plate (for fast rejection in the shader). */
export function analyzePlates(data: Uint8ClampedArray, w: number, h: number): PlateInfo[] {
  const sum = Array.from({ length: PLATE_COUNT }, () => new THREE.Vector3());
  const pts: THREE.Vector3[][] = Array.from({ length: PLATE_COUNT }, () => []);
  for (let y = 0; y < h; y += 2) {
    const lat = 90 - ((y + 0.5) / h) * 180;
    for (let x = 0; x < w; x += 2) {
      const id = data[(y * w + x) * 4];
      if (id >= PLATE_COUNT) continue;
      const lon = ((x + 0.5) / w) * 360 - 180;
      const v = dir(lat, lon);
      sum[id].addScaledVector(v, Math.cos((lat * Math.PI) / 180));
      if ((x + y) % 4 === 0) pts[id].push(v);
    }
  }
  return sum.map((s, k) => {
    if (s.lengthSq() === 0) return { center: new THREE.Vector3(0, 1, 0), cosR: 2 };
    const c = s.normalize();
    let minDot = 1;
    for (const v of pts[k]) minDot = Math.min(minDot, v.dot(c));
    const ang = Math.acos(Math.max(-1, minDot)) + 0.06;
    return { center: c, cosR: ang >= Math.PI ? -2 : Math.cos(ang) };
  });
}
