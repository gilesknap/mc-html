/* Showcase adapter for Claude's preserved Voxel Craft source. */
(() => {
  'use strict';
  const S = ShowcaseSaves;
  const playerNumbers = ['health', 'maxHealth', 'regenTimer', 'hurtCooldown', 'attackCooldown', 'walkTime', 'stepTimer'];
  const playerFlags = ['onGround', 'inWater', 'headInWater', 'dead', 'autoJump'];
  const mobNumbers = ['health', 'yaw', 'timer', 'animT', 'hurtTimer', 'fuse', 'attackCd', 'burnTimer', 'soundTimer'];
  const mobFlags = ['onGround', 'autoJump'];
  const dropNumbers = ['age', 'pickupDelay'];
  const vector = v => S.pick(v, ['x', 'y', 'z']);
  const optionalVector = v => v === null ? null : vector(v);
  const copyVector = v => v === null ? null : new THREE.Vector3(v.x, v.y, v.z);
  const item = value => {
    S.check(value && Number.isInteger(value.id) && value.id !== B.AIR && Object.hasOwn(DEFS, value.id));
    S.integer(value.count, 1, DEFS[value.id].stack);
  };
  const stack = value => { if (value !== null) { item(value); S.integer(value.dura, 0, DEFS[value.id].durability || 0); } };
  let restoredSpawned = new Set();
  const originalSpawn = Mobs.spawnPassiveInChunk;
  Mobs.spawnPassiveInChunk = function (chunk) {
    if (restoredSpawned.delete(chunkKey(chunk.cx, chunk.cz))) { chunk.mobsSpawned = true; return; }
    originalSpawn.call(this, chunk);
  };
  const adapter = {
    id: 'claude', title: 'Claude / Voxel Craft', seed: WORLD_SEED,
    source: '62b8e4a9fb3a629a0e270eaed2389fcdb514d6923d03b73e321941c758a31abf',
    ready: () => !!world.chunkAt(player.pos.x, player.pos.z)?.generated,
    pause() { for (const key of Object.keys(keys)) delete keys[key]; for (const key of Object.keys(mouse)) mouse[key] = false; pointerLocked = false; },
    resume() { if (!uiOpen && !player.dead && adapter.ready()) { Audio.init(); canvas.requestPointerLock(); } },
    capture() {
      return { player: { ...S.pick(player, [...playerNumbers, ...playerFlags, 'fallStart']), pos: vector(player.pos), vel: vector(player.vel), spawn: vector(player.spawn) },
        yaw: player.yaw, pitch: player.pitch, time: DayNight.time, spawnTimer: Mobs.spawnTimer,
        selected: Inventory.selected, inventory: Inventory.slots, cursor: Inventory.cursor,
        grid2: Crafting.grid2, grid3: Crafting.grid3, uiOpen,
        edits: [...world.overrides],
        spawned: [...new Set([...restoredSpawned, ...[...world.chunks.values()].filter(c => c.mobsSpawned).map(c => chunkKey(c.cx, c.cz))])],
        mobs: Mobs.list.map(m => ({ type: m.type, ...S.pick(m, [...mobNumbers, ...mobFlags, 'state']), pos: vector(m.pos), vel: vector(m.vel), target: optionalVector(m.target), fleeFrom: optionalVector(m.fleeFrom) })),
        drops: Items.list.map(d => ({ ...S.pick(d, [...dropNumbers, 'id', 'count', 'onGround', 'autoJump']), pos: vector(d.pos), vel: vector(d.vel) })) };
    },
    validate(s) {
      S.fields(s, ['yaw', 'pitch', 'time', 'spawnTimer']); S.check(s.time >= 0 && s.time < 1 && Math.abs(s.pitch) <= Math.PI / 2);
      S.check([null, 'inventory', 'crafting'].includes(s.uiOpen)); S.integer(s.selected, 0, 8);
      S.fields(s.player, playerNumbers, playerFlags); S.check(s.player.fallStart === null || S.number(s.player.fallStart));
      S.check(s.player.maxHealth === 20 && s.player.health >= 0 && s.player.health <= 20 && (s.player.dead || s.player.health > 0));
      for (const key of ['pos', 'vel', 'spawn']) S.vector(s.player[key]);
      for (const [key, length] of [['inventory', 36], ['grid2', 4], ['grid3', 9]]) { S.list(s[key], length, stack); S.check(s[key].length === length); }
      stack(s.cursor); S.edits(s.edits, WORLD_HEIGHT, B.JUNGLE_LEAVES);
      S.list(s.spawned, 10000, key => S.check(typeof key === 'string' && /^-?\d+,-?\d+$/.test(key) && key.split(',').every(v => Math.abs(Number(v)) <= 10000000)));
      S.list(s.mobs, MAX_MOBS, m => {
        S.check(typeof m.type === 'string' && Object.hasOwn(MOB_TYPES, m.type) && ['idle', 'walk', 'chase', 'flee'].includes(m.state));
        S.fields(m, mobNumbers, mobFlags); S.vector(m.pos); S.vector(m.vel);
        for (const key of ['target', 'fleeFrom']) if (m[key] !== null) S.vector(m[key]);
      });
      S.list(s.drops, 10000, d => { item(d); S.fields(d, dropNumbers, ['onGround', 'autoJump']); S.vector(d.pos); S.vector(d.vel); });
    },
    async restore(s) {
      adapter.validate(s); adapter.pause();
      for (const c of world.chunks.values()) disposeChunkMesh(c);
      world.chunks.clear(); world.dirtyChunks.clear(); world.overrides.clear();
      ChunkManager.genQueue.length = 0; ChunkManager.lastCX = ChunkManager.lastCZ = null;
      Lighting.skyQueue.length = Lighting.lightQueue.length = 0;
      for (const [key, id] of s.edits) world.overrides.set(key, id);
      for (const m of Mobs.list.slice()) Mobs.remove(m);
      while (Items.list.length) Items.remove(Items.list.length - 1);
      Particles.list.length = 0; Particles.mesh.instanceMatrix.array.fill(0); Particles.mesh.instanceMatrix.needsUpdate = true;
      Object.assign(player, S.pick(s.player, [...playerNumbers, ...playerFlags, 'fallStart']));
      for (const key of ['pos', 'vel', 'spawn']) player[key].copy(s.player[key]);
      player.yaw = s.yaw; player.pitch = s.pitch; DayNight.time = s.time; Mobs.spawnTimer = s.spawnTimer;
      Inventory.selected = s.selected; Inventory.cursor = S.clone(s.cursor);
      // UI click handlers retain these array references, so replace their contents.
      for (const [array, saved] of [[Inventory.slots, s.inventory], [Crafting.grid2, s.grid2], [Crafting.grid3, s.grid3]]) array.splice(0, array.length, ...S.clone(saved));
      uiOpen = s.uiOpen; Mining.target = Mining.targetKey = null; Mining.progress = 0;
      currentHit = currentMobHit = currentHitPrev = null; outlineMesh.visible = crackMesh.visible = false;
      restoredSpawned = new Set(s.spawned);
      const cx = Math.floor(player.pos.x / 16), cz = Math.floor(player.pos.z / 16);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const c = new Chunk(cx + dx, cz + dz), key = chunkKey(c.cx, c.cz);
        world.chunks.set(key, c); generateChunk(c); c.mobsSpawned = true; restoredSpawned.delete(key); await S.tick();
      }
      for (const c of world.chunks.values()) { Lighting.initChunk(c); await S.tick(); }
      for (const c of world.chunks.values()) { applyChunkMesh(c); await S.tick(); }
      world.dirtyChunks.clear();
      for (const saved of s.mobs) {
        const m = Mobs.spawn(saved.type, saved.pos.x, saved.pos.y, saved.pos.z);
        Object.assign(m, S.pick(saved, [...mobNumbers, ...mobFlags, 'state'])); m.vel.copy(saved.vel);
        m.target = copyVector(saved.target); m.fleeFrom = copyVector(saved.fleeFrom); m.group.position.copy(m.pos); m.group.rotation.y = m.yaw;
      }
      // Items.spawn merges nearby stacks. Keep each restored entity separate
      // while reusing the author's mesh constructor and its original materials.
      const restoredDrops = [];
      for (const saved of s.drops) {
        const d = Items.spawn(saved.pos.x, saved.pos.y, saved.pos.z, saved.id, saved.count); Items.list.pop();
        Object.assign(d, S.pick(saved, [...dropNumbers, 'onGround', 'autoJump'])); d.vel.copy(saved.vel);
        d.mesh.position.set(d.pos.x, d.pos.y + 0.15 + Math.sin(d.age * 2) * 0.05, d.pos.z); d.mesh.rotation.y = d.age * 1.5; restoredDrops.push(d);
      }
      Items.list.push(...restoredDrops);
      document.getElementById('overlay').style.display = 'none'; document.getElementById('death').style.display = player.dead ? 'flex' : 'none';
      document.getElementById('inventoryScreen').classList.toggle('open', uiOpen === 'inventory');
      document.getElementById('craftingScreen').classList.toggle('open', uiOpen === 'crafting');
      UI.cursorEl.style.display = 'none'; UI.refresh(); HUD.updateHotbar(); HUD.updateHearts();
      document.getElementById('damageFlash').style.opacity = '0'; document.getElementById('waterTint').style.opacity = player.headInWater ? '1' : '0';
      camera.position.set(player.pos.x, player.pos.y + PLAYER_EYE, player.pos.z); camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
      DayNight.update(0); HeldItem.update(0); lastTime = performance.now(); renderer.clear(); renderer.render(scene, camera);
    }
  };
  S.register(adapter);
})();
