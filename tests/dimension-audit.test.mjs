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
  assert.equal(report.currentStage, 'rAlignment');
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
    assert.ok(item.packingWitness, `${item.label}: aligned current envelopes must retain the audited witness`);
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
  assert.equal(witnessed, 20);
  assert.deepEqual(report.packing.unresolved, []);
  assert.equal(report.windows.count, 24);
  assert.equal(report.windows.roomWindowCount, 20);
  assert.equal(report.windows.sharedUnassignedWindowCount, 4);
  assert.equal(report.wallFaceHypothesis.assumedOffset, 0.20);
  assert.equal(report.wallFaceHypothesis.supersededByRAlignment, true);
  assert.ok(report.wallFaceHypothesis.remainingNecessaryExtensionBeyondCandidate > 0.40,
    'retain the historical trial result, explicitly superseded by current R alignment');
  assert.ok(report.wallFaceHypothesis.westW4PastAssumedInnerFace > 0.24, 'the historical 0.20m band was short of the accepted W4 overlap');
  assert.equal(report.shapeSimilarity.commonDepthVerification.supersededByAreaStudy, true,
    'the area study must not validate new depths against the former fitted depth');
  assert.equal(report.areaStudy.parameters.targetInternalAreaSquareMetres, 16.4);
  assert.equal(report.rAlignment.rooms.length, 3);
  assert.ok(report.rAlignment.rooms.every(room => room.internalArea < room.targetArea),
    'the living-zone witness does not settle the full conditional apartment area');
  assert.equal(report.topology.nonLRoomPolygonsUnchanged, false);
  assert.equal(report.topology.retainedRPolygonsUnchanged, false);
  assert.equal(report.topology.nonLRRoomPolygonsUnchanged, false);
  assert.ok(report.topology.allSpaceOverlapArea < 1e-6, 'room, stair and hall polygons must share exact serialized edges');
  assert.equal(report.topology.unassigned.length, 1);
  assert.equal(report.topology.unassigned[0].doorwayCount, 0);
  assert.deepEqual(report.topology.unassigned[0].declaredConnections, []);
  assert.equal(report.topology.unassigned[0].assumedPassage, false);
  assert.ok(Math.abs(report.topology.areaConservationResidual) < 0.001);
});

test('area evidence is current and exposes the R shortfall instead of forcing a fit', async () => {
  const [auditBytes, studyBytes, provenanceBytes] = await Promise.all([
    read('docs/data/house55-area-audit.json'), read('public/data/interior-studies.json'),
    read('data/source/house55-2og-study-provenance.json'),
  ]);
  const audit = JSON.parse(auditBytes);
  assert.equal(audit.studySHA256, digest(studyBytes));
  assert.equal(audit.provenanceSHA256, digest(provenanceBytes));
  assert.equal(audit.currentStage, 'rAlignment');
  assert.equal(audit.rooms.length, 20);
  assert.equal(audit.rooms.filter(room => room.targetMet).length, 17);
  assert.deepEqual(audit.rooms.filter(room => !room.targetMet).map(room => room.room), ['R1', 'R2', 'R3']);
  for (const room of audit.rooms) {
    assert.ok(room.removedPerimeterAllocation > 0);
    assert.ok(Math.abs(room.grossArea - room.conditionalInternalArea - room.removedPerimeterAllocation) < 1e-6);
    assert.equal(room.recordStage, room.bank === 'R' ? 'rAlignment' : 'areaStudy');
    if (room.bank === 'R') {
      assert.ok(room.conditionalInternalArea > 16.06 && room.conditionalInternalArea < 16.09);
      assert.ok(room.shortfall > .31 && room.shortfall < .34);
    }
  }
  assert.ok(audit.rConnector.conditionalClearGap >= 1.2 - 1e-5);
  assert.ok(audit.rConnector.extraDepthToForceTarget > .11 && audit.rConnector.extraDepthToForceTarget < .13);
  assert.ok(audit.rConnector.conditionalClearGapIfTargetForced > 1.07
    && audit.rConnector.conditionalClearGapIfTargetForced < 1.10);
  assert.ok(audit.rConnector.conditionalClearGapIfTargetForced < audit.parameters.minimumConnectorClearStudyGuardMetres);
  assert.equal(audit.rAlignment.unchangedNonRRoomCount, 17);
  assert.ok(Math.abs(audit.rAlignment.recessEndpointPlaneResiduals.left) < 1e-8);
  assert.ok(Math.abs(audit.rAlignment.recessEndpointPlaneResiduals.right) < 1e-8);
  assert.ok(audit.rAlignment.unchangedSourceFacadeLength < 8.09);
  assert.ok(audit.rAlignment.alignedEstimatedBankFacadeLength > 8.97);
  assert.ok(audit.areaBudget.hallRemainderAfter < audit.areaBudget.hallRemainderBefore);
  assert.ok(audit.areaBudget.unassignedServiceArea > 2.92 && audit.areaBudget.unassignedServiceArea < 2.93);
  assert.equal(audit.unassigned.spaceCount, 1);
  assert.equal(audit.unassigned.doorwayCount, 0);
  assert.equal(audit.unassigned.assumedPassage, false);
  assert.ok(audit.areaBudget.allSpaceOverlap < 1e-6);
  assert.ok(Math.abs(audit.areaBudget.areaConservationResidual) < 0.001);
});

