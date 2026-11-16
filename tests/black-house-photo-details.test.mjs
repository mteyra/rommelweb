import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createExteriorDetails} from '../src/exterior-details.js';
import {presentExteriorSurface} from '../src/exterior-presentation.js';
import {createBuildingWindowStudies} from '../src/windows.js';

const lod2 = JSON.parse(await readFile(new URL('../public/data/lod2.json', import.meta.url)));
const building = lod2.buildings.find(item => item.number === '49');
const rows = Array.from({length: 6}, (_, floor) => building.baseY + building.height * floor / 6);
const details = () => createExteriorDetails(building, {house: '49', levels: 6, absoluteFloorElevations: rows});

test('Black photo registers only the two photographed southeast elevations', () => {
  const original = JSON.stringify(building), guides = [...rows], detail = details();
  const registration = detail.features.find(feature => feature.id === '49-resident-photo-registration');
  assert.deepEqual(registration.sourceSurfaceIndices, [1, 9]);
  assert.deepEqual(registration.nearCorner, [-66.440, 0, -59.092]);
  assert.deepEqual([...detail.layoutsBySurface.keys()].map(surface => building.surfaces.indexOf(surface)).sort((a, b) => a - b), [1, 9]);
  for (const index of [0, 2, 3, 4, 7, 8]) {
    assert.equal(detail.exclusionsBySurface.has(building.surfaces[index]), false, `unphotographed wall ${index}`);
  }
  assert.equal(JSON.stringify(building), original);
  assert.deepEqual(rows, guides);
  assert.deepEqual(details(), detail);
});

test('Black corner openings remain on photographed floors and inside retained source planes', () => {
  const detail = details();
  const loggias = detail.features.filter(feature => feature.kind === 'corner-loggia');
  assert.deepEqual(loggias.map(feature => feature.floor), [1, 4]);
  for (const loggia of loggias) {
    assert.deepEqual(loggia.sourceSurfaceIndices, [1, 9]);
    assert.ok(loggia.frontWidth > loggia.returnWidth * 2);
    for (const index of loggia.sourceSurfaceIndices) {
      const masks = detail.exclusionsBySurface.get(building.surfaces[index]);
      assert.ok(masks.some(ring => Math.abs(Math.min(...ring.map(point => point[1])) - (rows[loggia.floor] + 0.08)) < 1e-6));
    }
    assert.match(loggia.evidence, /existing apartment plans are unchanged/);
  }
  const partial = detail.features.filter(feature => feature.kind === 'partial-loggia-end');
  assert.deepEqual(partial.map(feature => feature.floor), [2, 5]);
  partial.forEach(feature => assert.deepEqual(feature.sourceSurfaceIndices, [1], 'unseen west return is not altered'));
  for (const index of [1, 9]) {
    const surface = building.surfaces[index];
    const result = presentExteriorSurface(surface, detail.exclusionsBySurface.get(surface));
    assert.ok(result.removedArea > 1 && result.visibleArea > result.removedArea);
    assert.ok(result.positions.every(Number.isFinite));
  }
});

test('Black visible row counts and alternating columns survive loggia clipping', () => {
  const detail = details();
  const studies = createBuildingWindowStudies(building.surfaces, rows, building.baseY + building.height, {
    house: '49', family: 'timber',
    exclusionsBySurface: detail.exclusionsBySurface, layoutsBySurface: detail.layoutsBySurface,
  });
  for (const [index, counts] of [[1, [1, 1, 4, 5, 4, 4]], [9, [6, 6, 7, 7, 6, 7]]]) {
    const surface = building.surfaces[index], layout = detail.layoutsBySurface.get(surface);
    assert.deepEqual(layout.rows.map(row => row.centers.length), counts);
    assert.equal(layout.replace, false);
    for (const row of layout.rows) {
      assert.equal(studies.get(surface).patches.filter(patch => patch.floor === row.floor).length, row.centers.length,
        `wall ${index} floor ${row.floor}: observed windows must not disappear behind a wrong recess`);
    }
  }
  const eastRows = detail.layoutsBySurface.get(building.surfaces[9]).rows;
  assert.deepEqual(eastRows[3].centers, eastRows[5].centers, 'photographed alternate rows have matching columns');
  assert.notDeepEqual(eastRows[3].centers, eastRows[4].centers, 'retain the observed stagger');
  const southRows = detail.features.find(feature => feature.id === '49-photographic-window-rows-1').rows;
  assert.match(southRows.find(row => row.floor === 0).coverage, /not a floor total/);
});

test('Black photo mesh has finite triangles and no roof equipment inferred from a street view', () => {
  const detail = details();
  for (const positions of Object.values(detail.triangleLayers)) {
    assert.equal(positions.length % 9, 0);
    assert.ok(positions.every(Number.isFinite));
  }
  const sourceY = building.surfaces.flatMap(surface => surface.points.map(point => point[1]));
  for (const positions of Object.values(detail.triangleLayers)) {
    for (let i = 1; i < positions.length; i += 3) {
      assert.ok(positions[i] >= Math.min(...sourceY) - 0.003 && positions[i] <= Math.max(...sourceY) + 0.003);
    }
  }
  assert.equal(detail.triangleLayers.detailRoofHardware, undefined);
  assert.equal(detail.features.some(feature => feature.kind === 'recessed-stair-elevation'), false);
});
