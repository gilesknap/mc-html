# Voxel Craft — Working Memory (continue here)

Single-file MC clone: `/workspaces/mc-html-home/index.html` (1324 lines, one big `<script>`).
Run: `cd /workspaces/mc-html-home && python3 -m http.server 8080` → http://localhost:8080 (hard refresh Ctrl+Shift+R).
Syntax check + full test harness:
```
awk '/^<script>$/{flag=1;next}/^<\/script>/{flag=0}flag' index.html > /tmp/game.js && node --check /tmp/game.js && cd /tmp && node vm_test.js
```
`/tmp/vm_test.js` = Node vm harness (permissive THREE/DOM proxies with scene-graph tracking: Group.add/traverse + isMesh) loading the REAL game script. 13 assertions, ALL PASS as of last turn. /tmp may be wiped between sessions — if vm_test.js is gone, ask user for it or rebuild (see HANDOFF.md "Test Harness" note).
Full architecture in `HANDOFF.md` (updated with Recently Fixed + TODO).

## Done this turn (both tasks complete)
### 1. Mining (user: "sometimes hits once but usually fails to have any effect")
- **(C) Fixed `addToInventory` stack-cap bug**: `n-=n` zeroed remainder; now `take=Math.min(max,n); inventory[i]={item,n:take}; n-=take;` (careful: property name is `n`, not `take` — first attempt broke this, harness caught it).
- **(A) Added crack overlay**: 6 procedural 16×16 crack textures (`crackTexs`, jagged black lines, more per stage) + `crackMesh` (BoxGeometry 1.012, transparent, depthWrite:false, renderOrder 1). `handleMining` updates stage from `miningProgress`, hides when not cracking. Torches excluded (full-block crack box on a thin post looks bad; highlight only).
- **(D) mousedown always sets `miningTarget`** (previously skipped when a mob was attacked → stale target).
- **Bonus real bug fixed: raycast now hits TORCH** (was `b!==B.AIR&&b!==B.WATER&&b!==B.TORCH` — passed through torches, so placed torches were unmineable).
- Harness-verified: hold-to-mine stone in 169 frames (2.8s), cracks visible all 168 frames, torch mined in 5 frames, place still works.
### 2. Mobs look like real Minecraft
- Web research: hitbox dims from minecraft.wiki (zombie 0.6×1.95, creeper 0.6×1.7, cow 0.9×1.4, pig 0.9×0.9, sheep 0.9×1.3, chicken 0.4×0.7).
- Rebuilt `createMobMesh` (section 13, ~line 952): MC proportions in block units, front=+z, limb BoxGeometry translated so rotation pivots at hip/shoulder. Per-mob: zombie (arms held forward rot.x=-π/2+0.15, 2 legs), creeper (4 stubby legs, classic 2×-scaled face), cow (white patches, muzzle w/ nostrils, hooves, no horns — vanilla cows have none), pig (snout mesh, ears, hooves), sheep (wool body, pink face front-only, pink legs), chicken (comb×3, wattle, orange beak, yellow legs).
- Procedural 16×16 pixel skins: `speckleTex(base,spots,n,seed)` (seeded LCG `seededRnd`), `faceTex` painters, `mobTex` (NearestFilter). Textures shared per-type (module-level consts); materials per-mob (`mMat`) so hit-flash doesn't leak between mobs.
- **Fixed real crash**: `damage()` did `this.mesh.material.emissive=...` but `mesh` is a THREE.Group (no material) → TypeError in real browser (would kill game loop on dawn burn). Now `mesh.traverse(o=>{if(o.isMesh){...emissive.setRGB(1,0,0)}})`; flash decays: `flashT` now decremented in `update()` (was never decayed → burned mobs never re-burned) and emissive resets to black on expiry.
- Walk anim guards per-leg index (biped mobs have 2 legs, not 4).
- Harness-verified: all 6 mesh shapes (mesh/leg counts), damage no-throw, hp math.

