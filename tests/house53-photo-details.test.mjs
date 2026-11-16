import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createExteriorDetails} from '../src/exterior-details.js';
import {presentExteriorSurface} from '../src/exterior-presentation.js';
import {createBuildingWindowStudies, getOldFacadeRowGuides} from '../src/windows.js';
import {surfaceFrame} from '../src/facade.js';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const [lod2, studies, canonical, interiors] = await Promise.all([
  read('public/data/lod2.json'), read('public/data/interior-studies.json'),
  read('public/data/house53-module-layouts.json'), read('public/data/interiors.json'),
]);
const inputs = {lod2, studies, canonical, interiors}, before = structuredClone(inputs);
const building = lod2.buildings.find(b => b.number === '53');
const guides = getOldFacadeRowGuides(building, 3, interiors);
const options = {levels: 3, absoluteFloorElevations: guides.elevations};
const details = createExteriorDetails(building, options);
const feature = id => details.features.find(f => f.id === id);
const masks = index => details.exclusionsBySurface.get(building.surfaces[index]) || [];
const windows = createBuildingWindowStudies(building.surfaces, guides.elevations, building.baseY + guides.guideHeight, {
  house: '53', family: 'plates', exclusionsBySurface: details.exclusionsBySurface,
  layoutsBySurface: details.layoutsBySurface,
});
const counts = index => [0, 1, 2].map(floor => (windows.get(building.surfaces[index])?.patches || []).filter(p => p.floor === floor).length);
const inside = (p, ring) => {
  let result = false;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
};

test('Orange photo construction preserves all current layout and envelope inputs', () => {
  assert.deepEqual(inputs, before);
  assert.deepEqual(createExteriorDetails(building, options), details, 'Photo construction is deterministic');
  assert.deepEqual(options.absoluteFloorElevations, guides.elevations);
  for (const [surface, masks] of details.exclusionsBySurface) {
    assert.ok(building.surfaces.includes(surface), 'Masks refer to the original source record');
    const display = presentExteriorSurface(surface, masks);
    assert.ok(display.removedArea > 0 && display.removedArea < display.sourceArea);
    assert.ok(display.positions.every(Number.isFinite));
  }
});

test('photographed Orange room columns stay aligned and survive source-face clipping', () => {
  assert.deepEqual(counts(36), [5, 5, 4], 'The low outer step contains the fifth lower column');
  assert.deepEqual(counts(33), [4, 4, 3], 'The photographed end retains three upper and four lower columns');
  assert.deepEqual(counts(22), [2, 2, 3], 'The entry-side face retains its extra upper opening');
  for (const index of [22, 33, 36]) {
    const surface = building.surfaces[index], layout = details.layoutsBySurface.get(surface);
    assert.deepEqual(layout.rows[0].centers, layout.rows[1].centers);
    const middle = layout.rows[1].centers, upper = layout.rows[2].centers;
    const shared = index === 22 ? middle : upper;
    const complete = index === 22 ? upper : middle;
    assert.ok(shared.every(center => complete.includes(center)));
    for (const row of layout.rows) assert.equal(counts(index)[row.floor], row.centers.length,
      'A wrong source registration must not silently discard a photographed opening');
  }
  assert.deepEqual(counts(0), [0, 0, 0], 'The low end is visibly blank in photo 8');
  assert.deepEqual(counts(4), [0, 0, 0], 'The adjoining stepped end has no invented openings');
  assert.equal(feature('53-narrow-window-over-canopy').count, 1);
  assert.equal(feature('53-narrow-window-over-canopy').floor, 1);
  assert.equal(masks(5).length, 1, 'The observed non-grounded opening is explicitly placed above the canopy');
});

test('orange communal glazing keeps its brown piers, white panels and separate entrance', () => {
  assert.equal(masks(26).length, 2, 'Two broad glazing groups on the entrance face');
  assert.equal(masks(36).length, 3, 'Three separate groups on its low return');
  assert.ok(details.triangleLayers.detailLightPanel.length > 0);
  for (const index of [26, 36]) {
    const surface = building.surfaces[index], frame = surfaceFrame(surface);
    const intervals = masks(index).map(ring => {
      const points = ring.map(frame.project);
      return [Math.min(...points.map(p => p[0])), Math.max(...points.map(p => p[0]))];
    }).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < intervals.length; i++) assert.ok(intervals[i][0] - intervals[i - 1][1] > 0.3,
      'Opaque cladding remains between broad groups');
    assert.ok(masks(index).flat().every(p => p[1] < 4.9));
  }
  assert.equal(feature('53-recessed-entrance').doorCount, 1);
  assert.equal(feature('53-recessed-entrance').noticeCaseCount, 1);
  assert.equal(masks(46).length, 1);
  assert.ok(Math.max(...masks(46)[0].map(p => p[1])) < Math.min(...building.surfaces[21].points.map(p => p[1])));
  assert.equal(masks(21).length, 0, 'The original entrance canopy is retained');
  const sign = details.signs.find(s => s.id === '53-entrance-address');
  assert.deepEqual(sign.lines, ['Erwin-Rommel-Straße', '53']);
  assert.ok(sign.corners.flat().every(Number.isFinite));
});

test('Orange roof details use photographed planes and keep the original ridge height', () => {
  const dormer = feature('53-entrance-dormer');
  assert.deepEqual(dormer.sourceSurfaceIndices, [30]);
  assert.equal(masks(30).length, 1);
  assert.equal(dormer.divisions, 3);
  assert.ok(dormer.capY < Math.max(...building.surfaces[30].points.map(p => p[1])));
  const [a, b, c, d] = dormer.frontGlazing;
  assert.deepEqual([a[0], a[2]], [d[0], d[2]]);
  assert.deepEqual([b[0], b[2]], [c[0], c[2]]);
  assert.ok(c[1] > b[1] && d[1] > a[1], 'The dormer front is upright');
  assert.deepEqual(feature('53-observed-roof-finishes').sourceSurfaceIndices, [21, 30, 34, 42]);
  assert.ok(!details.features.some(f => f.sourceSurfaceIndices.includes(41)), 'The unseen opposite slope gets no copied dormer');
});

test('the photographed repair station stays within the pre-existing shelter', () => {
  const shelter = feature('53-bike-service-shelter'), station = feature('53-bike-repair-station');
  assert.deepEqual(shelter.sourceSurfaceIndices, [15, 25, 38, 42]);
  assert.equal(station.count, 1);
  assert.equal(masks(42).length, 0, 'The shelter roof retains its original footprint');
  assert.ok([15, 25, 38].every(index => masks(index).length === 1));
  const roof = building.surfaces[42];
  assert.ok(inside([station.position[0], station.position[2]], roof.points.map(p => [p[0], p[2]])));
  assert.ok(station.position[1] >= building.baseY);
  assert.match(station.evidence, /approximations within the retained roof footprint/);
  assert.ok(!details.features.some(f => /interior-route|stair-connection|room-addition/.test(f.kind)));
});
