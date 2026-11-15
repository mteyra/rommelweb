import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {difference, intersection, union, setPrecision} from 'polyclip-ts';
import {
  local, campus, close, rounded, clean, asMulti, geometry, polygonArea,
  onBoundary, nodeSharedRing,
} from './house55-window-wall-study.mjs';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);
const unit = a => a.map(v => v / Math.hypot(...a));
const sumArea = polygons => polygons.reduce((sum, polygon) => sum + polygonArea(polygon), 0);
const square = close([[-100, -100], [100, -100], [100, 100], [-100, 100]]);
const cut = (ring, {normal, constant}) => {
  const points = ring.slice(0, -1), result = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const da = dot(normal, a) - constant, db = dot(normal, b) - constant;
    if (da >= -1e-10) result.push(a);
    if ((da >= 0) !== (db >= 0)) result.push(add(a, sub(b, a), da / (da - db)));
  }
  return result.length > 2 ? close(result) : [];
};
const clippedBy = planes => planes.reduce((ring, plane) => ring.length ? cut(ring, plane) : [], square);
const xLine = ({normal, constant}) => ({slope: -normal[1] / normal[0], intercept: constant / normal[0]});
const sidePlane = (slope, intercept, sign = 1) => {
  const length = Math.hypot(1, slope);
  return {normal: [sign / length, -slope * sign / length], constant: sign * intercept / length};
};
const prune = ring => {
  const points = ring.slice(0, -1).map(p => [...p]);
  for (let changed = true; changed && points.length > 2;) {
    changed = false;
    for (let i = 0; i < points.length; i++) {
      const previous = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
      if (Math.hypot(...sub(points[i], previous)) < 1e-8 || Math.hypot(...sub(previous, next)) < 1e-8) {
        points.splice(i, 1); changed = true; break;
      }
    }
  }
  const result = close(points);
  if (Math.abs(polygonArea([result]) - polygonArea([ring])) > 0.00001) throw new Error('R alignment serialization removed material area');
  return result;
};

/**
 * Align the estimated R bank's two side lines to the opposite recess ends.
 * The source shell is immutable. This is a resident-requested interpretation,
 * not evidence that its new dividers or an east staircase entrance exist.
 */
