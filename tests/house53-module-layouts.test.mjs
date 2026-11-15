import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {difference, intersection, union} from 'polyclip-ts';
import {createHouse53ModuleLayouts} from '../scripts/house53-module-layouts.mjs';
import {createOldHouseModuleLayouts} from '../scripts/old-house-module-layout.mjs';
import {validateInteriorStudies} from '../src/interior-studies.js';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const [studies, published, before, catalog, campus, lod2, topPlan, firstFloorPlan, groundFloorPlan] =
  await Promise.all([
    read('public/data/interior-studies.json'), read('public/data/house53-module-layouts.json'),
    read('tests/fixtures/house53-before-resident-layout.json'), read('public/data/old-house-module-layouts.json'),
    read('public/data/campus.json'), read('public/data/lod2.json'),
    read('public/data/house55-module-layout.json'), read('public/data/house55-first-floor-layout.json'),
    read('public/data/house55-ground-floor-layout.json'),
  ]);
const input = {studies, lod2, topPlan, oldHouseLayouts: catalog}, snapshot = structuredClone(input);
const generated = createHouse53ModuleLayouts(input);
const plans = generated.metadata.levels;
const close = (a, b, label = '') => assert.ok(Math.abs(a - b) < 1e-6, `${label}: ${a} vs ${b}`);
const edges = ring => ring.slice(1).map((b, i) => [ring[i], b]);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const ringArea = ring => Math.abs(edges(ring).reduce((sum, [a, b]) =>
  sum + a[0] * b[1] - b[0] * a[1], 0)) / 2;
const area = polygons => polygons.reduce((sum, polygon) =>
  sum + ringArea(polygon[0]) - polygon.slice(1).reduce((holes, ring) => holes + ringArea(ring), 0), 0);
const rect = (u, v, width, depth) =>
  [[u, v], [u + width, v], [u + width, v + depth], [u, v + depth], [u, v]];
const sameArea = (a, b, label) => {
  close(area(difference(a, b)), 0, `${label}: excess`);
  close(area(difference(b, a)), 0, `${label}: gap`);
};
const key = room => `${room.bank}/${room.label}`;
const levelFor = index => studies.buildings['53'].levels.find(level => level.index === index);
const boundaryDistance = (point, ring) => Math.min(...edges(ring).map(([a, b]) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], squared = dx * dx + dy * dy;
  const t = squared ? Math.max(0, Math.min(1,
    ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / squared)) : 0;
  return distance(point, [a[0] + t * dx, a[1] + t * dy]);
}));
const local = (point, frame) => [frame.axisU, frame.axisV].map(axis => Math.round(1e7 *
  ((point[0] - frame.originCampusXZ[0]) * axis[0] +
   (point[1] - frame.originCampusXZ[1]) * axis[1])) / 1e7);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('Orange generation is immutable, reproducible from the old fit, and preserves all other buildings', () => {
  assert.deepEqual(input, snapshot);
  assert.deepEqual(generated.metadata, published);
  assert.deepEqual(generated.studies, studies);
  assert.deepEqual(createHouse53ModuleLayouts({...input, studies: generated.studies}), generated);
  const original = structuredClone(studies), oldCatalog = structuredClone(catalog);
  original.buildings['53'] = structuredClone(before.building);
  oldCatalog.houses['53'] = structuredClone(before.layout);
  assert.deepEqual(createHouse53ModuleLayouts({...input, studies: original, oldHouseLayouts: oldCatalog}), generated);
  for (const [house, building] of Object.entries(original.buildings)) {
    if (house !== '53') assert.deepEqual(studies.buildings[house], building, house);
  }
  for (const [field, value] of Object.entries(before.building)) {
    if (!['source', 'levels'].includes(field)) assert.deepEqual(studies.buildings['53'][field], value, field);
  }
  for (const previous of before.building.levels) {
    const current = levelFor(previous.index);
    for (const field of ['windows', 'windowCoverage']) assert.deepEqual(current[field], previous[field]);
  }
  assert.equal(validateInteriorStudies(studies, campus, lod2), true);
});

