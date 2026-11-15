import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {presentExteriorSurface} from '../src/exterior-presentation.js';

const wall = {type: 'WallSurface', points: [[0, 0, 0], [10, 0, 0], [10, 12, 0], [0, 12, 0], [0, 0, 0]]};
const rect = (left, bottom, right, top) => [[left, bottom, 0], [right, bottom, 0], [right, top, 0], [left, top, 0], [left, bottom, 0]];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} ≈ ${b}`);
function triangleArea(positions) {
  let result = 0;
  for (let i = 0; i < positions.length; i += 9) {
    const [a, b, c] = [positions.slice(i, i + 3), positions.slice(i + 3, i + 6), positions.slice(i + 6, i + 9)];
    const u = b.map((v, j) => v - a[j]), v = c.map((v, j) => v - a[j]);
    result += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
  }
  return result;
}

test('corner loggias remove a real piece of the displayed wall without moving the authoritative face', () => {
  const before = structuredClone(wall), masks = [rect(0, 8, 4, 11), rect(7, 3, 10, 6)];
  const output = presentExteriorSurface(wall, masks);
  assert.deepEqual(wall, before);
  near(output.sourceArea, 120);
  near(output.removedArea, 21);
  near(triangleArea(output.positions), 99);
  for (const ring of output.polygons.flat()) for (const [x, y, z] of ring) {
    assert.equal(z, 0); assert.ok(x >= 0 && x <= 10 && y >= 0 && y <= 12);
  }
  // The original corner line no longer spans the open loggia.
  assert.ok(!output.boundarySegments.some(([a, b]) => a[0] === 0 && b[0] === 0 && Math.min(a[1], b[1]) < 9 && Math.max(a[1], b[1]) > 9));
});

test('overlapping masks and an existing source hole are subtracted only once; off-plane masks are rejected', () => {
  const source = {...wall, holes: [rect(4, 1, 5, 2)]};
  const result = presentExteriorSurface(source, [rect(0, 8, 4, 11), rect(2, 9, 6, 11)]);
  near(result.sourceArea, 119);
  near(result.removedArea, 16);
  near(triangleArea(result.positions), 103);
  assert.throws(() => presentExteriorSurface(wall, [rect(0, 8, 4, 11).map(p => [p[0], p[1], 0.1])]), /coplanar/);
});

test('without masks, every real LoD2 face retains its exact source vertices and boundary segments', async () => {
  const lod2 = JSON.parse(await readFile(new URL('../public/data/lod2.json', import.meta.url), 'utf8'));
  const snapshot = JSON.stringify(lod2);
  for (const building of lod2.buildings) for (const surface of building.surfaces) {
    const output = presentExteriorSurface(surface);
    const allowed = new Set([surface.points, ...(surface.holes || [])].flat().map(p => p.join(',')));
    near(output.removedArea, 0);
    for (let i = 0; i < output.positions.length; i += 3) assert.ok(allowed.has(output.positions.slice(i, i + 3).join(',')));
    assert.equal(output.boundarySegments.length, [surface.points, ...(surface.holes || [])].reduce((sum, ring) => sum + ring.length - 1, 0));
  }
  assert.equal(JSON.stringify(lod2), snapshot);
});
