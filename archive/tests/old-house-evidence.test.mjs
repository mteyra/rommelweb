import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {readHistoricalSource, assertUnchangedOtherFloors} from './fixtures/pre-module-studies.mjs';

const read = path => readFile(new URL(`../${path}`, import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

test('the historical old-house audit keeps its exact source fingerprints and unchanged incomplete-inventory findings', async () => {
  const paths = [
    'public/data/interior-studies.json',
    'data/source/old-house-study-provenance.json',
    'public/data/lod2.json', 'public/data/interiors.json',
    'public/data/campus.json', 'public/data/room-markers.json',
    'scripts/generate-old-house-studies.mjs',
  ];
  const [auditBytes, ...inputs] = await Promise.all([
    read('docs/evidence/old-house-studies-audit.json'), ...paths.map(readHistoricalSource),
  ]);
  const audit = JSON.parse(auditBytes), studies = JSON.parse(inputs[0]);
  assert.deepEqual(audit.inputs.map(record => record.path), paths);
  paths.forEach((path, i) => assert.equal(audit.inputs[i].sha256, sha(inputs[i]),
    `Retain the exact historical input bytes for ${path}`));
  assertUnchangedOtherFloors(JSON.parse(await read('public/data/interior-studies.json')), studies);
  const houses = ['51', '53', '55', '57', '59'];
  const levels = houses.flatMap(number => studies.buildings[number].levels);
  assert.equal(levels.length, 15);
  assert.equal(audit.summary.allNumericalGeometryChecksPass, true);
  assert.equal(audit.summary.studyRoomHypotheses,
    levels.reduce((sum, level) => sum + level.spaces.filter(space => space.kind === 'room').length, 0));
  assert.ok(audit.summary.studyRoomHypotheses < audit.summary.publicIndexEntries,
    'Unassigned banks and lower wings must remain a visible inventory gap');
  assert.ok(audit.summary.roomHypothesesWithoutRepresentedStairRoute > 0,
    'A consistent drawing must not conceal its unverified stair connections');
  for (const number of houses) {
    assert.deepEqual(audit.houses[number].levels.map(level => level.floorIndex), [0, 1, 2]);
  }
});
