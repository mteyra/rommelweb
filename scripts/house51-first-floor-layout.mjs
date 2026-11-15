import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {union, intersection} from 'polyclip-ts';
import {createOldHouseModuleLayouts} from './old-house-module-layout.mjs';
import {validateInteriorStudies} from '../src/interior-studies.js';

const clone = value => structuredClone(value);
const round = value => Math.round(value * 1e9) / 1e9;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rect = (x, y, width, depth) => [
  [x, y], [x + width, y], [x + width, y + depth], [x, y + depth], [x, y],
].map(point => point.map(round));
const area = ring => Math.abs(ring.slice(1).reduce((sum, point, index) =>
  sum + ring[index][0] * point[1] - point[0] * ring[index][1], 0) / 2);
const multiArea = polygons => polygons.reduce((sum, polygon) =>
  sum + area(polygon[0]) - polygon.slice(1).reduce((holes, ring) => holes + area(ring), 0), 0);
const eastBanks = new Set(['E', 'N', 'R']);
const roomKey = room => `${room.bank}-${room.label}`;
const roomLabel = room => `Room ${room.label}${['E', 'F'].includes(room.label)
  ? ` · ${room.bank === 'A' ? 'A wing' : 'East wing'}` : ''}`;
const annotation = {
  path: 'data/source/house51-1og-resident-annotation.png',
  sha256: 'a1b3965b7afcb579224086779bbe771d562ca4411f50321b8ebf6c7711100567',
};
const doorEnds = {
  'E-H': 'top', 'E-G': 'bottom', 'E-F': 'top', 'E-E': 'bottom',
  'N-N4': 'left', 'N-N3': 'right', 'N-N2': 'left', 'N-N1': 'right', 'N-N0': 'left',
  'R-R3': 'left', 'R-R2': 'right', 'R-R1': 'left',
  'L-L3': 'left', 'L-L2': 'left', 'L-L1': 'right',
  'A-F': 'left', 'A-E': 'right', 'A-D': 'left', 'A-C': 'right',
  'W-W4': 'top', 'W-W3': 'bottom', 'W-W2': 'top', 'W-W1': 'bottom',
};
const notes = [
  'House 51 / 1. OG is the second physical storey shown in the resident annotation. Only this floor changes; EG, the accepted 2. OG and all other houses are preserved.',
  'The plan has twenty-three single apartments and one shared A envelope. G-H, N3-N4 and W1 are divided into singles; N0 and two A-bank singles are added. The blue-covered extra W-row is ignored.',
  'The enlarged A bank moves right by one 3.10 m pitch from its unaligned sketch position. Its leftmost F module and L1 both start at local U=25.60 m; both clear interiors start at U=25.80 m. The stair and R/L core do not move.',
  'Single interiors remain 2.70 x 6.00 m, with two 0.20 m side allocations and 3.10 m pitch. Halls remain 1.40 m wide; shared A uses the accepted 6.20 x 7.40 m gross envelope with unresolved internals.',
  'The two balcony enclosures fill the remaining 6.20 m core-side gaps. Their 2.90 m depth is inherited from the accepted balcony assumption, not measured from this drawing.',
  'Visible lime marks identify doorway ends. Openings are schematic: 0.90 m wide, centred 0.60 m from the indicated edge with a 0.15 m jamb. W1 has no distinct uncovered lime mark; its bottom-end doorway continues the adjacent alternating pattern. The West balcony doorway is schematic near the stairs.',
  'The outline is the complete union of modules, halls, stair and balconies, without residual gray floor. The accepted Yellow coordinate frame retains the absorbed 0.40 m core offset; geometry is not scaled to the folded exterior.',
  'Room facade window symbols, doorway offsets, stair treads and internal fittings remain schematic. Folded exterior geometry and its source window evidence remain separate and unchanged.',
];

