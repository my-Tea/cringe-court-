# Miss Ratio — Phase 3 quality checkpoint

**Status:** **v3 lowkey revision** built and exported. Awaiting approval before scaling the cast.

### v3 lowkey changes
- Slimmer limbs / narrower coat / smaller head (~36u tall vs ~40u).
- Muted burgundy + softer gold (less contrast scream).
- Thinner asymmetric lock and quieter coat-tails.
- Point / objection restrained (firm, not crash-out).
- Idle is a soft breath loop only.

## Capability audit (verified)

| Capability | Result |
|---|---|
| Blockbench | 5.1.6 desktop |
| MCP | 1.10.1 at `http://localhost:3000/bb-mcp` |
| Project format | `free` (Generic Model) — animation_mode + meshes + bone_rig |
| Cubes / groups | yes (`place_cube`, `add_group`) |
| Meshes / spheres | yes (`place_mesh`, `create_sphere`) |
| Textures | yes (`create_texture`) |
| Animations + keyframes | yes (`create_animation`, `manage_keyframes`, `animation_timeline`) |
| Save `.bbmodel` | yes (`export_model` codec `project`) |
| Export GLB with clips | yes (`export_model` codec `gltf`, `animations: true`) |
| Reference images at `docs/art/references/cringecourt_isometric_*.png` | **not found** — used `cc-art/dist/CHARACTER-DESIGN-BIBLE.md` + style guide |

Roam renderer remains Three.js (`packages/scene/src/roam/three/renderer.ts`). Blockbench is offline authoring only.

## Delivered files

| Path | Role |
|---|---|
| `packages/scene/assets/roam/heroes/prosecutor/hero.bbmodel` | Editable source |
| `packages/scene/assets/roam/heroes/prosecutor/hero.glb` | Game export (~107 KB) |
| `packages/scene/assets/roam/heroes/prosecutor/manifest.json` | Clip map + metadata |
| `.bbshots/heroes/miss-ratio-*.png` | Front / side / ¾ / iso + anim peaks |
| `tools/bbmcp/build-miss-ratio.ts` | Rebuild script |
| `tools/bbmcp/validate-hero-glb.mjs` | Headless GLB clip check |

## Clips verified in GLB

Parsed from the GLB JSON chunk and smoke-played with `THREE.AnimationMixer`:

| Export name | Channels | Duration |
|---|---:|---:|
| `animation.prosecutor_idle` | 8 | 2.0s (loop) |
| `animation.prosecutor_talk` | 4 | 1.2s (loop) |
| `animation.prosecutor_point` | 9 | 1.35s |
| `animation.prosecutor_objection` | 10 | 1.45s |

All four have nonzero duration and multi-keyframe transform tracks.

## What’s good

- Real editable hierarchy (hips → torso → head / arms / legs / hairLock / coatTail / folder).
- Sphere head mesh (not only a cube).
- Burgundy / charcoal / ivory / gold palette matches the design bible.
- Asymmetric hair lock + coat-tails + evidence folder present.
- Signature clips authored and exported, not static renders pretending to be animation.

## Remaining visible problems (honest)

1. **Still too cuboid / Minecraft-adjacent** for the “polished isometric indie” brief — limbs and coat are panels, not sculpted meshes.
2. **Point / objection timing** reads mechanical from orthographic/side captures; needs polish passes on anticipation and finger readability.
3. **No painted UV detail** yet — flat fill textures only.
4. **Not wired into roam `HeroAvatar` mixer yet** — courtroom still uses procedural Three.js heroes until this style is approved.
5. Supplied isometric reference PNGs were missing from the repo; identity comes from the written bible.

## Ask before Phase 4–7

Approve or reject this Miss Ratio look:

- **Approve** → complete remaining prosecutor clips, then Chaos / Judge / Clerk in the same language, then Three.js mixer integration.
- **Reject / revise** → specify what to change (more mesh sculpting, softer proportions, different hair volume, painted textures, etc.) before we scale the cast.

Do not build twelve characters on an unapproved silhouette.
