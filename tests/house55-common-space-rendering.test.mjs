import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Raycaster, Vector3} from 'three';
import {getDisplayLevel} from '../src/interior-studies.js';
import {createInteriorWireframe} from '../src/interior-wireframe.js';

const studies = JSON.parse(await readFile(new URL('../public/data/interior-studies.json', import.meta.url), 'utf8'));
const epsilon = 0.00003; // Float32 line vertices in campus coordinates.
const near = (a, b) => Math.abs(a - b) < epsilon;
const edges = ring => ring.slice(1).map((b, i) => [ring[i], b]);
const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const project = (p, a, b) => {
  const length = distance(a, b);
  return ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / length;
};
const deviation = (p, a, b) => Math.abs((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) / distance(a, b);
const baseWalls = result => result.group.children
  .filter(child => ['interior-walls', 'estimated-interior-walls'].includes(child.userData.role))
  .flatMap(child => {
    const values = child.geometry.attributes.position.array, lines = [];
    for (let i = 0; i < values.length; i += 6) {
      if (near(values[i + 1], .045) && near(values[i + 4], .045)) {
        lines.push([[values[i], values[i + 2]], [values[i + 3], values[i + 5]]]);
      }
    }
    return lines;
  });
const merge = intervals => {
  const result = [];
  for (const [low, high] of intervals.sort((a, b) => a[0] - b[0])) {
    if (high - low < epsilon) continue;
    const last = result.at(-1);
    if (last && low <= last[1] + epsilon) last[1] = Math.max(last[1], high);
    else result.push([low, high]);
  }
  return result;
};

for (const floor of [0, 1]) {
  test(`House 55 ${floor === 0 ? 'EG' : '1. OG'} renders each common enclosure closed except for its single hallway doorway`, () => {
    const level = getDisplayLevel({buildings: {}}, studies, '55', floor);
    const result = createInteriorWireframe(level, {house: '55', floor});
    const walls = baseWalls(result), common = level.spaces.filter(space => space.kind === 'service');
    assert.equal(common.length, 2);
    for (const space of common) {
      const doors = level.doors.filter(door => [door.spaceId, door.toSpaceId].includes(space.id));
      assert.equal(doors.length, 1, `${space.label} has one entrance`);
      const door = doors[0];
      const hall = level.spaces.find(item => item.id === (door.spaceId === space.id ? door.toSpaceId : door.spaceId));
      assert.equal(hall.kind, 'corridor');
      for (const [a, b] of edges(space.polygon)) {
        const length = distance(a, b);
        const intervals = merge(walls.filter(line => line.every(p => deviation(p, a, b) < epsilon))
          .map(line => line.map(p => project(p, a, b)).sort((x, y) => x - y))
          .map(([low, high]) => [Math.max(0, low), Math.min(length, high)]));
        const opensHere = door.segment.every(p => deviation(p, a, b) < epsilon);
        const [low, high] = door.segment.map(p => project(p, a, b)).sort((x, y) => x - y);
        const expected = opensHere ? [[0, low], [high, length]] : [[0, length]];
        assert.equal(intervals.length, expected.length, `${space.label} boundary wall runs`);
        intervals.forEach((interval, i) => interval.forEach((value, j) => {
          assert.ok(near(value, expected[i][j]), `${space.label} wall ends at the exact doorway/perimeter`);
        }));
      }
      const center = space.polygon.slice(0, -1).reduce((sum, p) => [sum[0] + p[0] / 4, sum[1] + p[1] / 4], [0, 0]);
      result.group.updateMatrixWorld(true);
      const hits = new Raycaster(new Vector3(center[0], 10, center[1]), new Vector3(0, -1, 0))
        .intersectObjects(result.pickables);
      assert.equal(hits[0]?.object.userData.spaceId, space.id, `${space.label} remains selectable`);
      assert.equal(result.labels.filter(label => label.spaceId === space.id && label.kind === 'space').length, 1);
      assert.equal(result.pickables.filter(mesh => mesh.userData.openingId === door.id).length, 1);
    }
  });
}
