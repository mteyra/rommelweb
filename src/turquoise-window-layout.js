import {surfaceFrame} from './facade.js';

/**
 * Turquoise / 57a, resident photographs, 16 November 2026.
 *
 * Positions are fractions estimated by rectifying the visible wall corners;
 * they are appearance evidence, not a survey or a replacement floorplan.
 * Dark panes remain windows. Tree cover, flare and the unlit top of the west
 * face limit confidence in those rows. No apartment identities are inferred.
 *
 * The three room elevations have different distributions. In particular the
 * south and east faces retain the broad windowless timber beside the long
 * corner-loggia arms. The front has no room windows in its timber wings.
 */
export const TURQUOISE_WINDOW_FRACTIONS = Object.freeze({
  // Photo 4, from southwest to southeast. Left 35–40% is mainly blank.
  south: [
    [0.211, 0.297, 0.547],
    [0.501, 0.645, 0.783, 0.918],
    [0.553, 0.683, 0.829, 0.961],
    [0.415, 0.500, 0.646, 0.783],
    [0.407, 0.552, 0.686, 0.823, 0.960],
    [0.501, 0.643, 0.775, 0.951],
    [0.403, 0.540, 0.688, 0.823],
    [0.405, 0.500, 0.636, 0.775, 0.951],
  ],
  // Photos 3 and 4, from northeast to southeast. The cage occupies ground.
  east: [
    [],
    [0.089, 0.231, 0.373, 0.516, 0.657],
    [0.132, 0.277, 0.414, 0.557, 0.653],
    [0.088, 0.229, 0.368, 0.506],
    [0.232, 0.372, 0.514, 0.648],
    [0.093, 0.235, 0.372, 0.513, 0.650],
    [0.131, 0.274, 0.415, 0.557],
    [0.091, 0.235, 0.371, 0.514, 0.650],
  ],
  // Photo 1, from northwest to southwest. The shifted rows are deliberate;
  // forcing a single vertically aligned grid erases visible timber panels.
  west: [
    [0.064, 0.207, 0.350, 0.491, 0.635, 0.778, 0.920],
    [0.253, 0.399, 0.543, 0.681, 0.820, 0.949],
    [0.062, 0.209, 0.353, 0.499, 0.637, 0.774],
    [0.111, 0.258, 0.404, 0.546, 0.686, 0.829, 0.965],
    [0.062, 0.210, 0.355, 0.501, 0.645, 0.787, 0.936],
    [0.128, 0.270, 0.413, 0.557, 0.700, 0.842],
    [0.097, 0.242, 0.386, 0.529, 0.673, 0.817, 0.957],
    [0.262, 0.423, 0.560, 0.699, 0.837, 0.965],
  ],
});

const NW = [64.713, 0, -14.562], NE = [86.607, 0, -9.008];
const SW = [59.090, 0, 7.582], SE = [81.003, 0, 13.166];
const floorIndexes = Array.from({length: 8}, (_, floor) => floor);
const lerp = (a, b, fraction) => a.map((value, i) => value + (b[i] - value) * fraction);

/** Only the folded exterior appearance is changed; no source data is edited. */
export function addTurquoiseWindowLayouts({building, output}) {
  const faces = [
    {name: 'south', indices: [0], start: SW, end: SE, photos: [4]},
    {name: 'east', indices: [9, 8], start: NE, end: SE, photos: [3, 4]},
    {name: 'west', indices: [6], start: NW, end: SW, photos: [1]},
  ];
  for (const {name, indices, start, end, photos} of faces) {
    const fractions = TURQUOISE_WINDOW_FRACTIONS[name];
    for (const index of indices) {
      const surface = building.surfaces[index], frame = surfaceFrame(surface);
      output.layoutsBySurface.set(surface, {
        replace: true,
        replaceLocatedFloors: [...floorIndexes],
        recessDepth: 0.14,
        rows: fractions.map((centers, floor) => ({
          floor,
          centers: centers.map(fraction => frame.project(lerp(start, end, fraction))[0]),
          width: 1.1,
          height: name === 'south' && floor === 0 ? 1.12 : 2.5,
          sillOffset: name === 'south' && floor === 0 ? 0.18 : 0.14,
          headHeight: name === 'south' && floor === 0 ? 0.10 : 0.25,
          transomRatio: name === 'south' && floor === 0 ? 0.50 : 0.35,
        })),
      });
    }
    output.features.push({
      id: `57a-${name}-photographic-window-rows`,
      kind: 'photographic-window-rows',
      sourceSurfaceIndices: indices,
      photos,
      rows: fractions.map((centers, floor) => ({
        floor, count: centers.length, fractions: [...centers],
        coverage: name === 'west'
          ? 'photo-informed row; far corner flare and tree-hidden bays are estimated'
          : name === 'south' && floor <= 1
            ? 'visible openings only; trees obscure the remaining ground and first-floor wall'
            : 'photo-informed row; corner loggias are excluded separately',
      })),
      evidence: `${name === 'east' ? 'Cross-checked in two overlapping photographs.' : 'Single photographed elevation.'} Fractions use a coarse planar rectification. Widths, shallow recesses and pane divisions remain estimated. Ground south windows are visibly shorter; the east cage has no apartment-window grid.`,
    });
  }
  // Both solid wings of the gallery side are windowless in photos 2 and 3.
  // Dedicated gallery and entrance geometry supplies the recessed openings.
  for (const index of [2, 1, 5, 4]) {
    output.layoutsBySurface.set(building.surfaces[index], {
      replace: true, replaceLocatedFloors: [...floorIndexes], recessDepth: 0.14,
      rows: floorIndexes.map(floor => ({floor, centers: []})),
    });
  }
}
