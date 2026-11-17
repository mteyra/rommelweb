import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {difference, intersection, union, setPrecision} from 'polyclip-ts';
import {floorSection} from '../src/sections.js';
import {getLevelElevations} from '../src/interiors.js';
import {isIndependentLayout, pointInStudyOutline, validateInteriorStudies} from '../src/interior-studies.js';

const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const subtract = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b, scale = 1) => a.map((v, i) => v + b[i] * scale);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const close = points => [...points, [...points[0]]];
const rounded = point => point.map(value => Math.round(value * 1e9) / 1e9);
const ringArea = ring => Math.abs(ring.slice(1).reduce((sum, b, i) => sum + cross(ring[i], b), 0)) / 2;
export const polygonArea = polygon => ringArea(polygon[0]) - polygon.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0);
const sumArea = multi => multi.reduce((sum, polygon) => sum + polygonArea(polygon), 0);
const asPolygon = space => [space.polygon, ...(space.holes || [])];
const clean = multi => multi.filter(p => polygonArea(p) > 1e-7);
const geometry = polygon => ({polygon: polygon[0], ...(polygon.length > 1 ? {holes: polygon.slice(1)} : {})});
const digest = object => createHash('sha256').update(JSON.stringify(object)).digest('hex');

// These are alternatives selected from exterior frontage plausibility, not
// verified apartment inventories. L/R and the circulation retain House 55's
// topology as an explicit hypothesis. House 59's east inventory is unresolved.
export const BANK_COUNTS = {
  '51': {A: 5, W: 3, E: 3, N: 4, L: 3, R: 3},
  '53': {A: 4, W: 3, E: 3, N: 4, L: 3, R: 3},
  '57': {A: 4, W: 4, E: 3, N: 3, L: 3, R: 3},
  '59': {A: 4, W: 4, E: null, N: 3, L: 3, R: 3},
};
const BANKS = {
  A: ['A', 'B', 'C', 'D'], W: ['W1', 'W2', 'W3', 'W4'],
  E: ['E', 'F', 'G'], N: ['N1', 'N2', 'N3'],
  L: ['L1', 'L2', 'L3'], R: ['R1', 'R2', 'R3'],
};
const FRONTAGES = {
  '51': {A: [15, 16], W: [12, 13], E: [23, 0], N: [3, 2]},
  '53': {A: [23, 0], W: [20, 21], E: [9, 10], N: [13, 12]},
  '57': {A: [13, 14], W: [10, 11], E: [23, 0], N: [3, 2]},
  '59': {A: [10, 11], W: [7, 8], E: [20, 21], N: [0, 23]},
};
const SOURCE_FACADES = {A: [23, 0], W: [20, 21], E: [9, 10], N: [13, 12], L: [18, 17], R: [6, 7]};
const CENTRAL_FACADES = {'51': {L: [10, 7], R: [20, 21]}, '53': {L: [18, 17], R: [6, 7]},
  '57': {L: [8, 7], R: [20, 21]}, '59': {L: [5, 4], R: [17, 18]}};
const AREA_PARAMETERS = {
  targetInternalAreaSquareMetres: 16.4, externalFacadeAllowanceMetres: 0.20,
  otherExternalEndAllowanceMetres: 0.20, allocationBoundaryHalfWallMetres: 0.10,
  interpretation: 'Conditional internal-envelope benchmark borrowed from the operator category average, not a measured clear/rental area or verified individual apartment area.',
};
const HALL_APPROACH_METRES = 1.40;
const MAX_DEPTH_ADJUSTMENT_METRES = 0.20;
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

function serialize(multi) {
  return clean(multi).flatMap(polygon => {
    const rings = polygon.map(ring => simplifyRing(ring, true));
    return rings[0] ? [[rings[0], ...rings.slice(1).filter(Boolean)]] : [];
  });
}

function nodeSharedBoundaries(spaces) {
  const tolerance = 0.0000001;
  const ordered = [...spaces.filter(s => s.kind !== 'corridor'), ...spaces.filter(s => s.kind === 'corridor')];
  const vertices = [];
  const canonical = point => {
    const existing = vertices.find(p => Math.hypot(...subtract(p, point)) <= tolerance);
    if (existing) return existing;
    const copy = [...point]; vertices.push(copy); return copy;
  };
  ordered.forEach(space => asPolygon(space).forEach(ring => ring.slice(0, -1).forEach(canonical)));
  const node = ring => {
    const result = [];
    for (let i = 1; i < ring.length; i++) {
      const a = canonical(ring[i - 1]), b = canonical(ring[i]), d = subtract(b, a), length = Math.hypot(...d);
      if (length < 1e-8) continue;
      const inner = vertices.flatMap(p => {
        const along = dot(subtract(p, a), d) / (length * length);
        return along > 1e-8 && along < 1 - 1e-8 && Math.abs(cross(d, subtract(p, a))) / length < tolerance ? [{p, along}] : [];
      }).sort((first, last) => first.along - last.along).map(item => item.p);
      for (const p of [a, ...inner]) if (!result.length || Math.hypot(...subtract(p, result.at(-1))) > 1e-8) result.push([...p]);
    }
    return simplifyRing(close(result), false, true);
  };
  for (const space of spaces) {
    space.polygon = node(space.polygon);
    if (space.holes) space.holes = space.holes.map(node);
  }
}

function pruneThinHallTails(ring) {
  let points = ring.slice(0, -1);
  const signedArea = path => path.slice(1).reduce((sum, point, i) => sum + cross(path[i], point), 0) / 2;
  const direction = Math.sign(signedArea(ring));
  // The exact source intersection may leave a cap reached through a <2mm
  // mouth along a shaft face. Keep it as unassigned floor, not circulation.
  // Only remove a positive-area ear; never fill a concavity or move the shell.
  for (let pass = 0; pass < 100; pass++) {
    let replacement = null;
    for (let i = 0; i < points.length && !replacement; i++) {
      const sequence = [...points.slice(i), ...points.slice(0, i)], p = sequence[0];
      for (let j = 2; j < sequence.length - 1; j++) {
        const a = sequence[j], b = sequence[j + 1], d = subtract(b, a), lengthSquared = dot(d, d);
        if (lengthSquared < 1e-14) continue;
        const t = dot(subtract(p, a), d) / lengthSquared;
        if (t < 0 || t > 1) continue;
        const projection = add(a, d, t), width = Math.hypot(...subtract(p, projection));
        if (width > 0.002) continue;
        const ear = [...sequence.slice(0, j + 1), projection, p], lost = signedArea(ear) * direction;
        if (lost <= 1e-10 || lost > 0.01) continue;
        replacement = [p, projection, ...sequence.slice(j + 1)];
        break;
      }
    }
    if (!replacement) break;
    points = simplifyRing(close(replacement)).slice(0, -1);
  }
  return simplifyRing(close(points));
}

