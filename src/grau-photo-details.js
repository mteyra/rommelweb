import {addGrauWindowLayouts} from './grau-window-layout.js';
import {addGrauBicycleDetails} from './grau-bicycle-details.js';

/**
 * Grau / 55a, seven resident photographs, November 2026.
 * Coordinates remain in the official campus metre frame. Only the displayed
 * wall surfaces are opened: source shell, dimensions and interiors are fixed.
 * Recess depths and construction sizes are photographic estimates.
 */
export function addGrauPhotoDetails({building, base, rows, highest, output, helpers}) {
  const {face, facePoint, faceMask, quad, wall, line, box, atY, add, sub, mul, dot} = helpers;
  const nw = [12.881, 0, -30.699], ne = [34.692, 0, -36.870];
  const sw = [19.092, 0, -8.705], se = [40.872, 0, -14.857];
  const north = face([6, 4, 0, 2], ne, nw), east = face([7], ne, se);
  const south = face([5, 3], sw, se), west = face([9], nw, sw);
  const northWest = face([2, 0, 4, 6], nw, ne), eastSouth = face([7], se, ne);
  const southEast = face([3, 5], se, sw), westSouth = face([9], sw, nw);
  const evidence = 'Seven resident photos register all four elevations. Storeys, corner relationships and visible openings follow the photos; dimensions of facade fittings and recesses remain estimates.';

  function beam(front, left, bottom, width, height, inset = 0.08, depth = 0.035, role = 'detailGraphite') {
    box(role, atY(facePoint(front, left, inset), bottom), front.u, front.inward, width, depth, height, role);
  }
  function rail(front, left, right, bottom) {
    for (const y of [bottom + 0.12, bottom + 1.08]) beam(front, left, y, right - left, 0.035);
    const count = Math.ceil((right - left) / 0.135);
    for (let i = 0; i <= count; i++) beam(front, left + (right - left - 0.020) * i / count,
      bottom + 0.12, 0.020, 0.96, 0.09, 0.024);
    for (let x = left; x <= right; x += 1.45) beam(front, x, bottom + 0.04, 0.044, 1.075, 0.08, 0.044);
  }
  function loggia(id, corner, floor, main, side, width, depth) {
    const bottom = rows[floor] + 0.08, top = (rows[floor + 1] ?? highest) - 0.16;
    faceMask(main, 0, width, bottom, top);
    faceMask(side, 0, depth, bottom, top);
    const a = main.start, b = facePoint(main, width), d = facePoint(side, depth), c = add(b, sub(d, a));
    quad('detailThreshold', [a, b, c, d].map(p => atY(p, bottom)));
    quad('detailAcidShade', [a, b, c, d].map(p => atY(p, top - 0.20)));
    wall('detailAcidShade', b, c, bottom, top);
    wall('detailAcidShade', c, d, bottom, top);
    wall('detailAcidLime', a, b, top - 0.24, top);
    wall('detailAcidLime', d, a, top - 0.24, top);
    box('detailAcidLime', atY(facePoint(main, width * 0.37, 0.23), bottom),
      main.u, main.inward, 0.20, 0.20, top - bottom - 0.20, 'detailAcidShade');
    // Lime ceiling ribs are visible behind the fascia in photos 1, 3 and 4.
    const rib = facePoint(main, width * 0.37, 0.23);
    box('detailAcidLime', atY(rib, top - 0.32), main.u, main.inward,
      0.18, Math.max(0.18, depth - 0.24), 0.13, 'detailAcidShade');
    rail(main, 0.08, width - 0.08, bottom);
    rail(side, 0.08, depth - 0.08, bottom);
    // One recessed access opening is discernible at the inner end; it is an
    // exterior fitting and does not create a door or route in any floorplan.
    const doorLeft = width - 1.62, doorRight = width - 0.49;
    const rear = x => add(add(d, mul(main.u, x)), mul(main.inward, -0.025));
    wall('detailGraphite', rear(doorLeft), rear(doorRight), bottom + 0.03, top - 0.45);
    wall('detailGlazing', add(rear(doorLeft + 0.08), mul(main.inward, -0.012)),
      add(rear(doorRight - 0.08), mul(main.inward, -0.012)), bottom + 0.12, top - 0.53);
    output.features.push({
      id, kind: 'corner-loggia', corner, floor, frontWidth: width, returnWidth: depth,
      sourceSurfaceIndices: [...main.indices, ...side.indices],
      planRing: [a, b, c, d, a].map(p => [p[0], p[2]]),
      evidence: `${evidence} Lime soffit/fascia, column and open dark picket rails wrap both corner faces. The recessed access opening is a photographic approximation.`,
    });
  }
  loggia('55a-lower-northwest-loggia', 'northwest', 1, northWest, west, 6.90, 3.05);
  loggia('55a-lower-southwest-loggia', 'southwest', 2, south, westSouth, 6.90, 3.00);
  loggia('55a-middle-southeast-loggia', 'southeast', 3, eastSouth, southEast, 9.43, 3.20);
  loggia('55a-upper-northeast-loggia', 'northeast', 4, north, east, 7.30, 2.85);
  loggia('55a-top-southwest-loggia', 'southwest', 5, south, westSouth, 6.90, 3.00);

  // Exact endpoints of the existing central north source face. Viewed from
  // outside, its local direction runs screen-left to screen-right.
  const gallery = face([0], [27.153, 0, -34.724], [20.409, 0, -32.816]);
  const left = 0.025, right = gallery.span - 0.025, depth = 2.10;
  const p = (x, y, inset = depth - 0.04) => atY(facePoint(gallery, x, inset), y);
  function door(x, width, bottom, height, glazed = true) {
    beam(gallery, x, bottom, width, height, depth - 0.035, 0.026);
    wall(glazed ? 'detailGlazing' : 'detailCoolRecess',
      facePoint(gallery, x + 0.055, depth - 0.05),
      facePoint(gallery, x + width - 0.055, depth - 0.05), bottom + 0.06, bottom + height - 0.055);
    if (glazed) beam(gallery, x + 0.04, bottom + height * 0.33, width - 0.08, 0.045, depth - 0.070, 0.023);
    beam(gallery, x + width - 0.17, bottom + 0.87, 0.025, 0.27, depth - 0.10, 0.03, 'detailMetal');
  }
  for (let floor = 0; floor < rows.length; floor++) {
    const bottom = rows[floor] + 0.06;
    const top = (rows[floor + 1] ?? highest) - (floor ? 0.19 : 0.43);
    faceMask(gallery, left, right, bottom, top);
    const a = facePoint(gallery, left), b = facePoint(gallery, right);
    const c = facePoint(gallery, right, depth), d = facePoint(gallery, left, depth);
    quad('detailThreshold', [a, b, c, d].map(v => atY(v, bottom)));
    quad('detailConcrete', [a, b, c, d].map(v => atY(v, top)));
    wall('detailCoolRecess', a, d, bottom, top);
    wall('detailCoolRecess', c, b, bottom, top);
    wall(floor ? 'detailCoolRecess' : 'detailGraphite', d, c, bottom, top);
    if (floor) {
      // Fully remove the source timber belt before adding the slab fascia.
      faceMask(gallery, left, right, rows[floor] - 0.19, bottom);
      beam(gallery, left, rows[floor] - 0.19, right - left, 0.25, 0.002, depth, 'detailConcrete');
      rail(gallery, left + 0.065, right - 0.065, bottom);
      door(1.46, 1.05, bottom + 0.035, 2.20);
      door(4.58, 0.98, bottom + 0.035, 2.20, false);
      // A shaded side passage reads behind each rail; no exposed zigzag
      // stairs cross the facade in the resident's head-on photograph.
      wall('detailGraphite', facePoint(gallery, 0.16, depth - 0.055),
        facePoint(gallery, 0.88, depth - 0.055), bottom + 0.08, top - 0.11);
      beam(gallery, 3.40, top - 0.32, 0.27, 0.13, depth - 0.14, 0.09, 'detailCoolLight');
      beam(gallery, 3.04, top - 0.045, 1.15, 0.05, 0.60, 0.10, 'detailMetal');
      output.features.push({
        id: `55a-north-landing-${floor}`, kind: 'open-access-landing', floor,
        sourceSurfaceIndices: [0], width: right - left, depth,
        evidence: 'Photo 4 shows one concrete landing and dark vertical railing per upper floor, with cool fixtures and recessed doors.',
      });
    } else {
      // Blue-tinted central entrance, mailboxes on its left and a narrow
      // service cabinet on its right, as visible in the frontal photo.
      door(3.16, 1.24, bottom + 0.015, 2.42);
      beam(gallery, 3.22, bottom + 0.09, 1.12, 2.25, depth - 0.071, 0.014, 'detailGrauEntryGlass');
      beam(gallery, 3.23, bottom + 2.02, 1.10, 0.028, depth - 0.091, 0.025);
      beam(gallery, 4.18, bottom + 1.0, 0.035, 0.36, depth - 0.108, 0.04, 'detailMetal');
      beam(gallery, 0.20, bottom + 0.82, 1.60, 1.13, depth - 0.09, 0.075, 'detailMetal');
      for (let row = 0; row < 6; row++) for (let col = 0; col < 6; col++) {
        const x = 0.23 + col * 0.255, y = bottom + 0.85 + row * 0.18;
        beam(gallery, x, y, 0.235, 0.145, depth - 0.11, 0.012);
        line('detailMetal', p(x + 0.03, y + 0.11, depth - 0.125), p(x + 0.19, y + 0.11, depth - 0.125));
      }
      beam(gallery, 2.46, bottom + 1.09, 0.29, 0.58, depth - 0.10, 0.045, 'detailMetal');
      beam(gallery, 2.43, bottom + 1.74, 0.33, 0.31, depth - 0.13, 0.06, 'detailCoolLight');
      beam(gallery, 5.52, bottom + 0.08, 0.76, 2.13, depth - 0.07, 0.05, 'detailConcrete');
      beam(gallery, 5.58, bottom + 0.15, 0.64, 1.99, depth - 0.095, 0.025, 'detailRecess');
      beam(gallery, 2.42, top - 0.13, 2.04, 0.07, 0.50, 0.12, 'detailCoolLight');
    }
  }
  faceMask(gallery, left, right, highest - 0.19, highest - 0.005);
  beam(gallery, left, highest - 0.19, right - left, 0.185, 0.002, depth, 'detailConcrete');
  // The fascia is a thin dark band at the mouth of the recessed entrance.
  const fasciaBottom = rows[1] - 0.43, fasciaTop = rows[1] - 0.06;
  faceMask(gallery, left, right, fasciaBottom, rows[1] - 0.19);
  beam(gallery, left, fasciaBottom, right - left, fasciaTop - fasciaBottom, -0.004, 0.11);
  (output.signs ||= []).push({
    id: '55a-entrance-address', style: 'fascia',
    lines: ['Studentenwohnheim  Erwin-Rommel-Straße 55a'],
    corners: [p(left + 0.13, fasciaBottom + 0.035, -0.016), p(right - 0.13, fasciaBottom + 0.035, -0.016),
      p(right - 0.13, fasciaTop - 0.035, -0.016), p(left + 0.13, fasciaTop - 0.035, -0.016)],
  });
  output.features.push({
    id: '55a-north-stair', kind: 'recessed-stair-elevation',
    sourceSurfaceIndices: [0], width: gallery.span, depth, landingFloors: [1, 2, 3, 4, 5],
    evidence: 'Photos 4/5 show five open landings exactly above the central entrance; the flanking north timber wings have no bedroom-window grid. Stair circulation inside remains unchanged.',
  }, {
    id: '55a-north-entrance', kind: 'recessed-entrance', floor: 0,
    sourceSurfaceIndices: [0], width: gallery.span, depth, doorCount: 1,
    evidence: 'Photo 4 locates the blue-tinted tall entry door beneath the address, with mailboxes on its left and a service cabinet on its right. Photo 5 confirms the entrance on the north beside the bicycle cage.',
  });

  addGrauBicycleDetails({building, base, rows, highest, output, helpers});
  addGrauWindowLayouts({building, output});
  // Small dark flashings on the horizontal storey joints. Clip every opening
  // so no strip floats across the gallery, loggias or bicycle enclosure.
  for (const front of [north, east, south, west]) {
    for (let floor = 1; floor < rows.length; floor++) {
      const y = rows[floor] + 0.02;
      let spans = [[0.015, front.span - 0.015]];
      for (const index of front.indices) for (const ring of output.exclusionsBySurface.get(building.surfaces[index]) || []) {
        if (y < Math.min(...ring.map(p => p[1])) || y > Math.max(...ring.map(p => p[1]))) continue;
        const xs = ring.map(p => dot(sub(p, front.start), front.u)), lo = Math.min(...xs), hi = Math.max(...xs);
        spans = spans.flatMap(([a, b]) => hi <= a || lo >= b ? [[a, b]]
          : [[a, Math.min(lo, b)], [Math.max(hi, a), b]].filter(([l, r]) => r - l > 0.01));
      }
      for (const [lo, hi] of spans) wall('detailGraphite',
        facePoint(front, lo, -0.003), facePoint(front, hi, -0.003), y - 0.027, y + 0.012);
    }
  }
  output.photoSurfaceIndices = [0, 2, 3, 4, 5, 6, 7, 9];
  output.features.push({
    id: '55a-seven-photo-registration', kind: 'photo-face-registration',
    sourceSurfaceIndices: output.photoSurfaceIndices,
    photoFaces: {1: 'east', 2: 'east', 3: 'south / southeast', 4: 'north', 5: 'northeast', 6: 'west', 7: 'west'},
    evidence: `${evidence} Night glare and branches obscure portions of the south and west window rows; those positions carry lower confidence. Bright green horizontal streaks are lens reflections, not facade fixtures.`,
  });
}
