import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, writeFile, copyFile, mkdir, mkdtemp, symlink, rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {difference, intersection, union} from 'polyclip-ts';
import {createHouse51GroundFloorLayout} from '../scripts/house51-ground-floor-layout.mjs';
import {createHouse51FirstFloorLayout} from '../scripts/house51-first-floor-layout.mjs';
import {createHouse51TopFloorLayout} from '../scripts/house51-top-floor-layout.mjs';
import {createOldHouseModuleLayouts} from '../scripts/old-house-module-layout.mjs';
import {validateInteriorStudies} from '../src/interior-studies.js';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const [studies, firstFloorPlan, published, before, catalog, topPlan, campus, lod2, redTop, redFirst, redGround] =
  await Promise.all([
    read('public/data/interior-studies.json'), read('public/data/house51-first-floor-layout.json'),
    read('public/data/house51-ground-floor-layout.json'), read('tests/fixtures/house51-before-ground-floor-layout.json'),
    read('public/data/old-house-module-layouts.json'), read('public/data/house51-top-floor-layout.json'),
    read('public/data/campus.json'), read('public/data/lod2.json'), read('public/data/house55-module-layout.json'),
    read('public/data/house55-first-floor-layout.json'), read('public/data/house55-ground-floor-layout.json'),
  ]);
const input = {studies, firstFloorPlan}, snapshot = structuredClone(input);
const result = createHouse51GroundFloorLayout(input), plan = result.plan;
const level = result.studies.buildings['51'].levels.find(item => item.index === 0);
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
const without = (item, fields) => Object.fromEntries(Object.entries(item).filter(([name]) => !fields.includes(name)));
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
const freeze = value => {
  if (!value || typeof value !== 'object') return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
};

test('Yellow EG reproduces the exact final output from its archived fit without mutating any input', () => {
  assert.deepEqual(input, snapshot);
  assert.deepEqual(createHouse51GroundFloorLayout(input), result);
  assert.deepEqual(createHouse51GroundFloorLayout(freeze(structuredClone(input))), result);
  assert.deepEqual(createHouse51GroundFloorLayout({...input, studies: result.studies}), result);
  assert.deepEqual(plan, published);
  assert.deepEqual(result.studies, studies);
  const original = structuredClone(studies);
  original.buildings['51'] = structuredClone(before.building);
  assert.deepEqual(createHouse51GroundFloorLayout({...input, studies: original}), result);
  for (const index of [1, 2]) {
    const previous = before.building.levels.find(item => item.index === index);
    const current = studies.buildings['51'].levels.find(item => item.index === index);
    assert.equal(JSON.stringify(current), JSON.stringify(previous), `Yellow/${index} exact previous record`);
  }
  for (const [house, building] of Object.entries(studies.buildings)) {
    if (house !== '51') assert.deepEqual(result.studies.buildings[house], building, house);
  }
  assert.deepEqual(without(studies.buildings['51'], ['levels', 'source']),
    without(before.building, ['levels', 'source']));
  const previous = before.building.levels.find(item => item.index === 0);
  const changed = ['label', 'source', 'notes', 'layoutBasis', 'floorOutline', 'spaces', 'doors',
    'wallBands', 'dimensionGuides', 'layoutWindows', 'extrapolatedFrom'];
  assert.deepEqual(without(level, changed), without(previous, changed), 'All original non-layout evidence survives');
  assert.equal(validateInteriorStudies(result.studies, campus, lod2), true);
});

