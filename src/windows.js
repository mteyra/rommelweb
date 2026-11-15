import { ShapeUtils, Vector2 } from 'three';
import { surfaceFrame } from './facade.js';
import { getLevelElevations, getInteriorLevel } from './interiors.js';

/**
 * A separate appearance study. These are not surveyed openings, room locations,
 * occupancy data or modifications to the LoD2 exterior.
 */
export const WINDOW_PROFILE = Object.freeze({
  family: 'timber', firstFloor: 1, minimumWallHeight: 0, groundedOnly: false, wallClearance: 0.025,
  width: 1.1, maxHeight: 2.55, bayPitch: 3.4, alternateOffset: 0.55,
  minimumWallSpan: 20, sillOffset: 0.14, headHeight: 0.28,
  minimumAnchorSpan: 12, coplanarTolerance: 0.08,
  source: 'https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-527.jpg',
  secondarySource: 'https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-939.jpg',
  widthSource: 'https://rommelwood.de/wohnen/zimmergrundriss/',
  status: 'Photo-informed schematic upper-storey window study. Typical width is approximately 1.10m; heights, bay positions, offsets and frame dimensions are illustrative. No surveyed openings or room assignments.',
});
export const OLD_WINDOW_PROFILE = Object.freeze({
  family: 'plates', firstFloor: 0, minimumWallHeight: 4.8, groundedOnly: true, wallClearance: 0.08,
  width: 1.05, maxHeight: 1.55, bayPitch: 3.25, alternateOffset: 0,
  minimumWallSpan: 2.4, sillOffset: 0.95, headHeight: 0,
  minimumAnchorSpan: 2.4, coplanarTolerance: 0.08,
  source: 'https://www.werkswelt.de/data/uploads/wohnen/wh-e-rommel.jpg',
  secondarySource: 'https://www.werkswelt.de/data/uploads/wohnen/wh-e-rommel3.jpg',
  widthSource: 'https://rommelwood.de/wohnen/zimmergrundriss/',
  status: 'Photo-informed schematic older-house window study. One unassigned typical sketch gives approximately 1.05m width, 1.55m height and 0.95m sill; bay positions, pitch, frame colors and row guides are illustrative. Three aligned rows where whole openings fit below the source roof; no surveyed openings, room assignments or occupancy.',
});

/** Resident corrections override a material-family default only for that house. */
export function getWindowProfile(house, family = 'timber') {
  if (family === 'plates') return OLD_WINDOW_PROFILE;
  if (family !== 'timber') throw new Error('Unknown window-study material family');
  if (String(house) !== '51a') return WINDOW_PROFILE;
  return Object.freeze({
    ...WINDOW_PROFILE, alternateOffset: 0,
    alignmentSource: 'Resident correction: Blue House 51a upper window rows are vertically aligned.',
    source: 'https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-158.jpg',
    status: `${WINDOW_PROFILE.status} House 51a row alignment follows a resident correction; other dimensions and placement remain schematic.`,
  });
}

/**
 * Older façades have window rows beneath broad flat roofs and higher roof caps.
 * Use the dominant broad horizontal roof only as an appearance guide.
 * This never edits floor-section elevations; approved anchors remain exact.
 */
