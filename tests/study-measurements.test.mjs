import test from 'node:test';
import assert from 'node:assert/strict';
import { studyRoomMeasurements, studyDimensionRuns, exteriorDimensionRuns } from '../src/study-measurements.js';
import {isFittedModuleLayout, isIndependentLayout, isModuleLayout, getLevelWindows,
  studyFloorSection, studyPlanDirection, validateInteriorStudies} from '../src/interior-studies.js';

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

test('fitted rectangles measure their own axes while the unchanged source outline keeps its orientation and dimensions', () => {
  for (const angle of [0.08, -0.21, Math.PI / 2 + 0.015]) {
    const level = {isStudy: true, layoutBasis: 'fitted-module-layout',
      floorOutline: [{outer: transform(rectangle(-10, -10, 40, 25), angle + 0.035)}]};
    const before = structuredClone(level);
    for (const [kind, width, depth, basis] of [
      ['room', 2.7, 6, 'clear-room-layout'], ['shared', 6.2, 7.4, 'shared-apartment-layout'],
    ]) {
      const room = {kind, polygon: transform(rectangle(0, 0, width, depth), angle)};
      const result = studyRoomMeasurements(level, room);
      close(result.shortSpan, width);
      close(result.longSpan, depth);
      close(result.area, width * depth);
      assert.equal(result.areaBasis, basis);
    }
    const original = {...level, layoutBasis: undefined};
    assert.deepEqual(studyPlanDirection(level), studyPlanDirection(original));
    assert.deepEqual(exteriorDimensionRuns(level.floorOutline), exteriorDimensionRuns(original.floorOutline));
    assert.deepEqual(level, before);
  }
});

test('fitted module basis retains source-plate semantics and the normal polygon validation contract', () => {
  const level = {
    index: 0, label: 'Provisional floor', source: 'Synthetic placement', notes: 'Original outline retained.',
    layoutBasis: 'fitted-module-layout', layoutWindows: [],
    floorOutline: [{outer: rectangle(-2, -2, 15, 12)}],
    spaces: [{id: 'fitted-room', label: 'Room A', kind: 'room', confidence: 'estimated',
      polygon: rectangle(0, 0, 2.7, 6)}],
  };
  const input = {schemaVersion: 1, buildings: {'51': {source: 'Synthetic source', levels: [level]}}};
  const campus = {buildings: [{number: '51', levels: 3}]}, lod2 = {buildings: [{number: '51', surfaces: []}]};
  assert.equal(validateInteriorStudies(input, campus, lod2), true);
  assert.equal(isFittedModuleLayout(level), true);
  assert.equal(isModuleLayout(level), true);
  assert.equal(isIndependentLayout(level), false);
  const shown = {...level, isStudy: true};
  const section = studyFloorSection({polygons: level.floorOutline, sampleElevation: 1.5}, shown);
  assert.equal(section.sourceStatus, 'fixed-source-outline-module-study');
  assert.equal(section.sampleElevation, 1.5);
  assert.deepEqual(section.polygons[0].outer, level.floorOutline[0].outer);
  assert.deepEqual(getLevelWindows({...shown, windows: [{id: 'folded-source-window'}]}), [],
    'source façade observations do not become fitted room openings');
  for (const change of [
    copy => { copy.buildings['51'].levels[0].layoutBasis = 'confirmed-measurements'; },
    copy => { copy.buildings['51'].levels[0].spaces[0].polygon = [[0, 0], [3, 6], [0, 6], [3, 0], [0, 0]]; },
    copy => { copy.buildings['51'].levels[0].spaces[0].polygon = rectangle(99, 99, 2.7, 6); },
  ]) {
    const invalid = structuredClone(input);
    change(invalid);
    assert.throws(() => validateInteriorStudies(invalid, campus, lod2));
  }
});
