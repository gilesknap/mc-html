# Voxel Craft — Handoff Document

## What This Is
A single-file HTML Minecraft-style voxel game at `/workspaces/mc-html-home/index.html` (~1324 lines).
Three.js r128 from CDN, vanilla JS, no build tools, no external assets. All textures/procedural.

## Test Harness (reuse after any logic change)
`/tmp/vm_test.js` — Node `vm` harness with permissive THREE/DOM Proxy stubs (scene-graph tracking for
Group.add/traverse + isMesh). Loads the REAL game script and runs 13 assertions: inventory stack caps,
mine speeds, DDA raycast (stone + torch), hold-to-mine, crack overlay, torch mining, mousedown mob-attack
edge case, block placement, mob mesh shapes for all 6 types, mob damage no-throw.
```bash
awk '/^<script>$/{flag=1;next}/^<\/script>/{flag=0}flag' index.html > /tmp/game.js && node --check /tmp/game.js && cd /tmp && node vm_test.js
```
Note: /tmp may be wiped between sessions — rebuild /tmp/game.js with the awk line; vm_test.js is in this doc's history (ask if missing).

## Current State: WORKING but needs polish
The game runs, renders infinite terrain, has mobs, day/night, mining, crafting, inventory.
Player can walk, mine, craft, and explore. Known issues listed below.

## How to Run
```bash
cd /workspaces/mc-html-home
python3 -m http.server 8080
# Open http://localhost:8080
# Hard refresh with Ctrl+Shift+R after every edit (browser caches aggressively)
```

## Syntax Check
```bash
awk '/^<script>$/{flag=1;next}/^<\/script>/{flag=0}flag' index.html > /tmp/game.js && node --check /tmp/game.js
```

## File Structure (by line section)
| Section | ~Lines | What |
|---------|--------|------|
| 1. Constants & Blocks | 54-120 | Block IDs, hardness, drops, items, tools, `getMineSpeed` |
| 2. Noise | 123-187 | `mulberry32`, `hash2d/3d`, `vnoise2d/3d`, `noise2d/3d` |
| 3. Texture Atlas | 189-245 | 18× 16×16 procedural textures on canvas, `tileUV()`, `BLOCK_FACES`, `drawItemIcon` |
| 4. World Gen | 246-390 | `getBiomeRaw`, `getTerrainHeight`, `isCave`, `getOre`, `getTreeAt`, `getGeneratedBlock`, `isTreeBlock`, `getBlockFinal`, overrides system |
| 5. Chunks & Meshing | 395-530 | `Chunk` class (typed array + generate + mesh), `buildChunkMesh` (hidden-face culling), `computeLight`, `updateChunks` (queue), `rebuildAround` |
| 6. Player | 535-570 | Position, collision (`collides`), `updatePlayer` (movement, water, fall damage, health regen) |
| 7. Block Interaction | 575-650 | `raycast` (DDA), `handleMining`, `mineBlock`, `placeBlock`, `spawnItemDrop`, `updateItemDrops`, `addToInventory` |
| 8. Inventory UI | 655-700 | Hotbar, hearts, `toggleInventory`, `renderInventory`, slot click handlers |
| 9. Crafting | 700-760 | 16 recipes, `matchRecipe` (shape-aware), `craftTakeResult`, `openCraftingTable` |
| 10. View Model | 760-800 | Held item mesh, swing anim, walk bob |
| 11. Particles | 800-840 | Block break, explosion, torch ember, hit particles |
| 12. Audio | 840-860 | Web Audio API: break, place, step, hurt, zombie, hiss, animal |
| 13. Mobs | ~948-1200 | `MOB_TYPES`, procedural 16×16 mob skins (speckle/face painters), `createMobMesh` (MC proportions, pivot limbs), `Mob` class (AI, physics, flash decay), `collidesMob`, `spawnMobs` |
| 14. Day/Night | ~1200-1240 | `timeOfDay`, sun/moon meshes, sky color lerp, fog, ambient/directional light |
| 15. Main Loop | ~1240-1324 | `gameLoop`, mouse handlers, resize, keyboard |

## Key Architecture Decisions
- **Infinite world**: `getBlockFinal(wx,wy,wz)` is a pure function of world coords + seed. No world bounds.
- **Chunks**: 16×96×16 `Uint8Array`. Generated incrementally (8/frame), prioritized by distance. Render distance = 6 chunks.
- **Overrides**: `overrides` object keyed `"x,y,z"` → block ID. Checked before procedural gen. Not persisted.
- **Trees**: Pre-computed per chunk during generation (scan 22×22 area). Trunks + spherical canopies.
- **Water**: Simple check — air block below sea level and above terrain height = water. No sky-exposure scan.
- **Lighting**: Simplified — based on depth below terrain surface. Torches checked via override lookup only. No flood-fill propagation.
- **Meshing**: Single `BufferGeometry` per chunk (solid) + one for water. Vertex colors for lighting. Hidden faces culled.