test('the ground sketch has 23 fixed-size singles, one shared A, and a new single B', () => {
  assert.equal(plan.house, '51');
  assert.equal(plan.levelIndex, 0);
  assert.equal(level.layoutBasis, 'resident-module-layout');
  assert.deepEqual(plan.rooms.map(key).sort(), [
    'E/H', 'E/G', 'E/F', 'E/E', 'N/N4', 'N/N3', 'N/N2', 'N/N1', 'N/N0',
    'R/R3', 'R/R2', 'R/R1', 'L/L3', 'L/L2', 'L/L1',
    'A/E', 'A/D', 'A/C', 'A/B', 'W/W4', 'W/W3', 'W/W2', 'W/W1',
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
      `${key(item)} room plus side walls covers its module`);
  }
  for (const pair of [['E/H', 'E/G'], ['N/N4', 'N/N3'], ['W/W1', 'W/W2']]) {
    pair.forEach(label => assert.ok(room(label), `${label} remains its own single room`));
  }
  assert.equal(room('A/F'), undefined, 'Sports replaces the middle floor’s F module');
  for (const [label, x] of [['E', 28.7], ['D', 31.8], ['C', 34.9], ['B', 38]]) {
    sameArea([room(`A/${label}`).modulePolygon], [rect(x, -7.4, 3.1, 6)], `${label} in ground A bank`);
  }
  sameArea([plan.sharedApartments[0].polygon], [rect(41.1, -7.4, 6.2, 7.4)], 'Shared A moves one module');
  close(ringArea(plan.sharedApartments[0].polygon), 45.88, 'Shared A unchanged envelope size');
  for (const item of plan.rooms.filter(item => item.bank !== 'A')) {
    const prior = firstFloorPlan.rooms.find(other => key(other) === key(item));
    for (const field of ['polygon', 'modulePolygon', 'sideWalls', 'doorSegment']) {
      assert.deepEqual(item[field], prior[field], `${key(item)} ${field} copied from completed middle floor`);
    }
  }
});

test('Sports and Laundry are separate enlarged common rooms with one entrance each', () => {
  assert.equal(plan.commonAreas.length, 2);
  const sports = plan.commonAreas.find(item => item.bank === 'L');
  const laundry = plan.commonAreas.find(item => item.bank === 'R');
  assert.match(sports.label, /sport/i);
  assert.match(laundry.label, /laundry/i);
  sameArea([sports.polygon], [rect(19.4, -7.4, 9.3, 7.4)], 'Sports closes west gap and takes old F');
  sameArea([laundry.polygon], [rect(10.5, 7.4, 6.2, 7.4)], 'Laundry behind N0 reaches the stair');
  close(ringArea(sports.polygon), 68.82, 'Sports model area');
  close(ringArea(laundry.polygon), 45.88, 'Laundry model area');
  assert.ok(!level.spaces.some(item => /balcony/i.test(item.label)), 'Ground floor has no balcony labels');
  for (const item of plan.commonAreas) {
    const space = level.spaces.find(space => space.id === item.id);
    assert.ok(space, `${item.label} remains selectable`);
    assert.notEqual(space.kind, 'room');
    assert.equal(level.doors.filter(door => door.spaceId === item.id || door.toSpaceId === item.id).length, 1);
  }
});

test('all floor space is disjoint, inside the new shell, and connected by 1.40 m hall strips', () => {
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
  sameArea(occupied, shell, 'No residual unassigned gap');
  close(ringArea(plan.shell.outline), 708.18, 'Ground floor model area');
  for (const hall of plan.corridors) {
    close(Math.min(...edges(hall.polygon).map(([a, b]) => distance(a, b))), 1.4, `${hall.bank} hall width`);
  }
  sameArea([plan.corridors.find(item => item.bank === 'A').polygon], [rect(28.7, -1.4, 12.4, 1.4)],
    'A hall serves four singles and shared A after Sports enclosure');
  close(area(intersection(shell, [rect(28.7, 12.4, 7.4, 3.1)])), 0,
    'No extra W room beyond the inherited four singles');
});

