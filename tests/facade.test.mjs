import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createFacadeSegments, createStoreyJointSegments, createTimberBoardStudy, FACADE_PROFILES, surfaceFrame, timberLineBrightness } from '../src/facade.js';
import { CampusScene } from '../src/scene.js';
import * as THREE from 'three';
import { intersection, union } from 'polyclip-ts';
import { createExteriorDetails } from '../src/exterior-details.js';
import { createBuildingWindowStudies } from '../src/windows.js';
import { getLevelElevations } from '../src/interiors.js';

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

test('overlapping appearance exclusions stay empty instead of toggling material back into the overlap', () => {
  const surface = {...rectangle, holes: []};
  const masks = [
    [[1, 1, 0], [3.5, 1, 0], [3.5, 5, 0], [1, 5, 0], [1, 1, 0]],
    [[2.5, 2, 0], [5, 2, 0], [5, 4, 0], [2.5, 4, 0], [2.5, 2, 0]],
  ];
  const before = JSON.stringify({surface, masks});
  const isInside = ([x, y]) => x > 1 + 1e-8 && x < 3.5 - 1e-8 && y > 1 + 1e-8 && y < 5 - 1e-8
    || x > 2.5 + 1e-8 && x < 5 - 1e-8 && y > 2 + 1e-8 && y < 4 - 1e-8;
  const segments = [...createFacadeSegments(surface, 'timber', 1, {exclusions: masks}),
    ...createFacadeSegments(surface, 'plates', 1, {exclusions: masks}),
    ...createStoreyJointSegments(surface, [1.5, 3, 4.5], {exclusions: masks})];
  for (const [a, b] of segments) for (const t of [0.1, 0.5, 0.9]) {
    assert.equal(isInside(a.map((value, i) => value + (b[i] - value) * t)), false, 'seams may not cross either open recess or their overlap');
  }
  assert.equal(JSON.stringify({surface, masks}), before);
});

test('material pitch and seam phase stay continuous across split coplanar source surfaces', () => {
  const patch = (left, right) => ({type: 'WallSurface', points: [[left, 0, 0], [right, 0, 0], [right, 6, 0], [left, 6, 0], [left, 0, 0]]});
  const first = patch(0, 2.73), second = patch(2.73, 6), entire = patch(0, 6);
  const allSeams = createFacadeSegments(entire, 'timber', 4).map(([a]) => a[0]);
  const splitSeams = [first, second].flatMap(surface => createFacadeSegments(surface, 'timber', 4).map(([a]) => a[0]));
  assert.deepEqual(splitSeams, allSeams, 'source-record boundaries must not restart the board spacing');
  const segments = createFacadeSegments(entire, 'timber');
  const brightness = segments.map(timberLineBrightness);
  assert.ok(brightness.every(value => value >= 0.44 && value <= 1));
  assert.ok(new Set(brightness.map(value => value.toFixed(2))).size > 8, 'original board variation must not use a single repeated brightness');
  const frame = surfaceFrame(second);
  for (const point of second.points) assert.ok(frame.lift(frame.project(point)).every((value, i) => Math.abs(value - point[i]) < 1e-8));
});

