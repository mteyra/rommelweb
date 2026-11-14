import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createWindowStudy, createBuildingWindowStudies, WINDOW_PROFILE } from '../src/windows.js';
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
    const studies = createBuildingWindowStudies(building.surfaces, elevations, building.baseY + building.height);
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
