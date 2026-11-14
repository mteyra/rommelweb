/**
 * Photo-informed material marks, not measured facade or window geometry.
 * Exact LoD2 surface rings are inputs and are never changed by this module.
 */
export const FACADE_PROFILES = Object.freeze({
  timber: Object.freeze({
    family: 'timber', material: 'untreated larch, vertical boarding',
    spacing: 0.18, courseHeight: 3,
    source: 'https://www.karlundp.de/projekt/wohnanlage-fuer-studierende-erlangen/',
    status: 'Schematic material hatching; pitch and joint positions are illustrative, with no inferred windows.',
  }),
  plates: Object.freeze({
    family: 'plates', material: 'reddish-brown horizontal plates with staggered joints',
    spacing: 1.2, courseHeight: 0.3,
    source: 'https://www.werkswelt.de/data/uploads/wohnen/wh-e-rommel.jpg',
    status: 'Schematic material hatching; pitch and joint positions are illustrative, with no inferred windows.',
  }),
});

const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const subtract = (a, b) => a.map((value, i) => value - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = vector => { const length = Math.hypot(...vector); return length > 1e-10 ? vector.map(value => value / length) : null; };

/** Even/odd scanline clipping supports concave rings and holes. */
function scanIntervals(rings, axis, value) {
  const along = 1 - axis;
  const crossings = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i], b = ring[i + 1];
      if ((a[axis] > value) !== (b[axis] > value)) {
        crossings.push(a[along] + (b[along] - a[along]) * (value - a[axis]) / (b[axis] - a[axis]));
      }
    }
  }
  crossings.sort((a, b) => a - b);
  const intervals = [];
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    if (crossings[i + 1] - crossings[i] > 0.025) intervals.push([crossings[i], crossings[i + 1]]);
  }
  return intervals;
}

export function surfaceFrame(surface) {
  if (surface.type !== 'WallSurface' || !Array.isArray(surface.points) || surface.points.length < 4) return null;
  const points = surface.points;
  const normal = [0, 0, 0];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    normal[0] += (a[1] - b[1]) * (a[2] + b[2]);
    normal[1] += (a[2] - b[2]) * (a[0] + b[0]);
    normal[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const n = normalize(normal);
  if (!n) return null;
  const u = normalize([n[2], 0, -n[0]]);
  if (!u) return null;
  let v = normalize(cross(n, u));
  if (v[1] < 0) v = v.map(value => -value);
  const origin = points[0];
  const project = point => { const offset = subtract(point, origin); return [dot(offset, u), dot(offset, v)]; };
  const lift = ([horizontal, vertical]) => origin.map((value, i) => value + u[i] * horizontal + v[i] * vertical);
  const rings = [points, ...(surface.holes || [])].map(ring => ring.map(project));
  const us = rings[0].map(point => point[0]), vs = rings[0].map(point => point[1]);
  const minU = Math.min(...us), maxU = Math.max(...us), minV = Math.min(...vs), maxV = Math.max(...vs);
  return { origin, normal: n, u, v, rings, lift, minU, maxU, minV, maxV };
}

/**
 * Generate surface-clipped 3D line segment pairs. detail=4 is a coarser map LOD.
 * No wall, window, opening, room boundary or source height is generated here.
 */
export function createFacadeSegments(surface, family = 'timber', detail = 1) {
  const frame = surfaceFrame(surface);
  if (!frame) return [];
  const profile = FACADE_PROFILES[family];
  if (!profile || !Number.isFinite(detail) || detail < 1) throw new Error('Facade requires a known material profile and detail multiplier >= 1');
  const { rings, lift, minU, maxU, minV, maxV } = frame;
  const segments = [];
  const add = (a, b) => segments.push([lift(a), lift(b)]);
  if (family === 'timber') {
    const pitch = profile.spacing * detail;
    // Coarse LOD keeps a subset of the fine boards, so blending never slides
    // material seams sideways as the camera approaches.
    for (let value = Math.ceil(minU / pitch) * pitch + profile.spacing * 0.12; value < maxU; value += pitch) {
      for (const [a, b] of scanIntervals(rings, 0, value)) add([value, a], [value, b]);
    }
  } else {
    const height = profile.courseHeight * detail;
    const width = profile.spacing * detail;
    const firstRow = Math.floor(minV / height);
    for (let row = firstRow; row * height < maxV; row++) {
      const bottom = row * height, top = bottom + height;
      if (bottom > minV + 0.025) {
        for (const [a, b] of scanIntervals(rings, 1, bottom)) add([a, bottom], [b, bottom]);
      }
      const stagger = (row % 2) * width / 2;
      for (let value = Math.floor((minU - stagger) / width) * width + stagger; value < maxU; value += width) {
        if (value < minU + 0.025) continue;
        for (const [a, b] of scanIntervals(rings, 0, value)) {
          const low = Math.max(a, bottom), high = Math.min(b, top);
          if (high - low > 0.025) add([value, low], [value, high]);
        }
      }
    }
  }
  return segments;
}

/**
 * Clip illustrative horizontal storey joints to an official wall.
 * Elevations use the campus datum; their source may be provisional floor spacing.
 * These marks do not turn floor assumptions into measured facade features.
 */
export function createStoreyJointSegments(surface, elevations) {
  if (!Array.isArray(elevations) || !elevations.every(Number.isFinite)) throw new Error('Storey joint elevations must be finite metres');
  const frame = surfaceFrame(surface);
  if (!frame || frame.v[1] < 1e-8) return [];
  const { origin, v, rings, lift, minV, maxV } = frame;
  const segments = [];
  for (const elevation of new Set(elevations)) {
    const height = (elevation - origin[1]) / v[1];
    if (height <= minV + 0.025 || height >= maxV - 0.025) continue;
    for (const [a, b] of scanIntervals(rings, 1, height)) segments.push([lift([a, height]), lift([b, height])]);
  }
  return segments;
}
