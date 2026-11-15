import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {difference, intersection, union} from 'polyclip-ts';
import {createHouse57ModuleLayouts} from '../scripts/house57-module-layout.mjs';
import {createOldHouseModuleLayouts} from '../scripts/old-house-module-layout.mjs';
import {generateOldHouseStudies} from '../scripts/generate-old-house-studies.mjs';
import {validateInteriorStudies} from '../src/interior-studies.js';
import {readHistoricalStudies} from './fixtures/pre-module-studies.mjs';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const [studies, lod2, campus, interiors, roomMarkers, topPlan, firstFloorPlan, groundFloorPlan, published,
  oldHouseLayouts, before, historical, archivedGreen, archivedYellow, archivedOrange] = await Promise.all([
  read('public/data/interior-studies.json'), read('public/data/lod2.json'), read('public/data/campus.json'),
  read('public/data/interiors.json'), read('public/data/room-markers.json'),
  read('public/data/house55-module-layout.json'), read('public/data/house55-first-floor-layout.json'),
  read('public/data/house55-ground-floor-layout.json'), read('public/data/house57-module-layouts.json'),
  read('public/data/old-house-module-layouts.json'), read('tests/fixtures/house57-before-resident-layout.json'),
  readHistoricalStudies(), read('tests/fixtures/house59-before-resident-layout.json'),
  read('tests/fixtures/house51-before-top-floor-layout.json'),
  read('tests/fixtures/house53-before-resident-layout.json'),
]);
const input = {studies, lod2, topPlan, firstFloorPlan, groundFloorPlan, oldHouseLayouts};
const snapshot = structuredClone(input), generated = createHouse57ModuleLayouts(input);
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
const sameArea = (first, second, message) => {
  close(area(difference(first, second)), 0, `${message}, no excess`);
  close(area(difference(second, first)), 0, `${message}, no gap`);
};
const boundaryDistance = (point, item) => Math.min(...polygon(item).flatMap(ring =>
  edges(ring).map(([a, b]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], squared = dx * dx + dy * dy;
    const t = squared ? Math.max(0, Math.min(1,
      ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / squared)) : 0;
    return distance(point, [a[0] + t * dx, a[1] + t * dy]);
  })));
const geometry = value => {
  if (Array.isArray(value)) return value.map(geometry);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) =>
    !['id', 'spaceId', 'toSpaceId', 'note'].includes(key)).map(([key, item]) => [key, geometry(item)]));
};
const whiteId = (id, floor) => id.replace(/^study-55-\d+-/, `study-57-${floor}-`)
  .replace(/^module-55-\d+-/, `module-57-${floor}-`)
  .replace(/^module-(?!57-)/, `module-57-${floor}-`);
const frames = frame => ({
  campus: ([u, v]) => frame.originCampusXZ.map((origin, i) => origin + u * frame.axisU[i] + v * frame.axisV[i]),
  local: point => [frame.axisU, frame.axisV].map(axis =>
    (point[0] - frame.originCampusXZ[0]) * axis[0] + (point[1] - frame.originCampusXZ[1]) * axis[1]),
});
const visit = (graph, start) => {
  const seen = new Set([start]), queue = [start];
  while (queue.length) for (const neighbor of graph.get(queue.shift())) {
    if (!seen.has(neighbor)) { seen.add(neighbor); queue.push(neighbor); }
  }
  return seen;
};
const floors = () => generated.metadata.levels.map(plan => ({
  plan, level: generated.studies.buildings['57'].levels.find(level => level.index === plan.levelIndex),
  red: [groundFloorPlan, firstFloorPlan, topPlan][plan.levelIndex],
  name: `White/${plan.levelIndex}`,
}));