test('all three inventories follow Orange’s own red additions and blue removals', () => {
  const common = ['E/E', 'E/F', 'E/G', 'N/N0', 'N/N1', 'N/N2',
    'R/R1', 'R/R2', 'R/R3', 'L/L1', 'L/L2', 'L/L3',
    'A/B', 'A/C', 'A/D', 'A/E', 'W/W2', 'W/W3', 'W/W4'];
  for (const plan of plans) {
    const lower = plan.levelIndex !== 2;
    assert.deepEqual(plan.rooms.map(key).sort(), [...common,
      ...(lower ? ['E/H', 'A/A', 'W/W1'] : ['N/N3'])].sort());
    assert.equal(plan.rooms.length, lower ? 22 : 20);
    assert.deepEqual(plan.sharedApartments.map(key), lower ? ['N/N3–N4'] : []);
    assert.equal(levelFor(plan.levelIndex).layoutBasis, 'resident-module-layout');
  }
  const top = plans[2], shell = [top.shell.outline];
  for (const [label, polygon] of [
    ['removed A', rect(38, -7.4, 3.1, 7.4)],
    ['removed east core gap', rect(10.5, 7.4, 6.2, 7.4)],
    ['removed west core gap', rect(19.4, -7.4, 6.2, 7.4)],
    ['absent W1', rect(28.7, 9.3, 7.4, 3.1)],
  ]) close(area(intersection(shell, [polygon])), 0, label);
  assert.equal(top.commonAreas.length, 0);
});

test('clear room dimensions, side allocations and repeated room columns remain fixed', () => {
  for (const plan of plans) for (const room of plan.rooms) {
    edges(room.polygon).map(([a, b]) => distance(a, b)).sort((a, b) => a - b)
      .forEach((length, i) => close(length, [2.7, 2.7, 6, 6][i], `${key(room)} clear edge`));
    close(ringArea(room.polygon), 16.2, 'Clear room');
    close(ringArea(room.modulePolygon), 18.6, 'Module');
    assert.equal(room.sideWalls.length, 2);
    room.sideWalls.forEach(wall => close(ringArea(wall), 1.2, 'Side allocation'));
    sameArea(union([room.polygon], ...room.sideWalls.map(wall => [wall])),
      [room.modulePolygon], 'Room and both walls fill module');
    for (const otherPlan of plans) {
      const other = otherPlan.rooms.find(item => key(item) === key(room));
      if (other) for (const field of ['polygon', 'modulePolygon', 'sideWalls']) {
        assert.deepEqual(room[field], other[field], `${key(room)} ${field} vertical alignment`);
      }
    }
    if (['R', 'L'].includes(room.bank)) {
      const source = topPlan.rooms.find(item => key(item) === key(room));
      assert.deepEqual(room.modulePolygon, source.modulePolygon, 'Central banks stay fixed');
    }
  }
  for (const plan of plans) {
    const room = label => plan.rooms.find(item => key(item) === label);
    sameArea([room('N/N0').modulePolygon], [rect(7.4, 8.8, 3.1, 6)], 'N0 beside N1');
    sameArea([room('A/E').modulePolygon], [rect(25.6, -7.4, 3.1, 6)], 'E beside D');
    for (const shared of plan.sharedApartments) {
      sameArea([shared.polygon], [rect(-5, 7.4, 6.2, 7.4)], 'Unsplit shared N3–N4');
    }
  }
});

test('middle balcony and Bar access stair retain their envelopes above ground common areas', () => {
  const middle = plans[1], ground = plans[0];
  assert.deepEqual(middle.commonAreas.map(item => item.use), ['bar-access-stair', 'balcony']);
  sameArea([middle.commonAreas[0].polygon], [rect(10.5, 7.4, 6.2, 2.9)], 'Bar access enclosure');
  sameArea([middle.commonAreas[1].polygon], [rect(19.4, -2.9, 6.2, 2.9)], 'West balcony');
  assert.match(middle.commonAreas[0].dimensionBasis, /inherited balcony depth/);
  const bar = ground.commonAreas.find(item => item.use === 'bar');
  const common = ground.commonAreas.find(item => item.use === 'common-room');
  sameArea([bar.polygon], [rect(10.5, 7.4, 6.2, 7.4)], 'Bar fills north gap');
  close(ringArea(bar.polygon), 45.88, 'Bar area');
  close(ringArea(common.polygon), 43.92, 'Stepped Common room area');
  const notch = rect(24.2, -1.4, 1.4, 1.4);
  sameArea(union([common.polygon], [notch]), [rect(19.4, -7.4, 6.2, 7.4)], 'Stepped outline');
  close(area(intersection([common.polygon], [notch])), 0, 'Notch stays outside common room');
  sameArea(intersection(union(...ground.corridors.map(item => [item.polygon])), [notch]),
    [notch], 'Notch is assigned to the public hallway');
  assert.equal(bar.doorSegment, undefined, 'No unmarked ground hall door invented');
  assert.equal(common.doorPlacement.evidence, 'resident-lime-mark');
});

