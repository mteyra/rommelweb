import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {union} from 'polyclip-ts';
import {createRegistration} from './generate-old-house-studies.mjs';
import {createOldHouseModuleLayouts} from './old-house-module-layout.mjs';
import {validateInteriorStudies} from '../src/interior-studies.js';

const clone = value => structuredClone(value);
const round = value => Math.round(value * 1e9) / 1e9;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rect = (x, y, width, height) =>
  [[x, y], [x + width, y], [x + width, y + height], [x, y + height], [x, y]].map(point => point.map(round));
const area = ring => Math.abs(ring.slice(1).reduce((sum, point, index) =>
  sum + ring[index][0] * point[1] - point[0] * ring[index][1], 0) / 2);
const eastBanks = new Set(['E', 'N', 'R']);
const roomKey = room => `${room.bank}-${room.label}`;
const roomLabel = room => `Room ${room.label}${room.label === 'E' ? ` · ${room.bank === 'A' ? 'A wing' : 'East wing'}` : ''}`;
const coreTranslation = [0, -0.4];

// The annotations identify ends of hall-facing room walls, not measured jamb
// offsets. Keep that distinction explicit in both the data and the viewer.
const doorEnds = {
  'E-G': 'bottom', 'E-F': 'top', 'E-E': 'bottom',
  'N-N3': 'right', 'N-N2': 'left', 'N-N1': 'right', 'N-N0': 'left',
  'R-R3': 'left', 'R-R2': 'right', 'R-R1': 'left',
  'L-L3': 'left', 'L-L2': 'left', 'L-L1': 'right',
  'A-E': 'left', 'A-D': 'right', 'A-C': 'left', 'A-B': 'right', 'A-A': 'left',
  'W-W4': 'top', 'W-W3': 'bottom', 'W-W2': 'top',
};
const notes = [
  'Yellow House 51 top-floor arrangement follows the resident annotation of 15 November 2026; EG and 1. OG remain exactly as previously drawn and await separate instructions.',
  'The twenty-one single apartments are the nineteen existing top-floor modules plus E at the left of the A wing and N0 at the right of the N wing. The W wing retains W4, W3 and W2 only.',
  'The independent floor outline is the union of whole 3.10 m modules, 1.40 m hallways and the accepted 2.70 x 7.40 m stair block. The blue-marked extensions and other residual source-shell gaps are removed from this floor only.',
  'Clear single interiors remain 2.70 x 6.00 m with two 0.20 m side allocations. The room width is resident measured; room length, wall allocations, hall width and stair split remain the accepted modeling assumptions.',
  'The lime marks determine which end of each room-to-hall wall receives its door. Doorways are drawn 0.90 m wide with their centre 0.60 m from the indicated clear-room edge, leaving a schematic 0.15 m jamb. These offsets are not new measurements.',
  'Both E labels are retained as drawn: the added E in the A wing and the existing E in the East wing have separate identifiers and descriptive selection labels.',
  'The existing rigid Yellow registration and its retained 0.40 m core offset keep the stair block aligned with the untouched lower floors. Room dimensions are neither fitted nor scaled to the folded exterior.',
  'Layout window symbols, door offsets, stair treads and room internals remain schematic. The folded Yellow exterior and all original facade window evidence are preserved separately.',
];

function assertFrame(frame) {
  const {originCampusXZ, axisU, axisV} = frame || {};
  if (![originCampusXZ, axisU, axisV].every(point =>
    Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))
    || Math.abs(Math.hypot(...axisU) - 1) > 1e-8
    || Math.abs(Math.hypot(...axisV) - 1) > 1e-8
    || Math.abs(axisU[0] * axisV[0] + axisU[1] * axisV[1]) > 1e-8
    || Math.abs(axisU[0] * axisV[1] - axisU[1] * axisV[0] - 1) > 1e-8) {
    throw Error('House 51 requires a rigid, orientation-preserving coordinate frame in metres.');
  }
}

