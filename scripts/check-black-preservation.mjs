import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

// Reconstruct the actual Git baseline, independently of the working tree.
// Usage: node scripts/check-black-preservation.mjs [baseline-ref] [report.json]
// The default is the release immediately before the six-photo Black pass.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reference = process.argv[2] || 'cda73a8';
const destination = resolve(process.argv[3] || join(root, 'docs/evidence/black-photo-preservation.json'));
const git = (...args) => execFileSync('git', args, {cwd: root, maxBuffer: 32 * 1024 * 1024});
const head = git('rev-parse', '--verify', `${reference}^{commit}`).toString().trim();
const baseline = await mkdtemp(join(tmpdir(), 'rommel-black-baseline-'));
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = value => sha(JSON.stringify(value));
const load = (directory, path) => import(pathToFileURL(join(directory, path)).href);
const pathsAt = (...paths) => git('ls-tree', '-r', '--name-only', head, '--', ...paths).toString().trim().split('\n').filter(Boolean);
const baselineFile = path => git('show', `${head}:${path}`);
const report = {
  baselineHead: head,
  baselineProvenance: 'Files reconstructed from the committed release; no working-tree files substituted.',
  scope: 'Black 49 exterior only; every source shell, floorplan and other dorm exterior unchanged',
  reviewedAt: new Date().toISOString(),
  success: false,
};
let views = [];
const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

