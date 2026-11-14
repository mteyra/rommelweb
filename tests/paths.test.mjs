import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Scene } from 'three';
import { CampusScene } from '../src/scene.js';

test('ground paths use only mapped outdoor OSM ways, with ribbons only for explicit source widths', async () => {
  const campus = JSON.parse(await readFile(new URL('../public/data/campus.json', import.meta.url), 'utf8'));
  const mock = { campus, scene: new Scene(), line: CampusScene.prototype.line };
  CampusScene.prototype.makePaths.call(mock);
  const expected = campus.context.filter(item => item.kind === 'path' && item.tags.highway && item.tags.indoor !== 'yes');
  const rendered = mock.paths.children.filter(object => object.userData.role === 'sourced-path');
  assert.equal(mock.pathCount, expected.length);
  assert.deepEqual(rendered.map(object => object.userData.osmId).sort(), expected.map(item => item.id).sort());
  for (const object of rendered) {
    const source = expected.find(item => item.id === object.userData.osmId);
    assert.equal(object.userData.source, source.osmUrl);
    const positions = object.geometry.getAttribute('position');
    assert.ok([...positions.array].every(Number.isFinite));
    if (object.isMesh) {
      assert.equal(object.userData.mappedWidth, Number(source.tags.width), 'road width must come from a tag');
      for (let i = 0; i < positions.count; i += 6) {
        const left = [positions.getX(i), positions.getZ(i)], right = [positions.getX(i + 1), positions.getZ(i + 1)];
        assert.ok(Math.abs(Math.hypot(left[0] - right[0], left[1] - right[1]) - object.userData.mappedWidth) < 0.0001);
        const center = [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2];
        assert.ok(source.points.some(point => Math.hypot(point[0] - center[0], point[1] - center[1]) < 0.0001), 'ribbon must stay centered on the mapped path');
      }
    } else {
      assert.equal(positions.count, source.points.length);
      source.points.forEach(([x, z], i) => assert.ok(Math.hypot(positions.getX(i) - x, positions.getZ(i) - z) < 0.0001));
    }
  }
});