test('alignment evidence separates the quarter-split enclosure from the inset schematic flight', async () => {
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
  const bounds = stairs.polygon.map(point => signed(point, towardR));
  const low = Math.min(...bounds), high = Math.max(...bounds);
  assert.ok(low < 0 && high > 0, 'the unchanged source-edge extension crosses the enclosure');
  assert.ok(Math.abs(-low / (high - low) - 0.25) < 1e-5, 'the gross enclosure keeps one quarter toward L3');
  assert.ok(Math.abs(high / (high - low) - 0.75) < 1e-5, 'the gross enclosure keeps three quarters toward R1');
  const flightBounds = stairs.stairFlight.map(point => signed(point, towardR));
  const flightLow = Math.min(...flightBounds), flightHigh = Math.max(...flightBounds);
  assert.ok(Math.abs(flightLow - low - .1) < 1e-5, 'the L3-side flight inset is explicit');
  assert.ok(Math.abs(high - flightHigh - .1) < 1e-5, 'the R1-side flight inset is explicit');
  const flightLShare = -flightLow / (flightHigh - flightLow);
  const flightRShare = flightHigh / (flightHigh - flightLow);
  assert.ok(flightLow < 0 && flightHigh > 0, 'the unchanged source-edge extension crosses the flight');
  assert.ok(flightLShare > .20 && flightLShare < .25, 'the schematic flight uses the requested L3-side range');
  assert.ok(Math.abs(flightLShare - alignment.schematicFlight.l3ShareAtCenter) < 1e-5);
  assert.ok(Math.abs(flightRShare - alignment.schematicFlight.r1ShareAtCenter) < 1e-5);
  assert.equal(alignment.crossSections.length, 5);
  for (const section of alignment.crossSections) {
    assert.ok(Math.abs(section.lSideRatio - 0.25) < 1e-5);
    assert.ok(Math.abs(section.rSideRatio - 0.75) < 1e-5);
  }
  assert.equal(alignment.schematicFlight.crossSections.length, 5);
  for (const section of alignment.schematicFlight.crossSections) {
    assert.ok(Math.abs(section.lSideRatio - flightLShare) < 1e-5);
    assert.ok(Math.abs(section.rSideRatio - flightRShare) < 1e-5);
  }
  assert.ok(alignment.schematicFlight.widthVariation < 1e-5);
  assert.ok(alignment.widthVariationAcrossFlight < 1e-5, 'parallel stair sides retain the ratio throughout the flight');
});
