import { validateInteriorPolygon } from './interiors.js';

// Display concepts only. These dimensions never modify the room study or
// establish the actual position, mirror, service plan, or clear size of a room.
const INSET = 0.20;
const WALK = 0.75;
const LANDING = 0.90;
const LIVING_DEPTH = 3.30;
const EPS = 1e-8;
const DOOR_TOLERANCE = 0.002;
const CANDIDATE_SHORT_EDGE = 0.01;
const PATH_CAP_SIDES = 32;
const SOURCE = 'https://rommelwood.de/media/images/zimmerskizze.jpg';
const SOURCE_NOTES = 'https://rommelwood.de/wohnen/zimmergrundriss/';

const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const rectangle = (left, front, right, back) => [
  [left, front], [right, front], [right, back], [left, back], [left, front],
];
const edges = ring => ring.slice(1).map((b, i) => [ring[i], b]);
const finitePoint = point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite);
const validSegment = segment => Array.isArray(segment) && segment.length === 2 &&
  segment.every(finitePoint) && Math.hypot(segment[1][0] - segment[0][0], segment[1][1] - segment[0][1]) > EPS;

function signedArea(ring) {
  const origin = ring[0];
  return edges(ring).reduce((sum, [a, b]) => sum +
    (a[0] - origin[0]) * (b[1] - origin[1]) - (b[0] - origin[0]) * (a[1] - origin[1]), 0) / 2;
}

function pointSegmentDistance(point, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = clamp(((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
}

function pointInRing(point, ring, includeBoundary = true) {
  let inside = false;
  for (const [a, b] of edges(ring)) {
    if (pointSegmentDistance(point, a, b) <= EPS) return includeBoundary;
    if ((a[1] > point[1]) !== (b[1] > point[1]) &&
      point[0] < a[0] + (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1])) inside = !inside;
  }
  return inside;
}

function crosses(a, b, c, d) {
  const ac = cross(a, b, c), ad = cross(a, b, d), ca = cross(c, d, a), cb = cross(c, d, b);
  return (ac > EPS && ad < -EPS || ac < -EPS && ad > EPS) &&
    (ca > EPS && cb < -EPS || ca < -EPS && cb > EPS);
}

function segmentWithinRing(a, b, ring) {
  const d = [b[0] - a[0], b[1] - a[1]], lengthSquared = dot(d, d);
  const stops = [0, 1];
  for (const [p, q] of edges(ring)) {
    const e = [q[0] - p[0], q[1] - p[1]], f = [p[0] - a[0], p[1] - a[1]];
    const denominator = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(denominator) > EPS) {
      const t = (f[0] * e[1] - f[1] * e[0]) / denominator;
      const u = (f[0] * d[1] - f[1] * d[0]) / denominator;
      if (t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS) stops.push(clamp(t, 0, 1));
    } else if (Math.abs(cross(a, b, p)) < EPS) {
      for (const point of [p, q]) stops.push(clamp(dot([point[0] - a[0], point[1] - a[1]], d) / lengthSquared, 0, 1));
    }
  }
  stops.sort((x, y) => x - y);
  return stops.slice(1).every((end, i) => {
    const t = (stops[i] + end) / 2;
    return pointInRing([a[0] + t * d[0], a[1] + t * d[1]], ring);
  });
}

// A candidate is convex, while the obstacle may have recesses. Mid-edge probes
// also detect coincident edges enclosing positive area, including identical rings.
function overlaps(candidate, obstacle) {
  if (edges(candidate).some(([a, b]) => edges(obstacle).some(([c, d]) => crosses(a, b, c, d)))) return true;
  const probes = ring => ring.slice(0, -1).flatMap((a, i) => [
    a, [(a[0] + ring[i + 1][0]) / 2, (a[1] + ring[i + 1][1]) / 2],
  ]);
  if (probes(candidate).some(p => pointInRing(p, obstacle, false)) ||
    probes(obstacle).some(p => pointInRing(p, candidate, false))) return true;
  const middle = candidate.slice(0, -1).reduce((p, q) => [p[0] + q[0], p[1] + q[1]], [0, 0])
    .map(value => value / (candidate.length - 1));
  return pointInRing(middle, obstacle, false);
}

function distanceBetweenRings(a, b) {
  let result = Infinity;
  for (const [p, q] of edges(a)) for (const [r, s] of edges(b)) {
    if (crosses(p, q, r, s)) return 0;
    result = Math.min(result, pointSegmentDistance(p, r, s), pointSegmentDistance(q, r, s),
      pointSegmentDistance(r, p, q), pointSegmentDistance(s, p, q));
  }
  return result;
}

// Component polygons conservatively cover a round, WALK-wide swept path.
// Circumscribed caps leave no narrower diagonal gaps at bends; every component
// receives the same containment and obstacle checks as furniture below.
function pathComponents(points) {
  const radius = WALK / 2, capRadius = radius / Math.cos(Math.PI / PATH_CAP_SIDES);
  const segments = points.slice(1).flatMap((b, index) => {
    const a = points[index], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length < EPS) return [];
    const n = [radius * (a[1] - b[1]) / length, radius * (b[0] - a[0]) / length];
    return [[
      [a[0] - n[0], a[1] - n[1]], [a[0] + n[0], a[1] + n[1]],
      [b[0] + n[0], b[1] + n[1]], [b[0] - n[0], b[1] - n[1]],
      [a[0] - n[0], a[1] - n[1]],
    ]];
  });
  const caps = points.map(point => {
    const polygon = Array.from({length: PATH_CAP_SIDES}, (_, i) => {
      const angle = (i + 0.5) * Math.PI * 2 / PATH_CAP_SIDES;
      return [point[0] + capRadius * Math.cos(angle), point[1] + capRadius * Math.sin(angle)];
    });
    return [...polygon, polygon[0]];
  });
  return [...segments, ...caps];
}

