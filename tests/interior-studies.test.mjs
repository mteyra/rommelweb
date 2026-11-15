import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Raycaster, Vector3 } from 'three';
import { difference, intersection } from 'polyclip-ts';
import { validateInteriorData, getLevelElevations } from '../src/interiors.js';
import { validateInteriorStudies, getDisplayLevel, studyFloorSection, studyPlanDirection } from '../src/interior-studies.js';
import { createInteriorWireframe } from '../src/interior-wireframe.js';
import { floorSection } from '../src/sections.js';

const read = async name => JSON.parse(await readFile(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'));
const [campus, lod2] = await Promise.all(['campus', 'lod2'].map(read));
const emptyApproved = { schemaVersion: 1, buildings: {} };
const rectangle = (left, bottom, right, top) => [[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]];
const entry = studies => studies.buildings['55'];
const level = studies => entry(studies).levels[0];
const room = studies => level(studies).spaces[0];
const validate = studies => validateInteriorStudies(studies, campus, lod2);
const display = studies => getDisplayLevel(emptyApproved, studies, '55', 2);

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

test('the published first study is confined to House 55 / 2. OG and keeps estimates separate from approval', async () => {
  const published = freeze(await read('interior-studies')), before = structuredClone(published);
  assert.equal(validate(published), true);
  assert.deepEqual(Object.keys(published.buildings), ['55']);
  assert.deepEqual(published.buildings['55'].levels.map(level => level.index), [2]);
  const resolved = display(published);
  assert.equal(resolved.isStudy, true);
  assert.equal(Object.hasOwn(resolved, 'elevation'), false);
  assert.equal(Object.hasOwn(resolved, 'reviewedAt'), false);
  assert.ok(resolved.spaces.some(space => space.kind === 'room' && space.confidence === 'estimated'));
  assert.ok(resolved.spaces.some(space => space.kind === 'room' && space.confidence === 'sketch'));
  assert.ok(resolved.spaces.filter(space => space.kind === 'room').every(space => /sketch|estimate/i.test(space.label)), 'labels must identify the evidence rather than imply physical room numbers');
  assert.ok(resolved.doors.every(door => door.confidence === 'estimated' && !Object.hasOwn(door, 'hinge') && !Object.hasOwn(door, 'swing')));
  assert.equal(resolved.excludedAreas.length, 2, 'both resident-marked missing wings are retained');
  assert.ok(/not a confirmed room count/i.test(resolved.notes));
  for (const building of campus.buildings) {
    for (let floor = 0; floor < building.levels; floor++) {
      if (building.number === '55' && floor === 2) continue;
      assert.equal(getDisplayLevel(emptyApproved, published, building.number, floor), null, 'the local drawing cannot populate other floors');
    }
  }
  assert.deepEqual(published, before);
});

test('published study triangulation preserves its usable area, stair cutout and both excluded wings', async () => {
  const published = freeze(await read('interior-studies')), resolved = display(published);
  const result = createInteriorWireframe(resolved, {house: '55', floor: 2});
  result.group.updateMatrixWorld(true);
  const outline = resolved.floorOutline.map(piece => [piece.outer, ...(piece.holes || [])]);
  for (const area of resolved.excludedAreas) {
    assert.ok(multiArea(intersection(outline, [area.polygon])) < 1e-5, `${area.label} must contain no study floor plate`);
  }
  for (const space of resolved.spaces) {
    const mesh = result.pickables.find(mesh => mesh.userData.role === 'interior-space' && mesh.userData.spaceId === space.id);
    assert.ok(mesh && Number.isFinite(meshArea(mesh)) && meshArea(mesh) > 0);
    assert.ok(Math.abs(meshArea(mesh) - polygonArea([space.polygon, ...(space.holes || [])])) < 0.001, `${space.label}: triangulation must retain holes and area`);
    const values = mesh.geometry.attributes.position.array;
    for (let i = 0; i < values.length; i += 9) {
      const triangle = [[values[i], values[i + 2]], [values[i + 3], values[i + 5]], [values[i + 6], values[i + 8]], [values[i], values[i + 2]]];
      assert.ok(multiArea(difference([triangle], outline)) < 0.0001, `${space.label}: rendered triangle must fit the corrected floor`);
      for (const area of resolved.excludedAreas) {
        assert.ok(multiArea(intersection([triangle], [area.polygon])) < 0.0001, `${space.label}: no rendered triangle may fill ${area.label}`);
      }
    }
  }
  const stair = resolved.spaces.find(space => space.kind === 'stairs');
  assert.ok(stair);
  const stairLabel = result.labels.find(label => label.spaceId === stair.id && label.kind === 'space');
  const ray = new Raycaster(new Vector3(stairLabel.position[0], 10, stairLabel.position[2]), new Vector3(0, -1, 0));
  const hits = ray.intersectObjects(result.pickables.filter(mesh => mesh.userData.role === 'interior-space'));
  assert.ok(hits.length > 0 && hits.every(hit => hit.object.userData.spaceId === stair.id), 'the hallway hole must leave the stairs as the sole space beneath their label');
});

test('the House 55 study reads along its building axes in either aspect without changing source geometry', async () => {
  const data = freeze(await read('interior-studies')), before = structuredClone(data), sourceBefore = structuredClone(lod2);
  const plan = display(data);
  const screenRight = direction => new Vector3(0, 1, 0).cross(new Vector3(...direction)).normalize();
  const desktop = studyPlanDirection(plan), portrait = studyPlanDirection(plan, true);
  const right = screenRight(desktop), portraitRight = screenRight(portrait);
  assert.ok(Math.abs(right.x - 0.676) < 0.01 && Math.abs(right.z - 0.737) < 0.01, 'desktop screen-right follows the registered House 55 long axis');
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
