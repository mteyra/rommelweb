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
const roomLabel = room => `Room ${room.label}${room.label === 'E'
  ? ` · ${room.bank === 'A' ? 'A wing' : 'East wing'}` : ''}`;
const annotation = {
  path: 'data/source/house51-eg-resident-annotation.png',
  sha256: '5b5ea5454f08a61209a917af39994ece6756be42de5333469f3e335c0b742b61',
};
const notes = [
  'Yellow House 51 EG follows the resident ground-floor sketch, using the accepted 1. OG modules and exact stair registration. Both upper floor records remain unchanged.',
  'There are twenty-three single apartments and one shared A envelope. The H/G, N4/N3 and W2/W1 splits remain as on 1. OG, and N0 stays beside N1. F is removed from the A-bank inventory and B is inserted before shared A. The A bank reads E, D, C, B, shared A.',
  'The resident text correction narrows Sports room to 6.20 x 7.40 m. Its right edge and the A-wing E left module edge align at U=25.60 m with the L1/L2 module boundary. The complete A bank, its hall, doorways and windows move left by one 3.10 m pitch from the first ground-floor draft; shared A therefore returns to its accepted middle-floor coordinates.',
  'Laundry fills the east-balcony gap beside N0, extended to the southern N-wing facade: one 6.20 x 7.40 m enclosure. Sports room and Laundry each have one entrance from their main hallway; no internal subdivisions or equipment are inferred.',
  'Singles retain 2.70 x 6.00 m clear interiors, two 0.20 m side allocations and 3.10 m pitch. Halls remain 1.40 m and shared A stays a 6.20 x 7.40 m gross envelope. Common-room dimensions follow module alignment; they are not new site measurements.',
  'Clear lime marks place Sports at the bottom-right entrance, A-wing E at bottom-left, D at bottom-right and C at bottom-left. The other room door ends retain the completed middle-floor pattern. B uses a schematic bottom-right entrance; Laundry inherits the east balcony stair-side entrance, and shared A retains its left-bottom entrance after shifting.',
  'Openings remain schematic 0.90 m widths, generally centred 0.60 m from the clear-room or envelope corner with 0.15 m jambs. The general sketch establishes room types and relative placement, not exact jamb dimensions, hinges or door swings.',
  'The independent ground-floor outline is the complete union of modules, halls, stair and both common enclosures. It has no residual gray gaps. The unchanged Yellow frame retains exact stair alignment with both accepted upper floors.',
  'Sports retains one schematic 1.05 m opening based on the former A-bank F template, moved left by 3.10 m with the narrower enclosure so it stays on the Sports facade. B has one schematic room window and shared A keeps its two openings with the corrected envelope. No further common-room openings are invented; folded source facade geometry and window evidence remain unchanged.',
];

function assertFrame(frame) {
  const {originCampusXZ, axisU, axisV} = frame || {};
  if (![originCampusXZ, axisU, axisV].every(point =>
    Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))
    || Math.abs(Math.hypot(...axisU) - 1) > 1e-8
    || Math.abs(Math.hypot(...axisV) - 1) > 1e-8
    || Math.abs(axisU[0] * axisV[0] + axisU[1] * axisV[1]) > 1e-8
    || Math.abs(axisU[0] * axisV[1] - axisU[1] * axisV[0] - 1) > 1e-8) {
    throw Error('House 51 EG requires the accepted rigid coordinate frame in unscaled metres.');
  }
}

function shiftedRoom(source, label, du = 0) {
  assert.ok(source, `Missing source module for ${label}.`);
  const move = ring => ring.map(([u, v]) => [round(u + du), v]);
  return {
    ...clone(source), label,
    polygon: move(source.polygon), modulePolygon: move(source.modulePolygon),
    sideWalls: source.sideWalls.map(move),
    doorSegment: move(source.doorSegment), windowSegment: move(source.windowSegment),
  };
}