function assertFrame(frame) {
  const {originCampusXZ, axisU, axisV} = frame || {};
  if (![originCampusXZ, axisU, axisV].every(point =>
    Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))
    || Math.abs(Math.hypot(...axisU) - 1) > 1e-8
    || Math.abs(Math.hypot(...axisV) - 1) > 1e-8
    || Math.abs(axisU[0] * axisV[0] + axisU[1] * axisV[1]) > 1e-8
    || Math.abs(axisU[0] * axisV[1] - axisU[1] * axisV[0] - 1) > 1e-8) {
    throw Error('House 51 requires the accepted rigid coordinate frame in unscaled metres.');
  }
}

function shiftedRoom(source, label, du = 0, dv = 0) {
  assert.ok(source, `Missing source module for ${label}.`);
  const move = ring => ring.map(([u, v]) => [round(u + du), round(v + dv)]);
  return {
    ...clone(source), label,
    polygon: move(source.polygon), modulePolygon: move(source.modulePolygon),
    sideWalls: source.sideWalls.map(move),
    doorSegment: move(source.doorSegment), windowSegment: move(source.windowSegment),
  };
}

function setDoor(room) {
  const key = roomKey(room), end = doorEnds[key];
  assert.ok(end, `Missing doorway end for ${key}.`);
  const u = room.polygon.map(point => point[0]), v = room.polygon.map(point => point[1]);
  const limits = {left: Math.min(...u), right: Math.max(...u), top: Math.min(...v), bottom: Math.max(...v)};
  const wall = room.bank === 'E' ? 'right' : room.bank === 'W' ? 'left'
    : ['N', 'L'].includes(room.bank) ? 'top' : 'bottom';
  const center = limits[end] + (['left', 'top'].includes(end) ? 0.6 : -0.6);
  room.doorSegment = (['left', 'right'].includes(wall)
    ? [[limits[wall], center - 0.45], [limits[wall], center + 0.45]]
    : [[center - 0.45, limits[wall]], [center + 0.45, limits[wall]]]).map(point => point.map(round));
  room.doorPlacement = {
    wall, end, width: 0.9, centerOffsetFromClearEdge: 0.6, jambOffsetFromClearEdge: 0.15,
    evidence: key === 'W-W1' ? 'schematic-continuation' : 'resident-lime-mark',
    basis: key === 'W-W1'
      ? 'No distinct uncovered lime mark is visible for W1. Its bottom-end doorway continues the neighboring alternating corner pattern; placement, width and offsets are schematic.'
      : 'The doorway end follows the resident lime mark; its width and exact corner offsets are schematic.',
  };
}

