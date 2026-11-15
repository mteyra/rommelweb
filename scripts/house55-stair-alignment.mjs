import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {difference, intersection} from 'polyclip-ts';
import {
  local, campus, close, rounded, clean, asMulti, geometry, extent, distance,
  onBoundary, polygonArea, nodeSharedRing, evidence,
} from './house55-window-wall-study.mjs';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const sub = (a, b) => a.map((value, i) => value - b[i]);
const add = (a, b, scale = 1) => a.map((value, i) => value + scale * b[i]);
const unit = vector => vector.map(value => value / Math.hypot(...vector));

/**
 * Apply the resident's relative constraints, after the frozen window stage.
 * Equal W4/L1 CORNER overrun and 1/4 toward L3 : 3/4 toward R1 are observations.
 * Absolute L bay widths and stair flight/landing depths remain study estimates.
 */
export async function applyHouse55StairAlignment(level, building) {
  const baselinePath = 'data/source/house55-2og-stair-ratio-baseline.json';
  const bytes = await readFile(new URL(`../${baselinePath}`, import.meta.url));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== '64801d3747c247f45404f1300abd5b9e3b779734e411c35e8a349354f50c5eba'
      || JSON.stringify(level) !== JSON.stringify(JSON.parse(bytes).level)) {
    throw new Error('Review changed geometry against the frozen pre-stair-alignment baseline');
  }
  const images = {
    overlapReference: await evidence('house55-2og-overlap-reference.png', '6159c5a93209886b108c3dcd0fe2d925a8e7eb171d6b502fc85352043254b204', 'codex-clipboard-IAqczZ.png'),
    lCorrection: await evidence('house55-2og-l-overlap-correction.png', 'a35b1a9df6d55c7626148f536448d8ce4254c6b2206e09b385e4ca2417810e07', 'codex-clipboard-op6ht1.png'),
    stairRatio: await evidence('house55-stair-ratio-mark.png', '7e0d117946c06d72cd33cf67c0b55bbd63644387cd5e19fd50d63b782c53a2e4', 'codex-clipboard-Uw5pTJ.png'),
  };
  const output = structuredClone(level);
  const flat = building.surfaces[39].points.map(([x, , z]) => [x, z]), source = flat.map(local);
  const origin = source[3], along = unit(sub(source[4], source[3])), east = [along[1], -along[0]];
  const across = point => dot(sub(point, origin), east);
  const xAtY = (u, y) => origin[0] + (u - east[1] * (y - origin[1])) / east[0];
  const atY = (u, y) => [xAtY(u, y), y];
  const plan = intersection([flat], output.floorOutline.map(piece => [piece.outer, ...(piece.holes || [])]));
  const w4 = level.spaces.find(space => space.shortLabel === 'W4');
  const wFacade = unit(sub(source[21], source[20])), wFacadeNormal = [-wFacade[1], wFacade[0]];
  const w4Corner = w4.polygon.map(local).filter(point => Math.abs(dot(sub(point, source[20]), wFacadeNormal)) < 0.002)
    .sort((a, b) => b[1] - a[1])[0];
  const westReturn = unit(sub(source[21], source[22])), westNormal = [-westReturn[1], westReturn[0]];
  const overlap = dot(sub(w4Corner, source[21]), westNormal);
  if (!(overlap > 0 && overlap < 1)) throw new Error('Review the resident-selected W4 overlap');
  const lReturn = unit(sub(source[18], source[19])), lNormal = [-lReturn[1], lReturn[0]];
  const lAnchor = add(source[18], lNormal, overlap), lWest = across(lAnchor);
  const oldL = ['L1', 'L2', 'L3'].map(label => level.spaces.find(space => space.shortLabel === label));
  const oldWest = extent(oldL[0])[0], oldEast = extent(oldL[2])[2];
  const bay = (oldEast - oldWest) * east[0] / 3;
  const stairWest = lWest + bay * 3, width = -stairWest / 0.25, stairEast = width * 0.75;
  if (!(width > 1 && width < 3)) throw new Error('Relative constraints produced an implausible study stair width; do not force a fit');
  const northSlope = (source[17][1] - source[18][1]) / (source[17][0] - source[18][0]);
  const northIntercept = source[18][1] - northSlope * source[18][0];
  const north = (u, pad = 0) => {
    const x = (u + dot(origin, east) - east[1] * (northIntercept - pad)) / (east[0] + east[1] * northSlope);
    return [x, northSlope * x + northIntercept - pad];
  };
  const southY = oldL.reduce((sum, room) => sum + extent(room)[3], 0) / 3;
  for (let i = 0; i < 3; i++) {
    const room = output.spaces.find(space => space.id === oldL[i].id);
    const u0 = lWest + i * bay, u1 = u0 + bay;
    const candidate = close([north(u0, 0.001), north(u1, 0.001), atY(u1, southY), atY(u0, southY)].map(campus));
    const clipped = clean(intersection(plan, [candidate]));
    if (clipped.length !== 1) throw new Error('Aligned L room crosses a missing floor region');
    Object.assign(room, geometry(clipped[0]));
    room.note = `The L block matches the resident-selected W4 corner overlap (${overlap.toFixed(3)}m in this source model). Equal approximately ${bay.toFixed(3)}m gross bays and corridor-facing depth are retained. Dividers align with the marked stair reference; source skew causes only millimetre differences. One outside window per room is resident-confirmed. Absolute room dimensions and wall construction remain estimates.`;
  }
  const oldStairs = level.spaces.find(space => space.kind === 'stairs');
  const stairs = output.spaces.find(space => space.kind === 'stairs'), stairSouth = extent(oldStairs)[3];
  const candidate = close([north(stairWest, 0.001), north(stairEast, 0.001), atY(stairEast, stairSouth), atY(stairWest, stairSouth)].map(campus));
  const enclosure = clean(intersection(plan, [candidate]));
  if (enclosure.length !== 1) throw new Error('Aligned staircase is disconnected');
  const l3 = output.spaces.find(space => space.shortLabel === 'L3');
  const joint = l3.polygon.find(point => Math.abs(across(local(point)) - stairWest) < 1e-5 && local(point)[1] > 5);
  const ring = enclosure[0][0], jointEdge = ring.slice(1).findIndex((b, i) => distance(joint, ring[i], b) < 1e-5);
  if (jointEdge < 0) throw new Error('L3 and aligned staircase are not flush');
  ring.splice(jointEdge + 1, 0, [...joint]);
  Object.assign(stairs, geometry(enclosure[0]));
  const [, flightNorth, , flightSouth] = extent({polygon: oldStairs.stairFlight});
  stairs.stairFlight = rounded(close([
    atY(stairWest + 0.000002, flightNorth), atY(stairEast - 0.000002, flightNorth),
    atY(stairEast - 0.000002, flightSouth), atY(stairWest + 0.000002, flightSouth),
  ].map(campus)));
  stairs.note = `The resident confirms that the extended marked outside edge splits the staircase: 1/4 toward L3 and 3/4 toward R1. Both sides run parallel to that source edge, so the ratio holds throughout the flight. Matching L1 to W4's corner overlap while retaining the estimated L bays derives a ${width.toFixed(3)}m gross enclosure. This is not a measured clear stair width. Flight length and landing depths remain schematic. The west-hall entrance is retained; the east-hall connection remains unknown.`;
  const occupied = output.spaces.filter(space => space.kind !== 'corridor');
  const halls = clean(difference(plan, ...occupied.map(asMulti))).filter(polygon => polygonArea(polygon) > 1)
    .sort((a, b) => Math.min(...a[0].map(point => local(point)[0])) - Math.min(...b[0].map(point => local(point)[0])));
  if (halls.length !== 2) throw new Error('Alignment must retain two separate halls');
  const vertices = occupied.flatMap(space => asMulti(space).flatMap(ring => ring.slice(0, -1)));
  output.spaces.filter(space => space.kind === 'corridor').forEach((hall, i) => {
    delete hall.holes;
    Object.assign(hall, geometry(halls[i].map(ring => nodeSharedRing(rounded(ring), vertices))));
    hall.note = i
      ? 'East hall recalculated around the staircase aligned to the resident-confirmed 1/4 L3 : 3/4 R1 reference. The earlier R study is unchanged. Connection into the stairwell remains unconfirmed.'
      : 'West hall recalculated after the L block is moved to match W4’s confirmed corner overlap. The west-hall stairwell entrance stays below the flight. Gross boundaries do not establish clear hallway or masonry dimensions.';
  });
  for (const door of output.doors) {
    const room = output.spaces.find(space => space.id === door.spaceId);
    if (/^L[123]$/.test(room.shortLabel)) {
      const i = Number(room.shortLabel[1]) - 1, center = lWest + (i + 0.5) * bay;
      const length = Math.hypot(...sub(...door.segment));
      door.segment = rounded([atY(center - length * east[0] / 2, southY), atY(center + length * east[0] / 2, southY)].map(campus));
    } else if (room.kind === 'stairs') {
      door.segment = rounded(door.segment.map(point => atY(stairWest, local(point)[1])).map(campus));
      door.note = 'Resident-confirmed west-hall entrance INTO the stairwell, below the flight. Its position follows the aligned west stair wall; displayed width and landing position remain estimates. The opposite stairwell entrance is unconfirmed.';
    }
    const adjacent = output.spaces.filter(space => space.kind === 'corridor' && onBoundary(door.segment, space));
    if (adjacent.length !== 1 || !onBoundary(door.segment, room)) throw new Error(`Alignment stranded a doorway: ${door.id}`);
    door.toSpaceId = adjacent[0].id;
  }
  for (const window of output.windows.filter(window => /^Window — L[123]$/.test(window.label))) {
    const i = Number(window.label.at(-1)) - 1, center = north(lWest + (i + 0.5) * bay);
    const facade = unit(sub(source[17], source[18])), half = Math.hypot(...sub(...window.segment)) / 2;
    window.segment = rounded([add(center, facade, -half), add(center, facade, half)].map(campus));
    const room = output.spaces.find(space => space.id === window.spaceId);
    if (!onBoundary(window.segment, room)) throw new Error(`Aligned window misses ${room.shortLabel}`);
  }
  // Replace only the two west display bands. Their width depicts the matched
  // gross corner offset, which is NOT a measured wall assembly.
  output.wallBands = output.wallBands.filter(band => !/west-elbow|west-connector/.test(band.id));
  for (const [name, indexes] of [['west-elbow', [19, 18]], ['west-connector', [22, 21]]]) {
    const [a, b] = indexes.map(index => flat[index]), d = unit(sub(b, a)), normal = [-d[1], d[0]];
    const strips = [1, -1].map(sign => clean(intersection(plan, [close([a, b, add(b, normal, overlap * sign), add(a, normal, overlap * sign)])])));
    const strip = strips.reduce((best, item) => item.reduce((sum, p) => sum + polygonArea(p), 0) > best.reduce((sum, p) => sum + polygonArea(p), 0) ? item : best, []);
    const cuts = output.windows.filter(window => window.segment.every(point => distance(point, a, b) < 0.002)).map(window => {
      const [start, end] = window.segment, pad = overlap + 0.01;
      return [close([add(start, normal, pad), add(end, normal, pad), add(end, normal, -pad), add(start, normal, -pad)])];
    });
    const pieces = clean(cuts.length ? difference(strip, ...cuts) : strip);
    output.wallBands.push(...pieces.map((polygon, i) => ({
      id: `study-55-2-wall-band-${name}-${i + 1}`, label: `Possible wall band — ${name.replaceAll('-', ' ')}`,
      confidence: 'estimated', note: `The ${overlap.toFixed(3)}m band illustrates the resident-confirmed gross corner overlap. Actual wall thickness, assembly and usable area remain unmeasured.`,
      ...geometry(polygon),
    })));
  }
  const unchanged = level.spaces.filter(space => space.kind === 'room' && !/^L[123]$/.test(space.shortLabel));
  if (unchanged.length !== 17 || unchanged.some(room => JSON.stringify(room.polygon) !== JSON.stringify(output.spaces.find(s => s.id === room.id).polygon))) {
    throw new Error('Stair alignment changed a room outside L1–L3');
  }
  output.label = '2. OG — resident-aligned study';
  output.source = 'Resident-confirmed matching W4/L1 corner overlap and 1/4 L3-side : 3/4 R1-side stair alignment, clarified 15 November 2026; prior window marks and unchanged Bavarian exterior.';
  output.notes = 'The L block now matches W4’s confirmed corner overlap. The marked exterior edge extends through the staircase with 1/4 toward L3 and 3/4 toward R1. L bay widths are retained; the stair enclosure is derived at about 1.78m gross. These relative observations do not measure room sizes, clear stair width, masonry or landing depths. Twenty rooms and 24 windows remain; exact openings and dimensions are estimates. R’s dimensional fit and the east stairwell entrance remain unresolved.';
  return {level: output, metadata: {
    status: 'resident-confirmed-relative-alignment-with-estimated-absolute-dimensions',
    baseline: {path: baselinePath, sha256, sourceCommit: JSON.parse(bytes).sourceCommit}, images,
    reference: {sourceRoofSurfaceIndex: 39, sourceRoofVertexIndexes: [3, 4], line: [flat[3], flat[4]], meaning: 'Extend the resident-marked vertical exterior return north through the flight; do not use a moved room divider as the reference.'},
    observedRatio: {lSide: 0.25, rSide: 0.75, clarification: 'Resident explicitly answered “R1 side — left in Image 3” for the three-quarter portion. This later clarification resolves the initial left/right wording.'},
    overlap: {w4CornerOffsetMetres: overlap, l1CornerOffsetMetres: overlap, w4CornerStudyCoordinates: w4Corner, l1ReferenceStudyCoordinates: lAnchor, meaning: 'Equal signed perpendicular offset at the façade corners. Confirmed relative alignment; not a measurement of masonry thickness.'},
    stairGeometry: {grossWidthMetres: width, previousGrossWidthMetres: extent(oldStairs)[2] - extent(oldStairs)[0], lBayPerpendicularWidthMetres: bay,
      sourceParallelDirection: along, sourceEastNormal: east, lWestSignedOffsetMetres: lWest, stairWestSignedOffsetMetres: stairWest, stairEastSignedOffsetMetres: stairEast,
      derivation: 'Keep the prior equal L bay widths; place L1 at the W4-matched corner offset; L3 ends at the west stair wall. The reference lies one quarter of the derived full width from that wall. Both sides parallel the reference.'},
    unchangedRoomReferences: unchanged.map(room => room.shortLabel), unchangedSourceExterior: true,
    limitations: 'The tiny alignment shear follows source-edge skew. Exact L sizes remain prior estimates; the derived gross stair width is conditional on them. Landings, clear widths, wall assemblies and the east stair connection remain unmeasured.',
  }};
}
