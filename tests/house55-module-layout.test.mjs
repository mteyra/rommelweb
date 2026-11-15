import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { union, intersection, difference } from 'polyclip-ts';
import { createModulePlan, createStudyLevel, createSandbox } from '../scripts/house55-module-layout.mjs';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const [plan, studies, archive, provenance, sandbox] = await Promise.all([
  read('public/data/house55-module-layout.json'),
  read('public/data/interior-studies.json'),
  read('data/source/house55-2og-before-module-layout.json'),
  read('data/source/house55-2og-study-provenance.json'),
  read('public/house55-layout/shell.json'),
]);
const level = studies.buildings['55'].levels.find(item => item.index === 2);
const epsilon = 1e-7;
const close = (actual, expected, message = '') => assert.ok(
  Math.abs(actual - expected) < epsilon, `${message}: ${actual} differs from ${expected}`,
);
const edges = ring => ring.slice(1).map((b, index) => [ring[index], b]);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const ringArea = ring => Math.abs(edges(ring).reduce(
  (sum, [a, b]) => sum + a[0] * b[1] - b[0] * a[1], 0,
)) / 2;
const geometryArea = polygons => polygons.reduce(
  (sum, polygon) => sum + ringArea(polygon[0]) - polygon.slice(1).reduce((s, ring) => s + ringArea(ring), 0), 0,
);
const polygon = ring => [ring];
const edgeLengths = ring => edges(ring).map(([a, b]) => distance(a, b)).sort((a, b) => a - b);
const boundaryDistance = (point, ring) => Math.min(...edges(ring).map(([a, b]) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1,
    ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared,
  )) : 0;
  return distance(point, [a[0] + t * dx, a[1] + t * dy]);
}));

// These lengths and turns are read from the final annotated outline, independently
// of the generator's dimension labels and cached totals.
test('the drawn shell closes with the annotated connector, wing and step dimensions', () => {
  const expected = [
    ['E', 7.4], ['S', 1.9], ['E', 21.3], ['N', 7.4],
    ['E', 12.4], ['S', 7.4], ['W', 5], ['S', 12.4],
    ['W', 7.4], ['N', 5], ['W', 21.3], ['S', 7.4],
    ['W', 9.3], ['N', 7.4], ['E', 1.9], ['N', 9.3],
  ];
  const actual = edges(plan.shell.outline);
  assert.equal(actual.length, expected.length);
  actual.forEach(([a, b], index) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    assert.ok(Math.abs(dx) < epsilon || Math.abs(dy) < epsilon, 'Every shell edge is orthogonal');
    const direction = Math.abs(dx) > epsilon ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
    assert.equal(direction, expected[index][0], `Turn ${index}`);
    close(distance(a, b), expected[index][1], `Shell edge ${index}`);
  });
  assert.deepEqual(plan.shell.outline[0], plan.shell.outline.at(-1));
  close(ringArea(plan.shell.outline), 478.78, 'Area from outline vertices');
});

test('twenty clear rooms have fixed 2.70 by 6.00 interiors and 3.10 m modules', () => {
  assert.equal(plan.rooms.length, 20);
  assert.equal(new Set(plan.rooms.map(room => room.id)).size, 20);
  assert.deepEqual(plan.rooms.map(room => room.label).sort(), [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'L1', 'L2', 'L3',
    'N1', 'N2', 'N3', 'R1', 'R2', 'R3', 'W1', 'W2', 'W3', 'W4',
  ]);
  for (const room of plan.rooms) {
    edgeLengths(room.polygon).forEach((length, index) =>
      close(length, [2.7, 2.7, 6, 6][index], `${room.label} clear side`));
    edgeLengths(room.modulePolygon).forEach((length, index) =>
      close(length, [3.1, 3.1, 6, 6][index], `${room.label} module side`));
    close(ringArea(room.polygon), 16.2, `${room.label} clear area`);
    close(geometryArea(difference(polygon(room.polygon), polygon(plan.shell.outline))), 0,
      `${room.label} remains inside the floor`);
    assert.equal(room.sideWalls.length, 2);
    const moduleParts = union(polygon(room.polygon), ...room.sideWalls.map(polygon));
    close(geometryArea(difference(polygon(room.modulePolygon), moduleParts)), 0, `${room.label} module has no gap`);
    close(geometryArea(difference(moduleParts, polygon(room.modulePolygon))), 0, `${room.label} module has no excess`);
  }
});

test('clear rooms, forty side walls, halls and stairs cover the shell without positive overlaps', () => {
  assert.equal(plan.wallBands.length, 40);
  for (const wall of plan.wallBands) {
    edgeLengths(wall.polygon).forEach((length, index) =>
      close(length, [0.2, 0.2, 6, 6][index], `${wall.id} side`));
  }
  const groups = [
    [plan.rooms, 324], [plan.wallBands, 48], [plan.corridors, 86.8], [[plan.stair], 19.98],
  ];
  for (const [items, expectedArea] of groups) {
    close(items.reduce((sum, item) => sum + ringArea(item.polygon), 0), expectedArea);
  }
  const pieces = groups.flatMap(([items]) => items.map(item => polygon(item.polygon)));
  const occupied = union(...pieces);
  close(geometryArea(occupied), pieces.reduce((sum, item) => sum + geometryArea([item]), 0),
    'No piece has positive-area overlap');
  close(geometryArea(difference(polygon(plan.shell.outline), occupied)), 0, 'No floor area is missing');
  close(geometryArea(difference(occupied, polygon(plan.shell.outline))), 0, 'No occupied piece leaves the floor');
  for (let i = 0; i < plan.rooms.length; i++) for (let j = i + 1; j < plan.rooms.length; j++) {
    close(geometryArea(intersection(polygon(plan.rooms[i].polygon), polygon(plan.rooms[j].polygon))), 0,
      `${plan.rooms[i].label}/${plan.rooms[j].label} do not overlap`);
  }
});

