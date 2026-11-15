import { isIndependentLayout, studyPlanDirection } from './interior-studies.js';

const ringArea = ring => {
  const [ox, oz] = ring[0];
  return Math.abs(ring.slice(1).reduce((sum, point, index) => {
    const previous = ring[index];
    return sum + (previous[0] - ox) * (point[1] - oz) - (point[0] - ox) * (previous[1] - oz);
  }, 0) / 2);
};

/** Computed design extents; the layout basis distinguishes clear rooms from gross study envelopes. */
export function studyRoomMeasurements(level, space) {
  if (!level?.isStudy || space?.kind !== 'room') return null;
  const direction = studyPlanDirection(level);
  const length = Math.hypot(direction[0], direction[2]);
  const along = [direction[2] / length, -direction[0] / length];
  const across = [-along[1], along[0]];
  const span = axis => {
    const positions = space.polygon.map(point => point[0] * axis[0] + point[1] * axis[1]);
    return Math.max(...positions) - Math.min(...positions);
  };
  const spans = [span(along), span(across)].sort((a, b) => a - b);
  const area = ringArea(space.polygon) - (space.holes || []).reduce((sum, hole) => sum + ringArea(hole), 0);
  return {shortSpan: spans[0], longSpan: spans[1], area, areaBasis: isIndependentLayout(level) ? 'clear-room-layout' : 'gross-study-envelope'};
}

const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/**
 * Exterior section lengths in source metres, independent of the room study.
 * Join only points within 2 mm of the same straight run. Real returns, including
 * concave steps, remain individual edges; internal room and wall-band edges are
 * never inputs. The supplied geometry is left intact.
 */
export function exteriorDimensionRuns(polygons = []) {
  return polygons.flatMap(({outer}, polygonIndex) => {
    if (!outer?.length) return [];
    const points = outer.filter((point, index) => index === 0 || distance(point, outer[index - 1]) > 1e-8).map(point => [...point]);
    if (points.length > 1 && distance(points[0], points.at(-1)) < 1e-8) points.pop();
    let removed = true;
    while (removed && points.length > 3) {
      removed = false;
      for (let i = 0; i < points.length; i++) {
        const a = points[(i + points.length - 1) % points.length], b = points[i], c = points[(i + 1) % points.length];
        const dx = c[0] - a[0], dz = c[1] - a[1], length = Math.hypot(dx, dz);
        const along = ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / length;
        const deviation = Math.abs(dx * (a[1] - b[1]) - (a[0] - b[0]) * dz) / length;
        if (length > 0 && along > 0 && along < length && deviation <= 0.002) {
          points.splice(i, 1);
          removed = true;
          break;
        }
      }
    }
    if (points.length < 3) return [];
    const [ox, oz] = points[0];
    const winding = Math.sign(points.reduce((sum, a, i) => {
      const b = points[(i + 1) % points.length];
      return sum + (a[0] - ox) * (b[1] - oz) - (b[0] - ox) * (a[1] - oz);
    }, 0));
    return points.map((start, index) => {
      const end = points[(index + 1) % points.length];
      const length = distance(start, end);
      return {
        id: `${polygonIndex}:${index}`, start, end, length,
        outward: [winding * (end[1] - start[1]) / length, winding * (start[0] - end[0]) / length],
        label: `${length.toFixed(2)} m`,
      };
    });
  });
}

export function studyDimensionRuns(level) {
  return (level?.dimensionGuides || []).map(guide => {
    const [start, end] = guide.segment, length = distance(start, end);
    return {
      id: guide.id, start, end, length, outward: guide.outward,
      label: `${guide.label}${isIndependentLayout(level) ? '' : ' ≈'} ${length.toFixed(2)} m`,
      note: guide.note, isStudyGuide: true, priority: 1,
    };
  });
}

const boundsOverlap = (a, b, gap = 3) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap;

const pointInRing = (point, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
};

