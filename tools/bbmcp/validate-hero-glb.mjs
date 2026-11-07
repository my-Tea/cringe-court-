/**
 * Headless GLB smoke test for hero exports (Node + three GLTFLoader).
 *   node tools/bbmcp/validate-hero-glb.mjs [path/to/hero.glb]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// GLTFLoader expects a browser-like URL/self in texture decode.
globalThis.self ??= globalThis;
if (!globalThis.URL) globalThis.URL = URL;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const file = path.resolve(process.argv[2] ?? path.join(root, 'packages/scene/assets/roam/heroes/prosecutor/hero.glb'));
const buf = fs.readFileSync(file);
const loader = new GLTFLoader();
const gltf = await new Promise((res, rej) => {
  loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej);
});

const box = new THREE.Box3().setFromObject(gltf.scene);
const size = box.getSize(new THREE.Vector3());
const clips = gltf.animations.map((a) => ({
  name: a.name,
  duration: +a.duration.toFixed(3),
  tracks: a.tracks.length,
  hasMotion: a.tracks.some((t) => t.times.length > 1 && t.values.some((v, i, arr) => i > 2 && Math.abs(v - arr[i - 3]) > 1e-5)),
}));

const mixer = new THREE.AnimationMixer(gltf.scene);
for (const clip of gltf.animations) {
  const action = mixer.clipAction(clip);
  action.play();
  mixer.update(Math.max(0.01, clip.duration * 0.5));
  action.stop();
}

const report = {
  file,
  bytes: buf.length,
  nodes: (() => {
    let n = 0;
    gltf.scene.traverse(() => n++);
    return n;
  })(),
  size: { x: +size.x.toFixed(2), y: +size.y.toFixed(2), z: +size.z.toFixed(2) },
  animations: clips,
};
console.log(JSON.stringify(report, null, 2));
if (!clips.length) throw new Error('GLB has no animations');
if (clips.some((c) => !c.hasMotion || c.duration <= 0)) throw new Error('one or more clips lack motion');
console.error('# validate ok');
