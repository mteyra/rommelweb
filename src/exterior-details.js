import {ShapeUtils, Vector2} from 'three';
import {surfaceFrame} from './facade.js';
import {addHouse55Entrance} from './house55-entrance.js';
import {addHouse51PhotoDetails} from './house51-photo-details.js';
import {addHouse53PhotoDetails} from './house53-photo-details.js';
import {addBlackHousePhotoDetails} from './black-house-photo-details.js';
import {addBlueCourtyardPhotoDetails} from './blue-courtyard-photo-details.js';
import {addTurquoisePhotoDetails} from './turquoise-photo-details.js';
import {addPinkHousePhotoDetails} from './pink-house-photo-details.js';
import {addLilaPhotoDetails} from './lila-photo-details.js';
import {addGrauPhotoDetails} from './grau-photo-details.js';
import {addWhiteHousePhotoDetails} from './white-house-photo-details.js';

/**
 * Replaceable photographic façade details, in the unmodified campus metre frame.
 * A mask only changes presentation of its source face. It never edits LoD2,
 * floor sections, the interior study, building placement or overall dimensions.
 */
const add = (a, b) => a.map((value, i) => value + b[i]);
const sub = (a, b) => a.map((value, i) => value - b[i]);
const mul = (a, factor) => a.map(value => value * factor);
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const unit = a => mul(a, 1 / Math.hypot(...a));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const atY = (point, y) => [point[0], y, point[2]];
const closed = ring => [...ring, [...ring[0]]];
const lerp = (a, b, fraction) => add(a, mul(sub(b, a), fraction));
const polygonAreaXZ = ring => Math.abs(ring.slice(1).reduce((sum, p, i) => sum + ring[i][0] * p[2] - p[0] * ring[i][2], 0) / 2);

function insideXZ(point, ring) {
  let result = false;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i];
    if ((a[2] > point[2]) !== (b[2] > point[2]) &&
      point[0] < (b[0] - a[0]) * (point[2] - a[2]) / (b[2] - a[2]) + a[0]) result = !result;
  }
  return result;
}

function roofContains(roof, polygon) {
  return polygon.every(point => insideXZ(point, roof.points) && !(roof.holes || []).some(hole => insideXZ(point, hole)));
}