function setDoorEnd(room, end, evidence) {
  const u = room.polygon.map(point => point[0]);
  const v = room.polygon.map(point => point[1]);
  const wall = room.bank === 'E' ? 'right' : room.bank === 'W' ? 'left'
    : ['N', 'L'].includes(room.bank) ? 'top' : 'bottom';
  const limits = {left: Math.min(...u), right: Math.max(...u), top: Math.min(...v), bottom: Math.max(...v)};
  const center = limits[end] + (['left', 'top'].includes(end) ? 0.6 : -0.6);
  room.doorSegment = (['left', 'right'].includes(wall)
    ? [[limits[wall], center - 0.45], [limits[wall], center + 0.45]]
    : [[center - 0.45, limits[wall]], [center + 0.45, limits[wall]]]).map(point => point.map(round));
  room.doorPlacement = {
    wall, end, width: 0.9, centerOffsetFromClearEdge: 0.6, jambOffsetFromClearEdge: 0.15,
    evidence,
    basis: evidence === 'resident-eg-lime-mark'
      ? 'The doorway end follows the ground-floor lime mark; its width and exact corner offsets remain schematic.'
      : 'No separate B doorway mark is supplied. The bottom-right entrance continues the adjacent alternating corner pattern; its placement, width and offset are schematic.',
  };
}

