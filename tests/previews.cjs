/* Real browser playback and fallback checks, served beneath a Pages subpath. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
(async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'evidence/preview-clips.json')));
  for (const clip of manifest.clips) {
    const bytes = await fs.readFile(path.join(root, clip.path));
    assert.equal(bytes.length, clip.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), clip.sha256);
    const original = await fs.readFile(path.join(root, clip.source));
    assert.equal(crypto.createHash('sha256').update(original).digest('hex'), clip.source_sha256);
  }
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      assert(pathname.startsWith('/project-demo/'));
      const file = path.join(root, pathname.slice('/project-demo/'.length) || 'index.html');
      assert(file.startsWith(root + path.sep));
      const data = await fs.readFile(file);
      res.writeHead(200, { 'Content-Type': ({ '.mp4': 'video/mp4', '.png': 'image/png', '.js': 'text/javascript', '.html': 'text/html' })[path.extname(file)] || 'application/json', 'Content-Length': data.length });
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const url = `http://127.0.0.1:${server.address().port}/project-demo/`;
  const errors = [];
  const open = async options => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...options });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    return { context, page };
  };
  const visible = async page => {
    await page.locator('.preview').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
  };
  try {
    const { context, page } = await open();
    await page.goto(url); await visible(page);
    await page.waitForFunction(() => [...document.querySelectorAll('video')].every(v => v.readyState >= 2 && !v.paused && v.currentTime > 0.1));
    const media = await page.locator('video').evaluateAll(videos => videos.map(v => ({ duration: v.duration, width: v.videoWidth, height: v.videoHeight, muted: v.muted, loop: v.loop, inline: v.playsInline, time: v.currentTime })));
    assert.equal(media.length, 3);
    for (const v of media) { assert(Math.abs(v.duration - 12) < 0.1); assert.equal(v.width, 960); assert.equal(v.height, 540); assert(v.muted && v.loop && v.inline); }
    await page.waitForTimeout(700);
    const times = await page.locator('video').evaluateAll(v => v.map(x => x.currentTime));
    times.forEach((t, i) => assert(t !== media[i].time));
    await page.getByRole('button', { name: 'Pause Astra gameplay preview', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('video').paused);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }));
    await page.waitForFunction(() => [...document.querySelectorAll('video')].every(v => v.paused));
    await visible(page);
    await page.waitForFunction(() => { const v = document.querySelectorAll('video'); return v[0].paused && !v[1].paused && !v[2].paused; });
    await fs.mkdir(path.join(root, 'test-artifacts'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-artifacts/previews-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 }); await visible(page);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(root, 'test-artifacts/previews-mobile.png') });
    await context.close();
    console.log('PASS: all clips decode and advance, controls, offscreen pause, desktop/mobile subpath layout');

    const reduced = await open({ reducedMotion: 'reduce' });
    await reduced.page.goto(url); await visible(reduced.page);
    assert(await reduced.page.locator('video').evaluateAll(v => v.every(x => !x.getAttribute('src'))));
    await reduced.page.getByRole('button', { name: 'Play Astra gameplay preview', exact: true }).click();
    await reduced.page.waitForFunction(() => !document.querySelector('video').paused && document.querySelector('video').currentTime > 0);
    assert(await reduced.page.locator('video').evaluateAll(v => v.slice(1).every(x => !x.getAttribute('src'))));
    await reduced.page.emulateMedia({ reducedMotion: 'no-preference' });
    await reduced.page.waitForFunction(() => [...document.querySelectorAll('video')].every(v => !v.paused));
    await reduced.page.emulateMedia({ reducedMotion: 'reduce' });
    await reduced.page.waitForFunction(() => [...document.querySelectorAll('video')].every(v => v.paused));
    await reduced.context.close();

    const dataSaver = await open();
    await dataSaver.page.addInitScript(() => Object.defineProperty(navigator, 'connection', { value: { saveData: true, addEventListener() {} } }));
    await dataSaver.page.goto(url); await visible(dataSaver.page);
    assert(await dataSaver.page.locator('video').evaluateAll(v => v.every(x => !x.getAttribute('src'))));
    await dataSaver.context.close();

    const blocked = await open();
    await blocked.page.route('**/*.mp4', route => route.abort());
    await blocked.page.goto(url); await visible(blocked.page);
    await blocked.page.waitForFunction(() => [...document.querySelectorAll('.preview-toggle')].every(b => b.hidden));
    assert(await blocked.page.locator('.preview img').evaluateAll(imgs => imgs.every(i => i.complete && i.naturalWidth > 0)));
    assert(await blocked.page.locator('video').evaluateAll(v => v.every(x => !x.classList.contains('ready'))));
    await blocked.context.close();

    const plain = await open({ javaScriptEnabled: false });
    await plain.page.goto(url); await visible(plain.page);
    assert(await plain.page.locator('.preview img').evaluateAll(imgs => imgs.every(i => i.complete && i.naturalWidth > 0)));
    assert(await plain.page.locator('.preview-toggle').evaluateAll(b => b.every(x => x.hidden)));
    assert.equal(await plain.page.locator('.preview-link[href]').count(), 3);
    await plain.context.close();
    assert.deepEqual(errors, []);
    console.log('PASS: reduced motion, explicit play, data saving, failed media, no-JavaScript fallbacks; provenance hashes');
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
