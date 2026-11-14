import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Fog, Mesh, MeshBasicMaterial, LineBasicMaterial, PlaneGeometry } from 'three';
import { CampusScene, SCENE_THEMES, scenePalette } from '../src/scene.js';

test('theme palettes cover the same materials and interpolate to exact daylight/night colors', () => {
  assert.deepEqual(Object.keys(SCENE_THEMES.day), Object.keys(SCENE_THEMES.night));
  for (const [name, mix] of [['night', 0], ['day', 1]]) {
    const palette = scenePalette(mix);
    for (const role of Object.keys(SCENE_THEMES[name])) assert.equal(palette[role].getHex(), SCENE_THEMES[name][role]);
  }
  assert.equal(scenePalette(0).background.getHex(), 0x151715);
  assert.equal(scenePalette(1).background.getHex(), 0xe8e5da);
  const middle = scenePalette(0.5).background;
  assert.ok(middle.r > scenePalette(0).background.r && middle.r < scenePalette(1).background.r);
});

test('theme changes recolor the full scene while preserving geometry and active floor contrast', () => {
  const scene = new Scene();
  scene.fog = new Fog(0, 400, 1000);
  const materials = Object.keys(SCENE_THEMES.night).map(role => {
    const material = new MeshBasicMaterial();
    material.userData.themeRole = role;
    scene.add(new Mesh(new PlaneGeometry(2, 2), material));
    return material;
  });
  const building = {
    data: {number: '57a'}, exteriorLines: [new LineBasicMaterial()], exteriorFills: [new MeshBasicMaterial()],
    windowMaterials: [new MeshBasicMaterial()], jointMaterial: new LineBasicMaterial(),
    lineMaterials: [new LineBasicMaterial(), new LineBasicMaterial()], fillMaterials: [new MeshBasicMaterial(), new MeshBasicMaterial()],
  };
  const mock = {scene, buildings: new Map([['57a', building]]), selected: '57a', activeFloor: 1, applyBuildingAppearance: CampusScene.prototype.applyBuildingAppearance};
  const before = scene.children.map(mesh => [...mesh.geometry.getAttribute('position').array]);
  CampusScene.prototype.applyTheme.call(mock, 1);
  assert.equal(scene.fog.color.getHex(), SCENE_THEMES.day.background);
  for (const material of materials) assert.equal(material.color.getHex(), SCENE_THEMES.day[material.userData.themeRole]);
  assert.equal(building.exteriorLines[0].color.getHex(), SCENE_THEMES.day.activeInk);
  assert.ok(building.fillMaterials[1].opacity > building.fillMaterials[0].opacity * 4);
  CampusScene.prototype.applyTheme.call(mock, 0);
  for (const material of materials) assert.equal(material.color.getHex(), SCENE_THEMES.night[material.userData.themeRole]);
  assert.deepEqual(scene.children.map(mesh => [...mesh.geometry.getAttribute('position').array]), before);
});

test('theme reversal starts from the visible blend and reduced motion changes immediately', () => {
  const mock = {themeMix: 0.4, reduced: false, applyTheme: mix => { mock.themeMix = mix; }};
  CampusScene.prototype.setTheme.call(mock, 'day');
  assert.equal(mock.themeTween.from, 0.4);
  assert.equal(mock.themeTween.to, 1);
  CampusScene.prototype.setTheme.call(mock, 'night');
  assert.equal(mock.themeTween.from, 0.4);
  assert.equal(mock.themeTween.to, 0);
  mock.reduced = true;
  CampusScene.prototype.setTheme.call(mock, 'day');
  assert.equal(mock.themeMix, 1);
  assert.equal(mock.themeTween, null);
  assert.throws(() => CampusScene.prototype.setTheme.call(mock, 'invalid'), /day or night/);
});
