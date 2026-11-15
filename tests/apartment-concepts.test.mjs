import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { difference, intersection } from 'polyclip-ts';
import { apartmentConcept } from '../src/apartment-concepts.js';

const rectangle = (left, front, right, back) => [[left, front], [right, front], [right, back], [left, back], [left, front]];
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);
const ringArea = ring => {
  const [x, y] = ring[0];
  return Math.abs(ring.slice(1).reduce((sum, b, i) => sum +
    (ring[i][0] - x) * (b[1] - y) - (b[0] - x) * (ring[i][1] - y), 0)) / 2;
};
const multiArea = polygons => polygons.reduce((sum, [outer, ...holes]) => sum + ringArea(outer) -
  holes.reduce((total, hole) => total + ringArea(hole), 0), 0);
const transformPoint = ([x, y], angle) => [
  x * Math.cos(angle) - y * Math.sin(angle) + 63,
  x * Math.sin(angle) + y * Math.cos(angle) - 28,
];
const transformRing = (ring, angle) => ring.map(point => transformPoint(point, angle));

function fixture(width = 3, depth = 6.3, doorCentre = width / 2) {
  const room = {id: 'example-room', kind: 'room', polygon: rectangle(0, 0, width, depth)};
  const level = {
    isStudy: true, spaces: [room],
    doors: [{id: 'example-door', spaceId: room.id, segment: [[doorCentre - 0.45, 0], [doorCentre + 0.45, 0]]}],
    windows: [{id: 'example-window', spaceId: room.id, segment: [[width / 2 - 0.5, depth], [width / 2 + 0.5, depth]]}],
  };
  return {level, room};
}

function assertSafe(result, level, room) {
  assert.equal(result.status, 'concept');
  const allowed = [room.polygon, ...(room.holes || [])];
  const keepouts = result.zones.filter(zone => zone.keepClear).map(zone => zone.polygon);
  for (const zone of result.zones) {
    assert.ok(multiArea(difference([zone.polygon], allowed)) < 1e-8, `${zone.kind} stays within the room`);
    if (zone.keepClear) for (const band of level.wallBands || []) {
      assert.ok(multiArea(intersection([zone.polygon], [band.polygon])) < 1e-8, `${zone.kind} remains clear of wall bands`);
    }
  }
  for (const [index, item] of result.items.entries()) {
    assert.equal(item.polygon.length, 5, 'every concept footprint is a convex rectangle');
    assert.ok(item.polygon.flat().every(Number.isFinite) && Number.isFinite(item.height), 'item geometry uses finite campus metres');
    const sideLengths = item.polygon.slice(1).map((point, i) =>
      Math.hypot(point[0] - item.polygon[i][0], point[1] - item.polygon[i][1]));
    sideLengths.forEach((length, i) => near(length, i % 2 ? item.dimensions.depth : item.dimensions.width));
    near(ringArea(item.polygon), item.dimensions.width * item.dimensions.depth);
    assert.ok(multiArea(difference([item.polygon], allowed)) < 1e-8, `${item.kind} stays within the actual polygon`);
    for (const obstacle of [...keepouts, ...(level.wallBands || []).map(band => band.polygon),
      ...result.items.slice(0, index).map(other => other.polygon)]) {
      assert.ok(multiArea(intersection([item.polygon], [obstacle])) < 1e-8, `${item.kind} does not overlap a reserved area, wall band or item`);
    }
    if (item.sourceDimension) {
      const actual = [item.dimensions.width, item.dimensions.depth].sort((a, b) => a - b);
      const expected = [...item.sourceDimension.metres].sort((a, b) => a - b);
      actual.forEach((value, i) => near(value, expected[i]));
    }
  }
  const strip = result.zones.find(zone => zone.kind === 'circulation').polygon;
  near(Math.hypot(strip[1][0] - strip[0][0], strip[1][1] - strip[0][1]), 0.75);
  if (result.fit.layout === 'straight-fallback') {
    const landing = result.zones.find(zone => zone.kind === 'door-landing').polygon;
    const link = result.zones.find(zone => zone.kind === 'entry-link').polygon;
    assert.ok(multiArea(intersection([landing], [link])) > 0.001 &&
      multiArea(intersection([link], [strip])) > 0.001, 'fallback walking strip connects to the preserved entrance landing');
  }
  assert.equal(result.sourcePolicy.status, 'unassigned-schematic-concept');
  assert.match(result.sourcePolicy.serviceDimensions, /chosen examples, not dimensions/i);
}

