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
const detail = createExteriorDetails(building, {levels: 3, absoluteFloorElevations: rows});
const face = building.surfaces[2];

test('Blue photo4 replaces only the Red-facing rows and keeps the ground opening between blank spans', () => {
  assert.deepEqual(detail.photoSurfaceIndices, [2]);
  const layout = detail.layoutsBySurface.get(face);
  assert.deepEqual(layout.rows.map(row => row.floor), [1, 2]);
  assert.equal(layout.rows[0].centers.length, 6);
  assert.deepEqual(layout.rows[0].centers, layout.rows[1].centers);
  const opening = detail.features.find(feature => feature.id === '51a-courtyard-shared-glazing');
  assert.equal(opening.divisions, 4);
  assert.deepEqual(opening.openingFractions, [0.39, 0.665]);
  const study = createBuildingWindowStudies(building.surfaces, rows, building.baseY + building.height, {
    house: '51a', family: 'timber', exclusionsBySurface: detail.exclusionsBySurface,
    layoutsBySurface: detail.layoutsBySurface,
  }).get(face);
  assert.equal(study.count, 12);
  assert.ok(study.patches.every(patch => patch.recessDepth === 0.14));
  const shown = presentExteriorSurface(face, [
    ...detail.exclusionsBySurface.get(face), ...study.patches.map(patch => [...patch.corners, patch.corners[0]]),
  ]);
  assert.ok(shown.visibleArea > shown.removedArea, 'Broad blank timber remains around the photographed openings');
  assert.equal(JSON.stringify(building), source);
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
