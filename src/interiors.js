/** Approved, public geometry only. Resident information belongs behind an API. */
const SPACE_KINDS = new Set(['room', 'corridor', 'stairs', 'lift', 'shared', 'service']);
const EPSILON = 1e-8;

export { polygon as validateInteriorPolygon };

function fail(path, message) {
  throw new Error(`Interior data ${path}: ${message}`);
}

function object(value, path, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(path, 'must be an object');
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) fail(`${path}.${key}`, 'is not allowed; publish geometry and provenance only');
  }
}

function text(value, path, limit = 160) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || /[<>\u0000-\u001f]/u.test(value)) {
    fail(path, `must be nonempty plain text of at most ${limit} characters`);
  }
}

function reviewedDate(value, path) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(path, 'must be a reviewed date in YYYY-MM-DD format');
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) fail(path, 'must be a real calendar date');
  if (value > new Date().toISOString().slice(0, 10)) fail(path, 'cannot be a future review date');
}

function orientation(a, b, c) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a, b, point) {
  return Math.abs(orientation(a, b, point)) < EPSILON &&
    point[0] >= Math.min(a[0], b[0]) - EPSILON && point[0] <= Math.max(a[0], b[0]) + EPSILON &&
    point[1] >= Math.min(a[1], b[1]) - EPSILON && point[1] <= Math.max(a[1], b[1]) + EPSILON;
}

function intersects(a, b, c, d) {
  const abC = orientation(a, b, c), abD = orientation(a, b, d);
  const cdA = orientation(c, d, a), cdB = orientation(c, d, b);
  return ((abC > EPSILON && abD < -EPSILON || abC < -EPSILON && abD > EPSILON) &&
    (cdA > EPSILON && cdB < -EPSILON || cdA < -EPSILON && cdB > EPSILON)) ||
    onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);
}

function polygon(points, path) {
  if (!Array.isArray(points) || points.length < 4 || points.length > 1000) fail(path, 'must have 4–1000 points including a repeated closing point');
  for (const [index, point] of points.entries()) {
    if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) fail(`${path}[${index}]`, 'must be [campus-local x, campus-local z] in finite metres');
    if (point.some(value => Math.abs(value) > 10000)) fail(`${path}[${index}]`, 'lies outside plausible campus-local coordinates; convert geographic/UTM coordinates first');
  }
  const first = points[0], last = points.at(-1);
  if (first[0] !== last[0] || first[1] !== last[1]) fail(path, 'must be closed by repeating its first point');
  let doubleArea = 0;
  for (let index = 0; index < points.length - 1; index++) {
    const a = points[index], b = points[index + 1];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < EPSILON) fail(path, 'has a zero-length edge');
    doubleArea += a[0] * b[1] - b[0] * a[1];
    for (let other = index + 2; other < points.length - 1; other++) {
      if (index === 0 && other === points.length - 2) continue;
      if (intersects(a, b, points[other], points[other + 1])) fail(path, 'must be a simple polygon without crossing or touching nonadjacent edges');
    }
  }
  if (Math.abs(doubleArea) < 0.0002) fail(path, 'must enclose a nonzero area');
}

