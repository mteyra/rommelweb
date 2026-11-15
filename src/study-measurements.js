import { studyPlanDirection } from './interior-studies.js';

const ringArea = ring => {
  const [ox, oz] = ring[0];
  return Math.abs(ring.slice(1).reduce((sum, point, index) => {
    const previous = ring[index];
    return sum + (previous[0] - ox) * (point[1] - oz) - (point[0] - ox) * (previous[1] - oz);
  }, 0) / 2);
};

/** Computed extents of validated study geometry, never measured clear-room dimensions. */
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
  return {shortSpan: spans[0], longSpan: spans[1], area};
}
