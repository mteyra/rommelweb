import test from 'node:test';
import assert from 'node:assert/strict';
import { studyRoomMeasurements, studyDimensionRuns, exteriorDimensionRuns } from '../src/study-measurements.js';

const rectangle = (x, z, width, depth) => [[x, z], [x + width, z], [x + width, z + depth], [x, z + depth], [x, z]];
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should equal ${expected}`);
const transform = (ring, angle) => ring.map(([x, z]) => [
  x * Math.cos(angle) - z * Math.sin(angle) + 61,
  x * Math.sin(angle) + z * Math.cos(angle) - 34,
]);

test('study room spans follow the rotated building axes, not world-aligned bounds', () => {
  for (const angle of [0, Math.PI / 7, Math.PI / 2, -Math.PI / 5]) {
    const outer = transform(rectangle(0, 0, 30, 10), angle);
    const polygon = transform(rectangle(2, 1, 3, 6), angle);
    for (const reverse of [false, true]) {
      const level = {isStudy: true, floorOutline: [{outer: reverse ? [...outer].reverse() : outer}]};
      const space = {kind: 'room', polygon: reverse ? [...polygon].reverse() : polygon};
      const before = structuredClone({level, space});
      const result = studyRoomMeasurements(level, space);
      close(result.shortSpan, 3);
      close(result.longSpan, 6);
      close(result.area, 18);
      assert.deepEqual({level, space}, before, 'display measurements do not rewrite source geometry');
    }
  }
});

test('nonrectangular room area excludes recesses and holes rather than multiplying its spans', () => {
  const angle = Math.PI / 5;
  const level = {isStudy: true, floorOutline: [{outer: transform(rectangle(0, 0, 30, 10), angle)}]};
  const polygon = transform([[1, 1], [7, 1], [7, 3], [4, 3], [4, 5], [1, 5], [1, 1]], angle);
  const hole = transform(rectangle(2, 2, 1, 1), angle);
  for (const ring of [hole, [...hole].reverse()]) {
    const result = studyRoomMeasurements(level, {kind: 'room', polygon, holes: [ring]});
    close(result.shortSpan, 4);
    close(result.longSpan, 6);
    close(result.area, 17);
    assert.notEqual(result.area, result.shortSpan * result.longSpan);
  }
});

test('only study rooms receive envelope measurements', () => {
  const level = {isStudy: true, floorOutline: [{outer: rectangle(0, 0, 30, 10)}]};
  const room = {kind: 'room', polygon: rectangle(1, 1, 3, 6)};
  assert.equal(studyRoomMeasurements({...level, isStudy: false}, room), null);
  assert.equal(studyRoomMeasurements({...level, isStudy: undefined}, room), null);
  for (const kind of ['corridor', 'stairs', 'lift', 'shared', 'service']) {
    assert.equal(studyRoomMeasurements(level, {...room, kind}), null);
  }
});

test('estimated bank dimensions remain separate from immutable source exterior runs', () => {
  const source = [{outer: rectangle(0, 0, 8.08, 6)}];
  const before = structuredClone(source);
  const level = {dimensionGuides: [{
    id: 'estimated-bank', label: 'R bank', confidence: 'estimated',
    segment: [[-0.90, 0], [8.08, 0]], outward: [0, -1], note: 'Estimated allocation, not a clear-room or source-shell span.',
  }]};
  const sourceRuns = exteriorDimensionRuns(source), guides = studyDimensionRuns(level);
  assert.ok(sourceRuns.some(run => run.label === '8.08 m'));
  assert.equal(guides[0].label, 'R bank ≈ 8.98 m');
  assert.equal(guides[0].isStudyGuide, true);
  assert.deepEqual(source, before);
  assert.deepEqual(studyDimensionRuns(null), []);
});

test('independent layout measures clear rooms and exact design guides separately from its wall allowances', () => {
  const angle = Math.PI / 7;
  const level = {
    isStudy: true, layoutBasis: 'resident-module-layout',
    floorOutline: [{outer: transform(rectangle(0, 0, 3.10, 7.40), angle)}],
    dimensionGuides: [{id: 'module-width', label: 'Module', segment: transform([[0, 0], [3.10, 0]], angle), outward: [0, -1]}],
  };
  const room = {kind: 'room', polygon: transform(rectangle(0.20, 1.40, 2.70, 6.00), angle)};
  const result = studyRoomMeasurements(level, room);
  close(result.shortSpan, 2.70);
  close(result.longSpan, 6.00);
  close(result.area, 16.20);
  assert.equal(result.areaBasis, 'clear-room-layout');
  assert.equal(studyDimensionRuns(level)[0].label, 'Module 3.10 m');
  assert.equal(studyRoomMeasurements({...level, layoutBasis: undefined}, room).areaBasis, 'gross-study-envelope');
});

test('independent shared apartments measure whole gross envelopes in the rotated layout axes', () => {
  for (const angle of [0, Math.PI / 7, Math.PI / 2, -Math.PI / 5]) {
    const outer = transform(rectangle(0, 0, 30, 10), angle);
    const polygon = transform(rectangle(1, 1, 6.2, 7.4), angle);
    for (const reverse of [false, true]) {
      const level = {isStudy: true, layoutBasis: 'resident-module-layout',
        floorOutline: [{outer: reverse ? [...outer].reverse() : outer}]};
      const space = {kind: 'shared', polygon: reverse ? [...polygon].reverse() : polygon};
      const before = structuredClone({level, space});
      const result = studyRoomMeasurements(level, space);
      close(result.shortSpan, 6.2);
      close(result.longSpan, 7.4);
      close(result.area, 45.88);
      assert.equal(result.areaBasis, 'shared-apartment-layout');
      assert.deepEqual({level, space}, before);
      for (const kind of ['corridor', 'stairs', 'lift', 'service']) {
        assert.equal(studyRoomMeasurements(level, {...space, kind}), null);
      }
      assert.equal(studyRoomMeasurements({...level, isStudy: false}, space), null);
    }
  }
});

test('shared apartment polygon area excludes a recess and hole without changing its envelope spans', () => {
  const angle = Math.PI / 3;
  const level = {isStudy: true, layoutBasis: 'resident-module-layout',
    floorOutline: [{outer: transform(rectangle(0, 0, 30, 10), angle)}]};
  const space = {kind: 'shared',
    polygon: transform([[0, 0], [6.2, 0], [6.2, 7.4], [2, 7.4], [2, 6.4], [0, 6.4], [0, 0]], angle),
    holes: [transform(rectangle(3, 2, 0.5, 0.8), angle)]};
  const result = studyRoomMeasurements(level, space);
  close(result.shortSpan, 6.2);
  close(result.longSpan, 7.4);
  close(result.area, 43.48);
  assert.notEqual(result.area, result.shortSpan * result.longSpan);
  assert.equal(result.areaBasis, 'shared-apartment-layout');
});