// Independently construct a sampled round sweep and check it with polyclip.
// This does not depend on the runtime's cap count, radius or component layout.
function assertConnectedDogleg(result, level, room) {
  assert.equal(result.fit.layout, 'dogleg-service');
  const path = result.fit.circulation.centerline, radius = result.fit.circulation.width / 2;
  near(radius, 0.375);
  const pieces = path.map(([x, y]) => {
    const ring = Array.from({length: 128}, (_, i) => [x + radius * Math.cos(i * Math.PI / 64),
      y + radius * Math.sin(i * Math.PI / 64)]);
    return [[...ring, ring[0]]];
  });
  for (let i = 1; i < path.length; i++) {
    const [a, b] = [path[i - 1], path[i]], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < 1e-10) continue;
    const normal = [(a[1] - b[1]) * radius / length, (b[0] - a[0]) * radius / length];
    const ring = [[a[0] + normal[0], a[1] + normal[1]], [a[0] - normal[0], a[1] - normal[1]],
      [b[0] - normal[0], b[1] - normal[1]], [b[0] + normal[0], b[1] + normal[1]]];
    const strip = [[...ring, ring[0]]];
    // Near-coincident control points can create a sub-millimetre strip. Its
    // positive connection area scales with length; it need not cover 0.001 m².
    const connectionArea = Math.min(0.001, length * radius / 2);
    assert.ok(multiArea(intersection(strip, pieces[i - 1])) > connectionArea &&
      multiArea(intersection(strip, pieces[i])) > connectionArea, 'each strip connects the caps on both endpoints');
    pieces.push(strip);
  }
  const landing = result.zones.find(zone => zone.kind === 'door-landing').polygon;
  assert.ok(multiArea(intersection(pieces[0], [landing])) > 0.01, 'path connects to the unchanged entrance landing');
  const reserved = result.zones.filter(zone => zone.kind === 'circulation').map(zone => zone.polygon);
  const bounds = polygon => [Math.min(...polygon.map(p => p[0])), Math.min(...polygon.map(p => p[1])),
    Math.max(...polygon.map(p => p[0])), Math.max(...polygon.map(p => p[1]))];
  for (const piece of pieces) {
    const [a, b, c, d] = bounds(piece[0]);
    assert.ok(reserved.some(polygon => {
      const [left, bottom, right, top] = bounds(polygon);
      return left <= a + 1e-8 && bottom <= b + 1e-8 && right >= c - 1e-8 && top >= d - 1e-8 &&
        multiArea(difference(piece, [polygon])) < 1e-8;
    }), 'reserved components cover every part of the independent 0.75 m round sweep');
    assert.ok(multiArea(difference(piece, [room.polygon, ...(room.holes || [])])) < 1e-8,
      'full swept path remains in the actual room');
    for (const polygon of [...result.items.map(item => item.polygon), ...(level.wallBands || []).map(band => band.polygon)]) {
      assert.ok(multiArea(intersection(piece, [polygon])) < 1e-8, 'no item or wall narrows the 0.75 m route');
    }
  }
  const bathroom = result.items.find(item => item.kind === 'bathroom');
  const living = result.zones.find(zone => zone.kind === 'living').polygon;
  const intrusion = multiArea(intersection([bathroom.polygon], [living]));
  near(result.fit.livingZoneServiceIntrusion.area, intrusion);
  assert.equal(result.diagnostics.some(item => item.code === 'service-in-living-aim'), intrusion > 1e-8,
    'any service intrusion into the living-depth aim is disclosed');
  const leftSide = [bathroom.polygon[3], bathroom.polygon[0]];
  assert.ok(!result.partitions.some(segment => segment.every((point, index) =>
    Math.hypot(point[0] - leftSide[index][0], point[1] - leftSide[index][1]) < 1e-8)),
  'the bath side facing the path is open, without inventing a doorway');
}

