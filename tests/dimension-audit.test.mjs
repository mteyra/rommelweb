import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { difference } from 'polyclip-ts';

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const area = ring => Math.abs(ring.slice(1).reduce((sum, p, i) =>
  sum + ring[i][0] * p[1] - p[0] * ring[i][1], 0)) / 2;
const distance = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};

test('published dimension evidence matches the current model and its living-zone witnesses really fit', async () => {
  const [reportBytes, studyBytes, baselineBytes, sourceBytes, provenanceBytes] = await Promise.all([
    read('docs/data/house55-dimension-audit.json'), read('public/data/interior-studies.json'),
    read('data/source/house55-2og-stair-ratio-baseline.json'), read('public/data/lod2.json'),
    read('data/source/house55-2og-study-provenance.json'),
  ]);
  const report = JSON.parse(reportBytes);
  assert.equal(report.input.sha256, digest(studyBytes), 'regenerate the dated evidence after study changes');
  assert.equal(report.baseline.sha256, digest(baselineBytes));
  assert.equal(report.sourceSHA256, digest(sourceBytes));
  assert.equal(report.provenanceSHA256, digest(provenanceBytes));
  const plan = JSON.parse(studyBytes).buildings['55'].levels.find(level => level.index === 2);
  const {right, down} = report.studyAxes;
  assert.ok(Math.abs(Math.hypot(...right) - 1) < 1e-12);
  assert.ok(Math.abs(Math.hypot(...down) - 1) < 1e-12);
  assert.ok(Math.abs(right[0] * down[0] + right[1] * down[1]) < 1e-12);
  const local = p => [p[0] * right[0] + p[1] * right[1], p[0] * down[0] + p[1] * down[1]];
  let witnessed = 0;
  for (const item of report.rooms) {
    const space = plan.spaces.find(space => space.shortLabel === item.label);
    assert.ok(space);
    if (!item.packingWitness) {
      assert.ok(['R1', 'R2', 'R3'].includes(item.label));
      assert.equal(item.impossibleAtAnyRotationByBoundingWidth, true);
      assert.ok(Math.min(...item.insetBoundingSpans) < 2.7);
      continue;
    }
    witnessed++;
    const witness = item.packingWitness;
    const edges = witness.slice(1).map((p, i) => Math.hypot(p[0] - witness[i][0], p[1] - witness[i][1])).sort();
    assert.ok(Math.abs(edges[0] - 2.7) < 1e-8 && Math.abs(edges[3] - 3.3) < 1e-8);
    assert.ok(Math.abs(area(witness) - 8.91) < 1e-8);
    const rings = [space.polygon, ...(space.holes || [])].map(ring => ring.map(local));
    const outside = difference([witness], rings).reduce((sum, polygon) =>
      sum + area(polygon[0]) - polygon.slice(1).reduce((holes, ring) => holes + area(ring), 0), 0);
    assert.ok(outside < 1e-8, `${item.label}: the entire reference rectangle must fit`);
    for (const point of witness) {
      const closest = Math.min(...rings.flatMap(ring => ring.slice(1).map((b, i) => distance(point, ring[i], b))));
      assert.ok(closest >= report.packing.insetAssumption - 1e-6, `${item.label}: retain the declared hypothetical inset`);
    }
  }
  assert.equal(witnessed, 17);
  assert.deepEqual(report.packing.unresolved, ['R1', 'R2', 'R3']);
  assert.equal(report.windows.count, 24);
  assert.equal(report.windows.roomWindowCount, 20);
  assert.equal(report.windows.sharedUnassignedWindowCount, 4);
  assert.equal(report.wallFaceHypothesis.assumedOffset, 0.20);
  assert.ok(report.wallFaceHypothesis.remainingNecessaryExtensionBeyondCandidate > 0.40, 'the trial offset must not be reported as solving R');
  assert.ok(report.wallFaceHypothesis.westW4PastAssumedInnerFace > 0.24, 'the historical 0.20m band was short of the accepted W4 overlap');
  assert.equal(report.topology.nonLRoomPolygonsUnchanged, true);
  assert.equal(report.topology.retainedRPolygonsUnchanged, true);
  assert.equal(report.topology.nonLRRoomPolygonsUnchanged, true);
  assert.ok(report.topology.allSpaceOverlapArea < 1e-6, 'room, stair and hall polygons must share exact serialized edges');
});

test('the alignment evidence measures equal W4/L1 overlap and the clarified quarter/three-quarter staircase', async () => {
  const [report, data, lod] = await Promise.all([
    read('docs/data/house55-dimension-audit.json').then(JSON.parse),
    read('public/data/interior-studies.json').then(JSON.parse),
    read('public/data/lod2.json').then(JSON.parse),
  ]);
  const alignment = report.stairAlignment;
  assert.ok(alignment, 'regenerate the independent alignment audit');
  assert.deepEqual(alignment.confirmedRatios, {l3Side: 0.25, r1Side: 0.75});
  assert.ok(Math.abs(alignment.overlap.equalityResidual) < 1e-5);
  assert.ok(alignment.overlap.w4PerpendicularOffset > 0.44 && alignment.overlap.w4PerpendicularOffset < 0.46);
  const plan = data.buildings['55'].levels.find(level => level.index === 2);
  const stairs = plan.spaces.find(space => space.kind === 'stairs');
  const source = lod.buildings.find(building => building.number === '55').surfaces[39].points;
  const origin = [source[3][0], source[3][2]];
  const delta = [source[4][0] - origin[0], source[4][2] - origin[1]];
  const length = Math.hypot(...delta), axis = delta.map(value => value / length);
  // The coordinate-system orientation is checked from the room side rather
  // than inferred from screenshot-left/right or copied from the report.
  let towardR = [axis[1], -axis[0]];
  const rRoom = plan.spaces.find(space => space.shortLabel === 'R1');
  const signed = (point, normal) => point.reduce((sum, value, i) => sum + (value - origin[i]) * normal[i], 0);
  if (signed(rRoom.polygon[0], towardR) < 0) towardR = towardR.map(value => -value);
  const bounds = stairs.stairFlight.map(point => signed(point, towardR));
  const low = Math.min(...bounds), high = Math.max(...bounds);
  assert.ok(low < 0 && high > 0, 'the unchanged source-edge extension crosses the flight');
  assert.ok(Math.abs(-low / (high - low) - 0.25) < 1e-5, 'one quarter lies toward L3');
  assert.ok(Math.abs(high / (high - low) - 0.75) < 1e-5, 'three quarters lies toward R1');
  assert.equal(alignment.crossSections.length, 5);
  for (const section of alignment.crossSections) {
    assert.ok(Math.abs(section.lSideRatio - 0.25) < 1e-5);
    assert.ok(Math.abs(section.rSideRatio - 0.75) < 1e-5);
  }
  assert.ok(alignment.widthVariationAcrossFlight < 1e-5, 'parallel stair sides retain the ratio throughout the flight');
});