/** Isolated pure output, kept separate from scene and material ownership. */
export function createExteriorDetails(building, {house = building.number, levels, absoluteFloorElevations} = {}) {
  const output = {
    exclusionsBySurface: new Map(), layoutsBySurface: new Map(),
    triangleLayers: {}, segmentLayers: {}, features: [],
    status: 'Resident-photo-informed appearance study. Face registration is source-based; recess depths, rails, roof hardware and unmeasured placements are estimates.',
  };
  if (!building?.surfaces?.length) return output;
  house = String(house);
  levels ??= {'51a': 3, '53a': 5, '55a': 6, '49': 6, '57a': 8, '59a': 6}[house] || 3;
  const highest = Math.max(...building.surfaces.flatMap(surface => surface.points.map(point => point[1])));
  const base = building.baseY;
  const rows = absoluteFloorElevations || Array.from({length: levels}, (_, floor) => base + building.height * floor / levels);
  if (rows.length !== levels || !rows.every(Number.isFinite) || rows.some((value, i) => i && value <= rows[i - 1])) {
    throw new Error('Exterior detail rows must be finite, ascending and match the existing storey count');
  }
  const ringCentre = building.groundPolygons?.[0]
    ? building.groundPolygons[0].slice(0, -1).reduce((sum, point, _, all) => add(sum, [point[0] / all.length, 0, point[1] / all.length]), [0, 0, 0])
    : (building.surfaces.find(surface => surface.type === 'GroundSurface') || building.surfaces[0]).points.slice(0, -1)
      .reduce((sum, point, _, all) => add(sum, [point[0] / all.length, 0, point[2] / all.length]), [0, 0, 0]);

  function line(role, a, b) {
    if (Math.hypot(...sub(a, b)) < 1e-7) return;
    (output.segmentLayers[role] ||= []).push([a, b]);
  }
  function quad(role, points) {
    (output.triangleLayers[role] ||= []).push(...[points[0], points[1], points[2], points[0], points[2], points[3]].flat());
  }
  function polygon(role, points, projection) {
    const ring = points.slice(0, -1);
    const indices = ShapeUtils.triangulateShape(ring.map(point => new Vector2(...projection(point))), []);
    (output.triangleLayers[role] ||= []).push(...indices.flatMap(triangle => triangle.flatMap(index => ring[index])));
  }
  function wire(role, ring) {
    ring.slice(1).forEach((point, i) => line(role, ring[i], point));
  }
  function wall(role, a, b, bottom, top) {
    quad(role, [atY(a, bottom), atY(b, bottom), atY(b, top), atY(a, top)]);
  }
  function box(role, origin, u, v, width, depth, height, edgeRole = 'detailMetal') {
    const a = origin, b = add(a, mul(u, width)), c = add(b, mul(v, depth)), d = add(a, mul(v, depth));
    const roof = [a, b, c, d].map(point => add(point, [0, height, 0]));
    quad(role, roof);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quad(role, [[a, b, c, d][i], [a, b, c, d][j], roof[j], roof[i]]);
      line(edgeRole, roof[i], roof[j]); line(edgeRole, [a, b, c, d][i], roof[i]);
    }
  }
  function railing(a, b, floor, top = floor + 1.05, inward = [0, 0, 0]) {
    a = add(a, inward); b = add(b, inward);
    line('detailMetal', atY(a, top), atY(b, top));
    line('detailMetal', atY(a, floor + 0.12), atY(b, floor + 0.12));
    const count = Math.ceil(Math.hypot(...sub(b, a)) / 0.145);
    for (let i = 0; i <= count; i++) {
      const p = lerp(a, b, i / count);
      line('detailMetal', atY(p, floor + 0.12), atY(p, top));
    }
  }
  function mask(surface, ring) {
    (output.exclusionsBySurface.get(surface) || (output.exclusionsBySurface.set(surface, []), output.exclusionsBySurface.get(surface))).push(ring);
  }
  function face(indices, start, end) {
    const u = unit(sub(atY(end, 0), atY(start, 0)));
    let inward = [-u[2], 0, u[0]];
    if (dot(inward, sub(ringCentre, start)) < 0) inward = mul(inward, -1);
    return {indices, start: atY(start, 0), end: atY(end, 0), u, inward, span: Math.hypot(...sub(atY(end, 0), atY(start, 0)))};
  }
  function faceMask(face, left, right, bottom, top) {
    for (const index of face.indices) {
      const surface = building.surfaces[index], frame = surfaceFrame(surface);
      if (!frame) continue;
      const originU = dot(sub(frame.origin, face.start), face.u), direction = dot(frame.u, face.u);
      if (Math.abs(direction) < 0.99) continue;
      const us = surface.points.map(point => dot(sub(point, face.start), face.u));
      const lo = Math.max(left, Math.min(...us)), hi = Math.min(right, Math.max(...us));
      const minY = Math.min(...surface.points.map(point => point[1])), maxY = Math.max(...surface.points.map(point => point[1]));
      const y0 = Math.max(bottom, minY), y1 = Math.min(top, maxY);
      if (hi - lo < 0.01 || y1 - y0 < 0.01) continue;
      // Solve on the original wall plane, including its millimetre-scale bends.
      const lift = (horizontal, y) => {
        const v = (y - frame.origin[1]) / frame.v[1];
        const u = (horizontal - originU - v * dot(frame.v, face.u)) / direction;
        return frame.lift([u, v]);
      };
      mask(surface, closed([lift(lo, y0), lift(hi, y0), lift(hi, y1), lift(lo, y1)]));
    }
  }
  function facePoint(face, horizontal, depth = 0) {
    return add(add(face.start, mul(face.u, horizontal)), mul(face.inward, depth));
  }
  function faceGlazing(a, b, bottom, top, divisions = 2) {
    wall('detailGlazing', a, b, bottom, top);
    wire('windowFrame', closed([atY(a, bottom), atY(b, bottom), atY(b, top), atY(a, top)]));
    for (let i = 1; i < divisions; i++) {
      const point = lerp(a, b, i / divisions);
      line('windowFrame', atY(point, bottom), atY(point, top));
    }
    line('windowFrame', atY(a, bottom + (top - bottom) * 0.32), atY(b, bottom + (top - bottom) * 0.32));
  }
  function cornerLoggia(id, floor, main, side, frontWidth, returnWidth) {
    const lower = rows[floor] + 0.08, upper = (rows[floor + 1] ?? highest) - 0.12;
    const openingTop = upper - 0.20;
    faceMask(main, 0, frontWidth, lower, openingTop);
    faceMask(side, 0, returnWidth, lower, openingTop);
    const a = main.start, b = facePoint(main, frontWidth), d = facePoint(side, returnWidth), c = add(b, sub(d, a));
    quad('detailRecess', [a, b, c, d].map(point => atY(point, lower)));
    quad('detailSoffit', [a, b, c, d].map(point => atY(point, openingTop)));
    wall('detailLime', b, c, lower, openingTop);
    wall('detailLime', c, d, lower, openingTop);
    wall('detailLime', a, b, openingTop - 0.30, openingTop);
    wall('detailLime', d, a, openingTop - 0.30, openingTop);
    box('detailLime', atY(add(lerp(a, b, 0.37), mul(main.inward, 0.14)), lower),
      main.u, main.inward, 0.17, 0.17, openingTop - lower, 'detailLime');
    // Set rails just inside each open edge, leaving the source silhouette fixed.
    railing(a, b, lower, lower + 1.05, mul(main.inward, 0.08));
    railing(d, a, lower, lower + 1.05, mul(side.inward, 0.08));
    line('detailMetal', atY(a, lower), atY(a, openingTop));
    for (const fraction of [0.25, 0.70]) {
      const center = add(lerp(d, c, fraction), mul(main.inward, -0.012)), width = Math.min(1.15, frontWidth * 0.17);
      faceGlazing(add(center, mul(main.u, -width / 2)), add(center, mul(main.u, width / 2)), lower + 0.10, openingTop - 0.42, 1);
    }
    output.features.push({id, kind: 'corner-loggia', floor, sourceSurfaceIndices: [...main.indices, ...side.indices], frontWidth, returnWidth,
      evidence: 'Corner and relative floor identified in resident photograph; depth, width and rear glazing are estimated appearance geometry.'});
  }
  function stairElevation(id, face, left, right) {
    const width = right - left, depth = 1.65;
    for (let floor = 0; floor < levels; floor++) {
      const lower = rows[floor] + 0.06, upper = (rows[floor + 1] ?? highest) - 0.18;
      faceMask(face, left + 0.035, right - 0.035, lower, upper);
      const a = facePoint(face, left + 0.04), b = facePoint(face, right - 0.04), c = add(b, mul(face.inward, depth)), d = add(a, mul(face.inward, depth));
      quad('detailRecess', [a, b, c, d].map(point => atY(point, lower)));
      quad('detailSoffit', [a, b, c, d].map(point => atY(point, upper)));
      wall('detailRecess', a, d, lower, upper); wall('detailRecess', c, b, lower, upper);
      wall('detailRecess', d, c, lower, upper);
      if (floor) railing(a, b, lower, lower + 1.05, mul(face.inward, 0.09));
      for (const fraction of [0.25, 0.73]) {
        const center = add(lerp(d, c, fraction), mul(face.inward, -0.012));
        faceGlazing(add(center, mul(face.u, -0.52)), add(center, mul(face.u, 0.52)), lower + 0.12, Math.min(upper - 0.24, lower + 2.30), 1);
      }
      // Thin, subordinate tread/stringer cues behind the landing rail.
      if (floor < levels - 1) {
        const near = facePoint(face, left + width * 0.13, 0.60), far = facePoint(face, right - width * 0.13, 0.60);
        const start = floor % 2 ? far : near, end = floor % 2 ? near : far;
        const rise = rows[floor + 1] - lower, treads = 17;
        for (let i = 0; i < treads; i++) {
          const point = lerp(start, end, i / treads), next = lerp(start, end, (i + 1) / treads), y = lower + rise * i / treads;
          line('detailMetal', atY(point, y), atY(next, y));
          line('detailMetal', atY(next, y), atY(next, lower + rise * (i + 1) / treads));
        }
        line('detailMetal', atY(start, lower + 0.90), atY(end, rows[floor + 1] + 0.90));
      }
    }
    output.features.push({id, kind: 'recessed-stair-elevation', sourceSurfaceIndices: face.indices, width, depth,
      evidence: 'Photographic open landings registered to the source façade band. Recess depth, rear doors and visible stair details remain schematic; no interior route is created.'});
  }
  function groundFrontage(id, front, left, right, kind) {
    const lower = rows[0] + 0.06, upper = rows[1] - 0.20, depth = kind === 'bike-storage' ? 0.65 : 0.12;
    faceMask(front, left, right, lower, upper);
    const a = facePoint(front, left), b = facePoint(front, right), c = add(b, mul(front.inward, depth)), d = add(a, mul(front.inward, depth));
    wall('detailRecess', a, d, lower, upper); wall('detailRecess', b, c, lower, upper);
    quad('detailSoffit', [a, b, c, d].map(point => atY(point, upper)));
    quad('detailRecess', [a, b, c, d].map(point => atY(point, lower)));
    const divisions = Math.ceil((right - left) / 1.15);
    if (kind === 'bike-storage') {
      wall('detailRecess', d, c, lower, upper);
      const meshA = add(a, mul(front.inward, 0.16)), meshB = add(b, mul(front.inward, 0.16));
      for (let i = 0; i <= divisions; i++) {
        const point = lerp(meshA, meshB, i / divisions);
        line('detailMetal', atY(point, lower), atY(point, upper));
      }
      const meshDivisions = Math.ceil((right - left) / 0.25);
      for (let i = 1; i < meshDivisions; i++) {
        const point = lerp(meshA, meshB, i / meshDivisions);
        line('detailRoofTexture', atY(point, lower), atY(point, upper));
      }
      for (let y = lower + 0.25; y < upper; y += 0.25) line('detailRoofTexture', atY(meshA, y), atY(meshB, y));
      for (const fraction of [0.12, 0.38, 0.65, 0.89]) {
        box('detailLime', atY(add(lerp(a, b, fraction), mul(front.inward, 0.18)), lower),
          front.u, front.inward, 0.16, 0.16, upper - lower, 'detailLime');
      }
    } else faceGlazing(d, c, lower + 0.04, upper - 0.02, divisions);
    output.features.push({id, kind, floor: 0, sourceSurfaceIndices: front.indices,
      evidence: 'Use and broad frontage identified in the architect photograph. Bay spacing, depth and opening limits remain estimated; no room identity is assigned.'});
  }
  function photographicRows(surfaceIndex, start, end, rowFractions, partialFloors = []) {
    const surface = building.surfaces[surfaceIndex], frame = surfaceFrame(surface);
    const rows = Object.entries(rowFractions).map(([floor, fractions]) => ({
      floor: Number(floor), centers: fractions.map(fraction => frame.project(lerp(start, end, fraction))[0]),
    }));
    // Only observed rows override the baseline. Unknown rows remain visibly
    // schematic; a photograph is not used to infer a different floor count.
    output.layoutsBySurface.set(surface, {replace: false, rows});
    output.features.push({id: `${house}-photographic-window-rows-${surfaceIndex}`, kind: 'photographic-window-rows', sourceSurfaceIndices: [surfaceIndex],
      rows: rows.map(row => ({floor: row.floor, count: row.centers.length, coverage: partialFloors.includes(row.floor) ? 'visible openings only; not a floor total' : 'photographed row'})),
      evidence: 'Visible window centers estimated from a coarse planar rectification of resident/architect photographs; no calibrated metric error bound is established. Occluded rows retain the generic appearance study; partial ground rows are not complete opening inventories.'});
  }

  // Face directions start at the photographed corner and run along its outside.
  // The eight-photo November 16 request refines only these registered faces.
  // Source surfaces, floor guides and every interior remain independent.
  const photoHelpers = {
    face, facePoint, faceMask, wall, quad, line, wire, mask, closed, atY,
    add, sub, mul, unit, dot, lerp, box, railing, faceGlazing, photographicRows,
    polygon, cornerLoggia,
  };
  const photoContext = {building, base, rows, highest, output, helpers: photoHelpers};
  if (house === '51') addHouse51PhotoDetails(photoContext);
  if (house === '53') addHouse53PhotoDetails(photoContext);
  if (house === '49') addBlackHousePhotoDetails(photoContext);
  if (house === '51a') addBlueCourtyardPhotoDetails(photoContext);
  if (house === '57a') addTurquoisePhotoDetails(photoContext);
  if (house === '59a') addPinkHousePhotoDetails(photoContext);
  if (house === '55a') addGrauPhotoDetails(photoContext);
  if (house === '57') addWhiteHousePhotoDetails(photoContext);
  if (house === '53a') addLilaPhotoDetails(photoContext);
  if (['51', '53', '49', '51a'].includes(house)) {
    const surfaces = house === '51a' ? output.photoSurfaceIndices.map(index => building.surfaces[index])
      : [...new Set([...output.layoutsBySurface.keys(), ...output.exclusionsBySurface.keys()])];
    output.photoSurfaceIndices = surfaces.map(surface => building.surfaces.indexOf(surface));
    for (const surface of surfaces) {
      const layout = output.layoutsBySurface.get(surface);
      if (layout) layout.recessDepth = 0.14;
    }
  }

  if (house === '55') {
    // The common-room glazing sits beneath the low edge of this particular
    // sloped roof. It is not repeated along the occupied room wing of wall43.
    const front = face([43], [13.944, 0, 5.430], [19.764, 0, 11.799]);
    const lower = base + 0.23, upper = 5.79, left = 0.17, right = front.span - 0.17;
    faceMask(front, left, right, lower, upper);
    const a = facePoint(front, left, 0.09), b = facePoint(front, right, 0.09);
    wall('oldWindowFrame', a, b, lower, lower + 0.73);
    wall('detailGlazing', a, b, lower + 0.73, upper);
    const outer = closed([atY(a, lower), atY(b, lower), atY(b, upper), atY(a, upper)]);
    wire('oldWindowFrame', outer);
    const divisions = 9;
    for (let i = 1; i < divisions; i++) {
      const point = lerp(a, b, i / divisions);
      line('oldWindowFrame', atY(point, lower), atY(point, upper));
    }
    line('oldWindowFrame', atY(a, lower + 0.73), atY(b, lower + 0.73));
    line('oldWindowFrame', atY(a, upper - 0.56), atY(b, upper - 0.56));
    output.features.push({id: '55-rear-common-glazing', kind: 'shared-ground-glazing', sourceSurfaceIndices: [43], divisions,
      evidence: 'Resident rear photo locates a broad red framed communal opening below roof33. Nine divisions are an estimate, not a confirmed count; no apartments are assigned.'});

    addHouse55Entrance({building, base, output, helpers: {
      face, facePoint, faceMask, wall, quad, line, wire, mask, closed, atY, add, sub, mul, unit, dot, lerp,
    }});

    const roof = building.surfaces[33], points = roof.points.slice(0, -1);
    let normal = unit(points.reduce((sum, a, i) => {
      const b = points[(i + 1) % points.length];
      return add(sum, [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]);
    }, [0, 0, 0]));
    if (normal[1] < 0) normal = mul(normal, -1);
    const u = unit([normal[2], 0, -normal[0]]);
    let v = unit(cross(normal, u));
    if (v[1] < 0) v = mul(v, -1);
    const origin = points[0];
    const projectToPlane = point => sub(point, mul(normal, dot(sub(point, origin), normal)));
    const lowCenter = [16.854, 6.0475, 8.6145], highCenter = [10.269, 12.311, 14.398];
    const center = projectToPlane(lerp(lowCenter, highCenter, 0.81)), width = 2.32, length = 1.14;
    const lift = (x, y, offset = 0) => add(center, add(add(mul(u, x), mul(v, y)), mul(normal, offset)));
    const ring = closed([lift(-width / 2, -length / 2), lift(width / 2, -length / 2), lift(width / 2, length / 2), lift(-width / 2, length / 2)]);
    mask(roof, ring);
    const glazing = ring.slice(0, -1).map(point => sub(point, mul(normal, 0.045)));
    quad('detailGlazing', glazing);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      quad('detailRecess', [ring[i], ring[j], glazing[j], glazing[i]]);
    }
    wire('oldWindowFrame', ring.map(point => add(point, mul(normal, 0.015))));
    for (const x of [-width / 6, width / 6]) line('oldWindowFrame', lift(x, -length / 2, 0.02), lift(x, length / 2, 0.02));
    // Roof maintenance rungs remain on the slope, separate from floor geometry.
    for (let i = 0; i < 9; i++) {
      const along = -length / 2 - 0.25 - i * 0.27;
      line('detailMetal', lift(-0.34, along, 0.07), lift(0.34, along, 0.07));
    }
    for (const x of [-0.29, 0.29]) line('detailMetal', lift(x, -length / 2 - 0.23, 0.065), lift(x, -length / 2 - 2.45, 0.065));
    output.features.push({id: '55-rear-roof-window', kind: 'sloped-roof-window', sourceSurfaceIndices: [33], width, length, divisions: 3,
      evidence: 'Resident rear photo shows a small three-part bank on the roof slope with maintenance rungs. Size and offsets are estimated; this is not an occupied floor or apartment opening.'});
  }

  // Raised parapet appearance is constructed inward and downward from the
  // retained LoD2 cap; none of the source height or silhouette is enlarged.
  const timber = ['49', '51a', '53a', '55a', '57a', '59a'].includes(house);
  const roofCandidates = building.surfaces.filter(surface => surface.type === 'RoofSurface' &&
    Math.max(...surface.points.map(p => p[1])) - Math.min(...surface.points.map(p => p[1])) < 0.025 &&
    polygonAreaXZ(surface.points) > 30);
  for (const roof of roofCandidates) {
    const y = roof.points.reduce((sum, p) => sum + p[1], 0) / roof.points.length;
    const center = roof.points.slice(0, -1).reduce((sum, p, _, all) => add(sum, mul(p, 1 / all.length)), [0, 0, 0]);
    if (timber) {
      const size = Math.sqrt(polygonAreaXZ(roof.points)), scale = 1 - 0.42 / size;
      const inner = roof.points.map(p => atY(lerp(center, p, scale), y));
      if (roofContains(roof, inner)) {
        mask(roof, inner);
        const bedY = y - 0.46;
        polygon('detailRoofBed', inner.map(p => atY(p, bedY)), p => [p[0], p[2]]);
        for (let i = 1; i < inner.length; i++) {
          wall('detailMetal', inner[i - 1], inner[i], bedY, y);
          line('detailMetal', inner[i - 1], inner[i]);
        }
        output.features.push({id: `${house}-inset-roof-bed`, kind: 'inset-roof-bed', sourceSurfaceIndices: [building.surfaces.indexOf(roof)], depth: 0.46,
          evidence: 'Light green roof and coping visible in photographic references; roof-bed depth is a presentation allowance beneath the unchanged source cap.'});
        const edge = sub(roof.points[1], roof.points[0]), u = unit([edge[0], 0, edge[2]]), v = [-u[2], 0, u[0]];
        const local = p => [dot(sub(p, center), u), dot(sub(p, center), v)];
        const bounds = inner.map(local), minU = Math.min(...bounds.map(p => p[0])), maxU = Math.max(...bounds.map(p => p[0]));
        const minV = Math.min(...bounds.map(p => p[1])), maxV = Math.max(...bounds.map(p => p[1]));
        const lift = (x, z) => atY(add(center, add(mul(u, x), mul(v, z))), bedY + 0.003);
        const equipment = [];
        // Equipment silhouettes are restricted to the three photographed roofs.
        if (['51a', '53a', '55a'].includes(house)) {
          const equipmentSizes = house === '53a'
            ? [[0.50, 0.43, 3.85, 2.45], [0.29, 0.43, 0.95, 0.85]]
            : [[0.54, 0.48, 2.2, 1.5], [0.27, 0.42, 0.8, 0.75]];
          for (const [fu, fv, width, depth] of equipmentSizes) {
            const origin = lift(minU + (maxU - minU) * fu, minV + (maxV - minV) * fv);
            const ring = [origin, add(origin, mul(u, width)), add(add(origin, mul(u, width)), mul(v, depth)), add(origin, mul(v, depth))];
            if (roofContains(roof, ring)) {
              box('detailRoofHardware', origin, u, v, width, depth, 0.39);
              equipment.push(ring);
            }
          }
          const ventPositions = house === '53a'
            ? [[.11,.18],[.14,.18],[.18,.20],[.28,.18],[.33,.21],[.39,.18],[.52,.18],[.59,.22],[.68,.18],[.78,.20],
              [.16,.40],[.20,.42],[.36,.37],[.41,.39],[.77,.39],[.82,.44],
              [.12,.67],[.17,.68],[.25,.73],[.32,.69],[.39,.70],[.47,.74],[.60,.72],[.65,.69],[.76,.73],[.84,.68],
              [.20,.85],[.43,.84],[.68,.85]]
            : [0.18, 0.33, 0.64, 0.77].flatMap(fu => [0.22, 0.70].map(fv => [fu, fv]));
          let ventCount = 0;
          for (const [fu, fv] of ventPositions) {
            const origin = lift(minU + (maxU - minU) * fu, minV + (maxV - minV) * fv);
            const ring = [origin, add(origin, mul(u, 0.19)), add(add(origin, mul(u, 0.19)), mul(v, 0.19)), add(origin, mul(v, 0.19))];
            if (roofContains(roof, ring) && !equipment.some(polygon => insideXZ(origin, closed(polygon)))) {
              box('detailRoofHardware', origin, u, v, 0.19, 0.19, 0.26);
              ventCount++;
            }
          }
          if (house === '53a') output.features.push({
            id: '53a-photo-roof-hardware', kind: 'roof-hardware', sourceSurfaceIndices: [building.surfaces.indexOf(roof)],
            equipmentCount: equipment.length, ventCount,
            evidence: 'Resident aerial photo 1 shows a broad dark central equipment box, a smaller box and scattered short vents over a planted roof. Counts, positions and hardware dimensions are illustrative; all remain below the unchanged source roof cap.',
          });
        }
        for (let a = Math.ceil(minU / 0.7); a * 0.7 < maxU; a++) for (let b = Math.ceil(minV / 0.7); b * 0.7 < maxV; b++) {
          if (Math.abs((a * 17 + b * 29) % 5) > 1) continue;
          const p = lift(a * 0.7, b * 0.7), q = add(p, mul(u, 0.16 + Math.abs(a % 3) * 0.06));
          if (roofContains(roof, [p, q]) && !equipment.some(poly => insideXZ(p, closed(poly)))) line('detailRoofTexture', p, q);
        }
      }
    } else {
      wire('detailMetal', roof.points);
      // Fine low caps on the photographed Red roof, below its tall roof crowns.
      if (house === '55') {
        const u = unit([roof.points[1][0] - roof.points[0][0], 0, roof.points[1][2] - roof.points[0][2]]), v = [-u[2], 0, u[0]];
        const projected = roof.points.map(p => [dot(sub(p, center), u), dot(sub(p, center), v)]);
        const lo = [0, 1].map(axis => Math.min(...projected.map(p => p[axis]))), hi = [0, 1].map(axis => Math.max(...projected.map(p => p[axis])));
        const candidates = [];
        for (let x = lo[0] + 1.4; x < hi[0]; x += 5.8) for (let z = lo[1] + 1.5; z < hi[1]; z += 5.4) {
          const origin = atY(add(center, add(mul(u, x), mul(v, z))), y + 0.012);
          const corners = [origin, add(origin, mul(u, 0.44)), add(add(origin, mul(u, 0.44)), mul(v, 0.36)), add(origin, mul(v, 0.36))];
          if (roofContains(roof, corners) && y + 0.29 < highest - 0.02) candidates.push(origin);
        }
        // A dozen caps are visually discernible across the two exposed flat
        // portions. Keep a sparse view-side distribution, not a cap at every
        // room or an assumed service grid across the whole H-shaped roof.
        const selected = candidates.sort((a, b) => (b[0] - b[2]) - (a[0] - a[2])).slice(0, 12);
        for (const origin of selected) box('detailRoofHardware', origin, u, v, 0.44, 0.36, 0.22);
        output.features.push({id: '55-roof-cap-study', kind: 'roof-vent-caps', count: selected.length, sourceSurfaceIndices: [building.surfaces.indexOf(roof)],
          evidence: 'Approximately twelve square caps are distinguishable in the resident rear-roof photograph. Positions here remain an estimated sparse distribution, not a mechanical-services survey.'});
      }
    }
  }
  // Older-house stepped roof outlines receive fine metal edge/coping cues.
  if (!timber) for (const surface of building.surfaces.filter(surface => surface.type === 'RoofSurface')) {
    for (let i = 1; i < surface.points.length; i++) {
      const a = surface.points[i - 1], b = surface.points[i];
      line('detailMetal', a, b);
      if (Math.abs(a[1] - b[1]) < 0.025 && Math.hypot(...sub(a, b)) > 2) {
        line('detailMetal', add(a, [0, -0.055, 0]), add(b, [0, -0.055, 0]));
      }
    }
  }
  return output;
}
