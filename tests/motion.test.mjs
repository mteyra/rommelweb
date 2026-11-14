import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three';
import { advanceFloorMotion, CampusScene, motionEase } from '../src/scene.js';

const building = () => ({
  data: {baseY: 2.3}, floorElevations: [0, 2.9, 6.4],
  floorGroups: [new Group(), new Group(), new Group()], exterior: {visible: false},
  currentGap: 0, targetGap: 5, gapTween: {start: 100, from: 0, to: 5},
});

test('camera easing is monotonic and comes to rest without a velocity jump', () => {
  const samples = Array.from({length: 101}, (_, i) => motionEase(i / 100));
  assert.equal(samples[0], 0);
  assert.equal(samples.at(-1), 1);
  assert.ok(samples.every((value, i) => i === 0 || value >= samples[i - 1]));
  assert.ok(samples[1] - samples[0] < 0.0001);
  assert.ok(samples.at(-1) - samples.at(-2) < 0.0001);
});

test('floor movement is independent of frame rate and retains approved uneven elevations', () => {
  const fast = building(), slow = building();
  for (let time = 100; time <= 425; time += 5) advanceFloorMotion(fast, time);
  advanceFloorMotion(slow, 425);
  assert.equal(fast.currentGap, slow.currentGap);
  assert.equal(fast.currentGap, 2.5);
  fast.floorGroups.forEach((group, i) => assert.ok(Math.abs(group.position.y - [2.3, 7.7, 13.7][i]) < 1e-10));
  advanceFloorMotion(fast, 750);
  advanceFloorMotion(slow, 1000);
  assert.equal(fast.currentGap, 5);
  assert.equal(slow.currentGap, 5);
  assert.deepEqual(fast.floorGroups.map(group => group.position.y), slow.floorGroups.map(group => group.position.y));
  assert.equal(fast.gapTween, null);
});

test('reversing a floor transition continues from its displayed position and restores the exact shell', () => {
  const record = building();
  advanceFloorMotion(record, 425);
  record.targetGap = 0;
  record.gapTween = {start: 425, from: record.currentGap, to: 0};
  advanceFloorMotion(record, 425);
  assert.equal(record.currentGap, 2.5);
  advanceFloorMotion(record, 1075);
  assert.equal(record.currentGap, 0);
  assert.equal(record.exterior.visible, true);
  assert.ok(record.floorGroups.every(group => !group.visible));
  record.floorGroups.forEach((group, i) => assert.ok(Math.abs(group.position.y - record.data.baseY - record.floorElevations[i]) < 1e-10));
});

test('reduced motion makes unfolding and collapsing immediate', () => {
  const record = building();
  const mock = {
    selected: 'test', reduced: true, buildings: new Map([['test', record]]),
    camera: {position: new Vector3(40, 40, 40)}, controls: {target: new Vector3()},
    fittedCamera: () => ({position: new Vector3(), target: new Vector3()}), animateCamera: () => {},
  };
  CampusScene.prototype.explode.call(mock, true);
  assert.equal(record.gapTween, null);
  assert.equal(record.currentGap, 5);
  assert.equal(record.exterior.visible, false);
  assert.ok(record.floorGroups.every(group => group.visible));
  CampusScene.prototype.explode.call(mock, false);
  assert.equal(record.currentGap, 0);
  assert.equal(record.exterior.visible, true);
  assert.ok(record.floorGroups.every(group => !group.visible));
});

test('camera gestures and cancelled pointers cannot select a house accidentally', () => {
  const previousDocument = globalThis.document;
  globalThis.document = new EventTarget();
  try {
    const canvas = new EventTarget();
    const selections = [];
    const mock = {
      renderer: {domElement: canvas}, container: new EventTarget(),
      pickAt: () => ({object: {userData: {house: '57a', floor: null}}}),
      onSelect: house => selections.push(house),
    };
    CampusScene.prototype.bind.call(mock);
    const dispatch = (type, properties = {}) => {
      const event = new Event(type);
      Object.assign(event, {pointerId: 1, isPrimary: true, button: 0, clientX: 20, clientY: 20, ...properties});
      canvas.dispatchEvent(event);
    };
    dispatch('pointerdown', {button: 2});
    dispatch('pointerup', {button: 2});
    dispatch('pointerdown');
    dispatch('pointerup', {clientX: 50});
    dispatch('pointerdown');
    dispatch('pointercancel');
    dispatch('pointerup');
    dispatch('pointerdown');
    dispatch('pointerdown', {pointerId: 2, isPrimary: false});
    dispatch('pointerup', {pointerId: 2, isPrimary: false});
    dispatch('pointerup');
    assert.deepEqual(selections, [], 'right-click, orbit drag, cancelled touch and pinch must not navigate');
    dispatch('pointerdown');
    dispatch('pointerup');
    assert.deepEqual(selections, ['57a']);
    mock.selected = '57a';
    mock.pickAt = () => undefined;
    dispatch('pointerdown');
    dispatch('pointerup', {clientX: 60});
    dispatch('pointerdown');
    dispatch('pointermove', {clientX: 60, buttons: 1});
    dispatch('pointermove', {clientX: 20, buttons: 1});
    dispatch('pointerup');
    dispatch('pointerdown', {button: 2});
    dispatch('pointerup', {button: 2});
    dispatch('pointerdown');
    dispatch('pointerdown', {pointerId: 2, isPrimary: false});
    dispatch('pointerup', {pointerId: 2, isPrimary: false});
    dispatch('pointerup');
    assert.deepEqual(selections, ['57a'], 'empty-space camera gestures must retain the selected house');
    dispatch('pointerdown');
    dispatch('pointerup');
    assert.deepEqual(selections, ['57a', null], 'a true primary click on empty space returns to campus');
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});
