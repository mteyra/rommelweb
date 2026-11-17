import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, copyFile, mkdir, mkdtemp, symlink, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {frozenFile} from './frozen-files.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {difference, intersection, union} from 'polyclip-ts';
import {createHouse51TopFloorLayout} from '../scripts/house51-top-floor-layout.mjs';
import {validateInteriorStudies} from '../src/interior-studies.js';
import {withoutNewerStudies} from './fixtures/newer-study-history.mjs';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const [studies, lod2, campus, topPlan, published, before] = await Promise.all([
  read('public/data/interior-studies.json'), read('public/data/lod2.json'), read('public/data/campus.json'),
  read('public/data/house55-module-layout.json'),
  read('public/data/house51-top-floor-layout.json'), read('tests/fixtures/house51-before-top-floor-layout.json'),
]);
const input = {studies, lod2, topPlan}, snapshot = structuredClone(input);
const generated = createHouse51TopFloorLayout(input), plan = generated.plan;
const level = generated.studies.buildings['51'].levels.find(item => item.index === 2);
const epsilon = 1e-6;
const close = (actual, expected, message = '') =>
  assert.ok(Math.abs(actual - expected) < epsilon, `${message}: ${actual} differs from ${expected}`);
const edges = ring => ring.slice(1).map((b, index) => [ring[index], b]);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const ringArea = ring => Math.abs(edges(ring).reduce((sum, [a, b]) =>
  sum + a[0] * b[1] - b[0] * a[1], 0)) / 2;
const area = polygons => polygons.reduce((sum, polygon) =>
  sum + ringArea(polygon[0]) - polygon.slice(1).reduce((s, ring) => s + ringArea(ring), 0), 0);
const polygon = item => [item.polygon, ...(item.holes || [])];
const sameArea = (first, second, message) => {
  close(area(difference(first, second)), 0, `${message}: no excess`);
  close(area(difference(second, first)), 0, `${message}: no gap`);
};
const rectangle = (x, y, width, depth) => [
  [x, y], [x + width, y], [x + width, y + depth], [x, y + depth], [x, y],
];
const frames = frame => ({
  campus: ([u, v]) => frame.originCampusXZ.map((origin, axis) =>
    origin + u * frame.axisU[axis] + v * frame.axisV[axis]),
  local: point => [frame.axisU, frame.axisV].map(axis =>
    (point[0] - frame.originCampusXZ[0]) * axis[0] + (point[1] - frame.originCampusXZ[1]) * axis[1]),
});
const boundaryDistance = (point, item) => Math.min(...polygon(item).flatMap(ring =>
  edges(ring).map(([a, b]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], squared = dx * dx + dy * dy;
    const t = squared ? Math.max(0, Math.min(1,
      ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / squared)) : 0;
    return distance(point, [a[0] + t * dx, a[1] + t * dy]);
  })));
const without = (object, keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));
const roomKey = room => `${room.bank}/${room.label}`;
const visit = (graph, start) => {
  const seen = new Set([start]), queue = [start];
  while (queue.length) for (const neighbor of graph.get(queue.shift())) {
    if (!seen.has(neighbor)) { seen.add(neighbor); queue.push(neighbor); }
  }
  return seen;
};
const sha = value => createHash('sha256').update(value).digest('hex');

