import {
  AREA, MIN_WIDTH, setRoomDimension, rectangleVertices, rectangleBounds,
  snapRoom, analyzeLayout, packRooms
} from './geometry.js';

const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const STORE = 'rommelweb.house55.module-layout.v2';
const colours = { A: '#cddfcf', W: '#d4e4df', L: '#dedfc2', E: '#d5dfe8', R: '#e6ddc8', N: '#dcd8e6' };
const bankNames = { A: 'A–D', W: 'W1–W4', L: 'L1–L3', E: 'E–G', R: 'R1–R3', N: 'N1–N3' };
const state = {
  data: null, rooms: [], selected: 'A', gap: .4, scope: 'room',
  autoPack: true, snap: true, dimensions: true, allDimensions: false,
  guides: true, moveBank: false, view: null, initialView: null,
  past: [], future: [], gesture: null, inputBefore: null, analysis: null
};
const clone = value => structuredClone(value);
const f = (value, digits = 2) => Number(value).toFixed(digits);
let toastTimer, saveTimer;

function node(tag, attrs = {}, text) {
  const element = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  if (text != null) element.textContent = text;
  return element;
}
function ringPath(ring) { return ring.map((point, i) => `${i ? 'L' : 'M'}${point[0]},${point[1]}`).join(' ') + ' Z'; }
function polygonPath(polygon) {
  if (Array.isArray(polygon)) return polygon.map(polygonPath).join(' ');
  return [polygon.outline || polygon.outer || polygon.polygon, ...(polygon.holes || [])].filter(Boolean).map(ringPath).join(' ');
}
function selectedRoom() { return state.rooms.find(room => room.id === state.selected); }
function shapeSnapshot() { return { rooms: clone(state.rooms), gap: state.gap }; }
function sameShape(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function tell(message) {
  $('toast').textContent = message; $('toast').classList.add('visible');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3500);
}
function record(before) {
  if (!before || sameShape(before, shapeSnapshot())) return;
  state.past.push(before); if (state.past.length > 100) state.past.shift();
  state.future = []; save(); updateHistory();
}
function transact(callback) { finishInput(); const before = shapeSnapshot(); callback(); record(before); render(); }
function finishInput() {
  if (state.inputBefore) { const before = state.inputBefore; state.inputBefore = null; record(before); }
}
function updateHistory() {
  $('undo-button').disabled = !state.past.length;
  $('redo-button').disabled = !state.future.length;
}
function undo(redo = false) {
  finishInput();
  const source = redo ? state.future : state.past, destination = redo ? state.past : state.future;
  if (!source.length) return;
  destination.push(shapeSnapshot());
  const saved = source.pop(); state.rooms = clone(saved.rooms); state.gap = saved.gap;
  save(); render(); tell(redo ? 'Change restored.' : 'Change undone.');
}
function save() {
  clearTimeout(saveTimer);
  const savedDocument = layoutDocument();
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE, JSON.stringify(savedDocument)); $('save-status').textContent = 'Saved on this device'; }
    catch { $('save-status').textContent = 'Use Share or Download to save'; }
  }, 100);
}
function layoutDocument() {
  return {
    version: 1, house: 55, level: 2, shellHash: state.data.shellHash,
    areaPerRoom: AREA, gap: state.gap, selected: state.selected,
    rooms: state.rooms.map(({ id, bank, x, y, width, depth, rotation }) => ({ id, bank, x, y, width, depth, rotation }))
  };
}
function validateLayout(document) {
  if (!document || document.version !== 1 || document.house !== 55 || document.level !== 2) throw new Error('This is not a House Red top-floor layout file.');
  if (document.areaPerRoom !== AREA) throw new Error('This saved layout uses an earlier room area. The current plan uses 16.2 m² clear interiors.');
  if (document.shellHash !== state.data.shellHash) throw new Error('This layout uses a different shell version.');
  if (!Array.isArray(document.rooms) || document.rooms.length !== 20) throw new Error('A layout needs all twenty rooms.');
  if (!Number.isFinite(document.gap) || document.gap < 0 || document.gap > 1) throw new Error('Room spacing must be between 0 and 100 cm.');
  const ids = new Set();
  const rooms = document.rooms.map(room => {
    const original = state.data.rooms.find(item => item.id === room.id);
    if (!original || ids.has(room.id) || room.bank !== original.bank) throw new Error('The room labels do not match this floor.');
    ids.add(room.id);
    if (![room.x, room.y, room.width, room.depth, room.rotation].every(Number.isFinite)) throw new Error('Room dimensions and positions must be finite numbers.');
    if (Math.abs(room.x) > 1000 || Math.abs(room.y) > 1000 || room.width < MIN_WIDTH - 1e-10 || room.width > 10 || room.depth < MIN_WIDTH - 1e-10 || room.depth > 10) throw new Error('A room has dimensions or a position outside the editor range.');
    if (Math.abs(room.width * room.depth - AREA) > 1e-7 || room.rotation % 90 !== 0) throw new Error('Each room must be 16.2 m² with a rotation in steps of 90°.');
    return { id: room.id, bank: original.bank, x: room.x, y: room.y, width: room.width, depth: AREA / room.width, rotation: ((room.rotation % 180) + 180) % 180 };
  });
  return { rooms, gap: document.gap, selected: ids.has(document.selected) ? document.selected : 'A' };
}
function applyImported(document, message = 'Layout loaded.') {
  const next = validateLayout(document);
  transact(() => { state.rooms = next.rooms; state.gap = next.gap; state.selected = next.selected; });
  fitView(); render(); tell(message);
}
function targetedIds() {
  const room = selectedRoom();
  return state.rooms.filter(item => state.scope === 'all' || (state.scope === 'bank' ? item.bank === room.bank : item.id === room.id)).map(item => item.id);
}
function packBanks(bankIds) {
  for (const bankId of bankIds) {
    const bank = state.data.banks.find(item => item.id === bankId);
    if (!bank) continue;
    state.rooms = packRooms(state.rooms, bank.roomIds, { axis: bank.axis, gap: state.gap, anchor: 'center', align: 'center' });
  }
}
function resizeRooms(axis, value, ids = targetedIds()) {
  if (!Number.isFinite(value) || value < MIN_WIDTH || value > 10) return false;
  state.rooms = state.rooms.map(room => ids.includes(room.id) ? setRoomDimension(room, axis, value) : room);
  if (state.autoPack) packBanks(new Set(state.rooms.filter(room => ids.includes(room.id)).map(room => room.bank)));
  return true;
}
function dimensionInput(axis, value) {
  if (!Number.isFinite(value) || value < MIN_WIDTH || value > 10) return;
  if (!state.inputBefore) state.inputBefore = shapeSnapshot();
  resizeRooms(axis, value); render();
}
function setSelection(id, { focus = false } = {}) {
  finishInput(); state.selected = id;
  if (focus) focusRoom();
  render();
}
function fitView() { state.view = { ...state.initialView }; }
function focusRoom() {
  const b = rectangleBounds(selectedRoom()), padding = 1.7;
  state.view = { x: b.minX - padding, y: b.minY - padding, width: b.maxX - b.minX + padding * 2, height: b.maxY - b.minY + padding * 2 };
}
function zoom(factor, point) {
  const v = state.view, nextWidth = Math.max(4, Math.min(140, v.width * factor));
  const ratio = nextWidth / v.width, pivot = point || [v.x + v.width / 2, v.y + v.height / 2];
  state.view = { x: pivot[0] - (pivot[0] - v.x) * ratio, y: pivot[1] - (pivot[1] - v.y) * ratio, width: nextWidth, height: v.height * ratio };
  draw();
}
function toWorld(event) {
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform($('plan').getScreenCTM().inverse());
  return [p.x, p.y];
}
function localToWorld(room, u, v) {
  const angle = room.rotation * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return [room.x + u * c - v * s, room.y + u * s + v * c];
}
function dimension(svg, a, b, label, { shell = false, labelOffset = .13 } = {}) {
  const scale = Math.abs(svg.getScreenCTM()?.a || 20);
  const group = node('g', { 'pointer-events': 'none', 'data-dimension': shell ? 'shell' : 'room' });
  group.append(node('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'dimension-line', 'marker-start': 'url(#arrow)', 'marker-end': 'url(#arrow)' }));
  let angle = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
  if (angle > 90 || angle < -90) angle += 180;
  const x = (a[0] + b[0]) / 2, y = (a[1] + b[1]) / 2;
  group.append(node('text', { x, y: y - labelOffset, class: shell ? 'shell-dimension-label' : 'dimension-label', transform: `rotate(${angle} ${x} ${y})`, style: `font-size:${Math.max(shell ? .35 : .28, 7.5 / scale)}px` }, label));
  svg.append(group);
}
function roomDimensions(svg, room) {
  const w = room.width, d = room.depth, inset = .27;
  dimension(svg, localToWorld(room, -w / 2, -d / 2 + inset), localToWorld(room, w / 2, -d / 2 + inset), `${f(w)} m`, { labelOffset: -.19 });
  dimension(svg, localToWorld(room, w / 2 - inset, -d / 2), localToWorld(room, w / 2 - inset, d / 2), `${f(d)} m`, { labelOffset: -.19 });
}
function roomHandle(svg, room, axis) {
  const point = axis === 'width' ? localToWorld(room, room.width / 2, 0) : localToWorld(room, 0, room.depth / 2);
  const vertical = (axis === 'width') === (room.rotation % 180 !== 0);
  const scale = Math.abs(svg.getScreenCTM()?.a || 20), visibleSize = Math.max(.32, 8 / scale);
  const handle = node('g', {
    'data-resize': axis, style: `cursor:${vertical ? 'ns' : 'ew'}-resize`,
    role: 'slider', tabindex: 0, 'aria-label': `Resize ${axis} of room ${room.id}`,
    'aria-valuemin': MIN_WIDTH, 'aria-valuemax': 10, 'aria-valuenow': f(room[axis], 3),
    'aria-orientation': vertical ? 'vertical' : 'horizontal'
  });
  handle.append(node('circle', { cx: point[0], cy: point[1], r: Math.max(.28, 11 / scale), fill: 'transparent' }));
  handle.append(node('rect', { x: point[0] - visibleSize / 2, y: point[1] - visibleSize / 2, width: visibleSize, height: visibleSize, rx: .065, class: `resize-handle${vertical ? ' vertical' : ''}` }));
  handle.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const step = event.shiftKey ? .1 : .01, sign = ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 1;
    transact(() => resizeRooms(axis, Math.max(MIN_WIDTH, Math.min(10, selectedRoom()[axis] + sign * step))));
    svg.querySelector(`[data-resize="${axis}"]`)?.focus({ preventScroll: true });
  });
  svg.append(handle);
}
function drawGuides(svg) {
  const guides = state.data.referenceOverlays;
  const fontStyle = `font-size:${Math.max(.32, 7.5 / Math.abs(svg.getScreenCTM()?.a || 20))}px`;
  if (!guides) return;
  for (const hall of guides.hallways || guides.corridors || []) {
    const polygons = hall.polygons || (hall.polygon ? [{ outline: hall.polygon }] : []);
    svg.append(node('path', { d: polygonPath(polygons), fill: '#cfdac2', 'fill-opacity': .42, stroke: '#7b9270', 'stroke-width': .04, 'stroke-dasharray': '.12 .1', 'pointer-events': 'none' }));
    if (hall.polygon) {
      const xs = hall.polygon.map(p => p[0]), ys = hall.polygon.map(p => p[1]);
      const x = (Math.min(...xs) + Math.max(...xs)) / 2, y = (Math.min(...ys) + Math.max(...ys)) / 2;
      const vertical = Math.max(...ys) - Math.min(...ys) > Math.max(...xs) - Math.min(...xs);
      svg.append(node('text', { x, y, class: 'guide-label', transform: vertical ? `rotate(-90 ${x} ${y})` : '', style: fontStyle }, `${f(hall.width || 1.4)} m`));
    }
  }
  const stair = guides.stair;
  if (stair?.polygon) {
    svg.append(node('path', { d: ringPath(stair.polygon), fill: '#e5c8b1', 'fill-opacity': .4, stroke: '#a37b5d', 'stroke-width': .05, 'stroke-dasharray': '.15 .1', 'pointer-events': 'none' }));
    const xs = stair.polygon.map(p => p[0]), ys = stair.polygon.map(p => p[1]);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2, y = (Math.min(...ys) + Math.max(...ys)) / 2;
    svg.append(node('text', { x, y, class: 'guide-label', transform: `rotate(-90 ${x} ${y})`, style: fontStyle }, `${f(stair.width || 2.7)} m stair`));
  }
}
function draw() {
  const svg = $('plan'), v = state.view;
  const pixelsPerMetre = Math.min(svg.clientWidth / v.width, svg.clientHeight / v.height);
  svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.width} ${v.height}`);
  svg.replaceChildren();
  const defs = node('defs');
  const grid = node('pattern', { id: 'grid', width: .5, height: .5, patternUnits: 'userSpaceOnUse' });
  grid.append(node('circle', { cx: 0, cy: 0, r: .015, fill: '#c0ccc1' })); defs.append(grid);
  const arrow = node('marker', { id: 'arrow', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' });
  arrow.append(node('path', { d: 'M1 1 L7 4 L1 7', fill: 'none', stroke: '#3f6e60', 'stroke-width': 1.2 })); defs.append(arrow);
  svg.append(defs);
  svg.append(node('rect', { x: v.x - v.width, y: v.y - v.height, width: v.width * 3, height: v.height * 3, fill: 'url(#grid)', 'pointer-events': 'none' }));
  svg.append(node('path', { d: polygonPath(state.data.shell), fill: '#eeeee5', stroke: '#5b6f60', 'stroke-width': .075, 'fill-rule': 'evenodd', 'data-shell': 'module-layout', 'pointer-events': 'none' }));
  if (state.guides) drawGuides(svg);
  const errors = new Map(state.analysis.rooms.map(room => [room.id, room]));
  const order = [...state.rooms.filter(room => room.id !== state.selected), selectedRoom()];
  // Each module owns two 20 cm side strips. Adjacent clear interiors start
  // 40 cm apart; edits remain free to overlap these illustrative wall strips.
  for (const room of order) for (const sign of [-1, 1]) {
    const inner = sign * room.width / 2, outer = inner + sign * .2;
    const polygon = [[inner, -room.depth / 2], [outer, -room.depth / 2], [outer, room.depth / 2], [inner, room.depth / 2]]
      .map(([u, v]) => localToWorld(room, u, v));
    svg.append(node('path', {d: ringPath(polygon), fill: '#aab4ab', 'fill-opacity': .7, 'pointer-events': 'none', 'data-side-wall': room.id}));
  }
  for (const room of order) {
    const status = errors.get(room.id), isSelected = room.id === state.selected;
    const path = node('path', {
      d: ringPath(rectangleVertices(room)), fill: status.valid ? colours[room.bank] : '#edd4ad',
      'fill-opacity': .87, stroke: status.valid ? '#8b9e8e' : '#bf884d', 'stroke-width': .04,
      class: `room-shape${isSelected ? ' selected' : ''}`, 'data-room': room.id,
      tabindex: 0, role: 'button',
      'aria-label': `Room ${room.id}. ${f(room.width)} by ${f(room.depth)} metres. 16.2 square metres.${status.valid ? '' : ' Placement conflict.'}`
    });
    path.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelection(room.id); return; }
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation(); state.selected = room.id;
      const distance = event.shiftKey ? .1 : .01;
      transact(() => { const r = selectedRoom(); r.x += (event.key === 'ArrowRight' ? distance : event.key === 'ArrowLeft' ? -distance : 0); r.y += (event.key === 'ArrowDown' ? distance : event.key === 'ArrowUp' ? -distance : 0); });
      svg.querySelector(`[data-room="${room.id}"]`)?.focus({ preventScroll: true });
    });
    svg.append(path);
    svg.append(node('text', { x: room.x, y: room.y - .14, class: 'room-label', style: `font-size:${Math.max(.58, 9 / pixelsPerMetre)}px` }, room.id));
    if (pixelsPerMetre >= 18) svg.append(node('text', { x: room.x, y: room.y + .49, class: 'area-label', style: 'font-size:.32px' }, '16.2 m²'));
  }
  if (state.dimensions) {
    const bounds = state.data.bounds;
    dimension(svg, [bounds.minX, bounds.minY - 1.05], [bounds.maxX, bounds.minY - 1.05], `${f(bounds.maxX - bounds.minX)} m · overall`, { shell: true, labelOffset: .23 });
    dimension(svg, [bounds.minX - 1.05, bounds.minY], [bounds.minX - 1.05, bounds.maxY], `${f(bounds.maxY - bounds.minY)} m`, { shell: true, labelOffset: .23 });
    if (pixelsPerMetre >= 15) for (const room of state.rooms) if (state.allDimensions || room.id === state.selected) roomDimensions(svg, room);
  }
  roomHandle(svg, selectedRoom(), 'width'); roomHandle(svg, selectedRoom(), 'depth');
  const b = state.data.bounds, scaleY = b.maxY + 1.1;
  svg.append(node('path', { d: `M${b.minX},${scaleY - .15}V${scaleY}h2v-.15`, fill: 'none', stroke: '#65816e', 'stroke-width': .045, 'pointer-events': 'none' }));
  svg.append(node('text', { x: b.minX + 1, y: scaleY + .45, class: 'shell-dimension-label', style: `font-size:${Math.max(.35, 7.5 / pixelsPerMetre)}px` }, '2 metres'));
  $('zoom-label').textContent = `${Math.round(state.initialView.width / v.width * 100)}%`;
}
function updateInspector() {
  const room = selectedRoom(), status = state.analysis.rooms.find(item => item.id === room.id);
  $('room-title').textContent = room.id; $('room-select').value = room.id;
  $('scope-select').options[1].textContent = `Bank ${bankNames[room.bank]}`;
  $('scope-select').value = state.scope;
  for (const [id, value] of [['width-input', f(room.width, 3)], ['depth-input', f(room.depth, 3)], ['width-slider', room.width], ['gap-input', Math.round(state.gap * 100)]]) {
    if (document.activeElement !== $(id)) $(id).value = value;
  }
  $('area-equation').textContent = `${f(room.width, 3)} × ${f(room.depth, 3)}`;
  $('pack-bank-button').textContent = `Pack bank ${bankNames[room.bank]}`;
  $('room-state').textContent = status.valid ? 'Inside · clear' : 'Check placement';
  $('room-state').classList.toggle('warning', !status.valid);
  const issues = [];
  if (!status.insideShell) issues.push('Crosses the shell or a cutout.');
  if (status.overlaps.length) issues.push(`Overlaps ${status.overlaps.map(item => item.id).join(', ')}.`);
  $('room-status').textContent = issues.join(' ') || 'Clear interior inside the layout shell, with no room overlap. Hall and wall guides are advisory while editing.';
  $('conflict-list').replaceChildren();
  for (const id of [...new Set([...state.analysis.outOfBounds, ...state.analysis.overlaps.flatMap(item => [item.a, item.b])])]) {
    const button = document.createElement('button'); button.textContent = id; button.title = `Inspect room ${id}`;
    button.addEventListener('click', () => setSelection(id, { focus: true })); $('conflict-list').append(button);
  }
  const overlaps = state.analysis.overlaps.length, outside = state.analysis.outOfBounds.length;
  $('conflict-summary').textContent = overlaps || outside ? `${overlaps} overlap${overlaps === 1 ? '' : 's'} · ${outside} outside shell` : '✓ All rectangles inside & clear';
  $('conflict-summary').classList.toggle('warning', !!(overlaps || outside));
  $('total-area').textContent = f(state.analysis.totalArea, 1);
  $('guide-note').style.opacity = state.guides ? '1' : '.75';
  updateHistory();
}
function render() {
  state.analysis = analyzeLayout(state.rooms, state.data.shell);
  draw(); updateInspector();
}

$('plan').addEventListener('pointerdown', event => {
  if (!state.data || state.gesture || event.button > 0) return;
  finishInput();
  const point = toWorld(event), roomTarget = event.target.closest('[data-room]'), handle = event.target.closest('[data-resize]');
  const before = shapeSnapshot();
  if (handle) {
    state.gesture = { type: 'resize', axis: handle.dataset.resize, pointerId: event.pointerId, before, room: clone(selectedRoom()), ids: targetedIds() };
  } else if (roomTarget) {
    state.selected = roomTarget.dataset.room;
    const room = selectedRoom(), ids = state.moveBank || event.shiftKey ? state.rooms.filter(item => item.bank === room.bank).map(item => item.id) : [room.id];
    state.gesture = { type: 'move', pointerId: event.pointerId, start: point, before, room: clone(room), ids };
  } else {
    state.gesture = { type: 'pan', pointerId: event.pointerId, startClient: [event.clientX, event.clientY], view: { ...state.view }, matrix: $('plan').getScreenCTM().inverse() };
  }
  $('plan').setPointerCapture(event.pointerId); $('plan').classList.add('is-dragging'); event.preventDefault(); render();
});
$('plan').addEventListener('pointermove', event => {
  const g = state.gesture;
  if (!g || event.pointerId !== g.pointerId) return;
  if (g.type === 'pan') {
    const start = new DOMPoint(...g.startClient).matrixTransform(g.matrix), end = new DOMPoint(event.clientX, event.clientY).matrixTransform(g.matrix);
    state.view = { ...g.view, x: g.view.x - end.x + start.x, y: g.view.y - end.y + start.y }; draw(); return;
  }
  const point = toWorld(event);
  if (g.type === 'resize') {
    const theta = g.room.rotation * Math.PI / 180, dx = point[0] - g.room.x, dy = point[1] - g.room.y;
    const projected = g.axis === 'width' ? dx * Math.cos(theta) + dy * Math.sin(theta) : -dx * Math.sin(theta) + dy * Math.cos(theta);
    state.rooms = clone(g.before.rooms);
    resizeRooms(g.axis, Math.max(MIN_WIDTH, Math.min(10, projected * 2)), g.ids);
  } else {
    let dx = point[0] - g.start[0], dy = point[1] - g.start[1];
    if (state.snap && !event.altKey) {
      const moved = { ...g.room, x: g.room.x + dx, y: g.room.y + dy };
      const result = snapRoom(moved, g.before.rooms.filter(room => !g.ids.includes(room.id)), state.data.shell, { tolerance: Math.min(.25, state.view.width / $('plan').clientWidth * 8), gap: state.gap });
      dx = result.room.x - g.room.x; dy = result.room.y - g.room.y;
    }
    state.rooms = g.before.rooms.map(room => g.ids.includes(room.id) ? { ...room, x: room.x + dx, y: room.y + dy } : { ...room });
  }
  render();
});
function endGesture(event, cancel = false) {
  const g = state.gesture;
  if (!g || event.pointerId !== g.pointerId) return;
  state.gesture = null; $('plan').classList.remove('is-dragging');
  if ($('plan').hasPointerCapture(event.pointerId)) $('plan').releasePointerCapture(event.pointerId);
  if (g.type !== 'pan') {
    if (cancel) { state.rooms = clone(g.before.rooms); state.gap = g.before.gap; }
    else record(g.before);
  }
  render();
}
$('plan').addEventListener('pointerup', event => endGesture(event));
$('plan').addEventListener('pointercancel', event => endGesture(event, true));
$('plan').addEventListener('wheel', event => {
  if (!state.data) return;
  event.preventDefault(); zoom(Math.exp(Math.max(-.3, Math.min(.3, event.deltaY * .0015))), toWorld(event));
}, { passive: false });
$('room-select').addEventListener('change', event => setSelection(event.target.value));
$('scope-select').addEventListener('change', event => { finishInput(); state.scope = event.target.value; });
for (const [id, axis] of [['width-input', 'width'], ['depth-input', 'depth'], ['width-slider', 'width']]) {
  $(id).addEventListener('input', event => dimensionInput(axis, Number(event.target.value)));
  $(id).addEventListener('change', () => { finishInput(); $(id).blur(); updateInspector(); });
}
$('gap-input').addEventListener('change', event => {
  const value = Number(event.target.value);
  if (!Number.isFinite(value) || value < 0 || value > 100) { tell('Choose a gap between 0 and 100 cm.'); event.target.value = Math.round(state.gap * 100); return; }
  transact(() => { state.gap = value / 100; if (state.autoPack) packBanks(state.data.banks.map(bank => bank.id)); });
});
for (const [id, field] of [['snap-toggle', 'snap'], ['dimensions-toggle', 'dimensions'], ['all-dimensions-toggle', 'allDimensions'], ['guides-toggle', 'guides'], ['auto-pack-toggle', 'autoPack'], ['move-bank-toggle', 'moveBank']]) {
  $(id).addEventListener('change', event => {
    state[field] = event.target.checked;
    if (field === 'allDimensions' && state.allDimensions) { state.dimensions = true; $('dimensions-toggle').checked = true; }
    render();
  });
}
$('pack-bank-button').addEventListener('click', () => transact(() => packBanks([selectedRoom().bank])));
$('pack-all-button').addEventListener('click', () => { transact(() => packBanks(state.data.banks.map(bank => bank.id))); tell('Each bank is packed with the chosen spacing. Orange rooms still need adjusting.'); });
$('rotate-button').addEventListener('click', () => transact(() => {
  const ids = targetedIds();
  state.rooms = state.rooms.map(room => ids.includes(room.id) ? { ...room, rotation: (room.rotation + 90) % 180 } : room);
  if (state.autoPack) packBanks(new Set(state.rooms.filter(room => ids.includes(room.id)).map(room => room.bank)));
}));
$('undo-button').addEventListener('click', () => undo());
$('redo-button').addEventListener('click', () => undo(true));
$('fit-button').addEventListener('click', () => { fitView(); draw(); });
$('focus-button').addEventListener('click', () => { focusRoom(); draw(); });
$('zoom-in-button').addEventListener('click', () => zoom(.8));
$('zoom-out-button').addEventListener('click', () => zoom(1.25));
$('conflict-summary').addEventListener('click', () => {
  const id = state.analysis.outOfBounds[0] || state.analysis.overlaps[0]?.a;
  if (id) setSelection(id, { focus: true }); else tell('All room rectangles are within the shell, without overlap.');
});
$('reset-button').addEventListener('click', () => {
  transact(() => { state.rooms = clone(state.data.rooms); state.gap = state.data.defaultGap ?? .4; });
  fitView(); render(); tell('Starting rectangles restored. Undo brings your layout back.');
});
document.addEventListener('keydown', event => {
  if (!state.data || ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); undo(event.shiftKey); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); undo(true); }
});
$('export-button').addEventListener('click', () => {
  finishInput();
  const url = URL.createObjectURL(new Blob([JSON.stringify(layoutDocument(), null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `house55-layout-${new Date().toISOString().slice(0, 10)}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); tell('Your layout has been downloaded.');
});
$('import-button').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 100000) throw new Error('That file is too large for a layout.');
    applyImported(JSON.parse(await file.text()));
  } catch (error) { tell(error.message || 'That layout could not be read.'); }
  event.target.value = '';
});
function sharedURL() {
  const url = new URL(location.href); url.search = '';
  url.hash = `layout=${btoa(JSON.stringify(layoutDocument())).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}`;
  return url.href;
}
function readSharedLayout(fragment) {
  if (fragment.length > 20000) throw new Error('The shared layout link is too long.');
  return JSON.parse(atob(fragment.replaceAll('-', '+').replaceAll('_', '/')));
}
window.addEventListener('hashchange', () => {
  if (!state.data || !state.view) return;
  const fragment = new URLSearchParams(location.hash.slice(1)).get('layout');
  if (!fragment) return;
  try {
    applyImported(readSharedLayout(fragment), 'Opened the shared layout. Undo returns to your previous version.');
    history.replaceState(null, '', location.pathname + location.search);
  } catch (error) { tell(`Shared layout could not load: ${error.message}`); }
});
new ResizeObserver(() => { if (state.data && state.view) draw(); }).observe($('plan'));
$('share-button').addEventListener('click', () => {
  finishInput(); $('share-url').value = sharedURL(); $('copy-status').textContent = 'Anyone with this link can open this version. Later edits do not change the link.';
  $('share-dialog').showModal(); $('share-url').select();
});
$('copy-link-button').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('share-url').value); $('copy-status').textContent = 'Link copied. Send it here whenever you want to compare notes.'; }
  catch { $('share-url').focus(); $('share-url').select(); $('copy-status').textContent = 'Select and copy the link above.'; }
});

