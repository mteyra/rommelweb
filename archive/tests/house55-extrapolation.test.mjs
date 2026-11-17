import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {difference, intersection, union} from 'polyclip-ts';
import {refreshHouse55LowerLevels} from '../scripts/extrapolate-house55-levels.mjs';
import {validateInteriorStudies} from '../src/interior-studies.js';
import {readHistoricalStudies, assertUnchangedOtherFloors} from './fixtures/pre-module-studies.mjs';

const read = name => readFile(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8').then(JSON.parse);
const [published, historical, campus, lod2] = await Promise.all([
  read('interior-studies'), readHistoricalStudies(), read('campus'), read('lod2'),
]);
const original = historical.buildings['55'];
const building = lod2.buildings.find(item => item.number === '55');
const top = original.levels.find(level => level.index === 2);
const lower = original.levels.filter(level => level.index < 2);
const area = ring => Math.abs(ring.slice(1).reduce((sum, b, i) => sum + ring[i][0] * b[1] - b[0] * ring[i][1], 0)) / 2;
const polygonArea = polygon => area(polygon[0]) - polygon.slice(1).reduce((sum, ring) => sum + area(ring), 0);
const multiArea = polygons => polygons.reduce((sum, polygon) => sum + polygonArea(polygon), 0);
const asPolygon = space => [space.polygon, ...(space.holes || [])];
const frozen = value => {
  Object.freeze(value);
  for (const entry of Object.values(value)) if (entry && typeof entry === 'object' && !Object.isFrozen(entry)) frozen(entry);
  return value;
};

test('lower studies reproduce their historical core and retain their own complete source plates', () => {
  assertUnchangedOtherFloors(published, historical);
  const input = frozen(structuredClone({lower, top, building})), before = JSON.stringify(input);
  const {levels, metadata} = refreshHouse55LowerLevels(input.lower, input.top, input.building);
  assert.equal(JSON.stringify(input), before, 'neither the official shell nor any existing study may be mutated');
  const updated = {schemaVersion: 1, buildings: {'55': {...original, levels: [...levels, top]}}};
  assert.equal(validateInteriorStudies(updated, campus, lod2), true);
  for (const level of levels) {
    const prior = lower.find(item => item.index === level.index);
    assert.deepEqual(level.floorOutline, prior.floorOutline, 'lower plates are not replaced with the smaller top plate');
    assert.equal(level.extrapolatedFrom, 2);
    assert.equal(level.spaces.length, 24);
    assert.equal(level.spaces.filter(space => space.kind === 'room').length, 20);
    assert.equal(level.doors.length, 21);
    assert.ok(level.spaces.every(space => space.confidence === 'estimated'));
    assert.ok(level.doors.every(door => door.confidence === 'estimated'));
    assert.match(level.notes, /current corrected 2\. OG core as an unverified extrapolation/);
    for (const field of ['windows', 'windowCoverage', 'wallBands', 'excludedAreas', 'sketchBoundaries', 'reviewedAt', 'elevation']) {
      assert.equal(Object.hasOwn(level, field), false, `${field} must not be promoted from the top-floor evidence`);
    }
    const floor = level.floorOutline.map(piece => [piece.outer, ...(piece.holes || [])]);
    const assigned = union(...level.spaces.map(asPolygon));
    assert.ok(multiArea(difference(assigned, floor)) < 0.0001);
    assert.ok(multiArea(difference(floor, assigned)) > 50, 'visible extra lower wings remain unassigned');
    assert.ok(metadata.find(item => item.index === level.index).maximumExteriorTrimMetres < 0.001);
  }
  const ids = [...levels, top].flatMap(level => [...level.spaces, ...level.doors].map(item => item.id));
  assert.equal(new Set(ids).size, ids.length, 'rooms and doorways keep distinct identities on every floor');
});

test('repeated L rooms, staircase flight and door graph keep historical top-floor positions without filling extra lower circulation', () => {
  const {levels} = refreshHouse55LowerLevels(lower, top, building);
  for (const level of levels) {
    const floor = level.floorOutline.map(piece => [piece.outer, ...(piece.holes || [])]);
    const prefix = `study-55-${level.index}-`;
    for (const space of level.spaces) {
      const source = top.spaces.find(item => item.id === space.id.replace(prefix, 'study-55-2-'));
      assert.ok(source);
      const expected = intersection(asPolygon(source), floor);
      const actual = [asPolygon(space)];
      const changedArea = multiArea(difference(actual, expected)) + multiArea(difference(expected, actual));
      assert.ok(changedArea < 0.00001, `${space.shortLabel}: only numerical exterior clipping is allowed (${changedArea}m²)`);
      if (source.stairFlight) assert.deepEqual(space.stairFlight, source.stairFlight);
    }
    for (let i = 0; i < level.spaces.length; i++) for (let j = i + 1; j < level.spaces.length; j++) {
      assert.ok(multiArea(intersection(asPolygon(level.spaces[i]), asPolygon(level.spaces[j]))) < 0.000001);
    }
    const ids = new Set(level.spaces.map(space => space.id));
    for (const door of level.doors) {
      const source = top.doors.find(item => item.id === door.id.replace(prefix, 'study-55-2-'));
      assert.ok(source);
      assert.deepEqual(door.segment, source.segment, 'the repeated door follows the newly corrected partition');
      assert.equal(door.spaceId, source.spaceId.replace('study-55-2-', prefix));
      assert.equal(door.toSpaceId, source.toSpaceId.replace('study-55-2-', prefix));
      assert.ok(ids.has(door.spaceId) && ids.has(door.toSpaceId));
    }
    const stairs = level.spaces.find(space => space.kind === 'stairs');
    const stairDoors = level.doors.filter(door => [door.spaceId, door.toSpaceId].includes(stairs.id));
    assert.equal(stairDoors.length, 1, 'extrapolation cannot invent an east stairwell connection');
    const hall = level.spaces.find(space => space.id === stairDoors[0].toSpaceId);
    assert.equal(hall.shortLabel, 'West hall');
  }
});

test('historical extrapolation rejects an incompatible lower plate and refuses the independent module plan', () => {
  const independent = published.buildings['55'].levels.find(level => level.index === 2);
  assert.throws(() => refreshHouse55LowerLevels(lower, independent, building), /independent.*module|module.*independent/i);
  const altered = structuredClone(lower);
  altered[0].floorOutline = [{outer: [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]], holes: []}];
  assert.throws(() => refreshHouse55LowerLevels(altered, top, building), /disconnects|sub-millimetre/);
  assert.throws(() => refreshHouse55LowerLevels([lower[0], lower[0]], top, building), /existing EG and 1\. OG/);
  const wrongCount = structuredClone(top);
  wrongCount.spaces.splice(wrongCount.spaces.findIndex(space => space.kind === 'room'), 1);
  assert.throws(() => refreshHouse55LowerLevels(lower, wrongCount, building), /changed top-floor count/);
});