## Remaining TODO (priority, from HANDOFF)
1. **Performance** (user's main complaint) — PLAN BELOW, agreed to do next turn.
2. **Torch rendering** — stored as blocks but skipped in mesh builder (`if(b===B.TORCH)continue`); need small cross/quad geometry. (Mining/placing works.)
3. Mob AI stuck-in-places (no pathfinding), crafting-table overlay, item-drop visuals (white cubes → icon texture), cave lighting, sound polish, mobile support.

## Gotchas learned
- Harness: harness THREE proxies make `Group.material` a proxy (never undefined) — can't verify real-browser material crashes there; verify structurally. `o.isMesh`/`traverse`/`add` are special-cased in the harness proxy.
- World IS generated at load time (chunks around spawn) — pick test coords off actual terrain: find open spot via `getTerrainHeight` near (0,0) (spawn), don't hardcode y=50.
- `addToInventory` slot shape is `{item, n}` — shorthand `{item,take}` silently breaks it (harness caught).
- Raycast face for placement: steep downward rays enter target cell via -y face (place ON TOP); shallow via +z face. Compute expected placement cell from `target.face` in tests.
- `timeOfDay` starts 0.35 (dawn-burn range 0.3–0.7) — set `timeOfDay=0.1` in harness before hostile-mob update loops.
- Block IDs: AIR:0 GRASS:1 DIRT:2 STONE:3 COBBLE:4 COAL:5 IRON:6 SAND:7 WATER:8 WOOD:9 PLANKS:10 LEAVES:11 SNOW:12 CRAFT:13 TORCH:14 BEDROCK:15. Knobs at top (~line 55).
- Editing rules: small targeted edits; node --check + `cd /tmp && node vm_test.js` after each; tell user to hard refresh. Don't touch `getBlockFinal` casually (hot path).

## PERF PLAN (next turn — user approved; context ran out before any perf edits)
### Measured hot spots (line numbers in current 1324-line file)
- `getGeneratedBlock(wx,wy,wz)` (~line 311) is THE hot path: called per-block by chunk gen AND by `getBlockFinal` during neighbor-chunk meshing. Per underground block it runs: `getTerrainHeight` (4×noise2d = 18 octaves ≈ 72 hash2d) + `getBiome`→`getBiomeRaw` (+8 octaves ≈ 32 hash2d, calls getTerrainHeight AGAIN) + `isCave` (3×noise3d×2oct = 48 hash3d) + `getOre` (2×noise3d×2oct = 32 hash3d). ≈150 hash ops/block.
- Chunk = 16×96×16; `MAX_GEN_PER_FRAME=8` (line 57) → tens of millions of hash ops/frame while walking → hitching.
- `getTerrainHeight` (line 266): octaves 6/4/5/3 for base/detail/mountain/river (lines 267-274).
- `isCave`/`getOre` already y-guarded (cheap skips OK).
- Hidden cost: `drawItemIcon` (line ~235) calls `actx.getImageData(ax,ay,1,1)` PER PIXEL inside hotbar redraw (256 readbacks per slot!) — fires on every `updateHotbar()` (every mine/place/pickup).
- No double gameLoop (line 1253 is self-schedule inside gameLoop, line 1320 is the single initial kick).

### Fixes to implement (in order)
1. **Memoize `getGeneratedBlock` result** in one Map keyed `"x,y,z"` (it's pure — no override reads; overrides handled separately in getBlockFinal). This kills terrain+biome+cave+ore re-eval during meshing (rebuildAround rebuilds up to 4 chunks per mined/placed block) and dedupes getTerrainHeight/getBiome inside. Cap entries (~200k) → clear() when over (safe: pure fn). Put cache lookup at top of getGeneratedBlock; store result before return (wrap body in inner fn or cache at each return — easiest: rename body to `genBlock(wx,wy,wz)`, make getGeneratedBlock a cached wrapper).
2. **Adaptive gen budget**: in `updateChunks` (line ~525-542), replace fixed `count<MAX_GEN_PER_FRAME` with time budget: `while(queue.length && count<16 && performance.now()-t0<6)`. Keeps frame time flat instead of fixed 8-chunk spikes.
3. **Fix drawItemIcon readbacks**: grab `const atlasData=actx.getImageData(0,0,ATLAS_W,ATLAS_H).data` ONCE after atlas build; icon loop indexes `atlasData[(ay*ATLAS_W+ax)*4+i]` instead of per-pixel getImageData.
4. (Optional, small) terrain octaves 6/4/5/3 → 5/3/4/3 (lines 267-274) — ~30% less terrain noise cost, minor visual change. Do last; ask user if OK or just do it (low risk).
5. Verify after each: node --check + vm_test.js (13 assertions must stay green). Add a perf smoke test in harness? Optional — harness can't measure real GPU/browser perf; rely on user playing + FPS counter.

### After perf
Torch rendering (TODO #2): in `buildChunkMesh` (~line 471) torches are skipped (`if(b===B.TORCH)continue`); add small post+flame geometry (thin box 0.1×0.5 + glow quad) to the chunk's solid mesh or a separate torch mesh per chunk. Torch ember particles already exist (gameLoop).
