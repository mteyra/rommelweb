import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getInteriorLevel, getLevelElevations } from './interiors.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createFacadeSegments, createStoreyJointSegments, FACADE_PROFILES } from './facade.js';
import { floorSection, triangulateSection } from './sections.js';

const PAPER = 0x151715;
const INK = 0xa8aaa3;
const ACTIVE_INK = 0xdfdfd5;
const HOME_DIRECTION = new THREE.Vector3(0.85, 1.05, 1).normalize();
const HOME_TARGET = new THREE.Vector3(-3, 11, -7);

/** Clockwise bearings, zero geographic north; view-relative angles zero screen-up. */
export function navigationDirections(origin, buildings, heading, excludedNumber = null) {
  return buildings.filter(building => building.number !== excludedNumber).map(building => {
    const dx = building.centroid[0] - origin[0], dz = building.centroid[1] - origin[1];
    const bearing = (Math.atan2(dx, -dz) + Math.PI * 2) % (Math.PI * 2);
    const angle = Math.atan2(Math.sin(bearing - heading), Math.cos(bearing - heading));
    return { number: building.number, angle, distance: Math.hypot(dx, dz), bearing };
  }).sort((a, b) => a.distance - b.distance);
}

export class CampusScene {
  constructor(container, labels, campus, lod2, interiors, onSelect, onFloor) {
    this.container = container;
    this.labelsElement = labels;
    this.campus = campus;
    this.lod2 = lod2;
    this.interiors = interiors;
    this.onSelect = onSelect;
    this.onFloor = onFloor;
    this.buildings = new Map();
    this.labels = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(PAPER);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.scene = new THREE.Scene();
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
    this.controls.addEventListener('start', () => { this.tween = null; });
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
    this.campusCenter = this.campusBounds.getCenter(new THREE.Vector3());
    this.addGeographicLabels();
    this.bind();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.render());
  }

  makeGround() {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1800, 1800), new THREE.MeshBasicMaterial({ color: PAPER }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.35;
    ground.userData.role = 'minimal-ground';
    this.scene.add(ground);
    const radius = 127;
    const points = Array.from({ length: 161 }, (_, i) => [Math.sin(i * Math.PI * 2 / 160) * radius, -0.3, Math.cos(i * Math.PI * 2 / 160) * radius]);
    this.line(points, 0x676963, 0.14);
    for (let i = 0; i < 4; i++) {
      const angle = i * Math.PI / 2;
      this.line([[Math.sin(angle) * (radius - 1.5), -0.29, Math.cos(angle) * (radius - 1.5)], [Math.sin(angle) * (radius + 1.5), -0.29, Math.cos(angle) * (radius + 1.5)]], INK, 0.3);
    }
  }

  makePaths() {
    this.paths = new THREE.Group();
    this.paths.userData = { role: 'OSM-streets-and-paths', source: 'OpenStreetMap contributors, ODbL', elevationStatus: 'Flat display plane; terrain height unavailable.' };
    this.pathCount = 0;
    for (const path of this.campus.context) {
      if (path.kind !== 'path' || !path.tags.highway || path.tags.indoor === 'yes') continue;
      const mappedWidth = Number(path.tags.width);
      const road = ['residential', 'service', 'unclassified'].includes(path.tags.highway);
      const metadata = { role: 'sourced-path', osmId: path.id, source: path.osmUrl, highway: path.tags.highway, name: path.tags.name || null };
      if (Number.isFinite(mappedWidth) && mappedWidth > 0 && mappedWidth <= 30) {
        const positions = [], edges = [];
        for (let i = 1; i < path.points.length; i++) {
          const a = path.points[i - 1], b = path.points[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (length < 0.001) continue;
          const dx = -(b[1] - a[1]) / length * mappedWidth / 2, dz = (b[0] - a[0]) / length * mappedWidth / 2;
          const leftA = [a[0] + dx, -0.27, a[1] + dz], rightA = [a[0] - dx, -0.27, a[1] - dz];
          const leftB = [b[0] + dx, -0.27, b[1] + dz], rightB = [b[0] - dx, -0.27, b[1] - dz];
          positions.push(...leftA, ...rightA, ...leftB, ...rightA, ...rightB, ...leftB);
          edges.push(...leftA, ...leftB, ...rightA, ...rightB);
        }
        const ribbon = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)),
          new THREE.MeshBasicMaterial({ color: road ? 0x555754 : 0x66665f, transparent: true, opacity: road ? 0.27 : 0.17, side: THREE.DoubleSide, depthWrite: false }));
        ribbon.userData = { ...metadata, mappedWidth };
        const outline = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(edges, 3)),
          new THREE.LineBasicMaterial({ color: 0x7a7d75, transparent: true, opacity: road ? 0.19 : 0.13, depthWrite: false }));
        this.paths.add(ribbon, outline);
      } else {
        const centerline = this.line(path.points.map(([x, z]) => [x, -0.26, z]), 0x7b7c74, road ? 0.26 : 0.23, this.paths);
        centerline.userData = { ...metadata, widthStatus: 'Unknown; centerline only.' };
      }
      this.pathCount++;
    }
    this.scene.add(this.paths);
  }


  line(points, color = INK, opacity = 1, group = this.scene) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p => new THREE.Vector3(...p))),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
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
    for (const surface of official.surfaces) {
      const outer = surface.points.slice(0, -1).map(p => new THREE.Vector3(...p));
      if (outer.length < 3) continue;
      const normal = new THREE.Vector3();
      for (let i = 0; i < outer.length; i++) {
        const a = outer[i], b = outer[(i + 1) % outer.length];
        normal.x += (a.y - b.y) * (a.z + b.z);
        normal.y += (a.z - b.z) * (a.x + b.x);
        normal.z += (a.x - b.x) * (a.y + b.y);
      }
      const axis = Math.abs(normal.x) > Math.abs(normal.y) && Math.abs(normal.x) > Math.abs(normal.z) ? 'x' : Math.abs(normal.y) > Math.abs(normal.z) ? 'y' : 'z';
      const project = p => axis === 'x' ? new THREE.Vector2(p.y, p.z) : axis === 'y' ? new THREE.Vector2(p.x, p.z) : new THREE.Vector2(p.x, p.y);
      const holes = (surface.holes || []).map(h => h.slice(0, -1).map(p => new THREE.Vector3(...p)));
      const indices = THREE.ShapeUtils.triangulateShape(outer.map(project), holes.map(h => h.map(project))).flat();
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([...outer, ...holes.flat()].flatMap(v => [v.x, v.y, v.z]), 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      if (!geometries.has(surface.type)) geometries.set(surface.type, []);
      geometries.get(surface.type).push(geometry);
      for (const ring of [surface.points, ...(surface.holes || [])]) {
        for (let i = 0; i < ring.length - 1; i++) {
          const a = ring[i], b = ring[i + 1];
          const key = [a.join(','), b.join(',')].sort().join('|');
          edges.set(key, [a, b]);
        }
      }
      detailSegments.push(...createFacadeSegments(surface, family, 1));
      distantSegments.push(...createFacadeSegments(surface, family, 4));
      if (family === 'timber') jointSegments.push(...createStoreyJointSegments(surface, floorElevations.slice(1).map(elevation => data.baseY + elevation)));
    }
    // Batch by material while preserving every official source vertex/triangle.
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
    const facadeGroups = [];
    const facadeMaterials = [];
    for (const [index, segments] of [detailSegments, distantSegments].entries()) {
      const material = new THREE.LineBasicMaterial({ color: family === 'timber' ? 0x968575 : 0x9b8e7f, transparent: true, opacity: index ? 0.2 : 0.16, depthWrite: false, vertexColors: family === 'plates' });
      const hatchGeometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(segments.flat(2), 3));
      if (family === 'plates') {
        // Photographs show dominant horizontal courses; vertical plate joints are faint.
        hatchGeometry.setAttribute('color', new THREE.Float32BufferAttribute(segments.flatMap(([a, b]) => {
          const brightness = Math.abs(a[1] - b[1]) > 0.0001 ? (index ? 0.07 : 0.24) : 1;
          return Array(6).fill(brightness);
        }), 3));
      }
      const hatch = new THREE.LineSegments(hatchGeometry, material);
      hatch.renderOrder = 1;
      hatch.userData = { role: 'schematic-material-hatching', ...FACADE_PROFILES[family], segmentCount: segments.length };
      hatch.visible = index === 1;
      exterior.add(hatch);
      facadeGroups.push(hatch);
      facadeMaterials.push(material);
    }
    const jointMaterial = new THREE.LineBasicMaterial({ color: 0xa49783, transparent: true, opacity: 0.34, depthWrite: false });
    const joints = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(jointSegments.flat(2), 3)), jointMaterial);
    joints.renderOrder = 2;
    joints.userData = {
      role: 'schematic-storey-joints', segmentCount: jointSegments.length,
      source: FACADE_PROFILES.timber.source,
      status: 'Photo-informed horizontal joints at provisional floor elevations, not measured facade features.',
    };
    exterior.add(joints);
    group.add(exterior);
    const floorGroups = [];
    const fillMaterials = [];
    const lineMaterials = [];
    const pickables = [];
    const interiorGroups = [];
    const floorSections = [];
    for (let floor = 0; floor < data.levels; floor++) {
      const slab = new THREE.Group();
      const section = floorSection(official, floorElevations[floor]);
      floorSections.push(section);
      const triangles = triangulateSection(section, 0);
      const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(triangles.flat(2), 3));
      geometry.computeVertexNormals();
      const material = new THREE.MeshBasicMaterial({ color: 0x777a75, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { house: data.number, floor, role: 'source-envelope-section', sourceId: official.id, sectionStatus: section.sourceStatus, sampleElevation: section.sampleElevation };
      slab.add(mesh);
      const lineMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.68 });
      const boundary = section.polygons.flatMap(polygon => [polygon.outer, ...polygon.holes]).flatMap(ring =>
        ring.slice(1).flatMap((point, i) => [[ring[i][0], 0.005, ring[i][1]], [point[0], 0.005, point[1]]]));
      const edges = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(boundary.flat(), 3)), lineMat);
      slab.add(edges);
      slab.position.y = data.baseY + floorElevations[floor];
      const interior = new THREE.Group();
      const approved = getInteriorLevel(this.interiors, data.number, floor);
      for (const space of approved?.spaces || []) {
        this.line(space.polygon.map(([x, z]) => [x, 0.06, z]), space.kind === 'room' ? ACTIVE_INK : 0xb6a886, 1, interior);
        const el = document.createElement('span');
        el.className = 'room-label';
        el.textContent = space.label;
        this.labelsElement.appendChild(el);
        const points = space.polygon.slice(0, -1);
        const center = points.reduce((sum, [x, z]) => [sum[0] + x / points.length, sum[1] + z / points.length], [0, 0]);
        this.labels.push({ el, getPosition: () => new THREE.Vector3(center[0], slab.position.y + 0.25, center[1]), type: 'room', number: data.number, floor });
      }
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
    this.labelsElement.appendChild(el);
    const record = { data, group, floorGroups, floorElevations, floorSections, interiorGroups, fillMaterials, lineMaterials, pickables, exterior, exteriorFills, exteriorLines, exteriorPickables, facadeGroups, facadeMaterials, jointMaterial, joints, label: el, currentGap: 0, targetGap: 0 };
    this.buildings.set(data.number, record);
    this.labels.push({ el, getPosition: () => new THREE.Vector3(data.centroid[0], (this.exploded && this.selected === data.number ? floorElevations.at(-1) : data.height) + data.baseY + record.currentGap * (data.levels - 1) + 3, data.centroid[1]), type: 'house', number: data.number });
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
    if (this.exploded) return new THREE.Box3().setFromPoints(this.focusPoints());
    const b = this.buildings.get(this.selected);
    const bounds = new THREE.Box3();
    for (const [x, z] of b.data.footprint) {
      bounds.expandByPoint(new THREE.Vector3(x, b.data.baseY, z));
      bounds.expandByPoint(new THREE.Vector3(x, b.data.baseY + b.data.height + (this.exploded ? 5 * (b.data.levels - 1) : 0), z));
    }
    return bounds;
  }

  focusPoints() {
    if (this.selected && this.exploded) {
      const building = this.buildings.get(this.selected);
      return building.floorSections.flatMap((section, floor) => section.polygons.flatMap(polygon => polygon.outer.map(([x, z]) =>
        new THREE.Vector3(x, building.data.baseY + building.floorElevations[floor] + 5 * floor, z))));
    }
    return this.lod2.buildings.filter(building => !this.selected || building.number === this.selected)
      .flatMap(building => building.surfaces.flatMap(surface => surface.points.map(point => new THREE.Vector3(...point))));
  }

  fittedCamera(direction = HOME_DIRECTION, padding = this.selected ? 1.38 : 1.2) {
    const bounds = this.focusBounds();
    const target = bounds.getCenter(new THREE.Vector3());
    const outward = direction.clone().normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), outward).normalize();
    if (right.lengthSq() < 0.5) right.set(1, 0, 0);
    const up = new THREE.Vector3().crossVectors(outward, right).normalize();
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const tanH = tanV * this.camera.aspect;
    let distance = 24;
    const points = this.focusPoints?.() || [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y => [bounds.min.z, bounds.max.z].map(z => new THREE.Vector3(x, y, z))));
    for (const point of points) {
      const corner = point.clone().sub(target);
      distance = Math.max(distance, corner.dot(outward) + padding * Math.abs(corner.dot(right)) / tanH,
        corner.dot(outward) + padding * Math.abs(corner.dot(up)) / tanV);
    }
    return { target, position: target.clone().addScaledVector(outward, Math.min(distance, 840)) };
  }

  navigationSnapshot() {
    const horizontal = this.controls.target.clone().sub(this.camera.position);
    const heading = (Math.atan2(horizontal.x, -horizontal.z) + Math.PI * 2) % (Math.PI * 2);
    const selected = this.selected ? this.buildings.get(this.selected)?.data : null;
    const origin = selected?.centroid || [this.campusCenter.x, this.campusCenter.z];
    const point = new THREE.Vector3(origin[0], selected?.baseY || 0, origin[1]).project(this.camera);
    const { width, height } = this.container.getBoundingClientRect();
    return {
      heading, originNumber: this.selected || null,
      anchor: { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2, visible: point.z > -1 && point.z < 1 && Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 },
      directions: navigationDirections(origin, this.campus.buildings, heading, this.selected),
    };
  }

  setNavigationListener(listener) {
    if (listener != null && typeof listener !== 'function') throw new Error('Navigation listener must be a function or null');
    this.navigationListener = listener;
    if (listener) listener(this.navigationSnapshot());
  }

  renderingSummary() {
    return { buildings: this.buildings.size, officialSurfaces: this.lod2.buildings.reduce((sum, b) => sum + b.surfaces.length, 0),
      facadeSegments: [...this.buildings.values()].reduce((sum, b) => sum + b.facadeGroups[0].userData.segmentCount, 0),
      storeyJointSegments: [...this.buildings.values()].reduce((sum, b) => sum + b.joints.userData.segmentCount, 0),
      sourcePaths: this.pathCount,
      floorSections: [...this.buildings.values()].map(b => ({ number: b.data.number, areas: b.floorSections.map(section => section.area), openChains: b.floorSections.reduce((sum, section) => sum + section.openChains.length, 0) })),
      contextBoxes: 0, trees: 0, units: 'metres', facadeStatus: 'Photo-informed schematic material marks; no invented windows or room boundaries' };
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
    this.dirty = true;
    this.selected = number;
    this.exploded = false;
    this.activeFloor = null;
    for (const [num, building] of this.buildings) {
      const active = num === number, dim = number && !active;
      building.targetGap = 0;
      building.exterior.visible = true;
      building.floorGroups.forEach(f => { f.visible = false; });
      building.exteriorLines.forEach(m => { m.color.set(active ? ACTIVE_INK : INK); m.opacity = dim ? 0.2 : active ? 0.98 : 0.76; });
      building.exteriorFills.forEach(m => { m.opacity = dim ? 0.16 : m.userData.role === 'RoofSurface' ? 0.72 : active ? 0.65 : 0.54; });
      building.facadeMaterials.forEach((m, index) => { m.opacity = dim ? 0.045 : index ? 0.2 : active ? 0.22 : 0.16; });
      building.jointMaterial.opacity = dim ? 0.07 : active ? 0.46 : 0.34;
      building.label.classList.toggle('selected', active);
      building.label.classList.toggle('muted', Boolean(dim));
      building.lineMaterials.forEach(m => { m.color.set(active ? ACTIVE_INK : INK); m.opacity = dim ? 0.2 : 0.72; });
      building.fillMaterials.forEach(m => { m.opacity = active ? 0.21 : dim ? 0.035 : 0.11; });
    }
    if (focus && number) {
      const direction = this.camera.position.clone().sub(this.controls.target).normalize();
      if (!this.topView) direction.y = Math.max(direction.y, 0.48);
      const frame = this.fittedCamera(direction.normalize());
      this.animateCamera(frame.position, frame.target);
    } else if (focus) this.reset();
  }

  explode(enabled) {
    if (!this.selected) return;
    this.dirty = true;
    this.exploded = enabled;
    const b = this.buildings.get(this.selected);
    b.targetGap = enabled ? 5 : 0;
    b.exterior.visible = !enabled;
    b.floorGroups.forEach(f => { f.visible = enabled; });
    const direction = this.topView ? new THREE.Vector3(0, 1, 0.0001) : this.camera.position.clone().sub(this.controls.target).normalize();
    const frame = this.fittedCamera(direction, enabled ? 1.3 : 1.38);
    this.animateCamera(frame.position, frame.target);
  }

  setFloor(floor) {
    this.dirty = true;
    this.activeFloor = floor;
    if (!this.selected) return;
    const b = this.buildings.get(this.selected);
    b.fillMaterials.forEach((m, i) => { m.opacity = floor == null ? 0.21 : floor === i ? 0.38 : 0.045; });
    b.lineMaterials.forEach((m, i) => { m.opacity = floor == null || floor === i ? 0.9 : 0.2; });
    b.interiorGroups.forEach((group, i) => { group.visible = floor === i; });
  }

  setTop(enabled) {
    this.topView = enabled;
    const frame = this.fittedCamera(enabled ? new THREE.Vector3(0, 1, 0.0001) : HOME_DIRECTION);
    this.animateCamera(frame.position, frame.target);
  }

  zoom(amount) {
    const target = this.controls.target.clone();
    const displacement = this.camera.position.clone().sub(target).multiplyScalar(amount);
    displacement.clampLength(20, 840);
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

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    this.dirty = true;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    const direction = this.hasFitted ? this.camera.position.clone().sub(this.controls.target).normalize() : HOME_DIRECTION;
    const frame = this.fittedCamera(direction);
    this.tween = null;
    this.camera.position.copy(frame.position);
    this.controls.target.copy(frame.target);
    this.controls.update();
    this.hasFitted = true;
  }

  bind() {
    let start;
    this.renderer.domElement.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY }; });
    this.renderer.domElement.addEventListener('pointerup', e => {
      if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects([...this.buildings.values()].flatMap(b => b.exterior.visible ? b.exteriorPickables : b.pickables))[0];
      if (hit) {
        const { house, floor } = hit.object.userData;
        if (house === this.selected && this.exploded) this.onFloor(floor);
        else this.onSelect(house);
      }
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
    this.renderer.setAnimationLoop(null);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.scene.traverse(object => {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
      else object.material?.dispose();
    });
    this.renderer.dispose();
  }

  render() {
    if (this.container.offsetWidth === 0) return;
    let changed = this.dirty || Boolean(this.tween);
    this.dirty = false;
    if (this.tween) {
      const t = Math.min((performance.now() - this.tween.start) / 650, 1);
      const eased = 1 - (1 - t) ** 3;
      this.camera.position.lerpVectors(this.tween.position, this.tween.endPosition, eased);
      this.controls.target.lerpVectors(this.tween.target, this.tween.endTarget, eased);
      if (t === 1) this.tween = null;
    }
    for (const b of this.buildings.values()) {
      if (b.currentGap !== b.targetGap) {
        changed = true;
        b.currentGap = Math.abs(b.targetGap - b.currentGap) < 0.002 ? b.targetGap : b.currentGap + (b.targetGap - b.currentGap) * (this.reduced ? 1 : 0.12);
        b.floorGroups.forEach((floor, i) => { floor.position.y = b.data.baseY + b.floorElevations[i] + i * b.currentGap; });
      }
    }
    if (this.controls.update()) changed = true;
    // Keep OrbitControls damping responsive without redrawing a static campus.
    if (!changed) return;
    for (const b of this.buildings.values()) {
      const distance = this.camera.position.distanceTo(new THREE.Vector3(b.data.centroid[0], b.data.baseY + b.data.height / 2, b.data.centroid[1]));
      b.facadeGroups[0].visible = distance < 150;
      b.facadeGroups[1].visible = distance >= 150;
    }
    this.renderer.render(this.scene, this.camera);
    const { width, height } = this.container.getBoundingClientRect();
    const occupied = [];
    // Selected label gets first priority when labels collide.
    const sorted = [...this.labels].sort((a, b) => Number(b.number === this.selected) - Number(a.number === this.selected));
    for (const label of sorted) {
      const v = label.getPosition().project(this.camera);
      const x = (v.x + 1) * width / 2, y = (-v.y + 1) * height / 2;
      let visible = v.z > -1 && v.z < 1 && x > 35 && x < width - 35 && y > 45 && y < height - 80;
      if (this.selected && label.type === 'context') visible = false;
      if (label.type === 'room' && (!this.exploded || label.number !== this.selected || label.floor !== this.activeFloor)) visible = false;
      if (this.community && label.type === 'house' && sorted.some(l => l.type === 'club' && l.number === label.number)) visible = false;
      if (visible && label.type !== 'context') {
        if (occupied.some(p => Math.abs(p.x - x) < 64 && Math.abs(p.y - y) < 29)) visible = false;
        else occupied.push({ x, y });
      }
      label.el.hidden = !visible;
      if (visible) label.el.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`;
    }
    const snapshot = this.navigationSnapshot();
    this.container.dispatchEvent(new CustomEvent('rommel:camera', { detail: snapshot }));
    this.navigationListener?.(snapshot);
    const arrow = document.getElementById('north-arrow');
    if (arrow) {
      arrow.style.transform = `rotate(${-snapshot.heading}rad)`;
      arrow.style.transformOrigin = '50% 50%';
    }
  }
}

export function fallbackMap(container, campus, onSelect) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '-140 -115 260 240');
  svg.classList.add('fallback-map');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Two-dimensional map of the eleven dorm footprints. Select houses using the directory.');
  for (const b of campus.buildings) {
    const polygon = document.createElementNS(ns, 'polygon');
    polygon.setAttribute('points', b.footprint.map(p => p.join(',')).join(' '));
    polygon.setAttribute('fill', b.color);
    polygon.setAttribute('fill-opacity', '.18');
    polygon.setAttribute('stroke', '#a8aaa3');
    polygon.setAttribute('stroke-width', '.6');
    polygon.addEventListener('click', () => onSelect(b.number));
    const title = document.createElementNS(ns, 'title');
    title.textContent = b.address;
    polygon.appendChild(title);
    svg.appendChild(polygon);
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', b.centroid[0]); text.setAttribute('y', b.centroid[1]);
    text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-size', '5');
    text.setAttribute('fill', '#dfdfd5');
    text.textContent = b.number;
    svg.appendChild(text);
  }
  container.replaceChildren(svg);
}
