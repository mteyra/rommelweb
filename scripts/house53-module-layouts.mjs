import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {intersection, union} from 'polyclip-ts';
import {createRegistration} from './generate-old-house-studies.mjs';
import {createOldHouseModuleLayouts} from './old-house-module-layout.mjs';
import {validateInteriorStudies} from '../src/interior-studies.js';

const clone = value => structuredClone(value);
const round = value => Math.round(value * 1e9) / 1e9;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const rect = (u, v, width, depth) => [
  [u, v], [u + width, v], [u + width, v + depth], [u, v + depth], [u, v],
].map(point => point.map(round));
const area = ring => Math.abs(ring.slice(1).reduce((sum, point, index) =>
  sum + ring[index][0] * point[1] - point[0] * ring[index][1], 0) / 2);
const multiArea = polygons => polygons.reduce((sum, polygon) =>
  sum + area(polygon[0]) - polygon.slice(1).reduce((holes, ring) => holes + area(ring), 0), 0);
const eastBanks = new Set(['E', 'N', 'R']);
const roomKey = room => `${room.bank}-${room.label.replaceAll('–', '-')}`;
const roomLabel = room => `Room ${room.label}${room.label === 'E'
  ? ` · ${room.bank === 'A' ? 'A wing' : 'East wing'}` : ''}`;
const retainedCoreTranslation = [0, -0.2];
// Both shallow middle-floor enclosures retain the inherited depth. The blue
// arrow was clarified as stairs down to Bar, not a request to change depth.
const middleBalconyDepth = 2.9;
const commonHallNotch = 1.4;
const barFlightSymbol = rect(10.7, 7.6, 1.3, 2.5);
const barStairClarification = {
  date: '2026-11-15', source: 'resident-follow-up',
  text: 'The small blue upward arrow marks stairs down from House 53 / 1. OG to the EG Bar; it is not an edge adjustment or exclusion.',
};
const annotations = [
  {path: 'data/source/house53-eg-resident-annotation.png',
    sha256: 'cc923c79eda879f64da3f423795bd50e2465adda6aa77a909704108d88e747be'},
  {path: 'data/source/house53-1og-resident-annotation.png',
    sha256: '537d5ab1bf861722d06f0c4e516536b926efc7c674d22337fc2447325ac55fe2'},
  {path: 'data/source/house53-2og-resident-annotation.png',
    sha256: 'add982c84bbf1e14e2cf75029485c2124fa735b741441273e8d429cccc2caca8'},
];

// Ends are expressed in the retained local U/V frame. The screenshots view
// it from the opposite direction: screen-left is maximum U, screen-top
// maximum V. EG R2 is deliberately different from both upper floors.
const doorEnds = {
  'E-H': 'top', 'E-G': 'bottom', 'E-F': 'top', 'E-E': 'bottom',
  'N-N3': 'left', 'N-N2': 'right', 'N-N1': 'left', 'N-N0': 'right',
  'R-R3': 'left', 'R-R2': 'right', 'R-R1': 'right',
  'L-L3': 'right', 'L-L2': 'left', 'L-L1': 'right',
  'A-E': 'right', 'A-D': 'left', 'A-C': 'right', 'A-B': 'left', 'A-A': 'right',
  'W-W4': 'top', 'W-W3': 'bottom', 'W-W2': 'top', 'W-W1': 'bottom',
};

function assertFrame(frame) {
  const {originCampusXZ, axisU, axisV} = frame || {};
  assert.ok([originCampusXZ, axisU, axisV].every(point =>
    Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))
    && Math.abs(Math.hypot(...axisU) - 1) < 1e-8
    && Math.abs(Math.hypot(...axisV) - 1) < 1e-8
    && Math.abs(axisU[0] * axisV[0] + axisU[1] * axisV[1]) < 1e-8
    && Math.abs(axisU[0] * axisV[1] - axisU[1] * axisV[0] - 1) < 1e-8,
  'Orange requires its original rigid orientation and unscaled metre dimensions.');
}

