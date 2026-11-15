import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createInteriorWireframe } from '../src/interior-wireframe.js';
import { getDisplayLevel, validateInteriorStudies } from '../src/interior-studies.js';
import { createBuildingWindowStudies, getOldFacadeRowGuides } from '../src/windows.js';

const read = name => readFile(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8').then(JSON.parse);
const [studies, campus, lod2] = await Promise.all(['interior-studies', 'campus', 'lod2'].map(read));
const upper = data => data.buildings['55'].levels.find(level => level.index === 2);
const validate = data => validateInteriorStudies(data, campus, lod2);
const empty = {schemaVersion: 1, buildings: {}};

test('the resident window inventory covers all twenty room references plus four unassigned shared windows', () => {
  const plan = upper(studies);
  assert.equal(validate(studies), true);
  assert.equal(plan.windowCoverage, 'complete-floor');
  assert.equal(plan.windows.length, 24);
  for (const room of plan.spaces.filter(space => space.kind === 'room')) {
    assert.equal(plan.windows.filter(window => window.spaceId === room.id).length, 1, `${room.shortLabel} must retain one resident-confirmed window`);
  }
  assert.equal(plan.windows.filter(window => !window.spaceId).length, 4, 'shared windows must not invent room/stairwell ownership');
  for (const index of [0, 1]) {
    const floor = studies.buildings['55'].levels.find(level => level.index === index);
    assert.equal(floor.windows, undefined, 'top-floor observations must not silently become lower-floor evidence');
    assert.equal(floor.wallBands, undefined);
  }
  const changes = [
    data => { upper(data).windows[0].residentName = 'Unsupported'; },
    data => { upper(data).wallBands[0].phone = 'Unsupported'; },
    data => { upper(data).windows[0].sourceSurfaceIndex = 39; },
    data => { upper(data).windows[0].spaceId = upper(data).spaces.find(space => space.shortLabel === 'G').id; },
    data => { upper(data).windows[0].spaceId = studies.buildings['55'].levels[0].spaces[0].id; },
    data => { upper(data).windows[0].segment = [[900, 900], [901, 900]]; },
    data => { upper(data).wallBands[0].confidence = 'sketch'; },
    data => { upper(data).wallBands[0].polygon = upper(data).excludedAreas[0].polygon; },
  ];
  for (const change of changes) {
    const invalid = structuredClone(studies);
    change(invalid);
    assert.throws(() => validate(invalid), /not allowed|window|wall bands|estimated/);
  }
});

test('plan windows retain sills and do not become clickable doors or additional room labels', () => {
  const before = JSON.stringify(studies);
  const plan = getDisplayLevel(empty, studies, '55', 2);
  const result = createInteriorWireframe(plan, {house: '55', floor: 2});
  const symbols = result.group.children.find(child => child.userData.role === 'resident-window-symbols');
  assert.ok(symbols);
  assert.equal(symbols.userData.count, 24);
  assert.equal(new Set(symbols.userData.windowIds).size, 24);
  assert.equal(result.pickables.filter(mesh => mesh.userData.openingId).length, 21);
  assert.equal(result.labels.filter(label => label.kind === 'space').length, 23);
  assert.equal(result.labels.filter(label => label.kind === 'door').length, 21);
  assert.ok(result.group.children.some(child => child.userData.role === 'estimated-wall-band'));
  const wallSegments = result.group.children.filter(child => /interior-walls$/.test(child.userData.role || ''))
    .flatMap(child => {
      const p = child.geometry.attributes.position.array;
      return Array.from({length: p.length / 6}, (_, i) => [...p.slice(i * 6, i * 6 + 6)]);
    });
  for (const window of plan.windows) {
    const [a, b] = window.segment;
    const dx = b[0] - a[0], dz = b[1] - a[1], length2 = dx * dx + dz * dz;
    const acrossCenter = segment => {
      const points = [[segment[0], segment[2]], [segment[3], segment[5]]];
      if (!points.every(p => Math.abs(dx * (p[1] - a[1]) - dz * (p[0] - a[0])) / Math.sqrt(length2) < 0.00002)) return false;
      const ts = points.map(p => ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length2).sort((x, y) => x - y);
      return ts[0] < 0.49 && ts[1] > 0.51;
    };
    assert.ok(wallSegments.some(s => s[1] < 0.10 && s[4] < 0.10 && acrossCenter(s)), `${window.id} retains a wall below its sill`);
    assert.ok(!wallSegments.some(s => s[1] > 1 && s[4] > 1 && acrossCenter(s)), `${window.id} cuts the upper wall line`);
  }
  assert.equal(JSON.stringify(studies), before);
});

test('resident top-floor placements replace repeated exterior windows without changing lower rows or source surfaces', () => {
  const building = lod2.buildings.find(building => building.number === '55');
  const before = JSON.stringify(building), guide = getOldFacadeRowGuides(building, 3);
  const baseOptions = {house: '55', family: 'plates'};
  const previous = createBuildingWindowStudies(building.surfaces, guide.elevations, building.baseY + guide.guideHeight, baseOptions);
  const current = createBuildingWindowStudies(building.surfaces, guide.elevations, building.baseY + guide.guideHeight, {...baseOptions, locatedLevels: studies.buildings['55'].levels});
  const patches = map => [...map.values()].flatMap(study => study.patches);
  assert.deepEqual(patches(current).filter(patch => patch.floor < 2), patches(previous).filter(patch => patch.floor < 2));
  assert.deepEqual([...current.values()].flatMap(study => study.rejectedLocated || []), []);
  const top = patches(current).filter(patch => patch.floor === 2);
  assert.equal(top.length, 24, 'the old repeated pattern must not remain underneath marked top-floor windows');
  assert.deepEqual(top.map(patch => patch.windowId).sort(), upper(studies).windows.map(window => window.id).sort());
  assert.equal(JSON.stringify(building), before);

  const broken = structuredClone(upper(studies));
  broken.windows[0].segment = broken.windows[0].segment.map(point => point.map(value => value + 100));
  const rejected = createBuildingWindowStudies(building.surfaces, guide.elevations, building.baseY + guide.guideHeight, {...baseOptions, locatedLevels: [broken]});
  assert.deepEqual([...rejected.values()].flatMap(study => study.rejectedLocated || []), [broken.windows[0].id], 'a misplaced opening must fail whole-window coverage rather than being clipped or shrunk to fit');
});
