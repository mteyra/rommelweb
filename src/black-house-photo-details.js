/**
 * Black / 49, resident photograph 5 from 16 November 2026.
 *
 * Registration: the near corner faces the rest of the campus (southeast).
 * The photograph's left elevation is source wall 1 (south); the right is
 * source wall 9 (east). Fractions were estimated on rectified wall planes,
 * not taken from raw image widths. They are replaceable appearance estimates.
 *
 * This module does not read or write a floor plan. The new photo reveals
 * recesses absent from the older provisional apartment packing; keep that
 * discrepancy explicit instead of changing rooms to accommodate this mesh.
 */
export function addBlackHousePhotoDetails({building, base, rows, highest, output, helpers}) {
  const {
    face, facePoint, faceMask, wall, quad, line, atY, add, sub, mul,
    box, railing, photographicRows,
  } = helpers;
  const southEast = [-66.440, 0, -59.092];
  const southWest = [-88.618, 0, -54.850];
  const northEast = [-70.705, 0, -81.523];
  const south = face([1], southEast, southWest);
  const east = face([9], southEast, northEast);

  // Bright, long loggia on the south; short open return on the east.
  // Neither its numerical depth nor the rear door inventory is measured.
  const width = 8.80, returnWidth = 3.15;
  function photographedCorner(floor) {
    const lower = rows[floor] + 0.08;
    const upper = (rows[floor + 1] ?? highest) - 0.32;
    faceMask(south, 0, width, lower, upper);
    faceMask(east, 0, returnWidth, lower, upper);
    const a = southEast;
    const b = facePoint(south, width);
    const d = facePoint(east, returnWidth);
    const c = add(b, sub(d, a));
    quad('detailRecess', [a, b, c, d].map(point => atY(point, lower)));
    quad('detailLimeShade', [a, b, c, d].map(point => atY(point, upper)));
    wall('detailLimeShade', b, c, lower, upper);
    wall('detailLimeShade', c, d, lower, upper);
    wall('detailLime', a, b, upper - 0.27, upper);
    wall('detailLime', d, a, upper - 0.27, upper);

    // The visible lime column and actual sectioned handrails add volume to
    // the wireframe. No concealed stair, passage or doorway is inferred.
    box('detailLime', atY(facePoint(south, width * 0.30, 0.20), lower),
      south.u, south.inward, 0.18, 0.18, upper - lower, 'detailLime');
    for (const [front, extent] of [[south, width], [east, returnWidth]]) {
      const railA = facePoint(front, 0.05, 0.09);
      const railB = facePoint(front, extent - 0.05, 0.09);
      railing(railA, railB, lower, lower + 1.05);
      box('detailMetal', atY(railA, lower + 1.025),
        front.u, front.inward, extent - 0.10, 0.042, 0.05);
      const posts = Math.ceil(extent / 1.35);
      for (let i = 0; i <= posts; i++) {
        box('detailMetal', atY(facePoint(front, 0.05 + (extent - 0.10) * i / posts, 0.085), lower + 0.10),
          front.u, front.inward, 0.035, 0.035, 0.93);
      }
    }
    if (floor === 1) {
      // Opaque dark panels are visible on the lower long railing; these are
      // facade screens, not walls in the independently retained room layout.
      for (const [left, right] of [[0.10, 2.55], [2.61, 5.23], [5.29, 8.20]]) {
        wall('detailRecess', facePoint(south, left, 0.065), facePoint(south, right, 0.065),
          lower + 0.16, lower + 0.97);
        line('detailMetal', atY(facePoint(south, left, 0.063), lower + 0.97),
          atY(facePoint(south, right, 0.063), lower + 0.97));
      }
    }
    output.features.push({
      id: `49-southeast-loggia-${floor}`, kind: 'corner-loggia', floor,
      sourceSurfaceIndices: [1, 9], frontWidth: width, returnWidth,
      planRing: [a, b, c, d, a].map(point => [point[0], point[2]]),
      evidence: 'Resident photo 5 shows the southeast corner open at 1. OG and 4. OG, with a long lime south arm, short east return, metal rails and one visible column. Arm widths, rail sections and recess depth are estimated. No rear-door inventory or interior route is inferred; existing apartment plans are unchanged.',
    });
  }
  photographedCorner(1);
  photographedCorner(4);

  // Two further lime ends are visible at the far side of the south face.
  // Model only that photographed face: the unphotographed west return,
  // its length and its arrangement are intentionally left unresolved.
  for (const floor of [2, 5]) {
    const left = south.span - 2.80, right = south.span;
    const lower = rows[floor] + 0.08, upper = (rows[floor + 1] ?? highest) - 0.32;
    faceMask(south, left, right, lower, upper);
    const a = facePoint(south, left), b = facePoint(south, right);
    const c = facePoint(south, right, 1.15), d = facePoint(south, left, 1.15);
    quad('detailRecess', [a, b, c, d].map(point => atY(point, lower)));
    quad('detailLimeShade', [a, b, c, d].map(point => atY(point, upper)));
    wall('detailRecess', d, c, lower, upper);
    wall('detailLime', a, d, lower, upper);
    wall('detailLime', a, b, upper - 0.27, upper);
    railing(a, b, lower, lower + 1.05, mul(south.inward, 0.09));
    output.features.push({
      id: `49-south-visible-loggia-end-${floor}`, kind: 'partial-loggia-end', floor,
      sourceSurfaceIndices: [1], visibleWidth: right - left, depth: 1.15,
      evidence: 'Only a lime fascia, dark opening and railing at the far south-face end are visible in resident photo 5. This shallow appearance recess stops at that face; the unseen west elevation and full corner return remain unchanged and unresolved.',
    });
  }

  photographicRows(9, southEast, northEast, {
    0: [0.114, 0.255, 0.396, 0.538, 0.678, 0.903],
    1: [0.203, 0.342, 0.480, 0.620, 0.758, 0.896],
    2: [0.066, 0.251, 0.390, 0.528, 0.666, 0.804, 0.942],
    3: [0.065, 0.204, 0.342, 0.480, 0.618, 0.756, 0.894],
    4: [0.250, 0.388, 0.526, 0.665, 0.803, 0.940],
    5: [0.065, 0.204, 0.342, 0.480, 0.618, 0.756, 0.894],
  }, [0]);
  photographicRows(1, southEast, southWest, {
    0: [0.246],
    1: [0.944],
    2: [0.360, 0.452, 0.590, 0.731],
    3: [0.356, 0.495, 0.650, 0.790, 0.942],
    4: [0.458, 0.590, 0.729, 0.868],
    5: [0.366, 0.508, 0.650, 0.796],
  }, [0, 1]);
  for (const index of [1, 9]) {
    const layout = output.layoutsBySurface.get(building.surfaces[index]);
    const ground = layout.rows.find(row => row.floor === 0);
    Object.assign(ground, {height: 2.18, sillOffset: 0.10, headHeight: 0.28});
    layout.rows.forEach(row => {
      // Preserve observed stagger and aligned 3. OG/5. OG columns rather than
      // imposing a single repeated bay pattern across every storey.
      row.transomRatio = 0.32;
    });
  }
  output.features.push({
    id: '49-resident-photo-registration', kind: 'photo-face-registration',
    sourceSurfaceIndices: [1, 9], photo: 5, nearCorner: southEast,
    evidence: 'Resident identifies Black house and its corner facing the rest of the campus. That southeast corner registers photo-left to south wall1 and photo-right to east wall9. Coarse planar rectification estimates visible window fractions; thin trees, wide-angle distortion and oblique perspective prevent surveyed placement or a complete ground inventory.',
  });

  // The dark plinth and narrow horizontal flashing are visible on these
  // two elevations. Keep all trim attached inward within the source outline.
  for (const front of [south, east]) {
    const a = facePoint(front, 0.015, 0.008);
    const b = facePoint(front, front.span - 0.015, 0.008);
    wall('detailMetal', a, b, base + 0.025, base + 0.17);
    for (const y of rows.slice(1)) {
      wall('detailMetal', a, b, y - 0.035, y + 0.015);
    }
  }
  output.features.push({
    id: '49-photographed-plinth-and-flashing', kind: 'facade-flashing',
    sourceSurfaceIndices: [1, 9],
    evidence: 'Resident photo 5 shows a dark plinth and thin metal flashing between timber storeys. Narrow attached strips follow existing row guides; their sections are unmeasured and no facade or floor outline changes.',
  });
}
