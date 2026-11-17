import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {difference, union} from 'polyclip-ts';
import {createRegistration} from './lib/older-house-registration.mjs';
import {createStudyLevel} from './house55-module-layout.mjs';
import {createFirstFloorStudyLevel} from './house55-first-floor-layout.mjs';
import {createGroundFloorStudyLevel} from './house55-ground-floor-layout.mjs';
import {validateInteriorStudies} from '../src/interior-studies.js';

const clone = value => structuredClone(value);
const round = value => Math.round(value * 1e9) / 1e9;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const signedArea = ring => ring.slice(1).reduce((sum, b, i) =>
  sum + ring[i][0] * b[1] - b[0] * ring[i][1], 0) / 2;
const area = ring => Math.abs(signedArea(ring));
const multiArea = polygons => polygons.reduce((sum, polygon) =>
  sum + area(polygon[0]) - polygon.slice(1).reduce((total, hole) => total + area(hole), 0), 0);
const ID_FIELDS = new Set(['id', 'spaceId', 'toSpaceId']);

function greenId(id, levelIndex) {
  return id.replace(/^study-55-\d+-/, `study-59-${levelIndex}-`)
    .replace(/^module-55-\d+-/, `module-59-${levelIndex}-`)
    .replace(/^module-(?!59-)/, `module-59-${levelIndex}-`);
}

// Only identifiers are remapped. Source filenames and provenance continue to
// name the accepted Red plans from which this separate Green layout derives.
function remapIds(value, levelIndex) {
  if (Array.isArray(value)) return value.map(item => remapIds(item, levelIndex));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key, ID_FIELDS.has(key) && typeof item === 'string' ? greenId(item, levelIndex) : remapIds(item, levelIndex),
  ]));
}

function assertFrame(frame) {
  const {originCampusXZ, axisU, axisV} = frame || {};
  if (![originCampusXZ, axisU, axisV].every(point =>
    Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))
    || Math.abs(Math.hypot(...axisU) - 1) > 1e-8
    || Math.abs(Math.hypot(...axisV) - 1) > 1e-8
    || Math.abs(axisU[0] * axisV[0] + axisU[1] * axisV[1]) > 1e-8
    || Math.abs(axisU[0] * axisV[1] - axisU[1] * axisV[0] - 1) > 1e-8) {
    throw Error('The House 59 registration must be a rigid, orientation-preserving frame in metres.');
  }
}

function coordinateFrame(topPlan, lod2, oldHouseLayouts) {
  const retained = oldHouseLayouts?.houses?.['59']?.coordinateFrame;
  if (retained) {
    assertFrame(retained);
    return clone(retained);
  }
  const source = lod2?.buildings.find(building => building.number === '55');
  const target = lod2?.buildings.find(building => building.number === '59');
  if (!source || !target) throw Error('House 55 and House 59 LoD2 records are required for registration.');
  const registration = createRegistration(source, target);
  const [a, b, c, d] = registration.manifest.rigid;
  const rotate = ([x, y]) => [a * x + b * y, c * x + d * y];
  const frame = {
    originCampusXZ: registration.mapPoint(topPlan.coordinateFrame.originCampusXZ),
    axisU: rotate(topPlan.coordinateFrame.axisU),
    axisV: rotate(topPlan.coordinateFrame.axisV),
    basis: 'Existing source registration anchor and rigid orientation; all layout distances remain unscaled metres.',
  };
  assertFrame(frame);
  return frame;
}

