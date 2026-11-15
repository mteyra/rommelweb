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
  for (const [number, building] of Object.entries(historical.buildings)) {
    if (number !== '55') {
      assert.deepEqual(current.buildings[number], building,
        `House ${number} must retain its historical study instead of inheriting the new module plan`);
      continue;
    }
    // House 55's first and top floors now have independent module studies.
    // Its ground floor and every other house retain the archived geometry.
    for (const level of building.levels.filter(item => item.index === 0)) {
      assert.deepEqual(current.buildings[number].levels.find(item => item.index === level.index), level,
        `House 55 floor ${level.index} must retain its historical study`);
    }
  }
}
