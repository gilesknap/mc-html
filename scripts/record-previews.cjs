/* Capture real, unmodified game pages. Requires Playwright and an ffmpeg build
 * with H.264 encoding: FFMPEG=/path/to/ffmpeg node scripts/record-previews.cjs. */
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const ffmpeg = process.env.FFMPEG || 'ffmpeg';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  execFileSync(ffmpeg, ['-version'], { stdio: 'ignore' });
  const rawDir = path.join(root, 'test-artifacts', 'raw-previews');
  await fs.mkdir(rawDir, { recursive: true });
  await fs.mkdir(path.join(root, 'assets/clips'), { recursive: true });
  const server = http.createServer(async (req, res) => {
    try {
      const file = path.join(root, new URL(req.url, 'http://localhost').pathname);
      if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
      res.setHeader('Content-Type', 'text/html'); res.end(await fs.readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  try {
    for (const game of (process.env.GAMES || 'astra,qwen,claude').split(',')) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: rawDir, size: { width: 960, height: 540 } } });
      const page = await context.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/originals/${game}.html`);
      if (game === 'astra') { await page.waitForFunction(() => !document.getElementById('enter').disabled); await page.locator('#enter').click(); }
      else await page.locator(game === 'qwen' ? '#instructions' : '#overlay').click();
      await page.waitForFunction(() => !!document.pointerLockElement);
      await sleep(16000);
      const before = await page.evaluate(game => game === 'claude' ? player.yaw : yaw, game);
      let walking = false, cameraMoved = false;
      const begin = Date.now();
      for (let step = 0; step < 120; step++) {
        const t = step / 10;
        const movementX = t >= 1.5 && t < 5 ? 8 : t >= 5 && t < 8 ? -8 : t >= 10 ? 2 : 0;
        // Headless pointer lock warps absolute mouse moves back to the centre.
        // Supply relative mouse events to the original handlers; never edit game state.
        await page.evaluate(movementX => document.dispatchEvent(new MouseEvent('mousemove', { movementX, movementY: 0, bubbles: true })), movementX);
        cameraMoved ||= (await page.evaluate(game => game === 'claude' ? player.yaw : yaw, game)) !== before;
        if (t >= 8 && t < 10 && !walking) { await page.keyboard.down('KeyW'); walking = true; }
        if (t >= 10 && walking) { await page.keyboard.up('KeyW'); walking = false; }
        await sleep(Math.max(0, begin + (step + 1) * 100 - Date.now()));
      }
      if (!cameraMoved) throw new Error(`${game}: recorded mouse input did not change the view`);
      await page.screenshot({ path: path.join(root, 'test-artifacts', `${game}-clip-end.png`) });
      const video = page.video(); await context.close();
      if (errors.length) throw new Error(`${game}: ${errors.join('; ')}`);
      const raw = await video.path(), output = path.join(root, 'assets/clips', `${game}.mp4`);
      execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-sseof', '-12', '-i', raw, '-t', '12', '-an', '-vf', 'fps=24', '-c:v', 'libx264', '-preset', 'slow', '-crf', '29', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output]);
      console.log(`${game}: ${(await fs.stat(output)).size} bytes, 12-second muted H.264 clip`);
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