function planNotes(levelIndex) {
  return [
    'Resident confirmation for Green House 59, 15 November 2026: the top floor and 1. OG match completed Red House 55 exactly; EG follows the supplied Hausmeister, Garden room, Storage and extra-dorm annotation.',
    levelIndex === 2
      ? 'All twenty single apartments, halls, stairs, side-wall allocations and the independent outline match the Red top floor exactly in local metres.'
      : levelIndex === 1
        ? 'All sixteen singles, four shared apartments A, W1, N3-N4 and G-H, both enclosed balconies, halls, stairs and the independent outline match Red 1. OG exactly in local metres.'
        : 'EG uses Red’s complete footprint and restores the missing A-bank single. The whole N wing, including its former internal bank hallway, becomes one enclosed Hausmeister area. The eastern R enclosure is Garden room; the western L enclosure is Storage. Each common area has one doorway to the public hallway.',
    'A single rigid House 59 registration anchors all three floors; no scaling, bank shifts, room clipping or shortened modules remain. The stair enclosure, flight and walkway align vertically.',
    'Singles retain 2.70 x 6.00 m clear interiors, two 0.20 m side allocations and 3.10 m modules. Halls remain 1.40 m wide; shared envelopes remain 6.20 x 7.40 m gross.',
    'The resident confirmed the arrangement. Exact openings, floor heights, kitchen and bathroom partitions, shared-apartment internals and common-area fittings remain schematic or unresolved; the red H marks the Hausmeister area and does not establish internal partitions.',
    'Green’s folded official exterior and source window evidence remain separate and unchanged. Schematic layout openings do not transfer Red’s measured facade observations.',
  ];
}

