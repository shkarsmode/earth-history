import * as THREE from 'three';
import '@fontsource/press-start-2p/cyrillic.css';
import '@fontsource/press-start-2p/latin.css';
import { Display } from './gfx/display';
import { buildFont } from './gfx/font';
import { PlanetScene, analyzePlates } from './planet/planetScene';
import { EARTH_FS } from './planet/earthShader';
import { Director, SPEEDS } from './core/director';
import { Hud } from './hud/hud';
import { planetAt } from './story/planetState';
import { hex } from './gfx/pixbuf';
import { emptyEvents } from './planet/events';
import { applyFx } from './story/fx';
import { SCENES } from './dio';
import { smooth } from './core/hash';
import { drawGeo } from './hud/geo';
import { dir } from './story/plates';
import { Soundtrack } from './core/audio';

THREE.ColorManagement.enabled = false;

async function loadTex(url: string, mip: boolean): Promise<THREE.Texture> {
  const t = await new THREE.TextureLoader().loadAsync(url);
  t.flipY = false;
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.generateMipmaps = mip;
  t.anisotropy = mip ? 4 : 1;
  t.needsUpdate = true;
  return t;
}

/** City lights → single-channel intensity texture, so mip levels average lights instead of cancelling them. */
function lightsTexture(img: HTMLImageElement): THREE.DataTexture {
  const px = imagePixels(img);
  const n = img.width * img.height;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    // lights are grey-white (~110-125) over a dark-blue base whose red channel stays below ~25
    const r = px[i * 4];
    const v = (r - 22) * 2.6;
    out[i] = v <= 0 ? 0 : v >= 255 ? 255 : v;
  }
  const t = new THREE.DataTexture(out, img.width, img.height, THREE.RedFormat, THREE.UnsignedByteType);
  t.wrapS = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}

function imagePixels(img: HTMLImageElement | ImageBitmap): Uint8ClampedArray {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img as CanvasImageSource, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height).data;
}

