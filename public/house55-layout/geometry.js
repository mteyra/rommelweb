/** Pure geometry for the House 55 fixed-area rectangle sandbox.
 *
 * Room: {id,bank,x,y,width,depth,rotation}; x/y are centers in metres.
 * Rotation is a multiple of 90 degrees. Width/depth are the room's local axes.
 * Shell: {outline:[[x,y],...],holes:[ring,...]}, or disjoint component array.
 * Mutations preserve metadata and the fixed 16.2m² area. Analysis deliberately
 * permits invalid placements: it reports conflicts instead of rejecting moves.
 */
export const AREA = 16.2;
export const MAX_WIDTH = 10;
export const MIN_WIDTH = AREA / MAX_WIDTH;
export const EPSILON = 1e-9;
export const AREA_EPSILON = 1e-7;

const finite = value => typeof value === 'number' && Number.isFinite(value);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const almostSame = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < EPSILON;

export function normalizeRotation(rotation = 0) {
  if (!finite(rotation) || Math.abs(rotation / 90 - Math.round(rotation / 90)) > EPSILON) {
    throw new RangeError('Room rotation must be a multiple of 90 degrees.');
  }
  return ((Math.round(rotation / 90) % 2) + 2) % 2 * 90;
}

/** Resize one local dimension, adjusting its reciprocal dimension exactly. */
export function setRoomDimension(room, dimension, value, options = {}) {
  if (dimension !== 'width' && dimension !== 'depth') {
    throw new RangeError('Dimension must be width or depth.');
  }
  if (!finite(value) || value <= 0) {
    throw new RangeError('A room dimension must be a positive finite number.');
  }
  const minWidth = options.minWidth ?? MIN_WIDTH;
  const maxWidth = options.maxWidth ?? MAX_WIDTH;
  if (!finite(minWidth) || !finite(maxWidth) || minWidth <= 0 || maxWidth < minWidth) {
    throw new RangeError('Width limits must be positive and ordered.');
  }
  const width = clamp(dimension === 'width' ? value : AREA / value, minWidth, maxWidth);
  return { ...room, width, depth: AREA / width, rotation: normalizeRotation(room.rotation) };
}

/** Preserve a supplied width; use depth only when width is absent. */
export function normalizeRoom(room, options = {}) {
  if (!room || !finite(room.x) || !finite(room.y)) {
    throw new RangeError('Room centers must contain finite x and y coordinates.');
  }
  const dimension = finite(room.width) && room.width > 0 ? 'width' : 'depth';
  return setRoomDimension(room, dimension, room[dimension], options);
}

export function validateRoom(room, { checkArea = true } = {}) {
  const errors = [];
  if (!room || typeof room !== 'object') return ['Room must be an object.'];
  if (typeof room.id !== 'string' || !room.id) errors.push('Room id must be a nonempty string.');
  if (typeof room.bank !== 'string' || !room.bank) errors.push('Room bank must be a nonempty string.');
  for (const key of ['x', 'y', 'width', 'depth']) {
    if (!finite(room[key])) errors.push(`${key} must be finite.`);
  }
  if (room.width <= 0 || room.depth <= 0) errors.push('Dimensions must be positive.');
  try { normalizeRotation(room.rotation); } catch (error) { errors.push(error.message); }
  if (checkArea && finite(room.width) && finite(room.depth)
      && Math.abs(room.width * room.depth - AREA) > AREA_EPSILON) {
    errors.push(`Room area must be ${AREA} square metres.`);
  }
  return errors;
}

export function rectangleBounds(room) {
  if (!room || ![room.x, room.y, room.width, room.depth].every(finite)
      || room.width <= 0 || room.depth <= 0) {
    throw new RangeError('Rectangle centers and positive dimensions must be finite.');
  }
  const rotated = normalizeRotation(room.rotation) === 90;
  const halfX = (rotated ? room.depth : room.width) / 2;
  const halfY = (rotated ? room.width : room.depth) / 2;
  return { minX: room.x - halfX, minY: room.y - halfY,
    maxX: room.x + halfX, maxY: room.y + halfY };
}

