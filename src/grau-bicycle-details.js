/**
 * Grau / 55a — the lime-backed bicycle enclosure in resident photos 1–5.
 * All meshes are folded exterior scenery inside the retained source footprint.
 * The estimated cage/porch depths do not create or change any interior space.
 */
export function addGrauBicycleDetails({building, base, rows, output, helpers}) {
  const {face, facePoint, faceMask, wall, quad, line, atY, box, add, sub, mul} = helpers;
  const ne = [34.692, 0, -36.870], se = [40.872, 0, -14.857];
  const nw = [12.881, 0, -30.699], sw = [19.092, 0, -8.705];
  const east = face([7], ne, se), north = face([6, 4], ne, nw);
  const south = face([3, 5], se, sw);
  const floor = base + 0.035, top = rows[1] - 0.26;
  const cageDepth = 7.65, meshDepth = 0.095;
  const porchEnd = 14.25, porchDepth = 2.20;
  const p = (front, u, y, inset = meshDepth) => atY(facePoint(front, u, inset), y);
  const beam = (role, front, u, y, width, height, inset = meshDepth, depth = 0.035) =>
    box(role, p(front, u, y, inset), front.u, front.inward, width, depth, height, role);

  // One continuous enclosure around both east corners. There is no opaque
  // glazing or second rear wall sealing off either photographed return.
  const a = ne, b = se, c = facePoint(south, cageDepth), d = facePoint(north, cageDepth);
  const cageRing = [a, b, c, d];
  quad('detailThreshold', cageRing.map(point => atY(point, floor)));
  quad('detailAcidShade', cageRing.map(point => atY(point, top)));
  wall('detailAcidLime', d, c, floor, top);

  function cageMesh(front, length, bays) {
    const left = 0.045, right = length - 0.055;
    faceMask(front, left, right, floor, top);
    for (const y of [floor + 0.045, top - 0.055]) {
      beam('detailGraphite', front, left, y, right - left, 0.038);
    }
    for (let i = 0; i <= bays; i++) {
      const x = left + (right - left) * i / bays;
      beam('detailGraphite', front, Math.min(x, right - 0.055), floor + 0.04,
        0.055, top - floor - 0.08, meshDepth, 0.055);
    }
    for (let x = left + 0.14; x < right - 0.06; x += 0.145) {
      line('detailGraphite', p(front, x, floor + 0.09), p(front, x, top - 0.08));
    }
    for (let y = floor + 0.20; y < top - 0.09; y += 0.19) {
      line('detailGraphite', p(front, left + 0.02, y), p(front, right - 0.02, y));
    }
    for (let i = 0; i <= bays; i++) {
      const x = Math.max(0.10, Math.min(length - 0.29, length * i / bays));
      // The bright structural supports stand immediately behind the fence.
      beam('detailAcidLime', front, x, floor, 0.20, top - floor, 0.24, 0.22);
    }
    for (let i = 0; i < bays; i++) {
      const x = (i + 0.5) * length / bays - 0.56;
      beam('detailCoolLight', front, x, top - 0.16, 1.12, 0.085, 0.50, 0.10);
    }
  }
  cageMesh(east, east.span, 8);
  cageMesh(north, cageDepth, 3);
  cageMesh(south, cageDepth, 3);

  // A mesh access gate, with its own stile/handle, is distinct from the main
  // dorm entrance under the north gallery. No opaque gate panel is added.
  for (const x of [cageDepth - 2.11, cageDepth - 0.76]) {
    beam('detailGraphite', north, x, floor + 0.045, 0.052, top - floor - 0.08, 0.062, 0.055);
  }
  beam('detailMetal', north, cageDepth - 0.90, floor + 1.03, 0.16, 0.05, 0.038, 0.045);

  function bicycle(front, center, inset, variant) {
    const q = (u, y, z = 0) => p(front, center + u, floor + y, inset + z);
    const radius = 0.31, axle = 0.36;
    for (const [u, z] of [[-0.54, 0], [0.54, 0.08]]) {
      for (let i = 0; i < 24; i++) {
        const angle = Math.PI * i / 12, next = Math.PI * (i + 1) / 12;
        line('detailGraphite', q(u + Math.cos(angle) * radius, axle + Math.sin(angle) * radius, z),
          q(u + Math.cos(next) * radius, axle + Math.sin(next) * radius, z));
        if (i % 4 === 0) line('detailMetal', q(u, axle, z),
          q(u + Math.cos(angle) * radius, axle + Math.sin(angle) * radius, z));
      }
    }
    const rear = [-0.54, axle], crank = [-0.08, 0.30], saddle = [-0.20, 0.86];
    const head = [0.32, 0.85], frontAxle = [0.54, axle, 0.08];
    for (const [a, b] of [[rear, crank], [rear, saddle], [saddle, crank], [crank, head], [saddle, head],
      [head, frontAxle], [saddle, [-0.23, 0.99]], [[-0.36, 0.99], [-0.10, 0.99]],
      [head, [0.29, 1.12, 0.08]], [[0.18, 1.12, 0.08], [0.45, 1.12, 0.08]],
      [[-0.16, 0.27], [0.09, 0.34]]]) {
      line(variant % 3 ? 'detailMetal' : 'detailGraphite', q(...a), q(...b));
    }
  }
  let bicycleCount = 0;
  for (let i = 0; i < 19; i++) {
    bicycle(east, 1.00 + i * 1.15, 0.82 + (i % 3) * 0.27, i); bicycleCount++;
  }
  for (let i = 0; i < 13; i++) {
    bicycle(east, 1.55 + i * 1.61, 2.11 + (i % 2) * 0.26, i + 1); bicycleCount++;
  }
  for (const front of [north, south]) for (let i = 0; i < 4; i++) {
    bicycle(front, 1.02 + i * 1.69, 1.15 + (i % 2) * 0.33, i); bicycleCount++;
  }

  // The long elevation also reveals a separate utility leaf on the lime
  // rear wall. It belongs to the cage, not the north residential entrance.
  const rearDoor = east.span * 0.43;
  beam('detailGraphite', east, rearDoor, floor + 0.035, 1.13, 2.27, cageDepth - 0.09, 0.045);
  beam('detailMetal', east, rearDoor + 0.93, floor + 0.94, 0.03, 0.28, cageDepth - 0.105, 0.03);
  beam('detailLightPanel', east, rearDoor + 0.46, floor + 1.72, 0.19, 0.15, cageDepth - 0.11, 0.02);

  // Large pale-gray, lower-case letters face the entrance forecourt.
  // NE→NW is left→right when this face is viewed from the north.
  const left = 0.34, right = cageDepth - 0.38;
  (output.signs ||= []).push({
    id: '55a-grau-bicycle-wordmark', style: 'wordmark', lines: ['grau'], ink: '#767b69',
    corners: [p(north, left, floor + 0.35, 0.057), p(north, right, floor + 0.35, 0.057),
      p(north, right, floor + 2.30, 0.057), p(north, left, floor + 2.30, 0.057)],
  });
  output.features.push({
    id: '55a-east-bicycle-storage', kind: 'bike-storage', floor: 0,
    sourceSurfaceIndices: [7, 6, 4, 3], frontWidth: east.span, returnWidth: cageDepth,
    depth: cageDepth, bicycleCount, planRing: [...cageRing, a].map(point => [point[0], point[2]]),
    evidence: 'Photos 1/2 show the full ESE ground cage; photo 5 and the left side of photo 4 show its NE return and grau lettering; photo 3 shows the SE return. Lime-backed welded mesh, square supports and fluorescent fixtures are visible. Depth, bay spacing and forty parked bicycle silhouettes are estimates, not interior boundaries or an inventory.',
  });

  // South service porch beside the cage: a recessed lime back wall, open
  // exterior edge and individual columns. No fence closes this access area.
  faceMask(south, cageDepth, porchEnd, floor, top);
  const pa = facePoint(south, cageDepth), pb = facePoint(south, porchEnd);
  const pc = facePoint(south, porchEnd, porchDepth), pd = facePoint(south, cageDepth, porchDepth);
  quad('detailThreshold', [pa, pb, pc, pd].map(point => atY(point, floor)));
  quad('detailAcidShade', [pa, pb, pc, pd].map(point => atY(point, top)));
  wall('detailAcidShade', pd, pc, floor, top);
  wall('detailAcidLime', pb, pc, floor, top);
  for (const u of [cageDepth + 0.08, 10.98, porchEnd - 0.23]) {
    beam('detailAcidLime', south, u, floor, 0.20, top - floor, 0.11, 0.22);
  }
  function serviceOpening(left, width, glazed) {
    const depth = porchDepth - 0.055, height = Math.min(2.34, top - floor - 0.16);
    beam('detailGraphite', south, left, floor + 0.02, width, height, depth, 0.032);
    wall(glazed ? 'detailGlazing' : 'detailLightPanel',
      facePoint(south, left + 0.065, depth - 0.012), facePoint(south, left + width - 0.065, depth - 0.012),
      floor + 0.08, floor + height - 0.045);
    if (glazed) beam('detailGraphite', south, left + 0.06, floor + 0.81, width - 0.12, 0.055, depth - 0.03);
    beam('detailMetal', south, left + 0.13, floor + 0.98, 0.04, 0.30, depth - 0.046);
  }
  serviceOpening(8.52, 1.16, false);
  serviceOpening(12.30, 1.38, true);
  // Paired small meter/notice boxes are visible on the porch back wall.
  for (const u of [10.12, 10.57]) beam('detailLightPanel', south, u, floor + 1.40, 0.33, 0.48, porchDepth - 0.07, 0.04);
  output.features.push({
    id: '55a-south-service-porch', kind: 'recessed-service-porch', floor: 0,
    sourceSurfaceIndices: [3, 5], width: porchEnd - cageDepth, depth: porchDepth,
    planRing: [pa, pb, pc, pd, pa].map(point => [point[0], point[2]]),
    evidence: 'Photo 3 shows an open, lime-columned recess beside the south cage return, with a gray service door, paired small wall boxes and a taller glazed opening farther west. Exact depth and opening dimensions are estimates. The main residential entrance remains on the north gallery face.',
  });

  // One compact outdoor plant unit appears high on the cage back wall.
  const unitStart = add(d, mul(east.u, east.span * 0.59));
  const unitFront = add(unitStart, mul(east.inward, -0.20));
  box('detailLightPanel', atY(unitFront, top - 0.79), east.u, east.inward,
    0.72, 0.16, 0.59, 'detailMetal');
  const fanCenter = add(unitFront, mul(east.u, 0.34));
  for (let i = 0; i < 20; i++) {
    const t = i * Math.PI / 10, n = (i + 1) * Math.PI / 10;
    line('detailGraphite', atY(add(fanCenter, mul(east.u, Math.cos(t) * 0.22)), top - 0.49 + Math.sin(t) * 0.22),
      atY(add(fanCenter, mul(east.u, Math.cos(n) * 0.22)), top - 0.49 + Math.sin(n) * 0.22));
  }
}
