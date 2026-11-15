import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Raycaster, Vector3 } from 'three';
import { difference, intersection, union } from 'polyclip-ts';
import { validateInteriorData, getLevelElevations } from '../src/interiors.js';
import { validateInteriorStudies, getDisplayLevel, getLevelWindows, studyFloorSection, studyPlanDirection } from '../src/interior-studies.js';
import { createInteriorWireframe } from '../src/interior-wireframe.js';
import { floorSection } from '../src/sections.js';
import { readHistoricalStudies, assertUnchangedOtherFloors } from './fixtures/pre-module-studies.mjs';

const read = async name => JSON.parse(await readFile(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'));
const [campus, lod2] = await Promise.all(['campus', 'lod2'].map(read));
const emptyApproved = { schemaVersion: 1, buildings: {} };
const rectangle = (left, bottom, right, top) => [[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]];
const entry = studies => studies.buildings['55'];
const level = studies => entry(studies).levels[0];
const room = studies => level(studies).spaces[0];
const validate = studies => validateInteriorStudies(studies, campus, lod2);
const display = studies => getDisplayLevel(emptyApproved, studies, '55', 2);
const priorUpper = async () => JSON.parse(await readFile(new URL('../data/source/house55-2og-before-module-layout.json', import.meta.url), 'utf8')).level;

// Synthetic plans exercise the data contract; none is loaded by the website.
function fixture() {
  return { schemaVersion: 1, buildings: { '55': {
    source: 'Synthetic resident-study fixture, never a real floor plan',
    sourceDate: '2026-11-15',
    levels: [{
      index: 2, label: 'Synthetic upper floor', source: 'Synthetic drawing',
      notes: 'Letters identify test shapes, never physical room numbers.',
      floorOutline: [{ outer: rectangle(-2, -4, 10, 8), holes: [] }],
      spaces: [
        {id: 'study-room-a', label: 'Room A', kind: 'room', confidence: 'estimated', polygon: rectangle(0, 0, 4, 3)},
        {id: 'study-hall', label: 'Hall', kind: 'corridor', confidence: 'sketch', polygon: rectangle(0, -2, 4, 0)},
      ],
      doors: [{id: 'study-door-a', label: 'Door A', confidence: 'estimated', spaceId: 'study-room-a', toSpaceId: 'study-hall', segment: [[1.4, 0], [2.3, 0]]}],
    }],
  } } };
}

test('independent floor openings and outline stay separate from the retained source façade', async () => {
  const data = fixture(), plan = level(data);
  const original = (await read('interior-studies')).buildings['55'].levels.find(item => item.index === 2);
  plan.layoutBasis = 'resident-module-layout';
  plan.windows = [{...structuredClone(original.windows[0]), id: 'source-window-fixture', spaceId: 'study-room-a'}];
  plan.windowCoverage = 'complete-floor';
  plan.layoutWindows = [{
    id: 'layout-window-fixture', label: 'Layout window', spaceId: 'study-room-a',
    confidence: 'estimated', note: 'Schematic opening on the independently arranged room.',
    segment: [[1, 3], [2, 3]],
  }];
  const before = structuredClone(data);
  assert.equal(validate(data), true, 'source façade windows need not move into the independent floor outline');
  const shown = display(data);
  assert.deepEqual(getLevelWindows(shown), plan.layoutWindows);
  const section = studyFloorSection({polygons: [{outer: rectangle(90, 90, 99, 99)}], sourceStatus: 'source'}, shown);
  assert.equal(section.sourceStatus, 'independent-module-layout-outline');
  assert.deepEqual(section.polygons[0].outer, plan.floorOutline[0].outer);
  const wireframe = createInteriorWireframe(shown, {house: '55', floor: 2});
  const symbols = wireframe.group.children.find(child => child.userData.role === 'layout-window-symbols');
  assert.deepEqual(symbols.userData.windowIds, ['layout-window-fixture']);
  assert.ok(!wireframe.group.children.some(child => child.userData.role === 'resident-window-symbols'));
  assert.deepEqual(data, before);
  for (const change of [
    copy => { level(copy).layoutBasis = 'measured-floor'; },
    copy => { delete level(copy).layoutBasis; },
    copy => { level(copy).windows[0].segment = [[900, 900], [901, 900]]; },
    copy => { level(copy).layoutWindows[0].segment = [[1, 2], [2, 2]]; },
    copy => { level(copy).layoutWindows[0].confidence = 'sketch'; },
    copy => { level(copy).layoutWindows[0].sourceSurfaceIndex = 0; },
  ]) {
    const invalid = structuredClone(data);
    change(invalid);
    assert.throws(() => validate(invalid), /layoutBasis|layoutWindows|window|not allowed/);
  }
});

test('estimated dimension guides reject external spans, source-confidence upgrades and private metadata', () => {
  const data = fixture(), plan = level(data);
  plan.dimensionGuides = [{
    id: 'estimate-span', label: 'Estimated bank', confidence: 'estimated',
    note: 'Illustrative internal span.', segment: [[0, 0], [4, 0]], outward: [0, -1],
  }];
  assert.equal(validate(data), true);
  for (const change of [
    guide => { guide.confidence = 'verified'; },
    guide => { guide.segment = [[0, 0], [40, 0]]; },
    guide => { guide.outward = [0, -4]; },
    guide => { guide.resident = 'unsupported field'; },
  ]) {
    const invalid = structuredClone(data);
    change(level(invalid).dimensionGuides[0]);
    assert.throws(() => validate(invalid), /dimensionGuides/);
  }
});

function approvedFixture() {
  return { schemaVersion: 1, buildings: { '55': {
    approved: true, source: 'Synthetic approved plan', reviewedAt: '2025-10-14',
    reusePermission: 'Original test geometry',
    levels: [{
      index: 2, label: 'Approved test floor', elevation: 6.3, source: 'Synthetic measured test plan', reviewedAt: '2025-10-14',
      spaces: [{id: 'approved-room', label: 'Approved test room', kind: 'room', polygon: rectangle(0, 0, 3, 3)}],
    }],
  } } };
}

function copyFloor(source, index) {
  const copy = structuredClone(source);
  copy.index = index;
  const items = [...copy.spaces, ...(copy.doors || []), ...(copy.excludedAreas || [])];
  const ids = new Map(items.map(item => [item.id, `${item.id}-floor${index}`]));
  items.forEach(item => { item.id = ids.get(item.id); });
  copy.spaces.forEach(space => { space.confidence = 'estimated'; });
  (copy.doors || []).forEach(door => {
    door.confidence = 'estimated';
    door.spaceId = ids.get(door.spaceId);
    if (door.toSpaceId !== undefined) door.toSpaceId = ids.get(door.toSpaceId);
  });
  return copy;
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function meshArea(mesh) {
  const values = mesh.geometry.attributes.position.array;
  let area = 0;
  for (let i = 0; i < values.length; i += 9) {
    area += Math.abs((values[i + 3] - values[i]) * (values[i + 8] - values[i + 2])
      - (values[i + 5] - values[i + 2]) * (values[i + 6] - values[i])) / 2;
  }
  return area;
}

const ringArea = ring => Math.abs(ring.slice(1).reduce((sum, b, i) => sum + ring[i][0] * b[1] - b[0] * ring[i][1], 0)) / 2;
const polygonArea = ([outer, ...holes]) => ringArea(outer) - holes.reduce((sum, hole) => sum + ringArea(hole), 0);
const multiArea = polygons => polygons.reduce((sum, polygon) => sum + polygonArea(polygon), 0);

// Published LoD2 vertices are millimetre-quantized. Independently clipped source
// edges, six-decimal study serialization and Float32 meshes can leave thin
// sub-millimetre slivers. Bound both their thickness (0.2 mm) and total area;
// an area-only tolerance could conceal a narrow but materially displaced edge.
// Synthetic overlap and hole-filling tests retain their stricter exact checks.
const sourceBoundaryAreaTolerance = 0.001;
function assertSourceBoundaryFit(subject, target, message) {
  const outside = difference(subject, target);
  const outsideArea = multiArea(outside);
  assert.ok(outsideArea < sourceBoundaryAreaTolerance, `${message}: exterior difference is ${outsideArea} m²`);
  const boundary = target.flatMap(polygon => polygon.flatMap(ring => ring.slice(1).map((b, i) => [ring[i], b])));
  for (const point of outside.flat(2)) {
    const nearest = Math.min(...boundary.map(([a, b]) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], squaredLength = dx * dx + dz * dz;
      const t = squaredLength ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / squaredLength)) : 0;
      return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dz);
    }));
    assert.ok(nearest < 0.0002, `${message}: exterior offset is ${nearest * 1000} mm`);
  }
  return outsideArea;
}