test('the annotation produces 21 singles with the added A-wing E and N0, and keeps the three-room W wing', () => {
  assert.equal(plan.house, '51');
  assert.equal(plan.levelIndex, 2);
  assert.equal(plan.status, 'resident-module-layout');
  assert.equal(level.layoutBasis, 'resident-module-layout');
  assert.deepEqual(plan.rooms.map(roomKey), [
    'E/G', 'E/F', 'E/E', 'N/N3', 'N/N2', 'N/N1', 'N/N0', 'R/R3', 'R/R2', 'R/R1',
    'L/L3', 'L/L2', 'L/L1', 'A/E', 'A/D', 'A/C', 'A/B', 'A/A', 'W/W4', 'W/W3', 'W/W2',
  ]);
  assert.equal(plan.rooms.length, 21);
  assert.equal(level.spaces.filter(space => space.kind === 'room').length, 21);
  assert.equal(level.spaces.filter(space => space.kind === 'shared').length, 0);
  assert.equal(plan.rooms.some(room => room.label === 'W1'), false);
  sameArea([plan.rooms.find(room => roomKey(room) === 'A/E').modulePolygon],
    [rectangle(25.6, -7.4, 3.1, 6)], 'Added E sits directly left of D');
  sameArea([plan.rooms.find(room => roomKey(room) === 'N/N0').modulePolygon],
    [rectangle(7.4, 8.8, 3.1, 6)], 'Added N0 sits directly right of N1');
  assert.deepEqual(plan.dimensions, topPlan.dimensions);
  for (const room of plan.rooms) {
    const sides = edges(room.polygon).map(([a, b]) => distance(a, b)).sort((a, b) => a - b);
    sides.forEach((side, index) => close(side, [2.7, 2.7, 6, 6][index], `${roomKey(room)} clear side`));
    close(ringArea(room.polygon), 16.2);
    close(ringArea(room.modulePolygon), 18.6);
    assert.equal(room.sideWalls.length, 2);
    room.sideWalls.forEach(wall => close(ringArea(wall), 1.2));
    sameArea(union([room.polygon], ...room.sideWalls.map(wall => [wall])), [room.modulePolygon],
      `${roomKey(room)} clear interior and two side allocations`);
    const original = topPlan.rooms.find(item => roomKey(item) === roomKey(room));
    if (original) {
      for (const key of ['polygon', 'modulePolygon', 'sideWalls', 'windowSegment', 'rotation']) {
        assert.deepEqual(room[key], original[key], `${roomKey(room)}/${key} retains the Red module`);
      }
    }
  }
});

test('the trimmed top floor has complete nonoverlapping coverage and no blue-area remnants', () => {
  assert.equal(level.floorOutline.length, 1);
  assert.deepEqual(level.floorOutline[0].holes || [], []);
  assert.deepEqual(plan.shell.holes || [], []);
  assert.deepEqual(plan.unassignedPolygons, []);
  close(ringArea(plan.shell.outline), 501.72);
  const floor = [plan.shell.outline];
  sameArea(union(...plan.rooms.map(room => [room.modulePolygon]),
    ...plan.corridors.map(hall => [hall.polygon]), [plan.stair.polygon]), floor,
  'The shell is exactly the complete requested modules and circulation');
  const local = frames(plan.coordinateFrame).local;
  const snapped = point => local(point).map(value => Math.round(value * 1e7) / 1e7);
  const pieces = [...level.spaces, ...level.wallBands].map(item => polygon(item).map(ring => ring.map(snapped)));
  for (const piece of pieces) close(area(difference(piece, floor)), 0, 'Every assigned piece is inside the shell');
  const occupied = union(...pieces);
  close(area(occupied), pieces.reduce((sum, piece) => sum + area([piece]), 0), 'No positive-area overlap');
  sameArea(occupied, floor, 'No leftover unassigned gaps');
  // The two blue extensions sit between the new terminal modules and the
  // stair; these rectangles must be completely outside the new floor.
  close(area(intersection(floor, [rectangle(19.4, -7.4, 6.2, 7.4)])), 0, 'Upper blue gap removed');
  close(area(intersection(floor, [rectangle(10.5, 7.4, 6.2, 7.4)])), 0, 'Lower blue gap removed');
  for (const hall of plan.corridors) {
    close(Math.min(...edges(hall.polygon).map(([a, b]) => distance(a, b))), 1.4, `${hall.bank} hallway width`);
  }
  assert.deepEqual(plan.totals, {
    roomCount: 21, roomArea: 340.2, sideWallArea: 50.4, bankHallArea: 91.14,
    stairArea: 19.98, shellArea: 501.72, unassignedArea: 0,
  });
});

