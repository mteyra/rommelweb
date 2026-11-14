import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Scene } from 'three';
import { CampusScene } from '../src/scene.js';
import { pathSources, validatePathNetwork } from '../src/paths.js';

const campus = JSON.parse(await readFile(new URL('../public/data/campus.json', import.meta.url), 'utf8'));
const cache = JSON.parse(await readFile(new URL('../public/data/path-network.json', import.meta.url), 'utf8'));
const sourceRecords = pathSources(campus.context);
const sceneMock = () => ({
  campus, scene: new Scene(), pathSourceRecords: sourceRecords,
  drawPathNetwork: CampusScene.prototype.drawPathNetwork,
});

function checkCenterlines(mock, expected) {
  const lines = mock.paths.children.filter(object => object.userData.role === 'sourced-centerlines');
  assert.deepEqual(lines.flatMap(object => object.userData.sourceIds).sort(), expected.map(source => source.id).sort());
  for (const object of lines) {
    const sources = expected.filter(source => source.family === object.userData.family);
    const starts = object.geometry.getAttribute('instanceStart'), ends = object.geometry.getAttribute('instanceEnd');
    const segments = sources.flatMap(source => source.points.slice(1).map((point, i) => [source.points[i], point]));
    assert.equal(starts.count, segments.length);
    segments.forEach(([a, b], i) => {
      assert.ok(Math.hypot(starts.getX(i) - a[0], starts.getZ(i) - a[1]) < 0.0001);
      assert.ok(Math.hypot(ends.getX(i) - b[0], ends.getZ(i) - b[1]) < 0.0001);
    });
  }
}

test('rendered network preserves source provenance with no invented widths for untagged paths', async () => {
  await validatePathNetwork(cache, campus.context);
  const mock = sceneMock();
  CampusScene.prototype.makePaths.call(mock, cache);
  assert.equal(mock.pathCount, sourceRecords.length);
  assert.deepEqual(mock.paths.userData.sources, sourceRecords);
  assert.equal(mock.paths.userData.cacheStatus, 'validated');
  const meshes = mock.paths.children.filter(object => object.userData.role === 'sourced-path-network');
  assert.deepEqual(meshes.flatMap(object => object.userData.sourceIds).sort(), sourceRecords.filter(source => source.width !== null).map(source => source.id).sort());
  for (const mesh of meshes) assert.ok([...mesh.geometry.getAttribute('position').array].every(Number.isFinite));
  assert.equal(mock.paths.children.filter(object => object.userData.role === 'unioned-network-boundary').length, 1);
  checkCenterlines(mock, sourceRecords.filter(source => source.width === null));
});

test('missing derived geometry falls back to all exact outdoor source centerlines', () => {
  const mock = sceneMock();
  CampusScene.prototype.drawPathNetwork.call(mock, null);
  assert.equal(mock.paths.userData.cacheStatus, 'source-centerlines');
  assert.equal(mock.paths.children.filter(object => object.isMesh && !object.isLineSegments2).length, 0);
  checkCenterlines(mock, sourceRecords);
  assert.equal(sourceRecords.length, 99);
  assert.equal(sourceRecords.some(source => campus.context.find(item => item.id === source.id)?.tags.indoor === 'yes'), false);
});