function coordinateFrame(topPlan, lod2, oldHouseLayouts) {
  let retained = oldHouseLayouts?.houses?.['51']?.coordinateFrame;
  if (!retained) {
    const source = lod2?.buildings.find(building => building.number === '55');
    const target = lod2?.buildings.find(building => building.number === '51');
    if (!source || !target) throw Error('House 55 and House 51 LoD2 records are required for registration.');
    const registration = createRegistration(source, target);
    const [a, b, c, d] = registration.manifest.rigid;
    const rotate = ([x, y]) => [a * x + b * y, c * x + d * y];
    retained = {
      originCampusXZ: registration.mapPoint(topPlan.coordinateFrame.originCampusXZ),
      axisU: rotate(topPlan.coordinateFrame.axisU),
      axisV: rotate(topPlan.coordinateFrame.axisV),
    };
  }
  assertFrame(retained);
  const frame = {
    originCampusXZ: retained.originCampusXZ.map((value, axis) =>
      value + coreTranslation[0] * retained.axisU[axis] + coreTranslation[1] * retained.axisV[axis]),
    axisU: clone(retained.axisU), axisV: clone(retained.axisV),
    basis: 'Existing rigid Yellow registration, with the retained [0, -0.4] m core translation absorbed into the origin. Local dimensions are unscaled metres.',
  };
  assertFrame(frame);
  return frame;
}

function shiftedRoom(source, label, dx, dy) {
  const move = ring => ring.map(([x, y]) => [round(x + dx), round(y + dy)]);
  return {
    ...clone(source), label,
    polygon: move(source.polygon), modulePolygon: move(source.modulePolygon),
    sideWalls: source.sideWalls.map(move),
    doorSegment: move(source.doorSegment), windowSegment: move(source.windowSegment),
  };
}

function setDoor(room) {
  const end = doorEnds[roomKey(room)];
  if (!end) throw Error(`Missing annotated door end for ${roomKey(room)}.`);
  const minX = Math.min(...room.polygon.map(point => point[0]));
  const maxX = Math.max(...room.polygon.map(point => point[0]));
  const minY = Math.min(...room.polygon.map(point => point[1]));
  const maxY = Math.max(...room.polygon.map(point => point[1]));
  const horizontal = room.rotation === 0;
  const center = end === 'left' ? minX + 0.6 : end === 'right' ? maxX - 0.6
    : end === 'top' ? minY + 0.6 : maxY - 0.6;
  const wall = horizontal ? room.doorSegment[0][1] : room.doorSegment[0][0];
  room.doorSegment = (horizontal ? [[center - 0.45, wall], [center + 0.45, wall]]
    : [[wall, center - 0.45], [wall, center + 0.45]]).map(point => point.map(round));
  room.doorPlacement = {
    wall: room.bank === 'E' ? 'right' : room.bank === 'W' ? 'left'
      : ['N', 'L'].includes(room.bank) ? 'top' : 'bottom',
    end, width: 0.9, centerOffsetFromClearEdge: 0.6, jambOffsetFromClearEdge: 0.15,
    basis: 'Door end follows the resident lime mark; width and exact offset are schematic.',
  };
}

function createLocalPlan(topPlan, frame) {
  const rooms = [];
  for (const source of topPlan.rooms) {
    if (source.bank === 'W' && source.label === 'W1') continue;
    if (source.bank === 'A' && source.label === 'D') rooms.push(shiftedRoom(source, 'E', -3.1, 0));
    rooms.push(clone(source));
    if (source.bank === 'N' && source.label === 'N1') rooms.push(shiftedRoom(source, 'N0', 3.1, 0));
  }
  if (rooms.length !== 21) throw Error('Yellow top floor must contain exactly twenty-one complete single modules.');
  rooms.forEach(room => {
    room.id = `module-51-2-room-${roomKey(room)}`;
    setDoor(room);
  });
  const corridors = topPlan.corridors.map(source => ({
    ...clone(source), id: `module-51-2-hall-${source.bank}`,
    polygon: source.bank === 'N' ? rect(-1.9, 7.4, 12.4, 1.4)
      : source.bank === 'A' ? rect(25.6, -1.4, 15.5, 1.4)
        : source.bank === 'W' ? rect(28.7, 0, 1.4, 9.3) : clone(source.polygon),
  }));
  const stair = clone(topPlan.stair);
  const shellPolygons = union(
    ...rooms.map(room => [room.modulePolygon]),
    ...corridors.map(hall => [hall.polygon]),
    [stair.polygon],
  );
  if (shellPolygons.length !== 1 || shellPolygons[0].length !== 1) {
    throw Error('Yellow top-floor modules must form one connected outline without residual holes.');
  }
  const outline = shellPolygons[0][0].map(point => point.map(round));
  const wallBands = rooms.flatMap(room => room.sideWalls.map((polygon, index) => ({
    id: `module-51-2-wall-${roomKey(room)}-${index}`,
    label: `${roomLabel(room)} side wall ${index + 1}`, polygon: clone(polygon),
  })));
  return {
    schemaVersion: 1, house: '51', levelIndex: 2, status: 'resident-module-layout', units: 'metres',
    sourceTemplate: 'public/data/house55-module-layout.json',
    sourceHashes: {'public/data/house55-module-layout.json': hash(topPlan)},
    sourceAnnotation: {
      path: 'data/source/house51-2og-resident-annotation.png',
      sha256: '1f898a8bcfc9a1030232d294554a3328c3b4001ca6dcc0d85e38abc4a80072d9',
    },
    dimensions: clone(topPlan.dimensions), coordinateFrame: frame,
    retainedCoreTranslation: clone(coreTranslation),
    shell: {outline, holes: []}, rooms, corridors, stair, wallBands,
    outlineDimensions: outline.slice(1).map((b, index) => ({
      a: outline[index], b, length: round(Math.hypot(b[0] - outline[index][0], b[1] - outline[index][1])),
    })),
    unassignedPolygons: [],
    totals: {
      roomCount: rooms.length, roomArea: round(rooms.reduce((sum, room) => sum + area(room.polygon), 0)),
      sideWallArea: round(wallBands.reduce((sum, wall) => sum + area(wall.polygon), 0)),
      bankHallArea: round(corridors.reduce((sum, hall) => sum + area(hall.polygon), 0)),
      stairArea: round(area(stair.polygon)), shellArea: round(area(outline)), unassignedArea: 0,
    },
    notes: clone(notes),
  };
}

