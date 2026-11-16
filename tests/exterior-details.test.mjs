import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createExteriorDetails} from '../src/exterior-details.js';
import {presentExteriorSurface} from '../src/exterior-presentation.js';
import {createBuildingWindowStudies} from '../src/windows.js';

const lod2 = JSON.parse(await readFile(new URL('../public/data/lod2.json', import.meta.url)));
const buildings = new Map(lod2.buildings.map(building => [building.number, building]));
const levelsByHouse = {'49': 6, '51a': 3, '53a': 5, '55a': 6, '57a': 8, '59a': 6};
const levels = building => levelsByHouse[building.number] || 3;
const elevations = building => Array.from({length: levels(building)}, (_, floor) => building.baseY + floor * building.height / levels(building));
const detailFor = building => createExteriorDetails(building, {levels: levels(building), absoluteFloorElevations: elevations(building)});
const sub = (a, b) => a.map((value, i) => value - b[i]);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const pointsOf = detail => [
  ...Object.values(detail.segmentLayers).flat(2),
  ...Object.values(detail.triangleLayers).flatMap(values => Array.from({length: values.length / 3}, (_, i) => values.slice(i * 3, i * 3 + 3))),
];
function inside(point, ring) {
  let result = false;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}
function edgeDistance(point, ring) {
  return Math.min(...ring.slice(1).map((b, i) => {
    const a = ring[i], edge = sub(b, a), delta = sub(point, a);
    const t = Math.max(0, Math.min(1, dot(delta, edge) / dot(edge, edge)));
    return Math.hypot(...point.map((value, axis) => value - a[axis] - t * edge[axis]));
  }));
}

test('photographic details preserve every source vertex, surface identity and original storey guide', () => {
  for (const building of lod2.buildings) {
    const before = JSON.stringify(building), rowGuides = elevations(building), copiedGuides = [...rowGuides];
    const detail = createExteriorDetails(building, {levels: levels(building), absoluteFloorElevations: rowGuides});
    assert.equal(JSON.stringify(building), before, `${building.number} source data cannot be rewritten`);
    assert.deepEqual(rowGuides, copiedGuides);
    assert.deepEqual(detail, detailFor(building), 'construction must be deterministic');
    assert.ok([...detail.exclusionsBySurface.keys(), ...detail.layoutsBySurface.keys()].every(surface => building.surfaces.includes(surface)));
    assert.ok(detail.features.every(feature => feature.sourceSurfaceIndices.every(index => building.surfaces[index])));
    assert.match(detail.status, /estimates/);
  }
});

test('all added geometry is finite and stays within the authoritative building envelope', () => {
  for (const building of lod2.buildings) {
    const detail = detailFor(building);
    for (const values of Object.values(detail.triangleLayers)) {
      assert.equal(values.length % 9, 0, 'complete triangles');
      assert.ok(values.every(Number.isFinite));
    }
    for (const segments of Object.values(detail.segmentLayers)) assert.ok(segments.every(segment => segment.length === 2));
    const sourcePoints = building.surfaces.flatMap(surface => surface.points);
    const minY = Math.min(...sourcePoints.map(point => point[1])), maxY = Math.max(...sourcePoints.map(point => point[1]));
    for (const point of pointsOf(detail)) {
      assert.equal(point.length, 3);
      assert.ok(point.every(Number.isFinite));
      assert.ok(point[1] >= minY - 0.003 && point[1] <= maxY + 0.003, `${building.number}: added point ${point} changed source height`);
      const plan = [point[0], point[2]];
      assert.ok(building.groundPolygons.some(ring => inside(plan, ring) || edgeDistance(plan, ring) < 0.035),
        `${building.number}: added point ${point} crossed the source footprint`);
    }
  }
});

test('every cutout is closed and coplanar and actually subtracts positive source face area', () => {
  for (const building of lod2.buildings) {
    const detail = detailFor(building);
    for (const [surface, masks] of detail.exclusionsBySurface) {
      assert.ok(masks.every(ring => ring.length >= 4 && JSON.stringify(ring[0]) === JSON.stringify(ring.at(-1))));
      const presented = presentExteriorSurface(surface, masks);
      assert.ok(presented.removedArea > 0.001);
      assert.ok(presented.visibleArea > 0, 'a recess must retain its surrounding source face');
      assert.ok(presented.removedArea < presented.sourceArea);
      assert.ok(presented.positions.every(Number.isFinite));
    }
  }
});

test('corner loggias open both elevations and their floors stay on the existing storeys', () => {
  const expected = {
    '53a': [2, 3, 4],
    '55a': [1, 2, 3, 4, 5],
  };
  for (const [number, floors] of Object.entries(expected)) {
    const building = buildings.get(number), detail = detailFor(building);
    const loggias = detail.features.filter(feature => feature.kind === 'corner-loggia');
    assert.deepEqual(loggias.map(feature => feature.floor).sort(), floors);
    for (const loggia of loggias) {
      const lower = elevations(building)[loggia.floor] + 0.08;
      const matchingFaces = loggia.sourceSurfaceIndices.filter(index => (detail.exclusionsBySurface.get(building.surfaces[index]) || [])
        .some(ring => Math.abs(Math.min(...ring.map(point => point[1])) - lower) < 0.002));
      assert.ok(matchingFaces.length >= 2, `${loggia.id} must cut both corner walls`);
      assert.ok(loggia.frontWidth > 5 && loggia.returnWidth > 2);
    }
    const stair = detail.features.find(feature => feature.kind === 'recessed-stair-elevation');
    assert.ok(stair && stair.depth > 1 && stair.width > 6);
  }
  const grey = detailFor(buildings.get('55a'));
  const wide = grey.features.find(feature => feature.id === '55a-middle-southeast-loggia');
  assert.equal(wide.sourceSurfaceIndices[0], 7, 'the long side of the large Grey middle loggia faces ESE');
  assert.equal(wide.frontWidth, 9.43);
  assert.equal(wide.returnWidth, 3.2);
});

