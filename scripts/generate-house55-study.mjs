#!/usr/bin/env node
/**
 * Reproduce the House 55 / 2. OG resident-sketch geometry study.
 *
 * This does not publish interior data or modify the official building model.
 * Usage: node scripts/generate-house55-study.mjs [output.json] [--write-provenance]
 *
 * The default JSON output is /tmp/house55-study-geometry.json. After review,
 * its .level replaces only House 55's index-2 record in interior-studies.json;
 * preserve every other house/floor and the separate approved-interiors file.
 * --write-provenance writes .metadata to the archived study-provenance JSON.
 * The script never writes public study geometry automatically.
 *
 * The annotated screenshot is a manually observed research input. Its colored
 * lines are not survey measurements. Pixel observations are retained below so
 * the registration and chosen estimates can be reviewed independently.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { difference, intersection, setPrecision, union } from 'polyclip-ts';
import { floorSection } from '../src/sections.js';

const sourceFile = new URL('../public/data/lod2.json', import.meta.url);
const sourceBytes = await readFile(sourceFile);
const annotationFile = new URL('../data/source/house55-2og-resident-markup.png', import.meta.url);
const annotationBytes = await readFile(annotationFile);
const annotationSha256 = createHash('sha256').update(annotationBytes).digest('hex');
if (annotationSha256 !== '46e8288900b26170fa83ee93ae8bbaa68a0385e55280ade3d01583cd94a757ba') {
  throw new Error('The resident annotation changed: re-register its control points before regenerating');
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

const rect = ([x0, y0, x1, y1]) => close([[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(campus));
const chosenZones = [
  { key: 'sw-known-four', code: 'sw', name: 'SW', count: 4, axis: 0, cuts: swCuts, facing: 'top', exteriorEdges: [0, 2, 3], sketchEdges: [0], confidence: 'sketch',
    note: 'Four bays are explicitly divided in red. The gross boundaries follow rectified hand strokes; these are not physical room numbers or measured partitions.' },
  { key: 'east-known-three', code: 'east', name: 'East', count: 3, axis: 1, cuts: eastCuts, facing: 'left', exteriorEdges: [2, 3], sketchEdges: [0, 3], confidence: 'sketch',
    note: 'Three bays are explicitly divided in red. The separate upper question-mark block is not counted here; marks on lower exterior walls are not plan divisions.' },
  { key: 'west-question', code: 'west', name: 'West', count: 4, axis: 1, facing: 'right', exteriorEdges: [0, 1], sketchEdges: [1, 2], confidence: 'estimated',
    note: 'Question-mark zone: four equal candidate bays estimated from its facade run and the approximately 3m gross pitch of the marked bays. Count and dividers need resident confirmation.' },
  { key: 'center-left-question', code: 'center-left', name: 'Center left', count: 2, axis: 0, facing: 'bottom', exteriorEdges: [1], sketchEdges: [1, 2, 3], confidence: 'estimated',
    note: 'Question-mark zone: two equal candidate bays. Its roughly 6.7m run does not establish a room count; this is a provisional study choice.' },
  { key: 'center-right-question', code: 'center-right', name: 'Center right', count: 3, axis: 0, facing: 'top', exteriorEdges: [3], sketchEdges: [0, 1, 3], confidence: 'estimated',
    note: 'Weakest count estimate: three candidate bays in roughly 8.1m imply about 2.7m gross per bay before walls. Two bays remain plausible; do not interpret three as confirmed.' },
  { key: 'upper-right-question', code: 'upper-right', name: 'Upper right', count: 3, axis: 0, facing: 'bottom', exteriorEdges: [0, 1, 2], sketchEdges: [2], confidence: 'estimated',
    note: 'Question-mark zone: three equal candidate bays estimated from its roughly 9.4m facade run. Count and divider locations are unconfirmed.' },
];
const spaces = [], roomMultis = [], doorCandidates = [], zoneResults = [], sketchBoundaries = [];
let sketchNumber = 0;
for (const zone of chosenZones) {
  const box = bounds[zone.key];
  const first = box[zone.axis], last = box[zone.axis + 2];
  const cuts = [first, ...(zone.cuts || Array.from({ length: zone.count - 1 }, (_, index) => first + (last - first) * (index + 1) / zone.count)), last];
  const zoneRooms = [];
  const boundaryRing = rect(box);
  sketchBoundaries.push(...zone.sketchEdges.map(index => [boundaryRing[index], boundaryRing[index + 1]].map(point => point.map(rounded))));
  if (zone.cuts) for (const cut of zone.cuts) {
    sketchBoundaries.push((zone.axis === 0 ? [[cut, box[1]], [cut, box[3]]] : [[box[0], cut], [box[2], cut]]).map(campus).map(point => point.map(rounded)));
  }
  for (let index = 0; index < zone.count; index++) {
    const cell = [...box];
    cell[zone.axis] = cuts[index]; cell[zone.axis + 2] = cuts[index + 1];
    const clippingCell = [...cell];
    // This margin only crosses the target exterior edge before intersection.
    // The resulting wall is the untouched source edge. It prevents tiny gaps
    // caused by the source model's almost-but-not-perfectly orthogonal walls.
    for (const edge of zone.exteriorEdges) if (Math.abs(cell[edge] - box[edge]) < EPSILON) clippingCell[edge] += edge < 2 ? -0.05 : 0.05;
    const clipped = clean(intersection(annotationPlan, [rect(clippingCell)]));
    if (clipped.length !== 1 || multiArea(clipped) < 5) throw new Error(`${zone.key} bay ${index + 1} does not fit the annotated floor`);
    const id = `study-55-2-${zone.code}-${index + 1}`;
    const label = zone.confidence === 'sketch' ? `Sketch room ${String.fromCharCode(65 + sketchNumber++)}` : `${zone.name} estimate ${index + 1}`;
    const shortLabel = zone.confidence === 'sketch' ? label.at(-1) : `${({ west: 'W', 'center-left': 'L', 'center-right': 'R', 'upper-right': 'N' })[zone.code]}${index + 1}`;
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
    id: zone.key, selectedCount: zone.count, confidence: zone.confidence, note: zone.note,
    rectifiedLocalBoundsMetres: box.map(rounded), runMetres: rounded(last - first),
    averageGrossBayMetres: rounded((last - first) / zone.count), rooms: zoneRooms,
    observed: regionMeasurements[zone.key],
  });
}

const stairMulti = intersection(annotationPlan, [rect(bounds.stairs)]);
if (stairMulti.length !== 1) throw new Error('Expected one registered stair zone');
const stairId = 'study-55-2-stairs';
spaces.push({
  id: stairId, label: 'Stairs — resident mark', shortLabel: 'Stairs', kind: 'stairs', confidence: 'sketch',
  note: 'The resident marks central stairs in blue. This rectangle records their approximate position and run direction, not a surveyed stair enclosure, riser count, width or landing arrangement.',
  ...schemaPolygon(stairMulti[0]),
});
const circulation = clean(difference(annotationPlan, ...roomMultis, stairMulti));
const mainCirculation = circulation.filter(polygon => polygonArea(polygon) > 1);
if (mainCirculation.length !== 1) throw new Error(`Expected one potential corridor, found ${mainCirculation.length}; inspect sketch boundaries`);
const corridorId = 'study-55-2-potential-corridor';
spaces.push({
  id: corridorId, label: 'Potential corridor', shortLabel: 'Hall', kind: 'corridor', confidence: 'estimated',
  note: 'Connected remainder between sketch bays and the marked stair zone, limited to the annotated flat-roof plan. It is a circulation hypothesis, not an approved route, egress plan or proof of usable floor area.',
  ...schemaPolygon(mainCirculation[0]),
});
const doors = doorCandidates.map(door => ({ ...door, toSpaceId: corridorId }));
const stairBox = bounds.stairs;
const stairCenter = (stairBox[0] + stairBox[2]) / 2;
doors.push({
  id: 'study-55-2-opening-stairs', label: 'Estimated stair access', spaceId: stairId, toSpaceId: corridorId,
  confidence: 'estimated', note: 'Illustrative 1.10m access gap at the open end of the blue stair mark; this is not evidence of a door leaf or an actual measured landing.',
  segment: [[stairCenter - 0.55, stairBox[3]], [stairCenter + 0.55, stairBox[3]]].map(campus).map(point => point.map(rounded)),
});

// Check topology before handing the study to the application schema.
let overlapArea = 0;
for (let a = 0; a < roomMultis.length; a++) for (let b = a + 1; b < roomMultis.length; b++) overlapArea += multiArea(intersection(roomMultis[a], roomMultis[b]));
if (overlapArea > 0.001) throw new Error(`Candidate rooms overlap by ${overlapArea}m²`);
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
      numericalCleanup: 'Polygon clipping uses 0.00000001m precision; isolated remnants below 0.000001m² are discarded. Candidate outer edges extend 0.05m before exact source clipping to avoid numerical circulation gaps along nearly orthogonal source walls; final source exterior vertices are unchanged.',
      noOccupancyClaim: 'Neither shell intersection nor a candidate room polygon proves occupied, rentable, habitable or safe space.',
    },
    roomInterpretation: {
      explicitlyDividedSketchBays: 7, estimatedBays: 12, candidateTotal: 19,
      knownCounts: { southwest: 4, east: 3 },
      selectedUnknownCounts: { west: 4, centerLeft: 2, centerRight: 3, upperRight: 3 },
      alternateCenterRightCount: 2, alternateCandidateTotal: 18,
      publicMapFloor2MarkerCount: 20,
      countDiscrepancy: 'The public resident-map aggregate reports 20 floor-2 markers. This does not establish 20 physical rooms. The 19-bay sketch interpretation remains provisional; an omitted bay, a different typology, a marker issue or changed layout is unresolved. No extra room is forced to match the aggregate.',
      noRoomNumbers: 'All identifiers and alphabetic labels are study references; none represent actual physical room numbers or residents.',
      zoneMeasurements: zoneResults,
    },
    stairs: {
      registeredLocalBoundsMetres: bounds.stairs.map(rounded),
      approximateRunMetres: rounded(bounds.stairs[3] - bounds.stairs[1]),
      approximateWidthMetres: rounded(bounds.stairs[2] - bounds.stairs[0]),
      runInCampusXZ: [[stairCenter, stairBox[1]], [stairCenter, stairBox[3]]].map(campus).map(point => point.map(rounded)),
      observed: regionMeasurements.stairs,
    },
    validation: {
      roomOverlapMetresSquared: rounded(overlapArea), spaceOutsideFloorMetresSquared: rounded(uncontainedArea),
      floorInsideExcludedGreenMetresSquared: rounded(greenOverlap), doorBoundaryChecksPassed: true,
      sourceVerticesModified: false, publicInteriorDataModified: false,
    },
  },
  level: {
    index: 2, label: '2. OG — resident sketch study',
    source: 'Resident sketch supplied on 15 November 2026, aligned to Bavaria’s official exterior model.',
    notes: 'Draft only: seven marked bays, twelve estimated bays, approximate stairs and a potential corridor. Nineteen candidates are not a confirmed room count; actual room numbers, doors and measured floor height are unknown.',
    floorOutline: roundPolygons(floorMulti),
    excludedAreas: exclusions.map(({ id, label, polygon }) => ({ id, label, polygon: roundRing(polygon) })),
    sketchBoundaries, spaces, doors,
  },
};

const outputPath = process.argv.slice(2).find(argument => !argument.startsWith('--')) || '/tmp/house55-study-geometry.json';
await writeFile(outputPath, `${JSON.stringify(study, null, 2)}\n`);
if (process.argv.includes('--write-provenance')) {
  await writeFile(new URL('../data/source/house55-2og-study-provenance.json', import.meta.url), `${JSON.stringify(study.metadata, null, 2)}\n`);
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
  outputPath, svgPath, registrationRmsPixels: rounded(rms), candidateRooms: 19, markedRooms: 7, estimatedRooms: 12,
  floorAreaMetresSquared: rounded(multiArea(floorMulti)), removedGreenAreaMetresSquared: rounded(sourceSection.area - multiArea(floorMulti)),
  approximateStairDimensionsMetres: [study.metadata.stairs.approximateWidthMetres, study.metadata.stairs.approximateRunMetres],
  validation: study.metadata.validation,
}, null, 2));