test('every floor is a connected disjoint partition with no leftover fitted shell', () => {
  for (const plan of plans) {
    assert.deepEqual(plan.shell.holes, []);
    assert.deepEqual(plan.unassignedPolygons, []);
    const pieces = [...plan.rooms.map(room => [room.modulePolygon]),
      ...plan.sharedApartments.map(item => [item.polygon]), ...plan.commonAreas.map(item => [item.polygon]),
      ...plan.corridors.map(item => [item.polygon]), [plan.stair.polygon]];
    const occupied = union(...pieces);
    assert.equal(occupied.length, 1);
    assert.equal(occupied[0].length, 1);
    close(area(occupied), pieces.reduce((sum, polygon) => sum + area([polygon]), 0), 'No overlap');
    sameArea(occupied, [plan.shell.outline], 'Entire shell assigned');
    close(ringArea(plan.shell.outline), [662.3, 606.5, 478.78][plan.levelIndex], 'Expected floor area');
    const level = levelFor(plan.levelIndex);
    const rendered = [...level.spaces, ...level.wallBands].map(item =>
      [item.polygon.map(point => local(point, plan.coordinateFrame))]);
    sameArea(union(...rendered), [plan.shell.outline], 'Rendered spaces and walls cover local plan');
    close(area(union(...rendered)), rendered.reduce((sum, polygon) => sum + area([polygon]), 0),
      'Rendered spaces do not overlap');
    for (const hall of plan.corridors) {
      close(Math.min(...edges(hall.polygon).map(([a, b]) => distance(a, b))), 1.4, 'Hall width');
    }
  }
});

test('all physical doorways meet the named spaces and connect to the original aligned stair', () => {
  const originalStair = before.building.levels.find(item => item.index === 2)
    .spaces.find(item => item.kind === 'stairs');
  const graph = new Map(plans.flatMap(plan => levelFor(plan.levelIndex).spaces.map(item => [item.id, new Set()])));
  const mainStairs = [];
  for (const plan of plans) {
    const level = levelFor(plan.levelIndex), lower = plan.levelIndex !== 2;
    assert.equal(level.spaces.length, lower ? 28 : 23);
    assert.equal(level.doors.length, [26, 27, 22][plan.levelIndex]);
    for (const door of level.doors) {
      const [a, b] = door.segment, middle = a.map((value, axis) => (value + b[axis]) / 2);
      close(distance(a, b), 0.9, 'Door width');
      const neighbors = level.spaces.filter(item =>
        [a, b, middle].every(point => boundaryDistance(point, item.polygon) < 1e-6));
      assert.deepEqual(neighbors.map(item => item.id).sort(), [door.spaceId, door.toSpaceId].sort(), door.id);
      graph.get(door.spaceId).add(door.toSpaceId);
      graph.get(door.toSpaceId).add(door.spaceId);
    }
    const stair = level.spaces.find(item => item.kind === 'stairs');
    mainStairs.push(stair.id);
    for (const item of [...plan.rooms, ...plan.sharedApartments, ...plan.commonAreas]) {
      assert.equal(level.doors.filter(door => door.spaceId === item.id || door.toSpaceId === item.id).length,
        item.use === 'bar' ? 0 : 1, `${item.label} hall entrances`);
    }
    for (const space of level.spaces.filter(item => item.stairConnection)) {
      graph.get(space.id).add(space.stairConnection.spaceId);
      graph.get(space.stairConnection.spaceId).add(space.id);
    }
    for (const field of ['polygon', 'stairFlight']) stair[field].forEach((point, i) =>
      point.forEach((value, axis) => close(value, originalStair[field][i][axis], 'Original campus stair position')));
  }
  const seen = new Set(mainStairs), queue = [...mainStairs];
  while (queue.length) for (const next of graph.get(queue.shift())) {
    if (!seen.has(next)) { seen.add(next); queue.push(next); }
  }
  assert.equal(seen.size, graph.size, 'Every space reaches one of the aligned main stair landings');
});

test('the clarified secondary stair links the middle enclosure to Bar with aligned contained flight symbols', () => {
  const upper = levelFor(1).spaces.find(item => item.id === 'module-53-1-common-R');
  const bar = levelFor(0).spaces.find(item => item.id === 'module-53-0-common-R');
  assert.equal(upper.kind, 'stairs');
  assert.equal(bar.kind, 'service');
  assert.deepEqual(upper.stairFlight, bar.stairFlight, 'Shared vertical footprint');
  assert.deepEqual(upper.stairConnection.segment, [...bar.stairConnection.segment].reverse());
  for (const [space, destination, index, direction] of [[upper, bar, 0, 'down'], [bar, upper, 1, 'up']]) {
    assert.equal(space.stairConnection.spaceId, destination.id);
    assert.equal(space.stairConnection.levelIndex, index);
    assert.equal(space.stairConnection.direction, direction);
    close(area(difference([space.stairFlight], [space.polygon])), 0, 'Flight symbol inside its enclosure');
    assert.match(space.note, /resident/i);
    assert.match(space.note, /run, rise.*landings.*unmeasured|not surveyed run, rise or landings/);
  }
  assert.match(published.sourceClarifications[0].text, /stairs down.*1. OG.*EG Bar/);
  assert.equal(levelFor(0).doors.filter(door => door.spaceId === bar.id || door.toSpaceId === bar.id).length, 0);
});

