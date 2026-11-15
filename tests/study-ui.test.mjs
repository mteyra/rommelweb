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
  assert.match(copy, /House 55’s EG and 1\. OG also use an independent layout/);
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
