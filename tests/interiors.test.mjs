import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateInteriorData, getInteriorLevel, getLevelElevations } from '../src/interiors.js';

const read = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const campus = await read('../public/data/campus.json');
const lod2 = await read('../public/data/lod2.json');
const published = await read('../public/data/interiors.json');

// Synthetic geometry used only to exercise validation, never loaded by the app.
function fixture() {
  return {
    schemaVersion: 1,
    buildings: {
      '55': {
        approved: true,
        source: 'Synthetic unit-test fixture; not a real plan',
        reviewedAt: '2025-10-14',
        reusePermission: 'Synthetic test data created by this project',
        levels: [{
          index: 0, label: 'Synthetic ground floor', elevation: 0,
          source: 'Synthetic test fixture, sheet 1', reviewedAt: '2025-10-14',
          spaces: [{id: 'test-55-space-1', label: 'Synthetic space', kind: 'room', polygon: [[0, 0], [4, 0], [4, 3], [0, 3], [0, 0]]}],
        }],
      },
    },
  };
}
const entry = data => data.buildings['55'];
const level = data => entry(data).levels[0];
const space = data => level(data).spaces[0];
const validate = data => validateInteriorData(data, campus, lod2);

test('published interior dataset validates and empty interior coverage is supported', () => {
  assert.equal(validate(published), true);
  const empty = {schemaVersion: 1, buildings: {}};
  assert.equal(validate(empty), true);
  assert.equal(getInteriorLevel(empty, '55', 0), null);
});

test('approved geometry validates without mutation and can be retrieved by house/floor', () => {
  const data = fixture();
  const before = structuredClone(data);
  assert.equal(validate(data), true);
  assert.deepEqual(data, before);
  assert.equal(getInteriorLevel(data, '55', 0), level(data));
  assert.equal(getInteriorLevel(data, '57', 0), null);
  assert.equal(getInteriorLevel(data, '55', 1), null);
  assert.equal(getInteriorLevel(data, '55', '0'), null);
  entry(data).approved = false;
  assert.equal(getInteriorLevel(data, '55', 0), null);
  assert.throws(() => validate(data), /approved/);
});

test('publication requires approval, source, dated review and explicit reuse permission', () => {
  for (const key of ['approved', 'source', 'reviewedAt', 'reusePermission']) {
    const data = fixture(); delete entry(data)[key];
    assert.throws(() => validate(data), new RegExp(key));
  }
  for (const key of ['source', 'reviewedAt']) {
    const data = fixture(); delete level(data)[key];
    assert.throws(() => validate(data), new RegExp(key));
  }
  const data = fixture(); level(data).reviewedAt = '2025-02-30';
  assert.throws(() => validate(data), /calendar date/);
});

test('unknown houses, floors and schema versions are rejected', () => {
  const unknown = fixture(); unknown.buildings['999'] = entry(unknown); delete unknown.buildings['55'];
  assert.throws(() => validate(unknown), /unknown house/);
  for (const floor of [-1, 3, 0.5, '0']) {
    const data = fixture(); level(data).index = floor;
    assert.throws(() => validate(data), /above-ground floor/);
  }
  const version = fixture(); version.schemaVersion = 2;
  assert.throws(() => validate(version), /schemaVersion/);
});

test('floor elevations must be finite, plausible and increase upwards', () => {
  for (const elevation of [-1, 9.491, NaN, Infinity, null, '0']) {
    const data = fixture(); level(data).elevation = elevation;
    assert.throws(() => validate(data), /elevation/);
  }
  const zeroUpperFloor = fixture();
  level(zeroUpperFloor).index = 1;
  assert.throws(() => validate(zeroUpperFloor), /above the building base/);
  const data = fixture();
  level(data).elevation = 0.5;
  entry(data).levels.push({...structuredClone(level(data)), index: 1, elevation: 0.5, spaces: []});
  assert.throws(() => validate(data), /elevations must increase/);
});

test('duplicate floor indexes and stable space IDs cannot create ambiguous targets', () => {
  const floors = fixture(); entry(floors).levels.push({...structuredClone(level(floors)), spaces: []});
  assert.throws(() => validate(floors), /duplicates a floor/);
  const ids = fixture(); level(ids).spaces.push(structuredClone(space(ids)));
  assert.throws(() => validate(ids), /duplicates a space ID/);
});