test('each floor follows its lime doorway corners, including the different EG R2 mark', () => {
  const ends = {
    'E/H': 'top', 'E/G': 'bottom', 'E/F': 'top', 'E/E': 'bottom',
    'N/N3': 'left', 'N/N2': 'right', 'N/N1': 'left', 'N/N0': 'right',
    'R/R3': 'left', 'R/R2': 'right', 'R/R1': 'right',
    'L/L3': 'right', 'L/L2': 'left', 'L/L1': 'right',
    'A/E': 'right', 'A/D': 'left', 'A/C': 'right', 'A/B': 'left', 'A/A': 'right',
    'W/W4': 'top', 'W/W3': 'bottom', 'W/W2': 'top', 'W/W1': 'bottom',
  };
  for (const plan of plans) for (const room of plan.rooms) {
    const end = plan.levelIndex === 0 && key(room) === 'R/R2' ? 'left' : ends[key(room)];
    const axis = ['left', 'right'].includes(end) ? 0 : 1;
    const limit = (['left', 'top'].includes(end) ? Math.min : Math.max)(...room.polygon.map(p => p[axis]));
    const center = (room.doorSegment[0][axis] + room.doorSegment[1][axis]) / 2;
    close(Math.abs(center - limit), 0.6, `${plan.levelIndex}/${key(room)} ${end}`);
    close(Math.min(...room.doorSegment.map(point => Math.abs(point[axis] - limit))), 0.15, 'Schematic jamb');
    assert.equal(room.doorPlacement.evidence, 'resident-lime-mark');
  }
});

test('selection IDs distinguish both E rooms and windows touch only their own exterior', () => {
  for (const plan of plans) {
    const level = levelFor(plan.levelIndex);
    const items = [...level.spaces, ...level.doors, ...level.layoutWindows, ...level.wallBands];
    assert.equal(new Set(items.map(item => item.id)).size, items.length);
    assert.ok(items.every(item => item.id.startsWith(`module-53-${plan.levelIndex}-`)));
    const eRooms = level.spaces.filter(item => item.shortLabel === 'E');
    assert.equal(eRooms.length, 2);
    assert.notEqual(eRooms[0].label, eRooms[1].label);
    for (const window of level.layoutWindows) {
      const owner = level.spaces.find(item => item.id === window.spaceId);
      const [a, b] = window.segment, middle = a.map((value, axis) => (value + b[axis]) / 2);
      close(distance(a, b), 1.05, 'Schematic window width');
      for (const point of [a, b, middle]) {
        close(boundaryDistance(point, level.floorOutline[0].outer), 0, 'Exterior window');
        close(boundaryDistance(point, owner.polygon), 0, 'Window belongs to room');
      }
    }
  }
});

test('generic regeneration keeps accepted Orange floors and only fits Yellow EG', () => {
  const rebuilt = createOldHouseModuleLayouts({studies, lod2, topPlan, firstFloorPlan, groundFloorPlan});
  assert.deepEqual(rebuilt.studies, studies);
  assert.deepEqual(rebuilt.metadata, catalog);
  assert.deepEqual(Object.keys(catalog.houses), ['51']);
  assert.deepEqual(catalog.houses['51'].levels.map(level => level.levelIndex), [0]);
});

test('all three original annotations and protected assets match the saved evidence receipt', async () => {
  const receipt = await read('docs/evidence/house53-layout-preservation.json');
  assert.equal(receipt.baseCommit, before.baseCommit);
  assert.deepEqual(receipt.studyChangeScope.changedBuildingRecords, ['53']);
  assert.deepEqual(receipt.studyChangeScope.changedLevels, [0, 1, 2]);
  for (const plan of plans) {
    const annotation = plan.sourceAnnotation;
    assert.equal(sha(await readFile(new URL(`../${annotation.path}`, import.meta.url))), annotation.sha256);
  }
  for (const [path, record] of Object.entries(receipt.immutableFiles)) {
    assert.equal(record.unchanged, true, path);
    assert.equal(sha(await readFile(new URL(`../${path}`, import.meta.url))), record.sha256, path);
  }
  assert.ok(Object.keys(receipt.immutableFiles).length > 80, 'Broad exterior/source preservation receipt');
});
