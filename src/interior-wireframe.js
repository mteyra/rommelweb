import * as THREE from 'three';

// A low cutaway for legibility, not a claim about measured ceiling height.
export const INTERIOR_CUT_HEIGHT = 1.05;
const WINDOW_SILL_CUT_HEIGHT = 0.70; // Display only; source sill height is unmeasured.
const EPSILON = 1e-6;

function splitAtDoors(a, b, doors, tolerance = EPSILON) {
  const dx = b[0] - a[0], dz = b[1] - a[1], lengthSquared = dx * dx + dz * dz;
  if (lengthSquared < EPSILON ** 2) return [];
  const intervals = [];
  for (const door of doors) {
    if (!door.segment.every(point => Math.abs(dx * (point[1] - a[1]) - dz * (point[0] - a[0])) / Math.sqrt(lengthSquared) <= tolerance)) continue;
    const ts = door.segment.map(point => ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / lengthSquared).sort((x, y) => x - y);
    const low = Math.max(0, ts[0]), high = Math.min(1, ts[1]);
    if (high - low > EPSILON) intervals.push([low, high]);
  }
  intervals.sort(([a], [b]) => a - b);
  const kept = [];
  let previous = 0;
  for (const [low, high] of intervals) {
    if (low > previous + EPSILON) kept.push([previous, low]);
    previous = Math.max(previous, high);
  }
  if (previous < 1 - EPSILON) kept.push([previous, 1]);
  return kept.map(pair => pair.map(t => [a[0] + dx * t, a[1] + dz * t]));
}

function followsSketch(a, b, boundaries) {
  return boundaries.some(([start, end]) => {
    const dx = end[0] - start[0], dz = end[1] - start[1], length = Math.hypot(dx, dz);
    return [a, b].every(point => {
      const along = ((point[0] - start[0]) * dx + (point[1] - start[1]) * dz) / length;
      return Math.abs(dx * (point[1] - start[1]) - dz * (point[0] - start[0])) / length <= 0.02 && along >= -0.06 && along <= length + 0.06;
    });
  });
}

function trianglesForSpace(space, height) {
  const outer = space.polygon.slice(0, -1), holes = (space.holes || []).map(ring => ring.slice(0, -1));
  const points = [...outer, ...holes.flat()];
  return THREE.ShapeUtils.triangulateShape(outer.map(([x, z]) => new THREE.Vector2(x, z)), holes.map(ring => ring.map(([x, z]) => new THREE.Vector2(x, z))))
    .flatMap(triangle => triangle.flatMap(index => [points[index][0], height, points[index][1]]));
}

/** Keep the label inside its polygon, including L-shaped rooms and corridors. */
function labelPosition(space) {
  const triangles = trianglesForSpace(space, 0.16);
  let best = null, maxArea = -1, totalArea = 0;
  const weighted = [0, 0, 0];
  for (let index = 0; index < triangles.length; index += 9) {
    const a = triangles.slice(index, index + 3), b = triangles.slice(index + 3, index + 6), c = triangles.slice(index + 6, index + 9);
    const area = Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]));
    const center = a.map((value, axis) => (value + b[axis] + c[axis]) / 3);
    center.forEach((value, axis) => { weighted[axis] += value * area; });
    totalArea += area;
    if (area > maxArea) {
      maxArea = area;
      best = center;
    }
  }
  // The area centroid centers rectangular bays. Concave circulation can put
  // its centroid outside the room or inside a stair hole, so check triangles.
  if (totalArea) {
    const center = weighted.map(value => value / totalArea);
    for (let i = 0; i < triangles.length; i += 9) {
      const vertices = [0, 3, 6].map(offset => [triangles[i + offset], triangles[i + offset + 2]]);
      const signs = vertices.map((a, index) => {
        const b = vertices[(index + 1) % 3];
        return (b[0] - a[0]) * (center[2] - a[1]) - (b[1] - a[1]) * (center[0] - a[0]);
      });
      if (signs.every(value => value >= -EPSILON) || signs.every(value => value <= EPSILON)) return center;
    }
  }
  return best;
}

/**
 * Render validated approved plans or explicitly identified resident studies.
 * Coordinates remain campus-local metres; all heights here are display offsets.
 */
