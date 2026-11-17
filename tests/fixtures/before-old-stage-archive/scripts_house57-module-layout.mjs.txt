import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {difference, union} from 'polyclip-ts';
import {createRegistration} from './generate-old-house-studies.mjs';
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
const samePoint = (a, b) => a.every((value, axis) => Math.abs(value - b[axis]) < 1e-8);
const ID_FIELDS = new Set(['id', 'spaceId', 'toSpaceId']);

function whiteId(id, levelIndex) {
  return id.replace(/^study-55-\d+-/, `study-57-${levelIndex}-`)
    .replace(/^module-55-\d+-/, `module-57-${levelIndex}-`)
    .replace(/^module-(?!57-)/, `module-57-${levelIndex}-`);
}

// Only identifiers are remapped. Source filenames and provenance continue to
// name the accepted Red plans from which this separate White layout derives.
function remapIds(value, levelIndex) {
  if (Array.isArray(value)) return value.map(item => remapIds(item, levelIndex));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key, ID_FIELDS.has(key) && typeof item === 'string' ? whiteId(item, levelIndex) : remapIds(item, levelIndex),
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
    throw Error('The House 57 registration must be a rigid, orientation-preserving frame in metres.');
  }
}

function coordinateFrame(topPlan, lod2, oldHouseLayouts) {
  const retained = oldHouseLayouts?.houses?.['57']?.coordinateFrame;
  if (retained) {
    assertFrame(retained);
    return clone(retained);
  }
  const source = lod2?.buildings.find(building => building.number === '55');
  const target = lod2?.buildings.find(building => building.number === '57');
  if (!source || !target) throw Error('House 55 and House 57 LoD2 records are required for registration.');
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

function preserveOutlineDirection(ring, original) {
  let points = ring.slice(0, -1).map(point => point.map(round));
  if (Math.sign(signedArea(ring)) !== Math.sign(signedArea(original))) points.reverse();
  const start = points.findIndex(point => samePoint(point, original[0]));
  if (start < 0) throw Error('The balcony cutout must retain the accepted drawing origin.');
  points = [...points.slice(start), ...points.slice(0, start)];
  return [...points, [...points[0]]];
}

function planNotes(levelIndex) {
  const arrangement = levelIndex === 2
    ? 'The twenty single apartments, room banks, hallways, stairs, side-wall allocations and complete floor outline match the accepted Red House 55 top floor exactly in local metres.'
    : 'The sixteen single apartments and four shared envelopes A, W1, N3-N4 and G-H retain the accepted Red House 55 lower-floor arrangement exactly in local metres.';
  const differenceNote = levelIndex === 1
    ? 'White has no east hall balcony on 1. OG. Its 9.30 x 2.90 m enclosure, floor footprint and doorway are removed; the west balcony and both halls retain their Red geometry.'
    : levelIndex === 0
      ? 'The east enclosure beside R is the resident-confirmed Gym and the west enclosure beside L is the Study. Their 9.30 x 7.40 m envelopes and entrances match Red. The complete Red ground-floor footprint is retained, including its 7.83 square metre unassigned stair-side spur.'
      : 'There are no top-floor layout differences from Red.';
  return [
    'Resident confirmation for White House 57, 15 November 2026: use the completed Red House 55 interior arrangement and replace White’s previous provisional floor outlines.',
    arrangement,
    differenceNote,
    'The same rigid House 57 registration is used on all three floors, with no rescaling, bank shifts, shortened rooms or omitted apartments. The 2.70 m stair enclosure, 1.30 m flight column and 1.40 m walkway align vertically.',
    'Single clear interiors remain 2.70 x 6.00 m with two 0.20 m side allocations, giving 3.10 m modules; halls remain 1.40 m wide. Shared envelopes remain 6.20 x 7.40 m gross.',
    'The resident confirmed the matching arrangement and named differences. These are independent modeling assumptions, not a survey of White: exact openings, floor elevations, bathroom and kitchen partitions, shared-apartment internals and service-space fittings remain unresolved. Door, window and stair symbols are schematic.',
    'White’s original folded exterior and any source window evidence remain separate and unchanged.',
  ];
}

function createLocalPlan(template, frame) {
  const levelIndex = template.levelIndex;
  const plan = remapIds(clone(template), levelIndex);
  plan.house = '57';
  plan.status = 'resident-module-layout';
  plan.coordinateFrame = clone(frame);
  plan.sourceTemplate = levelIndex === 2 ? 'public/data/house55-module-layout.json'
    : levelIndex === 1 ? 'public/data/house55-first-floor-layout.json' : 'public/data/house55-ground-floor-layout.json';
  plan.sourceHashes = {[plan.sourceTemplate]: hash(template)};
  plan.notes = planNotes(levelIndex);
  if (levelIndex === 1) {
    const east = plan.commonAreas.find(space => space.bank === 'R' && space.use === 'balcony');
    if (!east || Math.abs(area(east.polygon) - 26.97) > 1e-8) {
      throw Error('Expected the accepted 26.97 square metre east balcony in the Red first-floor template.');
    }
    const polygons = difference([plan.shell.outline, ...(plan.shell.holes || [])], [east.polygon]);
    if (polygons.length !== 1 || polygons[0].length !== 1) {
      throw Error('Removing the east balcony must leave one continuous first-floor outline without holes.');
    }
    plan.shell = {outline: preserveOutlineDirection(polygons[0][0], template.shell.outline), holes: []};
    plan.commonAreas = plan.commonAreas.filter(space => space !== east);
    plan.totals.commonArea = round(plan.totals.commonArea - east.area);
    plan.totals.shellArea = round(area(plan.shell.outline));
    if (Math.abs(template.totals.shellArea - plan.totals.shellArea - 26.97) > 1e-8) {
      throw Error('Only the east balcony footprint may be removed from the first floor.');
    }
    plan.commonAreas.forEach(space => {
      space.note = 'Resident-confirmed west balcony in the same 9.30 x 2.90 m enclosure as Red, with one entrance near the stairs. The 0.90 m doorway width and exact offset remain schematic.';
    });
    plan.outlineDimensions = plan.shell.outline.slice(1).map((b, i) => ({
      a: plan.shell.outline[i], b, length: round(Math.hypot(b[0] - plan.shell.outline[i][0], b[1] - plan.shell.outline[i][1])),
    }));
  } else if (levelIndex === 0) {
    plan.commonAreas.forEach(space => {
      const east = space.bank === 'R';
      space.label = east ? 'Gym' : 'Study';
      space.use = east ? 'gym' : 'study';
      space.note = `Resident-confirmed ${space.label.toLowerCase()} beside the ${east ? 'east R' : 'west L'} hallway, occupying the same 9.30 x 7.40 m enclosure as Red. The entrance remains near the stairs; exact opening placement and internal fittings remain schematic.`;
    });
    plan.restoredAreas.forEach(space => {
      if (space.status === 'assigned-common-area') {
        space.note = `Outer strip retained from the accepted Red ground-floor geometry and included in White’s ${space.id.endsWith('east') ? 'gym' : 'study'} enclosure.`;
      }
    });
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
    throw Error(`Unexpected unassigned floor in White ${levelIndex}: ${plan.totals.unassignedArea} square metres.`);
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
    note: 'Schematic opening copied from the accepted Red layout using White’s rigid registration. Its position does not establish a measured White façade opening; White’s folded source evidence is retained separately.',
  }));
}

