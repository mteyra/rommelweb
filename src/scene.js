import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getLevelElevations } from './interiors.js';
import { getDisplayLevel, isIndependentLayout, studyFloorSection, studyPlanDirection } from './interior-studies.js';
import { icon } from './icons.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createFacadeSegments, createStoreyJointSegments, createTimberBoardStudy, FACADE_PROFILES, timberLineBrightness } from './facade.js';
import { floorSection, triangulateSection } from './sections.js';
import { pathSources, loadPathNetwork, triangulatePathPolygons, pathBoundarySegments } from './paths.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { createBuildingWindowStudies, getWindowProfile, getOldFacadeRowGuides, OLD_WINDOW_COLORS } from './windows.js';
import { createInteriorWireframe, INTERIOR_CUT_HEIGHT } from './interior-wireframe.js';
import { exteriorDimensionRuns, studyDimensionRuns, layoutExteriorDimensions } from './study-measurements.js';
import { apartmentConcept } from './apartment-concepts.js';
import { createApartmentWireframe } from './apartment-wireframe.js';
import { createExteriorDetails } from './exterior-details.js';
import { presentExteriorSurface } from './exterior-presentation.js';

const PAPER = 0x151715;
const INK = 0xa8aaa3;
const ACTIVE_INK = 0xdfdfd5;
export const HOME_DIRECTION = new THREE.Vector3(-0.46, 0.447, 1).normalize();
const HOME_TARGET = new THREE.Vector3(-3, 11, -7);
const TRANSITION_MS = 650;
export const SCENE_THEMES = Object.freeze({
  night: Object.freeze({
    background: PAPER, ink: INK, activeInk: ACTIVE_INK, compass: 0x676963,
    roadFill: 0x555754, footFill: 0x66665f, pathBoundary: 0x464a42, roadLine: 0x5b5d56, footLine: 0x50534b, stepsLine: 0x68685e,
    roof: 0x363837, timber: 0x504638, plates: 0x382f29, timberHatch: 0x968575, plateHatch: 0x9b8e7f, joints: 0xa49783, floor: 0x777a75,
    room: ACTIVE_INK, sharedSpace: 0xb6a886, interiorWindow: 0x91b9c8, windowGlass: 0x202b2c, windowFrame: 0x111715, windowSill: 0x7f8179, oldWindowFrame: 0xad8454,
    detailMetal: 0x92958b, detailRecess: 0x202422, detailSoffit: 0x555a4c, detailLime: 0x8eaa56, detailRoofBed: 0x41443a, detailRoofHardware: 0x5c615a, detailRoofTexture: 0x686e52, detailGlazing: 0x243235,
  }),
  day: Object.freeze({
    background: 0xe8e5da, ink: 0x62655d, activeInk: 0x303a32, compass: 0x96978a,
    roadFill: 0x989c90, footFill: 0xb8b8a9, pathBoundary: 0x9a9f90, roadLine: 0x92988a, footLine: 0xa4aa99, stepsLine: 0x909786,
    roof: 0x74776f, timber: 0xa18a6d, plates: 0x695044, timberHatch: 0x705b47, plateHatch: 0xa98a73, joints: 0x544f42, floor: 0x899a89,
    room: 0x354a3b, sharedSpace: 0x82653b, interiorWindow: 0x376879, windowGlass: 0x667979, windowFrame: 0x303d38, windowSill: 0xa5afa4, oldWindowFrame: 0xa67e49,
    detailMetal: 0x626c68, detailRecess: 0x454d47, detailSoffit: 0x858b77, detailLime: 0x9db667, detailRoofBed: 0x868873, detailRoofHardware: 0x69716c, detailRoofTexture: 0x626c4b, detailGlazing: 0x566f70,
  }),
});

/** Blend in linear color space so transitions preserve material relationships. */
export function scenePalette(dayMix) {
  const mix = Math.max(0, Math.min(1, dayMix));
  return Object.fromEntries(Object.keys(SCENE_THEMES.night).map(role => [
    role, new THREE.Color(SCENE_THEMES.night[role]).lerp(new THREE.Color(SCENE_THEMES.day[role]), mix),
  ]));
}