function snapUnresolvedZoneToSource(zone, sourceBoundary) {
  const segments = sourceBoundary.flatMap(polygon => polygon.flatMap(ring => ring.slice(1).map((b, i) => [ring[i], b])));
  return zone.map(polygon => polygon.map(ring => simplifyRing(close(ring.slice(0, -1).map(point => {
    const candidates = segments.map(([a, b]) => {
      const d = subtract(b, a), t = Math.max(0, Math.min(1, dot(subtract(point, a), d) / dot(d, d)));
      const projected = add(a, d, t);
      return {projected, distance: Math.hypot(...subtract(point, projected))};
    }).filter(candidate => candidate.distance <= 0.002).sort((a, b) => a.distance - b.distance);
    return candidates[0]?.projected || point;
  })))));
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

export function frontageCandidates(length, bank) {
  const overlapHypothesis = bank === 'W' ? 0.45 : 0;
  const gross = length + overlapHypothesis;
  return Array.from({length: 7}, (_, i) => i + 1).flatMap(count => {
    const range = [(gross - 0.60 - (count - 1) * 0.25) / count, (gross - 0.30 - (count - 1) * 0.10) / count];
    return range[0] <= 3.10 && range[1] >= 2.55 ? [{count, hypotheticalClearWidthRange: range}] : [];
  });
}

function sourceFacingBank(sourceZone, mapping, source, target, bank, count) {
  const sourceRoof = source.surfaces[39].points.map(([x, , z]) => [x, z]);
  const targetRoof = target.surfaces[mapping.manifest.targetSurface].points.map(([x, , z]) => [x, z]);
  const [sa, sb] = SOURCE_FACADES[bank].map(i => sourceRoof[i]);
  const sourceAxis = subtract(sb, sa).map(v => v / Math.hypot(...subtract(sb, sa)));
  const contact = sourceZone.flatMap(p => p[0].slice(0, -1))
    .filter(p => Math.abs(cross(sourceAxis, subtract(p, sa))) < 0.003);
  // R's source facade contains a 0.116m step. The apartment frontage is the
  // long lower face, while its estimated end may overhang that face in plan.
  if (contact.length < 2) throw new Error(`Cannot identify ${bank}'s source-facing bank endpoints`);
  const [ta, tb] = (FRONTAGES[target.number][bank] || CENTRAL_FACADES[target.number][bank]).map(i => targetRoof[i]);
  const axis = subtract(tb, ta).map(v => v / Math.hypot(...subtract(tb, ta)));
  const normal = [-axis[1], axis[0]];
  const mappedCenter = mapping.mapPoint(sourceZone[0][0].slice(0, -1).reduce((sum, p, _, all) => add(sum, p, 1 / all.length), [0, 0]));
  if (dot(subtract(mappedCenter, ta), normal) < 0) normal.forEach((v, i) => { normal[i] = -v; });
  const positions = contact.map(p => dot(mapping.mapPoint(p), axis)), low = Math.min(...positions), high = Math.max(...positions);
  const length = high - low, end = AREA_PARAMETERS.otherExternalEndAllowanceMetres, half = AREA_PARAMETERS.allocationBoundaryHalfWallMetres;
  const exteriorEnds = {A: [true, true], N: [true, true], W: [true, false], E: [true, false], L: [false, false], R: [false, false]}[bank];
  const endAllowances = exteriorEnds.map(exterior => exterior ? end : half);
  const clearWidth = (length - endAllowances[0] - endAllowances[1] - 2 * half * (count - 1)) / count;
  if (clearWidth <= 0) throw new Error('Bank frontage cannot contain positive clear-width alternatives');
  const depth = AREA_PARAMETERS.targetInternalAreaSquareMetres / clearWidth + AREA_PARAMETERS.externalFacadeAllowanceMetres + half;
  const facade = dot(ta, normal), point = (u, v) => add(axis.map(x => x * u), normal, v);
  const quad = (l, r, back, front) => close([point(l, back), point(r, back), point(r, front), point(l, front)]);
  const polygons = [], internalPolygons = [], cuts = [low];
  const extendToSourceWall = (ring, first, last) => {
    const points = ring.slice(0, -1).map(p => [...p]);
    points[0] = add(points[0], normal, -0.20); points[1] = add(points[1], normal, -0.20);
    if (first && exteriorEnds[0]) { points[0] = add(points[0], axis, -0.10); points[3] = add(points[3], axis, -0.10); }
    if (last && exteriorEnds[1]) { points[1] = add(points[1], axis, 0.10); points[2] = add(points[2], axis, 0.10); }
    return close(points);
  };
  for (let i = 0; i < count; i++) {
    const leftAllowance = i === 0 ? endAllowances[0] : half, rightAllowance = i === count - 1 ? endAllowances[1] : half;
    const l = cuts.at(-1), r = i === count - 1 ? high : l + clearWidth + leftAllowance + rightAllowance;
    polygons.push([extendToSourceWall(quad(l, r, facade, facade + depth), i === 0, i === count - 1)]);
    internalPolygons.push([quad(l + leftAllowance, r - rightAllowance,
      facade + AREA_PARAMETERS.externalFacadeAllowanceMetres, facade + depth - half)]);
    cuts.push(r);
  }
  return {zone: serialize([[extendToSourceWall(quad(low, high, facade, facade + depth), true, true)]]),
    polygons: serialize(polygons), internalPolygons: serialize(internalPolygons),
    metadata: {method: 'Straight exterior-facing bank quadrilateral with a conditional equal internal-envelope benchmark',
      frontageLength: length, clearWidth, grossDepth: depth, facadeVertexIndexes: FRONTAGES[target.number][bank] || CENTRAL_FACADES[target.number][bank],
      internalArea: AREA_PARAMETERS.targetInternalAreaSquareMetres, parameters: AREA_PARAMETERS, endAllowancesMetres: endAllowances,
      sourceWallClip: {outwardFacadeMaskMetres: 0.20, exteriorEndMaskMetres: 0.10, exteriorEnds,
        purpose: 'Clip the gross allocation to actual skewed source wall faces; retain the internal benchmark and avoid classifying thin wall-edge wedges as hallway.'}}};
}

function retreatBank(proposal, metres) {
  const transform = multi => multi.map(polygon => polygon.map(ring => {
    const points = ring.slice(0, -1), depth = subtract(points[3], points[0]);
    const unit = depth.map(v => v / Math.hypot(...depth));
    points[2] = add(points[2], unit, -metres); points[3] = add(points[3], unit, -metres);
    return close(points);
  }));
  return {...proposal, zone: transform(proposal.zone), polygons: transform(proposal.polygons), internalPolygons: transform(proposal.internalPolygons),
    metadata: {...proposal.metadata, grossDepth: proposal.metadata.grossDepth - metres, depthRetreatMetres: metres,
      internalArea: AREA_PARAMETERS.targetInternalAreaSquareMetres - proposal.metadata.clearWidth * metres,
      internalAreaShortfall: proposal.metadata.clearWidth * metres}};
}

function approaches(proposal, depth = HALL_APPROACH_METRES) {
  return proposal.polygons.map(([ring]) => {
    const [a, b, c, d] = ring, normal = subtract(d, a).map(v => v / Math.hypot(...subtract(d, a)));
    const along = subtract(b, a).map(v => v / Math.hypot(...subtract(b, a)));
    const center = add(c, subtract(d, c), 0.5), left = add(center, along, -0.45), right = add(center, along, 0.45);
    return [close([left, right, add(right, normal, depth), add(left, normal, depth)])];
  });
}

function approachSensitivity(proposal, validCore, otherZones) {
  const maximumDepth = (bay, sourceOnly) => {
    let low = 0, high = 3;
    for (let iteration = 0; iteration < 30; iteration++) {
      const midpoint = (low + high) / 2, rectangle = approaches(proposal, midpoint)[bay];
      const outside = sumArea(difference(rectangle, validCore));
      const collision = sourceOnly ? 0 : Math.max(0, ...otherZones.map(zone => sumArea(intersection(rectangle, zone))));
      if (outside <= 0.002 && collision <= 0.002) low = midpoint;
      else high = midpoint;
    }
    return low;
  };
  const bays = proposal.polygons.map((_, index) => ({
    bay: index + 1,
    maximumSourceContainedApproachMetres: maximumDepth(index, true),
    maximumUnobstructedApproachMetres: maximumDepth(index, false),
  }));
  const minimum = Math.min(...bays.map(bay => bay.maximumUnobstructedApproachMetres));
  return {
    depthRetreatEvaluatedMetres: MAX_DEPTH_ADJUSTMENT_METRES,
    doorwaySweepWidthMetres: 0.90, areaToleranceSquareMetres: 0.002, searchUpperBoundMetres: 3,
    minimumApproachAcrossBaysMetres: minimum,
    shortfallFrom140Metres: Math.max(0, HALL_APPROACH_METRES - minimum),
    passesApproachAt140Metres: minimum >= 1.40,
    passesApproachAt120Metres: minimum >= 1.20,
    bays,
    interpretation: 'Sensitivity only at the existing maximum depth retreat and unchanged frontage. The 1.40m guard is a study assumption, not a legal minimum or evidence that the actual building is impossible. Passing an alternative approach guard does not resolve other area, stair, boundary or topology constraints.',
  };
}

const edges = polygon => polygon.flatMap(ring => ring.slice(1).map((b, i) => [ring[i], b]));
function sharedEdges(from, to) {
  const shared = [];
  for (const [a, b] of edges(asPolygon(from))) {
    const d = subtract(b, a), length = Math.hypot(...d);
    if (length < 0.4) continue;
    const u = d.map(v => v / length);
    for (const [c, e] of edges(asPolygon(to))) {
      // Source room/corridor serialization differs by micrometres at some
      // corners. This 1mm matching tolerance remains below the runtime
      // boundary guard and never moves an official shell vertex.
      if (Math.abs(cross(u, subtract(c, a))) > 0.001 || Math.abs(cross(u, subtract(e, a))) > 0.001) continue;
      const ends = [dot(subtract(c, a), u), dot(subtract(e, a), u)].sort((x, y) => x - y);
      const low = Math.max(0, ends[0]), high = Math.min(length, ends[1]);
      if (high - low > 0.4) shared.push([add(a, u, low), add(a, u, high)]);
    }
  }
  return shared;
}

function doorBetween(from, halls, id, preferredPoint, allowUnresolved = false) {
  const distanceToSegment = (point, a, b) => {
    const vector = subtract(b, a), lengthSquared = dot(vector, vector);
    const fraction = Math.max(0, Math.min(1, dot(subtract(point, a), vector) / lengthSquared));
    return Math.hypot(...subtract(point, add(a, vector, fraction)));
  };
  const candidates = halls.flatMap(hall => sharedEdges(from, hall).flatMap(segment => {
    const length = Math.hypot(...subtract(segment[1], segment[0]));
    if (length < 0.95) return [];
    const unit = subtract(segment[1], segment[0]).map(v => v / length), normal = [-unit[1], unit[0]];
    const count = Math.max(1, Math.ceil((length - 0.95) / 0.05));
    return Array.from({length: count + 1}, (_, index) => {
      const along = 0.475 + (length - 0.95) * index / count;
      const center = add(segment[0], unit, along);
      const safeApproach = [-1, 1].some(sign => {
        const approach = add(center, normal, sign * 0.605);
        return pointInStudyOutline(approach, [{outer: hall.polygon, holes: hall.holes || []}])
          && edges(asPolygon(hall)).every(([a, b]) => distanceToSegment(approach, a, b) >= 0.60 - 1e-7);
      });
      return safeApproach ? [{hall, segment, length, unit, center}] : [];
    }).flat();
  }));
  candidates.sort((a, b) => {
    if (preferredPoint) {
      return Math.hypot(...subtract(a.center, preferredPoint)) - Math.hypot(...subtract(b.center, preferredPoint));
    }
    const centrality = candidate => Math.hypot(...subtract(candidate.center, add(candidate.segment[0], subtract(candidate.segment[1], candidate.segment[0]), 0.5)));
    return b.length - a.length || centrality(a) - centrality(b);
  });
  const candidate = candidates[0];
  if (!candidate && allowUnresolved) return null;
  if (!candidate) throw new Error(`${from.id} has no shared corridor boundary with a 1.20m circular study approach for an estimated door`);
  const {unit: u, center} = candidate;
  return {
    id, label: `Estimated opening · ${from.shortLabel}`, spaceId: from.id, toSpaceId: candidate.hall.id,
    confidence: 'estimated',
    note: 'Illustrative 0.90m opening on a shared study boundary with a 1.20m circular gross-hall approach. This is a geometry check, not a measured clear width or compliance claim. Position, width, hinge, numbering and actual access are unverified.',
    segment: [rounded(add(center, u, -0.45)), rounded(add(center, u, 0.45))],
  };
}

/** Produce only inferred target-house records; never overwrite House 55. */
export function generateOldHouseStudies({studies, lod2, campus, interiors, roomMarkers}, {validate = true} = {}) {
  // polyclip-ts interprets its orientation epsilon as a squared distance:
  // 1e-6 would silently collapse source jogs up to 1mm. Use its exact decimal
  // predicates; round only the derived geometry at explicit serialization.
  setPrecision();
  const source = lod2.buildings.find(b => b.number === '55');
  const top = studies.buildings['55']?.levels.find(level => level.index === 2);
  if (top?.layoutBasis === 'resident-module-layout') {
    throw new Error('Independent module layouts require their floor-specific generators; use the retained pre-module studies to reproduce historical other-house records');
  }
  if (!top || top.spaces.filter(s => s.kind === 'room').length !== 20) throw new Error('The current twenty-room House 55 top study is required');
  const result = {schemaVersion: 1, buildings: {}};
  const metadata = {
    method: 'Source-facing straight bank quadrilaterals; conditional area/depth comparison; unchanged official floor sections.',
    methodVersion: 2,
    status: 'Inferred comparative study. No target-house room position, number, door, stair, window or floor elevation has been resident-verified.',
    template: {house: '55', floorIndex: 2, levelSha256: digest(top), roomCount: 20},
    areaMeaning: 'Room polygon areas are gross allocations. The 16.4m² internal envelope is a conditional category-average benchmark with explicit wall allowances; it is not a measured apartment area.',
    areaParameters: AREA_PARAMETERS,
    circulationStudyGuard: {grossDoorApproachMetres: HALL_APPROACH_METRES,
      assumedAllocationHalfWallMetres: 0.10, nominalClearApproachMetres: 1.20,
      maximumDepthRetreatMetres: MAX_DEPTH_ADJUSTMENT_METRES,
      caveat: 'A geometric study guard, not evidence of actual corridor width or a compliance test. A retreat records an explicit area shortfall.'},
    widthHypothesis: {clearRangeMetres: [2.55, 3.10], partitionRangeMetres: [0.10, 0.25],
      externalEndRangeMetres: [0.15, 0.30], westCornerOverlapMetres: 0.45,
      caveat: 'All width and overlap allowances are inherited comparison assumptions, not target-house measurements.'},
    computationalTolerance: {serializedMetres: 0.000000001, minimumEdgeMetres: 0.0000001, sharedBoundaryNodeMetres: 0.0000001, doorBoundaryMatchMetres: 0.001,
      maximumCollapsedLoopSquareMetres: 0.0001,
      hallTailRemoval: {maximumMouthMetres: 0.002, maximumCapSquareMetres: 0.01,
        meaning: 'Thin source-intersection appendages are left unassigned; they are not represented as circulation.'},
      note: 'Microscopic clipping artifacts are simplified in inferred geometry only. Official floor outline vertices remain byte-identical.'},
    houses: {},
  };
  for (const number of Object.keys(BANK_COUNTS)) {
    const retained = studies.buildings[number];
    if (retained?.levels.some(isIndependentLayout)) {
      result.buildings[number] = structuredClone(retained);
      continue;
    }
    const target = lod2.buildings.find(b => b.number === number), mapped = campus.buildings.find(b => b.number === number);
    if (mapped.levels !== 3) throw new Error(`House ${number} floor count changed`);
    const mapping = createRegistration(source, target), [a, b, d, e] = mapping.manifest.rigid;
    const targetFlat = target.surfaces[mapping.manifest.targetSurface].points.map(([x, , z]) => [x, z]);
    const mappedCoreDomain = [[targetFlat]];
    const norm = Math.hypot(0.676, 0.737), base = [0.676 / norm, 0.737 / norm], axisU = [a * base[0] + b * base[1], d * base[0] + e * base[1]], axisV = [-axisU[1], axisU[0]];
    const banks = {}, coreSpaces = [], occupiedZones = [], proposals = {};
    for (const [bank, labels] of Object.entries(BANKS)) {
      const sourceRooms = labels.map(label => top.spaces.find(space => space.shortLabel === label));
      if (sourceRooms.some(room => !room || room.kind !== 'room')) throw new Error(`House 55 ${bank} template bank changed`);
      const sourceZone = union(...sourceRooms.map(asPolygon));
      let zone = mapping.mapPolygons(sourceZone);
      const count = BANK_COUNTS[number][bank];
      const frontage = FRONTAGES[number][bank];
      const roof = target.surfaces[mapping.manifest.targetSurface];
      const length = frontage ? Math.hypot(roof.points[frontage[1]][0] - roof.points[frontage[0]][0], roof.points[frontage[1]][2] - roof.points[frontage[0]][2]) : null;
      banks[bank] = {
        selectedCount: count, countBasis: ['L', 'R'].includes(bank) ? 'House 55 central-bank hypothesis only' : count ? 'Exterior frontage compatibility under explicit width allowances' : 'Unresolved alternatives',
        sourceRoofVertexIndexes: frontage || null, sourceFrontageMetres: length,
        widthCandidates: length ? frontageCandidates(length, bank) : null,
        sourceZoneArea: sumArea(sourceZone), mappedZoneArea: sumArea(zone),
        mappedAreaRatio: sumArea(zone) / sumArea(sourceZone),
      };
      if (count === null) {
        banks[bank].alternatives = [
          {count: 3, implication: 'Wider bays than the adopted typical-width comparison range; would give 20 candidate core rooms.'},
          {count: 4, implication: 'Typical frontage widths under comparison allowances; would give 21 candidate core rooms, unlike the source top index total of 20.'},
        ];
        coreSpaces.push({
          key: 'bank-e-unresolved', label: 'E bank · unresolved', shortLabel: 'E bank', kind: 'service',
          note: 'Unassigned function, not an established service room. Three wider bays or four typical-width bays remain alternatives; the latter conflicts with the public top-floor index total. No room count or doorway is inferred here.',
          multi: zone,
        });
        occupiedZones.push(zone);
        continue;
      }
      const proposal = sourceFacingBank(sourceZone, mapping, source, target, bank, count);
      proposals[bank] = {...proposal, originalZone: zone};
      zone = proposal.zone;
      banks[bank].straightFit = proposal.metadata;
      const pieces = proposal.polygons;
      for (let i = 0; i < pieces.length; i++) coreSpaces.push({
        key: `bank-${bank.toLowerCase()}-${i + 1}`, label: `${bank}${i + 1} · estimated layout`,
        shortLabel: `${bank}${i + 1}`, kind: 'room', bank,
        note: `Unverified House ${number} ${bank}-bank hypothesis, bay ${i + 1} of ${count}. A straight source-facing envelope uses the conditional 16.4m² category-average benchmark with estimated wall allowances. Actual apartment dimensions, internal partitions and numbering remain unknown; the letter is a study reference only.`,
        multi: [pieces[i]],
      });
    }
    for (const space of top.spaces.filter(s => s.kind !== 'room')) {
      const mappedSpace = mapping.mapPolygons([asPolygon(space)]);
      if (space.kind !== 'corridor') occupiedZones.push(mappedSpace);
      coreSpaces.push({
        key: space.kind === 'corridor' ? (space.shortLabel === 'West hall' ? 'west-hall' : 'east-hall') : space.kind === 'stairs' ? 'stairs' : 'unassigned-stair-side',
        originalId: space.id, label: space.kind === 'service' ? 'Unassigned · inherited study' : `${space.shortLabel} · estimated`,
        shortLabel: space.kind === 'service' ? 'Unassigned' : space.shortLabel, kind: space.kind,
        note: space.kind === 'service'
          ? 'Unassigned residue of the inherited core hypothesis. Actual use and access are unknown; no doorway or passage is inferred.'
          : 'Inferred from the House 55 circulation topology and fitted continuously to this building. West hall and East hall are donor-relative study labels, not geographic compass directions here. The target house has not been internally surveyed; no stair alignment ratio or doorway has been independently confirmed.',
        multi: mappedSpace,
        ...(space.stairFlight ? {flight: close(space.stairFlight.slice(0, -1).map(mapping.mapPoint))} : {}),
      });
    }
    const rejected = new Map(), reject = (bank, reason) => rejected.set(bank, [...(rejected.get(bank) || []), reason]);
    const topSection = floorSection(target, getLevelElevations(interiors, number, mapped.levels, target.height)[2]);
    const topPlate = topSection.polygons.map(p => [p.outer, ...p.holes]);
    const validCore = serialize(intersection(mappedCoreDomain, topPlate));
    // The undivided E-zone is not a measured room. Its source-facing edge
    // follows the actual wall instead of leaving a sub-2mm "hall" around it.
    for (const core of coreSpaces.filter(space => space.key === 'bank-e-unresolved')) {
      core.multi = snapUnresolvedZoneToSource(core.multi, validCore);
      banks.E.sourceBoundarySnapMetres = 0.002;
    }
    for (const [bank, original] of Object.entries(proposals)) {
      let chosen = null, lastFailure = null;
      for (let centimetres = 0; centimetres <= MAX_DEPTH_ADJUSTMENT_METRES * 100; centimetres++) {
        const candidate = retreatBank(original, centimetres / 100);
        const doors = approaches(candidate);
        const outside = Math.max(...doors.map(p => sumArea(difference(p, validCore))));
        const collisions = Object.entries(proposals).filter(([other]) => other !== bank)
          .flatMap(([, other]) => doors.map(p => sumArea(intersection(p, other.zone))));
        const obstructed = Math.max(0, ...collisions);
        if (outside <= 0.002 && obstructed <= 0.002) { chosen = candidate; break; }
        lastFailure = {outside, obstructed};
      }
      if (!chosen) {
        reject(bank, `Cannot retain the ${HALL_APPROACH_METRES.toFixed(2)}m gross doorway approach within a ${MAX_DEPTH_ADJUSTMENT_METRES.toFixed(2)}m depth adjustment (outside ${lastFailure.outside.toFixed(3)}m²; conflicting bank ${lastFailure.obstructed.toFixed(3)}m²).`);
        continue;
      }
      proposals[bank] = chosen; banks[bank].straightFit = chosen.metadata;
      coreSpaces.filter(space => space.bank === bank).forEach((space, i) => {
        space.multi = [chosen.polygons[i]];
        if (chosen.metadata.depthRetreatMetres) space.note += ` The hallway guard retreats this envelope by ${chosen.metadata.depthRetreatMetres.toFixed(2)}m, leaving about ${chosen.metadata.internalArea.toFixed(2)}m² inside the assumed wall allowances; the 16.4m² benchmark is not met.`;
      });
    }
    for (const [bank, proposal] of Object.entries(proposals)) {
      const outside = sumArea(difference(proposal.zone, validCore));
      const internalOutside = proposal.internalPolygons.map(polygon => sumArea(difference(polygon, validCore)));
      banks[bank].straightFit.areaOutsideSourceCore = outside;
      banks[bank].straightFit.internalAreaOutsideSourceCore = internalOutside;
      if (internalOutside.some(area => area > 0.01)) reject(bank, `Internal envelope leaves the source core by up to ${Math.max(...internalOutside).toFixed(3)}m².`);
      for (const fixed of coreSpaces.filter(s => s.kind === 'stairs')) {
        const overlap = Math.max(...proposal.internalPolygons.map(polygon => sumArea(intersection(polygon, fixed.multi))));
        if (overlap > 0.01) reject(bank, `Internal bank envelope intersects inherited ${fixed.shortLabel} by ${overlap.toFixed(3)}m²; its access cannot be invented.`);
      }
    }
    for (const [bank, proposal] of Object.entries(proposals)) for (const [otherBank, other] of Object.entries(proposals)) {
      if (bank >= otherBank) continue;
      const overlap = sumArea(intersection(proposal.zone, other.zone));
      if (overlap > 0.02) {
        const central = [bank, otherBank].filter(b => ['L', 'R'].includes(b));
        for (const b of central.length ? central : [bank, otherBank]) reject(b, `Conditional straight banks ${bank}/${otherBank} overlap by ${overlap.toFixed(3)}m².`);
      }
    }
    for (const [bank, proposal] of Object.entries(proposals)) {
      banks[bank].straightFit.internalEnvelopePolygons = structuredClone(proposal.internalPolygons);
      banks[bank].straightFit.internalEnvelopeMeaning = 'Conditional comparison envelope before final source clipping; not an observed internal wall or fitted apartment plan.';
      if (rejected.has(bank)) {
        if (['L', 'R'].includes(bank)) {
          banks[bank].straightFit.approachSensitivity = approachSensitivity(
            retreatBank(proposal, MAX_DEPTH_ADJUSTMENT_METRES),
            validCore,
            Object.entries(proposals).filter(([other]) => other !== bank).map(([, other]) => other.zone),
          );
        }
        for (let i = coreSpaces.length - 1; i >= 0; i--) if (coreSpaces[i].bank === bank) coreSpaces.splice(i, 1);
        banks[bank].straightFit.accepted = false; banks[bank].straightFit.rejectionReasons = rejected.get(bank);
        banks[bank].displayedRoomCount = 0;
        const cuts = Object.entries(proposals).filter(([other]) => !rejected.has(other)).map(([, p]) => p.zone);
        const zone = serialize(cuts.length ? difference(proposal.originalZone, ...cuts) : proposal.originalZone);
        zone.forEach((polygon, i) => {
          coreSpaces.push({key: `bank-${bank.toLowerCase()}-unresolved-${i + 1}`, label: `${bank} bank · unresolved`, shortLabel: `${bank} bank`, kind: 'service',
            note: `Unassigned bank function, not an established service room. The ${BANK_COUNTS[number][bank]}-bay hypothesis cannot meet the conditional internal-area and source/core constraints without changing unknown stairs, access or boundaries. No apartment partitions or doorways are asserted.`,
            multi: [polygon]});
          occupiedZones.push([polygon]);
        });
      } else {
        banks[bank].straightFit.accepted = true; banks[bank].displayedRoomCount = BANK_COUNTS[number][bank];
        const stairs = coreSpaces.filter(s => s.kind === 'stairs').map(s => s.multi);
        occupiedZones.push(difference(intersection(proposal.zone, validCore), ...stairs));
        for (const core of coreSpaces.filter(s => s.bank === bank)) core.multi = difference(intersection(core.multi, validCore), ...stairs);
      }
    }
    const acceptedZones = Object.entries(proposals).filter(([bank]) => !rejected.has(bank)).map(([, p]) => p.zone);
    // An unassigned residue is not evidence of a service room in a different
    // house. It yields to the accepted bank hypothesis, without creating a
    // passage or fabricating an entrance.
    for (const core of coreSpaces.filter(s => s.key === 'unassigned-stair-side')) {
      const previous = core.multi, remaining = serialize(difference(previous, ...acceptedZones));
      const position = occupiedZones.indexOf(previous);
      if (position !== -1) occupiedZones.splice(position, 1);
      if (remaining.length !== 1) throw new Error(`House ${number} unassigned stair-side residue became disconnected`);
      core.multi = remaining; occupiedZones.push(remaining);
    }
    const elevations = getLevelElevations(interiors, number, mapped.levels, target.height);
    const houseMeta = {
      officialId: target.id, officialSurfaceSha256: digest(target.surfaces),
      registration: {
        sourceSurfaceIndex: mapping.manifest.sourceSurface, targetSurfaceIndex: mapping.manifest.targetSurface,
        sourceVertexIndexes: mapping.manifest.sourceVertexIndexes, targetVertexIndexes: mapping.manifest.targetVertexIndexes,
        rigidCageTransform: mapping.manifest.rigid, triangleCount: mapping.triangles.length,
        minimumAreaJacobian: Math.min(...mapping.triangles.map(t => t.determinant)), maximumAreaJacobian: Math.max(...mapping.triangles.map(t => t.determinant)),
        allTrianglesOrientationPreserving: true,
        caveat: number === '57' ? 'Two incompatible northern-notch controls were omitted from the smooth interior mapping. Actual target floor clipping retains that source notch.' : 'Correspondence fits the stepped family; it is not evidence of identical internal construction.',
      },
      banks, inferredCoreRoomCount: coreSpaces.filter(s => s.kind === 'room').length,
      sourceIndexCounts: roomMarkers?.summary?.[number]?.floors || null,
      sourceIndexCaveat: 'Public index aggregates are comparison evidence only, not approved apartment counts, geometry or occupancy.',
      levels: [],
    };
    const levels = elevations.map((elevation, index) => {
      const section = floorSection(target, elevation);
      if (section.openChains.length || !section.polygons.length) throw new Error(`House ${number} floor ${index} source section is not closed`);
      const plate = section.polygons.map(p => [p.outer, ...p.holes]);
      const level = {
        index, label: `${index === 0 ? 'EG' : `${index}. OG`} · inferred study`,
        ...(index < 2 ? {extrapolatedFrom: 2} : {}),
        source: 'Official LoD2 exterior section with a continuous House 55 bank-zone comparison and target-specific frontage hypotheses. No interior plan of this house is available.',
        notes: `All spaces and doors are estimated. This ${index < 2 ? 'lower floor repeats the inferred top core within its own complete exterior section' : 'top floor uses exterior-compatible bank counts; central L/R and stair topology remain inherited assumptions'}. Remaining plate areas are unassigned, including roof-related or additional wings. Displayed references are not official room numbers or a complete inventory. Windows, material bands and resident-confirmed House 55 observations are not transferred.${number === '59' ? ' The east bank is deliberately undivided because its room count remains unresolved.' : ''}`,
        floorOutline: structuredClone(section.polygons), spaces: [], doors: [],
      };
      const roomMetrics = [], clippedMetrics = [];
      for (const core of coreSpaces) {
        if (core.kind === 'corridor') continue;
        // Exact clipping uses each floor's own shell, including small lower
        // wall offsets. The runtime's point-on-boundary allowance is not used
        // as a substitute for geometric containment.
        const clipped = serialize(intersection(core.multi, plate));
        if (clipped.length !== 1) throw new Error(`House ${number}/${index}/${core.key} is ${clipped.length ? 'disconnected' : 'absent'} after source-floor clipping`);
        const space = {
          id: `study-${number}-${index}-${core.key}`, label: core.label, shortLabel: core.shortLabel,
          kind: core.kind, confidence: 'estimated', note: core.note, ...geometry(clipped[0]),
        };
        if (core.flight && sumArea(difference([core.flight], clipped)) < 1e-6) space.stairFlight = core.flight.map(rounded);
        level.spaces.push(space);
        const before = sumArea(core.multi), after = sumArea(clipped), loss = Math.max(0, before - after);
        clippedMetrics.push({id: space.id, areaRemovedBySourceClip: loss, retainedFraction: after / before});
        if (space.kind === 'room') {
          const valuesU = space.polygon.map(p => dot(p, axisU)), valuesV = space.polygon.map(p => dot(p, axisV));
          const spans = [Math.max(...valuesU) - Math.min(...valuesU), Math.max(...valuesV) - Math.min(...valuesV)];
          const sourceRoomMean = banks[core.bank].sourceZoneArea / BANKS[core.bank].length;
          roomMetrics.push({id: space.id, bank: core.bank, grossArea: after,
            grossAxisSpansMetres: spans, axisBoxFillRatio: after / (spans[0] * spans[1]),
            sourceBankMeanGrossArea: sourceRoomMean, relativeToSourceBankMean: after / sourceRoomMean,
            comparisonFlags: [
              ...(after / sourceRoomMean < 0.80 || after / sourceRoomMean > 1.20 ? ['Gross area differs by more than 20% from the source-bank mean; this screening threshold is not an apartment standard.'] : []),
              ...(after / (spans[0] * spans[1]) < 0.85 ? ['Nonrectangular allocation loses more than 15% of its axis box; inspect bent bank mapping.'] : []),
            ]});
        }
      }
      // Reconstruct the complementary halls from shared room/shaft boundaries.
      // Mapping independently serialized source hallway edges can differ from
      // their room edge by micrometres after bending; the complement shares the
      // exact new bank dividers and cannot create overlapping circulation.
      // Small exterior jogs omitted by the audited landmark correspondence
      // must not become millimetre-wide "hallways" around the mapped shaft.
      // Keep those source-profile differences unassigned.
      const corePlate = serialize(intersection(validCore, [close(mapping.targetPoints.slice(0, -4))], plate));
      const coreBoundary = corePlate.map(polygon => ({kind: 'corridor', ...geometry(polygon)}));
      nodeSharedBoundaries([...level.spaces, ...coreBoundary]);
      const bankZones = Object.keys(BANKS).flatMap(bank => {
        const spaces = level.spaces.filter(s => s.id.includes(`-bank-${bank.toLowerCase()}-`)).map(asPolygon);
        return spaces.length ? [spaces.length === 1 ? [spaces[0]] : union(...spaces)] : [];
      });
      const fixedZones = level.spaces.filter(s => !s.id.includes('-bank-')).map(asPolygon);
      const complement = serialize(difference(coreBoundary.map(asPolygon), ...bankZones, ...fixedZones));
      const hallPieces = complement.filter(polygon => polygonArea(polygon) > 1);
      const hallTemplates = coreSpaces.filter(s => s.kind === 'corridor');
      if (hallPieces.length !== hallTemplates.length) {
        throw new Error(`House ${number}/${index} mapped core has ${hallPieces.length} circulation components instead of ${hallTemplates.length}`);
      }
      for (const core of hallTemplates) {
        const center = polygon => polygon[0].slice(0, -1).reduce((sum, p, _, points) => add(sum, p, 1 / points.length), [0, 0]);
        const expectedCenter = center(core.multi[0]);
        const piece = hallPieces.map(polygon => ({polygon, distance: Math.hypot(...subtract(center(polygon), expectedCenter))}))
          .sort((a, b) => a.distance - b.distance)[0]?.polygon;
        if (!piece) throw new Error('An inferred hall lost its topological correspondence');
        hallPieces.splice(hallPieces.indexOf(piece), 1);
        level.spaces.push({id: `study-${number}-${index}-${core.key}`, label: core.label, shortLabel: core.shortLabel,
          kind: 'corridor', confidence: 'estimated', note: core.note, ...geometry([pruneThinHallTails(piece[0]), ...piece.slice(1)])});
      }
      nodeSharedBoundaries(level.spaces);
      for (const hall of level.spaces.filter(space => space.kind === 'corridor')) hall.polygon = pruneThinHallTails(hall.polygon);
      for (const metric of roomMetrics) {
        const space = level.spaces.find(s => s.id === metric.id), area = polygonArea(asPolygon(space));
        const valuesU = space.polygon.map(p => dot(p, axisU)), valuesV = space.polygon.map(p => dot(p, axisV));
        const spans = [Math.max(...valuesU) - Math.min(...valuesU), Math.max(...valuesV) - Math.min(...valuesV)];
        metric.grossArea = area;
        metric.grossAxisSpansMetres = spans;
        metric.axisBoxFillRatio = area / (spans[0] * spans[1]);
        metric.relativeToSourceBankMean = area / metric.sourceBankMeanGrossArea;
      }
      const halls = level.spaces.filter(s => s.kind === 'corridor');
      for (const room of level.spaces.filter(s => s.kind === 'room')) {
        level.doors.push(doorBetween(room, halls, `${room.id}-opening`));
      }
      const stairs = level.spaces.find(s => s.kind === 'stairs'), stairCore = coreSpaces.find(s => s.kind === 'stairs');
      const sourceOpening = top.doors.find(door => door.spaceId === stairCore.originalId);
      if (sourceOpening) {
        const originalHall = coreSpaces.find(s => s.originalId === sourceOpening.toSpaceId);
        const destination = halls.find(hall => hall.id.endsWith(`-${originalHall.key}`));
        const center = add(sourceOpening.segment[0], subtract(sourceOpening.segment[1], sourceOpening.segment[0]), 0.5);
        const doorway = doorBetween(stairs, [destination], `${stairs.id}-opening`, mapping.mapPoint(center), true);
        if (doorway) level.doors.push(doorway);
        else {
          stairs.note += ' No supported stair doorway is displayed: the inherited boundary has no 0.90m opening with the illustrative 1.20m gross circular approach. Actual access from either hall remains unknown.';
          level.notes += ' Stair access is unresolved; no route to the inherited stair is asserted.';
        }
      }
      const finalBankZones = Object.keys(BANKS).flatMap(bank => {
        const polygons = level.spaces.filter(s => s.id.includes(`-bank-${bank.toLowerCase()}-`)).map(asPolygon);
        return polygons.length ? [polygons.length === 1 ? [polygons[0]] : union(...polygons)] : [];
      });
      const finalOtherZones = level.spaces.filter(s => !s.id.includes('-bank-')).map(asPolygon);
      const residue = clean(difference(plate, ...finalBankZones, ...finalOtherZones));
      const assignedStudyArea = level.spaces.reduce((sum, space) => sum + polygonArea(asPolygon(space)), 0);
      houseMeta.levels.push({
        index, sourceFloorElevation: elevation, sourceFloorArea: section.area,
        assignedStudyArea, unassignedArea: sumArea(residue),
        roomCount: roomMetrics.length, roomMetrics, clipping: clippedMetrics,
        grossAreaRange: [Math.min(...roomMetrics.map(r => r.grossArea)), Math.max(...roomMetrics.map(r => r.grossArea))],
        unassignedPolygons: residue.map(p => ({outer: p[0], holes: p.slice(1)})),
      });
      return level;
    });
    result.buildings[number] = {
      source: 'Inferred interiors adapted from House 55 to official exterior landmarks. All target-house counts, positions, circulation and doorways remain hypotheses pending resident floor plans.',
      sourceDate: '2026-11-15', levels,
    };
    metadata.houses[number] = houseMeta;
  }
  if (validate) validateInteriorStudies(result, campus, lod2);
  return {studies: result, metadata};
}

async function main() {
  const arguments_ = process.argv.slice(2), option = (flag, fallback) => {
    const index = arguments_.indexOf(flag); return index === -1 ? fallback : arguments_[index + 1];
  };
  const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
  const [studies, lod2, campus, interiors, roomMarkers] = await Promise.all([
    read('public/data/interior-studies.json'), read('public/data/lod2.json'), read('public/data/campus.json'),
    read('public/data/interiors.json'), read('public/data/room-markers.json'),
  ]);
  const generated = generateOldHouseStudies({studies, lod2, campus, interiors, roomMarkers});
  const output = option('--output', '/tmp/rommel-old-house-studies.json');
  const metadataOutput = option('--metadata', '/tmp/rommel-old-house-studies-metadata.json');
  await writeFile(output, `${JSON.stringify(generated.studies, null, 2)}\n`);
  await writeFile(metadataOutput, `${JSON.stringify(generated.metadata, null, 2)}\n`);
  console.log(JSON.stringify({output, metadataOutput, houses: Object.fromEntries(Object.entries(generated.metadata.houses)
    .map(([number, house]) => [number, {rooms: house.inferredCoreRoomCount, grossAreaRange: house.levels[2].grossAreaRange,
      unassignedTopArea: house.levels[2].unassignedArea}]))}, null, 2));
}


// Audited corresponding exterior landmarks and common triangulations.
// Only inferred interior geometry is deformed; the official source is immutable.
// 57 omits the two contradictory northern-notch controls; its actual shell is
// still used for floor clipping. The outer cage extends the continuous map.
export const REGISTRATION = {
  "51": {"sourceSurface":39,"targetSurface":1,"sourceVertexIndexes":[0,2,3,4,7,8,9,10,11,12,13,15,16,17,18,19,20,21,22,23],"targetVertexIndexes":[16,18,19,20,21,22,23,0,1,2,3,5,6,7,10,11,12,13,14,15],"coreTriangleCount":18,"triangles":[[4,5,6],[7,8,9],[7,9,10],[7,10,11],[6,7,11],[4,6,11],[3,4,11],[2,3,11],[2,11,12],[12,13,14],[2,12,14],[1,2,14],[14,15,16],[1,14,16],[1,16,17],[17,18,19],[1,17,19],[0,1,19],[20,23,19],[18,17,16],[15,14,13],[13,12,11],[8,7,6],[5,4,3],[3,2,1],[0,19,23],[20,19,18],[10,13,11],[0,3,1],[5,0,23],[20,18,16],[13,10,15],[0,5,3],[21,20,16],[21,15,10],[6,5,23],[15,21,16],[6,23,22],[21,10,9],[8,6,22],[22,21,9],[9,8,22]],"rigid":[0.0016540710012037043,-0.9999986320236258,0.9999986320236258,0.0016540710012037043,-32.04511504843866,-20.707546150980498]},
  "53": {"sourceSurface":39,"targetSurface":7,"sourceVertexIndexes":[0,2,3,4,7,8,9,10,11,12,13,15,16,17,18,19,20,21,22,23],"targetVertexIndexes":[0,2,3,4,7,8,9,10,11,12,13,15,16,17,18,19,20,21,22,23],"coreTriangleCount":18,"triangles":[[2,3,4],[4,5,6],[4,6,7],[7,8,9],[4,7,9],[9,10,11],[4,9,11],[4,11,12],[12,13,14],[4,12,14],[2,4,14],[1,2,14],[14,15,16],[1,14,16],[1,16,17],[17,18,19],[1,17,19],[0,1,19],[20,23,19],[18,17,16],[15,14,13],[13,12,11],[8,7,6],[5,4,3],[3,2,1],[0,19,23],[20,19,18],[10,13,11],[0,3,1],[5,0,23],[20,18,16],[13,10,15],[0,5,3],[21,20,16],[21,15,10],[6,5,23],[15,21,16],[6,23,22],[21,10,9],[8,6,22],[22,21,9],[9,8,22]],"rigid":[0.9999995371046133,0.0009621801073968473,-0.0009621801073968473,0.9999995371046133,-21.985629717295698,-59.237072572630346]},
  "57": {"sourceSurface":39,"targetSurface":30,"sourceVertexIndexes":[0,2,3,4,7,8,9,10,11,12,13,15,18,19,20,21,22,23],"targetVertexIndexes":[14,16,17,18,21,22,23,0,1,2,3,5,8,9,10,11,12,13],"coreTriangleCount":16,"triangles":[[2,3,4],[4,5,6],[4,6,7],[7,8,9],[9,10,11],[7,9,11],[4,7,11],[2,4,11],[2,11,12],[1,2,12],[13,14,15],[12,13,15],[15,16,17],[12,15,17],[1,12,17],[0,1,17],[18,21,17],[16,15,14],[13,12,11],[8,7,6],[5,4,3],[3,2,1],[0,17,21],[18,17,16],[13,11,10],[0,3,1],[5,0,21],[18,16,14],[19,13,10],[0,5,3],[19,18,14],[6,5,21],[13,19,14],[6,21,20],[19,10,9],[8,6,20],[20,19,9],[9,8,20]],"rigid":[-0.0002944279145096053,-0.9999999566561006,0.9999999566561006,-0.0002944279145096053,43.962589807650474,34.09307356325364]},
  "59": {"sourceSurface":39,"targetSurface":33,"sourceVertexIndexes":[0,2,3,4,7,8,9,10,11,12,13,15,16,17,18,19,20,21,22,23],"targetVertexIndexes":[11,13,14,15,18,19,20,21,22,23,0,2,3,4,5,6,7,8,9,10],"coreTriangleCount":18,"triangles":[[2,3,4],[4,5,6],[4,6,7],[7,8,9],[7,9,10],[7,10,11],[4,7,11],[4,11,12],[2,4,12],[1,2,12],[14,15,16],[14,16,17],[13,14,17],[12,13,17],[1,12,17],[17,18,19],[1,17,19],[0,1,19],[20,23,19],[18,17,16],[15,14,13],[13,12,11],[8,7,6],[5,4,3],[3,2,1],[0,19,23],[20,19,18],[10,13,11],[0,3,1],[5,0,23],[20,18,16],[13,10,15],[0,5,3],[21,20,16],[21,15,10],[6,5,23],[15,21,16],[6,23,22],[21,10,9],[8,6,22],[22,21,9],[9,8,22]],"rigid":[-0.999999891799255,-0.0004651897229280482,0.0004651897229280482,-0.999999891799255,9.914864294739084,78.21843004844813]},
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