function createWhiteStudyLevel(plan, previous, sourceLevel, sourceFrame) {
  const create = plan.levelIndex === 2 ? createStudyLevel
    : plan.levelIndex === 1 ? createFirstFloorStudyLevel : createGroundFloorStudyLevel;
  const level = remapIds(create(plan, previous), plan.levelIndex);
  level.source = `Resident-confirmed White House 57 arrangement derived from the completed Red House 55 ${plan.levelIndex === 0 ? 'EG' : `${plan.levelIndex}. OG`} layout, 15 November 2026. ${plan.levelIndex === 1 ? 'The east balcony and its floor footprint are absent; the west balcony remains.' : plan.levelIndex === 0 ? 'Gym beside the east R hallway and Study beside the west L hallway.' : 'All twenty singles, halls, stairs and floor geometry match Red.'}`;
  level.notes = plan.notes.join(' ');
  level.layoutWindows = registerWindows(sourceLevel.layoutWindows, sourceFrame, plan.coordinateFrame, plan.levelIndex);
  // These records belong to the folded White exterior. They must not receive
  // Red identifiers, Red coordinates or newly inferred room associations.
  for (const key of ['windows', 'windowCoverage']) {
    delete level[key];
    if (previous[key] !== undefined) level[key] = clone(previous[key]);
  }
  return level;
}