function sharedBoundaryLength(first, second) {
  let total = 0;
  for (let i = 1; i < first.length; i++) {
    const a = first[i - 1], b = first[i], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    for (let j = 1; j < second.length; j++) {
      const c = second[j - 1], d = second[j];
      if ([c, d].some(point => Math.abs(dx * (point[1] - a[1]) - dz * (point[0] - a[0])) / length > 0.00001)) continue;
      const positions = [c, d].map(point => ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / length).sort((x, y) => x - y);
      total += Math.max(0, Math.min(length, positions[1]) - Math.max(0, positions[0]));
    }
  }
  return total;
}

function cornersOnly(ring) {
  const points = ring.slice(0, -1).map(point => [...point]);
  let changed = true;
  while (changed && points.length > 3) {
    changed = false;
    for (let i = 0; i < points.length; i++) {
      const a = points[(i + points.length - 1) % points.length], b = points[i], c = points[(i + 1) % points.length];
      const dx = c[0] - a[0], dz = c[1] - a[1], length = Math.hypot(dx, dz);
      const along = ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / length;
      if (length && Math.abs(dx * (b[1] - a[1]) - dz * (b[0] - a[0])) / length < 0.00001 && along > 0 && along < length) {
        points.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return points;
}

function wallSegments(result) {
  return result.group.children.filter(child => ['interior-walls', 'estimated-interior-walls'].includes(child.userData.role))
    .flatMap(child => {
      const values = child.geometry.attributes.position.array;
      return Array.from({length: values.length / 6}, (_, i) => ({
        role: child.userData.role, values: [...values.slice(i * 6, i * 6 + 6)],
      }));
    });
}

test('study validation and rendering preserve their source and never establish height anchors', () => {
  const studies = freeze(fixture()), before = structuredClone(studies);
  assert.equal(validate(studies), true);
  const resolved = display(studies);
  assert.equal(resolved.isStudy, true);
  assert.equal(Object.hasOwn(level(studies), 'isStudy'), false, 'display status is derived, never inserted in source data');
  createInteriorWireframe(resolved, {house: '55', floor: 2});
  assert.deepEqual(studies, before);
  assert.deepEqual(getLevelElevations(studies, '55', 3, 9), [0, 3, 6], 'a study cannot become a measured elevation anchor');
  assert.equal(validate({schemaVersion: 1, buildings: {}}), true);
});

test('studies reject approval, height and personal fields at all supported nesting levels', () => {
  const targets = [
    [data => data, 'residents'], [entry, 'approved'], [entry, 'reusePermission'],
    [entry, 'whatsappInvite'], [level, 'elevation'], [level, 'reviewedAt'], [level, 'occupants'],
    [room, 'residentName'], [room, 'isOccupied'], [room, 'physicalRoomNumber'],
    [data => level(data).doors[0], 'phone'], [data => level(data).doors[0], 'hinge'],
    [data => level(data).floorOutline[0], 'resident'],
  ];
  for (const [target, key] of targets) {
    const data = fixture();
    target(data)[key] = 'Unsupported data';
    assert.throws(() => validate(data), /not allowed/, `${key} must not enter a public study`);
  }
  const excluded = fixture();
  level(excluded).excludedAreas = [{id: 'excluded-test', label: 'Excluded area', polygon: rectangle(8, 5, 9, 6), occupant: 'Unsupported data'}];
  assert.throws(() => validate(excluded), /not allowed/);
});

test('every area and doorway requires explicit sketch or estimated confidence and plain source notes', () => {
  for (const target of [room, data => level(data).doors[0]]) {
    for (const confidence of [undefined, 'approved', 'measured', '', true]) {
      const data = fixture();
      target(data).confidence = confidence;
      assert.throws(() => validate(data), /confidence/);
    }
  }
  for (const field of ['source', 'notes']) {
    const data = fixture();
    level(data)[field] = '<script>untrusted</script>';
    assert.throws(() => validate(data), /plain text/);
  }
  const badDate = fixture();
  entry(badDate).sourceDate = '2026-02-30';
  assert.throws(() => validate(badDate), /calendar date/);
});

test('unmapped houses, duplicate floors and reused interaction IDs cannot create ambiguous study targets', () => {
  const unknown = fixture();
  unknown.buildings['999'] = entry(unknown);
  delete unknown.buildings['55'];
  assert.throws(() => validate(unknown), /existing house/);
  for (const index of [-1, 3, 1.5, '2']) {
    const data = fixture();
    level(data).index = index;
    assert.throws(() => validate(data), /existing floor/);
  }
  const duplicateFloor = fixture();
  entry(duplicateFloor).levels.push(structuredClone(level(duplicateFloor)));
  assert.throws(() => validate(duplicateFloor), /unique existing floor/);
  const duplicateId = fixture();
  level(duplicateId).doors[0].id = room(duplicateId).id;
  assert.throws(() => validate(duplicateId), /unique stable geometry ID/);
});

test('copied floor studies require globally unique targets and strictly same-floor doorway references', () => {
  const data = fixture(), upper = level(data), lower = copyFloor(upper, 0);
  entry(data).levels.push(lower);
  assert.equal(validate(data), true, 'vertically stacked studies may share coordinates while retaining different targets');
  assert.notEqual(getDisplayLevel(emptyApproved, data, '55', 0).spaces[0].id, getDisplayLevel(emptyApproved, data, '55', 2).spaces[0].id);
  const duplicate = structuredClone(data);
  entry(duplicate).levels[1].spaces[0].id = upper.spaces[0].id;
  assert.throws(() => validate(duplicate), /unique stable geometry ID/);
  for (const key of ['spaceId', 'toSpaceId']) {
    const crossFloor = structuredClone(data);
    entry(crossFloor).levels[1].doors[0][key] = upper.doors[0][key];
    assert.throws(() => validate(crossFloor), /source space boundary|destination boundary/, `${key} must not link a matching polygon on another floor`);
  }
});

test('extrapolation records its direct source floor and cannot imply evidence from missing, circular or assumed plans', () => {
  const data = fixture(), upper = level(data), lower = copyFloor(upper, 0);
  lower.extrapolatedFrom = 2;
  entry(data).levels.push(lower);
  assert.equal(validate(data), true);
  assert.equal(getDisplayLevel(emptyApproved, data, '55', 0).extrapolatedFrom, 2);
  for (const source of [0, 1, 3, '2', 1.5, null]) {
    const invalid = structuredClone(data);
    entry(invalid).levels[1].extrapolatedFrom = source;
    assert.throws(() => validate(invalid), /extrapolat|source|floor/, `source ${source} must be an existing different integer floor`);
  }
  const chained = structuredClone(data), middle = copyFloor(upper, 1);
  middle.extrapolatedFrom = 0;
  entry(chained).levels.push(middle);
  assert.throws(() => validate(chained), /extrapolat|direct|source/, 'a copied plan cannot become evidence for another copied floor');
  const cycle = structuredClone(data);
  level(cycle).extrapolatedFrom = 0;
  assert.throws(() => validate(cycle), /extrapolat|direct|source/, 'circular provenance cannot invent a direct observation');
  for (const kind of ['spaces', 'doors']) {
    const overstated = structuredClone(data);
    entry(overstated).levels[1][kind][0].confidence = 'sketch';
    assert.throws(() => validate(overstated), /estimated|extrapolat/, `copied ${kind} must remain estimates`);
  }
});

test('distinct study IDs cannot hide coincident rooms or crossing room overlaps', () => {
  for (const polygon of [rectangle(0, 0, 4, 3), rectangle(3, 1, 5, 4)]) {
    const data = fixture();
    level(data).spaces.push({...room(data), id: 'overlapping-room', label: 'Overlapping estimate', polygon});
    assert.throws(() => validate(data), /overlaps/, 'overlapping areas must fail even with unique IDs and valid individual boundaries');
  }
  assert.equal(validate(fixture()), true, 'the room and hall may still share their doorway boundary');
});

test('an approved plan wins on its exact floor; studies never spread to siblings or other houses', () => {
  const approved = freeze(approvedFixture()), studies = freeze(fixture());
  assert.equal(validateInteriorData(approved, campus, lod2), true);
  const selected = getDisplayLevel(approved, studies, '55', 2);
  assert.equal(selected, approved.buildings['55'].levels[0]);
  assert.equal(selected.isStudy, undefined);
  for (const [house, floor] of [['55', 0], ['55', 1], ['53', 2], ['55a', 2], ['55', '2'], ['55', null]]) {
    assert.equal(getDisplayLevel(approved, studies, house, floor), null);
  }
  const revoked = structuredClone(approved);
  revoked.buildings['55'].approved = false;
  assert.equal(getDisplayLevel(revoked, studies, '55', 2).isStudy, true);
  assert.equal(getDisplayLevel(emptyApproved, {...studies, schemaVersion: 2}, '55', 2), null);
});

test('outline correction changes only the mapped display plate and preserves every source and elevation', () => {
  const studies = freeze(fixture()), sourceBefore = structuredClone(lod2);
  const source = lod2.buildings.find(building => building.number === '55');
  const section = freeze(floorSection(source, 6.3)), before = structuredClone(section);
  const corrected = studyFloorSection(section, display(studies));
  assert.notEqual(corrected, section);
  assert.deepEqual(corrected.polygons, level(studies).floorOutline);
  assert.equal(corrected.area, 144);
  assert.equal(corrected.sourceStatus, 'resident-sketch-floor-outline');
  assert.equal(corrected.planeElevation, section.planeElevation);
  assert.equal(corrected.sampleElevation, section.sampleElevation);
  assert.equal(corrected.sampleOffset, section.sampleOffset);
  assert.equal(studyFloorSection(section, getDisplayLevel(emptyApproved, studies, '55', 1)), section);
  assert.equal(studyFloorSection(section, getDisplayLevel(emptyApproved, studies, '53', 2)), section);
  assert.equal(studyFloorSection(section, getDisplayLevel(approvedFixture(), studies, '55', 2)), section);
  assert.deepEqual(section, before);
  assert.deepEqual(lod2, sourceBefore);
});

test('a floor cutout cannot be silently filled by a room whose perimeter happens to stay inside', () => {
  const data = fixture(), cutout = rectangle(2, 2, 4, 4);
  level(data).floorOutline = [{outer: rectangle(0, 0, 8, 8), holes: [cutout]}];
  level(data).spaces = [{...room(data), polygon: rectangle(0, 0, 8, 8)}];
  level(data).doors = [];
  assert.throws(() => validate(data), /floor|hole|cutout|excluded/, 'the missing interior ring must be rejected before rendering');
  room(data).holes = [cutout];
  assert.equal(validate(data), true, 'the same room with its actual cutout is allowed');
  const section = studyFloorSection({polygons: [], area: 0}, display(data));
  assert.equal(section.area, 60, 'display area excludes the hole');
  level(data).excludedAreas = [{id: 'cutout-excluded', label: 'Excluded area', polygon: cutout}];
  assert.equal(validate(data), true, 'an excluded area may share the cutout boundary');
  level(data).floorOutline[0].holes = [];
  assert.throws(() => validate(data), /excluded areas/, 'the floor plate itself must not cover an excluded area');
});

test('hole edges cannot cross a concave floor or space even when every hole corner is inside', () => {
  const outer = [[0, 0], [6, 0], [6, 6], [4, 6], [4, 2], [2, 2], [2, 6], [0, 6], [0, 0]];
  const hole = rectangle(1, 3, 5, 5);
  for (const target of ['floor', 'space']) {
    const data = fixture();
    level(data).spaces = [{...room(data), polygon: rectangle(0.5, 0.5, 1.5, 1.5)}];
    level(data).doors = [];
    if (target === 'floor') level(data).floorOutline = [{outer, holes: [hole]}];
    else Object.assign(room(data), {polygon: outer, holes: [hole]});
    assert.throws(() => validate(data), /hole|inside/, `${target} holes cannot bridge the outer ring's missing notch`);
  }
});

test('corridor holes leave the stair area visible and independently clickable, including their label anchors', () => {
  const data = fixture(), stairRing = rectangle(2, 2, 4, 6);
  level(data).floorOutline = [{outer: rectangle(0, 0, 8, 8)}];
  level(data).spaces = [
    {id: 'hole-hall', label: 'Hall', kind: 'corridor', confidence: 'sketch', polygon: rectangle(0, 0, 8, 8), holes: [stairRing]},
    {id: 'hole-stair', label: 'Stair study', kind: 'stairs', confidence: 'sketch', polygon: stairRing},
  ];
  level(data).doors = [];
  assert.equal(validate(data), true);
  const result = createInteriorWireframe(display(data), {house: '55', floor: 2});
  result.group.updateMatrixWorld(true);
  const corridor = result.pickables.find(mesh => mesh.userData.spaceId === 'hole-hall');
  assert.equal(meshArea(corridor), 56);
  const centerRay = new Raycaster(new Vector3(3, 10, 4), new Vector3(0, -1, 0));
  assert.equal(centerRay.intersectObject(corridor).length, 0, 'corridor triangles must not span the stair hole');
  const hit = centerRay.intersectObjects(result.pickables)[0];
  assert.equal(hit.object.userData.spaceId, 'hole-stair');
  assert.equal(hit.object.userData.floor, 2);
  assert.equal(hit.object.userData.house, '55');
  for (const label of result.labels) {
    const ownMesh = result.pickables.find(mesh => mesh.userData.spaceId === label.spaceId);
    const ray = new Raycaster(new Vector3(label.position[0], 10, label.position[2]), new Vector3(0, -1, 0));
    assert.ok(ray.intersectObject(ownMesh).length, `${label.text} must sit inside its own rendered area`);
  }
  const treads = result.group.children.find(child => child.userData.role === 'schematic-stair-treads');
  assert.ok(treads && treads.geometry.attributes.position.count > 0);
});

test('a separate stair flight stays inside its enclosure and leaves the entrance landing free of treads', () => {
  const data = fixture();
  level(data).floorOutline = [{outer: rectangle(0, 0, 8, 10)}];
  level(data).spaces = [{
    id: 'landing-stair', label: 'Stairwell', kind: 'stairs', confidence: 'estimated',
    polygon: rectangle(2, 0, 4, 10), stairFlight: rectangle(2, 2, 4, 7),
  }];
  level(data).doors = [{id: 'landing-entry', label: 'Entry from hall', confidence: 'sketch',
    spaceId: 'landing-stair', segment: [[2, 8], [2, 9]]}];
  assert.equal(validate(data), true);
  const result = createInteriorWireframe(display(data), {house: '55', floor: 2});
  const treads = result.group.children.find(child => child.userData.role === 'schematic-stair-treads');
  const positions = treads.geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    assert.ok(positions[i] >= 2 && positions[i] <= 4);
    assert.ok(positions[i + 2] > 2 && positions[i + 2] < 7, 'neither landing may be filled by schematic steps');
  }
  const bad = flight => {
    const copy = structuredClone(data);
    copy.buildings['55'].levels[0].spaces[0].stairFlight = flight;
    return copy;
  };
  assert.throws(() => validate(bad(rectangle(1, 2, 4, 7))), /stairFlight.*within/);
  assert.throws(() => validate(bad([[2, 2], [4, 2], [3, 3], [4, 7], [2, 2]])), /stairFlight.*convex/);
  const withHole = structuredClone(data);
  withHole.buildings['55'].levels[0].spaces[0].holes = [rectangle(2.5, 4, 3.5, 5)];
  assert.throws(() => validate(withHole), /stairFlight.*within/);
  const notStairs = structuredClone(data);
  notStairs.buildings['55'].levels[0].spaces[0].kind = 'room';
  assert.throws(() => validate(notStairs), /stairFlight.*stairwell/);
});

test('estimated partitions remain dashed while sketch boundaries remain solid and doors have no invented swing', () => {
  const data = fixture(), result = createInteriorWireframe(display(data), {house: '55', floor: 2});
  assert.equal(result.group.userData.role, 'resident-interior-study');
  const solid = result.group.children.find(child => child.userData.role === 'interior-walls');
  const estimated = result.group.children.find(child => child.userData.role === 'estimated-interior-walls');
  assert.equal(solid.material.isLineDashedMaterial, undefined);
  assert.equal(estimated.material.isLineDashedMaterial, true);
  assert.ok(estimated.geometry.attributes.lineDistance.count > 0, 'dashes require populated line distances');
  const symbol = result.group.children.find(child => child.userData.role === 'interior-door-symbol');
  assert.equal(symbol.geometry.attributes.position.count, 2, 'an estimated door does not imply a hinge or swing');
  assert.equal(result.labels.find(label => label.spaceId === 'study-room-a' && label.kind === 'space').confidence, 'estimated');
  assert.equal(result.labels.find(label => label.spaceId === 'study-hall').confidence, 'sketch');
  assert.ok(wallSegments(result).filter(({values: [, ay, az, , by, bz]}) => Math.abs(az) < 1e-6 && Math.abs(bz) < 1e-6 && ay === by)
    .every(segment => segment.role === 'interior-walls'), 'a shared sketch boundary must not be downgraded to a guess');
});

test('explicit sketch boundaries remain solid inside estimated rooms without changing their evidence or closing doors', () => {
  const data = fixture();
  level(data).spaces = [room(data)];
  delete level(data).doors[0].toSpaceId;
  level(data).sketchBoundaries = [[[0, 0], [4, 0]], [[0, 3], [4, 3]]];
  assert.equal(validate(data), true);
  const result = createInteriorWireframe(display(data), {house: '55', floor: 2});
  const baseWalls = wallSegments(result).filter(({values: [, ay, , , by]}) => Math.abs(ay - 0.045) < 1e-6 && ay === by);
  const front = baseWalls.filter(({values: [, , az, , , bz]}) => az === 0 && bz === 0);
  assert.equal(front.length, 2, 'sketch boundaries preserve the gap between their two wall runs');
  assert.ok(front.every(segment => segment.role === 'interior-walls'));
  assert.ok(baseWalls.filter(({values: [, , az, , , bz]}) => az === 3 && bz === 3).every(segment => segment.role === 'interior-walls'));
  assert.ok(baseWalls.filter(({values: [ax, , , bx]}) => ax === bx).every(segment => segment.role === 'estimated-interior-walls'));
  assert.equal(result.labels[0].confidence, 'estimated', 'known boundary lines do not upgrade the whole room to verified geometry');
  for (const badSegment of [[[0, 0], [0, 0]], [[0, 0], [NaN, 0]], [[0, 0]], 'not a segment']) {
    const invalid = fixture();
    level(invalid).sketchBoundaries = [badSegment];
    assert.throws(() => validate(invalid), /sketchBoundaries/);
  }
});

test('millimetre-rounded diagonal study doors cut physical gaps without accepting centimetre displacement', () => {
  const data = fixture();
  room(data).polygon = [[0, 0], [20, 10], [18, 14], [-2, 4], [0, 0]];
  level(data).floorOutline = [{outer: rectangle(-3, -1, 21, 15)}];
  level(data).spaces = [room(data)];
  const door = level(data).doors[0];
  delete door.toSpaceId;
  door.segment = [[8.133, 4.067], [9.033, 4.517]]; // 0.45 mm from the diagonal after decimal rounding.
  assert.equal(validate(data), true);
  const result = createInteriorWireframe(display(data), {house: '55', floor: 2});
  const along = (x, z) => (2 * x + z) / Math.sqrt(5);
  const limits = door.segment.map(([x, z]) => along(x, z));
  const boundary = wallSegments(result).filter(({values: [ax, ay, az, bx, by, bz]}) =>
    Math.abs(ay - 0.045) < 1e-6 && Math.abs(by - ay) < 1e-6 && Math.abs(2 * az - ax) < 1e-5 && Math.abs(2 * bz - bx) < 1e-5);
  assert.equal(boundary.length, 2, 'the long diagonal has two wall runs around the rounded opening');
  for (const {values: [ax, , az, bx, , bz]} of boundary) {
    const low = Math.min(along(ax, az), along(bx, bz)), high = Math.max(along(ax, az), along(bx, bz));
    assert.ok(high <= limits[0] + 1e-5 || low >= limits[1] - 1e-5, 'no wall crosses the doorway');
  }
  door.segment = door.segment.map(([x, z]) => [x, z + 0.02]);
  assert.throws(() => validate(data), /source space boundary/, 'the tolerance must not turn a displaced guess into an attached opening');
});

test('approved geometry retains strict door collinearity instead of inheriting study rounding tolerance', () => {
  const approved = approvedFixture(), plan = approved.buildings['55'].levels[0];
  plan.spaces[0].polygon = [[0, 0], [20, 10], [18, 14], [-2, 4], [0, 0]];
  plan.doors = [{id: 'approved-door', label: 'Approved test door', spaceId: 'approved-room', segment: [[8.133, 4.067], [9.033, 4.517]]}];
  assert.throws(() => validateInteriorData(approved, campus, lod2), /boundary edge/);
});

test('House 55 retains its independent top-floor module layout while all three levels resolve their own module plans', async () => {
  const published = freeze(await read('interior-studies')), before = structuredClone(published);
  assertUnchangedOtherFloors(published, await readHistoricalStudies());
  assert.equal(validate(published), true);
  assert.ok(published.buildings['55']);
  assert.deepEqual(published.buildings['55'].levels.map(level => level.index).sort(), [0, 1, 2]);
  const resolved = display(published);
  assert.equal(resolved.isStudy, true);
  assert.equal(Object.hasOwn(resolved, 'elevation'), false);
  assert.equal(Object.hasOwn(resolved, 'reviewedAt'), false);
  assert.ok(resolved.spaces.some(space => space.kind === 'room' && space.confidence === 'estimated'));
  assert.equal(resolved.spaces.filter(space => space.kind === 'room').length, 20, 'the resident-confirmed count includes three L rooms');
  assert.equal(resolved.layoutBasis, 'resident-module-layout');
  assert.equal(resolved.spaces.length, 23, 'twenty clear rooms, stairwell and two halls');
  assert.equal(resolved.doors.length, 22, 'twenty room openings and the two stairwell entries');
  assert.equal(resolved.spaces.filter(space => space.kind === 'room' && space.confidence === 'sketch').length, 0);
  assert.equal(resolved.spaces.filter(space => space.kind === 'room' && space.confidence === 'estimated').length, 20, 'fitted envelopes remain estimates even where counts and approximate positions were sketched');
  for (const [prefix, count] of [['W', 4], ['L', 3], ['R', 3], ['N', 3]]) {
    assert.deepEqual(resolved.spaces.filter(space => new RegExp(`^${prefix}\\d+$`).test(space.shortLabel)).map(space => space.shortLabel).sort(),
      Array.from({length: count}, (_, i) => `${prefix}${i + 1}`), `${prefix} run matches the confirmed room count`);
  }
  assert.ok(resolved.doors.every(door => !Object.hasOwn(door, 'hinge') && !Object.hasOwn(door, 'swing')));
  assert.equal(resolved.excludedAreas?.length || 0, 0, 'old source-shell exclusions do not constrain the independent outline');
  for (const floor of [0, 1]) {
    const lower = getDisplayLevel(emptyApproved, published, '55', floor);
    assert.equal(lower.layoutBasis, 'resident-module-layout', `floor ${floor} has its own independent module plan`);
    assert.equal(lower.spaces.filter(space => space.kind === 'room').length, 20);
    assert.equal(lower.spaces.filter(space => space.kind === 'shared').length, 2);
    assert.equal(lower.extrapolatedFrom, undefined, 'the current annotated plan does not inherit historical extrapolation metadata');
  }
  for (const building of campus.buildings) {
    for (let floor = 0; floor < building.levels; floor++) {
      if (building.campus === 'I') continue;
      assert.equal(getDisplayLevel(emptyApproved, published, building.number, floor), null, 'the older-house study must not populate newer houses');
    }
  }
  assert.deepEqual(published, before);
});

test('every published floor preserves usable area and leaves the stairs independently clickable', async () => {
  const published = freeze(await read('interior-studies'));
  for (const floor of [0, 1, 2]) {
    const resolved = getDisplayLevel(emptyApproved, published, '55', floor);
    const result = createInteriorWireframe(resolved, {house: '55', floor});
    result.group.updateMatrixWorld(true);
    const outline = resolved.floorOutline.map(piece => [piece.outer, ...(piece.holes || [])]);
    for (const area of resolved.excludedAreas || []) {
      assert.ok(multiArea(intersection(outline, [area.polygon])) < 1e-5, `${area.label} must contain no study floor plate`);
    }
    for (const space of resolved.spaces) {
      const mesh = result.pickables.find(mesh => mesh.userData.role === 'interior-space' && mesh.userData.spaceId === space.id);
      assert.ok(mesh && Number.isFinite(meshArea(mesh)) && meshArea(mesh) > 0);
      assert.equal(mesh.userData.floor, floor);
      assert.ok(Math.abs(meshArea(mesh) - polygonArea([space.polygon, ...(space.holes || [])])) < 0.001, `${space.label}: triangulation must retain holes and area`);
      const values = mesh.geometry.attributes.position.array;
      for (let i = 0; i < values.length; i += 9) {
        const triangle = [[values[i], values[i + 2]], [values[i + 3], values[i + 5]], [values[i + 6], values[i + 8]], [values[i], values[i + 2]]];
        assertSourceBoundaryFit([triangle], outline, `${space.label}: rendered triangle must fit floor ${floor}`);
        for (const area of resolved.excludedAreas || []) {
          assert.ok(multiArea(intersection([triangle], [area.polygon])) < 0.0001, `${space.label}: no rendered triangle may fill ${area.label}`);
        }
      }
    }
    const stair = resolved.spaces.find(space => space.kind === 'stairs');
    assert.ok(stair);
    const stairLabel = result.labels.find(label => label.spaceId === stair.id && label.kind === 'space');
    const ray = new Raycaster(new Vector3(stairLabel.position[0], 10, stairLabel.position[2]), new Vector3(0, -1, 0));
    const hits = ray.intersectObjects(result.pickables.filter(mesh => mesh.userData.role === 'interior-space'));
    assert.ok(hits.length > 0 && hits.every(hit => hit.object.userData.spaceId === stair.id), 'the hallway must leave the stairs as the sole space beneath their label');
  }
});

test('the frozen pre-area stage retains its historical bay and depth assumptions for reproducible comparison', async () => {
  const {level: plan} = JSON.parse(await readFile(new URL('../data/source/house55-2og-area-baseline.json', import.meta.url)));
  const magnitude = Math.hypot(0.676, 0.737);
  const local = ([x, z]) => [(x * 0.676 + z * 0.737) / magnitude, (-x * 0.737 + z * 0.676) / magnitude];
  const span = (label, axis) => {
    const points = plan.spaces.find(space => space.shortLabel === label).polygon.map(local).map(point => point[axis]);
    return Math.max(...points) - Math.min(...points);
  };
  for (const [labels, axis, target] of [
    [['A', 'B', 'C', 'D'], 0, 3.0165], [['E', 'F', 'G'], 1, 3.0465],
    [['W1', 'W2', 'W3', 'W4'], 1, 3], [['L1', 'L2', 'L3'], 0, 2.94083],
  ]) {
    for (const label of labels) assert.ok(Math.abs(span(label, axis) - target) < 0.015, `${label} uses the candidate repeated bay within source skew`);
  }
  const similar = [...'ABCDEFG', 'W1', 'W2', 'W3', 'W4', 'L1', 'L2', 'L3', 'N1', 'N2', 'N3'];
  const widths = similar.map(label => span(label, /^W|^[EFG]$/.test(label) ? 1 : 0));
  const depths = similar.map(label => span(label, /^W|^[EFG]$/.test(label) ? 0 : 1));
  assert.ok(Math.max(...widths) - Math.min(...widths) < 0.26, 'the new source-corner alignment narrows L slightly; the resulting range must remain explicit');
  assert.ok(Math.max(...depths) - Math.min(...depths) < 0.03, 'a common candidate depth keeps the seventeen full envelopes comparable within source skew');
  const roof = lod2.buildings.find(building => building.number === '55').surfaces[39];
  const facade = Math.hypot(roof.points[7][0] - roof.points[6][0], roof.points[7][2] - roof.points[6][2]);
  assert.ok(facade < 3 * 2.70, 'the exact existing R facade cannot supply three literal 2.70m widths even before walls');
  for (const label of ['R1', 'R2', 'R3']) {
    assert.ok(span(label, 0) > 2.76 && span(label, 0) < 2.78, 'the explicit 0.20m block extension is shared across three R bays');
    assert.match(plan.spaces.find(space => space.shortLabel === label).note, /unresolved/);
  }
});

test('the saved prior stair correction retains its historical L3 alignment and ratio', async () => {
  const published = await readHistoricalStudies();
  const source = lod2.buildings.find(building => building.number === '55').surfaces[39].points;
  const origin = [source[3][0], source[3][2]], delta = [source[4][0] - origin[0], source[4][2] - origin[1]];
  const length = Math.hypot(...delta), along = delta.map(value => value / length), towardR = [along[1], -along[0]];
  const local = point => [towardR, along].map(axis => point.reduce((sum, value, i) => sum + (value - origin[i]) * axis[i], 0));
  const bounds = polygon => {
    const points = polygon.map(local);
    return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])), Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
  };
  for (const floor of [0, 1, 2]) {
    const plan = getDisplayLevel(emptyApproved, published, '55', floor);
    const stair = plan.spaces.find(space => space.kind === 'stairs');
    const l3 = plan.spaces.find(space => space.shortLabel === 'L3');
    assert.ok(stair && l3);
    const [sx0, sy0, sx1, sy1] = bounds(stair.polygon), [, ly0, lx1, ly1] = bounds(l3.polygon);
    assert.ok(Math.abs(sx0 - lx1) < 0.00001, `floor ${floor}: no gap may remain between stairs and L3`);
    assert.ok(Math.abs(-sx0 / (sx1 - sx0) - 0.25) < 1e-5, `floor ${floor}: one quarter of the stair width is toward L3`);
    assert.ok(Math.abs(sx1 / (sx1 - sx0) - 0.75) < 1e-5, `floor ${floor}: three quarters is toward R1`);
    const [, fy0, , fy1] = bounds(stair.stairFlight);
    const run = Math.hypot(stair.stairFlight[3][0] - stair.stairFlight[0][0], stair.stairFlight[3][1] - stair.stairFlight[0][1]);
    assert.ok(Math.abs(run - 4.304877) < 0.001, 'the schematic flight run is retained inside the enclosure');
    assert.ok(fy0 > sy0 + 1 && sy1 > fy1 + 1, 'upper and entrance landings are distinct from the flight');
    const joint = l3.polygon.map(local).filter(point => Math.abs(point[0] - sx0) < 1e-5).map(point => point[1]);
    const expectedContact = Math.max(...joint) - Math.min(...joint);
    const contact = sharedBoundaryLength(stair.polygon, l3.polygon);
    assert.ok(expectedContact > 2.9 && expectedContact < sy1 - sy0, 'retain substantial contact and the stair access below it');
    assert.ok(Math.abs(contact - expectedContact) < 0.00002, 'the whole adjoining span must be a shared edge rather than one touching corner');
    assert.ok(multiArea(intersection([stair.polygon], [l3.polygon])) < 0.000001, 'flush rooms must not overlap');
  }
});

