import {addLilaWindowLayouts} from './lila-window-layout.js';

/**
 * Lila / Erwin-Rommel-Straße 53a — eight resident photographs, November 2026.
 * All geometry belongs to the folded exterior display. The original footprint,
 * source surfaces, roof cap, five floor elevations and interior plans are inputs.
 * Photo-registered widths and depths below remain unmeasured visual estimates.
 */
export function addLilaPhotoDetails({building, base, rows, highest, output, helpers}) {
  const {face, facePoint, faceMask, wall, quad, line, atY, add, sub, box} = helpers;
  const se = [23.079, 0, -58.260], ne = [28.636, 0, -80.206];
  const sw = [0.996, 0, -63.869], nw = [6.564, 0, -85.824];
  const east = face([9, 4, 1, 3], se, ne), eastFromNorth = face([3, 1, 4, 9], ne, se);
  const south = face([2], se, sw), southFromWest = face([2], sw, se);
  const north = face([7], ne, nw), northFromWest = face([7], nw, ne);
  const west = face([5, 8], nw, sw), westFromSouth = face([8, 5], sw, nw);
  const evidence = 'Eight overlapping resident photographs register all four elevations. Corner, floor and frontage identities are photo-supported; detailed dimensions and concealed construction remain estimates.';
  const floors = [0, 1, 2, 3, 4];
  if (rows.length !== floors.length) throw new Error('Lila must retain its five existing storeys');
  // Solid recess walls prevent distant window/door batches showing through
  // the gallery as pale rectangular ghosts when inspecting the entrance.
  output.surfaceOpacity = 1;

  function beam(target, x, y, width, height, depth = 0.04, inset = 0.08, role = 'detailGraphite') {
    box(role, atY(facePoint(target, x, inset), y), target.u, target.inward, width, depth, height, role);
  }
  function rail(target, left, right, bottom, inset = 0.10) {
    const low = bottom + 0.12, top = bottom + 1.08;
    beam(target, left, top - 0.035, right - left, 0.04, 0.045, inset);
    beam(target, left, low, right - left, 0.035, 0.04, inset);
    const count = Math.ceil((right - left) / 0.135);
    for (let i = 0; i <= count; i++) {
      beam(target, left + (right - left) * i / count, low, 0.018, top - low, 0.025, inset);
    }
    const posts = Math.ceil((right - left) / 1.45);
    for (let i = 0; i <= posts; i++) {
      beam(target, left + (right - left) * i / posts, bottom + 0.025, 0.045, top - bottom, 0.045, inset);
    }
  }
  function door(target, left, width, bottom, height, inset, {glazed = true, toplight = false} = {}) {
    beam(target, left, bottom, width, height, 0.04, inset, 'detailGraphite');
    wall(glazed ? 'detailGlazing' : 'detailCoolRecess',
      facePoint(target, left + 0.055, inset - 0.012), facePoint(target, left + width - 0.055, inset - 0.012),
      bottom + 0.06, bottom + height - 0.055);
    if (glazed) {
      beam(target, left + 0.045, bottom + height * 0.34, width - 0.09, 0.045, 0.025, inset - 0.025);
      if (toplight) beam(target, left + 0.045, bottom + height * 0.80, width - 0.09, 0.065, 0.025, inset - 0.025);
    }
    beam(target, left + width - 0.16, bottom + 0.88, 0.025, 0.30, 0.035, inset - 0.05, 'detailMetal');
  }
  function sign(id, target, left, right, bottom, top, inset, text, style, ink) {
    (output.signs ||= []).push({
      id, lines: [text], style, ...(ink ? {ink} : {}), width: right - left, height: top - bottom,
      corners: [atY(facePoint(target, left, inset), bottom), atY(facePoint(target, right, inset), bottom),
        atY(facePoint(target, right, inset), top), atY(facePoint(target, left, inset), top)],
    });
  }

  function loggia(corner, floor, main, side, width, depth, photos) {
    const bottom = rows[floor] + 0.055, top = (rows[floor + 1] ?? highest) - 0.055;
    faceMask(main, 0, width, bottom, top);
    faceMask(side, 0, depth, bottom, top);
    const a = main.start, b = facePoint(main, width), d = facePoint(side, depth), c = add(b, sub(d, a));
    quad('detailThreshold', [a, b, c, d].map(p => atY(p, bottom)));
    quad('detailAcidShade', [a, b, c, d].map(p => atY(p, top - 0.29)));
    wall('detailAcidShade', b, c, bottom, top);
    wall('detailAcidShade', c, d, bottom, top);
    wall('detailAcidLime', a, b, top - 0.29, top);
    wall('detailAcidLime', d, a, top - 0.29, top);
    // Lime columns sit behind the dark continuous guardrails.
    beam(main, width * (corner === 'southwest' ? 0.38 : 0.58), bottom,
      0.22, top - bottom - 0.29, 0.22, 0.55, 'detailAcidLime');
    rail(main, 0.08, width - 0.08, bottom);
    rail(side, 0.08, depth - 0.08, bottom);
    // A single rear door is visible on the long SW loggia (#2). The other
    // concealed rear walls do not acquire invented pairs of luminous windows.
    if (corner === 'southwest') {
      door(main, width * 0.72, 1.0, bottom + 0.035, 2.27, depth - 0.045);
      beam(main, width * 0.07, bottom + 0.05, width * 0.37, 0.20, 0.40, depth - 0.48, 'detailGraphite');
    }
    output.features.push({
      id: `53a-${corner}-loggia-${floor}`, kind: 'corner-loggia', corner, floor,
      sourceSurfaceIndices: [...main.indices, ...side.indices], frontWidth: width, returnWidth: depth, photos,
      planRing: [a, b, c, d, a].map(p => [p[0], p[2]]),
      evidence: `${evidence} Lime fascia and soffit, inset column, open corner and vertical black rails. The southwest first-floor recess was missing from the earlier model.`,
    });
  }
  loggia('southwest', 1, westFromSouth, southFromWest, 10.00, 3.40, [2, 3]);
  loggia('northeast', 2, eastFromNorth, north, 6.10, 3.25, [1, 4, 5, 6, 7, 8]);
  loggia('northwest', 3, northFromWest, west, 8.85, 2.50, [2, 6, 7, 8]);
  loggia('southeast', 4, east, south, 6.50, 3.30, [1, 3, 4, 5]);

  // Front band: horizontal open access landings over a separate ground portal.
  // Photos #4/#5 do not show an exposed diagonal staircase across this face.
  const galleryLeft = 7.83, galleryRight = 15.03, galleryDepth = 2.06;
  for (let floor = 1; floor < rows.length; floor++) {
    const bottom = rows[floor] + 0.045, top = (rows[floor + 1] ?? highest) - 0.18;
    faceMask(east, galleryLeft, galleryRight, rows[floor] - 0.21, top);
    const a = facePoint(east, galleryLeft), b = facePoint(east, galleryRight);
    const c = facePoint(east, galleryRight, galleryDepth), d = facePoint(east, galleryLeft, galleryDepth);
    quad('detailConcrete', [a, b, c, d].map(p => atY(p, bottom)));
    quad('detailConcrete', [a, b, c, d].map(p => atY(p, top)));
    wall('detailConcrete', a, d, bottom, top);
    wall('detailConcrete', c, b, bottom, top);
    wall('detailCoolRecess', d, c, bottom, top);
    beam(east, galleryLeft, rows[floor] - 0.21, galleryRight - galleryLeft, 0.255, galleryDepth, 0.012, 'detailConcrete');
    if (floor === rows.length - 1) {
      faceMask(east, galleryLeft, galleryRight, top, highest - 0.02);
      beam(east, galleryLeft, top - 0.015, galleryRight - galleryLeft, highest - top - 0.01, galleryDepth, 0.012, 'detailConcrete');
    }
    rail(east, galleryLeft + 0.065, galleryRight - 0.10, bottom);
    door(east, galleryLeft + 0.12, 1.12, bottom + 0.03, 2.25, galleryDepth - 0.045);
    door(east, galleryRight - 1.76, 1.20, bottom + 0.03, 2.25, galleryDepth - 0.045);
    door(east, galleryLeft + 3.02, 0.93, bottom + 0.03, 2.17, galleryDepth - 0.045, {glazed: false});
    for (const x of [galleryLeft + 0.57, galleryRight - 1.36]) {
      beam(east, x, bottom + 2.39, 0.34, 0.12, 0.08, galleryDepth - 0.12, 'detailCoolLight');
    }
    beam(east, galleryLeft + 3.40, top - 0.09, 0.74, 0.065, 0.13, 0.91, 'detailCoolLight');
    output.features.push({
      id: `53a-east-landing-${floor}`, kind: 'open-access-landing', floor, sourceSurfaceIndices: [4, 1],
      width: galleryRight - galleryLeft, depth: galleryDepth, photos: [4, 5],
      evidence: `${evidence} Light concrete slabs and soffits, dark balustrades, rear doors and compact cool lamps. No interior access route or stair flight is changed.`,
    });
  }
  output.features.push({
    id: '53a-east-gallery', kind: 'recessed-stair-elevation', sourceSurfaceIndices: [4, 1],
    width: galleryRight - galleryLeft, depth: galleryDepth, landingCount: 4, evidence,
  });

  const ground = base + 0.035, entryHead = rows[1] - 0.51;
  faceMask(east, galleryLeft, galleryRight, ground, rows[1] + 0.045);
  const ea = facePoint(east, galleryLeft), eb = facePoint(east, galleryRight);
  const ec = facePoint(east, galleryRight, galleryDepth), ed = facePoint(east, galleryLeft, galleryDepth);
  quad('detailThreshold', [ea, eb, ec, ed].map(p => atY(p, ground)));
  quad('detailGraphite', [ea, eb, ec, ed].map(p => atY(p, entryHead)));
  wall('detailGraphite', ea, ed, ground, entryHead);
  wall('detailGraphite', eb, ec, ground, entryHead);
  wall('detailGraphite', ed, ec, ground, entryHead);
  const entryDoorLeft = galleryLeft + 3.48;
  door(east, entryDoorLeft, 1.22, ground + 0.015, 2.42, galleryDepth - 0.045, {toplight: true});
  door(east, galleryLeft + 0.15, 0.98, ground + 0.015, 2.42, galleryDepth - 0.045);
  beam(east, entryDoorLeft + 1.45, ground + 1.42, 0.30, 0.37, 0.07, galleryDepth - 0.12, 'detailCoolLight');
  beam(east, entryDoorLeft + 1.54, ground + 0.92, 0.10, 0.29, 0.04, galleryDepth - 0.10, 'detailMetal');
  // Mailboxes occupy the right reveal, retaining a distinct main doorway.
  const mailFace = face([], facePoint(east, galleryRight - 0.04, 0.18), facePoint(east, galleryRight - 0.04, 1.62));
  for (let row = 0; row < 6; row++) for (let column = 0; column < 5; column++) {
    beam(mailFace, 0.09 + column * 0.245, ground + 0.87 + row * 0.145,
      0.227, 0.128, 0.028, 0.012, 'detailMetal');
  }
  beam(east, galleryLeft, entryHead - 0.12, galleryRight - galleryLeft, 0.43, 0.10, 0.025);
  sign('53a-entrance-address', east, galleryLeft + 0.16, galleryRight - 0.16,
    entryHead - 0.09, entryHead + 0.25, 0.012, 'Studentenwohnheim  Erwin-Rommel-Straße 53a', 'fascia');
  // Small notice case on the timber pier between entrance and bicycle gate.
  faceMask(east, galleryRight + 0.22, galleryRight + 1.08, ground + 0.88, ground + 1.91);
  beam(east, galleryRight + 0.22, ground + 0.88, 0.86, 1.03, 0.055, 0.018, 'detailMetal');
  wall('detailLightPanel', facePoint(east, galleryRight + 0.27, 0.007),
    facePoint(east, galleryRight + 1.03, 0.007), ground + 0.94, ground + 1.85);
  output.features.push({
    id: '53a-recessed-entrance', kind: 'recessed-entrance', floor: 0, sourceSurfaceIndices: [4, 1],
    width: galleryRight - galleryLeft, depth: galleryDepth, doorCount: 1, sideOpeningCount: 1, photos: [4, 5],
    evidence: `${evidence} Exact photographed address header, charcoal portal, central-right glazed door with toplight, left glazed opening, right wall light and return mailboxes. The use of the left opening is not inferred.`,
  });

  // A single two-sided cage: full NNE face and a shorter ESE gate return.
  // Its lower head preserves the pronounced timber belt below first-floor windows.
  const cageFrontWidth = east.span - 16.55, cageLength = north.span - 0.04, cageTop = rows[1] - 0.62;
  faceMask(eastFromNorth, 0, cageFrontWidth, ground, cageTop);
  faceMask(north, 0, cageLength, ground, cageTop);
  const ca = ne, cb = facePoint(eastFromNorth, cageFrontWidth), cd = facePoint(north, cageLength), cc = add(cb, sub(cd, ca));
  quad('detailThreshold', [ca, cb, cc, cd].map(p => atY(p, ground)));
  quad('detailAcidShade', [ca, cb, cc, cd].map(p => atY(p, cageTop)));
  wall('detailAcidShade', cb, cc, ground, cageTop);
  wall('detailAcidShade', cc, cd, ground, cageTop);
  function cageMesh(target, extent) {
    const left = 0.055, right = extent - 0.055, inset = 0.105;
    for (const y of [ground + 0.04, cageTop - 0.055]) beam(target, left, y, right - left, 0.045, 0.055, inset);
    const bays = Math.ceil(extent / 2.85);
    for (let i = 0; i <= bays; i++) {
      const x = left + (right - left) * i / bays;
      beam(target, x, ground + 0.02, 0.05, cageTop - ground - 0.02, 0.06, inset);
      beam(target, Math.min(x + 0.015, extent - 0.23), ground, 0.18, cageTop - ground, 0.19, 0.34, 'detailAcidLime');
    }
    for (let x = left + 0.14; x < right; x += 0.14) {
      line('detailGraphite', atY(facePoint(target, x, inset), ground + 0.06), atY(facePoint(target, x, inset), cageTop - 0.07));
    }
    for (let y = ground + 0.20; y < cageTop - 0.06; y += 0.19) {
      line('detailGraphite', atY(facePoint(target, left, inset), y), atY(facePoint(target, right, inset), y));
    }
  }
  cageMesh(eastFromNorth, cageFrontWidth);
  cageMesh(north, cageLength);
  beam(eastFromNorth, cageFrontWidth - 1.52, ground + 0.05, 0.055, cageTop - ground - 0.11, 0.05, 0.065);
  beam(eastFromNorth, cageFrontWidth - 1.47, ground + 1.02, 0.16, 0.035, 0.04, 0.035, 'detailMetal');
  function bicycle(target, x, depth, index) {
    const p = (u, y) => atY(facePoint(target, x + u, depth), ground + y);
    for (const center of [0, 1.05]) {
      for (let i = 0; i < 24; i++) {
        const a = Math.PI * i / 12, b = Math.PI * (i + 1) / 12;
        line('detailGraphite', p(center + Math.cos(a) * 0.31, 0.34 + Math.sin(a) * 0.31),
          p(center + Math.cos(b) * 0.31, 0.34 + Math.sin(b) * 0.31));
        if (i % 4 === 0) line('detailMetal', p(center, 0.34), p(center + Math.cos(a) * 0.30, 0.34 + Math.sin(a) * 0.30));
      }
    }
    const frame = [[0, 0.34], [0.47, 0.29], [0.35, 0.86], [0, 0.34], [0.47, 0.29], [0.85, 0.88], [0.35, 0.86]];
    for (let i = 1; i < frame.length; i++) line(index % 3 ? 'detailMetal' : 'detailGraphite', p(...frame[i - 1]), p(...frame[i]));
    for (const [a, b] of [
      [[0.85, 0.88], [1.05, 0.34]], [[0.85, 0.88], [0.90, 1.10]], [[0.78, 1.10], [1.04, 1.10]],
      [[0.35, 0.86], [0.37, 0.98]], [[0.24, 0.98], [0.51, 0.98]],
    ]) line('detailGraphite', p(...a), p(...b));
  }
  for (let i = 0; i < 14; i++) bicycle(north, 0.70 + i * 1.51, 0.82 + i % 3 * 0.24, i);
  for (let i = 0; i < 3; i++) bicycle(eastFromNorth, 0.75 + i * 1.55, 1.8 + i % 2 * 0.35, i);
  // Face direction must read left-to-right from outside, opposite eastFromNorth.
  sign('53a-bike-wordmark', east, 16.79, east.span - 0.22, ground + 0.23, ground + 2.13,
    0.075, 'l i l a', 'wordmark', '#c391cf');
  output.features.push({
    id: '53a-northeast-bicycle-storage', kind: 'bike-storage', floor: 0, sourceSurfaceIndices: [3, 7],
    frontWidth: cageFrontWidth, returnWidth: cageLength, bicycleCount: 17, photos: [1, 4, 5, 6, 7, 8],
    planRing: [ca, cb, cc, cd, ca].map(p => [p[0], p[2]]),
    evidence: `${evidence} Continuous open welded-mesh cage with lime posts, broad timber head and lavender lowercase lila letters on its east gate. Parked bicycle count and positions are decorative.`,
  });

  // Photo #2: one low louvred service-type opening below the long SW loggia,
  // with a small dark top pane. It does not establish an apartment window.
  const serviceLeft = west.span * 0.713 - 0.55, serviceHeight = 2.44;
  faceMask(west, serviceLeft, serviceLeft + 1.10, ground, ground + serviceHeight);
  beam(west, serviceLeft, ground, 1.10, serviceHeight, 0.035, 0.13);
  wall('detailGlazing', facePoint(west, serviceLeft + 0.06, 0.105),
    facePoint(west, serviceLeft + 1.04, 0.105), ground + 1.84, ground + serviceHeight - 0.055);
  for (let i = 0; i < 11; i++) {
    beam(west, serviceLeft + 0.065, ground + 0.19 + i * 0.145, 0.97, 0.10, 0.03, 0.08, 'detailLightPanel');
  }
  beam(west, serviceLeft + 0.89, ground + 0.92, 0.035, 0.27, 0.05, 0.06, 'detailMetal');
  output.features.push({
    id: '53a-west-service-opening', kind: 'service-door', floor: 0, sourceSurfaceIndices: [8],
    width: 1.10, height: serviceHeight, photos: [2],
    evidence: `${evidence} A narrow ground-level opening has a dark top pane and pale horizontal lower louvres. Its service use is a visual interpretation; no interior room or door record is added.`,
  });

  addLilaWindowLayouts({building, output});
  output.photoSurfaceIndices = [1, 2, 3, 4, 5, 7, 8, 9];
  output.features.push({
    id: '53a-eight-photo-registration', kind: 'photo-face-registration', sourceSurfaceIndices: output.photoSurfaceIndices,
    photos: {1: 'aerial SSW and ESE', 2: 'WNW', 3: 'SSW from southwest', 4: 'ESE entrance', 5: 'ESE entrance close',
      6: 'NNE / ESE northeast corner', 7: 'NNE / ESE full corner', 8: 'NNE / ESE close corner'},
    evidence,
  });
}
