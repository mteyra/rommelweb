import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createExteriorDetails} from '../src/exterior-details.js';
import {presentExteriorSurface} from '../src/exterior-presentation.js';
import {createBuildingWindowStudies} from '../src/windows.js';

const lod2 = JSON.parse(await readFile(new URL('../public/data/lod2.json', import.meta.url)));
const building = lod2.buildings.find(item => item.number === '49');
const rows = Array.from({length: 6}, (_, floor) => building.baseY + building.height * floor / 6);
const details = () => createExteriorDetails(building, {house: '49', levels: 6, absoluteFloorElevations: rows});

test('Black six photos register all elevations without changing the source or floor guides', () => {
  const original = JSON.stringify(building), guides = [...rows], detail = details();
  const registration = detail.features.find(feature => feature.id === '49-resident-photo-registration');
  assert.deepEqual(registration.sourceSurfaceIndices, [0, 1, 2, 3, 4, 7, 8, 9]);
  assert.deepEqual(registration.photoFaces, {1: 'south', 2: 'southwest', 3: 'west', 4: 'northeast', 5: 'north entrance', 6: 'southeast'});
  assert.deepEqual([...detail.layoutsBySurface.keys()].map(surface => building.surfaces.indexOf(surface)).sort((a, b) => a - b), [0, 1, 2, 3, 4, 7, 8, 9]);
  assert.equal(detail.exclusionsBySurface.get(building.surfaces[5]).length, 1, 'Retain the existing inset roof-bed study');
  assert.equal(detail.features.find(feature => feature.id === '49-inset-roof-bed').depth, 0.46);
  assert.equal(detail.exclusionsBySurface.has(building.surfaces[6]), false, 'Ground source is retained');
  assert.equal(JSON.stringify(building), original);
  assert.deepEqual(rows, guides);
  assert.deepEqual(details(), detail);
});

test('Black corner openings remain on photographed floors and inside retained source planes', () => {
  const detail = details();
  const loggias = detail.features.filter(feature => feature.kind === 'corner-loggia');
  assert.deepEqual(loggias.map(({corner, floor}) => [corner, floor]),
    [['southeast', 1], ['southeast', 4], ['southwest', 2], ['southwest', 5], ['northwest', 3]]);
  for (const loggia of loggias) {
    assert.ok(loggia.frontWidth > loggia.returnWidth * 2);
    assert.ok(loggia.sourceSurfaceIndices.some(index => detail.exclusionsBySurface.get(building.surfaces[index])
      ?.some(ring => Math.abs(Math.min(...ring.map(point => point[1])) - (rows[loggia.floor] + 0.06)) < 1e-6)));
    assert.match(loggia.evidence, /existing apartment plans are unchanged/);
  }
  const partial = detail.features.filter(feature => feature.kind === 'partial-loggia-end');
  assert.equal(partial.length, 0, 'The southwest return is now photographed on both faces');
  const roofBedY = building.baseY + building.height - detail.features.find(feature => feature.id === '49-inset-roof-bed').depth;
  const topLoggia = loggias.find(feature => feature.floor === 5);
  assert.ok(topLoggia.ceilingElevation < roofBedY - 0.01, 'Roof bed must stay above the top balcony ceiling');
  const limeTriangles = detail.triangleLayers.detailAcidShade;
  const upperCeilings = [];
  for (let i = 0; i < limeTriangles.length; i += 9) {
    const ys = [limeTriangles[i + 1], limeTriangles[i + 4], limeTriangles[i + 7]];
    if (Math.max(...ys) - Math.min(...ys) < 1e-6 && ys[0] > rows[5] + 1) upperCeilings.push(ys[0]);
  }
  assert.ok(upperCeilings.length > 0 && upperCeilings.every(y => y < roofBedY - 0.01),
    'Actual top-storey lime ceiling geometry conceals the roof-bed underside');
  for (const index of [1, 2, 9]) {
    const surface = building.surfaces[index];
    const result = presentExteriorSurface(surface, detail.exclusionsBySurface.get(surface));
    assert.ok(result.removedArea > 1 && result.visibleArea > result.removedArea);
    assert.ok(result.positions.every(Number.isFinite));
  }
});

test('Black visible row counts and alternating columns survive loggia clipping', () => {
  const detail = details();
  const studies = createBuildingWindowStudies(building.surfaces, rows, building.baseY + building.height, {
    house: '49', family: 'timber',
    exclusionsBySurface: detail.exclusionsBySurface, layoutsBySurface: detail.layoutsBySurface,
  });
  for (const [index, counts] of [[1, [1, 4, 4, 5, 4, 4]], [2, [0, 5, 4, 4, 5, 4]], [9, [6, 6, 7, 7, 6, 7]]]) {
    const surface = building.surfaces[index], layout = detail.layoutsBySurface.get(surface);
    assert.deepEqual(layout.rows.map(row => row.centers.length), counts);
    assert.equal(layout.replace, true);
    for (const row of layout.rows) {
      assert.equal(studies.get(surface).patches.filter(patch => patch.floor === row.floor).length, row.centers.length,
        `wall ${index} floor ${row.floor}: observed windows must not disappear behind a wrong recess`);
    }
  }
  const eastRows = detail.layoutsBySurface.get(building.surfaces[9]).rows;
  assert.deepEqual(eastRows[3].centers, eastRows[5].centers, 'photographed alternate rows have matching columns');
  assert.notDeepEqual(eastRows[3].centers, eastRows[4].centers, 'retain the observed stagger');
  assert.equal(studies.get(building.surfaces[8]).count, 0, 'Split west plane must not create duplicate or generic windows');
  for (const index of [0, 3, 4, 7]) {
    assert.equal(studies.get(building.surfaces[index]).count, 0, 'North timber wings have no bedroom window grid');
  }
});

