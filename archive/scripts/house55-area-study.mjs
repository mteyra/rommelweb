import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {difference, intersection, union, setPrecision} from 'polyclip-ts';
import {
  local, campus, close, rounded, clean, asMulti, geometry, distance,
  onBoundary, polygonArea, nodeSharedRing, evidence,
} from './house55-window-wall-study.mjs';

const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);
const unit = a => a.map(v => v / Math.hypot(...a));
const sumArea = polygons => polygons.reduce((sum, p) => sum + polygonArea(p), 0);
const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
const centroid = ring => ring.slice(0, -1).reduce((out, p, _, points) => add(out, p, 1 / points.length), [0, 0]);
const plane = (a, b, inside) => {
  const tangent = unit(sub(b, a));
  let normal = [-tangent[1], tangent[0]], constant = dot(normal, a);
  if (dot(normal, inside) < constant) {
    normal = normal.map(v => -v);
    constant = -constant;
  }
  return {normal, constant, length: Math.hypot(...sub(b, a)), segment: [a, b]};
};
const clip = (ring, normal, constant) => {
  const points = ring.slice(0, -1), result = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const da = dot(normal, a) - constant, db = dot(normal, b) - constant;
    if (da >= -1e-10) result.push(a);
    if ((da >= 0) !== (db >= 0)) result.push(add(a, sub(b, a), da / (da - db)));
  }
  return result.length >= 3 ? close(result) : [];
};
const boundaryPlanes = ring => {
  const inside = centroid(ring);
  return ring.slice(1).flatMap((b, i) => Math.hypot(...sub(b, ring[i])) > 0.01 ? [plane(ring[i], b, inside)] : []);
};
const square = close([[-100, -100], [100, -100], [100, 100], [-100, 100]]);
const pruneZeroWidthSpurs = ring => {
  const points = ring.slice(0, -1).map(p => [...p]);
  for (let changed = true; changed && points.length >= 3;) {
    changed = false;
    for (let i = 0; i < points.length; i++) {
      const previous = points[(i + points.length - 1) % points.length], next = points[(i + 1) % points.length];
      if (Math.hypot(...sub(points[i], previous)) < 1e-8 || Math.hypot(...sub(previous, next)) < 1e-8) {
        points.splice(i, 1); changed = true; break;
      }
    }
  }
  const result = close(points);
  if (Math.abs(polygonArea([result]) - polygonArea([ring])) > 0.00001) throw new Error('Corridor serialization removed material floor area');
  return result;
};
const bankSpecs = [
  {key: 'A', labels: ['A', 'B', 'C', 'D'], facade: [23, 0], hallNormal: [0, 1], endAllowances: [0.30, 0.20], redistribute: true},
  {key: 'W', labels: ['W1', 'W2', 'W3', 'W4'], facade: [20, 21], hallNormal: [-1, 0], endAllowances: [0.30, 0.10], redistribute: true},
  {key: 'E', labels: ['E', 'F', 'G'], facade: [10, 9], hallNormal: [1, 0], endAllowances: [0.10, 0.30], redistribute: true},
  {key: 'N', labels: ['N1', 'N2', 'N3'], facade: [13, 12], hallNormal: [0, -1], endAllowances: [0.20, 0.30], redistribute: true},
  {key: 'L', labels: ['L1', 'L2', 'L3'], facade: [18, 17], hallNormal: [0, -1], endAllowances: [0.10, 0.10]},
  {key: 'R', labels: ['R1', 'R2', 'R3'], facade: [6, 7], hallNormal: [0, 1], endAllowances: [0.10, 0.10]},
];
const targetArea = 16.4;
const parameters = {
  targetInternalAreaSquareMetres: targetArea,
  publishedAreaSource: 'https://www.werkswelt.de/index.php?id=wohnanlage-campus-sud-i',
  publishedAverageDefinitionSource: 'https://werkswelt.de/data/uploads/wohnen/mietpreislisten/2026/erlangen/760-campus-sued-i-englisch-2026.pdf',
  targetInterpretation: 'Conditional internal-envelope benchmark, borrowed from the published 16.4m² average. It is not proof of the rental area, clear area or individual room dimensions.',
  externalFacadeAllowanceMetres: 0.20,
  markedEndWallAllowanceMetres: 0.30,
  otherExternalEndAllowanceMetres: 0.20,
  allocationBoundaryHalfWallMetres: 0.10,
  recessBandMetres: 0.20,
  minimumConnectorClearStudyGuardMetres: 1.20,
  guardInterpretation: 'Geometric study guard only, not a legal or accessibility-compliance claim.',
  internalPartitions: 'Bathroom, kitchenette and other internal partition footprints are unknown and are not deducted. The internal envelope is not certified usable floor area.',
};