test('fixed furniture stays inside a rotated room, respects entrance clearances and does not mutate inputs', () => {
  const baseline = fixture();
  const expected = apartmentConcept(baseline.level, baseline.room);
  assert.deepEqual(expected.items.map(item => item.kind), ['bed', 'desk', 'wardrobe', 'bathroom', 'kitchenette']);
  assert.deepEqual(expected.basis.rearWindowIds, ['example-window']);
  const sourceSizes = {bed: [0.97, 2.17], desk: [0.75, 1.55], wardrobe: [1, 0.60]};
  for (const [kind, values] of Object.entries(sourceSizes)) assert.deepEqual(expected.items.find(item => item.kind === kind).sourceDimension.metres, values);
  for (const angle of [0, Math.PI / 7, -Math.PI / 3, Math.PI / 2]) for (const reverse of [false, true]) {
    const {level, room} = fixture();
    room.polygon = transformRing(room.polygon, angle);
    if (reverse) room.polygon.reverse();
    for (const mark of [...level.doors, ...level.windows]) mark.segment = transformRing(mark.segment, angle);
    if (reverse) level.doors[0].segment.reverse();
    const snapshot = structuredClone({level, room});
    const result = apartmentConcept(level, room);
    assertSafe(result, level, room);
    assertConnectedDogleg(result, level, room);
    assert.deepEqual(result.items.map(item => item.kind), expected.items.map(item => item.kind));
    for (const [index, item] of result.items.entries()) item.polygon.forEach((point, vertex) => {
      const rotated = transformPoint(expected.items[index].polygon[vertex], angle);
      near(point[0], rotated[0], 1e-7); near(point[1], rotated[1], 1e-7);
    });
    assert.deepEqual({level, room}, snapshot);
  }
});

test('sample services only appear when their unscaled footprints and the walking strip fit', () => {
  const {level, room} = fixture(4, 7.2, 1);
  const result = apartmentConcept(level, room);
  assertSafe(result, level, room);
  const bath = result.items.find(item => item.kind === 'bathroom');
  assert.ok(bath, 'a sufficiently wide/deep example can contain the bathroom sample');
  assert.deepEqual(bath.dimensions, {width: 1.3, depth: 1.5});
  assert.equal(bath.sourceDimension, undefined, 'service dimensions are not attributed to the source sketch');
  assert.equal(result.partitions.length, 3, 'three example sides leave the front open without inventing a door');
  assert.ok(result.partitions.every(segment => segment.length === 2));
  const narrow = fixture(2.75, 6.3);
  const partial = apartmentConcept(narrow.level, narrow.room);
  assertSafe(partial, narrow.level, narrow.room);
  assert.equal(partial.fit.layout, 'straight-fallback', 'unfit full dogleg retains the original partial concept');
  assert.ok(partial.items.some(item => item.kind === 'bed'));
  assert.ok(!partial.items.some(item => item.kind === 'desk'));
  assert.ok(!partial.items.some(item => item.kind === 'bathroom'));
  assert.ok(partial.diagnostics.some(item => item.code === 'desk-omitted'));
  near(partial.items.find(item => item.kind === 'bed').dimensions.width, 0.97);
});

