import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFile, writeFile, mkdir, mkdtemp, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

// Compare independently executed baseline/current renderers, including both
// themes. Usage: node scripts/check-white-preservation.mjs <baseline-commit> [report.json]
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
assert.ok(process.argv[2], 'Supply the Git commit from before the White exterior change');
const git = args => execFileSync('git', args, {cwd: root, maxBuffer: 64 * 1024 * 1024});
const baselineCommit = git(['rev-parse', '--verify', '--end-of-options', `${process.argv[2]}^{commit}`]).toString().trim();
const destination = resolve(process.argv[3] || join(tmpdir(), 'rommel-white-preservation.json'));
const baseline = await mkdtemp(join(tmpdir(), 'rommel-white-compare-'));
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = value => sha(JSON.stringify(value));
const moduleAt = (directory, path) => import(pathToFileURL(join(directory, path)).href);
const report = {
  baselineCommit, scope: 'White / 57 exterior only',
  reviewedAt: new Date().toISOString(), success: false,
};
const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
let views = [];

try {
  const sourcePaths = git(['ls-tree', '-r', '--name-only', baselineCommit, '--', 'src', 'package.json'])
    .toString().trim().split('\n');
  for (const path of sourcePaths) {
    await mkdir(dirname(join(baseline, path)), {recursive: true});
    await writeFile(join(baseline, path), git(['show', `${baselineCommit}:${path}`]));
  }
  await symlink(join(root, 'node_modules'), join(baseline, 'node_modules'));
  const protectedPaths = git(['ls-tree', '-r', '--name-only', baselineCommit, '--',
    'public/data', 'data/source', 'scripts', 'src/interiors.js', 'src/interior-studies.js',
    'src/interior-wireframe.js', 'src/apartment-concepts.js', 'src/apartment-wireframe.js',
    'src/sections.js', 'src/study-measurements.js', 'src/windows.js', 'src/facade.js', 'src/data.js'])
    .toString().trim().split('\n');
  report.protectedFiles = await Promise.all(protectedPaths.map(async path => {
    const before = sha(git(['show', `${baselineCommit}:${path}`]));
    const after = sha(await readFile(join(root, path)));
    return {path, before, after, unchanged: before === after};
  }));
  report.protectedFilesUnchanged = report.protectedFiles.every(file => file.unchanged);
  assert.ok(report.protectedFilesUnchanged, 'All source data, interior renderers and existing layout generators must remain byte-identical');

  const [THREE, currentScene, originalScene, currentDetails, originalDetails,
    currentWindows, originalWindows, currentFacade, originalFacade, interiorFns, studyFns] = await Promise.all([
    moduleAt(root, 'node_modules/three/build/three.module.js'),
    moduleAt(root, 'src/scene.js'), moduleAt(baseline, 'src/scene.js'),
    moduleAt(root, 'src/exterior-details.js'), moduleAt(baseline, 'src/exterior-details.js'),
    moduleAt(root, 'src/windows.js'), moduleAt(baseline, 'src/windows.js'),
    moduleAt(root, 'src/facade.js'), moduleAt(baseline, 'src/facade.js'),
    moduleAt(root, 'src/interiors.js'), moduleAt(root, 'src/interior-studies.js'),
  ]);
  const [campus, lod2, interiors, studies] = await Promise.all(
    ['campus', 'lod2', 'interiors', 'interior-studies'].map(name =>
      readFile(join(root, `public/data/${name}.json`), 'utf8').then(JSON.parse)));
  const white = lod2.buildings.find(building => building.number === '57');
  report.preservedWhiteShell = {
    house: '57', baseY: white.baseY, height: white.height, levels: 3,
    sourceSurfaces: white.surfaces.length, sourceDigest: digest(white),
    groundPolygons: white.groundPolygons,
  };
  function exteriorPacket(building, detailsModule, windowsModule, facadeModule) {
    const source = lod2.buildings.find(item => item.number === building.number);
    const house = building.number, family = building.campus === 'II' ? 'timber' : 'plates';
    const elevations = interiorFns.getLevelElevations(interiors, house, building.levels, source.height);
    const rows = family === 'plates' ? windowsModule.getOldFacadeRowGuides(source, building.levels, interiors)
      : {elevations: elevations.map(y => source.baseY + y), guideHeight: source.height};
    const details = detailsModule.createExteriorDetails(source, {
      house, levels: building.levels, absoluteFloorElevations: rows.elevations,
    });
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
  report.otherHouseOutputs = campus.buildings.filter(building => building.number !== '57').map(building => {
    const before = exteriorPacket(building, originalDetails, originalWindows, originalFacade);
    const after = exteriorPacket(building, currentDetails, currentWindows, currentFacade);
    return {house: building.number, before, after,
      unchanged: Object.fromEntries(Object.keys(before).map(key => [key, before[key] === after[key]]))};
  });
  report.otherHouseOutputsUnchanged = report.otherHouseOutputs.every(item => Object.values(item.unchanged).every(Boolean));
  assert.ok(report.otherHouseOutputsUnchanged, 'All ten other houses must retain their complete exterior construction output');

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
      renderer: {setClearColor() {}, domElement: {
        getBoundingClientRect: () => ({left: 0, top: 0, width: 100, height: 100}),
      }},
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
  const material = value => value ? {json: clean(value.toJSON()), color: value.color?.toArray()} : null;
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
      const interiorBefore = digest(before.floorGroups.map(tree)), interiorAfter = digest(after.floorGroups.map(tree));
      const record = {house, theme: mix ? 'day' : 'night', interiorBefore, interiorAfter,
        interiorUnchanged: interiorBefore === interiorAfter};
      if (house !== '57') {
        record.exteriorBefore = digest(tree(before.exterior));
        record.exteriorAfter = digest(tree(after.exterior));
        record.exteriorUnchanged = record.exteriorBefore === record.exteriorAfter;
      }
      report.sceneMeshes.push(record);
    }
  }
  report.interiorSceneMeshesUnchanged = report.sceneMeshes.every(item => item.interiorUnchanged);
  report.otherExteriorSceneMeshesUnchanged = report.sceneMeshes.every(item => item.exteriorUnchanged !== false);
  assert.ok(report.interiorSceneMeshesUnchanged, 'All eleven interior scene trees must be identical in both themes');
  assert.ok(report.otherExteriorSceneMeshesUnchanged, 'All ten other exterior scene trees must be identical in both themes');
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
  await mkdir(dirname(destination), {recursive: true});
  await writeFile(destination, JSON.stringify(report, null, 2) + '\n');
  await rm(baseline, {recursive: true, force: true});
  console.log(JSON.stringify({
    success: report.success, baselineCommit, report: destination,
    protectedFiles: report.protectedFiles?.length, protectedFilesUnchanged: report.protectedFilesUnchanged,
    otherHouseOutputsUnchanged: report.otherHouseOutputsUnchanged,
    interiorSceneMeshesUnchanged: report.interiorSceneMeshesUnchanged,
    otherExteriorSceneMeshesUnchanged: report.otherExteriorSceneMeshesUnchanged,
    ...(report.error ? {error: report.error} : {}),
  }, null, 2));
}
