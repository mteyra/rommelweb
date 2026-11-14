import { ShapeUtils, Vector2 } from 'three';

const EPSILON = 1e-7;
const pointKey = point => `${Math.round(point[0] * 10000)},${Math.round(point[1] * 10000)}`;
const area = ring => ring.slice(0, -1).reduce((sum, p, i) => sum + p[0] * ring[i + 1][1] - ring[i + 1][0] * p[1], 0) / 2;

/** Triangulate a source surface on its dominant plane without moving its vertices. */
export function triangulateSurface(surface) {
  const rings = [surface.points, ...(surface.holes || [])].map(ring => ring.slice(0, -1));
  const outer = rings[0];
  if (outer.length < 3) return [];
  const normal = [0, 0, 0];
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i], b = outer[(i + 1) % outer.length];
    normal[0] += (a[1] - b[1]) * (a[2] + b[2]);
    normal[1] += (a[2] - b[2]) * (a[0] + b[0]);
    normal[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const axis = normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
  const project = point => axis === 0 ? new Vector2(point[1], point[2]) : axis === 1 ? new Vector2(point[0], point[2]) : new Vector2(point[0], point[1]);
  const vertices = rings.flat();
  return ShapeUtils.triangulateShape(outer.map(project), rings.slice(1).map(ring => ring.map(project)))
    .map(indices => indices.map(index => [...vertices[index]]));
}

function insideRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function simplifyRing(ring) {
  let points = ring.slice(0, -1);
  let changed = true;
  while (changed && points.length > 3) {
    changed = false;
    for (let i = 0; i < points.length; i++) {
      const a = points[(i + points.length - 1) % points.length], b = points[i], c = points[(i + 1) % points.length];
      const length = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const deviation = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
      if (length > EPSILON && deviation / length < 0.0002 && (b[0] - a[0]) * (b[0] - c[0]) + (b[1] - a[1]) * (b[1] - c[1]) <= EPSILON) {
        points.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return [...points, [...points[0]]];
}

/**
 * Intersect an official exterior shell with a horizontal plane.
 * Returns closed section polygons in campus [x,z], including holes and islands.
 * No occupancy, interior partition or living-area classification is inferred.
 */
export function horizontalSection(surfaces, elevation) {
  if (!Number.isFinite(elevation)) throw new Error('Section elevation must be finite metres');
  const edges = new Map(), vertices = new Map();
  for (const surface of surfaces) for (const triangle of triangulateSurface(surface)) {
    const distances = triangle.map(point => point[1] - elevation);
    if (distances.every(distance => Math.abs(distance) <= EPSILON)) continue;
    const intersections = new Map();
    for (let i = 0; i < 3; i++) {
      const a = triangle[i], b = triangle[(i + 1) % 3];
      const da = distances[i], db = distances[(i + 1) % 3];
      if (Math.abs(da) <= EPSILON) {
        const point = [a[0], a[2]];
        intersections.set(pointKey(point), point);
      }
      if ((da < -EPSILON && db > EPSILON) || (da > EPSILON && db < -EPSILON)) {
        const t = da / (da - db), point = [a[0] + (b[0] - a[0]) * t, a[2] + (b[2] - a[2]) * t];
        intersections.set(pointKey(point), point);
      }
    }
    if (intersections.size !== 2) continue;
    const pair = [...intersections.keys()];
    if (pair[0] === pair[1]) continue;
    const key = [...pair].sort().join('|');
    edges.set(key, pair);
    for (const [key, point] of intersections) if (!vertices.has(key)) vertices.set(key, point);
  }
  const adjacent = new Map();
  for (const [key, [a, b]] of edges) {
    if (!adjacent.has(a)) adjacent.set(a, []);
    if (!adjacent.has(b)) adjacent.set(b, []);
    adjacent.get(a).push({ edge: key, next: b });
    adjacent.get(b).push({ edge: key, next: a });
  }
  const unused = new Set(edges.keys()), rings = [], openChains = [];
  while (unused.size) {
    const edge = unused.values().next().value, [start, next] = edges.get(edge);
    unused.delete(edge);
    const keys = [start, next];
    let current = next;
    while (current !== start) {
      const continuation = adjacent.get(current)?.find(candidate => unused.has(candidate.edge));
      if (!continuation) break;
      unused.delete(continuation.edge);
      current = continuation.next;
      keys.push(current);
    }
    const ring = keys.map(key => [...vertices.get(key)]);
    if (current === start && ring.length >= 4) {
      const simplified = simplifyRing(ring);
      if (Math.abs(area(simplified)) > 0.001) rings.push(simplified);
    } else openChains.push(ring);
  }
  const ordered = rings.map(ring => ({ ring, area: Math.abs(area(ring)), parent: null, depth: 0 })).sort((a, b) => b.area - a.area);
  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i];
    for (let j = i - 1; j >= 0; j--) {
      if (insideRing(item.ring[0], ordered[j].ring)) {
        item.parent = ordered[j];
        item.depth = ordered[j].depth + 1;
        break;
      }
    }
  }
  const polygons = ordered.filter(item => item.depth % 2 === 0).map(item => ({
    outer: item.ring,
    holes: ordered.filter(child => child.parent === item && child.depth % 2 === 1).map(child => child.ring),
  }));
  return {
    elevation, polygons, openChains,
    area: polygons.reduce((sum, polygon) => sum + Math.abs(area(polygon.outer)) - polygon.holes.reduce((holes, ring) => holes + Math.abs(area(ring)), 0), 0),
    sourceStatus: 'Horizontal section of the official exterior; elevation provisional unless an approved floor record supplies it. Not a living-area boundary.',
  };
}

/** Renderable cap triangles, preserving both disjoint wings and polygon holes. */
export function triangulateSection(section, elevation = section.elevation) {
  return section.polygons.flatMap(polygon => {
    const outer = polygon.outer.slice(0, -1), holes = polygon.holes.map(ring => ring.slice(0, -1));
    const vertices = [outer, ...holes].flat();
    return ShapeUtils.triangulateShape(outer.map(point => new Vector2(...point)), holes.map(ring => ring.map(point => new Vector2(...point))))
      .map(indices => indices.map(index => [vertices[index][0], elevation, vertices[index][1]]));
  });
}

/**
 * The floor's visual plane stays at its requested elevation above the base.
 * Ground-level sampling moves only as far as needed to enter the source shell:
 * published base altitudes and quantized ground vertices differ by a few mm.
 */
export function floorSection(building, elevation) {
  if (!Number.isFinite(elevation) || elevation < 0 || elevation >= building.height) throw new Error('Floor section must be inside the building height');
  const ground = building.surfaces.filter(surface => surface.type === 'GroundSurface').flatMap(surface => surface.points.map(point => point[1]));
  const planeElevation = building.baseY + elevation;
  const sampleElevation = Math.max(planeElevation, Math.max(...ground) + 0.001);
  const section = horizontalSection(building.surfaces, sampleElevation);
  return { ...section, floorElevation: elevation, planeElevation, sampleElevation, sampleOffset: sampleElevation - planeElevation };
}