export function getOldFacadeRowGuides(building, count, interiors = {schemaVersion: 1, buildings: {}}) {
  const flatRoofs = building.surfaces.filter(surface => surface.type === 'RoofSurface' &&
    Math.max(...surface.points.map(point => point[1])) - Math.min(...surface.points.map(point => point[1])) < 0.02)
    .map(surface => ({
      surface,
      area: [surface.points, ...(surface.holes || [])].reduce((total, ring, index) => {
        const ringArea = Math.abs(ring.slice(1).reduce((sum, point, i) => sum + ring[i][0] * point[2] - point[0] * ring[i][2], 0)) / 2;
        return total + (index ? -ringArea : ringArea);
      }, 0),
      height: surface.points.reduce((sum, point) => sum + point[1], 0) / surface.points.length - building.baseY,
    })).filter(item => item.area >= 20 && item.height > 0).sort((a, b) => b.area - a.area);
  const roof = flatRoofs[0];
  let guideHeight = roof?.height || building.height;
  const highestApproved = Math.max(0, ...Array.from({length: count}, (_, index) => getInteriorLevel(interiors, building.number, index)?.elevation || 0));
  if (highestApproved >= guideHeight) guideHeight = building.height;
  const usesFlatRoof = Boolean(roof && guideHeight === roof.height);
  const relativeElevations = getLevelElevations(interiors, building.number, count, guideHeight);
  return {
    relativeElevations, elevations: relativeElevations.map(elevation => elevation + building.baseY),
    guideHeight, sourceSurfaceId: usesFlatRoof ? roof.surface.id : null,
    status: `Appearance-only row spacing from ${usesFlatRoof ? 'the dominant broad horizontal LoD2 roof' : 'the official overall height fallback'}, with approved anchors retained. Not measured floor elevations, ceiling heights or proof of roof-space occupancy; floor-section guides are unchanged.`,
  };
}

const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const area = points => Math.abs(points.reduce((sum, a, i) => {
  const b = points[(i + 1) % points.length];
  return sum + a[0] * b[1] - b[0] * a[1];
}, 0)) / 2;

/** Intersect a rectangle with a wall triangulation; holes remain unfilled. */
function clipRectangle(rectangle, triangles) {
  const [left, bottom, right, top] = rectangle;
  const pieces = [];
  for (const raw of triangles) {
    const triangle = cross(...raw) < 0 ? [...raw].reverse() : raw;
    let polygon = [[left, bottom], [right, bottom], [right, top], [left, top]];
    for (let edge = 0; edge < 3 && polygon.length; edge++) {
      const a = triangle[edge], b = triangle[(edge + 1) % 3], input = polygon;
      polygon = [];
      for (let i = 0; i < input.length; i++) {
        const p = input[i], q = input[(i + 1) % input.length], pSide = cross(a, b, p), qSide = cross(a, b, q);
        const pInside = pSide >= -1e-9, qInside = qSide >= -1e-9;
        if (pInside) polygon.push(p);
        if (pInside !== qInside) {
          const t = pSide / (pSide - qSide);
          polygon.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
        }
      }
    }
    if (polygon.length >= 3 && area(polygon) > 1e-8) pieces.push(polygon);
  }
  return pieces;
}

/** Exact union coverage by a vertical sweep through clipped polygon edges. */
function rectangleCovered(rectangle, triangles) {
  const [left, bottom, right, top] = rectangle;
  const polygons = clipRectangle(rectangle, triangles);
  if (!polygons.length) return false;
  const edges = polygons.flatMap(polygon => polygon.map((a, i) => [a, polygon[(i + 1) % polygon.length]]));
  const xs = [left, right, ...polygons.flat().map(point => point[0])];
  for (let i = 0; i < edges.length; i++) for (let j = 0; j < i; j++) {
    const [[ax, ay], [bx, by]] = edges[i], [[cx, cy], [dx, dy]] = edges[j];
    const denominator = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
    if (Math.abs(denominator) < 1e-12) continue;
    const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denominator;
    const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denominator;
    if (t > 0 && t < 1 && u > 0 && u < 1) xs.push(ax + t * (bx - ax));
  }
  xs.sort((a, b) => a - b);
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] - xs[i - 1] < 1e-9) continue;
    const x = (xs[i] + xs[i - 1]) / 2;
    const intervals = polygons.flatMap(polygon => {
      const ys = polygon.flatMap((a, j) => {
        const b = polygon[(j + 1) % polygon.length];
        return (a[0] > x) !== (b[0] > x) ? [a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])] : [];
      });
      return ys.length >= 2 ? [[Math.min(...ys), Math.max(...ys)]] : [];
    }).sort((a, b) => a[0] - b[0]);
    let covered = bottom;
    for (const [low, high] of intervals) {
      if (low > covered + 1e-7) return false;
      covered = Math.max(covered, high);
    }
    if (covered < top - 1e-7) return false;
  }
  return true;
}

