import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {difference, intersection, union} from 'polyclip-ts';
import {createHouse59ModuleLayouts} from '../scripts/house59-module-layout.mjs';
import {createOldHouseModuleLayouts} from '../scripts/old-house-module-layout.mjs';
import {generateOldHouseStudies} from '../scripts/generate-old-house-studies.mjs';
import {validateInteriorStudies} from '../src/interior-studies.js';
import {readHistoricalStudies} from './fixtures/pre-module-studies.mjs';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const [studies, lod2, campus, interiors, roomMarkers, topPlan, firstFloorPlan, groundFloorPlan, published,
  oldHouseLayouts, before, historical, archivedYellow, archivedOrange] = await Promise.all([
  read('public/data/interior-studies.json'), read('public/data/lod2.json'), read('public/data/campus.json'),
  read('public/data/interiors.json'), read('public/data/room-markers.json'),
  read('public/data/house55-module-layout.json'), read('public/data/house55-first-floor-layout.json'),
  read('public/data/house55-ground-floor-layout.json'), read('public/data/house59-module-layouts.json'),
  read('public/data/old-house-module-layouts.json'), read('tests/fixtures/house59-before-resident-layout.json'),
  readHistoricalStudies(), read('tests/fixtures/house51-before-top-floor-layout.json'),
  read('tests/fixtures/house53-before-resident-layout.json'),
]);
const input = {studies, lod2, topPlan, firstFloorPlan, groundFloorPlan, oldHouseLayouts};
const snapshot = structuredClone(input), generated = createHouse59ModuleLayouts(input);
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
const greenId = (id, floor) => id.replace(/^study-55-\d+-/, `study-59-${floor}-`)
  .replace(/^module-55-\d+-/, `module-59-${floor}-`)
  .replace(/^module-(?!59-)/, `module-59-${floor}-`);
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
  plan, level: generated.studies.buildings['59'].levels.find(level => level.index === plan.levelIndex),
  red: [groundFloorPlan, firstFloorPlan, topPlan][plan.levelIndex],
  name: `Green/${plan.levelIndex}`,
}));

test('Green generation is deterministic, nonmutating and reproduces the canonical plans and published study', () => {
  assert.deepEqual(input, snapshot);
  assert.deepEqual(createHouse59ModuleLayouts(input), generated);
  assert.deepEqual(createHouse59ModuleLayouts({...input, studies: generated.studies}), generated);
  assert.deepEqual(generated.metadata, published);
  assert.deepEqual(generated.studies, studies);
  const original = structuredClone(studies);
  original.buildings['59'] = structuredClone(before.building);
  assert.deepEqual(createHouse59ModuleLayouts({...input, studies: original}), generated,
    'The original fitted Green study produces the same completed replacement');
  const freeze = value => {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  };
  assert.deepEqual(createHouse59ModuleLayouts(freeze(structuredClone(input))), generated);
  for (const [house, building] of Object.entries(studies.buildings)) {
    if (house !== '59') assert.deepEqual(generated.studies.buildings[house], building);
  }
  assert.equal(validateInteriorStudies(generated.studies, campus, lod2), true);
});

test('Green discards its old fitting offsets and uses one rigid metre frame for all three floors', () => {
  const frame = generated.metadata.coordinateFrame;
  assert.deepEqual(frame, before.layout.coordinateFrame);
  close(Math.hypot(...frame.axisU), 1);
  close(Math.hypot(...frame.axisV), 1);
  close(frame.axisU[0] * frame.axisV[0] + frame.axisU[1] * frame.axisV[1], 0);
  close(frame.axisU[0] * frame.axisV[1] - frame.axisU[1] * frame.axisV[0], 1);
  assert.deepEqual(createHouse59ModuleLayouts({...input, oldHouseLayouts: undefined}), generated);
  const {campus: toCampus} = frames(frame);
  for (const {plan, level, name} of floors()) {
    assert.deepEqual(plan.coordinateFrame, frame, name);
    assert.equal(plan.bankPlacements, undefined);
    assert.equal(plan.status, 'resident-module-layout');
    assert.equal(level.layoutBasis, 'resident-module-layout');
    assert.equal(level.extrapolatedFrom, undefined);
    assert.equal(level.floorOutline.length, 1);
    assert.deepEqual(level.floorOutline[0].holes || [], []);
    plan.shell.outline.map(toCampus).forEach((point, i) => point.forEach((value, axis) =>
      close(value, level.floorOutline[0].outer[i][axis], `${name} shell registration`)));
    for (const item of [...plan.rooms, ...(plan.sharedApartments || []), ...(plan.commonAreas || [])]) {
      const actual = level.spaces.find(space => space.id === item.id);
      assert.ok(actual, `${name}/${item.label} published`);
      item.polygon.map(toCampus).forEach((point, i) => point.forEach((value, axis) =>
        close(value, actual.polygon[i][axis], `${name}/${item.label} unscaled placement`)));
    }
  }
});

