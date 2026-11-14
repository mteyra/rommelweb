import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {CampusScene, HOME_DIRECTION, advanceFloorMotion, explodedFloorGap} from '../src/scene.js';
import {floorSection} from '../src/sections.js';
import {getLevelElevations, validateInteriorData} from '../src/interiors.js';

const labelElement = () => ({hidden: false, classList: {toggle() {}}});
function fixture(reduced = true) {
  const view = Object.create(CampusScene.prototype);
  const records = ['51', '53'].map((number, index) => {
    const x = index * 80, footprint = [[x, 0], [x + 23, 0], [x + 23, 23], [x, 23], [x, 0]];
    const group = new THREE.Group(), exterior = new THREE.Group();
    group.add(exterior);
    const floorGroups = Array.from({length: 3}, () => new THREE.Group());
    const interiorGroups = Array.from({length: 3}, () => new THREE.Group());
    const pickables = floorGroups.map((floor, index) => {
      group.add(floor);
      floor.add(interiorGroups[index]);
      const mesh = new THREE.Mesh();
      mesh.userData = {house: number, floor: index, role: 'source-envelope-section'};
      floor.add(mesh);
      return mesh;
    });
    const interiorPickables = interiorGroups.flatMap((group, floor) => ['interior-space', 'interior-opening'].map(role => {
      const mesh = new THREE.Mesh();
      mesh.userData = {house: number, floor, spaceId: `${number}-${floor}`, role, ...(role === 'interior-opening' ? {openingId: `${number}-${floor}-door`} : {})};
      group.add(mesh);
      return mesh;
    }));
    return {data: {number, baseY: 2.3, height: 9.8, footprint, centroid: [x + 11.5, 11.5], levels: 3},
      group, exterior, floorGroups, interiorGroups, pickables, interiorPickables,
      exteriorPickables: [new THREE.Mesh()], floorElevations: [0, 2.9, 6.4],
      floorSections: Array.from({length: 3}, () => ({polygons: [{outer: footprint, holes: []}]})),
      currentGap: 0, targetGap: 0, facadeMaterials: [], label: labelElement()};
  });
  Object.assign(view, {
    selected: '51', activeFloor: null, exploded: false, reduced, contextMix: 1,
    interiors: {schemaVersion: 1, buildings: {}},
    buildings: new Map(records.map(record => [record.data.number, record])),
    contextGroup: new THREE.Group(), pointer: new THREE.Vector2(), raycaster: new THREE.Raycaster(),
    camera: new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 1600),
    renderer: {setSize() {}, domElement: {getBoundingClientRect: () => ({left: 0, top: 0, width: 1000, height: 600})}},
    container: {getBoundingClientRect: () => ({width: 1000, height: 600})},
    labels: records.flatMap(record => [
      {el: record.label, type: 'house', number: record.data.number},
      ...record.floorGroups.map((_, floor) => ({el: labelElement(), type: 'floor', number: record.data.number, floor})),
      {el: labelElement(), type: 'room', number: record.data.number, floor: 1},
    ]),
    applyBuildingAppearance() {},
  });
  view.lod2 = {buildings: records.map(record => ({number: record.data.number, surfaces: [
    {points: record.data.footprint.flatMap(([x, z]) => [[x, record.data.baseY, z], [x, record.data.baseY + record.data.height, z]])},
  ]}))};
  view.campusBounds = new THREE.Box3().setFromPoints(view.lod2.buildings.flatMap(building => building.surfaces.flatMap(surface => surface.points.map(point => new THREE.Vector3(...point)))));
  view.labels.push({el: labelElement(), type: 'context'});
  view.contextGroup.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({opacity: 0.4})));
  view.camera.position.set(-50, 40, 95);
  view.controls = {target: new THREE.Vector3(11.5, 5, 11.5), update() { view.camera.lookAt(this.target); view.camera.updateMatrixWorld(); }};
  view.controls.update();
  view.updateViewVisibility();
  return view;
}