function triangulatedWall(surface, projectionFrame = surfaceFrame(surface)) {
  const rings = [surface.points, ...(surface.holes || [])].map(ring => ring.slice(0, -1).map(point => [projectionFrame.u, projectionFrame.v].map(axis =>
    point.reduce((sum, value, i) => sum + (value - projectionFrame.origin[i]) * axis[i], 0))));
  const vertices = rings.flat();
  return ShapeUtils.triangulateShape(rings[0].map(point => new Vector2(...point)), rings.slice(1).map(ring => ring.map(point => new Vector2(...point)))).map(indices => indices.map(index => vertices[index]));
}

/**
 * Return batched planar frame/glass/head/sill geometry over broad source walls.
 * Family-specific rules exclude unsupported shared/stair/roof-only portions.
 * Complete openings must fit; split records clip back to each original wall.
 */
export function createWindowStudy(surface, absoluteFloorElevations, roofElevation, layout = null, profile = WINDOW_PROFILE, skipFloors = []) {
  const layers = {frame: [], glass: [], head: [], sill: []};
  const empty = {layers, count: 0, patches: [], profile};
  const frame = surfaceFrame(surface);
  const layoutFrame = layout?.frame || frame;
  const span = layout ? layout.maxU - layout.minU : frame ? frame.maxU - frame.minU : 0;
  if (!frame || span < profile.minimumWallSpan || frame.v[1] < 0.99) return empty;
  if (!Array.isArray(absoluteFloorElevations) || !absoluteFloorElevations.every(Number.isFinite) || !Number.isFinite(roofElevation) ||
    absoluteFloorElevations.some((value, i) => i > 0 && value <= absoluteFloorElevations[i - 1]) || roofElevation <= absoluteFloorElevations.at(-1)) throw new Error('Window study requires ascending finite floor elevations below its roof');
  if (frame.maxV - frame.minV < profile.minimumWallHeight || profile.groundedOnly && Math.min(...surface.points.map(point => point[1])) > absoluteFloorElevations[0] + 0.05) return empty;
  const wallTriangles = triangulatedWall(surface, frame);
  const toV = height => (height - frame.origin[1]) / frame.v[1];
  const lift = (point, offset) => frame.lift(point).map((value, i) => value + frame.normal[i] * offset);
  const addLayer = (key, rectangle, offset) => {
    for (const polygon of clipRectangle(rectangle, wallTriangles)) {
      for (let i = 1; i + 1 < polygon.length; i++) layers[key].push(...[polygon[0], polygon[i], polygon[i + 1]].flatMap(point => lift(point, offset)));
    }
  };
  const columns = Math.max(1, Math.floor((span - (profile.family === 'plates' ? 0.8 : 3)) / profile.bayPitch));
  const middle = layout ? (layout.minU + layout.maxU) / 2 : (frame.minU + frame.maxU) / 2, patches = [];
  let count = 0;
  for (let floor = profile.firstFloor; floor < absoluteFloorElevations.length; floor++) {
    if (skipFloors.includes(floor)) continue;
    const interval = (absoluteFloorElevations[floor + 1] ?? roofElevation) - absoluteFloorElevations[floor];
    const height = profile.family === 'plates' ? profile.maxHeight : Math.min(profile.maxHeight, interval - 0.4);
    if (height < 1 || profile.sillOffset + height + profile.wallClearance > interval) continue;
    const bottom = toV(absoluteFloorElevations[floor] + profile.sillOffset), top = bottom + height;
    const stagger = (floor % 2 ? -0.5 : 0.5) * profile.alternateOffset;
    for (let column = 0; column < columns; column++) {
      const layoutCenter = middle + (column - (columns - 1) / 2) * profile.bayPitch + stagger;
      const worldCenter = layoutFrame.lift([layoutCenter, 0]);
      const center = worldCenter.reduce((sum, value, i) => sum + (value - frame.origin[i]) * frame.u[i], 0);
      const left = center - profile.width / 2, right = center + profile.width / 2;
      const rectangle = [left, bottom, right, top];
      const layoutBottom = (absoluteFloorElevations[floor] + profile.sillOffset - layoutFrame.origin[1]) / layoutFrame.v[1];
      const clearance = profile.wallClearance;
      if (!rectangleCovered([layoutCenter - profile.width / 2 - clearance, layoutBottom - clearance, layoutCenter + profile.width / 2 + clearance, layoutBottom + height + clearance], layout?.coverageTriangles || wallTriangles)) continue;
      const clippedArea = clipRectangle(rectangle, wallTriangles).reduce((sum, polygon) => sum + area(polygon), 0);
      if (layout ? clippedArea < 0.00001 : Math.abs(clippedArea - profile.width * height) > 0.00001) continue;
      addLayer('frame', rectangle, 0.012);
      addLayer('glass', [left + 0.07, bottom + 0.09, right - 0.07, top - Math.max(0.07, profile.headHeight)], 0.022);
      if (profile.headHeight) addLayer('head', [left + 0.055, top - profile.headHeight, right - 0.055, top - 0.055], 0.029);
      const transom = bottom + (height - profile.headHeight) * (profile.family === 'plates' ? 0.5 : 0.32);
      addLayer('head', [left + 0.04, transom - 0.035, right - 0.04, transom + 0.035], 0.03);
      addLayer('sill', [left - 0.025, bottom, right + 0.025, bottom + 0.055], 0.037);
      patches.push({floor, corners: [[left, bottom], [right, bottom], [right, top], [left, top]].map(point => frame.lift(point))});
      if (clipRectangle([center - 0.0001, (bottom + top) / 2 - 0.0001, center + 0.0001, (bottom + top) / 2 + 0.0001], wallTriangles).length) count++;
    }
  }
  return {layers, count, patches, profile};
}