test('Green top and first-floor geometry repeat Red exactly including both first-floor balconies', () => {
  for (const {plan, level, red, name} of floors().filter(item => item.plan.levelIndex > 0)) {
    for (const key of ['dimensions', 'shell', 'rooms', 'sharedApartments', 'corridors', 'circulationExtensions',
      'commonAreas', 'wallBands', 'stair', 'outlineDimensions', 'reconciliation']) {
      assert.deepEqual(geometry(plan[key]), geometry(red[key]), `${name}/${key}`);
    }
    for (const [key, value] of Object.entries(red.totals)) assert.equal(plan.totals[key], value, `${name}/${key}`);
    const source = studies.buildings['55'].levels.find(item => item.index === plan.levelIndex);
    const toCampus = frames(plan.coordinateFrame).campus, fromRed = frames(red.coordinateFrame).local;
    for (const group of ['spaces', 'doors', 'wallBands']) {
      assert.equal(level[group].length, source[group].length, `${name}/${group} count`);
      for (const item of level[group]) {
        const original = source[group].find(record => greenId(record.id, plan.levelIndex) === item.id);
        assert.ok(original, `${name}/${item.id} matched Red source`);
        for (const field of ['polygon', 'segment', 'stairFlight']) {
          if (!original[field]) continue;
          assert.equal(item[field].length, original[field].length);
          original[field].map(point => toCampus(fromRed(point))).forEach((point, i) =>
            point.forEach((value, axis) => close(value, item[field][i][axis], `${name}/${field}`)));
        }
      }
    }
  }
  const first = floors().find(item => item.plan.levelIndex === 1);
  assert.deepEqual(first.plan.commonAreas.map(space => [space.bank, space.label, space.use]),
    [['R', 'East balcony', 'balcony'], ['L', 'West balcony', 'balcony']]);
  assert.equal(first.level.spaces.length, 25);
  assert.equal(first.level.doors.length, 24);
  close(ringArea(first.plan.shell.outline), 624.48);
});

test('Green EG replaces the complete N wing with one Hausmeister enclosure and one entrance', () => {
  const {plan, level} = floors().find(item => item.plan.levelIndex === 0);
  assert.deepEqual(geometry(plan.shell), geometry(groundFloorPlan.shell));
  const hausmeister = plan.commonAreas.find(space => space.label === 'Hausmeister');
  assert.ok(hausmeister);
  const envelope = [[-5, 7.4], [7.4, 7.4], [7.4, 14.8], [-5, 14.8], [-5, 7.4]];
  sameArea([hausmeister.polygon], [envelope], 'Hausmeister occupies the complete 12.40 × 7.40 N wing');
  close(ringArea(hausmeister.polygon), 91.76);
  assert.equal(plan.rooms.some(room => room.bank === 'N'), false);
  assert.equal(plan.sharedApartments.some(room => room.bank === 'N'), false);
  assert.equal(plan.corridors.some(hall => hall.bank === 'N'), false,
    'Former N hall belongs to Hausmeister, not a duplicate public corridor');
  assert.ok(level.spaces.every(space => !['N1', 'N2', 'N3–N4'].includes(space.shortLabel)));
  const hSpace = level.spaces.find(space => space.id === hausmeister.id);
  assert.equal(hSpace.kind, 'service');
  const doors = level.doors.filter(door => door.spaceId === hSpace.id || door.toSpaceId === hSpace.id);
  assert.equal(doors.length, 1);
  const local = frames(plan.coordinateFrame).local;
  const segment = doors[0].segment.map(local);
  segment.forEach(point => close(point[1], 7.4));
  close(Math.min(...segment.map(point => point[0])), 6.25);
  close(Math.max(...segment.map(point => point[0])), 7.15);
  const formerN = union(
    ...groundFloorPlan.rooms.filter(room => room.bank === 'N').map(room => [room.modulePolygon]),
    ...groundFloorPlan.sharedApartments.filter(room => room.bank === 'N').map(room => [room.polygon]),
    ...groundFloorPlan.corridors.filter(hall => hall.bank === 'N').map(hall => [hall.polygon]),
  );
  sameArea([hausmeister.polygon], formerN, 'No invented footprint or remaining N partitions');
});

