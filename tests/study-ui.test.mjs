import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {getDisplayLevel, getLevelWindows, isIndependentLayout, isFittedModuleLayout, isModuleLayout} from '../src/interior-studies.js';
import {studyRoomMeasurements} from '../src/study-measurements.js';
import {escapeHTML as esc, floorName} from '../src/data.js';

// Exercise the actual UI functions with their data/measurement dependencies.
// Bootstrapping and browser-only imports are omitted; these checks concern the
// rendered wording and controls, not browser layout or the Three.js scene.
const source = (await readFile(new URL('../src/main.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '')
  .replace('import.meta.env.BASE_URL', "'/'")
  .replace(/^init\(\);$/m, '');
const rectangle = (x, z, width, depth) => [[x, z], [x + width, z], [x + width, z + depth], [x, z + depth], [x, z]];

const floor = (index, {independent = false, shared = false} = {}) => ({
  index, label: `${index}. OG`, source: 'Synthetic UI study',
  ...(independent ? {layoutBasis: 'resident-module-layout'} : {}),
  floorOutline: [{outer: rectangle(0, 0, 30, 20)}],
  spaces: [
    {id: `room-${index}`, kind: 'room', label: 'Room A', shortLabel: 'A', confidence: 'estimated',
      polygon: rectangle(0.2, 1.4, 2.7, 6)},
    ...(shared ? [{id: `shared-${index}`, kind: 'shared', label: 'Shared apartment 1', shortLabel: 'Shared 1',
      confidence: 'estimated', polygon: rectangle(10, 1.4, 6.2, 7.4)}] : []),
  ],
  doors: [], layoutWindows: [],
});
const levels = mixed => [floor(0), floor(1, {independent: mixed, shared: mixed}), floor(2, {independent: true})];
const allModuleLevels = () => [floor(0, {independent: true, shared: true}), ...levels(true).slice(1)];

function ui(levelRecords, selectedFloor, selectedHouse = '55') {
  const elements = new Map(), conceptCalls = [];
  const element = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      innerHTML: '', textContent: '', dataset: {}, children: [],
      classList: {toggle() {}, add() {}, contains() {return false;}},
      setAttribute() {}, addEventListener() {}, showModal() {}, close() {},
      prepend(child) {this.children.unshift(child);}, before() {},
    });
    return elements.get(selector);
  };
  const fixture = {levelRecords, selectedFloor, selectedHouse};
  const document = {
    body: element('body'), activeElement: element('active'),
    querySelector: element, querySelectorAll: () => [], createElement: () => element('created'),
  };
  const controls = runInNewContext(`${source}
    studies = {schemaVersion: 1, buildings: {[fixture.selectedHouse]: {levels: fixture.levelRecords}}};
    interiors = {schemaVersion: 1, buildings: {}};
    lod2 = {buildings: [], metadata: {url: 'https://example.test/source'}};
    Object.assign(state, {selected: fixture.selectedHouse, floor: fixture.selectedFloor, exploded: true});
    ({renderFloor, spaceDialog, accuracyDialog});
  `, {document, fixture, console, getDisplayLevel, getLevelWindows, isIndependentLayout, isFittedModuleLayout, isModuleLayout,
    studyRoomMeasurements, esc, floorName,
    apartmentConcept: (...args) => {conceptCalls.push(args); return null;}});
  return {...controls, element, conceptCalls};
}

test('shared apartment cards display whole-envelope dimensions and offer no single-room furniture concept', () => {
  const view = ui(levels(true), 1);
  view.renderFloor();
  assert.match(view.element('#floor-stage-note').textContent, /Single rooms & shared envelopes/);
  assert.match(view.element('#floor-detail-content').innerHTML, /whole gross envelopes/);
  assert.match(view.element('#floor-detail-content').innerHTML, /HOUSE55-FIRST-FLOOR-LAYOUT\.md/);
  view.spaceDialog({house: '55', floor: 1, spaceId: 'shared-1'});
  const card = view.element('#modal-body').innerHTML;
  assert.match(card, /Shared apartment envelope · before walls/);
  assert.match(card, /6\.20 × 7\.40 m span · 45\.88 m² gross polygon area/);
  assert.match(card, /internal rooms, services and wall positions remain unresolved/);
  assert.doesNotMatch(card, /Clear room dimensions|16\.20 m²|3\.10 m module =/);
  assert.equal(view.conceptCalls.length, 0);
  assert.equal(view.element('#modal-body .modal-actions').children.length, 0);
});

