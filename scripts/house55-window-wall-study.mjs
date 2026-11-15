import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { difference, intersection } from 'polyclip-ts';

const magnitude = Math.hypot(0.676, 0.737), right = [0.676 / magnitude, 0.737 / magnitude];
const local = ([x, z]) => [x * right[0] + z * right[1], -x * right[1] + z * right[0]];
const campus = ([x, y]) => [x * right[0] - y * right[1], x * right[1] + y * right[0]];
const round = value => Math.round(value * 1e6) / 1e6;
const close = points => [...points, [...points[0]]];
const rounded = ring => ring.map(point => point.map(round));
const area = ring => Math.abs(ring.slice(1).reduce((sum, b, i) => sum + ring[i][0] * b[1] - b[0] * ring[i][1], 0)) / 2;
const polygonArea = polygon => area(polygon[0]) - polygon.slice(1).reduce((sum, ring) => sum + area(ring), 0);
const clean = polygons => polygons.filter(polygon => polygonArea(polygon) > 1e-6);
const asMulti = space => [space.polygon, ...(space.holes || [])];
const geometry = polygon => ({polygon: rounded(polygon[0]), ...(polygon.length > 1 ? {holes: polygon.slice(1).map(rounded)} : {})});
const lerp = (a, b, t) => a.map((value, axis) => value + (b[axis] - value) * t);
const extent = space => {
  const points = space.polygon.map(local);
  return [Math.min(...points.map(p => p[0])), Math.min(...points.map(p => p[1])),
    Math.max(...points.map(p => p[0])), Math.max(...points.map(p => p[1]))];
};
const distance = (p, a, b) => {
  const d = b.map((v, i) => v - a[i]), length2 = d[0] ** 2 + d[1] ** 2;
  const t = Math.max(0, Math.min(1, d.reduce((sum, v, i) => sum + v * (p[i] - a[i]), 0) / length2));
  return Math.hypot(...p.map((v, i) => v - a[i] - t * d[i]));
};
const onBoundary = (segment, space) => asMulti(space).some(ring => ring.slice(1).some((b, i) =>
  segment.every(point => distance(point, ring[i], b) < 0.002)));

// Polygon union/difference can merge nearly collinear room edges. Retain
// their serialized intermediate corners so the hall shares the exact same
// edges, rather than crossing them by fractions of a micrometre.
function nodeSharedRing(ring, vertices) {
  const nearest = point => vertices.find(vertex => Math.hypot(...vertex.map((v, i) => v - point[i])) < 0.000001) || point;
  const result = [];
  for (let i = 1; i < ring.length; i++) {
    const a = nearest(ring[i - 1]), b = nearest(ring[i]);
    const d = b.map((v, axis) => v - a[axis]), length2 = d[0] ** 2 + d[1] ** 2;
    if (length2 < 1e-16) continue;
    const inner = vertices.flatMap(point => {
      const t = d.reduce((sum, v, axis) => sum + v * (point[axis] - a[axis]), 0) / length2;
      return t > 1e-8 && t < 1 - 1e-8 && distance(point, a, b) < 0.000001 ? [{point, t}] : [];
    }).sort((first, last) => first.t - last.t).map(item => item.point);
    for (const point of [a, ...inner]) {
      if (!result.length || Math.hypot(...point.map((v, axis) => v - result.at(-1)[axis])) > 1e-8) result.push([...point]);
    }
  }
  return close(result);
}

async function evidence(name, expectedHash, originalFilename) {
  const path = `data/source/${name}`, bytes = await readFile(new URL(`../${path}`, import.meta.url));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== expectedHash) throw new Error(`Review changed House 55 evidence before regenerating: ${name}`);
  return {path, originalFilename, sha256, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
}

/**
 * A later, separate hypothesis stage. Exterior vertices and confirmed counts
 * stay fixed. The 0.20 m offset is deliberately NOT solved to make R "pass".
 * Finite wall bands are display hypotheses over gross envelopes, not rooms,
 * additional usable area, structural classifications or measured thicknesses.
 */
