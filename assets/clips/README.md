# Gameplay card previews

These are actual browser recordings of `originals/astra.html`, `originals/qwen.html`, and `originals/claude.html`. The original sources are unchanged. Scripted relative mouse events and a short keyboard-driven forward walk use the games' own input handlers. Relative events avoid a headless pointer-lock issue that cancels automated absolute mouse moves. Startup footage is trimmed; the game clock is not accelerated. The clips are illustrative footage, not rendering-performance or model benchmarks.

Each clip is 12 seconds, silent H.264 MP4, 960 × 540 at 24 fps, with the MP4 metadata moved to the front for playback. The browser viewport was 1280 × 720 with Chromium software WebGL. The original PNG screenshots remain as loading, reduced-motion, and no-JavaScript fallbacks.

`showcase/previews.js` loads videos on intersection, pauses offscreen or hidden-tab videos, respects explicit pauses, and avoids automatic playback for reduced-motion/data-saving preferences. Visitors can choose Play clip to override those preferences for an individual preview. Playback failure leaves a still image and the game link.

To re-record with Node 20+, installed Playwright Chromium, and ffmpeg with the `libx264` encoder:

```sh
npm ci
npx playwright install --with-deps chromium
FFMPEG=/path/to/ffmpeg node scripts/record-previews.cjs
```

The script writes raw WebM recordings and end-frame screenshots to ignored `test-artifacts/`, then writes the distributable MP4 clips here. Review the footage and update `evidence/preview-clips.json` if regenerating it. CDN access is needed during capture. End frames, raw recordings, and ffmpeg are not site dependencies.

`npm run test:previews` checks actual MP4 decoding and advancing playback, controls, offscreen pausing, reduced-motion and data-saving preferences, failed-media and no-JavaScript fallbacks, desktop/mobile layout beneath `/project-demo/`, and clip/source hashes. `npm test` also runs the existing game-save suite.