function createLocalPlan(topPlan) {
  const source = (bank, label) => topPlan.rooms.find(room => room.bank === bank && room.label === label);
  const rooms = [
    shiftedRoom(source('E', 'G'), 'H', 0, -3.1),
    ...['G', 'F', 'E'].map(label => shiftedRoom(source('E', label), label)),
    shiftedRoom(source('N', 'N3'), 'N4', -3.1, 0),
    ...['N3', 'N2', 'N1', 'N0'].map(label => shiftedRoom(source('N', label), label)),
    ...['R3', 'R2', 'R1'].map(label => shiftedRoom(source('R', label), label)),
    ...['L3', 'L2', 'L1'].map(label => shiftedRoom(source('L', label), label)),
    // The enlarged bank starts at L1's LEFT edge, not its right edge. Existing
    // top-floor modules already occupy the exact final U positions needed.
    shiftedRoom(source('A', 'E'), 'F'),
    shiftedRoom(source('A', 'D'), 'E'),
    shiftedRoom(source('A', 'C'), 'D'),
    shiftedRoom(source('A', 'B'), 'C'),
    ...['W4', 'W3', 'W2'].map(label => shiftedRoom(source('W', label), label)),
    shiftedRoom(source('W', 'W2'), 'W1', 0, 3.1),
  ];
  assert.equal(rooms.length, 23, 'Yellow 1. OG must have twenty-three single modules.');
  rooms.forEach(room => {
    room.id = `module-51-1-room-${roomKey(room)}`;
    setDoor(room);
  });
  const sharedApartments = [{
    id: 'module-51-1-shared-A', label: 'A', bank: 'A', kind: 'shared',
    polygon: rect(38, -7.4, 6.2, 7.4),
    width: 6.2, depth: 7.4, area: 45.88, areaBasis: 'assumed-gross-envelope', moduleCount: 2,
    doorSegment: [[38, -1.05], [38, -0.15]],
    doorPlacement: {
      wall: 'left', end: 'bottom', width: 0.9, centerOffsetFromEnvelopeEdge: 0.6, jambOffsetFromEnvelopeEdge: 0.15,
      evidence: 'resident-lime-mark',
      basis: 'The left-wall doorway near the bottom follows the lime mark. Width and corner offsets are schematic.',
    },
    windowSegments: [[[39.025, -7.4], [40.075, -7.4]], [[42.125, -7.4], [43.175, -7.4]]],
  }];
  const hallSpecs = [
    ['E', 6, -5, 1.4, 12.4], ['N', -5, 7.4, 15.5, 1.4], ['R', 7.4, 6, 9.3, 1.4],
    ['L', 19.4, 0, 9.3, 1.4], ['A', 25.6, -1.4, 12.4, 1.4], ['W', 28.7, 0, 1.4, 12.4],
  ];
  const corridors = hallSpecs.map(([bank, u, v, width, depth]) => ({
    id: `module-51-1-hall-${bank}`, label: `${bank} bank hallway`, bank,
    polygon: rect(u, v, width, depth), width: 1.4,
  }));
  const commonAreas = [
    {
      id: 'module-51-1-common-R', label: 'East balcony', bank: 'R',
      polygon: rect(10.5, 7.4, 6.2, 2.9), doorSegment: [[15.65, 7.4], [16.55, 7.4]],
      doorPlacement: {wall: 'top', end: 'right', evidence: 'resident-lime-mark'},
      note: 'Resident-marked balcony beside N0, with a doorway at the stair end of the top wall. The 6.20 m width follows the remaining core-side gap; the 2.90 m depth and 0.90 m doorway are inherited schematic assumptions.',
    },
    {
      id: 'module-51-1-common-L', label: 'West balcony', bank: 'L',
      polygon: rect(19.4, -2.9, 6.2, 2.9), doorSegment: [[19.55, 0], [20.45, 0]],
      doorPlacement: {wall: 'bottom', end: 'left', evidence: 'schematic-stair-side-access'},
      note: 'Resident-marked balcony beside the shifted A bank. The 6.20 m width follows the remaining core-side gap; its 2.90 m depth is inherited. No distinct lime door mark is visible; the 0.90 m stair-side doorway is schematic.',
    },
  ].map(item => ({
    ...item, kind: 'service', use: 'balcony', width: 6.2, depth: 2.9, area: 17.98,
    dimensionBasis: 'Width inferred from the remaining fixed-module gap; depth inherited from the accepted 2.90 m balcony assumption. Neither is newly measured from the annotation.',
  }));
  const stair = clone(topPlan.stair);
  const occupied = [
    ...rooms.map(room => ({label: roomKey(room), polygon: room.modulePolygon})),
    ...sharedApartments, ...corridors, ...commonAreas, {label: 'Stairs', polygon: stair.polygon},
  ];
  for (let i = 0; i < occupied.length; i++) for (let j = i + 1; j < occupied.length; j++) {
    assert.ok(multiArea(intersection([occupied[i].polygon], [occupied[j].polygon])) < 1e-7,
      `${occupied[i].label} must not overlap ${occupied[j].label}.`);
  }
  const polygons = union(...occupied.map(item => [item.polygon]));
  assert.ok(polygons.length === 1 && polygons[0].length === 1,
    'Yellow 1. OG requires one connected floor without residual holes.');
  const outline = polygons[0][0].map(point => point.map(round));
  const wallBands = rooms.flatMap(room => room.sideWalls.map((polygon, index) => ({
    id: `module-51-1-wall-${roomKey(room)}-${index}`,
    label: `${roomLabel(room)} side wall ${index + 1}`, polygon: clone(polygon), width: 0.2,
  })));
  return {
    schemaVersion: 1, house: '51', levelIndex: 1, status: 'resident-module-layout', units: 'metres',
    sourceTemplate: 'public/data/house51-top-floor-layout.json',
    sourceHashes: {'public/data/house51-top-floor-layout.json': hash(topPlan)},
    sourceAnnotation: clone(annotation),
    dimensions: {...clone(topPlan.dimensions), sharedWidth: 6.2, sharedDepth: 7.4, balconyWidth: 6.2, balconyDepth: 2.9},
    coordinateFrame: clone(topPlan.coordinateFrame),
    retainedCoreTranslation: clone(topPlan.retainedCoreTranslation),
    alignment: {
      bank: 'A', leftmostRoom: 'F', referenceBank: 'L', referenceRoom: 'L1', edge: 'left', axis: 'U',
      moduleEdge: 25.6, clearRoomEdge: 25.8, shiftFromUnalignedExtendedBank: [3.1, 0],
      basis: 'The entire enlarged A bank is shifted right until its leftmost module LEFT edge equals L1 LEFT edge. Core and room dimensions are unchanged.',
    },
    shell: {outline, holes: []}, rooms, sharedApartments, corridors, commonAreas, stair, wallBands,
    outlineDimensions: outline.slice(1).map((b, index) => ({
      a: outline[index], b, length: round(Math.hypot(b[0] - outline[index][0], b[1] - outline[index][1])),
    })),
    unassignedPolygons: [],
    totals: {
      singleCount: rooms.length, sharedApartmentCount: 1, apartmentCount: rooms.length + 1, moduleCount: rooms.length + 2,
      singleClearArea: round(rooms.reduce((sum, room) => sum + area(room.polygon), 0)),
      sharedEnvelopeArea: round(sharedApartments.reduce((sum, item) => sum + area(item.polygon), 0)),
      sideWallArea: round(wallBands.reduce((sum, wall) => sum + area(wall.polygon), 0)),
      bankHallArea: round(corridors.reduce((sum, hall) => sum + area(hall.polygon), 0)),
      commonArea: round(commonAreas.reduce((sum, item) => sum + area(item.polygon), 0)),
      stairArea: round(area(stair.polygon)), shellArea: round(area(outline)), unassignedArea: 0,
    },
    notes: clone(notes),
  };
}

