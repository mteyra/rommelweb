/**
 * Pink / 59a: the dark ground-floor bicycle cage in resident photos 3 and 4.
 * This is folded exterior scenery only. Its depth, frame sections and parked
 * bicycles are visual estimates; it creates no interior room or access route.
 */
export function addPinkBicycleDetails({building, rows, output, helpers, front, east}) {
  const {facePoint, faceMask, wall, quad, line, atY, box, sub, dot} = helpers;
  const lower = rows[0] + 0.06, upper = rows[1] - 0.24;
  const depth = 0.85, meshDepth = 0.10;
  const frontLeft = 14.95, frontRight = front.span - 0.035;
  const eastLeft = 0.035, eastRight = east.span - 0.035;
  if (frontRight <= frontLeft || eastRight <= depth || upper <= lower) {
    throw new Error('Pink bicycle frontage must fit its existing ground storey');
  }

  const p = (face, u, y, inset = meshDepth) => atY(facePoint(face, u, inset), y);
  const stroke = (role, face, a, b, inset) => line(role,
    p(face, a[0], a[1], inset), p(face, b[0], b[1], inset));

  function bicycle(face, center, variation) {
    // Quiet silhouettes behind the mesh, with two actual round wheels and
    // the familiar frame triangle. Positions are decorative, not inventory.
    const inset = 0.51 + variation * 0.04;
    const radius = 0.31, axle = lower + radius + 0.025;
    const rear = center - 0.54, frontWheel = center + 0.54;
    for (const u of [rear, frontWheel]) {
      for (let step = 0; step < 24; step++) {
        const first = step * Math.PI / 12, next = (step + 1) * Math.PI / 12;
        stroke('detailMetal', face,
          [u + Math.cos(first) * radius, axle + Math.sin(first) * radius],
          [u + Math.cos(next) * radius, axle + Math.sin(next) * radius], inset);
      }
      for (let spoke = 0; spoke < 6; spoke++) {
        const angle = spoke * Math.PI / 3;
        stroke('detailRoofTexture', face, [u, axle],
          [u + Math.cos(angle) * radius, axle + Math.sin(angle) * radius], inset);
      }
    }
    const rearAxle = [rear, axle], crank = [center - 0.08, lower + 0.30];
    const saddleStem = [center - 0.22, lower + 0.85];
    const headset = [center + 0.33, lower + 0.84];
    const frontAxle = [frontWheel, axle];
    const tubes = [
      [rearAxle, crank], [rearAxle, saddleStem], [saddleStem, crank],
      [crank, headset], [saddleStem, headset], [headset, frontAxle],
      [saddleStem, [center - 0.25, lower + 0.98]],
      [[center - 0.39, lower + 0.99], [center - 0.11, lower + 0.99]],
      [headset, [center + 0.28, lower + 1.10]],
      [[center + 0.28, lower + 1.10], [center + 0.46, lower + 1.13]],
      [[center - 0.14, lower + 0.27], [center + 0.09, lower + 0.34]],
    ];
    for (const [a, b] of tubes) stroke('detailMetal', face, a, b, inset);
  }

  function cage(face, left, right, id, floorStart, backLeft, backRight, closeLeft, closeRight) {
    faceMask(face, left, right, lower, upper);
    const footprint = [
      facePoint(face, floorStart, 0.035), facePoint(face, right, 0.035),
      facePoint(face, right, depth), facePoint(face, floorStart, depth),
    ];
    quad('detailRecess', footprint.map(point => atY(point, lower)));
    quad('detailRecess', footprint.map(point => atY(point, upper)));
    wall('detailRecess', facePoint(face, backLeft, depth), facePoint(face, backRight, depth), lower, upper);
    if (closeLeft) wall('detailRecess', facePoint(face, left, 0.035), facePoint(face, left, depth), lower, upper);
    if (closeRight) wall('detailRecess', facePoint(face, right, 0.035), facePoint(face, right, depth), lower, upper);

    // Welded rectangular mesh remains see-through: no opaque face is placed
    // across the cage. Dark solid top/bottom rails and posts give it thickness.
    const bays = Math.ceil((right - left) / 2.85);
    const bayWidth = (right - left) / bays;
    for (const y of [lower + 0.025, upper - 0.06]) {
      box('detailMetal', p(face, left + 0.012, y, meshDepth),
        face.u, face.inward, right - left - 0.024, 0.035, 0.035);
    }
    for (let index = 0; index <= bays; index++) {
      const center = left + index * bayWidth;
      const start = Math.max(left + 0.012, Math.min(right - 0.19, center - 0.085));
      // Pale, square supports are visible through the foreground trees.
      box('detailLimeShade', p(face, start, lower, 0.145),
        face.u, face.inward, 0.17, 0.17, upper - lower, 'detailMetal');
    }
    const verticals = Math.ceil((right - left) / 0.18);
    for (let index = 1; index < verticals; index++) {
      const u = left + (right - left) * index / verticals;
      stroke('detailRoofTexture', face, [u, lower + 0.06], [u, upper - 0.04], meshDepth);
    }
    for (let y = lower + 0.18; y < upper - 0.05; y += 0.18) {
      stroke('detailRoofTexture', face, [left + 0.01, y], [right - 0.01, y], meshDepth);
    }
    const bicycleCenters = [];
    for (let index = 0; index < bays; index++) {
      const center = left + (index + 0.50) * bayWidth;
      if (center - 0.9 <= left || center + 0.9 >= right) continue;
      bicycle(face, center, index % 3);
      bicycleCenters.push(center);
    }
    const sourceSurfaceIndices = face.indices.filter(index => {
      const us = building.surfaces[index].points.map(point => dot(sub(point, face.start), face.u));
      return Math.min(...us) < right && Math.max(...us) > left;
    });
    output.features.push({
      id, kind: 'bike-storage', floor: 0, sourceSurfaceIndices,
      width: right - left, depth, meshPitch: 0.18, bays,
      decorativeBicycles: bicycleCenters.length,
      evidence: 'Resident photos 3 and 4 show a ground-floor bicycle cage with dark welded-wire panels and pale square supports, wrapping from the east elevation onto the entrance-side wing. Recess depth, mesh pitch, bay sections and parked bicycles are appearance estimates, not room boundaries or a bicycle inventory.',
    });
  }

  // The strips meet at the northeast corner. Stop the rear walls and the
  // east floor at the inner corner so they do not seal or double-fill it.
  cage(front, frontLeft, frontRight, '59a-north-bicycle-storage',
    frontLeft, frontLeft, front.span - depth, true, false);
  cage(east, eastLeft, eastRight, '59a-east-bicycle-storage',
    depth, depth, eastRight, false, true);
}
