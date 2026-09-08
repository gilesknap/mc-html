# Voxel Craft — Working Memory (continue here)

Single-file MC clone: `/workspaces/mc-html-home/index.html` (1379 lines, one big `<script>`).
Run: `cd /workspaces/mc-html-home && python3 -m http.server 8080` → http://localhost:8080 (hard refresh Ctrl+Shift+R).
Syntax check + full test harness (self-contained, no build step):
```
cd /workspaces/mc-html-home && node --check index.html 2>/dev/null; node test.js
```
`test.js` = Node vm harness (permissive THREE/DOM/audio proxies with scene-graph tracking: Group.add/traverse + isMesh) that extracts the real `<script>` from index.html and runs **45 assertions, ALL PASS**. Lives in the main folder next to the source (survives /tmp wipes).

Full architecture in `HANDOFF.md`.

## Done (this session — 4 fixes, all harness-verified)
### 1. Mob auto-step (was stuck/hopping at steps, stuck in foliage)
- Old bug: mob stepped up only 0.5 block → couldn't clear a 1-block step → perpetual hopping loop.
- Fix: per-axis **1-block** auto-step in `Mob.update` (section ~1194-1207): on ground, if blocked horizontally, try `y+=1`; if still colliding, revert `y-=1` and snap x/z back (no hover). Passive mobs re-pick wander target when fully blocked on ground (anti-stuck, line ~1213).
- Harness: chicken steps UP (maxy=55) and advances past the step (adv=4.51), y stable (range 1.0, not hopping).

### 2. Player auto-jump (was off)
- Fix: per-axis collision with auto-jump in `updatePlayer` (lines ~616-632): `wasOnGround && wantMove` and blocked → `y+=1` (1-block step, max once per frame via `stepped` flag). `wantMove` = horizontal input present.
- Also fixed a pre-existing bug: **fall damage never triggered** — impact velocity was zeroed before the check. Now `impactVy` is captured in the Y-collision branch (line ~627) and used for the fall-damage check (line ~635).
- Harness: player steps UP over 1-block step (maxy=55) and advances; does NOT auto-jump a 2-block wall (maxy=54).

### 3. Mined block goes to the selected/held slot (was always slot 1)
- Fix: `addToInventory(item,n,prefer)` (line ~778) — when `prefer` is a hotbar slot (0-8) that is empty or holds the same item, fill it FIRST; else fall through to standard first-empty / stack logic. `mineBlock`→`spawnItemDrop`→`addToInventory` passes `selectedSlot` as `prefer`.
- Harness: mined block lands in selected slot (4), slot 0 stays empty; stacks into selected slot; occupied-by-different-item selected slot is NOT overwritten (falls to next empty); no-prefer path still fills slot 0 (backwards-compatible).

### 4. Performance (user's main complaint)
- **Memoized `getTerrainHeight`** (line ~268): body renamed `_terrain`, wrapped with `terrainCache` Map keyed `"x,z"`, cap 120k → clear().
- **Memoized `getGeneratedBlock`** (line ~324): body renamed `_genBlock`, wrapped with `genBlockCache` Map keyed `"x,y,z"`, cap 250k → clear(). Both are pure (no override reads).
- **Removed redundant `getTerrainHeight` call**: `getBiome(wx,wz)` → `getBiomeRaw(wx,wz,h)` passes the already-computed height (was recomputing it).
- **Adaptive time budget** in `updateChunks` (line ~563): replaced fixed `MAX_GEN_PER_FRAME` count with an 8ms `performance.now()` budget (cap 20 chunks) → flat frame time instead of spikes.
- **Fixed `drawItemIcon` readbacks** (line ~222/237): grabbed `atlasData = actx.getImageData(0,0,ATLAS_W,ATLAS_H).data` ONCE after atlas build; icon loop indexes `atlasData[(ay*ATLAS_W+ax)*4+i]` instead of per-pixel `actx.getImageData(ax,ay,1,1)` (was ~256 readbacks per hotbar redraw).
- Harness: memoization correctness verified — `getTerrainHeight`/`getGeneratedBlock` match `_terrain`/`_genBlock` over 200/8×8×N samples (caches don't change results).

## Remaining TODO (from HANDOFF)
1. **Torch rendering** — stored as blocks but skipped in mesh builder (`if(b===B.TORCH)continue`); need small cross/quad geometry. (Mining/placing works.)
2. Mob AI stuck-in-places (no pathfinding), crafting-table overlay, item-drop visuals (white cubes → icon texture), cave lighting, sound polish, mobile support.

## Gotchas learned
- **Test coords must be terrain-aware**: don't hardcode `y=50` (terrain at (0,0) is 53 → you're underground). Use the harness `spot` finder (flat, above-water) — see `test.js`.
- **`player.vx` is recomputed from key input every frame** in `updatePlayer` — to test movement, set `keys['KeyW']` etc., not `player.vx`.
- **Auto-step descends after climbing** — assert on MAX y over the frame loop, not final y.
- `addToInventory` slot shape is `{item, n}` — shorthand `{item,take}` silently breaks it (harness caught earlier).
- Harness THREE proxies make `Group.material` a proxy (never undefined) — can't verify real-browser material crashes there; verify structurally (`o.isMesh`/`traverse`/`add` are special-cased).
- `timeOfDay` starts 0.35 (dawn-burn range 0.3–0.7) — set `timeOfDay=0.1` in harness before hostile-mob update loops.
- Block IDs: AIR:0 GRASS:1 DIRT:2 STONE:3 COBBLE:4 COAL:5 IRON:6 SAND:7 WATER:8 WOOD:9 PLANKS:10 LEAVES:11 SNOW:12 CRAFT:13 TORCH:14 BEDROCK:15. Knobs at top (~line 55).
- Editing rules: small targeted edits; `node test.js` after each; tell user to hard refresh. Don't touch `getBlockFinal`/`_genBlock` casually (hot path).

## Test Harness (test.js) — 45 assertions, sections
Sanity/world · Memoization correctness · Selected-slot preference · Stack caps · Mining speeds · DDA raycast (stone+torch) · Hold-to-mine (break + crack) · Torch mining · Block placement · Player auto-jump (1-step yes / 2-wall no) · Mob auto-step · Mob mesh shapes (6 types) + damage no-throw · Mousedown mining-target.