function createLocalPlan(template, frame) {
  const levelIndex = template.levelIndex;
  const plan = remapIds(clone(template), levelIndex);
  plan.house = '59';
  plan.status = 'resident-module-layout';
  plan.coordinateFrame = clone(frame);
  plan.sourceTemplate = levelIndex === 2 ? 'public/data/house55-module-layout.json'
    : levelIndex === 1 ? 'public/data/house55-first-floor-layout.json' : 'public/data/house55-ground-floor-layout.json';
  plan.sourceHashes = {[plan.sourceTemplate]: hash(template)};
  plan.notes = planNotes(levelIndex);
  if (levelIndex === 0) {
    const convertedRooms = plan.rooms.filter(room => room.bank === 'N');
    const convertedShared = plan.sharedApartments.filter(room => room.bank === 'N');
    const convertedHall = plan.corridors.filter(hall => hall.bank === 'N');
    if (convertedRooms.length !== 2 || convertedShared.length !== 1 || convertedHall.length !== 1) {
      throw Error('Expected Red’s complete N1, N2, N3-N4 and N hallway before creating the Hausmeister enclosure.');
    }
    const hausmeisterPolygons = union(
      ...convertedRooms.map(room => [room.modulePolygon]),
      ...convertedShared.map(room => [room.polygon]),
      ...convertedHall.map(hall => [hall.polygon]),
    );
    if (hausmeisterPolygons.length !== 1 || hausmeisterPolygons[0].length !== 1
      || Math.abs(multiArea(hausmeisterPolygons) - 91.76) > 1e-8) {
      throw Error('The Hausmeister enclosure must cover the complete 12.40 x 7.40 m N wing.');
    }
    const removedLabels = new Set(convertedRooms.map(room => room.label));
    plan.rooms = plan.rooms.filter(room => room.bank !== 'N');
    plan.sharedApartments = plan.sharedApartments.filter(room => room.bank !== 'N');
    plan.corridors = plan.corridors.filter(hall => hall.bank !== 'N');
    plan.wallBands = plan.wallBands.filter(band => ![...removedLabels].some(label => band.label.startsWith(`${label} side wall `)));
    plan.commonAreas.forEach(space => {
      const east = space.bank === 'R';
      space.label = east ? 'Garden room' : 'Storage';
      space.use = east ? 'garden-room' : 'storage';
      if (east) space.doorSegment = [[14.05, 7.4], [13.15, 7.4]];
      space.note = east
        ? 'Resident-confirmed Garden room beside the Hausmeister enclosure, separated from the east R hall. One 0.90 m doorway is placed one third of the way from the stair end along its hall-facing wall to follow the green door mark; exact offset and fittings remain schematic.'
        : 'Resident-confirmed Storage in the west L common enclosure, with the same 9.30 x 7.40 m footprint and single hallway entrance as Red’s ground-floor common area. Internal fittings remain unresolved.';
    });
    const hausmeister = {
      id: 'study-59-0-common-N', label: 'Hausmeister', bank: 'N', kind: 'service', use: 'hausmeister',
      polygon: hausmeisterPolygons[0][0].map(point => point.map(round)),
      width: 12.4, depth: 7.4, area: 91.76,
      doorSegment: [[7.15, 7.4], [6.25, 7.4]],
      windowSegments: [...convertedRooms.flatMap(room => [room.windowSegment]),
        ...convertedShared.flatMap(room => room.windowSegments)],
      replaces: [...convertedRooms, ...convertedShared, ...convertedHall].map(item => item.id),
      note: 'Resident-marked Hausmeister area spanning the entire N1-N4 wing, including the former local hallway. One 12.40 x 7.40 m gross enclosure replaces the two singles and N3-N4 shared apartment. The H is a use label; no internal partitions are inferred. One schematic 0.90 m entrance connects to the east hall.',
    };
    plan.commonAreas.push(hausmeister);
    plan.restoredAreas.forEach(space => {
      if (space.status === 'assigned-common-area') {
        space.note = `Outer strip retained from the completed Red ground-floor geometry and included in Green’s ${space.id.endsWith('east') ? 'Garden room' : 'Storage'} enclosure.`;
      }
    });
    plan.totals = {
      ...plan.totals,
      singleCount: plan.rooms.length,
      sharedApartmentCount: plan.sharedApartments.length,
      apartmentCount: plan.rooms.length + plan.sharedApartments.length,
      moduleCount: plan.rooms.length + plan.sharedApartments.reduce((sum, room) => sum + room.moduleCount, 0),
      singleClearArea: round(plan.rooms.reduce((sum, room) => sum + area(room.polygon), 0)),
      sharedEnvelopeArea: round(plan.sharedApartments.reduce((sum, room) => sum + area(room.polygon), 0)),
      sideWallArea: round(plan.wallBands.reduce((sum, wall) => sum + area(wall.polygon), 0)),
      bankHallArea: round(plan.corridors.reduce((sum, hall) => sum + area(hall.polygon), 0)),
      commonArea: round(plan.commonAreas.reduce((sum, common) => sum + area(common.polygon), 0)),
      hausmeisterArea: hausmeister.area,
      convertedNModules: 4,
    };
  }
  const occupied = union(
    ...plan.rooms.map(room => [room.modulePolygon]),
    ...(plan.sharedApartments || []).map(room => [room.polygon]),
    ...plan.corridors.map(corridor => [corridor.polygon]),
    ...(plan.commonAreas || []).map(space => [space.polygon]),
    [plan.stair.polygon],
  );
  const unassigned = difference([plan.shell.outline, ...(plan.shell.holes || [])], occupied);
  plan.unassignedPolygons = unassigned.map(polygon => ({
    outer: polygon[0].map(point => point.map(round)),
    holes: polygon.slice(1).map(ring => ring.map(point => point.map(round))),
  }));
  plan.totals.unassignedArea = round(multiArea(unassigned));
  const expectedUnassigned = levelIndex === 0 ? 7.83 : 0;
  if (Math.abs(plan.totals.unassignedArea - expectedUnassigned) > 1e-8) {
    throw Error(`Unexpected unassigned floor in Green ${levelIndex}: ${plan.totals.unassignedArea} square metres.`);
  }
  return plan;
}

function registerWindows(source, sourceFrame, targetFrame, levelIndex) {
  assertFrame(sourceFrame);
  const {originCampusXZ: sourceOrigin, axisU: sourceU, axisV: sourceV} = sourceFrame;
  const {originCampusXZ: targetOrigin, axisU: targetU, axisV: targetV} = targetFrame;
  // Invert only the accepted source registration. Rounding recovers its local
  // metre coordinates from the serialized campus positions, without a fit.
  const point = sourcePoint => {
    const offset = sourcePoint.map((value, axis) => value - sourceOrigin[axis]);
    const x = round(offset[0] * sourceU[0] + offset[1] * sourceU[1]);
    const y = round(offset[0] * sourceV[0] + offset[1] * sourceV[1]);
    return targetOrigin.map((value, axis) => round(value + x * targetU[axis] + y * targetV[axis]));
  };
  return source.map(window => ({
    ...remapIds(clone(window), levelIndex),
    segment: window.segment.map(point),
    note: 'Schematic opening copied from the accepted Red layout using Green’s rigid registration. Its position does not establish a measured Green façade opening; Green’s folded source evidence is retained separately.',
  }));
}