function createStudyLevel(plan, previous) {
  const {originCampusXZ: origin, axisU, axisV} = plan.coordinateFrame;
  const point = ([u, v]) => origin.map((value, axis) => round(value + u * axisU[axis] + v * axisV[axis]));
  const ring = polygon => polygon.map(point);
  const eastId = 'module-51-1-hall-east', westId = 'module-51-1-hall-west', stairId = 'module-51-1-stairs';
  const hallId = bank => eastBanks.has(bank) ? eastId : westId;
  const spaces = plan.rooms.map(room => ({
    id: room.id, label: roomLabel(room), shortLabel: room.label, kind: 'room', confidence: 'estimated',
    note: 'Resident-annotated 1. OG position. Clear interior 2.70 x 6.00 m = 16.20 square metres, with two 0.20 m side allocations giving a 3.10 m module. Bathroom, kitchen and furnishing partitions remain unresolved.',
    polygon: ring(room.polygon),
  }));
  for (const apartment of plan.sharedApartments) spaces.push({
    id: apartment.id, label: `Shared apartment ${apartment.label}`, shortLabel: apartment.label,
    kind: 'shared', confidence: 'estimated', polygon: ring(apartment.polygon),
    note: 'Resident-retained shared A envelope, shifted with the whole A bank. Its 6.20 x 7.40 m gross envelope follows the accepted module assumption. Net area, internal partitions and occupancy are not established.',
  });
  for (const east of [true, false]) {
    const polygons = union(...plan.corridors.filter(hall => eastBanks.has(hall.bank) === east).map(hall => [hall.polygon]));
    assert.ok(polygons.length === 1 && polygons[0].length === 1,
      'Each bank hall must form one connected polygon without holes.');
    const label = east ? 'East hall' : 'West hall';
    spaces.push({
      id: east ? eastId : westId, label, shortLabel: label, kind: 'corridor', confidence: 'estimated',
      note: 'Continuous 1.40 m hallway joining the annotated room modules and balcony to the retained stair.',
      polygon: ring(polygons[0][0]),
    });
  }
  spaces.push({
    id: stairId, label: 'Stairwell', shortLabel: 'Stairs', kind: 'stairs', confidence: 'estimated',
    note: 'Accepted 2.70 x 7.40 m stair enclosure with a 1.30 m flight and 1.40 m walkway. Its rigid placement stays aligned to EG and the accepted 2. OG; treads, landings and openings remain schematic.',
    polygon: ring(plan.stair.polygon), stairFlight: ring(plan.stair.flightPolygon),
  });
  for (const common of plan.commonAreas) spaces.push({
    id: common.id, label: common.label, shortLabel: common.label, kind: 'service', confidence: 'estimated',
    note: common.note, polygon: ring(common.polygon),
  });
  const doors = [...plan.rooms, ...plan.sharedApartments].map(room => ({
    id: `module-51-1-door-${roomKey(room)}`,
    label: `${room.kind === 'shared' ? 'Shared apartment A' : roomLabel(room)} doorway`,
    spaceId: room.id, toSpaceId: hallId(room.bank), confidence: 'estimated',
    note: room.doorPlacement.basis,
    segment: ring(room.doorSegment),
  }));
  plan.stair.connectionSegments.forEach((segment, index) => doors.push({
    id: `module-51-1-stair-door-${index}`, label: `${index ? 'West' : 'East'} hall stair entry`,
    spaceId: stairId, toSpaceId: index ? westId : eastId, confidence: 'estimated',
    note: 'Existing schematic 0.90 m entrance retained on the hall-to-stair boundary.', segment: ring(segment),
  }));
  for (const common of plan.commonAreas) doors.push({
    id: `module-51-1-common-door-${common.bank}`, label: `${common.label} doorway`,
    spaceId: common.id, toSpaceId: hallId(common.bank), confidence: 'estimated',
    note: common.note, segment: ring(common.doorSegment),
  });
  const layoutWindows = plan.rooms.map(room => ({
    id: `module-51-1-window-${roomKey(room)}`, label: `${roomLabel(room)} window`,
    spaceId: room.id, confidence: 'estimated',
    note: 'Schematic 1.05 m room-facade opening. This is separate from the preserved folded Yellow exterior window evidence.',
    segment: ring(room.windowSegment),
  }));
  plan.sharedApartments[0].windowSegments.forEach((segment, index) => layoutWindows.push({
    id: `module-51-1-window-shared-A-${index}`, label: `Shared apartment A window ${index + 1}`,
    spaceId: plan.sharedApartments[0].id, confidence: 'estimated',
    note: 'Schematic 1.05 m opening on the shared envelope; the annotation does not establish a surveyed facade opening.',
    segment: ring(segment),
  }));
  const level = {
    ...clone(previous),
    index: 1, label: '1. OG · module layout', layoutBasis: 'resident-module-layout',
    source: 'Resident House 51 / 1. OG drawing, 15 November 2026: split G-H, N3-N4 and W1; add N0 and two A-bank singles; retain shared A; align the enlarged A bank LEFT edge with L1 LEFT edge; add two balcony enclosures; ignore the blue-covered W-row.',
    notes: notes.join(' '), floorOutline: [{outer: ring(plan.shell.outline)}], spaces, doors, layoutWindows,
    wallBands: plan.wallBands.map(wall => ({
      id: wall.id, label: wall.label, polygon: ring(wall.polygon), confidence: 'estimated',
      note: 'One 0.20 m side-wall allocation. Adjacent single modules retain both allocations, totaling 0.40 m.',
    })),
    dimensionGuides: [],
  };
  delete level.extrapolatedFrom;
  delete level.excludedAreas;
  delete level.sketchBoundaries;
  return level;
}