test('other-house fitted modules show exact room sizes within a provisional, unchanged-outline study', () => {
  const records = allModuleLevels().map(level => ({...level, layoutBasis: 'fitted-module-layout'}));
  const view = ui(records, 0, '51');
  view.renderFloor();
  assert.equal(view.element('#floor-stage-note').textContent, 'Provisional module placement · original outline');
  const detail = view.element('#floor-detail-content').innerHTML;
  assert.match(detail, /original outline retained/);
  assert.match(detail, /unused gray space remains unassigned/);
  assert.match(detail, /Exterior \/ m/);
  assert.match(detail, /OLD-HOUSES-MODULE-LAYOUT\.md/);
  assert.doesNotMatch(detail, /HOUSE55-MODULE-LAYOUT\.md|Layout \/ m|Independent floor layout/);
  view.spaceDialog({house: '51', floor: 0, spaceId: 'room-0'});
  const single = view.element('#modal-body').innerHTML;
  assert.match(single, /Provisional placement/);
  assert.match(single, /2\.70 × 6\.00 m · 16\.20 m² clear polygon area/);
  assert.match(single, /this house’s existing outline using the House 55 module/);
  view.spaceDialog({house: '51', floor: 0, spaceId: 'shared-0'});
  const shared = view.element('#modal-body').innerHTML;
  assert.match(shared, /6\.20 × 7\.40 m span · 45\.88 m² gross polygon area/);
  assert.match(shared, /proposed whole shared-apartment envelope/);
  assert.doesNotMatch(shared, /Clear room dimensions|Independent layout/);
  assert.equal(view.conceptCalls.length, 1, 'only the single room offers a furniture concept');
  view.accuracyDialog();
  assert.match(view.element('#modal-body').innerHTML, /Houses 51 use provisional modules fitted within their original outlines/);
  assert.doesNotMatch(view.element('#modal-body').innerHTML, /Other older houses retain their earlier template studies/);
});

test('publishing a mixed first floor does not change top-floor controls, evidence or single-room card output', () => {
  const before = ui(levels(false), 2), after = ui(levels(true), 2);
  for (const view of [before, after]) {
    view.renderFloor();
    view.spaceDialog({house: '55', floor: 2, spaceId: 'room-2'});
  }
  for (const selector of ['#floor-stage-title', '#floor-stage-note', '#floor-detail-content', '#modal-body']) {
    assert.equal(after.element(selector).innerHTML, before.element(selector).innerHTML, selector);
    assert.equal(after.element(selector).textContent, before.element(selector).textContent, selector);
  }
  assert.equal(after.element('#floor-stage-note').textContent, 'Room 2.70 × 6.00 m · Module 3.10 m · Hall 1.40 m');
  assert.match(after.element('#floor-detail-content').innerHTML, /HOUSE55-MODULE-LAYOUT\.md/);
  assert.match(after.element('#modal-body').innerHTML, /2\.70 × 6\.00 m · 16\.20 m² clear polygon area/);
  assert.equal(after.conceptCalls.length, 1);
});

test('mixed-floor circulation includes retained common areas while top-floor hallway wording stays unchanged', () => {
  const records = levels(true);
  for (const index of [1, 2]) {
    records[index].spaces.push({id: `hall-${index}`, kind: 'corridor', label: 'Hall', confidence: 'estimated',
      polygon: rectangle(0, 0, 9.3, index === 1 ? 4.3 : 1.4)});
    const view = ui(records, index);
    view.spaceDialog({house: '55', floor: index, spaceId: `hall-${index}`});
    const card = view.element('#modal-body').innerHTML;
    assert.ok(card.includes(index === 1
      ? 'Circulation joining the 1.40 m hall runs and retained common areas.'
      : 'A 1.40 m wide hallway in the independent room layout.'));
    assert.equal(view.conceptCalls.length, 0);
  }
});

test('source modal reports an independent first floor only when the displayed data provides one', () => {
  const before = ui(levels(false), 1), after = ui(levels(true), 1);
  before.accuracyDialog();
  after.accuracyDialog();
  const oldCopy = before.element('#modal-body').innerHTML, newCopy = after.element('#modal-body').innerHTML;
  assert.match(oldCopy, /Other floors and older houses retain their earlier template studies/);
  assert.doesNotMatch(oldCopy, /1\. OG also uses an independent layout/);
  assert.match(newCopy, /House 55’s 1\. OG also uses an independent layout/);
  assert.match(newCopy, /shared apartment envelopes whose internal divisions remain unresolved/);
  assert.match(newCopy, /House 55’s EG and other older houses retain their earlier template studies/);
  for (const copy of [oldCopy, newCopy]) {
    assert.match(copy, /top floor now shows an independent layout with 2\.70 × 6\.00 m clear rooms/);
    assert.match(copy, /The folded exterior retains its source model/);
  }
});

