import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getInteriorLevel, getLevelElevations } from './interiors.js';

const PAPER = 0xf0f2e9;
const INK = 0x365b50;
const HOME = new THREE.Vector3(190, 205, 235);
const HOME_TARGET = new THREE.Vector3(-8, 0, -9);

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
    this.scene.fog = new THREE.Fog(PAPER, 370, 730);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 1300);
    this.camera.position.copy(HOME);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(HOME_TARGET);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.maxPolarAngle = Math.PI / 2.08;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 600;
    this.controls.enablePan = true;
    this.controls.addEventListener('start', () => { this.tween = null; });
    this.scene.add(new THREE.AmbientLight(0xffffff, 2.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2);
    sun.position.set(-100, 180, 70);
    this.scene.add(sun);
    this.makeGround();
    this.makeContext();
    for (const building of campus.buildings) this.makeBuilding(building);
    this.addGeographicLabels();
    this.bind();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.render());
  }

  makeGround() {
    const grid = new THREE.GridHelper(600, 120, 0xc3cdc0, 0xd9dfd1);
    grid.material.transparent = true;
    grid.material.opacity = 0.38;
    grid.position.y = -0.2;
    this.scene.add(grid);
    const border = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-140, 0, -130), new THREE.Vector3(130, 0, -130),
      new THREE.Vector3(130, 0, 130), new THREE.Vector3(-140, 0, 130),
    ]), new THREE.LineDashedMaterial({ color: 0xa6b7a8, dashSize: 2, gapSize: 2 }));
    border.computeLineDistances();
    this.scene.add(border);
  }

  footprintShape(points) {
    const shape = new THREE.Shape();
    points.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z));
    shape.closePath();
    return shape;
  }

  extrude(points, height) {
    const geometry = new THREE.ExtrudeGeometry(this.footprintShape(points), { depth: height, bevelEnabled: false, steps: 1 });
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }

  makeContext() {
    const treeMaterial = new THREE.LineBasicMaterial({ color: 0x99af89, transparent: true, opacity: 0.32 });
    const treeGeometry = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(3.7, 0));
    for (const item of this.campus.context) {
      if (item.kind === 'tree') {
        const [x, z] = item.points;
        if (Math.abs(x) > 140 || Math.abs(z) > 130) continue;
        const tree = new THREE.LineSegments(treeGeometry, treeMaterial);
        tree.position.set(x, 4.2, z);
        tree.scale.y = 1.35;
        this.scene.add(tree);
        this.line([[x, 0, z], [x, 3.4, z]], 0xb0bca4, 0.45);
      } else if (item.kind === 'building') {
        const pts = item.points;
        if (!Array.isArray(pts?.[0]) || pts.some(([x, z]) => Math.abs(x) > 160 || Math.abs(z) > 155)) continue;
        const geometry = this.extrude(pts, Number(item.tags?.['building:levels'] || 2) * 3);
        const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xdde4d7, transparent: true, opacity: 0.25, depthWrite: false }));
        const lines = new THREE.LineSegments(new THREE.EdgesGeometry(geometry), new THREE.LineBasicMaterial({ color: 0xa6b5a2, transparent: true, opacity: 0.25 }));
        this.scene.add(mesh, lines);
      } else if (Array.isArray(item.points?.[0])) {
        const pts = item.points;
        const valid = pts.filter(([x, z]) => Math.abs(x) < 170 && Math.abs(z) < 155);
        if (valid.length < 2 || valid.length !== pts.length) continue;
        const road = ['residential', 'service', 'tertiary'].includes(item.tags?.highway);
        this.line(valid.map(([x, z]) => [x, 0.08, z]), road ? 0x82988b : 0xb5c0ae, road ? 0.45 : 0.5);
      }
    }
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
    const exteriorFills = [], exteriorLines = [], exteriorPickables = [];
    for (const surface of official.surfaces) {
      const outer = surface.points.slice(0, -1).map(p => new THREE.Vector3(...p));
      if (outer.length < 3) continue;
      // Project each planar CityGML surface onto its strongest normal axis,
      // triangulate the concave contour, then restore original 3D coordinates.
      const normal = new THREE.Vector3();
      for (let i = 0; i < outer.length; i++) {
        const a = outer[i], b = outer[(i + 1) % outer.length];
        normal.x += (a.y - b.y) * (a.z + b.z);
        normal.y += (a.z - b.z) * (a.x + b.x);
        normal.z += (a.x - b.x) * (a.y + b.y);
      }
      const axis = Math.abs(normal.x) > Math.abs(normal.y) && Math.abs(normal.x) > Math.abs(normal.z) ? 'x' :
        Math.abs(normal.y) > Math.abs(normal.z) ? 'y' : 'z';
      const project = p => axis === 'x' ? new THREE.Vector2(p.y, p.z) : axis === 'y' ? new THREE.Vector2(p.x, p.z) : new THREE.Vector2(p.x, p.y);
      const holes = (surface.holes || []).map(h => h.slice(0, -1).map(p => new THREE.Vector3(...p)));
      const indices = THREE.ShapeUtils.triangulateShape(outer.map(project), holes.map(h => h.map(project))).flat();
      const all = [...outer, ...holes.flat()];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(all.flatMap(v => [v.x, v.y, v.z]), 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      const fill = new THREE.MeshBasicMaterial({ color: surface.type === 'RoofSurface' ? 0xc6d9bd : data.color, side: THREE.DoubleSide, transparent: true, opacity: surface.type === 'RoofSurface' ? 0.22 : 0.15, depthWrite: false });
      const mesh = new THREE.Mesh(geometry, fill);
      mesh.userData = { house: data.number, floor: null };
      exterior.add(mesh);
      exteriorFills.push(fill);
      exteriorPickables.push(mesh);
      for (const ring of [surface.points, ...(surface.holes || [])]) {
        const line = this.line(ring, INK, 0.8, exterior);
        exteriorLines.push(line.material);
      }
    }
    group.add(exterior);
    const floorGroups = [];
    const fillMaterials = [];
    const lineMaterials = [];
    const pickables = [];
    const floorElevations = getLevelElevations(this.interiors, data.number, data.levels, data.height);
    const interiorGroups = [];
    const shadow = new THREE.Mesh(new THREE.ShapeGeometry(this.footprintShape(data.footprint)),
      new THREE.MeshBasicMaterial({ color: 0x627861, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(1.8, 0.025, 1.8);
    group.add(shadow);
    for (let floor = 0; floor < data.levels; floor++) {
      const slab = new THREE.Group();
      const geometry = this.extrude(data.footprint, (floorElevations[floor + 1] ?? data.height) - floorElevations[floor]);
      const material = new THREE.MeshBasicMaterial({ color: data.color, transparent: true, opacity: 0.11, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData = { house: data.number, floor };
      slab.add(mesh);
      const lineMat = new THREE.LineBasicMaterial({ color: INK, transparent: true, opacity: 0.68 });
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 12), lineMat);
      slab.add(edges);
      slab.position.y = data.baseY + floorElevations[floor] + 0.15;
      const interior = new THREE.Group();
      const approved = getInteriorLevel(this.interiors, data.number, floor);
      for (const space of approved?.spaces || []) {
        this.line(space.polygon.map(([x, z]) => [x, 0.06, z]), space.kind === 'room' ? 0x194c3c : 0x8c7152, 1, interior);
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
    const record = { data, group, floorGroups, floorElevations, interiorGroups, fillMaterials, lineMaterials, pickables, exterior, exteriorFills, exteriorLines, exteriorPickables, label: el, currentGap: 0, targetGap: 0 };
    this.buildings.set(data.number, record);
    this.labels.push({ el, getPosition: () => new THREE.Vector3(data.centroid[0], data.height + data.baseY + record.currentGap * (data.levels - 1) + 3, data.centroid[1]), type: 'house', number: data.number });
  }

  addGeographicLabels() {
    for (const [text, x, z, cls] of [
      ['ERWIN-ROMMEL-STRASSE', -109, -8, 'road-label'],
      ['TOWARDS TECHFAK ↙', -85, 101, 'place-label'],
      ['AT THE EDGE OF THE FOREST', 90, -115, 'place-label'],
    ]) {
      const el = document.createElement('span');
      el.className = cls;
      el.textContent = text;
      this.labelsElement.appendChild(el);
      this.labels.push({ el, getPosition: () => new THREE.Vector3(x, 0, z), type: 'context' });
    }
  }

  setCommunity(enabled, clubs) {
    this.dirty = true;
    this.community = enabled;
    for (const l of this.labels.filter(l => l.type === 'club')) l.el.remove();
    this.labels = this.labels.filter(l => l.type !== 'club');
    if (!enabled) return;
    clubs.filter(c => c.house).forEach(club => {
      const building = this.buildings.get(club.house);
      const el = document.createElement('button');
      el.className = 'club-label';
      el.textContent = club.title;
      el.addEventListener('click', () => this.onSelect(club.house));
      this.labelsElement.appendChild(el);
      this.labels.push({ el, getPosition: () => new THREE.Vector3(building.data.centroid[0], building.data.baseY + building.data.height + building.currentGap * (building.data.levels - 1) + 11, building.data.centroid[1]), type: 'club', number: club.house });
    });
  }

  select(number, focus = true) {
    this.dirty = true;
    this.selected = number;
    this.exploded = false;
    this.activeFloor = null;
    for (const [num, building] of this.buildings) {
      const active = num === number, dim = number && !active;
      building.targetGap = 0;
      building.exterior.visible = true;
      building.floorGroups.forEach(f => { f.visible = false; });
      building.exteriorLines.forEach(m => { m.color.set(active ? 0x194c3c : INK); m.opacity = dim ? 0.22 : 0.78; });
      building.exteriorFills.forEach(m => { m.opacity = active ? 0.28 : dim ? 0.05 : 0.16; });
      building.label.classList.toggle('selected', active);
      building.label.classList.toggle('muted', Boolean(dim));
      building.lineMaterials.forEach(m => { m.color.set(active ? 0x194c3c : INK); m.opacity = dim ? 0.2 : 0.72; });
      building.fillMaterials.forEach(m => { m.opacity = active ? 0.21 : dim ? 0.035 : 0.11; });
    }
    if (focus && number) {
      const b = this.buildings.get(number).data;
      const target = new THREE.Vector3(b.centroid[0], b.baseY + b.height / 2, b.centroid[1]);
      const direction = this.camera.position.clone().sub(this.controls.target).normalize();
      direction.y = Math.max(direction.y, 0.65);
      direction.normalize();
      this.animateCamera(target.clone().addScaledVector(direction, 110 + b.height * 1.3), target);
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
    const height = b.data.height + (enabled ? 5 * (b.data.levels - 1) : 0);
    const target = new THREE.Vector3(b.data.centroid[0], b.data.baseY + height / 2, b.data.centroid[1]);
    const direction = new THREE.Vector3(0.9, 0.8, 1).normalize();
    this.animateCamera(target.clone().addScaledVector(direction, 110 + height * 1.15), target);
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
    const target = this.controls.target.clone();
    this.animateCamera(enabled ? target.clone().add(new THREE.Vector3(0, this.selected ? 145 : 340, 0.01)) :
      target.clone().add(this.selected ? new THREE.Vector3(85, 90, 105) : HOME.clone().sub(HOME_TARGET)), target);
  }

  zoom(amount) {
    const target = this.controls.target.clone();
    const displacement = this.camera.position.clone().sub(target).multiplyScalar(amount);
    displacement.clampLength(25, 580);
    this.animateCamera(target.clone().add(displacement), target);
  }

  reset() {
    this.select(null, false);
    const offset = HOME.clone().sub(HOME_TARGET).multiplyScalar(Math.max(1, 0.92 / this.camera.aspect));
    this.animateCamera(HOME_TARGET.clone().add(offset), HOME_TARGET.clone());
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
    const homeScale = Math.max(1, 0.92 / this.camera.aspect);
    if (!this.selected && homeScale !== this.homeScale) {
      this.tween = null;
      const offset = this.camera.position.clone().sub(this.controls.target).multiplyScalar(homeScale / (this.homeScale || 1));
      this.camera.position.copy(this.controls.target).add(offset);
    }
    this.homeScale = homeScale;
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
      const t = Math.min((performance.now() - this.tween.start) / 900, 1);
      const eased = 1 - (1 - t) ** 3;
      this.camera.position.lerpVectors(this.tween.position, this.tween.endPosition, eased);
      this.controls.target.lerpVectors(this.tween.target, this.tween.endTarget, eased);
      if (t === 1) this.tween = null;
    }
    for (const b of this.buildings.values()) {
      if (b.currentGap !== b.targetGap) {
        changed = true;
        b.currentGap = Math.abs(b.targetGap - b.currentGap) < 0.002 ? b.targetGap : b.currentGap + (b.targetGap - b.currentGap) * (this.reduced ? 1 : 0.12);
        b.floorGroups.forEach((floor, i) => { floor.position.y = b.data.baseY + b.floorElevations[i] + i * b.currentGap + 0.15; });
      }
    }
    if (this.controls.update()) changed = true;
    // Keep OrbitControls damping responsive without redrawing a static campus.
    if (!changed) return;
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
    const arrow = document.getElementById('north-arrow');
    if (arrow) {
      const angle = Math.atan2(this.camera.position.x - this.controls.target.x, this.camera.position.z - this.controls.target.z);
      arrow.style.transform = `rotate(${-angle}rad)`;
      arrow.style.transformOrigin = '22px 22px';
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
    polygon.setAttribute('stroke', '#365b50');
    polygon.setAttribute('stroke-width', '.6');
    polygon.addEventListener('click', () => onSelect(b.number));
    const title = document.createElementNS(ns, 'title');
    title.textContent = b.address;
    polygon.appendChild(title);
    svg.appendChild(polygon);
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('x', b.centroid[0]); text.setAttribute('y', b.centroid[1]);
    text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-size', '5');
    text.textContent = b.number;
    svg.appendChild(text);
  }
  container.replaceChildren(svg);
}
