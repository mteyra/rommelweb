import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Exact retained bytes used by the dated R-alignment/other-house audits.
// Keep their original paths in audit records; resolve those paths to these
// snapshots only when checking that historical evidence.
const snapshots = {
  'public/data/interior-studies.json': 'data/source/interior-studies-before-module-layout.json',
  'scripts/generate-old-house-studies.mjs': 'data/source/generate-old-house-studies-before-module-layout.mjs',
};

export const readHistoricalSource = path =>
  readFile(new URL(`../../${snapshots[path] || path}`, import.meta.url));

export const readHistoricalStudies = async () =>
  JSON.parse(await readHistoricalSource('public/data/interior-studies.json'));

export function assertUnchangedOtherFloors(current, historical) {
  const fittedTargets = new Set(['51', '53', '57', '59']);
  const without = (record, allowed) => Object.fromEntries(Object.entries(record)
    .filter(([key]) => !allowed.includes(key)));
  for (const [number, building] of Object.entries(historical.buildings)) {
    // Dedicated module tests protect House 55. The later other-house fitting
    // may replace only provisional interiors, retaining every original outline.
    if (number === '55') continue;
    const next = current.buildings[number];
    const fitted = next?.levels.some(level => level.layoutBasis === 'fitted-module-layout');
    if (!fitted) {
      assert.deepEqual(next, building, `House ${number} retains its historical study`);
      continue;
    }
    assert.ok(fittedTargets.has(number), `House ${number} is an explicitly requested old-house target`);
    assert.deepEqual(without(next, ['source', 'sourceDate', 'levels']),
      without(building, ['source', 'sourceDate', 'levels']));
    assert.deepEqual(next.levels.map(level => level.index), building.levels.map(level => level.index),
      `House ${number} retains its original floor inventory`);
    for (const original of building.levels) {
      const level = next.levels.find(item => item.index === original.index);
      if (level.layoutBasis !== 'fitted-module-layout') {
        assert.deepEqual(level, original);
        continue;
      }
      const changes = ['label', 'source', 'notes', 'layoutBasis', 'spaces', 'doors',
        'wallBands', 'dimensionGuides', 'layoutWindows', 'extrapolatedFrom'];
      assert.deepEqual(without(level, changes), without(original, changes),
        `${number}/${level.index}: source outline, openings and other source fields remain exact`);
      assert.ok(level.spaces.every(space => space.confidence === 'estimated'));
      assert.ok((level.doors || []).every(door => door.confidence === 'estimated'));
    }
  }
}
