# Showcase save support

Added by Codex after the showcased game runs. This is an investigation aid shared by all three games, not part of either model's original delivery. It does not repair their gameplay rules, generation, rendering, crafting, or AI.

The playable HTML files have only an animation-loop pause check and two external script tags, plus an attribution comment. Classic scripts let each adapter access the original top-level lexical state without reorganizing the game source. `saves.js` owns the interface and persistence; `astra-saves.js`, `qwen-saves.js`, and `claude-saves.js` capture and reconstruct the different game representations.

## Use

Serve the repository over HTTP (for example `python3 -m http.server 8000`). Start a game, then press F6, or release the mouse with Esc and click Saves. The modal pauses simulation, clears held controls, and keeps game shortcuts from responding while naming a slot. Continue resumes play or returns to the saved inventory/death interface.

Each game has five independent named slots with Save, Load, Export, Import, and Delete. Overwriting, deleting, and replacing current play ask for confirmation. Import stores a checkpoint in the chosen slot; Load is a separate action. Exported JSON can be shared with another person using the same game version. Imported names are rendered as text.

IndexedDB stores saves under the site's path and game ID. Writes complete transactionally before reporting success, and revision checks prevent silently overwriting a slot changed in another tab. Storage errors are shown in the panel. Clearing site data, using a different browser/profile/origin, or moving the site path affects access to saves. Export backups; there is no automatic save or server/cloud synchronization. Playing from `file://` is not supported by this addition.

## What a save contains

- Game identity, fixed world seed, pre-save source hash, format version, name, and timestamp.
- All block overrides, including removed blocks and edits in unloaded chunks.
- Player position, facing, velocity, grounded/fall state, health, regeneration, and respawn state where the game represents it.
- Inventory, selected hotbar slot, crafting grid and its size, held cursor stack, and inventory/death UI state.
- Day/night time (and Astra's day counter), live mobs with gameplay timers and velocities, and dropped items with their remaining lifetime.

Terrain, meshes, lighting, and interface elements are rebuilt from data. Loading pauses physics until the surrounding 3 × 3 chunks exist. Astra drains its outstanding terrain-worker reply before replacing caches and suppresses duplicate animal spawning for chunks already populated at the checkpoint. Its remaining chunks then stream through the original worker. Qwen restores drops directly because its original spawn-drop function first tries to collect items into inventory.

Transient particles, sounds, input holds, and partially completed mining swings are discarded. The games use `Math.random()` for runtime behavior, so this is a resumable checkpoint, not deterministic replay. Loaded entities outside the rebuilt neighborhood continue under the original streaming rules. Existing crafting, collision, rendering, and despawning quirks remain observable. Saves are validated against this adapter version; incompatible seeds, source revisions, game IDs, malformed fields, and oversized imports are rejected before restoration. There is no migration between games or source revisions.

Claude’s adapter also restores tool durability, both crafting grids, mob targets and fleeing origins. It preserves the UI’s existing array references so restored slots remain interactive, suppresses duplicate passive spawns, and reconstructs nearby dropped stacks separately instead of merging them during load. Its simulation runs while the original inventory is open; the shared save modal explicitly pauses it.

The internal save format and database name retain the original `two-worlds` identifiers for compatibility with existing Astra and Qwen saves. Claude uses its own game ID and slots.

## Authorship and evidence

The landing page's HTML downloads point to exact pre-save files in `originals/`. `originals/manifest.json` identifies the baseline commit and hashes. Astra's baseline includes the repository's later controls, compass, and recipe-discovery fixes (`84fc4e6`); its hash therefore differs from the original September 8 capture. Claude’s untouched source and author-reported run details are recorded separately in `evidence/claude-snapshot.json`. `evidence/snapshot.json` retains the historical hashes without rewriting them to describe modified files.

Deploy `showcase/` and `originals/` together with `astra/`, `qwen/`, and `claude/`. The site remains static and needs no runtime npm dependencies or build step.

## Verification

Use Node 20+:

```sh
npm ci
npx playwright install --with-deps chromium
npm test
```

The browser suite serves the repo locally and exercises all three real games with Three.js and software WebGL. It checks save/load across reload, named slots, terrain edits, inventory and crafting, mobs and drops, repeated restoration, pause/input isolation, export/import, incompatible/corrupt files, storage failure, tool durability, retained crafting UI references, and preserved snapshot hashes. The suite also checks three desktop columns, mobile page overflow, exact displayed file sizes, downloads, and local links. The games load Three.js from their original CDN, so the test requires network access. Test screenshots go to ignored `test-artifacts/`.
