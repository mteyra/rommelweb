import { ShapeUtils, Vector2 } from 'three';
import { surfaceFrame } from './facade.js';

/**
 * A separate appearance study. These are not surveyed openings, room locations,
 * occupancy data or modifications to the LoD2 exterior.
 */
export const WINDOW_PROFILE = Object.freeze({
  width: 1.1, maxHeight: 2.55, bayPitch: 3.4, alternateOffset: 0.55,
  minimumWallSpan: 20, sillOffset: 0.14, headHeight: 0.28,
  minimumAnchorSpan: 12, coplanarTolerance: 0.08,
  source: 'https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-527.jpg',
  secondarySource: 'https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-939.jpg',
  widthSource: 'https://rommelwood.de/wohnen/zimmergrundriss/',
  status: 'Photo-informed schematic upper-storey window study. Typical width is approximately 1.10m; heights, bay positions, offsets and frame dimensions are illustrative. No surveyed openings or room assignments.',
});

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

/**
 * Return batched planar frame/glass/head/sill geometry over broad source walls.
 * Ground-floor communal spaces and interrupted stair/recess faces are excluded.
 * Each patch is clipped to the exact source wall, including any polygon holes.
 */
export function createWindowStudy(surface, absoluteFloorElevations, roofElevation, layout = null) {
  const layers = {frame: [], glass: [], head: [], sill: []};
  const empty = {layers, count: 0, patches: [], profile: WINDOW_PROFILE};
  const frame = surfaceFrame(surface);
  const layoutFrame = layout?.frame || frame;
  const span = layout ? layout.maxU - layout.minU : frame ? frame.maxU - frame.minU : 0;
  if (!frame || span < WINDOW_PROFILE.minimumWallSpan || frame.v[1] < 0.99) return empty;
  if (!Array.isArray(absoluteFloorElevations) || !absoluteFloorElevations.every(Number.isFinite) || !Number.isFinite(roofElevation) ||
    absoluteFloorElevations.some((value, i) => i > 0 && value <= absoluteFloorElevations[i - 1]) || roofElevation <= absoluteFloorElevations.at(-1)) throw new Error('Window study requires ascending finite floor elevations below its roof');
  const rings = frame.rings.map(ring => ring.slice(0, -1)), vertices = rings.flat();
  const wallTriangles = ShapeUtils.triangulateShape(rings[0].map(point => new Vector2(...point)), rings.slice(1).map(ring => ring.map(point => new Vector2(...point)))).map(indices => indices.map(index => vertices[index]));
  const toV = height => (height - frame.origin[1]) / frame.v[1];
  const lift = (point, offset) => frame.lift(point).map((value, i) => value + frame.normal[i] * offset);
  const addLayer = (key, rectangle, offset) => {
    for (const polygon of clipRectangle(rectangle, wallTriangles)) {
      for (let i = 1; i + 1 < polygon.length; i++) layers[key].push(...[polygon[0], polygon[i], polygon[i + 1]].flatMap(point => lift(point, offset)));
    }
  };
  const columns = Math.max(1, Math.floor((span - 3) / WINDOW_PROFILE.bayPitch));
  const middle = layout ? (layout.minU + layout.maxU) / 2 : (frame.minU + frame.maxU) / 2, patches = [];
  let count = 0;
  for (let floor = 1; floor < absoluteFloorElevations.length; floor++) {
    const interval = (absoluteFloorElevations[floor + 1] ?? roofElevation) - absoluteFloorElevations[floor];
    const height = Math.min(WINDOW_PROFILE.maxHeight, interval - 0.4);
    if (height < 1) continue;
    const bottom = toV(absoluteFloorElevations[floor] + WINDOW_PROFILE.sillOffset), top = bottom + height;
    const stagger = (floor % 2 ? -0.5 : 0.5) * WINDOW_PROFILE.alternateOffset;
    for (let column = 0; column < columns; column++) {
      const layoutCenter = middle + (column - (columns - 1) / 2) * WINDOW_PROFILE.bayPitch + stagger;
      const worldCenter = layoutFrame.lift([layoutCenter, 0]);
      const center = worldCenter.reduce((sum, value, i) => sum + (value - frame.origin[i]) * frame.u[i], 0);
      const left = center - WINDOW_PROFILE.width / 2, right = center + WINDOW_PROFILE.width / 2;
      const rectangle = [left, bottom, right, top];
      const clippedArea = clipRectangle(rectangle, wallTriangles).reduce((sum, polygon) => sum + area(polygon), 0);
      if (layout ? clippedArea < 0.00001 : Math.abs(clippedArea - WINDOW_PROFILE.width * height) > 0.00001) continue;
      addLayer('frame', rectangle, 0.012);
      addLayer('glass', [left + 0.07, bottom + 0.09, right - 0.07, top - WINDOW_PROFILE.headHeight], 0.022);
      addLayer('head', [left + 0.055, top - WINDOW_PROFILE.headHeight, right - 0.055, top - 0.055], 0.029);
      const transom = bottom + (height - WINDOW_PROFILE.headHeight) * 0.32;
      addLayer('head', [left + 0.04, transom - 0.035, right - 0.04, transom + 0.035], 0.03);
      addLayer('sill', [left - 0.025, bottom, right + 0.025, bottom + 0.055], 0.037);
      patches.push({floor, corners: [[left, bottom], [right, bottom], [right, top], [left, top]].map(point => frame.lift(point))});
      if (clipRectangle([center - 0.0001, (bottom + top) / 2 - 0.0001, center + 0.0001, (bottom + top) / 2 + 0.0001], wallTriangles).length) count++;
    }
  }
  return {layers, count, patches, profile: WINDOW_PROFILE};
}

/**
 * A broad façade may be split into multiple near-coplanar LoD2 wall records.
 * Share a display layout across adjacent records, then clip every layer back
 * onto each original surface. Never merge or move source vertices. Heavily
 * fragmented faces without a broad anchor remain excluded (stair-side study).
 */
export function createBuildingWindowStudies(surfaces, elevations, roofElevation) {
  const walls = surfaces.map(surface => ({surface, frame: surfaceFrame(surface)})).filter(item => item.frame);
  const groups = [];
  const adjacent = (a, b) => {
    if (a.frame.normal.reduce((sum, value, i) => sum + value * b.frame.normal[i], 0) < Math.cos(0.75 * Math.PI / 180)) return false;
    if (Math.max(...b.surface.points.map(point => Math.abs(point.reduce((sum, value, i) => sum + (value - a.frame.origin[i]) * a.frame.normal[i], 0)))) > WINDOW_PROFILE.coplanarTolerance) return false;
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
    if (anchor.frame.maxU - anchor.frame.minU < WINDOW_PROFILE.minimumAnchorSpan) continue;
    const us = group.flatMap(item => item.surface.points.map(point => point.reduce((sum, value, i) => sum + (value - anchor.frame.origin[i]) * anchor.frame.u[i], 0)));
    const layout = {frame: anchor.frame, minU: Math.min(...us), maxU: Math.max(...us)};
    for (const item of group) studies.set(item.surface, createWindowStudy(item.surface, elevations, roofElevation, layout));
  }
  return studies;
}