test('an obstacle in the proposed bathroom rejects the entire dogleg and preserves a safe straight fallback', () => {
  const {level, room} = fixture(3.3, 6.3);
  level.wallBands = [{polygon: rectangle(2.1, 1.4, 2.8, 2.4)}];
  const result = apartmentConcept(level, room);
  assertSafe(result, level, room);
  assert.equal(result.fit.layout, 'straight-fallback');
  assert.ok(result.items.some(item => item.kind === 'bed'));
  assert.ok(result.items.some(item => item.kind === 'desk'));
  assert.ok(!result.items.some(item => item.kind === 'bathroom'));
  assert.ok(result.diagnostics.some(item => item.code === 'bathroom-omitted'));
  assert.ok(!result.diagnostics.some(item => item.code === 'service-in-living-aim'),
    'rejected candidate diagnostics do not leak into fallback');
});

test('thicker marked end walls remain obstacles without treating their short returns as full-depth insulation', () => {
  const {level, room} = fixture(3.3, 6.3);
  level.wallBands = [{polygon: rectangle(0, 0, 0.3, 6.3)}];
  const result = apartmentConcept(level, room);
  assertSafe(result, level, room);
  assert.ok(result.fit.edgeInsets.some(inset => Math.abs(inset - 0.3) < 1e-8));
  assert.ok(result.items.find(item => item.kind === 'bed').polygon.every(point => point[0] >= 0.3 - 1e-8));
  assert.ok(result.fit.depth > 5.8, 'the band’s 0.3 m front return is not mistaken for a 6.3 m inset');
});

test('holes, recesses and tiny source notches cannot be bridged by furniture or walking zones', () => {
  const notch = fixture();
  notch.room.polygon = [[0, 0], [3, 0], [3, 6.3], [0, 6.3], [0, 3], [0.001, 3], [0.001, 2.5], [0, 2.5], [0, 0]];
  const fitted = apartmentConcept(notch.level, notch.room);
  assertSafe(fitted, notch.level, notch.room);
  const obstructed = fixture();
  obstructed.room.holes = [rectangle(0.7, 2, 2.3, 4)];
  const result = apartmentConcept(obstructed.level, obstructed.room);
  assert.equal(result.status, 'unavailable');
  assert.deepEqual(result.items, []);
  assert.ok(result.diagnostics.some(item => item.code === 'no-inscribed-rectangle'));
  const recessed = fixture();
  recessed.room.polygon = [[0, 0], [3, 0], [3, 6.3], [0, 6.3], [0, 4], [2, 4], [2, 2], [0, 2], [0, 0]];
  const recessResult = apartmentConcept(recessed.level, recessed.room);
  if (recessResult.status === 'concept') assertSafe(recessResult, recessed.level, recessed.room);
  else assert.deepEqual(recessResult.items, []);
});

test('non-study inputs, invalid polygons and absent, ambiguous or displaced doors fail without invented orientation', () => {
  const {level, room} = fixture();
  assert.equal(apartmentConcept({...level, isStudy: false}, room), null);
  assert.equal(apartmentConcept(level, {...room, kind: 'corridor'}), null);
  for (const change of [
    () => ({level: {...level, doors: []}, room}),
    () => ({level: {...level, doors: [...level.doors, {...level.doors[0], id: 'other'}]}, room}),
    () => ({level: {...level, doors: [{...level.doors[0], segment: [[1, 1], [2, 1]]}]}, room}),
    () => ({level, room: {...room, polygon: [[0, 0], [3, 6], [3, 0], [0, 6], [0, 0]]}}),
    () => ({level, room: {...room, holes: [rectangle(-1, 1, 0.5, 2)]}}),
    () => ({level: {...level, wallBands: [{polygon: []}]}, room}),
  ]) {
    const changed = change(), result = apartmentConcept(changed.level, changed.room);
    assert.equal(result.status, 'unavailable');
    assert.deepEqual(result.items, []);
    assert.ok(result.diagnostics.length);
  }
  const noWindows = apartmentConcept({...level, windows: []}, room);
  assertSafe(noWindows, {...level, windows: []}, room);
  assert.deepEqual(noWindows.basis.rearWindowIds, []);
  assert.match(noWindows.basis.rearEvidence, /assumed opposite/);
});