/**
 * An explicitly conditional, area-led study. Source shell and resident
 * constraints are retained. R is capped at a connector guard rather than
 * forcing twenty rooms to reach an unverified area target.
 */
export async function applyHouse55AreaStudy(level, building) {
  const baselinePath = 'data/source/house55-2og-area-baseline.json';
  const bytes = await readFile(new URL(`../${baselinePath}`, import.meta.url));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const baseline = JSON.parse(bytes);
  if (sha256 !== '868a6f93a7cde1cd09909c3b6e5009cc862c3035e4828d9b8fb578fb0cee4de8'
      || JSON.stringify(level) !== JSON.stringify(baseline.level)) {
    throw new Error('Review the area-led study against its frozen resident-aligned baseline');
  }
  if (level.index !== 2 || level.spaces.filter(s => s.kind === 'room').length !== 20) {
    throw new Error('Area study requires the twenty confirmed top-floor room references');
  }
  const output = structuredClone(level);
  const images = {
    endWallHypothesis: await evidence('house55-2og-area-wall-marks.png', '03ad1ccd28fdfd585762f8e4743b5f09984df6382fa0f21c2a83c2d9d75c7ba6', 'codex-clipboard-C7HvUV.png'),
    exteriorDimensionRequest: await evidence('house55-exterior-dimension-request.png', '4b48c3bec6134e17a0624526b9d4669caee1447bf285e47d71b942334c83cef4', 'codex-clipboard-iAs8sS.png'),
  };
  const flat = building.surfaces[39].points.map(([x, , z]) => [x, z]);
  const source = flat.map(local);
  // Same numerical precision as the existing complete House 55 generator.
  // Make it explicit here so independent module callers get identical rings.
  setPrecision(1e-8);
  const plan = intersection([flat], output.floorOutline.map(p => [p.outer, ...(p.holes || [])]));
  const roomByLabel = new Map(level.spaces.filter(s => s.kind === 'room').map(s => [s.shortLabel, s]));
  const banks = bankSpecs.map(spec => {
    const originals = spec.labels.map(label => roomByLabel.get(label));
    const rings = originals.map(room => room.polygon.map(local));
    const facade = plane(...spec.facade.map(i => source[i]), centroid(rings[0]));
    const edges = rings.map(boundaryPlanes);
    const hallConstant = mean(edges.map(list => list.filter(e => dot(e.normal, spec.hallNormal) > 0.99)
      .sort((a, b) => b.length - a.length)[0].segment.reduce((sum, p) => sum + dot(p, spec.hallNormal) / 2, 0)));
    const dividers = originals.slice(1).map((_, i) => {
      const shared = edges[i].filter(e => e.segment.every(point =>
        edges[i + 1].some(other => other.segment.every(p => Math.abs(dot(e.normal, p) - e.constant) < 0.002))))
        .sort((a, b) => b.length - a.length)[0];
      if (!shared) throw new Error(`${spec.key}: cannot identify a shared room divider`);
      return shared;
    });
    const models = edges.map((list, i) => {
      const sides = list.filter(e => Math.abs(dot(e.normal, facade.normal)) < 0.20);
      if (sides.length !== 2) throw new Error(`${originals[i].shortLabel}: ambiguous fixed side boundaries`);
      return sides.map(edge => {
        const dividerIndex = dividers.findIndex(d => edge.segment.every(p => Math.abs(dot(d.normal, p) - d.constant) < 0.002));
        const direction = dividerIndex >= 0 ? Math.sign(dot(edge.normal, dividers[dividerIndex].normal)) : 1;
        const allowance = dividerIndex >= 0 ? 0.10 : i === 0 ? spec.endAllowances[0] : spec.endAllowances[1];
        return {edge, dividerIndex, direction, allowance};
      });
    });
    return {...spec, originals, rings, facade, hallConstant, dividers, models};
  });
  function candidate(bank, i, growth, shifts, internal = false) {
    let ring = square;
    const offsets = [];
    for (const side of bank.models[i]) {
      const {edge, dividerIndex, direction, allowance} = side;
      const shared = dividerIndex >= 0 ? bank.dividers[dividerIndex] : edge;
      const normal = dividerIndex >= 0 ? shared.normal.map(v => v * direction) : edge.normal;
      const constant = dividerIndex >= 0 ? (shared.constant + shifts[dividerIndex]) * direction : edge.constant;
      const amount = internal ? allowance : 0;
      offsets.push({kind: dividerIndex >= 0 ? 'shared-divider' : 'bank-end', normal, constant, allowance: internal ? amount : allowance});
      ring = clip(ring, normal, constant + amount);
      if (!ring.length) return {polygons: [], offsets};
    }
    // Overshoot by 1mm only where the entire facade is clipped back to
    // the source plate. R's existing 0.20m end extension passes beyond the
    // source corner into available floor: padding there would create a
    // visible extra corner instead of retaining its flush facade line.
    const facadeConstant = bank.facade.constant + (internal ? 0.20 : bank.key === 'R' ? 0 : -0.001);
    ring = clip(ring, bank.facade.normal, facadeConstant);
    if (!ring.length) return {polygons: [], offsets};
    ring = clip(ring, bank.hallNormal, bank.hallConstant - growth + (internal ? 0.10 : 0));
    if (!ring.length) return {polygons: [], offsets};
    offsets.push(
      {kind: 'external-facade', normal: bank.facade.normal, constant: bank.facade.constant, allowance: 0.20},
      {kind: 'hall-allocation', normal: bank.hallNormal, constant: bank.hallConstant - growth, allowance: 0.10},
    );
    // The inset envelope is convex and retains the fixed side/facade planes;
    // evaluate it directly during the solve. Validate it against the complete
    // source plate once at the final solution below.
    return {polygons: internal ? [[ring.map(campus)]] : clean(intersection(plan, [ring.map(campus)])), offsets};
  }
  const internalArea = (bank, i, growth, shifts) => sumArea(candidate(bank, i, growth, shifts, true).polygons);
  function dividerFit(bank, growth) {
    const shifts = bank.dividers.map(() => 0);
    if (!bank.redistribute) return shifts;
    // Keep all outer endpoints fixed. Small movements of shared estimated
    // dividers allocate the thicker end walls without jagged corridor fronts.
    for (let i = 0; i < shifts.length; i++) {
      let low = -8, high = 8;
      shifts[i] = low;
      const rising = (() => {
        const a = internalArea(bank, i, growth, shifts);
        shifts[i] = high;
        return internalArea(bank, i, growth, shifts) > a;
      })();
      for (let iteration = 0; iteration < 42; iteration++) {
        shifts[i] = (low + high) / 2;
        const below = internalArea(bank, i, growth, shifts) < targetArea;
        if (below === rising) low = shifts[i]; else high = shifts[i];
      }
      shifts[i] = (low + high) / 2;
    }
    return shifts;
  }
  function solve(bank) {
    let low = 0, high = 2.5;
    for (let iteration = 0; iteration < 42; iteration++) {
      const growth = (low + high) / 2, shifts = dividerFit(bank, growth);
      const measure = bank.redistribute
        ? internalArea(bank, bank.labels.length - 1, growth, shifts)
        : mean(bank.labels.map((_, i) => internalArea(bank, i, growth, shifts)));
      if (measure < targetArea) low = growth; else high = growth;
    }
    let growth = (low + high) / 2;
    const unconstrainedGrowth = growth;
    if (bank.key === 'R') {
      // Source northern recess is slightly skewed; use its southernmost
      // ordinate so the entire connector passes the declared study guard.
      const recessY = Math.max(source[15][1], source[16][1]);
      const minimumFrontY = recessY + parameters.recessBandMetres
        + parameters.minimumConnectorClearStudyGuardMetres + parameters.allocationBoundaryHalfWallMetres;
      growth = Math.min(growth, bank.hallConstant - minimumFrontY);
    }
    const shifts = dividerFit(bank, growth);
    if (shifts.some(shift => Math.abs(shift) > 0.20)) throw new Error(`${bank.key}: required divider shift exceeds the declared 0.20m study bound`);
    return {growth, shifts, unconstrainedGrowth};
  }
  const records = [], bankRecords = [];
  for (const bank of banks) {
    const fitted = solve(bank);
    bank.fitted = fitted;
    const areas = [];
    for (let i = 0; i < bank.labels.length; i++) {
      const {polygons} = candidate(bank, i, fitted.growth, fitted.shifts);
      const internal = candidate(bank, i, fitted.growth, fitted.shifts, true);
      if (polygons.length !== 1 || internal.polygons.length !== 1) throw new Error(`${bank.labels[i]}: area candidate is disconnected or empty`);
      if (sumArea(difference(internal.polygons, plan)) > 0.00001) throw new Error(`${bank.labels[i]}: conditional internal area leaves the source floor plate`);
      const room = output.spaces.find(s => s.id === bank.originals[i].id);
      delete room.holes;
      Object.assign(room, geometry(polygons[0]));
      const grossArea = polygonArea(asMulti(room)), netArea = sumArea(internal.polygons);
      const depth = mean(room.polygon.slice(0, -1).map(local).filter(p =>
        Math.abs(dot(bank.hallNormal, p) - bank.hallConstant + fitted.growth) < 0.002)
        .map(p => dot(bank.facade.normal, p) - bank.facade.constant));
      const residual = netArea - targetArea;
      room.confidence = 'estimated';
      room.note = bank.key === 'R'
        ? `Conditional area study: approximately ${netArea.toFixed(2)}m² inside the assumed perimeter allowances, ${Math.abs(residual).toFixed(2)}m² below the unverified 16.4m² benchmark. Its straight corridor wall stops at the 1.20m connector study guard. Three R rooms, their existing frontage and source shell are retained; the target is not forced. Internal service partitions and actual clear dimensions remain unknown.`
        : `Conditional area study: approximately ${netArea.toFixed(2)}m² inside assumed perimeter allowances, before unknown service-partition footprints. The published 16.4m² average is a study benchmark, not a verified individual apartment area. A straight corridor wall and source facade are retained; room dimensions and masonry remain estimates.`;
      const record = {
        label: room.shortLabel, bank: bank.key, grossArea, internalArea: netArea, targetArea,
        residual, grossDepth: depth, internalPolygon: geometry(internal.polygons[0]).polygon,
        edgeOffsets: internal.offsets, targetMet: Math.abs(residual) < 0.02,
        feasibility: bank.key === 'R' ? 'capped-at-connector-study-guard-target-unmet' : 'conditional-envelope-target-fit',
      };
      records.push(record); areas.push(netArea);
    }
    bankRecords.push({
      bank: bank.key, roomLabels: bank.labels, corridorWallGrowth: fitted.growth,
      unconstrainedTargetGrowth: fitted.unconstrainedGrowth, dividerShifts: fitted.shifts,
      corridorPlane: {normal: bank.hallNormal, constant: bank.hallConstant - fitted.growth},
      meanInternalArea: mean(areas), minimumInternalArea: Math.min(...areas), maximumInternalArea: Math.max(...areas),
      approach: bank.redistribute ? 'straight-front-with-small-shared-divider-adjustments' : 'fixed-dividers-straight-front',
    });
  }
  const occupied = output.spaces.filter(s => s.kind !== 'corridor');
  const vertices = occupied.flatMap(s => asMulti(s).flatMap(ring => ring.slice(0, -1)));
  // Node new L3/stair and room/hall contacts before the difference so both
  // sides serialize exactly the same vertices. This changes no stair edge.
  occupied.forEach(space => {
    const polys = asMulti(space).map(ring => nodeSharedRing(rounded(ring), vertices));
    Object.assign(space, geometry(polys));
  });
  for (let i = 0; i < occupied.length; i++) for (let j = i + 1; j < occupied.length; j++) {
    if (sumArea(intersection(asMulti(occupied[i]), asMulti(occupied[j]))) > 0.00001) {
      throw new Error(`Area candidate overlaps ${occupied[i].shortLabel} and ${occupied[j].shortLabel}`);
    }
  }
  const hallPolygons = clean(difference(plan, ...occupied.map(asMulti))).filter(p => polygonArea(p) > 1)
    .sort((a, b) => Math.min(...a[0].map(p => local(p)[0])) - Math.min(...b[0].map(p => local(p)[0])));
  if (hallPolygons.length !== 2) throw new Error('Area study must retain both existing hall regions without inventing an east stair entrance');
  const allVertices = occupied.flatMap(s => asMulti(s).flatMap(r => r.slice(0, -1)));
  output.spaces.filter(s => s.kind === 'corridor').forEach((hall, i) => {
    delete hall.holes;
    const noded = hallPolygons[i].map(r => pruneZeroWidthSpurs(nodeSharedRing(rounded(r), allVertices)));
    // A sub-micrometre source seam may close only after serialization,
    // leaving a hole touching the outer ring. Resolve that exact shared
    // boundary before validating the final simple corridor geometry.
    const resolved = clean(union(noded));
    if (resolved.length !== 1) throw new Error('Corridor quantization produced a disconnected region');
    Object.assign(hall, geometry(resolved[0].map(r => pruneZeroWidthSpurs(nodeSharedRing(rounded(r), allVertices)))));
    hall.note = 'Hall envelope recalculated around the conditional area study. Assumed boundary allowances and a 1.20m connector guard are geometric study inputs, not measurements or code-compliance findings. The east stairwell entrance remains unconfirmed.';
  });
  for (const door of output.doors) {
    const room = output.spaces.find(s => s.id === door.spaceId);
    if (room.kind === 'room') {
      const bank = banks.find(b => b.labels.includes(room.shortLabel));
      const q = bank.hallConstant - bank.fitted.growth;
      const edges = room.polygon.slice(1).map((b, i) => [room.polygon[i], b])
        .filter(edge => edge.every(p => Math.abs(dot(bank.hallNormal, local(p)) - q) < 0.002))
        .sort((a, b) => Math.hypot(...sub(...b)) - Math.hypot(...sub(...a)));
      if (!edges.length) throw new Error(`${room.shortLabel}: no corridor-facing doorway boundary`);
      const [a, b] = edges[0], center = add(a, b).map(v => v / 2), tangent = unit(sub(b, a));
      const width = Math.hypot(...sub(...door.segment));
      door.segment = rounded([add(center, tangent, -width / 2), add(center, tangent, width / 2)]);
      door.confidence = 'estimated';
      door.note = 'Illustrative opening recentered on the conditional area-study corridor wall. Door width, position, hinge and internal apartment plan remain unmeasured.';
    }
    const halls = output.spaces.filter(s => s.kind === 'corridor' && onBoundary(door.segment, s));
    if (halls.length !== 1 || !onBoundary(door.segment, room)) throw new Error(`Area study stranded doorway ${door.id}`);
    door.toSpaceId = halls[0].id;
  }
  for (const window of output.windows) {
    if (window.spaceId && !onBoundary(window.segment, output.spaces.find(s => s.id === window.spaceId))) {
      throw new Error(`Area study moved a confirmed window off its room: ${window.label}`);
    }
  }
  for (const [label, indexes] of [['W1', [19, 20]], ['A', [22, 23]], ['N3', [12, 11]], ['G', [8, 9]]]) {
    const room = output.spaces.find(s => s.shortLabel === label);
    const [a, b] = indexes.map(i => flat[i]), inside = centroid(room.polygon);
    const {normal} = plane(a, b, inside);
    const strip = close([a, b, add(b, normal, 0.30), add(a, normal, 0.30)]);
    const pieces = clean(intersection([strip], asMulti(room)));
    output.wallBands.push(...pieces.map((polygon, i) => ({
      id: `study-55-2-wall-band-area-end-${label.toLowerCase()}-${i + 1}`,
      label: `Thicker outer end wall — ${label}`, confidence: 'estimated',
      note: 'Resident-requested thickness hypothesis for this outside end wall. Its displayed 0.30m allowance is an explicit unmeasured study assumption, not a measured wall assembly.',
      ...geometry(polygon),
    })));
  }
  output.label = '2. OG — conditional area study';
  output.source = 'Resident-confirmed twenty-room arrangement, windows, W4/L1 overlap and 1/4 L3 : 3/4 R1 staircase; resident-requested thickness hypotheses for four outside end walls, 15 November 2026. Conditional area and wall allowances are explicitly estimated.';
  output.notes = 'The source shell and confirmed relative arrangement remain. Seventeen rooms approach a conditional 16.4m² internal-envelope benchmark through deeper envelopes and small estimated divider changes; unknown internal service partitions are not deducted. R1–R3 stop at a declared connector study guard and retain an explicit area shortfall. This is a falsifiable area study, not an as-built floor plan or verified usable-area calculation.';
  const rBank = banks.find(b => b.key === 'R'), rFront = rBank.hallConstant - rBank.fitted.growth;
  const recessY = Math.max(source[15][1], source[16][1]);
  return {level: output, metadata: {
    status: 'conditional-area-led-refit-with-explicit-r-deficit',
    baseline: {path: baselinePath, sha256, sourceCommit: baseline.sourceCommit}, images,
    parameters, rooms: records, banks: bankRecords,
    rConnector: {
      northRecessSourceVertexIndexes: [15, 16], maximumRecessY: recessY,
      roomFrontY: rFront, grossGap: rFront - recessY,
      assumedClearGap: rFront - recessY - parameters.recessBandMetres - parameters.allocationBoundaryHalfWallMetres,
      unconstrainedAssumedClearGap: rBank.hallConstant - rBank.fitted.unconstrainedGrowth - recessY
        - parameters.recessBandMetres - parameters.allocationBoundaryHalfWallMetres,
      studyGuard: parameters.minimumConnectorClearStudyGuardMetres,
      targetForced: false,
    },
    preserved: {sourceExterior: true, floorOutline: true, roomCount: 20, windowObservations: 24, windowSegments: true,
      lBlockFrontageAndOverlap: true, staircaseRatioAndEnclosure: true, existingDoorGraph: true},
    limitations: 'Area and masonry inputs remain unverified. Existing service partitions are unknown. The R target does not fit under these fixed-frontage/connector assumptions; more depth cannot resolve its separate clear-width concern. Gross model envelopes, conditional internal envelopes and rental/usable floor area must not be conflated.',
  }};
}
