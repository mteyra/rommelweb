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
import {createHouse51FirstFloorLayout} from '../scripts/house51-first-floor-layout.mjs';
import {validateInteriorStudies} from '../src/interior-studies.js';
import {withoutNewerStudies} from './fixtures/newer-study-history.mjs';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const [studies, topPlan, published, before, campus, lod2,
  archivedOrange, beforeGround] = await Promise.all([
  read('public/data/interior-studies.json'), read('public/data/house51-top-floor-layout.json'),
  read('public/data/house51-first-floor-layout.json'), read('tests/fixtures/house51-before-first-floor-layout.json'),
  read('public/data/campus.json'), read('public/data/lod2.json'),
  read('tests/fixtures/house53-before-resident-layout.json'),
  read('tests/fixtures/house51-before-ground-floor-layout.json'),
]);
const input = {studies, topPlan}, snapshot = structuredClone(input);
const result = createHouse51FirstFloorLayout(input), plan = result.plan;
const firstFloorInput = structuredClone(input);
firstFloorInput.studies.buildings['51'] = structuredClone(before.building);
const firstFloorRelease = createHouse51FirstFloorLayout(firstFloorInput);
const level = result.studies.buildings['51'].levels.find(item => item.index === 1);
const close = (actual, expected, label = '') =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} vs ${expected}`);
const edges = ring => ring.slice(1).map((b, index) => [ring[index], b]);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const ringArea = ring => Math.abs(edges(ring).reduce((sum, [a, b]) =>
  sum + a[0] * b[1] - b[0] * a[1], 0)) / 2;
const area = polygons => polygons.reduce((sum, polygon) =>
  sum + ringArea(polygon[0]) - polygon.slice(1).reduce((s, ring) => s + ringArea(ring), 0), 0);
const rect = (x, y, width, height) =>
  [[x, y], [x + width, y], [x + width, y + height], [x, y + height], [x, y]];
const sameArea = (a, b, label) => {
  close(area(difference(a, b)), 0, `${label}: excess`);
  close(area(difference(b, a)), 0, `${label}: gap`);
};
const key = room => `${room.bank}/${room.label}`;
const room = label => plan.rooms.find(item => key(item) === label);
const polygon = item => [item.polygon, ...(item.holes || [])];
const local = point => {
  const frame = plan.coordinateFrame;
  return [frame.axisU, frame.axisV].map(axis => Math.round(1e7 *
    ((point[0] - frame.originCampusXZ[0]) * axis[0] +
     (point[1] - frame.originCampusXZ[1]) * axis[1])) / 1e7);
};
const boundaryDistance = (point, item) => Math.min(...polygon(item).flatMap(ring =>
  edges(ring).map(([a, b]) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], squared = dx * dx + dy * dy;
    const t = squared ? Math.max(0, Math.min(1,
      ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / squared)) : 0;
    return distance(point, [a[0] + t * dx, a[1] + t * dy]);
  })));
const sha = value => createHash('sha256').update(value).digest('hex');

test('Yellow 1. OG is reproducible and changes only the requested middle floor', () => {
  assert.deepEqual(input, snapshot);
  assert.deepEqual(createHouse51FirstFloorLayout(input), result);
  assert.deepEqual(createHouse51FirstFloorLayout({...input, studies: result.studies}), result);
  assert.deepEqual(plan, published);
  assert.deepEqual(result.studies, studies);
  assert.deepEqual(firstFloorRelease.plan, plan);
  assert.deepEqual(firstFloorRelease.studies.buildings['51'], beforeGround.building,
    'The archived middle-floor release remains exactly reproducible, including its source summary');
  for (const index of [0, 2]) {
    assert.deepEqual(firstFloorRelease.studies.buildings['51'].levels.find(item => item.index === index),
      before.building.levels.find(item => item.index === index), `Yellow/${index} exact historical previous record`);
    assert.deepEqual(result.studies.buildings['51'].levels.find(item => item.index === index),
      studies.buildings['51'].levels.find(item => item.index === index), `Yellow/${index} current record preserved`);
  }
  for (const [house, building] of Object.entries(studies.buildings)) {
    if (house !== '51') assert.deepEqual(result.studies.buildings[house], building);
  }
  const previous = before.building.levels.find(item => item.index === 1);
  for (const field of ['windows', 'windowCoverage']) assert.deepEqual(level[field], previous[field]);
  assert.equal(validateInteriorStudies(result.studies, campus, lod2), true);
});

test('the new drawing yields 23 fixed-size singles, shared A and the three split pairs', () => {
  assert.equal(plan.house, '51');
  assert.equal(plan.levelIndex, 1);
  assert.equal(level.layoutBasis, 'resident-module-layout');
  assert.deepEqual(plan.rooms.map(key).sort(), [
    'E/H', 'E/G', 'E/F', 'E/E', 'N/N4', 'N/N3', 'N/N2', 'N/N1', 'N/N0',
    'R/R3', 'R/R2', 'R/R1', 'L/L3', 'L/L2', 'L/L1',
    'A/F', 'A/E', 'A/D', 'A/C', 'W/W4', 'W/W3', 'W/W2', 'W/W1',
  ].sort());
  assert.equal(plan.sharedApartments.length, 1);
  assert.equal(plan.sharedApartments[0].label, 'A');
  assert.equal(level.spaces.filter(item => item.kind === 'room').length, 23);
  assert.equal(level.spaces.filter(item => item.kind === 'shared').length, 1);
  for (const item of plan.rooms) {
    edges(item.polygon).map(([a, b]) => distance(a, b)).sort((a, b) => a - b)
      .forEach((length, index) => close(length, [2.7, 2.7, 6, 6][index], `${key(item)} clear side`));
    close(ringArea(item.polygon), 16.2, `${key(item)} clear area`);
    close(ringArea(item.modulePolygon), 18.6, `${key(item)} module area`);
    assert.equal(item.sideWalls.length, 2);
    item.sideWalls.forEach(wall => close(ringArea(wall), 1.2, `${key(item)} side allocation`));
    sameArea(union([item.polygon], ...item.sideWalls.map(wall => [wall])), [item.modulePolygon],
      `${key(item)} clear room plus walls covers its module`);
  }
  close(ringArea(plan.sharedApartments[0].polygon), 45.88, 'Shared A gross envelope');
  sameArea([room('E/H').modulePolygon], [rect(0, -5, 6, 3.1)], 'H restores upper paired module');
  sameArea([room('N/N4').modulePolygon], [rect(-5, 8.8, 3.1, 6)], 'N4 restores left paired module');
  sameArea([room('N/N0').modulePolygon], [rect(7.4, 8.8, 3.1, 6)], 'N0 extends beside N1');
  sameArea([room('W/W1').modulePolygon], [rect(30.1, 9.3, 6, 3.1)], 'W1 is retained above canceled annotation');
  assert.equal(Math.max(...plan.rooms.filter(item => item.bank === 'W').flatMap(item =>
    item.modulePolygon.map(point => point[1]))), 12.4, 'No room from the blue-covered canceled extension');
});

test('the whole enlarged A wing shifts one module to align its left edge with L1', () => {
  const left = item => Math.min(...item.modulePolygon.map(point => point[0]));
  close(left(room('A/F')), left(room('L/L1')), 'Module left edges align');
  close(Math.min(...room('A/F').polygon.map(point => point[0])),
    Math.min(...room('L/L1').polygon.map(point => point[0])), 'Clear room edges align too');
  for (const [label, x] of [['F', 25.6], ['E', 28.7], ['D', 31.8], ['C', 34.9]]) {
    sameArea([room(`A/${label}`).modulePolygon], [rect(x, -7.4, 3.1, 6)], `Shifted ${label}`);
  }
  sameArea([plan.sharedApartments[0].polygon], [rect(38, -7.4, 6.2, 7.4)],
    'Shared A travels with the shifted bank');
  const priorD = before.layout.levels.find(item => item.levelIndex === 1).rooms
    .find(item => item.bank === 'A' && item.label === 'D');
  close(left(room('A/D')) - left(priorD), 3.1, 'Existing D moves exactly one pitch');
  for (const item of plan.rooms.filter(item => ['L', 'R'].includes(item.bank))) {
    const prior = topPlan.rooms.find(other => key(other) === key(item));
    for (const field of ['polygon', 'modulePolygon', 'sideWalls']) {
      assert.deepEqual(item[field], prior[field], `${key(item)} ${field} stays fixed`);
    }
  }
});

test('both balconies fill the remaining two-module gaps and keep their own hall entrances', () => {
  assert.equal(plan.commonAreas.length, 2);
  const east = plan.commonAreas.find(item => item.bank === 'R');
  const west = plan.commonAreas.find(item => item.bank === 'L');
  sameArea([east.polygon], [rect(10.5, 7.4, 6.2, 2.9)], 'East balcony between N0 and stair');
  sameArea([west.polygon], [rect(19.4, -2.9, 6.2, 2.9)], 'West balcony ends at aligned A wing');
  for (const item of plan.commonAreas) {
    close(ringArea(item.polygon), 17.98, `${item.label} assumed area`);
    const space = level.spaces.find(space => space.id === item.id);
    assert.ok(space, `${item.label} remains independently selectable`);
    assert.notEqual(space.kind, 'room');
    assert.equal(level.doors.filter(door => door.spaceId === item.id || door.toSpaceId === item.id).length, 1);
  }
});

test('the floor has complete disjoint coverage with connected 1.40 m halls and no residual source-shell gaps', () => {
  const shell = [plan.shell.outline];
  assert.deepEqual(plan.shell.holes || [], []);
  assert.deepEqual(plan.unassignedPolygons, []);
  sameArea(union(...plan.rooms.map(item => [item.modulePolygon]),
    ...plan.sharedApartments.map(polygon), ...plan.commonAreas.map(polygon),
    ...plan.corridors.map(polygon), [plan.stair.polygon]), shell, 'Complete module outline');
  const pieces = [...level.spaces, ...level.wallBands].map(item => polygon(item).map(ring => ring.map(local)));
  for (const piece of pieces) close(area(difference(piece, shell)), 0, 'Assigned piece contained');
  const occupied = union(...pieces);
  close(area(occupied), pieces.reduce((sum, piece) => sum + area([piece]), 0), 'No positive-area overlap');
  sameArea(occupied, shell, 'No unassigned gaps');
  close(ringArea(plan.shell.outline), 629.44, 'Expected fixed-module floor area');
  close(area(intersection(shell, [rect(28.7, 12.4, 7.4, 3.1)])), 0, 'Canceled extra W row omitted');
  for (const hall of plan.corridors) {
    close(Math.min(...edges(hall.polygon).map(([a, b]) => distance(a, b))), 1.4, `${hall.bank} hall width`);
  }
});

test('every apartment and balcony has one physical doorway and reaches the retained stair', () => {
  assert.equal(level.spaces.length, 29);
  assert.equal(level.doors.length, 28);
  const graph = new Map(level.spaces.map(item => [item.id, new Set()]));
  for (const door of level.doors) {
    const [a, b] = door.segment, middle = a.map((value, axis) => (value + b[axis]) / 2);
    close(distance(a, b), 0.9, `${door.id} width`);
    const neighbors = level.spaces.filter(item => [a, b, middle].every(point => boundaryDistance(point, item) < 1e-6));
    assert.deepEqual(neighbors.map(item => item.id).sort(), [door.spaceId, door.toSpaceId].sort(),
      `${door.id} on actual shared boundary`);
    graph.get(door.spaceId).add(door.toSpaceId);
    graph.get(door.toSpaceId).add(door.spaceId);
  }
  const stair = level.spaces.find(item => item.kind === 'stairs');
  const visited = new Set([stair.id]), queue = [stair.id];
  while (queue.length) for (const neighbor of graph.get(queue.shift())) {
    if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
  }
  assert.equal(visited.size, level.spaces.length, 'All spaces connect to stairs');
  for (const item of [...plan.rooms, ...plan.sharedApartments, ...plan.commonAreas]) {
    assert.equal(level.doors.filter(door => door.spaceId === item.id || door.toSpaceId === item.id).length, 1,
      `${item.label} single hall entrance`);
  }
  assert.deepEqual(plan.coordinateFrame, topPlan.coordinateFrame);
  assert.deepEqual(plan.stair, topPlan.stair);
  for (const other of studies.buildings['51'].levels.filter(item => item.index !== 1)) {
    const otherStair = other.spaces.find(item => item.kind === 'stairs');
    for (const field of ['polygon', 'stairFlight']) {
      stair[field].forEach((point, i) => point.forEach((value, axis) =>
        close(value, otherStair[field][i][axis], `Floor ${other.index} ${field} alignment`)));
    }
  }
});

test('visible lime marks determine the specified room corners without inventing a measured jamb', () => {
  const marked = {
    'E/H': 'top', 'E/G': 'bottom', 'E/F': 'top', 'E/E': 'bottom',
    'N/N4': 'left', 'N/N3': 'right', 'N/N2': 'left', 'N/N1': 'right', 'N/N0': 'left',
    'R/R3': 'left', 'R/R2': 'right', 'R/R1': 'left',
    'L/L3': 'left', 'L/L2': 'left', 'L/L1': 'right',
    'A/F': 'left', 'A/E': 'right', 'A/D': 'left', 'A/C': 'right',
    'W/W4': 'top', 'W/W3': 'bottom', 'W/W2': 'top',
  };
  for (const [label, end] of Object.entries(marked)) {
    const item = room(label), axis = ['left', 'right'].includes(end) ? 0 : 1;
    const limits = item.polygon.map(point => point[axis]);
    const limit = ['left', 'top'].includes(end) ? Math.min(...limits) : Math.max(...limits);
    const middle = (item.doorSegment[0][axis] + item.doorSegment[1][axis]) / 2;
    close(Math.abs(middle - limit), 0.6, `${label} entrance near ${end}`);
    close(Math.min(...item.doorSegment.map(point => Math.abs(point[axis] - limit))), 0.15, `${label} schematic jamb`);
  }
});

test('selection identities stay unique and schematic windows remain on the exterior', () => {
  const items = [...level.spaces, ...level.doors, ...level.layoutWindows, ...level.wallBands];
  assert.equal(new Set(items.map(item => item.id)).size, items.length);
  const spaceIds = new Set(level.spaces.map(item => item.id));
  for (const item of items) {
    assert.ok(item.id.startsWith('module-51-1-'), item.id);
    for (const field of ['spaceId', 'toSpaceId']) if (item[field]) assert.ok(spaceIds.has(item[field]));
  }
  for (const label of ['E', 'F']) {
    const pair = level.spaces.filter(item => item.shortLabel === label);
    assert.equal(pair.length, 2);
    assert.notEqual(pair[0].label, pair[1].label, `${label} cards distinguish wing`);
  }
  for (const window of level.layoutWindows) {
    const [a, b] = window.segment, middle = a.map((value, axis) => (value + b[axis]) / 2);
    close(distance(a, b), 1.05, `${window.id} schematic width`);
    [a, b, middle].forEach(point => close(boundaryDistance(point, {polygon: level.floorOutline[0].outer}), 0,
      `${window.id} on exterior`));
  }
});

test('the first-floor preservation receipt protects the top floor, EG and the exterior evidence', async () => {
  const receipt = await read('docs/evidence/house51-first-floor-preservation.json');
  assert.equal(receipt.baseCommit, before.baseCommit);
  assert.deepEqual(receipt.studyChangeScope.changedBuildingRecords, ['51']);
  assert.deepEqual(receipt.studyChangeScope.changedLevels, [1]);
  for (const [path, record] of Object.entries(receipt.immutableFiles)) {
    assert.equal(record.unchanged, true, path);
    const source = frozenFile(path);
    if (!source) continue;
    assert.equal(sha(await readFile(new URL(`../${source}`, import.meta.url))), record.sha256, path);
  }
  // This release predates Orange's independent layouts and the Campus II layer.
  // Restore that dated snapshot here; current geometry is checked separately.
  const firstFloorReleaseStudies = withoutNewerStudies(firstFloorRelease.studies);
  firstFloorReleaseStudies.buildings['53'] = structuredClone(archivedOrange.building);
  assert.equal(sha(JSON.stringify(firstFloorReleaseStudies, null, 2) + '\n'),
    receipt.studyChangeScope.afterSha256);
  for (const [house, record] of Object.entries(receipt.unchangedStudyBuildings)) {
    assert.equal(sha(JSON.stringify(firstFloorReleaseStudies.buildings[house])), record.sha256, house);
  }
  assert.equal(sha(JSON.stringify(archivedOrange.layout)), receipt.unchangedHouse53Fit.sha256);
  for (const index of [0, 2]) assert.equal(sha(JSON.stringify(firstFloorRelease.studies.buildings['51'].levels.find(item =>
    item.index === index))), receipt.unchangedYellowLevels[index].sha256);
  assert.deepEqual(plan.sourceAnnotation, receipt.annotation);
  assert.equal(sha(await readFile(new URL(`../${receipt.annotation.path}`, import.meta.url))), receipt.annotation.sha256);
  assert.equal(receipt.foldedExteriorUnchanged, true);
});