test('EG has Garden room east, Storage west and the missing A-bank single restored from Red', () => {
  const {plan} = floors().find(item => item.plan.levelIndex === 0);
  const garden = plan.commonAreas.find(space => space.bank === 'R');
  const storage = plan.commonAreas.find(space => space.bank === 'L');
  assert.equal(garden.label, 'Garden room');
  assert.equal(storage.label, 'Storage');
  for (const actual of [garden, storage]) {
    const original = groundFloorPlan.commonAreas.find(space => space.bank === actual.bank);
    sameArea([actual.polygon], [original.polygon], `${actual.label} exact common enclosure`);
    close(ringArea(actual.polygon), 68.82);
  }
  assert.deepEqual(garden.doorSegment, [[14.05, 7.4], [13.15, 7.4]]);
  assert.deepEqual(storage.doorSegment, groundFloorPlan.commonAreas.find(space => space.bank === 'L').doorSegment);
  const formerALabels = before.layout.levels.find(level => level.levelIndex === 0).rooms
    .filter(room => room.bank === 'A').map(room => room.label).sort();
  assert.deepEqual(formerALabels, ['C', 'D']);
  assert.deepEqual(plan.rooms.filter(room => room.bank === 'A').map(room => room.label).sort(), ['B', 'C', 'D']);
  for (const key of ['rooms', 'sharedApartments', 'corridors']) {
    assert.deepEqual(geometry(plan[key]), geometry(groundFloorPlan[key].filter(item => item.bank !== 'N')),
      `EG/${key} preserves every other Red room and hall`);
  }
  assert.deepEqual(geometry(plan.wallBands),
    geometry(groundFloorPlan.wallBands.filter(wall => !/^N[12] side wall/.test(wall.label))));
});

test('single rooms, shared apartments and stairs retain exact dimensions and vertical alignment', () => {
  for (const {plan, level, name} of floors()) {
    assert.equal(plan.rooms.length, [14, 16, 20][plan.levelIndex], `${name} singles`);
    assert.equal((plan.sharedApartments || []).length, [3, 4, 0][plan.levelIndex], `${name} shared`);
    assert.equal(level.spaces.length, [23, 25, 23][plan.levelIndex], `${name} assigned spaces`);
    assert.equal(level.doors.length, [22, 24, 22][plan.levelIndex], `${name} doors`);
    for (const room of plan.rooms) {
      const sides = edges(room.polygon).map(([a, b]) => distance(a, b)).sort((a, b) => a - b);
      sides.forEach((side, i) => close(side, [2.7, 2.7, 6, 6][i], `${name}/${room.label}`));
      close(ringArea(room.polygon), 16.2);
      close(ringArea(room.modulePolygon), 18.6);
      assert.equal(room.sideWalls.length, 2);
      room.sideWalls.forEach(wall => close(ringArea(wall), 1.2));
      sameArea(union([room.polygon], ...room.sideWalls.map(wall => [wall])), [room.modulePolygon],
        `${name}/${room.label} room and two side allocations`);
    }
    for (const shared of plan.sharedApartments || []) {
      const sides = edges(shared.polygon).map(([a, b]) => distance(a, b)).sort((a, b) => a - b);
      sides.forEach((side, i) => close(side, [6.2, 6.2, 7.4, 7.4][i], `${name}/${shared.label}`));
      close(ringArea(shared.polygon), 45.88);
    }
    assert.deepEqual(geometry(plan.stair), geometry(topPlan.stair), `${name} Red stair footprint`);
    const stair = level.spaces.find(space => space.kind === 'stairs');
    const ground = generated.studies.buildings['59'].levels.find(level => level.index === 0)
      .spaces.find(space => space.kind === 'stairs');
    assert.deepEqual(stair.polygon, ground.polygon);
    assert.deepEqual(stair.stairFlight, ground.stairFlight);
  }
});