/** Resident-located openings replace a complete floor's repeated bay pattern.
 * Dimensions/elevations still use the appearance profile. Every whole opening
 * must fit its actual source wall; failures are reported, never shrunk to fit.
 */
function createLocatedWindowStudy(surface, surfaceIndex, elevations, locatedLevels, profile) {
  const layers = {frame: [], glass: [], head: [], sill: []}, patches = [], rejectedLocated = [];
  const frame = surfaceFrame(surface);
  const entries = locatedLevels.flatMap(level => (level.windows || []).filter(window => window.sourceSurfaceIndex === surfaceIndex).map(window => ({floor: level.index, window})));
  if (!entries.length) return {layers, patches, count: 0, locatedCount: 0, rejectedLocated, profile};
  if (!frame || frame.v[1] < 0.99) return {layers, patches, count: 0, locatedCount: 0, rejectedLocated: entries.map(entry => entry.window.id), profile};
  const triangles = triangulatedWall(surface, frame);
  const lift = (point, offset) => frame.lift(point).map((value, i) => value + frame.normal[i] * offset);
  const add = (key, rectangle, offset) => {
    for (const polygon of clipRectangle(rectangle, triangles)) {
      for (let i = 1; i + 1 < polygon.length; i++) layers[key].push(...[polygon[0], polygon[i], polygon[i + 1]].flatMap(point => lift(point, offset)));
    }
  };
  for (const {floor, window} of entries) {
    const us = window.segment.map(([x, z]) => (x - frame.origin[0]) * frame.u[0] + (z - frame.origin[2]) * frame.u[2]);
    const left = Math.min(...us), right = Math.max(...us);
    const bottom = (elevations[floor] + profile.sillOffset - frame.origin[1]) / frame.v[1], top = bottom + profile.maxHeight;
    const clearance = profile.wallClearance;
    if (![left, right, bottom, top].every(Number.isFinite)
      || !rectangleCovered([left - clearance, bottom - clearance, right + clearance, top + clearance], triangles)) {
      rejectedLocated.push(window.id);
      continue;
    }
    add('frame', [left, bottom, right, top], 0.012);
    add('glass', [left + 0.07, bottom + 0.09, right - 0.07, top - 0.07], 0.022);
    const transom = (bottom + top) / 2;
    add('head', [left + 0.04, transom - 0.035, right - 0.04, transom + 0.035], 0.03);
    add('sill', [left - 0.025, bottom, right + 0.025, bottom + 0.055], 0.037);
    patches.push({floor, corners: [[left, bottom], [right, bottom], [right, top], [left, top]].map(point => frame.lift(point)), windowId: window.id});
  }
  return {layers, patches, count: patches.length, locatedCount: patches.length, rejectedLocated, profile};
}