function coordinateFrame(topPlan, lod2, oldHouseLayouts) {
  let retained = oldHouseLayouts?.houses?.['53']?.coordinateFrame;
  if (!retained) {
    const source = lod2?.buildings.find(building => building.number === '55');
    const target = lod2?.buildings.find(building => building.number === '53');
    assert.ok(source && target, 'House 55 and House 53 LoD2 records are required for registration.');
    const registration = createRegistration(source, target);
    const [a, b, c, d] = registration.manifest.rigid;
    const rotate = ([x, y]) => [a * x + b * y, c * x + d * y];
    retained = {
      originCampusXZ: registration.mapPoint(topPlan.coordinateFrame.originCampusXZ),
      axisU: rotate(topPlan.coordinateFrame.axisU), axisV: rotate(topPlan.coordinateFrame.axisV),
    };
  }
  assertFrame(retained);
  const frame = {
    originCampusXZ: retained.originCampusXZ.map((value, axis) =>
      value + retainedCoreTranslation[0] * retained.axisU[axis]
        + retainedCoreTranslation[1] * retained.axisV[axis]),
    axisU: clone(retained.axisU), axisV: clone(retained.axisV),
    basis: 'Original rigid House 53 registration with its retained [0, -0.2] m core offset absorbed into the origin. Local dimensions remain unscaled metres.',
  };
  assertFrame(frame);
  return frame;
}

function shiftedRoom(source, label, du = 0, dv = 0) {
  assert.ok(source, `Missing canonical source module for ${label}.`);
  const move = ring => ring.map(([u, v]) => [round(u + du), round(v + dv)]);
  return {
    ...clone(source), label,
    polygon: move(source.polygon), modulePolygon: move(source.modulePolygon),
    sideWalls: source.sideWalls.map(move),
    doorSegment: move(source.doorSegment), windowSegment: move(source.windowSegment),
  };
}

function setDoor(room, levelIndex) {
  const key = roomKey(room), end = levelIndex === 0 && key === 'R-R2' ? 'left' : doorEnds[key];
  assert.ok(end, `Missing annotated door end for ${key}.`);
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
    evidence: 'resident-lime-mark',
    basis: 'The doorway end follows this floor’s lime mark in the rotated resident drawing; width and exact corner offsets are schematic.',
  };
}

function planNotes(levelIndex) {
  return [
    `Orange House 53 / ${levelIndex === 0 ? 'EG' : `${levelIndex}. OG`} follows its own resident drawing dated 15 November 2026. Other houses and original folded facade evidence remain unchanged.`,
    levelIndex === 2
      ? 'Twenty single apartments: remove the blue-covered terminal A; add E beside D and N0 beside N1. Both blue-hatched core-side gaps are outside this floor. The W wing retains W4, W3 and W2 only.'
      : 'Twenty-two singles and retained shared N3-N4: split the former W1, A and G-H pairs, then add E beside D and N0 beside N1. The shared N envelope retains unresolved internals.',
    levelIndex === 0
      ? 'The eastern core-side gap is Bar, accessed by stairs from 1. OG. No additional ground hall doorway is inferred. The western Common room retains its drawn stepped edge: a 1.40 x 1.40 m public hallway notch beside E uses the inherited hall width, not a new measurement.'
      : levelIndex === 1
        ? 'The West balcony and East Bar-access stair enclosure are each 6.20 m wide with inherited 2.90 m depth. The resident clarified the small blue arrow beside N0 as stairs down to the EG Bar, not deletion or a change of depth.'
        : 'The new outline is the complete module-and-circulation union, without residual gray source-shell patches.',
    'One canonical 3.10 m module grid aligns corresponding rooms vertically. The earlier arbitrary A/N shell-fit offsets are removed as a regularization assumption; the drawings establish topology, not a survey of these bank translations. The original Orange stair placement is retained.',
    `Single clear interiors remain 2.70 x 6.00 m with two 0.20 m side allocations; halls remain 1.40 m wide.${levelIndex === 2 ? '' : ' Shared N3-N4 is an assumed 6.20 x 7.40 m gross envelope.'} No room is stretched to fit the folded exterior.`,
    `Lime marks establish doorway ends. Openings remain schematic at 0.90 m width, centered 0.60 m from the indicated clear edge.${levelIndex === 0 ? ' R2 follows its distinct opposite-end mark.' : ''}`,
    `${levelIndex === 2 ? '' : 'The linked Bar stair symbol is aligned between floors at the N0 side. Its 1.30 x 2.50 m footprint locates the connection; actual run, rise and landings remain unmeasured. '}Layout windows, stair treads and room internals remain schematic. The retained [0, -0.2] m core offset is absorbed into the Orange frame without changing the main stair.`,
  ];
}

