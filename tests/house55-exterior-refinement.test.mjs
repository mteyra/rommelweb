import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createExteriorDetails} from '../src/exterior-details.js';
import {presentExteriorSurface} from '../src/exterior-presentation.js';
import {surfaceFrame} from '../src/facade.js';
import {getOldFacadeRowGuides} from '../src/windows.js';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const [lod2, studies, interiors, top, first, ground, otherHouses] = await Promise.all([
  read('public/data/lod2.json'), read('public/data/interior-studies.json'), read('public/data/interiors.json'),
  read('public/data/house55-module-layout.json'), read('public/data/house55-first-floor-layout.json'),
  read('public/data/house55-ground-floor-layout.json'), read('public/data/old-house-module-layouts.json'),
]);
const records = {lod2, studies, interiors, top, first, ground, otherHouses};
const snapshot = structuredClone(records);
const building = lod2.buildings.find(item => item.number === '55');
const options = {levels: 3, absoluteFloorElevations: getOldFacadeRowGuides(building, 3, interiors).elevations};
const details = createExteriorDetails(building, options);
const feature = id => details.features.find(item => item.id === id);
const masks = index => details.exclusionsBySurface.get(building.surfaces[index]) || [];
const close = (actual, expected, message = '') =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} differs from ${expected}`);
const midpoint = (a, b) => a.map((value, i) => (value + b[i]) / 2);
const inside = (point, ring) => {
  let result = false;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i];
    if ((a[1] > point[1]) !== (b[1] > point[1])
      && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
};
const visibleAt = (point, presentation, frame) => presentation.polygons.some(rings =>
  inside(frame.project(point), rings[0].map(frame.project))
  && !rings.slice(1).some(ring => inside(frame.project(point), ring.map(frame.project))));

test('the courtyard refinement leaves the source envelope and every accepted interior record untouched', () => {
  assert.deepEqual(createExteriorDetails(building, options), details, 'Exterior construction is deterministic');
  assert.deepEqual(records, snapshot, 'No exterior feature edits a source or interior record');
  assert.equal(studies.buildings['55'].levels.find(level => level.index === 2).windows.length, 24,
    'The historical inventory remains intact even when the folded photo display is refined');
  assert.deepEqual(studies.buildings['55'].levels.map(level => level.index), [0, 1, 2]);
  assert.equal(feature('55-courtyard-dormer').sourceSurfaceIndices[0], 3);
  assert.deepEqual(feature('55-courtyard-entry-glazing').sourceSurfaceIndices, [4]);
  assert.deepEqual(feature('55-courtyard-glazing-return').sourceSurfaceIndices, [45]);
  assert.deepEqual(feature('55-recessed-entrance').sourceSurfaceIndices.slice().sort((a, b) => a - b), [15, 18, 26, 45]);
});

test('three separate ground glazing groups retain opaque piers on the existing courtyard face', () => {
  const surface = building.surfaces[4], frame = surfaceFrame(surface);
  const openings = masks(4);
  assert.equal(openings.length, 3, 'The photograph shows three glazing groups, separated by cladding');
  const spans = openings.map(ring => {
    const points = ring.map(frame.project);
    return {
      left: Math.min(...points.map(point => point[0])), right: Math.max(...points.map(point => point[0])),
      bottom: Math.min(...points.map(point => point[1])), top: Math.max(...points.map(point => point[1])),
    };
  }).sort((a, b) => a.left - b.left);
  const presentation = presentExteriorSurface(surface, openings);
  for (const span of spans) {
    assert.ok(span.right > span.left && span.top > span.bottom);
    assert.ok(!visibleAt(frame.lift([(span.left + span.right) / 2, (span.bottom + span.top) / 2]), presentation, frame),
      'Glazing replaces the display wall within each opening');
  }
  for (let i = 1; i < spans.length; i++) {
    assert.ok(spans[i].left > spans[i - 1].right + 0.1, 'The gap is an opaque pier, not a thin window mullion');
    const point = frame.lift([(spans[i - 1].right + spans[i].left) / 2,
      (Math.max(spans[i - 1].bottom, spans[i].bottom) + Math.min(spans[i - 1].top, spans[i].top)) / 2]);
    assert.ok(visibleAt(point, presentation, frame), 'The original wall remains visible through the full pier');
  }
  assert.equal(masks(45).length, 1, 'The return glazing is a separate opening around the corner');
  for (const ring of [...openings, ...masks(45)]) {
    assert.ok(Math.max(...ring.map(point => point[1])) < 6, 'Shared glazing stays below the existing low roof');
  }
});

test('one recessed entrance sits beneath the original canopy and carries the photographed address', () => {
  const entrance = feature('55-recessed-entrance');
  assert.equal(entrance.doorCount, 1);
  assert.ok(entrance.doorWidth < entrance.width, 'The one door sits within the larger entrance recess');
  assert.ok(entrance.doorHeight > 0 && entrance.depth > 0);
  assert.equal(masks(15).length, 1, 'The entry cuts only one source-wall opening');
  assert.equal(masks(18).length, 0, 'Metal trim retains the original canopy plane');
  assert.ok(Math.max(...masks(15)[0].map(point => point[1]))
    < Math.min(...building.surfaces[18].points.map(point => point[1])), 'The entrance head remains below the canopy');
  assert.equal(details.signs.length, 1);
  const sign = details.signs[0];
  assert.deepEqual(sign.lines, ['Erwin-Rommel-Straße', '55']);
  assert.equal(sign.corners.length, 4);
  assert.ok(sign.corners.every(point => point.length === 3 && point.every(Number.isFinite)));
  close(Math.hypot(...sign.corners[0].map((value, i) => value - sign.corners[1][i])), sign.width, 'Sign width');
  close(Math.hypot(...sign.corners[0].map((value, i) => value - sign.corners[3][i])), sign.height, 'Sign height');
});

test('the courtyard opening is upright, local to roof3 and below its existing ridge', () => {
  const dormer = feature('55-courtyard-dormer'), front = dormer.frontGlazing;
  assert.equal(dormer.kind, 'upright-roof-dormer');
  assert.equal(dormer.divisions, 3);
  assert.equal(masks(3).length, 1);
  assert.equal(front.length, 5);
  assert.deepEqual(front[0], front.at(-1));
  for (const [bottom, top] of [[front[0], front[3]], [front[1], front[2]]]) {
    close(bottom[0], top[0], 'Upright glazing X');
    close(bottom[2], top[2], 'Upright glazing Z');
    assert.ok(top[1] > bottom[1]);
  }
  const slopeHeights = masks(3)[0].map(point => point[1]);
  assert.ok(Math.max(...slopeHeights) - Math.min(...slopeHeights) > 0.5, 'Its feet intersect the existing sloping roof');
  assert.ok(dormer.capY < Math.max(...building.surfaces[3].points.map(point => point[1])),
    'The small dormer does not raise the existing roof ridge');
  assert.ok(front.every(point => point.every(Number.isFinite)));
  assert.ok(front.every(point => point[1] < dormer.capY));
  assert.ok(midpoint(front[0], front[1])[1] < midpoint(front[2], front[3])[1]);
  assert.equal(masks(33).length, 1, 'The distinct opposite-slope opening remains independently registered');
});

test('Red features stay local while separately photographed houses retain their own identities', () => {
  const redIds = new Set([
    '55-courtyard-entry-glazing', '55-courtyard-glazing-return', '55-recessed-entrance',
    '55-courtyard-rainwater', '55-courtyard-dormer',
  ]);
  for (const id of redIds) assert.ok(feature(id), `${id} is present`);
  for (const other of lod2.buildings.filter(item => item.number !== '55')) {
    const result = createExteriorDetails(other);
    assert.ok(result.features.every(item => !redIds.has(item.id)));
    if (['51', '53', '57'].includes(other.number)) {
      assert.ok(result.signs.length > 0, 'Newly photographed entrances carry their own signs');
      assert.ok(result.signs.every(sign => sign.lines.at(-1) === other.number), 'Never copy the Red address');
    } else if (other.number === '57a') {
      // The later Turquoise photo pass has its own single-line address and bike
      // wordmark. Its geometry is covered by turquoise-photo-details.test.mjs;
      // this historical Red test continues to check ownership and locality.
      assert.ok(result.signs.every(sign => sign.id.startsWith('57a-')), 'Turquoise signs keep their own identity');
      assert.ok(result.signs.some(sign => sign.id === '57a-entrance-address' && /57a$/.test(sign.lines[0])),
        'Turquoise carries its photographed address, never the Red address');
    } else if (other.number === '59a') {
      assert.ok(result.signs.every(sign => sign.id.startsWith('59a-')), 'Pink signs keep their own identity');
      assert.ok(result.signs.some(sign => sign.id === '59a-address' && /59a$/.test(sign.lines[0])),
        'Pink carries its own photographed entrance address');
      assert.ok(result.signs.some(sign => sign.id === '59a-pink-wordmark' && sign.lines[0] === 'pink'),
        'Pink lettering belongs to the bicycle frontage');
    } else if (other.number === '51a') {
      assert.ok(result.signs.every(sign => sign.id.startsWith('51a-')), 'Blue signs keep their own identity');
      assert.ok(result.signs.some(sign => sign.id === '51a-entrance-address' && /51a$/.test(sign.lines[0])),
        'Blue carries its own photographed entrance address');
      assert.ok(result.signs.some(sign => sign.id === '51a-entrance-blau' && sign.lines[0] === 'blau'),
        'Blue lettering belongs to the residential entrance sidelight');
    } else if (other.number === '49') {
      assert.ok(result.signs.every(sign => sign.id.startsWith('49-')), 'Black signage keeps its own identity');
      assert.ok(result.signs.some(sign => sign.id === '49-address' && / 49$/.test(sign.lines[0])),
        'The photographed Black entrance carries its own address');
      assert.ok(result.signs.some(sign => sign.id === '49-schwarz-wordmark' && sign.lines[0] === 'schwarz'));
    } else if (other.number === '55a') {
      assert.ok(result.signs.every(sign => sign.id.startsWith('55a-')), 'Grau signs keep their own identity');
      assert.ok(result.signs.some(sign => sign.id === '55a-entrance-address' && /55a$/.test(sign.lines[0])),
        'Grau carries its photographed entrance address');
      assert.ok(result.signs.some(sign => sign.id === '55a-grau-bicycle-wordmark' && sign.lines[0] === 'grau'),
        'Grau lettering belongs to the bicycle cage beside the entrance');
    } else if (other.number === '53a') {
      assert.ok(result.signs.every(sign => sign.id.startsWith('53a-')), 'Lila signs keep their own identity');
      assert.ok(result.signs.some(sign => sign.id === '53a-entrance-address' && /53a$/.test(sign.lines[0])),
        'Lila carries its photographed entrance address, never the Red address');
      assert.ok(result.signs.some(sign => sign.id === '53a-bike-wordmark' && sign.lines[0] === 'l i l a'),
        'Lila lettering belongs to its bicycle gate');
    } else {
      assert.deepEqual(result.signs || [], [], 'Unphotographed entrances do not gain invented signs');
      assert.equal(result.triangleLayers.detailCladding?.length || 0, 0, 'Unphotographed houses retain their previous cladding');
    }
  }
});
