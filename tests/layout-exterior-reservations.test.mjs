import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {NEWER_HOUSES, protectedExteriorPolygons} from '../scripts/new-house-module-layout.mjs';
import {getLevelElevations} from '../src/interiors.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8').then(JSON.parse);
const [lod2, campus, interiors, archive] = await Promise.all([
  'public/data/lod2.json', 'public/data/campus.json', 'public/data/interiors.json',
  'data/source/newer-layout-exterior-reservations.json',
].map(read));
const inputs = house => {
  const building = lod2.buildings.find(item => item.number === house);
  const count = campus.buildings.find(item => item.number === house).levels;
  return {building, elevations: getLevelElevations(interiors, house, count, building.height)};
};

test('all 34 saved layout reservations survive exterior refinements and caller mutation', () => {
  assert.deepEqual(Object.keys(archive.houses).sort(), [...NEWER_HOUSES].sort());
  let checked = 0;
  for (const house of NEWER_HOUSES) {
    const {building, elevations} = inputs(house);
    assert.deepEqual(elevations, archive.houses[house].relativeFloorElevations);
    for (let floor = 0; floor < elevations.length; floor++) {
      const expected = archive.houses[house].levels[floor];
      const first = protectedExteriorPolygons(building, floor, elevations);
      assert.deepEqual(first, expected, `${house}/${floor}`);
      if (first.polygons.length) first.polygons[0][0][0][0] += 900;
      if (first.features.length) first.features[0].kind = 'caller-edited';
      first.polygons.push([[[900, 900], [901, 900], [901, 901], [900, 900]]]);
      first.features.push({kind: 'caller-added'});
      assert.deepEqual(protectedExteriorPolygons(building, floor, elevations), expected,
        `${house}/${floor}: returned reservations must not expose the archive`);
      checked++;
    }
  }
  assert.equal(checked, 34);
  const black = inputs('49');
  for (let floor = 0; floor < black.elevations.length; floor++) {
    assert.deepEqual(protectedExteriorPolygons(black.building, floor, black.elevations), {polygons: [], features: []},
      'new Black facade recesses must not silently alter the previously saved rooms or hall');
  }
});

test('reservation lookup rejects changed source, elevations and unsupported inputs', () => {
  for (const house of NEWER_HOUSES) {
    const {building, elevations} = inputs(house);
    assert.throws(() => protectedExteriorPolygons({...building, height: building.height + 0.1}, 0, elevations),
      /source building differs/);
    const movedCorner = structuredClone(building);
    movedCorner.groundPolygons[0][0][0] += 0.1;
    assert.throws(() => protectedExteriorPolygons(movedCorner, 0, elevations), /source building differs/);
    for (const changed of [null, [], elevations.slice(1), [elevations[0] + 0.01, ...elevations.slice(1)],
      [NaN, ...elevations.slice(1)], [Infinity, ...elevations.slice(1)]]) {
      assert.throws(() => protectedExteriorPolygons(building, 0, changed), /floor elevations differ/);
    }
    for (const floor of [-1, elevations.length, 0.5, NaN, '0', undefined]) {
      assert.throws(() => protectedExteriorPolygons(building, floor, elevations), /Unsupported frozen exterior reservation floor/);
    }
  }
  for (const building of [null, undefined, {number: '55'}, {number: 'unknown'}]) {
    assert.throws(() => protectedExteriorPolygons(building, 0, [0]), /No frozen exterior reservations/);
  }
});