test('unfolding isolates one metre-scale building and collapse restores all context immediately with reduced motion', () => {
  const view = fixture(), selected = view.buildings.get('51'), other = view.buildings.get('53');
  const before = structuredClone(selected.data);
  view.explode(true);
  assert.equal(selected.currentGap, explodedFloorGap(selected));
  assert.ok(selected.currentGap >= 10);
  assert.equal(selected.gapTween, null);
  assert.equal(view.tween, undefined);
  assert.equal(other.group.visible, false);
  assert.equal(selected.exterior.visible, false);
  assert.ok(selected.floorGroups.every(group => group.visible));
  assert.ok(selected.interiorGroups.every(group => group.visible));
  assert.equal(view.contextGroup.visible, false);
  assert.ok(view.labels.filter(label => label.type === 'house' || label.number === '53').every(label => label.el.hidden));
  assert.equal(view.labelInCurrentView(view.labels.find(label => label.type === 'floor' && label.number === '51')), true);
  assert.deepEqual(selected.data, before);
  view.explode(false);
  assert.equal(selected.currentGap, 0);
  assert.equal(other.group.visible, true);
  assert.equal(selected.exterior.visible, true);
  assert.ok(selected.floorGroups.every(group => !group.visible));
  assert.ok(selected.interiorGroups.every(group => !group.visible));
  assert.equal(view.contextGroup.visible, true);
  assert.equal(view.contextGroup.children[0].material.opacity, 0.4);
  selected.floorGroups.forEach((group, floor) => assert.equal(group.position.y, selected.data.baseY + selected.floorElevations[floor]));
});

test('selecting one floor hides siblings and fits only its actual section almost overhead; all floors restores the stack', () => {
  const view = fixture(), building = view.buildings.get('51');
  view.explode(true);
  const stackDistance = view.camera.position.distanceTo(view.controls.target);
  view.setFloor(1);
  assert.deepEqual(building.floorGroups.map(group => group.visible), [false, true, false]);
  assert.deepEqual(building.interiorGroups.map(group => group.visible), [false, true, false]);
  assert.equal(view.topView, true);
  assert.ok(view.camera.position.clone().sub(view.controls.target).normalize().y > 0.999);
  assert.ok(view.camera.position.distanceTo(view.controls.target) < stackDistance * 0.85);
  const y = building.data.baseY + building.floorElevations[1] + building.targetGap;
  assert.ok(view.focusPoints().every(point => point.y >= y && point.y <= y + 0.13));
  assert.ok(view.focusPoints().every(point => {
    const projected = point.clone().project(view.camera);
    return Math.abs(projected.x) < 0.87 && Math.abs(projected.y) < 0.87;
  }));
  view.setFloor(null);
  assert.ok(building.floorGroups.every(group => group.visible));
  assert.ok(building.interiorGroups.every(group => group.visible));
  assert.equal(view.topView, false);
  assert.ok(view.camera.position.clone().sub(view.controls.target).normalize().y < 0.6);
  view.setFloor(99);
  assert.equal(view.activeFloor, null, 'invalid levels cannot hide the selected building');
});

test('resize during floor travel fits its destination and house travel cancels isolation and stale floor transitions', () => {
  const view = fixture(false), building = view.buildings.get('51');
  view.explode(true);
  advanceFloorMotion(building, building.gapTween.start + 325);
  assert.ok(building.currentGap > 0 && building.currentGap < building.targetGap);
  view.setFloor(2);
  view.container.getBoundingClientRect = () => ({width: 390, height: 844});
  view.resize();
  assert.equal(view.tween, null);
  assert.ok(view.camera.position.clone().sub(view.controls.target).normalize().y > 0.999);
  for (const point of view.focusPoints()) {
    const projected = point.clone().project(view.camera);
    assert.ok(Math.abs(projected.x) < 0.87 && Math.abs(projected.y) < 0.87, 'portrait resize must retain the focused destination section');
  }
  view.select('53');
  assert.equal(view.exploded, false);
  assert.equal(view.activeFloor, null);
  assert.equal(view.topView, false);
  assert.ok([...view.buildings.values()].every(record => record.group.visible && record.exterior.visible && record.currentGap === 0 && !record.gapTween));
  assert.ok(view.labels.filter(label => label.type === 'room' || label.type === 'floor').every(label => label.el.hidden));
  assert.equal(view.contextTween, null, 'context had not begun fading, so restore without a stale transition');
  assert.equal(view.contextGroup.visible, true);
  view.reset();
  assert.equal(view.selected, null);
});

