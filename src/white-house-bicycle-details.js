/**
 * White's outdoor cycle parking is scenery, not a building extension.
 * Keep it in distinct site layers: footprint containment continues to apply
 * to every architectural triangle; racks do not alter source bounds or rooms.
 */
export function addWhiteBicycleDetails({base, output, helpers, court, north, south}) {
  const {facePoint, add, sub, mul, unit, atY} = helpers;
  const triangles = output.siteTriangleLayers ||= {};
  const segments = output.siteSegmentLayers ||= {};
  const floor = base + 0.035;
  function line(role, a, b) {(segments[role] ||= []).push([a, b]);}
  function quad(role, a, b, c, d) {(triangles[role] ||= []).push(...[a, b, c, a, c, d].flat());}
  function tube(role, a, b, radius = 0.018) {
    const axis = unit(sub(b, a));
    const seed = Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
    const u = unit(cross(axis, seed)), v = unit(cross(axis, u));
    const p = (origin, angle) => add(origin, add(mul(u, radius * Math.cos(angle)), mul(v, radius * Math.sin(angle))));
    for (let i = 0; i < 6; i++) quad(role, p(a, i * Math.PI / 3), p(a, (i + 1) * Math.PI / 3),
      p(b, (i + 1) * Math.PI / 3), p(b, i * Math.PI / 3));
  }
  function bicycle(center, along, lean, variation) {
    const up = unit([lean[0] * 0.08, 1, lean[2] * 0.08]);
    const p = (u, y, sideways = 0) => add(center, add(mul(along, u), add(mul(up, y), mul(lean, sideways))));
    const axleY = 0.345, radius = 0.325;
    for (const wheel of [-0.56, 0.56]) {
      for (let i = 0; i < 28; i++) {
        const a = i * Math.PI / 14, b = (i + 1) * Math.PI / 14;
        quad('detailGraphite',
          p(wheel + radius * Math.cos(a), axleY + radius * Math.sin(a)),
          p(wheel + radius * Math.cos(b), axleY + radius * Math.sin(b)),
          p(wheel + (radius - 0.027) * Math.cos(b), axleY + (radius - 0.027) * Math.sin(b)),
          p(wheel + (radius - 0.027) * Math.cos(a), axleY + (radius - 0.027) * Math.sin(a)));
      }
      for (let spoke = 0; spoke < 8; spoke++) {
        const angle = spoke * Math.PI / 4;
        line('detailMetal', p(wheel, axleY), p(wheel + radius * 0.92 * Math.cos(angle), axleY + radius * 0.92 * Math.sin(angle)));
      }
    }
    const rear = p(-0.56, axleY), front = p(0.56, axleY), crank = p(-0.08, 0.30);
    const seat = p(-0.23, 0.86), head = p(0.32, 0.85);
    const frameRole = variation % 4 === 1 ? 'oldWindowFrame' : variation % 4 === 2 ? 'detailMetal' : 'detailGraphite';
    for (const [a, b] of [[rear, crank], [rear, seat], [seat, crank], [crank, head], [seat, head], [head, front]]) tube(frameRole, a, b);
    tube('detailMetal', seat, p(-0.26, 0.99), 0.013);
    tube('detailGraphite', p(-0.39, 1.00), p(-0.11, 1.00), 0.035);
    tube('detailMetal', head, p(0.27, 1.12), 0.014);
    tube('detailGraphite', p(0.27, 1.12, -0.24), p(0.27, 1.12, 0.24), 0.015);
    tube('detailMetal', crank, p(0.02, 0.23, 0.12), 0.010);
    tube('detailGraphite', p(0.02, 0.23, 0.08), p(0.02, 0.23, 0.23), 0.022);
    if (variation % 3 === 0) {
      tube('detailMetal', p(-0.73, 0.73), p(-0.28, 0.73), 0.012);
      tube('detailMetal', rear, p(-0.68, 0.73), 0.010);
    }
  }
  function parking(id, target, left, right, outward, count, photos) {
    const origin = atY(facePoint(target, left, -outward), floor);
    const length = right - left, sideways = mul(target.inward, -1);
    const point = (u, v, y = 0) => add(origin, add(mul(target.u, u), add(mul(sideways, v), [0, y, 0])));
    // Low wheel rails and U-shaped stands; no opaque shed or new room.
    for (const v of [-0.23, 0.23]) tube('detailMetal', point(0, v, 0.055), point(length, v, 0.055), 0.024);
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) * length / count;
      tube('detailMetal', point(u - 0.13, -0.25, 0.06), point(u - 0.13, -0.25, 0.56), 0.018);
      tube('detailMetal', point(u + 0.13, 0.25, 0.06), point(u + 0.13, 0.25, 0.56), 0.018);
      tube('detailMetal', point(u - 0.13, -0.25, 0.56), point(u + 0.13, 0.25, 0.56), 0.018);
      const direction = unit(add(mul(sideways, 0.92), mul(target.u, i % 2 ? 0.28 : -0.18)));
      const center = point(u, 0.37 + (i % 3) * 0.08);
      bicycle(center, direction, target.u, i);
    }
    output.features.push({
      id, kind: 'outdoor-bicycle-parking', floor: 0, sourceSurfaceIndices: target.indices,
      photos, decorativeBicycles: count, outdoor: true, structural: false,
      evidence: 'White resident photos show open-air bicycles at this frontage. Rack dimensions, bicycle count, lean and exact parking positions are illustrative scenery; they change no dorm footprint, interior, route or bicycle-capacity record.',
    });
  }
  parking('57-entry-court-bicycles', court, 1.80, 7.50, 1.15, 9, [7]);
  parking('57-north-front-bicycles', north, 2.05, 7.55, 1.10, 8, [5]);
  parking('57-south-front-bicycles', south, 0.95, 4.65, 1.08, 6, [1]);
}