test('White regeneration is deterministic, idempotent and reproduces its published canonical and study records', () => {
  assert.deepEqual(input, snapshot, 'The generator must not mutate any argument');
  assert.deepEqual(createHouse57ModuleLayouts(input), generated);
  assert.deepEqual(createHouse57ModuleLayouts({...input, studies: generated.studies}), generated);
  assert.deepEqual(generated.metadata, published);
  assert.deepEqual(generated.studies, studies);
  const previous = structuredClone(studies);
  previous.buildings['57'] = structuredClone(before.building);
  assert.deepEqual(createHouse57ModuleLayouts({...input, studies: previous}), generated,
    'The original fitted White record regenerates the same replacement');
  for (const [number, building] of Object.entries(studies.buildings)) {
    if (number !== '57') assert.deepEqual(generated.studies.buildings[number], building);
  }
  assert.equal(validateInteriorStudies(generated.studies, campus, lod2), true);
});

test('White retains its own unscaled rigid registration on every floor and discards all old bank fit offsets', () => {
  const frame = generated.metadata.coordinateFrame;
  assert.deepEqual(frame, before.layout.coordinateFrame);
  assert.notDeepEqual(frame.originCampusXZ, topPlan.coordinateFrame.originCampusXZ);
  close(Math.hypot(...frame.axisU), 1, 'U scale');
  close(Math.hypot(...frame.axisV), 1, 'V scale');
  close(frame.axisU[0] * frame.axisV[0] + frame.axisU[1] * frame.axisV[1], 0, 'Orthogonal axes');
  close(frame.axisU[0] * frame.axisV[1] - frame.axisU[1] * frame.axisV[0], 1, 'No reflection');
  assert.deepEqual(createHouse57ModuleLayouts({...input, oldHouseLayouts: undefined}), generated,
    'Independent source registration and retained historical frame agree');
  const {campus: toCampus} = frames(frame);
  for (const {plan, level, name} of floors()) {
    assert.deepEqual(plan.coordinateFrame, frame, name);
    assert.equal(plan.status, 'resident-module-layout');
    assert.equal(level.layoutBasis, 'resident-module-layout');
    assert.equal(plan.bankPlacements, undefined, `${name} has no old fitted bank translations`);
    assert.equal(level.extrapolatedFrom, undefined);
    assert.equal(level.floorOutline.length, 1, `${name} has one connected independent outline`);
    assert.deepEqual(level.floorOutline[0].holes || [], [], `${name} has no extra holes`);
    assert.equal(level.floorOutline[0].outer.length, plan.shell.outline.length);
    plan.shell.outline.map(toCampus).forEach((point, i) =>
      point.forEach((value, axis) => close(value, level.floorOutline[0].outer[i][axis], `${name} registered shell`)));
    for (const item of [...plan.rooms, ...(plan.sharedApartments || []), ...(plan.commonAreas || [])]) {
      const actual = level.spaces.find(space => space.id === item.id);
      assert.ok(actual, `${name}/${item.label} is published`);
      item.polygon.map(toCampus).forEach((point, i) =>
        point.forEach((value, axis) => close(value, actual.polygon[i][axis], `${name}/${item.label} rigid placement`)));
    }
    const redLevel = studies.buildings['55'].levels.find(item => item.index === plan.levelIndex);
    const fromRed = frames(topPlan.coordinateFrame).local;
    for (const group of ['spaces', 'doors', 'wallBands']) {
      for (const item of level[group]) {
        const source = redLevel[group].find(record => whiteId(record.id, plan.levelIndex) === item.id);
        assert.ok(source, `${name}/${item.id} has its matching Red source`);
        for (const field of ['polygon', 'segment', 'stairFlight']) {
          if (!source[field]) continue;
          assert.equal(item[field].length, source[field].length, `${name}/${item.id}/${field} vertex inventory`);
          source[field].map(point => toCampus(fromRed(point))).forEach((point, i) =>
            point.forEach((value, axis) => close(value, item[field][i][axis],
              `${name}/${item.id}/${field} retains its exact Red placement`)));
        }
      }
    }
  }
});