test('ground-floor shared apartments use their own evidence and keep the existing gross-envelope presentation', () => {
  const view = ui(allModuleLevels(), 0);
  view.renderFloor();
  assert.equal(view.element('#floor-stage-title').textContent, 'House 55 / EG');
  assert.match(view.element('#floor-stage-note').textContent, /Single rooms & shared envelopes/);
  const details = view.element('#floor-detail-content').innerHTML;
  assert.match(details, /HOUSE55-GROUND-FLOOR-LAYOUT\.md/);
  assert.doesNotMatch(details, /HOUSE55-FIRST-FLOOR-LAYOUT\.md|HOUSE55-MODULE-LAYOUT\.md/);
  view.spaceDialog({house: '55', floor: 0, spaceId: 'shared-0'});
  const card = view.element('#modal-body').innerHTML;
  assert.match(card, /6\.20 × 7\.40 m span · 45\.88 m² gross polygon area/);
  assert.doesNotMatch(card, /Clear room dimensions|16\.20 m²|3\.10 m module =/);
  assert.equal(view.conceptCalls.length, 0);
});

test('publishing the ground-floor module layout preserves both upper floors controls and apartment cards', () => {
  for (const index of [1, 2]) {
    const before = ui(levels(true), index), after = ui(allModuleLevels(), index);
    for (const view of [before, after]) {
      view.renderFloor();
      view.spaceDialog({house: '55', floor: index, spaceId: `${index === 1 ? 'shared' : 'room'}-${index}`});
    }
    for (const selector of ['#floor-stage-title', '#floor-stage-note', '#floor-detail-content', '#modal-body']) {
      assert.equal(after.element(selector).innerHTML, before.element(selector).innerHTML, `${index}: ${selector}`);
      assert.equal(after.element(selector).textContent, before.element(selector).textContent, `${index}: ${selector}`);
    }
  }
});

test('source modal no longer describes EG as a template when all three House55 floors have module layouts', () => {
  const view = ui(allModuleLevels(), 0);
  view.accuracyDialog();
  const copy = view.element('#modal-body').innerHTML;
  assert.match(copy, /House 55 uses independent layouts on all three levels/);
  assert.match(copy, /Other older houses retain their earlier template studies/);
  assert.doesNotMatch(copy, /House 55’s EG and other older houses retain their earlier template studies/);
});

test('enclosed balconies, cinema and laundry remain common-space cards with one doorway and no apartment controls', () => {
  for (const [index, names] of [[1, ['East balcony', 'West balcony']], [0, ['Cinema', 'Laundry']]]) {
    const records = allModuleLevels(), record = records[index];
    record.spaces.push({id: `hall-${index}`, kind: 'corridor', label: 'Hall',
      confidence: 'estimated', polygon: rectangle(0, 0, 9.3, 1.4)});
    for (const [i, name] of names.entries()) {
      record.spaces.push({id: `common-${i}`, kind: 'service', label: name, shortLabel: name,
        confidence: 'estimated', note: 'Enclosed common area with one hallway entrance.',
        polygon: rectangle(i * 12, 8, 9.3, index === 1 ? 2.9 : 7.4)});
      record.doors.push({id: `entry-${i}`, label: `${name} entry`,
        spaceId: `common-${i}`, toSpaceId: `hall-${index}`, confidence: 'estimated',
        note: 'Single entrance beside the stair end of the hall.', segment: [[1, 8], [1.9, 8]]});
    }
    const view = ui(records, index);
    view.renderFloor();
    for (const [i, name] of names.entries()) {
      assert.ok(view.element('#floor-detail-content').innerHTML.includes(name));
      view.spaceDialog({house: '55', floor: index, spaceId: `common-${i}`});
      const card = view.element('#modal-body').innerHTML;
      assert.ok(card.includes(`${name} · study`));
      assert.match(card, /A common area enclosed from the hallway, with its own marked doorway/);
      assert.doesNotMatch(card, /Shared apartment envelope|Clear room dimensions|gross polygon area|study-identity-note/);
      view.spaceDialog({house: '55', floor: index, spaceId: `common-${i}`, openingId: `entry-${i}`});
      assert.ok(view.element('#modal-body').innerHTML.includes(`${name} entry · study`));
      assert.match(view.element('#modal-body').innerHTML, /Single entrance beside the stair end/);
    }
    assert.equal(view.conceptCalls.length, 0);
    assert.equal(view.element('#modal-body .modal-actions').children.length, 0);
    view.spaceDialog({house: '55', floor: index, spaceId: `hall-${index}`});
    assert.match(view.element('#modal-body').innerHTML, /1\.40 m wide hallway connecting the apartments and enclosed common areas/);
    assert.doesNotMatch(view.element('#modal-body').innerHTML, /joining the 1\.40 m hall runs and retained common areas/);
  }
});

