/**
 * @cringe-court/scene/iso/three — the isometric town's three.js renderer.
 * Separate from `iso/index` so headless consumers never load three.
 */
export { IsoRenderer, TOWN_MOODS, batchWorld, drawOrderOf, type IsoRendererOptions, type WorldBatch } from './renderer';
