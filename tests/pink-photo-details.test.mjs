import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Scene, PerspectiveCamera, Raycaster, Vector2, Vector3} from 'three';
import {createExteriorDetails} from '../src/exterior-details.js';
import {createBuildingWindowStudies} from '../src/windows.js';
import {surfaceFrame} from '../src/facade.js';
import {presentExteriorSurface} from '../src/exterior-presentation.js';
import {getLevelElevations} from '../src/interiors.js';
import {CampusScene} from '../src/scene.js';

const read = name => readFile(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8').then(JSON.parse);
const [campus, lod2, interiors, studies] = await Promise.all(['campus', 'lod2', 'interiors', 'interior-studies'].map(read));
const source = lod2.buildings.find(building => building.number === '59a');
const building = campus.buildings.find(building => building.number === '59a');
const elevations = getLevelElevations(interiors, '59a', building.levels, source.height).map(y => y + source.baseY);
const details = () => createExteriorDetails(source, {house: '59a', levels: building.levels, absoluteFloorElevations: elevations});
const windows = detail => createBuildingWindowStudies(source.surfaces, elevations, source.baseY + source.height, {
  house: '59a', family: 'timber', exclusionsBySurface: detail.exclusionsBySurface, layoutsBySurface: detail.layoutsBySurface,
});
const groundMasks = (detail, index) => (detail.exclusionsBySurface.get(source.surfaces[index]) || []).filter(ring =>
  Math.min(...ring.map(point => point[1])) < source.baseY + 0.25 &&
  Math.max(...ring.map(point => point[1])) < elevations[1] + 0.05);
const span = (index, ring) => {
  const frame = surfaceFrame(source.surfaces[index]), us = ring.map(point => frame.project(point)[0]);
  return Math.max(...us) - Math.min(...us);
};

test('Pink leaves all north entrance wings blank and controls only photographed room elevations', () => {
  const detail = details(), generated = windows(detail);
  const registration = detail.features.find(feature => feature.id === '59a-resident-photo-registration');
  assert.deepEqual(registration.photoFaces, {1: 'west', 2: 'north', 3: 'east', 4: 'north-east'},
    'The east windows visible in photographs 3 and 4 identify the same elevation');
  assert.deepEqual(registration.unphotographedSurfaceIndices, [3, 8]);
  for (const index of [4, 9, 1, 6]) {
    const layout = detail.layoutsBySurface.get(source.surfaces[index]);
    assert.equal(layout?.replace, true, `North source wall ${index}: explicit absence of bedroom windows`);
    assert.equal(layout.rows.reduce((sum, row) => sum + row.centers.length, 0), 0);
    assert.equal(generated.get(source.surfaces[index])?.patches.length || 0, 0,
      `The generic room-window grid must not appear on the entrance façade, including its narrow fragmented records`);
  }
  for (const index of [2, 7]) {
    assert.equal(detail.layoutsBySurface.get(source.surfaces[index])?.replace, true);
  }
  for (const index of [3, 8]) {
    assert.equal(detail.layoutsBySurface.has(source.surfaces[index]), false,
      `Unphotographed south wall ${index}: preserve its existing window hypothesis apart from observed corner returns`);
  }
  assert.ok([3, 8].some(index => generated.get(source.surfaces[index])?.patches.length),
    'South must retain regular windows rather than becoming an invented blank wall');
});

test('Pink identifies dark east window candidates as uncertain instead of claiming a measured inventory', () => {
  const detail = details();
  const evidence = detail.features.find(feature => feature.id === '59a-photographic-window-rows-2');
  assert.match(evidence.evidence, /not confirmed counts/);
  const layout = detail.layoutsBySurface.get(source.surfaces[2]);
  const frame = surfaceFrame(source.surfaces[2]);
  const start = [79.992, 0, 66.643], end = [79.7, 0, 43.779];
  for (const [floor, fractions] of Object.entries(evidence.inferredCenters)) {
    assert.ok(fractions.length > 0, `Floor ${floor}: retain explicit confidence metadata for dark or occluded candidates`);
    const row = layout.rows.find(row => row.floor === Number(floor));
    for (const fraction of fractions) {
      const center = frame.project(start.map((value, axis) => value + (end[axis] - value) * fraction))[0];
      assert.ok(row.centers.some(value => Math.abs(value - center) < 1e-6),
        `Floor ${floor}: the uncertainty annotation must refer to an actual displayed candidate`);
    }
    assert.match(evidence.rows.find(row => row.floor === Number(floor)).coverage, /not a floor total/);
  }
});

test('the five Pink loggias wrap the photographed corners at their correct floors', () => {
  const detail = details();
  const corners = [
    {name: 'northeast', point: [79.7, 43.779], walls: [6, 2], floors: [2]},
    {name: 'northwest', point: [57.05, 44.096], walls: [4, 7], floors: [4]},
    {name: 'southeast', point: [79.992, 66.643], walls: [3, 2], floors: [3]},
    {name: 'southwest', point: [57.372, 66.961], walls: [8, 7], floors: [1, 5]},
  ];
  const loggias = detail.features.filter(feature => feature.kind === 'corner-loggia');
  assert.equal(loggias.length, 5);
  assert.deepEqual(loggias.map(feature => feature.floor).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  for (const corner of corners) {
    for (let floor = 1; floor < 6; floor++) {
      const expected = corner.floors.includes(floor);
      const middle = (elevations[floor] + (elevations[floor + 1] ?? source.baseY + source.height)) / 2;
      for (const index of corner.walls) {
        const open = (detail.exclusionsBySurface.get(source.surfaces[index]) || []).some(ring =>
          Math.min(...ring.map(point => point[1])) < middle && Math.max(...ring.map(point => point[1])) > middle &&
          ring.some(point => Math.hypot(point[0] - corner.point[0], point[2] - corner.point[1]) < 0.12));
        assert.equal(open, expected, `${corner.name}, floor ${floor}, wall ${index}: both faces must open together`);
      }
      if (expected) {
        const feature = loggias.find(item => item.id === `59a-${corner.name}-loggia-${floor}`);
        assert.ok(feature, 'The individually registered loggia must retain its corner/floor identity');
        corner.walls.forEach(index => assert.ok(feature.sourceSurfaceIndices.includes(index)));
      }
    }
  }
});

test('Pink retains five open north landings above a separately modeled ground entrance', () => {
  const detail = details();
  assert.equal(detail.features.find(feature => feature.id === '59a-north-stair')?.kind, 'recessed-stair-elevation');
  const entry = detail.features.find(feature => feature.id === '59a-north-entrance');
  assert.equal(entry?.kind, 'recessed-entrance');
  const core = source.surfaces[9];
  for (let floor = 1; floor < 6; floor++) {
    const bottom = elevations[floor], top = elevations[floor + 1] ?? source.baseY + source.height;
    const openings = (detail.exclusionsBySurface.get(core) || []).filter(ring => {
      const low = Math.min(...ring.map(point => point[1])), high = Math.max(...ring.map(point => point[1]));
      return low >= bottom - 0.01 && high <= top + 0.01 && high - low > 2;
    });
    assert.equal(openings.length, 1, `Floor ${floor}: one open landing across the core`);
    assert.ok(span(9, openings[0]) > 6.6, 'The landing must occupy the source core instead of becoming a narrow window');
  }
  assert.ok(groundMasks(detail, 9).length, 'The ground portal must be cut into the central source wall');
  assert.ok((detail.signs || []).some(sign => (sign.lines || []).join(' ').includes('59a')),
    'The ground entrance must carry its own correct house address');
});

test('Pink bicycle storage wraps the east ground corner while the west keeps residential openings', () => {
  const detail = details(), generated = windows(detail);
  assert.ok(groundMasks(detail, 2).some(ring => span(2, ring) > 18),
    'The photographed east ground floor is an extensive bicycle cage');
  assert.ok([1, 6].some(index => groundMasks(detail, index).some(ring => span(index, ring) > 1)),
    'The bicycle cage continues around the northeast corner onto the entrance wing');
  assert.equal(generated.get(source.surfaces[2])?.patches.filter(patch => patch.floor === 0).length || 0, 0,
    'The east cage must not be filled with generic ground-floor room windows');
  assert.equal(generated.get(source.surfaces[7])?.patches.filter(patch => patch.floor === 0).length, 6,
    'The west residential ground façade has six photo-located openings');
  for (const index of [2, 7]) {
    const layout = detail.layoutsBySurface.get(source.surfaces[index]);
    for (const row of layout.rows) {
      const actual = generated.get(source.surfaces[index])?.patches.filter(patch => patch.floor === row.floor).length || 0;
      assert.equal(actual, row.centers.length,
        `Wall ${index}, floor ${row.floor}: no requested photo window may disappear behind a misplaced loggia or wall edge`);
    }
  }
});

test('Pink cutouts and details preserve the fixed source shell and never mutate interior or floor data', () => {
  const before = JSON.stringify({campus, lod2, interiors, studies}), guides = [...elevations], detail = details();
  const allPoints = source.surfaces.flatMap(surface => surface.points);
  const min = [0, 1, 2].map(axis => Math.min(...allPoints.map(point => point[axis])));
  const max = [0, 1, 2].map(axis => Math.max(...allPoints.map(point => point[axis])));
  for (const [surface, masks] of detail.exclusionsBySurface) {
    const presentation = presentExteriorSurface(surface, masks);
    assert.ok(presentation.positions.every(Number.isFinite));
    assert.ok(presentation.visibleArea >= 0 && presentation.visibleArea <= presentation.sourceArea + 1e-6);
  }
  for (const [role, positions] of Object.entries(detail.triangleLayers)) {
    assert.equal(positions.length % 9, 0, `${role}: complete triangles`);
    assert.ok(positions.every(Number.isFinite), `${role}: finite vertices`);
    for (let i = 0; i < positions.length; i++) {
      const axis = i % 3;
      assert.ok(positions[i] >= min[axis] - 0.08 && positions[i] <= max[axis] + 0.08,
        `${role}: details must stay attached to the existing shell`);
    }
  }
  assert.deepEqual(elevations, guides);
  assert.equal(JSON.stringify({campus, lod2, interiors, studies}), before);
  assert.deepEqual(details(), detail, 'Repeated generation must be deterministic');
  assert.equal(detail.triangleLayers.detailRoofHardware, undefined,
    'Street photos supply no evidence for new rooftop equipment');
});

class Element extends EventTarget {
  constructor() {super(); this.dataset = {}; this.style = {setProperty() {}}; this.children = [];}
  setAttribute() {}
  appendChild(child) {this.children.push(child);}
}

test('every Pink recessed photo window remains pickable on the near façade and belongs only to the exterior', t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {configurable: true, value: {createElement: () => new Element()}});
  const view = Object.assign(Object.create(CampusScene.prototype), {
    lod2, interiors, studies, scene: new Scene(), buildings: new Map(),
    labelsElement: new Element(), labels: [], camera: new PerspectiveCamera(45, 1, 0.01, 200),
    selected: null, activeFloor: null, pointer: new Vector2(), raycaster: new Raycaster(),
    renderer: {domElement: {getBoundingClientRect: () => ({left: 0, top: 0, width: 100, height: 100})}},
  });
  try {
    view.makeBuilding({...building, baseY: source.baseY, height: source.height, footprint: source.groundPolygons[0]});
    view.scene.updateMatrixWorld(true);
    const record = view.buildings.get('59a');
    assert.equal(record.detailGroup.parent, record.exterior);
    assert.equal(record.floorGroups.length, 6);
    assert.ok(record.floorGroups.every(floor => !floor.visible));
    let checked = 0;
    for (const [surface, study] of windows(details())) {
      const normal = new Vector3(...surfaceFrame(surface).normal);
      for (const patch of study.patches.filter(patch => patch.recessDepth)) {
        const center = patch.corners.reduce((sum, point) => sum.add(new Vector3(...point)), new Vector3()).multiplyScalar(0.25);
        view.camera.position.copy(center).addScaledVector(normal, 0.5);
        view.camera.lookAt(center);
        view.camera.updateMatrixWorld(true);
        const hit = view.pickAt(50, 50);
        const label = `Pink wall ${source.surfaces.indexOf(surface)}, floor ${patch.floor}`;
        assert.ok(hit, `${label}: visible glazing must select the dorm`);
        assert.equal(hit.object.userData.house, '59a', label);
        assert.equal(hit.object.userData.floor, null, label);
        assert.ok(hit.distance < 0.8, `${label}: stop at the near opening, not the opposite wall`);
        checked++;
      }
    }
    assert.ok(checked > 25, 'Exercise every recessed opening across both photographed room elevations');
    t.diagnostic(`${checked} actual recessed Pink window rays hit their near façade.`);
  } finally {
    view.scene.traverse(object => {
      object.geometry?.dispose();
      for (const material of [object.material].flat().filter(Boolean)) material.dispose();
    });
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
});
