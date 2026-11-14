import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const readJSON = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const campus = await readJSON('../public/data/campus.json');
const lod2 = await readJSON('../public/data/lod2.json');
const receipt = await readJSON('../data/source/lod2-source.json');
const expectedAddresses = ['49', '51', '51a', '53', '53a', '55', '55a', '57', '57a', '59', '59a'];

test('every dorm is independently address-matched in both exterior and context sources', () => {
  assert.deepEqual(lod2.buildings.map((building) => building.number), expectedAddresses);
  assert.deepEqual(campus.buildings.map((building) => building.number), expectedAddresses);
  assert.equal(new Set(lod2.buildings.map((building) => building.id)).size, 11);
  assert.equal(new Set(campus.buildings.map((building) => building.osmId)).size, 11);
  for (const building of campus.buildings) {
    assert.equal(building.tags['addr:housenumber'], building.number);
    assert.equal(building.tags['addr:street'], 'Erwin-Rommel-Straße');
    assert.equal(building.levels, Number(building.tags['building:levels']));
  }
});

test('official model surfaces form finite closed rings and retain both roofs and walls', () => {
  for (const building of lod2.buildings) {
    for (const required of ['GroundSurface', 'WallSurface', 'RoofSurface']) {
      assert.ok(building.surfaces.some((surface) => surface.type === required), `${building.number}: missing ${required}`);
    }
    for (const surface of building.surfaces) {
      for (const ring of [surface.points, ...surface.holes]) {
        assert.ok(ring.length >= 4, `${building.number}: invalid ring`);
        assert.deepEqual(ring[0], ring.at(-1), `${building.number}: open ring`);
        for (const point of ring) {
          assert.equal(point.length, 3);
          assert.ok(point.every(Number.isFinite));
          assert.ok(Math.abs(point[0]) < 200 && Math.abs(point[2]) < 200, 'Projection/origin error');
          assert.ok(point[1] > -0.02 && point[1] < 40, 'Vertical datum error');
        }
      }
    }
  }
});

test('rendered roof/base elevations agree with official height attributes', () => {
  for (const building of lod2.buildings) {
    const elevations = building.surfaces.flatMap((surface) => surface.points.map((point) => point[1]));
    // Official surfaces and string height attributes use slightly different rounding.
    assert.ok(Math.abs(Math.min(...elevations) - building.baseY) < 0.015, building.number);
    assert.ok(Math.abs(Math.max(...elevations) - Math.min(...elevations) - building.height) < 0.015, building.number);
    assert.ok(Math.abs(building.baseAltitude - lod2.metadata.verticalDatum - building.baseY) < 0.0011);
    assert.ok(Math.abs(building.roofAltitude - building.baseAltitude - building.height) < 0.0011);
  }
  assert.equal(lod2.buildings.find((building) => building.number === '57a').height, 23.458);
  assert.notEqual(lod2.buildings.find((building) => building.number === '51a').height, 9, 'Do not replace official heights with 3 m/storey fallback');
});

test('official exterior and independently mapped footprints agree on location', () => {
  assert.deepEqual(lod2.metadata.origin, campus.metadata.origin);
  for (const building of lod2.buildings) {
    const reference = campus.buildings.find((item) => item.number === building.number);
    const ring = building.groundPolygons[0];
    const xs = ring.map((point) => point[0]);
    const zs = ring.map((point) => point[1]);
    const middle = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2];
    assert.ok(Math.hypot(middle[0] - reference.centroid[0], middle[1] - reference.centroid[1]) < 5, `${building.number}: address/projection mismatch`);
  }
});

test('retained official source has its recorded checksum and both licences remain identifiable', async () => {
  const source = await readFile(new URL('../data/source/dorms-lod2.gml', import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'), receipt.subsetSha256);
  assert.equal(lod2.metadata.sha256, receipt.hash);
  assert.equal(lod2.metadata.license, 'CC-BY-4.0');
  assert.equal(campus.metadata.license, 'ODbL-1.0');
  assert.ok(lod2.metadata.attribution.includes('Bayerische Vermessungsverwaltung'));
  assert.ok(campus.metadata.attribution.includes('OpenStreetMap'));
});
