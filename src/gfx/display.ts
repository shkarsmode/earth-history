// Low-resolution pixel pipeline.
// Everything is rendered at a small internal resolution (≈480×270) and the canvas is scaled up by an
// integer factor in *device* pixels with nearest-neighbour sampling, so every art pixel is a crisp square.
import * as THREE from 'three';
import { PixBuf } from './pixbuf';

const COMP_VS = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const COMP_FS = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform sampler2D tDio;
uniform sampler2D tOver;
uniform float uMix;       // 0 = 3D scene, 1 = surface diorama (ordered-dither dissolve)
uniform float uFade;      // dissolve to uFadeColor (flashes, fades)
uniform vec3 uFadeColor;
uniform vec2 uSize;
out highp vec4 fragColor;

// 8x8 Bayer threshold: bit-reverse(interleave(x^y, y)) / 64
float bayer8(vec2 p) {
  int x = int(p.x) & 7, y = int(p.y) & 7;
  int xy = x ^ y;
  int v = ((xy & 1) << 5) | ((y & 1) << 4) | ((xy & 2) << 2) | ((y & 2) << 1) | ((xy & 4) >> 1) | ((y & 4) >> 2);
  return (float(v) + 0.5) / 64.0;
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 pf = ivec2(p.x, int(uSize.y) - 1 - p.y);
  vec3 c = texelFetch(tScene, p, 0).rgb;
  if (uMix > 0.0) {
    vec3 d = texelFetch(tDio, pf, 0).rgb;
    c = (uMix > bayer8(gl_FragCoord.xy)) ? d : c;
  }
  if (uFade > 0.0) {
    if (uFade > bayer8(gl_FragCoord.xy + vec2(3.0, 5.0))) c = uFadeColor;
  }
  vec4 o = texelFetch(tOver, pf, 0);
  c = mix(c, o.rgb, o.a);
  fragColor = vec4(c, 1.0);
}
`;

export class Display {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  w = 0;
  h = 0;
  scale = 1;
  dpr = 1;
  overlay!: PixBuf;
  overlayTex!: THREE.DataTexture;
  dio!: PixBuf;
  dioTex!: THREE.DataTexture;
  sceneRT!: THREE.WebGLRenderTarget;
  forced: { w: number; h: number; scale: number } | null = null;
  readonly comp: THREE.ShaderMaterial;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // raw output: palettes are authored in sRGB
    this.comp = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: COMP_VS,
      fragmentShader: COMP_FS,
      uniforms: {
        tScene: { value: null },
        tDio: { value: null },
        tOver: { value: null },
        uMix: { value: 0 },
        uFade: { value: 0 },
        uFadeColor: { value: new THREE.Color(1, 1, 1) },
        uSize: { value: new THREE.Vector2(1, 1) },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.comp);
    quad.frustumCulled = false;
    this.quadScene.add(quad);
    this.layout();
  }

  /** Recompute the internal resolution. Returns true when it changed (buffers were recreated). */
  layout(): boolean {
    const dpr = window.devicePixelRatio || 1;
    let w: number, h: number, scale: number;
    if (this.forced) {
      ({ w, h, scale } = this.forced);
    } else {
      const devW = Math.max(1, Math.round(window.innerWidth * dpr));
      const devH = Math.max(1, Math.round(window.innerHeight * dpr));
      scale = Math.max(1, Math.floor(devH / 240));
      // keep at least ~300 art pixels across on narrow windows
      while (scale > 1 && Math.floor(devW / scale) < 300) scale--;
      w = Math.floor(devW / scale);
      h = Math.floor(devH / scale);
    }
    const changed = w !== this.w || h !== this.h || scale !== this.scale || dpr !== this.dpr;
    this.dpr = dpr;
    this.scale = scale;
    // CSS size so that one art pixel == `scale` device pixels exactly
    this.canvas.style.width = `${(w * scale) / dpr}px`;
    this.canvas.style.height = `${(h * scale) / dpr}px`;
    if (!changed) return false;
    this.w = w;
    this.h = h;
    this.renderer.setSize(w, h, false);
    this.sceneRT?.dispose();
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false,
      generateMipmaps: false,
    });
    this.overlay = new PixBuf(w, h);
    this.dio = new PixBuf(w, h);
    this.overlayTex?.dispose();
    this.dioTex?.dispose();
    this.overlayTex = makeTex(this.overlay);
    this.dioTex = makeTex(this.dio);
    const u = this.comp.uniforms;
    u.tScene.value = this.sceneRT.texture;
    u.tDio.value = this.dioTex;
    u.tOver.value = this.overlayTex;
    u.uSize.value.set(w, h);
    return true;
  }

  renderScene(scene: THREE.Scene, camera: THREE.Camera) {
    this.renderer.setRenderTarget(this.sceneRT);
    this.renderer.render(scene, camera);
  }

  present(mix: number, fade = 0, fadeColor?: [number, number, number]) {
    const u = this.comp.uniforms;
    u.uMix.value = mix;
    u.uFade.value = fade;
    if (fadeColor) u.uFadeColor.value.setRGB(fadeColor[0], fadeColor[1], fadeColor[2]);
    this.overlayTex.needsUpdate = true;
    if (mix > 0) this.dioTex.needsUpdate = true;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.quadScene, this.quadCam);
  }

  /** Upscale the current frame by an integer factor and POST it to the dev server (.snaps/<name>.png). */
  async snap(name: string, scale = 3): Promise<string> {
    const c2 = document.createElement('canvas');
    c2.width = this.w * scale;
    c2.height = this.h * scale;
    const ctx = c2.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.canvas, 0, 0, c2.width, c2.height);
    const blob = await new Promise<Blob>((res) => c2.toBlob((b) => res(b!), 'image/png'));
    const r = await fetch('/__snap?name=' + encodeURIComponent(name), { method: 'POST', body: blob });
    return r.text();
  }
}

function makeTex(buf: PixBuf): THREE.DataTexture {
  const t = new THREE.DataTexture(buf.data, buf.w, buf.h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}
