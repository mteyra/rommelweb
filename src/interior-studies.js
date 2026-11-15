import { getInteriorLevel, validateInteriorPolygon } from './interiors.js';

const KINDS = new Set(['room', 'corridor', 'stairs', 'lift', 'shared', 'service']);
const CONFIDENCE = new Set(['sketch', 'estimated']);
const fail = (path, message) => { throw new Error(`Interior study ${path}: ${message}`); };

function object(value, path, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object');
  for (const field of Object.keys(value)) {
    if (!fields.includes(field)) fail(`${path}.${field}`, 'is not allowed; studies contain geometry and source notes only');
  }
}

function text(value, path, max = 2000) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[<>\u0000-\u001f]/u.test(value)) fail(path, 'must be nonempty plain text');
}

function pointOnStudySegment(a, b, point) {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
  if (!length) return false;
  const along = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / length;
  return Math.abs(dx * (point[1] - a[1]) - dz * (point[0] - a[0])) / length <= 0.002 && along >= -0.002 && along <= length + 0.002;
}

export function pointInStudyRing(point, ring) {
  let inside = false;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i], b = ring[i + 1];
    if (pointOnStudySegment(a, b, point)) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function pointInStudyOutline(point, polygons) {
  return polygons.some(({outer, holes = []}) => pointInStudyRing(point, outer) && !holes.some(hole => {
    // Shared boundary lines are valid; only the hole's open interior is absent.
    const onBoundary = hole.slice(1).some((b, i) => pointOnStudySegment(hole[i], b, point));
    return !onBoundary && pointInStudyRing(point, hole);
  }));
}

const ringArea = ring => Math.abs(ring.slice(1).reduce((sum, b, i) => sum + ring[i][0] * b[1] - b[0] * ring[i][1], 0) / 2);
const rings = space => [space.polygon, ...(space.holes || [])];

function interiorProbes(polygon) {
  return [polygon.outer, ...(polygon.holes || [])].flatMap((ring, ringIndex) => {
    const signedArea = ring.slice(1).reduce((sum, b, i) => sum + ring[i][0] * b[1] - b[0] * ring[i][1], 0);
    const direction = Math.sign(signedArea) * (ringIndex ? -1 : 1);
    return ring.slice(1).flatMap((b, i) => {
      const a = ring[i], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < 0.01) return [];
      const inset = Math.min(0.01, length / 4) * direction;
      return [[(a[0] + b[0]) / 2 - dz / length * inset, (a[1] + b[1]) / 2 + dx / length * inset]];
    });
  });
}

function boundariesCross(a, b) {
  const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const edges = polygon => [polygon.outer, ...(polygon.holes || [])].flatMap(ring => ring.slice(1).map((point, i) => [ring[i], point]));
  return edges(a).some(([p, q]) => edges(b).some(([r, s]) => {
    const a1 = cross(p, q, r), a2 = cross(p, q, s), b1 = cross(r, s, p), b2 = cross(r, s, q);
    const pa = Math.hypot(q[0] - p[0], q[1] - p[1]) * 0.002, pb = Math.hypot(s[0] - r[0], s[1] - r[1]) * 0.002;
    return (a1 > pa && a2 < -pa || a1 < -pa && a2 > pa) && (b1 > pb && b2 < -pb || b1 < -pb && b2 > pb);
  }));
}

function overlapsArea(a, b) {
  return boundariesCross(a, b)
    || interiorProbes(a).some(point => pointInStudyOutline(point, [b]))
    || interiorProbes(b).some(point => pointInStudyOutline(point, [a]));
}

