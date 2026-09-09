# Evidence and scope

These notes and `snapshot.json` describe the historical capture, before the later Astra fixes and showcase save support. Current pre-save baselines are separately archived in [`originals/`](../originals/manifest.json); playable pages include the additions documented in [`showcase/`](../showcase/README.md).

Captured on 8 September 2026. This directory supports the public comparison page without requiring local filesystem access.

## Author-reported run details

The author supplied the following details in the showcase request:

- Astra: one shot, approximately 18 minutes, medium effort.
- Qwen: `Qwen3.8-27B-UD-Q4_K_S.gguf`, several iterations, approximately four full contexts of 128K each.
- Qwen ran locally in pi.dev, initially without agent internet access. The author later supplied `pi install --local npm:pi-web-access`.

These are attributed accounts rather than measured inference logs. Four 128K contexts do not establish output-token count, total unique input tokens, cost, or inference speed. Astra’s initial run included tool calls, browser verification, and corrections within that run.

The shared prompt is archived in [PROMPT.md](../PROMPT.md) and rendered on [the prompt page](../prompt.html). It was exported from the Google Doc linked by the author. The plain-text export matches the specification supplied in this conversation; the archive normalizes line endings and adds a provenance header.

## Qwen repository observations

Source: the sibling `mc-html-home` repository, read without modifying it.

- Seven commits were present. See [qwen-history.txt](qwen-history.txt).
- The initial commit added a 1,099-line `index.html`.
- The first and last commit timestamps span 1 hour, 58 minutes, 42 seconds. This describes saved checkpoints and cannot establish total work duration.
- Commit `06bd425` records a handoff from the first context. Commit `f598cee` records the end of context two. Git alone does not establish the author’s approximately four-context total.
- The working tree had uncommitted `index.html` changes and untracked `PI-SETUP.md`. The latter was not copied into the site.
- No Git remote was configured at capture.
- `.pi/settings.json` registered `npm:pi-web-access`. A setup document mentions `pi-playwright`, but that package was not in the inspected project registration; the site does not claim it was installed.
- The published game snapshot includes the uncommitted changes, recorded in [qwen-working-tree.patch](qwen-working-tree.patch).
- [qwen-HANDOFF.md](qwen-HANDOFF.md) and [qwen-memory.md](qwen-memory.md) are copied historical notes. They describe known issues and planned fixes; some of those fixes are now in the uncommitted snapshot. The original commit message mentions web SVGs; current source inspection shows procedurally generated mob textures, not runtime SVG downloads.

The game files themselves were copied or moved unchanged. Their byte sizes and SHA-256 hashes are in [snapshot.json](snapshot.json).

## Observed machine

Sources were queried locally, without serial numbers, hostnames, or GPU UUIDs being included in the report:

- `lscpu`: AMD Ryzen 7 5800X, 8 physical cores, 16 logical CPUs.
- `/proc/meminfo`: 31,733,660 KiB total, approximately 30.3 GiB visible to the OS. Installed DIMM capacity was not independently inspected.
- NVIDIA driver information under `/proc/driver/nvidia/gpus/`: NVIDIA GeForce RTX 3090.
- `/etc/os-release`: Ubuntu 24.04.4 LTS.
- `uname`: Linux 7.0.0-28-generic, x86_64.

These are the specs visible to this workspace. No GPU offload configuration, VRAM allocation, model-serving command, or inference throughput was verified. Astra’s inference was hosted; these local specs are not presented as Astra’s inference hardware.

## Source-level comparison

Both implementations use a procedural atlas, typed chunk arrays, deterministic terrain, hidden-face chunk meshes, crafting, and mob entities. The comparison table is scoped to the captured source rather than an assertion that either implementation satisfies every requirement.

Astra uses an embedded worker, configurable view distance defaulting to eight chunks, flood-filled sky/block light, and torch post geometry. Qwen uses six chunks, cached generation on the main thread with a between-chunk time budget, depth-based lighting plus neighboring torch overrides, and currently skips torch blocks in its mesh builder. Qwen’s later uncommitted changes include auto-step and a corrected fall-impact calculation.

## Browser verification

During Astra’s initial game build, headless Chromium checked:

- Startup, pointer lock, inventory opening, and JavaScript errors.
- Hold-to-mine, floating drops, movement-based pickup, and crafting through the UI.
- All 12 recipe definitions, including shifted pattern matching.
- Cave darkness, torch source level 14, neighboring level 13, removal, and chunk-border light.
- Chunk-border collision, placement and stack consumption, self-placement protection, and bedrock protection.
- Inventory stacking and full-inventory remainder handling.
- Mob hit/flee behavior, death/drop behavior, and player respawn.
- Unloading the origin at coordinates −1,040 / 1,104, then returning and confirming edited blocks persisted.

Qwen’s historical notes report a 13-assertion Node VM harness with permissive Three.js/DOM stubs. That historical claim is not equivalent to a real-browser full functional test.

For this showcase, both unchanged game copies were launched in headless Chromium, their start controls were clicked, and screenshots were captured after approximately 17 seconds of play view. Neither produced a JavaScript page error during those captures. Screenshots were taken at 1440 × 900 with software WebGL, then displayed at smaller sizes on the landing page. Their visible FPS counters are incidental captures, not comparable hardware-accelerated performance results.

The comparison page is also checked at desktop and mobile widths, and all local links and packaged files are validated. The full functional suite has not been run against both implementations. Firefox and real GPU performance have not been benchmarked here.


## Claude added on 9 September 2026

Claude's third contender was copied from `../mc-html-claude/index.html` without modifying that source. The exact file is preserved at [`originals/claude.html`](../originals/claude.html), with its hash and byte size in [`claude-snapshot.json`](claude-snapshot.json). Playable `claude/index.html` adds the same explicitly attributed save hooks as the other contenders.

The supplied [`claude-notes.txt`](claude-notes.txt) reports 28m 22s and 210k tokens. The author separately confirmed one shot and medium reasoning effort in conversation. The Claude model version, environment, and token accounting were not supplied; the page labels the model simply Claude and does not equate its token count with Qwen's context-window estimate.

Source inspection shows Three.js r160, 16 × 16 × 96 chunks, an eight-chunk render radius, main-thread generation and meshing budgets of 7 ms and 6 ms checked between chunks, sky/block flood fill across borders, shaped crafting, item durability, and textured passive/hostile mobs. These are source observations, not a standardized performance comparison.

The new landing-page image is an actual 1440 × 900 Chromium capture of the untouched Claude file after entering the world, with software WebGL. Browser tests cover save/load across reloads, distant edits, entities, both crafting grids, durability, repeated loads, invalid imports, storage failures/conflicts, and resumed simulation. Landing-page tests cover the three-column desktop layout, mobile overflow, file sizes, downloads, and local links. Historical capture notes above remain scoped to Astra and Qwen.

## Gameplay preview clips

The landing cards now use 12-second muted recordings of the preserved originals, with the earlier PNG screenshots retained as fallbacks. All were captured at a 1280 × 720 browser viewport, recorded at 960 × 540, and encoded as 24 fps H.264 MP4 with no audio. The capture script waits for startup, then uses mouse turns and a brief forward walk through the original input handlers. It does not modify the game source or set player/world state. Startup footage is trimmed; gameplay is not sped up. Software WebGL performance and visible FPS counters are not controlled benchmarks.

The clip files, hashes, sizes, and source versions are in [`preview-clips.json`](preview-clips.json). Recording instructions are in [`assets/clips/README.md`](../assets/clips/README.md). Claude's medium effort was confirmed by the author after its initial addition; the supplied timing/token note remains unchanged.
