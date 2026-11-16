import {surfaceFrame} from './facade.js';

/**
 * Orange's three November 16 photographs, registered to the retained LoD2
 * envelope. Everything here belongs to the folded exterior display; no room,
 * layout window, route, floor section or source coordinate is written.
 */
export function addHouse53PhotoDetails({building, base, rows, highest, output, helpers}) {
  const {face, facePoint, faceMask, wall, quad, line, wire, mask, closed, atY,
    add, sub, mul, unit, dot, lerp, box} = helpers;
  const evidence = 'Resident eight-photo request, images 6–8: photographed Orange entrance and left end. Source-face registration is geometric; opening dimensions, fixtures and offsets remain unmeasured appearance estimates.';
  const front = face([26], [-26.504, 0, -38.256], [-23.006, 0, -41.472]);
  // This re-entrant H-shaped frontage faces away from the overall centroid.
  // Its interior is northwest of the boundary, beneath source roof30.
  front.inward = [-front.u[2], 0, front.u[0]];
  front.inward = mul(front.inward, -1);
  const glazedReturn = face([36], [-30.890, 0, -43.063], [-26.504, 0, -38.256]);
  const entry = face([46], [-21.718, 0, -40.067], [-19.484, 0, -42.112]);
  const roomFace = face([22], [-19.447, 0, -42.146], [-14.196, 0, -36.393]);
  const outerRoomFace = face([36], [-41.299, 0, -54.471], [-26.504, 0, -38.256]);
  const endRoomFace = face([33], [-32.621, 0, -57.457], [-22.027, 0, -67.133]);
  const floor = base + 0.045, glazingBottom = base + 0.12, glazingTop = 4.88;

  function photoRows(index, target, entries, options = {}) {
    const surface = building.surfaces[index], frame = surfaceFrame(surface);
    const displayRows = entries.map(([floor, centers, extra = {}]) => ({
      floor, centers: centers.map(center => frame.project(facePoint(target, center))[0]), ...extra,
    }));
    output.layoutsBySurface.set(surface, {
      replace: false, rows: displayRows, ...options,
      evidence: `${evidence} Corresponding rows share one set of horizontal centers; no internal room or window record is moved.`,
    });
    output.features.push({
      id: `53-observed-window-rows-${index}`, kind: 'photographic-window-rows',
      sourceSurfaceIndices: [index], rows: displayRows.map(row => ({floor: row.floor, count: row.centers.length})),
      evidence,
    });
  }
  // Four upper / five lower columns can be counted on the oblique outer wing.
  // The fifth lower column occupies the existing low roof step.
  const outerUpper = [4.30, 7.40, 10.50, 13.60];
  photoRows(36, outerRoomFace, [[0, [1.20, ...outerUpper]], [1, [1.20, ...outerUpper]], [2, outerUpper]]);
  const entranceUpper = [0.90, 3.35, 6.65], entranceLower = entranceUpper.slice(1);
  photoRows(22, roomFace, [[0, entranceLower], [1, entranceLower], [2, entranceUpper]]);
  const narrow = face([5], [-19.484, 0, -42.112], [-20.738, 0, -43.487]);
  // This short source patch begins above the canopy, so the grounded-wall
  // fallback intentionally cannot generate it. Place the one photographed
  // narrow first-floor opening explicitly, without broadening that fallback.
  const narrowBottom = 5.87, narrowTop = 7.46, narrowLeft = 0.52, narrowRight = 1.28;
  faceMask(narrow, narrowLeft, narrowRight, narrowBottom, narrowTop);
  const na = facePoint(narrow, narrowLeft), nb = facePoint(narrow, narrowRight);
  const nc = facePoint(narrow, narrowRight, 0.085), nd = facePoint(narrow, narrowLeft, 0.085);
  wall('detailRecess', na, nd, narrowBottom, narrowTop);
  wall('detailRecess', nb, nc, narrowBottom, narrowTop);
  wall('oldWindowFrame', nd, nc, narrowBottom, narrowTop);
  wall('detailGlazing', facePoint(narrow, narrowLeft + 0.055, 0.076),
    facePoint(narrow, narrowRight - 0.055, 0.076), narrowBottom + 0.07, narrowTop - 0.07);
  wall('oldWindowFrame', facePoint(narrow, narrowLeft, 0.068),
    facePoint(narrow, narrowRight, 0.068), (narrowBottom + narrowTop) / 2 - 0.028, (narrowBottom + narrowTop) / 2 + 0.028);
  output.features.push({
    id: '53-narrow-window-over-canopy', kind: 'photographic-window', floor: 1,
    sourceSurfaceIndices: [5], count: 1, evidence,
  });
  // Image 8 resolves the end elevation's lower extra column and the completely
  // blank low end block. The hidden opposite side retains its prior treatment.
  const endUpper = [1.80, 4.90, 8.00], endLower = [...endUpper, 11.10];
  photoRows(33, endRoomFace, [[0, endLower], [1, endLower], [2, endUpper]]);
  for (const index of [0, 4]) {
    output.layoutsBySurface.set(building.surfaces[index], {
      replace: true, rows: [0, 1, 2].map(floor => ({floor, centers: [], disabled: true})), evidence,
    });
  }
  output.features.push({
    id: '53-photographed-blank-end', kind: 'photographed-blank-cladding',
    sourceSurfaceIndices: [0, 4], evidence: `${evidence} Image 8 shows an opaque end block under roof34; no new openings are invented there.`,
  });

  function glazingBay(target, left, right, divisions = 2) {
    faceMask(target, left, right, glazingBottom, glazingTop);
    const a = facePoint(target, left, 0.11), b = facePoint(target, right, 0.11);
    const fa = facePoint(target, left), fb = facePoint(target, right);
    wall('detailRecess', fa, a, glazingBottom, glazingTop);
    wall('detailRecess', b, fb, glazingBottom, glazingTop);
    quad('detailRecess', [atY(fa, glazingTop), atY(fb, glazingTop), atY(b, glazingTop), atY(a, glazingTop)]);
    quad('detailThreshold', [atY(fa, glazingBottom), atY(fb, glazingBottom), atY(b, glazingBottom), atY(a, glazingBottom)]);
    const panelTop = glazingBottom + 0.80, transom = panelTop + (glazingTop - panelTop) * 0.48;
    wall('detailLightPanel', a, b, glazingBottom, panelTop);
    wall('detailGlazing', a, b, panelTop, glazingTop);
    for (const y of [glazingBottom + 0.035, panelTop, transom, glazingTop - 0.035]) {
      wall('oldWindowFrame', facePoint(target, left, 0.090), facePoint(target, right, 0.090), y - 0.035, y + 0.035);
    }
    for (let i = 0; i <= divisions; i++) {
      const x = left + (right - left) * i / divisions;
      wall('oldWindowFrame', facePoint(target, Math.max(left, x - 0.038), 0.087),
        facePoint(target, Math.min(right, x + 0.038), 0.087), glazingBottom, glazingTop);
    }
    line('detailMetal', atY(fa, glazingBottom - 0.024), atY(fb, glazingBottom - 0.024));
  }
  const frontBays = [[0.43, 2.20, 2], [2.64, 4.35, 2]];
  const returnBays = [[0.30, 1.80, 1], [2.18, 3.81, 1], [4.20, 6.12, 2]];
  for (const bay of frontBays) glazingBay(front, ...bay);
  for (const bay of returnBays) glazingBay(glazedReturn, ...bay);
  output.features.push({
    id: '53-entrance-common-glazing', kind: 'shared-ground-glazing', floor: 0,
    sourceSurfaceIndices: [26], groups: frontBays,
    evidence: `${evidence} Two orange-framed groups have white lower infill and retained broad cladding piers; this assigns no internal use.`,
  }, {
    id: '53-entrance-glazing-return', kind: 'shared-ground-glazing', floor: 0,
    sourceSurfaceIndices: [36], groups: returnBays, evidence,
  });

  const openingLeft = 0.10, openingRight = entry.span - 0.10, depth = 1.65, head = 4.79;
  faceMask(entry, openingLeft, openingRight, floor, head);
  const a = facePoint(entry, openingLeft), b = facePoint(entry, openingRight);
  const c = facePoint(entry, openingRight, depth), d = facePoint(entry, openingLeft, depth);
  quad('detailThreshold', [a, b, c, d].map(p => atY(p, floor)));
  quad('detailRecess', [a, b, c, d].map(p => atY(p, head)));
  wall('detailCladding', a, d, floor, head);
  wall('detailCladding', c, b, floor, head);
  wall('detailRecess', d, c, floor, head);
  const doorLeft = 1.53, doorRight = Math.min(openingRight - 0.08, 2.73), doorTop = floor + 2.38;
  wall('oldWindowFrame', facePoint(entry, doorLeft, depth - 0.018),
    facePoint(entry, doorRight, depth - 0.018), floor + 0.015, doorTop);
  for (const [lo, hi] of [[0.15, 0.78], [0.89, 1.53], [1.64, 2.24]]) {
    wall('detailGlazing', facePoint(entry, doorLeft + 0.21, depth - 0.032),
      facePoint(entry, doorRight - 0.08, depth - 0.032), floor + lo, floor + hi);
  }
  const handle = facePoint(entry, doorLeft + 0.12, depth - 0.064);
  line('detailMetal', atY(handle, floor + 0.90), atY(handle, floor + 1.29));
  // The orange notice case is a distinctive visible fixture, not a second
  // doorway. Its legs stand within the existing canopy volume.
  box('oldWindowFrame', atY(facePoint(entry, 0.75, 0.49), floor + 0.62),
    entry.u, entry.inward, 1.48, 0.085, 1.05, 'oldWindowFrame');
  for (const x of [0.78, 2.15]) {
    box('oldWindowFrame', atY(facePoint(entry, x, 0.50), floor), entry.u, entry.inward, 0.065, 0.065, 0.68, 'oldWindowFrame');
  }
  output.features.push({
    id: '53-recessed-entrance', kind: 'recessed-entrance', floor: 0,
    sourceSurfaceIndices: [21, 46], depth, doorCount: 1, noticeCaseCount: 1, evidence,
  });
  output.signs ||= [];
  const signLeft = 3.43, signRight = 4.43, signBottom = 4.97, signTop = 5.51;
  output.signs.push({
    id: '53-entrance-address', lines: ['Erwin-Rommel-Straße', '53'],
    width: signRight - signLeft, height: signTop - signBottom,
    corners: [atY(facePoint(front, signLeft, -0.012), signBottom),
      atY(facePoint(front, signRight, -0.012), signBottom),
      atY(facePoint(front, signRight, -0.012), signTop),
      atY(facePoint(front, signLeft, -0.012), signTop)],
  });

  function pipe(target, horizontal, yTop) {
    const center = facePoint(target, horizontal, 0.003), radius = 0.026;
    for (let i = 0; i < 8; i++) {
      const point = angle => add(center, add(mul(target.u, Math.cos(angle) * radius), mul(target.inward, Math.sin(angle) * radius)));
      wall('detailMetal', point(i * Math.PI / 4), point((i + 1) * Math.PI / 4), floor + 0.06, yTop);
    }
    for (const y of [floor + 0.42, yTop - 0.43]) line('detailMetal',
      atY(facePoint(target, horizontal - 0.065, 0.02), y), atY(facePoint(target, horizontal + 0.065, 0.02), y));
  }
  pipe(entry, 0.15, 4.96);
  pipe(glazedReturn, glazedReturn.span - 0.15, 5.06);
  const lowEnd = face([0], [-41.299, 0, -54.471], [-35.091, 0, -60.174]);
  pipe(lowEnd, 0.11, 8.26);

  function roofPlane(index) {
    const roof = building.surfaces[index], points = roof.points.slice(0, -1);
    const normal = unit(points.reduce((sum, a, i) => {
      const b = points[(i + 1) % points.length];
      return add(sum, [(a[1] - b[1]) * (a[2] + b[2]),
        (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]);
    }, [0, 0, 0]));
    const origin = points[0];
    const onRoof = p => [p[0], origin[1] - (normal[0] * (p[0] - origin[0]) + normal[2] * (p[2] - origin[2])) / normal[1], p[2]];
    const u = unit([normal[2], 0, -normal[0]]);
    const v = [-u[2], 0, u[0]];
    return {roof, points, onRoof, u, v, origin};
  }
  function roofCourses(index, omitted = null) {
    const {roof, points, onRoof, u, v, origin} = roofPlane(index);
    const local = p => [dot(sub(p, origin), u), dot(sub(p, origin), v)];
    const ring = points.map(local), minV = Math.min(...ring.map(p => p[1])), maxV = Math.max(...ring.map(p => p[1]));
    for (let level = minV + 0.22; level < maxV - 0.09; level += 0.31) {
      const cuts = [];
      ring.forEach((a, i) => {
        const b = ring[(i + 1) % ring.length];
        if ((a[1] <= level && b[1] > level) || (b[1] <= level && a[1] > level))
          cuts.push(a[0] + (b[0] - a[0]) * (level - a[1]) / (b[1] - a[1]));
      });
      cuts.sort((a, b) => a - b);
      for (let i = 0; i + 1 < cuts.length; i += 2) {
        const left = cuts[i] + 0.025, right = cuts[i + 1] - 0.025;
        const intervals = omitted && level > omitted.minV && level < omitted.maxV
          ? [[left, Math.min(right, omitted.minU - 0.03)], [Math.max(left, omitted.maxU + 0.03), right]]
          : [[left, right]];
        for (const [a, b] of intervals) if (b > a) {
          const p = t => add(onRoof(add(origin, add(mul(u, t), mul(v, level)))), [0, 0.007, 0]);
          line('detailRoofTexture', p(a), p(b));
        }
      }
    }
    for (let i = 1; i < roof.points.length; i++) {
      const a = roof.points[i - 1], b = roof.points[i];
      quad('detailMetal', [a, b, add(b, [0, -0.060, 0]), add(a, [0, -0.060, 0])]);
    }
  }

  // A small upright dormer intersects slope30 without changing its ridge.
  const {roof, onRoof, u: roofU, v: roofV, origin: roofOrigin} = roofPlane(30);
  const low = [-28.697, 5.0515, -40.6595], high = [-22.228, 12.011, -46.590];
  const slope = unit([high[0] - low[0], 0, high[2] - low[2]]), across = glazedReturn.u;
  const foot = lerp(low, high, 0.60), width = 2.20, dormerDepth = 1.42;
  const point = (x, z) => onRoof(add(foot, add(mul(across, x), mul(slope, z))));
  const feet = [point(-width / 2, 0), point(width / 2, 0), point(width / 2, dormerDepth), point(-width / 2, dormerDepth)];
  mask(roof, closed(feet));
  const capY = Math.min(highest - 0.15, Math.max(feet[2][1], feet[3][1]) + 0.075), tops = feet.map(p => atY(p, capY));
  quad('detailCladding', [feet[0], feet[3], tops[3], tops[0]]);
  quad('detailCladding', [feet[2], feet[1], tops[1], tops[2]]);
  quad('detailCladding', [feet[0], feet[1], tops[1], tops[0]]);
  quad('detailMetal', tops);
  const glassBottom = Math.max(feet[0][1], feet[1][1]) + 0.13, glassTop = capY - 0.15;
  const glassA = add(lerp(feet[0], feet[1], 0.08), mul(slope, -0.008));
  const glassB = add(lerp(feet[0], feet[1], 0.92), mul(slope, -0.008));
  wall('detailGlazing', glassA, glassB, glassBottom, glassTop);
  wire('oldWindowFrame', closed([atY(glassA, glassBottom), atY(glassB, glassBottom), atY(glassB, glassTop), atY(glassA, glassTop)]));
  for (const fraction of [1 / 3, 2 / 3]) {
    const p = lerp(glassA, glassB, fraction);
    line('oldWindowFrame', atY(p, glassBottom), atY(p, glassTop));
  }
  const localFeet = feet.map(p => [dot(sub(p, roofOrigin), roofU), dot(sub(p, roofOrigin), roofV)]);
  roofCourses(30, {
    minU: Math.min(...localFeet.map(p => p[0])), maxU: Math.max(...localFeet.map(p => p[0])),
    minV: Math.min(...localFeet.map(p => p[1])), maxV: Math.max(...localFeet.map(p => p[1])),
  });
  for (let i = 0; i < 12; i++) {
    const run = -0.25 - i * 0.29;
    const rung = x => add(point(x, run), [0, 0.055, 0]);
    line('detailMetal', rung(-0.32), rung(0.32));
  }
  for (const x of [-0.29, 0.29]) line('detailMetal', add(point(x, -0.22), [0, 0.055, 0]), add(point(x, -3.48), [0, 0.055, 0]));
  for (const index of [21, 34, 42]) roofCourses(index);
  output.features.push({
    id: '53-entrance-dormer', kind: 'upright-roof-dormer', sourceSurfaceIndices: [30],
    width, depth: dormerDepth, capY, divisions: 3,
    frontGlazing: closed([atY(glassA, glassBottom), atY(glassB, glassBottom), atY(glassB, glassTop), atY(glassA, glassTop)]), evidence,
  }, {
    id: '53-observed-roof-finishes', kind: 'roof-courses-and-drainage',
    sourceSurfaceIndices: [21, 30, 34, 42], evidence,
  });

  // Image 7's service shelter is already present in LoD2 as low roof42.
  // Open only a display copy of its front/left wall and keep the roof footprint.
  const shelter = face([38, 25], [-18.992, 0, -32.001], [-13.276, 0, -25.745]);
  const shelterSide = face([15], [-18.992, 0, -32.001], [-16.896, 0, -33.915]);
  const shelterDepth = 2.65, shelterHead = 4.82;
  faceMask(shelter, 0.16, shelter.span - 0.16, floor, shelterHead);
  faceMask(shelterSide, 0.12, shelterDepth - 0.08, floor, shelterHead);
  const sa = facePoint(shelter, 0.16), sb = facePoint(shelter, shelter.span - 0.16);
  const sc = facePoint(shelter, shelter.span - 0.16, shelterDepth), sd = facePoint(shelter, 0.16, shelterDepth);
  quad('detailThreshold', [sa, sb, sc, sd].map(p => atY(p, floor)));
  quad('detailRecess', [sa, sb, sc, sd].map(p => atY(p, shelterHead)));
  wall('detailCladding', sd, sc, floor, shelterHead);
  wall('detailCladding', sc, sb, floor, shelterHead);
  box('detailRecess', atY(facePoint(shelter, 0.14, 0.13), floor), shelter.u, shelter.inward, 0.14, 0.14, shelterHead - floor, 'detailMetal');
  // A narrow linear luminaire beneath the existing canopy.
  box('detailLightPanel', atY(facePoint(shelter, 2.75, 0.35), shelterHead - 0.095),
    shelter.u, shelter.inward, 1.70, 0.08, 0.065, 'detailMetal');

  const stationX = 6.05, stationDepth = 2.16;
  box('detailRoofHardware', atY(facePoint(shelter, stationX, stationDepth), floor),
    shelter.u, shelter.inward, 0.19, 0.20, 1.37, 'detailMetal');
  box('detailMetal', atY(facePoint(shelter, stationX - 0.08, stationDepth - 0.12), floor + 1.35),
    shelter.u, shelter.inward, 0.35, 0.32, 0.055, 'detailMetal');
  for (const arm of [stationX - 0.065, stationX + 0.24]) {
    const a = facePoint(shelter, arm, stationDepth - 0.26), b = facePoint(shelter, arm, stationDepth + 0.08);
    line('detailMetal', atY(a, floor + 1.40), atY(b, floor + 1.40));
    line('detailMetal', atY(a, floor + 1.40), atY(a, floor + 1.46));
  }
  // Restrained tether/tool outlines, all on the exposed front of the post.
  for (const [offset, drop] of [[0.00, 0.46], [0.08, 0.65], [0.15, 0.53]]) {
    const top = atY(facePoint(shelter, stationX + offset, stationDepth - 0.026), floor + 1.27);
    const middle = add(top, mul(shelter.inward, -0.07));
    const bottom = atY(add(middle, mul(shelter.u, 0.025)), top[1] - drop);
    line('detailMetal', top, atY(middle, top[1] - drop * 0.45));
    line('detailMetal', atY(middle, top[1] - drop * 0.45), bottom);
    line('detailMetal', bottom, add(bottom, mul(shelter.u, 0.055)));
  }
  const pump = atY(facePoint(shelter, stationX + 0.34, stationDepth - 0.08), floor);
  line('detailMetal', pump, add(pump, [0, 0.62, 0]));
  line('detailMetal', add(add(pump, [0, 0.62, 0]), mul(shelter.u, -0.09)),
    add(add(pump, [0, 0.62, 0]), mul(shelter.u, 0.09)));
  output.features.push({
    id: '53-bike-service-shelter', kind: 'bike-service-shelter', floor: 0,
    sourceSurfaceIndices: [15, 25, 38, 42], depth: shelterDepth,
    evidence: `${evidence} Image 7 resolves an open low shelter. The existing roof42 is retained; a display recess, post and linear soffit light refine that volume without assigning an interior room.`,
  }, {
    id: '53-bike-repair-station', kind: 'bike-repair-station', floor: 0,
    sourceSurfaceIndices: [42], position: atY(facePoint(shelter, stationX, stationDepth), floor), count: 1,
    evidence: `${evidence} One dark repair post with support arms, tethered tools and a pump is visible under the shelter. Geometry and placement are approximations within the retained roof footprint.`,
  });
}