export function rectangleVertices(room) {
  const b = rectangleBounds(room);
  return [[b.minX, b.minY], [b.maxX, b.minY], [b.maxX, b.maxY], [b.minX, b.maxY]];
}

function cleanRing(ring) {
  if (!Array.isArray(ring)) throw new TypeError('Shell rings must be arrays.');
  const points = ring.map(point => {
    if (!Array.isArray(point) || point.length < 2 || !finite(point[0]) || !finite(point[1])) {
      throw new RangeError('Shell vertices must contain finite coordinate pairs.');
    }
    return [point[0], point[1]];
  });
  if (points.length > 1 && almostSame(points[0], points.at(-1))) points.pop();
  if (points.length < 3) throw new RangeError('Shell rings require at least three vertices.');
  return points;
}

export function shellComponents(shell) {
  if (!shell) return [];
  // A raw ring and both exporter spellings are accepted.
  if (Array.isArray(shell) && Array.isArray(shell[0]) && finite(shell[0][0])) {
    return [{ outline: cleanRing(shell), holes: [] }];
  }
  const components = Array.isArray(shell) ? shell : shell.polygons ?? [shell];
  return components.map(component => ({
    outline: cleanRing(component.outline ?? component.outer),
    holes: (component.holes ?? []).map(cleanRing),
  }));
}

export function polygonArea(ring) {
  if (!ring || ring.length < 3) return 0;
  const origin = ring[0];
  let twiceArea = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    twiceArea += (a[0] - origin[0]) * (b[1] - origin[1])
      - (b[0] - origin[0]) * (a[1] - origin[1]);
  }
  return Math.abs(twiceArea) / 2;
}

