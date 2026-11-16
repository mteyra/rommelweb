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
const source = lod2.buildings.find(building => building.number === '57a');
const building = campus.buildings.find(building => building.number === '57a');
const elevations = getLevelElevations(interiors, '57a', building.levels, source.height).map(y => y + source.baseY);
const details = () => createExteriorDetails(source, {house: '57a', levels: building.levels, absoluteFloorElevations: elevations});
const windows = detail => createBuildingWindowStudies(source.surfaces, elevations, source.baseY + source.height, {
  house: '57a', family: 'timber', exclusionsBySurface: detail.exclusionsBySurface, layoutsBySurface: detail.layoutsBySurface,
});
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const subtract = (a, b) => a.map((value, index) => value - b[index]);

test('Turquoise controls all photographed room faces and retains the blank entrance wings', () => {
  const detail = details(), generated = windows(detail);
  const actualWalls = source.surfaces.map((surface, index) => surface.type === 'WallSurface' ? index : null).filter(index => index !== null);
  assert.deepEqual([...detail.layoutsBySurface.keys()].map(surface => source.surfaces.indexOf(surface)).sort((a, b) => a - b), actualWalls,
    'All four supplied elevations need explicit window control, including split source walls');
  for (const index of [1, 2, 4, 5]) {
    assert.equal(generated.get(source.surfaces[index])?.patches.length || 0, 0,
      `Entrance wall ${index}: blank timber wings and gallery doors must not acquire the generic bedroom window grid`);
  }
  for (const floor of Array.from({length: 8}, (_, index) => index)) {
    for (const index of [0, 6]) {
      assert.ok(generated.get(source.surfaces[index])?.patches.some(patch => patch.floor === floor),
        `Room wall ${index}, storey ${floor}: visible dark openings must not disappear merely because the photo was taken at night`);
    }
  }
  assert.ok(generated.get(source.surfaces[9])?.patches.length > 0, 'East windows must survive its split source records');
});

test('every photo-located room window survives the separately modelled balcony and cage masks', () => {
  const detail = details(), generated = windows(detail);
  for (const feature of detail.features.filter(item => item.kind === 'photographic-window-rows')) {
    const patches = feature.sourceSurfaceIndices.flatMap(index => generated.get(source.surfaces[index])?.patches || []);
    for (const row of feature.rows) {
      assert.equal(patches.filter(patch => patch.floor === row.floor).length, row.count,
        `${feature.id}, storey ${row.floor}: a photographed window cannot be silently dropped to fit a balcony-depth estimate`);
    }
  }
});

test('the photographed rotating balcony pattern cuts both corner faces on exactly the seven upper floors', () => {
  const detail = details();
  const corners = [
    {name: 'northwest', point: [64.713, -14.562], walls: [2, 6], floors: [1, 7]},
    {name: 'southwest', point: [59.09, 7.582], walls: [0, 6], floors: [2, 5]},
    {name: 'southeast', point: [81.003, 13.166], walls: [0, 8], floors: [3, 6]},
    {name: 'northeast', point: [86.607, -9.008], walls: [4, 9], floors: [4]},
  ];
  for (const corner of corners) {
    for (let floor = 1; floor < 8; floor++) {
      const expected = corner.floors.includes(floor), middle = (elevations[floor] + (elevations[floor + 1] ?? source.baseY + source.height)) / 2;
      for (const index of corner.walls) {
        const open = (detail.exclusionsBySurface.get(source.surfaces[index]) || []).some(ring =>
          Math.min(...ring.map(point => point[1])) < middle && Math.max(...ring.map(point => point[1])) > middle &&
          ring.some(point => Math.hypot(point[0] - corner.point[0], point[2] - corner.point[1]) < 0.12));
        assert.equal(open, expected, `${corner.name}, storey ${floor}, wall ${index}: balcony openings must wrap the correct corner`);
      }
    }
  }
  const loggias = detail.features.filter(feature => feature.kind === 'corner-loggia');
  assert.equal(loggias.length, 7);
  assert.deepEqual(loggias.map(feature => feature.floor).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7]);
});

