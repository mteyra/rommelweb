import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createExteriorDetails} from '../src/exterior-details.js';
import {createBuildingWindowStudies, getOldFacadeRowGuides} from '../src/windows.js';
import {presentExteriorSurface} from '../src/exterior-presentation.js';
import {surfaceFrame} from '../src/facade.js';

const load = name => readFile(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8').then(JSON.parse);
const [lod2, interiors, studies, layouts] = await Promise.all(
  ['lod2', 'interiors', 'interior-studies', 'house57-module-layouts'].map(load));
const building = lod2.buildings.find(building => building.number === '57');
const rows = getOldFacadeRowGuides(building, 3, interiors);
const makeDetails = () => createExteriorDetails(building, {levels: 3, absoluteFloorElevations: rows.elevations});
const details = makeDetails();
const windows = createBuildingWindowStudies(building.surfaces, rows.elevations, building.baseY + rows.guideHeight, {
  house: '57', family: 'plates', locatedLevels: studies.buildings['57'].levels,
  exclusionsBySurface: details.exclusionsBySurface, layoutsBySurface: details.layoutsBySurface,
});
const feature = id => details.features.find(feature => feature.id === id);
const masks = index => details.exclusionsBySurface.get(building.surfaces[index]) || [];
const count = index => [0, 1, 2].map(floor => windows.get(building.surfaces[index])?.patches.filter(patch => patch.floor === floor).length || 0);
const sub = (a, b) => a.map((value, i) => value - b[i]);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test('White construction is deterministic and preserves source and all interior records', () => {
  const records = {lod2, interiors, studies, layouts, rows};
  const before = JSON.stringify(records);
  assert.deepEqual(makeDetails(), details);
  assert.equal(JSON.stringify(records), before);
  assert.equal(building.height, 9.672);
  assert.equal(building.baseY, 2.641);
  assert.equal(building.surfaces.length, 43);
  assert.equal(studies.buildings['57'].levels.length, 3);
  assert.ok(details.features.every(item => item.id.startsWith('57-')));
  assert.ok(details.features.every(item => item.sourceSurfaceIndices.every(index => building.surfaces[index])));
});

test('the seven photographs produce their distinct window counts after masking and source clipping', () => {
  // EG / 1. OG / 2. OG: inspect the actual rendering output, not just the layout
  // declarations. A nominal window must not disappear under a roof or a mask.
  const expected = new Map([
    [40, [4, 4, 3]], [4, [4, 4, 4]], [1, [1, 1, 0]], [23, [5, 5, 4]],
    [21, [2, 2, 1]], [36, [5, 5, 4]], [11, [3, 3, 3]], [18, [1, 1, 1]],
  ]);
  for (const [index, counts] of expected) assert.deepEqual(count(index), counts, `source wall ${index}`);
  for (const index of [3, 5, 8, 10, 12, 14, 16, 19, 22, 25, 27, 32, 33, 35, 37]) {
    assert.deepEqual(count(index), [0, 0, 0], `no generic room grid on blank/special frontage ${index}`);
  }
  const upper = feature('57-window-above-entrance');
  assert.equal(upper.count, 1);
  assert.equal(upper.floor, 2);
  assert.equal(masks(32).length, 1);
  assert.ok(masks(32)[0].every(point => point[1] >= rows.elevations[2] + 0.94));
});

test('repeated columns align vertically and the disappearing upper bays correspond to real roof steps', () => {
  for (const index of [40, 4, 1, 23, 21, 36, 11]) {
    const surface = building.surfaces[index], frame = surfaceFrame(surface);
    const centers = floor => windows.get(surface).patches.filter(p => p.floor === floor)
      .map(p => frame.project(p.corners[0])[0] + (frame.project(p.corners[1])[0] - frame.project(p.corners[0])[0]) / 2)
      .sort((a, b) => a - b);
    const lower = centers(0), middle = centers(1), upper = centers(2);
    assert.equal(lower.length, middle.length);
    lower.forEach((center, i) => close(center, middle[i]));
    assert.ok(upper.every(center => lower.some(other => Math.abs(center - other) < 1e-7)));
    for (const patch of windows.get(surface).patches) {
      assert.equal(patch.recessDepth, 0.14);
      const display = presentExteriorSurface(surface, [[...patch.corners, patch.corners[0]]]);
      assert.ok(display.removedArea > 0.35, 'the window is a real display opening');
    }
  }
  assert.equal(count(40)[0] - count(40)[2], 1);
  assert.equal(count(23)[0] - count(23)[2], 1);
  assert.equal(count(36)[0] - count(36)[2], 1);
});

test('both common-room corners retain separate white glazing bays and broad opaque piers', () => {
  for (const [id, index, numberOfGroups] of [
    ['57-garden-front-glazing', 40, 3], ['57-garden-return-glazing', 33, 2],
    ['57-entrance-front-glazing', 36, 3], ['57-entrance-return-glazing', 10, 1],
  ]) {
    const observed = feature(id);
    assert.equal(observed.groups.length, numberOfGroups);
    assert.equal(masks(index).length, numberOfGroups);
    const surface = building.surfaces[index], frame = surfaceFrame(surface);
    const spans = masks(index).map(ring => {
      const us = ring.map(point => frame.project(point)[0]);
      return [Math.min(...us), Math.max(...us)];
    }).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < spans.length; i++) {
      assert.ok(spans[i][0] - spans[i - 1][1] >= 0.45, 'broad cladding piers separate the groups');
    }
    for (const ring of masks(index)) assert.ok(ring.every(point => point[1] < 5.75), 'glazing remains beneath the low eave');
    const presented = presentExteriorSurface(surface, masks(index));
    assert.ok(presented.removedArea > 8);
    assert.ok(presented.visibleArea > 1, 'source piers and upper cladding remain');
  }
  assert.deepEqual(feature('57-garden-front-glazing').groups.map(group => group.divisions), [3, 3, 3]);
  assert.deepEqual(feature('57-entrance-front-glazing').groups.map(group => group.divisions), [3, 2, 2]);
});