test('room polygons must be closed, finite, nondegenerate and non-self-intersecting', () => {
  const malformed = [
    [[0, 0], [4, 0], [4, 3], [0, 3]],
    [[0, 0], [Infinity, 0], [4, 3], [0, 0]],
    [[0, 0], [2, 0], [4, 0], [0, 0]],
    [[0, 0], [4, 3], [0, 3], [4, 0], [0, 0]],
    [[0, 0], [4, 0], [4, 0], [0, 3], [0, 0]],
    [[646738, 5493536], [646742, 5493536], [646742, 5493539], [646738, 5493536]],
  ];
  for (const polygon of malformed) {
    const data = fixture(); space(data).polygon = polygon;
    assert.throws(() => validate(data), /polygon/);
  }
});

test('resident, contact, occupancy and other unrecognized fields are rejected at every level', () => {
  for (const [select, key] of [[data => data, 'residents'], [entry, 'whatsappInvite'], [level, 'occupants'], [space, 'residentName'], [space, 'phone'], [space, 'isOccupied']]) {
    const data = fixture(); select(data)[key] = 'Private information must never be bundled';
    assert.throws(() => validate(data), /not allowed; publish geometry and provenance only/);
  }
  const data = fixture(); space(data).kind = 'resident';
  assert.throws(() => validate(data), /kind/);
});

test('unpopulated or unapproved interiors use uniformly spaced floor guides', () => {
  const empty = {schemaVersion: 1, buildings: {}};
  assert.deepEqual(getLevelElevations(empty, '55a', 6, 18), [0, 3, 6, 9, 12, 15]);
  assert.deepEqual(getLevelElevations(empty, '55', 1, 9), [0]);
  const data = fixture(); entry(data).approved = false; level(data).elevation = 2;
  assert.deepEqual(getLevelElevations(data, '55', 3, 9), [0, 3, 6]);
});

test('partial measured floors anchor interpolation exactly instead of colliding with old guides', () => {
  const data = fixture();
  data.buildings['55a'] = entry(data); delete data.buildings['55'];
  const template = data.buildings['55a'].levels[0];
  data.buildings['55a'].levels = [{...template, index: 2, elevation: 7, spaces: []}];
  assert.equal(validate(data), true);
  const before = structuredClone(data);
  assert.deepEqual(getLevelElevations(data, '55a', 6, 18), [0, 3.5, 7, 9.75, 12.5, 15.25]);
  assert.deepEqual(data, before);
});

test('multiple unsorted anchors and a measured ground floor remain exact', () => {
  const data = fixture();
  const template = level(data);
  entry(data).levels = [
    {...template, index: 2, elevation: 6.6, spaces: []},
    {...template, index: 0, elevation: 0.25},
  ];
  assert.equal(validate(data), true);
  const elevations = getLevelElevations(data, '55', 3, 9.491);
  assert.equal(elevations[0], 0.25);
  assert.equal(elevations[2], 6.6);
  assert.ok(Math.abs(elevations[1] - 3.425) < 1e-10);
  entry(data).levels.push({...template, index: 1, elevation: 3.1, spaces: []});
  assert.deepEqual(getLevelElevations(data, '55', 3, 9.491), [0.25, 3.1, 6.6]);
});

test('invalid envelope dimensions and contradictory anchors cannot generate overlapping guides', () => {
  for (const count of [0, -1, 2.5, NaN, Infinity, '3']) {
    assert.throws(() => getLevelElevations(published, '55', count, 9.491), /Floor count/);
  }
  for (const height of [0, -1, NaN, Infinity, '9']) {
    assert.throws(() => getLevelElevations(published, '55', 3, height), /Official height/);
  }
  const data = fixture();
  entry(data).levels.push({...structuredClone(level(data)), index: 1, elevation: 0, spaces: []});
  assert.throws(() => getLevelElevations(data, '55', 3, 9.491), /must increase/);
  entry(data).levels[1].index = 3;
  assert.throws(() => getLevelElevations(data, '55', 3, 9.491), /outside floor count/);
});
