import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFacadeSegments, createStoreyJointSegments, FACADE_PROFILES } from '../src/facade.js';
import { CampusScene } from '../src/scene.js';
import * as THREE from 'three';

const rectangle = {
  type: 'WallSurface',
  points: [[0, 0, 0], [6, 0, 0], [6, 6, 0], [0, 6, 0], [0, 0, 0]],
  holes: [[[2, 2, 0], [4, 2, 0], [4, 4, 0], [2, 4, 0], [2, 2, 0]]],
};

test('material hatching leaves source surfaces intact and clips around holes', () => {
  const before = structuredClone(rectangle);
  for (const family of ['timber', 'plates']) {
    const segments = createFacadeSegments(rectangle, family);
    assert.ok(segments.length > 0);
    for (const [a, b] of segments) {
      for (const p of [a, b]) {
        assert.ok(p.every(Number.isFinite));
        assert.ok(p[0] >= -1e-8 && p[0] <= 6 + 1e-8 && p[1] >= -1e-8 && p[1] <= 6 + 1e-8);
        assert.ok(Math.abs(p[2]) < 1e-8, 'marks must remain on the exact wall plane');
      }
      const midpoint = a.map((v, i) => (v + b[i]) / 2);
      assert.ok(!(midpoint[0] > 2 + 1e-8 && midpoint[0] < 4 - 1e-8 && midpoint[1] > 2 + 1e-8 && midpoint[1] < 4 - 1e-8), 'no line may cross an opening');
    }
  }
  assert.deepEqual(rectangle, before);
});

test('different source material patterns stay schematic and coarse detail uses fewer segments', () => {
  const timber = createFacadeSegments(rectangle, 'timber');
  assert.ok(timber.every(([a, b]) => Math.abs(a[0] - b[0]) < 1e-8));
  const plates = createFacadeSegments(rectangle, 'plates');
  assert.ok(plates.some(([a, b]) => Math.abs(a[1] - b[1]) < 1e-8));
  assert.ok(plates.some(([a, b]) => Math.abs(a[0] - b[0]) < 1e-8));
  for (const family of ['timber', 'plates']) {
    assert.ok(createFacadeSegments(rectangle, family, 4).length < createFacadeSegments(rectangle, family, 1).length);
    assert.match(FACADE_PROFILES[family].status, /illustrative.*no inferred windows/);
  }
  assert.deepEqual(createFacadeSegments({...rectangle, type: 'RoofSurface'}, 'timber'), []);
});

test('coarse timber seams are a stable subset of detailed seams during camera LOD blending', () => {
  const fine = createFacadeSegments(rectangle, 'timber', 1);
  const coarse = createFacadeSegments(rectangle, 'timber', 4);
  for (const [a, b] of coarse) {
    assert.ok(fine.some(([c, d]) => Math.hypot(...a.map((value, i) => value - c[i])) < 1e-8 && Math.hypot(...b.map((value, i) => value - d[i])) < 1e-8), 'board seams must not shift when detail changes');
  }
});

test('all real LoD2 walls can be hatched without changing the official model', async () => {
  const source = JSON.parse(await readFile(new URL('../public/data/lod2.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(source);
  let total = 0;
  for (const building of source.buildings) {
    const family = building.number.endsWith('a') || building.number === '49' ? 'timber' : 'plates';
    for (const surface of building.surfaces) {
      const segments = createFacadeSegments(surface, family);
      assert.ok(segments.every(segment => segment.length === 2 && segment.every(point => point.length === 3 && point.every(Number.isFinite))));
      total += segments.length;
    }
  }
  assert.ok(total > 1000 && total < 50000, `unexpected facade density ${total}`);
  assert.equal(JSON.stringify(source), before);
});

test('storey joints retain exact provided elevations and clip around wall openings', () => {
  const before = structuredClone(rectangle);
  const segments = createStoreyJointSegments(rectangle, [0, 1.5, 3, 3, 4.5, 6, 9]);
  assert.equal(segments.length, 4, 'three internal elevations with one split around the opening');
  assert.deepEqual([...new Set(segments.map(([a]) => a[1]))].sort(), [1.5, 3, 4.5]);
  for (const [a, b] of segments) {
    assert.equal(a[1], b[1], 'joints remain horizontal');
    assert.equal(a[2], 0);
    assert.equal(b[2], 0);
    if (a[1] === 3) assert.ok(Math.max(a[0], b[0]) <= 2 || Math.min(a[0], b[0]) >= 4, 'joints must not cross openings');
  }
  assert.deepEqual(rectangle, before);
  assert.deepEqual(createStoreyJointSegments({...rectangle, type: 'RoofSurface'}, [3]), []);
  assert.throws(() => createStoreyJointSegments(rectangle, [NaN]), /finite metres/);
});

test('camera fitting keeps metre-scale bounds on screen across desktop and portrait viewports', () => {
  const bounds = new THREE.Box3(new THREE.Vector3(-22, 2, -18), new THREE.Vector3(22, 54, 18));
  for (const aspect of [16 / 9, 1, 0.45]) {
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 1600);
    const mock = { camera, selected: 'test', focusBounds: () => bounds.clone() };
    const frame = CampusScene.prototype.fittedCamera.call(mock, new THREE.Vector3(0.85, 1.05, 1), 1.3);
    camera.position.copy(frame.position);
    camera.lookAt(frame.target);
    camera.updateMatrixWorld();
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const projected = new THREE.Vector3(x, y, z).project(camera);
      assert.ok(Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1, `bounds cropped at aspect ${aspect}`);
    }
  }
});

test('overview camera fits actual source vertices without wasting space on empty campus corners', async () => {
  const source = JSON.parse(await readFile(new URL('../public/data/lod2.json', import.meta.url), 'utf8'));
  const points = source.buildings.flatMap(building => building.surfaces.flatMap(surface => surface.points.map(point => new THREE.Vector3(...point))));
  const bounds = new THREE.Box3().setFromPoints(points);
  const direction = new THREE.Vector3(0.85, 1.05, 1);
  for (const aspect of [1440 / 1024, 390 / 844]) {
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 1600);
    const mock = { camera, focusBounds: () => bounds.clone(), focusPoints: () => points };
    const frame = CampusScene.prototype.fittedCamera.call(mock, direction, 1.2);
    const boxFrame = CampusScene.prototype.fittedCamera.call({...mock, focusPoints: undefined}, direction, 1.2);
    assert.ok(frame.position.distanceTo(frame.target) < boxFrame.position.distanceTo(boxFrame.target) * 0.9);
    camera.position.copy(frame.position);
    camera.lookAt(frame.target);
    camera.updateMatrixWorld();
    let maxProjected = 0;
    for (const point of points) {
      const projected = point.clone().project(camera);
      assert.ok(Math.abs(projected.x) <= 0.84 && Math.abs(projected.y) <= 0.84);
      maxProjected = Math.max(maxProjected, Math.abs(projected.x), Math.abs(projected.y));
    }
    assert.ok(maxProjected > 0.8, 'campus should occupy the available viewport');
  }
});