function commonAreas(levelIndex) {
  const prefix = `module-53-${levelIndex}`;
  if (levelIndex === 2) return [];
  if (levelIndex === 1) return [
    {
      id: `${prefix}-common-R`, label: 'Bar access stair', shortLabel: 'Bar stairs', bank: 'R', kind: 'stairs', use: 'bar-access-stair',
      polygon: rect(10.5, 7.4, 6.2, middleBalconyDepth),
      width: 6.2, depth: middleBalconyDepth, doorSegment: [[15.65, 7.4], [16.55, 7.4]],
      doorPlacement: {wall: 'top', end: 'right', evidence: 'resident-lime-mark'},
      stairFlight: clone(barFlightSymbol),
      stairConnection: {levelIndex: 0, spaceId: 'module-53-0-common-R', direction: 'down',
        segment: [[11.35, 7.85], [11.35, 9.85]]},
      sourceClarification: clone(barStairClarification),
      note: 'The resident clarified the blue arrow beside N0 as stairs down to the EG Bar. The lime mark gives this enclosure’s hall entrance. Its shallow 6.20 x 2.90 m envelope is retained. The aligned 1.30 x 2.50 m flight symbol shows connection location/direction only; actual run, rise and landings are unmeasured.',
    },
    {
      id: `${prefix}-common-L`, label: 'West balcony', bank: 'L', kind: 'service', use: 'balcony',
      polygon: rect(19.4, -middleBalconyDepth, 6.2, middleBalconyDepth),
      width: 6.2, depth: middleBalconyDepth, doorSegment: [[19.55, 0], [20.45, 0]],
      doorPlacement: {wall: 'bottom', end: 'left', evidence: 'resident-lime-mark'},
      note: 'Resident-labeled balcony beside the added E. Its lime doorway is at the stair end. Width 6.20 m follows the remaining grid gap; depth 2.90 m and doorway width/offsets are inherited schematic assumptions.',
    },
  ].map(item => ({...item, area: round(area(item.polygon)), dimensionBasis: 'Fixed-module gap and inherited balcony depth; not newly measured from the annotation.'}));
  return [
    {
      id: `${prefix}-common-R`, label: 'Bar', bank: 'R', kind: 'service', use: 'bar',
      polygon: rect(10.5, 7.4, 6.2, 7.4), width: 6.2, depth: 7.4, area: 45.88,
      stairFlight: clone(barFlightSymbol),
      stairConnection: {levelIndex: 1, spaceId: 'module-53-1-common-R', direction: 'up',
        segment: [[11.35, 9.85], [11.35, 7.85]]},
      sourceClarification: clone(barStairClarification),
      note: 'Resident-labeled Bar, accessed from 1. OG by the blue-arrow stairs clarified by the resident. No clear lime doorway mark is visible on its ground hall boundary, so no additional hall entrance is inferred; the adjacent lime mark belongs to N0. The aligned flight symbol locates the connection, not surveyed run, rise or landings.',
      dimensionBasis: 'Full fixed-module gap; no new survey dimensions.',
    },
    {
      id: `${prefix}-common-L`, label: 'Common room', bank: 'L', kind: 'service', use: 'common-room',
      polygon: [[19.4, -7.4], [25.6, -7.4], [25.6, -1.4],
        [round(25.6 - commonHallNotch), -1.4], [round(25.6 - commonHallNotch), 0],
        [19.4, 0], [19.4, -7.4]],
      width: 6.2, depth: 7.4, area: round(6.2 * 7.4 - commonHallNotch * 1.4),
      hallNotch: {width: commonHallNotch, depth: 1.4, polygon: rect(25.6 - commonHallNotch, -1.4, commonHallNotch, 1.4)},
      doorSegment: [[24.55, -1.4], [25.45, -1.4]],
      doorPlacement: {wall: 'stepped-bottom', end: 'right', evidence: 'resident-lime-mark'},
      note: 'Resident-labeled Common room with the drawn stepped hall edge. A 1.40 x 1.40 m public hallway notch remains beside E; these notch dimensions inherit the hall width rather than a measured sketch offset. The lime entrance sits on the short step edge. Fixtures remain unresolved.',
      dimensionBasis: '6.20 x 7.40 m grid gap minus an explicitly schematic 1.40 x 1.40 m public-hall notch.',
    },
  ];
}