## Recently Fixed
- **Mining** — crack overlay (6 procedural 16×16 crack textures, `crackMesh` box 1.012 over target, stage by `miningProgress`), `addToInventory` stack-cap bug (`n-=n` → proper take), mousedown always sets `miningTarget` (mob-attack no longer stalls mining), raycast now HITS torches (previously passed through, so placed torches were unmineable). Torches intentionally get no crack box (highlight only).
- **Mobs** — rebuilt `createMobMesh` with real MC proportions (zombie 0.6×1.9 arms-forward, creeper 0.6×1.7, cow 0.9×1.4, pig 0.9×0.9, sheep 0.9×1.3, chicken 0.4×0.7) + procedural 16×16 pixel skins (zombie green/blue shirt/pants, creeper mottle + classic face, cow white patches + muzzle + hooves, pig snout/ears, sheep wool + pink face, chicken comb/wattle/beak). Limb geometry translated so rotation pivots at hip/shoulder. `damage()` no longer crashes on `Group.material` (traverse + per-mob materials), hit-flash decays via `flashT`.

## Known Issues / TODO (priority order)
1. **Performance** — Still heavy. Main costs: `isCave`/`getOre` 3D noise per underground block, cross-chunk `getBlockFinal` calls during meshing. Could cache height map during mesh, reduce noise octaves further, or use Web Workers.
2. **Mob AI** — Wander works but mobs still get stuck occasionally. No pathfinding (direct walk only). Could add simple obstacle avoidance.
3. **Torch rendering** — Torches are stored as blocks but not rendered as geometry (skipped in mesh builder with `if(b===B.TORCH)continue`). Need small cross/quad geometry for torches. (Torch MINING works via raycast now.)
4. **Crafting table interaction** — `openCraftingTable` exists but the 3×3 grid UI reuses the inventory screen. Could be a separate overlay.
5. **Item drop visuals** — Drops are plain white cubes. Could use the item icon texture.
6. **Cave lighting** — No actual light propagation. Caves are lit by a simple depth falloff. Real Minecraft-style flood-fill sky/block light would be a major upgrade.
7. **Sound polish** — Basic oscillator beeps. Could add noise-based sounds for more natural feel.
8. **Mobile/touch support** — Not implemented. Desktop only (pointer lock + keyboard).
6. **Crafting table interaction** — `openCraftingTable` exists but the 3×3 grid UI reuses the inventory screen. Could be a separate overlay.
7. **Item drop visuals** — Drops are plain white cubes. Could use the item icon texture.
8. **Cave lighting** — No actual light propagation. Caves are lit by a simple depth falloff. Real Minecraft-style flood-fill sky/block light would be a major upgrade.
9. **Sound polish** — Basic oscillator beeps. Could add noise-based sounds for more natural feel.
10. **Mobile/touch support** — Not implemented. Desktop only (pointer lock + keyboard).

## Configuration Knobs (top of file, line ~55)
```javascript
const CHUNK_SIZE = 16, CHUNK_HEIGHT = 96, SEA_LEVEL = 48;
const RENDER_DISTANCE = 6, MAX_GEN_PER_FRAME = 8;
const DAY_LENGTH = 240; // seconds per full day/night cycle
const PW = 0.6, PH = 1.8, P_EYE = 1.62; // player collision
const GRAVITY = -20, JUMP_VEL = 8, WALK_SPD = 4.5, SPRINT_SPD = 6.75;
const WATER_MULT = 0.5, REACH = 6, MAX_MOBS = 20, MAX_HOSTILE = 5;
const WSEED = 12345; // world seed — change for different terrain
```

## Biome IDs
0=plains, 1=forest, 2=rainforest, 3=desert, 4=beach, 5=ocean, 6=highlands, 7=snow

## Block IDs
```
AIR:0, GRASS:1, DIRT:2, STONE:3, COBBLE:4, COAL:5, IRON:6, SAND:7,
WATER:8, WOOD:9, PLANKS:10, LEAVES:11, SNOW:12, CRAFT:13, TORCH:14, BEDROCK:15
```

## Editting Guidelines
- Keep edits small and targeted (the file is one big script block)
- Always run the syntax check after edits
- Tell the user to hard refresh (Ctrl+Shift+R) after changes
- The `node --check` command extracts the script and validates syntax
- Be careful with brace counting in minified-style code (many statements per line)
- `getBlockFinal` is the hot path — any change there affects all chunk gen + meshing + collision

## What the User Likes / Wants
- Infinite world with no edges ✓
- Varied biomes with dramatic terrain ✓
- Mobs that look and behave like Minecraft (visuals done 2026: MC proportions + 16×16 procedural skins; behavior still basic)
- Good performance (currently the main complaint)
- Wants the game to "feel like Minecraft"
