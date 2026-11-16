import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

// Compare against an explicit working-tree snapshot, including changes that
// were already pending when Blue's exterior pass began. The snapshot contains
// src/, package.json, a node_modules link and baseline.json (protected SHA-256s).
// Usage: node scripts/check-blue-preservation.mjs /tmp/rommel-blue-baseline-... [report.json]
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv[2]) throw new Error('Pass the captured Blue working-tree baseline directory as the first argument');
const baseline = resolve(process.argv[2]);
const snapshot = JSON.parse(await readFile(join(baseline, 'baseline.json'), 'utf8'));
const destination = resolve(process.argv[3] || join(tmpdir(), 'rommel-blue-preservation.json'));
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = value => sha(JSON.stringify(value));
const load = (directory, path) => import(pathToFileURL(join(directory, path)).href);
const report = {baseline, baselineHead: snapshot.head, capturedAt: snapshot.capturedAt, baselineProvenance: snapshot.provenance || null,
  scope: 'Blue 51a exterior only; every source shell and interior unchanged', reviewedAt: new Date().toISOString(), success: false};
let views = [];
const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

try {
  // This new audit script remains an editable task artifact; it is not an
  // interior generator or a source record protected by the exterior scope.
  report.protectedFiles = await Promise.all(snapshot.protectedFiles.filter(({path}) =>
    path !== 'scripts/check-blue-preservation.mjs').map(async ({path, sha256: before}) => {
    const after = sha(await readFile(join(root, path)));
    return {path, before, after, unchanged: before === after};
  }));
  report.changedProtectedFiles = report.protectedFiles.filter(file => !file.unchanged).map(file => file.path);
  report.protectedFilesUnchanged = report.changedProtectedFiles.length === 0;
  // Separate independently edited verification artifacts from functional
  // layout generators/data. Their original and current hashes remain above.
  const concurrentAuditPaths = ['scripts/check-pink-preservation.mjs', 'scripts/check-turquoise-preservation.mjs'];
  report.concurrentAuditArtifactChanges = report.protectedFiles.filter(file =>
    !file.unchanged && concurrentAuditPaths.includes(file.path));
  report.sourceAndInteriorFilesUnchanged = report.protectedFiles.filter(file =>
    !concurrentAuditPaths.includes(file.path)).every(file => file.unchanged);

  const [THREE, currentScene, originalScene, currentDetails, originalDetails, currentWindows, originalWindows,
    currentFacade, originalFacade, interiorFns, studyFns] = await Promise.all([
    load(root, 'node_modules/three/build/three.module.js'),
    load(root, 'src/scene.js'), load(baseline, 'src/scene.js'),
    load(root, 'src/exterior-details.js'), load(baseline, 'src/exterior-details.js'),
    load(root, 'src/windows.js'), load(baseline, 'src/windows.js'),
    load(root, 'src/facade.js'), load(baseline, 'src/facade.js'),
    load(root, 'src/interiors.js'), load(root, 'src/interior-studies.js'),
  ]);
  const [campus, lod2, interiors, studies] = await Promise.all(
    ['campus', 'lod2', 'interiors', 'interior-studies'].map(name => readFile(join(root, `public/data/${name}.json`), 'utf8').then(JSON.parse)));
  const blue = lod2.buildings.find(building => building.number === '51a');
  report.preservedBlueShell = {
    house: '51a', baseY: blue.baseY, height: blue.height,
    levels: campus.buildings.find(building => building.number === '51a').levels,
    sourceSurfaces: blue.surfaces.length, groundPolygons: blue.groundPolygons,
    sourceDigest: digest(blue),
  };
  const unchangedHouses = campus.buildings.filter(building => building.number !== '51a');
  function exteriorPacket(building, detailsModule, windowsModule, facadeModule) {
    const source = lod2.buildings.find(item => item.number === building.number);
    const house = building.number, family = building.campus === 'II' ? 'timber' : 'plates';
    const elevations = interiorFns.getLevelElevations(interiors, house, building.levels, source.height);
    const rows = family === 'plates' ? windowsModule.getOldFacadeRowGuides(source, building.levels, interiors)
      : {elevations: elevations.map(y => source.baseY + y), guideHeight: source.height};
    const details = detailsModule.createExteriorDetails(source, {house, levels: building.levels, absoluteFloorElevations: rows.elevations});
    const locatedLevels = (studies.buildings[house]?.levels || []).filter(level =>
      level.windows?.length && !studyFns.getDisplayLevel(interiors, null, house, level.index));
    const windows = windowsModule.createBuildingWindowStudies(source.surfaces, rows.elevations, source.baseY + rows.guideHeight, {
      house, family, locatedLevels, exclusionsBySurface: details.exclusionsBySurface, layoutsBySurface: details.layoutsBySurface,
    });
    const weathering = source.surfaces.map((surface, index) => family === 'timber'
      ? facadeModule.createTimberBoardStudy(surface, {
        exclusions: [...(details.exclusionsBySurface.get(surface) || []),
          ...(windows.get(surface)?.patches || []).map(patch => [...patch.corners, patch.corners[0]])],
        elevationOrigin: source.baseY, elevations: details.claddingElevations ?? [...rows.elevations, source.baseY + source.height],
        refinedWeathering: Boolean(details.photoSurfaceIndices?.includes(index)),
      }) : null);
    const stable = value => JSON.stringify(value, (_, item) => item instanceof Map
      ? [...item].map(([surface, data]) => [source.surfaces.indexOf(surface), data]) : item);
    return {details: sha(stable(details)), windows: sha(stable(windows)), weathering: digest(weathering)};
  }
  report.otherHouseOutputs = unchangedHouses.map(building => {
    const before = exteriorPacket(building, originalDetails, originalWindows, originalFacade);
    const after = exteriorPacket(building, currentDetails, currentWindows, currentFacade);
    const unchanged = Object.fromEntries(Object.keys(before).map(key => [key, before[key] === after[key]]));
    return {house: building.number, before, after, unchanged};
  });
  await writeFile(join(baseline, 'exterior-output-hashes.json'), JSON.stringify(report.otherHouseOutputs.map(({house, before}) => ({house, ...before})), null, 2) + '\n');
  report.otherHouseOutputsUnchanged = report.otherHouseOutputs.every(item => Object.values(item.unchanged).every(Boolean));

  class Element extends EventTarget {
    constructor() {super(); this.dataset = {}; this.style = {setProperty() {}}; this.children = [];}
    setAttribute() {}
    appendChild(child) {this.children.push(child);}
  }
  Object.defineProperty(globalThis, 'document', {configurable: true, value: {createElement: () => new Element()}});
  const makeView = module => {
    const view = Object.assign(Object.create(module.CampusScene.prototype), {
      lod2, interiors, studies, scene: new THREE.Scene(), buildings: new Map(),
      labelsElement: new Element(), labels: [], camera: new THREE.PerspectiveCamera(45, 1, 0.01, 200),
      selected: null, activeFloor: null, pointer: new THREE.Vector2(), raycaster: new THREE.Raycaster(),
      renderer: {setClearColor() {}, domElement: {getBoundingClientRect: () => ({left: 0, top: 0, width: 100, height: 100})}},
    });
    for (const data of campus.buildings) {
      const source = lod2.buildings.find(building => building.number === data.number);
      view.makeBuilding({...data, baseY: source.baseY, height: source.height, footprint: source.groundPolygons[0]});
    }
    view.scene.updateMatrixWorld(true);
    return view;
  };
  views = [makeView(originalScene), makeView(currentScene)];
  const clean = value => JSON.parse(JSON.stringify(value, (key, item) => ['uuid', 'metadata'].includes(key) ? undefined : item));
  const material = value => value ? {json: clean(value.toJSON()), color: value.color?.toArray(), emissive: value.emissive?.toArray()} : null;
  const attribute = value => value ? {
    itemSize: value.itemSize, normalized: value.normalized, count: value.count,
    array: Array.from(value.array || value.data?.array || []), offset: value.offset, stride: value.data?.stride,
  } : null;
  const tree = object => ({
    type: object.type, role: object.userData.role, house: object.userData.house, floor: object.userData.floor,
    visible: object.visible, renderOrder: object.renderOrder, position: object.position.toArray(),
    quaternion: object.quaternion.toArray(), scale: object.scale.toArray(), matrixAutoUpdate: object.matrixAutoUpdate,
    frustumCulled: object.frustumCulled, layers: object.layers.mask,
    geometry: object.geometry ? {
      type: object.geometry.type, index: attribute(object.geometry.index),
      attributes: Object.fromEntries(Object.entries(object.geometry.attributes).map(([key, value]) => [key, attribute(value)])),
      groups: object.geometry.groups, drawRange: object.geometry.drawRange,
    } : null,
    material: Array.isArray(object.material) ? object.material.map(material) : material(object.material),
    children: object.children.map(tree),
  });
  report.sceneMeshes = [];
  for (const mix of [0, 1]) {
    views.forEach(view => view.applyTheme(mix));
    for (const {number: house} of campus.buildings) {
      const [before, after] = views.map(view => view.buildings.get(house));
      const floorsBefore = digest(before.floorGroups.map(tree)), floorsAfter = digest(after.floorGroups.map(tree));
      const record = {house, theme: mix ? 'day' : 'night', interiorBefore: floorsBefore, interiorAfter: floorsAfter, interiorUnchanged: floorsBefore === floorsAfter};
      if (house !== '51a') {
        record.exteriorBefore = digest(tree(before.exterior));
        record.exteriorAfter = digest(tree(after.exterior));
        record.exteriorUnchanged = record.exteriorBefore === record.exteriorAfter;
      }
      report.sceneMeshes.push(record);
    }
  }
  report.interiorSceneMeshesUnchanged = report.sceneMeshes.every(item => item.interiorUnchanged);
  report.otherExteriorSceneMeshesUnchanged = report.sceneMeshes.every(item => item.exteriorUnchanged !== false);
  assert.ok(report.protectedFilesUnchanged || (
    snapshot.provenance?.kind === 'isolated-Blue-change-counterpart' && report.sourceAndInteriorFilesUnchanged),
  'The exterior pass must leave all captured source and interior data/generators unchanged');
  assert.ok(report.interiorSceneMeshesUnchanged, 'All eleven dorm interiors must have identical scene meshes in both themes');
  assert.ok(report.otherHouseOutputsUnchanged, 'Every other dorm must retain its complete detail, window and timber output');
  assert.ok(report.otherExteriorSceneMeshesUnchanged, 'All ten other dorms must have identical exterior scene meshes in both themes');
  report.success = true;
} catch (error) {
  report.error = error.stack || String(error);
  process.exitCode = 1;
} finally {
  for (const view of views) view.scene.traverse(object => {
    object.geometry?.dispose();
    for (const material of [object.material].flat().filter(Boolean)) material.dispose();
  });
  if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
  else delete globalThis.document;
  await writeFile(destination, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    success: report.success, baseline, report: destination,
    protectedFiles: report.protectedFiles?.length, changedProtectedFiles: report.changedProtectedFiles,
    sourceAndInteriorFilesUnchanged: report.sourceAndInteriorFilesUnchanged,
    concurrentAuditArtifactChanges: report.concurrentAuditArtifactChanges?.map(item => item.path),
    otherHouseOutputs: report.otherHouseOutputs?.map(({house, unchanged}) => ({house, ...unchanged})),
    sceneChecks: report.sceneMeshes?.map(({house, theme, interiorUnchanged, exteriorUnchanged}) =>
      ({house, theme, interiorUnchanged, ...(exteriorUnchanged === undefined ? {} : {exteriorUnchanged})})),
    ...(report.error ? {error: report.error} : {}),
  }, null, 2));
}