test('all 21 entrance ends follow the lime marks and use the stated schematic jamb spacing', () => {
  // Independent transcription of the annotation. L3 and L2 are both at
  // their left ends; all other apparent pairs retain their specific marks.
  const expected = {
    'E/G': ['right', 'bottom'], 'E/F': ['right', 'top'], 'E/E': ['right', 'bottom'],
    'N/N3': ['top', 'right'], 'N/N2': ['top', 'left'], 'N/N1': ['top', 'right'], 'N/N0': ['top', 'left'],
    'R/R3': ['bottom', 'left'], 'R/R2': ['bottom', 'right'], 'R/R1': ['bottom', 'left'],
    'L/L3': ['top', 'left'], 'L/L2': ['top', 'left'], 'L/L1': ['top', 'right'],
    'A/E': ['bottom', 'left'], 'A/D': ['bottom', 'right'], 'A/C': ['bottom', 'left'],
    'A/B': ['bottom', 'right'], 'A/A': ['bottom', 'left'],
    'W/W4': ['left', 'top'], 'W/W3': ['left', 'bottom'], 'W/W2': ['left', 'top'],
  };
  for (const room of plan.rooms) {
    const key = roomKey(room), [wall, end] = expected[key];
    const xs = room.polygon.map(point => point[0]), ys = room.polygon.map(point => point[1]);
    const limits = {left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys)};
    const fixedAxis = ['left', 'right'].includes(wall) ? 0 : 1, alongAxis = 1 - fixedAxis;
    const [a, b] = room.doorSegment, midpoint = a.map((value, axis) => (value + b[axis]) / 2);
    [a, b].forEach(point => close(point[fixedAxis], limits[wall], `${key} hallway-facing wall`));
    close(distance(a, b), 0.9, `${key} doorway width`);
    close(Math.abs(midpoint[alongAxis] - limits[end]), 0.6, `${key} specified end`);
    close(Math.min(...[a, b].map(point => Math.abs(point[alongAxis] - limits[end]))), 0.15, `${key} jamb`);
    assert.equal(room.doorPlacement.wall, wall);
    assert.equal(room.doorPlacement.end, end);
    assert.match(room.doorPlacement.basis, /schematic/);
  }
});

test('every Yellow apartment has one actual boundary door and a connected route to the stairs', () => {
  const graph = new Map(level.spaces.map(space => [space.id, new Set()]));
  assert.equal(level.doors.length, 23);
  for (const door of level.doors) {
    const [a, b] = door.segment, midpoint = a.map((value, axis) => (value + b[axis]) / 2);
    const neighbors = level.spaces.filter(space =>
      [a, b, midpoint].every(point => boundaryDistance(point, space) < epsilon));
    assert.deepEqual(neighbors.map(space => space.id).sort(), [door.spaceId, door.toSpaceId].sort(),
      `${door.id} lies on its two actual neighboring boundaries`);
    close(distance(a, b), 0.9, `${door.id} width`);
    graph.get(door.spaceId).add(door.toSpaceId);
    graph.get(door.toSpaceId).add(door.spaceId);
  }
  const stair = level.spaces.find(space => space.kind === 'stairs');
  assert.equal(visit(graph, stair.id).size, level.spaces.length);
  for (const room of plan.rooms) {
    const doors = level.doors.filter(door => door.spaceId === room.id || door.toSpaceId === room.id);
    assert.equal(doors.length, 1, `${roomKey(room)} single entrance`);
    const actual = doors[0].segment.map(frames(plan.coordinateFrame).local);
    actual.forEach((point, index) => point.forEach((value, axis) =>
      close(value, room.doorSegment[index][axis], `${roomKey(room)} published door`)));
  }
});

