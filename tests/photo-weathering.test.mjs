import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {intersection, union} from 'polyclip-ts';
import {createTimberBoardStudy} from '../src/facade.js';

const wall = {
  type: 'WallSurface', points: [[0, 0, 0], [6, 0, 0], [6, 9, 0], [0, 9, 0], [0, 0, 0]],
  holes: [[[2, 2, 0], [4, 2, 0], [4, 4, 0], [2, 4, 0], [2, 2, 0]]],
};
const options = {
  elevations: [0, 3, 6, 9],
  exclusions: [[[0.5, 0.7, 0], [2.8, 0.7, 0], [2.8, 3, 0], [0.5, 3, 0], [0.5, 0.7, 0]]],
};
const area = polygons => polygons.reduce((total, polygon) => total + polygon.reduce((sum, ring, index) =>
  sum + (index ? -1 : 1) * Math.abs(ring.slice(1).reduce((a, p, i) => a + ring[i][0] * p[1] - p[0] * ring[i][1], 0)) / 2, 0), 0);

test('photographic weathering is opt-in and the original default output stays byte-identical', () => {
  const original = createTimberBoardStudy(wall, options);
  assert.equal(createHash('sha256').update(JSON.stringify(original)).digest('hex'),
    'd1146480e6a73a068ea8a54a870e93c431e581b6f58a7abebf554f867e807e57');
  assert.deepEqual(createTimberBoardStudy(wall, {...options, refinedWeathering: false}), original);
});

test('refined weathering resolves storey bands while retaining exact opening exclusions and the wall plane', () => {
  const source = {...wall, points: [[0, 0, 0], [6, 0, 0], [6, 7, 0], [4, 9, 0], [0, 9, 0], [0, 0, 0]]};
  const before = JSON.stringify({source, options});
  const study = createTimberBoardStudy(source, {...options, refinedWeathering: true});
  const forbidden = union(...[...source.holes, ...options.exclusions].map(ring => [ring.map(p => p.slice(0, 2))]));
  for (let i = 0; i < study.positions.length; i += 9) {
    const triangle = [0, 3, 6].map(offset => study.positions.slice(i + offset, i + offset + 2));
    const ring = [...triangle, triangle[0]], size = area([[ring]]);
    assert.ok(size > 1e-12);
    assert.ok(area(intersection([ring], forbidden)) < 1e-8, 'No color triangle crosses a window, hole or their overlap');
    assert.ok(size - area(intersection([ring], [source.points.map(p => p.slice(0, 2))])) < 1e-8);
    assert.ok([2, 5, 8].every(offset => study.positions[i + offset] === 0));
  }
  const heights = study.positions.filter((_, index) => index % 3 === 1);
  for (const y of [0.36, 2.4, 3, 3.36, 5.4, 6, 6.36, 8.4]) {
    assert.ok(heights.some(height => Math.abs(height - y) < 1e-9), `Weathering stops are represented at ${y}m`);
  }
  assert.ok(study.positions.length / 9 < 1600, 'The three-storey reference remains a bounded mesh');
  assert.ok(study.dayColors.every((value, index) => Number.isFinite(value) && value >= 0 && value <= 1 && value > study.nightColors[index]));
  assert.deepEqual(createTimberBoardStudy(source, {...options, refinedWeathering: true}), study);
  assert.equal(JSON.stringify({source, options}), before);
});

test('photographed upper storey reads grayer than the sheltered warmer strips below it', () => {
  const study = createTimberBoardStudy({...wall, holes: []}, {elevations: [0, 3, 6, 9], refinedWeathering: true});
  const colorsAt = target => {
    const values = [];
    for (let i = 0; i < study.positions.length; i += 3) {
      if (Math.abs(study.positions[i + 1] - target) > 1e-8) continue;
      values.push(study.dayColors.slice(i, i + 3));
    }
    return values;
  };
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const warmthAt = target => mean(colorsAt(target).map(([r, , b]) => r - b));
  assert.ok(warmthAt(5.4) > warmthAt(8.4) + 0.07, 'Highest storey is predominantly weathered silver');
  assert.ok(warmthAt(5.4) > warmthAt(3.36) + 0.05, 'Warm upper board ends differ from the dark lower strip');
  const luminanceAt = target => colorsAt(target).map(([r, g, b]) => r * 0.2126 + g * 0.7152 + b * 0.0722);
  const upper = luminanceAt(8.4), sheltered = luminanceAt(5.4), lower = luminanceAt(3.36);
  assert.ok(mean(sheltered) > mean(upper) * 1.6, 'Dark exposed top and warm sheltered boards retain visible tonal separation');
  assert.ok(mean(sheltered) > mean(lower) * 1.6, 'Lower board ends are distinctly weathered');
  const upperMean = mean(upper);
  assert.ok(Math.sqrt(mean(upper.map(value => (value - upperMean) ** 2))) > 0.02,
    'Individual boards retain charcoal-to-silver variation instead of a uniform flat gray');
});
