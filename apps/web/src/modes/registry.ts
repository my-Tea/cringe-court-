/**
 * Web mode registry. Each mode track adds one folder, `src/modes/<mode>/`, with a
 * `mode.ts` (or `mode.tsx`) whose default export is a `WebModeModule`. This file
 * discovers them at build time, so adding a mode never edits shared files.
 *
 *   // src/modes/solo/mode.tsx
 *   import { soloMode } from '@cringe-court/modes-solo';
 *   const mode: WebModeModule = { definition: soloMode, routes: [{ path: 'play', lazy: () => import('./SoloPlay') }] };
 *   export default mode;
 *
 * Routes are mounted under `/<mode id>/` (e.g. `/solo/play`), beside the mode's
 * landing page.
 */
import { createModeRegistry, type ModeDefinition, type ModeId, type ModeRegistry } from '@cringe-court/core';
import type { RouteObject } from 'react-router';

export interface WebModeModule {
  /** The mode's rules (from packages/modes-<mode>, or a core BASE_MODES entry). */
  definition: ModeDefinition;
  /** Child routes under `/<mode id>/`. */
  routes?: RouteObject[];
}

const discovered = import.meta.glob<WebModeModule>('./*/mode.{ts,tsx}', { eager: true, import: 'default' });

export function loadWebModes(files: Record<string, WebModeModule> = discovered): {
  registry: ModeRegistry;
  modules: ReadonlyMap<ModeId, WebModeModule>;
} {
  const registry = createModeRegistry();
  const modules = new Map<ModeId, WebModeModule>();
  for (const [path, mod] of Object.entries(files)) {
    const folder = path.split('/')[1];
    if (!mod?.definition) throw new Error(`${path}: default export must be a WebModeModule`);
    if (folder !== mod.definition.id) throw new Error(`${path}: folder must be named after the mode id "${mod.definition.id}"`);
    if (modules.has(mod.definition.id)) throw new Error(`Mode ${mod.definition.id} is registered twice`);
    registry.register(mod.definition, { replace: true });
    modules.set(mod.definition.id, mod);
  }
  return { registry, modules };
}

export const { registry: modeRegistry, modules: webModes } = loadWebModes();

/** Child routes every registered mode contributes, keyed by mode path. */
export function modeChildRoutes(id: ModeId): RouteObject[] {
  return webModes.get(id)?.routes ?? [];
}
