import {surfaceFrame} from './facade.js';
import {addWhiteBicycleDetails} from './white-house-bicycle-details.js';

/**
 * White / 57, registered to the resident's seven walk-around photographs.
 * Only the folded display is changed. LoD2, floor outlines, elevations, rooms,
 * layout windows and the historical opening inventory remain independent.
 */
export function addWhiteHousePhotoDetails({building, base, rows, highest, output, helpers}) {
  const {face, facePoint, faceMask, wall, quad, line, wire, mask, closed, atY,
    add, sub, mul, unit, dot, lerp} = helpers;
  const evidence = 'White House 57, seven resident photographs supplied 2026-11-16. Counts, blank spans and architectural relationships are observed; metric opening sizes, recess depths and fixture placements are visual estimates.';
  const floor = base + 0.025;

  function inside(point) {
    return building.groundPolygons.some(ring => {
      let result = false;
      for (let i = 1; i < ring.length; i++) {
        const a = ring[i - 1], b = ring[i];
        if ((a[1] > point[2]) !== (b[1] > point[2]) &&
          point[0] < (b[0] - a[0]) * (point[2] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
      }
      return result;
    });
  }
  // A building centroid is on the wrong side of several H-courtyard returns.
  // Resolve the inward direction against the retained footprint instead.
  function registeredFace(indices, start, end) {
    const target = face(indices, start, end);
    const center = lerp(target.start, target.end, 0.5);
    if (!inside(add(center, mul(target.inward, 0.08))) &&
      inside(add(center, mul(target.inward, -0.08)))) target.inward = mul(target.inward, -1);
    return target;
  }
  const south = registeredFace([40], [23.214, 0, 61.996], [38.331, 0, 48.061]);
  const southReturn = registeredFace([33], [38.331, 0, 48.061], [33.05, 0, 42.286]);
  const garden = registeredFace([4], [33.05, 0, 42.286], [41.242, 0, 34.766]);
  const gardenReturn = registeredFace([1], [41.242, 0, 34.766], [45.699, 0, 39.648]);
  const east = registeredFace([23], [51.923, 0, 34.085], [42.174, 0, 23.498]);
  const steppedReturn = registeredFace([21], [42.174, 0, 23.498], [49.016, 0, 17.212]);
  const serviceEnd = registeredFace([35], [43.27, 0, 10.935], [49.016, 0, 17.212]);
  const north = registeredFace([36], [23.837, 0, 28.834], [43.27, 0, 10.935]);
  const northReturn = registeredFace([10], [23.837, 0, 28.834], [27.258, 0, 32.557]);
  // This direction also makes the address read left-to-right from the court.
  const entry = registeredFace([14], [27.258, 0, 32.557], [25.233, 0, 34.423]);
  const entryUpper = face([32], [28.828, 0, 34.567], [26.952, 0, 36.29]);
  entryUpper.inward = [...entry.inward];
  const court = registeredFace([11], [27.103, 0, 36.454], [21.161, 0, 41.915]);
  const courtReturn = registeredFace([18], [21.161, 0, 41.915], [18.681, 0, 39.197]);
  const workshop = registeredFace([12], [18.548, 0, 39.323], [12.585, 0, 44.803]);

  // White identifies the frames, not the cladding. These overrides belong to
  // this house's exterior materials and never reach the unfolded floor groups.
  output.materialOverrides = {
    oldWindowFrame: {night: 0xd7dbd5, day: 0xe3e4dc},
    detailLightPanel: {night: 0xc3c9c1, day: 0xdedfd6},
    detailCladding: {night: 0x49302e, day: 0x714c47},
    roof: {night: 0x30312e, day: 0x595951},
    detailRoofTexture: {night: 0x50514a, day: 0x41443e},
    detailMetal: {night: 0x9ba59d, day: 0x939b94},
    detailCoolRecess: {night: 0x3e4946, day: 0x747e76},
    detailGlazing: {night: 0x2b4146, day: 0x738c8b},
  };
  output.photoCladding = output.materialOverrides.detailCladding;
  output.opaqueShell = true;

  function photoRows(target, entries, photos, note) {
    const surface = building.surfaces[target.indices[0]], frame = surfaceFrame(surface);
    const displayRows = entries.map(([floor, centers, appearance = {}]) => ({
      floor, centers: centers.map(center => frame.project(facePoint(target, center))[0]), ...appearance,
    }));
    output.layoutsBySurface.set(surface, {
      replace: true, replaceLocatedFloors: [0, 1, 2], recessDepth: 0.14, rows: displayRows, evidence,
    });
    output.features.push({
      id: `57-window-rows-${target.indices[0]}`, kind: 'photographic-window-rows',
      sourceSurfaceIndices: target.indices, photos,
      rows: entries.map(([floor, centers]) => ({floor, count: centers.length, centers: [...centers]})),
      evidence: `${evidence} ${note}`,
    });
  }
  const southColumns = [1.80, 4.90, 8.00, 11.10];
  photoRows(south, [[0, southColumns], [1, southColumns], [2, southColumns.slice(1)]], [1, 3],
    'Four lower columns and three upper columns; the low left roof step has no top opening. The adjoining three common-room bays are separate.');
  const gardenColumns = [1.35, 4.14, 6.93, 9.72];
  photoRows(garden, [0, 1, 2].map(floor => [floor, gardenColumns]), [2, 3],
    'Four vertically aligned columns across the garden court, including the partly tree-obscured third column.');
  photoRows(gardenReturn, [[0, [3.28]], [1, [3.28]], [2, []]], [2],
    'One opening on each lower row of the recessed return; the upper return remains blank.');
  const eastColumns = [1.38, 4.48, 7.58, 10.68, 13.38];
  photoRows(east, [[0, eastColumns], [1, eastColumns], [2, eastColumns.slice(1)]], [4],
    'Five lower columns and four upper columns. The foremost lower column sits beneath the lower roof step.');
  photoRows(steppedReturn, [[0, [1.38, 5.83]], [1, [1.38, 5.83]], [2, [1.38]]], [4],
    'Two lower columns and one upper opening, with a long blank span beneath the lowest roof step.');
  const northColumns = [10.25, 13.35, 16.45, 19.55, 22.65];
  photoRows(north, [[0, northColumns], [1, northColumns], [2, northColumns.slice(0, 4)]], [5, 6],
    'Five lower columns and four upper columns; the first 8.8 metres belong to the glazed common frontage, not a repeated room row.');
  const courtColumns = [1.42, 4.12, 6.82];
  photoRows(court, [0, 1, 2].map(floor => [floor, courtColumns]), [6, 7],
    'Three stacked columns beside the entrance. A fourth upper opening belongs to the separate wall above the canopy.');
  photoRows(courtReturn, [
    [0, [1.70]], [1, [1.70]],
    [2, [0.52], {width: 0.28, height: 1.10, sillOffset: 0.36}],
  ], [7], 'The two lower return openings align. Only a slender upper slot is visible; it is kept within the retained sloping return, with its size unresolved.');

  // These faces are solid in the photos or receive their own glazing below.
  // Unseen outer-west faces 31/34/42 retain their earlier opening patterns.
  const blankFaces = [0, 2, 3, 5, 8, 10, 12, 14, 15, 16, 17, 19, 20, 22, 25, 26, 27, 32, 33, 35, 37, 41];
  for (const index of blankFaces) {
    output.layoutsBySurface.set(building.surfaces[index], {
      replace: true, replaceLocatedFloors: [0, 1, 2], rows: [], evidence,
    });
  }
  output.features.push({
    id: '57-blank-end-walls', kind: 'photographed-blank-cladding',
    sourceSurfaceIndices: [5, 3, 16, 19, 22, 25, 27, 35, 37], photos: [2, 4, 5, 7],
    evidence: `${evidence} Broad end cladding and raised roof-step fascias have no repeated room windows. End wall35 has only the separately modelled service door.`,
  });
  output.photoSurfaceIndices = [...new Set([
    ...blankFaces, 1, 4, 11, 18, 21, 23, 36, 40,
  ])];

  // Rectangular white frames with a single horizontal transom, also used for
  // the one upper opening excluded by the generic grounded-wall algorithm.
  function framedOpening(target, left, right, bottom, top, {divisions = 1, panel = 0, depth = 0.12, cut = true, transom = 0.50} = {}) {
    if (cut) faceMask(target, left, right, bottom, top);
    const a = facePoint(target, left, depth), b = facePoint(target, right, depth);
    const fa = facePoint(target, left), fb = facePoint(target, right);
    if (cut) {
      wall('detailRecess', fa, a, bottom, top);
      wall('detailRecess', b, fb, bottom, top);
      quad('detailRecess', [atY(fa, top), atY(fb, top), atY(b, top), atY(a, top)]);
      quad('detailMetal', [atY(fa, bottom), atY(fb, bottom), atY(b, bottom), atY(a, bottom)]);
    }
    wall('detailGlazing', a, b, bottom, top);
    const panelTop = bottom + panel;
    if (panel) wall('detailLightPanel', facePoint(target, left, depth - 0.012),
      facePoint(target, right, depth - 0.012), bottom, panelTop);
    const transomY = panelTop + (top - panelTop) * transom;
    for (const y of [bottom + 0.034, ...(panel ? [panelTop] : []), transomY, top - 0.034]) {
      wall('oldWindowFrame', facePoint(target, left, depth - 0.025),
        facePoint(target, right, depth - 0.025), y - 0.034, y + 0.034);
    }
    for (let i = 0; i <= divisions; i++) {
      const x = left + (right - left) * i / divisions;
      wall('oldWindowFrame', facePoint(target, Math.max(left, x - 0.037), depth - 0.027),
        facePoint(target, Math.min(right, x + 0.037), depth - 0.027), bottom, top);
    }
  }
  framedOpening(entryUpper, 0.74, 1.79, rows[2] + 0.95, rows[2] + 2.50);
  output.features.push({
    id: '57-window-above-entrance', kind: 'photographic-window', floor: 2, count: 1,
    sourceSurfaceIndices: [32], photos: [6, 7],
    evidence: `${evidence} The fourth upper courtyard window is above the canopy; there is no matching middle or ground opening below it.`,
  });

  const glazingBottom = base + 0.23, glazingTop = base + 3.10;
  const southBays = [[12.48, 14.65, 3], [15.14, 17.31, 3], [17.80, 20.00, 3]];
  const southSideBays = [[0.30, 4.32, 4], [4.86, 7.49, 3]];
  const northBays = [[0.39, 2.83, 3], [3.38, 5.59, 2], [6.14, 8.38, 2]];
  const northSideBays = [[0.25, northReturn.span - 0.29, 4]];
  for (const [id, target, groups, photos] of [
    ['garden-front', south, southBays, [1, 3]],
    ['garden-return', southReturn, southSideBays, [2, 3]],
    ['entrance-front', north, northBays, [5, 6]],
    ['entrance-return', northReturn, northSideBays, [6, 7]],
  ]) {
    for (const [left, right, divisions] of groups) framedOpening(target, left, right, glazingBottom, glazingTop,
      {divisions, panel: 0.79, transom: 0.49});
    output.features.push({
      id: `57-${id}-glazing`, kind: 'shared-ground-glazing', floor: 0,
      sourceSurfaceIndices: target.indices, photos,
      groups: groups.map(([left, right, divisions]) => ({left, right, divisions})),
      evidence: `${evidence} Separate white-framed glazing groups, opaque lower panels and broad red-brown cladding piers wrap this corner. Glazing does not define an interior use or add a balcony.`,
    });
  }

  // The original small roof7 fixes the entrance, rather than a nearest-window
  // guess. Its front wall is opened and the single glazed leaf sits behind it.
  const entryLeft = 0.10, entryRight = entry.span - 0.10;
  const head = base + 2.62, depth = 1.76;
  faceMask(entry, entryLeft, entryRight, floor, head);
  const ea = facePoint(entry, entryLeft), eb = facePoint(entry, entryRight);
  const ec = facePoint(entry, entryRight, depth), ed = facePoint(entry, entryLeft, depth);
  quad('detailThreshold', [ea, eb, ec, ed].map(p => atY(p, floor)));
  quad('detailRecess', [ea, eb, ec, ed].map(p => atY(p, head)));
  wall('detailCladding', ea, ed, floor, head);
  wall('detailCladding', ec, eb, floor, head);
  wall('detailRecess', ed, ec, floor, head);
  const doorLeft = 1.03, doorRight = 2.30, doorBottom = floor + 0.018, doorTop = doorBottom + 2.38;
  wall('oldWindowFrame', facePoint(entry, doorLeft, depth - 0.018),
    facePoint(entry, doorRight, depth - 0.018), doorBottom, doorTop);
  for (const [lo, hi] of [[0.15, 0.80], [0.89, 1.55], [1.64, 2.26]]) {
    wall('detailGlazing', facePoint(entry, doorLeft + 0.30, depth - 0.031),
      facePoint(entry, doorRight - 0.09, depth - 0.031), doorBottom + lo, doorBottom + hi);
  }
  const handle = facePoint(entry, doorLeft + 0.15, depth - 0.065);
  line('detailMetal', atY(handle, doorBottom + 0.87), atY(handle, doorBottom + 1.34));
  wall('detailCoolLight', facePoint(entry, 0.66, depth - 0.034),
    facePoint(entry, 0.74, depth - 0.034), floor + 1.35, floor + 2.14);
  wall('oldWindowFrame', facePoint(entry, entryRight - 0.12, 0.045),
    facePoint(entry, entryRight - 0.015, 0.045), floor + 0.91, floor + 1.70);
  wall('detailMetal', facePoint(entry, entryRight - 0.108, 0.031),
    facePoint(entry, entryRight - 0.028, 0.031), floor + 1.05, floor + 1.23);
  output.features.push({
    id: '57-recessed-entrance', kind: 'recessed-entrance', floor: 0,
    sourceSurfaceIndices: [7, 8, 14, 32], photos: [6, 7],
    width: entryRight - entryLeft, depth, doorCount: 1, doorWidth: doorRight - doorLeft,
    evidence: `${evidence} One white three-pane door with a wide handle stile stands inside the existing canopy recess. A slim entry light, right-hand intercom and rainwater pipe are separate exterior fixtures.`,
  });
  output.signs ||= [];
  output.signs.push({
    id: '57-entrance-address', lines: ['Erwin-Rommel-Straße', '57'], width: 1.30, height: 0.56,
    corners: [
      atY(facePoint(entry, 0.23, -0.012), 5.35), atY(facePoint(entry, 1.53, -0.012), 5.35),
      atY(facePoint(entry, 1.53, -0.012), 5.91), atY(facePoint(entry, 0.23, -0.012), 5.91),
    ],
  });
  const canopy = building.surfaces[7];
  for (let i = 1; i < canopy.points.length; i++) {
    const a = canopy.points[i - 1], b = canopy.points[i];
    quad('detailMetal', [a, b, add(b, [0, -0.052, 0]), add(a, [0, -0.052, 0])]);
  }

  // Plain service leaf on the lowest end, distinct from the signed entrance.
  const serviceLeft = serviceEnd.span * 0.47 - 0.47, serviceRight = serviceLeft + 0.94;
  faceMask(serviceEnd, serviceLeft, serviceRight, floor, floor + 2.16);
  const serviceA = facePoint(serviceEnd, serviceLeft, 0.075), serviceB = facePoint(serviceEnd, serviceRight, 0.075);
  wall('detailLightPanel', serviceA, serviceB, floor, floor + 2.16);
  wire('oldWindowFrame', closed([atY(serviceA, floor), atY(serviceB, floor),
    atY(serviceB, floor + 2.16), atY(serviceA, floor + 2.16)]));
  const serviceHandle = facePoint(serviceEnd, serviceRight - 0.10, 0.045);
  line('detailMetal', atY(serviceHandle, floor + 1.04), atY(add(serviceHandle, mul(serviceEnd.u, -0.12)), floor + 1.04));
  output.features.push({
    id: '57-plain-service-door', kind: 'service-door', floor: 0, doorCount: 1,
    sourceSurfaceIndices: [35], photos: [5],
    evidence: `${evidence} The lowest otherwise blank end has a plain white service door, without an address canopy or a second residential entrance.`,
  });

  // Photo 7's gray foreground workshop/screen is kept on the existing low
  // court face. Its depth and ownership are unresolved; do not extend the
  // source footprint or turn it into an inferred interior room.
  const workshopTop = base + 3.35;
  faceMask(workshop, 0.035, workshop.span - 0.035, base + 0.015, workshopTop);
  wall('detailCoolRecess', facePoint(workshop, 0.035, 0.018),
    facePoint(workshop, workshop.span - 0.035, 0.018), base + 0.015, workshopTop);
  wall('detailMetal', facePoint(workshop, 0.035, 0.010),
    facePoint(workshop, workshop.span - 0.035, 0.010), workshopTop - 0.055, workshopTop);
  framedOpening(workshop, 0.75, 1.88, base + 1.91, base + 2.32,
    {depth: 0.001, cut: false, transom: 0.95});
  output.features.push({
    id: '57-courtyard-workshop-screen', kind: 'courtyard-service-frontage', floor: 0,
    sourceSurfaceIndices: [12], photos: [7], horizontalWindowCount: 1,
    evidence: `${evidence} The gray foreground face and single high horizontal opening are fitted to the existing court-side low wall. The photo does not establish a surveyed shed footprint or an internal room boundary.`,
  });

  function pipe(target, horizontal, top) {
    const center = facePoint(target, horizontal, 0.005), radius = 0.026;
    for (let i = 0; i < 8; i++) {
      const point = angle => add(center, add(mul(target.u, Math.cos(angle) * radius),
        mul(target.inward, Math.sin(angle) * radius)));
      wall('detailMetal', point(i * Math.PI / 4), point((i + 1) * Math.PI / 4), base + 0.10, top);
    }
    for (let y = base + 0.42; y < top - 0.10; y += 1.42) {
      line('detailMetal', atY(facePoint(target, horizontal - 0.058, 0.012), y),
        atY(facePoint(target, horizontal + 0.058, 0.012), y));
    }
  }
  pipe(entry, entry.span - 0.14, 5.64);
  pipe(north, 8.64, 6.02);
  pipe(south, 12.25, 6.07);
  pipe(gardenReturn, gardenReturn.span - 0.12, 8.37);
  pipe(serviceEnd, 0.13, 5.80);
  // Small utility cabinet mounted flat beside the entry pipe.
  wall('detailMetal', facePoint(entry, entry.span - 0.46, -0.010),
    facePoint(entry, entry.span - 0.06, -0.010), base + 0.30, base + 0.98);
  output.features.push({
    id: '57-rainwater-details', kind: 'rainwater-details',
    sourceSurfaceIndices: [1, 7, 14, 35, 36, 40], photos: [1, 2, 4, 5, 6, 7],
    evidence: `${evidence} Thin zinc-colored gutters, downpipes and clips follow the photographed eaves and entrance edge.`,
  });

  // The white-gray foundation line is continuous around grounded cladding,
  // with gaps at the two doors. It creates no platform or enlarged footprint.
  for (const [index, surface] of building.surfaces.entries()) {
    const frame = surfaceFrame(surface);
    if (!frame || Math.min(...surface.points.map(p => p[1])) > base + 0.01 || index === 14) continue;
    const ranges = index === 35 ? [[frame.minU, frame.project(facePoint(serviceEnd, serviceLeft))[0]],
      [frame.project(facePoint(serviceEnd, serviceRight))[0], frame.maxU]] : [[frame.minU, frame.maxU]];
    if (index === 35) {
      // The local frame may run opposite to the registered service-door face.
      const cut = [serviceLeft, serviceRight].map(u => frame.project(facePoint(serviceEnd, u))[0]).sort((a, b) => a - b);
      ranges.splice(0, ranges.length, [frame.minU, cut[0]], [cut[1], frame.maxU]);
    }
    for (const [left, right] of ranges) {
      if (right - left < 0.01) continue;
      const a = add(frame.lift([left, 0]), mul(frame.normal, 0.004));
      const b = add(frame.lift([right, 0]), mul(frame.normal, 0.004));
      wall('detailLightPanel', a, b, base + 0.01, base + 0.18);
    }
  }

  function roofFrame(index, lowA, lowB, highA, highB) {
    const surface = building.surfaces[index], points = surface.points.slice(0, -1);
    const normal = unit(points.reduce((sum, a, i) => {
      const b = points[(i + 1) % points.length];
      return add(sum, [(a[1] - b[1]) * (a[2] + b[2]),
        (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]);
    }, [0, 0, 0]));
    const across = unit([lowB[0] - lowA[0], 0, lowB[2] - lowA[2]]);
    const low = lerp(lowA, lowB, 0.5), high = lerp(highA, highB, 0.5);
    let slope = [-across[2], 0, across[0]];
    if (dot(sub(high, low), slope) < 0) slope = mul(slope, -1);
    const onRoof = point => [point[0], points[0][1] -
      (normal[0] * (point[0] - points[0][0]) + normal[2] * (point[2] - points[0][2])) / normal[1], point[2]];
    return {surface, across, slope, low, high, onRoof,
      run: Math.hypot(high[0] - low[0], high[2] - low[2])};
  }
  function dormer(index, lowA, lowB, highA, highB, photos) {
    const {surface, across, slope, low, high, onRoof, run} = roofFrame(index, lowA, lowB, highA, highB);
    const foot = lerp(low, high, 0.62), width = 2.78, depth = 1.56;
    const p = (u, v) => onRoof(add(foot, add(mul(across, u), mul(slope, v))));
    const feet = [p(-width / 2, 0), p(width / 2, 0), p(width / 2, depth), p(-width / 2, depth)];
    mask(surface, closed(feet));
    const capY = Math.max(feet[2][1], feet[3][1]) + 0.085;
    if (capY >= highest || capY >= Math.max(...surface.points.map(p => p[1]))) {
      throw new Error('White dormer must remain below its existing roof ridge');
    }
    const tops = feet.map(point => atY(point, capY));
    quad('detailCladding', [feet[0], feet[3], tops[3], tops[0]]);
    quad('detailCladding', [feet[2], feet[1], tops[1], tops[2]]);
    quad('detailCladding', [feet[0], feet[1], tops[1], tops[0]]);
    quad('detailMetal', tops);
    const front = {start: atY(feet[0], 0), u: across, inward: slope, indices: [index]};
    const bottom = Math.max(feet[0][1], feet[1][1]) + 0.14, top = capY - 0.15;
    // Roof dormers have three upright panes, with no central room transom.
    const a = facePoint(front, 0.12, -0.008), b = facePoint(front, width - 0.12, -0.008);
    wall('detailGlazing', a, b, bottom, top);
    for (const y of [bottom, top]) wall('oldWindowFrame', a, b, y - 0.033, y + 0.033);
    for (let i = 0; i <= 3; i++) {
      const u = 0.12 + (width - 0.24) * i / 3;
      wall('oldWindowFrame', facePoint(front, u - 0.032, -0.014),
        facePoint(front, u + 0.032, -0.014), bottom, top);
    }
    const ladderPoint = (u, v) => add(p(u - 0.64, v), [0, 0.05, 0]);
    for (let step = 0; step < 10; step++) {
      const v = -0.26 - step * 0.32;
      line('detailMetal', ladderPoint(-0.31, v), ladderPoint(0.31, v));
    }
    for (const u of [-0.29, 0.29]) line('detailMetal', ladderPoint(u, -0.24), ladderPoint(u, -3.16));
    // A low snow guard follows the eave; it is not a balcony railing.
    const guardA = lerp(lowA, lowB, 0.02), guardB = lerp(lowA, lowB, 0.98);
    const guard = (fraction, rise) => add(onRoof(add(lerp(guardA, guardB, fraction), mul(slope, 0.21))), [0, rise, 0]);
    line('detailMetal', guard(0, 0.18), guard(1, 0.18));
    line('detailMetal', guard(0, 0.035), guard(1, 0.035));
    const bars = Math.ceil(Math.hypot(...sub(lowA, lowB)) / 0.15);
    for (let i = 0; i <= bars; i++) line('detailMetal', guard(i / bars, 0.035), guard(i / bars, 0.18));
    wall('detailMetal', lerp(lowA, lowB, 0.005), lerp(lowA, lowB, 0.995),
      Math.min(lowA[1], lowB[1]) - 0.065, Math.min(lowA[1], lowB[1]) - 0.005);
    output.features.push({
      id: `57-upright-dormer-${index}`, kind: 'upright-roof-dormer',
      sourceSurfaceIndices: [index], photos, width, depth, divisions: 3, capY, run,
      frontGlazing: closed([atY(a, bottom), atY(b, bottom), atY(b, top), atY(a, top)]),
      evidence: `${evidence} Three upright panes under a thin metal cap, solid cheeks, maintenance rungs and a low eave snow guard occupy the retained roof slope. No floor or balcony is created.`,
    });
  }
  dormer(9, [32.089, 6.089, 53.814], [38.331, 6.117, 48.061],
    [26.825, 12.011, 48.047], [33.085, 12.011, 42.324], [1, 2, 3]);
  dormer(29, [23.837, 6.050, 28.834], [30.29, 6.046, 22.891],
    [29.455, 12.309, 35.252], [36.073, 12.313, 29.171], [5, 6]);

  // Tile courses are clipped to each retained sloping plane and dormer cutout.
  // They never bridge a roof step or continue through the dormer glazing.
  for (const index of [6, 9, 13, 24, 28, 29, 38]) {
    const surface = building.surfaces[index], points = surface.points.slice(0, -1);
    const sorted = [...points].sort((a, b) => a[1] - b[1]);
    const lowPoints = points.filter(p => p[1] < sorted[0][1] + 0.12);
    const highPoints = points.filter(p => p[1] > sorted.at(-1)[1] - 0.12);
    if (lowPoints.length < 2 || highPoints.length < 2) continue;
    const widestPair = points => points.flatMap((a, i) => points.slice(i + 1).map(b => [a, b]))
      .sort(([a, b], [c, d]) => Math.hypot(...sub(d, c)) - Math.hypot(...sub(b, a)))[0];
    const {across, slope, low, onRoof} = roofFrame(index, ...widestPair(lowPoints), ...widestPair(highPoints));
    const project = p => [dot(sub(p, low), across), dot(sub(p, low), slope)];
    const rings = [surface.points, ...(output.exclusionsBySurface.get(surface) || [])].map(ring => ring.map(project));
    const projected = points.map(project), lo = Math.min(...projected.map(p => p[1])), hi = Math.max(...projected.map(p => p[1]));
    const lift = (u, v) => add(onRoof(add(low, add(mul(across, u), mul(slope, v)))), [0, 0.006, 0]);
    for (let v = lo + 0.27; v < hi - 0.07; v += 0.27) {
      const crossings = rings.flatMap(ring => ring.slice(1).flatMap((b, i) => {
        const a = ring[i];
        return (a[1] > v) !== (b[1] > v) ? [a[0] + (b[0] - a[0]) * (v - a[1]) / (b[1] - a[1])] : [];
      })).sort((a, b) => a - b);
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        line('detailRoofTexture', lift(crossings[i] + 0.025, v), lift(crossings[i + 1] - 0.025, v));
      }
    }
  }
  output.features.push({
    id: '57-stepped-roofs-and-plinth', kind: 'exterior-surface-finish',
    sourceSurfaceIndices: [6, 9, 13, 24, 28, 29, 30, 38], photos: [1, 2, 3, 4, 5, 6, 7],
    evidence: `${evidence} Staggered cladding courses, pale foundation strips, dark tiled slopes and metal edge caps retain all existing roof steps and the complete source silhouette.`,
  });

  addWhiteBicycleDetails({base, output, helpers, court, north, south});
}
