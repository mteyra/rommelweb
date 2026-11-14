import { union, difference } from 'polyclip-ts';
import { pathSources } from './paths.js';

const closeRing = points => [...points, [...points[0]]];
const merge = polygons => polygons.length ? union(...polygons) : [];

/**
 * A round drawing buffer around the untouched source centerline.
 * Rounded joins/caps are display conventions, not surveyed kerb geometry.
 * Every buffer point remains within half the mapped width of that centerline.
 */
function bufferPieces(points, width) {
  if (!Number.isFinite(width) || width <= 0) throw new Error('Path buffer requires a positive mapped width');
  if (!Array.isArray(points) || points.length < 2 || !points.every(point => point.length === 2 && point.every(Number.isFinite))) throw new Error('Path centerline requires finite [x,z] source points');
  const radius = width / 2, pieces = [];
  const distinct = points.filter((point, i) => i === 0 || point[0] !== points[i - 1][0] || point[1] !== points[i - 1][1]);
  if (distinct.length < 2) return pieces;
  // At most ~2 cm radial approximation for the largest campus street.
  const steps = Math.max(16, Math.min(48, Math.ceil(Math.PI / Math.acos(Math.max(-1, 1 - 0.02 / radius))) * 2));
  for (const point of distinct) {
    pieces.push([closeRing(Array.from({ length: steps }, (_, i) => {
      const angle = i * Math.PI * 2 / steps;
      return [point[0] + Math.cos(angle) * radius, point[1] + Math.sin(angle) * radius];
    }))]);
  }
  for (let i = 1; i < distinct.length; i++) {
    const a = distinct[i - 1], b = distinct[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = -(b[1] - a[1]) / length * radius, dz = (b[0] - a[0]) / length * radius;
    pieces.push([closeRing([[a[0] + dx, a[1] + dz], [a[0] - dx, a[1] - dz], [b[0] - dx, b[1] - dz], [b[0] + dx, b[1] + dz]])]);
  }
  return pieces;
}

export function bufferMappedPath(points, width) {
  return merge(bufferPieces(points, width));
}

/**
 * Merge width-tagged streets into a continuous visual network. Intersection
 * boundaries disappear; the narrower path fill is cut away beneath roads.
 * No width is inferred for any untagged way, and no source vertex is smoothed.
 */
export function buildPathNetwork(context) {
  const sources = pathSources(context);
  const roads = [], footpaths = [], centerlines = [];
  for (const source of sources) {
    if (source.width === null) centerlines.push(source);
    else (source.family === 'road' ? roads : footpaths).push(...bufferPieces(source.points, source.width));
  }
  const roadPolygons = merge(roads), footpathPolygons = merge(footpaths);
  const polygons = merge([roadPolygons, footpathPolygons].filter(polygons => polygons.length));
  const footpathFill = roadPolygons.length && footpathPolygons.length ? difference(footpathPolygons, roadPolygons) : footpathPolygons;
  return {
    sources, polygons, roadPolygons, footpathPolygons: footpathFill, centerlines,
    sourceStatus: 'OSM source centerlines and explicit widths preserved; round joins/caps are visual conventions. Untagged widths use screen-width lines only.',
    counts: { ways: sources.length, mappedWidths: sources.length - centerlines.length, unknownWidths: centerlines.length, islands: polygons.length },
  };
}
