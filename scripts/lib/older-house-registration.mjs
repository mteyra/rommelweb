// Places a House 55 drawing onto another older house's official LoD2 outline.
// Extracted unchanged from the archived archive/scripts/generate-old-house-studies.mjs;
// the older-house generators (51, 53, 57, 59) use it to position their final plans.
import {createHash} from 'node:crypto';
import {union} from 'polyclip-ts';

const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const subtract = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b, scale = 1) => a.map((v, i) => v + b[i] * scale);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const close = points => [...points, [...points[0]]];
const rounded = point => point.map(value => Math.round(value * 1e9) / 1e9);
const ringArea = ring => Math.abs(ring.slice(1).reduce((sum, b, i) => sum + cross(ring[i], b), 0)) / 2;
const polygonArea = polygon => ringArea(polygon[0]) - polygon.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0);
const sumArea = multi => multi.reduce((sum, polygon) => sum + polygonArea(polygon), 0);
const digest = object => createHash('sha256').update(JSON.stringify(object)).digest('hex');

const SOURCE_IDS = {
  '51': 'DEBY_LOD2_3166503', '53': 'DEBY_LOD2_3166504',
  '55': 'DEBY_LOD2_3166499', '57': 'DEBY_LOD2_107316307', '59': 'DEBY_LOD2_3166500',
};
const SOURCE_HASHES = {
  '51': '7ba0920954d67fb071da55a10bbb69f9783f44866f169d58e0048c17f78d9531',
  '53': '5434cf9b173eb4dc4b62d209a37bef293a8a79c9b74ac0e9ac76fb5f9a763e6a',
  '55': '97d8230fda2e3fe57013f31e1ccba1ccdd34adc8e2f01acb374bf5c3fc6993c4',
  '57': '4ac99d27da8a6e3067a2392970e8ec139a577738c4312b57c17ebf3c4d209db2',
  '59': 'db84521d421b48bf38899fe9633d23eb230d9c8f9eb8d1b9f4e322ab7fc9a533',
};

function simplifyRing(ring, allowCollapsedArtifact = false, preserveCollinear = false) {
  let points = [];
  for (const p of ring.slice(0, -1).map(rounded)) {
    if (!points.length || Math.hypot(...subtract(p, points.at(-1))) > 0.0000001) points.push(p);
  }
  // Exact clipping can reveal a tiny cap joined by a collapsed, zero-width
  // stem after serialization. It is not a usable hallway. Remove only such
  // repeated-vertex loops below 1cm²; their area stays in the final residue.
  for (let changed = true; changed && points.length > 3;) {
    changed = false;
    for (let i = 0; i < points.length && !changed; i++) for (let j = i + 1; j < points.length; j++) {
      if (Math.hypot(...subtract(points[i], points[j])) > 1e-9) continue;
      const loop = points.slice(i, j + 1), other = [...points.slice(j), ...points.slice(0, i + 1)];
      if (ringArea(loop) < 0.0001) {
        points.splice(i + 1, j - i); changed = true; break;
      }
      if (ringArea(other) < 0.0001) {
        points = loop.slice(0, -1); changed = true; break;
      }
    }
  }
  for (let changed = true; changed && points.length > 3;) {
    changed = false;
    for (let i = 0; i < points.length; i++) {
      const a = points[(i + points.length - 1) % points.length], p = points[i], b = points[(i + 1) % points.length];
      const span = subtract(b, a), length = Math.hypot(...span);
      if (length < 1e-10 || Math.hypot(...subtract(p, a)) < 0.0000001 || Math.hypot(...subtract(p, b)) < 0.0000001
        || !preserveCollinear && length > 1e-9 && Math.abs(cross(span, subtract(p, a))) / length < 0.000000001
        && dot(subtract(p, a), subtract(p, b)) <= 1e-10) {
        points.splice(i, 1); changed = true; break;
      }
    }
  }
  if (points.length < 3) {
    if (allowCollapsedArtifact && ringArea(ring) < 0.0001) return null;
    throw new Error('A mapped ring collapsed');
  }
  return close(points);
}

function barycentric(point, triangle) {
  const [a, b, c] = triangle, u = subtract(b, a), v = subtract(c, a), p = subtract(point, a);
  const det = cross(u, v), y = cross(p, v) / det, z = cross(u, p) / det;
  return [1 - y - z, y, z];
}

