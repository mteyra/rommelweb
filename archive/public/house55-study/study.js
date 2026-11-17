const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const names = {A: 'A–D', E: 'E–G', N: 'N1–N3', R: 'R1–R3', L: 'L1–L3', W: 'W1–W4'};
const state = {data: null, selected: 'A', dimensions: true, focus: false, view: null, fullView: null, drag: null};
const f = (value, digits = 2) => Number(value).toFixed(digits);
const bounds = ring => ({
  x: Math.min(...ring.map(p => p[0])), y: Math.min(...ring.map(p => p[1])),
  width: Math.max(...ring.map(p => p[0])) - Math.min(...ring.map(p => p[0])),
  height: Math.max(...ring.map(p => p[1])) - Math.min(...ring.map(p => p[1])),
});
const center = ring => { const b = bounds(ring); return [b.x + b.width / 2, b.y + b.height / 2]; };
const path = ring => ring.map((p, i) => `${i ? 'L' : 'M'}${p.join(',')}`).join(' ') + ' Z';
function node(tag, attrs = {}, text) {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text;
  return element;
}
function shape(svg, polygon, attrs) { svg.append(node('path', {d: path(polygon), ...attrs})); }
function line(svg, a, b, attrs) { svg.append(node('line', {x1: a[0], y1: a[1], x2: b[0], y2: b[1], ...attrs})); }
function text(svg, position, label, attrs = {}) {
  svg.append(node('text', {x: position[0], y: position[1], 'font-size': .42, fill: '#526965', 'text-anchor': 'middle', ...attrs}, label));
}
function dimensions(svg, pixelsPerMetre) {
  const ring = state.data.shell.outline;
  const sign = Math.sign(ring.slice(1).reduce((sum, b, i) => sum + ring[i][0] * b[1] - b[0] * ring[i][1], 0));
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1], b = ring[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (pixelsPerMetre < 12 && length < 3) continue;
    const normal = [sign * (b[1] - a[1]) / length, sign * (a[0] - b[0]) / length];
    const offset = p => p.map((v, axis) => v + normal[axis] * .50);
    const start = offset(a), end = offset(b), mid = a.map((v, axis) => (v + b[axis]) / 2 + normal[axis] * .94);
    line(svg, start, end, {stroke: '#8a9990', 'stroke-width': .025});
    for (const p of [a, b]) line(svg, p, p.map((v, axis) => v + normal[axis] * .65), {stroke: '#8a9990', 'stroke-width': .025});
    const angle = Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]) ? -90 : 0;
    text(svg, mid, `${f(length)} m`, {transform: `rotate(${angle} ${mid.join(' ')})`, 'font-size': Math.max(.4, 7.5 / pixelsPerMetre)});
  }
}
function draw() {
  const svg = $('plan'), {data, view} = state;
  const pixelsPerMetre = Math.min(svg.clientWidth / view.width, svg.clientHeight / view.height);
  svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
  svg.replaceChildren();
  shape(svg, data.shell.outline, {fill: '#eeeee7', stroke: '#6c7d70', 'stroke-width': .065, 'data-shell': 'module-layout'});
  for (const wall of data.wallBands || []) shape(svg, wall.polygon, {fill: '#aab4ab', 'data-wall': wall.id});
  for (const hall of data.corridors) shape(svg, hall.polygon, {fill: '#e1e9d6', 'data-hall': hall.id});
  shape(svg, data.stair.polygon, {fill: '#efd2c6', stroke: '#b28e7c', 'stroke-width': .035});
  shape(svg, data.stair.walkwayPolygon, {fill: '#e1e9d6'});
  for (const landing of data.stair.landings || []) shape(svg, landing.polygon, {fill: '#e1e9d6'});
  for (const segment of data.stair.connectionSegments || []) line(svg, ...segment, {stroke: '#e1e9d6', 'stroke-width': .13});
  const flight = bounds(data.stair.flightPolygon);
  for (let i = 1; i < 9; i++) {
    const y = flight.y + flight.height * i / 9;
    line(svg, [flight.x, y], [flight.x + flight.width, y], {stroke: '#a98571', 'stroke-width': .03});
  }
  for (const room of data.rooms) {
    const selected = room.label === state.selected;
    const element = node('path', {
      d: path(room.polygon), fill: selected ? '#a8c9cd' : '#d7e7e9', stroke: selected ? '#1d555b' : '#8fa4a2',
      'stroke-width': selected ? .09 : .035, class: `plan-room${selected ? ' selected' : ''}`,
      'data-room': room.label, tabindex: 0, role: 'button',
      'aria-label': `Room ${room.label}, 2.70 by 6.00 metres, 16.20 square metres`,
    });
    element.addEventListener('click', () => select(room.label));
    element.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(room.label); }
    });
    svg.append(element);
    const p = center(room.polygon);
    text(svg, [p[0], p[1] - .15], room.label, {'font-size': Math.max(.60, 9 / pixelsPerMetre), 'font-weight': 700, fill: '#27494c', 'dominant-baseline': 'middle'});
    if ((state.dimensions || selected) && pixelsPerMetre >= 15) text(svg, [p[0], p[1] + .45], '2.70 × 6.00', {'font-size': .40});
    if (room.doorSegment) line(svg, ...room.doorSegment, {stroke: '#fffefa', 'stroke-width': .13});
    if (room.windowSegment) line(svg, ...room.windowSegment, {stroke: '#5c97aa', 'stroke-width': .09});
  }
  dimensions(svg, pixelsPerMetre);
  const p = center(data.stair.polygon);
  text(svg, [p[0], p[1]], 'Stairs', {'font-size': .4, transform: `rotate(-90 ${p.join(' ')})`});
  $('focus-button').setAttribute('aria-pressed', state.focus);
  $('dimension-button').setAttribute('aria-pressed', state.dimensions);
}
function select(label) {
  state.selected = label;
  const room = state.data.rooms.find(room => room.label === label);
  $('room-title').textContent = room.label;
  $('room-bank').textContent = `Bank ${names[room.bank]} · prescribed module`;
  $('room-select').value = label;
  if (state.focus) focusRoom();
  draw();
}
function focusRoom() {
  const room = state.data.rooms.find(room => room.label === state.selected);
  const b = bounds(room.modulePolygon || room.polygon), pad = 1.6;
  state.view = {x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2};
}
function fullPlan() {if (!state.data) return; state.focus = false; state.view = {...state.fullView}; draw();}
$('fit-button').addEventListener('click', fullPlan);
$('focus-button').addEventListener('click', () => {
  if (!state.data) return;
  state.focus = !state.focus;
  if (state.focus) focusRoom(); else state.view = {...state.fullView};
  draw();
});
$('dimension-button').addEventListener('click', () => {if (!state.data) return; state.dimensions = !state.dimensions; draw();});
$('room-select').addEventListener('change', event => select(event.target.value));
$('plan').addEventListener('wheel', event => {
  if (!state.data) return;
  event.preventDefault();
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform($('plan').getScreenCTM().inverse());
  const factor = Math.exp(Math.max(-.25, Math.min(.25, event.deltaY * .0015)));
  const width = Math.max(5, Math.min(85, state.view.width * factor)), ratio = width / state.view.width;
  state.view = {x: p.x - (p.x - state.view.x) * ratio, y: p.y - (p.y - state.view.y) * ratio, width, height: state.view.height * ratio};
  state.focus = false; draw();
}, {passive: false});
$('plan').addEventListener('pointerdown', event => {
  if (!state.data || event.button !== 0 || event.target.closest('[data-room]')) return;
  state.drag = {pointerId: event.pointerId, start: new DOMPoint(event.clientX, event.clientY), matrix: $('plan').getScreenCTM().inverse(), view: {...state.view}};
  $('plan').setPointerCapture(event.pointerId);
});
$('plan').addEventListener('pointermove', event => {
  const d = state.drag;
  if (!d || d.pointerId !== event.pointerId) return;
  const a = d.start.matrixTransform(d.matrix), b = new DOMPoint(event.clientX, event.clientY).matrixTransform(d.matrix);
  state.view = {...d.view, x: d.view.x + a.x - b.x, y: d.view.y + a.y - b.y}; state.focus = false; draw();
});
for (const type of ['pointerup', 'pointercancel']) $('plan').addEventListener(type, event => {
  if (state.drag?.pointerId !== event.pointerId) return;
  state.drag = null;
  if ($('plan').hasPointerCapture(event.pointerId)) $('plan').releasePointerCapture(event.pointerId);
});
new ResizeObserver(() => { if (state.data && state.view) draw(); }).observe($('plan'));
try {
  const response = await fetch('../data/house55-module-layout.json');
  if (!response.ok) throw new Error(`The module plan could not load (${response.status}).`);
  state.data = await response.json();
  if (state.data.rooms.length !== 20) throw new Error('The plan must contain twenty room interiors.');
  const b = bounds(state.data.shell.outline), pad = 2.3;
  state.fullView = {x: b.x - pad, y: b.y - pad, width: b.width + pad * 2, height: b.height + pad * 2};
  state.view = {...state.fullView};
  for (const room of state.data.rooms) {
    const option = document.createElement('option'); option.value = room.label; option.textContent = `${room.label} · bank ${names[room.bank]}`; $('room-select').append(option);
  }
  for (const bank of ['A', 'W', 'L', 'R', 'E', 'N']) {
    const rooms = state.data.rooms.filter(room => room.bank === bank);
    const row = document.createElement('tr');
    for (const value of [names[bank], rooms.length, `${f(rooms.length * 3.1)} m`, '16.20 m²']) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    }
    $('bank-table').append(row);
  }
  for (const label of ['20 equal room interiors', '3.10 m room modules', '1.40 m hallways', 'Independent layout outline']) {
    const chip = document.createElement('span'); chip.className = 'check good'; chip.textContent = label; $('checks').append(chip);
  }
  select('A');
  window.house55ModulePlan = Object.freeze({getState: () => ({selected: state.selected, roomCount: state.data.rooms.length, dimensions: structuredClone(state.data.dimensions), view: {...state.view}})});
} catch (error) {
  $('error').style.display = 'block'; $('error').textContent = `${error.message} Refresh to try again.`;
  document.querySelectorAll('button,select').forEach(element => {element.disabled = true;});
  console.error(error);
}
