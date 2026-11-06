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
import { allKeys, en, t, type MessageKey } from '@/i18n';

export interface WebModeModule {
  /** The mode's rules (from packages/modes-<mode>, or a core BASE_MODES entry). */
  definition: ModeDefinition;
  /** Child routes under `/<mode id>/`. */
  routes?: RouteObject[];
  /**
   * The landing page's primary call to action, once the mode is playable. A
   * `label` is either a catalog key (preferred; translated when shown) or plain
   * text. Render it through `resolveModeLabel`.
   */
  landing?: { label: string; to: string; secondary?: { label: string; to: string } };
  /** Where a player finds their own cases in this mode (the lobby's "Your cases" row). */
  docket?: { label: string; to: string };
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

let catalogKeys: ReadonlySet<string> | undefined;

/** Translates a mode-module label: a catalog key is looked up, anything else is shown as written. */
export function resolveModeLabel(label: MessageKey | (string & {})): string {
  catalogKeys ??= new Set<string>(allKeys(en));
  return catalogKeys.has(label) ? t(label as MessageKey) : label;
}
