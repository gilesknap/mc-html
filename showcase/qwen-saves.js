/* Showcase adapter; the original Voxel Craft source is preserved separately. */
(() => {
  'use strict';
  const S = ShowcaseSaves;
  const playerNumbers = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'health', 'maxHealth', 'spawnX', 'spawnY', 'spawnZ', 'regenT'];
  const playerFlags = ['onGround', 'dead'];
  const mobNumbers = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'hp', 'maxHp', 'fleeT', 'wanderT', 'attackCd', 'fuseT', 'flashT', 'walkT', 'deathT'];
  const mobFlags = ['onGround', 'dead', 'spawned'];
  const dropNumbers = ['x', 'y', 'z', 'vx', 'vy', 'vz', 'n', 'life', 'age'];
  const stack = value => {
    if (value === null) return;
    S.check(value && typeof value.item === 'string' && Object.hasOwn(ITEMS, value.item)); S.integer(value.n, 1, ITEMS[value.item].max);
  };
  const removeMesh = mesh => { scene.remove(mesh); mesh.geometry?.dispose(); if (mesh.material) mesh.material.dispose(); };
  const adapter = {
    id: 'qwen', title: 'Voxel Craft', seed: WSEED,
    source: 'a5ce9750ffe33397aaa06318c19fb211fe31b613efb66e0b2eeb0798cc62ad7c',
    ready: () => [...chunks.values()].some(c => c.generated),
    pause() { for (const key of Object.keys(keys)) delete keys[key]; mining = false; locked = false; },
    resume() { if (!invOpen && !player.dead && adapter.ready()) el.requestPointerLock(); },
    capture() {
      return { player: { ...S.pick(player, [...playerNumbers, ...playerFlags]), regenT: player.regenT || 0 }, yaw, pitch, timeOfDay, selectedSlot,
        inventory, invOpen, craftOpen, craftType, gridSize: craftGrid.size, craft: craftGrid.slots, heldStack,
        edits: Object.entries(overrides),
        mobs: mobs.map(m => ({ type: m.type, ...S.pick(m, [...mobNumbers, ...mobFlags]), wanderTarget: m.wanderTarget ? S.pick(m.wanderTarget, ['x', 'z']) : null })),
        drops: itemDrops.map(d => ({ item: d.item, ...S.pick(d, dropNumbers) })) };
    },
    validate(s) {
      S.fields(s, ['yaw', 'pitch', 'timeOfDay'], ['invOpen', 'craftOpen']);
      S.check(s.timeOfDay >= 0 && s.timeOfDay < 1 && Math.abs(s.pitch) <= 1.55);
      S.integer(s.selectedSlot, 0, 8); S.check([2, 3].includes(s.craftType) && [2, 3].includes(s.gridSize));
      S.fields(s.player, playerNumbers, playerFlags); S.check(s.player.maxHealth === 20 && s.player.health <= 20 && (s.player.dead || s.player.health > 0));
      S.list(s.inventory, 36, stack); S.check(s.inventory.length === 36);
      S.list(s.craft, 9, stack); S.check(s.craft.length === s.gridSize ** 2); stack(s.heldStack);
      S.edits(s.edits, CHUNK_HEIGHT, Math.max(...Object.values(B)));
      S.list(s.mobs, 100, m => { S.check(typeof m.type === 'string' && Object.hasOwn(MOB_TYPES, m.type)); S.fields(m, mobNumbers, mobFlags); if (m.wanderTarget !== null) S.fields(m.wanderTarget, ['x', 'z']); });
      S.list(s.drops, 10000, d => { stack(d); S.fields(d, dropNumbers); });
    },
    async restore(s) {
      adapter.validate(s);
      adapter.pause();
      for (const c of chunks.values()) for (const mesh of [c.mesh, c.waterMesh]) if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); }
      chunks.clear(); chunkQueue.length = 0; queueSet.clear();
      for (const key of Object.keys(overrides)) delete overrides[key];
      for (const [key, id] of s.edits) overrides[key] = id;
      for (const m of [...mobs]) {
        m.despawn();
        const geometries = new Set(), materials = new Set();
        m.mesh.traverse(o => { if (o.isMesh) { geometries.add(o.geometry); for (const material of Array.isArray(o.material) ? o.material : [o.material]) materials.add(material); } });
        geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
      }
      itemDrops.forEach(d => removeMesh(d.mesh)); itemDrops.length = 0;
      particles.forEach(p => removeMesh(p.mesh)); particles.length = 0;
      Object.assign(player, S.pick(s.player, [...playerNumbers, ...playerFlags]));
      yaw = s.yaw; pitch = s.pitch; timeOfDay = s.timeOfDay; selectedSlot = s.selectedSlot;
      inventory.splice(0, inventory.length, ...S.clone(s.inventory));
      invOpen = s.invOpen; craftOpen = s.craftOpen; craftType = s.craftType;
      craftGrid = new CraftGrid(s.gridSize); craftGrid.slots = S.clone(s.craft); heldStack = S.clone(s.heldStack);
      miningTarget = null; miningProgress = 0; crackStage = -1; crackMesh.visible = false;
      const cx = Math.floor(player.x / CHUNK_SIZE), cz = Math.floor(player.z / CHUNK_SIZE);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const c = new Chunk(cx + dx, cz + dz); chunks.set(`${c.cx},${c.cz}`, c); c.generate(); await S.tick();
      }
      for (const saved of s.mobs) {
        const m = new Mob(saved.type, saved.x, saved.y, saved.z);
        Object.assign(m, S.pick(saved, [...mobNumbers, ...mobFlags])); m.wanderTarget = S.clone(saved.wanderTarget); mobs.push(m);
      }
      // The author's spawnItemDrop first tries to collect into inventory. Restore
      // the same drop mesh directly so loading cannot collect or duplicate items.
      for (const saved of s.drops) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x333333 }));
        mesh.position.set(saved.x, saved.y, saved.z); scene.add(mesh);
        itemDrops.push({ item: saved.item, ...S.pick(saved, dropNumbers), mesh });
      }
      instrEl.style.display = 'none'; document.getElementById('inv-screen').style.display = invOpen ? 'block' : 'none';
      document.getElementById('death-screen').style.display = player.dead ? 'flex' : 'none';
      updateHotbar(); updateHearts(); updateHeldItem(); if (invOpen) { renderInventory(); updateCraftResult(); }
      camera.position.set(player.x, player.y + P_EYE, player.z); camera.rotation.order = 'YXZ'; camera.rotation.set(pitch, yaw, 0);
      updateDayNight(0); lastTime = performance.now(); renderer.render(scene, camera);
    }
  };
  S.register(adapter);
})();
