import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWindowStudy, createBuildingWindowStudies, WINDOW_PROFILE, OLD_WINDOW_PROFILE, getWindowProfile, getOldFacadeRowGuides } from '../src/windows.js';
import { surfaceFrame } from '../src/facade.js';
import { getLevelElevations } from '../src/interiors.js';

const wall = {
  type: 'WallSurface',
  points: [[0, 0, 0], [22.8, 0, 0], [22.8, 15, 0], [0, 15, 0], [0, 0, 0]],
  holes: [[[10, 5, 0], [13, 5, 0], [13, 9, 0], [10, 9, 0], [10, 5, 0]]],
};
const contains = (ring, point) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
};

test('window study preserves the source and leaves ground floors, holes and narrow stair faces clear', () => {
  const before = structuredClone(wall);
  const study = createWindowStudy(wall, [0, 3, 6, 9, 12], 15);
  assert.ok(study.count > 0);
  assert.deepEqual(wall, before);
  assert.ok(study.patches.every(patch => patch.floor >= 1));
  for (const positions of Object.values(study.layers)) {
    assert.ok(positions.every(Number.isFinite));
    for (let i = 0; i < positions.length; i += 9) {
      const x = (positions[i] + positions[i + 3] + positions[i + 6]) / 3;
      const y = (positions[i + 1] + positions[i + 4] + positions[i + 7]) / 3;
      assert.ok(x > 0 && x < 22.8 && y > 3 && y < 15);
      assert.ok(!(x > 10 && x < 13 && y > 5 && y < 9), 'glass and frame patches cannot bridge source holes');
      assert.ok(positions[i + 2] > 0 && positions[i + 2] < 0.04, 'appearance layer has only a shallow surface offset');
    }
  }
  const narrow = {...wall, points: [[0, 0, 0], [8, 0, 0], [8, 15, 0], [0, 15, 0], [0, 0, 0]], holes: []};
  assert.equal(createWindowStudy(narrow, [0, 3, 6, 9, 12], 15).count, 0);
  assert.equal(createWindowStudy({...wall, type: 'RoofSurface'}, [0, 3, 6, 9, 12], 15).count, 0);
  assert.match(WINDOW_PROFILE.status, /schematic.*illustrative.*No surveyed openings/);
});

test('windows follow supplied unequal storey guides and stagger without assigning rooms', () => {
  const study = createWindowStudy({...wall, holes: []}, [0, 2.8, 6.2, 9.4, 12.1], 15);
  for (const floor of [1, 2, 3, 4]) {
    const patches = study.patches.filter(patch => patch.floor === floor);
    assert.ok(patches.length > 0);
    for (const patch of patches) {
      assert.ok(Math.abs(patch.corners[0][1] - [0, 2.8, 6.2, 9.4, 12.1][floor] - WINDOW_PROFILE.sillOffset) < 1e-8);
      assert.deepEqual(Object.keys(patch), ['floor', 'corners'], 'a window study must not become a resident or room index');
    }
  }
  const first = study.patches.find(patch => patch.floor === 1).corners[0][0];
  const second = study.patches.find(patch => patch.floor === 2).corners[0][0];
  assert.ok(Math.abs(second - first - WINDOW_PROFILE.alternateOffset) < 1e-8);
  assert.throws(() => createWindowStudy(wall, [0, 3, 2], 15), /ascending finite/);
});