test('top and EG local geometry match Red exactly, with only the two confirmed ground-floor use names changed', () => {
  for (const {plan, red, name} of floors().filter(item => item.plan.levelIndex !== 1)) {
    for (const key of ['dimensions', 'shell', 'rooms', 'sharedApartments', 'corridors', 'circulationExtensions',
      'wallBands', 'stair', 'outlineDimensions', 'restoredAreas', 'reconciliation']) {
      assert.deepEqual(geometry(plan[key]), geometry(red[key]), `${name}/${key} exact local geometry`);
    }
    for (const [key, value] of Object.entries(red.totals)) assert.equal(plan.totals[key], value, `${name}/${key}`);
  }
  const ground = generated.metadata.levels.find(plan => plan.levelIndex === 0);
  assert.deepEqual(ground.commonAreas.map(item => [item.bank, item.label, item.use]),
    [['R', 'Gym', 'gym'], ['L', 'Study', 'study']]);
  assert.deepEqual(generated.studies.buildings['57'].levels.find(level => level.index === 0)
    .spaces.filter(space => space.kind === 'service').map(space => space.label), ['Gym', 'Study']);
  ground.commonAreas.forEach(item => {
    const source = groundFloorPlan.commonAreas.find(space => space.bank === item.bank);
    assert.deepEqual(geometry({...item, label: source.label, use: source.use}), geometry(source));
  });
  const top = generated.metadata.levels.find(plan => plan.levelIndex === 2);
  assert.deepEqual(top.commonAreas, topPlan.commonAreas);
});

test('first floor removes exactly the east 26.97 square metre balcony, footprint and entrance', () => {
  const {plan, level} = floors().find(item => item.plan.levelIndex === 1);
  for (const key of ['dimensions', 'rooms', 'sharedApartments', 'corridors', 'circulationExtensions',
    'wallBands', 'stair', 'reconciliation']) {
    assert.deepEqual(geometry(plan[key]), geometry(firstFloorPlan[key]), `1. OG/${key} exact local geometry`);
  }
  const east = firstFloorPlan.commonAreas.find(space => space.bank === 'R');
  const west = firstFloorPlan.commonAreas.find(space => space.bank === 'L');
  assert.equal(plan.commonAreas.length, 1);
  assert.deepEqual(geometry(plan.commonAreas[0]), geometry(west));
  sameArea(difference([firstFloorPlan.shell.outline], [plan.shell.outline]), [east.polygon], 'Only east balcony removed');
  close(area(difference([plan.shell.outline], [firstFloorPlan.shell.outline])), 0, 'No added footprint');
  close(ringArea(east.polygon), 26.97);
  close(ringArea(plan.shell.outline), 597.51);
  assert.deepEqual(plan.shell.holes, []);
  assert.deepEqual(plan.shell.outline[0], firstFloorPlan.shell.outline[0], 'Drawing origin retained');
  assert.equal(level.spaces.length, 24);
  assert.equal(level.doors.length, 23);
  assert.deepEqual(level.spaces.filter(space => space.kind === 'service').map(space => space.label), ['West balcony']);
  const removedId = whiteId(east.id, 1);
  assert.ok(level.spaces.every(space => space.id !== removedId));
  assert.ok(level.doors.every(door => door.spaceId !== removedId && door.toSpaceId !== removedId));
  const redLevel = studies.buildings['55'].levels.find(item => item.index === 1);
  const removedDoor = redLevel.doors.find(door => door.spaceId === east.id || door.toSpaceId === east.id);
  assert.ok(removedDoor);
  assert.deepEqual(level.doors.map(door => door.id).sort(),
    redLevel.doors.filter(door => door !== removedDoor).map(door => whiteId(door.id, 1)).sort());
});

