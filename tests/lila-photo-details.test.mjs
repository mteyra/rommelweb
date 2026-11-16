import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Scene, PerspectiveCamera, Raycaster, Vector2, Vector3, BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial, DoubleSide} from 'three';
import {createExteriorDetails} from '../src/exterior-details.js';
import {createBuildingWindowStudies} from '../src/windows.js';
import {surfaceFrame} from '../src/facade.js';
import {presentExteriorSurface} from '../src/exterior-presentation.js';
import {getLevelElevations} from '../src/interiors.js';
import {CampusScene} from '../src/scene.js';

const read = name => readFile(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8').then(JSON.parse);
const [campus, lod2, interiors, studies] = await Promise.all(['campus', 'lod2', 'interiors', 'interior-studies'].map(read));
const source = lod2.buildings.find(building => building.number === '53a');
const building = campus.buildings.find(building => building.number === '53a');
const elevations = getLevelElevations(interiors, '53a', building.levels, source.height).map(y => y + source.baseY);
const details = () => createExteriorDetails(source, {house: '53a', levels: building.levels, absoluteFloorElevations: elevations});
const windows = detail => createBuildingWindowStudies(source.surfaces, elevations, source.baseY + source.height, {
  house: '53a', family: 'timber', exclusionsBySurface: detail.exclusionsBySurface, layoutsBySurface: detail.layoutsBySurface,
});
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const subtract = (a, b) => a.map((value, index) => value - b[index]);

// A window straddling two retained LoD2 fragments is still one opening.
function physicalCenters(generated, indices, floor) {
  const centers = [];
  for (const index of indices) {
    for (const patch of generated.get(source.surfaces[index])?.patches || []) {
      if (patch.floor !== floor) continue;
      const center = [0, 2].map(axis => patch.corners.reduce((sum, point) => sum + point[axis], 0) / patch.corners.length);
      if (!centers.some(other => Math.hypot(center[0] - other[0], center[1] - other[1]) < 0.025)) centers.push(center);
    }
  }
  return centers;
}

test('all photographed Lila elevations have explicit rows and the entrance wings stay windowless', () => {
  const detail = details(), generated = windows(detail);
  const walls = source.surfaces.map((surface, index) => surface.type === 'WallSurface' ? index : null).filter(index => index !== null);
  assert.deepEqual([...detail.layoutsBySurface.keys()].map(surface => source.surfaces.indexOf(surface)).sort((a, b) => a - b), walls);
  for (const index of walls) {
    const layout = detail.layoutsBySurface.get(source.surfaces[index]);
    assert.equal(layout.replace, true, `Wall ${index} must not acquire generic fallback windows`);
    assert.deepEqual(layout.rows.map(row => row.floor).sort((a, b) => a - b), [0, 1, 2, 3, 4]);
  }
  for (const index of [1, 3, 4, 9]) {
    assert.equal(generated.get(source.surfaces[index])?.patches.length || 0, 0,
      `Entrance wall ${index}: blank timber, open landings and cage have no ordinary room-window grid`);
  }
  assert.equal(physicalCenters(generated, [7], 0).length, 0, 'The north bicycle cage is not a ground-floor apartment row');
  for (const feature of detail.features.filter(item => item.kind === 'photographic-window-rows')) {
    for (const row of feature.rows) {
      assert.equal(physicalCenters(generated, feature.sourceSurfaceIndices, row.floor).length, row.count,
        `${feature.id}, floor ${row.floor}: an observed opening cannot be silently swallowed by a balcony estimate`);
    }
  }
});

test('four corner balconies rotate through the four upper floors, including the southwest first floor', () => {
  const detail = details();
  const corners = [
    {name: 'southwest', point: [0.996, -63.869], walls: [8, 2], floor: 1},
    {name: 'northeast', point: [28.636, -80.206], walls: [3, 7], floor: 2},
    {name: 'northwest', point: [6.564, -85.824], walls: [5, 7], floor: 3},
    {name: 'southeast', point: [23.079, -58.260], walls: [9, 2], floor: 4},
  ];
  const loggias = detail.features.filter(feature => feature.kind === 'corner-loggia');
  assert.equal(loggias.length, 4, 'The resident photos reveal a fourth balcony missing from the earlier model');
  assert.deepEqual(loggias.map(feature => feature.floor).sort((a, b) => a - b), [1, 2, 3, 4]);
  for (const corner of corners) {
    for (let floor = 1; floor < 5; floor++) {
      const middle = (elevations[floor] + (elevations[floor + 1] ?? source.baseY + source.height)) / 2;
      for (const index of corner.walls) {
        const open = (detail.exclusionsBySurface.get(source.surfaces[index]) || []).some(ring =>
          Math.min(...ring.map(point => point[1])) < middle && Math.max(...ring.map(point => point[1])) > middle &&
          ring.some(point => Math.hypot(point[0] - corner.point[0], point[2] - corner.point[1]) < 0.12));
        assert.equal(open, floor === corner.floor, `${corner.name}, floor ${floor}, wall ${index}`);
      }
    }
  }
});

test('the entrance has four open upper galleries and its address remains visible below them', () => {
  const detail = details(), centralWall = source.surfaces[4], frame = surfaceFrame(centralWall);
  for (let floor = 1; floor < 5; floor++) {
    const middle = (elevations[floor] + (elevations[floor + 1] ?? source.baseY + source.height)) / 2;
    const openings = (detail.exclusionsBySurface.get(centralWall) || []).filter(ring =>
      Math.min(...ring.map(point => point[1])) < middle && Math.max(...ring.map(point => point[1])) > middle);
    assert.ok(openings.some(ring => {
      const us = ring.map(point => frame.project(point)[0]);
      return Math.max(...us) - Math.min(...us) > 6.5;
    }), `Floor ${floor}: the broad central landing must be cut out of the retained timber shell`);
  }
  const address = (detail.signs || []).find(sign => (sign.lines || []).join(' ').includes('53a'));
  assert.ok(address, 'The photographed entry requires the 53a address above the ground doors');
  assert.ok(address.corners.every(point => point[1] > source.baseY && point[1] < elevations[1] + 0.1));
  const signRing = address.corners.map(point => frame.lift(frame.project(point)));
  signRing.push(signRing[0]);
  const masks = detail.exclusionsBySurface.get(centralWall) || [];
  const before = presentExteriorSurface(centralWall, masks);
  const after = presentExteriorSurface(centralWall, [...masks, signRing]);
  assert.ok(Math.abs(before.visibleArea - after.visibleArea) < 0.003,
    'The address must face a real display aperture; retained timber must not obscure it');
  const start = [23.079, 0, -58.260], end = [28.636, 0, -80.206];
  const delta = subtract(end, start), length = Math.hypot(...delta), direction = delta.map(value => value / length);
  const slopes = (detail.segmentLayers.detailMetal || []).filter(segment => {
    const positions = segment.map(point => dot(subtract(point, start), direction));
    return positions.every(value => value > 8.0 && value < 14.5) &&
      segment.every(point => point[1] > elevations[1] + 0.1 && point[1] < source.baseY + source.height - 0.3) &&
      Math.abs(segment[0][1] - segment[1][1]) > 0.4 && Math.abs(positions[0] - positions[1]) > 0.4;
  });
  assert.equal(slopes.length, 0, 'The photos show level galleries; the old invented diagonal stair rails must be removed');
});

test('the bicycle storage wraps the northeast corner with a long north side and shorter entrance-side return', () => {
  const detail = details();
  const groundMasks = index => (detail.exclusionsBySurface.get(source.surfaces[index]) || []).filter(ring =>
    Math.min(...ring.map(point => point[1])) < source.baseY + 0.25 &&
    Math.max(...ring.map(point => point[1])) < elevations[1] + 0.05);
  const width = (index, ring) => {
    const frame = surfaceFrame(source.surfaces[index]), us = ring.map(point => frame.project(point)[0]);
    return Math.max(...us) - Math.min(...us);
  };
  assert.ok(groundMasks(7).some(ring => width(7, ring) > 21.5), 'The mesh cage extends along almost the whole north ground elevation');
  assert.ok(groundMasks(3).some(ring => width(3, ring) > 5.5), 'The cage wraps the entrance-side corner beside the central doorway');
  assert.equal(groundMasks(9).length, 0, 'The opposite solid entrance wing must retain its timber ground façade');
});

test('the complete entrance address faces the viewer without being covered by its concrete slab or header backing', () => {
  const detail = details(), sign = detail.signs.find(item => item.id === '53a-entrance-address');
  const [a, b, , d] = sign.corners.map(point => new Vector3(...point));
  const horizontal = b.clone().sub(a), vertical = d.clone().sub(a);
  const normal = horizontal.clone().cross(vertical).normalize();
  if (normal.dot(new Vector3(...surfaceFrame(source.surfaces[4]).normal)) < 0) normal.negate();
  const material = new MeshBasicMaterial({side: DoubleSide});
  const meshes = Object.entries(detail.triangleLayers).map(([role, positions]) => {
    const mesh = new Mesh(new BufferGeometry().setAttribute('position', new Float32BufferAttribute(positions, 3)), material);
    mesh.userData.role = role;
    mesh.updateMatrixWorld(true);
    return mesh;
  });
  try {
    const ray = new Raycaster();
    for (const x of [0.03, 0.25, 0.50, 0.75, 0.97]) {
      for (const y of [0.03, 0.50, 0.97]) {
        const point = a.clone().addScaledVector(horizontal, x).addScaledVector(vertical, y);
        ray.set(point.clone().addScaledVector(normal, 0.5), normal.clone().negate());
        const covering = ray.intersectObjects(meshes).filter(hit => hit.distance <= 0.502);
        assert.equal(covering.length, 0,
          `Address sample ${x},${y} is covered by ${covering.map(hit => hit.object.userData.role).join(', ')}`);
      }
    }
  } finally {
    meshes.forEach(mesh => mesh.geometry.dispose());
    material.dispose();
  }
});

test('room openings are recessed, remain within the original storeys and subtract their full visible area', () => {
  const detail = details(), generated = windows(detail);
  let checked = 0;
  for (const [surface, study] of generated) {
    const frame = surfaceFrame(surface);
    const masks = detail.exclusionsBySurface.get(surface) || [];
    const cutouts = study.patches.map(patch => [...patch.corners, patch.corners[0]]);
    if (!cutouts.length) continue;
    assert.ok(study.patches.every(patch => patch.recessDepth > 0 && patch.recessDepth <= 0.3));
    const architecture = presentExteriorSurface(surface, masks);
    const final = presentExteriorSurface(surface, [...masks, ...cutouts]);
    const openingArea = cutouts.reduce((sum, mask) => sum + presentExteriorSurface(surface, [mask]).removedArea, 0);
    assert.ok(Math.abs(architecture.visibleArea - final.visibleArea - openingArea) < 0.003,
      'No balcony or cage mask may consume part of a room opening');
    for (const patch of study.patches) {
      for (const point of patch.corners) {
        assert.ok(Math.abs(dot(subtract(point, frame.origin), frame.normal)) < 1e-7, 'Window masks stay on the source plane');
      }
      const low = Math.min(...patch.corners.map(point => point[1])), high = Math.max(...patch.corners.map(point => point[1]));
      assert.ok(low >= elevations[patch.floor] && high < (elevations[patch.floor + 1] ?? source.baseY + source.height),
        'Photo windows cannot change the retained floor elevations');
      checked++;
    }
  }
  assert.ok(checked > 50, 'Exercise dark and lit openings across the three room façades');
});

class Element extends EventTarget {
  constructor() {super(); this.dataset = {}; this.style = {setProperty() {}}; this.children = [];}
  setAttribute() {}
  appendChild(child) {this.children.push(child);}
}

test('the exterior is selectable at every window while all five floor groups and source models remain unchanged', t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {configurable: true, value: {createElement: () => new Element()}});
  const snapshot = JSON.stringify({source, elevations, interiors, studies});
  const view = Object.assign(Object.create(CampusScene.prototype), {
    lod2, interiors, studies, scene: new Scene(), buildings: new Map(), labelsElement: new Element(), labels: [],
    camera: new PerspectiveCamera(45, 1, 0.01, 200), selected: null, activeFloor: null,
    pointer: new Vector2(), raycaster: new Raycaster(),
    renderer: {domElement: {getBoundingClientRect: () => ({left: 0, top: 0, width: 100, height: 100})}},
  });
  try {
    view.makeBuilding({...building, baseY: source.baseY, height: source.height, footprint: source.groundPolygons[0]});
    view.scene.updateMatrixWorld(true);
    const model = view.buildings.get('53a');
    assert.equal(model.floorGroups.length, 5);
    assert.equal(model.detailGroup.parent, model.exterior, 'Exterior additions hide with the folded building');
    assert.ok(model.floorGroups.every(group => !group.visible));
    let checked = 0;
    for (const [surface, study] of windows(details())) {
      const normal = new Vector3(...surfaceFrame(surface).normal);
      for (const patch of study.patches) {
        const center = patch.corners.reduce((sum, point) => sum.add(new Vector3(...point)), new Vector3()).multiplyScalar(0.25);
        view.camera.position.copy(center).addScaledVector(normal, 0.5);
        view.camera.lookAt(center);
        view.camera.updateMatrixWorld(true);
        const hit = view.pickAt(50, 50), label = `wall ${source.surfaces.indexOf(surface)}, floor ${patch.floor}`;
        assert.ok(hit, label);
        assert.equal(hit.object.userData.house, '53a', label);
        assert.equal(hit.object.userData.floor, null, label);
        assert.ok(hit.distance < 0.8, `${label}: clicks must hit the near façade through its aperture`);
        checked++;
      }
    }
    assert.ok(checked > 50);
    assert.equal(JSON.stringify({source, elevations, interiors, studies}), snapshot);
    t.diagnostic(`${checked} room-window rays hit Lila at the near façade.`);
  } finally {
    view.scene.traverse(object => {
      object.geometry?.dispose();
      for (const material of [object.material].flat().filter(Boolean)) material.dispose();
    });
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
});