const ringIntersectsBounds = (ring, bounds) => {
  const corners = [[bounds.left, bounds.top], [bounds.right, bounds.top], [bounds.right, bounds.bottom], [bounds.left, bounds.bottom]];
  if (corners.some(point => pointInRing(point, ring))) return true;
  return ring.some((a, index) => {
    const b = ring[(index + 1) % ring.length];
    let lower = 0, upper = 1;
    for (const [axis, minimum, maximum] of [[0, bounds.left, bounds.right], [1, bounds.top, bounds.bottom]]) {
      const delta = b[axis] - a[axis];
      if (Math.abs(delta) < 1e-8) {
        if (a[axis] < minimum || a[axis] > maximum) return false;
      } else {
        const ts = [(minimum - a[axis]) / delta, (maximum - a[axis]) / delta].sort((x, y) => x - y);
        lower = Math.max(lower, ts[0]);
        upper = Math.min(upper, ts[1]);
      }
    }
    return lower <= upper;
  });
};

/**
 * Place projected dimensions in CSS pixels. Door/room labels have priority.
 * A dimension is shown only when its entire edge is visible, its text fits,
 * and its label lies outside the floor. Short returns become readable on zoom.
 */
export function layoutExteriorDimensions(projected, {viewport, occupied = [], outlines = [], compact = false}) {
  const placements = [];
  const obstacles = [...occupied];
  const fontSize = compact ? 10 : 10.5;
  const candidates = projected.filter(run => run.visible !== false)
    .map(run => ({...run, screenLength: distance(run.start, run.end)}))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0) || b.screenLength - a.screenLength || a.id.localeCompare(b.id));
  for (const run of candidates) {
    const {start, end, screenLength} = run;
    const textWidth = run.label.length * fontSize * 0.62 + 6, textHeight = fontSize + 5;
    if (screenLength < textWidth + (compact ? 4 : 12)) continue;
    if ([...start, ...end, ...run.outwardPoint].some(value => !Number.isFinite(value))) continue;
    if ([start, end].some(([x, y]) => x < viewport.left || x > viewport.right || y < viewport.top || y > viewport.bottom)) continue;
    const tangent = [(end[0] - start[0]) / screenLength, (end[1] - start[1]) / screenLength];
    let normal = [tangent[1], -tangent[0]];
    const middle = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
    if (normal[0] * (run.outwardPoint[0] - middle[0]) + normal[1] * (run.outwardPoint[1] - middle[1]) < 0) normal = normal.map(value => -value);
    let angle = Math.atan2(tangent[1], tangent[0]);
    if (angle > Math.PI / 2) angle -= Math.PI;
    if (angle < -Math.PI / 2) angle += Math.PI;
    const width = Math.abs(Math.cos(angle)) * textWidth + Math.abs(Math.sin(angle)) * textHeight;
    const height = Math.abs(Math.sin(angle)) * textWidth + Math.abs(Math.cos(angle)) * textHeight;
    for (const offset of compact ? [18, 24, 12] : [22, 30, 14]) {
      const labelPoint = middle.map((value, axis) => value + normal[axis] * (offset + 11));
      const bounds = {left: labelPoint[0] - width / 2, right: labelPoint[0] + width / 2, top: labelPoint[1] - height / 2, bottom: labelPoint[1] + height / 2};
      if (bounds.left < viewport.left || bounds.right > viewport.right || bounds.top < viewport.top || bounds.bottom > viewport.bottom) continue;
      if (obstacles.some(obstacle => boundsOverlap(bounds, obstacle))) continue;
      // Concave recesses can face another wing. Do not place text over that wing.
      if (!run.isStudyGuide && outlines.some(ring => ringIntersectsBounds(ring, bounds))) continue;
      const at = (point, amount) => point.map((value, axis) => value + normal[axis] * amount);
      const lineStart = at(start, offset), lineEnd = at(end, offset);
      const tick = point => [
        point.map((value, axis) => value - (tangent[axis] + normal[axis]) * 3),
        point.map((value, axis) => value + (tangent[axis] + normal[axis]) * 3),
      ];
      placements.push({
        ...run, bounds, labelPoint, angle: angle * 180 / Math.PI,
        dimensionLine: [lineStart, lineEnd],
        extensionLines: [[at(start, 4), at(start, offset + 4)], [at(end, 4), at(end, offset + 4)]],
        ticks: [tick(lineStart), tick(lineEnd)],
      });
      obstacles.push(bounds);
      break;
    }
  }
  return placements;
}