function createLocalPlan(topPlan, frame, levelIndex) {
  const lower = levelIndex !== 2, prefix = `module-53-${levelIndex}`;
  const source = (bank, label) => topPlan.rooms.find(room => room.bank === bank && room.label === label);
  const rooms = [
    ...(lower ? [shiftedRoom(source('E', 'G'), 'H', 0, -3.1)] : []),
    ...['G', 'F', 'E'].map(label => shiftedRoom(source('E', label), label)),
    ...(lower ? [] : [shiftedRoom(source('N', 'N3'), 'N3')]),
    ...['N2', 'N1'].map(label => shiftedRoom(source('N', label), label)),
    shiftedRoom(source('N', 'N1'), 'N0', 3.1),
    ...['R3', 'R2', 'R1'].map(label => shiftedRoom(source('R', label), label)),
    ...['L3', 'L2', 'L1'].map(label => shiftedRoom(source('L', label), label)),
    shiftedRoom(source('A', 'D'), 'E', -3.1),
    ...['D', 'C', 'B', ...(lower ? ['A'] : [])].map(label => shiftedRoom(source('A', label), label)),
    ...['W4', 'W3', 'W2', ...(lower ? ['W1'] : [])].map(label => shiftedRoom(source('W', label), label)),
  ];
  assert.equal(rooms.length, lower ? 22 : 20, 'Orange apartment count must match this floor’s annotation.');
  for (const room of rooms) {
    room.id = `${prefix}-room-${roomKey(room)}`;
    setDoor(room, levelIndex);
  }
  const sharedApartments = lower ? [{
    id: `${prefix}-shared-N3-N4`, label: 'N3–N4', bank: 'N', kind: 'shared',
    polygon: rect(-5, 7.4, 6.2, 7.4), width: 6.2, depth: 7.4, area: 45.88,
    moduleCount: 2, areaBasis: 'assumed-gross-envelope',
    doorSegment: [[1.2, 7.55], [1.2, 8.45]],
    doorPlacement: {wall: 'right', end: 'top', evidence: 'resident-lime-mark',
      basis: 'The right-wall doorway near the minimum-V corner follows the shared envelope’s lime mark. Its 0.90 m width and offsets are schematic.'},
    windowSegments: [[[-3.975, 14.8], [-2.925, 14.8]], [[-0.875, 14.8], [0.175, 14.8]]],
  }] : [];
  const aStart = levelIndex === 0 ? round(25.6 - commonHallNotch) : 25.6;
  const hallSpecs = [
    ['E', 6, lower ? -5 : -1.9, 1.4, lower ? 12.4 : 9.3],
    ['N', lower ? 1.2 : -1.9, 7.4, lower ? 9.3 : 12.4, 1.4],
    ['R', 7.4, 6, 9.3, 1.4], ['L', 19.4, 0, 9.3, 1.4],
    ['A', aStart, -1.4, (lower ? 41.1 : 38) - aStart, 1.4],
    ['W', 28.7, 0, 1.4, lower ? 12.4 : 9.3],
  ];
  const corridors = hallSpecs.map(([bank, u, v, width, depth]) => ({
    id: `${prefix}-hall-piece-${bank}`, label: `${bank} bank hallway`, bank,
    polygon: rect(u, v, width, depth), width: 1.4,
  }));
  const commons = commonAreas(levelIndex), stair = clone(topPlan.stair);
  const pieces = [
    ...rooms.map(room => ({label: roomKey(room), polygon: room.modulePolygon})),
    ...sharedApartments, ...corridors, ...commons, {label: 'Stairs', polygon: stair.polygon},
  ];
  for (let i = 0; i < pieces.length; i++) for (let j = i + 1; j < pieces.length; j++) {
    assert.ok(multiArea(intersection([pieces[i].polygon], [pieces[j].polygon])) < 1e-7,
      `Orange ${levelIndex}: ${pieces[i].label} must not overlap ${pieces[j].label}.`);
  }
  const joined = union(...pieces.map(item => [item.polygon]));
  assert.ok(joined.length === 1 && joined[0].length === 1,
    'Every Orange floor must have one fully assigned connected outline without holes.');
  const outline = joined[0][0].map(point => point.map(round));
  const wallBands = rooms.flatMap(room => room.sideWalls.map((polygon, index) => ({
    id: `${prefix}-wall-${roomKey(room)}-${index}`,
    label: `${roomLabel(room)} side wall ${index + 1}`, polygon: clone(polygon), width: 0.2,
  })));
  return {
    schemaVersion: 1, house: '53', levelIndex, status: 'resident-module-layout', units: 'metres',
    sourceTemplate: 'public/data/house55-module-layout.json',
    sourceHashes: {'public/data/house55-module-layout.json': hash(topPlan)},
    sourceAnnotation: clone(annotations[levelIndex]), coordinateFrame: clone(frame),
    retainedCoreTranslation: clone(retainedCoreTranslation),
    dimensions: {...clone(topPlan.dimensions), sharedWidth: 6.2, sharedDepth: 7.4,
      middleEnclosureWidth: 6.2, middleEnclosureDepth: middleBalconyDepth,
      balconyWidth: 6.2, balconyDepth: middleBalconyDepth, commonHallNotchWidth: commonHallNotch,
      barStairSymbolWidth: 1.3, barStairSymbolLength: 2.5},
    shell: {outline, holes: []}, rooms, sharedApartments, corridors, commonAreas: commons, stair, wallBands,
    outlineDimensions: outline.slice(1).map((b, index) => ({
      a: outline[index], b, length: round(Math.hypot(b[0] - outline[index][0], b[1] - outline[index][1])),
    })),
    unassignedPolygons: [],
    totals: {
      singleCount: rooms.length, sharedApartmentCount: sharedApartments.length,
      apartmentCount: rooms.length + sharedApartments.length, moduleCount: rooms.length + 2 * sharedApartments.length,
      singleClearArea: round(rooms.reduce((sum, room) => sum + area(room.polygon), 0)),
      sharedEnvelopeArea: round(sharedApartments.reduce((sum, item) => sum + area(item.polygon), 0)),
      sideWallArea: round(wallBands.reduce((sum, wall) => sum + area(wall.polygon), 0)),
      bankHallArea: round(corridors.reduce((sum, hall) => sum + area(hall.polygon), 0)),
      commonArea: round(commons.reduce((sum, item) => sum + area(item.polygon), 0)),
      stairArea: round(area(stair.polygon)), shellArea: round(area(outline)), unassignedArea: 0,
    },
    notes: planNotes(levelIndex),
  };
}