function createYellowStudyLevel(plan, previous) {
  const {originCampusXZ: origin, axisU, axisV} = plan.coordinateFrame;
  const point = ([x, y]) => origin.map((value, axis) => round(value + x * axisU[axis] + y * axisV[axis]));
  const ring = polygon => polygon.map(point);
  const eastId = 'module-51-2-hall-east', westId = 'module-51-2-hall-west', stairId = 'module-51-2-stairs';
  const hallId = bank => eastBanks.has(bank) ? eastId : westId;
  const spaces = plan.rooms.map(room => ({
    id: room.id, label: roomLabel(room), shortLabel: room.label, kind: 'room', confidence: 'estimated',
    note: 'Resident-annotated top-floor position. Clear interior 2.70 x 6.00 m = 16.20 square metres, with two external 0.20 m side allocations giving a 3.10 m module. Internal bathroom and kitchen partitions remain unresolved.',
    polygon: ring(room.polygon),
  }));
  for (const east of [true, false]) {
    const polygons = union(...plan.corridors.filter(hall => eastBanks.has(hall.bank) === east).map(hall => [hall.polygon]));
    if (polygons.length !== 1 || polygons[0].length !== 1) throw Error('Yellow bank hallways must be connected without holes.');
    const label = east ? 'East hall' : 'West hall';
    spaces.push({
      id: east ? eastId : westId, label, shortLabel: label, kind: 'corridor', confidence: 'estimated',
      note: 'Continuous 1.40 m hallway joining the resident-annotated room modules.', polygon: ring(polygons[0][0]),
    });
  }
  spaces.push({
    id: stairId, label: 'Stairwell', shortLabel: 'Stairs', kind: 'stairs', confidence: 'estimated',
    note: 'Accepted 2.70 m split with a 1.30 m flight column and 1.40 m walkway. Registration retains alignment to the untouched lower-floor stair block; treads, flight run, landings and openings remain schematic.',
    polygon: ring(plan.stair.polygon), stairFlight: ring(plan.stair.flightPolygon),
  });
  const doors = plan.rooms.map(room => ({
    id: `module-51-2-door-${roomKey(room)}`, label: `${roomLabel(room)} doorway`, spaceId: room.id,
    toSpaceId: hallId(room.bank), confidence: 'estimated',
    note: `Door follows the lime mark at the ${room.doorPlacement.end} end of the ${room.doorPlacement.wall} room-to-hall wall. Its 0.90 m width, 0.60 m centre offset from the clear edge and 0.15 m jamb are schematic.`,
    segment: ring(room.doorSegment),
  }));
  plan.stair.connectionSegments.forEach((segment, index) => doors.push({
    id: `module-51-2-stair-door-${index}`, label: `${index ? 'West' : 'East'} hall stair entry`,
    spaceId: stairId, toSpaceId: index ? westId : eastId, confidence: 'estimated',
    note: 'Illustrative 0.90 m entrance connecting the hallway to its stair landing.', segment: ring(segment),
  }));
  const layoutWindows = plan.rooms.map(room => ({
    id: `module-51-2-window-${roomKey(room)}`, label: `${roomLabel(room)} window`,
    spaceId: room.id, confidence: 'estimated',
    note: 'Schematic 1.05 m opening on the independent room facade. Yellow’s original folded source window evidence remains separate.',
    segment: ring(room.windowSegment),
  }));
  [
    [[6.175, -1.9], [7.225, -1.9]],
    [[-1.9, 7.575], [-1.9, 8.625]],
    [[40, 0], [41.05, 0]],
    [[28.875, 9.3], [29.925, 9.3]],
  ].forEach((segment, index) => layoutWindows.push({
    id: `module-51-2-window-shared-${index}`, label: `Shared window ${index + 1}`, confidence: 'estimated',
    note: 'Schematic hallway opening on the independent outline; this does not establish an observed facade window.',
    segment: ring(segment),
  }));
  const level = {
    index: 2, label: '2. OG · module layout', layoutBasis: 'resident-module-layout',
    source: 'Resident Yellow House 51 top-floor annotation, 15 November 2026: add A-wing E and N0, retain the three-room W wing, remove the blue-marked residual extensions and place doors at the marked ends.',
    notes: notes.join(' '), floorOutline: [{outer: ring(plan.shell.outline)}], spaces, doors, layoutWindows,
    wallBands: plan.wallBands.map(wall => ({
      ...wall, polygon: ring(wall.polygon), confidence: 'estimated',
      note: 'One 0.20 m side-wall allocation. Adjacent singles retain both allocations, totaling 0.40 m.',
    })),
    dimensionGuides: [],
  };
  for (const key of ['windows', 'windowCoverage']) {
    if (previous[key] !== undefined) level[key] = clone(previous[key]);
  }
  return level;
}

