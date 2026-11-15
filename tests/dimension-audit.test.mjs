import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { difference } from 'polyclip-ts';

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const area = ring => Math.abs(ring.slice(1).reduce((sum, p, i) =>
  sum + ring[i][0] * p[1] - p[0] * ring[i][1], 0)) / 2;
const distance = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / length)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};

test('published dimension evidence matches the current model and its living-zone witnesses really fit', async () => {
  const [reportBytes, studyBytes, baselineBytes, sourceBytes] = await Promise.all([
    read('docs/data/house55-dimension-audit.json'), read('public/data/interior-studies.json'),
    read('data/source/house55-2og-sketch-baseline.json'), read('public/data/lod2.json'),
  ]);
  const report = JSON.parse(reportBytes);
  assert.equal(report.input.sha256, digest(studyBytes), 'regenerate the dated evidence after study changes');
  assert.equal(report.baseline.sha256, digest(baselineBytes));
  assert.equal(report.sourceSHA256, digest(sourceBytes));
  const plan = JSON.parse(studyBytes).buildings['55'].levels.find(level => level.index === 2);
  const {right, down} = report.studyAxes;
  assert.ok(Math.abs(Math.hypot(...right) - 1) < 1e-12);
  assert.ok(Math.abs(Math.hypot(...down) - 1) < 1e-12);
  assert.ok(Math.abs(right[0] * down[0] + right[1] * down[1]) < 1e-12);
  const local = p => [p[0] * right[0] + p[1] * right[1], p[0] * down[0] + p[1] * down[1]];
  let witnessed = 0;
  for (const item of report.rooms) {
    const space = plan.spaces.find(space => space.shortLabel === item.label);
    assert.ok(space);
    if (!item.packingWitness) {
      assert.ok(['R1', 'R2', 'R3'].includes(item.label));
      assert.equal(item.impossibleAtAnyRotationByBoundingWidth, true);
      assert.ok(Math.min(...item.insetBoundingSpans) < 2.7);
      continue;
    }
    witnessed++;
    const witness = item.packingWitness;
    const edges = witness.slice(1).map((p, i) => Math.hypot(p[0] - witness[i][0], p[1] - witness[i][1])).sort();
    assert.ok(Math.abs(edges[0] - 2.7) < 1e-8 && Math.abs(edges[3] - 3.3) < 1e-8);
    assert.ok(Math.abs(area(witness) - 8.91) < 1e-8);
    const rings = [space.polygon, ...(space.holes || [])].map(ring => ring.map(local));
    const outside = difference([witness], rings).reduce((sum, polygon) =>
      sum + area(polygon[0]) - polygon.slice(1).reduce((holes, ring) => holes + area(ring), 0), 0);
    assert.ok(outside < 1e-8, `${item.label}: the entire reference rectangle must fit`);
    for (const point of witness) {
      const closest = Math.min(...rings.flatMap(ring => ring.slice(1).map((b, i) => distance(point, ring[i], b))));
      assert.ok(closest >= report.packing.insetAssumption - 1e-6, `${item.label}: retain the declared hypothetical inset`);
    }
  }
  assert.equal(witnessed, 17);
  assert.deepEqual(report.packing.unresolved, ['R1', 'R2', 'R3']);
});