test('source-split broad facades share window rhythm while every fragment stays on its original patch', () => {
  const patch = (left, right) => ({type: 'WallSurface', points: [[left, 0, 0], [right, 0, 0], [right, 15, 0], [left, 15, 0], [left, 0, 0]]});
  const first = patch(0, 7), second = patch(7, 22.8);
  assert.equal(createWindowStudy(first, [0, 3, 6, 9, 12], 15).count, 0);
  assert.equal(createWindowStudy(second, [0, 3, 6, 9, 12], 15).count, 0);
  const before = JSON.stringify([first, second]);
  const studies = createBuildingWindowStudies([first, second], [0, 3, 6, 9, 12], 15);
  assert.ok(studies.get(first).layers.glass.length > 0);
  assert.ok(studies.get(second).layers.glass.length > 0);
  for (const [surface, study] of studies) {
    const left = surface.points[0][0], right = surface.points[1][0];
    for (const positions of Object.values(study.layers)) {
      for (let i = 0; i < positions.length; i += 3) {
        assert.ok(positions[i] >= left - 1e-8 && positions[i] <= right + 1e-8);
        assert.ok(positions[i + 1] > 3 && positions[i + 1] < 15);
      }
    }
  }
  const fragmented = [patch(0, 7), patch(7, 14), patch(14, 22.8)];
  assert.equal(createBuildingWindowStudies(fragmented, [0, 3, 6, 9, 12], 15).size, 0, 'highly fragmented faces without a broad anchor remain out of the room-window study');
  assert.equal(JSON.stringify([first, second]), before);
});

