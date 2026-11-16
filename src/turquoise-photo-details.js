import {addTurquoiseWindowLayouts} from './turquoise-window-layout.js';

/**
 * Türkis / 57a, four resident elevations, 16 November 2026.
 * Exterior presentation only: all recesses point into the retained LoD2 shell.
 * Floor guides, footprint, height and the independent apartment plans are inputs,
 * never outputs. Widths/depths below are photographic estimates, not measurements.
 */
export function addTurquoisePhotoDetails({building, base, rows, highest, output, helpers}) {
  const {face, facePoint, faceMask, wall, quad, line, atY, add, sub, box} = helpers;
  const nw = [64.713, 0, -14.562], ne = [86.607, 0, -9.008];
  const sw = [59.090, 0, 7.582], se = [81.003, 0, 13.166];
  // These directions read left-to-right when standing outside each elevation.
  const north = face([4, 5, 1, 2], ne, nw);
  const east = face([8, 9], se, ne);
  const south = face([0], sw, se);
  const west = face([6], nw, sw);
  const northFromWest = face([2, 1, 5, 4], nw, ne);
  const eastFromNorth = face([9, 8], ne, se);
  const southFromEast = face([0], se, sw);
  const westFromSouth = face([6], sw, nw);
  const evidence = 'Four resident photographs register the north entrance, northeast bicycle corner, southeast and northwest corners. Relative positions and floor identities follow cross-face comparison; metric detail dimensions remain estimates.';

  function beam(target, x, y, width, height, depth = 0.04, inset = 0.08, role = 'detailGraphite') {
    box(role, atY(facePoint(target, x, inset), y), target.u, target.inward, width, depth, height, role);
  }
  function rail(target, left, right, floor, {inset = 0.10, screen = false} = {}) {
    const bottom = floor + 0.12, top = floor + 1.08;
    beam(target, left, top - 0.04, right - left, 0.045, 0.045, inset);
    beam(target, left, bottom, right - left, 0.035, 0.035, inset);
    const pickets = Math.ceil((right - left) / 0.135);
    for (let i = 0; i <= pickets; i++) {
      beam(target, left + (right - left) * i / pickets, bottom, 0.018, top - bottom, 0.025, inset);
    }
    const posts = Math.ceil((right - left) / 1.4);
    for (let i = 0; i <= posts; i++) {
      beam(target, left + (right - left) * i / posts, floor + 0.025, 0.043, top - floor, 0.048, inset);
    }
    if (screen) {
      const bays = Math.ceil((right - left) / 1.55);
      for (let i = 0; i < bays; i++) {
        wall('detailGraphite', facePoint(target, left + (right - left) * i / bays + 0.025, inset - 0.018),
          facePoint(target, left + (right - left) * (i + 1) / bays - 0.025, inset - 0.018),
          bottom + 0.02, top - 0.10);
      }
    }
  }
  function corner(cornerName, floor, main, side, width, depth, screened = false) {
    const bottom = rows[floor] + 0.06, top = (rows[floor + 1] ?? highest) - 0.16;
    faceMask(main, 0, width, bottom, top);
    faceMask(side, 0, depth, bottom, top);
    const a = main.start, b = facePoint(main, width), d = facePoint(side, depth), c = add(b, sub(d, a));
    quad('detailThreshold', [a, b, c, d].map(p => atY(p, bottom)));
    quad('detailAcidShade', [a, b, c, d].map(p => atY(p, top - 0.20)));
    wall('detailAcidShade', b, c, bottom, top);
    wall('detailCoolRecess', c, d, bottom, top - 0.20);
    // The lime fascia wraps the actual opening, with a deep soffit behind it.
    wall('detailAcidLime', a, b, top - 0.24, top);
    wall('detailAcidLime', d, a, top - 0.24, top);
    wall('detailAcidLime', b, c, top - 0.24, top);
    box('detailAcidLime', atY(facePoint(main, width * 0.37, 0.22), bottom),
      main.u, main.inward, 0.20, 0.20, top - bottom - 0.20, 'detailAcidShade');
    // Dark vertical railings run around both open edges. Only the observed
    // low NW and middle SE fronts have opaque privacy panels.
    rail(main, 0.09, width - 0.08, bottom, {screen: screened});
    rail(side, 0.09, depth - 0.08, bottom);
    output.features.push({
      id: `57a-${cornerName}-loggia-${floor}`, kind: 'corner-loggia', corner: cornerName, floor,
      sourceSurfaceIndices: [...main.indices, ...side.indices], frontWidth: width, returnWidth: depth,
      planRing: [a, b, c, d, a].map(p => [p[0], p[2]]), privacyScreen: screened,
      evidence: `${evidence} Open on both corner faces, with a lime fascia, soffit, column and dark rails. Concealed balcony doors are not inferred.`,
    });
  }
  corner('northwest', 1, northFromWest, west, 7.55, 3.15, true);
  corner('southwest', 2, south, westFromSouth, 9.50, 2.75);
  corner('southeast', 3, east, southFromEast, 9.05, 3.15, true);
  corner('northeast', 4, north, eastFromNorth, 7.50, 3.15);
  corner('southwest', 5, south, westFromSouth, 9.50, 2.75);
  corner('southeast', 6, east, southFromEast, 9.05, 3.15);
  corner('northwest', 7, northFromWest, west, 7.55, 3.15);

  // The split LoD2 north band identifies the gallery; the photographs show
  // horizontal landings and rear doors, not an exposed zig-zag stair flight.
  const galleryLeft = 7.79, galleryRight = 14.79, galleryDepth = 2.04;
  function rearDoor(left, width, bottom, height, glazed = true) {
    const inset = galleryDepth - 0.018;
    beam(north, left, bottom, width, height, 0.025, inset, 'detailGraphite');
    wall(glazed ? 'detailGlazing' : 'detailConcrete',
      facePoint(north, left + 0.055, inset - 0.015), facePoint(north, left + width - 0.055, inset - 0.015),
      bottom + 0.07, bottom + height - 0.07);
    if (glazed) beam(north, left + 0.04, bottom + height * 0.34, width - 0.08, 0.055, 0.028, inset - 0.03);
    beam(north, left + width - 0.16, bottom + 0.84, 0.03, 0.32, 0.045, inset - 0.07, 'detailMetal');
  }
  for (let floor = 1; floor < rows.length; floor++) {
    const bottom = rows[floor] + 0.04, top = (rows[floor + 1] ?? highest) - 0.18;
    faceMask(north, galleryLeft, galleryRight, bottom, top);
    // Remove the timber at the slab edge too: a concrete beam hidden behind
    // an uncut source strip would leave a false wooden belt across the void.
    faceMask(north, galleryLeft, galleryRight, rows[floor] - 0.18, bottom);
    const a = facePoint(north, galleryLeft), b = facePoint(north, galleryRight);
    const c = facePoint(north, galleryRight, galleryDepth), d = facePoint(north, galleryLeft, galleryDepth);
    quad('detailConcrete', [a, b, c, d].map(p => atY(p, bottom)));
    quad('detailConcrete', [a, b, c, d].map(p => atY(p, top)));
    wall('detailConcrete', a, d, bottom, top);
    wall('detailConcrete', c, b, bottom, top);
    wall('detailCoolRecess', d, c, bottom, top);
    beam(north, galleryLeft, rows[floor] - 0.18, galleryRight - galleryLeft, 0.22, galleryDepth, 0.015, 'detailConcrete');
    if (floor === rows.length - 1) {
      faceMask(north, galleryLeft, galleryRight, top, highest - 0.025);
      beam(north, galleryLeft, top - 0.02, galleryRight - galleryLeft, highest - top - 0.005, galleryDepth, 0.015, 'detailConcrete');
    }
    rail(north, galleryLeft + 0.04, galleryRight - 0.08, bottom, {inset: 0.11});
    rearDoor(galleryLeft + 0.86, 1.12, bottom + 0.04, 2.18);
    rearDoor(galleryRight - 1.76, 1.00, bottom + 0.04, 2.18, false);
    // Small wall luminaires and the cool concrete surface communicate the
    // night photograph without adding lights to unrelated campus geometry.
    for (const x of [galleryLeft + 0.72, galleryRight - 2.00]) {
      beam(north, x, bottom + 2.37, 0.64, 0.09, 0.10, galleryDepth - 0.13, 'detailCoolLight');
    }
    output.features.push({
      id: `57a-north-landing-${floor}`, kind: 'open-access-landing', floor,
      sourceSurfaceIndices: [1, 5], width: galleryRight - galleryLeft, depth: galleryDepth,
      evidence: `${evidence} One recessed horizontal landing per upper storey; rear door and lamp dimensions estimated. No interior stair or corridor geometry changes.`,
    });
  }
  output.features.push({
    id: '57a-north-gallery', kind: 'recessed-stair-elevation', sourceSurfaceIndices: [1, 5],
    width: galleryRight - galleryLeft, depth: galleryDepth, landingCount: 7, evidence,
  });

  // A single recessed ground entrance below the gallery; bicycle storage
  // remains a separate frontage on its left (east) when viewed from outside.
  const floor = base + 0.03, head = rows[1] - 0.40;
  faceMask(north, galleryLeft, galleryRight, floor, head);
  faceMask(north, galleryLeft, galleryRight, head, rows[1] + 0.04);
  const a = facePoint(north, galleryLeft), b = facePoint(north, galleryRight);
  const c = facePoint(north, galleryRight, galleryDepth), d = facePoint(north, galleryLeft, galleryDepth);
  quad('detailThreshold', [a, b, c, d].map(p => atY(p, floor)));
  quad('detailConcrete', [a, b, c, d].map(p => atY(p, head)));
  wall('detailConcrete', a, d, floor, head);
  wall('detailConcrete', c, b, floor, head);
  wall('detailConcrete', d, c, floor, head);
  const doorLeft = galleryLeft + 2.41;
  rearDoor(doorLeft, 1.30, floor + 0.015, 2.38);
  // A narrow sidelight, notice case, intercom, and flush right-hand service panel.
  rearDoor(doorLeft - 0.55, 0.50, floor + 0.015, 2.38);
  beam(north, galleryLeft + 0.35, floor + 0.70, 1.02, 1.34, 0.04, galleryDepth - 0.08, 'detailMetal');
  wall('detailLightPanel', facePoint(north, galleryLeft + 0.42, galleryDepth - 0.10),
    facePoint(north, galleryLeft + 1.30, galleryDepth - 0.10), floor + 0.77, floor + 1.97);
  box('detailMetal', atY(facePoint(north, galleryRight - 0.05, 0.25), floor + 1.03),
    north.inward, north.u, 0.21, 0.05, 0.42, 'detailMetal');
  beam(north, galleryRight - 1.51, floor + 0.03, 1.03, 2.37, 0.025, galleryDepth - 0.035, 'detailCoolRecess');
  beam(north, galleryLeft + 1.05, head - 0.24, 4.90, 0.075, 0.12, 0.31, 'detailCoolLight');
  beam(north, galleryLeft, head - 0.16, galleryRight - galleryLeft, 0.375, 0.11, 0.025);
  output.signs ||= [];
  const sign = (id, target, left, right, bottom, top, inset, lines, style) => output.signs.push({
    id, lines, style, width: right - left, height: top - bottom,
    corners: [atY(facePoint(target, left, inset), bottom), atY(facePoint(target, right, inset), bottom),
      atY(facePoint(target, right, inset), top), atY(facePoint(target, left, inset), top)],
  });
  sign('57a-entrance-address', north, galleryLeft + 0.16, galleryRight - 0.16,
    head - 0.135, head + 0.185, 0.012, ['Studentenwohnheim  Erwin-Rommel-Straße 57a'], 'fascia');
  output.features.push({
    id: '57a-recessed-entrance', kind: 'recessed-entrance', floor: 0,
    sourceSurfaceIndices: [1, 5], width: galleryRight - galleryLeft, depth: galleryDepth,
    doorCount: 1, sidelightCount: 1, evidence: `${evidence} The address fascia and ground door sit directly below the gallery; a notice case is left of the glazed entrance and the intercom is on the right reveal.`,
  });

  // The cage occupies the NE corner, stopping at the east wall's lower split.
  // Its two mesh elevations enclose one continuous volume, not two fake windows.
  const cageWidth = 7.58, cageLength = 15.64, cageTop = rows[1] - 0.20;
  faceMask(north, 0, cageWidth, floor, cageTop);
  faceMask(eastFromNorth, 0, cageLength, floor, cageTop);
  const ca = ne, cb = facePoint(north, cageWidth), cd = facePoint(eastFromNorth, cageLength), cc = add(cb, sub(cd, ca));
  quad('detailThreshold', [ca, cb, cc, cd].map(p => atY(p, floor)));
  quad('detailAcidShade', [ca, cb, cc, cd].map(p => atY(p, cageTop)));
  wall('detailAcidShade', cb, cc, floor, cageTop);
  wall('detailAcidLime', cc, cd, floor, cageTop);
  function cageMesh(target, extent) {
    const left = 0.10, right = extent - 0.04, inset = 0.10;
    beam(target, left, floor + 0.05, right - left, 0.055, 0.07, inset);
    beam(target, left, cageTop - 0.075, right - left, 0.075, 0.07, inset);
    const bays = Math.ceil(extent / 2.0);
    for (let i = 0; i <= bays; i++) beam(target, left + (right - left) * i / bays,
      floor + 0.03, 0.07, cageTop - floor - 0.07, 0.09, inset);
    for (let x = left + 0.16; x < right; x += 0.16) line('detailGraphite',
      atY(facePoint(target, x, inset), floor + 0.10), atY(facePoint(target, x, inset), cageTop - 0.09));
    for (let y = floor + 0.20; y < cageTop - 0.09; y += 0.21) line('detailGraphite',
      atY(facePoint(target, left, inset), y), atY(facePoint(target, right, inset), y));
    for (let x = 0.18; x < extent - 0.05; x += 3.4) {
      beam(target, x, floor, 0.18, cageTop - floor, 0.18, 0.30, 'detailAcidLime');
      beam(target, x + 0.22, cageTop - 0.17, 0.83, 0.10, 0.12, 0.55, 'detailCoolLight');
    }
  }
  cageMesh(north, cageWidth);
  cageMesh(eastFromNorth, cageLength);
  // Gate stile / handle, deliberately independent of the main dorm entrance.
  beam(north, 2.18, floor + 0.05, 0.065, cageTop - floor - 0.13, 0.07, 0.065);
  beam(north, 2.08, floor + 1.05, 0.14, 0.045, 0.05, 0.035, 'detailMetal');
  function bicycle(target, x, inset, variant) {
    const p = (u, y, z = 0) => atY(facePoint(target, x + u, inset + z), floor + y);
    const wheel = (u, z) => {
      for (let i = 0; i < 20; i++) {
        const angle = 2 * Math.PI * i / 20, next = 2 * Math.PI * (i + 1) / 20;
        line('detailGraphite', p(u + Math.cos(angle) * 0.32, 0.36 + Math.sin(angle) * 0.32, z),
          p(u + Math.cos(next) * 0.32, 0.36 + Math.sin(next) * 0.32, z));
        if (i % 4 === 0) line('detailMetal', p(u, 0.36, z), p(u + Math.cos(angle) * 0.31, 0.36 + Math.sin(angle) * 0.31, z));
      }
    };
    wheel(0, 0); wheel(1.07, 0.11);
    const frame = [[0, 0.36], [0.50, 0.31], [0.36, 0.87], [0, 0.36], [0.50, 0.31], [0.88, 0.89], [0.36, 0.87]];
    for (let i = 1; i < frame.length; i++) line(variant % 3 ? 'detailMetal' : 'detailGraphite', p(...frame[i - 1]), p(...frame[i]));
    line('detailGraphite', p(0.88, 0.89), p(1.07, 0.36, 0.11));
    line('detailGraphite', p(0.88, 0.89), p(0.91, 1.12, 0.11));
    line('detailGraphite', p(0.80, 1.12, 0.11), p(1.02, 1.12, 0.11));
    line('detailGraphite', p(0.34, 0.81), p(0.38, 0.99));
    line('detailGraphite', p(0.24, 0.99), p(0.49, 0.99));
  }
  for (let i = 0; i < 10; i++) bicycle(eastFromNorth, 0.68 + i * 1.38, 0.85 + (i % 3) * 0.26, i);
  for (let i = 0; i < 4; i++) bicycle(north, 0.62 + i * 1.60, 2.05 + (i % 2) * 0.45, i);
  sign('57a-bike-wordmark', north, 0.30, cageWidth - 0.26, floor + 0.25, floor + 2.08, 0.055, ['türkis'], 'wordmark');
  output.features.push({
    id: '57a-northeast-bicycle-storage', kind: 'bike-storage', floor: 0,
    sourceSurfaceIndices: [4, 5, 9], frontWidth: cageWidth, returnWidth: cageLength,
    planRing: [ca, cb, cc, cd, ca].map(p => [p[0], p[2]]), bicycleCount: 14,
    evidence: `${evidence} One lime-backed wire-mesh bicycle enclosure wraps the NE corner, with a dark türkis wordmark on the north fence. Bicycle count, positions and fence spacing are illustrative.`,
  });

  // Photo 4 shows a separate flush service door and turquoise plaque in the
  // otherwise solid southeast ground return, before the bicycle enclosure.
  const serviceLeft = 3.60, serviceRight = 4.88, serviceTop = floor + 2.29;
  faceMask(east, serviceLeft, serviceRight, floor, serviceTop);
  beam(east, serviceLeft, floor + 0.015, serviceRight - serviceLeft, serviceTop - floor - 0.015, 0.05, 0.10);
  for (const x of [serviceLeft + 0.42, serviceLeft + 0.85]) {
    beam(east, x, floor + 1.03, 0.045, 0.31, 0.06, 0.04, 'detailMetal');
  }
  faceMask(east, serviceRight + 0.13, serviceRight + 0.56, floor + 0.18, floor + 2.13);
  beam(east, serviceRight + 0.13, floor + 0.18, 0.43, 1.95, 0.04, 0.025, 'detailTurquoisePlaque');
  output.features.push({
    id: '57a-east-service-door', kind: 'service-door', floor: 0, sourceSurfaceIndices: [8],
    width: serviceRight - serviceLeft, evidence: `${evidence} Photo 4 shows a dark utility doorway and turquoise plaque beside the long bicycle frontage; this is separate from the north main entrance.`,
  });

  addTurquoiseWindowLayouts({building, output});
  output.photoSurfaceIndices = [0, 1, 2, 4, 5, 6, 8, 9];
  output.features.push({
    id: '57a-four-photo-registration', kind: 'photo-face-registration', sourceSurfaceIndices: output.photoSurfaceIndices,
    photos: {1: 'northwest / west', 2: 'north entrance', 3: 'northeast / east and north', 4: 'southeast / south and east'},
    evidence,
  });
}
