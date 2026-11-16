import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

// Reproducible, read-only source/scene comparison for the Grau exterior pass.
// Reconstruct the release before this task using git archive and freeze the
// current source in a second temporary directory before importing either.
// Usage: node scripts/check-grau-preservation.mjs [baseline-ref] [report.json]
// Dependencies must already be installed in the current checkout.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const reference = process.argv[2] || '9052cc6';
const destination = resolve(process.argv[3] || join(tmpdir(), 'rommel-grau-preservation.json'));
const git = args => execFileSync('git', ['-C', root, ...args], {maxBuffer: 64 * 1024 * 1024});
const baselineHead = git(['rev-parse', '--verify', '--end-of-options', `${reference}^{commit}`]).toString().trim();
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = value => sha(JSON.stringify(value));
const load = (directory, path) => import(pathToFileURL(join(directory, path)).href);
const scratch = await mkdtemp(join(tmpdir(), 'rommel-grau-audit-'));
const baseline = join(scratch, 'baseline'), currentSnapshot = join(scratch, 'current');
const report = {
  baselineHead, scope: 'Grau 55a exterior only; every source shell, floorplan and interior unchanged',
  reviewedAt: new Date().toISOString(), success: false,
};
let views = [];
const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const previousCanvas = Object.getOwnPropertyDescriptor(globalThis, 'HTMLCanvasElement');

