import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createInteriorWireframe } from '../src/interior-wireframe.js';
import { getDisplayLevel, getLevelWindows, validateInteriorStudies } from '../src/interior-studies.js';
import { createBuildingWindowStudies, getOldFacadeRowGuides } from '../src/windows.js';

const read = name => readFile(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8').then(JSON.parse);
const [studies, campus, lod2] = await Promise.all(['interior-studies', 'campus', 'lod2'].map(read));
const upper = data => data.buildings['55'].levels.find(level => level.index === 2);
const validate = data => validateInteriorStudies(data, campus, lod2);
const empty = {schemaVersion: 1, buildings: {}};
const previousUpper = JSON.parse(await readFile(new URL('../data/source/house55-2og-before-module-layout.json', import.meta.url), 'utf8')).level;

test('source exterior windows are retained while independent layout windows follow the new room geometry', () => {
  const plan = upper(studies);
  assert.equal(validate(studies), true);
  assert.equal(plan.layoutBasis, 'resident-module-layout');
  assert.equal(plan.windowCoverage, 'complete-floor');
  assert.equal(plan.windows.length, 24);
  assert.deepEqual(plan.windows, previousUpper.windows, 'the module layout preserves the complete original exterior inventory');
  assert.equal(plan.layoutWindows.length, 24);
  assert.ok(plan.layoutWindows.every(window => window.confidence === 'estimated' && !Object.hasOwn(window, 'sourceSurfaceIndex')));
  for (const room of plan.spaces.filter(space => space.kind === 'room')) {
    assert.equal(plan.windows.filter(window => window.spaceId === room.id).length, 1, `${room.shortLabel} retains its historical source window reference`);
    assert.equal(plan.layoutWindows.filter(window => window.spaceId === room.id).length, 1, `${room.shortLabel} receives one schematic layout window`);
  }
  assert.equal(plan.windows.filter(window => !window.spaceId).length, 4, 'shared windows must not invent room/stairwell ownership');
  assert.equal(plan.layoutWindows.filter(window => !window.spaceId).length, 4);
  const originalWindowIds = new Set(plan.windows.map(window => window.id));
  const lowerLayoutWindowIds = [];
  for (const index of [0, 1]) {
    const floor = studies.buildings['55'].levels.find(level => level.index === index);
    assert.equal(floor.windows, undefined, 'top-floor observations must not silently become lower-floor evidence');
    assert.equal(floor.windowCoverage, undefined, 'independent layout windows cannot establish source façade coverage');
    assert.equal(floor.layoutBasis, 'resident-module-layout');
    assert.equal(floor.layoutWindows.length, 24);
    assert.ok(floor.layoutWindows.every(window => window.confidence === 'estimated' && !Object.hasOwn(window, 'sourceSurfaceIndex')));
    assert.deepEqual(getLevelWindows(floor), floor.layoutWindows, `floor ${index} displays its own schematic openings`);
    assert.ok(floor.wallBands.length > 0 && floor.wallBands.every(band => band.confidence === 'estimated'),
      `floor ${index} wall allocations remain independent estimates`);
    assert.ok(floor.layoutWindows.every(window => !originalWindowIds.has(window.id)),
      `floor ${index} symbols cannot reuse source-window identities`);
    lowerLayoutWindowIds.push(...floor.layoutWindows.map(window => window.id));
  }
  assert.equal(new Set(lowerLayoutWindowIds).size, lowerLayoutWindowIds.length,
    'ground- and first-floor symbols retain separate interaction identities');
  const changes = [
    data => { upper(data).windows[0].residentName = 'Unsupported'; },
    data => { upper(data).wallBands[0].phone = 'Unsupported'; },
    data => { upper(data).windows[0].sourceSurfaceIndex = 39; },
    data => { upper(data).layoutWindows[0].spaceId = upper(data).spaces.find(space => space.shortLabel === 'A').id; },
    data => { upper(data).windows[0].spaceId = studies.buildings['55'].levels[0].spaces[0].id; },
    data => { upper(data).windows[0].segment = [[900, 900], [901, 900]]; },
    data => { upper(data).wallBands[0].confidence = 'sketch'; },
    data => { upper(data).wallBands[0].polygon = [[900, 900], [901, 900], [901, 901], [900, 901], [900, 900]]; },
  ];
  for (const change of changes) {
    const invalid = structuredClone(studies);
    change(invalid);
    assert.throws(() => validate(invalid), /not allowed|window|wall bands|estimated/);
  }
});

test('independent layout windows retain sills without displaying or moving source façade windows', () => {
  const before = JSON.stringify(studies);
  const plan = getDisplayLevel(empty, studies, '55', 2);
  const result = createInteriorWireframe(plan, {house: '55', floor: 2});
  const symbols = result.group.children.find(child => child.userData.role === 'layout-window-symbols');
  assert.ok(symbols);
  assert.equal(symbols.userData.count, 24);
  assert.equal(new Set(symbols.userData.windowIds).size, 24);
  assert.deepEqual(symbols.userData.windowIds, plan.layoutWindows.map(window => window.id));
  assert.ok(!symbols.userData.windowIds.some(id => plan.windows.some(window => window.id === id)));
  assert.equal(result.pickables.filter(mesh => mesh.userData.openingId).length, 22);
  assert.equal(result.labels.filter(label => label.kind === 'space').length, plan.spaces.length);
  assert.equal(result.labels.filter(label => label.kind === 'door').length, 22);
  assert.ok(result.group.children.some(child => child.userData.role === 'estimated-wall-band'));
  const wallSegments = result.group.children.filter(child => /interior-walls$/.test(child.userData.role || ''))
    .flatMap(child => {
      const p = child.geometry.attributes.position.array;
      return Array.from({length: p.length / 6}, (_, i) => [...p.slice(i * 6, i * 6 + 6)]);
    });
  for (const window of getLevelWindows(plan)) {
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

test('the module layout preserves every folded exterior window and original source surface', () => {
  const building = lod2.buildings.find(building => building.number === '55');
  const before = JSON.stringify(building), guide = getOldFacadeRowGuides(building, 3);
  const baseOptions = {house: '55', family: 'plates'};
  const previous = createBuildingWindowStudies(building.surfaces, guide.elevations, building.baseY + guide.guideHeight, baseOptions);
  const current = createBuildingWindowStudies(building.surfaces, guide.elevations, building.baseY + guide.guideHeight, {...baseOptions, locatedLevels: studies.buildings['55'].levels});
  const beforeLayout = createBuildingWindowStudies(building.surfaces, guide.elevations, building.baseY + guide.guideHeight, {...baseOptions, locatedLevels: [previousUpper]});
  const patches = map => [...map.values()].flatMap(study => study.patches);
  assert.deepEqual(patches(current), patches(beforeLayout), 'independent room dimensions and layout windows cannot alter folded façade patches');
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
