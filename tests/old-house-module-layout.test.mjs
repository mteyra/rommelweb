import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {difference, intersection, union} from 'polyclip-ts';
import {createOldHouseModuleLayouts} from '../scripts/old-house-module-layout.mjs';
import {validateInteriorStudies} from '../src/interior-studies.js';
import {readHistoricalStudies} from './fixtures/pre-module-studies.mjs';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const [studies, lod2, campus, topPlan, firstFloorPlan, groundFloorPlan, published, historical,
  archivedWhite, archivedGreen, archivedYellow, archivedOrange] = await Promise.all([
  read('public/data/interior-studies.json'), read('public/data/lod2.json'), read('public/data/campus.json'),
  read('public/data/house55-module-layout.json'), read('public/data/house55-first-floor-layout.json'),
  read('public/data/house55-ground-floor-layout.json'), read('public/data/old-house-module-layouts.json'),
  readHistoricalStudies(), read('tests/fixtures/house57-before-resident-layout.json'),
  read('tests/fixtures/house59-before-resident-layout.json'),
  read('tests/fixtures/house51-before-top-floor-layout.json'),
  read('tests/fixtures/house53-before-resident-layout.json'),
]);
const houses = ['51'];
const historicalHouses = ['51', '53', '57', '59'];
const input = {studies, lod2, topPlan, firstFloorPlan, groundFloorPlan};
const snapshot = structuredClone(input);
const generated = createOldHouseModuleLayouts(input);
const epsilon = 1e-6;
const close = (actual, expected, message = '') =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${message}: ${actual} differs from ${expected}`);
const edges = ring => ring.slice(1).map((b, i) => [ring[i], b]);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const ringArea = ring => Math.abs(edges(ring).reduce((sum, [a, b]) =>
  sum + a[0] * b[1] - b[0] * a[1], 0)) / 2;
const area = polygons => polygons.reduce((sum, polygon) =>
  sum + ringArea(polygon[0]) - polygon.slice(1).reduce((s, ring) => s + ringArea(ring), 0), 0);
const polygon = item => [item.polygon, ...(item.holes || [])];
const outline = pieces => pieces.map(piece => [piece.outer, ...(piece.holes || [])]);
const sides = ring => edges(ring).map(([a, b]) => distance(a, b)).sort((a, b) => a - b);
const transform = frame => ([u, v]) => frame.originCampusXZ.map((origin, i) =>
  origin + u * frame.axisU[i] + v * frame.axisV[i]);
const sameArea = (first, second, message) => {
  close(area(difference(first, second)), 0, `${message}, no excess`);
  close(area(difference(second, first)), 0, `${message}, no gap`);
};
const rectangle = (ring, width, depth, message) => {
  assert.equal(ring.length, 5, `${message} has four sides`);
  assert.deepEqual(ring[0], ring.at(-1), `${message} closes`);
  sides(ring).forEach((length, i) =>
    close(length, [width, width, depth, depth].sort((a, b) => a - b)[i], `${message} side`));
  const vectors = edges(ring).map(([a, b]) => [b[0] - a[0], b[1] - a[1]]);
  for (let i = 0; i < vectors.length; i++) {
    const next = vectors[(i + 1) % vectors.length];
    close(vectors[i][0] * next[0] + vectors[i][1] * next[1], 0, `${message} right angle`);
  }
  close(ringArea(ring), width * depth, `${message} area`);
};
const boundaryDistance = (point, space) => Math.min(...polygon(space).flatMap(ring =>
  edges(ring).map(([a, b]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], squared = dx * dx + dy * dy;
    const t = squared ? Math.max(0, Math.min(1,
      ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / squared)) : 0;
    return distance(point, [a[0] + t * dx, a[1] + t * dy]);
  })));
const sharedBoundaryLength = (first, second) => {
  let length = 0;
  for (const [a, b] of edges(first)) for (const [c, d] of edges(second)) {
    const vertical = Math.abs(a[0] - b[0]) < epsilon && Math.abs(c[0] - d[0]) < epsilon;
    const horizontal = Math.abs(a[1] - b[1]) < epsilon && Math.abs(c[1] - d[1]) < epsilon;
    if (!vertical && !horizontal) continue;
    const fixed = vertical ? 0 : 1, along = 1 - fixed;
    if (Math.abs(a[fixed] - c[fixed]) >= epsilon) continue;
    length += Math.max(0, Math.min(Math.max(a[along], b[along]), Math.max(c[along], d[along]))
      - Math.max(Math.min(a[along], b[along]), Math.min(c[along], d[along])));
  }
  return length;
};
const visit = (graph, start) => {
  const seen = new Set([start]), queue = [start];
  while (queue.length) for (const next of graph.get(queue.shift())) {
    if (!seen.has(next)) { seen.add(next); queue.push(next); }
  }
  return seen;
};
// Retain all earlier fits under every numeric regression check, including
// Yellow's original top floor. Dedicated suites protect the replacements.
const archived = {'51': archivedYellow, '53': archivedOrange, '57': archivedWhite, '59': archivedGreen};
const fitting = house => archived[house]?.layout ?? generated.metadata.houses[house];
const fittingStudy = house => archived[house]?.building ?? generated.studies.buildings[house];
const floors = () => historicalHouses.flatMap(house => fitting(house).levels.map(plan => ({
  house, plan, frame: fitting(house).coordinateFrame,
  level: fittingStudy(house).levels.find(level => level.index === plan.levelIndex),
  name: `${house}/${plan.levelIndex}`,
})));

test('fitting is deterministic, leaves inputs intact and preserves the accepted House 55', () => {
  assert.deepEqual(input, snapshot);
  assert.deepEqual(createOldHouseModuleLayouts(input), generated);
  assert.deepEqual(generated.studies, studies, 'Published studies reproduce the generator');
  assert.deepEqual(generated.metadata, published, 'Published fitting record reproduces the generator');
  for (const [house, building] of Object.entries(studies.buildings)) {
    if (!houses.includes(house)) assert.deepEqual(generated.studies.buildings[house], building);
  }
  assert.deepEqual(generated.studies.buildings['55'], snapshot.studies.buildings['55']);
  assert.deepEqual(lod2, snapshot.lod2, 'Folded exterior evidence remains untouched');
});

test('all twelve historical source outlines and facade observations remain exact', () => {
  const historicalInput = structuredClone(input);
  for (const house of historicalHouses) historicalInput.studies.buildings[house] = structuredClone(historical.buildings[house]);
  const fromHistorical = createOldHouseModuleLayouts(historicalInput);
  for (const house of historicalHouses) {
    assert.deepEqual(fromHistorical.studies.buildings[house], fittingStudy(house),
      `${house}: historical provisional interiors reproduce their exact dated fit`);
    assert.deepEqual(fromHistorical.metadata.houses[house], fitting(house));
  }
  for (const house of historicalHouses) {
    const next = fittingStudy(house);
    assert.deepEqual(next.levels.map(level => level.index), [0, 1, 2]);
    for (const previous of historical.buildings[house].levels) {
      const level = next.levels.find(item => item.index === previous.index);
      for (const key of ['floorOutline', 'windows', 'windowCoverage', 'excludedAreas', 'sketchBoundaries']) {
        assert.deepEqual(level[key], previous[key], `${house}/${level.index} retains ${key}`);
        assert.equal(Object.hasOwn(level, key), Object.hasOwn(previous, key), `${key} presence is retained`);
      }
      assert.deepEqual(level.layoutWindows, [], 'House 55 windows do not become evidence for another house');
    }
  }
});

test('archived Yellow, Orange, White and Green fits remain exactly reproducible from isolated historical inputs', () => {
  for (const [house, fixture] of Object.entries(archived)) {
    const historicalInput = structuredClone(input);
    historicalInput.studies.buildings[house] = structuredClone(fixture.building);
    const result = createOldHouseModuleLayouts(historicalInput);
    assert.deepEqual(result.studies.buildings[house], fixture.building);
    assert.deepEqual(result.metadata.houses[house], fixture.layout);
    assert.deepEqual(generated.studies.buildings[house], studies.buildings[house],
      'Historical reproduction never replaces the current resident-confirmed study');
  }
});

test('fitted records remain provisional, contain only requested houses and pass site validation', () => {
  assert.deepEqual(Object.keys(generated.metadata.houses).sort(), houses);
  assert.equal(generated.metadata.units, 'metres');
  assert.equal(generated.metadata.status, 'provisional-fit-for-site-check');
  assert.deepEqual(generated.metadata.dimensions, {
    singleWidth: 2.7, singleDepth: 6, sideWallAllocation: 0.2, modulePitch: 3.1,
    hallWidth: 1.4, sharedWidth: 6.2, sharedDepth: 7.4,
  });
  for (const {level, plan, name} of floors()) {
    assert.equal(level.layoutBasis, 'fitted-module-layout', name);
    assert.equal(plan.status, 'provisional-fit-for-site-check', name);
    assert.ok(level.spaces.every(space => space.confidence === 'estimated'));
    assert.ok(level.doors.every(door => door.confidence === 'estimated'));
    assert.ok(level.spaces.every(space => ['room', 'shared', 'corridor', 'stairs'].includes(space.kind)),
      `${name} does not assign guessed uses to residual space`);
    assert.ok(plan.rooms.length > 0, `${name} contains proposed singles`);
    if (level.index === 2) assert.equal(plan.sharedApartments.length, 0);
    else assert.ok(plan.sharedApartments.length > 0, `${name} contains proposed shared apartments`);
  }
  assert.equal(validateInteriorStudies(generated.studies, campus, lod2), true);
});

test('all clear rooms, side allocations and shared envelopes retain exact unscaled dimensions', () => {
  for (const {frame, plan, level, name} of floors()) {
    close(Math.hypot(...frame.axisU), 1, `${name} U scale`);
    close(Math.hypot(...frame.axisV), 1, `${name} V scale`);
    close(frame.axisU[0] * frame.axisV[0] + frame.axisU[1] * frame.axisV[1], 0, `${name} axes`);
    const map = transform(frame), spaces = new Map(level.spaces.map(space => [space.id, space]));
    for (const room of plan.rooms) {
      rectangle(room.polygon, 2.7, 6, `${name}/${room.label} clear room`);
      rectangle(room.modulePolygon, 3.1, 6, `${name}/${room.label} module`);
      rectangle(spaces.get(room.id).polygon, 2.7, 6, `${name}/${room.label} campus room`);
      assert.equal(room.sideWalls.length, 2);
      for (const wall of room.sideWalls) rectangle(wall, 0.2, 6, `${name}/${room.label} side wall`);
      sameArea(union([room.polygon], ...room.sideWalls.map(ring => [ring])), [room.modulePolygon],
        `${name}/${room.label} clear room and two side allocations form its module`);
    }
    for (const room of plan.sharedApartments) {
      rectangle(room.polygon, 6.2, 7.4, `${name}/${room.label} shared envelope`);
      rectangle(spaces.get(room.id).polygon, 6.2, 7.4, `${name}/${room.label} campus envelope`);
    }
    for (const room of [...plan.rooms, ...plan.sharedApartments]) {
      const mapped = room.polygon.map(map), actual = spaces.get(room.id).polygon;
      mapped.forEach((point, i) => point.forEach((value, axis) =>
        close(value, actual[i][axis], `${name}/${room.label} rigid registration`)));
    }
    assert.equal(plan.wallBands.length, plan.rooms.length * 2);
    assert.equal(level.wallBands.length, plan.wallBands.length);
    for (const wall of level.wallBands) rectangle(wall.polygon, 0.2, 6, `${name} published wall strip`);
    close(plan.totals.singleCount, plan.rooms.length);
    close(plan.totals.sharedApartmentCount, plan.sharedApartments.length);
    close(plan.totals.apartmentCount, plan.rooms.length + plan.sharedApartments.length);
    close(plan.totals.moduleCount, plan.rooms.length + plan.sharedApartments.length * 2);
  }
});

test('assigned geometry fits each untouched shell without overlaps and leaves the remainder gray', () => {
  for (const {frame, plan, level, name} of floors()) {
    const local = point => [frame.axisU, frame.axisV].map(vector =>
      (point[0] - frame.originCampusXZ[0]) * vector[0] + (point[1] - frame.originCampusXZ[1]) * vector[1]);
    // Clip published geometry in its orthonormal frame. The independent
    // registration checks above protect this transform; submicrometre
    // snapping removes rounding noise between coincident campus boundaries.
    const snapped = point => local(point).map(value => Math.round(value * 1e7) / 1e7);
    const floor = outline(level.floorOutline).map(piece => piece.map(ring => ring.map(local)));
    const pieces = [...level.spaces, ...level.wallBands].map(space =>
      polygon(space).map(ring => ring.map(snapped)));
    for (const [i, piece] of pieces.entries()) {
      close(area(difference(piece, floor)), 0, `${name} piece ${i} remains inside the source floor`);
    }
    const occupied = union(...pieces), gray = difference(floor, occupied);
    close(area(occupied), pieces.reduce((sum, piece) => sum + area([piece]), 0),
      `${name} has no positive-area overlap between rooms, walls and circulation`);
    assert.ok(area(gray) > epsilon, `${name} retains unused gray floor`);
    close(area(floor), plan.totals.shellArea, `${name} original area`);
    close(area(occupied), plan.totals.assignedArea, `${name} assigned area`);
    close(area(gray), plan.totals.unassignedArea, `${name} gray area`);
    const recordedGray = outline(plan.unassignedPolygons);
    sameArea(gray, recordedGray, `${name} recorded gray remainder`);
    close(area(intersection(occupied, recordedGray)), 0, `${name} gray is unassigned`);
    sameArea(union(occupied, recordedGray), floor, `${name} entire original floor remains visible`);
  }
});

test('every hallway stays 1.40 m wide, has full-width junctions and reaches the unchanged stair core', () => {
  for (const {plan, name} of floors()) {
    const circulation = [...plan.corridors, plan.stair];
    const graph = new Map(circulation.map(piece => [piece.id, new Set()]));
    for (const hall of plan.corridors) {
      const lengths = sides(hall.polygon);
      assert.ok(lengths.some(length => Math.abs(length - 1.4) < epsilon), `${name}/${hall.bank} clear hall width`);
      rectangle(hall.polygon, lengths[0], lengths.at(-1), `${name}/${hall.bank} hall piece`);
    }
    rectangle(plan.stair.polygon, 2.7, 7.4, `${name} stair enclosure`);
    rectangle(plan.stair.flightPolygon, 1.3, 4.6, `${name} stair flight`);
    for (let i = 0; i < circulation.length; i++) for (let j = i + 1; j < circulation.length; j++) {
      const width = sharedBoundaryLength(circulation[i].polygon, circulation[j].polygon);
      // Additional partial contacts are harmless if every piece already has
      // a connected route through full-width openings.
      if (width < 1.4 - epsilon) continue;
      graph.get(circulation[i].id).add(circulation[j].id);
      graph.get(circulation[j].id).add(circulation[i].id);
    }
    assert.equal(visit(graph, plan.stair.id).size, circulation.length, `${name} all hallway pieces reach the stair`);
  }
  for (const house of historicalHouses) {
    const plans = fitting(house).levels;
    for (const plan of plans.slice(1)) {
      assert.deepEqual(plan.stair.polygon, plans[0].stair.polygon, `${house} staircase remains vertically aligned`);
    }
  }
});

test('each proposed apartment has one real doorway and a connected route to the stair', () => {
  for (const {level, name} of floors()) {
    const graph = new Map(level.spaces.map(space => [space.id, new Set()]));
    for (const door of level.doors) {
      const [a, b] = door.segment, midpoint = a.map((value, i) => (value + b[i]) / 2);
      const neighbors = level.spaces.filter(space =>
        [a, b, midpoint].every(point => boundaryDistance(point, space) < epsilon));
      assert.deepEqual(neighbors.map(space => space.id).sort(), [door.spaceId, door.toSpaceId].sort(),
        `${name}/${door.id} lies on its two actual space boundaries`);
      close(distance(a, b), 0.9, `${name}/${door.id} door width`);
      graph.get(door.spaceId).add(door.toSpaceId);
      graph.get(door.toSpaceId).add(door.spaceId);
    }
    const stairs = level.spaces.filter(space => space.kind === 'stairs');
    assert.equal(stairs.length, 1);
    assert.equal(visit(graph, stairs[0].id).size, level.spaces.length, `${name} all assigned spaces reach the stair`);
    for (const apartment of level.spaces.filter(space => ['room', 'shared'].includes(space.kind))) {
      const doors = level.doors.filter(door => door.spaceId === apartment.id || door.toSpaceId === apartment.id);
      assert.equal(doors.length, 1, `${name}/${apartment.shortLabel} has one entrance`);
      const other = doors[0].spaceId === apartment.id ? doors[0].toSpaceId : doors[0].spaceId;
      assert.equal(level.spaces.find(space => space.id === other).kind, 'corridor');
    }
  }
});