test('the saved prior area refit retains its hall assignments and historical west-only stair entry', async () => {
  const published = await readHistoricalStudies(), plan = display(published);
  const baseline = JSON.parse(await readFile(new URL('../data/source/house55-2og-area-baseline.json', import.meta.url)));
  const magnitude = Math.hypot(0.676, 0.737);
  const local = ([x, z]) => [(x * 0.676 + z * 0.737) / magnitude, (-x * 0.737 + z * 0.676) / magnitude];
  const stair = plan.spaces.find(space => space.kind === 'stairs');
  const halls = plan.spaces.filter(space => space.kind === 'corridor');
  assert.equal(halls.length, 2);
  assert.ok(multiArea(intersection(...halls.map(hall => [hall.polygon, ...(hall.holes || [])]))) < 1e-8);
  const roomEntries = plan.doors.filter(door => plan.spaces.find(space => space.id === door.spaceId)?.kind === 'room');
  const westHall = roomEntries.find(door => door.spaceId.endsWith('-sw-1')).toSpaceId;
  const eastHall = roomEntries.find(door => door.spaceId.endsWith('-east-1')).toSpaceId;
  assert.notEqual(westHall, eastHall);
  for (const entry of roomEntries) {
    const space = plan.spaces.find(space => space.id === entry.spaceId);
    assert.equal(entry.toSpaceId, /^(?:[ABCD]|W\d|L\d)$/.test(space.shortLabel) ? westHall : eastHall);
    assert.equal(entry.toSpaceId, baseline.level.doors.find(item => item.id === entry.id).toSpaceId,
      `${space.shortLabel}: deeper rooms must still open into their established hallway`);
  }
  assert.equal(roomEntries.length, 20);
  assert.deepEqual(plan.windows, baseline.level.windows, 'the area refit preserves every window observation');
  const entries = plan.doors.filter(door => door.spaceId === stair.id || door.toSpaceId === stair.id);
  assert.equal(entries.length, 1, 'do not invent an eastern connection to join the hall graph');
  assert.equal(entries[0].toSpaceId, westHall);
  assert.equal(entries[0].confidence, 'sketch');
  assert.deepEqual(entries[0].segment, baseline.level.doors.find(door => door.spaceId === stair.id).segment);
  const source = lod2.buildings.find(building => building.number === '55').surfaces[39];
  const corner = index => local([source.points[index][0], source.points[index][2]]);
  const edge = [3, 4].map(index => corner(index)), d = edge[1].map((value, i) => value - edge[0][i]);
  const n = [d[1], -d[0]].map(value => value / Math.hypot(...d));
  const offset = point => point.reduce((sum, value, i) => sum + (value - edge[0][i]) * n[i], 0);
  const westOffset = Math.min(...stair.polygon.map(local).map(offset));
  const flightBottom = Math.max(...stair.stairFlight.map(local).map(p => p[1]));
  for (const point of entries[0].segment.map(local)) {
    assert.ok(Math.abs(offset(point) - westOffset) < 1e-5, 'entrance follows the aligned west stair wall');
    assert.ok(point[1] > flightBottom && point[1] < corner(3)[1], 'entrance reaches the landing below the flight');
  }
});

