import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bufferMappedPath, buildPathNetwork } from '../src/path-network.js';
import { loadPathNetwork, pathSourceDigest, triangulatePathPolygons, validatePathNetwork } from '../src/paths.js';

const area = polygons => polygons.reduce((sum, polygon) => sum + polygon.reduce((part, ring, i) => {
  const value = Math.abs(ring.slice(1).reduce((s, p, j) => s + ring[j][0] * p[1] - p[0] * ring[j][1], 0)) / 2;
  return part + (i ? -value : value);
}, 0), 0);
const way = (id, points, width, highway = 'footway') => ({ id, kind: 'path', tags: {highway, ...(width === undefined ? {} : {width: String(width)})}, points, osmUrl: `https://www.openstreetmap.org/${id}` });
const distanceToSegment = (p, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
};
const campus = JSON.parse(await readFile(new URL('../public/data/campus.json', import.meta.url), 'utf8'));
const cache = JSON.parse(await readFile(new URL('../public/data/path-network.json', import.meta.url), 'utf8'));

test('crossing paths merge to one boundary without stacked translucent intersections', () => {
  const context = [way('way/1', [[-10, 0], [10, 0]], 2, 'service'), way('way/2', [[0, -10], [0, 10]], 2)];
  const before = structuredClone(context);
  const network = buildPathNetwork(context);
  assert.deepEqual(context, before);
  assert.equal(network.polygons.length, 1);
  assert.equal(network.polygons[0].length, 1);
  assert.ok(Math.abs(area(network.polygons) - (80 - 4 + Math.PI * 2)) < 0.1);
  assert.ok(Math.abs(area(network.roadPolygons) + area(network.footpathPolygons) - area(network.polygons)) < 1e-8, 'road and footpath fills must partition the network');
  for (const ring of network.polygons[0]) for (let i = 1; i < ring.length; i++) {
    const midpoint = ring[i].map((value, axis) => (value + ring[i - 1][axis]) / 2);
    assert.ok(!(Math.abs(midpoint[0]) < 1 - 1e-8 && Math.abs(midpoint[1]) < 1 - 1e-8), 'no kerb edge remains inside the crossing');
  }
});

test('acute bends have bounded rounded joins and preserve every source centerline point', () => {
  const points = [[-10, 0], [0, 0], [-9, 1], [-9, 1], [2, 4]];
  const before = structuredClone(points);
  const polygons = bufferMappedPath(points, 2);
  assert.deepEqual(points, before);
  assert.equal(polygons.length, 1);
  for (const point of polygons.flat(2)) {
    const distance = Math.min(...points.slice(1).flatMap((b, i) => b[0] === points[i][0] && b[1] === points[i][1] ? [] : [distanceToSegment(point, points[i], b)]));
    assert.ok(distance <= 1.00000001, 'round join must never produce a long miter spike');
  }
  assert.throws(() => bufferMappedPath([[0, 0], [1, Infinity]], 2), /finite/);
});

test('closed path loops retain empty islands in both polygon and triangle geometry', () => {
  const polygons = bufferMappedPath([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], 2);
  assert.equal(polygons.length, 1);
  assert.equal(polygons[0].length, 2, 'the center is a hole, not a filled paved square');
  assert.ok(Math.abs(area(polygons) - (144 - (4 - Math.PI) - 64)) < 0.1);
  const triangles = triangulatePathPolygons(polygons, 0);
  let triangleArea = 0;
  for (let i = 0; i < triangles.length; i += 9) {
    const a = [triangles[i], triangles[i + 2]], b = [triangles[i + 3], triangles[i + 5]], c = [triangles[i + 6], triangles[i + 8]];
    triangleArea += Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
    const center = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
    assert.ok(!(center[0] > 1 && center[0] < 9 && center[1] > 1 && center[1] < 9));
  }
  assert.ok(Math.abs(triangleArea - area(polygons)) < 1e-8);
});

test('published path cache exactly matches source SHA and normalized provenance', async () => {
  assert.equal(await validatePathNetwork(cache, campus.context), true);
  assert.equal(cache.sourceSha256, await pathSourceDigest(campus.context));
  assert.equal(cache.counts.mappedWidths, 45);
  assert.equal(cache.counts.unknownWidths, 54);
  const changed = structuredClone(campus.context);
  changed.find(item => item.kind === 'path').points[0][0] += 0.1;
  await assert.rejects(validatePathNetwork(cache, changed), /stale/);
  const malformed = structuredClone(cache);
  malformed.polygons[0][0].pop();
  await assert.rejects(validatePathNetwork(malformed, campus.context), /closed/);
});

test('cache loading failures are nonfatal and never present stale geometry as current', async () => {
  assert.equal(await loadPathNetwork(campus.context, '/missing', async () => ({ok: false})), null);
  assert.equal(await loadPathNetwork(campus.context, '/unreachable', async () => { throw new Error('offline'); }), null);
  assert.equal(await loadPathNetwork(campus.context, '/stale', async () => ({ok: true, json: async () => ({...cache, sourceSha256: 'stale'})})), null);
  assert.equal(await loadPathNetwork(campus.context, '/valid', async () => ({ok: true, json: async () => cache})), cache);
});