test('Yellow retains its source rigid orientation and exact lower-floor stair position', () => {
  const frame = plan.coordinateFrame, previous = before.layout.coordinateFrame;
  assert.deepEqual(frame.axisU, previous.axisU);
  assert.deepEqual(frame.axisV, previous.axisV);
  close(Math.hypot(...frame.axisU), 1);
  close(Math.hypot(...frame.axisV), 1);
  close(frame.axisU[0] * frame.axisV[0] + frame.axisU[1] * frame.axisV[1], 0);
  close(frame.axisU[0] * frame.axisV[1] - frame.axisU[1] * frame.axisV[0], 1);
  assert.deepEqual(plan.retainedCoreTranslation, [0, -0.4]);
  frame.originCampusXZ.forEach((value, axis) => close(value,
    previous.originCampusXZ[axis] - 0.4 * previous.axisV[axis], 'Retained source core offset'));
  assert.deepEqual(createHouse51TopFloorLayout({...input, oldHouseLayouts: undefined}), generated,
    'Source LoD2 registration reproduces the retained rigid frame');
  assert.deepEqual(plan.stair, topPlan.stair);
  const stair = level.spaces.find(space => space.kind === 'stairs');
  for (const lower of studies.buildings['51'].levels.filter(item => item.index !== 2)) {
    const source = lower.spaces.find(space => space.kind === 'stairs');
    for (const field of ['polygon', 'stairFlight']) {
      stair[field].forEach((point, index) => point.forEach((value, axis) =>
        close(value, source[field][index][axis], `Yellow/${lower.index} stair ${field}`)));
    }
  }
  const toCampus = frames(frame).campus;
  plan.shell.outline.map(toCampus).forEach((point, index) =>
    point.forEach((value, axis) => close(value, level.floorOutline[0].outer[index][axis], 'Published rigid shell')));
  for (const room of plan.rooms) {
    const actual = level.spaces.find(space => space.id === room.id);
    room.polygon.map(toCampus).forEach((point, index) =>
      point.forEach((value, axis) => close(value, actual.polygon[index][axis], `${roomKey(room)} rigid placement`)));
  }
});

test('duplicate E labels have distinct space, door and window identities and every schematic window is on the exterior', () => {
  const ids = [], spaceIds = new Set(level.spaces.map(space => space.id));
  for (const item of [...level.spaces, ...level.doors, ...level.wallBands, ...level.layoutWindows]) {
    assert.ok(item.id.startsWith('module-51-2-'), item.id);
    ids.push(item.id);
    for (const key of ['spaceId', 'toSpaceId']) if (item[key]) assert.ok(spaceIds.has(item[key]), `${item.id}/${key}`);
  }
  assert.equal(new Set(ids).size, ids.length);
  const eRooms = level.spaces.filter(space => space.shortLabel === 'E');
  assert.equal(eRooms.length, 2);
  assert.notEqual(eRooms[0].id, eRooms[1].id);
  assert.notEqual(eRooms[0].label, eRooms[1].label);
  for (const room of eRooms) {
    assert.equal(level.doors.filter(door => door.spaceId === room.id).length, 1);
    assert.equal(level.layoutWindows.filter(window => window.spaceId === room.id).length, 1);
  }
  assert.equal(level.layoutWindows.length, 25);
  for (const window of level.layoutWindows) {
    const [a, b] = window.segment, midpoint = a.map((value, axis) => (value + b[axis]) / 2);
    close(distance(a, b), 1.05, `${window.id} schematic width`);
    [a, b, midpoint].forEach(point => close(boundaryDistance(point, {polygon: level.floorOutline[0].outer}), 0,
      `${window.id} touches the independent exterior`));
  }
  const injected = structuredClone(studies), prior = injected.buildings['51'].levels.find(item => item.index === 2);
  prior.windows = [{id: 'yellow-source-observation', segment: [[1, 2], [2, 2]], confidence: 'estimated',
    sourceSurfaceIndex: 42, note: 'Source facade observation must never be replaced by a layout symbol.'}];
  prior.windowCoverage = 'complete-floor';
  const regenerated = createHouse51TopFloorLayout({...input, studies: injected}).studies.buildings['51'].levels
    .find(item => item.index === 2);
  assert.deepEqual(regenerated.windows, prior.windows);
  assert.equal(regenerated.windowCoverage, prior.windowCoverage);
  assert.notEqual(regenerated.windows, prior.windows);
});