function createStudyLevel(plan, previous) {
  const {originCampusXZ: origin, axisU, axisV} = plan.coordinateFrame;
  const point = ([u, v]) => origin.map((value, axis) => round(value + u * axisU[axis] + v * axisV[axis]));
  const ring = polygon => polygon.map(point), prefix = `module-53-${plan.levelIndex}`;
  const eastId = `${prefix}-hall-east`, westId = `${prefix}-hall-west`, stairId = `${prefix}-stairs`;
  const hallId = bank => eastBanks.has(bank) ? eastId : westId;
  const spaces = plan.rooms.map(room => ({
    id: room.id, label: roomLabel(room), shortLabel: room.label, kind: 'room', confidence: 'estimated',
    note: 'Resident-annotated Orange room on the regularized module grid. Clear interior 2.70 x 6.00 m = 16.20 square metres; two 0.20 m side allocations give a 3.10 m pitch. Internal kitchen, bathroom and furnishing partitions remain unresolved.',
    polygon: ring(room.polygon),
  }));
  for (const shared of plan.sharedApartments) spaces.push({
    id: shared.id, label: `Shared apartment ${shared.label}`, shortLabel: shared.label,
    kind: 'shared', confidence: 'estimated', polygon: ring(shared.polygon),
    note: 'Resident-retained shared N3-N4 envelope, 6.20 x 7.40 m gross under the accepted module assumption. Net area, occupancy and internal partitions are not established.',
  });
  for (const east of [true, false]) {
    const joined = union(...plan.corridors.filter(hall => eastBanks.has(hall.bank) === east).map(hall => [hall.polygon]));
    assert.ok(joined.length === 1 && joined[0].length === 1, 'Each Orange bank hall must remain connected.');
    const label = east ? 'East hall' : 'West hall';
    spaces.push({
      id: east ? eastId : westId, label, shortLabel: label, kind: 'corridor', confidence: 'estimated',
      note: `Continuous 1.40 m public hallway joining the fixed room modules to the retained stair.${plan.levelIndex === 0 && !east ? ' This West hall includes the small notch beside the Common room entrance.' : ''}`,
      polygon: ring(joined[0][0]),
    });
  }
  spaces.push({
    id: stairId, label: 'Stairwell', shortLabel: 'Stairs', kind: 'stairs', confidence: 'estimated',
    note: 'Original Orange stair position retained on all three floors. The accepted 2.70 x 7.40 m enclosure has a 1.30 m flight and 1.40 m walkway; treads, landings and openings remain schematic.',
    polygon: ring(plan.stair.polygon), stairFlight: ring(plan.stair.flightPolygon),
  });
  for (const common of plan.commonAreas) {
    const space = {
      id: common.id, label: common.label, shortLabel: common.shortLabel || common.label,
      kind: common.kind, confidence: 'estimated', note: common.note, polygon: ring(common.polygon),
    };
    if (common.stairFlight) space.stairFlight = ring(common.stairFlight);
    if (common.stairConnection) space.stairConnection = {
      ...clone(common.stairConnection), segment: ring(common.stairConnection.segment),
    };
    spaces.push(space);
  }
  const doors = [...plan.rooms, ...plan.sharedApartments].map(room => ({
    id: `${prefix}-door-${roomKey(room)}`, label: `${room.kind === 'shared' ? `Shared apartment ${room.label}` : roomLabel(room)} doorway`,
    spaceId: room.id, toSpaceId: hallId(room.bank), confidence: 'estimated',
    note: room.doorPlacement.basis, segment: ring(room.doorSegment),
  }));
  plan.stair.connectionSegments.forEach((segment, index) => doors.push({
    id: `${prefix}-stair-door-${index}`, label: `${index ? 'West' : 'East'} hall stair entry`,
    spaceId: stairId, toSpaceId: index ? westId : eastId, confidence: 'estimated',
    note: 'Original schematic 0.90 m hall-to-stair opening retained.', segment: ring(segment),
  }));
  for (const common of plan.commonAreas.filter(item => item.doorSegment)) doors.push({
    id: `${prefix}-common-door-${common.bank}`, label: `${common.label} doorway`,
    spaceId: common.id, toSpaceId: hallId(common.bank), confidence: 'estimated',
    note: common.note, segment: ring(common.doorSegment),
  });
  const layoutWindows = plan.rooms.map(room => ({
    id: `${prefix}-window-${roomKey(room)}`, label: `${roomLabel(room)} window`, spaceId: room.id,
    confidence: 'estimated', note: 'Schematic 1.05 m room-facade opening, separate from preserved Orange exterior window evidence.',
    segment: ring(room.windowSegment),
  }));
  for (const shared of plan.sharedApartments) shared.windowSegments.forEach((segment, index) => layoutWindows.push({
    id: `${prefix}-window-shared-N3-N4-${index}`, label: `Shared N3-N4 window ${index + 1}`, spaceId: shared.id,
    confidence: 'estimated', note: 'Schematic 1.05 m opening on the retained shared envelope; not a surveyed facade opening.',
    segment: ring(segment),
  }));
  const level = {
    ...clone(previous), index: plan.levelIndex,
    label: `${plan.levelIndex === 0 ? 'EG' : `${plan.levelIndex}. OG`} · module layout`,
    layoutBasis: 'resident-module-layout',
    source: `Resident House 53 / ${plan.levelIndex === 0 ? 'EG' : `${plan.levelIndex}. OG`} annotation, 15 November 2026. Orange’s own room additions, removals, common enclosures and lime doorway ends are applied on the retained rigid core frame.`,
    notes: plan.notes.join(' '), floorOutline: [{outer: ring(plan.shell.outline)}],
    spaces, doors, layoutWindows,
    wallBands: plan.wallBands.map(wall => ({
      id: wall.id, label: wall.label, polygon: ring(wall.polygon), confidence: 'estimated',
      note: 'One 0.20 m side-wall allocation. Adjacent modules retain both allocations, totaling 0.40 m.',
    })),
    dimensionGuides: [],
  };
  delete level.extrapolatedFrom;
  delete level.excludedAreas;
  delete level.sketchBoundaries;
  return level;
}

