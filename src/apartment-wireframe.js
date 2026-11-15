import * as THREE from 'three';
import { createInteriorWireframe, INTERIOR_CUT_HEIGHT } from './interior-wireframe.js';

/** A separate design overlay: no furniture or service outline becomes source geometry. */
export function createApartmentWireframe(level, space, concept, {house, floor}) {
  const isolated = {
    ...level, spaces: [space],
    doors: (level.doors || []).filter(door => door.spaceId === space.id || door.toSpaceId === space.id)
      .map(door => ({...door, spaceId: space.id, toSpaceId: undefined})),
    windows: (level.windows || []).filter(window => window.spaceId === space.id),
    wallBands: [],
  };
  const cutaway = createInteriorWireframe(isolated, {house, floor});
  const {group} = cutaway;
  group.userData = {role: 'apartment-layout-concept', spaceId: space.id, status: concept.status};
  const labels = [];
  const addLines = (segments, role = 'room', dashed = false, opacity = 0.8) => {
    const material = dashed
      ? new THREE.LineDashedMaterial({color: 0xa8aaa3, transparent: true, opacity, dashSize: 0.11, gapSize: 0.08})
      : new THREE.LineBasicMaterial({color: 0xa8aaa3, transparent: true, opacity});
    material.userData.themeRole = role;
    const mesh = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(segments.flat(2), 3)), material);
    if (dashed) mesh.computeLineDistances();
    mesh.userData.role = 'concept-linework';
    group.add(mesh);
  };
  const raised = (point, height) => [point[0], height, point[1]];
  for (const item of concept.items || []) {
    const ring = item.polygon;
    if (!ring?.length) continue;
    const top = Math.min(item.height || 0.6, INTERIOR_CUT_HEIGHT);
    const segments = ring.slice(1).flatMap((point, i) => item.kind === 'bathroom' ? [
      [raised(ring[i], 0.06), raised(point, 0.06)],
    ] : [
      [raised(ring[i], top), raised(point, top)],
      [raised(ring[i], 0.06), raised(point, 0.06)],
      [raised(ring[i], 0.06), raised(ring[i], top)],
    ]);
    const service = /bath|kitchen|service/.test(item.kind);
    addLines(segments, service ? 'interiorWindow' : 'room', service, service ? 0.7 : 0.94);
    const corners = ring.slice(0, -1);
    labels.push({
      text: item.label,
      position: [corners.reduce((sum, p) => sum + p[0], 0) / corners.length, top + 0.12, corners.reduce((sum, p) => sum + p[1], 0) / corners.length],
    });
    // A mattress seam and pillow stay inside the fixed-size bed footprint.
    if (item.kind === 'bed' && corners.length === 4) {
      const local = (u, v) => corners[0].map((value, axis) => value + (corners[1][axis] - value) * u + (corners[3][axis] - value) * v);
      const pillow = [[0.15, 0.12], [0.85, 0.12], [0.85, 0.30], [0.15, 0.30], [0.15, 0.12]].map(([u, v]) => raised(local(u, v), top + 0.025));
      addLines(pillow.slice(1).map((point, i) => [pillow[i], point]), 'room', false, 0.6);
    }
  }
  for (const segment of concept.partitions || []) {
    const [a, b] = Array.isArray(segment) ? segment : segment.segment;
    addLines([[raised(a, 0.06), raised(b, 0.06)], [raised(a, INTERIOR_CUT_HEIGHT), raised(b, INTERIOR_CUT_HEIGHT)],
      [raised(a, 0.06), raised(a, INTERIOR_CUT_HEIGHT)], [raised(b, 0.06), raised(b, INTERIOR_CUT_HEIGHT)]], 'interiorWindow', true, 0.7);
  }
  return {group, pickables: cutaway.pickables, labels};
}