async function boot() {
  const canvas = document.getElementById('screen') as HTMLCanvasElement;
  const display = new Display(canvas);
  const font = await buildFont('Press Start 2P', 8, { lineHeight: 11 });
  const [plates, day, nightImg, topo] = await Promise.all([
    loadTex('/tex/plates.png', false),
    loadTex('/tex/earth-bm.jpg', true),
    loadTex('/tex/earth-night.jpg', true),
    loadTex('/tex/earth-topo.png', true),
  ]);
  const night = lightsTexture(nightImg.image as HTMLImageElement);
  nightImg.dispose();
  const pimg = plates.image as HTMLImageElement;
  const plateInfo = analyzePlates(imagePixels(pimg), pimg.width, pimg.height);
  const planet = new PlanetScene({ plates, day, night, topo }, plateInfo);
  const director = new Director();
  const hud = new Hud(font);
  const sound = new Soundtrack();

  // ---------- map view (debug: flat palaeogeography) ----------
  const mapScene = new THREE.Scene();
  const mapCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mapMat = planet.earthMat.clone();
  mapMat.uniforms = planet.earthMat.uniforms; // share all era uniforms
  mapMat.vertexShader = /* glsl */ `
    out vec3 vObj; out vec3 vWorldN; out vec3 vWorldP;
    void main() {
      vec2 ll = vec2((uv.x - 0.5) * 6.2831853, (uv.y - 0.5) * 3.14159265);
      vObj = vec3(cos(ll.y) * sin(ll.x), sin(ll.y), cos(ll.y) * cos(ll.x));
      vWorldN = vObj; vWorldP = vObj * 2.0;
      gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
    }`;
  mapMat.fragmentShader = EARTH_FS;
  const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2, 360, 180), mapMat);
  mapMesh.frustumCulled = false;
  mapScene.add(mapMesh);

  let mapMode: number | null = null;

  // free look: drag rotates the planet, wheel zooms; eases back to the film camera while playing
  const look = { lon: 0, lat: 0, zoom: 1, downX: 0, downY: 0, down: false, moved: false };

  let lastDioAmb = -1;
  function renderFrame(forceDio = true) {
    if (display.layout()) planet.setSize(display.w, display.h);
    const year = director.year();
    const s = planetAt(mapMode !== null ? 2026 - mapMode * 1e6 : year);
    const shot = director.shot();
    shot.lon += look.lon;
    shot.lat = Math.max(-85, Math.min(85, shot.lat + look.lat));
    shot.rh *= look.zoom;
    const ev = emptyEvents();
    const where = director.locate();
    if (mapMode === null) applyFx(where, year, s, shot, ev, director.amb);
    // surface diorama window: dither-dissolve, with a "dive" zoom into the planet before it
    let mix = 0;
    const dio = where.ch.dio;
    if (mapMode === null && dio && SCENES[dio.id]) {
      const tA = dio.a * where.ch.dur, tB = dio.b * where.ch.dur;
      const tl = where.tl;
      mix = smooth((tl - tA) / 1.2) * (dio.b >= 1 ? 1 - smooth((tl - (where.ch.dur - 1.0)) / 1.0) : 1 - smooth((tl - (tB - 1.2)) / 1.2));
      const special = shot.fov < 12; // long-lens shots (Earthrise) keep their framing
      if (special) { /* no dive zoom */ }
      else if (tl < tA + 1.2) shot.rh *= 1 + 1.8 * smooth((tl - (tA - 2.4)) / 2.4);
      else if (dio.b < 1 && tl > tB - 1.2) shot.rh *= 1 + 1.8 * (1 - smooth((tl - (tB - 1.2)) / 2.4));
      // dioramas are drawn on the CPU: cap them at 30 fps (pixel art does not need more)
      if (mix > 0 && (forceDio || Math.abs(director.amb - lastDioAmb) >= 1 / 30 - 1e-4)) {
        SCENES[dio.id](display.dio, Math.max(0, tl - tA + 1.2), { amb: director.amb, year, u: where.u });
        lastDioAmb = director.amb;
      }
    }
    planet.update(s, shot, mapMode !== null ? 2026 - mapMode * 1e6 : year, director.amb, ev);
    if (mapMode !== null) {
      planet.earthMat.uniforms.uFlat.value = 1;
      planet.earthMat.uniforms.uCloudShadow.value = 0;
      display.renderScene(mapScene, mapCam);
      planet.earthMat.uniforms.uFlat.value = 0;
      const o = display.overlay;
      o.clear(0);
      const grid = hex('#ffffff', 90);
      for (let la = -60; la <= 60; la += 30) { const y = Math.round(((90 - la) / 180) * display.h); for (let x = 0; x < display.w; x += 2) o.set(x, y, grid); }
      for (let lo = -150; lo <= 150; lo += 30) { const x = Math.round(((lo + 180) / 360) * display.w); for (let y = 0; y < display.h; y += 2) o.set(x, y, grid); }
      font.drawOutlined(o, `${mapMode} МЛН ЛЕТ НАЗАД`, 6, 12, hex('#ffffff'), hex('#000000'));
      display.present(0);
      return;
    }
    display.renderScene(planet.scene, planet.camera);
    hud.draw(display.overlay, director, performance.now() / 1000);
    if (!hud.hideUi) {
      const q = planet.earthGroup.quaternion, cam = planet.camera, W = display.w, H = display.h;
      drawGeo(display.overlay, font, (lat, lon) => {
        const p = dir(lat, lon).applyQuaternion(q);
        const vis = p.dot(cam.position.clone().sub(p).normalize());
        const s = p.clone().project(cam);
        return { x: (s.x * 0.5 + 0.5) * W, y: (0.5 - s.y * 0.5) * H, vis };
      }, year, where.ch.id, 1 - mix, director.amb);
    }
    hud.soundOn = sound.enabled;
    sound.update(director, dio ? dio.id : null, mix);
    display.present(mix, ev.flash, ev.flashColor);
  }

  // ---------- input ----------
  const toInternal = (e: PointerEvent | MouseEvent) => {
    const r = canvas.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) / r.width) * display.w), Math.floor(((e.clientY - r.top) / r.height) * display.h)];
  };
  canvas.addEventListener('pointermove', (e) => {
    const [x, y] = toInternal(e);
    hud.mouseX = x; hud.mouseY = y; hud.lastMove = performance.now() / 1000;
    if (hud.dragging) director.seek(hud.timeAt(director, display.w, x));
    else if (look.down) {
      const dx = x - look.downX, dy = y - look.downY;
      if (Math.abs(dx) + Math.abs(dy) > 3) look.moved = true;
      if (look.moved) {
        look.lon -= dx * 0.6; look.lat += dy * 0.5;
        look.lat = Math.max(-80, Math.min(80, look.lat));
        look.downX = x; look.downY = y;
      }
    }
  });
  canvas.addEventListener('wheel', (e) => {
    look.zoom = Math.max(0.45, Math.min(5, look.zoom * Math.exp(-e.deltaY * 0.0012)));
    hud.lastMove = performance.now() / 1000;
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = toInternal(e);
    hud.lastMove = performance.now() / 1000;
    const h = hud.hit(director, display.w, display.h, x, y);
    if (!h) return;
    if (h.kind === 'play') director.playing = !director.playing;
    else if (h.kind === 'slower') director.speedIdx = Math.max(0, director.speedIdx - 1);
    else if (h.kind === 'faster') director.speedIdx = Math.min(SPEEDS.length - 1, director.speedIdx + 1);
    else if (h.kind === 'sound') sound.toggle();
    else if (h.kind === 'seek') { hud.dragging = true; director.seek(h.t); canvas.setPointerCapture(e.pointerId); }
    else if (h.kind === 'scene') { look.down = true; look.moved = false; look.downX = x; look.downY = y; canvas.setPointerCapture(e.pointerId); }
  });
  canvas.addEventListener('pointerup', () => {
    if (look.down && !look.moved) director.playing = !director.playing; // a click (not a drag) toggles pause
    look.down = false;
    hud.dragging = false;
  });
  canvas.addEventListener('dblclick', () => { look.lon = 0; look.lat = 0; look.zoom = 1; });
  canvas.addEventListener('pointerleave', () => { hud.mouseX = -1; hud.mouseY = -1; });
  window.addEventListener('keydown', (e) => {
    hud.lastMove = performance.now() / 1000;
    switch (e.code) {
      case 'Space': director.playing = !director.playing; if (director.t >= director.total) director.t = 0; e.preventDefault(); break;
      case 'ArrowRight': director.nextChapter(1); break;
      case 'ArrowLeft': director.nextChapter(-1); break;
      case 'ArrowUp': case 'Equal': case 'NumpadAdd': director.speedIdx = Math.min(SPEEDS.length - 1, director.speedIdx + 1); break;
      case 'ArrowDown': case 'Minus': case 'NumpadSubtract': director.speedIdx = Math.max(0, director.speedIdx - 1); break;
      case 'Home': director.seek(0); break;
      case 'KeyH': hud.hideUi = !hud.hideUi; break;
      case 'KeyM': sound.toggle(); break;
      case 'KeyF': if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); break;
    }
  });

  // ---------- loop ----------
  let last = performance.now();
  function loop(now: number) {
    const dt = (now - last) / 1000;
    director.tick(dt);
    if (director.playing && !look.down) {
      const k = Math.exp(-Math.min(dt, 0.1) * 0.8);
      look.lon *= k; look.lat *= k; look.zoom = 1 + (look.zoom - 1) * k;
    }
    last = now;
    renderFrame(false);
    requestAnimationFrame(loop);
  }
  document.getElementById('boot')?.remove();
  requestAnimationFrame((n) => { last = n; loop(n); });

  // ---------- debug hook (works even when rAF is throttled: set time, render, snapshot) ----------
  const api = {
    director, display, planet, hud, scenes: SCENES,
    /** jump to chapter (index or id) at local progress u, pause, and render */
    at(ch: number | string, u = 0.5, amb?: number) {
      const ci = typeof ch === 'number' ? ch : director.chapters.findIndex((c) => c.id === ch);
      if (ci < 0) throw new Error('no chapter ' + ch);
      director.t = director.starts[ci] + director.chapters[ci].dur * u;
      director.playing = false;
      if (amb !== undefined) director.amb = amb;
      mapMode = null;
      renderFrame();
      return { ci, id: director.chapters[ci].id, year: director.year(), t: director.t };
    },
    seek(t: number) { director.seek(t); renderFrame(); },
    render() { renderFrame(); },
    map(ma: number) { mapMode = ma; renderFrame(); },
    noMap() { mapMode = null; renderFrame(); },
    force(w: number, h: number) { display.forced = { w, h, scale: 1 }; renderFrame(); },
    unforce() { display.forced = null; renderFrame(); },
    snap(name: string, scale = 3) { return display.snap(name, scale); },
    chapters() { return director.chapters.map((c, i) => `${i}:${c.id}`).join(' '); },
  };
  (window as any).__earth = api;
}

boot().catch((e) => {
  console.error(e);
  const b = document.getElementById('boot');
  if (b) b.textContent = 'Ошибка: ' + (e?.message ?? e);
});
