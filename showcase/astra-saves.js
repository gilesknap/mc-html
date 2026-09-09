/* Adapter for the preserved Wildwood snapshot. Classic script intentionally
 * shares its lexical scope without moving or rewriting the original game. */
(() => {
  'use strict';
  const S = ShowcaseSaves;
  const playerNumbers = ['hp', 'hurt', 'regen', 'fallY'];
  const mobNumbers = ['hp', 'heading', 'timer', 'flee', 'flash', 'fuse', 'attack', 'phase'];
  const dropNumbers = ['n', 'age'];
  const mobTypes = ['cow', 'pig', 'sheep', 'chicken', 'zombie', 'creeper'];
  let restoredSpawned = new Set();
  const originalSpawnAnimals = spawnAnimals;
  spawnAnimals = function (chunk) {
    if (restoredSpawned.delete(chunk.key)) return;
    originalSpawnAnimals(chunk);
  };
  const stack = value => {
    if (value === null) return;
    S.check(value && typeof value.id === 'string' && Object.hasOwn(items, value.id));
    S.integer(value.n, 1, capacity(value.id));
  };
  const vectorState = value => ({ ...S.pick(value, playerNumbers), ground: value.ground, pos: S.pick(value.pos, ['x', 'y', 'z']), vel: S.pick(value.vel, ['x', 'y', 'z']) });
  const adapter = {
    id: 'astra', title: 'Wildwood', seed: SEED,
    source: '485afe06b5483b96ea61678afc9e8ce164847d182837aad496f99606df683422',
    ready: () => ready && started,
    pause() { keys.clear(); mining = false; },
    resume() { if (started && !ui && !dead) lock(); },
    capture() {
      return { player: vectorState(player), yaw, pitch, time, day, selected, dead, ui, gridSize, craft, cursor, inv,
        spawnTimer, attackCooldown,
        edits: [...overrides],
        spawned: [...new Set([...restoredSpawned, ...[...chunks.values()].filter(c => c.spawned).map(c => c.key)])],
        mobs: mobs.map(m => ({ type: m.type, ...S.pick(m, mobNumbers), ground: m.ground, pos: S.pick(m.pos, ['x', 'y', 'z']), vel: S.pick(m.vel, ['x', 'y', 'z']) })),
        drops: drops.map(d => ({ id: d.id, ...S.pick(d, dropNumbers), ground: d.ground, pos: S.pick(d.pos, ['x', 'y', 'z']), vel: S.pick(d.vel, ['x', 'y', 'z']) })) };
    },
    validate(s) {
      S.fields(s, ['yaw', 'pitch', 'time', 'spawnTimer', 'attackCooldown'], ['dead', 'ui']);
      S.check(s.time >= 0 && s.time < 1 && Math.abs(s.pitch) <= 1.55);
      S.integer(s.day, 1, 10000000); S.integer(s.selected, 0, 8); S.check([2, 3].includes(s.gridSize));
      S.fields(s.player, playerNumbers, ['ground']); S.vector(s.player.pos); S.vector(s.player.vel);
      S.check(s.player.hp <= 20 && (s.dead || s.player.hp > 0));
      S.list(s.inv, 36, stack); S.check(s.inv.length === 36);
      S.list(s.craft, 9, stack); S.check(s.craft.length === s.gridSize ** 2 || (!s.ui && s.craft.length === 0)); stack(s.cursor);
      S.edits(s.edits, H, BEDROCK);
      S.list(s.spawned, 10000, key => S.check(typeof key === 'string' && /^-?\d+,-?\d+$/.test(key) && key.split(',').every(v => Math.abs(Number(v)) <= 10000000)));
      S.list(s.mobs, 40, m => { S.check(mobTypes.includes(m.type)); S.fields(m, mobNumbers, ['ground']); S.vector(m.pos); S.vector(m.vel); });
      S.list(s.drops, 10000, d => { stack(d); S.fields(d, dropNumbers, ['ground']); S.vector(d.pos); S.vector(d.vel); });
    },
    async restore(s) {
      adapter.validate(s);
      // Drain the one outstanding worker reply before clearing caches. The
      // paused frame and empty queue cannot submit work from the old world.
      genQueue.length = 0;
      const deadline = performance.now() + 15000;
      while (workerBusy) { S.check(performance.now() < deadline, 'Terrain worker did not finish. Try loading again.'); await new Promise(resolve => setTimeout(resolve, 10)); }
      for (const c of chunks.values()) for (const mesh of [c.mesh, c.water]) if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
      chunks.clear(); meshQueue.clear(); lightDirty.clear(); lightJobs.length = 0; overrides.clear(); editsByChunk.clear();
      for (const [key, id] of s.edits) {
        overrides.set(key, id);
        const [x, y, z] = key.split(',').map(Number), cx = Math.floor(x / 16), cz = Math.floor(z / 16), key2 = ck(cx, cz);
        if (!editsByChunk.has(key2)) editsByChunk.set(key2, new Map());
        editsByChunk.get(key2).set(index(x - cx * 16, y, z - cz * 16), id);
      }
      while (mobs.length) removeMob(mobs.length - 1);
      drops.forEach(d => discardItemMesh(d.mesh)); drops.length = 0;
      particles.forEach(p => scene.remove(p.mesh)); particles.length = 0;
      Object.assign(player, S.pick(s.player, [...playerNumbers, 'ground']));
      player.pos.copy(s.player.pos); player.vel.copy(s.player.vel);
      yaw = s.yaw; pitch = s.pitch; time = s.time; day = s.day; selected = s.selected; dead = s.dead;
      ui = s.ui; gridSize = s.gridSize; craft = S.clone(s.craft); cursor = S.clone(s.cursor); inv.splice(0, inv.length, ...S.clone(s.inv));
      spawnTimer = s.spawnTimer; attackCooldown = s.attackCooldown;
      keys.clear(); mining = false; mineProgress = 0; mineKey = ''; target = null; outline.visible = false; $('mine').style.display = 'none';
      restoredSpawned = new Set(s.spawned);
      // Build the collision neighborhood before allowing play. Remaining chunks
      // continue through the author's worker/lighting/meshing pipeline.
      const cx = Math.floor(player.pos.x / 16), cz = Math.floor(player.pos.z / 16);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, z = cz + dz, result = generate(x, z), key = ck(x, z);
        const c = { ...result, cx: x, cz: z, key, sky: new Uint8Array(24576), block: new Uint8Array(24576), mesh: null, water: null, spawned: true };
        for (const [i, id] of editsByChunk.get(key) || []) c.data[i] = id;
        chunks.set(key, c); restoredSpawned.delete(key); await S.tick();
      }
      for (let pass = 0; pass < 2; pass++) for (const c of chunks.values()) relight(c);
      for (const c of chunks.values()) { meshChunk(c); await S.tick(); }
      for (const saved of s.mobs) {
        const m = createMob(saved.type, saved.pos.x, saved.pos.y, saved.pos.z);
        Object.assign(m, S.pick(saved, [...mobNumbers, 'ground'])); m.vel.copy(saved.vel); m.group.rotation.y = m.heading + Math.PI;
      }
      for (const saved of s.drops) {
        spawnDrop(saved.id, saved.pos.x, saved.pos.y, saved.pos.z, saved.n);
        const d = drops[drops.length - 1]; Object.assign(d, S.pick(saved, [...dropNumbers, 'ground'])); d.vel.copy(saved.vel);
      }
      started = true; ready = true; $('enter').disabled = false;
      for (const id of ['intro', 'veil', 'guide', 'introBottom']) $(id).classList.add('hidden');
      $('playHUD').classList.remove('hidden'); $('death').classList.toggle('hidden', !dead); $('inventory').classList.toggle('hidden', !ui);
      $('inventoryTitle').textContent = gridSize === 3 ? 'Crafting table' : 'Inventory';
      $('tooltip').style.display = 'none'; renderRecipeBook(); renderInventory(); hearts(); updateHeld();
      camera.position.copy(player.pos).add(new THREE.Vector3(0, 1.62, 0)); camera.rotation.set(pitch, yaw, 0); atmosphere(0); updateCompass();
      refreshChunks(); previous = performance.now(); renderer.autoClear = true; renderer.render(scene, camera);
    }
  };
  S.register(adapter);
})();
