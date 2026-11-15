import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {difference, intersection, setPrecision} from 'polyclip-ts';
import {createRegistration, generateOldHouseStudies, polygonArea} from '../scripts/generate-old-house-studies.mjs';
import {floorSection} from '../src/sections.js';
import {getLevelElevations} from '../src/interiors.js';
import {validateInteriorStudies} from '../src/interior-studies.js';

const read = async path => JSON.parse(await readFile(new URL(`../public/data/${path}.json`, import.meta.url), 'utf8'));
const [studies, lod2, campus, interiors, roomMarkers] = await Promise.all(
  ['interior-studies', 'lod2', 'campus', 'interiors', 'room-markers'].map(read),
);
const input = {studies, lod2, campus, interiors, roomMarkers}, before = JSON.stringify(input);
const generated = generateOldHouseStudies(input), output = generated.studies, metadata = generated.metadata;
const shape = space => [space.polygon, ...(space.holes || [])];
const area = polygons => polygons.reduce((total, polygon) => total + polygonArea(polygon), 0);
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const distanceToSegment = (point, a, b) => {
  const vector = subtract(b, a), t = Math.max(0, Math.min(1, dot(subtract(point, a), vector) / dot(vector, vector)));
  return Math.hypot(point[0] - a[0] - t * vector[0], point[1] - a[1] - t * vector[1]);
};
function insideRing(point, ring) {
  let inside = false;
  for (let index = 1; index < ring.length; index++) {
    const a = ring[index - 1], b = ring[index];
    if ((a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function circleApproach(door, hall) {
  const [a, b] = door.segment, length = Math.hypot(...subtract(b, a)), normal = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
  return [-1, 1].some(sign => {
    const center = a.map((value, i) => (value + b[i]) / 2 + sign * 0.605 * normal[i]);
    return insideRing(center, hall.polygon) && !(hall.holes || []).some(ring => insideRing(center, ring))
      && shape(hall).every(ring => ring.slice(1).every((end, index) => distanceToSegment(center, ring[index], end) >= 0.60 - 0.000002));
  });
}

test('adaptation preserves all input records and guards the audited exterior correspondence against source drift', () => {
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(Object.keys(output.buildings), ['51', '53', '57', '59']);
  for (const [number, building] of Object.entries(output.buildings)) {
    assert.deepEqual(studies.buildings[number], building, `${number}: published studies match their reproducible generator`);
  }
  const source = lod2.buildings.find(building => building.number === '55');
  for (const number of Object.keys(output.buildings)) {
    const target = lod2.buildings.find(building => building.number === number);
    const registration = createRegistration(source, target);
    registration.sourcePoints.forEach((point, index) => assert.ok(
      Math.hypot(...subtract(registration.mapPoint(point), registration.targetPoints[index])) < 1e-8,
      `${number}: corresponding exterior landmark stays fixed`,
    ));
    for (const triangle of registration.triangles) {
      assert.ok(triangle.determinant > 0, 'interior correspondence must never fold');
      for (let edge = 0; edge < 3; edge++) {
        const a = triangle.from[edge], b = triangle.from[(edge + 1) % 3];
        const midpoint = a.map((value, i) => (value + b[i]) / 2);
        assert.ok(Math.hypot(...subtract(registration.mapPoint(midpoint), triangle.map(midpoint))) < 1e-8,
          'adjacent triangles map a shared edge continuously');
      }
    }
    const changed = structuredClone(target);
    changed.surfaces[registration.manifest.targetSurface].points[0][0] += 0.01;
    assert.throws(() => createRegistration(source, changed), /Review changed official/);
  }
});

test('all twelve inferred floors retain their own exact official sections and do not inherit House55-specific observations', () => {
  assert.equal(validateInteriorStudies(output, campus, lod2), true);
  for (const [number, building] of Object.entries(output.buildings)) {
    const official = lod2.buildings.find(item => item.number === number), count = campus.buildings.find(item => item.number === number).levels;
    const elevations = getLevelElevations(interiors, number, count, official.height);
    assert.equal(building.levels.length, 3);
    for (const level of building.levels) {
      assert.deepEqual(level.floorOutline, floorSection(official, elevations[level.index]).polygons);
      for (const property of ['windows', 'windowCoverage', 'wallBands', 'dimensionGuides', 'excludedAreas', 'sketchBoundaries']) {
        assert.equal(level[property], undefined, `${number}/${level.index}: ${property} requires its own evidence`);
      }
      assert.equal(level.extrapolatedFrom, level.index < 2 ? 2 : undefined);
      assert.ok(level.spaces.every(space => space.confidence === 'estimated'));
      assert.ok(level.doors.every(door => door.confidence === 'estimated'));
    }
  }
});

test('conflicting central banks and House59 east inventory remain undivided, without fabricated apartments or entrances', () => {
  for (const [number, count] of Object.entries({'51': 15, '53': 14, '57': 20, '59': 17})) {
    assert.equal(metadata.houses[number].inferredCoreRoomCount, count);
    for (const level of output.buildings[number].levels) {
      assert.equal(level.spaces.filter(space => space.kind === 'room').length, count);
      for (const space of level.spaces.filter(space => space.kind === 'service')) {
        assert.ok(!level.doors.some(door => door.spaceId === space.id || door.toSpaceId === space.id));
      }
      for (const room of level.spaces.filter(space => space.kind === 'room')) {
        assert.equal(level.doors.filter(door => door.spaceId === room.id).length, 1);
      }
    }
  }
  for (const number of ['51', '53']) for (const bank of ['L', 'R']) {
    const record = metadata.houses[number].banks[bank], fit = record.straightFit;
    assert.equal(record.selectedCount, 3, 'the inherited three-bay hypothesis remains explicit evidence for rejection');
    assert.equal(record.displayedRoomCount, 0);
    assert.equal(fit.accepted, false);
    assert.match(fit.rejectionReasons.join(' '), /doorway approach/);
    assert.equal(fit.approachSensitivity.passesApproachAt120Metres, false);
    assert.ok(fit.approachSensitivity.minimumApproachAcrossBaysMetres < 1.20);
    assert.equal(fit.approachSensitivity.depthRetreatEvaluatedMetres, 0.20);
  }
  assert.equal(metadata.houses['59'].banks.E.selectedCount, null);
  assert.deepEqual(metadata.houses['59'].banks.E.alternatives.map(item => item.count), [3, 4]);
});

test('conditional area claims are recomputable from their envelopes and endpoint wall allowances', () => {
  setPrecision();
  for (const [number, house] of Object.entries(metadata.houses)) {
    const level = output.buildings[number].levels[2];
    for (const [bank, record] of Object.entries(house.banks)) {
      const fit = record.straightFit;
      if (!fit?.accepted) continue;
      const ends = ['A', 'N'].includes(bank) ? [0.20, 0.20] : ['L', 'R'].includes(bank) ? [0.10, 0.10] : [0.20, 0.10];
      assert.deepEqual(fit.endAllowancesMetres, ends);
      const n = record.displayedRoomCount;
      assert.ok(Math.abs(fit.clearWidth * n + ends[0] + ends[1] + (n - 1) * 0.20 - fit.frontageLength) < 1e-8);
      assert.ok(fit.depthRetreatMetres <= 0.20);
      assert.ok(Math.abs(fit.internalArea + fit.internalAreaShortfall - 16.4) < 1e-8);
      const rooms = level.spaces.filter(space => space.id.includes(`-bank-${bank.toLowerCase()}-`) && space.kind === 'room');
      assert.equal(rooms.length, fit.internalEnvelopePolygons.length);
      fit.internalEnvelopePolygons.forEach((polygon, index) => {
        assert.ok(Math.abs(polygonArea(polygon) - fit.internalArea) < 0.00001,
          `${number}/${bank}${index + 1}: displayed area statement must match the conditional polygon`);
        assert.ok(area(difference(polygon, shape(rooms[index]))) < 0.0001,
          `${number}/${bank}${index + 1}: a benchmark envelope must fit its actual saved gross room`);
      });
    }
  }
});

test('saved rooms are nonoverlapping and every displayed doorway has a real inward hallway approach', () => {
  setPrecision();
  for (const [number, building] of Object.entries(output.buildings)) for (const level of building.levels) {
    let overlap = 0, outside = 0;
    const floor = level.floorOutline.map(polygon => [polygon.outer, ...(polygon.holes || [])]);
    for (let index = 0; index < level.spaces.length; index++) {
      outside += area(difference(shape(level.spaces[index]), floor));
      for (const other of level.spaces.slice(index + 1)) overlap += area(intersection(shape(level.spaces[index]), shape(other)));
    }
    assert.ok(outside < 0.00001, `${number}/${level.index}: source-floor containment residual ${outside}`);
    assert.ok(overlap < 0.00001, `${number}/${level.index}: pairwise interior overlap ${overlap}`);
    for (const door of level.doors) {
      const hall = level.spaces.find(space => space.id === door.toSpaceId);
      assert.equal(hall.kind, 'corridor');
      assert.ok(circleApproach(door, hall), `${door.id}: the marker must not open onto a thin boundary tail`);
    }
    if (number === '57') {
      const stairs = level.spaces.find(space => space.kind === 'stairs');
      assert.equal(level.doors.some(door => door.spaceId === stairs.id), false);
      assert.match(stairs.note, /Actual access from either hall remains unknown/);
    }
  }
});