test('Green common spaces are separate from apartment cards and link to their own floor evidence', () => {
  const records = allModuleLevels(), record = records[0];
  for (const [index, name] of ['Hausmeister', 'Garden room', 'Storage'].entries()) {
    record.spaces.push({id: `green-common-${index}`, kind: 'service', label: name,
      confidence: 'estimated', polygon: rectangle(index * 10, 8, 9.3, 7.4)});
    record.doors.push({id: `green-door-${index}`, label: `${name} doorway`, spaceId: `green-common-${index}`,
      confidence: 'estimated', segment: [[index * 10 + 1, 8], [index * 10 + 1.9, 8]]});
  }
  const view = ui(records, 0, '59');
  view.renderFloor();
  const details = view.element('#floor-detail-content').innerHTML;
  assert.match(details, /HOUSE59-MODULE-LAYOUT\.md/);
  assert.doesNotMatch(details, /HOUSE57-MODULE-LAYOUT\.md|Provisional module placement|original outline retained/);
  for (const [index, name] of ['Hausmeister', 'Garden room', 'Storage'].entries()) {
    view.spaceDialog({house: '59', floor: 0, spaceId: `green-common-${index}`});
    const card = view.element('#modal-body').innerHTML;
    assert.ok(card.includes(`${name} · study`));
    assert.match(card, /Resident-confirmed arrangement/);
    assert.doesNotMatch(card, /Shared apartment envelope|Clear room dimensions|study-identity-note|White’s/);
    view.spaceDialog({house: '59', floor: 0, spaceId: `green-common-${index}`, openingId: `green-door-${index}`});
    assert.ok(view.element('#modal-body').innerHTML.includes(`${name} doorway · study`));
  }
  assert.equal(view.conceptCalls.length, 0);
  assert.equal(view.element('#modal-body .modal-actions').children.length, 0);
  view.accuracyDialog();
  assert.match(view.element('#modal-body').innerHTML, /Green follows Red on both upper floors, including both first-floor balconies/);
});

const yellowMixedLevels = () => {
  const records = allModuleLevels().map(level => ({...level, layoutBasis: 'fitted-module-layout'}));
  const top = records[2];
  top.layoutBasis = 'resident-module-layout';
  top.spaces = [
    {id: 'a-e', kind: 'room', label: 'Room E · A wing', shortLabel: 'E', confidence: 'estimated', polygon: rectangle(0.2, 1.4, 2.7, 6)},
    {id: 'east-e', kind: 'room', label: 'Room E · East wing', shortLabel: 'E', confidence: 'estimated', polygon: rectangle(3.3, 1.4, 2.7, 6)},
    {id: 'n-0', kind: 'room', label: 'Room N0', shortLabel: 'N0', confidence: 'estimated', polygon: rectangle(6.4, 1.4, 2.7, 6)},
  ];
  top.doors = top.spaces.map(space => ({id: `${space.id}-door`, label: `${space.label} doorway`,
    spaceId: space.id, confidence: 'estimated', segment: [[0.2, 1.4], [1.1, 1.4]]}));
  return records;
};

