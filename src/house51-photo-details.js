/**
 * Yellow House 51: the three resident photographs of its entrance and rear.
 * All positions below are replaceable exterior appearance estimates. Nothing
 * here changes a source surface, a floor elevation or an interior layout.
 */
export function addHouse51PhotoDetails({building, base, output, helpers}) {
  const {face, facePoint, faceMask, wall, quad, line, wire, mask, closed, atY, add, sub, mul, unit, dot, lerp, photographicRows} = helpers;
  const front = face([4], [-52.826, 0, 7.344], [-36.647, 0, -7.522]);
  const rear = face([22], [-34.712, 0, -41.999], [-53.008, 0, -25.209]);
  const entrance = face([36], [-38.443, 0, -12.312], [-40.517, 0, -14.579]);
  const glazingReturn = face([6], [-36.647, 0, -7.522], [-39.845, 0, -11.02]);
  // A centroid cannot determine the inside of this concave return: the common
  // volume is on the long wing side of wall6, and behind canopy20 at the entry.
  glazingReturn.inward = mul(front.u, -1);
  entrance.inward = mul(front.u, -1);

  function observedRows(index, target, distances) {
    photographicRows(index, target.start, target.end, Object.fromEntries(
      Object.entries(distances).map(([floor, centers]) => [floor, centers.map(value => value / target.span)])));
    const feature = output.features.at(-1);
    feature.evidence = 'Resident Yellow photographs identify these visible aligned columns. Centers are estimated along the retained source face; photographs do not measure window offsets or define room divisions.';
  }
  // Photo3: four upper columns and an additional low column under the step.
  const frontColumns = [1.30, 4.35, 7.20, 10.60, 13.35];
  observedRows(4, front, {0: frontColumns, 1: frontColumns, 2: frontColumns.slice(1)});
  // Photo1: a longer rear wing, with five upper and six lower columns.
  const rearColumns = [1.70, 4.90, 8.10, 11.30, 14.50, 17.10];
  observedRows(22, rear, {0: rearColumns, 1: rearColumns, 2: rearColumns.slice(1)});
  // Photo2 resolves the upper and ground row beside the entrance. The middle
  // row is obscured by the bicycle shelter; retain its existing study.
  const entryBank = face([25], [-40.517, 0, -14.579], [-34.79, 0, -19.845]);
  observedRows(25, entryBank, {
    0: [0.28, 0.58, 0.88].map(value => value * entryBank.span),
    2: [0.09, 0.28, 0.58, 0.88].map(value => value * entryBank.span),
  });

  const bottom = base + 0.20, top = 5.79;
  function glazingBay(target, left, right, divisions = 2) {
    faceMask(target, left, right, bottom, top);
    const a = facePoint(target, left, 0.115), b = facePoint(target, right, 0.115);
    const outerA = facePoint(target, left), outerB = facePoint(target, right);
    const panelTop = bottom + 0.80, transom = panelTop + (top - panelTop) * 0.50;
    wall('detailRecess', outerA, a, bottom, top);
    wall('detailRecess', b, outerB, bottom, top);
    quad('detailRecess', [atY(outerA, top), atY(outerB, top), atY(b, top), atY(a, top)]);
    quad('detailMetal', [atY(outerA, bottom), atY(outerB, bottom), atY(b, bottom + 0.04), atY(a, bottom + 0.04)]);
    wall('detailLightPanel', a, b, bottom, panelTop);
    wall('detailGlazing', a, b, panelTop, top);
    for (const y of [bottom + 0.035, panelTop, transom, top - 0.035]) {
      wall('oldWindowFrame', facePoint(target, left, 0.090), facePoint(target, right, 0.090), y - 0.035, y + 0.035);
    }
    for (let i = 0; i <= divisions; i++) {
      const x = left + (right - left) * i / divisions;
      wall('oldWindowFrame', facePoint(target, Math.max(left, x - 0.038), 0.085),
        facePoint(target, Math.min(right, x + 0.038), 0.085), bottom, top);
    }
  }
  // Opaque brown piers remain between these independently cut glazing groups.
  const frontStart = Math.hypot(-42.166 - front.start[0], -2.452 - front.start[2]);
  const frontGroups = [[frontStart + 0.25, frontStart + 2.24], [frontStart + 2.70, frontStart + 4.69],
    [frontStart + 5.15, front.span - 0.26]];
  for (const [left, right] of frontGroups) glazingBay(front, left, right);
  const returnGroups = [[0.30, 1.55], [2.28, 3.50]];
  for (const [left, right] of returnGroups) glazingBay(glazingReturn, left, right, 1);
  const rearStart = Math.hypot(-48.028 - rear.start[0], -29.78 - rear.start[2]);
  const rearGroups = [[rearStart + 0.20, rearStart + 2.04], [rearStart + 2.40, rearStart + 4.24],
    [rearStart + 4.60, rear.span - 0.20]];
  for (const [left, right] of rearGroups) glazingBay(rear, left, right);
  output.features.push({
    id: '51-entrance-common-glazing', kind: 'shared-ground-glazing', floor: 0,
    sourceSurfaceIndices: [4], groups: frontGroups.map(([left, right]) => ({left, right, divisions: 2})),
    evidence: 'Entrance photographs show three yellow two-leaf glazing groups, white lower panels and brown piers beneath source roof12. Extents and frame dimensions are visual estimates.',
  }, {
    id: '51-entrance-glazing-return', kind: 'shared-ground-glazing', floor: 0,
    sourceSurfaceIndices: [6], groups: returnGroups.map(([left, right]) => ({left, right, divisions: 1})),
    evidence: 'The entrance photograph shows separate tall glazing on the common-volume return toward the recessed doorway. Dimensions remain estimated; no interior opening or room is created.',
  }, {
    id: '51-rear-common-glazing', kind: 'shared-ground-glazing', floor: 0,
    sourceSurfaceIndices: [22], groups: rearGroups.map(([left, right]) => ({left, right, divisions: 2})),
    evidence: 'The rear photograph shows yellow divided communal glazing below source roof39. Three visible groups are represented with approximate extents; vegetation and foreground hardware obscure some lower panels.',
  });

  const floor = base + 0.025, head = base + 2.76, depth = 1.16;
  const left = 0.16, right = entrance.span - 0.17;
  faceMask(entrance, left, right, floor, head);
  const a = facePoint(entrance, left), b = facePoint(entrance, right);
  const c = facePoint(entrance, right, depth), d = facePoint(entrance, left, depth);
  quad('detailThreshold', [a, b, c, d].map(point => atY(point, floor)));
  quad('detailRecess', [a, b, c, d].map(point => atY(point, head)));
  wall('plates', a, d, floor, head);
  wall('plates', c, b, floor, head);
  wall('detailRecess', d, c, floor, head);
  const doorLeft = 0.43, doorRight = 1.64, doorBottom = floor + 0.025, doorTop = floor + 2.41;
  wall('oldWindowFrame', facePoint(entrance, doorLeft, depth - 0.02), facePoint(entrance, doorRight, depth - 0.02), doorBottom, doorTop);
  for (const [lo, hi] of [[0.13, 0.79], [0.88, 1.54], [1.63, 2.25]]) {
    wall('detailGlazing', facePoint(entrance, doorLeft + 0.09, depth - 0.035),
      facePoint(entrance, doorRight - 0.20, depth - 0.035), doorBottom + lo, doorBottom + hi);
  }
  const handle = facePoint(entrance, doorRight - 0.11, depth - 0.08);
  line('detailMetal', atY(handle, doorBottom + 0.83), atY(handle, doorBottom + 1.29));
  wall('detailMetal', facePoint(entrance, right - 0.27, 0.06),
    facePoint(entrance, right - 0.10, 0.06), floor + 1.03, floor + 1.60);
  for (const [p, q] of building.surfaces[20].points.slice(1).map((p, i) => [building.surfaces[20].points[i], p])) {
    quad('detailMetal', [p, q, add(q, [0, -0.065, 0]), add(p, [0, -0.065, 0])]);
  }
  output.features.push({
    id: '51-recessed-entrance', kind: 'recessed-entrance', floor: 0, sourceSurfaceIndices: [36, 20],
    doorCount: 1, depth, width: right - left, doorWidth: doorRight - doorLeft, doorHeight: doorTop - doorBottom,
    evidence: 'The resident identifies this entrance; the existing canopy20 locates it beside the glazed common volume. One yellow glazed leaf, dark recess and metal trim are visible; door and recess dimensions are estimated.',
  });
  const signLeft = 0.18, signRight = 1.48, signBottom = head + 0.10, signTop = 5.52;
  output.signs ||= [];
  output.signs.push({
    id: '51-entrance-address', lines: ['Erwin-Rommel-Straße', '51'],
    width: signRight - signLeft, height: signTop - signBottom,
    corners: [atY(facePoint(entrance, signLeft, -0.012), signBottom), atY(facePoint(entrance, signRight, -0.012), signBottom),
      atY(facePoint(entrance, signRight, -0.012), signTop), atY(facePoint(entrance, signLeft, -0.012), signTop)],
  });

  function pipe(target, horizontal, yTop) {
    const center = facePoint(target, horizontal, 0.003), radius = 0.028;
    const point = angle => add(center, add(mul(target.u, Math.cos(angle) * radius), mul(target.inward, Math.sin(angle) * radius)));
    for (let i = 0; i < 8; i++) wall('detailMetal', point(i * Math.PI / 4), point((i + 1) * Math.PI / 4), floor + 0.10, yTop);
    for (const y of [floor + 0.55, yTop - 0.55]) {
      line('detailMetal', atY(facePoint(target, horizontal - 0.06, 0.012), y), atY(facePoint(target, horizontal + 0.06, 0.012), y));
    }
  }
  pipe(front, frontStart + 0.08, 6.035);
  pipe(entrance, 0.10, 5.57);
  pipe(rear, 0.08, 8.46);
  for (const [target, start] of [[front, frontStart], [rear, rearStart]]) {
    wall('detailMetal', facePoint(target, start + 0.02, -0.012), facePoint(target, target.span - 0.02, -0.012), 5.99, 6.065);
  }
  output.features.push({
    id: '51-photographed-rainwater', kind: 'rainwater-details', sourceSurfaceIndices: [4, 22, 36, 20],
    evidence: 'Thin gutters and downpipes follow edges visible in the entrance and rear photographs. Diameters and attachment offsets are illustrative; source eaves remain unchanged.',
  });

  function roofPlane(index) {
    const roof = building.surfaces[index], points = roof.points.slice(0, -1);
    const normal = unit(points.reduce((n, p, i) => {
      const q = points[(i + 1) % points.length];
      return add(n, [(p[1] - q[1]) * (p[2] + q[2]), (p[2] - q[2]) * (p[0] + q[0]), (p[0] - q[0]) * (p[1] + q[1])]);
    }, [0, 0, 0]));
    const origin = points[0];
    return {roof, onRoof: (x, z) => [x, origin[1] - (normal[0] * (x - origin[0]) + normal[2] * (z - origin[2])) / normal[1], z]};
  }
  const {roof, onRoof} = roofPlane(12);
  const low = [-39.4065, 6.047, -4.987], high = [-45.148, 12.711, -11.4625];
  const slope = front.inward, across = front.u;
  const run = dot(sub(high, low), slope), foot = add(low, mul(slope, run * 0.62));
  const width = 2.46, dormerDepth = 1.64;
  const planPoint = (u, v) => {
    const p = add(foot, add(mul(across, u), mul(slope, v)));
    return onRoof(p[0], p[2]);
  };
  const feet = [planPoint(-width / 2, 0), planPoint(width / 2, 0), planPoint(width / 2, dormerDepth), planPoint(-width / 2, dormerDepth)];
  mask(roof, closed(feet));
  const capY = Math.max(feet[2][1], feet[3][1]) + 0.09, tops = feet.map(p => atY(p, capY));
  quad('plates', [feet[0], feet[3], tops[3], tops[0]]);
  quad('plates', [feet[2], feet[1], tops[1], tops[2]]);
  quad('plates', [feet[0], feet[1], tops[1], tops[0]]);
  quad('detailMetal', tops);
  const glassBottom = Math.max(feet[0][1], feet[1][1]) + 0.13, glassTop = capY - 0.21;
  const glassA = add(lerp(feet[0], feet[1], 0.09), mul(slope, -0.012));
  const glassB = add(lerp(feet[0], feet[1], 0.91), mul(slope, -0.012));
  wall('detailGlazing', glassA, glassB, glassBottom, glassTop);
  const glazing = closed([atY(glassA, glassBottom), atY(glassB, glassBottom), atY(glassB, glassTop), atY(glassA, glassTop)]);
  wire('oldWindowFrame', glazing);
  for (let i = 0; i <= 3; i++) {
    const t = i / 3, halfWidth = 0.014;
    wall('oldWindowFrame', lerp(glassA, glassB, Math.max(0, t - halfWidth)), lerp(glassA, glassB, Math.min(1, t + halfWidth)), glassBottom, glassTop);
  }
  for (const y of [glassBottom, glassTop]) {
    wall('oldWindowFrame', glassA, glassB, y - 0.028, y + 0.028);
  }
  const ladderPoint = (u, v) => {
    const p = add(foot, add(mul(across, u - 0.18), mul(slope, v)));
    return add(onRoof(p[0], p[2]), [0, 0.055, 0]);
  };
  for (let i = 0; i < 14; i++) {
    const d = -0.24 - i * 0.34;
    const a = ladderPoint(-0.34, d), b = ladderPoint(0.34, d);
    quad('detailMetal', [a, b, add(b, mul(slope, 0.08)), add(a, mul(slope, 0.08))]);
  }
  for (const u of [-0.30, 0.30]) line('detailMetal', ladderPoint(u, -0.20), ladderPoint(u, -4.69));
  output.features.push({
    id: '51-entrance-roof-dormer', kind: 'upright-roof-dormer', sourceSurfaceIndices: [12], width, depth: dormerDepth,
    divisions: 3, capY, frontGlazing: glazing,
    evidence: 'Entrance photographs show one upright three-part yellow dormer and a maintenance ladder on roof12. The added shell is below the retained ridge and intersects the existing slope; dimensions are approximate, with no interior change.',
  });

  // Scan the exact roof footprint for each course: this keeps texture off the
  // canopy notch and avoids filling the dormer with lines.
  function tileCourses(index, center, along, crossAxis, dormer = null) {
    const {roof, onRoof} = roofPlane(index);
    const project = p => [dot(sub(p, center), along), dot(sub(p, center), crossAxis)];
    const local = roof.points.map(project);
    const ground = building.groundPolygons.map(ring => ring.map(([x, z]) => project([x, 0, z])));
    const intervalsAt = (ring, d) => {
      const intersections = [];
      for (let i = 1; i < ring.length; i++) {
        const a = ring[i - 1], b = ring[i];
        if ((a[0] > d) !== (b[0] > d)) intersections.push(a[1] + (b[1] - a[1]) * (d - a[0]) / (b[0] - a[0]));
      }
      intersections.sort((a, b) => a - b);
      return Array.from({length: Math.floor(intersections.length / 2)}, (_, i) => [intersections[i * 2], intersections[i * 2 + 1]]);
    };
    const min = Math.min(...local.map(p => p[0])), max = Math.max(...local.map(p => p[0]));
    for (let d = min + 0.22; d < max - 0.03; d += 0.29) {
      const groundIntervals = ground.flatMap(ring => intervalsAt(ring, d));
      for (const [left, right] of intervalsAt(local, d)) {
        let intervals = groundIntervals.map(([a, b]) => [Math.max(left, a) + 0.025, Math.min(right, b) - 0.025])
          .filter(([a, b]) => b > a);
        if (dormer && d >= dormer.start - 0.03 && d <= dormer.end + 0.03) {
          intervals = intervals.flatMap(([a, b]) => [[a, Math.min(b, -width / 2 - 0.03)], [Math.max(a, width / 2 + 0.03), b]]);
        }
        for (const [a, b] of intervals) if (b - a > 0.03) {
          const lift = v => {
            const p = add(center, add(mul(along, d), mul(crossAxis, v)));
            return add(onRoof(p[0], p[2]), [0, 0.010, 0]);
          };
          line('detailRoofTexture', lift(a), lift(b));
        }
      }
    }
  }
  tileCourses(12, low, slope, across, {start: run * 0.62, end: run * 0.62 + dormerDepth});
  const rearLow = [-50.518, 6.05, -27.4945];
  tileCourses(39, rearLow, rear.inward, rear.u);
  output.features.push({
    id: '51-photographed-roof-courses', kind: 'roof-courses', sourceSurfaceIndices: [12, 39],
    evidence: 'The two photographed broad slopes have small horizontal roof courses. Course pitch is procedural, clipped to source roofs; no unseen roof feature is inferred.',
  });
}