test('every Green floor has nonoverlapping complete coverage with only the retained EG stair spur unassigned', () => {
  const local = frames(generated.metadata.coordinateFrame).local;
  const snapped = point => local(point).map(value => Math.round(value * 1e7) / 1e7);
  for (const {plan, level, name} of floors()) {
    const floor = [plan.shell.outline, ...(plan.shell.holes || [])];
    const pieces = [...level.spaces, ...level.wallBands].map(space => polygon(space).map(ring => ring.map(snapped)));
    for (const piece of pieces) close(area(difference(piece, floor)), 0, `${name} assigned containment`);
    const occupied = union(...pieces), residual = outline(plan.unassignedPolygons);
    close(area(occupied), pieces.reduce((sum, piece) => sum + area([piece]), 0), `${name} no overlap`);
    sameArea(union(occupied, residual), floor, `${name} complete footprint coverage`);
    close(area(intersection(occupied, residual)), 0, `${name} separate unassigned remainder`);
    close(area(residual), plan.levelIndex === 0 ? 7.83 : 0, `${name} unassigned area`);
    close(area([floor]), [716.01, 624.48, 478.78][plan.levelIndex], `${name} shell area`);
    if (plan.levelIndex === 0) sameArea(residual,
      [groundFloorPlan.restoredAreas.find(item => item.status === 'unassigned-footprint').polygon],
      'Only the original Red stair-side spur remains unassigned');
  }
});

test('each Green apartment and common room has one boundary doorway and a connected route to the stairs', () => {
  for (const {level, plan, name} of floors()) {
    const graph = new Map(level.spaces.map(space => [space.id, new Set()]));
    for (const hall of plan.corridors) {
      close(Math.min(...edges(hall.polygon).map(([a, b]) => distance(a, b))), 1.4, `${name}/${hall.bank} hall`);
    }
    for (const door of level.doors) {
      const [a, b] = door.segment, midpoint = a.map((value, i) => (value + b[i]) / 2);
      const neighbors = level.spaces.filter(space =>
        [a, b, midpoint].every(point => boundaryDistance(point, space) < epsilon));
      assert.deepEqual(neighbors.map(space => space.id).sort(), [door.spaceId, door.toSpaceId].sort(),
        `${name}/${door.id} two real shared boundaries`);
      close(distance(a, b), 0.9, `${name}/${door.id} clear width`);
      graph.get(door.spaceId).add(door.toSpaceId);
      graph.get(door.toSpaceId).add(door.spaceId);
    }
    const stair = level.spaces.find(space => space.kind === 'stairs');
    assert.equal(visit(graph, stair.id).size, level.spaces.length, `${name} all spaces reach the stair`);
    for (const space of level.spaces.filter(space => ['room', 'shared', 'service'].includes(space.kind))) {
      const doors = level.doors.filter(door => door.spaceId === space.id || door.toSpaceId === space.id);
      assert.equal(doors.length, 1, `${name}/${space.label} entrance inventory`);
      const neighborId = doors[0].spaceId === space.id ? doors[0].toSpaceId : doors[0].spaceId;
      assert.equal(level.spaces.find(item => item.id === neighborId).kind, 'corridor');
    }
  }
});