test('the saved prior R1–R3 allocation remains one continuous block without a corner spur', async () => {
  const published = await readHistoricalStudies();
  const roof = lod2.buildings.find(building => building.number === '55').surfaces[39];
  const sourceCorners = [6, 7].map(index => [roof.points[index][0], roof.points[index][2]]);
  for (const floor of [0, 1, 2]) {
    const plan = getDisplayLevel(emptyApproved, published, '55', floor);
    const rooms = ['R1', 'R2', 'R3'].map(label => plan.spaces.find(space => space.shortLabel === label));
    assert.ok(rooms.every(Boolean));
    const block = union(...rooms.map(room => [room.polygon, ...(room.holes || [])]));
    assert.equal(block.length, 1);
    assert.equal(block[0].length, 1, 'the block must contain no gap or internal hole');
    const corners = cornersOnly(block[0][0]);
    if (floor === 2) {
      assert.equal(corners.length, 4, 'an otherwise straight block must not acquire a fifth corner from source quantization');
      const sourceVector = sourceCorners[1].map((value, axis) => value - sourceCorners[0][axis]);
      const facadeCorners = corners.filter(corner => Math.abs(sourceVector[0] * (corner[1] - sourceCorners[0][1]) - sourceVector[1] * (corner[0] - sourceCorners[0][0])) / Math.hypot(...sourceVector) < 0.00001);
      assert.equal(facadeCorners.length, 2, 'the extended bank stays flush with the unchanged source façade plane');
      assert.ok(Math.abs(Math.hypot(...facadeCorners[0].map((v, i) => v - facadeCorners[1][i])) - 8.9785205) < 0.00002, 'aligned side lines set the new R extent without stretching the shell');
      assert.ok(corners.every((point, i) => Math.hypot(point[0] - corners[(i + 1) % corners.length][0], point[1] - corners[(i + 1) % corners.length][1]) > 1), 'no tiny connecting edge remains');
    }
    assert.ok(sharedBoundaryLength(rooms[0].polygon, rooms[1].polygon) > 4);
    assert.ok(sharedBoundaryLength(rooms[1].polygon, rooms[2].polygon) > 4);
  }
});