function createLocalPlan(firstFloorPlan) {
  const formerF = firstFloorPlan.rooms.find(room => room.bank === 'A' && room.label === 'F');
  assert.ok(formerF, 'Expected the first-floor A-bank F window template for Sports room.');
  const rooms = firstFloorPlan.rooms.filter(room => !(room.bank === 'A' && room.label === 'F'))
    .flatMap(source => {
      const room = shiftedRoom(source, source.label, source.bank === 'A' ? -3.1 : 0);
      return source.bank === 'A' && source.label === 'C'
        ? [room, shiftedRoom(source, 'B')] : [room];
    });
  assert.equal(rooms.length, 23, 'Yellow EG must contain twenty-three single modules.');
  rooms.forEach(room => {
    room.id = `module-51-0-room-${roomKey(room)}`;
    if (room.bank === 'A') setDoorEnd(room, ['E', 'C'].includes(room.label) ? 'left' : 'right',
      room.label === 'B' ? 'schematic-new-single' : 'resident-eg-lime-mark');
    else room.doorPlacement = {
      ...room.doorPlacement,
      evidence: 'retained-middle-floor-pattern',
      basis: 'Retained from the completed middle-floor doorway pattern, consistent with the general ground-floor annotation; exact width and corner offsets remain schematic.',
    };
  });
  assert.equal(firstFloorPlan.sharedApartments.length, 1, 'Expected only shared A on 1. OG.');
  const sharedA = clone(firstFloorPlan.sharedApartments[0]);
  assert.equal(sharedA.label, 'A');
  sharedA.id = 'module-51-0-shared-A';
  sharedA.doorPlacement = {
    ...sharedA.doorPlacement,
    evidence: 'resident-corrected-a-bank-alignment',
    basis: 'The retained left-bottom entrance follows shared A after the resident-corrected bank moves left by one module from the first ground-floor draft. Its width and corner offset remain schematic.',
  };
  const sharedApartments = [sharedA];
  const corridors = firstFloorPlan.corridors.map(hall => ({
    ...clone(hall), id: `module-51-0-hall-${hall.bank}`,
    polygon: hall.bank === 'A' ? rect(25.6, -1.4, 12.4, 1.4) : clone(hall.polygon),
  }));
  const commonAreas = [
    {
      id: 'module-51-0-common-R', label: 'Laundry', bank: 'R', kind: 'service', use: 'laundry',
      polygon: rect(10.5, 7.4, 6.2, 7.4), width: 6.2, depth: 7.4, area: 45.88,
      doorSegment: clone(firstFloorPlan.commonAreas.find(item => item.bank === 'R').doorSegment),
      doorPlacement: {wall: 'top', end: 'right', evidence: 'retained-balcony-stair-side-access'},
      windowSegments: [],
      note: 'Resident-marked Laundry beside N0, occupying the 6.20 m module gap to the stair and extending to the N-wing facade at 7.40 m depth. Its one doorway retains the former east balcony stair-side entrance; exact dimensions, opening and equipment remain schematic.',
    },
    {
      id: 'module-51-0-common-L', label: 'Sports room', bank: 'L', kind: 'service', use: 'sports-room',
      polygon: rect(19.4, -7.4, 6.2, 7.4), width: 6.2, depth: 7.4, area: 45.88,
      doorSegment: [[24.55, 0], [25.45, 0]],
      doorPlacement: {wall: 'bottom', end: 'right', evidence: 'resident-eg-lime-mark'},
      windowSegments: [formerF.windowSegment.map(([u, v]) => [round(u - 3.1), v])],
      replaces: ['module-51-1-common-L'],
      note: 'Resident-corrected Sports room is 6.20 x 7.40 m, with its right edge at U=25.60 m aligned to the A-wing E left module edge and the L1/L2 module boundary. Its one bottom-right entrance follows the lime mark and moves with the corrected edge. Equipment and exact opening offsets remain schematic.',
    },
  ];
  const stair = clone(firstFloorPlan.stair);
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
    'Yellow EG requires one connected floor without residual holes.');
  const outline = polygons[0][0].map(point => point.map(round));
  const wallBands = rooms.flatMap(room => room.sideWalls.map((polygon, index) => ({
    id: `module-51-0-wall-${roomKey(room)}-${index}`,
    label: `${roomLabel(room)} side wall ${index + 1}`, polygon: clone(polygon), width: 0.2,
  })));
  return {
    schemaVersion: 1, house: '51', levelIndex: 0, status: 'resident-module-layout', units: 'metres',
    sourceTemplate: 'public/data/house51-first-floor-layout.json',
    sourceHashes: {'public/data/house51-first-floor-layout.json': hash(firstFloorPlan)},
    sourceAnnotation: clone(annotation),
    sourceCorrections: [{
      source: 'resident-text-correction', date: '2026-11-15',
      summary: 'Narrow Sports room so the A-wing E left module edge aligns with the L1/L2 boundary. Shift the complete A bank left by one module while preserving apartment sizes and counts.',
      alignmentU: 25.6, aBankShiftFromInitialGround: [-3.1, 0],
      basis: 'This resident alignment correction supplements the retained general sketch; it is not a new measured dimension.',
    }],
    dimensions: {...clone(firstFloorPlan.dimensions), sportsWidth: 6.2, sportsDepth: 7.4, laundryWidth: 6.2, laundryDepth: 7.4},
    coordinateFrame: clone(firstFloorPlan.coordinateFrame),
    retainedCoreTranslation: clone(firstFloorPlan.retainedCoreTranslation),
    groundFloorChanges: {
      insertedSingle: 'B', removedSingle: 'A/F', sharedAShift: [0, 0],
      aSingleBankShiftFromFirstFloor: [-3.1, 0], eLeftModuleEdgeU: 25.6,
      sportsAbsorbsFormerFHall: false, laundryExtendsFormerEastBalcony: true,
      commonRoomBasis: 'Ground-floor uses follow the general resident sketch, supplemented by the resident correction aligning the Sports/E boundary with the L1/L2 module boundary. Module alignment establishes the rectangular envelopes.',
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
  const eastId = 'module-51-0-hall-east', westId = 'module-51-0-hall-west', stairId = 'module-51-0-stairs';
  const hallId = bank => eastBanks.has(bank) ? eastId : westId;
  const spaces = plan.rooms.map(room => ({
    id: room.id, label: roomLabel(room), shortLabel: room.label, kind: 'room', confidence: 'estimated',
    note: 'Ground-floor single in the resident-annotated arrangement. Clear interior 2.70 x 6.00 m = 16.20 square metres, with two external 0.20 m side allocations giving a 3.10 m module. Bathroom, kitchen and furnishing partitions remain unresolved.',
    polygon: ring(room.polygon),
  }));
  for (const apartment of plan.sharedApartments) spaces.push({
    id: apartment.id, label: `Shared apartment ${apartment.label}`, shortLabel: apartment.label,
    kind: 'shared', confidence: 'estimated', polygon: ring(apartment.polygon),
    note: 'Shared A follows the resident-corrected A bank, shifted left by one 3.10 m module from the first ground-floor draft and aligned with its accepted middle-floor coordinates. Its 6.20 x 7.40 m gross envelope, one entrance and two windows remain intact. Internal divisions, net area and occupancy are not established.',
  });
  for (const east of [true, false]) {
    const polygons = union(...plan.corridors.filter(hall => eastBanks.has(hall.bank) === east).map(hall => [hall.polygon]));
    assert.ok(polygons.length === 1 && polygons[0].length === 1,
      'Each bank hall must form one connected polygon without holes.');
    const label = east ? 'East hall' : 'West hall';
    spaces.push({
      id: east ? eastId : westId, label, shortLabel: label, kind: 'corridor', confidence: 'estimated',
      note: 'Continuous 1.40 m hallway joining the ground-floor apartments and common room to the retained stair.',
      polygon: ring(polygons[0][0]),
    });
  }
  spaces.push({
    id: stairId, label: 'Stairwell', shortLabel: 'Stairs', kind: 'stairs', confidence: 'estimated',
    note: 'Accepted 2.70 x 7.40 m stair enclosure with 1.30 m flight and 1.40 m walkway. Its exact rigid placement is shared with both completed upper floors; treads, landings and openings remain schematic.',
    polygon: ring(plan.stair.polygon), stairFlight: ring(plan.stair.flightPolygon),
  });
  for (const common of plan.commonAreas) spaces.push({
    id: common.id, label: common.label, shortLabel: common.label, kind: 'service', confidence: 'estimated',
    note: common.note, polygon: ring(common.polygon),
  });
  const doors = [...plan.rooms, ...plan.sharedApartments].map(room => ({
    id: `module-51-0-door-${roomKey(room)}`,
    label: `${room.kind === 'shared' ? 'Shared apartment A' : roomLabel(room)} doorway`,
    spaceId: room.id, toSpaceId: hallId(room.bank), confidence: 'estimated',
    note: room.doorPlacement.basis, segment: ring(room.doorSegment),
  }));
  plan.stair.connectionSegments.forEach((segment, index) => doors.push({
    id: `module-51-0-stair-door-${index}`, label: `${index ? 'West' : 'East'} hall stair entry`,
    spaceId: stairId, toSpaceId: index ? westId : eastId, confidence: 'estimated',
    note: 'Existing schematic 0.90 m entrance retained on the hall-to-stair boundary.', segment: ring(segment),
  }));
  for (const common of plan.commonAreas) doors.push({
    id: `module-51-0-common-door-${common.bank}`, label: `${common.label} doorway`,
    spaceId: common.id, toSpaceId: hallId(common.bank), confidence: 'estimated',
    note: common.note, segment: ring(common.doorSegment),
  });
  const layoutWindows = plan.rooms.map(room => ({
    id: `module-51-0-window-${roomKey(room)}`, label: `${roomLabel(room)} window`,
    spaceId: room.id, confidence: 'estimated',
    note: 'Schematic 1.05 m room-facade opening, separate from preserved folded Yellow exterior window evidence.',
    segment: ring(room.windowSegment),
  }));
  for (const apartment of plan.sharedApartments) apartment.windowSegments.forEach((segment, index) => layoutWindows.push({
    id: `module-51-0-window-shared-${apartment.label}-${index}`, label: `Shared apartment ${apartment.label} window ${index + 1}`,
    spaceId: apartment.id, confidence: 'estimated',
    note: 'The schematic opening moves with its retained shared envelope; the ground-floor sketch does not establish a surveyed facade opening.',
    segment: ring(segment),
  }));
  for (const common of plan.commonAreas) common.windowSegments.forEach((segment, index) => layoutWindows.push({
    id: `module-51-0-window-common-${common.bank}-${index}`, label: `${common.label} window ${index + 1}`,
    spaceId: common.id, confidence: 'estimated',
    note: 'The schematic 1.05 m former A-bank F template opening moves left by 3.10 m to stay on the narrowed Sports facade. This is a layout adjustment, not new facade evidence; no additional common-room window pattern is inferred.',
    segment: ring(segment),
  }));
  const level = {
    ...clone(previous),
    index: 0, label: 'EG · module layout', layoutBasis: 'resident-module-layout',
    source: 'Resident House 51 / EG general sketch and subsequent alignment correction, 15 November 2026: retain the single-room splits and N0; use Sports and Laundry in the common areas; retain inserted B and shared A; narrow Sports and align the A-wing E left module edge with the L1/L2 boundary.',
    notes: [
      'Resident general sketch fitted to the accepted middle-floor modules: twenty-three singles and one shared A envelope. H/G, N4/N3 and W2/W1 stay split, and N0 remains beside N1.',
      'Sports is corrected to 6.20 x 7.40 m: its right edge and A-wing E left module edge align at U=25.60 m with the L1/L2 boundary. E/D/C/B/shared A and their hall move left by one 3.10 m pitch from the first ground-floor draft, preserving apartment sizes. Laundry remains 6.20 x 7.40 m beside N0. Each common room has one hallway entrance.',
      'Singles keep 2.70 x 6.00 m clear interiors, two 0.20 m side allocations and 3.10 m pitch. Halls stay 1.40 m; shared A keeps its 6.20 x 7.40 m gross envelope. Common dimensions are inferred from module alignment.',
      'Clear lime door ends are followed for Sports and A-wing E/D/C; other existing apartments retain the middle-floor pattern. B uses a schematic bottom-right entrance and Laundry inherits the stair-side balcony doorway. Openings are schematic 0.90 m widths; hinges, swings and exact jambs are unresolved.',
      'The independent outline has no residual gaps. Stair and rigid coordinate frame align exactly with both unchanged upper floors. The schematic former F window template moves left with the narrowed Sports facade; B keeps one window and A keeps two. Source facade geometry and window evidence are unchanged.',
    ].join(' '),
    floorOutline: [{outer: ring(plan.shell.outline)}], spaces, doors, layoutWindows,
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

/** Replace only House 51 / EG; firstFloorPlan is the accepted Yellow 1. OG plan. */
export function createHouse51GroundFloorLayout({studies, firstFloorPlan}) {
  assert.ok(firstFloorPlan?.house === '51' && firstFloorPlan.levelIndex === 1
    && firstFloorPlan.status === 'resident-module-layout',
  'Expected the accepted independent House 51 first-floor plan.');
  assertFrame(firstFloorPlan.coordinateFrame);
  const previous = studies?.buildings?.['51'];
  const index = previous?.levels.findIndex(level => level.index === 0);
  assert.ok(previous && index >= 0, 'Missing the existing House 51 / EG.');
  const plan = createLocalPlan(firstFloorPlan);
  const result = clone(studies);
  result.buildings['51'].levels[index] = createStudyLevel(plan, previous.levels[index]);
  result.buildings['51'].source = 'Yellow House 51 has independent resident-directed layouts on all three floors. The accepted top floor retains twenty-one singles and its marked doors; 1. OG retains twenty-three singles, shared A and two balconies. EG has twenty-three singles, shared A, Sports room and Laundry. The resident-corrected Sports room is 6.20 m wide, with the A-wing E left module edge aligned to the L1/L2 boundary. Folded exterior evidence remains unchanged.';
  return {studies: result, plan};
}

async function main() {
  const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const [studies, firstFloorPlan, lod2, redTopPlan, redFirstFloorPlan, redGroundFloorPlan, campus] = await Promise.all([
    read('public/data/interior-studies.json'), read('public/data/house51-first-floor-layout.json'),
    read('public/data/lod2.json'), read('public/data/house55-module-layout.json'),
    read('public/data/house55-first-floor-layout.json'), read('public/data/house55-ground-floor-layout.json'),
    read('public/data/campus.json'),
  ]);
  const bytes = await readFile(new URL(`../${annotation.path}`, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), annotation.sha256,
    'House 51 EG annotation must match its recorded source digest.');
  const {studies: updated, plan} = createHouse51GroundFloorLayout({studies, firstFloorPlan});
  const remainingFits = createOldHouseModuleLayouts({
    studies: updated, lod2, topPlan: redTopPlan, firstFloorPlan: redFirstFloorPlan, groundFloorPlan: redGroundFloorPlan,
  });
  assert.deepEqual(remainingFits.studies, updated,
    'Refreshing remaining provisional fits must preserve every study record.');
  validateInteriorStudies(updated, campus, lod2);
  await writeFile(new URL('../public/data/house51-ground-floor-layout.json', import.meta.url), `${JSON.stringify(plan, null, 2)}\n`);
  await writeFile(new URL('../public/data/interior-studies.json', import.meta.url), `${JSON.stringify(updated, null, 2)}\n`);
  await writeFile(new URL('../public/data/old-house-module-layouts.json', import.meta.url), `${JSON.stringify(remainingFits.metadata, null, 2)}\n`);
  console.log(`Generated House 51 / EG: ${plan.totals.singleCount} singles, one shared apartment, Sports room and Laundry, ${plan.totals.shellArea.toFixed(2)} m² independent outline.`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
