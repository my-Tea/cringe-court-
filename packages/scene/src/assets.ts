/**
 * Asset URLs. `new URL(…, import.meta.url)` lets Vite fingerprint and emit the
 * files (no copies of cc-art output), and works as file:// URLs under node.
 * The JSON files are fetched at runtime so the 95 KB box list never weighs on the
 * main bundle.
 */
export const COURTROOM_URLS = {
  boxes: new URL('../../../cc-art/dist/scene/courtroom.boxes.json', import.meta.url).href,
  layout: new URL('../../../cc-art/dist/scene/courtroom.layout.json', import.meta.url).href,
  animations: new URL('../../../cc-art/dist/animation/animations.json', import.meta.url).href,
  atlas: new URL('../assets/atlas/atlas.json', import.meta.url).href,
} as const;

// One literal per file so bundlers can see every asset.
export const ATLAS_IMAGE_URLS: Readonly<Record<string, string>> = {
  judge: new URL('../assets/atlas/judge.png', import.meta.url).href,
  prosecutor: new URL('../assets/atlas/prosecutor.png', import.meta.url).href,
  defense: new URL('../assets/atlas/defense.png', import.meta.url).href,
  bailiff: new URL('../assets/atlas/bailiff.png', import.meta.url).href,
  clerk: new URL('../assets/atlas/clerk.png', import.meta.url).href,
  juror: new URL('../assets/atlas/juror.png', import.meta.url).href,
  creator: new URL('../assets/atlas/creator.png', import.meta.url).href,
  'side-a': new URL('../assets/atlas/side-a.png', import.meta.url).href,
  'side-b': new URL('../assets/atlas/side-b.png', import.meta.url).href,
  'ai-narrator': new URL('../assets/atlas/ai-narrator.png', import.meta.url).href,
};