test('Yellow top floor identifies both E rooms and N0 with its own evidence and annotated doors', () => {
  const records = yellowMixedLevels(), view = ui(records, 2, '51');
  view.renderFloor();
  const details = view.element('#floor-detail-content').innerHTML;
  assert.match(details, /Resident-marked top-floor layout · Yellow House/);
  assert.match(details, /HOUSE51-TOP-FLOOR-LAYOUT\.md/);
  assert.match(details, /EG and 1\. OG retain their provisional layouts/);
  assert.doesNotMatch(details, /HOUSE55-MODULE-LAYOUT\.md|original outline retained|Resident-confirmed arrangement/);
  for (const space of records[2].spaces) {
    assert.ok(details.includes(space.label));
    view.spaceDialog({house: '51', floor: 2, spaceId: space.id});
    const card = view.element('#modal-body').innerHTML;
    assert.ok(card.includes(`${space.label} · study`));
    assert.match(card, /Resident-marked top-floor layout/);
    assert.match(card, /2\.70 × 6\.00 m · 16\.20 m² clear polygon area/);
    view.spaceDialog({house: '51', floor: 2, spaceId: space.id, openingId: `${space.id}-door`});
    assert.match(view.element('#modal-body').innerHTML, /resident’s lime-green mark/);
  }
});

test('Yellow top-floor completion preserves both lower floors’ existing controls and cards', () => {
  const previous = allModuleLevels().map(level => ({...level, layoutBasis: 'fitted-module-layout'}));
  for (const index of [0, 1]) {
    const before = ui(previous, index, '51'), after = ui(yellowMixedLevels(), index, '51');
    for (const view of [before, after]) {
      view.renderFloor();
      view.spaceDialog({house: '51', floor: index, spaceId: `room-${index}`});
    }
    for (const selector of ['#floor-stage-title', '#floor-stage-note', '#floor-detail-content', '#modal-body']) {
      assert.equal(after.element(selector).innerHTML, before.element(selector).innerHTML, `${index}: ${selector}`);
      assert.equal(after.element(selector).textContent, before.element(selector).textContent, `${index}: ${selector}`);
    }
  }
});

test('Yellow mixed-floor model evidence reports only the top floor as resident-marked', () => {
  const view = ui(yellowMixedLevels(), null, '51');
  view.renderFloor();
  assert.match(view.element('#floor-detail-content').innerHTML, /Yellow’s 2\. OG follows the resident’s room and doorway annotation/);
  assert.match(view.element('#floor-detail-content').innerHTML, /EG and 1\. OG retain their existing provisional layouts/);
  view.accuracyDialog();
  const copy = view.element('#modal-body').innerHTML;
  assert.match(copy, /Yellow House 51’s 2\. OG has a resident-marked layout/);
  assert.match(copy, /House 51’s EG and 1\. OG retain their provisional modules and original outlines/);
  assert.match(copy, /HOUSE51-TOP-FLOOR-LAYOUT\.md/);
  assert.doesNotMatch(copy, /Houses 51 use provisional modules|House 51 uses independent layouts on all three levels/);
});

const publishedYellowLevels = JSON.parse(await readFile(
  new URL('./fixtures/house51-before-ground-floor-layout.json', import.meta.url), 'utf8')).building.levels;

test('Yellow first-floor drawing key uses its own evidence and explains the F-to-L1 alignment', () => {
  const view = ui(publishedYellowLevels, 1, '51');
  view.renderFloor();
  assert.equal(view.element('#floor-stage-title').textContent, 'House 51 / 1. OG');
  assert.equal(view.element('#floor-stage-note').textContent, '23 singles · Shared A · 2 balconies');
  const details = view.element('#floor-detail-content').innerHTML;
  assert.match(details, /Resident-marked first-floor layout · Yellow House/);
  assert.match(details, /HOUSE51-FIRST-FLOOR-LAYOUT\.md/);
  assert.match(details, /one 3\.10 m module so F’s left edge aligns with L1/);
  assert.match(details, /Room F · A wing, resident-marked first-floor layout/);
  assert.match(details, /Room L1, resident-marked first-floor layout/);
  assert.match(details, /each item’s note distinguishes marked access from schematic placement/);
  assert.match(details, /EG retains its provisional layout/);
  assert.doesNotMatch(details, /HOUSE51-TOP-FLOOR-LAYOUT\.md|HOUSE55-FIRST-FLOOR-LAYOUT\.md|original outline retained/);
});

