# Claude / Voxel Craft

Added as the third contender on 9 September 2026, from `../mc-html-claude/index.html`.

The author reports **one shot, 28 minutes 22 seconds, and 210k tokens**. The duration and token count come from the supplied `claude.readme.txt`, preserved in [evidence/claude-notes.txt](../evidence/claude-notes.txt); the one-shot description was confirmed in conversation. The specific Claude model, reasoning setting, token breakdown, and tool environment were not supplied. These figures are not standardized throughput or cost measurements.

The untouched single HTML file is preserved at [originals/claude.html](../originals/claude.html). It is **132,939 bytes (129.8 KiB)**, before showcase save support, excluding its Three.js CDN dependency. Its SHA-256 and source observations are in [evidence/claude-snapshot.json](../evidence/claude-snapshot.json) and the [original download manifest](../originals/manifest.json).

`index.html` contains only the original game plus a pause check, two external script tags, and an attribution comment for showcase saves. The external adapter preserves block changes, player and mob state, dropped items, both crafting grids, the cursor stack, and tool durability. The save system was added by Codex after the Claude run and is not part of Claude's original delivery. See [showcase/README.md](../showcase/README.md).

Serve the repository over HTTP and open `claude/`. Click the game to capture the mouse; E opens inventory and F6 opens five browser save slots. The original controls and gameplay are retained. Internet access is required for Three.js r160 from cdnjs.

The landing-page image is a real 1440 × 900 Chromium capture of the untouched source after entering the game, using software WebGL. Its visible FPS is incidental and is not comparable inference or rendering benchmark evidence. The shared browser suite checks saves with the real game; it does not establish full compliance with the original prompt.
