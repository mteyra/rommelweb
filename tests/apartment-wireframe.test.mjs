import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {apartmentConcept} from '../src/apartment-concepts.js';
import {createApartmentWireframe} from '../src/apartment-wireframe.js';
import {INTERIOR_CUT_HEIGHT} from '../src/interior-wireframe.js';
import {CampusScene} from '../src/scene.js';
import {getLevelElevations} from '../src/interiors.js';
import {getDisplayLevel} from '../src/interior-studies.js';

const read = async name => JSON.parse(await readFile(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8'));
const [studies, lod2] = await Promise.all(['interior-studies', 'lod2'].map(read));
const approved = {schemaVersion: 1, buildings: {}};
const rectangle = (x, z, width, depth) => [[x, z], [x + width, z], [x + width, z + depth], [x, z + depth], [x, z]];
const near = (a, b, epsilon = 1e-5) => assert.ok(Math.abs(a - b) < epsilon, `${a} ≈ ${b}`);
const ringArea = ring => Math.abs(ring.slice(1).reduce((sum, b, i) => sum + ring[i][0] * b[1] - b[0] * ring[i][1], 0)) / 2;
const meshArea = mesh => {
  const p = mesh.geometry.attributes.position;
  let total = 0;
  for (let i = 0; i < p.count; i += 3) total += Math.abs(
    (p.getX(i + 1) - p.getX(i)) * (p.getZ(i + 2) - p.getZ(i)) -
    (p.getX(i + 2) - p.getX(i)) * (p.getZ(i + 1) - p.getZ(i)),
  ) / 2;
  return total;
};
const points = object => {
  const p = object.geometry.attributes.position;
  return Array.from({length: p.count}, (_, i) => [p.getX(i), p.getY(i), p.getZ(i)]);
};
const dispose = group => group.traverse(object => {
  object.geometry?.dispose();
  for (const material of [object.material].flat().filter(Boolean)) material.dispose();
});

function synthetic() {
  const room = {id: 'example-room', kind: 'room', confidence: 'estimated', label: 'Room example', polygon: rectangle(20, -15, 4, 7.2)};
  const other = {...room, id: 'other-room', polygon: rectangle(55, 30, 4, 7.2)};
  const level = {
    index: 2, isStudy: true, spaces: [room, other], floorOutline: [{outer: rectangle(15, -20, 50, 65)}],
    doors: [
      {id: 'own-door', spaceId: room.id, label: 'Own entrance', segment: [[20.55, -15], [21.45, -15]]},
      {id: 'other-door', spaceId: other.id, label: 'Other entrance', segment: [[55.55, 30], [56.45, 30]]},
    ],
    windows: [
      {id: 'own-window', spaceId: room.id, segment: [[21.5, -7.8], [22.5, -7.8]]},
      {id: 'other-window', spaceId: other.id, segment: [[56.5, 37.2], [57.5, 37.2]]},
    ],
    wallBands: [{id: 'other-wall', polygon: rectangle(55, 30, 0.3, 7.2)}],
  };
  return {level, room};
}

function assertRoomGeometry(wireframe, concept, room, house = '55', floor = 2) {
  assert.deepEqual(wireframe.group.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(wireframe.group.quaternion.toArray(), [0, 0, 0, 1]);
  assert.equal(wireframe.group.userData.role, 'apartment-layout-concept');
  assert.equal(wireframe.group.userData.spaceId, room.id);
  const floorMesh = wireframe.pickables.filter(object => object.userData.role === 'interior-space');
  assert.equal(floorMesh.length, 1, 'isolated room has one physical floor hit region');
  near(meshArea(floorMesh[0]), ringArea(room.polygon) - (room.holes || []).reduce((sum, ring) => sum + ringArea(ring), 0), 0.0001);
  assert.ok(wireframe.pickables.every(object => object.userData.spaceId === room.id &&
    object.userData.house === house && object.userData.floor === floor), 'no neighbouring room can intercept an apartment click');
  const linework = wireframe.group.children.filter(object => object.userData.role === 'concept-linework');
  for (const item of concept.items) {
    const height = item.kind === 'bathroom' ? 0.06 : Math.min(item.height, INTERIOR_CUT_HEIGHT);
    // Locate each original, unscaled footprint in an actual rendered line mesh.
    // The bath is a low footprint with separately open partition linework.
    // Pillow seams and capped cupboard heights cannot substitute for corners.
    assert.ok(linework.some(object => {
      const vertices = points(object);
      return item.polygon.slice(0, -1).every(([x, z]) => vertices.some(point =>
        Math.abs(point[0] - x) < 1e-5 && Math.abs(point[1] - height) < 1e-5 && Math.abs(point[2] - z) < 1e-5));
    }), `${item.kind}: rendered footprint retains every campus-metre corner`);
  }
  wireframe.group.traverse(object => {
    if (!object.geometry?.attributes.position) return;
    assert.ok(points(object).flat().every(Number.isFinite));
  });
}

test('apartment cutaway isolates its room, entrance and window without scaling fixed furniture or mutating the floor', () => {
  const {level, room} = synthetic(), before = JSON.stringify(level);
  const concept = apartmentConcept(level, room);
  assert.equal(concept.status, 'concept');
  assert.ok(concept.items.some(item => item.kind === 'bathroom'), 'wide fixture exercises service partitions too');
  const wireframe = createApartmentWireframe(level, room, concept, {house: '55', floor: 2});
  assertRoomGeometry(wireframe, concept, room);
  assert.deepEqual(wireframe.pickables.filter(object => object.userData.openingId).map(object => object.userData.openingId), ['own-door']);
  const windows = wireframe.group.children.find(object => object.userData.role === 'resident-window-symbols');
  assert.deepEqual(windows.userData.windowIds, ['own-window']);
  assert.ok(wireframe.group.children.every(object => object.userData.wallBandId !== 'other-wall'));
  assert.equal(wireframe.labels.length, concept.items.length);
  assert.ok(wireframe.labels.every(label => label.position.every(Number.isFinite)));
  assert.equal(JSON.stringify(level), before);
  dispose(wireframe.group);
});

test('bath footprint stays complete while the raised route-facing side remains open', () => {
  const {level, room} = synthetic(), concept = apartmentConcept(level, room);
  assert.equal(concept.fit.layout, 'dogleg-service');
  const bath = concept.items.find(item => item.kind === 'bathroom');
  const wireframe = createApartmentWireframe(level, room, concept, {house: '55', floor: 2});
  const segments = wireframe.group.children.filter(object => object.userData.role === 'concept-linework')
    .flatMap(object => {
      const vertices = points(object);
      return Array.from({length: vertices.length / 2}, (_, i) => vertices.slice(i * 2, i * 2 + 2));
    });
  const matches = (actual, expected) => Math.hypot(...actual.map((value, i) => value - expected[i])) < 1e-5;
  const hasEdge = (a, b, height) => {
    const start = [a[0], height, a[1]], end = [b[0], height, b[1]];
    return segments.some(([p, q]) => matches(p, start) && matches(q, end) || matches(p, end) && matches(q, start));
  };
  for (let i = 1; i < bath.polygon.length; i++) {
    assert.ok(hasEdge(bath.polygon[i - 1], bath.polygon[i], 0.06), 'all four footprint edges retain the chosen bath size');
  }
  for (const [a, b] of concept.partitions) {
    assert.ok(hasEdge(a, b, INTERIOR_CUT_HEIGHT), 'each supplied sample partition is raised');
  }
  const [a, b] = [bath.polygon[3], bath.polygon[0]];
  const delta = [b[0] - a[0], b[1] - a[1]], length = Math.hypot(...delta);
  const along = p => ((p[0] - a[0]) * delta[0] + (p[2] - a[1]) * delta[1]) / length;
  const distance = p => Math.abs(delta[0] * (p[2] - a[1]) - delta[1] * (p[0] - a[0])) / length;
  assert.ok(!segments.some(([p, q]) => {
    if (Math.min(p[1], q[1]) <= 0.061 || distance(p) > 1e-5 || distance(q) > 1e-5) return false;
    const offsets = [along(p), along(q)].sort((x, y) => x - y);
    return Math.min(length, offsets[1]) - Math.max(0, offsets[0]) > 0.01;
  }), 'no raised full-box or split edge silently closes the route-facing opening');
  dispose(wireframe.group);
});

test('an entrance referencing the room as toSpaceId stays visible and picks the focused room without changing the source record', () => {
  const {level, room} = synthetic();
  level.doors[0] = {...level.doors[0], spaceId: 'hall-owner', toSpaceId: room.id};
  const before = JSON.stringify(level), concept = apartmentConcept(level, room);
  assert.equal(concept.status, 'concept');
  const wireframe = createApartmentWireframe(level, room, concept, {house: '55', floor: 2});
  assertRoomGeometry(wireframe, concept, room);
  const opening = wireframe.pickables.find(object => object.userData.openingId === 'own-door');
  assert.ok(opening, 'concept API and renderer must agree on either doorway endpoint');
  assert.equal(opening.userData.spaceId, room.id);
  assert.equal(JSON.stringify(level), before);
  dispose(wireframe.group);
});

test('all current House 55 room concepts render finite, unscaled geometry on all three floors', () => {
  const before = JSON.stringify(studies);
  for (const source of studies.buildings['55'].levels) {
    const level = getDisplayLevel(approved, studies, '55', source.index);
    const rooms = level.spaces.filter(space => space.kind === 'room');
    assert.equal(rooms.length, source.index === 2 ? 20 : 16);
    for (const room of rooms) {
      const concept = apartmentConcept(level, room);
      assert.equal(concept.status, 'concept', `${source.label}, ${room.shortLabel}: ${JSON.stringify(concept.diagnostics)}`);
      const wireframe = createApartmentWireframe(level, room, concept, {house: '55', floor: source.index});
      assertRoomGeometry(wireframe, concept, room, '55', source.index);
      dispose(wireframe.group);
    }
  }
  assert.equal(JSON.stringify(studies), before);
});

function element() {
  return {
    hidden: false, removed: false, classList: {toggle() {}},
    remove() {this.removed = true; this.parent?.children.splice(this.parent.children.indexOf(this), 1);},
  };
}

function sceneFixture(width = 1440, height = 1000) {
  const view = Object.create(CampusScene.prototype), scene = new THREE.Scene();
  const records = ['55', '51'].map(number => {
    const model = lod2.buildings.find(building => building.number === number);
    const data = {number, baseY: model.baseY, height: model.height, footprint: model.groundPolygons[0], levels: 3};
    const group = new THREE.Group(), exterior = new THREE.Group();
    group.add(exterior); scene.add(group);
    exterior.visible = number !== '55';
    const floorGroups = Array.from({length: 3}, () => new THREE.Group());
    const interiorGroups = floorGroups.map(floorGroup => {
      group.add(floorGroup);
      const interior = new THREE.Group();
      floorGroup.add(interior);
      return interior;
    });
    return {
      data, group, exterior, floorGroups, interiorGroups, currentGap: 12, targetGap: 12,
      floorElevations: getLevelElevations(approved, number, 3, model.height),
      floorSections: Array.from({length: 3}, () => ({polygons: [{outer: data.footprint, holes: []}]})),
      label: element(), facadeMaterials: [],
    };
  });
  const labelsElement = {children: [], appendChild(el) {el.parent = this; this.children.push(el);}};
  Object.assign(view, {
    scene, studies: structuredClone(studies), interiors: approved, lod2,
    selected: '55', activeFloor: 2, exploded: true, reduced: true, themeMix: 0,
    buildings: new Map(records.map(record => [record.data.number, record])),
    labelsElement, labels: [{el: element(), type: 'room', number: '55', floor: 2}, {el: element(), type: 'house', number: '51'}],
    dimensionLayer: {style: {}}, contextGroup: new THREE.Group(), contextMix: 0,
    camera: new THREE.PerspectiveCamera(42, width / height, 0.1, 1600),
    container: {getBoundingClientRect: () => ({width, height})},
    renderer: {setClearColor() {}, setSize() {}, domElement: {getBoundingClientRect: () => ({left: 0, top: 0, width, height})}},
    raycaster: new THREE.Raycaster(), pointer: new THREE.Vector2(),
    applyBuildingAppearance() {},
  });
  view.controls = {target: new THREE.Vector3(), minDistance: 20, maxDistance: 850,
    update() {view.camera.lookAt(this.target); view.camera.updateMatrixWorld();}};
  view.camera.position.set(-50, 40, 95);
  view.controls.update();
  view.updateViewVisibility();
  return view;
}

function withDocument(callback) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {configurable: true, value: {createElement: element}});
  try {return callback();} finally {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
}

test('room focus isolates rendering and picking; replacement and floor return dispose only the concept and restore floor navigation', () => withDocument(() => {
  const view = sceneFixture(), building = view.buildings.get('55');
  const level = getDisplayLevel(approved, studies, '55', 2);
  const rooms = level.spaces.filter(space => space.kind === 'room');
  const before = JSON.stringify(view.studies);
  assert.ok(view.focusApartment(rooms[0].id));
  const first = view.apartment;
  assert.equal(first.group.parent, view.scene);
  assert.equal(first.group.position.y, building.data.baseY + building.floorElevations[2] + 2 * building.targetGap);
  assert.ok(building.floorGroups.every(group => !group.visible));
  assert.equal(view.buildings.get('51').group.visible, false);
  assert.equal(view.controls.minDistance, 2);
  assert.ok(view.labels.filter(label => label.type !== 'concept').every(label => label.el.hidden));
  assert.ok(view.labels.filter(label => label.type === 'concept').every(label => view.labelInCurrentView(label)));
  let picked;
  view.raycaster.intersectObjects = objects => {picked = objects; return [];};
  view.pickAt(100, 100);
  assert.deepEqual(picked, first.pickables);
  assert.ok(picked.every(object => object.userData.spaceId === rooms[0].id));
  const disposed = new Map(), firstLabels = view.labels.filter(label => label.type === 'concept').map(label => label.el);
  first.group.traverse(object => {
    for (const resource of [object.geometry, ...[object.material].flat()].filter(Boolean)) {
      if (disposed.has(resource)) continue;
      disposed.set(resource, 0);
      resource.addEventListener('dispose', () => disposed.set(resource, disposed.get(resource) + 1));
    }
  });
  assert.equal(view.focusApartment('absent-room'), null);
  assert.equal(view.apartment, first, 'an invalid focus must not discard the active room');
  assert.ok(view.focusApartment(rooms[1].id));
  assert.equal(first.group.parent, null);
  assert.ok([...disposed.values()].every(count => count === 1), 'old concept GPU resources are released once');
  assert.ok(firstLabels.every(label => label.removed));
  assert.equal(view.scene.children.filter(group => group.userData.role === 'apartment-layout-concept').length, 1);
  view.setFloor(1);
  assert.equal(view.apartment, null);
  assert.equal(view.controls.minDistance, 20);
  assert.equal(view.labels.some(label => label.type === 'concept'), false);
  assert.deepEqual(building.floorGroups.map(group => group.visible), [false, true, false]);
  assert.equal(JSON.stringify(view.studies), before);
}));

test('keyboard zoom respects the close room limit and leaving the house clears the concept', () => withDocument(() => {
  const view = sceneFixture();
  const room = studies.buildings['55'].levels.find(level => level.index === 2).spaces.find(space => space.kind === 'room');
  view.focusApartment(room.id);
  const before = view.camera.position.distanceTo(view.controls.target);
  assert.ok(before < 20, 'desktop room frame exercises the previous campus-only zoom clamp');
  view.zoom(0.85);
  near(view.camera.position.distanceTo(view.controls.target), before * 0.85);
  view.zoom(0.0001);
  near(view.camera.position.distanceTo(view.controls.target), view.controls.minDistance);
  const group = view.apartment.group;
  view.select('51', false);
  assert.equal(view.apartment, null);
  assert.equal(group.parent, null);
  assert.equal(view.controls.minDistance, 20);
  assert.equal(view.selected, '51');
  assert.equal(view.exploded, false);
  assert.ok([...view.buildings.values()].every(building => building.group.visible && building.exterior.visible));
}));

test('room camera fits every current top-room envelope on desktop and phones without moving source or furniture geometry', () => withDocument(() => {
  const rooms = studies.buildings['55'].levels.find(level => level.index === 2).spaces.filter(space => space.kind === 'room');
  for (const [width, height] of [[1440, 1000], [390, 844], [320, 568]]) {
    const view = sceneFixture(width, height), sourceBefore = JSON.stringify(view.studies);
    for (const room of rooms) {
      view.focusApartment(room.id);
      const geometryBefore = view.apartment.group.children.filter(object => object.geometry)
        .map(object => Array.from(object.geometry.attributes.position.array));
      const framePoints = view.focusPoints();
      const top = width <= 700 ? Math.min(138, height * 0.27) : 140;
      const bottom = width <= 700 ? Math.min(154, height * 0.35) : 150;
      for (const point of framePoints) {
        const projected = point.clone().project(view.camera);
        const x = (projected.x + 1) * width / 2, y = (1 - projected.y) * height / 2;
        assert.ok(projected.z > -1 && projected.z < 1);
        assert.ok(x >= 0 && x <= width && y >= top && y <= height - bottom,
          `${room.shortLabel}, ${width}×${height}: room must fit around the controls`);
      }
      view.resize();
      assert.deepEqual(view.apartment.group.scale.toArray(), [1, 1, 1]);
      assert.deepEqual(view.apartment.group.children.filter(object => object.geometry)
        .map(object => Array.from(object.geometry.attributes.position.array)), geometryBefore);
    }
    assert.equal(JSON.stringify(view.studies), sourceBefore);
    view.clearApartment();
  }
}));