function createGreenStudyLevel(plan, previous, sourceLevel, sourceFrame) {
  const create = plan.levelIndex === 2 ? createStudyLevel
    : plan.levelIndex === 1 ? createFirstFloorStudyLevel : createGroundFloorStudyLevel;
  const level = remapIds(create(plan, previous), plan.levelIndex);
  level.source = `Resident-confirmed Green House 59 arrangement, 15 November 2026. ${plan.levelIndex === 0 ? 'Red-derived EG with the missing single restored, one Hausmeister enclosure across the N wing, Garden room beside the east hall and Storage beside the west hall.' : `The complete ${plan.levelIndex}. OG matches Red House 55 in local geometry, including its rooms, halls, stairs and any balconies.`}`;
  level.notes = plan.notes.join(' ');
  level.layoutWindows = registerWindows(sourceLevel.layoutWindows, sourceFrame, plan.coordinateFrame, plan.levelIndex);
  if (plan.levelIndex === 0) {
    const hausmeister = plan.commonAreas.find(space => space.use === 'hausmeister');
    const replaced = new Set(hausmeister.replaces);
    let windowIndex = 0;
    level.layoutWindows = level.layoutWindows.map(window => replaced.has(window.spaceId) ? {
      ...window, id: `module-59-0-window-Hausmeister-${windowIndex++}`,
      label: `Hausmeister window ${windowIndex}`, spaceId: hausmeister.id,
    } : window);
    const gardenDoor = level.doors.find(door => door.spaceId === 'study-59-0-common-R');
    gardenDoor.note = 'One schematic 0.90 m Garden room entrance one third of the way from the stair end along the wall facing the east hall, following the resident green door mark.';
    const hausmeisterDoor = level.doors.find(door => door.spaceId === hausmeister.id);
    hausmeisterDoor.note = 'One schematic 0.90 m entrance from the enclosed Hausmeister wing to the east hall; former apartment doors are removed.';
  }
  // These records belong to the folded Green exterior. They must not receive
  // Red identifiers, Red coordinates or newly inferred room associations.
  for (const key of ['windows', 'windowCoverage']) {
    delete level[key];
    if (previous[key] !== undefined) level[key] = clone(previous[key]);
  }
  return level;
}

/**
 * Replace only Green's interior study using the completed Red local plans.
 * All arguments remain unchanged; repeated builds produce identical output.
 */