test('Yellow first-floor single rooms, shared A and both balconies keep their distinct card and measurement types', () => {
  const view = ui(publishedYellowLevels, 1, '51');
  for (const [id, label] of [
    ['module-51-1-room-A-F', 'Room F · A wing'],
    ['module-51-1-room-L-L1', 'Room L1'],
    ['module-51-1-room-W-W1', 'Room W1'],
  ]) {
    view.spaceDialog({house: '51', floor: 1, spaceId: id});
    const card = view.element('#modal-body').innerHTML;
    assert.ok(card.includes(`${label} · study`));
    assert.match(card, /Resident-marked first-floor layout/);
    assert.match(card, /2\.70 × 6\.00 m · 16\.20 m² clear polygon area/);
  }
  assert.equal(view.conceptCalls.length, 3);
  view.spaceDialog({house: '51', floor: 1, spaceId: 'module-51-1-shared-A'});
  const shared = view.element('#modal-body').innerHTML;
  assert.match(shared, /Shared apartment A · study/);
  assert.match(shared, /6\.20 × 7\.40 m span · 45\.88 m² gross polygon area/);
  assert.match(shared, /Net area, internal partitions and occupancy are not established/);
  assert.doesNotMatch(shared, /Clear room dimensions|16\.20 m²|3\.10 m module =/);
  for (const side of ['R', 'L']) {
    view.spaceDialog({house: '51', floor: 1, spaceId: `module-51-1-common-${side}`});
    const card = view.element('#modal-body').innerHTML;
    assert.match(card, /balcony · study/);
    assert.match(card, /A common area enclosed from the hallway in Yellow’s first-floor layout/);
    assert.doesNotMatch(card, /Shared apartment envelope|Clear room dimensions|gross polygon area|study-identity-note/);
  }
  assert.equal(view.conceptCalls.length, 3, 'shared A and balconies do not offer a single-room furniture concept');
});

test('Yellow doorway cards preserve the marked-end evidence and the W1 and West balcony exceptions', () => {
  const record = publishedYellowLevels.find(level => level.index === 1);
  const view = ui(publishedYellowLevels, 1, '51');
  for (const openingId of ['module-51-1-door-A-F', 'module-51-1-door-W-W1', 'module-51-1-common-door-L']) {
    const door = record.doors.find(item => item.id === openingId);
    view.spaceDialog({house: '51', floor: 1, spaceId: door.spaceId, openingId});
    const card = view.element('#modal-body').innerHTML;
    assert.match(card, /A doorway in Yellow’s resident-marked first-floor layout/);
    assert.match(card, /Exact offsets, widths and opening details remain schematic/);
    assert.ok(card.includes(esc(door.note)), 'the specific doorway evidence must reach its card unchanged');
    assert.doesNotMatch(card, /A doorway placed from the resident’s lime-green mark|Clear room dimensions/);
  }
  view.spaceDialog({house: '51', floor: 1, spaceId: 'module-51-1-room-W-W1', openingId: 'module-51-1-door-W-W1'});
  assert.match(view.element('#modal-body').innerHTML, /No distinct uncovered lime mark is visible for W1/);
  view.spaceDialog({house: '51', floor: 1, spaceId: 'module-51-1-common-L', openingId: 'module-51-1-common-door-L'});
  assert.match(view.element('#modal-body').innerHTML, /No distinct lime door mark is visible; the 0\.90 m stair-side doorway is schematic/);
});

test('Yellow mixed-floor overview and source modal report both upper floors and leave only EG provisional', () => {
  const view = ui(publishedYellowLevels, null, '51');
  view.renderFloor();
  const overview = view.element('#floor-detail-content').innerHTML;
  assert.match(overview, /Yellow’s 1\. OG has 23 single rooms, shared apartment A and two balconies/);
  assert.match(overview, /2\. OG retains its resident-marked layout of 21 single rooms/);
  assert.match(overview, /EG retains its existing provisional layout/);
  assert.doesNotMatch(overview, /EG and 1\. OG retain|Select the top floor to review/);
  view.accuracyDialog();
  const copy = view.element('#modal-body').innerHTML;
  assert.match(copy, /Yellow House 51’s 1\. OG has a resident-marked layout of 23 single rooms/);
  assert.match(copy, /Yellow House 51’s 2\. OG has a resident-marked layout of 21 single rooms/);
  assert.match(copy, /House 51’s EG retains its provisional modules and original outline/);
  assert.match(copy, /HOUSE51-FIRST-FLOOR-LAYOUT\.md/);
  assert.match(copy, /HOUSE51-TOP-FLOOR-LAYOUT\.md/);
  assert.doesNotMatch(copy, /House 51’s EG and 1\. OG retain|House 51 uses independent layouts on all three levels|House 55’s top floor now shows/);
});

