#!/usr/bin/env node
/**
 * Reproduce the House 55 / 2. OG resident-sketch geometry study.
 *
 * This does not publish interior data or modify the official building model.
 * Usage: node scripts/generate-house55-study.mjs [output.json] [--write-provenance] [--write-study]
 *
 * The default JSON output is /tmp/house55-study-geometry.json. After review,
 * its .level contains 2. OG and .levels contains the complete three-floor
 * study. --write-study replaces only House 55's study levels after checking
 * the generated geometry; other houses and approved interiors are preserved.
 * --write-provenance writes .metadata to the archived study-provenance JSON.
 * Public study geometry is written only with the explicit --write-study flag.
 *
 * The annotated screenshot is a manually observed research input. Its colored
 * lines are not survey measurements. Pixel observations are retained below so
 * the registration and chosen estimates can be reviewed independently.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { difference, intersection, setPrecision, union } from 'polyclip-ts';
import { floorSection } from '../src/sections.js';
import { validateInteriorStudies } from '../src/interior-studies.js';

const sourceFile = new URL('../public/data/lod2.json', import.meta.url);
const sourceBytes = await readFile(sourceFile);
const annotationFile = new URL('../data/source/house55-2og-resident-markup.png', import.meta.url);
const annotationBytes = await readFile(annotationFile);
const annotationSha256 = createHash('sha256').update(annotationBytes).digest('hex');
if (annotationSha256 !== '46e8288900b26170fa83ee93ae8bbaa68a0385e55280ade3d01583cd94a757ba') {
  throw new Error('The resident annotation changed: re-register its control points before regenerating');
}
const leftCorrectionFile = new URL('../data/source/house55-2og-left-correction.png', import.meta.url);
const leftCorrectionBytes = await readFile(leftCorrectionFile);
const leftCorrectionSha256 = createHash('sha256').update(leftCorrectionBytes).digest('hex');
if (leftCorrectionSha256 !== 'dbad4facac5f354b934020577ee83e4a8b4372dceb43ac3fe660fa44c14191fd') {
  throw new Error('The left-side correction image changed: review its interpretation before regenerating');
}
const dimensionBaselineFile = new URL('../data/source/house55-2og-dimension-baseline.json', import.meta.url);
const dimensionBaselineBytes = await readFile(dimensionBaselineFile);
const dimensionBaseline = JSON.parse(dimensionBaselineBytes);
const dimensionBaselineSha256 = createHash('sha256').update(dimensionBaselineBytes).digest('hex');
if (dimensionBaselineSha256 !== '43b7917c18c3734a86992403083e08c212e552fc776c4fea6c5eb21eb2a2a3c1') {
  throw new Error('The frozen dimensional baseline changed: do not silently replace the comparison source');
}
const lod2 = JSON.parse(sourceBytes);
const building = lod2.buildings.find(item => item.number === '55');
if (building?.id !== 'DEBY_LOD2_3166499') throw new Error('Expected House 55 source model is missing');
const flat = building.surfaces[39];
if (flat.type !== 'RoofSurface' || flat.points.length !== 25 || !flat.points.every(point => point[1] === 11.401)) {
  throw new Error('House 55 flat roof changed: re-register the annotated screenshot before regenerating');
}

const EPSILON = 1e-7;
// Robustly identify shared derived boundaries without near-zero-area slivers.
// This computational tolerance is far below source-coordinate precision.
setPrecision(1e-8);
const close = points => [...points, [...points[0]]];
const withoutClosingPoint = ring => ring.slice(0, -1);
const ringArea = ring => Math.abs(ring.slice(0, -1).reduce((sum, point, index) => {
  const next = ring[index + 1];
  return sum + point[0] * next[1] - next[0] * point[1];
}, 0) / 2);
const polygonArea = polygon => ringArea(polygon[0]) - polygon.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0);
const multiArea = multi => multi.reduce((sum, polygon) => sum + polygonArea(polygon), 0);
const clean = multi => multi.filter(polygon => polygonArea(polygon) > 0.000001);
const rounded = value => Number(value.toFixed(6));
const roundRing = ring => ring.map(point => point.map(rounded));
const roundPolygons = multi => multi.map(([outer, ...holes]) => ({ outer: roundRing(outer), holes: holes.map(roundRing) }));
const schemaPolygon = polygon => ({ polygon: roundRing(polygon[0]), ...(polygon.length > 1 ? { holes: polygon.slice(1).map(roundRing) } : {}) });

// Plan X follows the long left-to-right direction in the user's screenshot.
// Plan Y follows its top-to-bottom direction. These orthonormal basis vectors
// describe a rotation of campus [x,z]; they do not move any source vertices.
const magnitude = Math.hypot(0.676, 0.737);
const right = [0.676 / magnitude, 0.737 / magnitude];
const down = [-right[1], right[0]];
const local = ([x, z]) => [x * right[0] + z * right[1], x * down[0] + z * down[1]];
const campus = ([x, y]) => [x * right[0] + y * down[0], x * right[1] + y * down[1]];
const sourcePoint = index => [flat.points[index][0], flat.points[index][2]];
const sourceLocal = index => local(sourcePoint(index));
const annotationImage = { width: annotationBytes.readUInt32BE(16), height: annotationBytes.readUInt32BE(20) };
const observationCanvas = { width: 1344, height: 702 };
const imagePixel = point => [
  point[0] * annotationImage.width / observationCanvas.width,
  point[1] * annotationImage.height / observationCanvas.height,
];

// Only source corners on the same y=11.401m horizontal roof are fitted.
// The corners next to the two green marks are omitted from the fit because
// their visible roof-ridge edges sit ~0.91m above this plane.
const controlPixels = [
  [0, 490, 664], [5, 808, 441], [6, 809, 438], [7, 1032, 434],
  [8, 1033, 470], [9, 1267, 466], [10, 1246, 220], [11, 1276, 219],
  [12, 1257, 4], [13, 1006, 8], [17, 775, 213], [18, 491, 218],
  [19, 492, 122], [20, 265, 125], [21, 256, 431], [22, 156, 433],
  [23, 147, 670],
];

function solve(matrix, vector) {
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < vector.length; column++) {
    let pivot = column;
    for (let row = column + 1; row < vector.length; row++) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    if (Math.abs(divisor) < 1e-12) throw new Error('Registration control points are degenerate');
    rows[column] = rows[column].map(value => value / divisor);
    for (let row = 0; row < vector.length; row++) {
      if (row === column) continue;
      const coefficient = rows[row][column];
      rows[row] = rows[row].map((value, index) => value - coefficient * rows[column][index]);
    }
  }
  return rows.map(row => row.at(-1));
}

function fitHomography(controls) {
  const matrix = [], target = [];
  for (const [index, px, py] of controls) {
    const [x, y] = sourceLocal(index);
    matrix.push([x, y, 1, 0, 0, 0, -px * x, -px * y], [0, 0, 0, x, y, 1, -py * x, -py * y]);
    target.push(px, py);
  }
  const normal = Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => matrix.reduce((sum, row) => sum + row[i] * row[j], 0)));
  const result = Array.from({ length: 8 }, (_, i) => matrix.reduce((sum, row, index) => sum + row[i] * target[index], 0));
  return [...solve(normal, result), 1];
}

const homography = fitHomography(controlPixels);
function project([x, y]) {
  const h = homography, divisor = h[6] * x + h[7] * y + 1;
  return [(h[0] * x + h[1] * y + h[2]) / divisor, (h[3] * x + h[4] * y + h[5]) / divisor];
}
function unproject([x, y]) {
  const h = homography;
  return solve([[h[0] - x * h[6], h[1] - x * h[7]], [h[3] - y * h[6], h[4] - y * h[7]]], [x - h[2], y - h[5]]);
}
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const pointDistance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const controls = controlPixels.map(([index, ...pixel]) => {
  const projected = project(sourceLocal(index));
  const originalPixel = imagePixel(pixel), originalProjected = imagePixel(projected);
  return {
    sourceSurfaceIndex: 39, sourceVertexIndex: index,
    sourcePoint: flat.points[index], pixel: originalPixel.map(rounded),
    observationCanvasPixel: pixel, projectedPixel: originalProjected.map(rounded),
    residualPixels: rounded(pointDistance(originalPixel, originalProjected)),
  };
});
const rms = Math.sqrt(mean(controls.map(control => control.residualPixels ** 2)));
if (rms > 2) throw new Error(`Unexpectedly poor registration: RMS ${rms}px`);

const pixelRegions = {
  'sw-known-four': [[156, 500], [490, 499], [490, 664], [148, 670]],
  'east-known-three': [[1103, 224], [1246, 220], [1267, 466], [1103, 470]],
  'west-question': [[265, 125], [395, 125], [395, 422], [256, 431]],
  'center-left-question': [[491, 218], [674, 216], [674, 348], [490, 356]],
  'center-right-question': [[812, 291], [1033, 291], [1033, 434], [809, 438]],
  'upper-right-question': [[1006, 8], [1257, 4], [1262, 136], [1017, 141]],
  stairs: [[687, 270], [751, 270], [751, 384], [687, 386]],
};
const observed = Object.fromEntries(Object.entries(pixelRegions).map(([id, points]) => [id, points.map(unproject)]));
const regionMeasurements = Object.fromEntries(Object.entries(observed).map(([id, points]) => [id, {
  pixels: pixelRegions[id].map(point => imagePixel(point).map(rounded)),
  observationCanvasPixels: pixelRegions[id], registeredLocalCorners: points.map(point => point.map(rounded)),
  edgeLengthsMetres: points.map((point, index) => rounded(pointDistance(point, points[(index + 1) % points.length]))),
}]));

const provisionalFloorElevation = building.height * 2 / 3;
const sourceSection = floorSection(building, provisionalFloorElevation);
if (sourceSection.openChains.length) throw new Error('Cannot build study from an open source envelope section');
const sectionMulti = sourceSection.polygons.map(({ outer, holes }) => [outer, ...holes]);
const exclusionSurfaceIndexes = [3, 33];
const exclusions = exclusionSurfaceIndexes.map((index, order) => {
  const surface = building.surfaces[index];
  if (surface.type !== 'RoofSurface') throw new Error(`Expected green-marked roof surface ${index}`);
  return {
    id: `study-55-2-no-floor-${order + 1}`,
    label: order ? 'No floor — upper green mark' : 'No floor — lower green mark',
    polygon: surface.points.map(point => [point[0], point[2]]),
    sourceSurfaceIndex: index,
  };
});
const floorMulti = clean(difference(sectionMulti, ...exclusions.map(exclusion => [exclusion.polygon])));
const flatPlan = [flat.points.map(point => [point[0], point[2]])];
const annotationPlan = clean(intersection(floorMulti, flatPlan));
const unassignedStepEdges = clean(difference(floorMulti, annotationPlan));

// Hand strokes are rectified to the two building axes. Exterior edges are
// anchored to source corners; internal strokes retain their approximate
// observed position. This is a reconstruction of the sketch, not a survey.
const sw = observed['sw-known-four'];
const swTop = mean([sw[0][1], sw[1][1]]);
const swLeft = sourceLocal(23)[0], swRight = sourceLocal(0)[0];
const swBottom = Math.max(sourceLocal(23)[1], sourceLocal(0)[1]);
const swCuts = [[232, 500, 232, 665], [308, 500, 308, 669], [400, 500, 400, 665]].map(([a, b, c, d]) => mean([unproject([a, b])[0], unproject([c, d])[0]]));
const east = observed['east-known-three'];
const eastLeft = mean([east[0][0], east[3][0]]);
const eastRight = Math.max(sourceLocal(9)[0], sourceLocal(10)[0]);
const eastTop = mean([sourceLocal(10)[1], sourceLocal(11)[1]]);
const eastBottom = Math.max(sourceLocal(8)[1], sourceLocal(9)[1]);
const eastCuts = [[[1104, 299], [1253, 297]], [[1107, 369], [1256, 365]]].map(pair => mean(pair.map(point => unproject(point)[1])));
const west = observed['west-question'], centerLeft = observed['center-left-question'];
const centerRight = observed['center-right-question'], upperRight = observed['upper-right-question'];
const stairs = observed.stairs;
const bounds = {
  'sw-known-four': [swLeft, swTop, swRight, swBottom],
  'east-known-three': [eastLeft, eastTop, eastRight, eastBottom],
  'west-question': [Math.min(sourceLocal(20)[0], sourceLocal(21)[0]), sourceLocal(20)[1], mean([west[1][0], west[2][0]]), mean([west[2][1], west[3][1]])],
  'center-left-question': [sourceLocal(18)[0], mean([sourceLocal(17)[1], sourceLocal(18)[1]]), mean([centerLeft[1][0], centerLeft[2][0]]), mean([centerLeft[2][1], centerLeft[3][1]])],
  'center-right-question': [mean([centerRight[0][0], centerRight[3][0]]), mean([centerRight[0][1], centerRight[1][1]]), mean([centerRight[1][0], centerRight[2][0]]), mean([sourceLocal(6)[1], sourceLocal(7)[1]])],
  'upper-right-question': [sourceLocal(13)[0], Math.min(sourceLocal(12)[1], sourceLocal(13)[1]), sourceLocal(12)[0], mean([upperRight[2][1], upperRight[3][1]])],
  stairs: [mean([stairs[0][0], stairs[3][0]]), mean([stairs[0][1], stairs[1][1]]), mean([stairs[1][0], stairs[2][0]]), mean([stairs[2][1], stairs[3][1]])],
};
const preRefitBounds = structuredClone(bounds);
const originalStairBounds = [...bounds.stairs];
const originalRightBounds = [...bounds['center-right-question']];

// The resident confirms the counts, not the dimensions of the hand strokes.
// The two explicitly counted exterior runs suggest a roughly 3m gross bay:
// SW ≈12.066/4 and east ≈9.140/3. Use that as a candidate module for W/L,
// equalize the SW/east dividers, then fit a shared gross depth below. This
// models the resident's small dimensional variation without making equal
// areas a substitute for similar dimensions. No rental-area target is used.
// R remains source-aligned and unresolved.
const candidateBay = 3;
bounds['west-question'][3] = bounds['west-question'][1] + 4 * candidateBay;
bounds['center-left-question'][0] = 1;
bounds['center-left-question'][2] = 10;

// Subsequent resident correction: attach the stairs to the left block's
// right wall. Its final adjacent room is L3 after the confirmed count update.
// Preserve the sketch's run direction, north/south position and dimensions.
const stairShift = bounds['center-left-question'][2] - bounds.stairs[0];
bounds.stairs[0] += stairShift;
bounds.stairs[2] += stairShift;

// The R block meets the source's long exterior wall at corners 6 and 7.
// Its side edges continue the adjoining source edges 5→6 and 7→8. A slight
// source skew is retained instead of extruding an axis-aligned padded box,
// which previously introduced short corner projections.
function continueEdgeAtY(a, b, y) {
  if (Math.abs(b[1] - a[1]) < 1e-10) throw new Error('Cannot extend a horizontal source edge to the R-block top');
  return [a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y];
}
function continueEdgeAtX(a, b, x) {
  return [x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])];
}
const rightBottomLeft = sourceLocal(6), rightBottomRight = sourceLocal(7);
const rightTopY = originalRightBounds[1];
const rightQuad = [
  continueEdgeAtY(sourceLocal(5), rightBottomLeft, rightTopY),
  continueEdgeAtY(rightBottomRight, sourceLocal(8), rightTopY),
  rightBottomRight, rightBottomLeft,
];
bounds['center-right-question'] = [
  rightBottomLeft[0], rightTopY, rightBottomRight[0], mean([rightBottomLeft[1], rightBottomRight[1]]),
];

const rect = ([x0, y0, x1, y1]) => close([[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(campus));
// Derive the same source-aligned side geometry for both the width-only input
// stage and the final depth fit. Only the corridor-facing edge may move.
function zoneQuad(key, box) {
  if (key === 'center-left-question') return [
    continueEdgeAtX(sourceLocal(18), sourceLocal(17), box[0]),
    continueEdgeAtX(sourceLocal(18), sourceLocal(17), box[2]),
    [box[2], box[3]], [box[0], box[3]],
  ];
  if (key === 'west-question') return [
    sourceLocal(20),
    continueEdgeAtX(sourceLocal(20), sourceLocal(19), box[2]),
    [box[2], box[3]],
    continueEdgeAtY(sourceLocal(20), sourceLocal(21), box[3]),
  ];
  return key === 'center-right-question' ? rightQuad : null;
}
const chosenZones = [
  { key: 'sw-known-four', code: 'sw', name: 'SW', count: 4, axis: 0, facing: 'top', exteriorEdges: [0, 2, 3], sketchEdges: [], confidence: 'estimated',
    note: 'Four rooms are resident-confirmed. Equal gross bays of about 3.02m replace uneven hand-stroke divisions. Their corridor-facing wall moves to the common fitted gross depth; these are not measured full apartments or physical room numbers.' },
  { key: 'east-known-three', code: 'east', name: 'East', count: 3, axis: 1, facing: 'left', exteriorEdges: [2, 3], sketchEdges: [], confidence: 'estimated',
    note: 'Three rooms are resident-confirmed. Equal gross bays of about 3.05m replace uneven hand-stroke divisions. Their corridor-facing wall moves to the common fitted gross depth. Kitchen, bathroom, wall thicknesses and usable areas remain unknown.' },
  { key: 'west-question', code: 'west', name: 'West', count: 4, axis: 1, facing: 'right', exteriorEdges: [], sketchEdges: [], confidence: 'estimated',
    note: 'Four rooms are resident-confirmed. Candidate 3.00m gross bays and a common fitted gross depth use some former corridor space. These similar envelope dimensions are a model assumption, not a measured full-apartment template.' },
  { key: 'center-left-question', code: 'center-left', name: 'Center left', count: 3, axis: 0, facing: 'bottom', exteriorEdges: [], sketchEdges: [], confidence: 'estimated',
    note: 'Three rooms L1–L3 are resident-confirmed. Candidate 3.00m gross bays and a common fitted depth replace the implausibly narrow earlier L subdivisions. The stairs remain flush to L3 after shifting about 0.70m plan-right. L1 has only partial facade frontage, so its exact shape and window need checking.' },
  { key: 'center-right-question', code: 'center-right', name: 'Center right', count: 3, axis: 0, facing: 'top', exteriorEdges: [], sketchEdges: [0, 1, 3], confidence: 'estimated',
    note: 'Three rooms and the flush exterior alignment are resident-confirmed. The retained facade is about 8.08m long: roughly 2.69m gross per bay, before walls. Three literal 2.70m clear-width templates cannot fit this fixed span. This block is unresolved; no narrower real apartment type or invented wall thickness is asserted.' },
  { key: 'upper-right-question', code: 'upper-right', name: 'Upper right', count: 3, axis: 0, facing: 'bottom', exteriorEdges: [0, 1, 2], sketchEdges: [], confidence: 'estimated',
    note: 'Three rooms are resident-confirmed. Source-anchored gross bays remain about 3.19m wide; only their corridor-facing boundary moves to the common fitted gross depth. All internal positions and clear dimensions remain estimates.' },
];
const studyLabel = (zone, index) => zone.code === 'sw' ? String.fromCharCode(65 + index)
  : zone.code === 'east' ? String.fromCharCode(69 + index)
    : `${({ west: 'W', 'center-left': 'L', 'center-right': 'R', 'upper-right': 'N' })[zone.code]}${index + 1}`;
function cellsForZone(zone, box = bounds[zone.key]) {
  const first = box[zone.axis], last = box[zone.axis + 2];
  const cuts = [first, ...(zone.cuts || Array.from({ length: zone.count - 1 }, (_, index) => first + (last - first) * (index + 1) / zone.count)), last];
  const quad = zoneQuad(zone.key, box), cells = [];
  for (let index = 0; index < zone.count; index++) {
    const cell = [...box];
    cell[zone.axis] = cuts[index]; cell[zone.axis + 2] = cuts[index + 1];
    const clippingCell = [...cell];
    // This margin only crosses the target exterior edge before intersection.
    // The resulting wall is the untouched source edge. It prevents tiny gaps
    // caused by the source model's almost-but-not-perfectly orthogonal walls.
    for (const edge of zone.exteriorEdges) if (Math.abs(cell[edge] - box[edge]) < EPSILON) clippingCell[edge] += edge < 2 ? -0.05 : 0.05;
    const interpolate = (a, b, t) => a.map((value, coordinate) => value + (b[coordinate] - value) * t);
    const candidate = quad ? close((zone.axis === 1 ? [
      interpolate(quad[0], quad[3], index / zone.count),
      interpolate(quad[1], quad[2], index / zone.count),
      interpolate(quad[1], quad[2], (index + 1) / zone.count),
      interpolate(quad[0], quad[3], (index + 1) / zone.count),
    ] : [
      interpolate(quad[0], quad[1], index / zone.count),
      interpolate(quad[0], quad[1], (index + 1) / zone.count),
      interpolate(quad[3], quad[2], (index + 1) / zone.count),
      interpolate(quad[3], quad[2], index / zone.count),
    ]).map(campus)) : rect(clippingCell);
    const clipped = clean(intersection(annotationPlan, [candidate]));
    if (clipped.length !== 1 || multiArea(clipped) < 5) throw new Error(`${zone.key} bay ${index + 1} does not fit the annotated floor`);
    cells.push({ index, cell, clipped });
  }
  return { box, cuts, quad, cells };
}
function grossBounds(polygon, serialize = false) {
  const points = (serialize ? roundRing(polygon[0]) : polygon[0]).map(local);
  return [Math.min(...points.map(point => point[0])), Math.min(...points.map(point => point[1])),
    Math.max(...points.map(point => point[0])), Math.max(...points.map(point => point[1]))];
}
const depthFitZones = chosenZones.filter(zone => zone.code !== 'center-right');
const widthOnlyBounds = structuredClone(bounds);
const depthInputs = depthFitZones.flatMap(zone => cellsForZone(zone).cells.map(({ index, clipped }) => {
  const box = grossBounds(clipped[0], true), axis = 1 - zone.axis;
  return {
    id: `study-55-2-${zone.code}-${index + 1}`, label: studyLabel(zone, index), zone: zone.key,
    projectedGrossBoundsMetres: box,
    projectedGrossDepthMetres: box[axis + 2] - box[axis],
  };
}));
if (depthInputs.length !== 17) throw new Error('The common-depth fit requires exactly seventeen non-R room references');
// The arithmetic mean minimizes summed squared depth changes across these
// seventeen prior envelopes. It is a modelling convention, not calibration.
const commonDepth = mean(depthInputs.map(input => input.projectedGrossDepthMetres));
const depthWallChanges = [];
for (const zone of depthFitZones) {
  const coordinate = ({ left: 0, top: 1, right: 2, bottom: 3 })[zone.facing];
  const before = bounds[zone.key][coordinate], direction = coordinate < 2 ? -1 : 1;
  const measureAt = value => {
    const box = [...bounds[zone.key]]; box[coordinate] = value;
    return mean(cellsForZone(zone, box).cells.map(({ clipped }) => {
      const extent = grossBounds(clipped[0]), axis = 1 - zone.axis;
      return extent[axis + 2] - extent[axis];
    }));
  };
  let low = before - 1.5, high = before + 1.5;
  if ((measureAt(low) - commonDepth) * direction > 0
    || (measureAt(high) - commonDepth) * direction < 0) throw new Error(`${zone.key}: common depth is outside the corridor-wall bracket`);
  for (let iteration = 0; iteration < 36; iteration++) {
    const mid = (low + high) / 2;
    if ((measureAt(mid) - commonDepth) * direction < 0) low = mid;
    else high = mid;
  }
  bounds[zone.key][coordinate] = (low + high) / 2;
  depthWallChanges.push({
    zone: zone.key, coordinateIndex: coordinate, beforeMetres: before,
    afterMetres: bounds[zone.key][coordinate], meanGrossDepthMetres: measureAt(bounds[zone.key][coordinate]),
  });
  zone.note += ` The shared fitted gross depth is approximately ${commonDepth.toFixed(2)}m before walls; it is not a measured clear apartment depth.`;
}

// Later resident correction: align L1's left wall to the source's northern
// elbow, then the L3/stairwell wall to the southern corner. The three rooms
// remain equal bays, retaining their previous corridor-facing depth. The
// other seventeen rooms and the prior common-depth calculation stay frozen.
const priorDimensionBounds = structuredClone(bounds);
const leftBox = bounds['center-left-question'];
leftBox[0] = sourceLocal(18)[0];
leftBox[2] = sourceLocal(3)[0];
leftBox[1] = continueEdgeAtX(sourceLocal(18), sourceLocal(17), leftBox[0])[1];
const correctedLeftBayWidth = (leftBox[2] - leftBox[0]) / 3;
const stairwellWidth = correctedLeftBayWidth / 2;
const stairFlightBounds = [leftBox[2], bounds.stairs[1], leftBox[2] + stairwellWidth, bounds.stairs[3]];
bounds.stairs = [
  leftBox[2], continueEdgeAtX(sourceLocal(18), sourceLocal(17), leftBox[2])[1],
  leftBox[2] + stairwellWidth, sourceLocal(3)[1],
];
const correctedLeftZone = chosenZones.find(zone => zone.code === 'center-left');
correctedLeftZone.note = `Three rooms L1–L3 and their rightward shift are resident-confirmed. Their left edge follows the source northern elbow and L3 meets the stairwell wall above the southern source corner. Equal gross bays are about ${correctedLeftBayWidth.toFixed(2)}m wide; the previous approximately ${commonDepth.toFixed(2)}m gross depth is retained. These are unmeasured candidate envelopes, not exact apartment dimensions or physical room numbers.`;

const spaces = [], roomMultis = [], doorCandidates = [], zoneResults = [], sketchBoundaries = [];
for (const zone of chosenZones) {
  const { box, cuts, quad, cells } = cellsForZone(zone);
  const first = box[zone.axis], last = box[zone.axis + 2], zoneRooms = [];
  const boundaryRing = quad ? close(quad.map(campus)) : rect(box);
  sketchBoundaries.push(...zone.sketchEdges.map(index => [boundaryRing[index], boundaryRing[index + 1]].map(point => point.map(rounded))));
  for (const { index, cell, clipped } of cells) {
    const id = `study-55-2-${zone.code}-${index + 1}`;
    const shortLabel = studyLabel(zone, index);
    const label = `Room ${shortLabel} — estimated layout`;
    spaces.push({ id, label, shortLabel, kind: 'room', confidence: zone.confidence, note: zone.note, ...schemaPolygon(clipped[0]) });
    roomMultis.push(clipped);
    zoneRooms.push({ id, grossAreaMetresSquared: rounded(multiArea(clipped)), grossBayWidthMetres: rounded(cuts[index + 1] - cuts[index]) });
    const cx = (cell[0] + cell[2]) / 2, cy = (cell[1] + cell[3]) / 2, halfWidth = 0.45;
    const segment = zone.facing === 'top' ? [[cx - halfWidth, cell[1]], [cx + halfWidth, cell[1]]]
      : zone.facing === 'bottom' ? [[cx - halfWidth, cell[3]], [cx + halfWidth, cell[3]]]
        : zone.facing === 'left' ? [[cell[0], cy - halfWidth], [cell[0], cy + halfWidth]]
          : [[cell[2], cy - halfWidth], [cell[2], cy + halfWidth]];
    doorCandidates.push({
      id: `study-55-2-opening-${zone.code}-${index + 1}`, label: `Estimated opening — ${label}`,
      spaceId: id, confidence: 'estimated',
      note: 'Illustrative 0.90m opening centered on a potential corridor-facing boundary; no door position, width, hinge or swing was supplied.',
      segment: segment.map(campus).map(point => point.map(rounded)),
    });
  }
  zoneResults.push({
    id: zone.key, selectedCount: zone.count, countBasis: 'resident-confirmed', confidence: zone.confidence, note: zone.note,
    rectifiedLocalBoundsMetres: box.map(rounded), runMetres: rounded(last - first),
    averageGrossBayMetres: rounded((last - first) / zone.count), rooms: zoneRooms,
    ...(quad ? { correctedLocalCornersMetres: quad.map(point => point.map(rounded)) } : {}),
    observed: regionMeasurements[zone.key],
  });
}

const stairQuad = [
  continueEdgeAtX(sourceLocal(18), sourceLocal(17), bounds.stairs[0]),
  continueEdgeAtX(sourceLocal(18), sourceLocal(17), bounds.stairs[2]),
  [bounds.stairs[2], bounds.stairs[3]], [bounds.stairs[0], bounds.stairs[3]],
];
const stairMulti = clean(intersection(annotationPlan, [close(stairQuad.map(campus))]));
if (stairMulti.length !== 1) throw new Error('Expected one source-clipped stairwell enclosure');
// Preserve the existing L3 bottom corner as an intermediate stairwell vertex.
// Otherwise rounding one long stair edge and the shorter L3 edge separately
// can create a sub-micrometre triangle along their supposedly shared wall.
const l3Index = spaces.findIndex(space => space.shortLabel === 'L3');
const expectedL3Joint = campus([leftBox[2], leftBox[3]]);
const l3Joint = roomMultis[l3Index][0][0].find(point => pointDistance(point, expectedL3Joint) < 0.000001);
if (!l3Joint) throw new Error('L3 bottom corner is missing from its clipped boundary');
const stairOuter = stairMulti[0][0];
const jointEdges = stairOuter.slice(0, -1).flatMap((point, index) => (
  distanceToSegment(l3Joint, point, stairOuter[index + 1]) < 0.000001
    && pointDistance(l3Joint, point) > 0.000001
    && pointDistance(l3Joint, stairOuter[index + 1]) > 0.000001 ? [index] : []
));
if (jointEdges.length !== 1) throw new Error('L3 bottom corner must lie on exactly one stairwell boundary edge');
stairOuter.splice(jointEdges[0] + 1, 0, [...l3Joint]);
const stairFlight = roundRing(rect(stairFlightBounds));
const stairId = 'study-55-2-stairs';
spaces.push({
  id: stairId, label: 'Stairwell — resident correction', shortLabel: 'Stairs', kind: 'stairs', confidence: 'estimated',
  note: `The resident confirms that the earlier stairwell was too wide and the green mark is an entrance into it from the west hall. The width is provisionally interpreted as half a neighboring room bay, about ${stairwellWidth.toFixed(2)}m; it is not a measurement. The enclosure follows L3's right wall from the north facade to the southern source corner. A separate schematic flight keeps the earlier approximate run, leaving upper and lower landing areas clear. The east-hall connection, exact enclosure, steps and landing dimensions remain unknown.`,
  ...schemaPolygon(stairMulti[0]),
  stairFlight,
});
const circulation = clean(difference(annotationPlan, ...roomMultis, stairMulti));
const mainCirculation = circulation.filter(polygon => polygonArea(polygon) > 1)
  .sort((a, b) => grossBounds(a)[0] - grossBounds(b)[0]);
if (mainCirculation.length !== 2) throw new Error(`Expected separate west/east halls, found ${mainCirculation.length}; inspect stairwell contact with the source boundary`);
const corridorId = 'study-55-2-potential-corridor';
const corridors = mainCirculation.map((polygon, index) => ({
  id: index ? `${corridorId}-east` : corridorId,
  label: index ? 'East hall — connection unconfirmed' : 'West hall — study',
  shortLabel: index ? 'East hall' : 'West hall', kind: 'corridor', confidence: 'estimated',
  note: index
    ? 'Eastern remainder between the unchanged room envelopes and corrected stairwell. Its connection into the stairwell or western hall was not supplied; no opening or route is invented. The narrow gap beside R is an unresolved geometric result, not an approved circulation width.'
    : 'Western remainder between the room envelopes and corrected stairwell. The resident marks a door into the stairwell below the flight. Hall dimensions remain estimates and do not establish an approved route or usable floor area.',
  ...schemaPolygon(polygon),
}));
spaces.push(...corridors);
const doors = doorCandidates.map(door => {
  const samples = [...door.segment, door.segment[0].map((value, index) => (value + door.segment[1][index]) / 2)];
  const adjacent = corridors.filter(corridor => samples.every(point => onBoundary(point, corridor)));
  if (adjacent.length !== 1) throw new Error(`${door.id} does not identify exactly one adjacent hallway`);
  return { ...door, toSpaceId: adjacent[0].id };
});
const stairBox = bounds.stairs;
const stairCenter = (stairBox[0] + stairBox[2]) / 2;
const stairEntryCenter = (stairFlightBounds[3] + stairBox[3]) / 2;
doors.push({
  id: 'study-55-2-opening-stairs', label: 'Stairwell entrance — resident mark', spaceId: stairId, toSpaceId: corridorId,
  confidence: 'sketch',
  note: 'The resident confirms the green mark as a door from the west hallway INTO the stairwell, on its left wall below the flight. The 1.10m gap and centered landing position are illustrative, not measured. No hinge, swing, exterior-exit status or east-side stairwell opening is inferred.',
  segment: [[stairBox[0], stairEntryCenter - 0.55], [stairBox[0], stairEntryCenter + 0.55]].map(campus).map(point => point.map(rounded)),
});

// The correction must not alter any of the other seventeen room polygons.
const unchangedRoomIds = [];
for (const prior of dimensionBaseline.level.spaces.filter(space => space.kind === 'room' && !space.shortLabel.startsWith('L'))) {
  const current = spaces.find(space => space.id === prior.id);
  const geometry = space => ({ polygon: space.polygon, holes: space.holes || [] });
  if (JSON.stringify(geometry(current)) !== JSON.stringify(geometry(prior))) {
    throw new Error(`Left-side correction changed frozen room geometry ${prior.shortLabel}`);
  }
  unchangedRoomIds.push(prior.id);
}
if (unchangedRoomIds.length !== 17) throw new Error('Expected seventeen unchanged room envelopes');

// Check topology before handing the study to the application schema.
let overlapArea = 0;
for (let a = 0; a < roomMultis.length; a++) for (let b = a + 1; b < roomMultis.length; b++) overlapArea += multiArea(intersection(roomMultis[a], roomMultis[b]));
if (overlapArea > 0.001) throw new Error(`Candidate rooms overlap by ${overlapArea}m²`);
const stairRoomOverlap = roomMultis.reduce((sum, room) => sum + multiArea(intersection(room, stairMulti)), 0);
if (stairRoomOverlap > 0.001) throw new Error(`Corrected stairwell overlaps rooms by ${stairRoomOverlap}m²`);
const uncontainedArea = multiArea(difference(union(...roomMultis, stairMulti, mainCirculation), floorMulti));
if (uncontainedArea > 0.001) throw new Error(`Study spaces escape the proposed floor outline by ${uncontainedArea}m²`);
const greenOverlap = multiArea(intersection(floorMulti, union(...exclusions.map(exclusion => [exclusion.polygon]))));
if (greenOverlap > 0.001) throw new Error(`Green no-floor zones still contain ${greenOverlap}m² of floor`);
function distanceToSegment(point, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared)) : 0;
  return pointDistance(point, [a[0] + t * dx, a[1] + t * dy]);
}
function onBoundary(point, space) {
  return [space.polygon, ...(space.holes || [])].some(ring => ring.slice(0, -1).some((a, index) => distanceToSegment(point, a, ring[index + 1]) < 0.00001));
}
for (const door of doors) {
  for (const id of [door.spaceId, door.toSpaceId]) {
    const space = spaces.find(item => item.id === id);
    if (!door.segment.every(point => onBoundary(point, space))) throw new Error(`${door.id} is not on ${id}'s boundary`);
  }
}

const allSourceVertices = sourceSection.polygons.flatMap(polygon => polygon.outer.map(local));
const sourceBounds = [
  Math.min(...allSourceVertices.map(point => point[0])), Math.min(...allSourceVertices.map(point => point[1])),
  Math.max(...allSourceVertices.map(point => point[0])), Math.max(...allSourceVertices.map(point => point[1])),
];
const study = {
  metadata: {
    schemaVersion: 1, status: 'resident-sketch-and-explicit-estimates', house: '55', levelIndex: 2,
    generatedForDate: '2026-11-15', generator: 'node scripts/generate-house55-study.mjs',
    source: 'Resident annotated House 55 / 2. OG screenshot supplied in this project on 2026-11-15; registered to Bayerische Vermessungsverwaltung LoD2 exterior.',
    dimensionRefit: {
      status: 'prior-common-depth-candidate-followed-by-left-side-correction',
      basis: 'Resident-confirmed twenty-room count, general hallway positions and broadly similar single-apartment types with small dimensional variation; approximate 2.70×3.30m living zone in Rommelwood’s older single-apartment sketch.',
      sourceUrl: 'https://rommelwood.de/wohnen/zimmergrundriss/',
      candidateGrossModuleMetres: candidateBay,
      moduleReason: 'The two explicitly counted exterior runs are approximately 12.066/4 and 9.140/3 metres per bay. The prior dimensional stage used a rounded 3m gross module for W/L. The later resident left-side correction replaces only L with source-anchored bays of about 2.94m; no module is a measured structural grid.',
      changes: 'Historical stage: equal SW/east divisions, four 3m W bays, three 3m L bays and a fitted common gross depth for seventeen non-R envelopes. Later left-side stage: L moves between source corners with three roughly 2.94m bays; its prior depth boundary is retained. The stairwell, entry and two hall regions are corrected separately. The other seventeen room polygons, including unresolved R, stay byte-identical to the archived dimensional baseline.',
      commonDepth: {
        stage: 'Historical dimensional-fit stage, retained reproducibly; not recalculated after the resident left-side correction.',
        candidateGrossDepthMetres: commonDepth,
        method: 'Arithmetic mean of the seventeen source-clipped width-only envelope depths in the study axes, minimizing the sum of their squared depth changes with equal per-room weight. Each zone corridor-facing wall is then solved against its source-clipped mean depth; source skew allows small individual differences.',
        inputStage: 'Reproducible width-only stage: equal SW/east divisions, 3m W/L bays, N source frontage, approximate original depths. Source-clipped polygons are serialized to six decimals before measuring the retained input vector, as in the prior public study.',
        inputDepths: depthInputs,
        widthOnlyLocalBoundsMetres: widthOnlyBounds,
        corridorFacingWallChanges: depthWallChanges,
        scope: 'Prior seventeen-room fit: A–G, W1–W4, L1–L3 and N1–N3; R excluded. The later left-side correction retains the existing L depth boundary while moving its frontage along the slightly skewed source wall. This historical target is not refitted globally.',
        interpretation: 'A fitted gross model depth before walls, not a measured full-apartment template, clear living dimension or rental-area target. Similar dimensions do not establish identical interiors or usable areas. The resident’s hand-length description is qualitative and has not been converted into a measured tolerance.',
      },
      stairTranslationFromPreviousStudyMetres: [rounded(priorDimensionBounds['center-left-question'][2] - preRefitBounds['center-left-question'][2]), 0],
      unresolved: 'R remains about 2.69m gross per bay. Three literal 2.70m clear-width living zones plus walls cannot fit this fixed facade span. Exact full apartment dimensions and equal usable areas remain unproved everywhere.',
      scope: 'Only index2 is refitted. Lower floors retain the frozen earlier sketch; this candidate is not automatically repeated downwards.',
      originalLocalBoundsMetres: Object.fromEntries(Object.entries(preRefitBounds).map(([key, box]) => [key, box.map(rounded)])),
      originalHandStrokeCutsLocalMetres: { sw: swCuts.map(rounded), east: eastCuts.map(rounded) },
      auditDocument: 'docs/HOUSE55-DIMENSION-REFIT.md',
    },
    residentCorrections: {
      source: 'Resident follow-ups on 2026-11-15: twenty top-floor rooms; flush R exterior alignment; then a new left-side image, L1–L3 shifted toward the marked source corners, a narrower stairwell, and a confirmed west-hall entrance into it.',
      leftSide: {
        status: 'resident-marked-positions-with-explicit-dimensional-estimates',
        image: {
          path: 'data/source/house55-2og-left-correction.png',
          originalFilename: 'codex-clipboard-hc2CPv.png',
          sha256: leftCorrectionSha256,
          width: leftCorrectionBytes.readUInt32BE(16), height: leftCorrectionBytes.readUInt32BE(20),
          interpretation: 'Annotated orthographic study-axis plot. Blue brackets and arrow request a rightward L1–L3 shift. Red strokes indicate its left boundary and a narrower stair/partition area; green marks the confirmed hallway-to-stairwell entrance below the flight. Pixel strokes are soft constraints, not calibrated measurements.',
          sourceAnchorChoice: 'Use existing RoofSurface39 vertex18 as the left elbow and vertex3 X as the shared L3/stairwell wall, instead of treating thick freehand pixels as precise coordinates. No second image homography, source rescale or source-vertex change is introduced.',
        },
        comparisonBaseline: {
          path: 'data/source/house55-2og-dimension-baseline.json',
          sha256: dimensionBaselineSha256, sourceCommit: dimensionBaseline.sourceCommit,
          meaning: dimensionBaseline.meaning,
        },
        leftSourceAnchor: { surfaceIndex: 39, vertexIndex: 18, campusPoint: flat.points[18], localPoint: sourceLocal(18).map(rounded) },
        sharedWallSouthSourceAnchor: { surfaceIndex: 39, vertexIndex: 3, campusPoint: flat.points[3], localPoint: sourceLocal(3).map(rounded) },
        priorLeftLocalBoundsMetres: priorDimensionBounds['center-left-question'].map(rounded),
        correctedLeftLocalBoundsMetres: leftBox.map(rounded),
        equalGrossBayWidthMetres: correctedLeftBayWidth,
        retainedCorridorFacingDepthCoordinateMetres: leftBox[3],
        depthInterpretation: 'The previous roughly 5.395m gross model depth is retained, not newly measured or globally refitted. The source-wall skew gives small depth variation after the rightward shift.',
        stairwellWidthInterpretation: 'The resident said the previous stairwell was too wide and described it as roughly half a room size. Because the clarification concerned width, this study provisionally uses half the adjacent gross bay width. The ratio, clear width and enclosure remain unmeasured.',
        stairwellWidthFractionOfLeftBay: 0.5,
        approximateStairwellWidthMetres: stairwellWidth,
        stairwellToRightBlockMinimumAxisGapMetres: Math.min(...spaces.filter(space => space.shortLabel?.startsWith('R')).flatMap(space => space.polygon.map(point => local(point)[0]))) - bounds.stairs[2],
        corridorSpaceIds: { west: corridorId, east: `${corridorId}-east` },
        knownConnection: 'West hall to stairwell through the green-marked entrance on its left wall, below the flight.',
        unknownConnection: 'No east-hall connection into the stairwell or west hall was supplied. No second stairwell door or bypass route is invented.',
        thickWallQuestion: 'The handwritten “Thick wall?” remains an unanswered question. No source exterior, wall thickness, structural role or floor area is changed from it.',
        unchangedOtherRoomIds: unchangedRoomIds,
        unchangedOtherRoomGeometryCount: unchangedRoomIds.length,
        lowerFloorScope: 'The correction applies only to index2; both lower-floor records retain their earlier frozen sketch extrapolations.',
      },
      stairs: {
        instruction: 'Keep the corrected stairwell flush against L3, narrower than before, with the confirmed west-hall entrance below the flight. Its enclosure reaches the north source wall and the southern source corner Y.',
        adjacentStudyRoom: 'L3',
        originalLocalBoundsMetres: originalStairBounds.map(rounded),
        priorDimensionLocalBoundsMetres: priorDimensionBounds.stairs.map(rounded),
        correctedLocalBoundsMetres: bounds.stairs.map(rounded),
        leftWallShiftFromPriorDimensionMetres: rounded(bounds.stairs[0] - priorDimensionBounds.stairs[0]),
        schematicFlightLocalBoundsMetres: stairFlightBounds.map(rounded),
        sharedWallInCampusXZ: [
          [bounds.stairs[0], Math.max(bounds.stairs[1], bounds['center-left-question'][1])],
          [bounds.stairs[0], Math.min(bounds.stairs[3], bounds['center-left-question'][3])],
        ].map(campus).map(point => point.map(rounded)),
        sharedWallLengthMetres: rounded(Math.min(bounds.stairs[3], bounds['center-left-question'][3]) - Math.max(bounds.stairs[1], bounds['center-left-question'][1])),
        intermediateL3JointInCampusXZ: l3Joint.map(rounded),
        greenEntranceSegmentInCampusXZ: doors.at(-1).segment,
        entranceWidthMetres: 1.10,
        entranceWidthStatus: 'Illustrative only; resident confirms the location and west-hall-to-stairwell relationship, not the width, exact center, leaf or swing.',
        unchanged: 'Only the schematic flight retains its earlier approximate north/south run. The enclosure now includes clear upper/lower landing areas, and its width and left-wall position have changed.',
        unknown: 'Exact stair flight, number of risers, landing layout, clear widths and any east-hall connection remain unmeasured or unknown.',
      },
      rightBlock: {
        instruction: 'Shift R1–R3 toward the stairs until its ends meet the adjoining exterior edges without small corner projections.',
        originalLocalBoundsMetres: originalRightBounds.map(rounded),
        correctedLocalCornersMetres: rightQuad.map(point => point.map(rounded)),
        exteriorWallSource: { surfaceIndex: 39, vertexIndexes: [6, 7], adjacentEdgeVertexIndexes: [[5, 6], [7, 8]] },
        leftEndShiftMetres: rounded(rightBottomLeft[0] - originalRightBounds[0]),
        rightEndShiftMetres: rounded(rightBottomRight[0] - originalRightBounds[2]),
        bottomWallLengthMetres: rounded(pointDistance(rightBottomLeft, rightBottomRight)),
        correctionMeaning: 'Outer alignment and three-room count follow the resident correction. Internal divider coordinates and all doorway positions remain estimates.',
      },
    },
    annotation: {
      filename: 'house55-2og-resident-markup.png', originalFilename: 'codex-clipboard-iLXgxr.png',
      archivedPath: 'data/source/house55-2og-resident-markup.png', ...annotationImage,
      sha256: annotationSha256,
      observation: 'Red: room bays and four question-mark zones. Green: two areas explicitly marked as no floor. Blue: central stairs. Lower facade marks are not counted as 2. OG plan divisions.',
      reusePermission: 'Resident supplied the annotation for implementation in rommelweb and explicitly authorized estimates where counts are unknown.',
    },
    geometrySource: {
      path: 'public/data/lod2.json', sha256: createHash('sha256').update(sourceBytes).digest('hex'),
      buildingId: building.id, footprintCurrency: building.footprintCurrency, creationDate: building.creationDate,
      attribution: 'Datenquelle: Bayerische Vermessungsverwaltung – www.geodaten.bayern.de',
      license: 'CC BY 4.0', sourceUrl: 'https://geodaten.bayern.de/opengeodata/OpenDataDetail.html?pn=lod2',
    },
    registration: {
      method: 'Least-squares 8-parameter planar homography from seventeen manually observed same-plane source corners; h33=1.',
      sourcePlaneCampusY: 11.401, sourcePlaneAltitudeNHN: 300.990,
      sourcePlaneMeaning: 'Visible horizontal roof used only to register plan positions; not the second-floor elevation.',
      localAxesInCampusXZ: { x: right, y: down }, localOriginInCampusXZ: [0, 0],
      observationCanvas: { ...observationCanvas, meaning: 'Manual digitization canvas; the original image is rescaled to this coordinate grid for the retained observations.' },
      observationCanvasToOriginalPixelScale: [annotationImage.width / observationCanvas.width, annotationImage.height / observationCanvas.height],
      localMetresToObservationCanvasPixelsRowMajor: homography,
      localMetresToImagePixelsRowMajor: homography.map((value, index) => index < 3 ? value * annotationImage.width / observationCanvas.width : index < 6 ? value * annotationImage.height / observationCanvas.height : value),
      controls,
      rmsResidualPixels: rounded(rms), maximumResidualPixels: Math.max(...controls.map(control => control.residualPixels)),
      residualMeaning: 'Fit consistency only. It is not survey accuracy. Hand-drawn strokes, wall thickness, intended boundary placement and the source model remain uncertain.',
      registrationUncertainty: 'Approximately 1.1px fit residual at roughly 27px/m; annotate interior positions to no better than several decimetres. No calibrated uncertainty bound is established.',
      omittedRidgeControls: [2, 3, 15, 16],
    },
    floorGeometry: {
      method: 'Original horizontal LoD2 envelope section at the unchanged provisional index-2 elevation, minus the complete plan projections of the two resident-marked sloping roof wings.',
      provisionalElevationAboveBuildingBase: provisionalFloorElevation,
      provisionalPlaneCampusY: sourceSection.planeElevation,
      elevationStatus: 'Unchanged roof-height / 3 guide; not a measured storey elevation, and distinct from the roof plane used for registration.',
      sourceSectionAreaMetresSquared: rounded(sourceSection.area),
      retainedFloorOutlineAreaMetresSquared: rounded(multiArea(floorMulti)),
      removedFromSourceSectionAreaMetresSquared: rounded(sourceSection.area - multiArea(floorMulti)),
      greenProjectionAreaMetresSquared: rounded(multiArea(union(...exclusions.map(exclusion => [exclusion.polygon])))),
      sourceSectionLocalBoundsMetres: sourceBounds.map(rounded),
      sourceSectionDimensionsMetres: [rounded(sourceBounds[2] - sourceBounds[0]), rounded(sourceBounds[3] - sourceBounds[1])],
      annotatedFlatPlanAreaMetresSquared: rounded(multiArea(annotationPlan)),
      unassignedSteppedEdgeAreaMetresSquared: rounded(multiArea(unassignedStepEdges)),
      unassignedSteppedEdgePolygons: roundPolygons(unassignedStepEdges),
      unassignedMeaning: 'Source section beyond the annotated flat-roof footprint. Retained in the plate but given no room or circulation function; the screenshot does not resolve these edges.',
      numericalCleanup: 'Polygon clipping uses a 0.00000001 numerical comparison tolerance; isolated remnants below 0.000001m² are discarded. Candidate outer edges extend 0.05m before exact source clipping to avoid numerical circulation gaps along nearly orthogonal source walls; final source exterior vertices are unchanged.',
      noOccupancyClaim: 'Neither shell intersection nor a candidate room polygon proves occupied, rentable, habitable or safe space.',
    },
    roomInterpretation: {
      explicitlyDividedSketchBays: 7, estimatedPartitionBays: 20, candidateTotal: 20,
      confirmedRoomCount: 20,
      confirmedCounts: { sw: 4, east: 3, west: 4, left: 3, right: 3, north: 3 },
      confirmationSource: 'Resident double-check on 2026-11-15: all twenty top-floor rooms, including L1–L3, and their general hallway positions are correct; dimensions must be rechecked.',
      confirmationLimit: 'Room counts and general hallway positions are resident-confirmed. All twenty fitted room envelopes, divider coordinates, doorways and floor elevations remain unmeasured; study labels are not physical room numbers.',
      publicMapFloor2MarkerCount: 20,
      markerCountRole: 'Secondary aggregate crosscheck only; the current count is confirmed directly by the resident rather than inferred from map markers.',
      noRoomNumbers: 'All identifiers and alphabetic labels are study references; none represent actual physical room numbers or residents.',
      zoneMeasurements: zoneResults,
    },
    stairs: {
      registeredLocalBoundsMetres: originalStairBounds.map(rounded),
      correctedLocalBoundsMetres: bounds.stairs.map(rounded),
      schematicFlightLocalBoundsMetres: stairFlightBounds.map(rounded),
      approximateRunMetres: rounded(stairFlightBounds[3] - stairFlightBounds[1]),
      approximateEnclosureDepthMetres: rounded(bounds.stairs[3] - bounds.stairs[1]),
      approximateWidthMetres: rounded(bounds.stairs[2] - bounds.stairs[0]),
      approximateUpperLandingAxisDepthMetres: rounded(stairFlightBounds[1] - bounds.stairs[1]),
      approximateLowerLandingAxisDepthMetres: rounded(bounds.stairs[3] - stairFlightBounds[3]),
      runInCampusXZ: [[stairCenter, stairFlightBounds[1]], [stairCenter, stairFlightBounds[3]]].map(campus).map(point => point.map(rounded)),
      observed: regionMeasurements.stairs,
    },
    validation: {
      roomOverlapMetresSquared: rounded(overlapArea), spaceOutsideFloorMetresSquared: rounded(uncontainedArea),
      stairwellRoomOverlapMetresSquared: rounded(stairRoomOverlap),
      floorInsideExcludedGreenMetresSquared: rounded(greenOverlap), doorBoundaryChecksPassed: true,
      unchangedOtherRoomGeometryCount: unchangedRoomIds.length, separateHallwayRegions: corridors.length,
      sourceVerticesModified: false, approvedInteriorDataModified: false,
    },
  },
  level: {
    index: 2, label: '2. OG — left-side correction study',
    source: 'Resident-confirmed twenty-room count, left-side correction image and stairwell-entrance clarification supplied on 15 November 2026, aligned to Bavaria’s unchanged exterior model.',
    notes: `Twenty rooms and their general groups remain resident-confirmed. L1–L3 now shift between the marked source corners as three approximately ${correctedLeftBayWidth.toFixed(2)}m gross bays, retaining the previous roughly ${commonDepth.toFixed(2)}m model depth. The narrower stairwell is provisionally half a neighboring bay wide; its schematic flight leaves landing areas clear. The green-marked west-hall entrance into the stairwell is confirmed in location, with an illustrative 1.10m opening. The east hall's stairwell connection is unknown and is not invented. The other seventeen room polygons stay unchanged, including unresolved R1–R3 at about 2.69m gross width. Full apartment dimensions, service layouts, wall thickness, openings and floor height remain unmeasured. Study labels are not room numbers. Both lower floors retain the earlier frozen sketch.`,
    floorOutline: roundPolygons(floorMulti),
    excludedAreas: exclusions.map(({ id, label, polygon }) => ({ id, label, polygon: roundRing(polygon) })),
    sketchBoundaries, spaces, doors,
  },
};

// Keep the earlier lower-floor extrapolations reproducible, without silently
// propagating this unconfirmed top-floor dimensional candidate.
const baselineFile = new URL('../data/source/house55-2og-sketch-baseline.json', import.meta.url);
const baselineBytes = await readFile(baselineFile);
const baseline = JSON.parse(baselineBytes);
const repeatedSpaces = baseline.level.spaces, repeatedDoors = baseline.level.doors;
const repeatedSpaceMulti = union(...repeatedSpaces.map(space => [space.polygon, ...(space.holes || [])]));
const lowerMetadata = [];
const lowerLevels = [0, 1].map(index => {
  const name = index === 0 ? 'EG' : '1. OG';
  const sourceFloor = floorSection(building, building.height * index / 3);
  if (sourceFloor.openChains.length) throw new Error(`${name}: source floor section is open`);
  const sourceOutline = sourceFloor.polygons.map(({ outer, holes }) => [outer, ...holes]);
  const exteriorTrim = difference(repeatedSpaceMulti, sourceOutline);
  const trimmedArea = multiArea(exteriorTrim);
  const sourceBoundaryRings = sourceOutline.flat();
  const maximumTrim = exteriorTrim.length ? Math.max(...exteriorTrim.flat(2).map(point => Math.min(
    ...sourceBoundaryRings.flatMap(ring => ring.slice(1).map((b, i) => distanceToSegment(point, ring[i], b))),
  ))) : 0;
  if (maximumTrim > 0.002) throw new Error(`${name}: lower-floor exterior requires more than numerical source-edge trimming (${maximumTrim}m)`);
  const idForFloor = id => id.replace(/^study-55-2-/, `study-55-${index}-`);
  const lowerSpaces = repeatedSpaces.map(space => {
    const clipped = clean(intersection([space.polygon, ...(space.holes || [])], sourceOutline));
    if (clipped.length !== 1) throw new Error(`${name}: source clipping disconnected study space ${space.id}`);
    const { polygon, holes, ...semantics } = structuredClone(space);
    return {
      ...semantics, ...schemaPolygon(clipped[0]),
      id: idForFloor(space.id),
      label: space.kind === 'room' ? `Room ${space.shortLabel} — assumed layout`
        : space.kind === 'stairs' ? 'Stairs — assumed position' : 'Potential corridor — assumed layout',
      confidence: 'estimated',
      note: `${name}: assumed continuation of the earlier 2. OG sketch, before its dimensional refit; this lower-floor space was not observed. Earlier reference: ${space.note}`,
    };
  });
  // Check each independently serialized space rather than unioning rounded
  // shared edges again, which can amplify extremely short source segments.
  const serializedOutside = lowerSpaces.flatMap(space => difference([space.polygon, ...(space.holes || [])], sourceOutline));
  const outsideArea = multiArea(serializedOutside);
  const maximumSerializedOffset = serializedOutside.length ? Math.max(...serializedOutside.flat(2).map(point => Math.min(
    ...sourceBoundaryRings.flatMap(ring => ring.slice(1).map((b, i) => distanceToSegment(point, ring[i], b))),
  ))) : 0;
  if (outsideArea > 0.0001) throw new Error(`${name}: clipped study spaces still escape their source plate by ${outsideArea}m² / maximum ${maximumSerializedOffset}m`);
  const unassigned = clean(difference(sourceOutline, repeatedSpaceMulti));
  const lowerDoors = repeatedDoors.map(door => {
    const from = lowerSpaces.find(space => space.id === idForFloor(door.spaceId));
    return {
      ...structuredClone(door), id: idForFloor(door.id), spaceId: idForFloor(door.spaceId),
      ...(door.toSpaceId ? { toSpaceId: idForFloor(door.toSpaceId) } : {}),
      label: `Assumed opening — ${from.shortLabel}`,
      confidence: 'estimated',
      note: `${name}: hypothetical continuation of a schematic 2. OG opening; no lower-floor door position was supplied. ${door.note}`,
    };
  });
  lowerMetadata.push({
    index, extrapolatedFrom: 2,
    method: 'Resident-requested repetition of the earlier 2. OG sketch. The new top-floor dimensional candidate has not been propagated. Every lower-floor space and opening remains an estimate.',
    frozenSource: { path: 'data/source/house55-2og-sketch-baseline.json', sha256: createHash('sha256').update(baselineBytes).digest('hex'), sourceCommit: baseline.sourceCommit },
    floorPlateSource: 'Complete unmodified LoD2 horizontal section at this floor’s provisional guide; holes and disconnected components are retained.',
    provisionalElevationAboveBuildingBase: sourceFloor.floorElevation,
    provisionalPlaneCampusY: sourceFloor.planeElevation,
    sourceSectionAreaMetresSquared: rounded(sourceFloor.area),
    studySpaces: lowerSpaces.length, candidateRoomReferences: lowerSpaces.filter(space => space.kind === 'room').length,
    estimatedOpenings: lowerDoors.length,
    unassignedAreaMetresSquared: rounded(multiArea(unassigned)),
    unassignedPolygons: roundPolygons(unassigned),
    unassignedMeaning: 'Additional lower-floor wings and edge areas are visible in the source plate but receive no invented room, corridor, stair, count or use classification.',
    copiedTopFloorExclusions: false, copiedSolidSketchBoundaries: false,
    exteriorTrimAreaMetresSquared: rounded(trimmedArea),
    maximumExteriorTrimMetres: rounded(maximumTrim),
    exteriorTrimMeaning: 'Shared interior dividers and opening coordinates are retained. Outer space edges are clipped to this floor’s own source outline; sub-millimetre roof/ground quantization differences are not resolved by changing official vertices.',
    spaceOutsideFloorMetresSquared: rounded(outsideArea),
    maximumSerializedExteriorOffsetMetres: rounded(maximumSerializedOffset),
    noOccupancyClaim: 'The repeated twenty study references are not a complete or confirmed lower-floor room count, room-number inventory, measured layout or occupancy statement.',
  });
  return {
    index, label: `${name} — extrapolated study`, extrapolatedFrom: 2,
    source: 'Repeated from the earlier House 55 2. OG sketch at the resident’s request on 15 November 2026; this floor was not separately mapped or updated by the subsequent dimensional refit.',
    notes: 'All rooms, stairs, circulation and openings here repeat the earlier 2. OG sketch, before its dimensional refit. The new top-floor candidate has not been copied here. The full source floor plate is retained; additional lower-floor wings remain unassigned. The 20 displayed study references are not a confirmed or complete count for this lower floor.',
    floorOutline: roundPolygons(sourceOutline), spaces: lowerSpaces, doors: lowerDoors,
  };
});
study.levels = [...lowerLevels, study.level];
study.metadata.lowerFloorExtrapolation = lowerMetadata;
study.metadata.outputContract = {
  level: 'The corrected directly annotated index-2 study.',
  levels: 'All three study levels, in order EG/index0, 1. OG/index1, 2. OG/index2.',
  approvalStatus: 'All are unmeasured study records; none creates an approved interior or a measured elevation anchor.',
};
const generatedBuilding = {
  source: 'House 55 resident-confirmed 2. OG count with a corrected left block, stairwell and marked west-hall entrance; remaining room envelopes and lower-floor extrapolations retain their preceding study geometry.',
  sourceDate: '2026-11-15', levels: study.levels,
};
const campusData = JSON.parse(await readFile(new URL('../public/data/campus.json', import.meta.url)));
validateInteriorStudies({ schemaVersion: 1, buildings: { 55: generatedBuilding } }, campusData, lod2);

const outputPath = process.argv.slice(2).find(argument => !argument.startsWith('--')) || '/tmp/house55-study-geometry.json';
await writeFile(outputPath, `${JSON.stringify(study, null, 2)}\n`);
if (process.argv.includes('--write-provenance')) {
  await writeFile(new URL('../data/source/house55-2og-study-provenance.json', import.meta.url), `${JSON.stringify(study.metadata, null, 2)}\n`);
}
if (process.argv.includes('--write-study')) {
  const publicFile = new URL('../public/data/interior-studies.json', import.meta.url);
  const published = JSON.parse(await readFile(publicFile));
  published.buildings['55'] = { ...published.buildings['55'], ...generatedBuilding };
  validateInteriorStudies(published, campusData, lod2);
  await writeFile(publicFile, `${JSON.stringify(published, null, 2)}\n`);
}

// Small review-only SVG in screenshot coordinates, not shipped to the website.
const svgPath = outputPath.replace(/\.json$/, '') + '-overlay.svg';
const svg = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="1317" height="694" viewBox="0 0 1317 694">',
  '<rect width="1317" height="694" fill="#1b1c19"/>',
];
const svgRing = ring => ring.map(point => imagePixel(project(local(point))).map(value => value.toFixed(2)).join(',')).join(' ');
for (const polygon of floorMulti) svg.push(`<polygon points="${svgRing(polygon[0])}" fill="#34342d" stroke="#bdb8a5" stroke-width="2"/>`);
for (const space of spaces.filter(space => space.kind !== 'corridor')) {
  const color = space.kind === 'stairs' ? '#6da2f2' : space.confidence === 'sketch' ? '#ecad78' : '#d6c678';
  svg.push(`<polygon points="${svgRing(space.polygon)}" fill="${color}" fill-opacity=".09" stroke="${color}" stroke-width="2" ${space.confidence === 'estimated' ? 'stroke-dasharray="6 4"' : ''}/>`);
  if (space.stairFlight) svg.push(`<polygon points="${svgRing(space.stairFlight)}" fill="${color}" fill-opacity=".13" stroke="${color}" stroke-width="1" stroke-dasharray="3 3"/>`);
  const corners = withoutClosingPoint(space.polygon).map(local), center = [mean(corners.map(point => point[0])), mean(corners.map(point => point[1]))], [x, y] = imagePixel(project(center));
  const label = space.shortLabel || space.label;
  svg.push(`<text x="${x}" y="${y}" fill="${color}" text-anchor="middle" font-size="15" font-family="sans-serif">${label}</text>`);
}
for (const exclusion of exclusions) svg.push(`<polygon points="${svgRing(exclusion.polygon)}" fill="#6d9960" fill-opacity=".16" stroke="#6d9960" stroke-width="2" stroke-dasharray="5 7"/>`);
for (const door of doors) {
  const [a, b] = door.segment.map(point => imagePixel(project(local(point))));
  svg.push(`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#e4dfd1" stroke-width="5"/>`);
}
svg.push('</svg>');
await writeFile(svgPath, svg.join('\n'));
console.log(JSON.stringify({
  outputPath, svgPath, registrationRmsPixels: rounded(rms), confirmedUpstairsRoomCount: 20, sketchPositionRooms: 0, estimatedPartitionRooms: 20,
  floorAreaMetresSquared: rounded(multiArea(floorMulti)), removedGreenAreaMetresSquared: rounded(sourceSection.area - multiArea(floorMulti)),
  approximateStairDimensionsMetres: [study.metadata.stairs.approximateWidthMetres, study.metadata.stairs.approximateRunMetres],
  stairLeftWallShiftFromPreviousDimensionMetres: rounded(bounds.stairs[0] - priorDimensionBounds.stairs[0]),
  correctedLeftBayWidthMetres: correctedLeftBayWidth, approximateStairwellWidthMetres: stairwellWidth,
  commonGrossDepthMetres: commonDepth, commonDepthRoomReferences: depthInputs.length,
  lowerFloors: lowerMetadata.map(level => ({
    index: level.index, sourceAreaMetresSquared: level.sourceSectionAreaMetresSquared,
    unassignedAreaMetresSquared: level.unassignedAreaMetresSquared, spaces: level.studySpaces, openings: level.estimatedOpenings,
  })),
  validation: study.metadata.validation,
}, null, 2));