/** Apply all three Orange drawings while preserving other buildings exactly. */
export function createHouse53ModuleLayouts({studies, lod2, topPlan, oldHouseLayouts}) {
  assert.ok(topPlan?.house === '55' && topPlan.levelIndex === 2 && topPlan.status === 'resident-module-layout',
    'Expected the accepted independent Red House 55 top-floor module plan.');
  const previous = studies?.buildings?.['53'];
  assert.ok(previous && [0, 1, 2].every(index => previous.levels.some(level => level.index === index)),
    'House 53 requires its three existing floor records.');
  const frame = coordinateFrame(topPlan, lod2, oldHouseLayouts);
  const levels = [0, 1, 2].map(index => createLocalPlan(topPlan, frame, index));
  const result = clone(studies);
  for (const plan of levels) {
    const index = previous.levels.findIndex(level => level.index === plan.levelIndex);
    result.buildings['53'].levels[index] = createStudyLevel(plan, previous.levels[index]);
  }
  result.buildings['53'].source = 'Orange House 53 follows three resident drawings: 20 singles on 2. OG; 22 singles and retained shared N3-N4 on each lower floor. 1. OG has the West balcony and stairs down to the EG Bar, clarified by the resident’s blue-arrow explanation. EG also has the stepped Common room. One unscaled regularized grid retains the original Orange core position. Folded exterior and source windows remain separate.';
  return {
    studies: result,
    metadata: {
      schemaVersion: 1, house: '53', status: 'resident-module-layout', units: 'metres',
      coordinateFrame: clone(frame), retainedCoreTranslation: clone(retainedCoreTranslation),
      sourceClarifications: [clone(barStairClarification)], levels,
    },
  };
}

