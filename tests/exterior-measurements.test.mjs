import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {CampusScene, explodedFloorGap} from '../src/scene.js';
import {getDisplayLevel, studyFloorSection, studyPlanDirection} from '../src/interior-studies.js';
import {getLevelElevations} from '../src/interiors.js';
import {floorSection} from '../src/sections.js';
import {exteriorDimensionRuns, layoutExteriorDimensions} from '../src/study-measurements.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} should equal ${b}`);
const outline = [[0, 0], [8, 0], [8, 3], [5, 3], [5, 7], [0, 7], [0, 0]];
const transform = (ring, angle) => ring.map(([x, z]) => [
  160 + x * Math.cos(angle) - z * Math.sin(angle),
  -75 + x * Math.sin(angle) + z * Math.cos(angle),
]);
const viewport = {left: 10, right: 490, top: 10, bottom: 490};
const screenRun = (id, start, end, outwardPoint, label = '8.00 m') => ({id, start, end, outwardPoint, label, length: 8});
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

test('exterior lengths preserve the concave returns and actual metres under rotation or reversed winding', () => {
  for (const angle of [0, Math.PI / 7, -Math.PI / 3]) {
    const outer = transform(outline, angle);
    for (const reverse of [false, true]) {
      const polygons = [{outer: reverse ? [...outer].reverse() : outer}];
      const before = structuredClone(polygons);
      const runs = exteriorDimensionRuns(polygons);
      assert.deepEqual(runs.map(run => Math.round(run.length * 1e6) / 1e6).sort((a, b) => a - b), [3, 3, 4, 5, 7, 8]);
      assert.deepEqual(polygons, before);
      for (const run of runs) {
        near(Math.hypot(...run.outward), 1);
        near(run.outward[0] * (run.end[0] - run.start[0]) + run.outward[1] * (run.end[1] - run.start[1]), 0);
      }
    }
  }
  const forward = exteriorDimensionRuns([{outer: outline}]);
  const reversed = exteriorDimensionRuns([{outer: [...outline].reverse()}]);
  for (const run of forward) {
    const opposite = reversed.find(other => other.start[0] === run.end[0] && other.start[1] === run.end[1]);
    opposite.outward.forEach((value, axis) => near(value, run.outward[axis]));
  }
  assert.deepEqual(forward[2].outward, [0, 1], 'the notch-facing horizontal edge points into the recess');
});

test('only collinear source vertices merge; a real 0.12 m return survives and internal room geometry is irrelevant', () => {
  const outer = [[0, 0], [4, .001], [8, 0], [8, 3], [7.88, 3], [7.88, 7], [0, 7], [0, 0]];
  const polygons = [{outer, holes: [[[1, 1], [2, 1], [2, 2], [1, 1]]], spaces: [{polygon: outline}]}];
  const runs = exteriorDimensionRuns(polygons);
  assert.equal(runs.length, 6);
  near(runs[0].length, 8);
  near(runs.find(run => run.length < 1).length, .12);
  assert.equal(exteriorDimensionRuns([{outer}]).length, runs.length);
});

test('House 55 annotations use the floor outline independently of all room polygons', async () => {
  const data = JSON.parse(await readFile(new URL('../public/data/interior-studies.json', import.meta.url), 'utf8'));
  const level = data.buildings['55'].levels.find(item => item.index === 2);
  const before = structuredClone(level);
  const runs = exteriorDimensionRuns(level.floorOutline);
  assert.ok(runs.length >= 16, 'stepped house perimeter is not reduced to one bounding box');
  const sourcePoints = level.floorOutline.flatMap(polygon => polygon.outer);
  for (const run of runs) {
    assert.ok(sourcePoints.some(point => point.every((value, axis) => value === run.start[axis])));
    assert.ok(sourcePoints.some(point => point.every((value, axis) => value === run.end[axis])));
    near(run.length, Math.hypot(run.end[0] - run.start[0], run.end[1] - run.start[1]));
    assert.match(run.label, /^\d+\.\d{2} m$/);
  }
  level.spaces = [];
  assert.deepEqual(exteriorDimensionRuns(level.floorOutline), runs);
  assert.deepEqual(level.floorOutline, before.floorOutline);
});

test('dimension text stays outside the footprint with extension lines and readable upright rotation', () => {
  const footprint = [[100, 100], [300, 100], [300, 300], [100, 300], [100, 100]];
  const runs = [
    screenRun('top', [100, 100], [300, 100], [200, 80]),
    screenRun('right', [300, 100], [300, 300], [320, 200]),
    screenRun('bottom', [300, 300], [100, 300], [200, 320]),
    screenRun('left', [100, 300], [100, 100], [80, 200]),
  ];
  const placed = layoutExteriorDimensions(runs, {viewport, outlines: [footprint]});
  assert.equal(placed.length, 4);
  for (const item of placed) {
    assert.equal(item.extensionLines.length, 2);
    assert.equal(item.ticks.length, 2);
    assert.ok(item.angle >= -90 && item.angle <= 90);
    const bounds = item.bounds;
    assert.ok(bounds.right < 100 || bounds.left > 300 || bounds.bottom < 100 || bounds.top > 300);
  }
});