/**
 * A broad façade may be split into multiple near-coplanar LoD2 wall records.
 * Share a display layout across adjacent records, then clip every layer back
 * onto each original surface. Never merge or move source vertices. Heavily
 * fragmented faces without a broad anchor remain excluded (stair-side study).
 */
export function createBuildingWindowStudies(surfaces, elevations, roofElevation, options = {}) {
  const profile = getWindowProfile(options.house, options.family);
  const locatedLevels = options.locatedLevels || [];
  const skipFloors = locatedLevels.filter(level => level.windowCoverage === 'complete-floor').map(level => level.index);
  const walls = surfaces.map(surface => ({surface, frame: surfaceFrame(surface)})).filter(item => item.frame &&
    (!profile.groundedOnly || Math.min(...item.surface.points.map(point => point[1])) <= elevations[0] + 0.05) &&
    item.frame.maxV - item.frame.minV >= profile.minimumWallHeight);
  const groups = [];
  const adjacent = (a, b) => {
    if (a.frame.normal.reduce((sum, value, i) => sum + value * b.frame.normal[i], 0) < Math.cos(0.75 * Math.PI / 180)) return false;
    if (Math.max(...b.surface.points.map(point => Math.abs(point.reduce((sum, value, i) => sum + (value - a.frame.origin[i]) * a.frame.normal[i], 0)))) > profile.coplanarTolerance) return false;
    return a.surface.points.some(p => b.surface.points.some(q => Math.hypot(...p.map((value, i) => value - q[i])) < 0.002));
  };
  for (const wall of walls) {
    const matches = groups.filter(group => group.some(item => adjacent(wall, item)));
    if (!matches.length) groups.push([wall]);
    else {
      const group = matches[0];
      group.push(wall);
      for (const other of matches.slice(1)) {
        group.push(...other);
        groups.splice(groups.indexOf(other), 1);
      }
    }
  }
  const studies = new Map();
  for (const group of groups) {
    const anchor = group.reduce((a, b) => a.frame.maxU - a.frame.minU > b.frame.maxU - b.frame.minU ? a : b);
    if (anchor.frame.maxU - anchor.frame.minU < profile.minimumAnchorSpan) continue;
    const us = group.flatMap(item => item.surface.points.map(point => point.reduce((sum, value, i) => sum + (value - anchor.frame.origin[i]) * anchor.frame.u[i], 0)));
    const layout = {frame: anchor.frame, minU: Math.min(...us), maxU: Math.max(...us), coverageTriangles: group.flatMap(item => triangulatedWall(item.surface, anchor.frame))};
    for (const item of group) studies.set(item.surface, createWindowStudy(item.surface, elevations, roofElevation, layout, profile, skipFloors));
  }
  for (const [index, surface] of surfaces.entries()) {
    const located = createLocatedWindowStudy(surface, index, elevations, locatedLevels, profile);
    if (!located.count && !located.rejectedLocated.length) continue;
    const existing = studies.get(surface);
    if (!existing) studies.set(surface, located);
    else studies.set(surface, {
      ...existing, count: existing.count + located.count, locatedCount: located.locatedCount, rejectedLocated: located.rejectedLocated,
      patches: [...existing.patches, ...located.patches],
      layers: Object.fromEntries(Object.keys(existing.layers).map(key => [key, [...existing.layers[key], ...located.layers[key]]])),
    });
  }
  return studies;
}