test('Green layout windows copy Red positions and reassign the former N windows to Hausmeister on EG', () => {
  const target = frames(generated.metadata.coordinateFrame);
  for (const {level, plan, red, name} of floors()) {
    const source = frames(red.coordinateFrame);
    const originals = studies.buildings['55'].levels.find(item => item.index === plan.levelIndex).layoutWindows;
    assert.equal(level.layoutWindows.length, 24);
    const hausmeister = level.spaces.find(space => space.label === 'Hausmeister');
    for (const window of originals) {
      const formerN = plan.levelIndex === 0 && /-window-N/.test(window.id);
      const expectedSegment = window.segment.map(point => target.campus(source.local(point)));
      const actual = formerN
        ? level.layoutWindows.find(item => item.spaceId === hausmeister.id
          && item.segment.every((point, i) => distance(point, expectedSegment[i]) < epsilon))
        : level.layoutWindows.find(item => item.id === greenId(window.id, plan.levelIndex));
      assert.ok(actual, `${name}/${window.id} stable independent opening`);
      expectedSegment.forEach((point, i) =>
        point.forEach((value, axis) => close(value, actual.segment[i][axis], `${name} window registration`)));
      actual.segment.forEach(point => close(boundaryDistance(point, {polygon: level.floorOutline[0].outer}), 0,
        `${name} independent exterior opening`));
      if (formerN) {
        assert.equal(actual.spaceId, hausmeister.id);
        assert.match(actual.label, /^Hausmeister window /);
      }
      else assert.equal(actual.spaceId, window.spaceId ? greenId(window.spaceId, plan.levelIndex) : undefined);
    }
    if (hausmeister) assert.equal(level.layoutWindows.filter(window => window.spaceId === hausmeister.id).length, 4);
    const previous = before.building.levels.find(item => item.index === plan.levelIndex);
    for (const key of ['windows', 'windowCoverage']) {
      assert.deepEqual(level[key], previous[key]);
      assert.equal(Object.hasOwn(level, key), Object.hasOwn(previous, key));
    }
  }
  const injected = structuredClone(studies);
  for (const level of injected.buildings['59'].levels) {
    level.windows = [{id: `green-source-${level.index}`, note: 'Original Green source observation',
      segment: [[1, 2], [2, 2]], sourceSurfaceIndex: 42, confidence: 'estimated'}];
    level.windowCoverage = 'complete-floor';
  }
  const snapshot = structuredClone(injected);
  const result = createHouse59ModuleLayouts({...input, studies: injected});
  assert.deepEqual(injected, snapshot);
  for (const level of result.studies.buildings['59'].levels) {
    const original = snapshot.buildings['59'].levels.find(item => item.index === level.index);
    assert.deepEqual(level.windows, original.windows);
    assert.equal(level.windowCoverage, original.windowCoverage);
    assert.notEqual(level.windows, injected.buildings['59'].levels[level.index].windows);
  }
});

test('Green identifiers are unique, floor-specific and reference only existing Green spaces', () => {
  const ids = [];
  for (const {level, name} of floors()) {
    const spaces = new Set(level.spaces.map(space => space.id));
    for (const item of level.spaces) assert.ok(item.id.startsWith(`study-59-${level.index}-`), `${name}/${item.id}`);
    for (const item of [...level.doors, ...level.layoutWindows, ...level.wallBands]) {
      assert.ok(item.id.startsWith(`module-59-${level.index}-`), `${name}/${item.id}`);
      for (const field of ['spaceId', 'toSpaceId']) if (item[field]) assert.ok(spaces.has(item[field]));
    }
    ids.push(...[...level.spaces, ...level.doors, ...level.layoutWindows, ...level.wallBands].map(item => item.id));
  }
  assert.equal(new Set(ids).size, ids.length);
});

