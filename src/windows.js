import { ShapeUtils, Vector2 } from 'three';
import { surfaceFrame } from './facade.js';
import { getLevelElevations, getInteriorLevel } from './interiors.js';
import { createHouse55WindowAlignment } from './house55-window-alignment.js';

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

/** Frame paint read as house identity; neutral lighting values, not swatches. */
export const OLD_WINDOW_COLORS = Object.freeze({
  '51': Object.freeze({night: 0xc7ad5d, day: 0xb7962f}),
  '53': Object.freeze({night: 0xc67c4a, day: 0xb36329}),
  '55': Object.freeze({night: 0xb95650, day: 0xa5443a}),
  '57': Object.freeze({night: 0xbdc1b6, day: 0xb1b7b3}),
  '59': Object.freeze({night: 0x81915f, day: 0x758342}),
});

/** Resident corrections override a material-family default only for that house. */
export function getWindowProfile(house, family = 'timber') {
  if (family === 'plates') return OLD_WINDOW_PROFILE;
  if (family !== 'timber') throw new Error('Unknown window-study material family');
  if (String(house) !== '51a') return WINDOW_PROFILE;
  return Object.freeze({
    ...WINDOW_PROFILE, alternateOffset: 0,
    headHeight: 0.34, transomRatio: 0.36,
    topHeadHeight: 0.55, topTransomRatio: 0.52, topHeadStyle: 'slatted',
    alignmentSource: 'Resident correction: Blue House 51a upper window rows are vertically aligned.',
    source: 'https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-158.jpg',
    status: `${WINDOW_PROFILE.status} House 51a rows stay aligned; the supplied close-up informs a taller slatted top-row blind zone and a lower transom on the row below. Blind pose and dimensions are illustrative, not permanent measured differences.`,
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

const windowLayers = () => ({reveal: [], frame: [], glass: [], head: [], blind: [], sill: []});
const projectRing = (ring, frame) => ring.map(point => [frame.u, frame.v].map(axis =>
  point.reduce((sum, value, i) => sum + (value - frame.origin[i]) * axis[i], 0)));
function exclusionTriangles(rings, frame) {
  return rings.flatMap(ring => {
    const points = projectRing(ring, frame);
    if (Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]) < 1e-8) points.pop();
    return ShapeUtils.triangulateShape(points.map(point => new Vector2(...point)), [])
      .map(indices => indices.map(index => points[index]));
  });
}

function lineCoveredIntervals(a, b, triangles) {
  const intervals = [];
  for (const raw of triangles) {
    const triangle = cross(...raw) < 0 ? [...raw].reverse() : raw;
    let low = 0, high = 1;
    for (let edge = 0; edge < 3; edge++) {
      const p = triangle[edge], q = triangle[(edge + 1) % 3], first = cross(p, q, a), last = cross(p, q, b);
      if (first < -1e-9 && last < -1e-9) { high = -1; break; }
      if (first < 0 && last >= 0) low = Math.max(low, first / (first - last));
      if (last < 0 && first >= 0) high = Math.min(high, first / (first - last));
    }
    if (high - low > 1e-8) intervals.push([low, high]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  const result = [];
  for (const interval of intervals) {
    const last = result.at(-1);
    if (last && interval[0] <= last[1] + 1e-8) last[1] = Math.max(last[1], interval[1]);
    else result.push([...interval]);
  }
  return result;
}

/** Construction cues remain a shallow independent layer on the source wall. */
function addWindowConstruction(layers, linework, frame, triangles, rectangle, specification) {
  const [left, bottom, right, top] = rectangle;
  const {headHeight = 0, transomRatio = 0.5, headStyle = 'solid'} = specification;
  const lift = (point, offset) => frame.lift(point).map((value, i) => value + frame.normal[i] * offset);
  const add = (key, rect, offset) => {
    for (const polygon of clipRectangle(rect, triangles)) for (let i = 1; i + 1 < polygon.length; i++) {
      layers[key].push(...[polygon[0], polygon[i], polygon[i + 1]].flatMap(point => lift(point, offset)));
    }
  };
  const line = (a, b) => {
    for (const [low, high] of lineCoveredIntervals(a, b, triangles)) {
      const at = t => a.map((value, i) => value + (b[i] - value) * t);
      linework.push([lift(at(low), 0.038), lift(at(high), 0.038)]);
    }
  };
  const rectangleLines = ([x0, y0, x1, y1]) => {
    const points = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
    points.forEach((point, index) => line(point, points[(index + 1) % 4]));
  };
  add('reveal', [left - 0.022, bottom - 0.018, right + 0.022, top + 0.018], 0.012);
  add('frame', rectangle, 0.016);
  add('glass', [left + 0.075, bottom + 0.085, right - 0.075, top - Math.max(0.075, headHeight)], 0.024);
  if (headHeight) add(headStyle === 'slatted' ? 'blind' : 'head',
    [left + 0.055, top - headHeight, right - 0.055, top - 0.055], 0.029);
  const transom = bottom + (top - bottom - headHeight) * transomRatio;
  add('head', [left + 0.04, transom - 0.032, right - 0.04, transom + 0.032], 0.031);
  add('sill', [left - 0.025, bottom, right + 0.025, bottom + 0.055], 0.037);
  rectangleLines(rectangle);
  rectangleLines([left + 0.075, bottom + 0.085, right - 0.075, top - Math.max(0.075, headHeight)]);
  line([left + 0.04, transom - 0.032], [right - 0.04, transom - 0.032]);
  line([left + 0.04, transom + 0.032], [right - 0.04, transom + 0.032]);
  if (headStyle === 'slatted') {
    for (let y = top - headHeight + 0.04; y < top - 0.07; y += 0.045) line([left + 0.06, y], [right - 0.06, y]);
  }
}

/**
 * Return batched planar frame/glass/head/sill geometry over broad source walls.
 * Family-specific rules exclude unsupported shared/stair/roof-only portions.
 * Complete openings must fit; split records clip back to each original wall.
 */
export function createWindowStudy(surface, absoluteFloorElevations, roofElevation, layout = null, profile = WINDOW_PROFILE, skipFloors = [], options = {}) {
  const layers = windowLayers(), linework = [], construction = [];
  const empty = {layers, linework, construction, count: 0, patches: [], profile};
  const frame = surfaceFrame(surface);
  const layoutFrame = layout?.frame || frame;
  const span = layout ? layout.maxU - layout.minU : frame ? frame.maxU - frame.minU : 0;
  if (!frame || !options.explicitLayout && span < profile.minimumWallSpan || frame.v[1] < 0.99) return empty;
  if (!Array.isArray(absoluteFloorElevations) || !absoluteFloorElevations.every(Number.isFinite) || !Number.isFinite(roofElevation) ||
    absoluteFloorElevations.some((value, i) => i > 0 && value <= absoluteFloorElevations[i - 1]) || roofElevation <= absoluteFloorElevations.at(-1)) throw new Error('Window study requires ascending finite floor elevations below its roof');
  if (options.explicitLayout && (!Array.isArray(options.explicitLayout.rows) || options.explicitLayout.rows.some(row =>
    !Number.isInteger(row.floor) || row.floor < 0 || row.floor >= absoluteFloorElevations.length))) throw new Error('Explicit window row floors must identify an existing integer floor');
  if (frame.maxV - frame.minV < profile.minimumWallHeight || profile.groundedOnly && Math.min(...surface.points.map(point => point[1])) > absoluteFloorElevations[0] + 0.05) return empty;
  const wallTriangles = triangulatedWall(surface, frame);
  const maskTriangles = exclusionTriangles(options.exclusions || [], frame);
  const toV = height => (height - frame.origin[1]) / frame.v[1];
  const columns = Math.max(1, Math.floor((span - (profile.family === 'plates' ? 0.8 : 3)) / profile.bayPitch));
  const middle = layout ? (layout.minU + layout.maxU) / 2 : (frame.minU + frame.maxU) / 2, patches = [];
  let count = 0;
  const firstFloor = Math.min(profile.firstFloor, ...(options.explicitLayout?.rows || []).map(row => row.floor));
  if (!Number.isInteger(firstFloor) || firstFloor < 0) throw new Error('Explicit window row floors must be nonnegative integers');
  for (let floor = firstFloor; floor < absoluteFloorElevations.length; floor++) {
    if (skipFloors.includes(floor)) continue;
    const explicitRow = options.explicitLayout?.rows?.find(row => row.floor === floor);
    if (options.explicitLayout?.replace && !explicitRow || explicitRow?.disabled) continue;
    if (explicitRow && (!Array.isArray(explicitRow.centers) || !explicitRow.centers.every(Number.isFinite))) throw new Error('Explicit window rows require finite local centres');
    const interval = (absoluteFloorElevations[floor + 1] ?? roofElevation) - absoluteFloorElevations[floor];
    const width = explicitRow?.width ?? profile.width;
    const height = explicitRow?.height ?? (profile.family === 'plates' ? profile.maxHeight : Math.min(profile.maxHeight, interval - 0.4));
    const sillOffset = explicitRow?.sillOffset ?? profile.sillOffset;
    const topFloor = floor === absoluteFloorElevations.length - 1;
    const headHeight = explicitRow?.headHeight ?? (topFloor ? profile.topHeadHeight : undefined) ?? profile.headHeight;
    const headStyle = explicitRow?.headStyle ?? (topFloor ? profile.topHeadStyle : undefined) ?? 'solid';
    const transomRatio = explicitRow?.transomRatio ?? (topFloor ? profile.topTransomRatio : undefined) ?? profile.transomRatio ?? (profile.family === 'plates' ? 0.5 : 0.32);
    if (![width, height, sillOffset, headHeight, transomRatio].every(Number.isFinite) || width <= 0.16 || height <= 0.2 || sillOffset < 0
      || headHeight < 0 || headHeight >= height - 0.17 || transomRatio <= 0 || transomRatio >= 1 || !['solid', 'slatted'].includes(headStyle)) {
      throw new Error('Window construction requires positive finite dimensions and a supported head style');
    }
    if (height < 1 || sillOffset + height + profile.wallClearance > interval) continue;
    const bottom = toV(absoluteFloorElevations[floor] + sillOffset), top = bottom + height;
    const stagger = (floor % 2 ? -0.5 : 0.5) * profile.alternateOffset;
    const centers = explicitRow?.centers ?? Array.from({length: columns}, (_, column) => middle + (column - (columns - 1) / 2) * profile.bayPitch + stagger);
    for (const centerValue of centers) {
      const worldCenter = (explicitRow ? frame : layoutFrame).lift([centerValue, 0]);
      const center = worldCenter.reduce((sum, value, i) => sum + (value - frame.origin[i]) * frame.u[i], 0);
      const layoutCenter = worldCenter.reduce((sum, value, i) => sum + (value - layoutFrame.origin[i]) * layoutFrame.u[i], 0);
      const left = center - width / 2, right = center + width / 2;
      const rectangle = [left, bottom, right, top];
      const layoutBottom = (absoluteFloorElevations[floor] + sillOffset - layoutFrame.origin[1]) / layoutFrame.v[1];
      const clearance = profile.wallClearance;
      if (!rectangleCovered([layoutCenter - width / 2 - clearance, layoutBottom - clearance, layoutCenter + width / 2 + clearance, layoutBottom + height + clearance], layout?.coverageTriangles || wallTriangles)) continue;
      if (clipRectangle([left - clearance, bottom - clearance, right + clearance, top + clearance], maskTriangles).some(polygon => area(polygon) > 1e-9)) continue;
      const clippedArea = clipRectangle(rectangle, wallTriangles).reduce((sum, polygon) => sum + area(polygon), 0);
      if (layout ? clippedArea < 0.00001 : Math.abs(clippedArea - width * height) > 0.00001) continue;
      addWindowConstruction(layers, linework, frame, wallTriangles, rectangle, {headHeight, headStyle, transomRatio});
      patches.push({floor, corners: [[left, bottom], [right, bottom], [right, top], [left, top]].map(point => frame.lift(point))});
      construction.push({floor, headHeight, headStyle, transomRatio, explicit: Boolean(explicitRow)});
      if (clipRectangle([center - 0.0001, (bottom + top) / 2 - 0.0001, center + 0.0001, (bottom + top) / 2 + 0.0001], wallTriangles).length) count++;
    }
  }
  return {layers, linework, construction, count, patches, profile};
}

/** Resident-located openings replace a complete floor's repeated bay pattern.
 * Dimensions/elevations still use the appearance profile. Every whole opening
 * must fit its actual source wall; failures are reported, never shrunk to fit.
 */
function createLocatedWindowStudy(surface, surfaceIndex, elevations, locatedLevels, profile, exclusions = []) {
  const layers = windowLayers(), linework = [], construction = [], patches = [], rejectedLocated = [];
  const frame = surfaceFrame(surface);
  const entries = locatedLevels.flatMap(level => (level.windows || []).filter(window => window.sourceSurfaceIndex === surfaceIndex).map(window => ({floor: level.index, window})));
  if (!entries.length) return {layers, linework, construction, patches, count: 0, locatedCount: 0, rejectedLocated, profile};
  if (!frame || frame.v[1] < 0.99) return {layers, linework, construction, patches, count: 0, locatedCount: 0, rejectedLocated: entries.map(entry => entry.window.id), profile};
  const triangles = triangulatedWall(surface, frame);
  const masks = exclusionTriangles(exclusions, frame);
  for (const {floor, window} of entries) {
    const us = window.segment.map(([x, z]) => (x - frame.origin[0]) * frame.u[0] + (z - frame.origin[2]) * frame.u[2]);
    const left = Math.min(...us), right = Math.max(...us);
    const bottom = (elevations[floor] + profile.sillOffset - frame.origin[1]) / frame.v[1], top = bottom + profile.maxHeight;
    const clearance = profile.wallClearance;
    if (![left, right, bottom, top].every(Number.isFinite)
      || !rectangleCovered([left - clearance, bottom - clearance, right + clearance, top + clearance], triangles)
      || clipRectangle([left - clearance, bottom - clearance, right + clearance, top + clearance], masks).some(polygon => area(polygon) > 1e-9)) {
      rejectedLocated.push(window.id);
      continue;
    }
    addWindowConstruction(layers, linework, frame, triangles, [left, bottom, right, top], {headHeight: 0, transomRatio: 0.5});
    patches.push({floor, corners: [[left, bottom], [right, bottom], [right, top], [left, top]].map(point => frame.lift(point)), windowId: window.id});
    construction.push({floor, headHeight: 0, headStyle: 'solid', transomRatio: 0.5, located: true});
  }
  return {layers, linework, construction, patches, count: patches.length, locatedCount: patches.length, rejectedLocated, profile};
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
  const exclusionsBySurface = options.exclusionsBySurface || new Map();
  const layoutsBySurface = new Map(options.layoutsBySurface || []);
  if(String(options.house)==='55'&&profile.family==='plates'){
    for(const [surface,alignment] of createHouse55WindowAlignment(surfaces,locatedLevels)){
      const existing=layoutsBySurface.get(surface);
      layoutsBySurface.set(surface,existing?{
        ...alignment,...existing,
        rows:[...alignment.rows.filter(row=>!existing.rows.some(other=>other.floor===row.floor)),...existing.rows],
        replaceLocatedFloors:[...new Set([...(alignment.replaceLocatedFloors||[]),...(existing.replaceLocatedFloors||[])])],
      }:alignment);
    }
  }
  const skipFloors = locatedLevels.filter(level => level.windowCoverage === 'complete-floor').map(level => level.index);
  // An explicitly replaced appearance row may suppress a located opening
  // without deleting or relabeling its original evidence record.
  const renderLocatedLevels=locatedLevels.map(level=>({
    ...level,windows:(level.windows||[]).filter(window=>
      !layoutsBySurface.get(surfaces[window.sourceSurfaceIndex])?.replaceLocatedFloors?.includes(level.index)),
  }));
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
    if (anchor.frame.maxU - anchor.frame.minU < profile.minimumAnchorSpan && !group.some(item => layoutsBySurface.has(item.surface))) continue;
    const us = group.flatMap(item => item.surface.points.map(point => point.reduce((sum, value, i) => sum + (value - anchor.frame.origin[i]) * anchor.frame.u[i], 0)));
    const layout = {frame: anchor.frame, minU: Math.min(...us), maxU: Math.max(...us), coverageTriangles: group.flatMap(item => triangulatedWall(item.surface, anchor.frame))};
    const exclusions = group.flatMap(item => exclusionsBySurface.get(item.surface) || []);
    for (const item of group) studies.set(item.surface, createWindowStudy(item.surface, elevations, roofElevation, layout, profile,
      skipFloors.filter(floor=>!layoutsBySurface.get(item.surface)?.replaceLocatedFloors?.includes(floor)), {
      exclusions, explicitLayout: layoutsBySurface.get(item.surface),
    }));
  }
  for (const [index, surface] of surfaces.entries()) {
    const located = createLocatedWindowStudy(surface, index, elevations, renderLocatedLevels, profile, exclusionsBySurface.get(surface) || []);
    if (!located.count && !located.rejectedLocated.length) continue;
    const existing = studies.get(surface);
    if (!existing) studies.set(surface, located);
    else studies.set(surface, {
      ...existing, count: existing.count + located.count, locatedCount: located.locatedCount, rejectedLocated: located.rejectedLocated,
      patches: [...existing.patches, ...located.patches],
      linework: [...existing.linework, ...located.linework],
      construction: [...existing.construction, ...located.construction],
      layers: Object.fromEntries(Object.keys(existing.layers).map(key => [key, [...existing.layers[key], ...located.layers[key]]])),
    });
  }
  return studies;
}