test('every doorway lies on its actual two-space boundary and every room reaches the retained stairs', () => {
  assert.equal(level.spaces.length, 29);
  assert.equal(level.doors.length, 28);
  const graph = new Map(level.spaces.map(item => [item.id, new Set()]));
  for (const door of level.doors) {
    const [a, b] = door.segment, middle = a.map((value, axis) => (value + b[axis]) / 2);
    close(distance(a, b), 0.9, `${door.id} schematic width`);
    const neighbors = level.spaces.filter(item => [a, b, middle].every(point => boundaryDistance(point, item) < 1e-6));
    assert.deepEqual(neighbors.map(item => item.id).sort(), [door.spaceId, door.toSpaceId].sort(),
      `${door.id} has exactly its declared physical neighbors`);
    graph.get(door.spaceId).add(door.toSpaceId);
    graph.get(door.toSpaceId).add(door.spaceId);
  }
  const stair = level.spaces.find(item => item.kind === 'stairs');
  const visited = new Set([stair.id]), queue = [stair.id];
  while (queue.length) for (const neighbor of graph.get(queue.shift())) {
    if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
  }
  assert.equal(visited.size, level.spaces.length, 'All spaces connect to the stairs');
  for (const item of [...plan.rooms, ...plan.sharedApartments, ...plan.commonAreas]) {
    assert.equal(level.doors.filter(door => door.spaceId === item.id || door.toSpaceId === item.id).length, 1,
      `${item.label} has a single hallway entry`);
  }
  assert.deepEqual(plan.coordinateFrame, firstFloorPlan.coordinateFrame);
  assert.deepEqual(plan.coordinateFrame, topPlan.coordinateFrame);
  assert.deepEqual(plan.stair, firstFloorPlan.stair);
  for (const other of studies.buildings['51'].levels.filter(item => item.index !== 0)) {
    const otherStair = other.spaces.find(item => item.kind === 'stairs');
    for (const field of ['polygon', 'stairFlight']) {
      assert.deepEqual(stair[field], otherStair[field], `Floor ${other.index}: exact campus stair ${field}`);
    }
  }
});

test('marked ground doors and inherited alternating entrances use the correct wall and end', () => {
  const marked = {
    'E/H': ['right', 'top'], 'E/G': ['right', 'bottom'], 'E/F': ['right', 'top'], 'E/E': ['right', 'bottom'],
    'N/N4': ['top', 'left'], 'N/N3': ['top', 'right'], 'N/N2': ['top', 'left'],
    'N/N1': ['top', 'right'], 'N/N0': ['top', 'left'],
    'R/R3': ['bottom', 'left'], 'R/R2': ['bottom', 'right'], 'R/R1': ['bottom', 'left'],
    'L/L3': ['top', 'left'], 'L/L2': ['top', 'left'], 'L/L1': ['top', 'right'],
    'A/E': ['bottom', 'left'], 'A/D': ['bottom', 'right'], 'A/C': ['bottom', 'left'], 'A/B': ['bottom', 'right'],
    'W/W4': ['left', 'top'], 'W/W3': ['left', 'bottom'], 'W/W2': ['left', 'top'], 'W/W1': ['left', 'bottom'],
  };
  const nearEnd = (item, side, end) => {
    const axis = ['left', 'right'].includes(end) ? 0 : 1, fixed = 1 - axis;
    const along = item.polygon.map(point => point[axis]), across = item.polygon.map(point => point[fixed]);
    const limit = ['left', 'top'].includes(end) ? Math.min(...along) : Math.max(...along);
    const wall = ['left', 'top'].includes(side) ? Math.min(...across) : Math.max(...across);
    const middle = (item.doorSegment[0][axis] + item.doorSegment[1][axis]) / 2;
    item.doorSegment.forEach(point => close(point[fixed], wall, `${item.label} ${side} wall`));
    close(Math.abs(middle - limit), 0.6, `${item.label} entry near ${end}`);
    close(Math.min(...item.doorSegment.map(point => Math.abs(point[axis] - limit))), 0.15,
      `${item.label} schematic jamb`);
  };
  Object.entries(marked).forEach(([label, [side, end]]) => nearEnd(room(label), side, end));
  nearEnd(plan.sharedApartments[0], 'left', 'bottom');
  nearEnd(plan.commonAreas.find(item => item.bank === 'L'), 'bottom', 'right');
  nearEnd(plan.commonAreas.find(item => item.bank === 'R'), 'top', 'right');
});