test('all floors retain full apartment inventories, precise clear rooms, shared envelopes and vertically aligned stairs', () => {
  for (const {plan, level, name} of floors()) {
    assert.equal(plan.rooms.length, plan.levelIndex === 2 ? 20 : 16, `${name} singles`);
    assert.equal((plan.sharedApartments || []).length, plan.levelIndex === 2 ? 0 : 4, `${name} shared apartments`);
    assert.equal(level.spaces.filter(space => space.kind === 'room').length, plan.rooms.length);
    assert.equal(level.spaces.filter(space => space.kind === 'shared').length, (plan.sharedApartments || []).length);
    for (const room of plan.rooms) {
      const sides = edges(room.polygon).map(([a, b]) => distance(a, b)).sort((a, b) => a - b);
      sides.forEach((side, i) => close(side, [2.7, 2.7, 6, 6][i], `${name}/${room.label} clear side`));
      close(ringArea(room.polygon), 16.2);
      close(ringArea(room.modulePolygon), 18.6);
      assert.equal(room.sideWalls.length, 2);
      room.sideWalls.forEach(wall => close(ringArea(wall), 1.2));
      sameArea(union([room.polygon], ...room.sideWalls.map(wall => [wall])), [room.modulePolygon], 'Room with two side strips');
    }
    for (const shared of plan.sharedApartments || []) {
      const sides = edges(shared.polygon).map(([a, b]) => distance(a, b)).sort((a, b) => a - b);
      sides.forEach((side, i) => close(side, [6.2, 6.2, 7.4, 7.4][i], `${name}/${shared.label} gross envelope`));
      close(ringArea(shared.polygon), 45.88);
    }
    assert.deepEqual(geometry(plan.stair), geometry(topPlan.stair), `${name} exact Red stair`);
    const stair = level.spaces.find(space => space.kind === 'stairs');
    const groundStair = generated.studies.buildings['57'].levels[0].spaces.find(space => space.kind === 'stairs');
    assert.deepEqual(stair.polygon, groundStair.polygon);
    assert.deepEqual(stair.stairFlight, groundStair.stairFlight);
  }
});

test('nonoverlapping rooms, walls and circulation cover every floor, with only the exact EG stair spur unassigned', () => {
  const {local} = frames(generated.metadata.coordinateFrame);
  const snapped = point => local(point).map(value => Math.round(value * 1e7) / 1e7);
  for (const {plan, level, name} of floors()) {
    const floor = [plan.shell.outline, ...(plan.shell.holes || [])];
    const pieces = [...level.spaces, ...level.wallBands].map(space =>
      polygon(space).map(ring => ring.map(snapped)));
    for (const piece of pieces) close(area(difference(piece, floor)), 0, `${name} containment`);
    const occupied = union(...pieces), residual = outline(plan.unassignedPolygons);
    close(area(occupied), pieces.reduce((sum, piece) => sum + area([piece]), 0), `${name} no positive overlaps`);
    sameArea(union(occupied, residual), floor, `${name} complete footprint coverage`);
    close(area(intersection(occupied, residual)), 0, `${name} unassigned area is separate`);
    close(area(residual), plan.levelIndex === 0 ? 7.83 : 0, `${name} expected unassigned area`);
    close(area([floor]), [716.01, 597.51, 478.78][plan.levelIndex], `${name} floor area`);
    if (plan.levelIndex === 0) {
      const spur = groundFloorPlan.restoredAreas.find(item => item.status === 'unassigned-footprint');
      sameArea(residual, [spur.polygon], 'The complete Red EG stair-side spur remains');
    }
  }
});