test('the archived ground-floor extrapolation retains its historical core and complete source exterior section', async () => {
  const published = freeze(await readHistoricalStudies()), before = structuredClone(published);
  const upper = await priorUpper(), official = lod2.buildings.find(building => building.number === '55');
  const elevations = getLevelElevations(emptyApproved, '55', 3, official.height);
  const allIds = published.buildings['55'].levels.flatMap(plan => [...plan.spaces, ...(plan.doors || []), ...(plan.excludedAreas || [])].map(item => item.id));
  assert.equal(new Set(allIds).size, allIds.length, 'same-looking floor plans still need globally unique interaction IDs');
  for (const floor of [0]) {
    const plan = getDisplayLevel(emptyApproved, published, '55', floor);
    assert.equal(plan.extrapolatedFrom, 2);
    assert.match(plan.notes, /extrapolat/i);
    assert.equal(Object.hasOwn(plan, 'elevation'), false);
    assert.equal(Object.hasOwn(plan, 'reviewedAt'), false);
    assert.ok(plan.spaces.every(space => space.confidence === 'estimated'));
    assert.ok(plan.doors.every(door => door.confidence === 'estimated'));
    assert.equal(plan.spaces.filter(space => space.kind === 'room').length, 20);
    assert.equal(plan.spaces.length, 24);
    assert.equal(plan.doors.length, 21);
    assert.equal(plan.excludedAreas?.length || 0, 0, 'the upper-floor missing wings are not evidence for missing lower-floor area');
    assert.equal(plan.sketchBoundaries?.length || 0, 0, 'copied walls cannot retain the directly sketched wall style');
    const source = floorSection(official, elevations[floor]);
    const sourceOutline = source.polygons.map(piece => [piece.outer, ...(piece.holes || [])]);
    const drawnOutline = plan.floorOutline.map(piece => [piece.outer, ...(piece.holes || [])]);
    assert.ok(multiArea(difference(drawnOutline, sourceOutline)) + multiArea(difference(sourceOutline, drawnOutline)) < 0.0001, `floor ${floor} retains its own complete official section`);
    assert.equal(plan.spaces.length, upper.spaces.length);
    for (const space of plan.spaces) {
      const original = upper.spaces.find(item => item.shortLabel === space.shortLabel);
      assert.ok(original);
      assert.notEqual(space.id, original.id);
      const clippedOriginal = intersection([original.polygon, ...(original.holes || [])], sourceOutline);
      const copied = [space.polygon, ...(space.holes || [])];
      const message = `floor ${floor}, ${space.shortLabel}: repeat the corrected core, clipping only its exterior to this source section`;
      const addedArea = assertSourceBoundaryFit([copied], clippedOriginal, message);
      const missingArea = assertSourceBoundaryFit(clippedOriginal, [copied], message);
      assert.ok(addedArea + missingArea < sourceBoundaryAreaTolerance, `${message}: total difference is ${addedArea + missingArea} m²`);
    }
    const spaceIds = new Set(plan.spaces.map(space => space.id));
    for (const door of plan.doors) {
      assert.ok(spaceIds.has(door.spaceId) && spaceIds.has(door.toSpaceId), 'door adjacency must resolve within its own floor');
      const from = plan.spaces.find(space => space.id === door.spaceId);
      const original = upper.doors.find(item => upper.spaces.find(space => space.id === item.spaceId)?.shortLabel === from.shortLabel);
      assert.ok(original);
      assert.notEqual(door.id, original.id);
      assert.deepEqual(door.segment, original.segment);
    }
    const assignedArea = plan.spaces.reduce((sum, space) => sum + polygonArea([space.polygon, ...(space.holes || [])]), 0);
    assert.ok(multiArea(drawnOutline) - assignedArea > 1, 'additional lower-floor area remains unassigned');
  }
  assert.equal(validate(published), true);
  assert.deepEqual(published, before);
});

