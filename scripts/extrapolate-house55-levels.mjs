import { createHash } from 'node:crypto';
import { difference, intersection, union } from 'polyclip-ts';

const ringArea = ring => Math.abs(ring.slice(1).reduce((sum, b, i) =>
  sum + ring[i][0] * b[1] - b[0] * ring[i][1], 0)) / 2;
const polygonArea = polygon => ringArea(polygon[0])
  - polygon.slice(1).reduce((sum, ring) => sum + ringArea(ring), 0);
const multiArea = polygons => polygons.reduce((sum, polygon) => sum + polygonArea(polygon), 0);
const clean = polygons => polygons.filter(polygon => polygonArea(polygon) > 1e-8);
const asPolygon = space => [space.polygon, ...(space.holes || [])];
const round = value => Math.round(value * 1e6) / 1e6;
const rounded = ring => {
  const points = [];
  for (const point of ring.map(point => point.map(round))) {
    if (!points.length || point.some((value, axis) => value !== points.at(-1)[axis])) points.push(point);
  }
  return points;
};
const geometry = polygon => ({
  polygon: rounded(polygon[0]),
  ...(polygon.length > 1 ? {holes: polygon.slice(1).map(rounded)} : {}),
});
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function distance(point, a, b) {
  const d = b.map((value, axis) => value - a[axis]), length2 = d[0] ** 2 + d[1] ** 2;
  const t = length2 ? Math.max(0, Math.min(1, d.reduce((sum, value, axis) =>
    sum + value * (point[axis] - a[axis]), 0) / length2)) : 0;
  return Math.hypot(...point.map((value, axis) => value - a[axis] - t * d[axis]));
}

const edges = polygons => polygons.flatMap(polygon =>
  polygon.flatMap(ring => ring.slice(1).map((b, i) => [ring[i], b])));
const maximumOffset = (polygons, boundary) => polygons.length
  ? Math.max(...polygons.flat(2).map(point => Math.min(...boundary.map(([a, b]) => distance(point, a, b)))))
  : 0;
const onBoundary = (segment, space) => asPolygon(space).some(ring =>
  ring.slice(1).some((b, i) => segment.every(point => distance(point, ring[i], b) < 0.002)));

// Preserve serialized room corners on shared hall edges. Polyclip may merge
// nearly collinear segments; retaining their nodes avoids numerical overlaps.
function nodeSharedRing(ring, vertices) {
  const nearest = point => vertices.find(vertex =>
    Math.hypot(...vertex.map((value, axis) => value - point[axis])) < 0.000001) || point;
  const result = [];
  for (let i = 1; i < ring.length; i++) {
    const a = nearest(ring[i - 1]), b = nearest(ring[i]);
    const d = b.map((value, axis) => value - a[axis]), length2 = d[0] ** 2 + d[1] ** 2;
    if (length2 < 1e-16) continue;
    const inner = vertices.flatMap(point => {
      const t = d.reduce((sum, value, axis) => sum + value * (point[axis] - a[axis]), 0) / length2;
      return t > 1e-8 && t < 1 - 1e-8 && distance(point, a, b) < 0.000001 ? [{point, t}] : [];
    }).sort((a, b) => a.t - b.t).map(item => item.point);
    for (const point of [a, ...inner]) {
      if (!result.length || Math.hypot(...point.map((value, axis) => value - result.at(-1)[axis])) > 1e-8) {
        result.push([...point]);
      }
    }
  }
  return [...result, [...result[0]]];
}

/**
 * Repeat the current top-floor core at the resident's request. This refreshes
 * the lower-floor study, not its source plate or its evidence classification.
 * Extra lower wings receive no inferred rooms, circulation or window records.
 */
