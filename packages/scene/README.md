# @cringe-court/scene

The voxel courtroom: `animations.json` parser, sampler and per-character
animator, system timelines, merged-by-material room geometry, per-character
sprite atlases, and a three.js runtime that implements `ScenePort`
(`asScenePort(runtime)`). React apps render it with `<Courtroom/>` and load it
with `useCourtroom()` from `@cringe-court/scene/react`.

```bash
npm run atlas            # regenerate assets/atlas/* from cc-art/dist/characters/*/poses
npm run atlas -- --check # fail if the committed atlases are stale (part of npm run check)
```

Design notes, rules and what is not verified: [`docs/ENGINE.md`](../../docs/ENGINE.md) §6–7.