test('each apartment, balcony and common room has one real hallway door and a connected route to the stairs', () => {
  for (const {level, plan, name} of floors()) {
    const graph = new Map(level.spaces.map(space => [space.id, new Set()]));
    for (const hall of plan.corridors) {
      const sides = edges(hall.polygon).map(([a, b]) => distance(a, b));
      close(Math.min(...sides), 1.4, `${name}/${hall.bank} clear hallway width`);
    }
    for (const door of level.doors) {
      const [a, b] = door.segment, midpoint = a.map((value, i) => (value + b[i]) / 2);
      const neighbors = level.spaces.filter(space =>
        [a, b, midpoint].every(point => boundaryDistance(point, space) < epsilon));
      assert.deepEqual(neighbors.map(space => space.id).sort(), [door.spaceId, door.toSpaceId].sort(),
        `${name}/${door.id} lies on its two actual boundaries`);
      close(distance(a, b), 0.9, `${name}/${door.id} door width`);
      graph.get(door.spaceId).add(door.toSpaceId);
      graph.get(door.toSpaceId).add(door.spaceId);
    }
    const stairs = level.spaces.filter(space => space.kind === 'stairs');
    assert.equal(stairs.length, 1);
    assert.equal(visit(graph, stairs[0].id).size, level.spaces.length, `${name} every assigned space reaches the stairs`);
    for (const space of level.spaces.filter(space => ['room', 'shared', 'service'].includes(space.kind))) {
      const doors = level.doors.filter(door => door.spaceId === space.id || door.toSpaceId === space.id);
      assert.equal(doors.length, 1, `${name}/${space.label} has one entrance`);
      const neighbor = doors[0].spaceId === space.id ? doors[0].toSpaceId : doors[0].spaceId;
      assert.equal(level.spaces.find(item => item.id === neighbor).kind, 'corridor');
    }
  }
});

test('White schematic windows are rigid copies of Red layouts while White folded source evidence remains independent', () => {
  const target = frames(generated.metadata.coordinateFrame);
  for (const {level, plan, red, name} of floors()) {
    const sourceLevel = studies.buildings['55'].levels.find(item => item.index === plan.levelIndex);
    const source = frames(red.coordinateFrame);
    assert.equal(level.layoutWindows.length, 24);
    for (const window of sourceLevel.layoutWindows) {
      const actual = level.layoutWindows.find(item => item.id === whiteId(window.id, plan.levelIndex));
      assert.ok(actual, `${name}/${window.id} schematic opening retained`);
      window.segment.map(point => target.campus(source.local(point))).forEach((point, i) =>
        point.forEach((value, axis) => close(value, actual.segment[i][axis], `${name} schematic registration`)));
      const [a, b] = actual.segment, midpoint = a.map((value, i) => (value + b[i]) / 2);
      for (const point of [a, b, midpoint]) close(boundaryDistance(point, {polygon: level.floorOutline[0].outer}), 0,
        `${name} schematic opening lies on its independent exterior`);
    }
    const previous = before.building.levels.find(item => item.index === plan.levelIndex);
    for (const key of ['windows', 'windowCoverage']) {
      assert.deepEqual(level[key], previous[key], `${name} source ${key}`);
      assert.equal(Object.hasOwn(level, key), Object.hasOwn(previous, key), `${name} source field presence`);
    }
  }
  const injected = structuredClone(studies);
  for (const level of injected.buildings['57'].levels) {
    level.windows = [{
      id: `white-source-${level.index}`, label: 'White original facade observation', confidence: 'estimated',
      sourceSurfaceIndex: 42, note: 'Independent folded source metadata', segment: [[1, 2], [2, 2]],
    }];
    level.windowCoverage = 'complete-floor';
  }
  const original = structuredClone(injected);
  const result = createHouse57ModuleLayouts({...input, studies: injected});
  assert.deepEqual(injected, original);
  for (const level of result.studies.buildings['57'].levels) {
    const source = original.buildings['57'].levels.find(item => item.index === level.index);
    assert.deepEqual(level.windows, source.windows);
    assert.equal(level.windowCoverage, source.windowCoverage);
    assert.notEqual(level.windows, injected.buildings['57'].levels[level.index].windows);
    assert.deepEqual(level.layoutWindows, generated.studies.buildings['57'].levels[level.index].layoutWindows);
  }
});