function clipHalfPlane(points, normal, offset) {
  const result = [];
  for (let index = 0; index < points.length; index++) {
    const a = points[index], b = points[(index + 1) % points.length];
    const da = dot(normal, a) - offset, db = dot(normal, b) - offset;
    if (da >= -EPS) result.push(a);
    if ((da >= -EPS) !== (db >= -EPS)) {
      const t = da / (da - db);
      result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
    }
  }
  return result;
}

// Intersect inward half-planes. For a concave room this uses its convex kernel,
// deliberately giving up some floor area instead of bridging a recess.
function inscribedRectangle(outer, holes, bands) {
  const sign = Math.sign(signedArea(outer));
  const planes = edges(outer).flatMap(([a, b]) => {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // Tiny source notches otherwise collapse the visibility kernel. This is
    // candidate generation only: every original edge is checked for the full
    // clearance below. No source vertex or final collision edge is removed.
    if (length < CANDIDATE_SHORT_EDGE) return [];
    const normal = [sign * (a[1] - b[1]) / length, sign * (b[0] - a[0]) / length];
    const edgeOffset = dot(normal, a);
    let inset = INSET;
    for (const band of bands) {
      // A full-edge inset also respects a thicker marked end band. A partial,
      // unattached band remains an obstacle checked against each item below.
      const touching = band.slice(0, -1).filter(p => pointSegmentDistance(p, a, b) < DOOR_TOLERANCE)
        .map(p => ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / length);
      if (touching.length >= 2 && Math.max(...touching) - Math.min(...touching) >= length * 0.80) {
        inset = Math.max(inset, ...band.map(p => dot(normal, p) - edgeOffset));
      }
    }
    return [{normal, offset: edgeOffset + inset, inset}];
  });
  const xs = outer.map(p => p[0]), ys = outer.map(p => p[1]);
  let kernel = rectangle(Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1).slice(0, -1);
  for (const plane of planes) {
    kernel = clipHalfPlane(kernel, plane.normal, plane.offset);
    if (kernel.length < 3) return null;
  }
  const minY = Math.min(...kernel.map(p => p[1])), maxY = Math.max(...kernel.map(p => p[1]));
  let best = null;
  // The extra margin avoids a pointed kernel extremum collapsing the rectangle
  // when source edges are slightly skewed. All final edges are checked exactly.
  for (const frontMargin of [0.025, 0.10, 0.25]) for (const backMargin of [0.025, 0.10, 0.25, 0.50, 1]) {
    const front = minY + frontMargin, back = maxY - backMargin;
    if (back - front < 2.20) continue;
    let left = -Infinity, right = Infinity, possible = true;
    for (const {normal: [nx, ny], offset} of planes) {
      const y = ny >= 0 ? front : back;
      if (Math.abs(nx) < EPS) {
        if (ny * y < offset - EPS) possible = false;
      } else if (nx > 0) left = Math.max(left, (offset - ny * y) / nx);
      else right = Math.min(right, (offset - ny * y) / nx);
    }
    if (!possible || !Number.isFinite(left + right) || right - left < 0.80) continue;
    const polygon = rectangle(left + EPS, front, right - EPS, back);
    if (!polygon.every(p => pointInRing(p, outer)) || distanceBetweenRings(polygon, outer) < INSET - EPS) continue;
    if (holes.some(hole => overlaps(polygon, hole) || distanceBetweenRings(polygon, hole) < INSET - EPS)) continue;
    const area = (right - left) * (back - front);
    if (!best || area > best.area) best = {left: left + EPS, right: right - EPS, front, back, area, polygon, planes};
  }
  return best;
}