const sharedBoundaryLength = (first, second) => {
  let length = 0;
  for (const [a, b] of edges(first)) for (const [c, d] of edges(second)) {
    const vertical = Math.abs(a[0] - b[0]) < epsilon && Math.abs(c[0] - d[0]) < epsilon;
    const horizontal = Math.abs(a[1] - b[1]) < epsilon && Math.abs(c[1] - d[1]) < epsilon;
    const fixedAxis = vertical ? 0 : 1;
    if ((!vertical && !horizontal) || Math.abs(a[fixedAxis] - c[fixedAxis]) >= epsilon) continue;
    const along = 1 - fixedAxis;
    length += Math.max(0, Math.min(Math.max(a[along], b[along]), Math.max(c[along], d[along]))
      - Math.max(Math.min(a[along], b[along]), Math.min(c[along], d[along])));
  }
  return length;
};

test('all hallway junctions meet across the full 1.40 m width and reach the stair landings', () => {
  for (const hall of plan.corridors) close(edgeLengths(hall.polygon)[0], 1.4, `${hall.bank} hallway width`);
  const circulation = [...plan.corridors.map(hall => ({ name: hall.bank, polygon: hall.polygon })),
    { name: 'Stair', polygon: plan.stair.polygon }];
  const connections = [];
  for (let i = 0; i < circulation.length; i++) for (let j = i + 1; j < circulation.length; j++) {
    const length = sharedBoundaryLength(circulation[i].polygon, circulation[j].polygon);
    if (length > epsilon) {
      close(length, 1.4, `${circulation[i].name}/${circulation[j].name} open connection`);
      connections.push([circulation[i].name, circulation[j].name].sort().join('-'));
    }
  }
  assert.deepEqual(connections.sort(), ['A-W', 'E-N', 'E-R', 'L-Stair', 'L-W', 'R-Stair']);
  const stairParts = [plan.stair.flightPolygon, plan.stair.walkwayPolygon,
    ...plan.stair.landings.map(landing => landing.polygon)].map(polygon);
  const wholeStair = union(...stairParts);
  close(geometryArea(wholeStair), ringArea(plan.stair.polygon), 'Stair subdivision covers its enclosure');
  close(geometryArea(difference(wholeStair, polygon(plan.stair.polygon))), 0);
  close(edgeLengths(plan.stair.walkwayPolygon)[0], 1.4);
  close(edgeLengths(plan.stair.flightPolygon)[0], 1.3);
});

test('every active room reaches the stair through 22 door segments on real shared boundaries', () => {
  const roomSpaces = level.spaces.filter(space => space.kind === 'room');
  assert.equal(roomSpaces.length, 20);
  assert.equal(level.doors.length, 22);
  const adjacency = new Map(level.spaces.map(space => [space.id, new Set()]));
  for (const door of level.doors) {
    const [a, b] = door.segment;
    const samples = [a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]];
    const geometricNeighbors = level.spaces.filter(space =>
      samples.every(point => boundaryDistance(point, space.polygon) < epsilon)).map(space => space.id);
    assert.equal(geometricNeighbors.length, 2, `${door.id} touches exactly two spaces`);
    assert.deepEqual(geometricNeighbors.sort(), [door.spaceId, door.toSpaceId].sort(),
      `${door.id} metadata agrees with its actual boundary`);
    close(distance(a, b), 0.9, `${door.id} width`);
    adjacency.get(geometricNeighbors[0]).add(geometricNeighbors[1]);
    adjacency.get(geometricNeighbors[1]).add(geometricNeighbors[0]);
  }
  const stair = level.spaces.find(space => space.kind === 'stairs');
  const visited = new Set([stair.id]), queue = [stair.id];
  while (queue.length) for (const neighbor of adjacency.get(queue.shift())) {
    if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); }
  }
  assert.equal(visited.size, level.spaces.length, 'All rooms, both halls and stair form one graph');
  for (const room of roomSpaces) {
    assert.equal(adjacency.get(room.id).size, 1, `${room.shortLabel} has one hall entry`);
    close(ringArea(room.polygon), 16.2, `${room.shortLabel} stays at metre scale after campus registration`);
    close(geometryArea(difference(polygon(room.polygon), level.floorOutline.map(item =>
      [item.outer, ...(item.holes || [])]))), 0, `${room.shortLabel} stays inside the registered floor`);
  }
});

test('all relocated window symbols stay on the independent floor exterior', () => {
  assert.equal(level.layoutWindows.length, 24);
  const exterior = level.floorOutline[0].outer;
  for (const window of level.layoutWindows) {
    const [a, b] = window.segment;
    for (const point of [a, b, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]]) {
      close(boundaryDistance(point, exterior), 0, `${window.id} belongs to an exterior edge`);
    }
  }
});

test('generation is deterministic, preserves the archived input and retains folded window evidence', () => {
  const previous = structuredClone(archive.level);
  const registration = structuredClone(provenance.registration);
  const generated = createModulePlan(previous, registration);
  assert.deepEqual(generated, plan);
  assert.deepEqual(createModulePlan(previous, registration), generated);
  assert.deepEqual(createStudyLevel(generated, previous), level);
  assert.deepEqual(createSandbox(generated), sandbox);
  assert.deepEqual(previous, archive.level);
  assert.deepEqual(registration, provenance.registration);
  assert.deepEqual(level.windows, archive.level.windows);
  assert.deepEqual(level.windowCoverage, archive.level.windowCoverage);
  assert.equal(level.layoutWindows.length, 24);
  assert.ok(level.layoutWindows.every(window => window.confidence === 'estimated'));
});
