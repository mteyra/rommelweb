/**
 * Resident photo 4, 16 November: Blue's complete elevation facing Red.
 * A four-corner planar rectification estimates relative positions; numerical
 * depths and widths remain replaceable appearance settings, never floor data.
 */
export function addBlueCourtyardPhotoDetails({building, rows, output, helpers}) {
  const {face, facePoint, faceMask, wall, quad, line, atY, photographicRows} = helpers;
  // In the photograph the near/left corner is E; the far/right corner is N.
  const east = [-12.330, 0, 31.066], north = [-27.730, 0, 14.365];
  const front = face([2], east, north);
  const fractions = [0.285, 0.357, 0.495, 0.625, 0.755, 0.897];
  photographicRows(2, east, north, {1: fractions, 2: fractions});
  const layout = output.layoutsBySurface.get(building.surfaces[2]);
  // This photo shows short head boxes, a low transom in both rows and several
  // temporary lowered blinds. Do not reinterpret a blind pose as a new frame.
  for (const row of layout.rows) {
    row.headHeight = row.floor === 2 ? 0.18 : 0.30;
    row.headStyle = 'solid';
    row.transomRatio = 0.35;
  }
  const left = front.span * 0.39, right = front.span * 0.665;
  const bottom = rows[0] + 0.06, top = rows[1] - 0.20, depth = 0.17;
  faceMask(front, left, right, bottom, top);
  const a = facePoint(front, left), b = facePoint(front, right);
  const c = facePoint(front, right, depth), d = facePoint(front, left, depth);
  wall('detailRecess', a, d, bottom, top);
  wall('detailRecess', c, b, bottom, top);
  quad('detailRecess', [a, b, c, d].map(point => atY(point, top)));
  quad('detailThreshold', [a, b, c, d].map(point => atY(point, bottom)));
  wall('detailGlazing', d, c, bottom + 0.06, top - 0.06);
  // Four full-height dark glazed bays; retain the extensive blank timber at
  // both sides instead of extending communal glazing toward either corner.
  for (let index = 0; index <= 4; index++) {
    const u = left + (right - left) * index / 4;
    wall('windowFrame', facePoint(front, Math.max(left, u - 0.035), depth - 0.025),
      facePoint(front, Math.min(right, u + 0.035), depth - 0.025), bottom, top);
  }
  for (const y of [bottom + 0.04, top - 0.04]) {
    wall('windowFrame', facePoint(front, left, depth - 0.025), facePoint(front, right, depth - 0.025), y - 0.04, y + 0.04);
  }
  // Fine projecting sill, head flashing and the continuous dark base trim.
  for (const y of [bottom, top]) line('detailMetal', atY(a, y), atY(b, y));
  wall('windowFrame', facePoint(front, 0.03, -0.012), facePoint(front, front.span - 0.03, -0.012),
    rows[0] + 0.03, rows[0] + 0.14);
  output.features.push({
    id: '51a-courtyard-shared-glazing', kind: 'shared-ground-glazing', floor: 0,
    sourceSurfaceIndices: [2], divisions: 4, openingFractions: [0.39, 0.665], depth,
    evidence: 'Resident photo 4 shows four dark ground-glazing bays between broad blank timber spans. Full-face perspective rectification supersedes the earlier corner-frontage guess; dimensions and four bay widths remain unmeasured.',
  });
}