async function main() {
  const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const [studies, lod2, topPlan, firstFloorPlan, groundFloorPlan, oldHouseLayouts, campus] = await Promise.all([
    read('public/data/interior-studies.json'), read('public/data/lod2.json'),
    read('public/data/house55-module-layout.json'), read('public/data/house55-first-floor-layout.json'),
    read('public/data/house55-ground-floor-layout.json'), read('public/data/old-house-module-layouts.json'),
    read('public/data/campus.json'),
  ]);
  for (const annotation of annotations) {
    const bytes = await readFile(new URL(`../${annotation.path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), annotation.sha256,
      `Source annotation digest must match: ${annotation.path}`);
  }
  const {studies: updated, metadata} = createHouse53ModuleLayouts({studies, lod2, topPlan, oldHouseLayouts});
  const remaining = createOldHouseModuleLayouts({studies: updated, lod2, topPlan, firstFloorPlan, groundFloorPlan});
  assert.deepEqual(remaining.studies, updated, 'Refreshing provisional metadata must preserve all accepted study records.');
  validateInteriorStudies(updated, campus, lod2);
  await writeFile(new URL('../public/data/house53-module-layouts.json', import.meta.url), `${JSON.stringify(metadata, null, 2)}\n`);
  await writeFile(new URL('../public/data/interior-studies.json', import.meta.url), `${JSON.stringify(updated, null, 2)}\n`);
  await writeFile(new URL('../public/data/old-house-module-layouts.json', import.meta.url), `${JSON.stringify(remaining.metadata, null, 2)}\n`);
  for (const plan of metadata.levels) console.log(`Generated Orange ${plan.levelIndex}: ${plan.totals.singleCount} singles, ${plan.totals.sharedApartmentCount} shared, ${plan.commonAreas.length} common enclosures; ${plan.totals.shellArea.toFixed(2)} m².`);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
