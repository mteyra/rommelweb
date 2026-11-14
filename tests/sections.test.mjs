import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Ray, Vector3 } from 'three';
import { floorSection, horizontalSection, triangulateSection, triangulateSurface } from '../src/sections.js';

function prism(outer, holes = [], bottom = 0, top = 6) {
  const surfaces = [
    { type: 'GroundSurface', points: outer.map(([x, z]) => [x, bottom, z]), holes: holes.map(ring => ring.map(([x, z]) => [x, bottom, z])) },
    { type: 'RoofSurface', points: outer.map(([x, z]) => [x, top, z]), holes: holes.map(ring => ring.map(([x, z]) => [x, top, z])) },
  ];
  for (const ring of [outer, ...holes]) for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i];
    surfaces.push({ type: 'WallSurface', points: [[a[0], bottom, a[1]], [b[0], bottom, b[1]], [b[0], top, b[1]], [a[0], top, a[1]], [a[0], bottom, a[1]]] });
  }
  return surfaces;
}

function insideSource(point, triangles) {
  // Independent vertical ray parity against the triangulated original shell.
  const ray = new Ray(new Vector3(...point), new Vector3(0, 1, 0));
  const hit = new Vector3(), heights = [];
  for (const triangle of triangles) {
    if (ray.intersectTriangle(...triangle.map(vertex => new Vector3(...vertex)), false, hit) && hit.y > point[1] + 1e-6) {
      if (!heights.some(height => Math.abs(height - hit.y) < 1e-5)) heights.push(hit.y);
    }
  }
  return heights.length % 2 === 1;
}

function boundaryDistance(point, section) {
  return Math.min(...section.polygons.flatMap(polygon => [polygon.outer, ...polygon.holes]).flatMap(ring =>
    ring.slice(1).map((b, i) => {
      const a = ring[i], dx = b[0] - a[0], dz = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[2] - a[1]) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(point[0] - a[0] - t * dx, point[2] - a[1] - t * dz);
    })));
}

test('horizontal sections preserve holes and disjoint wings without bridging their empty space', () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  const hole = [[3, 3], [3, 7], [7, 7], [7, 3], [3, 3]];
  const island = [[20, 0], [24, 0], [24, 4], [20, 4], [20, 0]];
  const surfaces = [...prism(square, [hole]), ...prism(island)];
  const before = structuredClone(surfaces);
  const section = horizontalSection(surfaces, 2.5);
  assert.equal(section.openChains.length, 0);
  assert.equal(section.polygons.length, 2);
  assert.equal(section.polygons.reduce((sum, polygon) => sum + polygon.holes.length, 0), 1);
  assert.ok(Math.abs(section.area - 100) < 1e-8, '100 - 16 courtyard + 16 separate wing');
  const sourceTriangles = surfaces.flatMap(triangulateSurface);
  for (const triangle of triangulateSection(section)) {
    const center = [0, 1, 2].map(axis => triangle.reduce((sum, vertex) => sum + vertex[axis] / 3, 0));
    assert.ok(insideSource(center, sourceTriangles), 'a section triangle must not span the courtyard or gap');
  }
  assert.deepEqual(surfaces, before);
});

test('roof intersection shrinks an upper section instead of repeating a full ground footprint', () => {
  const surfaces = prism([[0, 0], [8, 0], [8, 6], [0, 6], [0, 0]], [], 0, 3);
  surfaces.splice(1, 1);
  surfaces.push(
    { type: 'RoofSurface', points: [[0, 3, 0], [4, 7, 0], [4, 7, 6], [0, 3, 6], [0, 3, 0]] },
    { type: 'RoofSurface', points: [[4, 7, 0], [8, 3, 0], [8, 3, 6], [4, 7, 6], [4, 7, 0]] },
    { type: 'WallSurface', points: [[0, 3, 0], [8, 3, 0], [4, 7, 0], [0, 3, 0]] },
    { type: 'WallSurface', points: [[0, 3, 6], [8, 3, 6], [4, 7, 6], [0, 3, 6]] },
  );
  const lower = horizontalSection(surfaces, 2), upper = horizontalSection(surfaces, 5);
  assert.equal(lower.area, 48);
  assert.equal(upper.area, 24);
  assert.equal(upper.openChains.length, 0);
  assert.ok(upper.polygons[0].outer.every(([x]) => x >= 2 && x <= 6));
  for (const triangle of triangulateSection(upper)) assert.ok(triangle.every(vertex => vertex[1] === 5), 'a floor is a section plane, not invented roof volume');
});

test('every real floor section is closed and lies inside its official shell; all five old upper outlines differ', async () => {
  const lod2 = JSON.parse(await readFile(new URL('../public/data/lod2.json', import.meta.url), 'utf8'));
  const campus = JSON.parse(await readFile(new URL('../public/data/campus.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(lod2);
  let samples = 0;
  for (const building of lod2.buildings) {
    const data = campus.buildings.find(item => item.number === building.number);
    const sourceTriangles = building.surfaces.flatMap(triangulateSurface), sections = [];
    for (let floor = 0; floor < data.levels; floor++) {
      const section = floorSection(building, building.height / data.levels * floor);
      sections.push(section);
      assert.equal(section.openChains.length, 0, `House ${building.number} floor ${floor} must close`);
      assert.ok(section.polygons.length > 0 && section.area > 0);
      for (const polygon of section.polygons) for (const ring of [polygon.outer, ...polygon.holes]) {
        assert.deepEqual(ring[0], ring.at(-1));
        assert.ok(ring.every(point => point.length === 2 && point.every(Number.isFinite)));
      }
      for (const triangle of triangulateSection(section, section.sampleElevation)) {
        for (const weights of [[1 / 3, 1 / 3, 1 / 3], [0.2, 0.3, 0.5]]) {
          const point = [0, 1, 2].map(axis => triangle.reduce((sum, vertex, i) => sum + vertex[axis] * weights[i], 0));
          // Published source vertices are rounded to 1 mm. Exclude boundary
          // samples inside that uncertainty from the strict solid-parity test.
          if (boundaryDistance(point, section) < 0.001) continue;
          assert.ok(insideSource(point, sourceTriangles), `section escapes House ${building.number}, floor ${floor}: ${point}`);
          samples++;
        }
      }
      assert.ok(section.sampleOffset >= 0 && section.sampleOffset <= 0.006, 'only ground quantization requires a millimetric sample adjustment');
    }
    if (data.campus === 'I') {
      assert.ok(sections.at(-1).area < sections[0].area * 0.85, `House ${building.number}: upper section should lose low roof wings`);
      assert.notDeepEqual(sections[1].polygons, sections[0].polygons);
      assert.notDeepEqual(sections[2].polygons, sections[1].polygons);
    }
  }
  assert.ok(samples > 400, `expected broad section interior sampling, got ${samples}`);
  assert.equal(JSON.stringify(lod2), before, 'section study must never alter folded source geometry');
});

test('approved floor elevations remain exact while base quantization changes only the sampled contour', () => {
  const building = { baseY: 2, height: 6, surfaces: prism([[0, 0], [8, 0], [8, 6], [0, 6], [0, 0]], [], 2.004, 8) };
  const approved = floorSection(building, 2.71);
  assert.equal(approved.planeElevation, 4.71);
  assert.equal(approved.sampleElevation, 4.71);
  const ground = floorSection(building, 0);
  assert.equal(ground.planeElevation, 2);
  assert.ok(Math.abs(ground.sampleOffset - 0.005) < 1e-9);
  assert.throws(() => floorSection(building, 6), /inside the building height/);
  assert.throws(() => horizontalSection(building.surfaces, NaN), /finite metres/);
});
