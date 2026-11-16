import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createExteriorDetails} from '../src/exterior-details.js';
import {presentExteriorSurface} from '../src/exterior-presentation.js';
import {createBuildingWindowStudies, getOldFacadeRowGuides} from '../src/windows.js';

const lod2 = JSON.parse(await readFile(new URL('../public/data/lod2.json', import.meta.url)));
const building = lod2.buildings.find(b => b.number === '51');
const sourceBefore = JSON.stringify(building);
const rows = getOldFacadeRowGuides(building, 3);
const details = createExteriorDetails(building, {levels: 3, absoluteFloorElevations: rows.elevations});
const feature = id => details.features.find(item => item.id === id);

test('Yellow photo additions preserve the official shell and retain observed opaque glazing piers', () => {
  assert.equal(JSON.stringify(building), sourceBefore);
  for (const id of ['51-entrance-common-glazing', '51-rear-common-glazing']) {
    const glazing = feature(id);
    assert.ok(glazing, id);
    assert.equal(glazing.groups.length, 3);
    for (let i = 1; i < glazing.groups.length; i++) assert.ok(glazing.groups[i].left - glazing.groups[i - 1].right > 0.25);
    const surface = building.surfaces[glazing.sourceSurfaceIndices[0]];
    const masks = details.exclusionsBySurface.get(surface);
    assert.equal(masks.length, 3);
    const shown = presentExteriorSurface(surface, masks);
    assert.ok(shown.removedArea > 10 && shown.visibleArea > shown.removedArea);
  }
  assert.equal(feature('51-recessed-entrance').doorCount, 1);
  assert.deepEqual(feature('51-recessed-entrance').sourceSurfaceIndices, [36, 20]);
  assert.equal(details.exclusionsBySurface.has(building.surfaces[20]), false, 'The original entrance canopy is retained');
  assert.deepEqual(details.signs.find(sign => sign.id === '51-entrance-address').lines, ['Erwin-Rommel-Straße', '51']);
});

test('Yellow front and rear preserve their photographed aligned window columns and differing counts', () => {
  const windows = createBuildingWindowStudies(building.surfaces, rows.elevations, building.baseY + rows.guideHeight, {
    house: '51', family: 'plates', exclusionsBySurface: details.exclusionsBySurface, layoutsBySurface: details.layoutsBySurface,
  });
  for (const [index, lower, upper] of [[4, 5, 4], [22, 6, 5]]) {
    const layout = details.layoutsBySurface.get(building.surfaces[index]);
    assert.ok(layout, `wall${index}`);
    assert.equal(layout.rows.find(row => row.floor === 0).centers.length, lower);
    assert.equal(layout.rows.find(row => row.floor === 1).centers.length, lower);
    const high = layout.rows.find(row => row.floor === 2).centers;
    assert.equal(high.length, upper);
    const low = layout.rows.find(row => row.floor === 0).centers;
    for (const center of high) assert.ok(low.includes(center), 'Upper windows stay in the corresponding lower columns');
    assert.equal(windows.get(building.surfaces[index]).count, 2 * lower + upper, 'All observed windows survive source containment');
  }
});

test('Yellow dormer is upright, its mask lies on roof12 and all added geometry is finite', () => {
  const dormer = feature('51-entrance-roof-dormer');
  assert.ok(dormer);
  assert.equal(dormer.divisions, 3);
  assert.deepEqual(dormer.sourceSurfaceIndices, [12]);
  assert.ok(dormer.capY < Math.max(...building.surfaces[12].points.map(p => p[1])));
  const [a, b, c, d] = dormer.frontGlazing;
  assert.equal(a[1], b[1]);
  assert.equal(c[1], d[1]);
  assert.ok(Math.abs(a[0] - d[0]) < 1e-9 && Math.abs(a[2] - d[2]) < 1e-9);
  assert.ok(Math.abs(b[0] - c[0]) < 1e-9 && Math.abs(b[2] - c[2]) < 1e-9);
  const presentation = presentExteriorSurface(building.surfaces[12], details.exclusionsBySurface.get(building.surfaces[12]));
  assert.ok(presentation.removedArea > 2 && presentation.visibleArea > 20);
  for (const vertices of Object.values(details.triangleLayers)) assert.ok(vertices.every(Number.isFinite));
  for (const segments of Object.values(details.segmentLayers)) assert.ok(segments.flat(2).every(Number.isFinite));
});
