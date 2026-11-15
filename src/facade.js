import { Color } from 'three';
import { difference } from 'polyclip-ts';

/**
 * Photo-informed material marks, not measured facade or window geometry.
 * Exact LoD2 surface rings are inputs and are never changed by this module.
 */
export const FACADE_PROFILES = Object.freeze({
  timber: Object.freeze({
    family: 'timber', material: 'untreated larch, vertical boarding',
    spacing: 0.14, courseHeight: 3,
    source: 'https://www.karlundp.de/projekt/wohnanlage-fuer-studierende-erlangen/',
    status: 'Photo-informed board grooves and sparse grain; pitch, weathering and joint positions are illustrative, with no inferred windows.',
  }),
  plates: Object.freeze({
    family: 'plates', material: 'reddish-brown horizontal plates with staggered joints',
    spacing: 1.15, courseHeight: 0.38,
    source: 'https://www.werkswelt.de/data/uploads/wohnen/wh-e-rommel.jpg',
    status: 'Photo-informed large horizontal panels with offset vertical joints; pitch and joint positions are illustrative, with no inferred windows.',
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
  return { origin, normal: n, u, v, rings, project, lift, minU, maxU, minV, maxV };
}

/** Independent exclusions are subtracted as a union, never even/odd-toggled. */
function maskedIntervals(frame, axis, value, exclusions = []) {
  let intervals = scanIntervals(frame.rings, axis, value);
  for (const ring of exclusions) {
    for (const [start, end] of scanIntervals([ring], axis, value)) {
      intervals = intervals.flatMap(([a, b]) => end <= a || start >= b ? [[a, b]]
        : [[a, Math.min(b, start)], [Math.max(a, end), b]].filter(([low, high]) => high - low > 0.025));
    }
  }
  return intervals;
}

const noise = index => {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/**
 * Shade multiplier for original procedural timber grooves. The value varies
 * with board and height; it is not sampled from a photograph or a material map.
 */
export function timberLineBrightness(segment) {
  const [a, b] = segment;
  const index = Math.round((a[0] * 0.73 + a[2] * 1.31) * 25);
  return 0.44 + 0.56 * noise(index + Math.round((a[1] + b[1]) * 0.3));
}

const timberPalettes = Object.freeze({
  day: [new Color(0x908d85), new Color(0xa08b70)],
  night: [new Color(0x545149), new Color(0x594b3b)],
});
/**
 * Original, restrained board-color study on the unchanged source wall plane.
 * Returns triangle positions and linear-RGB day/night vertex colors. Palette,
 * grain, board module and weathering are illustrative, never image samples.
 * Adjacent board pairs share a color field to keep the layer small;
 * the separate groove/line study still resolves every individual board.
 * elevations, when supplied, are absolute storey edges including the roof;
 * otherwise a 3m display module is used from elevationOrigin.
 */
export function createTimberBoardStudy(surface, options = {}) {
  const empty = {positions: [], dayColors: [], nightColors: [], boardCount: 0};
  const frame = surfaceFrame(surface);
  if (!frame || frame.v[1] < 0.99) return empty;
  const origin = options.elevationOrigin ?? 0;
  if (!Number.isFinite(origin)) throw new Error('Timber elevation origin must be finite');
  const minY = frame.origin[1] + frame.minV * frame.v[1], maxY = frame.origin[1] + frame.maxV * frame.v[1];
  const elevations = options.elevations ?? Array.from({
    length: Math.ceil((maxY - origin) / 3) - Math.floor((minY - origin) / 3) + 1,
  }, (_, index) => origin + (Math.floor((minY - origin) / 3) + index) * 3);
  if (!Array.isArray(elevations) || elevations.length < 2 || !elevations.every(Number.isFinite)
    || elevations.some((value, index) => index && value <= elevations[index - 1])) {
    throw new Error('Timber storey edges must be ascending finite absolute elevations');
  }
  const source = frame.rings;
  const masks = (options.exclusions || []).map(ring => {
    if (!Array.isArray(ring) || ring.length < 4 || ring.some(point => !Array.isArray(point)
      || point.length !== 3 || !point.every(Number.isFinite)) || Math.hypot(...subtract(ring[0], ring.at(-1))) > 1e-8) {
      throw new Error('Timber exclusions must be finite closed 3D rings');
    }
    return ring.map(frame.project);
  });
  const visible = masks.length ? difference(source, ...masks.map(ring => [ring])) : [source];
  const boundaries = visible.flatMap(polygon => polygon.flatMap(ring => ring.slice(1).flatMap((b, i) => {
    const a = ring[i], deltaX = b[0] - a[0];
    if (Math.abs(deltaX) < 1e-10) return [];
    const slope = (b[1] - a[1]) / deltaX;
    return [{left: Math.min(a[0], b[0]), right: Math.max(a[0], b[0]), slope, intercept: a[1] - a[0] * slope}];
  })));
  const events = [...new Set(visible.flat(2).map(point => point[0]))].sort((a, b) => a - b);
  const result = {...empty};
  const phase = dot(frame.origin, frame.u), pitch = FACADE_PROFILES.timber.spacing, groupSize = 2;
  const seam = index => index * pitch + (noise(index) - 0.5) * 0.018 - phase;
  const color = (index, y, palette) => {
    let band = elevations.findIndex((height, i) => i < elevations.length - 1 && y <= elevations[i + 1]);
    if (band < 0) band = elevations.length - 2;
    const heightFraction = Math.min(1, Math.max(0, (y - elevations[band]) / (elevations[band + 1] - elevations[band])));
    // Some sheltered warmth beneath each floor trim, with broad weathered
    // areas below; no high-frequency mottling or artificial knot marks.
    const warmth = Math.min(0.92, 0.13 + noise(index + 91) * 0.55 + 0.2 * heightFraction ** 4);
    const brightness = 0.91 + noise(index + 137) * 0.14 + 0.025 * Math.cos(heightFraction * Math.PI);
    const [silver, ochre] = palette;
    return ['r', 'g', 'b'].map(key => (silver[key] + (ochre[key] - silver[key]) * warmth) * brightness);
  };
  for (let index = (Math.floor((frame.minU + phase) / pitch / groupSize) - 1) * groupSize; seam(index) < frame.maxU; index += groupSize) {
    const left = Math.max(frame.minU, seam(index) + 0.011), right = Math.min(frame.maxU, seam(index + groupSize));
    if (right - left <= 1e-8) continue;
    const firstPosition = result.positions.length;
    // Sweep the already-subtracted polygons. At each x event the visible
    // intervals are bounded by two known straight edges, giving exact small
    // trapezoids without retaining a whole-wall triangulation's diagonals.
    const slices = [left, ...events.filter(x => x > left + 1e-9 && x < right - 1e-9), right];
    for (let slice = 1; slice < slices.length; slice++) {
      const a = slices[slice - 1], b = slices[slice], middle = (a + b) / 2;
      if (b - a < 1e-9) continue;
      const crossings = boundaries.filter(edge => middle > edge.left && middle < edge.right)
        .sort((first, last) => first.slope * middle + first.intercept - last.slope * middle - last.intercept);
      for (let edge = 1; edge < crossings.length; edge += 2) {
        const low = crossings[edge - 1], high = crossings[edge];
        const points = [[a, low.slope * a + low.intercept], [b, low.slope * b + low.intercept],
          [b, high.slope * b + high.intercept], [a, high.slope * a + high.intercept]];
        for (const triangle of [[0, 1, 2], [0, 2, 3]]) {
          const [p, q, r] = triangle.map(vertex => points[vertex]);
          if (Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1])) < 1e-10) continue;
          for (const vertex of triangle) {
            const world = frame.lift(points[vertex]);
            result.positions.push(...world);
            result.dayColors.push(...color(index, world[1], timberPalettes.day));
            result.nightColors.push(...color(index, world[1], timberPalettes.night));
          }
        }
      }
    }
    if (result.positions.length > firstPosition) result.boardCount += groupSize;
  }
  return result;
}

/**
 * Generate surface-clipped 3D line segment pairs. detail=4 is a coarser map LOD.
 * No wall, window, opening, room boundary or source height is generated here.
 */
export function createFacadeSegments(surface, family = 'timber', detail = 1, options = {}) {
  const frame = surfaceFrame(surface);
  if (!frame) return [];
  const profile = FACADE_PROFILES[family];
  if (!profile || !Number.isFinite(detail) || detail < 1) throw new Error('Facade requires a known material profile and detail multiplier >= 1');
  const { rings, lift, minU, maxU, minV, maxV } = frame;
  const exclusions = (options.exclusions || []).map(ring => ring.map(frame.project));
  const scan = (axis, value) => maskedIntervals(frame, axis, value, exclusions);
  const segments = [];
  const add = (a, b) => segments.push([lift(a), lift(b)]);
  if (family === 'timber') {
    const phase = dot(frame.origin, frame.u), step = Math.max(1, Math.round(detail));
    // Global projected board coordinates stay aligned across coplanar source
    // patches. Coarse LOD selects real fine seams without sliding them.
    for (let index = Math.floor((minU + phase) / profile.spacing) - 1; index * profile.spacing < maxU + phase + profile.spacing; index++) {
      if (index % step) continue;
      const value = index * profile.spacing + (noise(index) - 0.5) * 0.018 - phase;
      for (const groove of detail < 2 ? [value, value + 0.011] : [value]) {
        if (groove <= minU + 0.01 || groove >= maxU - 0.01) continue;
        for (const [a, b] of scan(0, groove)) add([groove, a], [groove, b]);
      }
      // Sparse short grain strokes avoid an uninterrupted mathematical grid.
      // They remain vertical, contained, and absent from the overview LOD.
      if (detail < 2 && index % 3 === 0) {
        const grain = value + profile.spacing * (0.38 + noise(index + 9) * 0.2);
        if (grain <= minU + 0.01 || grain >= maxU - 0.01) continue;
        for (const [a, b] of scan(0, grain)) {
          const low = a + (b - a) * (0.08 + 0.28 * noise(index + 27));
          const high = a + (b - a) * (0.66 + 0.26 * noise(index + 53));
          if (high - low > 0.025) add([grain, low], [grain, high]);
        }
      }
    }
  } else {
    const height = profile.courseHeight * detail;
    const width = profile.spacing * detail;
    const originHeight = options.elevationOrigin || 0;
    const verticalPhase = (frame.origin[1] - originHeight) / frame.v[1], horizontalPhase = dot(frame.origin, frame.u);
    const firstRow = Math.floor((minV + verticalPhase) / height);
    for (let row = firstRow; row * height < maxV + verticalPhase; row++) {
      const bottom = row * height - verticalPhase, top = bottom + height;
      if (bottom > minV + 0.025) {
        for (const [a, b] of scan(1, bottom)) add([a, bottom], [b, bottom]);
      }
      const stagger = (row % 2) * width / 2;
      for (let value = Math.floor((minU + horizontalPhase - stagger) / width) * width + stagger - horizontalPhase; value < maxU; value += width) {
        if (value < minU + 0.025) continue;
        for (const [a, b] of scan(0, value)) {
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
export function createStoreyJointSegments(surface, elevations, options = {}) {
  if (!Array.isArray(elevations) || !elevations.every(Number.isFinite)) throw new Error('Storey joint elevations must be finite metres');
  const frame = surfaceFrame(surface);
  if (!frame || frame.v[1] < 1e-8) return [];
  const { origin, v, rings, lift, minV, maxV } = frame;
  const exclusions = (options.exclusions || []).map(ring => ring.map(frame.project));
  const segments = [];
  for (const elevation of new Set(elevations)) {
    const height = (elevation - origin[1]) / v[1];
    if (height <= minV + 0.025 || height >= maxV - 0.025) continue;
    for (const [a, b] of maskedIntervals(frame, 1, height, exclusions)) segments.push([lift([a, height]), lift([b, height])]);
  }
  return segments;
}