test('the signed residential entrance is recessed under roof7 and distinct from the plain end door', () => {
  const entrance = feature('57-recessed-entrance'), service = feature('57-plain-service-door');
  assert.equal(entrance.doorCount, 1);
  assert.equal(service.doorCount, 1);
  assert.equal(masks(14).length, 1);
  assert.equal(masks(35).length, 1);
  assert.equal(masks(7).length, 0, 'the canopy is trimmed, never moved or cut away');
  assert.ok(entrance.depth > 1);
  assert.ok(entrance.doorWidth < entrance.width);
  assert.ok(Math.max(...masks(14)[0].map(p => p[1])) < Math.min(...building.surfaces[7].points.map(p => p[1])));
  assert.equal(details.signs.length, 1);
  const sign = details.signs[0];
  assert.deepEqual(sign.lines, ['Erwin-Rommel-Straße', '57']);
  close(Math.hypot(...sub(sign.corners[1], sign.corners[0])), sign.width);
  close(Math.hypot(...sub(sign.corners[3], sign.corners[0])), sign.height);
  const horizontal = sub(sign.corners[1], sign.corners[0]);
  const outward = [-horizontal[2], 0, horizontal[0]];
  assert.ok(dot(outward, surfaceFrame(building.surfaces[14]).normal) > 0,
    'address text faces the entrance court without mirroring');
  assert.ok(details.features.every(item => !['corner-loggia', 'recessed-stair-elevation'].includes(item.kind)),
    'White does not acquire the newer houses’ open galleries or balconies');
});

test('both upright dormers intersect their own slope and remain below the existing ridges', () => {
  for (const index of [9, 29]) {
    const dormer = feature(`57-upright-dormer-${index}`), glass = dormer.frontGlazing;
    assert.equal(dormer.divisions, 3);
    assert.equal(masks(index).length, 1);
    assert.ok(dormer.capY < Math.max(...building.surfaces[index].points.map(point => point[1])));
    assert.ok(dormer.capY < building.baseY + building.height);
    assert.deepEqual(glass[0], glass.at(-1));
    for (const [bottom, top] of [[glass[0], glass[3]], [glass[1], glass[2]]]) {
      close(bottom[0], top[0]); close(bottom[2], top[2]);
      assert.ok(top[1] > bottom[1], 'panes are vertical, not painted onto a sloping roof');
    }
    const ys = masks(index)[0].map(point => point[1]);
    assert.ok(Math.max(...ys) - Math.min(...ys) > 0.9);
    const cut = presentExteriorSurface(building.surfaces[index], masks(index));
    assert.ok(cut.removedArea > 4);
    assert.ok(cut.visibleArea > 40);
  }
});

test('bicycles are outdoor scenery in three observed areas, independent of the architectural envelope', () => {
  const parking = details.features.filter(item => item.kind === 'outdoor-bicycle-parking');
  assert.equal(parking.length, 3);
  assert.ok(parking.every(item => item.outdoor && !item.structural));
  assert.deepEqual(parking.map(item => item.sourceSurfaceIndices), [[11], [36], [40]]);
  for (const values of Object.values(details.siteTriangleLayers)) {
    assert.equal(values.length % 9, 0);
    assert.ok(values.every(Number.isFinite));
    const ys = values.filter((_, i) => i % 3 === 1);
    assert.ok(Math.min(...ys) >= building.baseY);
    assert.ok(Math.max(...ys) < building.baseY + 1.4, 'bicycles and racks are ground fixtures');
  }
  assert.ok(Object.values(details.siteSegmentLayers).flat().every(segment => segment.length === 2 &&
    segment.every(point => point.length === 3 && point.every(Number.isFinite))));
  assert.equal(feature('57-courtyard-workshop-screen').horizontalWindowCount, 1);
});

test('White fixtures and its facade palette cannot appear on another dorm', () => {
  for (const other of lod2.buildings.filter(building => building.number !== '57')) {
    const result = createExteriorDetails(other);
    assert.ok(result.features.every(feature => !feature.id.startsWith('57-')));
    assert.ok((result.signs || []).every(sign => !sign.id.startsWith('57-')));
    assert.notDeepEqual(result.materialOverrides, details.materialOverrides);
  }
});
