const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../astra/index.html'), 'utf8');
const physics = html.slice(html.indexOf('function overlaps('), html.indexOf('let footstep=0;'));
function world({ manual = false, wall = false, ceiling = false, water = false, airborne = false } = {}) {
  const canvas = {};
  const context = vm.createContext({
    player: { pos: { x: .7, y: 1, z: .5 }, vel: { x: 0, y: 0, z: 0 }, ground: !airborne, fallY: 1 },
    keys: new Set(manual ? ['KeyW', 'Space'] : ['KeyW']),
    yaw: -Math.PI / 2, dead: false, ui: false, WATER: 2,
    document: { pointerLockElement: canvas }, renderer: { domElement: canvas },
    walkPhase: 0, footstep: 0, sound() {}, hurt() { assert.fail('Unexpected fall damage'); },
    loadedAt: () => true, solid: id => id === 1,
    get: (x, y) => y < 1 || (x >= 1 && y >= 1 && y < (wall ? 4 : 2)) || (ceiling && y >= 3) ? 1 : water ? 2 : 0,
  });
  vm.runInContext(physics, context);
  return context;
}
for (const dt of [1 / 120, 1 / 60, 1 / 30, .05]) {
  const auto = world(), manual = world({ manual: true });
  let peak = 1, landed = false;
  for (let frame = 0; frame < Math.ceil(1 / dt); frame++) {
    auto.updatePlayer(dt); manual.updatePlayer(dt);
    manual.keys.delete('Space');
    assert(Math.abs(auto.player.pos.y - manual.player.pos.y) < 1e-10, 'Autojump must match the Space jump arc');
    if (frame === 0) {
      assert(auto.player.pos.y > 1 && auto.player.pos.y < 1.5, 'Takeoff must rise gradually');
      assert.equal(auto.player.ground, false);
    }
    peak = Math.max(peak, auto.player.pos.y);
    if (auto.player.ground && auto.player.pos.y > 1.9) landed = true;
  }
  assert(peak > 2.2 && peak < 2.5, 'Jump should arc above the step');
  assert(landed, 'Player should land on the step');
}
for (const options of [{ wall: true }, { ceiling: true }, { water: true }, { airborne: true }]) {
  const context = world(options);
  context.updatePlayer(1 / 60);
  assert(context.player.vel.y <= 0, `Should not autojump: ${JSON.stringify(options)}`);
  assert(context.player.pos.y <= 1);
}
const mob = world();
mob.player.vel.x = 4.4; mob.player.vel.y = -23 / 60;
mob.moveBody(mob.player, 1 / 60, .3, 1.8, true);
assert(mob.player.pos.y > 1.9, 'Existing mob step behavior should remain intact');
console.log('PASS: Astra autojump matches Space at 20–120 fps; blocked steps, water, airborne movement, and mob stepping');
