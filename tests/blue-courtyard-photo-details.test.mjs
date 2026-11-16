import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createExteriorDetails} from '../src/exterior-details.js';
import {createBuildingWindowStudies, createWindowStudy} from '../src/windows.js';
import {presentExteriorSurface} from '../src/exterior-presentation.js';
import {surfaceFrame} from '../src/facade.js';
import {getLevelElevations} from '../src/interiors.js';

const read = async name => JSON.parse(await readFile(new URL(`../public/data/${name}.json`, import.meta.url)));
const [lod2, interiors] = await Promise.all([read('lod2'), read('interiors')]);
const building = lod2.buildings.find(item => item.number === '51a');
const source = JSON.stringify(building);
const rows = getLevelElevations(interiors, '51a', 3, building.height).map(y => y + building.baseY);
const originalRows = [...rows];
const detail = createExteriorDetails(building, {levels: 3, absoluteFloorElevations: rows});
const studies = createBuildingWindowStudies(building.surfaces, rows, building.baseY + building.height, {
  house: '51a', family: 'timber', exclusionsBySurface: detail.exclusionsBySurface,
  layoutsBySurface: detail.layoutsBySurface,
});
const photoFaces = [1, 2, 3, 4, 5, 6];
const feature = id => {
  const result = detail.features.find(item => item.id === id);
  assert.ok(result, `Missing photographed Blue feature: ${id}`);
  return result;
};