function policy() {
  return {
    status: 'unassigned-schematic-concept',
    sourceUrl: SOURCE,
    sourceNotesUrl: SOURCE_NOTES,
    furnitureDimensions: 'Approximate plan dimensions read from the published older-room sketch; never scaled to fit.',
    serviceDimensions: 'Bathroom and kitchenette footprints are chosen examples, not dimensions from the sketch.',
    placement: 'Adapted to an estimated room and door. Actual arrangement, mirror, wall thickness and service positions are unknown.',
    heights: 'All displayed furniture and partition heights are illustrative.',
    clearance: 'The 0.75 m connected walking path and 0.90 m landing are display-study guards, not accessibility or building-code checks.',
  };
}

/**
 * Optional furnishing concept in campus [x,z] metres, with no input mutation.
 * Pass a display level (isStudy:true). Non-study/non-room inputs return null.
 * An unavailable fit returns no items plus diagnostics. `zones` are semantic
 * overlays and may contain furniture; only circulation zones are keep-outs.
 * `partitions` are example bathroom boundary segments, not measured room walls.
 * A checked dogleg arrangement is preferred; an unfit dogleg leaves the original
 * straight-path, potentially partial furniture concept as the fallback.
 */
export function apartmentConcept(level, space) {
  if (!level?.isStudy || space?.kind !== 'room') return null;
  const diagnostics = [];
  const result = {
    status: 'unavailable', items: [], partitions: [], zones: [], basis: null, fit: null,
    diagnostics, notes: [
      'Optional unassigned furniture concept; this does not identify an actual apartment layout.',
      'The rear 3.30 m living-zone depth is a sketch-based aim, not a measurement of this room.',
      'Service footprints may be adapted or omitted. No bathroom fixtures, service connections, hinge or door swing are inferred.',
    ],
    sourcePolicy: policy(),
  };
  const unavailable = (code, message) => {
    diagnostics.push({code, message});
    return result;
  };
  try {
    if (typeof space.id !== 'string' || !space.id) throw new Error('Missing room ID');
    validateInteriorPolygon(space.polygon, 'concept.room');
    if (space.holes !== undefined && !Array.isArray(space.holes)) throw new Error('Invalid holes');
    for (const hole of space.holes || []) {
      validateInteriorPolygon(hole, 'concept.hole');
      if (!hole.every(point => pointInRing(point, space.polygon, false)) ||
        distanceBetweenRings(hole, space.polygon) < EPS) throw new Error('Hole leaves room');
    }
  } catch {
    return unavailable('invalid-room', 'A valid closed room polygon is required; no concept was placed.');
  }
  const doors = (Array.isArray(level.doors) ? level.doors : []).filter(door =>
    door?.spaceId === space.id || door?.toSpaceId === space.id);
  if (doors.length !== 1 || !validSegment(doors[0].segment)) {
    return unavailable('ambiguous-door', 'One recorded room entrance is required to orient a concept.');
  }
  const door = doors[0], [a, b] = door.segment;
  if (!edges(space.polygon).some(([p, q]) => [a, b].every(r => pointSegmentDistance(r, p, q) <= DOOR_TOLERANCE))) {
    return unavailable('door-off-boundary', 'The recorded entrance is not on a single room boundary edge.');
  }
  const origin = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const doorWidth = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tangent = [(b[0] - a[0]) / doorWidth, (b[1] - a[1]) / doorWidth];
  const normals = [[-tangent[1], tangent[0]], [tangent[1], -tangent[0]]];
  const isRoomPoint = point => pointInRing(point, space.polygon) && !(space.holes || []).some(hole => pointInRing(point, hole, false));
  const inwardChoices = normals.filter(normal => [0.02, 0.05].every(distance =>
    isRoomPoint([origin[0] + normal[0] * distance, origin[1] + normal[1] * distance])));
  if (inwardChoices.length !== 1) return unavailable('ambiguous-inward', 'The entrance does not establish an unambiguous inward direction.');
  const inward = inwardChoices[0], right = [inward[1], -inward[0]];
  const toLocal = point => [dot([point[0] - origin[0], point[1] - origin[1]], right),
    dot([point[0] - origin[0], point[1] - origin[1]], inward)];
  const toWorld = point => [origin[0] + point[0] * right[0] + point[1] * inward[0],
    origin[1] + point[0] * right[1] + point[1] * inward[1]];
  const outer = space.polygon.map(toLocal), holes = (space.holes || []).map(hole => hole.map(toLocal));
  const bands = [];
  for (const band of Array.isArray(level.wallBands) ? level.wallBands : []) {
    try {
      validateInteriorPolygon(band.polygon, 'concept.wall-band');
      bands.push(band.polygon.map(toLocal));
    } catch {
      return unavailable('invalid-wall-band', 'An invalid wall-band obstacle prevents a reliable fit check.');
    }
  }
  const matchingWindows = (Array.isArray(level.windows) ? level.windows : [])
    .filter(window => window.spaceId === space.id && validSegment(window.segment));
  const maxDepth = Math.max(...outer.map(p => p[1]));
  const rearWindows = matchingWindows.filter(window => {
    const points = window.segment.map(toLocal);
    return points.every(p => p[1] > maxDepth * 0.7);
  });
  result.basis = {
    origin, right, inward, doorId: door.id || null,
    orientationSource: 'Recorded entrance inward normal; entrance and furniture placement remain unmeasured.',
    rearWindowIds: rearWindows.map(window => window.id).filter(Boolean),
    rearEvidence: rearWindows.length ? 'A matched room-window marker corroborates the rear side.' : 'Rear side assumed opposite the entrance; no corroborating room-window marker.',
  };
  const fit = inscribedRectangle(outer, holes, bands);
  if (!fit) return unavailable('no-inscribed-rectangle', 'No conservative rectangle with the chosen wall and hole allowances fits this envelope.');
  const {left, right: rightEdge, front, back, polygon: fitPolygon} = fit;
  result.fit = {
    rectangle: fitPolygon.map(toWorld), width: rightEdge - left, depth: back - front,
    minimumBoundaryInset: INSET, edgeInsets: fit.planes.map(plane => plane.inset),
    walkingGuard: WALK, landingDepth: LANDING, livingDepthAim: LIVING_DEPTH,
    candidateShortEdgeThreshold: CANDIDATE_SHORT_EDGE,
    method: 'Inward half-plane rectangle candidates; all original boundary edges, holes, wall bands and item obstacles checked before placement.',
  };
  const withinRoom = polygon => polygon.every(p => pointInRing(p, outer)) &&
    !holes.some(hole => overlaps(polygon, hole)) &&
    edges(polygon).every(([p, q]) => segmentWithinRing(p, q, outer));
  const inFit = polygon => polygon.every(p => p[0] >= left - EPS && p[0] <= rightEdge + EPS &&
    p[1] >= front - EPS && p[1] <= back + EPS);
  const landingWidth = Math.max(doorWidth + 0.10, WALK);
  const landing = rectangle(-landingWidth / 2, 0.003, landingWidth / 2, LANDING);
  const livingFront = Math.max(front, back - LIVING_DEPTH);
  const makeItem = (kind, label, polygon, height, width, depth, sourceDimension) => ({
    kind, label, polygon: polygon.map(toWorld), height, dimensions: {width, depth},
    dimensionBasis: sourceDimension ? 'Approximate published furniture footprint; height and placement illustrative.' :
      'Chosen service example; dimensions, height and placement unmeasured.',
    ...(sourceDimension ? {sourceDimension: {metres: [...sourceDimension], url: SOURCE}} : {}),
  });

  // This adapts service order and rotates the full-size wardrobe. It does not
  // purport to register the source sketch, recover plumbing or locate a bath door.
  const doglegItems = [
    {kind: 'bed', label: 'Bed', x: left, y: back - 2.17, width: 0.97, depth: 2.17, height: 0.45, source: [0.97, 2.17]},
    {kind: 'desk', label: 'Desk', x: rightEdge - 0.75, y: back - 1.55, width: 0.75, depth: 1.55, height: 0.74, source: [0.75, 1.55]},
    {kind: 'wardrobe', label: 'Wardrobe', x: rightEdge - 0.60, y: front + 2.70, width: 0.60, depth: 1, height: 1.90, source: [1, 0.60]},
    {kind: 'bathroom', label: 'Bath concept', x: rightEdge - 1.30, y: front + 1.20, width: 1.30, depth: 1.50, height: 2.10},
    {kind: 'kitchenette', label: 'Kitchen concept', x: rightEdge - 0.60, y: front, width: 0.60, depth: 1.20, height: 0.90},
  ].map(item => ({...item, polygon: rectangle(item.x, item.y, item.x + item.width, item.y + item.depth)}));
  const bathLeft = rightEdge - 1.30, bathBack = front + 2.70, turnRadius = 0.395;
  const rearCentre = left + 0.97 + WALK / 2 + 0.01;
  const capRadius = WALK / 2 / Math.cos(Math.PI / PATH_CAP_SIDES);
  const dogleg = [
    [0, front + 0.40], [bathLeft - turnRadius, front + 0.40], [bathLeft - turnRadius, bathBack],
    ...Array.from({length: 18}, (_, i) => {
      const angle = Math.PI - (i + 1) * Math.PI / 36;
      return [bathLeft + turnRadius * Math.cos(angle), bathBack + turnRadius * Math.sin(angle)];
    }),
    [rearCentre, bathBack + turnRadius], [rearCentre, back - capRadius],
  ];
  const doglegZones = pathComponents(dogleg);
  const doglegFits = withinRoom(landing) && !bands.some(band => overlaps(landing, band)) &&
    doglegZones.every(polygon => inFit(polygon) && withinRoom(polygon) && !bands.some(band => overlaps(polygon, band))) &&
    // The round path starts inside the preserved landing and must actually
    // connect to it; no new entrance or narrow disconnected service pocket.
    doglegZones.some(polygon => overlaps(polygon, landing)) &&
    doglegItems.every((item, index) => inFit(item.polygon) && withinRoom(item.polygon) &&
      ![landing, ...doglegZones, ...bands, ...doglegItems.slice(0, index).map(other => other.polygon)]
        .some(obstacle => overlaps(item.polygon, obstacle)));
  if (doglegFits) {
    result.status = 'concept';
    result.items = doglegItems.map(item => makeItem(item.kind, item.label, item.polygon, item.height,
      item.width, item.depth, item.source));
    result.fit.layout = 'dogleg-service';
    result.fit.walkCentre = toWorld([rearCentre, bathBack + turnRadius]);
    result.fit.circulation = {
      kind: 'dogleg', width: WALK, centerline: dogleg.map(toWorld),
      method: 'Connected round sweep covered by checked segment rectangles and circumscribed 32-sided caps.',
    };
    const bathIntrusion = Math.max(0, bathBack - livingFront);
    result.fit.livingZoneServiceIntrusion = {depth: bathIntrusion, area: bathIntrusion * 1.30};
    result.zones.push(
      {kind: 'door-landing', label: 'Example entrance landing', polygon: landing.map(toWorld), keepClear: true},
      ...doglegZones.map(polygon => ({kind: 'circulation', label: '0.75 m concept walking path', polygon: polygon.map(toWorld), keepClear: true})),
      {kind: 'living', label: 'Rear 3.30 m depth aim; may contain service overlap',
        polygon: rectangle(left, livingFront, rightEdge, back).map(toWorld), keepClear: false},
    );
    const bath = doglegItems.find(item => item.kind === 'bathroom').polygon;
    // The route-facing left side stays wholly open. This is a deliberately
    // incomplete sample enclosure, not an inferred doorway, swing or bath access.
    result.partitions.push(...[[bath[0], bath[1]], [bath[1], bath[2]], [bath[2], bath[3]]]
      .map(segment => segment.map(toWorld)));
    result.notes.push('This alternative places kitchen then bath beside a dogleg path and rotates the wardrobe; service order is adapted, not registered to the published sketch.',
      'The bath outline is open along the walking path. Its actual entry, fixtures, plumbing and usable internal arrangement remain unknown.');
    if (bathIntrusion > EPS) diagnostics.push({
      code: 'service-in-living-aim',
      message: `The bath example enters the rear 3.30 m depth aim by approximately ${bathIntrusion.toFixed(2)} m; this is not a full clear 3.30 m living rectangle.`,
    });
    return result;
  }

  // Prioritise an unscaled bed, then a desk. If both fit, favour the entrance
  // centre to limit the lateral link; a narrow room is allowed a partial concept.
  let minWalk = left + 1 + WALK / 2 + 0.01;
  let maxWalk = rightEdge - 0.75 - WALK / 2 - 0.01;
  if (minWalk > maxWalk) minWalk = left + 0.97 + WALK / 2 + 0.01;
  const walkCentre = minWalk <= maxWalk ? clamp(0, minWalk, maxWalk) :
    clamp(left + 0.97 + WALK / 2 + 0.01, left + WALK / 2, rightEdge - WALK / 2);
  const walkLeft = walkCentre - WALK / 2, walkRight = walkCentre + WALK / 2;
  const linkTop = Math.max(LANDING + 0.25, front + WALK);
  const link = rectangle(Math.min(-landingWidth / 2, walkLeft), linkTop - WALK,
    Math.max(landingWidth / 2, walkRight), linkTop);
  const walk = rectangle(walkLeft, LANDING, walkRight, back);
  const keepouts = [landing, link, walk];
  if (back <= linkTop || keepouts.some(polygon => !withinRoom(polygon) || bands.some(band => overlaps(polygon, band)))) {
    return unavailable('entry-clearance', 'The selected entry landing and walking strip do not fit; no furniture was placed.');
  }
  result.fit.walkCentre = toWorld([walkCentre, LANDING]);
  result.fit.layout = 'straight-fallback';
  result.fit.circulation = {kind: 'straight', width: WALK,
    centerline: [[0, linkTop - WALK / 2], [walkCentre, linkTop - WALK / 2], [walkCentre, back]].map(toWorld),
    method: 'Checked rectangular entrance link and straight walking strip.'};
  result.zones.push(
    {kind: 'door-landing', label: 'Example entrance landing', polygon: landing.map(toWorld), keepClear: true},
    {kind: 'entry-link', label: 'Example walking connection', polygon: link.map(toWorld), keepClear: true},
    {kind: 'circulation', label: '0.75 m concept walking strip', polygon: walk.map(toWorld), keepClear: true},
  );
  result.zones.push({kind: 'living', label: 'Sketch-inspired living zone', polygon: rectangle(left, livingFront, rightEdge, back).map(toWorld), keepClear: false});
  if (back - front < LIVING_DEPTH) diagnostics.push({code: 'short-living-zone', message: 'The full 3.30 m living-zone aim does not fit; fixed furniture dimensions still apply.'});
  const accepted = [];
  function place(kind, label, choices, height, sourceDimension) {
    for (const choice of choices) {
      const polygon = rectangle(choice.x, choice.y, choice.x + choice.width, choice.y + choice.depth);
      if (!inFit(polygon) || !withinRoom(polygon) ||
        [...keepouts, ...bands, ...accepted].some(obstacle => overlaps(polygon, obstacle))) continue;
      accepted.push(polygon);
      result.items.push(makeItem(kind, label, polygon, height, choice.width, choice.depth, sourceDimension));
      return polygon;
    }
    diagnostics.push({code: `${kind}-omitted`, message: `${label} omitted: its fixed footprint conflicts with the available envelope, entry, walking strip or another item.`});
    return null;
  }
  place('bed', 'Bed', [{x: left, y: back - 2.17, width: 0.97, depth: 2.17}], 0.45, [0.97, 2.17]);
  place('desk', 'Desk', [{x: rightEdge - 0.75, y: back - 1.55, width: 0.75, depth: 1.55}], 0.74, [0.75, 1.55]);
  place('wardrobe', 'Wardrobe', [
    {x: left, y: livingFront, width: 1, depth: 0.60},
    {x: left, y: livingFront, width: 0.60, depth: 1},
  ], 1.90, [1, 0.60]);
  const serviceFront = linkTop + 0.05;
  const serviceChoice = (x, width, depth) => serviceFront + depth <= livingFront - 0.05 ?
    [{x, y: serviceFront, width, depth}] : [];
  const bath = place('bathroom', 'Bath concept', serviceChoice(rightEdge - 1.30, 1.30, 1.50), 2.10);
  if (bath) {
    // Leave its front open. This is not a fabricated bathroom door or hinge.
    result.partitions.push(...[[bath[1], bath[2]], [bath[2], bath[3]], [bath[3], bath[0]]].map(segment => segment.map(toWorld)));
  }
  place('kitchenette', 'Kitchen concept', serviceChoice(left, 0.60, 1.20), 0.90);
  result.status = result.items.length ? 'concept' : 'unavailable';
  if (result.status === 'unavailable') result.partitions = [];
  return result;
}
