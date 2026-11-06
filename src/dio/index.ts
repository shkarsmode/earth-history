// Registry of surface dioramas by id (chapters reference them in `dio`).
import type { PixBuf } from '../gfx/pixbuf';
import * as deep from './scenesDeep';
import type { Ctx } from './scenesDeep';

export type Scene = (b: PixBuf, t: number, c: Ctx) => void;

const mods = import.meta.glob(['./scenesLife.ts', './scenesHuman.ts'], { eager: true }) as Record<string, Record<string, unknown>>;

export const SCENES: Record<string, Scene> = {
  magma: deep.magma,
  vent: deep.vent,
  stromatolites: deep.stromatolites,
  snowball: deep.snowball,
  ediacara: deep.ediacara,
  cambrian: deep.cambrian,
};
for (const m of Object.values(mods)) for (const [k, v] of Object.entries(m)) if (typeof v === 'function') SCENES[k] = v as Scene;

export type { Ctx };