test('hidden buildings/floors cannot intercept picking; room and door targets activate only in a selected floor', () => {
  const view = fixture(), building = view.buildings.get('51');
  let candidates;
  view.raycaster.intersectObjects = objects => { candidates = objects; return objects.map(object => ({object})); };
  view.explode(true);
  view.pickAt(100, 100);
  assert.deepEqual(candidates, building.pickables, 'stack clicks select its floor rather than incidental room polygons');
  view.setFloor(1);
  const hit = view.pickAt(100, 100);
  assert.ok(candidates.every(mesh => mesh.userData.house === '51' && mesh.userData.floor === 1));
  assert.equal(candidates.length, 3);
  assert.equal(hit.object.userData.role, 'interior-opening', 'a doorway wins over its underlying room hit');
  const calls = [];
  view.onFloor = floor => calls.push(['floor', floor]);
  view.onSpace = details => calls.push(['space', details.spaceId, details.openingId]);
  view.openSpace({house: '51', floor: 0, spaceId: 'room0'});
  view.openSpace({house: '53', floor: 1, spaceId: 'other'});
  view.openSpace({house: '51', floor: 1, spaceId: 'room1', openingId: 'door1'});
  assert.deepEqual(calls, [['floor', 0], ['space', 'room1', 'door1']]);
});

test('overview direction matches the requested southwest low view and keeps all source vertices visible', async () => {
  assert.ok(HOME_DIRECTION.x < 0 && HOME_DIRECTION.z > 0);
  const pitch = THREE.MathUtils.radToDeg(Math.asin(HOME_DIRECTION.y));
  assert.ok(pitch > 20 && pitch < 24);
  const lod2 = JSON.parse(await readFile(new URL('../public/data/lod2.json', import.meta.url), 'utf8'));
  const points = lod2.buildings.flatMap(building => building.surfaces.flatMap(surface => surface.points.map(point => new THREE.Vector3(...point))));
  const bounds = new THREE.Box3().setFromPoints(points);
  for (const aspect of [1920 / 1087, 390 / 844]) {
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 1600);
    const mock = {camera, focusBounds: () => bounds, focusPoints: () => points};
    const frame = CampusScene.prototype.fittedCamera.call(mock);
    camera.position.copy(frame.position);
    camera.lookAt(frame.target);
    camera.updateMatrixWorld();
    assert.ok(points.every(point => {
      const p = point.clone().project(camera);
      return Math.abs(p.x) < 0.84 && Math.abs(p.y) < 0.84;
    }), 'every official vertex fits at either aspect without inflating the model');
  }
});