test('space identities stay unique, windows face outside, and folded source openings remain exact', () => {
  const items = [...level.spaces, ...level.doors, ...level.layoutWindows, ...level.wallBands];
  assert.equal(new Set(items.map(item => item.id)).size, items.length);
  const spaceIds = new Set(level.spaces.map(item => item.id));
  for (const item of items) {
    assert.ok(item.id.startsWith('module-51-0-'), item.id);
    for (const field of ['spaceId', 'toSpaceId']) if (item[field]) assert.ok(spaceIds.has(item[field]));
  }
  const duplicateE = level.spaces.filter(item => item.shortLabel === 'E');
  assert.equal(duplicateE.length, 2);
  assert.notEqual(duplicateE[0].label, duplicateE[1].label, 'Two E cards distinguish their wings');
  assert.equal(level.layoutWindows.length, 26);
  const sports = plan.commonAreas.find(item => item.bank === 'L');
  const oldF = firstFloorPlan.rooms.find(item => item.bank === 'A' && item.label === 'F');
  assert.deepEqual(sports.windowSegments, [oldF.windowSegment], 'Sports keeps F’s existing layout window');
  assert.deepEqual(plan.commonAreas.find(item => item.bank === 'R').windowSegments, [],
    'Laundry does not invent a facade window pattern');
  for (const window of level.layoutWindows) {
    const [a, b] = window.segment, middle = a.map((value, axis) => (value + b[axis]) / 2);
    close(distance(a, b), 1.05, `${window.id} schematic width`);
    [a, b, middle].forEach(point => close(boundaryDistance(point, {polygon: level.floorOutline[0].outer}), 0,
      `${window.id} belongs to the exterior`));
  }
  const source = structuredClone(input);
  const old = source.studies.buildings['51'].levels.find(item => item.index === 0);
  old.windows = [{id: 'retained-ground-source-observation', segment: [[1, 2], [2, 2]],
    confidence: 'estimated', sourceSurfaceIndex: 42,
    note: 'A folded source observation is independent of the schematic ground-floor layout.'}];
  old.windowCoverage = 'complete-floor';
  const next = createHouse51GroundFloorLayout(source).studies.buildings['51'].levels.find(item => item.index === 0);
  assert.deepEqual(next.windows, old.windows);
  assert.deepEqual(next.windowCoverage, old.windowCoverage);
  assert.notEqual(next.windows, old.windows);
});

test('ground assumptions are distinguished from resident marks and retain the exact accepted source plan', () => {
  assert.equal(plan.sourceTemplate, 'public/data/house51-first-floor-layout.json');
  assert.equal(plan.sourceHashes[plan.sourceTemplate], sha(JSON.stringify(firstFloorPlan)));
  assert.equal(room('A/B').doorPlacement.evidence, 'schematic-new-single');
  for (const label of ['E', 'D', 'C']) {
    assert.equal(room(`A/${label}`).doorPlacement.evidence, 'resident-eg-lime-mark');
  }
  assert.equal(plan.commonAreas.find(item => item.bank === 'R').doorPlacement.evidence,
    'retained-balcony-stair-side-access');
  assert.equal(plan.commonAreas.find(item => item.bank === 'L').doorPlacement.evidence, 'resident-eg-lime-mark');
  assert.ok([...level.spaces, ...level.doors, ...level.layoutWindows].every(item => item.confidence === 'estimated'));
});

test('completed Yellow is retired from provisional fitting and upper regeneration preserves its ground source summary', () => {
  const fitted = createOldHouseModuleLayouts({
    studies, lod2, topPlan: redTop, firstFloorPlan: redFirst, groundFloorPlan: redGround,
  });
  assert.deepEqual(fitted.studies, studies);
  assert.deepEqual(fitted.metadata, catalog);
  assert.deepEqual(Object.keys(catalog.houses), ['53']);
  assert.deepEqual(catalog.houses['53'].levels.map(item => item.levelIndex), [0, 1, 2]);
  assert.deepEqual(createHouse51FirstFloorLayout({studies, topPlan}).studies, studies);
  assert.deepEqual(createHouse51TopFloorLayout({studies, lod2, topPlan: redTop, oldHouseLayouts: catalog}).studies, studies);
});