/** A separate, explicitly unmeasured layer. It can never create approval or floor-height anchors. */
export function validateInteriorStudies(studies, campus, lod2) {
  object(studies, '$', ['schemaVersion', 'buildings']);
  if (studies.schemaVersion !== 1) fail('$.schemaVersion', 'must be 1');
  object(studies.buildings, '$.buildings', Object.keys(studies.buildings || {}));
  const ids = new Set();
  const identify = (item, path) => {
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(item.id) || ids.has(item.id)) fail(`${path}.id`, 'must be a unique stable geometry ID');
    ids.add(item.id);
    text(item.label, `${path}.label`, 160);
  };
  for (const [number, building] of Object.entries(studies.buildings)) {
    const path = `$.buildings[${number}]`;
    const mapped = campus?.buildings.find(item => item.number === number);
    if (!mapped || !lod2?.buildings.some(item => item.number === number)) fail(path, 'must identify an existing house');
    object(building, path, ['source', 'sourceDate', 'levels']);
    text(building.source, `${path}.source`);
    if (building.sourceDate !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(building.sourceDate) || !Number.isFinite(Date.parse(building.sourceDate)) || new Date(building.sourceDate).toISOString().slice(0, 10) !== building.sourceDate) fail(`${path}.sourceDate`, 'must be a calendar date');
    }
    if (!Array.isArray(building.levels) || !building.levels.length) fail(`${path}.levels`, 'requires at least one study floor');
    const indexes = new Set();
    for (const level of building.levels) {
      const lp = `${path}.levels[${level.index}]`;
      object(level, lp, ['index', 'label', 'source', 'notes', 'floorOutline', 'excludedAreas', 'sketchBoundaries', 'spaces', 'doors']);
      if (!Number.isInteger(level.index) || level.index < 0 || level.index >= mapped.levels || indexes.has(level.index)) fail(`${lp}.index`, 'must identify a unique existing floor');
      indexes.add(level.index);
      for (const field of ['label', 'source', 'notes']) text(level[field], `${lp}.${field}`);
      if (!Array.isArray(level.floorOutline) || !level.floorOutline.length) fail(`${lp}.floorOutline`, 'requires a nonempty floor outline');
      for (const [i, piece] of level.floorOutline.entries()) {
        object(piece, `${lp}.floorOutline[${i}]`, ['outer', 'holes']);
        validateInteriorPolygon(piece.outer, `${lp}.floorOutline[${i}].outer`);
        if (piece.holes !== undefined && !Array.isArray(piece.holes)) fail(lp, 'holes must be an array');
        for (const hole of piece.holes || []) {
          validateInteriorPolygon(hole, `${lp}.floorOutline[${i}].holes`);
          if (!hole.every(point => pointInStudyRing(point, piece.outer)) || boundariesCross({outer: hole}, {outer: piece.outer})) fail(lp, 'a floor hole must stay inside its outer ring');
        }
      }
      if (!Array.isArray(level.spaces) || !level.spaces.length) fail(`${lp}.spaces`, 'requires study space geometry');
      for (const [i, space] of level.spaces.entries()) {
        const sp = `${lp}.spaces[${i}]`;
        object(space, sp, ['id', 'label', 'shortLabel', 'kind', 'confidence', 'note', 'polygon', 'holes']);
        identify(space, sp);
        if (space.shortLabel !== undefined) text(space.shortLabel, `${sp}.shortLabel`, 16);
        if (!KINDS.has(space.kind) || !CONFIDENCE.has(space.confidence)) fail(sp, 'requires a known space kind and sketch/estimated confidence');
        if (space.note !== undefined) text(space.note, `${sp}.note`);
        validateInteriorPolygon(space.polygon, `${sp}.polygon`);
        if (space.holes !== undefined && !Array.isArray(space.holes)) fail(sp, 'holes must be an array');
        for (const hole of space.holes || []) {
          validateInteriorPolygon(hole, `${sp}.holes`);
          if (!hole.every(point => pointInStudyRing(point, space.polygon)) || boundariesCross({outer: hole}, {outer: space.polygon})) fail(sp, 'space holes must stay inside their outer ring');
        }
        const samples = rings(space).flatMap(ring => ring.slice(1).flatMap((b, i) => Array.from({length: 5}, (_, t) => [ring[i][0] + (b[0] - ring[i][0]) * t / 4, ring[i][1] + (b[1] - ring[i][1]) * t / 4])));
        if (!samples.every(point => pointInStudyOutline(point, level.floorOutline))) fail(sp, 'space edges must stay within the displayed floor');
        const spacePolygon = {outer: space.polygon, holes: space.holes || []};
        if (level.floorOutline.some(piece => boundariesCross(spacePolygon, piece)
          || (piece.holes || []).some(hole => overlapsArea(spacePolygon, {outer: hole})))) fail(sp, 'space must not cover a floor cutout or cross the floor boundary');
      }
      for (let i = 0; i < level.spaces.length; i++) for (let j = i + 1; j < level.spaces.length; j++) {
        const a = level.spaces[i], b = level.spaces[j];
        if (overlapsArea({outer: a.polygon, holes: a.holes}, {outer: b.polygon, holes: b.holes})) fail(`${lp}.spaces`, `${a.id} overlaps ${b.id}; shared edges are allowed, overlapping areas are not`);
      }
      if (level.excludedAreas !== undefined && !Array.isArray(level.excludedAreas)) fail(lp, 'excludedAreas must be an array');
      for (const area of level.excludedAreas || []) {
        object(area, `${lp}.excludedAreas`, ['id', 'label', 'polygon']);
        identify(area, `${lp}.excludedAreas`);
        validateInteriorPolygon(area.polygon, `${lp}.excludedAreas.polygon`);
        if (level.floorOutline.some(piece => overlapsArea(piece, {outer: area.polygon}))) fail(lp, 'excluded areas must contain no displayed floor');
      }
      if (level.sketchBoundaries !== undefined && !Array.isArray(level.sketchBoundaries)) fail(lp, 'sketchBoundaries must be an array');
      for (const segment of level.sketchBoundaries || []) {
        if (!Array.isArray(segment) || segment.length !== 2 || !segment.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))
          || Math.hypot(segment[1][0] - segment[0][0], segment[1][1] - segment[0][1]) < 0.01) fail(`${lp}.sketchBoundaries`, 'requires two distinct finite endpoints per segment');
      }
      if (level.doors !== undefined && !Array.isArray(level.doors)) fail(lp, 'doors must be an array');
      for (const door of level.doors || []) {
        const dp = `${lp}.doors`;
        object(door, dp, ['id', 'label', 'spaceId', 'toSpaceId', 'confidence', 'note', 'segment']);
        identify(door, dp);
        if (!CONFIDENCE.has(door.confidence)) fail(dp, 'door confidence is required');
        if (door.note !== undefined) text(door.note, `${dp}.note`);
        if (!Array.isArray(door.segment) || door.segment.length !== 2 || !door.segment.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))) fail(dp, 'requires two finite door endpoints');
        const width = Math.hypot(door.segment[1][0] - door.segment[0][0], door.segment[1][1] - door.segment[0][1]);
        if (width < 0.4 || width > 3) fail(dp, 'door width must be 0.4–3 m');
        const from = level.spaces.find(space => space.id === door.spaceId);
        const onBoundary = space => space && rings(space).some(ring => ring.slice(1).some((b, i) => door.segment.every(point => pointOnStudySegment(ring[i], b, point))));
        if (!onBoundary(from)) fail(dp, 'door must be on its source space boundary');
        if (door.toSpaceId !== undefined) {
          const to = level.spaces.find(space => space.id === door.toSpaceId);
          if (from === to || !onBoundary(to)) fail(dp, 'door must share the destination boundary');
        }
      }
    }
  }
  return true;
}

