import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {difference, intersection, union} from 'polyclip-ts';
import {applyHouse55AreaStudy} from '../scripts/house55-area-study.mjs';
import {refreshHouse55LowerLevels} from '../scripts/extrapolate-house55-levels.mjs';
import {validateInteriorStudies} from '../src/interior-studies.js';
import {asMulti, polygonArea, local, onBoundary} from '../scripts/house55-window-wall-study.mjs';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const [baseline, published, campus, lod2] = await Promise.all([
  read('data/source/house55-2og-area-baseline.json'), read('public/data/interior-studies.json'),
  read('public/data/campus.json'), read('public/data/lod2.json'),
]);
const building = lod2.buildings.find(b => b.number === '55');
const original = structuredClone(baseline.level), before = JSON.stringify(original), buildingBefore = JSON.stringify(building);
const result = await applyHouse55AreaStudy(original, building);
const {level, metadata} = result;
const totalArea = polygons => polygons.reduce((sum, p) => sum + polygonArea(p), 0);
const shapeDelta = (a, b) => totalArea(difference(asMulti(a), asMulti(b))) + totalArea(difference(asMulti(b), asMulti(a)));

test('conditional area fit retains the observed shell, counts, windows, staircase geometry and valid door graph on all three study floors', () => {
  assert.equal(JSON.stringify(original), before);
  assert.equal(JSON.stringify(building), buildingBefore);
  assert.deepEqual(level.floorOutline, original.floorOutline);
  assert.deepEqual(level.windows, original.windows);
  assert.equal(level.spaces.filter(s => s.kind === 'room').length, 20);
  assert.equal(level.doors.length, 21);
  const rBlock = union(...level.spaces.filter(s => /^R[123]$/.test(s.shortLabel)).map(asMulti));
  assert.equal(rBlock.length, 1);
  assert.equal(rBlock[0].length, 1);
  assert.equal(rBlock[0][0].length, 5, 'the R source facade stays one flush quadrilateral without a padding spur');
  const oldStairs = original.spaces.find(s => s.kind === 'stairs'), stairs = level.spaces.find(s => s.kind === 'stairs');
  assert.ok(shapeDelta(stairs, oldStairs) < 0.00001, 'noding cannot move the ratio-constrained stair enclosure');
  assert.deepEqual(stairs.stairFlight, oldStairs.stairFlight);
  assert.deepEqual(level.doors.find(d => d.spaceId === stairs.id).segment,
    original.doors.find(d => d.spaceId === oldStairs.id).segment, 'the west stair entrance is not displaced by room deepening');
  for (const door of level.doors) {
    const room = level.spaces.find(s => s.id === door.spaceId), hall = level.spaces.find(s => s.id === door.toSpaceId);
    assert.equal(hall.kind, 'corridor');
    assert.ok(onBoundary(door.segment, room) && onBoundary(door.segment, hall));
  }
  const lower = published.buildings['55'].levels.filter(l => l.index < 2);
  const repeated = refreshHouse55LowerLevels(lower, level, building).levels;
  assert.equal(validateInteriorStudies({
    schemaVersion: 1, buildings: {'55': {...published.buildings['55'], levels: [...repeated, level]}},
  }, campus, lod2), true, 'the serialized geometry passes the production validator, including repeated floors');
  const floor = level.floorOutline.map(p => [p.outer, ...(p.holes || [])]);
  for (let i = 0; i < level.spaces.length; i++) {
    const a = level.spaces[i];
    assert.ok(totalArea(difference(asMulti(a), floor)) < 0.00001);
    for (const b of level.spaces.slice(i + 1)) assert.ok(totalArea(intersection(asMulti(a), asMulti(b))) < 0.000001);
  }
});

test('area evidence separates gross envelopes from conditional internal areas and exposes the R failure instead of forcing twenty successes', () => {
  assert.match(metadata.parameters.targetInterpretation, /Conditional.*not proof/);
  assert.match(metadata.parameters.internalPartitions, /not deducted/);
  assert.equal(metadata.rooms.length, 20);
  for (const record of metadata.rooms) {
    assert.ok(record.grossArea > record.internalArea);
    assert.ok(Math.abs(polygonArea([record.internalPolygon]) - record.internalArea) < 0.00001);
    assert.ok(Math.abs(record.residual - (record.internalArea - record.targetArea)) < 1e-10);
    const room = level.spaces.find(s => s.shortLabel === record.label);
    assert.ok(totalArea(difference([record.internalPolygon], asMulti(room))) < 0.00001);
    if (record.bank === 'R') {
      assert.equal(record.targetMet, false);
      assert.ok(record.internalArea > 14.70 && record.internalArea < 14.77);
      assert.ok(record.residual < -1.60);
      assert.match(record.feasibility, /capped.*unmet/);
    } else {
      assert.equal(record.targetMet, true);
      assert.ok(Math.abs(record.residual) < 0.01);
    }
  }
  assert.ok(Math.abs(metadata.rConnector.assumedClearGap - 1.2) < 1e-8);
  assert.ok(metadata.rConnector.unconstrainedAssumedClearGap > 0.5
    && metadata.rConnector.unconstrainedAssumedClearGap < 0.6);
  assert.equal(metadata.rConnector.targetForced, false);
  assert.match(metadata.parameters.guardInterpretation, /not a legal/);
});

test('small shared-divider changes keep straight hall fronts and fixed L alignment while marking end walls as hypotheses', () => {
  for (const bank of metadata.banks) {
    assert.ok(bank.dividerShifts.every(v => Math.abs(v) < 0.16));
    if (['L', 'R'].includes(bank.bank)) assert.ok(bank.dividerShifts.every(v => v === 0));
    for (const label of bank.roomLabels) {
      const room = level.spaces.find(s => s.shortLabel === label);
      const door = level.doors.find(d => d.spaceId === room.id);
      for (const point of door.segment.map(local)) {
        const projected = point[0] * bank.corridorPlane.normal[0] + point[1] * bank.corridorPlane.normal[1];
        assert.ok(Math.abs(projected - bank.corridorPlane.constant) < 0.000002, `${label}: straight bank front`);
      }
    }
  }
  const l3 = level.spaces.find(s => s.shortLabel === 'L3');
  const entry = level.doors.find(d => d.spaceId === level.spaces.find(s => s.kind === 'stairs').id);
  assert.ok(Math.min(...entry.segment.map(p => local(p)[1]))
    - Math.max(...l3.polygon.map(p => local(p)[1])) > 0.33, 'L3 does not cover the west stair entrance');
  const bands = level.wallBands.filter(b => b.id.includes('area-end'));
  assert.equal(bands.length, 4);
  assert.ok(bands.every(b => b.confidence === 'estimated' && /hypothesis/.test(b.note)));
});

test('the area study refuses a changed unreviewed baseline', async () => {
  const changed = structuredClone(original);
  changed.spaces[0].polygon[0][0] += 0.01;
  await assert.rejects(applyHouse55AreaStudy(changed, building), /frozen resident-aligned baseline/);
});