export function createInteriorWireframe(level, { house, floor }) {
  const group = new THREE.Group(), pickables = [], labels = [];
  group.userData = { role: level?.isStudy ? 'resident-interior-study' : 'approved-interior-cutaway', cutHeight: INTERIOR_CUT_HEIGHT };
  if (!level) return { group, pickables, labels };
  const doors = level.doors || [];
  const windows = level.windows || [];
  const fullHeightOpenings = [...doors, ...windows];
  const joints = new Map();
  const addWall = (a, b, estimated, top = INTERIOR_CUT_HEIGHT) => {
    const key = `${[a.join(','), b.join(',')].sort().join('|')}|${top}`;
    if (!joints.has(key) || !estimated) joints.set(key, {a, b, estimated, top});
  };
  for (const space of level.spaces) {
    const material = new THREE.MeshBasicMaterial({
      color: space.kind === 'room' ? 0xdfdfd5 : 0xb6a886,
      transparent: true, opacity: space.kind === 'corridor' ? 0.14 : 0.055,
      side: THREE.DoubleSide, depthWrite: false,
    });
    material.userData.themeRole = space.kind === 'room' ? 'room' : 'sharedSpace';
    const mesh = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(trianglesForSpace(space, 0.028), 3)), material);
    mesh.userData = { house, floor, spaceId: space.id, role: 'interior-space' };
    group.add(mesh);
    pickables.push(mesh);
    for (const ring of [space.polygon, ...(space.holes || [])]) {
      for (let index = 1; index < ring.length; index++) {
        for (const [a, b] of splitAtDoors(ring[index - 1], ring[index], fullHeightOpenings, level.isStudy ? 0.002 : EPSILON)) {
          const estimated = level.isStudy && space.confidence === 'estimated' && !followsSketch(a, b, level.sketchBoundaries || []);
          addWall(a, b, estimated);
        }
      }
    }
    labels.push({ text: space.label, shortText: space.shortLabel, position: labelPosition(space), spaceId: space.id, kind: 'space', confidence: space.confidence });
    // A marked flight is only part of a stairwell; its landings remain clear.
    // Older studies keep their schematic full-enclosure treads.
    const flight = level.isStudy && space.stairFlight ? space.stairFlight : space.polygon;
    if (space.kind === 'stairs' && flight.length === 5 && (space.stairFlight || !space.holes?.length)) {
      const p = flight;
      const lengths = p.slice(1).map((b, i) => Math.hypot(b[0] - p[i][0], b[1] - p[i][1]));
      const start = lengths.indexOf(Math.max(...lengths)), a = p[start], b = p[(start + 1) % 4], c = p[(start + 2) % 4], d = p[(start + 3) % 4];
      const treads = Array.from({length: 8}, (_, index) => {
        const t = (index + 1) / 9;
        return [a[0] + (b[0] - a[0]) * t, 0.07, a[1] + (b[1] - a[1]) * t, d[0] + (c[0] - d[0]) * t, 0.07, d[1] + (c[1] - d[1]) * t];
      }).flat();
      const material = new THREE.LineBasicMaterial({color: 0xb6a886, transparent: true, opacity: 0.8});
      material.userData.themeRole = 'sharedSpace';
      const steps = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(treads, 3)), material);
      steps.userData.role = 'schematic-stair-treads';
      group.add(steps);
    }
  }
  // A window has a sill below it. Removing an entire wall as for a door would
  // incorrectly turn each marked window into another circulation opening.
  for (const window of windows) addWall(...window.segment, false, WINDOW_SILL_CUT_HEIGHT);
  for (const estimated of [false, true]) {
    const walls = [...joints.values()].filter(joint => Boolean(joint.estimated) === estimated).flatMap(({a, b, top}) => [
      a[0], 0.045, a[1], b[0], 0.045, b[1], a[0], top, a[1], b[0], top, b[1],
      a[0], 0.045, a[1], a[0], top, a[1], b[0], 0.045, b[1], b[0], top, b[1],
    ]);
    if (!walls.length) continue;
    const material = estimated
      ? new THREE.LineDashedMaterial({color: 0xdfdfd5, transparent: true, opacity: 0.58, dashSize: 0.23, gapSize: 0.16})
      : new THREE.LineBasicMaterial({color: 0xdfdfd5, transparent: true, opacity: 0.7});
    material.userData.themeRole = 'room';
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(walls, 3)), material);
    if (estimated) lines.computeLineDistances();
    lines.userData.role = estimated ? 'estimated-interior-walls' : 'interior-walls';
    group.add(lines);
  }

  for (const band of level.wallBands || []) {
    const material = new THREE.MeshBasicMaterial({color: 0xdfdfd5, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false});
    material.userData.themeRole = 'room';
    const mesh = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(trianglesForSpace(band, INTERIOR_CUT_HEIGHT + 0.005), 3)), material);
    mesh.userData = {role: 'estimated-wall-band', wallBandId: band.id};
    group.add(mesh);
  }
  if (windows.length) {
    const segments = windows.flatMap(({segment: [a, b]}) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      const nx = -dz / length * 0.065, nz = dx / length * 0.065;
      return [
        [a[0], WINDOW_SILL_CUT_HEIGHT, a[1]], [a[0], INTERIOR_CUT_HEIGHT + 0.015, a[1]],
        [b[0], WINDOW_SILL_CUT_HEIGHT, b[1]], [b[0], INTERIOR_CUT_HEIGHT + 0.015, b[1]],
        [a[0] - nx, INTERIOR_CUT_HEIGHT + 0.015, a[1] - nz], [b[0] - nx, INTERIOR_CUT_HEIGHT + 0.015, b[1] - nz],
        [a[0] + nx, INTERIOR_CUT_HEIGHT + 0.015, a[1] + nz], [b[0] + nx, INTERIOR_CUT_HEIGHT + 0.015, b[1] + nz],
        [a[0] - nx, INTERIOR_CUT_HEIGHT + 0.015, a[1] - nz], [a[0] + nx, INTERIOR_CUT_HEIGHT + 0.015, a[1] + nz],
        [b[0] - nx, INTERIOR_CUT_HEIGHT + 0.015, b[1] - nz], [b[0] + nx, INTERIOR_CUT_HEIGHT + 0.015, b[1] + nz],
      ];
    });
    const material = new THREE.LineBasicMaterial({color: 0x91b9c8, transparent: true, opacity: 1, depthWrite: false});
    material.userData.themeRole = 'interiorWindow';
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(segments.flat(), 3)), material);
    lines.userData = {role: 'resident-window-symbols', count: windows.length, windowIds: windows.map(window => window.id)};
    group.add(lines);
  }
  for (const door of doors) {
    const [a, b] = door.segment, dx = b[0] - a[0], dz = b[1] - a[1];
    const width = Math.hypot(dx, dz), nx = -dz / width, nz = dx / width;
    const center = [(a[0] + b[0]) / 2, 0.13, (a[1] + b[1]) / 2];
    const pad = 0.28;
    const corners = [
      [a[0] - nx * pad, 0.08, a[1] - nz * pad], [b[0] - nx * pad, 0.08, b[1] - nz * pad],
      [b[0] + nx * pad, 0.08, b[1] + nz * pad], [a[0] + nx * pad, 0.08, a[1] + nz * pad],
    ];
    const material = new THREE.MeshBasicMaterial({ color: 0xb6a886, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
    material.userData.themeRole = 'sharedSpace';
    const mesh = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 1, 2, 0, 2, 3].flatMap(index => corners[index]), 3)), material);
    mesh.userData = { house, floor, spaceId: door.spaceId, openingId: door.id, role: 'interior-opening' };
    group.add(mesh);
    pickables.push(mesh);

    const segments = [[a[0], 0.09, a[1]], [b[0], 0.09, b[1]]];
    // Do not guess a hinge or swing for a door whose plan doesn't supply one.
    if (door.hinge && door.swing) {
      const hinge = door.hinge === 'start' ? a : b, closed = door.hinge === 'start' ? b : a;
      const theta = Math.atan2(closed[1] - hinge[1], closed[0] - hinge[0]);
      const turn = door.swing === 'left' ? -Math.PI / 2 : Math.PI / 2;
      const arc = Array.from({ length: 17 }, (_, index) => {
        const angle = theta + turn * index / 16;
        return [hinge[0] + Math.cos(angle) * width, 0.09, hinge[1] + Math.sin(angle) * width];
      });
      for (let index = 1; index < arc.length; index++) segments.push(arc[index - 1], arc[index]);
      segments.push([hinge[0], 0.09, hinge[1]], arc.at(-1));
    }
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xb6a886, transparent: true, opacity: 1 });
    lineMaterial.userData.themeRole = 'sharedSpace';
    const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(segments.flat(), 3)), lineMaterial);
    lines.userData.role = 'interior-door-symbol';
    group.add(lines);
    labels.push({ text: door.label, position: center, spaceId: door.spaceId, openingId: door.id, kind: 'door', confidence: door.confidence });
  }
  return { group, pickables, labels };
}
