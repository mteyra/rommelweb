import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Scene, PerspectiveCamera} from 'three';
import {CampusScene, SCENE_THEMES} from '../src/scene.js';
import {OLD_WINDOW_COLORS} from '../src/windows.js';

const read = name => readFile(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8').then(JSON.parse);
const [campus, lod2, interiors, studies] = await Promise.all(['campus', 'lod2', 'interiors', 'interior-studies'].map(read));
class Element extends EventTarget {
  constructor() {super(); this.dataset = {}; this.style = {setProperty() {}}; this.children = [];}
  setAttribute() {}
  appendChild(child) {this.children.push(child);}
}

test('photographic exteriors integrate with all eleven fixed buildings, colored frames and the existing floor controls', () => {
  const before = JSON.stringify({campus, lod2, interiors, studies});
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {configurable: true, value: {createElement: () => new Element()}});
  const view = Object.assign(Object.create(CampusScene.prototype), {
    lod2, interiors, studies, scene: new Scene(), buildings: new Map(),
    labelsElement: new Element(), labels: [], camera: new PerspectiveCamera(),
    selected: null, activeFloor: null,
  });
  try {
    for (const original of campus.buildings) {
      const source = lod2.buildings.find(building => building.number === original.number);
      view.makeBuilding({...original, baseY: source.baseY, height: source.height, footprint: source.groundPolygons[0]});
    }
    assert.equal(view.buildings.size, 11);
    const geometry = [];
    view.scene.traverse(object => {
      if (object.geometry) geometry.push([...object.geometry.attributes.position.array]);
      if (object.material?.userData.themeRole) assert.ok(Object.hasOwn(SCENE_THEMES.night, object.material.userData.themeRole));
    });
    for (const mix of [0, 1, 0.4, 0]) {
      view.applyTheme(mix);
      for (const [house, building] of view.buildings) {
        assert.equal(building.detailGroup.parent, building.exterior, 'all exterior details collapse with the shell when unfolding');
        for (const detail of building.detailGroup.children.filter(child => child.isMesh)) {
          assert.ok(detail.renderOrder > 0, 'far-side architectural glazing must depth-test after the source shell');
        }
        assert.equal(building.floorGroups.length, building.data.levels);
        assert.ok(building.floorGroups.every(floor => !floor.visible), 'exterior startup must not expose internal floor overlays');
        for (const mesh of building.exteriorPickables) assert.equal(mesh.userData.house, house);
        if ((mix === 0 || mix === 1) && OLD_WINDOW_COLORS[house]) {
          const frames = building.windowMaterials.filter(material => material.userData.themeRole === 'oldWindowFrame');
          assert.ok(frames.length);
          for (const frame of frames) assert.equal(frame.color.getHex(), OLD_WINDOW_COLORS[house][mix ? 'day' : 'night']);
        }
        for (const material of building.detailMaterials) assert.ok([material.color.r, material.color.g, material.color.b, material.opacity].every(Number.isFinite));
        if (building.weathering) {
          assert.equal(building.weathering.parent, building.exterior);
          const colors = building.weathering.geometry.getAttribute('color').array;
          const {nightColors, dayColors} = building.weathering.userData;
          for (let i = 0; i < colors.length; i += 103) {
            assert.ok(Math.abs(colors[i] - (nightColors[i] + (dayColors[i] - nightColors[i]) * mix)) < 1e-7);
          }
        }
      }
    }
    const afterGeometry = [];
    view.scene.traverse(object => {if (object.geometry) afterGeometry.push([...object.geometry.attributes.position.array]);});
    assert.deepEqual(afterGeometry, geometry, 'appearance changes cannot rescale or reposition model geometry');
    const red = view.buildings.get('55');
    assert.equal(red.windowGroup.userData.locatedWindowCount, 24);
    assert.deepEqual(red.windowGroup.userData.rejectedLocatedWindows, []);
    assert.equal(view.labels.filter(label => label.number === '55' && label.type === 'room' && label.floor === 2).length, 24);
    assert.equal(view.labels.filter(label => label.number === '55' && label.type === 'door' && label.floor === 2).length, 21);
    view.selected = '55';
    view.applyTheme(0);
    assert.ok(red.exteriorFills.filter(material => material.userData.role === 'RoofSurface').every(material => material.opacity === 1),
      'an actively inspected roof must not show the silhouette of a far-side ground opening');
    assert.equal(JSON.stringify({campus, lod2, interiors, studies}), before, 'source and interior records remain untouched');
  } finally {
    view.scene.traverse(object => {object.geometry?.dispose(); for (const material of [object.material].flat().filter(Boolean)) material.dispose();});
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
});
