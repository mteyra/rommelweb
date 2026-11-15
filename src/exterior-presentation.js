import { ShapeUtils, Vector2 } from 'three';
import { difference } from 'polyclip-ts';

const sub = (a, b) => a.map((value, i) => value - b[i]);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = v => { const length = Math.hypot(...v); return length > 1e-10 ? v.map(value => value / length) : null; };
const close = ring => [...ring, ring[0]];
const open = ring => ring.length > 1 && Math.hypot(...sub(ring[0], ring.at(-1))) < 1e-8 ? ring.slice(0, -1) : ring;
const ringArea = ring => Math.abs(ring.reduce((sum, a, i) => {
  const b = ring[(i + 1) % ring.length];
  return sum + a[0] * b[1] - b[0] * a[1];
}, 0)) / 2;
const polygonArea = rings => ringArea(rings[0]) - rings.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0);

/**
 * Cut a display copy of a source face for photographed recesses.
 * Masks may touch the outer boundary: polygon subtraction, not overlapping
 * opaque patches, makes corner loggias genuinely open from both directions.
 * The source object remains the authoritative envelope for floors and scale.
 */
export function presentExteriorSurface(surface, masks = []) {
  const sourceRings = [surface.points, ...(surface.holes || [])].map(open);
  const outer = sourceRings[0];
  if (outer.length < 3) throw new Error('Exterior face needs three vertices');
  const normal = unit(outer.reduce((n, a, i) => {
    const b = outer[(i + 1) % outer.length];
    return n.map((value, axis) => value + [
      (a[1] - b[1]) * (a[2] + b[2]),
      (a[2] - b[2]) * (a[0] + b[0]),
      (a[0] - b[0]) * (a[1] + b[1]),
    ][axis]);
  }, [0, 0, 0]));
  if (!normal) throw new Error('Degenerate exterior face');
  const origin = outer[0], u = unit(sub(outer[1], origin));
  if (!u) throw new Error('Degenerate exterior face frame');
  const v = unit(cross(normal, u));
  if (!v) throw new Error('Degenerate exterior face frame');
  const project = point => [dot(sub(point, origin), u), dot(sub(point, origin), v)];
  const lift = point => origin.map((value, i) => value + point[0] * u[i] + point[1] * v[i]);
  const projected = sourceRings.map(ring => ring.map(project));
  for (const ring of masks) {
    if (ring.length < 4 || !ring.every(point => point.length === 3 && point.every(Number.isFinite)
      && Math.abs(dot(sub(point, origin), normal)) <= 0.002)) {
      throw new Error('Exterior recess masks must be finite, closed, coplanar 3D rings');
    }
    if (Math.hypot(...sub(ring[0], ring.at(-1))) > 1e-8) throw new Error('Exterior recess mask must be closed');
  }
  const clipped = masks.length
    ? difference(projected.map(close), ...masks.map(ring => [close(open(ring).map(project))]))
    : [projected];
  const positions = [], boundarySegments = [], polygons = [];
  for (const raw of clipped) {
    const rings = raw.map(open);
    const worldRings = masks.length ? rings.map(ring => ring.map(lift)) : sourceRings;
    const world = worldRings.flat();
    const triangles = ShapeUtils.triangulateShape(rings[0].map(point => new Vector2(...point)),
      rings.slice(1).map(ring => ring.map(point => new Vector2(...point))));
    for (const triangle of triangles) for (const i of triangle) positions.push(...world[i]);
    for (const ring of worldRings) for (let i = 0; i < ring.length; i++) boundarySegments.push([ring[i], ring[(i + 1) % ring.length]]);
    polygons.push(worldRings.map(close));
  }
  const sourceArea = polygonArea(projected);
  const visibleArea = clipped.reduce((sum, rings) => sum + polygonArea(rings), 0);
  return {positions, boundarySegments, polygons, sourceArea, visibleArea, removedArea: Math.max(0, sourceArea - visibleArea)};
}
