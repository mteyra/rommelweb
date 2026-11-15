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
    // All three House 55 floors now have separate module plans. Their dedicated
    // module tests protect each accepted plan; other-house records stay frozen.
    if (number === '55') continue;
    assert.deepEqual(current.buildings[number], building,
      `House ${number} must retain its historical study instead of inheriting the new module plan`);
  }
}
