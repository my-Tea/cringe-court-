# Blockbench MCP setup — CringeCourt

**Status: Blockbench 5.1.6 is already installed on your machine** (`blockbench` is
on PATH, verified). What remains is the part I cannot do from here — loading the
plugin, which needs mouse clicks in the GUI.

Why Blockbench for CringeCourt specifically: your courtroom reference is
high-density **voxel 3D**, not 2D sprites. Blockbench is the strongest free voxel
modeller, and its MCP plugin exposes ~65 tools including `place_cube`,
`extrude_mesh`, `set_cube_uv`, `export_model` and — critically —
`capture_screenshot`, which lets me *see* what I built and iterate.

---

## Why I could not finish this myself

Two blockers, both verified:

1. **No GUI access in my session.** `DISPLAY` is unset; the X0 socket rejects me
   with `Authorization required, but no authorization protocol specified`.
   Loading a Blockbench plugin requires `File → Plugins → Load Plugin from URL`.
   There is no CLI equivalent.
2. **AutoClaw has no custom-MCP registration path.** I read the app's own
   `main.cjs` and renderer bundles. MCP appears only inside the bundled vendor SDK
   (an MCP client class, `agent.mcp_tool_use` events) — there is no `mcpServers`
   config file and no "add MCP server" UI, only a curated `connectorCenter` of
   first-party connectors. So even with the server running, I have nowhere to
   register it from inside this app.

**Nothing is broken — this is just a click-only step.** Follow the steps below;
then the server is up and any MCP-capable client (Claude Code, Cursor, VS Code,
Cline) can drive it. Whether this AutoClaw build can reach it locally is
**unverified** — I'm not going to claim it works when I can't test the client side.

---

## What it gives you

The plugin exposes ~65 tools. The ones that matter for CringeCourt:

| Tool group | Tools | Why you care |
|---|---|---|
| **Cubes / blocks** | `place_cube`, `modify_cube`, `add_group`, `slice_cubes_to_block_grid`, `inspect_block_bounds` | Build voxel characters and props to an exact grid |
| **UV + textures** | `get_cube_uv`, `set_cube_uv`, `create_texture`, `apply_texture`, `auto_uv_mesh` | Applies Sprite Forge's 16×16 tiles onto models, correctly unwrapped |
| **Meshes** | `place_mesh`, `extrude_mesh`, `loop_cut_mesh`, `move_mesh_vertices`, `subdivide_mesh` | The non-cube detail that separates your look from plain Minecraft |
| **Export** | `export_model`, `list_export_formats`, `geckolib_export_model` | GLB / Minecraft JSON, straight into Three.js or Unity |
| **Animation** | `create_animation`, `animation_timeline`, `geckolib_export_animations` | Block-break, item swing, mob idle |
| **Feedback loop** | `capture_screenshot`, `capture_app_screenshot` | I can see the result and fix it without you describing it to me |

`capture_screenshot` is the whole reason to bother. Without it I'm modelling blind.

---

## Install

### 1. Get Blockbench

**Already done** — I installed it:

```bash
blockbench --version   # 5.1.6, verified on your PATH
```

> Use the **desktop** app. The MCP server does not exist in the web version.

### 2. Install the MCP plugin inside Blockbench

1. Open Blockbench → **File → Plugins**
2. Click **Load Plugin from URL**
3. Paste exactly:
   ```
   https://jasonjgardner.github.io/blockbench-mcp-plugin/mcp.js
   ```
4. Restart Blockbench when prompted.

### 3. Confirm the server is up

Blockbench → **Settings → General**. Two fields:
- **MCP Server Port** — default `3000`
- **MCP Server Endpoint** — default `bb-mcp`

So the full URL is `http://localhost:3000/bb-mcp`. Leave both at default unless
port 3000 is already taken on your machine.

Sanity check from a terminal:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/bb-mcp
```
Anything other than `000` (connection refused) means it's listening.

### 4. Connect it to me

Because the server is plain HTTP on localhost, it needs a stdio bridge. The
verified bridge is `mcp-remote` (confirmed working here):

```json
{
  "mcpServers": {
    "blockbench": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3000/bb-mcp"]
    }
  }
}
```

Most clients accept a direct HTTP entry instead, which is cleaner:

```json
{
  "mcpServers": {
    "blockbench": {
      "url": "http://localhost:3000/bb-mcp",
      "type": "http"
    }
  }
}
```

Where that JSON goes depends on the client — check your client's MCP settings page
and paste the matching form. Then restart the client (or use its "reload MCP"
action) and confirm `blockbench` appears in the server list with tools listed.

**Order matters:** Blockbench must be *running* with the plugin loaded before the
client connects, or the connection fails and you'll need to reconnect after
starting it.

---

## Honest limits

- **It does not draw pixel art.** Blockbench textures are painted by hand or
  produced by Sprite Forge. That division is the point: Sprite Forge makes the
  tiles and portraits, Blockbench puts them on voxel models and exports them.
- **Blockbench alone won't give you the reference look.** Your courtroom ref has
  smooth PBR shading, bloom, volumetric spotlights and depth of field. Those are
  *renderer* features (Three.js post-processing), not model features. Modelling
  gets you silhouettes; the lighting rig is what sells it.
- **Screenshots are the feedback loop.** If `capture_screenshot` fails, tell me —
  modelling without visual confirmation degrades fast.
- Not affiliated with Mojang. Blockbench is an independent, free tool.

---

## If you want a second opinion on style

The `pixel-art-sprites` skill (already installed globally at
`~/.agents/skills/pixel-art-sprites/`) carries the craft rules — hue-shifted
ramps, silhouette-first design, why 4 frames beat 8. Read it for direction; use
Sprite Forge for the actual pixels. They're complementary, not competing.
