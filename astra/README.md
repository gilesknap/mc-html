# Showcase save support

`index.html` now loads the shared panel and a game-specific adapter, with one pause check in the animation loop. Press F6 for saves. This addition was implemented by Codex after the game runs described below; it is not part of their original delivery. See [save documentation](../showcase/README.md).

The exact pre-save file is preserved at [`originals/astra.html`](../originals/astra.html), with its hash in [the pre-save manifest](../originals/manifest.json). The following account describes the historical capture, not the modified playable file.

# Astra / Wildwood

The original single-file game, moved unchanged from the showcase workspace’s root `index.html`.

The author reports one continuous run, approximately 18 minutes, at medium effort. That run included implementation, browser testing, and corrections. It did not require user follow-up iterations.

Serve the repository over HTTP and open `index.html` in a modern desktop browser. Internet access is required to load Three.js from its CDN. No build step or other game assets are required.

The showcase landing page is at `../index.html`. Its evidence manifest records this file’s SHA-256 hash.