export async function applyHouse55WindowWallStudy(level, building) {
  const baselineBytes = await readFile(new URL('../data/source/house55-2og-wall-offset-baseline.json', import.meta.url));
  const baseline = JSON.parse(baselineBytes);
  if (createHash('sha256').update(baselineBytes).digest('hex') !== '9a214415e0532f5960cfebf1009a7f44e2bbbba6479ab878c59c97b1dbfb16d8') {
    throw new Error('The frozen pre-window/wall-offset comparison changed');
  }
  if (JSON.stringify(level) !== JSON.stringify(baseline.level)) {
    throw new Error('The earlier House 55 stage changed: review the later wall-offset interpretation against a new baseline');
  }
  const windowImage = await evidence('house55-2og-window-marks.png', 'dbdf4328b8b55fd1b49e330caa337f860b6b5fec6c68c35202521792476c7824', 'codex-clipboard-g6kKzr.png');
  const wallImage = await evidence('house55-2og-wall-offsets.png', 'd5ff81c25d2b18fd198124ff29c0bfe47efb632d7f7e83c52320c2c7b4d79d9e', 'codex-clipboard-HHWKEQ.png');
  const output = structuredClone(level), offset = 0.20;
  const flat = building.surfaces[39].points.map(point => [point[0], point[2]]);
  const source = flat.map(local);
  const northY = x => source[18][1] + (source[17][1] - source[18][1]) * (x - source[18][0]) / (source[17][0] - source[18][0]);
  const plan = intersection([flat], output.floorOutline.map(piece => [piece.outer, ...(piece.holes || [])]));
  const previousStairs = level.spaces.find(space => space.kind === 'stairs'), previousStairBox = extent(previousStairs);
  const rLeft = source[6][0], rRight = source[7][0];
  const shiftL = point => {
    const [x, y] = local(point), moved = x - offset;
    return campus([moved, y]);
  };
  const widenR = point => {
    const [x, y] = local(point);
    const moved = x + offset * (x - rLeft) / (rRight - rLeft);
    const facadeY = coordinate => source[6][1] + (source[7][1] - source[6][1]) * (coordinate - rLeft) / (rRight - rLeft);
    return campus([moved, Math.abs(y - facadeY(x)) < 0.00001 ? facadeY(moved) : y]);
  };
  for (const space of output.spaces.filter(space => space.kind === 'room')) {
    if (space.shortLabel.startsWith('L')) {
      const candidate = space.polygon.map(point => {
        const [x, y] = local(point), moved = x - offset;
        // Overshoot only the known outside edge, then clip to both source
        // constraints. LoD2 wall/roof quantization differs by ~0.15 mm here.
        return campus([moved, Math.abs(y - northY(x)) < 0.002 ? northY(moved) - 0.001 : y]);
      });
      const clipped = clean(intersection(plan, [candidate]));
      if (clipped.length !== 1) throw new Error('L-room shift crosses a missing floor region');
      Object.assign(space, geometry(clipped[0]));
      space.note = 'The three L rooms move 0.20m left as an explicit wall-face hypothesis. Their existing equal gross widths and corridor-facing depth are retained; the staircase stays flush to L3 and gains that width. Each room has one north-facing window, confirmed by the resident. The offset, wall thickness and exact window centers remain unmeasured.';
    }
    if (space.shortLabel.startsWith('R')) {
      Object.assign(space, geometry([space.polygon.map(widenR)]));
      space.note = 'Three rooms and one south-facing window each are resident-confirmed. A hypothetical 0.20m shift of the east end toward the hallway is divided equally across R1–R3, giving about 2.76m gross bays. The original 8.08m exterior window wall is unchanged. These bays still fail the 2.70m clear-width living rectangle with a hypothetical 0.10m inset on both sides; the full apartment dimensions remain unresolved.';
    }
  }

  const stairs = output.spaces.find(space => space.kind === 'stairs');
  const stairWest = previousStairBox[0] - offset, stairEast = previousStairBox[2], stairSouth = previousStairBox[3];
  const stairCandidate = close([
    [stairWest, northY(stairWest)], [stairEast, northY(stairEast)], [stairEast, stairSouth], [stairWest, stairSouth],
  ].map(campus));
  const stairPolygon = clean(intersection(plan, [stairCandidate]));
  if (stairPolygon.length !== 1) throw new Error('Wall-offset hypothesis disconnects the stairwell');
  const l3 = output.spaces.find(space => space.shortLabel === 'L3');
  const joint = l3.polygon.find(point => Math.abs(local(point)[0] - stairWest) < 0.00001 && local(point)[1] > 5);
  const stairRing = stairPolygon[0][0];
  const jointEdge = stairRing.slice(1).findIndex((b, i) => distance(joint, stairRing[i], b) < 0.00001);
  if (jointEdge < 0) throw new Error('L3 no longer meets the stairwell');
  stairRing.splice(jointEdge + 1, 0, [...joint]);
  Object.assign(stairs, geometry(stairPolygon[0]));
  stairs.stairFlight = rounded(previousStairs.stairFlight.map(point => {
    const [x, y] = local(point);
    // Two micrometres avoids Float64/serialized-line disagreement with the
    // enclosure. This computational clearance is not a stair dimension.
    return campus([Math.abs(x - previousStairBox[0]) < 0.00001 ? stairWest + 0.000002 : stairEast - 0.000002, y]);
  }));
  stairs.note = 'The stairwell gains 0.20m on its west side as the L block shifts left in the wall-face hypothesis. Its gross width is about 1.67m; flight length and the east side are retained. This is an unmeasured enclosure, not a clear stair width. The resident-confirmed west-hall entrance remains below the flight. The east-hall connection and the shared-area window south of this enclosure remain unassigned to a stair route.';
  const roomsAndStairs = output.spaces.filter(space => space.kind !== 'corridor');
  const halls = clean(difference(plan, ...roomsAndStairs.map(asMulti))).filter(polygon => polygonArea(polygon) > 1)
    .sort((a, b) => Math.min(...a[0].map(p => local(p)[0])) - Math.min(...b[0].map(p => local(p)[0])));
  if (halls.length !== 2) throw new Error(`Wall-face hypothesis must keep two halls; found ${halls.length}`);
  const sharedVertices = roomsAndStairs.flatMap(space => asMulti(space).flatMap(ring => ring.slice(0, -1)));
  output.spaces.filter(space => space.kind === 'corridor').forEach((space, index) => {
    const {holes, ...rest} = space;
    delete space.holes;
    Object.assign(space, rest, geometry(halls[index].map(ring => nodeSharedRing(rounded(ring), sharedVertices))));
    space.note = index
      ? 'East hall after a hypothetical 0.20m extension of R toward this hall. Room and hall areas are disjoint. Its stairwell connection remains unknown; a window does not imply a door or an accessible route.'
      : 'West hall after the L block and stairwell west wall move 0.20m left as a wall-face hypothesis. The observed stairwell entrance is retained. Wall bands show a possible finite thickness without changing the source exterior or proving clear circulation widths.';
  });
  for (const door of output.doors) {
    const room = output.spaces.find(space => space.id === door.spaceId);
    if (room.shortLabel?.startsWith('L') || room.kind === 'stairs') door.segment = rounded(door.segment.map(shiftL));
    if (room.shortLabel?.startsWith('R')) {
      const [x0, y0, x1] = extent(room), center = (x0 + x1) / 2;
      door.segment = rounded([[center - 0.45, y0], [center + 0.45, y0]].map(campus));
    }
    const adjacent = output.spaces.filter(space => space.kind === 'corridor' && onBoundary(door.segment, space));
    if (adjacent.length !== 1 || !onBoundary(door.segment, room)) throw new Error(`Wall-face offset stranded a door: ${door.id}`);
    door.toSpaceId = adjacent[0].id;
  }
  // Do not present the newly moved estimated R divider as a resident-traced
  // coordinate. Only the unchanged long source façade is an exact source edge.
  output.sketchBoundaries = [[flat[6], flat[7]].map(point => point.map(round))];

  const windowSpecs = [
    ...['W1', 'W2', 'W3', 'W4'].map((room, i) => ({room, edge: [20, 21], wall: 16, mark: [173, [190, 261, 330, 391][i]]})),
    ...['A', 'B', 'C', 'D'].map((room, i) => ({room, edge: [23, 0], wall: 4, mark: [[129, 190, 257, 323][i], 605]})),
    ...['N1', 'N2', 'N3'].map((room, i) => ({room, edge: [13, 12], wall: 43, mark: [[813, 876, 942][i], 67]})),
    ...['E', 'F', 'G'].map((room, i) => ({room, edge: [10, 9], wall: 5, mark: [956, [297, 357, 423][i]]})),
    ...['R1', 'R2', 'R3'].map((room, i) => ({room, edge: [6, 7], wall: 36, mark: [[626, 685, 736][i], 430]})),
    ...['L1', 'L2', 'L3'].map(room => ({room, edge: [18, 17], wall: 0})),
    {name: 'west-hall', edge: [22, 21], wall: 28, mark: [141, 417]},
    {name: 'south-shared', edge: [4, 5], wall: 34, mark: [562, 431]},
    {name: 'east-return', edge: [7, 8], wall: 6, mark: [774, 447], width: 0.85},
    {name: 'north-return', edge: [10, 11], wall: 2, mark: [967, 259], width: 0.70},
  ];
  // Affine registration of the orthographic diagram. Plot X and Y have
  // different pixel scales; this is not the earlier perspective homography.
  const imageControls = [
    {vertex: 20, pixel: [174, 158]}, {vertex: 23, pixel: [98, 605]},
    {vertex: 0, pixel: [358, 605]}, {vertex: 13, pixel: [775, 67]},
    {vertex: 12, pixel: [980, 67]}, {vertex: 9, pixel: [957, 461]},
  ];
  const fits = [0, 1].map(axis => {
    const pairs = imageControls.map(control => [source[control.vertex][axis], control.pixel[axis]]);
    const meanX = pairs.reduce((sum, p) => sum + p[0], 0) / pairs.length, meanY = pairs.reduce((sum, p) => sum + p[1], 0) / pairs.length;
    const slope = pairs.reduce((sum, p) => sum + (p[0] - meanX) * (p[1] - meanY), 0) / pairs.reduce((sum, p) => sum + (p[0] - meanX) ** 2, 0);
    return {slope, intercept: meanY - slope * meanX};
  });
  const unproject = pixel => pixel.map((value, axis) => (value - fits[axis].intercept) / fits[axis].slope);
  const windowObservations = [];
  output.windows = windowSpecs.map(spec => {
    const [a, b] = spec.edge.map(index => source[index]), d = b.map((v, i) => v - a[i]), length = Math.hypot(...d), axis = Math.abs(d[0]) > Math.abs(d[1]) ? 0 : 1;
    const space = spec.room && output.spaces.find(space => space.shortLabel === spec.room);
    const box = space && extent(space), observation = spec.mark ? unproject(spec.mark) : [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
    const coordinate = spec.room?.startsWith('L') ? (box[0] + box[2]) / 2 : observation[axis];
    const width = spec.width || 1.05;
    // The two short return windows use narrower explicit estimates instead
    // of squeezing a typical 1.05 m opening through a source corner.
    const t = Math.max((width / 2 + 0.09) / length, Math.min(1 - (width / 2 + 0.09) / length, (coordinate - a[axis]) / d[axis]));
    const segment = rounded([lerp(a, b, t - width / (2 * length)), lerp(a, b, t + width / (2 * length))].map(campus));
    if (space && !onBoundary(segment, space)) throw new Error(`Marked window misses its room façade: ${spec.room}`);
    const id = `study-55-2-window-${spec.room || spec.name}`;
    windowObservations.push({id, roomReference: spec.room || null, sourceSurfaceIndex: spec.wall, roofEdgeVertexIndexes: spec.edge,
      observedImageCenterPixels: spec.mark || null, sourceOfPosition: spec.mark ? 'Green mark snapped to its existing source façade; hand-stroke center is approximate.' : 'Resident explicitly confirmed one north-facing window per L room; centered within its estimated bay.',
      widthMetres: width, widthStatus: 'Typical sketch or explicit narrower return-window estimate; not measured from green stroke length.'});
    return {
      id, label: spec.room ? `Window — ${spec.room}` : `Window — ${spec.name.replaceAll('-', ' ')}`,
      ...(space ? {spaceId: space.id} : {}), sourceSurfaceIndex: spec.wall, confidence: 'sketch',
      note: spec.room
        ? `One exterior window in ${spec.room}, confirmed by the resident's green marks or L-room clarification. Source façade retained; exact center and ${width.toFixed(2)}m model width remain estimates. No opening direction or resident identity is inferred.`
        : `Resident-marked shared-area window on the unchanged source façade. The ${width.toFixed(2)}m width and exact center are estimates. The window is not assigned to a room, stairwell, door or circulation route.`,
      segment,
    };
  });
  output.windowCoverage = 'complete-floor';

  const bands = [
    {name: 'west-elbow', edge: [19, 18]},
    {name: 'west-connector', edge: [22, 21]},
    {name: 'east-return', edge: [7, 8]},
    {name: 'north-recess', edge: [15, 16]},
    {name: 'south-recess', edge: [2, 3]},
  ];
  const wallBandObservations = [];
  output.wallBands = bands.flatMap(band => {
    const [a, b] = band.edge.map(index => flat[index]), d = b.map((v, i) => v - a[i]), length = Math.hypot(...d);
    const normal = [-d[1] / length, d[0] / length];
    // Determine the inward side by intersection, never by a drawing's
    // winding assumption. Only the displayed finite-width strip is added.
    const strips = [1, -1].map(sign => {
      const inset = p => p.map((v, i) => v + normal[i] * offset * sign);
      return clean(intersection(plan, [close([a, b, inset(b), inset(a)])]));
    });
    const strip = strips.reduce((best, current) => current.reduce((sum, p) => sum + polygonArea(p), 0) > best.reduce((sum, p) => sum + polygonArea(p), 0) ? current : best, []);
    const cuts = output.windows.filter(window => window.segment.every(point => distance(point, a, b) < 0.002)).map(window => {
      const [start, end] = window.segment;
      const pad = p => p.map((v, i) => v + normal[i] * (offset + 0.01));
      const unpad = p => p.map((v, i) => v - normal[i] * (offset + 0.01));
      return [close([pad(start), pad(end), unpad(end), unpad(start)])];
    });
    const pieces = clean(cuts.length ? difference(strip, ...cuts) : strip);
    wallBandObservations.push({name: band.name, roofEdgeVertexIndexes: band.edge, assumedThicknessMetres: offset,
      interpretation: band.name.includes('recess') ? 'Resident blue roof/void-edge mark; not evidence of a full-height structural wall.' : 'Resident red façade-return mark; possible inward wall face, not a measured assembly.'});
    return pieces.map((polygon, i) => ({
      id: `study-55-2-wall-band-${band.name}-${i + 1}`, label: `Possible wall band — ${band.name.replaceAll('-', ' ')}`,
      confidence: 'estimated', note: 'Illustrative 0.20m inward band at a resident-marked edge. Not measured wall thickness or added usable floor area. Gross space envelopes may include wall material; independent room polygons never overlap.',
      ...geometry(polygon),
    }));
  });
  const unchanged = level.spaces.filter(space => space.kind === 'room' && !/^[LR]/.test(space.shortLabel));
  if (unchanged.length !== 14 || unchanged.some(space => JSON.stringify(space.polygon) !== JSON.stringify(output.spaces.find(s => s.id === space.id).polygon))) {
    throw new Error('Wall-offset study changed a room outside L/R');
  }
  output.label = '2. OG — windows and wall-face study';
  output.source = 'Resident window marks, confirmation of one window per L room, and proposed wall-face offsets supplied on 15 November 2026; unchanged Bavarian exterior model.';
  output.notes = 'The twenty-room count and all 24 exterior window locations are resident-confirmed. Exact window centers, widths and all room dimensions remain estimates. A separate 0.20m wall-face hypothesis shifts L left, widens the stairwell to about 1.67m, and gives R about 2.76m gross bays. R still does not fit the published living rectangle with the audit’s hypothetical wall inset. Shaded bands show possible wall material within gross envelopes; room areas never overlap. Four shared-area windows are unassigned to rooms or routes. The east-hall stairwell connection remains unknown. The exterior, no-floor roof wings and both lower floors are unchanged.';
  const stairBox = extent(stairs);
  return {
    level: output,
    metadata: {
      status: 'resident-window-positions-and-unmeasured-wall-face-hypothesis',
      baseline: {path: 'data/source/house55-2og-wall-offset-baseline.json', sha256: createHash('sha256').update(baselineBytes).digest('hex'), sourceCommit: baseline.sourceCommit},
      images: {windows: windowImage, wallOffsets: wallImage},
      windows: {confirmedRoomWindowCount: 20, confirmedSharedWindowCount: 4, total: output.windows.length,
        lRoomClarification: 'Resident explicitly confirmed one window on the north/outside wall of each L room.',
        sharedWindowPolicy: 'The four shared-area windows retain their source façade locations without guessing room/stairwell ownership or access.',
        registration: {method: 'Independent least-squares affine scale/offset for X and Y in the orthographic plot; no source geometry rescaling.', controls: imageControls, localMetresToImagePixels: fits},
        observations: windowObservations,
        ignoredMarks: 'Three green marks in empty plotting space are excluded; they do not touch any building wall. Blue strokes are not windows.',
        elevationPolicy: 'The exterior uses the established appearance-only old-house row guides and typical-sketch sill/height. The plan uses a low display cutaway; neither establishes measured elevations.',
      },
      wallOffsets: {
        assumedOffsetMetres: offset,
        basis: 'A transparent 0.20m sensitivity case for the resident’s arrows and finite-wall hypothesis. Not digitized as a dimension, not derived from hand length, and not optimized to make the R template fit.',
        lTranslationMetres: [-offset, 0], rEastEndExtensionMetres: offset,
        previousStairwellGrossWidthMetres: previousStairBox[2] - previousStairBox[0],
        candidateStairwellGrossWidthMetres: stairBox[2] - stairBox[0],
        priorRFacadeRunMetres: rRight - rLeft, candidateRGrossAxisRunMetres: rRight - rLeft + offset,
        nominalRGrossBayMetres: (rRight - rLeft + offset) / 3,
        facadeRunNotExpanded: true, bands: wallBandObservations,
        whatCanOverlap: 'Different projected façade/roof edges and gross wall allocations may overlap visually. Independent room, stair and hall floor polygons must remain disjoint.',
        limitation: 'Source LoD2 contains exterior faces, not paired inner faces or wall assemblies. Its stepped extra floor-section margins occur at other roof ends; they do not establish extra width in the R façade. The wall hypothesis is not verified by the source.',
        numericalCleanup: 'L exterior edges clip against both original floor and roof constraints. Hall boundaries retain every adjoining serialized room corner. A 0.000002m schematic-flight inset avoids serialization slivers; it is not architectural clearance.',
      },
      unchangedRoomReferences: unchanged.map(space => space.shortLabel),
      unchangedLowerFloors: [0, 1], unchangedSourceExterior: true,
    },
  };
}