test('existing door targets get priority; dimensions neither overlap them nor each other', () => {
  const occupied = [{left: 155, right: 245, top: 30, bottom: 98}];
  const before = structuredClone(occupied);
  const runs = [
    screenRun('blocked-by-door', [100, 100], [300, 100], [200, 80]),
    screenRun('bottom', [300, 300], [100, 300], [200, 320]),
    screenRun('duplicate', [300, 303], [100, 303], [200, 323]),
  ];
  const placed = layoutExteriorDimensions(runs, {viewport, occupied});
  assert.equal(placed.some(item => item.id === 'blocked-by-door'), false);
  assert.ok(placed.length >= 1);
  for (let i = 0; i < placed.length; i++) {
    assert.ok(occupied.every(bounds => !overlaps(bounds, placed[i].bounds)));
    assert.ok(placed.slice(i + 1).every(item => !overlaps(item.bounds, placed[i].bounds)));
  }
  assert.deepEqual(occupied, before);
});

test('a small concave run is suppressed until zoom gives it room; camera clipping and the mobile UI remain clear', () => {
  const small = screenRun('return', [100, 100], [130, 100], [115, 80], '1.20 m');
  assert.equal(layoutExteriorDimensions([small], {viewport, compact: true}).length, 0);
  const zoomed = {...small, end: [190, 100], outwardPoint: [145, 80]};
  assert.equal(layoutExteriorDimensions([zoomed], {viewport, compact: true}).length, 1);
  assert.equal(layoutExteriorDimensions([{...zoomed, visible: false}], {viewport}).length, 0);
  assert.equal(layoutExteriorDimensions([{...zoomed, start: [-5, 100]}], {viewport}).length, 0);
  const mobileViewport = {left: 10, right: 380, top: 148, bottom: 648};
  const mobile = [
    screenRun('under-header', [100, 149], [300, 149], [200, 130]),
    screenRun('above-tray', [300, 647], [100, 647], [200, 668]),
    screenRun('middle', [100, 300], [300, 300], [200, 280]),
  ];
  const placed = layoutExteriorDimensions(mobile, {viewport: mobileViewport, compact: true});
  assert.deepEqual(placed.map(item => item.id), ['middle']);
});

test('a dimension in a narrow recess does not move its label over the opposite wing', () => {
  const run = screenRun('recess', [100, 180], [300, 180], [200, 195]);
  const oppositeWing = [[50, 194], [350, 194], [350, 240], [50, 240], [50, 194]];
  assert.equal(layoutExteriorDimensions([run], {viewport, outlines: [oppositeWing]}).length, 0);
});

test('the real top-floor camera leaves readable exterior dimensions on desktop and small phones', async () => {
  const [campus, lod2, interiors, studies] = await Promise.all(['campus', 'lod2', 'interiors', 'interior-studies'].map(async name =>
    JSON.parse(await readFile(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'))));
  const official = lod2.buildings.find(building => building.number === '55');
  const data = {...campus.buildings.find(building => building.number === '55'), baseY: official.baseY, height: official.height, footprint: official.groundPolygons[0]};
  const floorElevations = getLevelElevations(interiors, '55', data.levels, data.height);
  const building = {data, floorElevations, floorSections: floorElevations.map((elevation, floor) =>
    studyFloorSection(floorSection(official, elevation), getDisplayLevel(interiors, studies, '55', floor)))};
  building.targetGap = explodedFloorGap(building);
  const level = getDisplayLevel(interiors, studies, '55', 2);
  const runs = exteriorDimensionRuns(building.floorSections[2].polygons);
  for (const [width, height, minimumLabels] of [[1920, 1087, 10], [390, 844, 6], [320, 568, 1]]) {
    const compact = width <= 700;
    const view = Object.create(CampusScene.prototype);
    Object.assign(view, {
      selected: '55', activeFloor: 2, exploded: true, interiors, studies, buildings: new Map([['55', building]]),
      container: {getBoundingClientRect: () => ({width, height})},
      camera: new THREE.PerspectiveCamera(42, width / height, .1, 1600),
    });
    const frame = view.fittedCamera(new THREE.Vector3(...studyPlanDirection(level, compact)));
    view.camera.position.copy(frame.position);
    view.camera.lookAt(frame.target);
    view.camera.updateMatrixWorld();
    const project = ([x, z]) => {
      const point = new THREE.Vector3(x, data.baseY + floorElevations[2] + building.targetGap * 2, z).project(view.camera);
      return [(point.x + 1) * width / 2, (1 - point.y) * height / 2];
    };
    const projected = runs.map(run => ({
      ...run, start: project(run.start), end: project(run.end),
      outwardPoint: project(run.start.map((value, axis) => (value + run.end[axis]) / 2 + run.outward[axis])),
    }));
    const viewport = {
      left: compact ? 10 : 22, right: width - (compact ? 10 : 22),
      top: compact ? Math.min(148, height * .27) : 140,
      bottom: height - (compact ? Math.min(196, height * .35) : 150),
    };
    const outlines = building.floorSections[2].polygons.map(polygon => polygon.outer.map(project));
    const placed = layoutExteriorDimensions(projected, {viewport, outlines, compact});
    assert.ok(placed.length >= minimumLabels, `${width}×${height}: expected at least ${minimumLabels} useful exterior dimensions, got ${placed.length}`);
    for (const item of placed) {
      assert.ok(item.bounds.left >= viewport.left && item.bounds.right <= viewport.right && item.bounds.top >= viewport.top && item.bounds.bottom <= viewport.bottom);
    }
  }
});
