import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

// Rebuild the immediately preceding release in isolation. This is a release
// audit, not a replacement fixture: it checks actual source, generated façade
// output and rendered interior mesh trees against the requested scope.
const BASELINE = '662a1e1e767b105ffd17b9a8e729f20f773e376d';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// A copied source tree permits a scoped audit when another task is changing
// shared integration files concurrently. Its differences are recorded below;
// protected data always comes from the real checkout, never that snapshot.
const implementationRoot = resolve(process.env.ROMMEL_TURQUOISE_SOURCE_SNAPSHOT || root);
const destination = resolve(process.argv[2] || join(tmpdir(), 'rommel-turquoise-preservation.json'));
const git = args => execFileSync('git', ['-C', root, ...args], {maxBuffer: 32 * 1024 * 1024});
const sha = value => createHash('sha256').update(value).digest('hex');
const digest = value => sha(JSON.stringify(value));
const load = (directory, path) => import(pathToFileURL(join(directory, path)).href);
const baseline = await mkdtemp(join(tmpdir(), 'rommel-turquoise-baseline-'));
const report = {baseline: BASELINE, reviewedAt: new Date().toISOString(), success: false};
let views = [];
const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

try {
  const tracked = git(['ls-tree', '-r', '--name-only', BASELINE]).toString().trim().split('\n');
  const protectedPaths = tracked.filter(path =>
    /^(?:public\/data\/|data\/source\/|scripts\/|public\/house55-)/.test(path) ||
    /^src\/(?:interior|apartment|study-measurement|sections\.js|data\.js|house55-window-alignment\.js)/.test(path));
  report.protectedFiles = await Promise.all(protectedPaths.map(async path => {
    const before = sha(git(['show', `${BASELINE}:${path}`]));
    const after = sha(await readFile(join(root, path)));
    return {path, before, after, unchanged: before === after};
  }));
  report.changedProtectedFiles = report.protectedFiles.filter(file => !file.unchanged).map(file => file.path);
  assert.deepEqual(report.changedProtectedFiles, [], 'The exterior pass must leave all existing source and interior data/generators unchanged');
  report.implementation = {
    source: implementationRoot === root ? 'working-checkout' : 'isolated-source-snapshot',
    snapshotPath: implementationRoot === root ? null : implementationRoot,
    files: await Promise.all([
      'src/exterior-details.js', 'src/scene.js', 'src/turquoise-photo-details.js',
      'src/turquoise-window-layout.js', 'src/windows.js', 'src/facade.js',
    ].map(async path => {
      const checkout = await readFile(join(root, path), 'utf8');
      const audited = await readFile(join(implementationRoot, path), 'utf8');
      const checkoutLines = checkout.split('\n'), auditedLines = audited.split('\n');
      return {
        path, checkoutSha256: sha(checkout), auditedSha256: sha(audited),
        matchesCheckout: checkout === audited,
        ...(checkout === audited ? {} : {
          checkoutOnlyLines: checkoutLines.filter(line => !auditedLines.includes(line)),
          snapshotOnlyLines: auditedLines.filter(line => !checkoutLines.includes(line)),
        }),
      };
    })),
  };
  report.implementation.baselineSourceChanges = (await Promise.all(tracked.filter(path => path.startsWith('src/')).map(async path => {
    const before = sha(git(['show', `${BASELINE}:${path}`]));
    const after = sha(await readFile(join(implementationRoot, path)));
    return before === after ? null : {path, before, after};
  }))).filter(Boolean);

  const archive = join(baseline, 'source.tar');
  git(['archive', '--format=tar', '-o', archive, BASELINE, 'src', 'package.json']);
  execFileSync('tar', ['-xf', archive, '-C', baseline]);
  await symlink(join(root, 'node_modules'), join(baseline, 'node_modules'), 'dir');
  const [THREE, currentScene, originalScene, currentDetails, originalDetails, currentWindows, originalWindows,
    currentFacade, originalFacade, interiorFns, studyFns] = await Promise.all([
    load(root, 'node_modules/three/build/three.module.js'),
    load(implementationRoot, 'src/scene.js'), load(baseline, 'src/scene.js'),
    load(implementationRoot, 'src/exterior-details.js'), load(baseline, 'src/exterior-details.js'),
    load(implementationRoot, 'src/windows.js'), load(baseline, 'src/windows.js'),
    load(implementationRoot, 'src/facade.js'), load(baseline, 'src/facade.js'),
    load(root, 'src/interiors.js'), load(root, 'src/interior-studies.js'),
  ]);
  const [campus, lod2, interiors, studies] = await Promise.all(
    ['campus', 'lod2', 'interiors', 'interior-studies'].map(name => readFile(join(root, `public/data/${name}.json`), 'utf8').then(JSON.parse)));
  const turquoise = lod2.buildings.find(building => building.number === '57a');
  report.preservedTurquoiseShell = {
    house: '57a', baseY: turquoise.baseY, height: turquoise.height,
    levels: campus.buildings.find(building => building.number === '57a').levels,
    sourceSurfaces: turquoise.surfaces.length, groundPolygons: turquoise.groundPolygons,
    sourceDigest: digest(turquoise),
  };
  const unchangedHouses = campus.buildings.filter(building => building.number !== '57a');
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
        elevationOrigin: source.baseY, elevations: [...rows.elevations, source.baseY + source.height],
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
  assert.ok(report.otherHouseOutputs.every(item => Object.values(item.unchanged).every(Boolean)),
    'Every other dorm must retain its complete detail, window and timber output');

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
      if (house !== '57a') {
        record.exteriorBefore = digest(tree(before.exterior));
        record.exteriorAfter = digest(tree(after.exterior));
        record.exteriorUnchanged = record.exteriorBefore === record.exteriorAfter;
      }
      report.sceneMeshes.push(record);
    }
  }
  assert.ok(report.sceneMeshes.every(item => item.interiorUnchanged), 'All eleven dorm interiors must have identical scene meshes in both themes');
  assert.ok(report.sceneMeshes.every(item => item.exteriorUnchanged !== false), 'All ten other dorms must have identical exterior scene meshes in both themes');
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
  await writeFile(destination, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({
    success: report.success, baseline: BASELINE, report: destination,
    protectedFiles: report.protectedFiles?.length, changedProtectedFiles: report.changedProtectedFiles,
    otherHouseOutputs: report.otherHouseOutputs?.map(({house, unchanged}) => ({house, ...unchanged})),
    sceneChecks: report.sceneMeshes?.map(({house, theme, interiorUnchanged, exteriorUnchanged}) =>
      ({house, theme, interiorUnchanged, ...(exteriorUnchanged === undefined ? {} : {exteriorUnchanged})})),
    ...(report.error ? {error: report.error} : {}),
  }, null, 2));
}