export async function applyStage(level, building) {
  const baselinePath = 'data/source/house55-2og-r-alignment-baseline.json';
  const bytes = await readFile(new URL(`../${baselinePath}`, import.meta.url));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const baseline = JSON.parse(bytes);
  if (sha256 !== '8334489d75c63f813fa293a715e335e5ca1d68b0e65c1059f20362ce1548fff2'
    || JSON.stringify(level) !== JSON.stringify(baseline.level)) {
    throw new Error('Review the R-alignment stage against its frozen conditional-area baseline');
  }
  if (building.number !== '55' || level.index !== 2 || level.spaces.length !== 23 || level.doors.length !== 21) {
    throw new Error('R alignment requires the existing House 55 top-floor study and door graph');
  }
  setPrecision(1e-8);
  const output = structuredClone(level), parameters = structuredClone(baseline.areaStudy.parameters);
  const flat = building.surfaces[39].points.map(([x, , z]) => [x, z]), source = flat.map(local);
  const plan = intersection([flat], level.floorOutline.map(p => [p.outer, ...(p.holes || [])]));
  const priorRooms = ['R1', 'R2', 'R3'].map(label => level.spaces.find(s => s.shortLabel === label));
  const priorRecords = baseline.areaStudy.rRooms;
  const priorLeft = priorRecords[0].edgeOffsets.find(edge => edge.kind === 'bank-end');
  const priorRight = priorRecords[2].edgeOffsets.find(edge => edge.kind === 'bank-end');
  const facade = priorRecords[0].edgeOffsets.find(edge => edge.kind === 'external-facade');
  const hall = priorRecords[0].edgeOffsets.find(edge => edge.kind === 'hall-allocation');
  if (!priorLeft || !priorRight || !facade || !hall) throw new Error('The archived R perimeter allowances are incomplete');
  const left = {...priorLeft, constant: dot(priorLeft.normal, source[16])};
  const right = {...priorRight, constant: dot(priorRight.normal, source[15])};
  const leftLine = xLine(left), rightLine = xLine(right);
  const frontY = Math.max(source[15][1], source[16][1]) + parameters.recessBandMetres
    + parameters.minimumConnectorClearStudyGuardMetres + parameters.allocationBoundaryHalfWallMetres;
  if (Math.abs(hall.constant - frontY) > 1e-8) throw new Error('The existing R connector guard changed');
  const dividers = Array.from({length: 4}, (_, i) => ({
    slope: leftLine.slope + (rightLine.slope - leftLine.slope) * i / 3,
    intercept: leftLine.intercept + (rightLine.intercept - leftLine.intercept) * i / 3,
  }));
  const records = [];
  for (let i = 0; i < 3; i++) {
    const leftSide = sidePlane(dividers[i].slope, dividers[i].intercept);
    const rightSide = sidePlane(dividers[i + 1].slope, dividers[i + 1].intercept, -1);
    const offsets = [
      {...leftSide, kind: i === 0 ? 'bank-end' : 'shared-divider', allowance: parameters.allocationBoundaryHalfWallMetres},
      {...rightSide, kind: i === 2 ? 'bank-end' : 'shared-divider', allowance: parameters.allocationBoundaryHalfWallMetres},
      {...facade}, {...hall},
    ];
    const grossCandidate = [clippedBy(offsets).map(campus)];
    if (sumArea(difference(grossCandidate, plan)) > 0.00001) throw new Error(`${priorRooms[i].shortLabel}: aligned gross envelope leaves the source plate`);
    const gross = clean(intersection(grossCandidate, plan));
    const internalCandidate = [clippedBy(offsets.map(p => ({...p, constant: p.constant + p.allowance}))).map(campus)];
    if (gross.length !== 1 || sumArea(difference(internalCandidate, gross)) > 0.00001) throw new Error('Aligned R internal envelope does not fit its source-clipped room');
    const room = output.spaces.find(s => s.id === priorRooms[i].id);
    delete room.holes;
    Object.assign(room, geometry(gross[0]));
    const internalArea = polygonArea(internalCandidate), targetArea = parameters.targetInternalAreaSquareMetres;
    const grossArea = polygonArea(asMulti(room));
    room.note = `Resident-requested R-bank alignment study: both side lines meet the opposite recess endpoints, retaining source exterior and windows. Approximately ${internalArea.toFixed(2)}m² inside the existing assumed perimeter allowances is ${Math.abs(internalArea - targetArea).toFixed(2)}m² below the conditional 16.4m² benchmark. The 1.20m north connector study guard is retained; the remaining narrow stair-side strip is unassigned, not an assumed passage. Actual apartment and service-partition dimensions remain unknown.`;
    records.push({
      label: room.shortLabel, bank: 'R', grossArea, internalArea, targetArea,
      residual: internalArea - targetArea, targetMet: Math.abs(internalArea - targetArea) < 0.02,
      internalPolygon: rounded(internalCandidate[0]), edgeOffsets: offsets,
      grossDepth: room.polygon.slice(0, -1).map(local).filter(p => Math.abs(p[1] - frontY) < 0.002)
        .reduce((sum, p, _, points) => sum + (dot(facade.normal, p) - facade.constant) / points.length, 0),
      feasibility: 'recess-aligned-bank-retains-connector-guard-area-target-unmet',
    });
  }
  const stairs = output.spaces.find(s => s.kind === 'stairs');
  const referenceOrigin = source[3], along = unit(sub(source[4], source[3])), east = [along[1], -along[0]];
  const across = p => dot(sub(p, referenceOrigin), east);
  const offsets = stairs.polygon.map(local).map(across), west = Math.min(...offsets), eastSide = Math.max(...offsets);
  const grossWidth = eastSide - west, leftDistance = -west;
  const [flightNorth, flightSouth] = [
    Math.min(...stairs.stairFlight.map(local).map(p => p[1])),
    Math.max(...stairs.stairFlight.map(local).map(p => p[1])),
  ];
  const atY = (u, y) => [referenceOrigin[0] + (u - east[1] * (y - referenceOrigin[1])) / east[0], y];
  const sideInset = parameters.allocationBoundaryHalfWallMetres;
  const flightWest = west + sideInset, flightEast = eastSide - sideInset, flightWidth = flightEast - flightWest;
  const flightLeftShare = -flightWest / flightWidth;
  if (!(flightLeftShare >= 0.20 && flightLeftShare <= 0.25)) throw new Error('The schematic flight inset does not satisfy the requested ratio range');
  stairs.stairFlight = rounded(close([
    atY(flightWest, flightNorth), atY(flightEast, flightNorth),
    atY(flightEast, flightSouth), atY(flightWest, flightSouth),
  ].map(campus)));
  stairs.note = `The resident-aligned gross enclosure remains unchanged at about ${grossWidth.toFixed(3)}m and a 25% L3 / 75% R1 split about the fixed exterior-edge extension. The schematic flight now uses an explicit ${sideInset.toFixed(2)}m inset on both sides, giving about ${flightWidth.toFixed(3)}m width and ${(flightLeftShare * 100).toFixed(2)}% L3 / ${((1 - flightLeftShare) * 100).toFixed(2)}% R1. These are conditional display allowances, not measured masonry or clear stair dimensions. Shrinking only the R edge with the west edge fixed would exceed 25% on the L3 side. The west entry remains; east access is unconfirmed.`;
  const occupied = output.spaces.filter(s => s.kind !== 'corridor');
  const originalRemainder = clean(difference(plan, ...occupied.map(asMulti)));
  const initialVertices = occupied.flatMap(s => asMulti(s).flatMap(r => r.slice(0, -1)));
  const remainder = clean(union(...originalRemainder.map(polygon =>
    polygon.map(ring => prune(nodeSharedRing(rounded(ring), initialVertices))))));
  // The narrow side strip and its connected blind end pocket form one
  // unassigned region. Cutting the strip alone would leave a disconnected
  // piece falsely labelled as hallway below the staircase.
  const stripMask = clippedBy([
    {normal: [0, 1], constant: frontY},
    {normal: east, constant: dot(referenceOrigin, east)},
    {normal: [-1, 0], constant: -Math.max(source[5][0], source[6][0]) - 0.001},
  ]).map(campus);
  const unassigned = clean(intersection(remainder, [stripMask]));
  if (unassigned.length !== 1 || polygonArea(unassigned[0]) > 5 || polygonArea(unassigned[0]) < 1) {
    throw new Error('The aligned staircase strip does not form one bounded unassigned tail');
  }
  const service = {
    id: 'study-55-2-unassigned-stair-side', label: 'Unassigned strip — access unknown',
    shortLabel: 'Unassigned', kind: 'service', confidence: 'estimated',
    note: 'Narrow residual strip beside the staircase and its connected blind end pocket. No room, passage, service use or east stair entrance is established here. It is explicitly excluded from the hallway study and has no doorway.',
    ...geometry(unassigned[0]),
  };
  output.spaces.push(service); occupied.push(service);
  const vertices = occupied.flatMap(s => asMulti(s).flatMap(r => r.slice(0, -1)));
  // Add exact common nodes only where the new strip meets R/stairs. The
  // seventeen other room polygons remain byte-identical.
  for (const space of [...priorRooms.map(room => output.spaces.find(s => s.id === room.id)), stairs, service]) {
    Object.assign(space, geometry(asMulti(space).map(r => prune(nodeSharedRing(rounded(r), vertices)))));
  }
  const remainingMasks = [
    [{normal: [0, -1], constant: -frontY}],
    [{normal: [0, 1], constant: frontY}, {normal: east.map(v => -v), constant: -dot(referenceOrigin, east)}],
    [{normal: [0, 1], constant: frontY}, {normal: east, constant: dot(referenceOrigin, east)},
      {normal: [1, 0], constant: Math.max(source[5][0], source[6][0]) + 0.001}],
  ].map(planes => [clippedBy(planes).map(campus)]);
  const hallPieces = remainingMasks.flatMap(mask => clean(intersection(remainder, mask)));
  const halls = clean(union(...hallPieces)).filter(p => polygonArea(p) > 1)
    .sort((a, b) => Math.min(...a[0].map(p => local(p)[0])) - Math.min(...b[0].map(p => local(p)[0])));
  if (halls.length !== 2) throw new Error('R alignment must retain exactly the two existing hallway regions');
  const finalVertices = occupied.flatMap(s => asMulti(s).flatMap(r => r.slice(0, -1)));
  output.spaces.filter(s => s.kind === 'corridor').forEach((hallSpace, i) => {
    const noded = halls[i].map(r => prune(nodeSharedRing(rounded(r), finalVertices)));
    const resolved = clean(union(noded));
    if (resolved.length !== 1) throw new Error('Aligned hallway has invalid serialized topology');
    delete hallSpace.holes;
    Object.assign(hallSpace, geometry(resolved[0].map(r => prune(nodeSharedRing(rounded(r), finalVertices)))));
    if (i === 1) hallSpace.note = 'East hall follows the recess-aligned R-bank study and retains the 1.20m north connector study guard. The narrow strip beside the staircase and its blind end pocket are unassigned and not treated as a passage; no east stair entrance is inferred.';
  });
  for (const door of output.doors) {
    const room = output.spaces.find(s => s.id === door.spaceId);
    if (/^R[123]$/.test(room.shortLabel)) {
      const edges = room.polygon.slice(1).map((b, i) => [room.polygon[i], b])
        .filter(edge => edge.every(p => Math.abs(local(p)[1] - frontY) < 0.002))
        .sort((a, b) => Math.hypot(...sub(...b)) - Math.hypot(...sub(...a)));
      if (!edges.length) throw new Error('Aligned R doorway has no corridor-facing edge');
      const [a, b] = edges[0], center = add(a, b).map(v => v / 2), tangent = unit(sub(b, a));
      const width = Math.hypot(...sub(...door.segment));
      door.segment = rounded([add(center, tangent, -width / 2), add(center, tangent, width / 2)]);
      door.note = 'Illustrative doorway recentered on the aligned R-bank corridor wall. Width, hinge, exact position and apartment internals remain unmeasured.';
    }
    const adjacent = output.spaces.filter(s => s.kind === 'corridor' && onBoundary(door.segment, s));
    if (adjacent.length !== 1 || !onBoundary(door.segment, room)) throw new Error(`R alignment stranded ${door.id}`);
    door.toSpaceId = adjacent[0].id;
  }
  for (const window of output.windows) {
    if (window.spaceId && !onBoundary(window.segment, output.spaces.find(s => s.id === window.spaceId))) {
      throw new Error(`R alignment moved a source window off its room: ${window.label}`);
    }
  }
  for (let i = 0; i < output.spaces.length; i++) {
    const a = output.spaces[i];
    if (polygonArea(asMulti(a)) - sumArea(intersection(asMulti(a), plan)) > 0.00001) {
      throw new Error(`${a.shortLabel} leaves the annotated source region`);
    }
    for (const b of output.spaces.slice(i + 1)) {
      if (sumArea(intersection(asMulti(a), asMulti(b))) > 0.000001) throw new Error(`R alignment overlaps ${a.shortLabel} and ${b.shortLabel}`);
    }
  }
  const currentR = output.spaces.filter(s => /^R[123]$/.test(s.shortLabel));
  const rBlock = clean(union(...currentR.map(asMulti)));
  const facadePoints = rBlock[0][0].filter(p => Math.abs(dot(facade.normal, local(p)) - facade.constant) < 0.002);
  const facadeDirection = unit(sub(source[7], source[6]));
  facadePoints.sort((a, b) => dot(local(a), facadeDirection) - dot(local(b), facadeDirection));
  const facadeSegment = [facadePoints[0], facadePoints.at(-1)];
  const stripCrossSections = [frontY, Math.max(...stairs.polygon.map(local).map(p => p[1]))].map(y => ({
    studyY: y, width: across([leftLine.slope * y + leftLine.intercept, y]) - eastSide,
  }));
  output.label = '2. OG — aligned R-bank study';
  output.source = 'Resident-requested R-bank alignment to both opposite recess endpoints; existing twenty-room/window observations and gross stair alignment retained. Schematic flight insets, residual strip classification and internal dimensions remain estimates.';
  output.notes = 'The resident confirms twenty rooms and twenty-four window locations on this floor. R1–R3 now align their side lines to both ends of the opposite recess, while preserving the source shell, windows and north hallway guard. Their conditional internal envelopes remain below the unverified 16.4m² benchmark. The stair enclosure and west entry remain; a symmetric 0.10m schematic flight inset meets the requested 20–25% L3 / 75–80% R1 ratio. The narrow stair-side strip and blind end pocket are unassigned, with no doorway or assumed passage.';
  return {level: output, metadata: {
    status: 'resident-requested-r-alignment-with-explicit-area-and-access-limits',
    baseline: {path: baselinePath, sha256, sourceCommit: baseline.sourceCommit},
    parameters, rooms: records,
    alignment: {
      interpretation: 'Align the two existing estimated side-wall lines to the two endpoints of the opposite recess. Retain their small prior slopes, use equal interpolated bays, and keep the source-facing R plane unchanged.',
      northRecessSourceVertexIndexes: [16, 15], northRecessSegment: [flat[16], flat[15]],
      northRecessLength: Math.hypot(...sub(flat[15], flat[16])),
      alignedSidePlanes: {left, right}, facadeSegment,
      facadeLength: Math.hypot(...sub(...facadeSegment)),
      sourceFacadeSegment: [flat[6], flat[7]], sourceFacadeLength: Math.hypot(...sub(flat[7], flat[6])),
      markerMeaning: 'Estimated R-bank extent. It is distinct from the unchanged shorter source shell edge and from clear apartment widths.',
    },
    rConnector: {
      northRecessSourceVertexIndexes: [15, 16], maximumRecessY: Math.max(source[15][1], source[16][1]),
      roomFrontY: frontY, grossGap: frontY - Math.max(source[15][1], source[16][1]),
      assumedClearGap: parameters.minimumConnectorClearStudyGuardMetres,
      studyGuard: parameters.minimumConnectorClearStudyGuardMetres, targetForced: false,
    },
    staircase: {
      referenceSourceVertexIndexes: [3, 4], referenceLine: [flat[3], flat[4]],
      grossWidth, grossL3Share: leftDistance / grossWidth, grossR1Share: 1 - leftDistance / grossWidth,
      sideInset, schematicFlightWidth: flightWidth, schematicL3Share: flightLeftShare, schematicR1Share: 1 - flightLeftShare,
      allowedGrossWidthWithFixedWestEdge: {minimum: leftDistance / 0.25, maximum: leftDistance / 0.20},
      rightOnlyShrinkConflict: 'With the west edge fixed, the L3-side reference distance is fixed. Reducing total width increases its fraction above the existing 25%, so it cannot yield 20–25%. The gross enclosure therefore stays fixed; the flight receives equal explicit side insets.',
      enclosureUnchanged: true, westDoorUnchanged: true, flightLengthUnchanged: true,
    },
    unassigned: {
      spaceId: service.id, area: polygonArea(asMulti(service)), polygon: service.polygon,
      stripCrossSections, minimumStripWidth: Math.min(...stripCrossSections.map(p => p.width)),
      maximumStripWidth: Math.max(...stripCrossSections.map(p => p.width)),
      doorwayCount: 0, assumedPassage: false, confirmedFunction: null,
      meaning: 'Narrow residual strip and connected blind end pocket removed from circulation; service is a schema category, not an assertion of installed services.',
    },
    preserved: {sourceExterior: true, floorOutline: true, windowSegments: true, roomCount: 20, doorCount: 21,
      unchangedOtherRoomReferences: level.spaces.filter(s => s.kind === 'room' && !/^R[123]$/.test(s.shortLabel)).map(s => s.shortLabel)},
  }};
}