test('ground and upper CLIs reproduce output and preserve all completed floors in an isolated workspace', async t => {
  const temporary = await mkdtemp(join(tmpdir(), 'rommelweb-yellow-ground-'));
  t.after(() => rm(temporary, {recursive: true, force: true}));
  await Promise.all(['scripts', 'src', 'public/data', 'data/source'].map(path =>
    mkdir(join(temporary, path), {recursive: true})));
  const paths = [
    'package.json', 'scripts/house51-ground-floor-layout.mjs', 'scripts/house51-first-floor-layout.mjs',
    'scripts/house51-top-floor-layout.mjs', 'scripts/old-house-module-layout.mjs',
    'scripts/generate-old-house-studies.mjs', 'src/interior-studies.js', 'src/interiors.js', 'src/sections.js',
    'public/data/interior-studies.json', 'public/data/lod2.json', 'public/data/campus.json',
    'public/data/house55-module-layout.json', 'public/data/house55-first-floor-layout.json',
    'public/data/house55-ground-floor-layout.json', 'public/data/house51-first-floor-layout.json',
    'public/data/house51-top-floor-layout.json', 'public/data/old-house-module-layouts.json',
    'data/source/house51-eg-resident-annotation.png', 'data/source/house51-1og-resident-annotation.png',
    'data/source/house51-2og-resident-annotation.png',
  ];
  await Promise.all(paths.map(path => copyFile(new URL(`../${path}`, import.meta.url), join(temporary, path))));
  await symlink(fileURLToPath(new URL('../node_modules', import.meta.url)), join(temporary, 'node_modules'), 'dir');
  const original = structuredClone(studies), originalCatalog = structuredClone(catalog);
  original.buildings['51'] = structuredClone(before.building);
  originalCatalog.houses = {'51': structuredClone(before.layout), ...originalCatalog.houses};
  await Promise.all([
    writeFile(join(temporary, 'public/data/interior-studies.json'), JSON.stringify(original, null, 2) + '\n'),
    writeFile(join(temporary, 'public/data/old-house-module-layouts.json'), JSON.stringify(originalCatalog, null, 2) + '\n'),
  ]);
  const run = promisify(execFile);
  for (const command of ['house51-ground-floor-layout', 'house51-ground-floor-layout',
    'house51-first-floor-layout', 'house51-top-floor-layout', 'old-house-module-layout']) {
    await run(process.execPath, [join(temporary, `scripts/${command}.mjs`)], {cwd: temporary});
    for (const path of ['public/data/interior-studies.json', 'public/data/old-house-module-layouts.json',
      'public/data/house51-ground-floor-layout.json', 'public/data/house51-first-floor-layout.json',
      'public/data/house51-top-floor-layout.json']) {
      assert.equal(await readFile(join(temporary, path), 'utf8'), await readFile(new URL(`../${path}`, import.meta.url), 'utf8'),
        `${path} after ${command}`);
    }
  }
});

test('the ground preservation receipt protects both upper floors, every other house and folded exterior evidence', async () => {
  const receipt = await read('docs/evidence/house51-ground-floor-preservation.json');
  assert.equal(receipt.baseCommit, before.baseCommit);
  assert.deepEqual(receipt.studyChangeScope.changedBuildingRecords, ['51']);
  assert.deepEqual(receipt.studyChangeScope.changedLevels, [0]);
  for (const [path, record] of Object.entries(receipt.immutableFiles)) {
    assert.equal(record.unchanged, true, path);
    assert.equal(sha(await readFile(new URL(`../${path}`, import.meta.url))), record.sha256, path);
  }
  assert.equal(sha(await readFile(new URL('../public/data/interior-studies.json', import.meta.url))),
    receipt.studyChangeScope.afterSha256);
  for (const [house, record] of Object.entries(receipt.unchangedStudyBuildings)) {
    assert.equal(sha(JSON.stringify(studies.buildings[house])), record.sha256, house);
  }
  for (const index of [1, 2]) assert.equal(sha(JSON.stringify(studies.buildings['51'].levels.find(item =>
    item.index === index))), receipt.unchangedYellowLevels[index].sha256);
  assert.equal(sha(JSON.stringify(catalog.houses['53'])), receipt.unchangedHouse53Fit.sha256);
  assert.deepEqual(receipt.currentYellowFittedLevels, []);
  for (const field of ['yellowCanonical', 'historicalYellowFit', 'annotation']) {
    assert.equal(sha(await readFile(new URL(`../${receipt[field].path}`, import.meta.url))), receipt[field].sha256, field);
  }
  assert.equal(sha(await readFile(new URL(`../${receipt.firstFloorGeneratorGuard.path}`, import.meta.url))),
    receipt.firstFloorGeneratorGuard.afterSha256);
  assert.deepEqual(plan.sourceAnnotation, receipt.annotation);
  assert.equal(receipt.foldedExteriorUnchanged, true);
});