// Sutherland–Hodgman clipping against an axis-aligned convex rectangle.
// A concave source ring may produce linked components; signed area integration
// still gives their total intersection area, including concave notches.
function clipRingToBounds(ring, bounds) {
  let points = ring;
  for (const [axis, limit, sign] of [
    [0, bounds.minX, 1], [0, bounds.maxX, -1],
    [1, bounds.minY, 1], [1, bounds.maxY, -1],
  ]) {
    if (!points.length) break;
    const result = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const da = sign * (a[axis] - limit), db = sign * (b[axis] - limit);
      const inA = da >= 0, inB = db >= 0;
      if (inA) result.push(a);
      if (inA !== inB) {
        const t = da / (da - db);
        result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    points = result;
  }
  return points;
}

/** True polygon intersection area; tests all shell edges and enclosed holes. */
export function roomShellIntersectionArea(room, shell) {
  const bounds = rectangleBounds(room);
  const area = shellComponents(shell).reduce((total, component) => (
    total + polygonArea(clipRingToBounds(component.outline, bounds))
      - component.holes.reduce((sum, hole) => sum + polygonArea(clipRingToBounds(hole, bounds)), 0)
  ), 0);
  // Components supplied by the canonical exporter must be disjoint.
  return clamp(area, 0, room.width * room.depth);
}

export function roomContainedInShell(room, shell, tolerance = AREA_EPSILON) {
  return room.width * room.depth - roomShellIntersectionArea(room, shell) <= tolerance;
}

export function roomIntersectionArea(a, b) {
  const x = rectangleBounds(a), y = rectangleBounds(b);
  return Math.max(0, Math.min(x.maxX, y.maxX) - Math.max(x.minX, y.minX))
    * Math.max(0, Math.min(x.maxY, y.maxY) - Math.max(x.minY, y.minY));
}

/** Exact union area for the orthogonal rectangles, including triple overlaps. */
export function rectangleUnionArea(rooms) {
  if (!rooms.length) return 0;
  const bounds = rooms.map(rectangleBounds);
  const xs = [...new Set(bounds.flatMap(b => [b.minX, b.maxX]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 1; i < xs.length; i++) {
    const mid = (xs[i - 1] + xs[i]) / 2;
    const intervals = bounds.filter(b => b.minX < mid && b.maxX > mid)
      .map(b => [b.minY, b.maxY]).sort((a, b) => a[0] - b[0]);
    let length = 0, start = null, end = null;
    for (const [a, b] of intervals) {
      if (start === null) { start = a; end = b; }
      else if (a <= end) end = Math.max(end, b);
      else { length += end - start; start = a; end = b; }
    }
    if (start !== null) length += end - start;
    area += (xs[i] - xs[i - 1]) * length;
  }
  return area;
}

export function analyzeLayout(rooms, shell) {
  const components = shellComponents(shell);
  const records = rooms.map(room => {
    const geometryErrors = validateRoom(room, { checkArea: false });
    if (geometryErrors.length) {
      return { id: room?.id, area: null, areaError: null, insideShell: false,
        outsideArea: null, overlaps: [], geometryErrors, valid: false };
    }
    const area = room.width * room.depth;
    const outsideArea = Math.max(0, area - roomShellIntersectionArea(room, components));
    return { id: room.id, area, areaError: area - AREA,
      insideShell: outsideArea <= AREA_EPSILON, outsideArea,
      overlaps: [], geometryErrors: [], valid: true };
  });
  const overlaps = [];
  for (let i = 0; i < rooms.length; i++) {
    if (records[i].geometryErrors.length) continue;
    for (let j = i + 1; j < rooms.length; j++) {
      if (records[j].geometryErrors.length) continue;
      const area = roomIntersectionArea(rooms[i], rooms[j]);
      if (area > AREA_EPSILON) {
        overlaps.push({ a: rooms[i].id, b: rooms[j].id, area });
        records[i].overlaps.push({ id: rooms[j].id, area });
        records[j].overlaps.push({ id: rooms[i].id, area });
      }
    }
  }
  for (const record of records) {
    record.valid = !record.geometryErrors.length && record.insideShell
      && Math.abs(record.areaError) <= AREA_EPSILON && !record.overlaps.length;
  }
  const geometricallyValid = rooms.filter((_, i) => !records[i].geometryErrors.length);
  const bounds = geometricallyValid.map(rectangleBounds);
  const envelope = bounds.length ? {
    minX: Math.min(...bounds.map(b => b.minX)), minY: Math.min(...bounds.map(b => b.minY)),
    maxX: Math.max(...bounds.map(b => b.maxX)), maxY: Math.max(...bounds.map(b => b.maxY)),
  } : null;
  const totalArea = records.reduce((sum, r) => sum + (r.area ?? 0), 0);
  const occupiedArea = rectangleUnionArea(geometricallyValid);
  return {
    rooms: records, overlaps,
    outOfBounds: records.filter(r => !r.insideShell).map(r => r.id),
    invalidArea: records.filter(r => r.area !== null && Math.abs(r.areaError) > AREA_EPSILON).map(r => r.id),
    invalidGeometry: records.filter(r => r.geometryErrors.length).map(r => r.id),
    roomCount: rooms.length, totalArea, meanArea: rooms.length ? totalArea / rooms.length : 0,
    occupiedArea, duplicateOccupiedArea: Math.max(0, totalArea - occupiedArea),
    envelope, boundingBoxArea: envelope ? (envelope.maxX-envelope.minX) * (envelope.maxY-envelope.minY) : 0,
    valid: records.every(r => r.valid),
  };
}

function intervalDistance(a0, a1, b0, b1) {
  return Math.max(0, a0 - b1, b0 - a1);
}

/** Snap clear rectangle edges to neighbors (optionally a wall gap) or shell.
 *
 * Slanted source edges use the rectangle's support line: a corner can touch
 * a skewed shell edge without pretending the full room side is parallel.
 * Snap does not guarantee containment or prevent collisions.
 */
export function snapRoom(room, others = [], shell = null, options = {}) {
  const fixed = normalizeRoom(room);
  const tolerance = options.tolerance ?? .15;
  const gap = options.gap ?? .20;
  if (!finite(tolerance) || tolerance < 0 || !finite(gap) || gap < 0) {
    throw new RangeError('Snap tolerance and gap must be finite and nonnegative.');
  }
  if (options.enabled === false) return { room: fixed, snaps: [], snapped: false };
  const bounds = rectangleBounds(fixed);
  const candidates = [];
  const add = (normal, delta, target, type, extra = {}) => {
    if (Math.abs(delta) <= tolerance + EPSILON) {
      candidates.push({ normal, delta, target, type, ...extra });
    }
  };
  if (options.roomEdges !== false) for (const other of others) {
    if (other.id === fixed.id) continue;
    const b = rectangleBounds(other);
    if (intervalDistance(bounds.minY, bounds.maxY, b.minY, b.maxY) <= gap + tolerance) {
      add([1, 0], b.maxX + gap - bounds.minX, other.id, 'room-gap', { axis: 'x' });
      add([1, 0], b.minX - gap - bounds.maxX, other.id, 'room-gap', { axis: 'x' });
      add([1, 0], b.minX - bounds.minX, other.id, 'room-edge', { axis: 'x' });
      add([1, 0], b.maxX - bounds.maxX, other.id, 'room-edge', { axis: 'x' });
    }
    if (intervalDistance(bounds.minX, bounds.maxX, b.minX, b.maxX) <= gap + tolerance) {
      add([0, 1], b.maxY + gap - bounds.minY, other.id, 'room-gap', { axis: 'y' });
      add([0, 1], b.minY - gap - bounds.maxY, other.id, 'room-gap', { axis: 'y' });
      add([0, 1], b.minY - bounds.minY, other.id, 'room-edge', { axis: 'y' });
      add([0, 1], b.maxY - bounds.maxY, other.id, 'room-edge', { axis: 'y' });
    }
  }
  if (shell && options.shellEdges !== false) {
    const vertices = rectangleVertices(fixed);
    for (const [componentIndex, component] of shellComponents(shell).entries()) {
      for (const [ringIndex, ring] of [component.outline, ...component.holes].entries()) {
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], b = ring[(i + 1) % ring.length];
          const length = Math.hypot(b[0]-a[0], b[1]-a[1]);
          if (length < EPSILON) continue;
          const tangent = [(b[0]-a[0])/length, (b[1]-a[1])/length];
          const normal = [-tangent[1], tangent[0]];
          const projected = vertices.map(p => dot(p, tangent));
          const ends = [dot(a, tangent), dot(b, tangent)];
          if (intervalDistance(Math.min(...projected), Math.max(...projected),
            Math.min(...ends), Math.max(...ends)) > tolerance) continue;
          const side = vertices.map(p => dot(p, normal));
          const target = `shell:${componentIndex}:${ringIndex}:${i}`;
          const extra = { axis: Math.abs(normal[0]) > 1-EPSILON ? 'x'
            : Math.abs(normal[1]) > 1-EPSILON ? 'y' : 'normal',
          edge: [a, b], shellRing: ringIndex ? 'hole' : 'outline' };
          add(normal, dot(a, normal)-Math.min(...side), target, 'shell-edge', extra);
          add(normal, dot(a, normal)-Math.max(...side), target, 'shell-edge', extra);
        }
      }
    }
  }
  candidates.sort((a, b) => Math.abs(a.delta)-Math.abs(b.delta));
  if (!candidates.length) return { room: fixed, snaps: [], snapped: false };
  const first = candidates[0];
  let displacement = first.normal.map(n => n * first.delta);
  let selected = [first], bestSecondDistance = Infinity;
  for (const second of candidates.slice(1)) {
    const [a, b] = first.normal, [c, d] = second.normal;
    const determinant = a*d - b*c;
    if (Math.abs(determinant) < .25) continue;
    const move = [(first.delta*d-b*second.delta)/determinant,
      (a*second.delta-first.delta*c)/determinant];
    const distance = Math.hypot(...move);
    if (distance <= Math.SQRT2 * tolerance + EPSILON && distance < bestSecondDistance) {
      bestSecondDistance = distance; displacement = move; selected = [first, second];
    }
  }
  return {
    room: { ...fixed, x: fixed.x+displacement[0], y: fixed.y+displacement[1] },
    snaps: selected.map(snap => ({ ...snap, translation: [...displacement] })),
    snapped: true,
  };
}

/** Pack a selection in a single row; unselected rooms remain untouched.
 *
 * anchor:start keeps the minimum edge; anchor:center keeps the bounding-box
 * center. Optional anchorCoordinate/perpendicularCoordinate use world metres.
 * Order is the current position along the row unless order:'selection'.
 */
export function packRooms(rooms, ids, options = {}) {
  const selectedIds = new Set(ids);
  const axis = options.axis ?? 'x';
  const gap = options.gap ?? .20;
  const anchor = options.anchor ?? 'start';
  const align = options.align ?? 'center';
  if (!['x', 'y'].includes(axis) || !['start', 'center'].includes(anchor)
      || !['start', 'center', 'end'].includes(align) || !finite(gap) || gap < 0) {
    throw new RangeError('Invalid packing axis, anchor, alignment or nonnegative gap.');
  }
  const selected = rooms.filter(room => selectedIds.has(room.id)).map(room => normalizeRoom(room));
  if (!selected.length) return rooms.slice();
  if (options.order === 'selection') {
    const order = new Map([...selectedIds].map((id, i) => [id, i]));
    selected.sort((a, b) => order.get(a.id)-order.get(b.id));
  } else selected.sort((a, b) => a[axis]-b[axis] || a.id.localeCompare(b.id));
  const alongMin = axis === 'x' ? 'minX' : 'minY', alongMax = axis === 'x' ? 'maxX' : 'maxY';
  const crossMin = axis === 'x' ? 'minY' : 'minX', crossMax = axis === 'x' ? 'maxY' : 'maxX';
  const bounds = selected.map(rectangleBounds);
  const low = Math.min(...bounds.map(b => b[alongMin]));
  const high = Math.max(...bounds.map(b => b[alongMax]));
  const crossLow = Math.min(...bounds.map(b => b[crossMin]));
  const crossHigh = Math.max(...bounds.map(b => b[crossMax]));
  const length = bounds.reduce((sum, b) => sum+b[alongMax]-b[alongMin], 0) + gap*(selected.length-1);
  const anchorCoordinate = options.anchorCoordinate ?? (anchor === 'start' ? low : (low+high)/2);
  const crossCoordinate = options.perpendicularCoordinate
    ?? (align === 'start' ? crossLow : align === 'end' ? crossHigh : (crossLow+crossHigh)/2);
  if (!finite(anchorCoordinate) || !finite(crossCoordinate)) {
    throw new RangeError('Packing anchors must be finite.');
  }
  let cursor = anchor === 'start' ? anchorCoordinate : anchorCoordinate-length/2;
  const result = new Map();
  for (const [i, room] of selected.entries()) {
    const b = bounds[i], extent = b[alongMax]-b[alongMin], crossExtent = b[crossMax]-b[crossMin];
    const crossCenter = crossCoordinate + (align === 'start' ? crossExtent/2 : align === 'end' ? -crossExtent/2 : 0);
    result.set(room.id, { ...room, [axis]: cursor+extent/2,
      [axis === 'x' ? 'y' : 'x']: crossCenter });
    cursor += extent + gap;
  }
  return rooms.map(room => result.get(room.id) ?? room);
}

export function packBankRows(rooms, options = {}) {
  const axes = options.axes ?? { A: 'x', W: 'y', L: 'x', R: 'x', N: 'x', E: 'y' };
  let result = rooms.slice();
  for (const bank of new Set(rooms.map(room => room.bank))) {
    result = packRooms(result, rooms.filter(room => room.bank === bank).map(room => room.id),
      { ...options, axis: axes[bank] ?? 'x' });
  }
  return result;
}