try {
  const response = await fetch('./shell.json');
  if (!response.ok) throw new Error('Could not load the module layout shell.');
  state.data = await response.json();
  if (state.data.rooms.length !== 20) throw new Error('The floor must have twenty room rectangles.');
  const components = Array.isArray(state.data.shell) ? state.data.shell : [state.data.shell];
  const points = components.flatMap(polygon => polygon.outline || polygon.outer);
  state.data.bounds = { minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])), minY: Math.min(...points.map(p => p[1])), maxY: Math.max(...points.map(p => p[1])) };
  const b = state.data.bounds, pad = 2.4;
  state.initialView = { x: b.minX - pad, y: b.minY - pad, width: b.maxX - b.minX + pad * 2, height: b.maxY - b.minY + pad * 2 };
  state.rooms = clone(state.data.rooms);
  state.gap = state.data.defaultGap ?? .4;
  if (state.data.targetArea !== AREA) throw new Error('The room area and layout shell versions do not match.');
  for (const room of state.rooms) {
    const option = document.createElement('option'); option.value = room.id; option.textContent = `${room.id} · bank ${bankNames[room.bank]}`; $('room-select').append(option);
  }
  const fragment = new URLSearchParams(location.hash.slice(1)).get('layout');
  let loaded = false;
  if (fragment) {
    try {
      const next = validateLayout(readSharedLayout(fragment));
      state.rooms = next.rooms; state.gap = next.gap; state.selected = next.selected; loaded = true;
      history.replaceState(null, '', location.pathname + location.search);
      tell('Opened the shared layout. Your changes will save on this device.');
    } catch (error) { tell(`Shared layout could not load: ${error.message}`); }
  }
  if (!loaded) {
    try {
      const saved = localStorage.getItem(STORE);
      if (saved) {
        const next = validateLayout(JSON.parse(saved)); state.rooms = next.rooms; state.gap = next.gap; state.selected = next.selected; loaded = true;
      }
    } catch { tell('An older saved layout could not load. Starting rectangles are shown.'); }
  }
  fitView(); render(); save();
  // Read-only inspection surface also used by the browser verification harness.
  window.layoutSandbox = Object.freeze({ getState: () => ({ ...layoutDocument(), scope: state.scope, autoPack: state.autoPack, analysis: clone(state.analysis), view: clone(state.view) }) });
} catch (error) {
  $('load-error').hidden = false; $('load-error').textContent = `${error.message} Refresh to try again.`;
  document.querySelectorAll('.workspace button,.workspace input,.workspace select,.intro-actions button').forEach(element => { element.disabled = true; });
  console.error(error);
}