/** Replace only House 51 / 1. OG. topPlan is the accepted Yellow 2. OG plan. */
export function createHouse51FirstFloorLayout({studies, topPlan}) {
  assert.ok(topPlan?.house === '51' && topPlan.levelIndex === 2 && topPlan.status === 'resident-module-layout',
    'Expected the accepted independent House 51 top-floor plan.');
  assertFrame(topPlan.coordinateFrame);
  const previous = studies?.buildings?.['51'];
  const index = previous?.levels.findIndex(level => level.index === 1);
  assert.ok(previous && index >= 0, 'Missing the existing House 51 / 1. OG.');
  const plan = createLocalPlan(topPlan);
  const result = clone(studies);
  result.buildings['51'].levels[index] = createStudyLevel(plan, previous.levels[index]);
  // A completed ground floor owns the newer whole-building summary. Keep its
  // description when repeating this otherwise unchanged middle-floor build.
  if (!previous.levels.some(level => level.index === 0 && level.layoutBasis === 'resident-module-layout')) {
    result.buildings['51'].source = 'Yellow House 51: 1. OG follows the resident drawing with twenty-three singles, shared A, two balconies and the enlarged A-bank left edge aligned with L1. The accepted 2. OG retains its twenty-one singles and annotated doors. EG keeps its previous provisional fit for separate review. Folded exterior evidence remains unchanged.';
  }
  return {studies: result, plan};
}

