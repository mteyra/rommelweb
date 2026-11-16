import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Scene, PerspectiveCamera, Raycaster, Vector2, Vector3} from 'three';
import {CampusScene} from '../src/scene.js';
import {surfaceFrame} from '../src/facade.js';
import {getLevelElevations} from '../src/interiors.js';
import {getDisplayLevel} from '../src/interior-studies.js';
import {createExteriorDetails} from '../src/exterior-details.js';
import {createBuildingWindowStudies, getOldFacadeRowGuides} from '../src/windows.js';

const read = name => readFile(new URL(`../public/data/${name}.json`, import.meta.url), 'utf8').then(JSON.parse);
const [campus, lod2, interiors, studies] = await Promise.all(['campus', 'lod2', 'interiors', 'interior-studies'].map(read));
class Element extends EventTarget {
  constructor() {super(); this.dataset = {}; this.style = {setProperty() {}}; this.children = [];}
  setAttribute() {}
  appendChild(child) {this.children.push(child);}
}

test('clicking recessed photo windows selects the near facade, including Yellow windows with no wall behind them', t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {configurable: true, value: {createElement: () => new Element()}});
  const view = Object.assign(Object.create(CampusScene.prototype), {
    lod2, interiors, studies, scene: new Scene(), buildings: new Map(),
    labelsElement: new Element(), labels: [], camera: new PerspectiveCamera(45, 1, 0.01, 200),
    selected: null, activeFloor: null, pointer: new Vector2(), raycaster: new Raycaster(),
    renderer: {domElement: {getBoundingClientRect: () => ({left: 0, top: 0, width: 100, height: 100})}},
  });
  try {
    const photoHouses = ['49', '51', '51a', '53', '57'];
    for (const house of [...photoHouses, '55']) {
      const original = campus.buildings.find(building => building.number === house);
      const source = lod2.buildings.find(building => building.number === house);
      view.makeBuilding({...original, baseY: source.baseY, height: source.height, footprint: source.groundPolygons[0]});
    }
    view.scene.updateMatrixWorld(true);
    let checked = 0, previouslyMissed = 0;
    const missedCenters = [
      new Vector3(-47.311303462589564, 6.966666663870274, -30.43753156348274),
      new Vector3(-36.4573165854248, 6.966666666666668, -18.31189555808504),
    ];
    for (const house of photoHouses) {
      const building = view.buildings.get(house), {data} = building;
      const source = lod2.buildings.find(item => item.number === house);
      const rows = building.materialFamily === 'plates' ? getOldFacadeRowGuides(source, data.levels, interiors) : {
        elevations: getLevelElevations(interiors, house, data.levels, data.height).map(elevation => elevation + data.baseY),
        guideHeight: data.height,
      };
      const details = createExteriorDetails(source, {house, levels: data.levels, absoluteFloorElevations: rows.elevations});
      const windows = createBuildingWindowStudies(source.surfaces, rows.elevations, data.baseY + rows.guideHeight, {
        house, family: building.materialFamily,
        locatedLevels: (studies.buildings[house]?.levels || []).filter(level =>
          level.windows?.length && !getDisplayLevel(interiors, null, house, level.index)),
        exclusionsBySurface: details.exclusionsBySurface, layoutsBySurface: details.layoutsBySurface,
      });
      let houseChecked = 0;
      for (const [surface, study] of windows) {
        const normal = new Vector3(...surfaceFrame(surface).normal);
        for (const patch of study.patches.filter(patch => patch.recessDepth)) {
          const center = patch.corners.reduce((sum, point) => sum.add(new Vector3(...point)), new Vector3()).multiplyScalar(0.25);
          view.camera.position.copy(center).addScaledVector(normal, 0.5);
          view.camera.lookAt(center);
          view.camera.updateMatrixWorld(true);
          const hit = view.pickAt(50, 50);
          const label = `house ${house}, surface ${source.surfaces.indexOf(surface)}, floor ${patch.floor}`;
          assert.ok(hit, `${label}: a click on visible glass must hit the house`);
          assert.equal(hit.object.userData.house, house, label);
          assert.equal(hit.object.userData.floor, null, label);
          assert.ok(hit.distance < 0.8, `${label}: click must stop at the near window, not a distant wall`);
          checked++; houseChecked++;
          // These first-floor openings looked through the old shell completely.
          if (house === '51' && missedCenters.some(point => point.distanceTo(center) < 0.0001)) {
            assert.equal(hit.object.userData.role, 'facade-window', label);
            previouslyMissed++;
          }
        }
      }
      assert.ok(houseChecked > 0, `${house}: exercise actual recessed openings`);
    }
    assert.ok(checked > 200, 'cover every generated photo-window opening across all five houses');
    assert.equal(previouslyMissed, 2, 'retain both reproduced Yellow-house selection regressions');
    assert.equal(view.buildings.get('55').exteriorPickables.some(mesh => mesh.userData.role === 'facade-window'), false,
      'the existing Red facade keeps its original picking targets');
    t.diagnostic(`${checked} recessed openings selected their house at the near facade.`);
  } finally {
    view.scene.traverse(object => {
      object.geometry?.dispose();
      for (const material of [object.material].flat().filter(Boolean)) material.dispose();
    });
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
});