/** Continuous, orientation-preserving piecewise affine map, in actual metres. */
export function createRegistration(source, target) {
  for (const building of [source, target]) {
    if (building.id !== SOURCE_IDS[building.number] || digest(building.surfaces) !== SOURCE_HASHES[building.number]) {
      throw new Error(`Review changed official House ${building.number} geometry before using its boundary correspondence`);
    }
  }
  const manifest = REGISTRATION[target.number];
  if (source.number !== '55' || !manifest) throw new Error('The audited registration requires House 55 and one supported older target');
  const sourceRoof = source.surfaces[manifest.sourceSurface], targetRoof = target.surfaces[manifest.targetSurface];
  const sourcePoints = manifest.sourceVertexIndexes.map(i => [sourceRoof.points[i][0], sourceRoof.points[i][2]]);
  const targetPoints = manifest.targetVertexIndexes.map(i => [targetRoof.points[i][0], targetRoof.points[i][2]]);
  // Keep one common cage even where the incompatible House 57 notch is omitted.
  const fullSource = REGISTRATION['51'].sourceVertexIndexes.map(i => [sourceRoof.points[i][0], sourceRoof.points[i][2]]);
  const xs = fullSource.map(p => p[0]), ys = fullSource.map(p => p[1]);
  const cage = [[Math.min(...xs) - 20, Math.min(...ys) - 20], [Math.max(...xs) + 20, Math.min(...ys) - 20],
    [Math.max(...xs) + 20, Math.max(...ys) + 20], [Math.min(...xs) - 20, Math.max(...ys) + 20]];
  const [a, b, d, e, x, y] = manifest.rigid;
  sourcePoints.push(...cage);
  targetPoints.push(...cage.map(([u, v]) => [a * u + b * v + x, d * u + e * v + y]));
  const triangles = manifest.triangles.map((indexes, i) => {
    const from = indexes.map(j => sourcePoints[j]), to = indexes.map(j => targetPoints[j]);
    const ds = cross(subtract(from[1], from[0]), subtract(from[2], from[0]));
    const dt = cross(subtract(to[1], to[0]), subtract(to[2], to[0]));
    if (ds * dt <= 1e-10) throw new Error(`House ${target.number} mapping triangle ${i} folds or collapses`);
    const map = p => {
      const weights = barycentric(p, from);
      return [0, 1].map(axis => weights.reduce((sum, weight, j) => sum + weight * to[j][axis], 0));
    };
    const origin = map([0, 0]), u = subtract(map([1, 0]), origin), v = subtract(map([0, 1]), origin);
    const trace = dot(u, u) + dot(v, v), determinant = dt / ds;
    const spread = Math.sqrt(Math.max(0, trace * trace - 4 * determinant * determinant));
    const singularValues = [Math.sqrt((trace + spread) / 2), Math.sqrt((trace - spread) / 2)];
    return {indexes, from, to, determinant, singularValues, map};
  });
  const sourceTriangleUnion = union(...triangles.map(t => [close(t.from)]));
  const targetTriangleUnion = union(...triangles.map(t => [close(t.to)]));
  if (Math.abs(sumArea(sourceTriangleUnion) - ringArea(close(cage))) > 1e-5
    || Math.abs(triangles.reduce((sum, t) => sum + ringArea(close(t.to)), 0) - sumArea(targetTriangleUnion)) > 1e-5) {
    throw new Error(`House ${target.number} mapping is not a continuous, nonoverlapping cage partition`);
  }
  const mapPoint = point => {
    const triangle = triangles.find(t => barycentric(point, t.from).every(value => value >= -1e-8));
    if (!triangle) throw new Error('Study geometry lies outside the audited mapping cage');
    return triangle.map(point);
  };
  const triangleEdges = [...new Map(triangles.flatMap(t => t.indexes.map((j, i) => {
    const k = t.indexes[(i + 1) % 3], key = [j, k].sort((u, v) => u - v).join(':');
    return [key, [sourcePoints[j], sourcePoints[k]]];
  }))).values()];
  const mapRing = ring => {
    const output = [];
    for (let i = 1; i < ring.length; i++) {
      const start = ring[i - 1], end = ring[i], d = subtract(end, start), fractions = [0];
      for (const [a, b] of triangleEdges) {
        const edge = subtract(b, a), denominator = cross(d, edge);
        if (Math.abs(denominator) < 1e-10) continue;
        const delta = subtract(a, start), t = cross(delta, edge) / denominator, u = cross(delta, d) / denominator;
        if (t > 1e-9 && t < 1 - 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) fractions.push(t);
      }
      fractions.sort((a, b) => a - b);
      fractions.filter((t, j) => !j || t - fractions[j - 1] > 1e-9).forEach(t => output.push(mapPoint(add(start, d, t))));
    }
    return simplifyRing(close(output));
  };
  // Split each boundary where it crosses a triangulation edge. This preserves
  // the same exact bend in adjoining spaces without fragmenting a polygon
  // into nearly touching pieces at sub-millimetre source shoulders.
  const mapPolygons = multi => {
    if (!multi.length) throw new Error('Study polygon left the mapping domain');
    return multi.map(polygon => polygon.map(mapRing));
  };
  return {mapPoint, mapPolygons, sourcePoints, targetPoints, triangles, manifest};
}

