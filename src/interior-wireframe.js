import * as THREE from 'three';

// A low cutaway for legibility, not a claim about measured ceiling height.
export const INTERIOR_CUT_HEIGHT = 1.05;
const EPSILON = 1e-6;

function splitAtDoors(a, b, doors) {
  const dx = b[0] - a[0], dz = b[1] - a[1], lengthSquared = dx * dx + dz * dz;
  const intervals = [];
  for (const door of doors) {
    if (!door.segment.every(point => Math.abs(dx * (point[1] - a[1]) - dz * (point[0] - a[0])) < EPSILON)) continue;
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

function trianglesForSpace(space, height) {
  const points = space.polygon.slice(0, -1);
  return THREE.ShapeUtils.triangulateShape(points.map(([x, z]) => new THREE.Vector2(x, z)), [])
    .flatMap(triangle => triangle.flatMap(index => [points[index][0], height, points[index][1]]));
}

/** Keep the label inside its polygon, including L-shaped rooms and corridors. */
function labelPosition(space) {
  const triangles = trianglesForSpace(space, 0.16);
  let best = null, maxArea = -1;
  for (let index = 0; index < triangles.length; index += 9) {
    const a = triangles.slice(index, index + 3), b = triangles.slice(index + 3, index + 6), c = triangles.slice(index + 6, index + 9);
    const area = Math.abs((b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]));
    if (area > maxArea) {
      maxArea = area;
      best = a.map((value, axis) => (value + b[axis] + c[axis]) / 3);
    }
  }
  return best;
}

/**
 * Render only validated, approved geometry. Empty coverage stays empty.
 * Coordinates remain campus-local metres; all heights here are display offsets.
 */
export function createInteriorWireframe(level, { house, floor }) {
  const group = new THREE.Group(), pickables = [], labels = [];
  group.userData = { role: 'approved-interior-cutaway', cutHeight: INTERIOR_CUT_HEIGHT };
  if (!level) return { group, pickables, labels };
  const doors = level.doors || [];
  const walls = [], joints = new Set();
  const addWall = (a, b) => {
    const key = [a.join(','), b.join(',')].sort().join('|');
    if (joints.has(key)) return;
    joints.add(key);
    walls.push(
      a[0], 0.045, a[1], b[0], 0.045, b[1],
      a[0], INTERIOR_CUT_HEIGHT, a[1], b[0], INTERIOR_CUT_HEIGHT, b[1],
      a[0], 0.045, a[1], a[0], INTERIOR_CUT_HEIGHT, a[1],
      b[0], 0.045, b[1], b[0], INTERIOR_CUT_HEIGHT, b[1],
    );
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
    for (let index = 1; index < space.polygon.length; index++) {
      for (const [a, b] of splitAtDoors(space.polygon[index - 1], space.polygon[index], doors)) addWall(a, b);
    }
    labels.push({ text: space.label, position: labelPosition(space), spaceId: space.id, kind: 'space' });
  }
  const wallMaterial = new THREE.LineBasicMaterial({ color: 0xdfdfd5, transparent: true, opacity: 0.7 });
  wallMaterial.userData.themeRole = 'room';
  const wallLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(walls, 3)), wallMaterial);
  wallLines.userData.role = 'interior-walls';
  group.add(wallLines);

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
    labels.push({ text: door.label, position: center, spaceId: door.spaceId, openingId: door.id, kind: 'door' });
  }
  return { group, pickables, labels };
}