test('publishing Yellow first floor preserves EG and top-floor controls and cards while updating historical status', () => {
  const beforeRecords = publishedYellowLevels.map(level => level.index === 1 ? yellowMixedLevels()[1] : level);
  const originalTopNotes = publishedYellowLevels.find(level => level.index === 2).notes;
  for (const index of [0, 2]) {
    const room = publishedYellowLevels.find(level => level.index === index).spaces.find(space => space.kind === 'room');
    const before = ui(beforeRecords, index, '51'), after = ui(publishedYellowLevels, index, '51');
    for (const view of [before, after]) {
      view.renderFloor();
      view.spaceDialog({house: '51', floor: index, spaceId: room.id});
    }
    for (const selector of ['#floor-stage-title', '#floor-stage-note', '#modal-body']) {
      assert.equal(after.element(selector).innerHTML, before.element(selector).innerHTML, `${index}: ${selector}`);
      assert.equal(after.element(selector).textContent, before.element(selector).textContent, `${index}: ${selector}`);
    }
    const beforeDetails = before.element('#floor-detail-content').innerHTML;
    const afterDetails = after.element('#floor-detail-content').innerHTML;
    if (index === 0) assert.equal(afterDetails, beforeDetails, 'EG retains its existing drawing key and provisional evidence');
    else {
      assert.match(beforeDetails, /EG and 1\. OG remain exactly as previously drawn and await separate instructions/);
      assert.match(afterDetails, /1\. OG has its own resident-marked layout/);
      assert.match(afterDetails, /that revision left the lower floors unchanged/);
      assert.match(afterDetails, /The current 1\. OG arrangement is documented separately/);
      assert.match(afterDetails, /EG retains its provisional layout/);
      assert.doesNotMatch(afterDetails, /EG and 1\. OG retain|EG and 1\. OG remain exactly as previously drawn and await/);
    }
  }
  assert.equal(publishedYellowLevels.find(level => level.index === 2).notes, originalTopNotes,
    'historical source notes remain untouched in the accepted top-floor data');
});

const completedYellowLevels = JSON.parse(await readFile(
  new URL('../public/data/interior-studies.json', import.meta.url), 'utf8')).buildings['51'].levels;

test('Yellow ground-floor drawing key describes its rooms, service enclosures and own source', () => {
  const view = ui(completedYellowLevels, 0, '51');
  view.renderFloor();
  assert.equal(view.element('#floor-stage-title').textContent, 'House 51 / EG');
  assert.equal(view.element('#floor-stage-note').textContent, '23 singles · Shared A · Sports & Laundry');
  const details = view.element('#floor-detail-content').innerHTML;
  assert.match(details, /Resident-marked ground-floor layout · Yellow House/);
  assert.match(details, /HOUSE51-GROUND-FLOOR-LAYOUT\.md/);
  assert.match(details, /Single B is inserted before shared A/);
  assert.match(details, /Sports enclosure replaces the A-wing F module/);
  assert.match(details, /Room B, resident-marked ground-floor layout/);
  assert.match(details, /Sports room, resident-marked ground-floor layout/);
  assert.match(details, /Laundry, resident-marked ground-floor layout/);
  assert.doesNotMatch(details, /provisional layout|original outline retained|HOUSE51-FIRST-FLOOR-LAYOUT\.md/);
});

test('Yellow ground-floor singles and shared A retain separate measurement and concept behavior', () => {
  const level = completedYellowLevels.find(record => record.index === 0);
  const view = ui(completedYellowLevels, 0, '51');
  const single = level.spaces.find(space => space.kind === 'room' && space.shortLabel === 'B');
  const shared = level.spaces.find(space => space.kind === 'shared');
  assert.ok(single, 'the inserted B single has its own card');
  view.spaceDialog({house: '51', floor: 0, spaceId: single.id});
  const singleCard = view.element('#modal-body').innerHTML;
  assert.match(singleCard, /Room B · study/);
  assert.match(singleCard, /Resident-marked ground-floor layout/);
  assert.match(singleCard, /2\.70 × 6\.00 m · 16\.20 m² clear polygon area/);
  assert.equal(view.conceptCalls.length, 1);
  view.spaceDialog({house: '51', floor: 0, spaceId: shared.id});
  const sharedCard = view.element('#modal-body').innerHTML;
  assert.match(sharedCard, /Shared apartment A · study/);
  assert.match(sharedCard, /6\.20 × 7\.40 m span · 45\.88 m² gross polygon area/);
  assert.match(sharedCard, /Internal divisions, net area and occupancy are not established/);
  assert.doesNotMatch(sharedCard, /Clear room dimensions|16\.20 m²/);
  assert.equal(view.conceptCalls.length, 1, 'shared A has no single-room furniture concept');
});