async function main() {
  const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const [studies, topPlan, lod2, redTopPlan, firstFloorPlan, groundFloorPlan, campus] = await Promise.all([
    read('public/data/interior-studies.json'), read('public/data/house51-top-floor-layout.json'),
    read('public/data/lod2.json'), read('public/data/house55-module-layout.json'),
    read('public/data/house55-first-floor-layout.json'), read('public/data/house55-ground-floor-layout.json'),
    read('public/data/campus.json'),
  ]);
  const bytes = await readFile(new URL(`../${annotation.path}`, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), annotation.sha256,
    'House 51 / 1. OG annotation must match its recorded source digest.');
  const {studies: updated, plan} = createHouse51FirstFloorLayout({studies, topPlan});
  const remainingFits = createOldHouseModuleLayouts({
    studies: updated, lod2, topPlan: redTopPlan, firstFloorPlan, groundFloorPlan,
  });
  assert.deepEqual(remainingFits.studies, updated,
    'Refreshing remaining provisional fits must preserve every study record.');
  validateInteriorStudies(updated, campus, lod2);
  await writeFile(new URL('../public/data/house51-first-floor-layout.json', import.meta.url), `${JSON.stringify(plan, null, 2)}\n`);
  await writeFile(new URL('../public/data/interior-studies.json', import.meta.url), `${JSON.stringify(updated, null, 2)}\n`);
  await writeFile(new URL('../public/data/old-house-module-layouts.json', import.meta.url), `${JSON.stringify(remainingFits.metadata, null, 2)}\n`);
  console.log(`Generated House 51 / 1. OG: ${plan.totals.singleCount} singles, one shared apartment, two balconies, ${plan.totals.shellArea.toFixed(2)} m² independent outline.`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