test('timber color fields remain inside sloped source walls and outside the union of openings', () => {
  const source = {...rectangle, points: [[0, 0, 0], [6, 0, 0], [6, 4, 0], [4, 6, 0], [0, 6, 0], [0, 0, 0]]};
  const masks = [
    [[0.5, 0.7, 0], [2.8, 0.7, 0], [2.8, 3, 0], [0.5, 3, 0], [0.5, 0.7, 0]],
    [[2, 1, 0], [3.5, 1, 0], [3.5, 2.5, 0], [2, 2.5, 0], [2, 1, 0]],
  ];
  const before = JSON.stringify({source, masks});
  const study = createTimberBoardStudy(source, {exclusions: masks, elevations: [0, 3, 6]});
  const polygonArea = polygon => polygon.reduce((area, ring, index) => {
    const signed = Math.abs(ring.slice(1).reduce((sum, b, i) => sum + ring[i][0] * b[1] - b[0] * ring[i][1], 0)) / 2;
    return area + (index ? -signed : signed);
  }, 0);
  const forbidden = union(...[...source.holes, ...masks].map(ring => [ring.map(point => point.slice(0, 2))]));
  assert.ok(study.positions.length > 0);
  for (let start = 0; start < study.positions.length; start += 9) {
    const triangle = [0, 3, 6].map(offset => study.positions.slice(start + offset, start + offset + 2));
    const ring = [...triangle, triangle[0]], area = polygonArea([ring]);
    const outsideArea = area - intersection([ring], [source.points.map(point => point.slice(0, 2))]).reduce((sum, polygon) => sum + polygonArea(polygon), 0);
    const forbiddenArea = intersection([ring], forbidden).reduce((sum, polygon) => sum + polygonArea(polygon), 0);
    assert.ok(outsideArea < 1e-8 && forbiddenArea < 1e-8, 'color triangles may not bridge a sloping edge, source hole or overlapping recess masks');
    assert.ok([2, 5, 8].every(offset => study.positions[start + offset] === 0), 'fill remains on the exact source plane');
  }
  assert.equal(study.dayColors.length, study.positions.length);
  assert.equal(study.nightColors.length, study.positions.length);
  assert.ok([...study.dayColors, ...study.nightColors].every(value => Number.isFinite(value) && value >= 0 && value <= 1));
  assert.ok(study.dayColors.every((value, index) => value > study.nightColors[index]), 'day/night colors must remain in their intended luminance order');
  assert.ok(new Set(study.dayColors.map(value => value.toFixed(3))).size > 12, 'weathering must vary gently across the façade');
  assert.deepEqual(createTimberBoardStudy(source, {exclusions: masks, elevations: [0, 3, 6]}), study, 'procedural weathering is deterministic');
  assert.equal(JSON.stringify({source, masks}), before);
  assert.throws(() => createTimberBoardStudy(source, {elevations: [0, 3, 3]}), /ascending/);
});

test('weathering colors keep a shared phase across source-record boundaries', () => {
  const patch = (left, right) => ({type: 'WallSurface', points: [[left, 0, 0], [right, 0, 0], [right, 6, 0], [left, 6, 0], [left, 0, 0]]});
  const entire = createTimberBoardStudy(patch(0, 6), {elevations: [0, 3, 6]});
  const colorsAt = study => {
    const map = new Map();
    for (let i = 0; i < study.positions.length; i += 3) map.set(study.positions.slice(i, i + 3).map(value => value.toFixed(7)).join(','), study.dayColors.slice(i, i + 3));
    return map;
  };
  const expected = colorsAt(entire);
  let checked = 0;
  for (const surface of [patch(0, 2.73), patch(2.73, 6)]) {
    for (const [point, colors] of colorsAt(createTimberBoardStudy(surface, {elevations: [0, 3, 6]}))) {
      if (!expected.has(point)) continue;
      assert.ok(colors.every((value, i) => Math.abs(value - expected.get(point)[i]) < 1e-8), 'a source patch boundary must not restart the color sequence');
      checked++;
    }
  }
  assert.ok(checked > 30);
});

test('the six actual timber buildings retain source data and a bounded weathering mesh after all façade masks', async () => {
  const lod2 = JSON.parse(await readFile(new URL('../public/data/lod2.json', import.meta.url), 'utf8'));
  const campus = JSON.parse(await readFile(new URL('../public/data/campus.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(lod2);
  let vertices = 0;
  for (const building of lod2.buildings.filter(item => item.number.endsWith('a') || item.number === '49')) {
    const levels = campus.buildings.find(item => item.number === building.number).levels;
    const elevations = getLevelElevations({schemaVersion: 1, buildings: {}}, building.number, levels, building.height).map(y => y + building.baseY);
    const details = createExteriorDetails(building, {house: building.number, levels, absoluteFloorElevations: elevations});
    const windows = createBuildingWindowStudies(building.surfaces, elevations, building.baseY + building.height, {
      house: building.number, exclusionsBySurface: details.exclusionsBySurface, layoutsBySurface: details.layoutsBySurface,
    });
    for (const surface of building.surfaces) {
      const exclusions = [...(details.exclusionsBySurface.get(surface) || []),
        ...(windows.get(surface)?.patches || []).map(patch => [...patch.corners, patch.corners[0]])];
      const study = createTimberBoardStudy(surface, {exclusions, elevations: [...elevations, building.baseY + building.height], elevationOrigin: building.baseY});
      vertices += study.positions.length / 3;
      assert.ok(study.positions.every(Number.isFinite));
    }
  }
  assert.ok(vertices > 10000 && vertices < 60000, `the color tween should not need a dense texture mesh: ${vertices} vertices`);
  assert.equal(JSON.stringify(lod2), before);
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