test('the House 55 study reads along its building axes in either aspect without changing source geometry', async () => {
  const data = freeze(await read('interior-studies')), before = structuredClone(data), sourceBefore = structuredClone(lod2);
  const plan = display(data);
  const screenRight = direction => new Vector3(0, 1, 0).cross(new Vector3(...direction)).normalize();
  const desktop = studyPlanDirection(plan), portrait = studyPlanDirection(plan, true);
  const right = screenRight(desktop), portraitRight = screenRight(portrait);
  assert.ok(Math.abs(right.x + 0.676) < 0.01 && Math.abs(right.z + 0.737) < 0.01, 'desktop screen-right follows the independent plan orientation in the resident annotation');
  assert.ok(Math.abs(right.dot(portraitRight)) < 1e-10, 'portrait rotates the long axis vertically instead of shrinking a horizontal plan');
  for (const direction of [desktop, portrait]) {
    assert.equal(direction[1], 1);
    assert.ok(Math.abs(Math.hypot(direction[0], direction[2]) - 0.025) < 1e-12);
    assert.ok(new Vector3(...direction).normalize().y > 0.999, 'the aligned view remains almost overhead');
  }
  assert.deepEqual(data, before);
  assert.deepEqual(lod2, sourceBefore);
});

test('plan orientation follows rotated rectangular outlines and survives reversed ring order', () => {
  for (const angle of [0, Math.PI / 7, Math.PI / 2, -Math.PI / 5]) {
    const axis = [Math.cos(angle), Math.sin(angle)];
    const outer = rectangle(0, 0, 30, 5).map(([x, z]) => [x * axis[0] - z * axis[1] + 9, x * axis[1] + z * axis[0] - 12]);
    for (const ring of [outer, [...outer].reverse()]) {
      const plan = freeze({floorOutline: [{outer: ring}]});
      const direction = studyPlanDirection(plan), portrait = studyPlanDirection(plan, true);
      const right = [direction[2] / 0.025, -direction[0] / 0.025];
      const portraitRight = [portrait[2] / 0.025, -portrait[0] / 0.025];
      assert.ok(Math.abs(right[0] * axis[0] + right[1] * axis[1]) > 0.999999, 'the longest plan extent reads horizontally on desktop');
      assert.ok(Math.abs(portraitRight[0] * axis[0] + portraitRight[1] * axis[1]) < 1e-8, 'the longest plan extent reads vertically on a phone');
    }
  }
});

test('compact study labels preserve full identity and confidence while enforcing plain 16-character text', () => {
  const data = fixture();
  room(data).shortLabel = 'A';
  assert.equal(validate(data), true);
  const result = createInteriorWireframe(display(data), {house: '55', floor: 2});
  const label = result.labels.find(label => label.spaceId === room(data).id && label.kind === 'space');
  assert.equal(label.shortText, 'A');
  assert.equal(label.text, 'Room A', 'full evidence text remains available for accessible labels and cards');
  assert.equal(label.confidence, 'estimated');
  assert.equal(label.spaceId, 'study-room-a');
  const hall = result.labels.find(label => label.spaceId === 'study-hall');
  assert.equal(hall.shortText, undefined, 'short labels are optional and retain the full-text fallback');
  for (const shortLabel of ['', ' ', '12345678901234567', '<b>A</b>', 'A\nB', 42]) {
    const bad = fixture();
    room(bad).shortLabel = shortLabel;
    assert.throws(() => validate(bad), /shortLabel/);
  }
});
