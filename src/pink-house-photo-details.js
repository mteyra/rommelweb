import {addPinkBicycleDetails} from './pink-bicycle-details.js';

/**
 * Pink / 59a — the resident's four nighttime photographs, 16 November 2026.
 * X runs east; Z runs south. Photo 1 = west, 2 = north, 3 = east,
 * 4 = northeast corner. The repeated lit windows register photos 3 and 4.
 * The south elevation is NOT directly photographed. No floorplan is read,
 * resized or used as window evidence here. All dimensions below are estimates
 * inside the retained source shell, not a replacement building survey.
 */
export function addPinkHousePhotoDetails({building, base, rows, highest, output, helpers}) {
  const {
    face, facePoint, faceMask, wall, quad, line, atY, add, sub, mul,
    box, photographicRows,
  } = helpers;
  const nw = [57.050, 0, 44.096], ne = [79.700, 0, 43.779];
  const sw = [57.372, 0, 66.961], se = [79.992, 0, 66.643];
  const north = face([4, 9, 1, 6], nw, ne);
  const east = face([2], ne, se), west = face([7], nw, sw);
  const south = face([8, 3], sw, se);
  const frontEast = face([6, 1, 9, 4], ne, nw);
  const southEast = face([3, 8], se, sw);
  const eastSouth = face([2], se, ne), westSouth = face([7], sw, nw);

  // The entrance wings are blank timber, not the bedroom window grid.
  for (const index of north.indices) {
    output.layoutsBySurface.set(building.surfaces[index], {replace: true, rows: []});
  }
  const westEven = [0.12, 0.27, 0.42, 0.57, 0.72, 0.88];
  const westOdd = [0.07, 0.22, 0.37, 0.52, 0.68, 0.83];
  photographicRows(7, nw, sw, {
    0: westEven, 1: westOdd, 2: westEven, 3: westOdd,
    4: westEven.slice(1), 5: westOdd,
  });
  // Dark/occluded candidates in the southeast third are kept explicitly
  // provisional: darkness is not evidence for a wall without windows.
  // The distinctive observed east centers supersede the old generic grid.
  photographicRows(2, se, ne, {
    0: [],
    1: [0.09, 0.23, 0.37, 0.51, 0.67, 0.81, 0.95],
    2: [0.09, 0.23, 0.37, 0.48, 0.62, 0.76],
    3: [0.48, 0.62, 0.76, 0.90],
    4: [0.09, 0.23, 0.38, 0.48, 0.62, 0.76, 0.90],
    5: [0.09, 0.23, 0.38, 0.51, 0.65, 0.79, 0.93],
  }, [1, 2, 4, 5]);
  for (const index of [2, 7]) {
    const layout = output.layoutsBySurface.get(building.surfaces[index]);
    layout.replace = true;
    layout.recessDepth = 0.14;
    for (const row of layout.rows) {
      Object.assign(row, {width: 1.10, height: 2.48, sillOffset: 0.14, headHeight: 0.34, transomRatio: 0.34});
    }
  }
  const eastEvidence = output.features.find(feature => feature.id === '59a-photographic-window-rows-2');
  eastEvidence.evidence = 'Photos 3 and 4 register the east face through matching lit windows. Measured image fractions are approximate. Candidates at .09/.23 and obscured lower openings retain a plausible rhythm, not confirmed counts. Ground is the photographed bicycle cage; south-face windows remain unverified.';
  eastEvidence.inferredCenters = {1: [0.09, 0.23, 0.37, 0.51, 0.95], 2: [0.09, 0.23, 0.37], 4: [0.09, 0.23], 5: [0.09, 0.23]};

  // Physical rectangular rail sections remain visible in both close and
  // overview cameras. Closely spaced dark pickets, not solid balcony walls.
  function rail(front, left, right, bottom, depth = 0.10) {
    const height = 1.08;
    for (const y of [bottom + 0.12, bottom + height]) {
      box('windowFrame', atY(facePoint(front, left, depth), y),
        front.u, front.inward, right - left, 0.035, 0.035, 'windowFrame');
    }
    const count = Math.ceil((right - left) / 0.14);
    for (let i = 0; i <= count; i++) {
      const u = left + (right - left - 0.023) * i / count;
      wall('windowFrame', facePoint(front, u, depth), facePoint(front, u + 0.023, depth), bottom + 0.12, bottom + height);
    }
    for (let u = left; u < right; u += 1.35) {
      box('windowFrame', atY(facePoint(front, u, depth), bottom + 0.06),
        front.u, front.inward, 0.04, 0.04, height, 'windowFrame');
    }
  }

  function loggia(corner, floor, main, side, width, depth, partial = false) {
    const bottom = rows[floor] + 0.08;
    const top = (rows[floor + 1] ?? highest) - 0.22;
    faceMask(main, 0, width, bottom, top);
    faceMask(side, 0, depth, bottom, top);
    const a = main.start, b = facePoint(main, width);
    const d = facePoint(side, depth), c = add(b, sub(d, a));
    quad('detailThreshold', [a, b, c, d].map(p => atY(p, bottom)));
    quad('detailLime', [a, b, c, d].map(p => atY(p, top)));
    wall('detailLimeShade', b, c, bottom, top);
    wall('detailLimeShade', c, d, bottom, top);
    wall('detailLime', a, b, top - 0.30, top);
    wall('detailLime', d, a, top - 0.30, top);
    box('detailLime', atY(facePoint(main, width * 0.36, 0.25), bottom),
      main.u, main.inward, 0.20, 0.20, top - bottom, 'detailLime');
    rail(main, 0.08, width - 0.08, bottom);
    rail(side, 0.08, depth - 0.08, bottom);
    if (corner === 'northeast' && floor === 2) {
      // Photo 4 shows one tall glazed opening at the gallery end of this
      // balcony's back wall. This is a surface detail, not an interior door.
      const rear = u => add(add(d, mul(main.u, u)), mul(main.inward, -0.022));
      const lo = width - 1.38, hi = width - 0.27, topY = bottom + 2.28;
      wall('windowFrame', rear(lo - 0.055), rear(hi + 0.055), bottom + 0.07, topY + 0.055);
      const glass = u => add(rear(u), mul(main.inward, -0.012));
      wall('detailGlazing', glass(lo), glass(hi), bottom + 0.12, topY);
      line('windowFrame', atY(glass(lo), bottom + 0.76), atY(glass(hi), bottom + 0.76));
    }
    output.features.push({
      id: `59a-${corner}-loggia-${floor}`, kind: 'corner-loggia', floor,
      sourceSurfaceIndices: [...main.indices, ...side.indices],
      frontWidth: width, returnWidth: depth,
      planRing: [a, b, c, d, a].map(p => [p[0], p[2]]),
      evidence: partial
        ? 'Photo 1 partially shows this southwest lime recess through branches/cropping. West return and storey are visible; its unseen south arm and depth remain typological estimates. Existing rooms are unchanged.'
        : 'Matched resident photos locate the lime corner recess and its storey. Both exterior planes are cut for an open balcony with soffit, column and picket railing. Widths and depth remain approximate; no interior access or room geometry is inferred.',
    });
  }
  loggia('northeast', 2, frontEast, east, 7.62, 3.05);
  loggia('northwest', 4, north, west, 7.62, 3.05);
  loggia('southeast', 3, eastSouth, southEast, 8.55, 3.10);
  loggia('southwest', 1, south, westSouth, 7.62, 2.80, true);
  loggia('southwest', 5, south, westSouth, 7.62, 2.80, true);

  // Use the actual split source face for the tall central opening.
  const gallery = face([9], [64.843, 0, 43.987], [71.897, 0, 43.898]);
  const depth = 2.12, left = 0.045, right = gallery.span - 0.045;
  const p = (u, y, inset = 0) => atY(facePoint(gallery, u, inset), y);
  function galleryDoor(center, bottom, top, width = 0.94, role = 'detailGlazing') {
    const a = center - width / 2, b = center + width / 2;
    wall('detailRecess', facePoint(gallery, a - 0.055, depth - 0.02),
      facePoint(gallery, b + 0.055, depth - 0.02), bottom, top + 0.055);
    wall(role, facePoint(gallery, a, depth - 0.038),
      facePoint(gallery, b, depth - 0.038), bottom + 0.04, top);
    line('detailLightPanel', p(b - 0.09, bottom + 0.88, depth - 0.055), p(b - 0.09, bottom + 1.05, depth - 0.055));
  }
  for (let floor = 0; floor < rows.length; floor++) {
    const bottom = rows[floor] + 0.06;
    const top = (rows[floor + 1] ?? highest) - (floor ? 0.20 : 0.56);
    faceMask(gallery, left, right, bottom, top);
    const a = facePoint(gallery, left), b = facePoint(gallery, right);
    const c = facePoint(gallery, right, depth), d = facePoint(gallery, left, depth);
    quad('detailThreshold', [a, b, c, d].map(point => atY(point, bottom)));
    quad('detailPinkGallerySoffit', [a, b, c, d].map(point => atY(point, top)));
    wall('detailRecess', a, d, bottom, top);
    wall('detailRecess', c, b, bottom, top);
    wall('detailPinkGalleryWall', d, c, bottom, top);
    if (floor) {
      wall('detailLightPanel', a, b, bottom, bottom + 0.13);
      rail(gallery, left + 0.06, right - 0.06, bottom + 0.13);
      galleryDoor(gallery.span * 0.25, bottom, bottom + 2.20);
      galleryDoor(gallery.span * 0.77, bottom, bottom + 2.20);
      // Visible shaded side opening suggests the stair beyond the gallery.
      // Its silhouette does not route or change the retained internal stairs.
      wall('detailRecess', facePoint(gallery, right - 0.45, depth - 0.045),
        facePoint(gallery, right - 0.08, depth - 0.045), bottom + 0.10, top - 0.08);
    } else {
      // Open porch, recessed central gray door, side passages and mailboxes.
      galleryDoor(gallery.span * 0.36, bottom, bottom + 2.18, 1.04, 'detailLightPanel');
      for (const [lo, hi] of [[left + 0.10, left + 1.10], [right - 1.10, right - 0.10]]) {
        wall('detailRecess', facePoint(gallery, lo, depth - 0.05),
          facePoint(gallery, hi, depth - 0.05), bottom, top - 0.06);
      }
      const mailStart = right - 0.055;
      const mail = (inset, y) => p(mailStart, y, inset);
      quad('detailMetal', [mail(0.35, bottom + 0.82), mail(1.55, bottom + 0.82),
        mail(1.55, bottom + 1.70), mail(0.35, bottom + 1.70)]);
      for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) {
        line('windowFrame', mail(0.38 + col * 0.29, bottom + 0.92 + row * 0.15),
          mail(0.60 + col * 0.29, bottom + 0.92 + row * 0.15));
      }
    }
    // Small cool-white fixture geometry; no fake emissive room occupancy.
    const lampY = top - 0.035;
    quad('detailPinkGalleryLight', [p(2.25, lampY, 0.65), p(3.45, lampY, 0.65),
      p(3.45, lampY, 0.77), p(2.25, lampY, 0.77)]);
    wall('detailPinkGalleryLight', facePoint(gallery, right - 0.28, depth - 0.06),
      facePoint(gallery, right - 0.10, depth - 0.06), top - 0.21, top - 0.10);
  }
  output.features.push({
    id: '59a-north-stair', kind: 'recessed-stair-elevation',
    sourceSurfaceIndices: [9], width: gallery.span, depth, landingFloors: [1, 2, 3, 4, 5],
    evidence: 'Photos 2 and 4 show five open upper landings in the north source band, light slab edges/soffits, fine dark vertical rails and recessed openings. Rear openings and depth are appearance estimates, separate from the retained internal staircase.',
  }, {
    id: '59a-north-entrance', kind: 'recessed-entrance', floor: 0,
    sourceSurfaceIndices: [9], width: gallery.span, depth,
    evidence: 'Photos 2 and 4 show an open ground porch, gray rear door, side passages and mailboxes. No flush glass curtain wall or railing closes the public entrance.',
  });

  addPinkBicycleDetails({building, rows, output, helpers, front: north, east});

  // Text is oriented for a viewer NORTH of the building: east is screen-left.
  function sign(id, front, lo, hi, bottom, top, text, style, ink) {
    const inset = style === 'wordmark' ? 0.10 : -0.009;
    const a = atY(facePoint(front, hi, inset), bottom);
    const b = atY(facePoint(front, lo, inset), bottom);
    const c = atY(facePoint(front, lo, inset), top);
    const d = atY(facePoint(front, hi, inset), top);
    (output.signs ||= []).push({id, style, lines: [text], corners: [a, b, c, d], ...(ink ? {ink} : {})});
  }
  sign('59a-pink-wordmark', north, 15.24, 21.96, base + 0.35, base + 2.42, 'pink', 'wordmark', '#ed4b88');
  wall('windowFrame', facePoint(gallery, left, -0.004), facePoint(gallery, right, -0.004),
    rows[1] - 0.56, rows[1] - 0.02);
  sign('59a-address', gallery, 0.20, gallery.span - 0.20,
    rows[1] - 0.50, rows[1] - 0.065, 'Studentenwohnheim Erwin-Rommel-Straße 59a', 'fascia');
  output.features.push({
    id: '59a-north-lettering', kind: 'entrance-signage', sourceSurfaceIndices: [9, 1, 6],
    evidence: 'The pink lowercase wordmark stands on the northeast bicycle frontage; the narrow white address belongs directly over the central entrance.',
  });

  // Fine horizontal flashing follows the retained floor elevations. Clip it
  // at gallery/loggia openings instead of drawing strips across empty air.
  for (const front of [north, east, west]) {
    for (let floor = 1; floor < rows.length; floor++) {
      const y = rows[floor] + 0.025;
      let intervals = [[0.025, front.span - 0.025]];
      for (const index of front.indices) for (const ring of output.exclusionsBySurface.get(building.surfaces[index]) || []) {
        if (y < Math.min(...ring.map(p => p[1])) || y > Math.max(...ring.map(p => p[1]))) continue;
        const us = ring.map(point => helpers.dot(sub(point, front.start), front.u));
        const lo = Math.min(...us), hi = Math.max(...us);
        intervals = intervals.flatMap(([a, b]) => hi <= a || lo >= b ? [[a, b]]
          : [[a, Math.min(b, lo)], [Math.max(a, hi), b]].filter(([l, r]) => r - l > 0.01));
      }
      for (const [lo, hi] of intervals) {
        wall('windowFrame', facePoint(front, lo, 0.002), facePoint(front, hi, 0.002), y - 0.025, y + 0.008);
      }
    }
  }
  // Weathering only on the three supplied elevations. The south wall and
  // roof keep their existing material study and window assumptions.
  output.photoSurfaceIndices = [1, 2, 4, 6, 7, 9];
  output.features.push({
    id: '59a-resident-photo-registration', kind: 'photo-face-registration',
    sourceSurfaceIndices: [1, 2, 4, 6, 7, 9],
    photoFaces: {1: 'west', 2: 'north', 3: 'east', 4: 'north-east'},
    unphotographedSurfaceIndices: [3, 8],
    evidence: 'All four images are registered by corner loggias and matching east-window positions. The south face is not directly shown. Night glare, trees and cropped corners limit opening counts and southwest balcony dimensions.',
  });
}