test('all six actual Süd II studies stay on broad official wall planes without altering LoD2', async () => {
  const lod2 = JSON.parse(await readFile(new URL('../public/data/lod2.json', import.meta.url), 'utf8'));
  const campus = JSON.parse(await readFile(new URL('../public/data/campus.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(lod2);
  let count = 0;
  for (const building of lod2.buildings.filter(building => building.number.endsWith('a') || building.number === '49')) {
    const levels = campus.buildings.find(item => item.number === building.number).levels;
    const elevations = getLevelElevations({schemaVersion: 1, buildings: {}}, building.number, levels, building.height).map(elevation => building.baseY + elevation);
    const studies = createBuildingWindowStudies(building.surfaces, elevations, building.baseY + building.height, {house: building.number});
    let houseCount = 0;
    for (const [surface, study] of studies) {
      houseCount += study.count;
      const frame = surfaceFrame(surface);
      for (const positions of Object.values(study.layers)) {
        for (let i = 0; i < positions.length; i += 9) {
          const center = [0, 1, 2].map(axis => (positions[i + axis] + positions[i + axis + 3] + positions[i + axis + 6]) / 3);
          const project = vector => center.reduce((sum, value, axis) => sum + (value - frame.origin[axis]) * vector[axis], 0);
          const point = [project(frame.u), project(frame.v)];
          assert.ok(contains(frame.rings[0], point), 'window triangles must remain over their exact original wall patch');
          assert.ok(!frame.rings.slice(1).some(ring => contains(ring, point)));
          assert.ok(project(frame.normal) > 0.011 && project(frame.normal) < 0.038, 'only a shallow rendering offset is allowed');
        }
      }
    }
    if (building.number === '57a') assert.ok([...studies].some(([surface, study]) => {
      const frame = surfaceFrame(surface), span = frame.maxU - frame.minU;
      return span > 12 && span < 20 && study.layers.glass.length > 0;
    }), 'the broad east face must not lose windows merely because the source split it');
    assert.ok(houseCount > 0, `missing schematic upper windows on ${building.number}`);
    count += houseCount;
  }
  assert.ok(count > 100 && count < 500);
  assert.equal(JSON.stringify(lod2), before);
});

test('resident alignment correction affects Blue House 51a only', () => {
  const surface = {...wall, holes: []};
  const centers = (study, floor) => study.patches.filter(patch => patch.floor === floor).map(patch => (patch.corners[0][0] + patch.corners[1][0]) / 2);
  const blue = createBuildingWindowStudies([surface], [0, 3, 6], 9, {house: '51a'}).get(surface);
  assert.ok(centers(blue, 1).length > 0);
  assert.deepEqual(centers(blue, 1), centers(blue, 2), 'upper rows must be vertically aligned');
  assert.match(blue.profile.alignmentSource, /Resident correction.*51a/);
  for (const house of ['49', '53a', '55a', '57a', '59a']) {
    const study = createBuildingWindowStudies([surface], [0, 3, 6], 9, {house}).get(surface);
    assert.ok(centers(study, 1).every((x, index) => Math.abs(centers(study, 2)[index] - x - WINDOW_PROFILE.alternateOffset) < 1e-8));
    assert.equal(getWindowProfile(house).alignmentSource, undefined);
  }
});

test('old-room windows use three aligned rows including ground and reject roof-only or low shared walls', () => {
  const surface = {...wall, holes: [], points: [[0, 0, 0], [22.8, 0, 0], [22.8, 9, 0], [0, 9, 0], [0, 0, 0]]};
  const study = createWindowStudy(surface, [0, 3, 6], 9, null, OLD_WINDOW_PROFILE);
  const first = study.patches.filter(patch => patch.floor === 0);
  assert.ok(first.length > 0);
  for (const floor of [0, 1, 2]) {
    const patches = study.patches.filter(patch => patch.floor === floor);
    assert.equal(patches.length, first.length);
    for (const [index, patch] of patches.entries()) {
      assert.ok(Math.abs(patch.corners[0][1] - floor * 3 - 0.95) < 1e-8);
      assert.ok(Math.abs(patch.corners[1][0] - patch.corners[0][0] - 1.05) < 1e-8);
      assert.ok(Math.abs(patch.corners[3][1] - patch.corners[0][1] - 1.55) < 1e-8);
      assert.equal(patch.corners[0][0], first[index].corners[0][0]);
      assert.deepEqual(Object.keys(patch), ['floor', 'corners']);
    }
  }
  const low = {...surface, points: surface.points.map(([x, y, z]) => [x, y / 3, z])};
  const roofOnly = {...surface, points: surface.points.map(([x, y, z]) => [x, y + 3, z])};
  assert.equal(createBuildingWindowStudies([low, roofOnly], [0, 3, 6], 12, {house: '51', family: 'plates'}).size, 0);
});

test('sloped walls and holes reject an entire candidate opening, including across source patches', () => {
  const sloped = {
    type: 'WallSurface',
    points: [[0, 0, 0], [22.8, 0, 0], [22.8, 6.1, 0], [12, 9, 0], [0, 9, 0], [0, 0, 0]],
  };
  const study = createWindowStudy(sloped, [0, 3, 6], 9, null, OLD_WINDOW_PROFILE);
  assert.ok(study.patches.some(patch => patch.floor === 2));
  assert.ok(study.patches.filter(patch => patch.floor === 2).length < study.patches.filter(patch => patch.floor === 0).length);
  const ring = sloped.points.map(([x, y]) => [x, y]);
  for (const patch of study.patches) {
    const [left, bottom] = patch.corners[0], [right, top] = patch.corners[2];
    for (const [x, y] of [[left - 0.08, bottom - 0.08], [right + 0.08, bottom - 0.08], [right + 0.08, top + 0.08], [left - 0.08, top + 0.08]]) {
      assert.ok(contains(ring, [x, y]), 'whole opening and clearance must fit beneath the actual slope');
    }
  }
  const fragment = (left, right) => ({type: 'WallSurface', points: [[left, 0, 0], [right, 0, 0], [right, 9, 0], [left, 9, 0], [left, 0, 0]]});
  const first = fragment(0, 7), second = fragment(7, 22.8);
  const intact = createBuildingWindowStudies([first, second], [0, 3, 6], 9, {house: '51', family: 'plates'});
  const crossing = intact.get(first).patches.find(patch => patch.floor === 2 && patch.corners[0][0] < 7 && patch.corners[1][0] > 7);
  assert.ok(crossing, 'fixture must exercise an opening crossing a source-record boundary');
  const center = (crossing.corners[0][0] + crossing.corners[1][0]) / 2;
  first.holes = [[[center - 0.01, 7.3, 0], [center + 0.01, 7.3, 0], [center + 0.01, 7.35, 0], [center - 0.01, 7.35, 0], [center - 0.01, 7.3, 0]]];
  const cut = createBuildingWindowStudies([first, second], [0, 3, 6], 9, {house: '51', family: 'plates'});
  assert.ok([...cut.values()].every(result => !result.patches.some(patch => patch.floor === 2 && Math.abs((patch.corners[0][0] + patch.corners[1][0]) / 2 - center) < 1e-7)), 'a tiny interior hole must reject both fragments of the candidate, not leave chopped glazing');
});

test('all five actual old houses retain exact shells and floor guides while appearance rows fit their walls', async () => {
  const lod2 = JSON.parse(await readFile(new URL('../public/data/lod2.json', import.meta.url), 'utf8'));
  const empty = {schemaVersion: 1, buildings: {}};
  const before = JSON.stringify(lod2);
  const expectedGuideHeights = {'51': 9.404, '53': 8.836, '55': 8.579, '57': 8.670, '59': 8.743};
  for (const building of lod2.buildings.filter(item => item.number in expectedGuideHeights)) {
    const originalFloors = getLevelElevations(empty, building.number, 3, building.height);
    const rows = getOldFacadeRowGuides(building, 3, empty);
    assert.ok(Math.abs(rows.guideHeight - expectedGuideHeights[building.number]) < 1e-8);
    assert.ok(rows.guideHeight < building.height, 'higher roof cap must not become a fourth appearance row');
    assert.ok(rows.sourceSurfaceId);
    const studies = createBuildingWindowStudies(building.surfaces, rows.elevations, building.baseY + rows.guideHeight, {house: building.number, family: 'plates'});
    const floors = new Set([...studies.values()].flatMap(study => study.patches.map(patch => patch.floor)));
    assert.deepEqual([...floors].sort(), [0, 1, 2]);
    const wallFrames = building.surfaces.map(surfaceFrame).filter(Boolean);
    for (const [surface, study] of studies) {
      const frame = surfaceFrame(surface);
      for (const positions of Object.values(study.layers)) for (let i = 0; i < positions.length; i += 9) {
        const center = [0, 1, 2].map(axis => (positions[i + axis] + positions[i + axis + 3] + positions[i + axis + 6]) / 3);
        const project = vector => center.reduce((sum, value, axis) => sum + (value - frame.origin[axis]) * vector[axis], 0);
        assert.ok(contains(frame.rings[0], [project(frame.u), project(frame.v)]), `${building.number}: appearance triangles must remain on the exact source patch`);
        assert.ok(project(frame.normal) > 0.011 && project(frame.normal) < 0.038);
      }
      for (const patch of study.patches) for (const corner of patch.corners) {
        assert.ok(wallFrames.some(candidate => {
          const project = vector => corner.reduce((sum, value, axis) => sum + (value - candidate.origin[axis]) * vector[axis], 0);
          return Math.abs(project(candidate.normal)) < 0.08 && contains(candidate.rings[0], [project(candidate.u), project(candidate.v)]) &&
            !candidate.rings.slice(1).some(ring => contains(ring, [project(candidate.u), project(candidate.v)]));
        }), `${building.number}: no chopped windows under stepped or sloped source roofs`);
      }
    }
    assert.deepEqual(getLevelElevations(empty, building.number, 3, building.height), originalFloors);
    const approved = {schemaVersion: 1, buildings: {[building.number]: {approved: true, levels: [{index: 1, elevation: 3.1}]}}};
    assert.equal(getOldFacadeRowGuides(building, 3, approved).relativeElevations[1], 3.1, 'approved elevation anchors stay exact');
    const highAnchor = {schemaVersion: 1, buildings: {[building.number]: {approved: true, levels: [{index: 2, elevation: rows.guideHeight + 0.1}]}}};
    const fallbackRows = getOldFacadeRowGuides(building, 3, highAnchor);
    assert.equal(fallbackRows.guideHeight, building.height, 'an approved anchor above the appearance roof guide requires the overall-height fallback');
    assert.equal(fallbackRows.relativeElevations[2], rows.guideHeight + 0.1);
    assert.equal(fallbackRows.sourceSurfaceId, null, 'fallback metadata must not claim spacing still comes from the lower flat roof');
    assert.match(fallbackRows.status, /overall height fallback/);
  }
  assert.equal(JSON.stringify(lod2), before);
});
