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
const source = lod2.buildings.find(building => building.number === '55a');
const building = campus.buildings.find(building => building.number === '55a');
const elevations = getLevelElevations(interiors, '55a', building.levels, source.height).map(y => y + source.baseY);
const details = () => createExteriorDetails(source, {house: '55a', levels: building.levels, absoluteFloorElevations: elevations});
const windows = detail => createBuildingWindowStudies(source.surfaces, elevations, source.baseY + source.height, {
  house: '55a', family: 'timber', exclusionsBySurface: detail.exclusionsBySurface, layoutsBySurface: detail.layoutsBySurface,
});
const groundMasks = (detail, index) => (detail.exclusionsBySurface.get(source.surfaces[index]) || []).filter(ring =>
  Math.min(...ring.map(point => point[1])) < source.baseY + 0.25 &&
  Math.max(...ring.map(point => point[1])) < elevations[1] + 0.05);
const span = (index, ring) => {
  const frame = surfaceFrame(source.surfaces[index]), us = ring.map(point => frame.project(point)[0]);
  return Math.max(...us) - Math.min(...us);
};
const center = ring => ring.reduce((sum, point) => sum.map((value, axis) => value + point[axis] / ring.length), [0, 0, 0]);
const distanceXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const uniqueXZ = points => points.filter((point, index) => !points.slice(0, index).some(other => distanceXZ(point, other) < 0.02));

test('Grau explicitly controls all four elevations and leaves the north timber wings windowless', () => {
  const detail = details(), generated = windows(detail);
  const walls = source.surfaces.filter(surface => surface.type === 'WallSurface');
  assert.equal(walls.length, 8);
  for (const surface of walls) {
    const layout = detail.layoutsBySurface.get(surface);
    assert.equal(layout?.replace, true, `Source ${source.surfaces.indexOf(surface)} must not fall back to a generic window grid`);
  }
  assert.deepEqual([...detail.photoSurfaceIndices].sort((a, b) => a - b), [0, 2, 3, 4, 5, 6, 7, 9]);
  for (const index of [0, 2, 4, 6]) {
    const layout = detail.layoutsBySurface.get(source.surfaces[index]);
    assert.equal(layout.rows.reduce((sum, row) => sum + row.centers.length, 0), 0,
      `North wall ${index}: the photographs show timber or separately modeled gallery openings`);
    assert.equal(generated.get(source.surfaces[index])?.patches.length || 0, 0);
  }
  assert.equal(generated.get(source.surfaces[7])?.patches.filter(patch => patch.floor === 0).length || 0, 0,
    'The full east ground floor is bicycle storage, with no residential-window grid');
  assert.ok(generated.get(source.surfaces[9])?.patches.some(patch => patch.floor === 0),
    'The opposite west ground elevation retains its photographed tall room windows');
});

test('Grau requested window centers survive cutouts and remain continuous across split south records', () => {
  const detail = details(), generated = windows(detail);
  for (const indices of [[7], [9], [3, 5]]) {
    for (let floor = 0; floor < building.levels; floor++) {
      const requested = uniqueXZ(indices.flatMap(index => {
        const surface = source.surfaces[index], frame = surfaceFrame(surface);
        const row = detail.layoutsBySurface.get(surface).rows.find(item => item.floor === floor);
        return (row?.centers || []).map(value => frame.lift([value, 0]));
      }));
      const actual = uniqueXZ(indices.flatMap(index =>
        (generated.get(source.surfaces[index])?.patches || []).filter(patch => patch.floor === floor).map(patch => center(patch.corners))));
      const label = `Grau source ${indices.join('/')}, floor ${floor}`;
      assert.equal(actual.length, requested.length, `${label}: no photo window may be lost or added by a wall split or recess`);
      for (const point of requested) {
        assert.ok(actual.some(other => distanceXZ(point, other) < 0.02), `${label}: preserve the requested world position`);
      }
    }
  }
});