/** A shared zero-velocity, zero-acceleration start and finish for map motion. */
export function motionEase(progress) {
  const t = Math.max(0, Math.min(1, progress));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Absolute time keeps floor movement identical on fast and slow displays. */
export function advanceFloorMotion(building, now) {
  if (!building.gapTween) return false;
  const t = Math.min((now - building.gapTween.start) / TRANSITION_MS, 1);
  building.currentGap = building.gapTween.from + (building.gapTween.to - building.gapTween.from) * motionEase(t);
  building.floorGroups.forEach((floor, i) => { floor.position.y = building.data.baseY + building.floorElevations[i] + i * building.currentGap; });
  if (t === 1) {
    building.gapTween = null;
    if (building.targetGap === 0) {
      building.exterior.visible = true;
      building.floorGroups.forEach(floor => { floor.visible = false; });
    }
  }
  return true;
}

/** Display separation only: source floor elevations and model scale stay intact. */
export function explodedFloorGap(building) {
  const points = building.data.footprint || building.floorSections?.flatMap(section => section.polygons.flatMap(polygon => polygon.outer)) || [];
  if (!points.length) return 10;
  const width = Math.max(...points.map(point => point[0])) - Math.min(...points.map(point => point[0]));
  const depth = Math.max(...points.map(point => point[1])) - Math.min(...points.map(point => point[1]));
  return Math.max(10, Math.min(20, Math.hypot(width, depth) * 0.32));
}

export class CampusScene {
  constructor(container, labels, campus, lod2, interiors, onSelect, onFloor, onSpace = () => {}, studies = null) {
    this.container = container;
    this.labelsElement = labels;
    this.campus = campus;
    this.lod2 = lod2;
    this.interiors = interiors;
    this.studies = studies;
    this.onSelect = onSelect;
    this.onFloor = onFloor;
    this.onSpace = onSpace;
    this.buildings = new Map();
    this.labels = [];
    this.dimensionLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.dimensionLayer.classList.add('exterior-dimensions');
    this.dimensionLayer.setAttribute('role', 'img');
    this.dimensionLayer.setAttribute('aria-label', 'Exterior source-section lengths in metres. Zoom in to reveal smaller runs.');
    this.dimensionLayer.style.display = 'none';
    this.labelsElement.appendChild(this.dimensionLayer);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.theme = 'night';
    this.themeMix = 0;
    this.themeColors = scenePalette(0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(PAPER);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.scene = new THREE.Scene();
    this.contextGroup = new THREE.Group();
    this.contextGroup.userData.role = 'campus-context';
    this.contextMix = 1;
    this.scene.add(this.contextGroup);
    this.scene.fog = new THREE.Fog(PAPER, 440, 1000);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1600);
    this.camera.position.copy(HOME_TARGET).addScaledVector(HOME_DIRECTION, 265);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(HOME_TARGET);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.maxPolarAngle = Math.PI / 2.08;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 850;
    this.controls.enablePan = true;
    this.controls.addEventListener('start', () => {
      this.tween = null;
      this.isInteracting = true;
      this.setHovered(null);
      this.renderer.domElement.style.cursor = 'grabbing';
    });
    this.controls.addEventListener('end', () => {
      this.isInteracting = false;
      this.hoverDirty = true;
      this.renderer.domElement.style.cursor = 'grab';
    });
    this.scene.add(new THREE.AmbientLight(0xffffff, 2.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(-100, 180, 70);
    this.scene.add(sun);
    this.makeGround();
    this.makePaths();
    for (const building of campus.buildings) this.makeBuilding(building);
    this.campusBounds = new THREE.Box3();
    for (const building of lod2.buildings) for (const surface of building.surfaces) {
      for (const point of surface.points) this.campusBounds.expandByPoint(new THREE.Vector3(...point));
    }
    this.addGeographicLabels();
    this.applyTheme(0);
    this.bind();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.renderer.domElement.style.cursor = 'grab';
    this.renderer.setAnimationLoop(() => this.render());
  }

  makeGround() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshBasicMaterial({ color: PAPER }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.35;
    ground.userData.role = 'minimal-ground';
    ground.material.userData.themeRole = 'background';
    this.scene.add(ground);
    const radius = 127;
    const points = Array.from({ length: 161 }, (_, i) => [Math.sin(i * Math.PI * 2 / 160) * radius, -0.3, Math.cos(i * Math.PI * 2 / 160) * radius]);
    this.line(points, 0x676963, 0.14, this.contextGroup, 'compass');
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      this.line([[Math.sin(angle) * (radius - 1.5), -0.29, Math.cos(angle) * (radius - 1.5)], [Math.sin(angle) * (radius + 1.5), -0.29, Math.cos(angle) * (radius + 1.5)]], INK, 0.3, this.contextGroup, 'ink');
    }
  }

  makePaths(network = null) {
    this.pathSourceRecords = pathSources(this.campus.context);
    this.pathCount = this.pathSourceRecords.length;
    this.drawPathNetwork(network);
    if (!network) {
      const url = `${import.meta.env?.BASE_URL || './'}data/path-network.json`;
      this.pathLoad = loadPathNetwork(this.campus.context, url).then(cached => {
        if (!this.disposed && cached) {
          this.drawPathNetwork(cached);
          this.dirty = true;
        }
        return cached;
      });
    }
  }

  drawPathNetwork(network) {
    if (this.paths) {
      this.paths.removeFromParent();
      this.paths.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
    }
    this.paths = new THREE.Group();
    this.paths.userData = {
      role: 'OSM-streets-and-paths', source: 'OpenStreetMap contributors, ODbL',
      sources: this.pathSourceRecords, cacheStatus: network ? 'validated' : 'source-centerlines',
      elevationStatus: 'Flat display plane; terrain height unavailable.',
      geometryStatus: network?.sourceStatus || 'Source centerlines only; derived network unavailable.',
    };
    if (network) {
      for (const [family, polygons] of [['road', network.roadPolygons], ['footpath', network.footpathPolygons]]) {
        if (!polygons.length) continue;
        const road = family === 'road';
        const ribbon = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(triangulatePathPolygons(polygons, -0.27), 3)),
          new THREE.MeshBasicMaterial({ color: road ? 0x555754 : 0x66665f, transparent: true, opacity: road ? 0.27 : 0.18, side: THREE.DoubleSide, depthWrite: false }));
        ribbon.userData = { role: 'sourced-path-network', family, sourceIds: network.sources.filter(source => source.width !== null && (source.family === 'road') === road).map(source => source.id) };
        ribbon.material.userData.themeRole = road ? 'roadFill' : 'footFill';
        this.paths.add(ribbon);
      }
      const boundary = new LineSegments2(new LineSegmentsGeometry().setPositions(pathBoundarySegments(network.polygons, -0.255)),
        new LineMaterial({ color: 0x464a42, linewidth: 0.85, alphaToCoverage: true, depthWrite: false }));
      boundary.userData.role = 'unioned-network-boundary';
      boundary.material.userData.themeRole = 'pathBoundary';
      this.paths.add(boundary);
    }
    const centerlines = network ? network.centerlines : this.pathSourceRecords;
    for (const family of ['road', 'footpath', 'steps']) {
      const sources = centerlines.filter(source => source.family === family);
      if (!sources.length) continue;
      const positions = sources.flatMap(source => source.points.slice(1).flatMap((point, i) =>
        [[source.points[i][0], -0.25, source.points[i][1]], [point[0], -0.25, point[1]]])).flat();
      const centerline = new LineSegments2(new LineSegmentsGeometry().setPositions(positions),
        new LineMaterial({ color: family === 'road' ? 0x5b5d56 : family === 'steps' ? 0x68685e : 0x50534b, linewidth: family === 'road' ? 1.3 : 1.05, alphaToCoverage: true, depthWrite: false }));
      centerline.userData = { role: 'sourced-centerlines', family, sourceIds: sources.map(source => source.id), widthStatus: 'Screen-width linework; no ground width inferred.' };
      centerline.material.userData.themeRole = family === 'road' ? 'roadLine' : family === 'steps' ? 'stepsLine' : 'footLine';
      this.paths.add(centerline);
    }
    this.contextGroup.add(this.paths);
    this.applyContextMix(this.contextMix);
    this.applyTheme?.(this.themeMix || 0);
  }

  applyContextMix(mix) {
    this.contextMix = mix;
    this.contextGroup.visible = mix > 0;
    this.contextGroup.traverse(object => {
      for (const material of [object.material].flat().filter(Boolean)) {
        material.userData.contextOpacity ??= material.opacity;
        material.transparent = true;
        material.opacity = material.userData.contextOpacity * mix;
      }
    });
  }

  setContextVisible(visible) {
    const to = visible ? 1 : 0;
    this.contextTween = this.reduced || this.contextMix === to ? null : {start: performance.now(), from: this.contextMix, to};
    if (!this.contextTween) this.applyContextMix(to);
  }

  updateViewVisibility() {
    for (const [number, building] of this.buildings) {
      const isolated = this.exploded && number === this.selected;
      building.group.visible = !this.exploded || isolated;
      building.floorGroups.forEach((group, floor) => {
        group.visible = !this.apartment && building.group.visible && !building.exterior.visible && (!isolated || this.activeFloor == null || this.activeFloor === floor);
      });
      building.interiorGroups.forEach((group, floor) => {
        group.visible = isolated && (this.activeFloor == null || this.activeFloor === floor);
      });
    }
    // Hide DOM targets synchronously so rapid travel cannot activate stale labels.
    for (const label of this.labels) if (!this.labelInCurrentView(label)) label.el.hidden = true;
    if (this.dimensionLayer) this.dimensionLayer.style.display = 'none';
  }

  labelInCurrentView(label) {
    if (this.apartment) return label.type === 'concept';
    if (label.type === 'concept') return false;
    if (label.type === 'context') return !this.selected && !this.exploded;
    if (label.type === 'floor') return this.exploded && label.number === this.selected && this.activeFloor == null;
    if (label.type === 'room' || label.type === 'door') return this.exploded && label.number === this.selected && label.floor === this.activeFloor;
    return !this.exploded;
  }

  line(points, color = INK, opacity = 1, group = this.scene, themeRole = null) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p))),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
    if (themeRole) line.material.userData.themeRole = themeRole;
    group.add(line);
    return line;
  }

  makeBuilding(data) {
    const group = new THREE.Group();
    const official = this.lod2.buildings.find(b => b.number === data.number);
    const exterior = new THREE.Group();
    exterior.userData = { role: 'official-LoD2-exterior', sourceId: official.id };
    const exteriorFills = [], exteriorLines = [], exteriorPickables = [];
    const geometries = new Map();
    const edges = new Map();
    const family = data.campus === 'II' ? 'timber' : 'plates';
    const floorElevations = getLevelElevations(this.interiors, data.number, data.levels, data.height);
    const detailSegments = [], distantSegments = [], jointSegments = [];
    const timberBoards = {positions: [], nightColors: [], dayColors: [], boardCount: 0};
    const windowLayers = {reveal: [], frame: [], glass: [], head: [], blind: [], sill: []}, windowLinework = [];
    let windowCount = 0;
    const windowProfile = getWindowProfile(data.number, family);
    const windowRows = family === 'plates' ? getOldFacadeRowGuides(official, data.levels, this.interiors) : {
      elevations: floorElevations.map(elevation => data.baseY + elevation), relativeElevations: floorElevations, guideHeight: data.height,
      status: 'Schematic window rows follow the current provisional or approved floor guides; opening positions are not surveyed.',
    };
    const locatedLevels = (this.studies?.buildings[data.number]?.levels || []).filter(level => level.windows?.length && !getDisplayLevel(this.interiors, null, data.number, level.index));
    const architecturalDetails = createExteriorDetails(official, {house: data.number, levels: data.levels, absoluteFloorElevations: windowRows.elevations});
    const windowStudies = createBuildingWindowStudies(official.surfaces, windowRows.elevations, data.baseY + windowRows.guideHeight, {
      house: data.number, family, locatedLevels,
      exclusionsBySurface: architecturalDetails.exclusionsBySurface,
      layoutsBySurface: architecturalDetails.layoutsBySurface,
    });
    for (const surface of official.surfaces) {
      const masks = architecturalDetails.exclusionsBySurface.get(surface) || [];
      const presentation = presentExteriorSurface(surface, masks);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(presentation.positions, 3));
      geometry.computeVertexNormals();
      if (!geometries.has(surface.type)) geometries.set(surface.type, []);
      geometries.get(surface.type).push(geometry);
      for (const [a, b] of presentation.boundarySegments) {
        const key = [a.join(','), b.join(',')].sort().join('|');
        edges.set(key, [a, b]);
      }
      const study = windowStudies.get(surface);
      const constructionMasks = [...masks, ...(study?.patches || []).map(patch => [...patch.corners, patch.corners[0]])];
      const materialOptions = {exclusions: constructionMasks, elevationOrigin: data.baseY};
      detailSegments.push(...createFacadeSegments(surface, family, 1, materialOptions));
      distantSegments.push(...createFacadeSegments(surface, family, 4, materialOptions));
      if (family === 'timber') {
        const boards = createTimberBoardStudy(surface, {...materialOptions, elevations: [...windowRows.elevations, data.baseY + data.height]});
        for (const key of ['positions', 'nightColors', 'dayColors']) timberBoards[key].push(...boards[key]);
        timberBoards.boardCount += boards.boardCount;
      }
      if (family === 'timber') jointSegments.push(...createStoreyJointSegments(surface, floorElevations.slice(1).map(elevation => data.baseY + elevation), {exclusions: masks}));
      if (windowStudies.has(surface)) {
        windowCount += study.count;
        for (const key of Object.keys(windowLayers)) windowLayers[key].push(...study.layers[key]);
        windowLinework.push(...(study.linework || []));
      }
    }
    // Presentation cutouts do not alter the retained source used by floor sections.
    for (const [type, parts] of geometries) {
      const geometry = mergeGeometries(parts);
      parts.forEach(part => part.dispose());
      const roof = type === 'RoofSurface';
      const fill = new THREE.MeshBasicMaterial({
        color: roof ? 0x363837 : family === 'timber' ? 0x504638 : 0x382f29,
        side: THREE.DoubleSide, transparent: true, opacity: roof ? 0.72 : 0.54,
        depthWrite: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      });
      fill.userData.role = type;
      fill.userData.themeRole = roof ? 'roof' : family;
      const mesh = new THREE.Mesh(geometry, fill);
      mesh.userData = { house: data.number, floor: null, source: 'LoD2-BY' };
      exterior.add(mesh);
      exteriorFills.push(fill);
      exteriorPickables.push(mesh);
    }
    const edgeMaterial = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.76, depthWrite: false });
    const sourceEdges = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([...edges.values()].flat(2), 3)), edgeMaterial);
    sourceEdges.renderOrder = 2;
    exterior.add(sourceEdges);
    exteriorLines.push(edgeMaterial);
    let weathering = null;
    if (timberBoards.positions.length) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(timberBoards.positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(timberBoards.nightColors, 3));
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, transparent: true,
        opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      });
      weathering = new THREE.Mesh(geometry, material);
      weathering.renderOrder = 0.5;
      weathering.userData = {
        role: 'procedural-timber-weathering', boardCount: timberBoards.boardCount,
        nightColors: new Float32Array(timberBoards.nightColors), dayColors: new Float32Array(timberBoards.dayColors),
      };
      exterior.add(weathering);
    }
    const facadeGroups = [];
    const facadeMaterials = [];
    for (const [index, segments] of [detailSegments, distantSegments].entries()) {
      const material = new THREE.LineBasicMaterial({ color: family === 'timber' ? 0x968575 : 0x9b8e7f, transparent: true, opacity: index ? 0.2 : 0.16, depthWrite: false, vertexColors: true });
      material.userData.themeRole = family === 'timber' ? 'timberHatch' : 'plateHatch';
      const hatchGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(segments.flat(2), 3));
      hatchGeometry.setAttribute('color', new THREE.Float32BufferAttribute(segments.flatMap(([a, b]) => {
        const brightness = family === 'timber' ? timberLineBrightness([a, b]) : Math.abs(a[1] - b[1]) > 0.0001 ? (index ? 0.28 : 0.62) : 1;
        return Array(6).fill(brightness);
      }), 3));
      const hatch = new THREE.LineSegments(hatchGeometry, material);
      hatch.renderOrder = 1;
      hatch.userData = { role: 'schematic-material-hatching', ...FACADE_PROFILES[family], segmentCount: segments.length };
      hatch.visible = index === 1;
      exterior.add(hatch);
      facadeGroups.push(hatch);
      facadeMaterials.push(material);
    }
    const jointMaterial = new THREE.LineBasicMaterial({ color: 0xa49783, transparent: true, opacity: 0.34, depthWrite: false });
    jointMaterial.userData.themeRole = 'joints';
    const joints = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(jointSegments.flat(2), 3)), jointMaterial);
    joints.renderOrder = 2;
    joints.userData = {
      role: 'schematic-storey-joints', segmentCount: jointSegments.length,
      source: FACADE_PROFILES.timber.source,
      status: 'Photo-informed horizontal joints at provisional floor elevations, not measured facade features.',
    };
    exterior.add(joints);
    const windowGroup = new THREE.Group(), windowMaterials = [];
    windowGroup.userData = {
      role: 'schematic-window-study', ...windowProfile, windowCount, rowGuides: windowRows,
      locatedWindowCount: [...windowStudies.values()].reduce((sum, study) => sum + (study.locatedCount || 0), 0),
      rejectedLocatedWindows: [...windowStudies.values()].flatMap(study => study.rejectedLocated || []),
      scope: family === 'plates'
        ? 'Three aligned appearance rows, including ground, on grounded multistorey wall portions. Located House55 windows retained. Identified shared glazing is a separate photographic detail.'
        : 'Photo-informed room rows and construction details, clipped to source faces and suppressed inside identified stair/loggia openings. Unseen faces retain provisional rhythms.',
    };
    for (const [layer, positions] of Object.entries(windowLayers)) {
      if (!positions.length) continue;
      const themeRole = layer === 'glass' ? 'windowGlass' : layer === 'sill' ? 'windowSill' : ['reveal', 'blind'].includes(layer) ? 'windowFrame' : family === 'plates' ? 'oldWindowFrame' : 'windowFrame';
      const material = new THREE.MeshBasicMaterial({color: SCENE_THEMES.night[themeRole], side: THREE.DoubleSide, transparent: true, opacity: layer === 'glass' ? 0.87 : 0.96, depthWrite: true});
      material.userData = {themeRole, windowLayer: layer};
      if (themeRole === 'oldWindowFrame') material.userData.themeOverride = OLD_WINDOW_COLORS[data.number];
      const mesh = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)), material);
      mesh.renderOrder = layer === 'reveal' ? 2 : layer === 'frame' ? 3 : 4;
      windowGroup.add(mesh);
      windowMaterials.push(material);
    }
    if (windowLinework.length) {
      const material = new THREE.LineBasicMaterial({color: 0x7f8179, transparent: true, opacity: 0.7, depthWrite: false});
      material.userData = {themeRole: family === 'plates' ? 'oldWindowFrame' : 'windowSill', windowLayer: 'construction'};
      if (family === 'plates') material.userData.themeOverride = OLD_WINDOW_COLORS[data.number];
      const mesh = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(windowLinework.flat(2), 3)), material);
      mesh.renderOrder = 5;
      windowGroup.add(mesh);
      windowMaterials.push(material);
    }
    exterior.add(windowGroup);
    const detailGroup = new THREE.Group(), detailMaterials = [];
    detailGroup.userData = {role: 'photographic-exterior-details', features: architecturalDetails.features, status: 'Replaceable visual hypotheses inside the fixed source envelope; not an approved interior.'};
    for (const [themeRole, positions] of Object.entries(architecturalDetails.triangleLayers)) {
      if (!positions.length) continue;
      const material = new THREE.MeshBasicMaterial({color: SCENE_THEMES.night[themeRole], side: THREE.DoubleSide, transparent: true, opacity: 0.92, depthWrite: true});
      material.userData = {themeRole, detailType: 'surface'};
      if (themeRole === 'oldWindowFrame') material.userData.themeOverride = OLD_WINDOW_COLORS[data.number];
      const mesh = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)), material);
      mesh.userData = {house: data.number, floor: null, role: 'photographic-exterior-details'};
      // The source shell writes depth first, preventing far-side glazing from
      // bleeding through a translucent roof when it is batched with near faces.
      mesh.renderOrder = 1;
      detailGroup.add(mesh);
      detailMaterials.push(material);
      exteriorPickables.push(mesh);
    }
    for (const [themeRole, segments] of Object.entries(architecturalDetails.segmentLayers)) {
      if (!segments.length) continue;
      const material = new THREE.LineBasicMaterial({color: SCENE_THEMES.night[themeRole], transparent: true, opacity: 0.75, depthWrite: false});
      material.userData = {themeRole, detailType: 'line'};
      if (themeRole === 'oldWindowFrame') material.userData.themeOverride = OLD_WINDOW_COLORS[data.number];
      const mesh = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(segments.flat(2), 3)), material);
      mesh.renderOrder = 3;
      detailGroup.add(mesh);
      detailMaterials.push(material);
    }
    exterior.add(detailGroup);
    group.add(exterior);
    const floorGroups = [];
    const fillMaterials = [];
    const lineMaterials = [];
    const pickables = [];
    const interiorPickables = [];
    const interiorGroups = [];
    const floorSections = [];
    for (let floor = 0; floor < data.levels; floor++) {
      const slab = new THREE.Group();
      const level = getDisplayLevel(this.interiors, this.studies, data.number, floor);
      const section = studyFloorSection(floorSection(official, floorElevations[floor]), level);
      floorSections.push(section);
      const triangles = triangulateSection(section, 0);
      const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(triangles.flat(2), 3));
      geometry.computeVertexNormals();
      const material = new THREE.MeshBasicMaterial({ color: 0x777a75, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
      material.userData.themeRole = 'floor';
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { house: data.number, floor, role: isIndependentLayout(level) ? 'independent-layout-outline' : level?.isStudy ? 'resident-floor-outline' : 'source-envelope-section',
        ...(isIndependentLayout(level) ? {layoutBasis: level.layoutBasis} : {sourceId: official.id}),
        sectionStatus: section.sourceStatus, sampleElevation: section.sampleElevation };
      slab.add(mesh);
      const lineMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.68 });
      const boundary = section.polygons.flatMap(polygon => [polygon.outer, ...(polygon.holes || [])]).flatMap(ring =>
        ring.slice(1).flatMap((point, i) => [[ring[i][0], 0.005, ring[i][1]], [point[0], 0.005, point[1]]]));
      const edges = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(boundary.flat(), 3)), lineMat);
      slab.add(edges);
      slab.position.y = data.baseY + floorElevations[floor];
      const wireframe = createInteriorWireframe(level, {house: data.number, floor});
      const interior = wireframe.group;
      interiorPickables.push(...wireframe.pickables);
      for (const label of wireframe.labels) {
        if (!label.position) continue;
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `room-label${label.kind === 'door' ? ' door-label' : ''}${level?.isStudy ? ' study-marker' : ''}${label.confidence === 'estimated' ? ' is-estimated' : ''}`;
        if (label.kind === 'door' && level?.isStudy) el.innerHTML = icon('door');
        else el.textContent = level?.isStudy ? label.shortText || label.text : label.text;
        el.title = label.text;
        el.setAttribute('aria-label', `Explore ${label.text}${level?.isStudy ? `, ${label.confidence === 'estimated' ? 'estimated layout' : 'resident sketch'}` : ''}, House ${data.number}, ${floor === 0 ? 'ground floor' : `floor ${floor}`}`);
        const details = {house: data.number, floor, spaceId: label.spaceId, ...(label.openingId ? {openingId: label.openingId} : {})};
        el.addEventListener('click', () => this.openSpace(details));
        this.labelsElement.appendChild(el);
        this.labels.push({ el, getPosition: () => new THREE.Vector3(label.position[0], slab.position.y + label.position[1], label.position[2]), type: label.kind === 'door' ? 'door' : 'room', number: data.number, floor });
      }
      const floorLabel = document.createElement('button');
      floorLabel.type = 'button';
      floorLabel.className = 'floor-label';
      floorLabel.textContent = floor === 0 ? 'EG' : `${floor}. OG`;
      floorLabel.setAttribute('aria-label', `Explore House ${data.number}, ${level?.label || (floor === 0 ? 'ground floor' : `floor ${floor}`)}`);
      floorLabel.addEventListener('click', () => this.onFloor(floor));
      this.labelsElement.appendChild(floorLabel);
      this.labels.push({el: floorLabel, type: 'floor', number: data.number, floor, getPosition: () => {
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        const points = section.polygons.flatMap(polygon => polygon.outer);
        const anchor = points.reduce((best, point) => !best || point[0] * right.x + point[1] * right.z > best[0] * right.x + best[1] * right.z ? point : best, null) || data.centroid;
        return new THREE.Vector3(anchor[0] + right.x * 1.4, slab.position.y + 0.6, anchor[1] + right.z * 1.4);
      }});
      interior.visible = false;
      slab.add(interior);
      interiorGroups.push(interior);
      slab.visible = false;
      group.add(slab);
      floorGroups.push(slab);
      fillMaterials.push(material);
      lineMaterials.push(lineMat);
      pickables.push(mesh);
    }
    this.scene.add(group);
    const el = document.createElement('button');
    el.className = 'house-label';
    el.style.setProperty('--house-color', data.color);
    el.innerHTML = `<span class="label-dot"></span><strong>${data.number}</strong><span class="label-arrow">↗</span>`;
    el.setAttribute('aria-label', `Select house ${data.number}, ${data.name}`);
    el.dataset.house = data.number;
    el.addEventListener('click', () => this.onSelect(data.number));
    el.addEventListener('pointerenter', () => this.setHovered(data.number));
    el.addEventListener('pointerleave', () => this.setHovered(null));
    this.labelsElement.appendChild(el);
    const floorDimensions = floorSections.map((section, floor) => {
      const level = getDisplayLevel(this.interiors, this.studies, data.number, floor);
      const outline = exteriorDimensionRuns(section.polygons).map(run => isIndependentLayout(level)
        ? {...run, isLayoutOutline: true, note: `${run.label}, independent layout outline. Rooms use the chosen clear dimensions and separate wall allowances.`} : run);
      return [...outline, ...studyDimensionRuns(level)];
    });
    const record = { data, group, floorGroups, floorElevations, floorSections, floorDimensions, interiorGroups, interiorPickables, fillMaterials, lineMaterials, pickables, exterior, exteriorFills, exteriorLines, exteriorPickables, facadeGroups, facadeMaterials, weathering, materialFamily: family, jointMaterial, joints, windowGroup, windowMaterials, detailGroup, detailMaterials, label: el, currentGap: 0, targetGap: 0 };
    this.buildings.set(data.number, record);
    this.labels.push({ el, getPosition: () => new THREE.Vector3(data.centroid[0], data.baseY + Math.max(data.height, record.exterior.visible ? data.height : floorElevations.at(-1) + record.currentGap * (data.levels - 1)) + 3, data.centroid[1]), type: 'house', number: data.number });
  }

  addGeographicLabels() {
    for (const [text, x, z] of [['N', 0, -132], ['E', 132, 0], ['S', 0, 132], ['W', -132, 0]]) {
      const el = document.createElement('span');
      el.className = 'place-label compass-label';
      el.textContent = text;
      this.labelsElement.appendChild(el);
      this.labels.push({ el, getPosition: () => new THREE.Vector3(x, -0.2, z), type: 'context' });
    }
  }

  focusBounds() {
    if (!this.selected) return this.campusBounds.clone();
    return new THREE.Box3().setFromPoints(this.focusPoints());
  }

  focusPoints() {
    if (this.apartment) {
      return this.apartment.space.polygon.flatMap(([x, z]) => [new THREE.Vector3(x, this.apartment.y, z), new THREE.Vector3(x, this.apartment.y + INTERIOR_CUT_HEIGHT, z)]);
    }
    if (this.selected && this.exploded) {
      const building = this.buildings.get(this.selected);
      return building.floorSections.flatMap((section, floor) => {
        if (this.activeFloor != null && this.activeFloor !== floor) return [];
        const y = building.data.baseY + building.floorElevations[floor] + building.targetGap * floor;
        const level = getDisplayLevel(this.interiors, this.studies, building.data.number, floor);
        const points = [
          ...(section.polygons.length ? section.polygons.flatMap(polygon => polygon.outer) : building.data.footprint),
          ...(level?.spaces.flatMap(space => space.polygon) || []),
        ];
        return points.flatMap(([x, z]) => [
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(x, y + (level ? INTERIOR_CUT_HEIGHT : 0.12), z),
        ]);
      });
    }
    return this.lod2.buildings.filter(building => !this.selected || building.number === this.selected)
      .flatMap(building => building.surfaces.flatMap(surface => surface.points.map(point => new THREE.Vector3(...point))));
  }

  fittedCamera(direction = HOME_DIRECTION, padding = this.apartment ? 1.18 : this.selected ? this.exploded ? 1.16 : 1.38 : 1.2) {
    const bounds = this.focusBounds();
    const target = bounds.getCenter(new THREE.Vector3());
    const outward = direction.clone().normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), outward).normalize();
    if (right.lengthSq() < 0.5) right.set(1, 0, 0);
    const up = new THREE.Vector3().crossVectors(outward, right).normalize();
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const tanH = tanV * this.camera.aspect;
    const viewport = this.container?.getBoundingClientRect();
    // Leave room for the floor title and the compact bottom tray on phones.
    // Fit within those screen bounds without changing the metre-scale model.
    const floorView = this.exploded && viewport;
    const phoneFloor = this.exploded && viewport?.width <= 700;
    const top = phoneFloor ? Math.min(this.apartment ? 138 : 148, viewport.height * 0.27) : floorView ? viewport.width <= 1100 ? 164 : 140 : 0;
    const bottom = phoneFloor ? Math.min(this.apartment ? 154 : 196, viewport.height * 0.35) : floorView ? this.activeFloor !== null ? 150 : 70 : 0;
    const upper = floorView ? 1 - 2 * top / viewport.height : 1;
    const lower = floorView ? -1 + 2 * bottom / viewport.height : -1;
    const center = (upper + lower) / 2;
    let distance = this.apartment ? 4 : 24;
    const points = this.focusPoints?.() || [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y => [bounds.min.z, bounds.max.z].map(z => new THREE.Vector3(x, y, z))));
    for (const point of points) {
      const corner = point.clone().sub(target);
      const depth = corner.dot(outward), vertical = padding * corner.dot(up) / tanV;
      distance = Math.max(distance, depth + padding * Math.abs(corner.dot(right)) / tanH,
        (vertical + upper * depth) / (upper - center),
        (-vertical - lower * depth) / (center - lower));
    }
    distance = Math.min(distance, 840);
    target.addScaledVector(up, -center * distance * tanV);
    return { target, position: target.clone().addScaledVector(outward, distance) };
  }

  setTheme(theme) {
    if (!Object.hasOwn(SCENE_THEMES, theme)) throw new Error('Scene theme must be day or night');
    this.theme = theme;
    const to = theme === 'day' ? 1 : 0;
    this.dirty = true;
    this.themeTween = this.reduced || this.themeMix === to ? null : {start: performance.now(), from: this.themeMix, to};
    if (!this.themeTween) this.applyTheme(to);
  }

  applyTheme(dayMix) {
    this.themeMix = dayMix;
    this.themeColors = scenePalette(dayMix);
    this.renderer?.setClearColor(this.themeColors.background);
    if (this.scene.fog) this.scene.fog.color.copy(this.themeColors.background);
    this.scene.traverse(object => {
      for (const material of [object.material].flat().filter(Boolean)) {
        const role = material.userData.themeRole;
        if (material.userData.themeOverride) {
          material.color.set(material.userData.themeOverride.night).lerp(new THREE.Color(material.userData.themeOverride.day), dayMix);
        } else if (role) material.color.copy(this.themeColors[role]);
      }
    });
    for (const building of this.buildings.values()) {
      if (building.weathering) {
        const colors = building.weathering.geometry.getAttribute('color');
        const {nightColors, dayColors} = building.weathering.userData;
        for (let i = 0; i < colors.array.length; i++) colors.array[i] = nightColors[i] + (dayColors[i] - nightColors[i]) * dayMix;
        colors.needsUpdate = true;
      }
      this.applyBuildingAppearance(building);
    }
  }

  applyBuildingAppearance(building) {
    const colors = this.themeColors || scenePalette(0), mix = this.themeMix || 0;
    const active = building.data.number === this.selected, hovered = building.data.number === this.hovered;
    const dim = Boolean(this.selected && !active);
    const blend = (night, day) => night + (day - night) * mix;
    building.exteriorLines.forEach(material => {
      material.color.copy(active || hovered ? colors.activeInk : colors.ink);
      material.opacity = active ? 0.98 : hovered ? 0.94 : dim ? 0.2 : 0.76;
    });
    building.exteriorFills.forEach(material => {
      material.opacity = dim ? blend(0.16, 0.26) : material.userData.role === 'RoofSurface' ? active ? 1 : blend(0.72, 0.91) : active ? blend(0.65, 0.94) : blend(0.54, 0.86);
    });
    building.jointMaterial.opacity = dim ? 0.07 : active ? 0.46 : 0.34;
    if (building.weathering) building.weathering.material.opacity = dim ? blend(0.07, 0.13) : active ? 0.56 : 0.42;
    building.windowMaterials.forEach(material => {
      material.opacity = dim ? blend(0.12, 0.18) : material.userData.windowLayer === 'glass' ? 0.87 : material.userData.windowLayer === 'construction' ? 0.70 : 0.96;
    });
    building.detailMaterials?.forEach(material => {
      material.opacity = dim ? blend(0.18, 0.26) : material.userData.detailType === 'line' ? active ? 0.9 : 0.68 : 0.94;
    });
    building.lineMaterials.forEach((material, i) => {
      material.color.copy(active ? colors.activeInk : colors.ink);
      material.opacity = dim ? 0.2 : !active || this.activeFloor == null || this.activeFloor === i ? 0.9 : 0.2;
    });
    building.fillMaterials.forEach((material, i) => {
      material.opacity = dim ? 0.035 : !active ? blend(0.11, 0.18) : this.activeFloor == null ? blend(0.21, 0.28) : this.activeFloor === i ? blend(0.38, 0.48) : blend(0.045, 0.075);
    });
  }

  renderingSummary() {
    return { buildings: this.buildings.size, officialSurfaces: this.lod2.buildings.reduce((sum, b) => sum + b.surfaces.length, 0),
      facadeSegments: [...this.buildings.values()].reduce((sum, b) => sum + b.facadeGroups[0].userData.segmentCount, 0),
      storeyJointSegments: [...this.buildings.values()].reduce((sum, b) => sum + b.joints.userData.segmentCount, 0),
      sourcePaths: this.pathCount,
      pathCache: this.paths.userData.cacheStatus,
      mappedPathWidths: this.pathSourceRecords.filter(source => source.width !== null).length,
      theme: this.theme,
      schematicWindows: [...this.buildings.values()].reduce((sum, building) => sum + building.windowGroup.userData.windowCount, 0),
      windowStudies: [...this.buildings.values()].map(building => ({number: building.data.number, count: building.windowGroup.userData.windowCount, locatedCount: building.windowGroup.userData.locatedWindowCount, rejectedLocated: building.windowGroup.userData.rejectedLocatedWindows, rows: building.windowGroup.userData.rowGuides.relativeElevations, alignment: building.windowGroup.userData.alternateOffset === 0 ? 'aligned' : 'schematic offsets'})),
      floorSections: [...this.buildings.values()].map(b => ({ number: b.data.number, areas: b.floorSections.map(section => section.area), openChains: b.floorSections.reduce((sum, section) => sum + section.openChains.length, 0) })),
      exteriorDetails: [...this.buildings.values()].map(b => ({house: b.data.number, features: b.detailGroup.userData.features})),
      contextBoxes: 0, trees: 0, units: 'metres', facadeStatus: 'Photographic detail layer on retained source dimensions; unmeasured openings, recesses and roof fixtures do not establish room assignments or interior boundaries' };
  }

  setCommunity(enabled, clubs) {
    this.dirty = true;
    this.community = enabled;
    for (const l of this.labels.filter(l => l.type === 'club')) l.el.remove();
    this.labels = this.labels.filter(l => l.type !== 'club');
    if (!enabled) return;
    clubs.filter(c => c.house).forEach(club => {
      const building = this.buildings.get(club.house);
      if (!building) return;
      const el = document.createElement('button');
      el.className = 'club-label';
      el.textContent = club.title;
      el.addEventListener('click', () => this.onSelect(club.house));
      this.labelsElement.appendChild(el);
      this.labels.push({ el, getPosition: () => new THREE.Vector3(building.data.centroid[0], building.data.baseY + building.data.height + building.currentGap * (building.data.levels - 1) + 11, building.data.centroid[1]), type: 'club', number: club.house });
    });
  }

  select(number, focus = true) {
    if (number && !this.buildings.has(number)) return;
    this.clearApartment();
    const fromInterior = this.exploded;
    const previousDirection = fromInterior ? this.buildingViewDirection || HOME_DIRECTION : this.camera.position.clone().sub(this.controls.target).normalize();
    this.dirty = true;
    this.tween = null;
    this.selected = number;
    this.hovered = null;
    this.hoverDirty = Boolean(this.mousePosition);
    this.exploded = false;
    this.activeFloor = null;
    if (fromInterior) this.topView = false;
    for (const [num, building] of this.buildings) {
      const active = num === number, dim = number && !active;
      building.targetGap = building.currentGap = 0;
      building.gapTween = null;
      building.exterior.visible = true;
      building.floorGroups.forEach((f, i) => { f.visible = false; f.position.y = building.data.baseY + building.floorElevations[i]; });
      building.facadeMaterials.forEach((m, index) => { m.opacity = dim ? 0.045 : index ? 0.2 : active ? 0.22 : 0.16; });
      this.applyBuildingAppearance(building);
      building.label.classList.toggle('selected', active);
      building.label.classList.toggle('muted', Boolean(dim));
    }
    this.setContextVisible(true);
    this.updateViewVisibility();
    if (focus && number) {
      const direction = previousDirection.clone();
      if (!this.topView) direction.y = Math.max(direction.y, 0.48);
      const frame = this.fittedCamera(direction.normalize());
      this.animateCamera(frame.position, frame.target);
    } else if (focus) this.reset();
  }

  explode(enabled) {
    this.clearApartment();
    if (!this.selected) return;
    this.dirty = true;
    if (enabled && !this.exploded) {
      this.buildingViewDirection = this.camera.position.clone().sub(this.controls.target).normalize();
      const direction = this.buildingViewDirection.clone();
      direction.y = 0;
      if (direction.lengthSq() < 0.01) direction.copy(HOME_DIRECTION).setY(0);
      this.stackDirection = direction.normalize().setY(0.55).normalize();
    }
    this.exploded = enabled;
    this.activeFloor = null;
    this.topView = false;
    const b = this.buildings.get(this.selected);
    b.targetGap = enabled ? explodedFloorGap(b) : 0;
    b.gapTween = this.reduced ? null : { start: performance.now(), from: b.currentGap, to: b.targetGap };
    if (this.reduced) b.currentGap = b.targetGap;
    b.exterior.visible = !enabled && (this.reduced || b.currentGap === 0);
    b.floorGroups.forEach((f, i) => { f.position.y = b.data.baseY + b.floorElevations[i] + i * b.currentGap; });
    this.setContextVisible(!enabled);
    this.updateViewVisibility();
    this.applyBuildingAppearance(b);
    const direction = enabled ? this.stackDirection || HOME_DIRECTION : this.buildingViewDirection || HOME_DIRECTION;
    const frame = this.fittedCamera(direction);
    this.animateCamera(frame.position, frame.target);
  }

  setFloor(floor) {
    const b = this.buildings.get(this.selected);
    if (!b || floor !== null && (!Number.isInteger(floor) || floor < 0 || floor >= b.floorGroups.length)) return;
    this.clearApartment();
    this.dirty = true;
    if (floor !== null && !this.exploded) this.explode(true);
    this.activeFloor = floor;
    this.applyBuildingAppearance(b);
    this.updateViewVisibility();
    if (!this.exploded) return;
    // Align the remaining floor movement with this camera transition.
    if (b.gapTween) b.gapTween = {start: performance.now(), from: b.currentGap, to: b.targetGap};
    this.topView = floor !== null;
    const level = getDisplayLevel(this.interiors, this.studies, this.selected, floor);
    const viewport = this.container.getBoundingClientRect();
    const direction = floor === null ? this.stackDirection || HOME_DIRECTION
      : level?.isStudy ? new THREE.Vector3(...studyPlanDirection(level, viewport.width < 700 && viewport.height > viewport.width))
        : new THREE.Vector3(0, 1, 0.025);
    const frame = this.fittedCamera(direction);
    this.animateCamera(frame.position, frame.target);
  }

  openSpace(details) {
    if (!this.exploded || details.house !== this.selected) return;
    if (details.floor !== this.activeFloor) { this.onFloor(details.floor); return; }
    this.onSpace(details);
  }

  clearApartment() {
    if (!this.apartment) return;
    this.apartment.group.removeFromParent();
    this.apartment.group.traverse(object => { object.geometry?.dispose(); for (const material of [object.material].flat().filter(Boolean)) material.dispose(); });
    for (const label of this.labels.filter(label => label.type === 'concept')) label.el.remove();
    this.labels = this.labels.filter(label => label.type !== 'concept');
    this.apartment = null;
    this.controls.minDistance = 20;
    this.dirty = true;
  }

  focusApartment(spaceId) {
    const level = getDisplayLevel(this.interiors, this.studies, this.selected, this.activeFloor);
    const space = level?.spaces.find(space => space.id === spaceId && space.kind === 'room');
    const concept = space && apartmentConcept(level, space);
    if (!concept || concept.status !== 'concept') return null;
    this.clearApartment();
    const b = this.buildings.get(this.selected), floor = this.activeFloor;
    const wireframe = createApartmentWireframe(level, space, concept, {house: this.selected, floor});
    const y = b.data.baseY + b.floorElevations[floor] + b.targetGap * floor;
    wireframe.group.position.y = y;
    this.apartment = {space, level, concept, ...wireframe, y};
    this.scene.add(wireframe.group);
    this.controls.minDistance = 2;
    for (const label of wireframe.labels) {
      const el = document.createElement('span');
      el.className = 'room-label apartment-concept-label';
      el.textContent = label.text;
      this.labelsElement.appendChild(el);
      this.labels.push({el, type: 'concept', number: this.selected, floor, getPosition: () => new THREE.Vector3(label.position[0], y + label.position[1], label.position[2])});
    }
    this.updateViewVisibility();
    this.applyTheme(this.themeMix);
    const direction = new THREE.Vector3(-concept.basis.inward[0] * 0.025, 1, -concept.basis.inward[1] * 0.025);
    const frame = this.fittedCamera(direction);
    this.animateCamera(frame.position, frame.target);
    this.topView = true;
    this.dirty = true;
    return concept;
  }

  setTop(enabled) {
    this.topView = enabled;
    const frame = this.fittedCamera(enabled ? new THREE.Vector3(0, 1, 0.0001) : HOME_DIRECTION);
    this.animateCamera(frame.position, frame.target);
  }

  zoom(amount) {
    const target = this.controls.target.clone();
    const displacement = this.camera.position.clone().sub(target).multiplyScalar(amount);
    displacement.clampLength(this.controls.minDistance ?? 20, this.controls.maxDistance ?? 840);
    this.animateCamera(target.clone().add(displacement), target);
  }

  reset() {
    this.select(null, false);
    this.topView = false;
    const frame = this.fittedCamera(HOME_DIRECTION);
    this.animateCamera(frame.position, frame.target);
  }

  animateCamera(position, target) {
    this.dirty = true;
    if (this.reduced) { this.camera.position.copy(position); this.controls.target.copy(target); this.controls.update(); return; }
    this.tween = { start: performance.now(), position: this.camera.position.clone(), target: this.controls.target.clone(), endPosition: position, endTarget: target };
  }

  pickAt(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (this.apartment) return this.raycaster.intersectObjects(this.apartment.pickables)[0];
    const candidates = [...this.buildings.values()].flatMap(building => {
      if (!building.group.visible) return [];
      if (building.exterior.visible) return building.exteriorPickables;
      return [
        ...building.pickables.filter(mesh => building.floorGroups[mesh.userData.floor]?.visible),
        ...building.interiorPickables.filter(mesh => mesh.userData.floor === this.activeFloor && building.floorGroups[mesh.userData.floor]?.visible && building.interiorGroups[mesh.userData.floor]?.visible),
      ];
    });
    const hits = this.raycaster.intersectObjects(candidates);
    // A door's slightly raised target wins over the room behind its threshold.
    return hits.find(hit => hit.object.userData.role === 'interior-opening') || hits[0];
  }

  setHovered(number) {
    if (this.hovered === number) return;
    const previous = this.hovered;
    this.hovered = number;
    this.dirty = true;
    for (const house of new Set([previous, number])) {
      const building = this.buildings.get(house);
      if (!building) continue;
      this.applyBuildingAppearance(building);
    }
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.dirty = true;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    let direction = this.tween ? this.tween.endPosition.clone().sub(this.tween.endTarget).normalize() :
      this.hasFitted ? this.camera.position.clone().sub(this.controls.target).normalize() : HOME_DIRECTION;
    const level = this.exploded && this.activeFloor !== null && getDisplayLevel(this.interiors, this.studies, this.selected, this.activeFloor);
    if (this.apartment && this.topView) direction = new THREE.Vector3(-this.apartment.concept.basis.inward[0] * 0.025, 1, -this.apartment.concept.basis.inward[1] * 0.025);
    else if (level?.isStudy && this.topView) direction = new THREE.Vector3(...studyPlanDirection(level, width < 700 && height > width));
    const frame = this.fittedCamera(direction);
    this.tween = null;
    this.camera.position.copy(frame.position);
    this.controls.target.copy(frame.target);
    this.controls.update();
    this.hasFitted = true;
  }

  bind() {
    let start;
    const activePointers = new Set();
    this.renderer.domElement.addEventListener('pointerdown', e => {
      activePointers.add(e.pointerId);
      start = activePointers.size === 1 && e.isPrimary && e.button === 0 ? { id: e.pointerId, x: e.clientX, y: e.clientY } : null;
    });
    this.renderer.domElement.addEventListener('pointercancel', e => {
      activePointers.delete(e.pointerId);
      start = null;
    });
    this.renderer.domElement.addEventListener('pointermove', e => {
      if (start?.id === e.pointerId && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) start.dragged = true;
      if (e.pointerType !== 'mouse' || e.buttons) return;
      this.mousePosition = { x: e.clientX, y: e.clientY };
      this.hoverDirty = true;
    });
    this.renderer.domElement.addEventListener('pointerleave', () => {
      this.mousePosition = null;
      this.hoverDirty = false;
      this.setHovered(null);
      this.renderer.domElement.style.cursor = this.isInteracting ? 'grabbing' : 'grab';
    });
    this.renderer.domElement.addEventListener('pointerup', e => {
      activePointers.delete(e.pointerId);
      const pressed = start;
      start = null;
      if (!pressed || pressed.dragged || pressed.id !== e.pointerId || e.button !== 0 || Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) > 5) return;
      const hit = this.pickAt(e.clientX, e.clientY);
      if (hit) {
        const { house, floor, spaceId, openingId } = hit.object.userData;
        if (spaceId) { this.openSpace({house, floor, spaceId, ...(openingId ? {openingId} : {})}); return; }
        if (house === this.selected && this.exploded) this.onFloor(floor);
        else this.onSelect(house);
      } else if (this.apartment) this.onFloor(this.activeFloor);
      else if (this.selected) this.onSelect(null);
    });
    this.container.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', 'Home'].includes(e.key)) return;
      e.preventDefault();
      this.dirty = true;
      this.tween = null;
      if (e.key === 'Home') { this.onSelect(null); return; }
      if (e.key === '+' || e.key === '-') { this.zoom(e.key === '+' ? 0.85 : 1.15); return; }
      const offset = this.camera.position.clone().sub(this.controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      if (e.key === 'ArrowLeft') spherical.theta -= 0.1;
      if (e.key === 'ArrowRight') spherical.theta += 0.1;
      if (e.key === 'ArrowUp') spherical.phi = Math.max(0.08, spherical.phi - 0.1);
      if (e.key === 'ArrowDown') spherical.phi = Math.min(Math.PI / 2.1, spherical.phi + 0.1);
      this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
      this.controls.update();
    });
    this.visibilityHandler = () => {
      this.renderer.setAnimationLoop(document.hidden ? null : () => this.render());
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.renderer.domElement.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      this.renderer.setAnimationLoop(null);
      document.dispatchEvent(new CustomEvent('rommel:webgl-lost'));
    });
  }

  dispose() {
    this.disposed = true;
    this.clearApartment();
    this.renderer.setAnimationLoop(null);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.scene.traverse(object => {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
      else object.material?.dispose();
    });
    this.dimensionLayer?.remove();
    this.renderer.dispose();
  }

  renderExteriorDimensions(occupied, width, height) {
    const building = this.buildings.get(this.selected);
    const runs = !this.apartment && this.exploded && this.activeFloor != null ? building?.floorDimensions?.[this.activeFloor] : null;
    if (!runs?.length) {
      this.dimensionLayer.style.display = 'none';
      return;
    }
    const key = `${this.selected}:${this.activeFloor}`;
    if (this.dimensionKey !== key) {
      this.dimensionKey = key;
      this.dimensionLayer.setAttribute('aria-label', runs.some(run => run.isLayoutOutline)
        ? 'Independent layout dimensions in metres. Rooms have separate clear dimensions and wall allowances.'
        : 'Exterior source-section lengths in metres. Zoom in to reveal smaller runs.');
      this.dimensionLayer.replaceChildren();
      this.dimensionNodes = new Map();
      for (const run of runs) {
        const make = tag => document.createElementNS('http://www.w3.org/2000/svg', tag);
        const group = make('g'), extensions = make('path'), line = make('path'), text = make('text'), title = make('title');
        group.dataset.dimensionLength = run.length.toFixed(6);
        group.dataset.dimensionEdge = run.id;
        extensions.classList.add('dimension-extensions');
        line.classList.add('dimension-line');
        text.textContent = run.label;
        title.textContent = run.note || `${run.label}, building-shell edge at an estimated floor height. Low-roof margins are unassigned; this is not a clear-room dimension.`;
        if (run.isStudyGuide) group.classList.add('dimension-study-guide');
        group.append(title, extensions, line, text);
        this.dimensionLayer.appendChild(group);
        this.dimensionNodes.set(run.id, {group, extensions, line, text});
      }
    }
    this.dimensionLayer.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const y = building.floorGroups[this.activeFloor].position.y + 0.025;
    const project = point => {
      const v = new THREE.Vector3(point[0], y, point[1]).project(this.camera);
      return [(v.x + 1) * width / 2, (1 - v.y) * height / 2, v.z];
    };
    const projected = runs.map(run => {
      const start = project(run.start), end = project(run.end);
      const midpoint = run.start.map((value, axis) => (value + run.end[axis]) / 2 + run.outward[axis]);
      return {...run, start: start.slice(0, 2), end: end.slice(0, 2), outwardPoint: project(midpoint).slice(0, 2), visible: [start, end].every(point => point[2] > -1 && point[2] < 1)};
    });
    const outlines = building.floorSections[this.activeFloor].polygons.map(polygon => polygon.outer.map(point => project(point).slice(0, 2)));
    const compact = width <= 700;
    const viewport = {
      left: compact ? 10 : 22, right: width - (compact ? 10 : 22),
      top: compact ? Math.min(148, height * 0.27) : width <= 1100 ? 164 : 140,
      bottom: height - (compact ? Math.min(196, height * 0.35) : 150),
    };
    const placements = layoutExteriorDimensions(projected, {viewport, occupied, outlines, compact});
    for (const {group} of this.dimensionNodes.values()) group.style.display = 'none';
    const path = segments => segments.map(([a, b]) => `M${a[0].toFixed(2)},${a[1].toFixed(2)}L${b[0].toFixed(2)},${b[1].toFixed(2)}`).join('');
    for (const placement of placements) {
      const {group, extensions, line, text} = this.dimensionNodes.get(placement.id);
      group.style.display = '';
      extensions.setAttribute('d', path(placement.extensionLines));
      line.setAttribute('d', path([placement.dimensionLine, ...placement.ticks]));
      text.setAttribute('transform', `translate(${placement.labelPoint[0].toFixed(2)} ${placement.labelPoint[1].toFixed(2)}) rotate(${placement.angle.toFixed(2)})`);
    }
    this.dimensionLayer.style.display = placements.length ? '' : 'none';
  }

  render() {
    if (this.container.offsetWidth === 0) return;
    let changed = this.dirty || Boolean(this.tween) || Boolean(this.themeTween) || Boolean(this.contextTween) || this.hoverDirty;
    this.dirty = false;
    if (this.tween) {
      const t = Math.min((performance.now() - this.tween.start) / TRANSITION_MS, 1);
      const eased = motionEase(t);
      this.camera.position.lerpVectors(this.tween.position, this.tween.endPosition, eased);
      this.controls.target.lerpVectors(this.tween.target, this.tween.endTarget, eased);
      if (t === 1) this.tween = null;
    }
    const now = performance.now();
    if (this.themeTween) {
      const t = Math.min((now - this.themeTween.start) / TRANSITION_MS, 1);
      this.applyTheme(this.themeTween.from + (this.themeTween.to - this.themeTween.from) * motionEase(t));
      if (t === 1) this.themeTween = null;
    }
    if (this.contextTween) {
      const t = Math.min((now - this.contextTween.start) / TRANSITION_MS, 1);
      this.applyContextMix(this.contextTween.from + (this.contextTween.to - this.contextTween.from) * motionEase(t));
      if (t === 1) this.contextTween = null;
    }
    for (const building of this.buildings.values()) if (advanceFloorMotion(building, now)) changed = true;
    if (this.controls.update()) changed = true;
    if (this.hoverDirty && !this.isInteracting && !this.tween) {
      this.hoverDirty = false;
      const hit = this.mousePosition && this.pickAt(this.mousePosition.x, this.mousePosition.y);
      this.setHovered(hit?.object.userData.house || null);
      this.renderer.domElement.style.cursor = hit ? 'pointer' : 'grab';
    }
    // Keep OrbitControls damping responsive without redrawing a static campus.
    if (!changed) return;
    const pixelsPerRadian = this.container.clientHeight / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)));
    for (const b of this.buildings.values()) {
      const distance = this.camera.position.distanceTo(new THREE.Vector3(b.data.centroid[0], b.data.baseY + b.data.height / 2, b.data.centroid[1]));
      const pitch = b.materialFamily === 'timber' ? FACADE_PROFILES.timber.spacing : FACADE_PROFILES.plates.courseHeight;
      const detail = THREE.MathUtils.smoothstep(pitch * pixelsPerRadian / distance, 0.8, 1.5);
      const active = b.data.number === this.selected, dim = this.selected && !active;
      b.facadeMaterials[0].opacity = detail * (dim ? 0.045 : active ? 0.22 : 0.16);
      b.facadeMaterials[1].opacity = (1 - detail) * (dim ? 0.045 : 0.2);
      b.facadeGroups[0].visible = detail > 0.005;
      b.facadeGroups[1].visible = detail < 0.995;
    }
    this.renderer.render(this.scene, this.camera);
    const { width, height } = this.container.getBoundingClientRect();
    const occupied = [];
    // Selected label gets first priority when labels collide.
    const sorted = [...this.labels].sort((a, b) => Number(b.number === this.selected) - Number(a.number === this.selected));
    const projected = sorted.map(label => {
      const v = label.getPosition().project(this.camera);
      const x = (v.x + 1) * width / 2, y = (-v.y + 1) * height / 2;
      let visible = v.z > -1 && v.z < 1 && x > 35 && x < width - 35 && y > 45 && y < height - 80;
      if (!this.labelInCurrentView(label)) visible = false;
      if (this.community && label.type === 'house' && sorted.some(l => l.type === 'club' && l.number === label.number)) visible = false;
      label.el.hidden = !visible;
      return {label, x, y, visible};
    });
    // Measure together before writing positions: text length and icon targets
    // must participate in collisions, not just a fixed distance between anchors.
    const measured = projected.map(item => ({...item, w: item.visible ? item.label.el.offsetWidth : 0, h: item.visible ? item.label.el.offsetHeight : 0}));
    for (const {label, x, y, w, h, visible: eligible} of measured) {
      let visible = eligible;
      const bounds = {left: x - w / 2, right: x + w / 2, top: y - h, bottom: y};
      if (bounds.left < 10 || bounds.right > width - 10) visible = false;
      if (visible && label.type !== 'context') {
        if (occupied.some(p => bounds.left < p.right + 3 && bounds.right > p.left - 3 && bounds.top < p.bottom + 3 && bounds.bottom > p.top - 3)) visible = false;
        else occupied.push(bounds);
      }
      label.el.hidden = !visible;
      if (visible) label.el.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
    }
    this.renderExteriorDimensions(occupied, width, height);
  }
}