test('Yellow ground-floor Sports and Laundry cards explain their use without single-room measurements', () => {
  const level = completedYellowLevels.find(record => record.index === 0);
  const view = ui(completedYellowLevels, 0, '51');
  for (const [label, description] of [
    ['Sports room', /former A-wing F module with the adjacent common-area extension/],
    ['Laundry', /beside Yellow’s east hall and N0, with one hallway entrance/],
  ]) {
    const space = level.spaces.find(item => item.label === label);
    assert.ok(space, `${label} must be present in the ground-floor key`);
    view.spaceDialog({house: '51', floor: 0, spaceId: space.id});
    const card = view.element('#modal-body').innerHTML;
    assert.ok(card.includes(`${label} · study`));
    assert.match(card, /Resident-marked ground-floor layout/);
    assert.match(card, description);
    assert.doesNotMatch(card, /Clear room dimensions|Shared apartment envelope|gross polygon area|study-identity-note/);
    const doorway = level.doors.find(item => item.spaceId === space.id);
    assert.ok(doorway, `${label} must have its own hallway doorway`);
    view.spaceDialog({house: '51', floor: 0, spaceId: space.id, openingId: doorway.id});
    const doorCard = view.element('#modal-body').innerHTML;
    assert.match(doorCard, /A doorway in Yellow’s resident-marked ground-floor layout/);
    assert.match(doorCard, /Exact offsets, widths and opening details remain schematic/);
    assert.ok(doorCard.includes(esc(doorway.note)), 'the specific doorway evidence reaches its card');
  }
  assert.equal(view.conceptCalls.length, 0);
});

test('Yellow completed-stack and model copy include the ground floor without provisional Yellow claims', () => {
  const view = ui(completedYellowLevels, null, '51');
  view.renderFloor();
  const stack = view.element('#floor-detail-content').innerHTML;
  assert.match(stack, /Yellow has independent layouts on all three levels/);
  assert.match(stack, /EG contains 23 singles, shared A, Sports and Laundry/);
  assert.match(stack, /1\. OG retains 23 singles, shared A and two balconies/);
  assert.match(stack, /2\. OG retains 21 singles/);
  assert.doesNotMatch(stack, /provisional/);
  view.accuracyDialog();
  const model = view.element('#modal-body').innerHTML;
  assert.match(model, /House 51 uses independent layouts on all three levels/);
  assert.match(model, /Yellow House 51’s EG has a resident-marked layout/);
  assert.match(model, /Sports beside the west hall and Laundry beside the east hall/);
  for (const name of ['GROUND', 'FIRST', 'TOP']) assert.ok(model.includes(`HOUSE51-${name}-FLOOR-LAYOUT.md`));
  assert.doesNotMatch(model, /51’s EG retains its provisional|51’s EG and 1\. OG retain|Houses 51 use provisional/);
});

test('Yellow ground-floor completion preserves upper-floor controls, cards and raw source notes', () => {
  for (const index of [1, 2]) {
    const oldLevel = publishedYellowLevels.find(level => level.index === index);
    const newLevel = completedYellowLevels.find(level => level.index === index);
    assert.deepEqual(newLevel, oldLevel, `floor ${index} data is unchanged`);
    const before = ui(publishedYellowLevels, index, '51'), after = ui(completedYellowLevels, index, '51');
    for (const view of [before, after]) view.renderFloor();
    for (const selector of ['#floor-stage-title', '#floor-stage-note']) {
      assert.equal(after.element(selector).textContent, before.element(selector).textContent, selector);
    }
    for (const space of oldLevel.spaces) {
      for (const view of [before, after]) view.spaceDialog({house: '51', floor: index, spaceId: space.id});
      assert.equal(after.element('#modal-body').innerHTML, before.element('#modal-body').innerHTML, space.id);
    }
    const currentDetails = after.element('#floor-detail-content').innerHTML;
    assert.doesNotMatch(currentDetails, /EG retains its provisional layout|await separate instructions/);
    assert.match(currentDetails, index === 1
      ? /The current EG arrangement is documented separately/
      : /The current lower-floor arrangements are documented separately/);
  }
});
