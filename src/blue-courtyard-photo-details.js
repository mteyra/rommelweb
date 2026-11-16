import {surfaceFrame} from './facade.js';

/** Seven resident photos, 16 November 2026. Exterior appearance only. */
export const BLUE_PHOTO_FACADES = Object.freeze([
  {name: 'northeast', indices: [2], start: [-12.330, 0, 31.066], end: [-27.730, 0, 14.365],
    centers: [0.286, 0.364, 0.499, 0.625, 0.770, 0.898], photos: [1]},
  {name: 'southeast', indices: [4], start: [-29.024, 0, 46.518], end: [-12.330, 0, 31.066],
    centers: [0.080, 0.214, 0.352, 0.496, 0.632, 0.766, 0.892], photos: [2, 3]},
  {name: 'southwest', indices: [6], start: [-44.433, 0, 29.797], end: [-29.024, 0, 46.518],
    centers: [0.085, 0.220, 0.353, 0.485, 0.628, 0.710], photos: [3, 4, 7]},
  {name: 'northwest', indices: [3, 1, 5], start: [-27.730, 0, 14.365], end: [-44.433, 0, 29.797],
    centers: [0.267, 0.370, 0.615, 0.705], photos: [5, 6, 7]},
]);

/** Geometry is subordinate to the retained shell; no floor data is written. */
export function addBlueCourtyardPhotoDetails({building, base, rows, highest, output, helpers}) {
  const {face, facePoint, faceMask, wall, quad, line, atY, lerp, dot, sub} = helpers;
  const height = highest - base, y = fraction => base + height * fraction;
  const facades = BLUE_PHOTO_FACADES.map(spec => ({...spec, ...face(spec.indices, spec.start, spec.end)}));
  const [northeast, southeast, southwest, northwest] = facades;
  const bottoms = {1: y(0.393), 2: y(0.670)}, tops = {1: y(0.607), 2: y(0.896)}, width = 1.10;
  const evidence = 'Seven resident photographs show every elevation. Relative placements follow cross-view comparison and coarse planar rectification; widths, recess depths and hardware are unmeasured appearance estimates.';
  output.photoSurfaceIndices = [1, 2, 3, 4, 5, 6];
  // The taller ground cladding band is independent of all saved floor guides.
  output.claddingElevations = [base, y(0.39), y(0.666), highest];
  function panel(target, left, right, bottom, top, inset = -0.012, role = 'detailGraphite') {
    wall(role, facePoint(target, left, inset), facePoint(target, right, inset), bottom, top);
  }
  function sign(id, target, left, right, bottom, top, inset, text, style = 'fascia', color) {
    (output.signs ||= []).push({id, lines: [text], style, ...(color ? {ink: color} : {}), width: right - left, height: top - bottom,
      corners: [atY(facePoint(target, left, inset), bottom), atY(facePoint(target, right, inset), bottom),
        atY(facePoint(target, right, inset), top), atY(facePoint(target, left, inset), top)]});
  }
  function disc(target, horizontal, elevation, radius, inset) {
    const vertices = output.triangleLayers.detailBlueShopGreen ||= [];
    const center = atY(facePoint(target, horizontal, inset), elevation);
    const point = angle => atY(facePoint(target, horizontal + radius * Math.cos(angle), inset), elevation + radius * Math.sin(angle));
    for (let i = 0; i < 32; i++) vertices.push(...center, ...point(i * Math.PI / 16), ...point((i + 1) * Math.PI / 16));
  }
  for (const target of facades) {
    for (const index of target.indices) {
      const surface = building.surfaces[index], frame = surfaceFrame(surface);
      const centers = target.centers.map(fraction => frame.project(lerp(target.start, target.end, fraction))[0]);
      output.layoutsBySurface.set(surface, {replace: true, replaceLocatedFloors: [0, 1, 2], recessDepth: 0.14,
        rows: [1, 2].map(floor => ({floor, centers: [...centers], width, height: tops[floor] - bottoms[floor],
          sillOffset: bottoms[floor] - rows[floor], headHeight: 0.085, headStyle: 'solid', transomRatio: 0.35}))});
    }
    // Permanent charcoal connector panels bridge the aligned upper windows.
    for (const fraction of target.centers) {
      const left = target.span * fraction - width / 2, right = left + width;
      // Respect the window generator's 25 mm clearance around each aperture.
      faceMask(target, left, right, tops[1] + 0.031, bottoms[2] - 0.031);
      panel(target, left, right, tops[1], bottoms[2], -0.012);
    }
    panel(target, 0.012, target.span - 0.012, base + 0.02, base + 0.14);
    panel(target, 0.012, target.span - 0.012, highest - 0.075, highest - 0.008);
    for (const elevation of output.claddingElevations.slice(1, -1)) {
      panel(target, 0.012, target.span - 0.012, elevation - 0.025, elevation + 0.025, -0.018);
    }
    output.features.push({id: `51a-${target.name}-window-rows`, kind: 'photographic-window-rows', sourceSurfaceIndices: target.indices,
      photos: target.photos, rows: [1, 2].map(floor => ({floor, count: target.centers.length, coverage: 'photographed complete elevation'})),
      aligned: true, centerFractions: target.centers, evidence});
  }
  const groundBottom = base + 0.06, groundTop = y(0.313);
  function glazedOpening(target, left, right, divisions, {depth = 0.16, shop = false, transom = false, doorBays = []} = {}) {
    faceMask(target, left, right, groundBottom, groundTop);
    const a = facePoint(target, left), b = facePoint(target, right), c = facePoint(target, right, depth), d = facePoint(target, left, depth);
    wall('detailGraphite', a, d, groundBottom, groundTop); wall('detailGraphite', c, b, groundBottom, groundTop);
    quad('detailGraphite', [a, b, c, d].map(p => atY(p, groundTop)));
    quad('detailThreshold', [a, b, c, d].map(p => atY(p, groundBottom)));
    wall(shop ? 'detailBlueShopGlass' : 'detailGlazing', d, c, groundBottom, groundTop);
    const inset = depth - 0.028;
    for (let i = 0; i <= divisions; i++) {
      const u = left + (right - left) * i / divisions;
      panel(target, Math.max(left, u - 0.04), Math.min(right, u + 0.04), groundBottom, groundTop, inset);
    }
    for (const elevation of [groundBottom + 0.045, groundTop - 0.045]) panel(target, left, right, elevation - 0.04, elevation + 0.04, inset);
    if (transom) panel(target, left, right, groundTop - 0.79, groundTop - 0.72, inset);
    for (const bay of doorBays) {
      const a = left + (right - left) * bay / divisions, b = left + (right - left) * (bay + 1) / divisions;
      if (!transom) panel(target, a, b, groundTop - 0.57, groundTop - 0.50, inset);
      panel(target, b - 0.17, b - 0.14, base + 0.96, base + 1.29, inset - 0.015, 'detailMetal');
    }
    return {left, right, depth, divisions};
  }
  // NE: four dark bays between substantial blank timber spans.
  const courtyard = glazedOpening(northeast, northeast.span * 0.390, northeast.span * 0.665, 4, {doorBays: [0]});
  output.features.push({id: '51a-courtyard-shared-glazing', kind: 'shared-ground-glazing', floor: 0, sourceSurfaceIndices: [2],
    divisions: 4, openingFractions: [0.390, 0.665], depth: courtyard.depth, evidence});
  // SE: first six columns continue to the ground. No aperture under column seven.
  const groundCenters = southeast.centers.slice(0, 6);
  for (const fraction of groundCenters) {
    const left = southeast.span * fraction - width / 2;
    glazedOpening(southeast, left, left + width, 1, {transom: true});
  }
  output.features.push({id: '51a-southeast-ground-windows', kind: 'shared-ground-windows', floor: 0, sourceSurfaceIndices: [4],
    count: 6, centerFractions: groundCenters, evidence: `${evidence} The bicycles are parked outside six glazed openings, not inside an open bicycle cage.`});
  // SW: restaurant front ends at approximately 60% of the wall.
  const restaurantSW = glazedOpening(southwest, southwest.span * 0.012, southwest.span * 0.595, 9, {shop: true, doorBays: [2, 8]});
  output.features.push({id: '51a-southwest-shared-glazing', kind: 'shared-ground-glazing', floor: 0, sourceSurfaceIndices: [6],
    divisions: 9, openingFractions: [0.012, 0.595], depth: restaurantSW.depth, evidence});

  // NW: existing central source segment registers the recessed dorm entrance.
  const entranceUs = building.surfaces[1].points.map(p => dot(sub(p, northwest.start), northwest.u));
  const entranceLeft = Math.min(...entranceUs), entranceRight = Math.max(...entranceUs);
  const entry = face([1], facePoint(northwest, entranceLeft), facePoint(northwest, entranceRight));
  const recess = 0.90, entryTop = groundTop;
  faceMask(entry, 0, entry.span, groundBottom, entryTop);
  const ea = entry.start, eb = entry.end, ec = facePoint(entry, entry.span, recess), ed = facePoint(entry, 0, recess);
  wall('detailGraphite', ea, ed, groundBottom, entryTop); wall('detailGraphite', ec, eb, groundBottom, entryTop);
  wall('detailGraphite', ed, ec, groundBottom, entryTop);
  quad('detailSoffit', [ea, eb, ec, ed].map(p => atY(p, entryTop)));
  quad('detailThreshold', [ea, eb, ec, ed].map(p => atY(p, groundBottom)));
  const doorLeft = 0.14, doorRight = entry.span * 0.67, doorBottom = groundBottom + 0.035, doorTop = entryTop - 0.22;
  const middle = (doorLeft + doorRight) / 2;
  panel(entry, doorLeft, doorRight, doorBottom, doorTop, recess - 0.020, 'detailBlueShopGlass');
  for (const x of [doorLeft, middle, doorRight]) panel(entry, x - 0.035, x + 0.035, doorBottom, doorTop, recess - 0.045);
  for (const elevation of [doorBottom + 0.04, doorTop - 0.04, doorTop - 0.61, base + 1.14]) {
    panel(entry, doorLeft, doorRight, elevation - 0.03, elevation + 0.03, recess - 0.047);
  }
  panel(entry, middle + 0.09, middle + 0.115, base + 1.03, base + 1.34, recess - 0.065, 'detailMetal');
  panel(entry, entry.span - 0.58, entry.span - 0.22, base + 0.93, base + 1.80, recess - 0.03, 'detailMetal');
  panel(entry, entry.span - 0.55, entry.span - 0.25, base + 1.23, base + 1.53, recess - 0.05, 'detailLightPanel');
  // Header is in the wall opening, not hidden behind a source timber fascia.
  panel(entry, 0, entry.span, entryTop - 0.28, entryTop, -0.014);
  sign('51a-entrance-address', entry, 0.10, entry.span - 0.10, entryTop - 0.235, entryTop - 0.07, -0.025,
    'Studentenwohnheim  Erwin-Rommel-Straße 51a');
  sign('51a-entrance-blau', entry, doorLeft + 0.10, middle - 0.08, base + 1.20, base + 1.59, recess - 0.058,
    'blau', 'wordmark', '#3b70ae');
  quad('detailCoolLight', [
    facePoint(entry, 0.48, 0.23), facePoint(entry, entry.span - 0.95, 0.23),
    facePoint(entry, entry.span - 0.95, 0.31), facePoint(entry, 0.48, 0.31),
  ].map(p => atY(p, entryTop - 0.012)));
  output.features.push({id: '51a-recessed-entrance', kind: 'recessed-entrance', floor: 0, sourceSurfaceIndices: [1],
    openingFractions: [entranceLeft / northwest.span, entranceRight / northwest.span], width: entry.span, depth: recess,
    doorCount: 1, sidelightCount: 1, evidence: `${evidence} Northwest entry: left fixed light marked blau, one glazed entry leaf, charcoal intercom panel to the right and illuminated address header.`});

  const restaurantNW = glazedOpening(northwest, entranceRight + 0.045, northwest.span - 0.09, 6, {shop: true});
  // Photo 7: saturated green infill just before a charcoal corner post.
  const greenLeft = northwest.span - 1.22, greenRight = northwest.span - 0.43;
  panel(northwest, greenLeft, greenRight, groundBottom + 0.08, groundTop - 0.08, 0.098, 'detailBlueShopGreen');
  for (const fraction of [0.29, 0.58]) line('detailGraphite',
    atY(facePoint(northwest, greenLeft + (greenRight - greenLeft) * fraction, 0.092), groundBottom + 0.10),
    atY(facePoint(northwest, greenLeft + (greenRight - greenLeft) * fraction, 0.092), groundTop - 0.10));
  panel(northwest, northwest.span - 0.42, northwest.span - 0.01, groundBottom, groundTop, -0.010);
  panel(southwest, 0.012, 0.16, groundBottom, groundTop, -0.010);
  output.features.push({id: '51a-northwest-restaurant-glazing', kind: 'restaurant-corner-glazing', floor: 0, sourceSurfaceIndices: [5],
    divisions: 6, openingFractions: [restaurantNW.left / northwest.span, restaurantNW.right / northwest.span],
    depth: restaurantNW.depth, corner: 'west', greenCornerPanel: true, evidence});
  for (const target of [northwest, southwest]) {
    const opening = target === northwest ? restaurantNW : restaurantSW;
    const fractions = target === northwest ? [0.14, 0.33, 0.51, 0.69] : [0.13, 0.34, 0.57, 0.72];
    for (const fraction of fractions) disc(target, opening.left + (opening.right - opening.left) * fraction,
      groundTop - 0.51, 0.18, opening.depth - 0.045);
    const center = opening.left + (opening.right - opening.left) * 0.53;
    sign(`51a-${target.name}-restaurant-sign`, target, center - 0.62, center + 0.62, base + 1.08, base + 1.28,
      opening.depth - 0.05, 'Dönereria');
  }
  // Thin shallow housing in the blank SW middle band, not a balcony platform.
  panel(southwest, southwest.span * 0.77, southwest.span * 0.96, y(0.470), y(0.478), -0.024);
  function blind(target, floor, column, coverage) {
    const center = target.span * target.centers[column], left = center - width / 2 + 0.075, right = center + width / 2 - 0.075;
    const top = tops[floor] - 0.085, bottom = top - (top - bottoms[floor] - 0.08) * coverage;
    panel(target, left, right, bottom, top, 0.104, 'detailBlueBlind');
    for (let elevation = bottom + 0.055; elevation < top - 0.02; elevation += 0.055) line('detailGraphite',
      atY(facePoint(target, left, 0.099), elevation), atY(facePoint(target, right, 0.099), elevation));
  }
  // Sample visible blind poses, without classifying a shutter as a missing window.
  for (const [target, floor, column, coverage] of [
    [northeast, 1, 2, 1], [northeast, 1, 3, 1], [northeast, 2, 4, 1],
    [southeast, 1, 0, 0.78], [southeast, 2, 0, 0.56], [southeast, 2, 3, 1],
    [southwest, 1, 1, 0.46], [southwest, 1, 2, 0.65], [southwest, 2, 2, 1],
  ]) blind(target, floor, column, coverage);
  output.features.push({id: '51a-four-elevation-registration', kind: 'photo-face-registration', sourceSurfaceIndices: output.photoSurfaceIndices,
    photos: {1: 'northeast', 2: 'southeast', 3: 'southwest and southeast', 4: 'southwest', 5: 'northwest and northeast',
      6: 'northwest entrance', 7: 'west restaurant corner'}, balconies: 0, openBicycleEnclosures: 0, evidence});
}