// A single window can be represented on two adjacent LoD2 wall fragments.
// Count its physical centre once, retaining the distinct source wall records.
function physicalCenters(indices, floor) {
  const centers = [];
  for (const index of indices) {
    for (const patch of studies.get(building.surfaces[index])?.patches || []) {
      if (patch.floor !== floor) continue;
      const center = [0, 2].map(axis => patch.corners.reduce((sum, point) => sum + point[axis], 0) / patch.corners.length);
      if (!centers.some(other => Math.hypot(center[0] - other[0], center[1] - other[1]) < 0.025)) centers.push(center);
    }
  }
  return centers.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

test('all four Blue elevations use complete photographed upper rows within the unchanged source shell', () => {
  assert.deepEqual([...detail.photoSurfaceIndices].sort((a, b) => a - b), photoFaces);
  for (const index of photoFaces) {
    const layout = detail.layoutsBySurface.get(building.surfaces[index]);
    assert.ok(layout, `Wall ${index} needs an explicit photographed layout`);
    assert.equal(layout.replace, true, `Wall ${index} must not retain a generic fallback row`);
    assert.deepEqual(layout.rows.filter(row => row.floor > 0).map(row => row.floor).sort(), [1, 2]);
    assert.ok(layout.recessDepth > 0 && layout.recessDepth <= 0.3);
    assert.ok(studies.get(building.surfaces[index])?.construction.every(item => item.explicit));
  }
  for (const [indices, expected] of [[[2], 6], [[4], 7], [[6], 6], [[3, 1, 5], 4]]) {
    const first = physicalCenters(indices, 1), second = physicalCenters(indices, 2);
    assert.equal(first.length, expected, `First-floor window count on walls ${indices}`);
    assert.equal(second.length, expected, `Top-floor window count on walls ${indices}`);
    first.forEach((point, index) => assert.ok(
      Math.hypot(point[0] - second[index][0], point[1] - second[index][1]) < 0.001,
      `Window ${index + 1} must align vertically on walls ${indices}`));
  }
  assert.equal(detail.claddingElevations.length, 4);
  assert.equal(detail.claddingElevations[0], building.baseY);
  assert.equal(detail.claddingElevations.at(-1), building.baseY + building.height);
  assert.ok(detail.claddingElevations[1] > rows[1], 'The photographed tall ground cladding band is independent of the saved floor level');
  assert.equal(JSON.stringify(building), source);
  assert.deepEqual(rows, originalRows, 'Photo cladding and opening heights must not move floor-section guides');
});

test('the northeast ground gallery keeps its four bays between substantial blank timber spans', () => {
  const face = building.surfaces[2];
  const opening = feature('51a-courtyard-shared-glazing');
  assert.deepEqual(opening.sourceSurfaceIndices, [2]);
  assert.equal(opening.divisions, 4);
  assert.deepEqual(opening.openingFractions, [0.39, 0.665]);
  const study = studies.get(face);
  assert.equal(study.count, 12);
  assert.ok(study.patches.every(patch => patch.recessDepth > 0));
  const shown = presentExteriorSurface(face, [
    ...detail.exclusionsBySurface.get(face), ...study.patches.map(patch => [...patch.corners, patch.corners[0]]),
  ]);
  assert.ok(shown.removedArea > 0, 'Ground gallery and upper windows need actual presentation apertures');
  assert.ok(shown.visibleArea > shown.removedArea, 'Broad blank timber remains around the photographed openings');
  assert.equal(physicalCenters([2], 0).length, 0, 'The gallery must not receive a generic ground window row');
});

test('six separate southeast ground windows remain separate from the corner restaurant glazing', () => {
  const southeast = feature('51a-southeast-ground-windows');
  assert.deepEqual(southeast.sourceSurfaceIndices, [4]);
  assert.equal(southeast.count, 6);
  const masks = detail.exclusionsBySurface.get(building.surfaces[4]) || [];
  const groundMasks = masks.filter(ring => Math.min(...ring.map(point => point[1])) < rows[1]);
  assert.equal(groundMasks.length, 6, 'Each narrow opening needs its own aperture with timber between');
  const upperCenters = physicalCenters([4], 1);
  const groundCenters = groundMasks.map(ring => {
    const points = ring.slice(0, -1);
    return [0, 2].map(axis => points.reduce((sum, point) => sum + point[axis], 0) / points.length);
  }).sort((a, b) => a[0] - b[0]);
  groundCenters.forEach((point, index) => assert.ok(
    Math.hypot(point[0] - upperCenters[index][0], point[1] - upperCenters[index][1]) < 0.001,
    `Ground aperture ${index + 1} must align with its upper column`));
  for (const ring of groundMasks) {
    const frame = surfaceFrame(building.surfaces[4]);
    const us = ring.map(point => frame.project(point)[0]);
    assert.ok(Math.max(...us) - Math.min(...us) < 1.6, 'Separate ground windows must not become a continuous storefront');
  }
  const southwest = feature('51a-southwest-shared-glazing');
  assert.deepEqual(southwest.sourceSurfaceIndices, [6]);
  assert.deepEqual(southwest.openingFractions, [0.012, 0.595]);
  assert.equal(southwest.divisions, 9);
  const restaurant = feature('51a-northwest-restaurant-glazing');
  assert.deepEqual(restaurant.sourceSurfaceIndices, [5]);
  const entrance = feature('51a-recessed-entrance');
  assert.ok(restaurant.openingFractions[0] > entrance.openingFractions[1]);
  assert.ok(restaurant.openingFractions[0] - entrance.openingFractions[1] < 0.003,
    'Restaurant glazing starts immediately after the entrance reveal');
  assert.ok(restaurant.openingFractions[1] > 0.99 && restaurant.openingFractions[1] < 1,
    'Glazing reaches the west corner with clearance for its dark post');
  assert.equal(restaurant.divisions, 6);
  assert.equal(restaurant.greenCornerPanel, true);
});

test('the residential entrance occupies the central northwest wall between blank timber and restaurant', () => {
  const entrance = feature('51a-recessed-entrance');
  assert.deepEqual(entrance.sourceSurfaceIndices, [1]);
  assert.equal(entrance.doorCount, 1);
  assert.equal(entrance.sidelightCount, 1);
  assert.ok(entrance.width > 3.9 && entrance.width < 4.2, 'Entrance width follows the retained central source segment');
  const aperture = presentExteriorSurface(building.surfaces[1], detail.exclusionsBySurface.get(building.surfaces[1]) || []);
  assert.ok(aperture.removedArea > 5, 'The vestibule must be recessed into an open display shell');
  assert.ok(!detail.features.some(item => /corner-loggia|recessed-stair-elevation|bike-storage/.test(item.kind)),
    'Blue photos show an enclosed entrance and outdoor bicycle parking, with no balcony or storage façade');
  assert.equal(JSON.stringify(building), source);
  assert.deepEqual(rows, originalRows);
});

test('Photo windows have inset glass, connecting reveals and shallow external sills without shifting their plan corners', () => {
  const wall = {type: 'WallSurface', points: [[0, 0, 0], [22.8, 0, 0], [22.8, 9, 0], [0, 9, 0], [0, 0, 0]]};
  const layout = {replace: true, rows: [{floor: 1, centers: [3, 7]}]};
  const make = explicitLayout => createWindowStudy(wall, [0, 3, 6], 9, null, undefined, [], {explicitLayout});
  const flat = make(layout);
  const inset = make({...layout, recessDepth: 0.14});
  assert.equal(inset.count, 2);
  assert.deepEqual(inset.patches.map(patch => patch.corners), flat.patches.map(patch => patch.corners));
  const frame = surfaceFrame(wall);
  const depth = positions => Array.from({length: positions.length / 3}, (_, i) =>
    frame.normal.reduce((sum, value, axis) => sum + (positions[i * 3 + axis] - frame.origin[axis]) * value, 0));
  assert.ok(depth(inset.layers.glass).every(value => value < -0.10 && value > -0.14));
  assert.ok(depth(inset.layers.reveal).some(value => Math.abs(value) < 1e-8), 'Reveal connects to source wall plane');
  assert.ok(depth(inset.layers.reveal).some(value => value < -0.12), 'Reveal connects to inset frame');
  assert.ok(depth(inset.layers.sill).some(value => Math.abs(value - 0.025) < 1e-8));
  assert.ok(depth(flat.layers.glass).every(value => value > 0), 'Unreviewed elevations keep the original flat display');
  assert.throws(() => make({...layout, recessDepth: -0.1}), /recess depth/);
});