/** Replace only House 51 / 2. OG; preserve every other level and building. */
export function createHouse51TopFloorLayout({studies, lod2, topPlan, oldHouseLayouts}) {
  if (topPlan?.house !== '55' || topPlan.levelIndex !== 2 || topPlan.status !== 'resident-module-layout') {
    throw Error('Expected the accepted independent House 55 top-floor module plan.');
  }
  const previous = studies?.buildings?.['51'];
  const levelIndex = previous?.levels.findIndex(level => level.index === 2);
  if (!previous || levelIndex < 0) throw Error('Missing the existing Yellow House 51 top floor.');
  const frame = coordinateFrame(topPlan, lod2, oldHouseLayouts);
  const plan = createLocalPlan(topPlan, frame);
  const result = clone(studies);
  result.buildings['51'].levels[levelIndex] = createYellowStudyLevel(plan, previous.levels[levelIndex]);
  result.buildings['51'].source = 'Yellow House 51: the top floor follows the resident annotation with twenty-one single modules, added E and N0, marked door ends and a complete independent outline. EG and 1. OG retain their earlier provisional House 55 module fits inside the original source floors for separate resident review. Folded exterior evidence remains unchanged.';
  return {studies: result, plan};
}

async function main() {
  const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const [studies, lod2, topPlan, firstFloorPlan, groundFloorPlan, oldHouseLayouts, campus] = await Promise.all([
    read('public/data/interior-studies.json'), read('public/data/lod2.json'),
    read('public/data/house55-module-layout.json'), read('public/data/house55-first-floor-layout.json'),
    read('public/data/house55-ground-floor-layout.json'), read('public/data/old-house-module-layouts.json'),
    read('public/data/campus.json'),
  ]);
  const {studies: updated, plan} = createHouse51TopFloorLayout({studies, lod2, topPlan, oldHouseLayouts});
  const remainingFits = createOldHouseModuleLayouts({
    studies: updated, lod2, topPlan, firstFloorPlan, groundFloorPlan,
  });
  // Refresh the provisional catalog as part of this command, but never let
  // that housekeeping rewrite a lower floor or another completed house.
  assert.deepEqual(remainingFits.studies, updated,
    'Refreshing the remaining provisional catalog must preserve every study record.');
  validateInteriorStudies(updated, campus, lod2);
  await writeFile(new URL('../public/data/house51-top-floor-layout.json', import.meta.url), `${JSON.stringify(plan, null, 2)}\n`);
  await writeFile(new URL('../public/data/interior-studies.json', import.meta.url), `${JSON.stringify(updated, null, 2)}\n`);
  await writeFile(new URL('../public/data/old-house-module-layouts.json', import.meta.url), `${JSON.stringify(remainingFits.metadata, null, 2)}\n`);
  console.log(`Generated House 51 / 2. OG: ${plan.totals.roomCount} singles, annotated door ends, ${plan.totals.shellArea.toFixed(2)} m² independent outline.`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