test('Grau has the five photographed corner loggias and cuts both walls only at the correct floors', () => {
  const detail = details();
  const corners = [
    {name: 'northwest', point: [12.881, 0, -30.699], walls: [2, 9], floors: [1]},
    {name: 'southwest', point: [19.092, 0, -8.705], walls: [5, 9], floors: [2, 5]},
    {name: 'southeast', point: [40.872, 0, -14.857], walls: [3, 7], floors: [3]},
    {name: 'northeast', point: [34.692, 0, -36.870], walls: [6, 7], floors: [4]},
  ];
  const loggias = detail.features.filter(feature => feature.kind === 'corner-loggia');
  assert.equal(loggias.length, 5);
  assert.deepEqual(loggias.map(feature => feature.floor).sort((a, b) => a - b), [1, 2, 3, 4, 5]);
  for (const corner of corners) {
    for (let floor = 1; floor < building.levels; floor++) {
      const expected = corner.floors.includes(floor);
      const middle = (elevations[floor] + (elevations[floor + 1] ?? source.baseY + source.height)) / 2;
      for (const index of corner.walls) {
        const open = (detail.exclusionsBySurface.get(source.surfaces[index]) || []).some(ring =>
          Math.min(...ring.map(point => point[1])) < middle && Math.max(...ring.map(point => point[1])) > middle &&
          ring.some(point => distanceXZ(point, corner.point) < 0.12));
        assert.equal(open, expected, `${corner.name}, floor ${floor}, wall ${index}: both exterior faces open together`);
      }
      if (expected) {
        const feature = loggias.find(item => item.corner === corner.name && item.floor === floor);
        assert.ok(feature, 'Keep each balcony registered to a specific corner and floor');
        corner.walls.forEach(index => assert.ok(feature.sourceSurfaceIndices.includes(index)));
        assert.ok(feature.frontWidth > 6 && feature.returnWidth > 2);
      }
    }
  }
  const southeast = loggias.find(item => item.corner === 'southeast');
  assert.equal(southeast.sourceSurfaceIndices[0], 7);
  assert.ok(southeast.frontWidth > southeast.returnWidth * 2,
    'The middle balcony has a long east arm and short south return');
});

test('Grau entrance sits beneath five open landings in the central north source face', () => {
  const detail = details();
  const landings = detail.features.filter(feature => feature.kind === 'open-access-landing');
  assert.deepEqual(landings.map(feature => feature.floor), [1, 2, 3, 4, 5]);
  const entry = detail.features.find(feature => feature.kind === 'recessed-entrance');
  assert.deepEqual(entry?.sourceSurfaceIndices, [0]);
  assert.equal(entry.floor, 0);
  assert.equal(entry.doorCount, 1, 'One residential entrance is distinct from the cage and service doors');
  for (const landing of landings) {
    assert.deepEqual(landing.sourceSurfaceIndices, [0]);
    const bottom = elevations[landing.floor], top = elevations[landing.floor + 1] ?? source.baseY + source.height;
    const openings = (detail.exclusionsBySurface.get(source.surfaces[0]) || []).filter(ring => {
      const lo = Math.min(...ring.map(point => point[1])), hi = Math.max(...ring.map(point => point[1]));
      return lo >= bottom && hi <= top && hi - lo > 2;
    });
    assert.equal(openings.length, 1, `Floor ${landing.floor}: one full landing opening`);
    assert.ok(span(0, openings[0]) > 6.6, 'The landing fills the existing central source band');
  }
  assert.ok(groundMasks(detail, 0).some(ring => span(0, ring) > 6.6),
    'The entrance is recessed into the same source band, without a flush wall across it');
});

test('Grau bicycle cage spans the east ground floor and returns around both corners', () => {
  const detail = details();
  const cage = detail.features.find(feature => feature.kind === 'bike-storage');
  assert.ok(cage);
  assert.ok(cage.frontWidth > 22 && cage.returnWidth > 7);
  assert.ok(cage.bicycleCount > 10, 'The enclosure contains visible parked bicycle geometry');
  assert.ok(groundMasks(detail, 7).some(ring => span(7, ring) > 22));
  for (const point of [[34.692, 0, -36.870], [40.872, 0, -14.857]]) {
    assert.ok(groundMasks(detail, 7).some(ring => ring.some(vertex => distanceXZ(vertex, point) < 0.12)),
      'The cage must reach both photographed east corners');
  }
  assert.ok(groundMasks(detail, 6).some(ring => span(6, ring) > 6),
    'The mesh continues onto the north entrance wing');
  assert.ok(groundMasks(detail, 4).length, 'No solid strip separates the split north cage records');
  assert.ok(groundMasks(detail, 3).some(ring => span(3, ring) > 7),
    'The mesh also wraps the southeast corner onto the south elevation');
  const porch = detail.features.find(feature => feature.kind === 'recessed-service-porch');
  assert.ok(porch?.sourceSurfaceIndices.includes(3));
  assert.ok(porch.width > 5 && porch.depth > 1, 'The south service porch is separately recessed beside the cage');
});

