/**
 * @cringe-court/scene/iso — the explorable isometric town (headless part).
 *
 * The React component lives in `@cringe-court/scene/iso/react`. Everything here
 * runs in node: the maps, the collision, the camera rig, the conversation graph.
 * The three.js renderer is exported separately so a test never pays for WebGL.
 */
export * from './world';
export * from './library';
export * from './physics';
export * from './camera';
export * from './dialogue';
export * from './controller';
export * from './trial';
export * from './maps/town';
export * from './maps/dialogue';
export { bbmodelToBoxes, placeBoxes, rotatedBounds, colourOf, groupMap, BbModelError, type ConvertOptions, type ConvertResult, type RawModel } from './bbmodel';
export { loadTownData, type TownData } from './load';