/**
 * Replace only White's interior study using the completed Red local plans.
 * All arguments remain unchanged; repeated builds produce identical output.
 */
export function createHouse57ModuleLayouts({studies, lod2, topPlan, firstFloorPlan, groundFloorPlan, oldHouseLayouts}) {
  const templates = [groundFloorPlan, firstFloorPlan, topPlan];
  if (templates.some((plan, index) => plan?.house !== '55' || plan.levelIndex !== index || plan.status !== 'resident-module-layout')) {
    throw Error('Expected the completed House 55 EG, 1. OG and 2. OG independent module templates.');
  }
  const previous = studies?.buildings?.['57'];
  const source = studies?.buildings?.['55'];
  if (!previous || !source || previous.levels.length !== 3) throw Error('Expected the existing White and completed Red three-floor studies.');
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
    if (![0, 1, 2].includes(level.index)) throw Error('White must have exactly EG, 1. OG and 2. OG.');
    return createLocalPlan(templates[level.index], frame);
  });
  const result = clone(studies);
  result.buildings['57'] = {
    ...clone(previous),
    sourceDate: '2026-11-15',
    source: 'Resident-confirmed White House 57 interior uses the completed Red House 55 arrangement and independent floor outlines. The only differences are no east hall balcony or its footprint on 1. OG, Gym in the east EG enclosure beside R, and Study in the west EG enclosure beside L. The full room inventory and vertically aligned stairs are retained. White’s folded exterior and source window evidence remain unchanged; dimensions and schematic openings are modeling assumptions, with service fittings and internal partitions unresolved.',
    levels: previous.levels.map((level, index) => createWhiteStudyLevel(
      plans[index], level, sourceLevels[level.index], templates[level.index].coordinateFrame,
    )),
  };
  const metadata = {
    schemaVersion: 1, house: '57', status: 'resident-module-layout', units: 'metres',
    sourceDate: '2026-11-15',
    coordinateFrame: clone(frame),
    sourceHashes: {topPlan: hash(topPlan), firstFloorPlan: hash(firstFloorPlan), groundFloorPlan: hash(groundFloorPlan)},
    sourceHashMethod: 'SHA-256 of JSON.stringify of each accepted House 55 local plan.',
    registration: 'Retained House 57 registration anchor and rigid orientation only; previous per-bank fit offsets are discarded.',
    notes: [
      'All three canonical local templates are copied from the completed Red House 55 plans without stretching, shortening or shifting any room bank.',
      'Only the east 1. OG balcony enclosure, footprint and entrance are removed; EG Cinema becomes Gym and Laundry becomes Study.',
      'The top and EG local shells match Red exactly. Only Red’s retained 7.83 square metre EG stair-side spur remains unassigned.',
      'The resident confirmed this arrangement. Exact openings, interior service fittings, shared-apartment partitions and floor elevations remain unresolved.',
    ],
    levels: plans,
  };
  return {studies: result, metadata};
}

async function main() {
  const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const [studies, lod2, topPlan, firstFloorPlan, groundFloorPlan, oldHouseLayouts, campus] = await Promise.all([
    read('public/data/interior-studies.json'), read('public/data/lod2.json'), read('public/data/house55-module-layout.json'),
    read('public/data/house55-first-floor-layout.json'), read('public/data/house55-ground-floor-layout.json'),
    read('public/data/old-house-module-layouts.json'), read('public/data/campus.json'),
  ]);
  const result = createHouse57ModuleLayouts({studies, lod2, topPlan, firstFloorPlan, groundFloorPlan, oldHouseLayouts});
  validateInteriorStudies(result.studies, campus, lod2);
  await writeFile(new URL('../public/data/house57-module-layouts.json', import.meta.url), JSON.stringify(result.metadata, null, 2) + '\n');
  await writeFile(new URL('../public/data/interior-studies.json', import.meta.url), JSON.stringify(result.studies, null, 2) + '\n');
  console.log(JSON.stringify(result.metadata.levels.map(plan => ({
    floor: plan.levelIndex, singles: plan.rooms.length, shared: plan.sharedApartments?.length || 0,
    common: (plan.commonAreas || []).map(space => space.label), floorArea: plan.totals.shellArea,
    unassignedArea: plan.totals.unassignedArea,
  })), null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