test('photo-positioned window counts survive the recess masks without inventing extra upper windows', () => {
  for (const number of ['51a', '53a', '55a']) {
    const building = buildings.get(number), detail = detailFor(building);
    const windows = createBuildingWindowStudies(building.surfaces, elevations(building), building.baseY + building.height, {
      house: number, family: 'timber', exclusionsBySurface: detail.exclusionsBySurface, layoutsBySurface: detail.layoutsBySurface,
    });
    for (const [surface, layout] of detail.layoutsBySurface) {
      assert.equal(layout.replace, ['51a', '55a'].includes(number),
        'Blue and Grau have four-elevation coverage; unseen Lila rows retain their baseline');
      for (const row of layout.rows) {
        const patches = windows.get(surface).patches.filter(patch => patch.floor === row.floor);
        if (number === '51a' && [1, 3, 5].includes(building.surfaces.indexOf(surface))) {
          // The northwest elevation shares one row across three source wall
          // fragments. Its complete four-column count is checked separately.
          assert.ok(patches.length <= row.centers.length,
            'A source fragment cannot introduce more windows than the complete photographed row');
          continue;
        }
        if (number === '55a' && [3, 5].includes(building.surfaces.indexOf(surface))) {
          assert.ok(patches.length <= row.centers.length,
            'Grau south source fragments share one photographed elevation');
          continue;
        }
        assert.equal(patches.length, row.centers.length,
          `${number} source face ${building.surfaces.indexOf(surface)}, floor ${row.floor}: a photographed window should not be discarded to accommodate a wrong recess`);
      }
    }
  }
  const blue = detailFor(buildings.get('51a'));
  const blueRows = blue.layoutsBySurface.get(buildings.get('51a').surfaces[6]).rows;
  assert.deepEqual(blueRows[0].centers, blueRows[1].centers, 'Blue window columns retain the resident-confirmed vertical alignment');
  const lila = detailFor(buildings.get('53a')).features.find(feature => feature.id === '53a-photographic-window-rows-2');
  assert.match(lila.rows.find(row => row.floor === 0).coverage, /not a floor total/);
});

test('roof beds are below the retained source cap and observed hardware is not copied to unphotographed houses', () => {
  for (const number of Object.keys(levelsByHouse)) {
    const building = buildings.get(number), detail = detailFor(building);
    const roofs = detail.features.filter(feature => feature.kind === 'inset-roof-bed');
    assert.equal(roofs.length, 1);
    assert.equal(roofs[0].depth, 0.46);
    const cap = building.surfaces[roofs[0].sourceSurfaceIndices[0]].points[0][1];
    const y = detail.triangleLayers.detailRoofBed.filter((_, index) => index % 3 === 1);
    assert.ok(y.every(value => Math.abs(value - (cap - 0.46)) < 0.002));
    assert.equal(Boolean(detail.triangleLayers.detailRoofHardware?.length), ['51a', '53a', '55a'].includes(number));
  }
});

test('Red shared glazing and roof-light stay localized and create no extra occupied floor', () => {
  const building = buildings.get('55'), detail = detailFor(building);
  assert.deepEqual([...detail.exclusionsBySurface.keys()].map(surface => building.surfaces.indexOf(surface)).sort((a, b) => a - b), [3, 4, 15, 33, 43, 45]);
  const roofMasks = detail.exclusionsBySurface.get(building.surfaces[33]);
  assert.equal(roofMasks.length, 1);
  const ys = roofMasks[0].map(point => point[1]);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.5, 'roof-light must follow the sloped plane');
  const common = detail.exclusionsBySurface.get(building.surfaces[43])[0];
  assert.ok(Math.max(...common.map(point => point[1])) < 6.0, 'shared glazing cannot spread into the occupied room wing above the eave');
  for (const index of [4, 15, 45]) for (const entrance of detail.exclusionsBySurface.get(building.surfaces[index])) {
    assert.ok(Math.max(...entrance.map(point => point[1])) < 6.0, 'courtyard glazing and entry remain beneath the existing low roofs');
  }
  assert.ok(detail.features.every(feature => !['corner-loggia', 'recessed-stair-elevation'].includes(feature.kind)));
  assert.equal(detail.features.find(feature => feature.kind === 'sloped-roof-window').divisions, 3);
  for (const number of ['59']) assert.equal(detailFor(buildings.get(number)).exclusionsBySurface.size, 0,
    'Unphotographed old houses retain their existing opaque surfaces');
  for (const number of ['51', '53', '57']) assert.ok(detailFor(buildings.get(number)).features.every(feature => !feature.id.startsWith('55-')),
    'Yellow, Orange and White use their own photographic openings, never Red details');
});

test('invalid storey input fails instead of changing the architectural model to fit it', () => {
  const building = buildings.get('53a');
  assert.throws(() => createExteriorDetails(building, {levels: 5, absoluteFloorElevations: [0, 3, 6]}), /match/);
  assert.throws(() => createExteriorDetails(building, {levels: 5, absoluteFloorElevations: [0, 3, 6, 6, 12]}), /ascending/);
});
