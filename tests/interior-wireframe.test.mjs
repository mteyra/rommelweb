import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Raycaster, Vector3 } from 'three';
import { createInteriorWireframe, INTERIOR_CUT_HEIGHT } from '../src/interior-wireframe.js';
import { validateInteriorData } from '../src/interiors.js';

const campus = JSON.parse(await readFile(new URL('../public/data/campus.json', import.meta.url), 'utf8'));
const lod2 = JSON.parse(await readFile(new URL('../public/data/lod2.json', import.meta.url), 'utf8'));
function fixture() {
  return { schemaVersion: 1, buildings: { '55': {
    approved: true, source: 'Synthetic test only, never a real floor plan', reviewedAt: '2025-10-14',
    reusePermission: 'Original test geometry',
    levels: [{
      index: 0, label: 'Synthetic floor', elevation: 0, source: 'Synthetic test', reviewedAt: '2025-10-14',
      spaces: [
        {id: 'synthetic-room', label: 'Test room', kind: 'room', polygon: [[0, 0], [4, 0], [4, 3], [0, 3], [0, 0]]},
        {id: 'synthetic-hall', label: 'Test hall', kind: 'corridor', polygon: [[0, -2], [4, -2], [4, 0], [0, 0], [0, -2]]},
      ],
      doors: [{id: 'synthetic-door', label: 'Test door', spaceId: 'synthetic-room', toSpaceId: 'synthetic-hall', segment: [[1.4, 0], [2.3, 0]], hinge: 'start', swing: 'left'}],
    }],
  } } };
}
const level = data => data.buildings['55'].levels[0];
const validate = data => validateInteriorData(data, campus, lod2);

test('approved doors are physical geometry with same-floor adjacency and stable nonpersonal IDs', () => {
  const data = fixture(), before = structuredClone(data);
  assert.equal(validate(data), true);
  assert.deepEqual(data, before);
  for (const patch of [
    {spaceId: 'unknown'}, {toSpaceId: 'unknown'}, {toSpaceId: 'synthetic-room'}, {id: 'synthetic-room'},
    {segment: [[1.4, 0.2], [2.3, 0.2]]}, {segment: [[1.4, 0], [1.5, 0]]},
    {segment: [[1.4, 0], [Infinity, 0]]}, {segment: [[0, 0], [4, 0]]},
    {hinge: 'center'}, {swing: 'up'}, {residentName: 'Do not publish a resident'},
  ]) {
    const bad = fixture();
    Object.assign(level(bad).doors[0], patch);
    assert.throws(() => validate(bad), /Interior data/);
  }
  const missingSwing = fixture();
  delete level(missingSwing).doors[0].swing;
  assert.throws(() => validate(missingSwing), /supplied together/);
  const unrelated = fixture();
  level(unrelated).spaces[1].polygon = [[0, -3], [4, -3], [4, -2], [0, -2], [0, -3]];
  assert.throws(() => validate(unrelated), /sharing this door boundary/);
});

test('empty coverage creates no invented rooms, walls, doors or labels', () => {
  const empty = createInteriorWireframe(null, {house: '55', floor: 0});
  assert.equal(empty.group.children.length, 0);
  assert.equal(empty.pickables.length, 0);
  assert.equal(empty.labels.length, 0);
});

test('cutaway walls preserve room polygons and leave the shared door aperture open', () => {
  const data = fixture(), before = structuredClone(data);
  const result = createInteriorWireframe(level(data), {house: '55', floor: 0});
  assert.deepEqual(data, before);
  const walls = result.group.children.find(child => child.userData.role === 'interior-walls').geometry.attributes.position.array;
  for (let index = 0; index < walls.length; index += 6) {
    const [ax, ay, az, bx, by, bz] = walls.slice(index, index + 6);
    assert.ok(ay <= INTERIOR_CUT_HEIGHT + 1e-6 && by <= INTERIOR_CUT_HEIGHT + 1e-6);
    if (Math.abs(az) < 1e-5 && Math.abs(bz) < 1e-5 && Math.abs(ay - by) < 1e-5) {
      assert.ok(Math.max(ax, bx) <= 1.40001 || Math.min(ax, bx) >= 2.29999, 'both room and corridor walls must have the door gap');
    }
  }
  assert.equal(result.labels.filter(label => label.kind === 'space').length, 2);
  assert.equal(result.labels.filter(label => label.kind === 'door').length, 1);
  result.group.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(1.85, 10, 0), new Vector3(0, -1, 0));
  const hit = ray.intersectObjects(result.pickables)[0];
  assert.equal(hit.object.userData.openingId, 'synthetic-door');
  assert.equal(hit.object.userData.spaceId, 'synthetic-room');
  assert.equal(hit.object.userData.house, '55');
  assert.equal(hit.object.userData.floor, 0);
});

test('unknown hinge direction does not invent a door-swing arc', () => {
  const data = fixture();
  delete level(data).doors[0].hinge;
  delete level(data).doors[0].swing;
  assert.equal(validate(data), true);
  const result = createInteriorWireframe(level(data), {house: '55', floor: 0});
  const symbol = result.group.children.find(child => child.userData.role === 'interior-door-symbol');
  assert.equal(symbol.geometry.attributes.position.count, 2, 'only the measured threshold is drawn');
});