try {
  // Baseline modules resolve one shared dependency installation but have
  // independent module URLs and retain their complete pre-edit source.
  await Promise.all(pathsAt('src', 'package.json').map(async path => {
    await mkdir(dirname(join(baseline, path)), {recursive: true});
    await writeFile(join(baseline, path), baselineFile(path));
  }));
  await symlink(join(root, 'node_modules'), join(baseline, 'node_modules'), 'dir');

  const protectedPaths = pathsAt('public/data', 'data/source', 'scripts', 'src').filter(path =>
    !path.startsWith('src/') || /\/(?:interior|apartment|sections|study-measurements|room-references)/.test(path));
  report.protectedFiles = await Promise.all(protectedPaths.map(async path => {
    const before = sha(baselineFile(path));
    let after = null;
    try {after = sha(await readFile(join(root, path)));} catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    return {path, before, after, unchanged: before === after};
  }));
  report.changedProtectedFiles = report.protectedFiles.filter(file => !file.unchanged).map(file => file.path);
  report.protectedFilesUnchanged = report.changedProtectedFiles.length === 0;
  // Bind this receipt to the exact implementation inspected, so a later
  // change to the Black mesh cannot be mistaken for the audited revision.
  report.auditedImplementation = await Promise.all([
    'src/black-house-photo-details.js', 'src/exterior-details.js', 'src/scene.js',
    'src/windows.js', 'src/facade.js', 'scripts/check-black-preservation.mjs',
  ].map(async path => ({path, sha256: sha(await readFile(join(root, path)))})));

  const [THREE, currentScene, originalScene, currentDetails, originalDetails, currentWindows, originalWindows,
    currentFacade, originalFacade, interiorFns, studyFns] = await Promise.all([
    load(root, 'node_modules/three/build/three.module.js'),
    load(root, 'src/scene.js'), load(baseline, 'src/scene.js'),
    load(root, 'src/exterior-details.js'), load(baseline, 'src/exterior-details.js'),
    load(root, 'src/windows.js'), load(baseline, 'src/windows.js'),
    load(root, 'src/facade.js'), load(baseline, 'src/facade.js'),
    load(root, 'src/interiors.js'), load(root, 'src/interior-studies.js'),
  ]);
  const names = ['campus', 'lod2', 'interiors', 'interior-studies'];
  const currentData = Object.fromEntries(await Promise.all(names.map(async name =>
    [name, JSON.parse(await readFile(join(root, `public/data/${name}.json`), 'utf8'))])));
  const originalData = Object.fromEntries(names.map(name =>
    [name, JSON.parse(baselineFile(`public/data/${name}.json`).toString())]));
  const {campus, lod2, interiors, 'interior-studies': studies} = currentData;
  report.sourceShells = originalData.lod2.buildings.map(before => {
    const after = lod2.buildings.find(building => building.number === before.number);
    const beforeCampus = originalData.campus.buildings.find(building => building.number === before.number);
    const afterCampus = campus.buildings.find(building => building.number === before.number);
    const shell = (source, metadata) => ({
      baseY: source.baseY, height: source.height, levels: metadata.levels,
      centroid: metadata.centroid, groundPolygons: source.groundPolygons,
      surfaces: source.surfaces,
    });
    const beforeDigest = digest(shell(before, beforeCampus));
    const afterDigest = digest(shell(after, afterCampus));
    return {
      house: before.number, baseY: after.baseY, height: after.height, levels: afterCampus.levels,
      sourceSurfaces: after.surfaces.length, before: beforeDigest, after: afterDigest,
      unchanged: beforeDigest === afterDigest,
    };
  });
  report.sourceShellsUnchanged = report.sourceShells.every(shell => shell.unchanged) &&
    originalData.lod2.buildings.length === lod2.buildings.length;
  const unchangedHouses = campus.buildings.filter(building => building.number !== '49');

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
  report.otherHouseOutputsUnchanged = report.otherHouseOutputs.every(item => Object.values(item.unchanged).every(Boolean));

  // Canvas sign rasterization is omitted in this headless scene. Its complete
  // sign geometry/text metadata is included in the exteriorPacket comparison.
  class Element extends EventTarget {
    constructor() {super(); this.dataset = {}; this.style = {setProperty() {}}; this.children = [];}
    setAttribute() {}
    appendChild(child) {this.children.push(child);}
  }
  Object.defineProperty(globalThis, 'document', {configurable: true, value: {createElement: () => new Element()}});
  const makeView = (module, data) => {
    const view = Object.assign(Object.create(module.CampusScene.prototype), {
      lod2: data.lod2, interiors: data.interiors, studies: data['interior-studies'],
      scene: new THREE.Scene(), buildings: new Map(),
      labelsElement: new Element(), labels: [], camera: new THREE.PerspectiveCamera(45, 1, 0.01, 200),
      selected: null, activeFloor: null, pointer: new THREE.Vector2(), raycaster: new THREE.Raycaster(),
      renderer: {setClearColor() {}, domElement: {getBoundingClientRect: () => ({left: 0, top: 0, width: 100, height: 100})}},
    });
    for (const metadata of data.campus.buildings) {
      const source = data.lod2.buildings.find(building => building.number === metadata.number);
      view.makeBuilding({...metadata, baseY: source.baseY, height: source.height, footprint: source.groundPolygons[0]});
    }
    view.scene.updateMatrixWorld(true);
    return view;
  };
  views = [makeView(originalScene, originalData), makeView(currentScene, currentData)];
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
      record.floorGeometryBefore = digest({elevations: before.floorElevations, sections: before.floorSections, dimensions: before.floorDimensions});
      record.floorGeometryAfter = digest({elevations: after.floorElevations, sections: after.floorSections, dimensions: after.floorDimensions});
      record.floorGeometryUnchanged = record.floorGeometryBefore === record.floorGeometryAfter;
      if (house !== '49') {
        record.exteriorBefore = digest(tree(before.exterior));
        record.exteriorAfter = digest(tree(after.exterior));
        record.exteriorUnchanged = record.exteriorBefore === record.exteriorAfter;
      }
      report.sceneMeshes.push(record);
    }
  }
  report.interiorSceneMeshesUnchanged = report.sceneMeshes.every(item => item.interiorUnchanged);
  report.floorGeometryUnchanged = report.sceneMeshes.every(item => item.floorGeometryUnchanged);
  report.otherExteriorSceneMeshesUnchanged = report.sceneMeshes.every(item => item.exteriorUnchanged !== false);
  assert.ok(report.protectedFilesUnchanged, 'All source data and interior generators must remain unchanged');
  assert.ok(report.sourceShellsUnchanged, 'All eleven source shells and dorm dimensions must remain unchanged');
  assert.ok(report.interiorSceneMeshesUnchanged, 'All eleven dorm interior meshes must match in day and night');
  assert.ok(report.floorGeometryUnchanged, 'All floor elevations, sections and dimension runs must remain unchanged');
  assert.ok(report.otherHouseOutputsUnchanged, 'Every other dorm must retain its detail, window and timber outputs');
  assert.ok(report.otherExteriorSceneMeshesUnchanged, 'All ten other dorm exterior meshes must match in day and night');
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
  await rm(baseline, {recursive: true, force: true});
  await mkdir(dirname(destination), {recursive: true});
  await writeFile(destination, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    success: report.success, baselineHead: head, report: destination,
    protectedFiles: report.protectedFiles?.length, changedProtectedFiles: report.changedProtectedFiles,
    sourceShellsUnchanged: report.sourceShellsUnchanged,
    interiorSceneMeshesUnchanged: report.interiorSceneMeshesUnchanged,
    floorGeometryUnchanged: report.floorGeometryUnchanged,
    otherHouseOutputsUnchanged: report.otherHouseOutputsUnchanged,
    otherExteriorSceneMeshesUnchanged: report.otherExteriorSceneMeshesUnchanged,
    ...(report.error ? {error: report.error} : {}),
  }, null, 2));
}