test('Black photo mesh has finite triangles and no roof equipment inferred from a street view', () => {
  const detail = details();
  for (const positions of Object.values(detail.triangleLayers)) {
    assert.equal(positions.length % 9, 0);
    assert.ok(positions.every(Number.isFinite));
  }
  const sourceY = building.surfaces.flatMap(surface => surface.points.map(point => point[1]));
  for (const positions of Object.values(detail.triangleLayers)) {
    for (let i = 1; i < positions.length; i += 3) {
      assert.ok(positions[i] >= Math.min(...sourceY) - 0.003 && positions[i] <= Math.max(...sourceY) + 0.003);
    }
  }
  assert.equal(detail.triangleLayers.detailRoofHardware, undefined);
  assert.equal(detail.features.filter(feature => feature.kind === 'recessed-stair-elevation').length, 1);
});

test('Black entrance is on the north central band with five open landings and correctly oriented address', () => {
  const detail = details();
  const entrance = detail.features.find(feature => feature.kind === 'recessed-entrance');
  assert.deepEqual(entrance.sourceSurfaceIndices, [0]);
  assert.equal(entrance.address, 'Erwin-Rommel-Straße 49');
  const gallery = detail.features.find(feature => feature.kind === 'recessed-stair-elevation');
  assert.deepEqual(gallery.landingFloors, [1, 2, 3, 4, 5]);
  assert.ok(gallery.topCeilingElevation < building.baseY + building.height - 0.47,
    'The last gallery ceiling also sits below the retained roof bed');
  const presentation = presentExteriorSurface(building.surfaces[0], detail.exclusionsBySurface.get(building.surfaces[0]));
  assert.ok(presentation.removedArea / (presentation.visibleArea + presentation.removedArea) > 0.98,
    'Source timber must not seal the gallery or its concrete slab fronts');
  const address = detail.signs.find(sign => sign.id === '49-address');
  assert.equal(address.lines[0], 'Studentenwohnheim Erwin-Rommel-Straße 49');
  assert.ok(address.corners[0][0] > address.corners[1][0], 'North-facing text reads from east to west');
  assert.ok(address.corners.every(p => p[1] > rows[1] - 0.53 && p[1] < rows[1]));
  assert.ok(detail.triangleLayers.detailBlackPorchWall.length > 0);
  assert.ok(detail.triangleLayers.detailBlackPorchSoffit.length > 0);
});

test('Black bicycle storage turns around northwest, and its west service door stays distinct from the entrance', () => {
  const detail = details();
  const cages = detail.features.filter(feature => feature.kind === 'bike-storage');
  assert.deepEqual(cages.map(feature => feature.id), ['49-west-bicycle-storage', '49-north-bicycle-storage']);
  assert.deepEqual(cages[0].sourceSurfaceIndices, [2]);
  assert.deepEqual(cages[1].sourceSurfaceIndices, [7, 4]);
  assert.ok(cages[0].width > cages[1].width * 1.5);
  assert.ok(cages.every(feature => feature.decorativeBicycles > 0 && feature.floor === 0));
  const wordmark = detail.signs.find(sign => sign.id === '49-schwarz-wordmark');
  assert.equal(wordmark.lines[0], 'schwarz');
  const door = detail.features.find(feature => feature.kind === 'service-door');
  assert.deepEqual(door.sourceSurfaceIndices, [8]);
  assert.ok(door.width > 1.8, 'Photo 3 shows a double service door');
});

test('Black mesh and sign vertices stay inside the retained footprint and height', () => {
  const detail = details(), ring = building.groundPolygons[0];
  const inside = ([x, , z]) => {
    let hit = false, nearest = Infinity;
    for (let i = 1; i < ring.length; i++) {
      const [ax, az] = ring[i - 1], [bx, bz] = ring[i];
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      nearest = Math.min(nearest, Math.hypot(x - ax - t * dx, z - az - t * dz));
      if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) hit = !hit;
    }
    return hit || nearest < 0.008; // Source wall bends are millimetric.
  };
  const points = [
    ...Object.values(detail.triangleLayers).flatMap(values => Array.from({length: values.length / 3}, (_, i) => values.slice(i * 3, i * 3 + 3))),
    ...Object.values(detail.segmentLayers).flat(2),
    ...detail.signs.flatMap(sign => sign.corners),
  ];
  for (const p of points) {
    assert.ok(p.every(Number.isFinite));
    assert.ok(inside(p), `No exterior detail enlarges the footprint: ${p}`);
    assert.ok(p[1] >= building.baseY - 0.003 && p[1] <= building.baseY + building.height);
  }
});
