import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {intersection} from 'polyclip-ts';
import {applyStage} from '../scripts/house55-r-alignment.mjs';
import {validateInteriorStudies} from '../src/interior-studies.js';
import {local, asMulti, polygonArea, onBoundary} from '../scripts/house55-window-wall-study.mjs';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const [baseline, published, campus, lod2] = await Promise.all([
  read('data/source/house55-2og-r-alignment-baseline.json'),
  read('public/data/interior-studies.json'), read('public/data/campus.json'), read('public/data/lod2.json'),
]);
const building = lod2.buildings.find(b => b.number === '55'), original = structuredClone(baseline.level);
const snapshot = JSON.stringify({level: original, building});
const {level, metadata} = await applyStage(original, building);
const sumArea = polygons => polygons.reduce((sum, p) => sum + polygonArea(p), 0);
const source = building.surfaces[39].points.map(([x, , z]) => local([x, z]));
const lineDistance = (p, a, b) => Math.abs((b[0] - a[0]) * (p[1] - a[1])
  - (b[1] - a[1]) * (p[0] - a[0])) / Math.hypot(b[0] - a[0], b[1] - a[1]);

test('R interpretation preserves source data, observed windows and all seventeen other rooms while retaining valid source-contained geometry', () => {
  assert.equal(JSON.stringify({level: original, building}), snapshot);
  assert.deepEqual(level.floorOutline, original.floorOutline);
  assert.deepEqual(level.windows, original.windows);
  assert.deepEqual(level.wallBands, original.wallBands);
  assert.equal(level.spaces.length, 24);
  assert.equal(level.spaces.filter(s => s.kind === 'room').length, 20);
  assert.equal(level.doors.length, 21);
  for (const room of original.spaces.filter(s => s.kind === 'room' && !/^R[123]$/.test(s.shortLabel))) {
    assert.deepEqual(level.spaces.find(s => s.id === room.id), room);
  }
  const floor = level.floorOutline.map(p => [p.outer, ...(p.holes || [])]);
  for (let i = 0; i < level.spaces.length; i++) {
    const a = level.spaces[i];
    assert.ok(polygonArea(asMulti(a)) - sumArea(intersection(asMulti(a), floor)) < 0.00001);
    for (const b of level.spaces.slice(i + 1)) assert.ok(sumArea(intersection(asMulti(a), asMulti(b))) < 0.000001);
  }
  assert.equal(validateInteriorStudies({schemaVersion: 1, buildings: {'55': {
    ...published.buildings['55'], levels: [level],
  }}}, campus, lod2), true);
  for (const door of level.doors) {
    const from = level.spaces.find(s => s.id === door.spaceId), to = level.spaces.find(s => s.id === door.toSpaceId);
    assert.equal(to.kind, 'corridor');
    assert.ok(onBoundary(door.segment, from) && onBoundary(door.segment, to));
  }
});

test('both R side lines extrapolate to the actual opposite recess endpoints and retain explicit conditional area shortfalls', () => {
  for (const [label, sourceIndex, choose] of [['R1', 16, 0], ['R3', 15, -1]]) {
    const room = level.spaces.find(s => s.shortLabel === label), points = room.polygon.map(local);
    const sides = points.slice(1).map((b, i) => [points[i], b])
      .filter(([a, b]) => Math.abs(a[1] - b[1]) > 5)
      .sort((a, b) => (a[0][0] + a[1][0]) - (b[0][0] + b[1][0]));
    const edge = choose === 0 ? sides[0] : sides.at(-1);
    assert.ok(lineDistance(source[sourceIndex], ...edge) < 0.000002, `${label}: side aligns to source endpoint, not a guessed visual offset`);
  }
  for (const record of metadata.rooms) {
    assert.ok(record.internalArea > 16.06 && record.internalArea < 16.09);
    assert.ok(Math.abs(record.internalArea - polygonArea([record.internalPolygon])) < 0.00001);
    assert.ok(record.residual < -0.31);
    assert.equal(record.targetMet, false);
    const room = level.spaces.find(s => s.shortLabel === record.label);
    assert.ok(record.internalArea - sumArea(intersection([record.internalPolygon], asMulti(room))) < 0.00001);
    const front = Math.min(...room.polygon.map(p => local(p)[1]));
    assert.ok(Math.abs(front - Math.max(source[15][1], source[16][1]) - 0.20 - 0.10 - 1.20) < 0.000002);
  }
  assert.ok(metadata.alignment.northRecessLength > 8.98 && metadata.alignment.northRecessLength < 9.00);
  assert.ok(metadata.alignment.sourceFacadeLength > 8.07 && metadata.alignment.sourceFacadeLength < 8.09);
});

test('the narrower schematic flight satisfies the ratio without moving the enclosure or west entry, and the narrow tail has no assumed passage', () => {
  const old = original.spaces.find(s => s.kind === 'stairs'), stairs = level.spaces.find(s => s.kind === 'stairs');
  const commonArea = sumArea(intersection(asMulti(old), asMulti(stairs)));
  assert.ok(Math.abs(commonArea - polygonArea(asMulti(old))) < 0.00001);
  assert.ok(Math.abs(commonArea - polygonArea(asMulti(stairs))) < 0.00001);
  assert.deepEqual(level.doors.find(d => d.spaceId === stairs.id), original.doors.find(d => d.spaceId === old.id));
  const d = [source[4][0] - source[3][0], source[4][1] - source[3][1]], length = Math.hypot(...d);
  const east = [d[1] / length, -d[0] / length];
  const offset = p => (p[0] - source[3][0]) * east[0] + (p[1] - source[3][1]) * east[1];
  const range = polygon => {
    const values = polygon.map(local).map(offset); return [Math.min(...values), Math.max(...values)];
  };
  const [west, right] = range(stairs.polygon), [fw, fr] = range(stairs.stairFlight);
  assert.ok(Math.abs(-west / (right - west) - 0.25) < 0.000001);
  assert.ok(Math.abs(fw - west - 0.10) < 0.000002 && Math.abs(right - fr - 0.10) < 0.000002);
  assert.ok(-fw / (fr - fw) > 0.218 && -fw / (fr - fw) < 0.219);
  assert.ok(-west / (right - west - 0.10) > 0.25, 'a right-only shrink would contradict the requested ratio');
  const service = level.spaces.find(s => s.id === metadata.unassigned.spaceId);
  assert.equal(service.kind, 'service');
  assert.equal(service.confidence, 'estimated');
  assert.match(service.note, /No room, passage, service use or east stair entrance/);
  assert.ok(metadata.unassigned.area > 2.9 && metadata.unassigned.area < 3);
  assert.equal(level.doors.some(d => d.spaceId === service.id || d.toSpaceId === service.id), false);
  assert.equal(metadata.unassigned.assumedPassage, false);
});

test('R alignment rejects an unreviewed change to the archived stage', async () => {
  const altered = structuredClone(original);
  altered.spaces.find(s => s.shortLabel === 'R1').polygon[0][0] += 0.02;
  await assert.rejects(applyStage(altered, building), /frozen conditional-area baseline/);
});
