import {surfaceFrame} from './facade.js';

/**
 * Fractions along each photographed elevation, independent of the provisional
 * room layouts. East: NE→SE; west: NW→SW; south: SW→SE. Dark roller shutters
 * are still openings. The bright horizontal green streaks are lens flare.
 *
 * East rows are read from a planar rectification of photos 1/2 and checked
 * against photo 5. Trees and cropped roof corners make the west upper/south
 * rows less certain; these remain explicit photographic estimates.
 */
export const GRAU_WINDOW_FRACTIONS = Object.freeze({
  east: [
    [],
    [0.064, 0.200, 0.337, 0.474, 0.608],
    [0.116, 0.253, 0.389, 0.523, 0.609],
    [0.066, 0.203, 0.343, 0.483],
    [0.254, 0.391, 0.524, 0.614],
    [0.075, 0.212, 0.349, 0.480, 0.614],
  ],
  west: [
    [0.061, 0.211, 0.354, 0.489, 0.623, 0.747],
    [0.258, 0.406, 0.546, 0.685, 0.796, 0.942],
    [0.066, 0.214, 0.363, 0.507, 0.654, 0.803],
    [0.121, 0.269, 0.419, 0.565, 0.710, 0.844, 0.949],
    [0.071, 0.220, 0.374, 0.523, 0.670, 0.817, 0.963],
    [0.121, 0.269, 0.419, 0.565, 0.710, 0.829],
  ],
  south: [
    [], // The dedicated bicycle/service-porch mesh provides ground openings.
    [0.288, 0.406, 0.557, 0.714, 0.866],
    [0.435, 0.591, 0.752, 0.923],
    [0.287, 0.392, 0.546, 0.697],
    [0.300, 0.440, 0.606, 0.757, 0.942],
    [0.425, 0.558, 0.709, 0.860, 0.947],
  ],
});

const nw = [12.881, 0, -30.699], ne = [34.692, 0, -36.870];
const sw = [19.092, 0, -8.705], se = [40.872, 0, -14.857];
const floors = [0, 1, 2, 3, 4, 5];
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export function addGrauWindowLayouts({building, output}) {
  for (const {name, indices, start, end, photos} of [
    {name: 'east', indices: [7], start: ne, end: se, photos: [1, 2, 5]},
    {name: 'south', indices: [5, 3], start: sw, end: se, photos: [3]},
    {name: 'west', indices: [9], start: nw, end: sw, photos: [6, 7]},
  ]) {
    const fractions = GRAU_WINDOW_FRACTIONS[name];
    for (const index of indices) {
      const surface = building.surfaces[index], frame = surfaceFrame(surface);
      output.layoutsBySurface.set(surface, {
        replace: true, replaceLocatedFloors: [...floors], recessDepth: 0.14,
        rows: fractions.map((centers, floor) => ({
          floor, centers: centers.map(f => frame.project(lerp(start, end, f))[0]),
          width: 1.10, height: 2.50, sillOffset: 0.14, headHeight: 0.28, transomRatio: 0.34,
        })),
      });
    }
    output.features.push({
      id: `55a-${name}-photographic-window-rows`, kind: 'photographic-window-rows',
      sourceSurfaceIndices: indices, photos,
      rows: fractions.map((centers, floor) => ({
        floor, count: centers.length, fractions: [...centers],
        coverage: name === 'east' ? 'visible photographed row; cage and corner recesses excluded'
          : name === 'south' ? 'partial photo coverage; tree-hidden bays and cropped top remain estimates'
            : floor === 0 ? 'six visible ground openings; southwest timber end remains blank'
              : 'photo-informed staggered row; tree-hidden and upper-corner positions remain estimates',
      })),
      evidence: name === 'east'
        ? 'Two nearly frontal photographs establish the broad blank southeast strip and nonuniform final bay spacing on floors 2 and 4. Overlapping photo 5 confirms face identity.'
        : name === 'south'
          ? 'Photo 3 fixes both corner returns and the visible window rhythm. Branches obscure the lower center and the roof corner is cropped; inferred centers are provisional, not a verified room inventory.'
          : 'Photos 6/7 show a six-window ground row, alternating upper offsets, NW floor-1 recess and SW floor-2/floor-5 returns. Branches conceal several panes; upper positions are estimates.',
    });
  }
  for (const index of [2, 0, 4, 6]) {
    output.layoutsBySurface.set(building.surfaces[index], {
      replace: true, replaceLocatedFloors: [...floors], recessDepth: 0.14,
      rows: floors.map(floor => ({floor, centers: []})),
    });
  }
}