/** Throws with the invalid field path, or returns true. Does not mutate input. */
export function validateInteriorData(interiors, campus, lod2) {
  object(interiors, '$', ['schemaVersion', 'buildings']);
  if (interiors.schemaVersion !== 1) fail('$.schemaVersion', 'must be 1');
  object(interiors.buildings, '$.buildings', Object.keys(interiors.buildings || {}));
  if (!Array.isArray(campus?.buildings) || !Array.isArray(lod2?.buildings)) fail('$', 'requires campus and official LoD2 building reference data');
  const stableIds = new Set();
  for (const [house, entry] of Object.entries(interiors.buildings)) {
    const path = `$.buildings[${JSON.stringify(house)}]`;
    const mapped = campus.buildings.find(building => building.number === house);
    const official = lod2.buildings.find(building => building.number === house);
    if (!mapped || !official) fail(path, 'unknown house; must match both campus and official exterior records');
    object(entry, path, ['approved', 'source', 'reviewedAt', 'reusePermission', 'levels']);
    if (entry.approved !== true) fail(`${path}.approved`, 'must be true; unpublished/unreviewed drafts do not belong in this public dataset');
    text(entry.source, `${path}.source`, 1000);
    text(entry.reusePermission, `${path}.reusePermission`, 1000);
    reviewedDate(entry.reviewedAt, `${path}.reviewedAt`);
    if (!Array.isArray(entry.levels) || !entry.levels.length) fail(`${path}.levels`, 'must contain at least one approved level; omit empty building entries');
    const floorIndexes = new Set();
    const approvedLevels = [];
    for (const [position, level] of entry.levels.entries()) {
      const levelPath = `${path}.levels[${position}]`;
      object(level, levelPath, ['index', 'label', 'elevation', 'source', 'reviewedAt', 'spaces', 'doors']);
      if (!Number.isInteger(level.index) || level.index < 0 || level.index >= mapped.levels) fail(`${levelPath}.index`, `must be an above-ground floor from 0 to ${mapped.levels - 1}`);
      if (floorIndexes.has(level.index)) fail(`${levelPath}.index`, 'duplicates a floor in this house');
      floorIndexes.add(level.index);
      text(level.label, `${levelPath}.label`);
      text(level.source, `${levelPath}.source`, 1000);
      reviewedDate(level.reviewedAt, `${levelPath}.reviewedAt`);
      if (!Number.isFinite(level.elevation) || level.elevation < 0 || level.elevation >= official.height) fail(`${levelPath}.elevation`, `must be finite metres relative to the building base, at least 0 and below official height ${official.height}`);
      if (level.index > 0 && level.elevation === 0) fail(`${levelPath}.elevation`, 'positive floor indexes must be above the building base; zero would overlap the default ground floor');
      approvedLevels.push(level);
      if (!Array.isArray(level.spaces)) fail(`${levelPath}.spaces`, 'must be an array of approved public space geometry');
      for (const [spaceIndex, space] of level.spaces.entries()) {
        const spacePath = `${levelPath}.spaces[${spaceIndex}]`;
        object(space, spacePath, ['id', 'label', 'kind', 'polygon']);
        if (typeof space.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(space.id)) fail(`${spacePath}.id`, 'must be a stable 1–80 character identifier using letters, digits, dots, underscores, colons or hyphens');
        if (stableIds.has(space.id)) fail(`${spacePath}.id`, 'duplicates a space ID; IDs must be unique across the dataset');
        stableIds.add(space.id);
        text(space.label, `${spacePath}.label`);
        if (!SPACE_KINDS.has(space.kind)) fail(`${spacePath}.kind`, `must be one of ${[...SPACE_KINDS].join(', ')}`);
        polygon(space.polygon, `${spacePath}.polygon`);
      }
      if (level.doors !== undefined && !Array.isArray(level.doors)) fail(`${levelPath}.doors`, 'must be an array of approved door geometry');
      for (const [doorIndex, door] of (level.doors || []).entries()) {
        const doorPath = `${levelPath}.doors[${doorIndex}]`;
        object(door, doorPath, ['id', 'label', 'spaceId', 'toSpaceId', 'segment', 'hinge', 'swing']);
        if (typeof door.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,79}$/.test(door.id)) fail(`${doorPath}.id`, 'must be a stable 1–80 character geometry identifier');
        if (stableIds.has(door.id)) fail(`${doorPath}.id`, 'duplicates a space or door ID');
        stableIds.add(door.id);
        text(door.label, `${doorPath}.label`);
        const sourceSpace = level.spaces.find(space => space.id === door.spaceId);
        if (!sourceSpace) fail(`${doorPath}.spaceId`, 'must reference a space on the same floor');
        if (!Array.isArray(door.segment) || door.segment.length !== 2 || !door.segment.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))) {
          fail(`${doorPath}.segment`, 'must contain two finite [campus-local x, campus-local z] endpoints');
        }
        const width = Math.hypot(door.segment[1][0] - door.segment[0][0], door.segment[1][1] - door.segment[0][1]);
        if (width < 0.4 || width > 3) fail(`${doorPath}.segment`, 'must describe an opening between 0.4 and 3 metres wide');
        const onBoundary = space => space.polygon.slice(1).some((point, index) => door.segment.every(endpoint => onSegment(space.polygon[index], point, endpoint)));
        if (!onBoundary(sourceSpace)) fail(`${doorPath}.segment`, 'must lie on one boundary edge of its referenced space');
        if (door.toSpaceId !== undefined) {
          const destination = level.spaces.find(space => space.id === door.toSpaceId);
          if (!destination || destination === sourceSpace || !onBoundary(destination)) fail(`${doorPath}.toSpaceId`, 'must reference a different same-floor space sharing this door boundary');
        }
        if ((door.hinge === undefined) !== (door.swing === undefined)) fail(doorPath, 'hinge and swing must be supplied together or both omitted');
        if (door.hinge !== undefined && !['start', 'end'].includes(door.hinge)) fail(`${doorPath}.hinge`, 'must be start or end');
        if (door.swing !== undefined && !['left', 'right'].includes(door.swing)) fail(`${doorPath}.swing`, 'must be left or right relative to the closed leaf from hinge to opposite endpoint');
      }
    }
    approvedLevels.sort((a, b) => a.index - b.index);
    for (let index = 1; index < approvedLevels.length; index++) {
      if (approvedLevels[index].elevation <= approvedLevels[index - 1].elevation) fail(`${path}.levels`, 'elevations must increase with floor index');
    }
  }
  return true;
}

