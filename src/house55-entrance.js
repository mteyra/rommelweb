/**
 * House 55's photographed courtyard entrance, expressed only as folded
 * exterior presentation. The existing roof18 and wall15 locate the doorway;
 * no dimensions or routes are written into a floor plan.
 */
export function addHouse55Entrance({building, base, output, helpers}) {
  const {face, facePoint, faceMask, wall, quad, line, wire, mask, closed, atY, add, sub, mul, unit, dot, lerp} = helpers;
  const front = face([4], [-11.109, 0, 13.826], [-5.295, 0, 20.183]);
  const returnFace = face([45], [-5.295, 0, 20.183], [-1.531, 0, 16.724]);
  const entry = face([15], [-1.531, 0, 16.724], [0.3, 0, 18.744]);
  const bottom = base + 0.16, top = 5.79;

  function glazingBay(target, left, right, divisions) {
    faceMask(target, left, right, bottom, top);
    const a = facePoint(target, left, 0.10), b = facePoint(target, right, 0.10);
    const fa = facePoint(target, left), fb = facePoint(target, right);
    const panelTop = bottom + 0.78, transom = panelTop + (top - panelTop) * 0.47;
    wall('detailRecess', fa, a, bottom, top);
    wall('detailRecess', b, fb, bottom, top);
    quad('detailRecess', [atY(fa, top), atY(fb, top), atY(b, top), atY(a, top)]);
    wall('oldWindowFrame', a, b, bottom, panelTop);
    wall('detailGlazing', a, b, panelTop, top);
    for (const y of [bottom + 0.03, panelTop, transom, top - 0.03]) {
      wall('oldWindowFrame', add(a, mul(target.inward, -0.012)), add(b, mul(target.inward, -0.012)), y - 0.03, y + 0.03);
    }
    for (let i = 0; i <= divisions; i++) {
      const x = left + (right - left) * i / divisions;
      const l = Math.max(left, x - 0.035), r = Math.min(right, x + 0.035);
      wall('oldWindowFrame', facePoint(target, l, 0.085), facePoint(target, r, 0.085), bottom, top);
    }
    line('detailMetal', atY(fa, bottom - 0.025), atY(fb, bottom - 0.025));
  }

  // Three observed groups; the spaces between these masks remain the original
  // opaque cladding piers rather than becoming thin red window mullions.
  const bays = [[0.33, 2.00, 2], [2.55, 4.78, 2], [5.34, front.span - 0.25, 3]];
  for (const [left, right, divisions] of bays) glazingBay(front, left, right, divisions);
  glazingBay(returnFace, 0.20, returnFace.span - 0.40, 3);
  output.features.push({
    id: '55-courtyard-entry-glazing', kind: 'shared-ground-glazing', floor: 0,
    sourceSurfaceIndices: [4], groups: bays.map(([left, right, divisions]) => ({left, right, divisions})),
    evidence: 'Resident entrance photograph shows three separate red glazing groups, brown piers, lower opaque panels and horizontal transoms. Opening extents are visual estimates inside the fixed low wall.',
  }, {
    id: '55-courtyard-glazing-return', kind: 'shared-ground-glazing', floor: 0,
    sourceSurfaceIndices: [45], divisions: 3,
    evidence: 'Glazing continues around the courtyard corner toward the separate recessed entrance. Extent, frame sizes and subdivisions remain unmeasured.',
  });

  const openingLeft = 0.13, openingRight = entry.span - 0.13;
  const floor = base + 0.02, head = base + 2.60, depth = 1.82;
  faceMask(entry, openingLeft, openingRight, floor, head);
  const a = facePoint(entry, openingLeft), b = facePoint(entry, openingRight);
  const c = facePoint(entry, openingRight, depth), d = facePoint(entry, openingLeft, depth);
  quad('detailThreshold', [a, b, c, d].map(point => atY(point, floor)));
  quad('detailRecess', [a, b, c, d].map(point => atY(point, head)));
  wall('detailCladding', a, d, floor, head);
  wall('detailCladding', c, b, floor, head);
  wall('detailRecess', d, c, floor, head);
  const doorLeft = 0.96, doorRight = 2.14, doorBottom = floor + 0.015, doorTop = doorBottom + 2.37;
  const doorA = facePoint(entry, doorLeft, depth - 0.018), doorB = facePoint(entry, doorRight, depth - 0.018);
  wall('oldWindowFrame', doorA, doorB, doorBottom, doorTop);
  // One leaf with the photographed wide handle stile and three stacked panes.
  for (const [lo, hi] of [[0.14, 0.80], [0.90, 1.54], [1.64, 2.22]]) {
    wall('detailGlazing', facePoint(entry, doorLeft + 0.34, depth - 0.030),
      facePoint(entry, doorRight - 0.09, depth - 0.030), doorBottom + lo, doorBottom + hi);
  }
  wire('oldWindowFrame', closed([atY(doorA, doorBottom), atY(doorB, doorBottom), atY(doorB, doorTop), atY(doorA, doorTop)]));
  const handle = facePoint(entry, doorLeft + 0.16, depth - 0.070);
  line('detailMetal', atY(handle, doorBottom + 0.84), atY(handle, doorBottom + 1.32));
  for (const y of [0.88, 1.28]) line('detailMetal', atY(handle, doorBottom + y),
    atY(add(handle, mul(entry.inward, 0.035)), doorBottom + y));
  // Small intercom mounted beside the recess, as visible in the close photo.
  wall('oldWindowFrame', facePoint(entry, openingRight - 0.10, 0.06),
    facePoint(entry, openingRight + 0.02, 0.06), floor + 0.92, floor + 1.70);
  wall('detailMetal', facePoint(entry, openingRight - 0.09, 0.04),
    facePoint(entry, openingRight + 0.01, 0.04), floor + 0.99, floor + 1.15);

  // Dress the existing canopy plane; the source roof itself is not moved.
  const canopy = building.surfaces[18];
  for (let i = 1; i < canopy.points.length; i++) {
    const p = canopy.points[i - 1], q = canopy.points[i];
    quad('detailMetal', [p, q, add(q, [0, -0.075, 0]), add(p, [0, -0.075, 0])]);
  }
  output.features.push({
    id: '55-recessed-entrance', kind: 'recessed-entrance', floor: 0,
    sourceSurfaceIndices: [15, 18, 26, 45], width: openingRight - openingLeft, depth,
    doorCount: 1, doorWidth: doorRight - doorLeft, doorHeight: doorTop - doorBottom,
    evidence: 'The unique existing canopy18 and its narrow recess locate the photographed entrance beside the low glazed block. One red three-pane door, dark soffit and metal canopy trim are visual refinements; recess and door dimensions are estimates.',
  });

  // A local sign, attached to the existing fascia and hidden with the exterior.
  const signLeft = 0.24, signRight = 1.55, signBottom = head + 0.09, signTop = head + 0.69;
  output.signs ||= [];
  output.signs.push({
    id: '55-entrance-address', lines: ['Erwin-Rommel-Straße', '55'], width: signRight - signLeft, height: signTop - signBottom,
    corners: [
      atY(facePoint(entry, signLeft, -0.012), signBottom),
      atY(facePoint(entry, signRight, -0.012), signBottom),
      atY(facePoint(entry, signRight, -0.012), signTop),
      atY(facePoint(entry, signLeft, -0.012), signTop),
    ],
  });

  function pipe(target, horizontal, yTop) {
    // Half-round metal against the wall; the shallow exposed half remains
    // within the same small surface allowance as the existing sill details.
    const center = facePoint(target, horizontal, 0.003), radius = 0.028, sides = 8;
    for (let i = 0; i < sides; i++) {
      const point = angle => add(center, add(mul(target.u, Math.cos(angle) * radius), mul(target.inward, Math.sin(angle) * radius)));
      wall('detailMetal', point(i * Math.PI * 2 / sides), point((i + 1) * Math.PI * 2 / sides), floor + 0.10, yTop);
    }
    for (const y of [floor + 0.42, yTop - 0.42]) {
      line('detailMetal', atY(facePoint(target, horizontal - 0.07, 0.02), y),
        atY(facePoint(target, horizontal + 0.07, 0.02), y));
    }
  }
  pipe(entry, entry.span - 0.15, 5.86);
  pipe(front, 0.12, 6.01);
  const gutterA = facePoint(front, 0.03, -0.014), gutterB = facePoint(front, front.span - 0.02, -0.014);
  wall('detailMetal', gutterA, gutterB, 5.97, 6.05);
  output.features.push({
    id: '55-courtyard-rainwater', kind: 'rainwater-details', sourceSurfaceIndices: [4, 15, 18],
    evidence: 'Entrance and shared-frontage gutters/downpipes are visible in the resident photos. Thin attached geometry follows the existing edges; pipe diameter and mounting offsets are approximate.',
  });

  // The new entrance photo resolves an upright three-part dormer in roof3.
  // Its feet intersect the existing slope and its cap remains below the ridge.
  const roof = building.surfaces[3];
  const low = [-8.202, 6.049, 17.0045], high = [-1.9115, 12.311, 11.324];
  const slope = unit([high[0] - low[0], 0, high[2] - low[2]]);
  const across = front.u;
  const run = Math.hypot(high[0] - low[0], high[2] - low[2]), gradient = (high[1] - low[1]) / run;
  // Solve the exact source plane, rather than a rounded slope approximation.
  const p0 = roof.points[0], p1 = roof.points[1], p2 = roof.points.find(p => Math.abs(dot(sub(p, p0), across)) > 1);
  const v1 = sub(p1, p0), v2 = sub(p2, p0);
  const normal = unit([v1[1]*v2[2]-v1[2]*v2[1], v1[2]*v2[0]-v1[0]*v2[2], v1[0]*v2[1]-v1[1]*v2[0]]);
  const onRoof = (x, z) => [x, p0[1] - (normal[0]*(x-p0[0]) + normal[2]*(z-p0[2])) / normal[1], z];
  const foot = lerp(low, high, 0.64), width = 2.46, dormerDepth = 1.65;
  const planPoint = (u, v) => {
    const p = add(foot, add(mul(across, u), mul(slope, v)));
    return onRoof(p[0], p[2]);
  };
  const feet = [planPoint(-width/2, 0), planPoint(width/2, 0), planPoint(width/2, dormerDepth), planPoint(-width/2, dormerDepth)];
  mask(roof, closed(feet));
  const capY = Math.max(feet[2][1], feet[3][1]) + 0.075;
  const tops = feet.map(p => atY(p, capY));
  quad('detailCladding', [feet[0], feet[3], tops[3], tops[0]]);
  quad('detailCladding', [feet[2], feet[1], tops[1], tops[2]]);
  quad('detailCladding', [feet[0], feet[1], tops[1], tops[0]]);
  quad('detailMetal', tops);
  const glassBottom = Math.max(feet[0][1], feet[1][1]) + 0.13, glassTop = capY - 0.20;
  const outward = mul(slope, -0.008);
  const glassA = add(lerp(feet[0], feet[1], 0.09), outward), glassB = add(lerp(feet[0], feet[1], 0.91), outward);
  wall('detailGlazing', glassA, glassB, glassBottom, glassTop);
  wire('oldWindowFrame', closed([atY(glassA, glassBottom), atY(glassB, glassBottom), atY(glassB, glassTop), atY(glassA, glassTop)]));
  for (let i = 1; i < 3; i++) {
    const point = lerp(glassA, glassB, i/3);
    line('oldWindowFrame', atY(point, glassBottom), atY(point, glassTop));
  }
  const ladderFoot = add(foot, mul(across, -0.64));
  const ladderPoint = (u, v) => {
    const p = add(ladderFoot, add(mul(across, u), mul(slope, v)));
    return add(onRoof(p[0], p[2]), [0, 0.055, 0]);
  };
  for (let i = 0; i < 10; i++) line('detailMetal', ladderPoint(-0.32, -0.22-i*0.29), ladderPoint(0.32, -0.22-i*0.29));
  for (const u of [-0.29, 0.29]) line('detailMetal', ladderPoint(u, -0.20), ladderPoint(u, -2.86));
  // A restrained tiled slope: short courses only on this observed roof.
  const lowWidth = front.span;
  for (let distance = 0.24; distance < run; distance += 0.34) {
    const center = add(low, mul(slope, distance)), span = lowWidth * 0.475;
    const ends = [-span, span].map(u => {
      const p = add(center, mul(across, u)); return add(onRoof(p[0], p[2]), [0, 0.009, 0]);
    });
    // Avoid a course line continuing across the dormer opening.
    if (distance > run*0.64-0.03 && distance < run*0.64+dormerDepth+0.03) {
      const l = add(center, mul(across, -width/2-0.02)), r = add(center, mul(across, width/2+0.02));
      line('detailRoofTexture', ends[0], add(onRoof(l[0], l[2]), [0, 0.009, 0]));
      line('detailRoofTexture', add(onRoof(r[0], r[2]), [0, 0.009, 0]), ends[1]);
    } else line('detailRoofTexture', ...ends);
  }
  output.features.push({
    id: '55-courtyard-dormer', kind: 'upright-roof-dormer', sourceSurfaceIndices: [3],
    width, depth: dormerDepth, divisions: 3, capY, roofGradient: gradient,
    frontGlazing: closed([atY(glassA, glassBottom), atY(glassB, glassBottom), atY(glassB, glassTop), atY(glassA, glassTop)]),
    evidence: 'Entrance photo shows an upright three-part opening with metal cap and maintenance rungs on roof3. This small presentation dormer intersects the existing slope below its ridge; its dimensions are estimates and no interior floor is added.',
  });
}