test('the central north gallery opens on every upper floor above a separate ground entry', () => {
  const detail = details(), centralWall = source.surfaces[1];
  const frame = surfaceFrame(centralWall);
  for (let floor = 1; floor < 8; floor++) {
    const bottom = elevations[floor], top = elevations[floor + 1] ?? source.baseY + source.height;
    const gallery = (detail.exclusionsBySurface.get(centralWall) || []).filter(ring => {
      const low = Math.min(...ring.map(point => point[1])), high = Math.max(...ring.map(point => point[1]));
      return low >= bottom - 0.01 && high <= top + 0.01 && high - low > 2;
    });
    assert.equal(gallery.length, 1, `Storey ${floor}: one full-width central open landing`);
    const us = gallery[0].map(point => frame.project(point)[0]);
    assert.ok(Math.max(...us) - Math.min(...us) > 6.7, 'The seven landing openings follow the actual broad north core band');
  }
  const address = (detail.signs || []).find(sign => (sign.lines || []).join(' ').includes('57a'));
  assert.ok(address, 'The main entrance carries the photographed 57a address');
  assert.ok(address.corners.every(point => point[1] > source.baseY && point[1] < elevations[1] + 0.10),
    'The address belongs above the ground entry, beneath the first landing');
});

test('the retained timber shell cannot hide the address, service plaque or concrete gallery slab edges', () => {
  const detail = details();
  const address = detail.signs.find(sign => sign.id === '57a-entrance-address');
  for (const index of [1, 5]) {
    const surface = source.surfaces[index], frame = surfaceFrame(surface);
    const original = presentExteriorSurface(surface, detail.exclusionsBySurface.get(surface));
    const signRing = address.corners.map(point => frame.lift(frame.project(point)));
    signRing.push(signRing[0]);
    const withSign = presentExteriorSurface(surface, [...detail.exclusionsBySurface.get(surface), signRing]);
    assert.ok(Math.abs(original.visibleArea - withSign.visibleArea) < 1e-8,
      `Wall ${index}: the whole address sign must face an actual shell cutout`);
  }
  const surface = source.surfaces[1], frame = surfaceFrame(surface);
  const masks = detail.exclusionsBySurface.get(surface);
  const original = presentExteriorSurface(surface, masks);
  for (let floor = 1; floor < 8; floor++) {
    const y0 = (elevations[floor] - 0.15 - frame.origin[1]) / frame.v[1];
    const y1 = (elevations[floor] + 0.025 - frame.origin[1]) / frame.v[1];
    const left = frame.minU + 0.15, right = frame.maxU - 0.15;
    const strip = [[left, y0], [right, y0], [right, y1], [left, y1], [left, y0]].map(frame.lift);
    const withSlab = presentExteriorSurface(surface, [...masks, strip]);
    assert.ok(Math.abs(original.visibleArea - withSlab.visibleArea) < 1e-8,
      `Storey ${floor}: no residual timber belt may cover the inset concrete slab front`);
  }
  const serviceSurface = source.surfaces[8], serviceFrame = surfaceFrame(serviceSurface);
  const plaque = detail.triangleLayers.detailTurquoisePlaque;
  const points = Array.from({length: plaque.length / 3}, (_, index) => serviceFrame.project(plaque.slice(index * 3, index * 3 + 3)));
  const left = Math.min(...points.map(point => point[0])), right = Math.max(...points.map(point => point[0]));
  const bottom = Math.min(...points.map(point => point[1])), top = Math.max(...points.map(point => point[1]));
  const plaqueRing = [[left, bottom], [right, bottom], [right, top], [left, top], [left, bottom]].map(serviceFrame.lift);
  const serviceMasks = detail.exclusionsBySurface.get(serviceSurface);
  const serviceWall = presentExteriorSurface(serviceSurface, serviceMasks);
  const withPlaque = presentExteriorSurface(serviceSurface, [...serviceMasks, plaqueRing]);
  // The east source fragments and full façade axis differ slightly: projecting
  // the inset plaque's complete box adds less than 0.15 mm along its edge.
  assert.ok(Math.abs(serviceWall.visibleArea - withPlaque.visibleArea) < 0.001,
    'The small turquoise service plaque must be visible beside the doorway instead of disappearing behind the retained timber');
});