export function getDisplayLevel(interiors, studies, house, index) {
  const approved = getInteriorLevel(interiors, house, index);
  if (approved) return approved;
  if (studies?.schemaVersion !== 1 || !Number.isInteger(index) || !Object.hasOwn(studies.buildings || {}, String(house))) return null;
  const level = studies.buildings[house].levels.find(level => level.index === index);
  return level ? {...level, isStudy: true} : null;
}

/** A display-only plate correction; the retained LoD2 source is never changed. */
export function studyFloorSection(section, level) {
  if (!level?.isStudy) return section;
  const polygons = level.floorOutline.map(polygon => ({...polygon, holes: polygon.holes || []}));
  return {...section, polygons, area: polygons.reduce((sum, polygon) => sum + ringArea(polygon.outer) - (polygon.holes || []).reduce((area, hole) => area + ringArea(hole), 0), 0),
    sourceStatus: 'resident-sketch-floor-outline', outlineSource: level.source};
}

/** Orient the drawing to the building axes without rotating or rescaling geometry. */
export function studyPlanDirection(level, portrait = false) {
  const points = level.floorOutline.flatMap(polygon => polygon.outer);
  let best = null;
  for (const polygon of level.floorOutline) for (let i = 1; i < polygon.outer.length; i++) {
    const [a, b] = [polygon.outer[i - 1], polygon.outer[i]];
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    if (length < 0.1) continue;
    const along = [dx / length, dz / length], across = [-along[1], along[0]];
    const span = axis => {
      const positions = points.map(point => point[0] * axis[0] + point[1] * axis[1]);
      return Math.max(...positions) - Math.min(...positions);
    };
    const width = span(along), height = span(across), area = width * height;
    if (!best || area < best.area - 1e-6) best = {area, axis: width >= height ? along : across};
  }
  if (!best) return [0, 1, 0.025];
  let [x, z] = best.axis;
  if (x < 0 || Math.abs(x) < 1e-6 && z < 0) { x *= -1; z *= -1; }
  if (portrait) [x, z] = [z, -x];
  return [-z * 0.025, 1, x * 0.025];
}