test('White study identifiers are unique, stable, floor-specific and reference existing spaces', () => {
  const identifiers = [];
  for (const {level, name} of floors()) {
    const spaces = new Set(level.spaces.map(space => space.id));
    for (const item of level.spaces) assert.ok(item.id.startsWith(`study-57-${level.index}-`), `${name}/${item.id}`);
    for (const item of [...level.doors, ...level.layoutWindows, ...level.wallBands]) {
      assert.ok(item.id.startsWith(`module-57-${level.index}-`), `${name}/${item.id}`);
    }
    for (const door of level.doors) {
      assert.ok(spaces.has(door.spaceId));
      assert.ok(spaces.has(door.toSpaceId));
    }
    for (const window of level.layoutWindows) if (window.spaceId) assert.ok(spaces.has(window.spaceId));
    identifiers.push(...[...level.spaces, ...level.doors, ...level.layoutWindows, ...level.wallBands].map(item => item.id));
  }
  assert.equal(new Set(identifiers).size, identifiers.length);
});

test('legacy fitting and source-study generation cannot overwrite the independently accepted White layout', () => {
  const fitted = createOldHouseModuleLayouts(input);
  assert.deepEqual(fitted.studies, studies);
  assert.deepEqual(Object.keys(fitted.metadata.houses), []);
  assert.deepEqual(fitted.metadata, oldHouseLayouts);
  const mixed = structuredClone(historical);
  mixed.buildings['57'] = structuredClone(studies.buildings['57']);
  const previous = structuredClone(mixed.buildings['57']);
  const result = generateOldHouseStudies({studies: mixed, lod2, campus, interiors, roomMarkers});
  assert.deepEqual(result.studies.buildings['57'], previous);
});

test('preservation receipt protects Red, all other houses, original source exteriors and retained historical evidence', async () => {
  const receipt = await read('docs/evidence/house57-layout-preservation.json');
  const sha = value => createHash('sha256').update(value).digest('hex');
  for (const [path, record] of Object.entries(receipt.immutableFiles)) {
    assert.equal(record.unchanged, true, path);
    assert.equal(sha(await readFile(new URL(`../${path}`, import.meta.url))), record.sha256, path);
  }
  assert.equal(receipt.baseCommit, before.baseCommit);
  assert.equal(receipt.house55Unchanged, true);
  assert.deepEqual(receipt.studyChangeScope.changedBuildingRecords, ['57']);
  // This receipt describes the earlier White release. Reconstruct that dated
  // record with Green's, Yellow's and Orange's retained pre-completion data; their
  // current layouts are protected independently by their dedicated suites.
  const whiteReleaseStudies = structuredClone(studies);
  whiteReleaseStudies.buildings['59'] = structuredClone(archivedGreen.building);
  whiteReleaseStudies.buildings['51'] = structuredClone(archivedYellow.building);
  whiteReleaseStudies.buildings['53'] = structuredClone(archivedOrange.building);
  assert.equal(sha(JSON.stringify(whiteReleaseStudies, null, 2) + '\n'), receipt.studyChangeScope.afterSha256);
  assert.equal(sha(await readFile(new URL(`../${receipt.whiteCanonical.path}`, import.meta.url))),
    receipt.whiteCanonical.sha256);
  assert.equal(sha(await readFile(new URL(`../${receipt.historicalWhiteFit.path}`, import.meta.url))),
    receipt.historicalWhiteFit.sha256);
  assert.equal(sha(JSON.stringify(studies.buildings['55'])), receipt.house55RecordSha256);
  for (const [house, record] of Object.entries(receipt.unchangedStudyBuildings)) {
    assert.notEqual(house, '57');
    assert.equal(sha(JSON.stringify(whiteReleaseStudies.buildings[house])), record.sha256, house);
  }
  assert.equal(receipt.otherBuildings.length, 9);
  assert.ok(receipt.otherBuildings.every(record => record.exteriorUnchanged && record.campusUnchanged));
  for (const house of ['51', '53', '59']) {
    const layout = {'51': archivedYellow, '53': archivedOrange, '59': archivedGreen}[house].layout;
    assert.equal(sha(JSON.stringify(layout)), receipt.retainedFittedHouses[house].sha256);
  }
  assert.equal(receipt.currentFittedCatalogExcludes57, true);
  assert.equal(oldHouseLayouts.houses['57'], undefined);
});