export function refreshHouse55LowerLevels(lowerLevels, topLevel, building) {
  if (topLevel?.layoutBasis === 'resident-module-layout') {
    throw new Error('The independent module layout belongs only to House 55 / 2. OG; use the retained pre-module study to reproduce historical lower floors');
  }
  if (building?.number !== '55' || topLevel?.index !== 2 || topLevel.extrapolatedFrom !== undefined) {
    throw new Error('House 55 extrapolation requires its directly documented index-2 study');
  }
  if (!Array.isArray(lowerLevels) || lowerLevels.length !== 2
    || new Set(lowerLevels.map(level => level.index)).size !== 2
    || lowerLevels.some(level => ![0, 1].includes(level.index))) {
    throw new Error('House 55 extrapolation requires the existing EG and 1. OG source plates');
  }
  if (topLevel.spaces.filter(space => space.kind === 'room').length !== 20
    || topLevel.spaces.filter(space => space.kind === 'stairs').length !== 1
    || topLevel.spaces.filter(space => space.kind === 'corridor').length !== 2
    || topLevel.spaces.filter(space => space.kind === 'service').length > 1
    || topLevel.spaces.length !== 23 + topLevel.spaces.filter(space => space.kind === 'service').length
    || topLevel.doors.length !== 21) {
    throw new Error('Review a changed top-floor count before extrapolating House 55');
  }
  const sourcePrefix = 'study-55-2-';
  const sourceIds = [...topLevel.spaces, ...topLevel.doors].map(item => item.id);
  if (sourceIds.some(id => !id.startsWith(sourcePrefix)) || new Set(sourceIds).size !== sourceIds.length) {
    throw new Error('House 55 top-floor geometry requires unique floor-specific IDs');
  }
  const topGeometryDigest = digest({
    spaces: topLevel.spaces,
    doors: topLevel.doors,
  });
  const metadata = [];
  const levels = lowerLevels.map(lower => {
    const {index} = lower, name = index === 0 ? 'EG' : '1. OG';
    const floorOutline = structuredClone(lower.floorOutline);
    const floor = floorOutline.map(piece => [piece.outer, ...(piece.holes || [])]);
    const boundary = edges(floor);
    const idForFloor = id => {
      if (!id.startsWith(sourcePrefix)) throw new Error(`${name}: missing source-floor geometry reference ${id}`);
      return `study-55-${index}-${id.slice(sourcePrefix.length)}`;
    };
    const trims = [];
    const spaces = topLevel.spaces.map(original => {
      const clipped = clean(intersection(asPolygon(original), floor));
      if (clipped.length !== 1) throw new Error(`${name}: source plate disconnects ${original.id}`);
      const removed = difference(asPolygon(original), floor);
      const trimDistance = maximumOffset(removed, boundary);
      if (trimDistance > 0.001) {
        throw new Error(`${name}: ${original.id} needs more than sub-millimetre exterior trimming (${trimDistance}m)`);
      }
      trims.push({reference: original.shortLabel, areaMetresSquared: multiArea(removed), maximumDistanceMetres: trimDistance});
      const space = {
        id: idForFloor(original.id),
        label: original.kind === 'room' ? `Room ${original.shortLabel} — assumed layout`
          : original.kind === 'stairs' ? 'Stairwell — assumed position'
            : `${original.shortLabel} — assumed layout`,
        shortLabel: original.shortLabel,
        kind: original.kind,
        confidence: 'estimated',
        note: `${name}: assumed continuation of the current corrected 2. OG study, including its matched L-block overlap and staircase alignment. This lower-floor space was not separately observed. All dimensions and room references remain unmeasured; no physical room number or occupancy is established.`,
        ...geometry(clipped[0]),
      };
      if (original.stairFlight) {
        // The flight lies inside the repeated enclosure, away from the source
        // exterior. A clipping operation must never turn it into a new shape.
        if (multiArea(difference([original.stairFlight], clipped)) > 1e-8) {
          throw new Error(`${name}: source clipping would alter the schematic stair flight`);
        }
        space.stairFlight = structuredClone(original.stairFlight);
        space.note += ' Flight, landings and the west entrance repeat the top-floor interpretation; the east stairwell connection remains unknown.';
      }
      if (original.kind === 'corridor') {
        space.note += ' Only the top-floor corridor footprint is repeated; additional lower-floor wings remain unassigned.';
      }
      if (original.kind === 'service') {
        space.note += ' This narrow residual strip is unassigned, has no door, and must not be interpreted as a hallway or confirmed service area.';
      }
      return space;
    });
    const roomAndStairVertices = spaces.filter(space => space.kind !== 'corridor')
      .flatMap(space => asPolygon(space).flatMap(ring => ring.slice(0, -1)));
    for (const hall of spaces.filter(space => space.kind === 'corridor')) {
      const noded = asPolygon(hall).map(ring => nodeSharedRing(ring, roomAndStairVertices));
      delete hall.holes;
      Object.assign(hall, geometry(noded));
    }
    const doors = topLevel.doors.map(original => {
      const spaceId = idForFloor(original.spaceId);
      const toSpaceId = original.toSpaceId && idForFloor(original.toSpaceId);
      const from = spaces.find(space => space.id === spaceId);
      const to = spaces.find(space => space.id === toSpaceId);
      if (!from || !to || !onBoundary(original.segment, from) || !onBoundary(original.segment, to)) {
        throw new Error(`${name}: exterior clipping stranded ${original.id}`);
      }
      return {
        id: idForFloor(original.id),
        label: `Assumed opening — ${from.shortLabel}`,
        spaceId, toSpaceId,
        confidence: 'estimated',
        note: `${name}: hypothetical repetition of the current 2. OG doorway, including its current adjacent spaces. No lower-floor doorway position, width, hinge or swing was supplied; the top-floor resident mark is not evidence for this floor.`,
        segment: structuredClone(original.segment),
      };
    });
    const serializedOutside = spaces.flatMap(space => difference(asPolygon(space), floor));
    const outsideArea = multiArea(serializedOutside), maximumSerializedOffset = maximumOffset(serializedOutside, boundary);
    if (outsideArea > 0.0001 || maximumSerializedOffset > 0.000002) {
      throw new Error(`${name}: serialized repeated spaces escape the source plate (${outsideArea}m² / ${maximumSerializedOffset}m)`);
    }
    for (let i = 0; i < spaces.length; i++) for (let j = i + 1; j < spaces.length; j++) {
      const overlap = multiArea(intersection(asPolygon(spaces[i]), asPolygon(spaces[j])));
      if (overlap > 0.000001) {
        throw new Error(`${name}: repeated ${spaces[i].shortLabel} and ${spaces[j].shortLabel} overlap (${overlap}m²)`);
      }
    }
    const assigned = union(...spaces.map(asPolygon));
    const unassigned = clean(difference(floor, assigned));
    metadata.push({
      index, extrapolatedFrom: 2,
      method: 'Resident-requested repetition of the current corrected 2. OG core. The former frozen sketch is superseded on this floor; every copied space and doorway remains estimated.',
      topGeometrySha256: topGeometryDigest,
      floorPlateSource: 'This lower floor retains its preceding complete LoD2 source section byte-for-byte, including its own holes and extensions.',
      floorOutlineSha256: digest(lower.floorOutline),
      sourceSectionAreaMetresSquared: multiArea(floor),
      studySpaces: spaces.length,
      candidateRoomReferences: spaces.filter(space => space.kind === 'room').length,
      estimatedOpenings: doors.length,
      copiedTopFloorExclusions: false,
      copiedSolidSketchBoundaries: false,
      copiedObservedWindows: false,
      copiedWallBands: false,
      exteriorTrims: trims,
      maximumExteriorTrimMetres: Math.max(...trims.map(trim => trim.maximumDistanceMetres)),
      exteriorTrimAreaMetresSquared: trims.reduce((sum, trim) => sum + trim.areaMetresSquared, 0),
      exteriorTrimMeaning: 'Only sub-millimetre source-edge differences are clipped. Shared interior geometry, the schematic flight and doorway segments repeat the current top-floor study.',
      spaceOutsideFloorMetresSquared: outsideArea,
      maximumSerializedExteriorOffsetMetres: maximumSerializedOffset,
      unassignedAreaMetresSquared: multiArea(unassigned),
      unassignedPolygons: unassigned.map(polygon => ({
        outer: rounded(polygon[0]), holes: polygon.slice(1).map(rounded),
      })),
      unassignedMeaning: 'Additional lower-floor wings and unused edge areas have no invented rooms, corridor routes, staircase connections or use classification.',
      noOccupancyClaim: 'Twenty repeated study references are not a complete or confirmed lower-floor room count, room-number inventory, measured layout or occupancy statement.',
    });
    return {
      index, label: `${name} — extrapolated study`, extrapolatedFrom: 2,
      source: 'Repeated from the current corrected House 55 2. OG study at the resident’s request; this lower floor has not been separately mapped.',
      notes: 'Rooms, stairs, landings, circulation and doorways repeat the current corrected 2. OG core as an unverified extrapolation. The L-block overlap and staircase alignment therefore no longer show the earlier sketch. The complete source floor plate is retained, and additional lower-floor wings remain unassigned. The 20 displayed study references are not a confirmed or complete count for this lower floor. Top-floor window observations and wall-material hypotheses have not been copied.',
      floorOutline, spaces, doors,
    };
  });
  return {levels, metadata};
}