test('Grau wordmark and address are readable from outside the north elevation', () => {
  const detail = details();
  const address = detail.signs.find(sign => sign.lines.some(line => line.includes('Erwin-Rommel-Straße 55a')));
  const wordmark = detail.signs.find(sign => sign.lines[0] === 'grau');
  assert.ok(address && wordmark, 'Both the entrance address and cage wordmark identify this dorm');
  const northNormal = new Vector3(...surfaceFrame(source.surfaces[0]).normal);
  for (const sign of [address, wordmark]) {
    const [a, b, , d] = sign.corners.map(point => new Vector3(...point));
    const horizontal = b.clone().sub(a), vertical = d.clone().sub(a);
    assert.ok(horizontal.length() > 5 && Math.abs(horizontal.y) < 1e-6);
    assert.ok(vertical.y > 0);
    assert.ok(horizontal.cross(vertical).normalize().dot(northNormal) > 0.99,
      `${sign.id}: the text front faces outward, avoiding mirrored letters on the viewed face`);
    assert.ok(sign.corners.every(point => point[1] < elevations[1]),
      `${sign.id}: lettering belongs to the ground frontage`);
  }
  assert.ok(center(wordmark.corners)[0] > center(address.corners)[0],
    'The cage wordmark sits east of the main entrance, as in the north photograph');
});

test('Grau display details preserve source dimensions, floor guides and interior data', () => {
  const before = JSON.stringify({campus, lod2, interiors, studies}), guides = [...elevations], detail = details();
  const footprint = source.groundPolygons[0];
  function inFootprint(point) {
    let inside = false, nearest = Infinity;
    for (let i = 1; i < footprint.length; i++) {
      const a = footprint[i - 1], b = footprint[i], x = point[0], z = point[2];
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      nearest = Math.min(nearest, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
    }
    return inside || nearest <= 0.08;
  }
  for (const [surface, masks] of detail.exclusionsBySurface) {
    const presentation = presentExteriorSurface(surface, masks);
    assert.ok(presentation.positions.every(Number.isFinite));
    assert.ok(presentation.visibleArea >= 0 && presentation.visibleArea <= presentation.sourceArea + 1e-6);
  }
  const checkPoint = (point, label) => {
    assert.ok(point.every(Number.isFinite), `${label}: finite coordinates`);
    assert.ok(inFootprint(point), `${label}: attached to the retained rotated source footprint`);
    assert.ok(point[1] >= source.baseY - 0.08 && point[1] <= source.baseY + source.height + 0.08,
      `${label}: remains inside the retained building height`);
  };
  for (const [role, positions] of Object.entries(detail.triangleLayers)) {
    assert.equal(positions.length % 9, 0, `${role}: complete triangles`);
    for (let i = 0; i < positions.length; i += 3) checkPoint(positions.slice(i, i + 3), role);
  }
  for (const [role, segments] of Object.entries(detail.segmentLayers)) {
    for (const segment of segments) segment.forEach(point => checkPoint(point, role));
  }
  for (const sign of detail.signs) sign.corners.forEach(point => checkPoint(point, sign.id));
  assert.deepEqual(elevations, guides);
  assert.equal(JSON.stringify({campus, lod2, interiors, studies}), before);
  assert.deepEqual(details(), detail, 'Repeated exterior generation is deterministic');
});

class Element extends EventTarget {
  constructor() {super(); this.dataset = {}; this.style = {setProperty() {}}; this.children = [];}
  setAttribute() {}
  appendChild(child) {this.children.push(child);}
}

test('Grau recessed windows are pickable on the near face and exterior details never join a floorplan', t => {
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
    const record = view.buildings.get('55a');
    assert.equal(record.detailGroup.parent, record.exterior);
    assert.equal(record.floorGroups.length, 6);
    assert.ok(record.floorGroups.every(floor => !floor.visible));
    let checked = 0;
    for (const [surface, study] of windows(details())) {
      const normal = new Vector3(...surfaceFrame(surface).normal);
      for (const patch of study.patches.filter(patch => patch.recessDepth)) {
        const point = new Vector3(...center(patch.corners));
        view.camera.position.copy(point).addScaledVector(normal, 0.5);
        view.camera.lookAt(point);
        view.camera.updateMatrixWorld(true);
        const hit = view.pickAt(50, 50);
        const label = `Grau wall ${source.surfaces.indexOf(surface)}, floor ${patch.floor}`;
        assert.ok(hit, `${label}: the visible opening selects the dorm`);
        assert.equal(hit.object.userData.house, '55a', label);
        assert.equal(hit.object.userData.floor, null, label);
        assert.ok(hit.distance < 0.8, `${label}: the near façade, not the opposite building side`);
        checked++;
      }
    }
    assert.ok(checked > 30, 'Exercise all photographed room elevations');
    t.diagnostic(`${checked} Grau recessed-window rays hit the near exterior face.`);
  } finally {
    view.scene.traverse(object => {
      object.geometry?.dispose();
      for (const material of [object.material].flat().filter(Boolean)) material.dispose();
    });
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
});
