import {surfaceFrame} from './facade.js';

/**
 * Lila / 53a: the resident's eight photographs, 16 November 2026.
 *
 * Horizontal positions are photo estimates along the unchanged source faces.
 * They are deliberately independent of the provisional apartment plans.
 * The south face alternates two window rhythms; the north and west have
 * their own stacks and substantial blank timber beside the long loggias.
 *
 * Photo 2 trees conceal the middle of west floor 1 and most of west ground.
 * Only its two visible floor-1 windows are recorded here. The resulting
 * empty hidden spans do not establish that there are no windows behind trees.
 * The visible west ground opening is a service door, rendered separately.
 */
const frozenRows = rows => Object.freeze(rows.map(row => Object.freeze(row)));
export const LILA_WINDOW_FRACTIONS = Object.freeze({
  // Photos 1 and 3, southeast -> southwest.
  // Floor 4 loses its first bay to SE; floor 1 loses its last bay to SW.
  south: frozenRows([
    [0.130, 0.267, 0.404, 0.541, 0.678, 0.815, 0.952],
    [0.070, 0.207, 0.344, 0.481, 0.618, 0.755],
    [0.130, 0.267, 0.404, 0.541, 0.678, 0.815, 0.952],
    [0.070, 0.207, 0.344, 0.481, 0.618, 0.755, 0.892],
    [0.267, 0.404, 0.541, 0.678, 0.815, 0.952],
  ]),
  // Photos 6–8, northwest -> northeast. Ground is the bicycle cage.
  // The broad NW timber span has no ordinary window grid.
  north: frozenRows([
    [],
    [0.388, 0.527, 0.665, 0.804, 0.938],
    [0.386, 0.478, 0.617, 0.754],
    [0.533, 0.668, 0.801, 0.942],
    [0.387, 0.481, 0.618, 0.754, 0.940],
  ]),
  // Photo 2, northwest -> southwest. The last ~38% is blank timber above
  // the long SW floor-1 loggia; the short NW floor-3 return is at the start.
  west: frozenRows([
    [],
    [0.050, 0.450],
    [0.050, 0.230, 0.365, 0.500, 0.600],
    [0.180, 0.315, 0.450, 0.600],
    [0.100, 0.230, 0.365, 0.500, 0.600],
  ]),
});

const SE = [23.079, 0, -58.260], SW = [0.996, 0, -63.869];
const NE = [28.636, 0, -80.206], NW = [6.564, 0, -85.824];
const floors = Object.freeze([0, 1, 2, 3, 4]);
const lerp = (a, b, fraction) => a.map((value, index) => value + (b[index] - value) * fraction);

export const LILA_WINDOW_FACES = Object.freeze([
  Object.freeze({name: 'south', indices: Object.freeze([2]), start: SE, end: SW, photos: Object.freeze([1, 3])}),
  Object.freeze({name: 'north', indices: Object.freeze([7]), start: NW, end: NE, photos: Object.freeze([6, 7, 8])}),
  Object.freeze({name: 'west', indices: Object.freeze([5, 8]), start: NW, end: SW, photos: Object.freeze([2, 3])}),
]);

function coverage(name, floor) {
  if (name === 'north' && floor === 0) return 'bicycle cage; no apartment-window row';
  if (name === 'west' && floor === 0) return 'service door modeled separately; trees obscure the rest of this level';
  if (name === 'west' && floor === 1) return 'two visible openings only; trees conceal the middle bays, so this is not a floor total';
  if (name === 'south' && floor === 0) return 'seven openings visible in photo 3; shutters and low fence obscure pane details';
  return 'photo-informed row; separate corner loggias excluded';
}

/** Replace the folded exterior display inventory without changing any plan. */
export function addLilaWindowLayouts({building, output}) {
  for (const {name, indices, start, end, photos} of LILA_WINDOW_FACES) {
    const fractions = LILA_WINDOW_FRACTIONS[name];
    for (const index of indices) {
      const surface = building.surfaces[index], frame = surfaceFrame(surface);
      output.layoutsBySurface.set(surface, {
        replace: true,
        replaceLocatedFloors: [...floors],
        recessDepth: 0.14,
        rows: fractions.map((centers, floor) => ({
          floor,
          centers: centers.map(fraction => frame.project(lerp(start, end, fraction))[0]),
          width: 1.10,
          height: 2.50,
          sillOffset: 0.14,
          headHeight: 0.27,
          transomRatio: 0.35,
        })),
      });
    }
    output.features.push({
      id: `53a-${name}-photographic-window-rows`,
      kind: 'photographic-window-rows',
      sourceSurfaceIndices: [...indices],
      photos: [...photos],
      rows: fractions.map((centers, floor) => ({
        floor, count: centers.length, fractions: [...centers], coverage: coverage(name, floor),
      })),
      evidence: `${name === 'south'
        ? 'Two opposite corner views show alternating south window rows and seven ground openings.'
        : name === 'north'
          ? 'Three overlapping north views show five/four/four/five upper openings, a windowless NW timber span and the bicycle cage.'
          : 'Photo 2 shows five/four/five upper openings and a broad windowless SW span. Trees obscure the middle of floor 1 and most of ground.'} Positions come from coarse planar photo rectification. Opening dimensions, recess depth and pane divisions remain estimates; no room identity or hidden opening count is inferred.`,
    });
  }

  // Photos 1, 4 and 5 show continuous timber in both entrance-front wings.
  // Doors and glazing belong to the recessed gallery/entrance assembly.
  for (const index of [9, 4, 1, 3]) {
    output.layoutsBySurface.set(building.surfaces[index], {
      replace: true,
      replaceLocatedFloors: [...floors],
      recessDepth: 0.14,
      rows: floors.map(floor => ({floor, centers: []})),
    });
  }
  output.features.push({
    id: '53a-east-windowless-entrance-wings',
    kind: 'photographic-window-exclusion',
    sourceSurfaceIndices: [9, 4, 1, 3],
    photos: [1, 4, 5],
    evidence: 'The entrance/gallery elevation has blank timber wings, two corner loggias and the recessed central gallery. No generic apartment-window grid is placed on these source faces.',
  });
}