test('the bicycle cage wraps the northeast ground corner and stops before the southeast service bay', () => {
  const detail = details();
  const groundMasks = index => (detail.exclusionsBySurface.get(source.surfaces[index]) || []).filter(ring =>
    Math.min(...ring.map(point => point[1])) < source.baseY + 0.25 &&
    Math.max(...ring.map(point => point[1])) < elevations[1] + 0.05);
  const width = (index, ring) => {
    const frame = surfaceFrame(source.surfaces[index]), us = ring.map(point => frame.project(point)[0]);
    return Math.max(...us) - Math.min(...us);
  };
  assert.ok(groundMasks(4).some(ring => width(4, ring) > 5.8), 'The front cage occupies the northeast wing beside the entry');
  assert.ok(groundMasks(9).some(ring => width(9, ring) > 14.5), 'The cage has the long return visible along the east elevation');
  assert.ok(groundMasks(8).reduce((sum, ring) => sum + width(8, ring), 0) < 2.0,
    'The southeast ground return remains timber with a narrow service door, rather than extending the cage around the next corner');
});

test('Turquoise creates recessed openings and removes timber from their visible face', () => {
  const detail = details(), generated = windows(detail);
  let checked = 0;
  for (const [surface, study] of generated) {
    const frame = surfaceFrame(surface);
    const architecturalMasks = detail.exclusionsBySurface.get(surface) || [];
    const cutouts = study.patches.map(patch => [...patch.corners, patch.corners[0]]);
    if (!cutouts.length) continue;
    assert.ok(study.patches.every(patch => patch.recessDepth > 0 && patch.recessDepth <= 0.3),
      'The photographed thin dark window reveals must be physical inset openings');
    const architecture = presentExteriorSurface(surface, architecturalMasks);
    const final = presentExteriorSurface(surface, [...architecturalMasks, ...cutouts]);
    // A real opening can straddle two source records on the east elevation;
    // compare the exact clipped piece, rather than double-counting its full
    // rectangle in both wall records.
    const openingArea = cutouts.reduce((sum, mask) => sum + presentExteriorSurface(surface, [mask]).removedArea, 0);
    assert.ok(Math.abs(architecture.visibleArea - final.visibleArea - openingArea) < 0.002,
      'Every window subtracts its complete area; a balcony or cage must not swallow a room opening');
    for (const patch of study.patches) {
      for (const point of patch.corners) {
        assert.ok(Math.abs(dot(subtract(point, frame.origin), frame.normal)) < 1e-7, 'Opening masks stay on the original source plane');
      }
      const low = Math.min(...patch.corners.map(point => point[1])), high = Math.max(...patch.corners.map(point => point[1]));
      assert.ok(low >= elevations[patch.floor] && high < (elevations[patch.floor + 1] ?? source.baseY + source.height),
        'Windows fit the original storey without shifting floors');
      checked++;
    }
  }
  assert.ok(checked > 80, 'Exercise the complete set of room elevations, including unlit windows');
});

class Element extends EventTarget {
  constructor() {super(); this.dataset = {}; this.style = {setProperty() {}}; this.children = [];}
  setAttribute() {}
  appendChild(child) {this.children.push(child);}
}

test('every Turquoise recessed window remains selectable at its near facade and the eight floor groups stay separate', t => {
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
    const model = view.buildings.get('57a');
    assert.equal(model.floorGroups.length, 8);
    assert.equal(model.detailGroup.parent, model.exterior, 'Exterior recesses disappear with the folded shell');
    assert.ok(model.floorGroups.every(group => !group.visible));
    let checked = 0;
    for (const [surface, study] of windows(details())) {
      const normal = new Vector3(...surfaceFrame(surface).normal);
      for (const patch of study.patches) {
        const center = patch.corners.reduce((sum, point) => sum.add(new Vector3(...point)), new Vector3()).multiplyScalar(0.25);
        view.camera.position.copy(center).addScaledVector(normal, 0.5);
        view.camera.lookAt(center);
        view.camera.updateMatrixWorld(true);
        const hit = view.pickAt(50, 50), label = `wall ${source.surfaces.indexOf(surface)}, storey ${patch.floor}`;
        assert.ok(hit, label);
        assert.equal(hit.object.userData.house, '57a', label);
        assert.equal(hit.object.userData.floor, null, label);
        assert.ok(hit.distance < 0.8, `${label}: clicks cannot pass through the inset glass to a far wall`);
        checked++;
      }
    }
    assert.ok(checked > 80);
    assert.equal(JSON.stringify({source, elevations, interiors, studies}), snapshot, 'Creating and selecting the exterior cannot mutate its source or interior models');
    t.diagnostic(`${checked} room-window rays hit Turquoise at the near facade.`);
  } finally {
    view.scene.traverse(object => {
      object.geometry?.dispose();
      for (const material of [object.material].flat().filter(Boolean)) material.dispose();
    });
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
});