test('every real house stack and selected floor fits between the reserved phone controls', async () => {
  const [lod2, campus] = await Promise.all(['lod2', 'campus'].map(async name =>
    JSON.parse(await readFile(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'))));
  const before = JSON.stringify(lod2);
  const interiors = {schemaVersion: 1, buildings: {}};
  for (const official of lod2.buildings) {
    const mapped = campus.buildings.find(building => building.number === official.number);
    const data = {...mapped, baseY: official.baseY, height: official.height, footprint: official.groundPolygons[0]};
    const floorElevations = getLevelElevations(interiors, data.number, data.levels, data.height);
    const record = {data, floorElevations, floorSections: floorElevations.map(elevation => floorSection(official, elevation))};
    record.targetGap = explodedFloorGap(record);
    for (const [width, height] of [[320, 568], [390, 844]]) {
      const view = Object.create(CampusScene.prototype);
      Object.assign(view, {selected: data.number, exploded: true, interiors, buildings: new Map([[data.number, record]]),
        container: {getBoundingClientRect: () => ({width, height})},
        camera: new THREE.PerspectiveCamera(42, width / height, 0.1, 1600)});
      for (const activeFloor of [null, ...floorElevations.keys()]) {
        view.activeFloor = activeFloor;
        const frame = view.fittedCamera(activeFloor === null ? new THREE.Vector3(-0.46, 0.55, 1) : new THREE.Vector3(0, 1, 0.025));
        view.camera.position.copy(frame.position);
        view.camera.lookAt(frame.target);
        view.camera.updateMatrixWorld();
        // Independently project every source section vertex, including holes.
        // This also detects accidentally omitted floors in focusPoints().
        const vertices = record.floorSections.flatMap((section, floor) =>
          activeFloor !== null && activeFloor !== floor ? [] : section.polygons.flatMap(polygon =>
            [polygon.outer, ...polygon.holes].flatMap(ring => ring.map(([x, z]) =>
              new THREE.Vector3(x, data.baseY + floorElevations[floor] + record.targetGap * floor, z)))));
        assert.ok(vertices.length > 0, `${data.number} must have a section to frame`);
        for (const vertex of vertices) {
          const projected = vertex.project(view.camera);
          const x = (projected.x + 1) * width / 2, y = (1 - projected.y) * height / 2;
          const context = `${data.number}, ${activeFloor === null ? 'stack' : `floor ${activeFloor}`}, ${width}×${height}`;
          assert.ok(projected.z > -1 && projected.z < 1, `${context}: source vertex clipped by camera`);
          assert.ok(x >= -0.001 && x <= width + 0.001, `${context}: source vertex outside horizontal viewport`);
          assert.ok(y >= 148 - 0.001, `${context}: source vertex hidden behind the top title (${y.toFixed(2)}px)`);
          assert.ok(y <= height - 196 + 0.001, `${context}: source vertex hidden behind the bottom tray (${y.toFixed(2)}px)`);
        }
      }
    }
  }
  assert.equal(JSON.stringify(lod2), before, 'camera fitting must never move official source vertices');
});

test('approved interior geometry beyond a source section is included in floor camera bounds', () => {
  const view = fixture(), building = view.buildings.get('51');
  const polygon = [[35, -8], [46, -8], [46, 5], [35, 5], [35, -8]];
  view.interiors = {schemaVersion: 1, buildings: {'51': {
    approved: true, source: 'Synthetic regression fixture only', reusePermission: 'Test geometry only', reviewedAt: '2026-01-01',
    levels: [{index: 1, label: 'Synthetic level', elevation: 2.9, source: 'Synthetic regression fixture only', reviewedAt: '2026-01-01',
      spaces: [{id: 'synthetic-extension', label: 'Synthetic space', kind: 'shared', polygon}]}],
  }}};
  assert.equal(validateInteriorData(view.interiors,
    {buildings: [...view.buildings.values()].map(record => record.data)},
    {buildings: [...view.buildings.values()].map(record => record.data)}), true);
  const before = structuredClone(building.floorSections);
  view.explode(true);
  view.setFloor(1);
  const bounds = view.focusBounds();
  assert.ok(bounds.max.x >= 46 && bounds.min.z <= -8, 'valid approved geometry must not be cropped to the older exterior section');
  for (const [width, height] of [[320, 568], [390, 844]]) {
    view.container.getBoundingClientRect = () => ({width, height});
    view.resize();
    for (const [x, z] of polygon) for (const offset of [0, 1.05]) {
      const point = new THREE.Vector3(x, building.data.baseY + building.floorElevations[1] + building.targetGap + offset, z).project(view.camera);
      const screenY = (1 - point.y) * height / 2;
      assert.ok(Math.abs(point.x) <= 1 && screenY >= 148 && screenY <= height - 196, 'approved cutaway and room polygon must fit the unobscured mobile area');
    }
  }
  view.setFloor(0);
  assert.equal(view.focusBounds().max.x, 23, 'another floor must not inherit this floor’s approved extension');
  view.interiors.buildings['51'].approved = false;
  view.setFloor(1);
  assert.equal(view.focusBounds().max.x, 23, 'unapproved geometry must not influence the public scene');
  assert.deepEqual(building.floorSections, before);
});
