/* Real-browser regression tests; npm test (Node 20+). */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const delay = ms => new Promise(r => setTimeout(r, ms));
async function main() {
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'originals/manifest.json')));
  for (const [file, entry] of Object.entries(manifest.files)) {
    const bytes = await fs.readFile(path.join(root, file));
    assert.equal(bytes.length, entry.bytes); assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), entry.sha256);
  }
  const server = http.createServer(async (req, res) => {
    try {
      let relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (relative.endsWith('/')) relative += 'index.html';
      const file = path.join(root, relative); assert(file.startsWith(root + path.sep));
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/json');
      res.end(await fs.readFile(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
  await fs.mkdir(path.join(root, 'test-artifacts'), { recursive: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const errors = [];
    for (const game of ['astra', 'qwen']) {
      console.log(`Testing ${game}…`);
      const page = await context.newPage(); page.on('pageerror', e => errors.push(`${game}: ${e.message}`));
      page.on('console', m => { if (m.type() === 'error' && !m.text().includes('404')) errors.push(`${game}: ${m.text()}`); });
      page.on('dialog', d => d.accept());
      const button = (action, slot) => page.getByRole('button', { name: `${action} slot ${slot}`, exact: true });
      const message = text => page.waitForFunction(text => { const root = document.querySelector('#showcase-saves').shadowRoot; return !root.getElementById('slots').inert && root.getElementById('message').textContent.includes(text); }, text);
      await page.goto(`${url}/${game}/`);
      await page.waitForFunction(() => !!window.ShowcaseSaves?.adapter);
      if (game === 'astra') { await page.waitForFunction(() => !document.getElementById('enter').disabled); await page.locator('#enter').click(); }
      else await page.locator('#instructions').click();
      await page.waitForFunction(() => ShowcaseSaves.adapter.ready());
      await page.keyboard.press('F6'); await message('paused');
      assert.equal(await page.evaluate(() => ShowcaseSaves.paused), true);
      // Prepare a nontrivial checkpoint far from spawn using actual game state.
      await page.evaluate(async game => {
        const S = ShowcaseSaves, fixture = S.clone(S.adapter.capture());
        if (game === 'astra') {
          fixture.player.pos = { x: -1040.5, y: 80, z: 1104.5 }; fixture.player.hp = 13; fixture.player.regen = 2;
          fixture.player.vel = { x: 0, y: -2, z: 0 }; fixture.player.ground = false; fixture.player.fallY = 82;
          fixture.time = 0.7; fixture.day = 8; fixture.selected = 3; fixture.ui = true; fixture.gridSize = 3;
          fixture.inv[3] = { id: '10', n: 17 }; fixture.craft = Array(9).fill(null); fixture.craft[0] = { id: '9', n: 2 }; fixture.cursor = { id: 'stick', n: 4 };
          fixture.mobs = []; fixture.drops = []; fixture.spawned = [];
          await S.adapter.restore(fixture);
          setBlock(-1040, 79, 1104, 4); setBlock(-1041, 80, 1104, 14); setBlock(-1039, 79, 1104, 0);
          const m = createMob('creeper', -1038, 80, 1104); m.hp = 6; m.fuse = 0.8;
          spawnDrop('coal', -1043, 81, 1104, 3); drops.at(-1).age = 4;
        } else {
          Object.assign(fixture.player, { x: -1040.5, y: 80, z: 1104.5, health: 13, regenT: 2, vx: 0, vy: -2, vz: 0, onGround: false });
          fixture.timeOfDay = 0.8; fixture.selectedSlot = 3; fixture.invOpen = true; fixture.craftType = 3; fixture.gridSize = 3;
          fixture.inventory[3] = { item: 'cobble', n: 17 }; fixture.craft = Array(9).fill(null); fixture.craft[0] = { item: 'wood', n: 2 }; fixture.heldStack = { item: 'stick', n: 4 };
          fixture.mobs = []; fixture.drops = [{ item: 'coal', n: 3, x: -1043, y: 81, z: 1104, vx: 0.3, vy: -1, vz: 0, life: 25, age: 5 }];
          await S.adapter.restore(fixture);
          setOverride(-1040, 79, 1104, B.COBBLE); setOverride(-1041, 80, 1104, B.TORCH); setOverride(-1039, 79, 1104, B.AIR);
          rebuildAround(-1040, 1104);
          const m = new Mob('creeper', -1038, 80, 1104); m.hp = 6; m.fuseT = 0.8; mobs.push(m);
        }
        // An unloaded edit must survive as well.
        if (game === 'astra') {
          overrides.set('5000,70,5000', 10); editsByChunk.set('312,312', new Map([[index(8,70,8),10]]));
        } else setOverride(5000, 70, 5000, B.PLANKS);
      }, game);
      const saved = await page.evaluate(() => ShowcaseSaves.snapshot('Discovery').state);
      await page.getByRole('textbox', { name: 'Slot 1 name', exact: true }).fill('Discovery');
      await button('Save', 1).click(); await message('Saved.');
      const frozen = await page.evaluate(() => ShowcaseSaves.snapshot('test').state);
      await page.keyboard.type('e123wasd'); await page.keyboard.press('Space'); await delay(150);
      assert.deepEqual(await page.evaluate(() => ShowcaseSaves.snapshot('test').state), frozen, `${game}: panel freezes all gameplay and consumes game shortcuts`);
      // Second independent slot.
      await page.getByRole('textbox', { name: 'Slot 2 name', exact: true }).fill('Second checkpoint');
      await button('Save', 2).click(); await message('Saved.');
      // Browser download is a portable record, not the storage ID/revision.
      const downloading = page.waitForEvent('download'); await button('Export', 1).click();
      const download = await downloading, exported = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
      assert.equal(exported.name, 'Discovery'); assert.equal(exported.id, undefined); assert.equal(exported.revision, undefined);
      // Reload page and restore from persistent IndexedDB before starting play.
      await page.reload(); await page.waitForFunction(() => !!window.ShowcaseSaves?.adapter);
      await page.getByRole('button', { name: 'Saves · F6', exact: true }).click();
      await button('Load', 1).click(); await message('Loaded');
      const normalized = state => { const s = structuredClone(state); if (s.spawned) s.spawned.sort(); return s; };
      assert.deepEqual(normalized(await page.evaluate(() => ShowcaseSaves.snapshot('test').state)), normalized(saved), `${game}: complete checkpoint round trip across reload`);
      assert.equal(await page.evaluate(game => game === 'astra' ? get(-1041,80,1104) : getBlockFinal(-1041,80,1104), game), 14);
      assert.equal(await page.evaluate(game => game === 'astra' ? get(-1039,79,1104) : getBlockFinal(-1039,79,1104), game), 0);
      await button('Load', 1).click(); await message('Loaded');
      assert.deepEqual(normalized(await page.evaluate(() => ShowcaseSaves.snapshot('test').state)), normalized(saved), `${game}: repeated load does not duplicate mobs or drops`);
      // Regenerating at an unloaded edit must apply it to the real chunk.
      await page.evaluate(async game => {
        const state = ShowcaseSaves.clone(ShowcaseSaves.adapter.capture());
        if (game === 'astra') state.player.pos = { x: 5000.5, y: 72, z: 5000.5 };
        else Object.assign(state.player, { x: 5000.5, y: 72, z: 5000.5 });
        await ShowcaseSaves.adapter.restore(state);
        const block = game === 'astra' ? get(5000,70,5000) : getBlockFinal(5000,70,5000);
        if (block !== 10) throw new Error('Unloaded block edit was lost');
      }, game);
      await button('Load', 1).click(); await message('Loaded');
      await page.screenshot({ path: path.join(root, 'test-artifacts', `${game}-saves.png`) });
      // Import malformed/cross-game records without damaging an occupied slot.
      const upload = async (slot, payload) => {
        await button('Import', slot).click();
        await page.locator('#showcase-saves').locator('#file').setInputFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) });
      };
      await upload(2, { ...exported, game: game === 'astra' ? 'qwen' : 'astra' }); await message('different game');
      await upload(2, { ...exported, state: {} }); await message('Invalid');
      await upload(2, { ...exported, source: 'unknown' }); await message('different game');
      assert.equal(await page.getByRole('textbox', { name: 'Slot 2 name', exact: true }).inputValue(), 'Second checkpoint');
      await upload(3, exported); await message('Imported.');
      await button('Load', 3).click(); await message('Loaded');
      assert.deepEqual(normalized(await page.evaluate(() => ShowcaseSaves.snapshot('test').state)), normalized(saved));
      await button('Delete', 3).click(); await message('Deleted.'); assert(await button('Load', 3).isDisabled());
      // The previous record survives failed writes.
      await page.evaluate(() => { window.originalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('Test full storage', 'QuotaExceededError'); }; });
      await button('Save', 1).click(); await message('Save failed');
      await page.evaluate(() => { IDBObjectStore.prototype.put = window.originalPut; });
      await button('Load', 1).click(); await message('Loaded');
      // Another tab changes the record after this panel read it.
      await page.evaluate(async () => {
        const [entry] = await indexedDB.databases();
        const database = await new Promise((resolve, reject) => { const r = indexedDB.open(entry.name); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
        await new Promise((resolve, reject) => {
          const tx = database.transaction('saves', 'readwrite'), store = tx.objectStore('saves'), r = store.get(`${ShowcaseSaves.adapter.id}:0`);
          r.onsuccess = () => store.put({ ...r.result, name: 'Changed elsewhere', revision: 'other-tab' });
          tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
        }); database.close();
      });
      await button('Save', 1).click(); await message('another tab');
      await button('Load', 1).click(); await message('Changed elsewhere');
      // Invalid numeric state and wrong seeds fail before touching the game.
      await page.evaluate(exported => {
        for (const mutate of [s => { s.seed++; }, s => { s.state.yaw = null; }, s => { s.state.edits = [['0,999,0', 1]]; }]) {
          const record = ShowcaseSaves.clone(exported); mutate(record);
          let rejected = false; try { ShowcaseSaves.validate(record); } catch { rejected = true; }
          if (!rejected) throw new Error('Malformed checkpoint accepted');
        }
      }, exported);
      // The dead-player checkpoint restores its death UI and can be respawned.
      const deathRecord = structuredClone(exported);
      if (game === 'astra') { deathRecord.state.dead = true; deathRecord.state.ui = false; deathRecord.state.player.hp = 0; }
      else { deathRecord.state.player.dead = true; deathRecord.state.invOpen = false; deathRecord.state.player.health = 0; }
      await upload(4, deathRecord); await message('Imported.'); await button('Load', 4).click(); await message('Loaded');
      assert.equal(await page.evaluate(game => game === 'astra' ? !document.getElementById('death').classList.contains('hidden') : document.getElementById('death-screen').style.display === 'flex', game), true);
      await button('Load', 1).click(); await message('Changed elsewhere');
      // Resume into the restored inventory without resetting its crafting slots.
      await page.getByRole('button', { name: 'Continue', exact: true }).click();
      assert.equal(await page.evaluate(() => ShowcaseSaves.paused), false);
      assert.equal(await page.evaluate(game => game === 'astra' ? ui : invOpen, game), true);
      await page.screenshot({ path: path.join(root, 'test-artifacts', `${game}-restored.png`) });
      // Now resume physics and check the game loop still runs.
      await page.keyboard.press('KeyE');
      if (game === 'qwen') { await page.keyboard.press('F6'); await message('paused'); await page.getByRole('button', { name: 'Continue', exact: true }).click(); }
      const beforeY = await page.evaluate(game => game === 'astra' ? player.pos.y : player.y, game);
      await page.waitForTimeout(250);
      assert.notEqual(await page.evaluate(game => game === 'astra' ? player.pos.y : player.y, game), beforeY, `${game}: restored falling player resumes physics`);
      await page.keyboard.press('F6'); await message('paused');
      assert.equal(await page.evaluate(() => ShowcaseSaves.adapter.ready()), true);
      await page.close(); console.log(`PASS ${game}: persistence, full state, repeated restore, pause, slots, import/export, validation, write failure, resume`);
    }
    // A browser that refuses storage still gets a usable panel and Continue.
    const denied = await browser.newContext();
    await denied.addInitScript(() => { indexedDB.open = () => { throw new DOMException('Storage denied', 'SecurityError'); }; });
    const deniedPage = await denied.newPage(); await deniedPage.goto(`${url}/qwen/`);
    await deniedPage.getByRole('button', { name: 'Saves · F6', exact: true }).click();
    await deniedPage.waitForFunction(() => document.querySelector('#showcase-saves').shadowRoot.getElementById('message').textContent.includes('Storage denied'));
    await deniedPage.getByRole('button', { name: 'Continue', exact: true }).click();
    assert.equal(await deniedPage.evaluate(() => ShowcaseSaves.paused), false); await denied.close();
    assert.deepEqual(errors, [], 'No JavaScript/WebGL game errors');
    await context.close();
    console.log('PASS original snapshot hashes');
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