export const REGISTRATION = {
  "51": {"sourceSurface":39,"targetSurface":1,"sourceVertexIndexes":[0,2,3,4,7,8,9,10,11,12,13,15,16,17,18,19,20,21,22,23],"targetVertexIndexes":[16,18,19,20,21,22,23,0,1,2,3,5,6,7,10,11,12,13,14,15],"coreTriangleCount":18,"triangles":[[4,5,6],[7,8,9],[7,9,10],[7,10,11],[6,7,11],[4,6,11],[3,4,11],[2,3,11],[2,11,12],[12,13,14],[2,12,14],[1,2,14],[14,15,16],[1,14,16],[1,16,17],[17,18,19],[1,17,19],[0,1,19],[20,23,19],[18,17,16],[15,14,13],[13,12,11],[8,7,6],[5,4,3],[3,2,1],[0,19,23],[20,19,18],[10,13,11],[0,3,1],[5,0,23],[20,18,16],[13,10,15],[0,5,3],[21,20,16],[21,15,10],[6,5,23],[15,21,16],[6,23,22],[21,10,9],[8,6,22],[22,21,9],[9,8,22]],"rigid":[0.0016540710012037043,-0.9999986320236258,0.9999986320236258,0.0016540710012037043,-32.04511504843866,-20.707546150980498]},
  "53": {"sourceSurface":39,"targetSurface":7,"sourceVertexIndexes":[0,2,3,4,7,8,9,10,11,12,13,15,16,17,18,19,20,21,22,23],"targetVertexIndexes":[0,2,3,4,7,8,9,10,11,12,13,15,16,17,18,19,20,21,22,23],"coreTriangleCount":18,"triangles":[[2,3,4],[4,5,6],[4,6,7],[7,8,9],[4,7,9],[9,10,11],[4,9,11],[4,11,12],[12,13,14],[4,12,14],[2,4,14],[1,2,14],[14,15,16],[1,14,16],[1,16,17],[17,18,19],[1,17,19],[0,1,19],[20,23,19],[18,17,16],[15,14,13],[13,12,11],[8,7,6],[5,4,3],[3,2,1],[0,19,23],[20,19,18],[10,13,11],[0,3,1],[5,0,23],[20,18,16],[13,10,15],[0,5,3],[21,20,16],[21,15,10],[6,5,23],[15,21,16],[6,23,22],[21,10,9],[8,6,22],[22,21,9],[9,8,22]],"rigid":[0.9999995371046133,0.0009621801073968473,-0.0009621801073968473,0.9999995371046133,-21.985629717295698,-59.237072572630346]},
  "57": {"sourceSurface":39,"targetSurface":30,"sourceVertexIndexes":[0,2,3,4,7,8,9,10,11,12,13,15,18,19,20,21,22,23],"targetVertexIndexes":[14,16,17,18,21,22,23,0,1,2,3,5,8,9,10,11,12,13],"coreTriangleCount":16,"triangles":[[2,3,4],[4,5,6],[4,6,7],[7,8,9],[9,10,11],[7,9,11],[4,7,11],[2,4,11],[2,11,12],[1,2,12],[13,14,15],[12,13,15],[15,16,17],[12,15,17],[1,12,17],[0,1,17],[18,21,17],[16,15,14],[13,12,11],[8,7,6],[5,4,3],[3,2,1],[0,17,21],[18,17,16],[13,11,10],[0,3,1],[5,0,21],[18,16,14],[19,13,10],[0,5,3],[19,18,14],[6,5,21],[13,19,14],[6,21,20],[19,10,9],[8,6,20],[20,19,9],[9,8,20]],"rigid":[-0.0002944279145096053,-0.9999999566561006,0.9999999566561006,-0.0002944279145096053,43.962589807650474,34.09307356325364]},
  "59": {"sourceSurface":39,"targetSurface":33,"sourceVertexIndexes":[0,2,3,4,7,8,9,10,11,12,13,15,16,17,18,19,20,21,22,23],"targetVertexIndexes":[11,13,14,15,18,19,20,21,22,23,0,2,3,4,5,6,7,8,9,10],"coreTriangleCount":18,"triangles":[[2,3,4],[4,5,6],[4,6,7],[7,8,9],[7,9,10],[7,10,11],[4,7,11],[4,11,12],[2,4,12],[1,2,12],[14,15,16],[14,16,17],[13,14,17],[12,13,17],[1,12,17],[17,18,19],[1,17,19],[0,1,19],[20,23,19],[18,17,16],[15,14,13],[13,12,11],[8,7,6],[5,4,3],[3,2,1],[0,19,23],[20,19,18],[10,13,11],[0,3,1],[5,0,23],[20,18,16],[13,10,15],[0,5,3],[21,20,16],[21,15,10],[6,5,23],[15,21,16],[6,23,22],[21,10,9],[8,6,22],[22,21,9],[9,8,22]],"rigid":[-0.999999891799255,-0.0004651897229280482,0.0004651897229280482,-0.999999891799255,9.914864294739084,78.21843004844813]},
};
