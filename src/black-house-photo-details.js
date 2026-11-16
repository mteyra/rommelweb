import {surfaceFrame} from './facade.js';

/**
 * Black / 49 — six resident photographs, 16 November 2026.
 * Photo 1 south, 2 southwest, 3 west, 4 northeast, 5 north entrance,
 * 6 southeast. X is east and Z is south in the retained campus frame.
 * Only exterior presentation is produced. The source shell, six floor guides
 * and independent room/door/stair/window plans are never modified.
 */
export function addBlackHousePhotoDetails({building, base, rows, highest, output, helpers}) {
  const {
    face, facePoint, faceMask, wall, quad, line, atY, add, sub, mul, dot, box,
  } = helpers;
  const se = [-66.440, 0, -59.092], sw = [-88.618, 0, -54.850];
  const ne = [-70.705, 0, -81.523], nw = [-92.882, 0, -77.291];
  // Left to right, as seen by someone standing outside each wall.
  const south = face([1], sw, se), east = face([9], se, ne);
  const west = face([2, 8], nw, sw), north = face([3, 0, 7, 4], ne, nw);
  const southFromEast = face([1], se, sw), westFromSouth = face([8, 2], sw, nw);
  const northFromWest = face([4, 7, 0, 3], nw, ne);
  // Keep the visible top-storey ceilings below the retained roof bed (−0.46 m).
  // Otherwise that roof surface intrudes into a recess when viewed from below.
  const roofSoffit = highest - 0.54;
  const evidence = 'Six resident photographs register all four elevations. Visible openings, blank timber, corner recesses and entrance identity follow overlapping photographs. Dimensions of details and recess depths are visual estimates inside the fixed source shell; existing apartment plans are unchanged.';

  function beam(front, u, y, width, height, depth = 0.035, inset = 0.08, role = 'detailGraphite') {
    box(role, atY(facePoint(front, u, inset), y),
      front.u, front.inward, width, depth, height, role);
  }
  function rail(front, left, right, bottom, inset = 0.10, screenEnd = left) {
    const lo = bottom + 0.13, hi = bottom + 1.08;
    beam(front, left, hi - 0.035, right - left, 0.04, 0.04, inset);
    beam(front, left, lo, right - left, 0.028, 0.03, inset);
    const count = Math.ceil((right - left) / 0.135);
    for (let i = 0; i <= count; i++) {
      beam(front, left + (right - left - 0.019) * i / count, lo,
        0.019, hi - lo, 0.025, inset);
    }
    for (let u = left; u < right - 0.04; u += 1.35) {
      beam(front, u, bottom + 0.035, 0.04, hi - bottom, 0.045, inset);
    }
    if (screenEnd > left) {
      const bays = Math.ceil((screenEnd - left) / 1.65);
      for (let i = 0; i < bays; i++) {
        wall('detailGraphite', facePoint(front, left + (screenEnd - left) * i / bays + 0.02, inset - 0.018),
          facePoint(front, left + (screenEnd - left) * (i + 1) / bays - 0.02, inset - 0.018),
          lo + 0.015, hi - 0.075);
      }
    }
  }

  function loggia(corner, floor, main, side, width, depth, screenWidth = 0) {
    const bottom = rows[floor] + 0.06, top = (rows[floor + 1] ?? highest) - 0.055;
    const ceiling = floor === rows.length - 1 ? roofSoffit : top - 0.25;
    const fasciaBottom = floor === rows.length - 1 ? ceiling : top - 0.27;
    faceMask(main, 0, width, bottom, top);
    faceMask(side, 0, depth, bottom, top);
    const a = main.start, b = facePoint(main, width);
    const d = facePoint(side, depth), c = add(b, sub(d, a));
    quad('detailThreshold', [a, b, c, d].map(p => atY(p, bottom)));
    quad('detailAcidShade', [a, b, c, d].map(p => atY(p, ceiling)));
    wall('detailAcidShade', b, c, bottom, top);
    wall('detailLimeShade', c, d, bottom, top);
    wall('detailAcidLime', a, b, fasciaBottom, top);
    wall('detailAcidLime', d, a, fasciaBottom, top);
    box('detailAcidLime', atY(facePoint(main, width * 0.36, 0.23), bottom),
      main.u, main.inward, 0.20, 0.20, ceiling - bottom, 'detailAcidShade');
    rail(main, 0.08, width - 0.08, bottom, 0.10, screenWidth);
    rail(side, 0.08, depth - 0.08, bottom);
    if (corner === 'southwest' && floor === 2) {
      const rear = u => add(add(d, mul(main.u, u)), mul(main.inward, -0.03));
      wall('detailGraphite', rear(width - 1.35), rear(width - 0.24), bottom + 0.06, bottom + 2.34);
      wall('detailGlazing', add(rear(width - 1.28), mul(main.inward, -0.018)),
        add(rear(width - 0.31), mul(main.inward, -0.018)), bottom + 0.13, bottom + 2.27);
    }
    output.features.push({
      id: `49-${corner}-loggia-${floor}`, kind: 'corner-loggia', corner, floor,
      sourceSurfaceIndices: [...main.indices, ...side.indices],
      frontWidth: width, returnWidth: depth, privacyScreenWidth: screenWidth,
      ceilingElevation: ceiling,
      planRing: [a, b, c, d, a].map(p => [p[0], p[2]]), evidence,
    });
  }
  loggia('southeast', 1, southFromEast, east, 8.80, 3.15, 5.75);
  loggia('southeast', 4, southFromEast, east, 8.80, 3.15);
  loggia('southwest', 2, westFromSouth, south, 9.30, 3.15, 1.85);
  loggia('southwest', 5, westFromSouth, south, 9.30, 3.15);
  loggia('northwest', 3, northFromWest, west, 7.64, 3.05);

  // Fractions run left-to-right from outside. Closed shutters remain windows.
  const southRows = {
    0: [0.754],
    1: [0.056, 0.210, 0.350, 0.505],
    2: [0.269, 0.410, 0.548, 0.640],
    3: [0.058, 0.210, 0.350, 0.505, 0.644],
    4: [0.132, 0.271, 0.410, 0.542],
    5: [0.204, 0.350, 0.492, 0.634],
  };
  const eastRows = {
    0: [0.114, 0.255, 0.396, 0.538, 0.678, 0.903],
    1: [0.203, 0.342, 0.480, 0.620, 0.758, 0.896],
    2: [0.066, 0.251, 0.390, 0.528, 0.666, 0.804, 0.942],
    3: [0.065, 0.204, 0.342, 0.480, 0.618, 0.756, 0.894],
    4: [0.250, 0.388, 0.526, 0.665, 0.803, 0.940],
    5: [0.065, 0.204, 0.342, 0.480, 0.618, 0.756, 0.894],
  };
  const westRows = {
    0: [], // Cage and wide service door are modeled separately below.
    1: [0.050, 0.180, 0.320, 0.460, 0.600],
    2: [0.105, 0.246, 0.386, 0.528],
    3: [0.200, 0.340, 0.480, 0.620],
    4: [0.070, 0.245, 0.385, 0.525, 0.620],
    5: [0.070, 0.210, 0.350, 0.490],
  };
  function windowRows(front, name, rowFractions, photos) {
    for (const index of front.indices) {
      const surface = building.surfaces[index], frame = surfaceFrame(surface);
      // The common builder clips registered rows to the original wall union,
      // including the two almost coplanar west source pieces.
      output.layoutsBySurface.set(surface, {
        replace: true, recessDepth: 0.14,
        rows: Object.entries(rowFractions).map(([floor, fractions]) => ({
          floor: Number(floor), centers: fractions.map(f => frame.project(facePoint(front, f * front.span))[0]),
          width: 1.10, height: floor === '0' ? 2.18 : 2.55,
          sillOffset: floor === '0' ? 0.10 : 0.14, headHeight: 0.28, transomRatio: 0.32,
        })),
      });
    }
    output.features.push({
      id: `49-${name}-window-rows`, kind: 'photographic-window-rows',
      sourceSurfaceIndices: front.indices, photos, centerFractions: rowFractions,
      rows: Object.entries(rowFractions).map(([floor, centers]) => ({
        floor: Number(floor), count: centers.length,
        coverage: floor === '0' ? 'visible ground openings; landscaping obscures small details' : 'photographed row',
      })), evidence,
    });
  }
  windowRows(south, 'south', southRows, [1, 2, 6]);
  windowRows(east, 'east', eastRows, [4, 6]);
  windowRows(west, 'west', westRows, [2, 3]);
  for (const index of north.indices) {
    output.layoutsBySurface.set(building.surfaces[index], {replace: true, rows: []});
  }

  // Shutter poses illustrate the photographs without changing the inventory.
  const shutters = [
    [south, 1, southRows[1], 1], [south, 2, [southRows[2][0], southRows[2][2]], 1],
    [south, 3, [southRows[3][1], southRows[3][3]], 1],
    [south, 4, [southRows[4][2]], 0.67],
    [east, 5, [eastRows[5][0], eastRows[5][4]], 0.45],
    [west, 1, [westRows[1][0], westRows[1][2]], 0.88],
  ];
  for (const [front, floor, fractions, closed] of shutters) for (const fraction of fractions) {
    const center = front.span * fraction, top = rows[floor] + 2.61;
    const bottom = top - 2.37 * closed;
    wall('detailGraphite', facePoint(front, center - 0.475, 0.052),
      facePoint(front, center + 0.475, 0.052), bottom, top);
    for (let y = bottom + 0.045; y < top; y += 0.055) {
      line('detailMetal', atY(facePoint(front, center - 0.47, 0.050), y),
        atY(facePoint(front, center + 0.47, 0.050), y));
    }
  }

  // Exact central north source segment. Cut continuously so timber belts
  // cannot close the five gallery landings above the open entrance.
  const gallery = face([0], [-78.345, 0, -80.049], [-85.222, 0, -78.755]);
  const left = 0.025, right = gallery.span - 0.025, depth = 2.12;
  const p = (u, y, inset = 0.03) => atY(facePoint(gallery, u, inset), y);
  faceMask(gallery, left, right, base + 0.015, highest - 0.015);
  function galleryDoor(lo, width, bottom, height, glazed, panelRole = 'detailGraphite', handle = true) {
    beam(gallery, lo, bottom, width, height, 0.022, depth - 0.050, 'detailGraphite');
    wall(glazed ? 'detailGlazing' : panelRole,
      facePoint(gallery, lo + 0.065, depth - 0.065), facePoint(gallery, lo + width - 0.065, depth - 0.065),
      bottom + 0.07, bottom + height - 0.07);
    if (handle) beam(gallery, lo + width - 0.17, bottom + 0.87, 0.025, 0.26, 0.03, depth - 0.098, 'detailMetal');
    if (glazed) beam(gallery, lo + 0.06, bottom + 0.76, width - 0.12, 0.055, 0.025, depth - 0.095);
  }
  for (let floor = 0; floor < rows.length; floor++) {
    const bottom = rows[floor] + 0.05;
    const top = floor === rows.length - 1 ? roofSoffit : rows[floor + 1] - (floor ? 0.19 : 0.53);
    const a = facePoint(gallery, left, 0.03), b = facePoint(gallery, right, 0.03);
    const c = facePoint(gallery, right, depth), d = facePoint(gallery, left, depth);
    quad('detailConcrete', [a, b, c, d].map(point => atY(point, bottom)));
    quad(floor ? 'detailConcrete' : 'detailBlackPorchSoffit', [a, b, c, d].map(point => atY(point, top)));
    wall(floor ? 'detailConcrete' : 'detailBlackPorchWall', a, d, bottom, top);
    wall(floor ? 'detailConcrete' : 'detailBlackPorchWall', c, b, bottom, top);
    wall(floor ? 'detailCoolRecess' : 'detailBlackPorchWall', d, c, bottom, top);
    if (floor) {
      beam(gallery, left, rows[floor] - 0.18, right - left, 0.23, depth - 0.06, 0.03, 'detailConcrete');
      rail(gallery, left + 0.05, right - 0.05, bottom, 0.11);
      galleryDoor(0.75, 1.12, bottom, 2.21, false);
      galleryDoor(right - 1.65, 1.10, bottom, 2.21, true);
      for (const u of [0.52, right - 1.97]) {
        beam(gallery, u, top - 0.15, 0.50, 0.08, 0.10, depth - 0.16, 'detailCoolLight');
      }
    } else {
      // Photo 5: open left passage, central pale paired panels,
      // right stair glazing and a mailbox bank on the right-hand reveal.
      wall('detailRecess', facePoint(gallery, 0.08, depth - 0.03),
        facePoint(gallery, 1.47, depth - 0.03), bottom, top - 0.05);
      galleryDoor(2.05, 1.62, bottom, 2.18, false, 'detailLightPanel', false);
      beam(gallery, 2.85, bottom + 0.03, 0.027, 2.09, 0.025, depth - 0.095);
      galleryDoor(4.12, 1.26, bottom, 2.24, true);
      beam(gallery, 5.61, bottom + 0.85, 0.28, 0.68, 0.06, depth - 0.09, 'detailGraphite');
      for (let i = 0; i < 9; i++) {
        beam(gallery, 5.65, bottom + 0.91 + i * 0.057, 0.18, 0.012, 0.025, depth - 0.11, 'detailMetal');
      }
      // Side-wall mailboxes carry no personal names or identifying data.
      const mail = (inset, y) => p(right - 0.022, y, inset);
      quad('detailGraphite', [mail(0.48, bottom + 0.64), mail(1.83, bottom + 0.64),
        mail(1.83, bottom + 1.85), mail(0.48, bottom + 1.85)]);
      for (let row = 0; row < 8; row++) for (let col = 0; col < 4; col++) {
        line('detailMetal', mail(0.51 + col * 0.325, bottom + 0.73 + row * 0.13),
          mail(0.79 + col * 0.325, bottom + 0.73 + row * 0.13));
      }
      for (const u of [0.90, 4.40]) {
        quad('detailCoolLight', [p(u, top - 0.025, 0.60), p(u + 1.30, top - 0.025, 0.60),
          p(u + 1.30, top - 0.025, 0.77), p(u, top - 0.025, 0.77)]);
      }
      // Only the photographed right side carries an entrance guard.
      rail(gallery, right - 1.25, right - 0.06, bottom, 0.10);
    }
  }
  beam(gallery, left, roofSoffit, right - left, highest - 0.015 - roofSoffit, depth - 0.06, 0.03, 'detailConcrete');
  beam(gallery, left, rows[1] - 0.53, right - left, 0.49, 0.055, 0.035, 'detailGraphite');
  function sign(id, front, lo, hi, bottom, top, inset, text, style, ink) {
    (output.signs ||= []).push({
      id, style, lines: [text], ...(ink ? {ink} : {}),
      corners: [atY(facePoint(front, lo, inset), bottom), atY(facePoint(front, hi, inset), bottom),
        atY(facePoint(front, hi, inset), top), atY(facePoint(front, lo, inset), top)],
    });
  }
  sign('49-address', gallery, 0.15, gallery.span - 0.15, rows[1] - 0.48, rows[1] - 0.10, 0.031,
    'Studentenwohnheim Erwin-Rommel-Straße 49', 'fascia');
  output.features.push({
    id: '49-north-stair', kind: 'recessed-stair-elevation', sourceSurfaceIndices: [0],
    width: gallery.span, depth, landingFloors: [1, 2, 3, 4, 5],
    topCeilingElevation: roofSoffit,
    evidence: `${evidence} Photos 4 and 5 show open gray landings, concrete slab edges, dark vertical railings and rear openings. No exterior zigzag stair is invented.`,
  }, {
    id: '49-north-entrance', kind: 'recessed-entrance', floor: 0, sourceSurfaceIndices: [0],
    width: gallery.span, depth, address: 'Erwin-Rommel-Straße 49',
    evidence: 'Photo 5 locates the open north porch beneath the address fascia, left passage, pale paired panels, right glazed stair access, intercom, side mailboxes and ceiling strip lights. The pale panels are not assigned an internal function. Visible surfaces do not alter internal doors or stairs.',
  });

  // Bicycle enclosure wraps northwest: long west frontage, short north wing.
  const cageHeight = rows[1] - base - 0.25, cageBottom = base + 0.06;
  const cageTop = cageBottom + cageHeight, cageDepth = 0.95;
  function bicycle(front, center) {
    const q = (u, y) => atY(facePoint(front, u, 0.59), cageBottom + y);
    const stroke = (a, b) => line('detailMetal', q(...a), q(...b));
    for (const wheel of [center - 0.51, center + 0.51]) {
      for (let i = 0; i < 24; i++) {
        const a = i * Math.PI / 12, b = (i + 1) * Math.PI / 12;
        stroke([wheel + Math.cos(a) * 0.31, 0.34 + Math.sin(a) * 0.31],
          [wheel + Math.cos(b) * 0.31, 0.34 + Math.sin(b) * 0.31]);
      }
    }
    const back = [center - 0.51, 0.34], crank = [center - 0.08, 0.29];
    const saddle = [center - 0.23, 0.85], head = [center + 0.30, 0.87], frontWheel = [center + 0.51, 0.34];
    for (const [a, b] of [[back, crank], [back, saddle], [saddle, crank], [crank, head], [saddle, head],
      [head, frontWheel], [saddle, [center - 0.24, 1.0]], [[center - 0.39, 1], [center - 0.10, 1]],
      [head, [center + 0.28, 1.13]], [[center + 0.28, 1.13], [center + 0.47, 1.13]]]) stroke(a, b);
  }
  function cage(front, left, right, name, startAtCorner) {
    faceMask(front, left, right, cageBottom, cageTop);
    const a = facePoint(front, left, 0.03), b = facePoint(front, right, 0.03);
    const c = facePoint(front, right, cageDepth), d = facePoint(front, left, cageDepth);
    quad('detailRecess', [a, b, c, d].map(p => atY(p, cageBottom)));
    quad('detailRecess', [a, b, c, d].map(p => atY(p, cageTop)));
    wall('detailRecess', facePoint(front, startAtCorner ? cageDepth : left, cageDepth),
      facePoint(front, startAtCorner ? right : front.span - cageDepth, cageDepth), cageBottom, cageTop);
    if (startAtCorner) wall('detailRecess', b, c, cageBottom, cageTop);
    else wall('detailRecess', a, d, cageBottom, cageTop);
    const bays = Math.ceil((right - left) / 2.70);
    for (let i = 0; i <= bays; i++) {
      beam(front, Math.min(right - 0.17, left + (right - left) * i / bays),
        cageBottom, 0.16, cageHeight, 0.16, 0.14, 'detailAcidLime');
    }
    for (const y of [cageBottom + 0.035, cageTop - 0.05]) {
      beam(front, left, y, right - left, 0.035, 0.035, 0.10);
    }
    for (let u = left + 0.13; u < right; u += 0.14) {
      line('detailRoofTexture', atY(facePoint(front, u, 0.10), cageBottom + 0.04),
        atY(facePoint(front, u, 0.10), cageTop - 0.05));
    }
    for (let y = cageBottom + 0.14; y < cageTop; y += 0.14) {
      line('detailRoofTexture', atY(facePoint(front, left, 0.10), y),
        atY(facePoint(front, right, 0.10), y));
    }
    let decorativeBicycles = 0;
    for (let u = left + 1.25; u < right - 0.95; u += 2.15) {
      bicycle(front, u); decorativeBicycles++;
    }
    output.features.push({
      id: `49-${name}-bicycle-storage`, kind: 'bike-storage', floor: 0,
      sourceSurfaceIndices: front.indices.filter(index => {
        const us = building.surfaces[index].points.map(p => dot(sub(p, front.start), front.u));
        return Math.min(...us) < right && Math.max(...us) > left;
      }), width: right - left, depth: cageDepth, decorativeBicycles,
      evidence: 'Photos 2–4 show a welded-wire bicycle enclosure wrapping the northwest ground corner, with lime supports and dark mesh. Parked bicycle silhouettes and mesh/bay dimensions are illustrative. This is exterior scenery only.',
    });
  }
  cage(west, 0.035, west.span * 0.615, 'west', true);
  cage(north, north.span - 7.72, north.span - 0.035, 'north', false);
  sign('49-schwarz-wordmark', north, north.span - 6.70, north.span - 0.75,
    base + 0.37, base + 2.22, 0.075, 'schwarz', 'wordmark', '#111b1a');

  // Photo 3's west double service door is distinct from the signed entrance.
  const serviceLeft = west.span * 0.76, serviceRight = serviceLeft + 2.05;
  const serviceTop = base + 2.35;
  faceMask(west, serviceLeft, serviceRight, base + 0.06, serviceTop);
  beam(west, serviceLeft, base + 0.06, 2.05, serviceTop - base - 0.06, 0.04, 0.065);
  for (const u of [serviceLeft + 0.055, serviceLeft + 1.045]) {
    wall('windowFrame', facePoint(west, u, 0.055), facePoint(west, u + 0.93, 0.055),
      base + 0.13, serviceTop - 0.065);
  }
  beam(west, serviceLeft + 1.015, base + 0.10, 0.035, serviceTop - base - 0.12, 0.025, 0.03);
  for (const u of [serviceLeft + 0.89, serviceLeft + 1.12]) {
    beam(west, u, base + 1.00, 0.025, 0.25, 0.025, 0.025, 'detailMetal');
  }
  output.features.push({
    id: '49-west-service-door', kind: 'service-door', floor: 0, sourceSurfaceIndices: [8],
    width: 2.05, evidence: 'Photo 3 shows a dark double service door to the right of the bicycle cage; it is not the signed main entrance. Width and hardware are estimated.',
  });

  // Clipped narrow plinth and roof trim; no belt crosses an open recess.
  for (const front of [south, east, west, north]) {
    for (const [bottom, top] of [[base + 0.025, base + 0.065], [highest - 0.065, highest - 0.012]]) {
      let intervals = [[0.025, front.span - 0.025]];
      for (const index of front.indices) for (const ring of output.exclusionsBySurface.get(building.surfaces[index]) || []) {
        if (Math.max(...ring.map(p => p[1])) <= bottom || Math.min(...ring.map(p => p[1])) >= top) continue;
        const us = ring.map(p => dot(sub(p, front.start), front.u));
        const lo = Math.min(...us), hi = Math.max(...us);
        intervals = intervals.flatMap(([a, b]) => hi <= a || lo >= b ? [[a, b]]
          : [[a, Math.min(b, lo)], [Math.max(a, hi), b]].filter(([l, r]) => r - l > 0.01));
      }
      for (const [lo, hi] of intervals) {
        faceMask(front, lo, hi, bottom, top);
        wall('detailGraphite', facePoint(front, lo, 0.025), facePoint(front, hi, 0.025), bottom, top);
      }
    }
  }
  output.features.push({
    id: '49-resident-photo-registration', kind: 'photo-face-registration',
    sourceSurfaceIndices: [0, 1, 2, 3, 4, 7, 8, 9],
    photoFaces: {1: 'south', 2: 'southwest', 3: 'west', 4: 'northeast', 5: 'north entrance', 6: 'southeast'},
    evidence,
  });
}