test('every published old-house room returns an unchanged, safe fixed-size concept or an explained unavailable fit', async t => {
  const studies = JSON.parse(await readFile(new URL('../public/data/interior-studies.json', import.meta.url), 'utf8'));
  const ids = ['51', '53', '55', '57', '59'];
  const fixedSizes = {bed: [0.97, 2.17], desk: [0.75, 1.55], wardrobe: [0.6, 1],
    bathroom: [1.3, 1.5], kitchenette: [0.6, 1.2]};
  const before = JSON.stringify(studies);
  for (const id of ids) {
    assert.ok(studies.buildings[id], `House ${id} study is published`);
    assert.deepEqual(studies.buildings[id].levels.map(level => level.index).sort(), [0, 1, 2],
      `House ${id} has all three study levels`);
    for (const raw of studies.buildings[id].levels) {
      const level = {...raw, isStudy: true}, rooms = level.spaces.filter(space => space.kind === 'room');
      assert.ok(rooms.length, `${id}/${level.index} has room candidates to audit`);
      if (id === '55') assert.equal(rooms.length, 20, 'the resident-counted House 55 study keeps all 20 room references');
      const levelBefore = JSON.stringify(level), counts = {full: 0, partial: 0, unavailable: 0};
      for (const room of rooms) {
        const label = `${id}/${level.index}/${room.shortLabel || room.id}`;
        try {
          const result = apartmentConcept(level, room);
          assert.ok(result && ['concept', 'unavailable'].includes(result.status), 'room fit has an explicit status');
          assert.equal(result.sourcePolicy.status, 'unassigned-schematic-concept');
          if (id === '55') assert.equal(result.fit?.layout, 'dogleg-service', 'the existing House 55 full concepts remain available');
          if (result.status === 'unavailable') {
            assert.deepEqual(result.items, []);
            assert.deepEqual(result.partitions, []);
            assert.deepEqual(result.zones, []);
            assert.ok(result.diagnostics.some(item => item.code && item.message), 'unavailable fit explains why no items were placed');
            counts.unavailable++;
            continue;
          }
          assertSafe(result, level, room);
          assert.ok(['dogleg-service', 'straight-fallback'].includes(result.fit.layout));
          for (const item of result.items) {
            assert.ok(fixedSizes[item.kind], `${item.kind} is a known unscaled concept item`);
            const actual = [item.dimensions.width, item.dimensions.depth].sort((a, b) => a - b);
            actual.forEach((value, i) => near(value, fixedSizes[item.kind][i]));
          }
          if (result.fit.layout === 'dogleg-service') {
            assertConnectedDogleg(result, level, room);
            assert.deepEqual(result.items.map(item => item.kind), Object.keys(fixedSizes));
            counts.full++;
          } else {
            for (const kind of Object.keys(fixedSizes).filter(kind => !result.items.some(item => item.kind === kind))) {
              assert.ok(result.diagnostics.some(item => item.code === `${kind}-omitted`), `${kind} omission is explained`);
            }
            counts.partial++;
          }
          assert.deepEqual(result.basis.origin, level.doors.find(door => door.spaceId === room.id || door.toSpaceId === room.id)
            .segment.reduce((sum, point) => [sum[0] + point[0] / 2, sum[1] + point[1] / 2], [0, 0]),
          'the existing doorway remains the orientation origin');
        } catch (error) {
          assert.fail(`${label}: ${error.message}`);
        }
      }
      assert.equal(JSON.stringify(level), levelBefore, `${id}/${level.index} input remains unchanged`);
      t.diagnostic(`${id}/${level.index}: ${rooms.length} candidates; ${counts.full} full, ${counts.partial} partial, ${counts.unavailable} unavailable`);
    }
  }
  assert.equal(JSON.stringify(studies), before, 'published study data remains unchanged');
});