test('legacy generators preserve all completed Orange, Red, White and Green floors', () => {
  const fitted = createOldHouseModuleLayouts(input);
  assert.deepEqual(Object.keys(fitted.metadata.houses).sort(), ['51']);
  assert.deepEqual(fitted.metadata, oldHouseLayouts);
  assert.deepEqual(fitted.studies, studies);
  const mixed = structuredClone(historical);
  for (const house of ['53', '57', '59']) mixed.buildings[house] = structuredClone(studies.buildings[house]);
  const previous = structuredClone(mixed);
  const result = generateOldHouseStudies({studies: mixed, lod2, campus, interiors, roomMarkers});
  for (const house of ['53', '57', '59']) assert.deepEqual(result.studies.buildings[house], previous.buildings[house]);
});

test('Green preservation receipt protects completed Red and White, remaining provisional houses and all exterior evidence', async () => {
  const receipt = await read('docs/evidence/house59-layout-preservation.json');
  const sha = value => createHash('sha256').update(value).digest('hex');
  assert.equal(receipt.baseCommit, before.baseCommit);
  // Exact bytes retained from this receipt's base commit, b4af250847d77a7cb2ae48f2151f91b44d23e20c.
  // Current validation/rendering now supports Orange's linked stair flights;
  // its runtime contract remains covered by the current schema and renderer tests.
  const greenReleaseSources = {
    'src/interior-studies.js': 'tests/fixtures/interior-studies-at-house59-release.js',
    'src/interior-wireframe.js': 'tests/fixtures/interior-wireframe-at-house59-release.js',
  };
  for (const [path, record] of Object.entries(receipt.immutableFiles)) {
    assert.equal(record.unchanged, true, path);
    const source = greenReleaseSources[path] || path;
    assert.equal(sha(await readFile(new URL(`../${source}`, import.meta.url))), record.sha256, path);
  }
  assert.deepEqual(receipt.studyChangeScope.changedBuildingRecords, ['59']);
  // This dated receipt predates Yellow's top-floor and Orange's replacements.
  // Recreate both exact earlier records to retain the original release audit.
  const greenReleaseStudies = structuredClone(studies);
  greenReleaseStudies.buildings['51'] = structuredClone(archivedYellow.building);
  greenReleaseStudies.buildings['53'] = structuredClone(archivedOrange.building);
  assert.equal(sha(JSON.stringify(greenReleaseStudies, null, 2) + '\n'), receipt.studyChangeScope.afterSha256);
  assert.equal(sha(await readFile(new URL(`../${receipt.greenCanonical.path}`, import.meta.url))),
    receipt.greenCanonical.sha256);
  assert.equal(sha(await readFile(new URL(`../${receipt.historicalGreenFit.path}`, import.meta.url))),
    receipt.historicalGreenFit.sha256);
  for (const [house, record] of Object.entries(receipt.unchangedStudyBuildings)) {
    assert.notEqual(house, '59');
    assert.equal(record.unchanged, true);
    assert.equal(sha(JSON.stringify(greenReleaseStudies.buildings[house])), record.sha256, house);
  }
  for (const house of ['51', '53']) {
    const layout = {'51': archivedYellow, '53': archivedOrange}[house].layout;
    assert.equal(sha(JSON.stringify(layout)), receipt.retainedFittedHouses[house].sha256);
  }
  assert.equal(receipt.currentFittedCatalogExcludes59, true);
  assert.equal(oldHouseLayouts.houses['59'], undefined);
  assert.equal(receipt.greenExteriorUnchanged, true);
  assert.ok(receipt.otherBuildings.every(record => record.exteriorUnchanged && record.campusUnchanged));
  assert.equal(receipt.annotation.sha256, 'd7647b1ec8d4892aa9105c4188cd5f8098b1603a5cc152bec1c778c925a87bf4');
  assert.equal(sha(await readFile(new URL(`../${receipt.annotation.path}`, import.meta.url))), receipt.annotation.sha256);
  assert.equal(published.sourceAnnotation.path, receipt.annotation.path);
  assert.equal(published.sourceAnnotation.sha256, receipt.annotation.sha256);
  for (const [key, source] of Object.entries({topPlan, firstFloorPlan, groundFloorPlan})) {
    assert.equal(published.sourceHashes[key], sha(JSON.stringify(source)), `${key} exact canonical source hash`);
  }
});