try {
  const protectedPath = path =>
    /^(?:public\/data\/|data\/source\/|scripts\/|public\/house55-)/.test(path) ||
    /^src\/(?:interior|apartment|study-measurement|sections\.js|data\.js|house55-window-alignment\.js)/.test(path) ||
    ['package.json', 'package-lock.json'].includes(path);
  const tracked = git(['ls-tree', '-r', '--name-only', '-z', baselineHead]).toString().split('\0').filter(Boolean);
  const currentPaths = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).toString().split('\0').filter(Boolean);
  const protectedPaths = [...new Set([...tracked, ...currentPaths])].filter(protectedPath)
    .filter(path => path !== 'scripts/check-grau-preservation.mjs').sort();
  const baselineFiles = new Set(tracked);
  report.protectedFiles = await Promise.all(protectedPaths.map(async path => {
    const before = baselineFiles.has(path) ? sha(git(['show', `${baselineHead}:${path}`])) : null;
    let after;
    try {after = sha(await readFile(join(root, path)));}
    catch (error) {if (error.code !== 'ENOENT') throw error; after = null;}
    return {path, before, after, unchanged: before === after};
  }));
  report.changedProtectedFiles = report.protectedFiles.filter(file => !file.unchanged).map(file => file.path);
  report.protectedFilesUnchanged = report.changedProtectedFiles.length === 0;
  assert.ok(report.protectedFilesUnchanged,
    `Source data, dimensions, floorplans and interior generators must be unchanged: ${report.changedProtectedFiles.join(', ')}`);

  await Promise.all([mkdir(baseline), mkdir(currentSnapshot)]);
  const archive = join(scratch, 'baseline.tar');
  git(['archive', '--format=tar', '-o', archive, baselineHead, 'src', 'package.json']);
  execFileSync('tar', ['-xf', archive, '-C', baseline]);
  await Promise.all([
    cp(join(root, 'src'), join(currentSnapshot, 'src'), {recursive: true}),
    cp(join(root, 'public/data'), join(currentSnapshot, 'public/data'), {recursive: true}),
    cp(join(root, 'package.json'), join(currentSnapshot, 'package.json')),
    ...[baseline, currentSnapshot].map(directory => symlink(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir')),
  ]);
  report.currentSourceHashes = Object.fromEntries(await Promise.all((await readdir(join(currentSnapshot, 'src')))
    .filter(name => name.endsWith('.js')).sort().map(async name => [name, sha(await readFile(join(currentSnapshot, 'src', name)))])));
  const [THREE, currentScene, originalScene, currentDetails, originalDetails, currentWindows, originalWindows,
    currentFacade, originalFacade, interiorFns, studyFns] = await Promise.all([
    load(root, 'node_modules/three/build/three.module.js'),
    load(currentSnapshot, 'src/scene.js'), load(baseline, 'src/scene.js'),
    load(currentSnapshot, 'src/exterior-details.js'), load(baseline, 'src/exterior-details.js'),
    load(currentSnapshot, 'src/windows.js'), load(baseline, 'src/windows.js'),
    load(currentSnapshot, 'src/facade.js'), load(baseline, 'src/facade.js'),
    load(currentSnapshot, 'src/interiors.js'), load(currentSnapshot, 'src/interior-studies.js'),
  ]);
  const [campus, lod2, interiors, studies] = await Promise.all(
    ['campus', 'lod2', 'interiors', 'interior-studies'].map(name => readFile(join(currentSnapshot, `public/data/${name}.json`), 'utf8').then(JSON.parse)));
  const grau = lod2.buildings.find(building => building.number === '55a');
  report.preservedGrauShell = {
    house: '55a', baseY: grau.baseY, height: grau.height,
    levels: campus.buildings.find(building => building.number === '55a').levels,
    sourceSurfaces: grau.surfaces.length, groundPolygons: grau.groundPolygons,
    sourceDigest: digest(grau),
  };
  const unchangedHouses = campus.buildings.filter(building => building.number !== '55a');
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

  class Element extends EventTarget {
    constructor() {super(); this.dataset = {}; this.style = {setProperty() {}}; this.children = [];}
    setAttribute() {}
    appendChild(child) {this.children.push(child);}
  }
  // Capture text, font, color and geometry for every exterior sign as well.
  // This is deterministic drawing-command evidence, not a raster comparison.
  class Canvas extends Element {
    constructor() {super(); this.width = 300; this.height = 150; this.commands = [];}
    getContext() {
      const context = {};
      context.fillText = (text, x, y, maxWidth) => this.commands.push({
        text, x, y, maxWidth, font: context.font, fillStyle: context.fillStyle,
        textAlign: context.textAlign, textBaseline: context.textBaseline,
      });
      return context;
    }
    toDataURL() {
      return `data:application/json;base64,${Buffer.from(JSON.stringify({
        width: this.width, height: this.height, commands: this.commands,
      })).toString('base64')}`;
    }
  }
  Object.defineProperty(globalThis, 'HTMLCanvasElement', {configurable: true, value: Canvas});
  Object.defineProperty(globalThis, 'document', {configurable: true, value: {
    createElement: tag => tag === 'canvas' ? new Canvas() : new Element(),
  }});
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
  const clean = value => JSON.parse(JSON.stringify(value, (key, item) =>
    ['uuid', 'metadata'].includes(key) ? undefined :
      typeof item === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(item) ? 'runtime-uuid' : item));
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
  const registration = record => ({
    data: record.data,
    position: record.group.position.toArray(),
    quaternion: record.group.quaternion.toArray(),
    scale: record.group.scale.toArray(),
    floorElevations: record.floorElevations,
    floorSections: record.floorSections,
    floorDimensions: record.floorDimensions,
  });
  for (const mix of [0, 1]) {
    views.forEach(view => view.applyTheme(mix));
    for (const {number: house} of campus.buildings) {
      const [before, after] = views.map(view => view.buildings.get(house));
      const floorsBefore = digest(before.floorGroups.map(tree)), floorsAfter = digest(after.floorGroups.map(tree));
      const registrationBefore = digest(registration(before)), registrationAfter = digest(registration(after));
      const record = {
        house, theme: mix ? 'day' : 'night',
        interiorBefore: floorsBefore, interiorAfter: floorsAfter, interiorUnchanged: floorsBefore === floorsAfter,
        registrationBefore, registrationAfter, registrationUnchanged: registrationBefore === registrationAfter,
      };
      if (house !== '55a') {
        record.exteriorBefore = digest(tree(before.exterior));
        record.exteriorAfter = digest(tree(after.exterior));
        record.exteriorUnchanged = record.exteriorBefore === record.exteriorAfter;
      }
      report.sceneMeshes.push(record);
    }
  }
  report.interiorSceneMeshesUnchanged = report.sceneMeshes.every(item => item.interiorUnchanged);
  report.otherExteriorSceneMeshesUnchanged = report.sceneMeshes.every(item => item.exteriorUnchanged !== false);
  report.sourceRegistrationUnchanged = report.sceneMeshes.every(item => item.registrationUnchanged);
  report.signComparison = 'Exterior signs include mesh/UV geometry and captured canvas text, font, color and alignment commands; pixel rendering is reviewed separately in browser previews.';
  assert.ok(report.sourceRegistrationUnchanged, 'All eleven dorms must retain their source dimensions, placement, scale, sections and floor guides');
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
  if (previousCanvas) Object.defineProperty(globalThis, 'HTMLCanvasElement', previousCanvas);
  else delete globalThis.HTMLCanvasElement;
  await mkdir(dirname(destination), {recursive: true});
  await writeFile(destination, JSON.stringify(report, null, 2) + '\n');
  await rm(scratch, {recursive: true, force: true});
  console.log(JSON.stringify({
    success: report.success, baselineHead, report: destination,
    protectedFiles: report.protectedFiles?.length, changedProtectedFiles: report.changedProtectedFiles,
    otherHouseOutputs: report.otherHouseOutputs?.map(({house, unchanged}) => ({house, ...unchanged})),
    sceneChecks: report.sceneMeshes?.map(({house, theme, registrationUnchanged, interiorUnchanged, exteriorUnchanged}) =>
      ({house, theme, registrationUnchanged, interiorUnchanged, ...(exteriorUnchanged === undefined ? {} : {exteriorUnchanged})})),
    ...(report.error ? {error: report.error} : {}),
  }, null, 2));
}
