import { ShapeUtils, Vector2 } from 'three';

const ROAD_TYPES = new Set(['residential', 'service', 'unclassified', 'living_street']);

export function mappedPathWidth(tags) {
  const width = Number(tags.width);
  return Number.isFinite(width) && width > 0 && width <= 30 ? width : null;
}

/** Stable records used by the generator, runtime cache check and provenance. */
export function pathSources(context) {
  return context.filter(path => path.kind === 'path' && path.tags.highway && path.tags.indoor !== 'yes').map(path => ({
    id: path.id, url: path.osmUrl, highway: path.tags.highway, name: path.tags.name || null,
    family: ROAD_TYPES.has(path.tags.highway) ? 'road' : path.tags.highway === 'steps' ? 'steps' : 'footpath',
    points: path.points.map(point => [...point]), width: mappedPathWidth(path.tags),
  })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export async function pathSourceDigest(context) {
  const bytes = new TextEncoder().encode(JSON.stringify(pathSources(context)));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

export async function validatePathNetwork(network, context) {
  if (network?.schemaVersion !== 1 || network?.algorithmVersion !== 1) throw new Error('Unsupported path-network cache');
  const sources = pathSources(context);
  if (network.sourceSha256 !== await pathSourceDigest(context) || JSON.stringify(network.sources) !== JSON.stringify(sources)) throw new Error('Path-network cache is stale');
  for (const key of ['polygons', 'roadPolygons', 'footpathPolygons']) {
    if (!Array.isArray(network[key])) throw new Error('Path-network polygons are missing');
    for (const polygon of network[key]) {
      if (!Array.isArray(polygon) || !polygon.length) throw new Error('Path-network polygon is empty');
      for (const ring of polygon) {
        if (!Array.isArray(ring) || ring.length < 4 || !ring.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)) || ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) throw new Error('Path-network rings must be finite and closed');
      }
    }
  }
  const centerlines = sources.filter(source => source.width === null);
  if (network.counts?.ways !== sources.length || network.counts?.mappedWidths !== sources.length - centerlines.length || network.counts?.unknownWidths !== centerlines.length || network.counts?.islands !== network.polygons.length || JSON.stringify(network.centerlines) !== JSON.stringify(centerlines)) throw new Error('Path-network provenance does not match its source');
  return true;
}

/** Cache failure is deliberately non-fatal: source centerlines remain visible. */
export async function loadPathNetwork(context, url, fetcher = globalThis.fetch) {
  try {
    const response = await fetcher(url, {signal: AbortSignal.timeout(2500)});
    if (!response.ok) return null;
    const network = await response.json();
    await validatePathNetwork(network, context);
    return network;
  } catch {
    return null;
  }
}

export function triangulatePathPolygons(polygons, elevation = 0) {
  return polygons.flatMap(([outer, ...holes]) => {
    const rings = [outer, ...holes].map(ring => ring.slice(0, -1));
    const vertices = rings.flat();
    return ShapeUtils.triangulateShape(rings[0].map(point => new Vector2(...point)), rings.slice(1).map(ring => ring.map(point => new Vector2(...point))))
      .flatMap(indices => indices.flatMap(index => [vertices[index][0], elevation, vertices[index][1]]));
  });
}

/** Exterior and hole boundaries only, with no edges left inside intersections. */
export function pathBoundarySegments(polygons, elevation = 0) {
  return polygons.flatMap(polygon => polygon.flatMap(ring => ring.slice(1).flatMap((point, i) =>
    [[ring[i][0], elevation, ring[i][1]], [point[0], elevation, point[1]]]))).flat();
}
