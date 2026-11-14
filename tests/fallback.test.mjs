import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackMap } from '../src/scene.js';

test('fallback houses remain keyboard-selectable when WebGL and the directory are unavailable', () => {
  class Element extends EventTarget {
    constructor(tagName) {
      super();
      this.tagName = tagName;
      this.attributes = new Map();
      this.children = [];
      this.classList = {add() {}};
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name); }
    appendChild(child) { this.children.push(child); }
    replaceChildren(...children) { this.children = children; }
  }
  const previousDocument = globalThis.document;
  globalThis.document = {createElementNS: (_namespace, name) => new Element(name)};
  try {
    const container = new Element('div'), selections = [];
    fallbackMap(container, {buildings: [{
      number: '51a', name: 'Blue House', address: 'Erwin-Rommel-Straße 51a',
      footprint: [[0, 0], [20, 0], [20, 20], [0, 20], [0, 0]],
      centroid: [10, 10], color: '#658da7',
    }]}, number => selections.push(number));
    const svg = container.children[0];
    const polygon = svg.children.find(element => element.tagName === 'polygon');
    const label = svg.children.find(element => element.tagName === 'text');
    assert.equal(svg.getAttribute('role'), 'group');
    assert.doesNotMatch(svg.getAttribute('aria-label'), /directory/i);
    assert.equal(polygon.getAttribute('role'), 'button');
    assert.equal(polygon.getAttribute('tabindex'), '0');
    assert.match(polygon.getAttribute('aria-label'), /Explore House 51a.*Blue House/);
    assert.equal(label.getAttribute('pointer-events'), 'none');
    for (const key of ['Enter', ' ']) {
      const event = new Event('keydown', {cancelable: true});
      Object.assign(event, {key});
      polygon.dispatchEvent(event);
      assert.equal(event.defaultPrevented, true, 'Space must not scroll instead of activating the house');
    }
    assert.deepEqual(selections, ['51a', '51a']);
    const reset = new Event('click');
    Object.assign(reset, {button: 0});
    svg.dispatchEvent(reset);
    const secondary = new Event('click');
    Object.assign(secondary, {button: 2});
    svg.dispatchEvent(secondary);
    assert.deepEqual(selections, ['51a', '51a', null], 'only a primary background click resets selection');
  } finally {
    globalThis.document = previousDocument;
  }
});