export function createHouse59ModuleLayouts({studies, lod2, topPlan, firstFloorPlan, groundFloorPlan, oldHouseLayouts}) {
  const templates = [groundFloorPlan, firstFloorPlan, topPlan];
  if (templates.some((plan, index) => plan?.house !== '55' || plan.levelIndex !== index || plan.status !== 'resident-module-layout')) {
    throw Error('Expected the completed House 55 EG, 1. OG and 2. OG independent module templates.');
  }
  const previous = studies?.buildings?.['59'];
  const source = studies?.buildings?.['55'];
  if (!previous || !source || previous.levels.length !== 3) throw Error('Expected the existing Green and completed Red three-floor studies.');
  const frame = coordinateFrame(topPlan, lod2, oldHouseLayouts);
  const sourceLevels = templates.map(template => {
    const level = source.levels.find(item => item.index === template.levelIndex);
    if (level?.layoutBasis !== 'resident-module-layout' || !Array.isArray(level.layoutWindows)) {
      throw Error(`Missing accepted Red schematic openings for floor ${template.levelIndex}.`);
    }
    return level;
  });
  for (const template of templates) {
    if (JSON.stringify(template.stair) !== JSON.stringify(topPlan.stair)
      || JSON.stringify(template.coordinateFrame) !== JSON.stringify(topPlan.coordinateFrame)) {
      throw Error('Accepted Red floors must share exactly the same stair geometry and registration.');
    }
  }
  const plans = previous.levels.map(level => {
    if (![0, 1, 2].includes(level.index)) throw Error('Green must have exactly EG, 1. OG and 2. OG.');
    return createLocalPlan(templates[level.index], frame);
  });
  const result = clone(studies);
  result.buildings['59'] = {
    ...clone(previous),
    sourceDate: '2026-11-15',
    source: 'Resident-confirmed Green House 59 layout: 2. OG and 1. OG match completed Red House 55 exactly. EG restores the missing A-bank single within Red’s full footprint, replaces the N apartment wing and its local hallway with one Hausmeister enclosure, and assigns the eastern common area to Garden room and the western common area to Storage. Stairs align vertically. Green’s folded exterior and source window evidence remain unchanged; internal partitions, service fittings and exact openings remain unresolved.',
    levels: previous.levels.map((level, index) => createGreenStudyLevel(
      plans[index], level, sourceLevels[level.index], templates[level.index].coordinateFrame,
    )),
  };
  const metadata = {
    schemaVersion: 1, house: '59', status: 'resident-module-layout', units: 'metres',
    sourceDate: '2026-11-15',
    sourceAnnotation: {
      path: 'data/source/house59-eg-resident-annotation.png',
      sha256: 'd7647b1ec8d4892aa9105c4188cd5f8098b1603a5cc152bec1c778c925a87bf4',
      interpretation: 'Red H labels the complete N-wing Hausmeister enclosure; the green lower A-wing mark restores one single, the green doorway mark enters Garden room, and the opposite common enclosure is Storage.',
    },
    coordinateFrame: clone(frame),
    sourceHashes: {topPlan: hash(topPlan), firstFloorPlan: hash(firstFloorPlan), groundFloorPlan: hash(groundFloorPlan)},
    sourceHashMethod: 'SHA-256 of JSON.stringify of each accepted House 55 local plan.',
    registration: 'Retained House 59 registration anchor and rigid orientation only; previous per-bank fit offsets are discarded.',
    notes: [
      'The complete top and first floors match the completed Red House 55 local plans, including both first-floor balconies.',
      'The complete ground-floor shell also matches Red. The N1-N4 wing becomes one Hausmeister enclosure; the east common area is Garden room and the west is Storage. The missing A-bank single is restored.',
      'No room bank is stretched, shortened or shifted. Only Red’s retained 7.83 square metre EG stair-side spur remains unassigned.',
      'The resident confirmed this arrangement. Exact openings, interior service fittings, shared-apartment partitions and floor elevations remain unresolved.',
    ],
    levels: plans,
  };
  return {studies: result, metadata};
}

async function main() {
  const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const [studies, lod2, topPlan, firstFloorPlan, groundFloorPlan, campus] = await Promise.all([
    read('public/data/interior-studies.json'), read('public/data/lod2.json'), read('public/data/house55-module-layout.json'),
    read('public/data/house55-first-floor-layout.json'), read('public/data/house55-ground-floor-layout.json'),
    read('public/data/campus.json'),
  ]);
  const result = createHouse59ModuleLayouts({studies, lod2, topPlan, firstFloorPlan, groundFloorPlan});
  validateInteriorStudies(result.studies, campus, lod2);
  await writeFile(new URL('../public/data/house59-module-layouts.json', import.meta.url), JSON.stringify(result.metadata, null, 2) + '\n');
  await writeFile(new URL('../public/data/interior-studies.json', import.meta.url), JSON.stringify(result.studies, null, 2) + '\n');
  console.log(JSON.stringify(result.metadata.levels.map(plan => ({
    floor: plan.levelIndex, singles: plan.rooms.length, shared: plan.sharedApartments?.length || 0,
    common: (plan.commonAreas || []).map(space => space.label), floorArea: plan.totals.shellArea,
    unassignedArea: plan.totals.unassignedArea,
  })), null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
