/* Showcase save support, added after the original Astra and Qwen runs. */
(() => {
  'use strict';
  const base = new URL('../', document.currentScript.src);
  const clone = value => JSON.parse(JSON.stringify(value));
  const pick = (value, fields) => Object.fromEntries(fields.map(key => [key, value[key]]));
  const check = (ok, message = 'Invalid or incompatible save file.') => { if (!ok) throw new Error(message); };
  const number = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e9;
  const fields = (value, numbers = [], booleans = []) => {
    check(value && typeof value === 'object' && !Array.isArray(value));
    numbers.forEach(key => check(number(value[key])));
    booleans.forEach(key => check(typeof value[key] === 'boolean'));
  };
  const vector = value => fields(value, ['x', 'y', 'z']);
  const list = (value, limit, validate) => { check(Array.isArray(value) && value.length <= limit); value.forEach(validate); };
  const integer = (value, min, max) => check(Number.isInteger(value) && value >= min && value <= max);
  const edits = (value, height, maxBlock) => list(value, 500000, entry => {
    check(Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string');
    check(/^-?\d+,-?\d+,-?\d+$/.test(entry[0]));
    const xyz = entry[0].split(',').map(Number);
    xyz.forEach(v => integer(v, -10000000, 10000000));
    integer(xyz[1], 0, height - 1); integer(entry[1], 0, maxBlock);
  });
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));
  const api = window.ShowcaseSaves = { paused: false, clone, pick, check, number, fields, vector, list, integer, edits, tick };

  api.register = adapter => {
    api.adapter = adapter;
    let database, busy = false, restoreFailed = false, rows = [], selectedImport = 0;
    const db = () => database || (database = new Promise((resolve, reject) => {
      const request = indexedDB.open(`two-worlds-saves:${base.pathname}`, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('saves', { keyPath: 'id' });
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
      request.onerror = () => reject(new Error('Browser storage is unavailable. Check your browser’s storage settings.'));
      request.onblocked = () => reject(new Error('Close other Two Worlds tabs and try again.'));
    }).catch(error => { database = null; throw error; }));
    const read = async slot => new Promise((resolve, reject) => {
      db().then(database => {
        const request = database.transaction('saves').objectStore('saves').get(`${adapter.id}:${slot}`);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }, reject);
    });
    // Compare the displayed revision inside the write transaction: another tab
    // must not silently overwrite a slot between our prompt and the write.
    const write = async (slot, value, expected) => {
      const database = await db();
      return new Promise((resolve, reject) => {
        const tx = database.transaction('saves', 'readwrite'), store = tx.objectStore('saves');
        let conflict = false;
        const request = store.get(`${adapter.id}:${slot}`);
        request.onsuccess = () => {
          if (request.result?.revision !== expected) { conflict = true; tx.abort(); return; }
          try {
            if (value) store.put({ ...value, id: `${adapter.id}:${slot}`, revision: crypto.randomUUID() });
            else store.delete(`${adapter.id}:${slot}`);
          } catch { tx.abort(); }
        };
        tx.oncomplete = resolve;
        tx.onabort = tx.onerror = () => reject(new Error(conflict ? 'This slot changed in another tab. Reopen Saves and try again.' : 'Save failed. Browser storage may be full or unavailable. The previous save was kept.'));
      });
    };
    const validate = value => {
      check(value && value.format === 'two-worlds-save' && value.version === 1 && value.game === adapter.id && value.source === adapter.source && value.seed === adapter.seed,
        'This save belongs to a different game or an unsupported game/save version.');
      check(typeof value.name === 'string' && value.name.length <= 80 && typeof value.savedAt === 'string' && Number.isFinite(Date.parse(value.savedAt)));
      adapter.validate(value.state);
      return value;
    };
    const snapshot = name => validate({ format: 'two-worlds-save', version: 1, game: adapter.id, source: adapter.source, seed: adapter.seed, name, savedAt: new Date().toISOString(), state: clone(adapter.capture()) });
    api.snapshot = snapshot;
    api.validate = validate;

    const host = document.createElement('div'); host.id = 'showcase-saves';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      :host{all:initial;font:14px/1.5 system-ui,sans-serif;color:#eef2e6;position:fixed;right:20px;top:90px;z-index:2147483647}
      *{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer;border:1px solid #829480;background:#243d32;color:#eef2e6;border-radius:5px;padding:7px 12px}button:hover{background:#395541}button:disabled{opacity:.4;cursor:default}button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid #e4efa6;outline-offset:2px}
      dialog{color:#eef2e6;background:#17291f;border:1px solid #829480;border-radius:10px;padding:24px;width:min(760px,95vw);max-height:90vh;overflow:auto}dialog::backdrop{background:#07110bd9}h2{margin:0;font-size:24px}p{margin:8px 0 16px;color:#c4d2bf}a{color:#dceaa8}header{display:flex;justify-content:space-between;gap:20px;align-items:start}.slot{border-top:1px solid #62715a;padding:14px 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap}.info{flex:1;min-width:180px}.actions{display:flex;gap:6px;flex-wrap:wrap}input{background:#0d1e14;color:#eef2e6;border:1px solid #829480;border-radius:4px;padding:6px;width:100%}small{display:block;color:#bdcbb6;margin-top:4px}#message{min-height:24px;margin-bottom:0}footer{margin-top:12px;font-size:12px;color:#bdcbb6}
    </style><button id="open" title="Open saves (F6)">Saves · F6</button>
    <dialog aria-labelledby="title"><header><h2 id="title">${adapter.title} saves</h2><button id="continue">Continue</button></header>
    <p>Five checkpoints in this browser. Export a save to keep a backup or share a discovery.</p><div id="slots"></div><p id="message" role="status" aria-live="polite"></p>
    <footer>Showcase save support added after the original game. <a href="${new URL(`originals/${adapter.id}.html`, base)}" download>Download original HTML</a><br>Clearing site data removes browser saves. Saves resume a situation; future random events may differ.</footer>
    <input id="file" type="file" accept=".json,application/json" hidden></dialog>`;
    document.body.append(host);
    const get = id => root.getElementById(id), dialog = root.querySelector('dialog');
    const message = text => { get('message').textContent = text; };
    const render = async () => {
      rows = await Promise.all(Array.from({ length: 5 }, (_, slot) => read(slot)));
      get('slots').replaceChildren();
      rows.forEach((save, slot) => {
        const row = document.createElement('div'); row.className = 'slot';
        const info = document.createElement('div'); info.className = 'info';
        const name = document.createElement('input'); name.maxLength = 80; name.value = save?.name || `Save ${slot + 1}`; name.setAttribute('aria-label', `Slot ${slot + 1} name`);
        const detail = document.createElement('small'); detail.textContent = `${slot + 1} · ${save ? new Date(save.savedAt).toLocaleString() : 'Empty slot'}`;
        info.append(name, detail); row.append(info);
        const actions = document.createElement('div'); actions.className = 'actions';
        for (const action of ['Save', 'Load', 'Export', 'Import', 'Delete']) {
          const button = document.createElement('button'); button.textContent = action; button.setAttribute('aria-label', `${action} slot ${slot + 1}`);
          button.disabled = (['Load', 'Export', 'Delete'].includes(action) && !save) || (action === 'Save' && !adapter.ready());
          button.onclick = () => run(async () => {
            if (action === 'Save') {
              if (save && !confirm(`Overwrite “${save.name}”?`)) return;
              await write(slot, snapshot(name.value.trim() || `Save ${slot + 1}`), save?.revision);
              await render(); message('Saved.');
            } else if (action === 'Load') {
              if (!confirm(`Load “${save.name}”? Unsaved progress will be replaced.`)) return;
              const current = validate(await read(slot));
              const backup = adapter.ready() ? clone(adapter.capture()) : null;
              try { await adapter.restore(clone(current.state)); restoreFailed = false; }
              catch (error) {
                if (backup) { try { await adapter.restore(backup); } catch { restoreFailed = true; throw new Error('Restore failed. Keep this panel open and reload the page before continuing. Stored saves are unchanged.'); } }
                throw error;
              }
              await render(); message(`Loaded “${current.name}”. Choose Continue when ready.`);
            } else if (action === 'Export') {
              const { id, revision, ...value } = validate(await read(slot));
              const url = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: 'application/json' }));
              const link = document.createElement('a'); link.href = url; link.download = `${adapter.id}-save-${slot + 1}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
              message('Exported save.');
            } else if (action === 'Import') { selectedImport = slot; get('file').value = ''; get('file').click(); }
            else if (confirm(`Delete “${save.name}”?`)) { await write(slot, null, save.revision); await render(); message('Deleted.'); }
          });
          actions.append(button);
        }
        row.append(actions); get('slots').append(row);
      });
    };
    const run = async fn => {
      if (busy) return;
      busy = true; get('continue').disabled = true; get('slots').inert = true;
      try { await fn(); } catch (error) { message(error.message || 'Save operation failed.'); }
      finally { busy = false; get('continue').disabled = restoreFailed; get('slots').inert = false; }
    };
    get('file').onchange = () => run(async () => {
      const file = get('file').files[0]; if (!file) return;
      check(file.size <= 32 * 1024 * 1024, 'Save file is too large (maximum 32 MB).');
      const value = validate(JSON.parse(await file.text())), old = rows[selectedImport];
      if (old && !confirm(`Replace “${old.name}” with imported save “${value.name}”?`)) return;
      await write(selectedImport, value, old?.revision); await render(); message('Imported. Choose Load to explore this save.');
    });
    const open = () => {
      if (dialog.open) return;
      api.paused = true; adapter.pause(); document.exitPointerLock(); dialog.showModal();
      message(adapter.ready() ? 'Game paused.' : 'Load a checkpoint, or Continue and enter the world before saving.');
      run(render);
    };
    const close = () => { if (!busy && !restoreFailed) { dialog.close(); api.paused = false; adapter.resume(); } };
    get('open').onclick = open; get('continue').onclick = close;
    dialog.addEventListener('cancel', event => { if (event.target === dialog) { event.preventDefault(); close(); } });
    // Capture before either game's original listeners; typing names must never
    // move the player, change inventory slots, or open crafting behind the panel.
    for (const type of ['keydown', 'keyup', 'mousedown', 'mouseup', 'mousemove', 'wheel', 'click']) {
      window.addEventListener(type, event => {
        if (type === 'keydown' && event.code === 'F6') { event.preventDefault(); event.stopImmediatePropagation(); if (!event.repeat) dialog.open ? close() : open(); return; }
        if (dialog.open && !event.composedPath().includes(host)) { event.stopImmediatePropagation(); return; }
        if (dialog.open && ['keydown', 'keyup', 'mousemove', 'wheel'].includes(type)) {
          // Shadow DOM handles local input normally; stop the original document
          // and window game listeners after the event reaches the panel.
          // Key events need to reach the focused input for native editing.
          event.stopImmediatePropagation();
        }
      }, true);
    }
    api.open = open;
  };
})();