export function fallbackMap(container, campus, onSelect) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '-140 -115 260 240');
  svg.classList.add('fallback-map');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Two-dimensional campus map. Tab to a house and press Enter or Space to explore it.');
  svg.addEventListener('click', event => {
    if (event.target === svg && event.button === 0) onSelect(null);
  });
  for (const b of campus.buildings) {
    const polygon = document.createElementNS(ns, 'polygon');
    polygon.setAttribute('points', b.footprint.map(p => p.join(',')).join(' '));
    polygon.setAttribute('fill', b.color);
    polygon.setAttribute('fill-opacity', '.18');
    polygon.setAttribute('stroke', '#a8aaa3');
    polygon.setAttribute('stroke-width', '.6');
    polygon.setAttribute('tabindex', '0');
    polygon.setAttribute('role', 'button');
    polygon.setAttribute('aria-label', `Explore House ${b.number}, ${b.name}`);
    polygon.addEventListener('click', () => onSelect(b.number));
    polygon.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        onSelect(b.number);
      }
    });
    const title = document.createElementNS(ns, 'title');
    title.textContent = b.address;
    polygon.appendChild(title);
    svg.appendChild(polygon);
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', b.centroid[0]); text.setAttribute('y', b.centroid[1]);
    text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-size', '5');
    text.setAttribute('fill', '#dfdfd5');
    text.setAttribute('pointer-events', 'none');
    text.textContent = b.number;
    svg.appendChild(text);
  }
  container.replaceChildren(svg);
}