/** Call after validation. Returns null for unavailable or unapproved geometry. */
export function getInteriorLevel(data, house, index) {
  if (data?.schemaVersion !== 1 || !Number.isInteger(index)) return null;
  const entry = Object.hasOwn(data.buildings || {}, String(house)) ? data.buildings[String(house)] : null;
  if (entry?.approved !== true || !Array.isArray(entry.levels)) return null;
  return entry.levels.find(level => level.index === index) || null;
}

/**
 * Call after validateInteriorData. Preserve approved floor elevations exactly;
 * interpolate unknown guides between the nearest known floors and roof limit.
 * Returned values are relative to the building base, excluding the roof limit.
 */
export function getLevelElevations(interiors, house, count, officialHeight) {
  if (!Number.isInteger(count) || count < 1) throw new Error('Floor count must be a positive integer');
  if (!Number.isFinite(officialHeight) || officialHeight <= 0) throw new Error('Official height must be a positive finite number');
  const entry = interiors?.schemaVersion === 1 && Object.hasOwn(interiors.buildings || {}, String(house))
    ? interiors.buildings[String(house)] : null;
  const anchors = new Map([[0, 0], [count, officialHeight]]);
  const knownIndexes = new Set();
  if (entry?.approved === true && Array.isArray(entry.levels)) {
    for (const level of entry.levels) {
      if (!Number.isInteger(level.index) || level.index < 0 || level.index >= count) {
        throw new Error(`Interior elevation anchor for house ${house} has an index outside floor count ${count}`);
      }
      if (!Number.isFinite(level.elevation) || level.elevation < 0 || level.elevation >= officialHeight) {
        throw new Error(`Interior elevation anchor for house ${house}, floor ${level.index} must be nonnegative and below official height`);
      }
      if (knownIndexes.has(level.index)) throw new Error(`Duplicate interior elevation anchor for house ${house}, floor ${level.index}`);
      knownIndexes.add(level.index);
      anchors.set(level.index, level.elevation);
    }
  }
  const ordered = [...anchors.entries()].sort(([a], [b]) => a - b);
  const elevations = new Array(count);
  for (let position = 0; position < ordered.length - 1; position++) {
    const [lowerIndex, lowerHeight] = ordered[position];
    const [upperIndex, upperHeight] = ordered[position + 1];
    if (upperHeight <= lowerHeight) throw new Error(`Interior elevation anchors for house ${house} must increase with floor index`);
    for (let index = lowerIndex; index < upperIndex; index++) {
      elevations[index] = index === lowerIndex ? lowerHeight
        : lowerHeight + (upperHeight - lowerHeight) * (index - lowerIndex) / (upperIndex - lowerIndex);
    }
  }
  return elevations;
}
