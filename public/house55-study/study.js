const el = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const state = { version: 'candidate', dimensions: false, focused: false, selected: 'W3', data: null };
const bankNames = { A: 'A–D bank', W: 'West bank', L: 'L bank', E: 'E–G bank', R: 'R bank', N: 'North bank' };
const fixed = (n, places = 2) => Number(n).toFixed(places);
const average = values => values.reduce((a, b) => a + b, 0) / values.length;

function svgNode(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text != null) node.textContent = text;
  return node;
}

function ringsPath(polygons) {
  return polygons.flatMap(p => [p.outer || p.polygon, ...(p.holes || [])])
    .filter(Boolean).map(r => r.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ') + 'Z').join(' ');
}

function center(ring) {
  let twiceArea = 0, x = 0, y = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], cross = a[0] * b[1] - b[0] * a[1];
    twiceArea += cross; x += (a[0] + b[0]) * cross; y += (a[1] + b[1]) * cross;
  }
  return Math.abs(twiceArea) > 1e-8 ? [x / (3 * twiceArea), y / (3 * twiceArea)] :
    [average(ring.map(p => p[0])), average(ring.map(p => p[1]))];
}

function selectedPlan() { return state.data[state.version]; }

function updateInspector() {
  const room = selectedPlan().rooms.find(r => r.label === state.selected) || selectedPlan().rooms[0];
  state.selected = room.label;
  el('room-title').textContent = room.label;
  el('room-bank').textContent = `${bankNames[room.bank] || room.bank} · ${state.version === 'candidate' ? 'new candidate' : 'earlier fitted layout'}`;
  el('room-width').textContent = `${fixed(room.width)} m`;
  el('room-depth').textContent = `${fixed(room.depth)} m`;
  el('room-area').textContent = `${fixed(room.area)} m²`;
  el('room-hall').textContent = state.version === 'candidate' ? '1.30 m' : 'Not fitted to 1.30 m';
  el('room-select').value = room.label;
  document.querySelectorAll('.plan-room').forEach(node => node.classList.toggle('selected', node.dataset.label === room.label));
}

function drawPlan() {
  const plan = selectedPlan(), svg = el('plan');
  svg.replaceChildren();
  const points = state.data.candidate.floorOutline.flatMap(p => p.outer);
  const xmin = Math.min(...points.map(p => p[0])), xmax = Math.max(...points.map(p => p[0]));
  const ymin = Math.min(...points.map(p => p[1])), ymax = Math.max(...points.map(p => p[1]));
  const pad = 1.5;
  svg.setAttribute('viewBox', `${xmin - pad} ${ymin - pad} ${xmax - xmin + 2 * pad} ${ymax - ymin + 2 * pad}`);
  if (state.focused) {
    const room = plan.rooms.find(r => r.label === state.selected);
    const xs = room.polygon.map(p => p[0]), ys = room.polygon.map(p => p[1]);
    svg.setAttribute('viewBox', `${Math.min(...xs) - 1.5} ${Math.min(...ys) - 1.5} ${Math.max(...xs) - Math.min(...xs) + 3} ${Math.max(...ys) - Math.min(...ys) + 3}`);
  }
  svg.append(svgNode('title', {}, state.version === 'candidate' ? 'Candidate plan fitted around measured circulation' : 'Earlier room layout, before measured-width fitting'));
  svg.append(svgNode('path', { d: ringsPath(plan.floorOutline), fill: '#efeee7', stroke: '#82918b', 'stroke-width': .055, 'fill-rule': 'evenodd' }));
  if (plan.walls?.length) {
    svg.append(svgNode('path', { d: ringsPath(plan.walls), fill: '#aab4ab', 'fill-rule': 'evenodd' }));
  }
  for (const corridor of plan.corridors || []) {
    const polygons = corridor.polygons || [{ outer: corridor.polygon, holes: corridor.holes || [] }];
    svg.append(svgNode('path', { d: ringsPath(polygons), fill: '#e1e9d6', stroke: '#98af88', 'stroke-width': .035, 'fill-rule': 'evenodd' }));
  }
  if (plan.stair?.polygon) {
    svg.append(svgNode('path', { d: ringsPath([{ outer: plan.stair.polygon }]), fill: '#efd2c6', stroke: '#b56d52', 'stroke-width': .06 }));
    for (const [i, zone] of (plan.stair.zones || []).entries()) {
      svg.append(svgNode('path', { d: ringsPath([{ outer: zone.polygon }]), fill: i ? '#f1dfca' : '#e7beac', stroke: '#b68169', 'stroke-width': .025 }));
      const c = center(zone.polygon);
      svg.append(svgNode('text', { x: c[0], y: c[1], class: 'room-dims', style: 'fill:#80503c;font-size:.3px' }, zone.label));
    }
  }
  for (const room of plan.rooms) {
    const path = svgNode('path', {
      d: ringsPath([{ outer: room.polygon, holes: room.holes || [] }]), fill: '#d7e7e9',
      stroke: '#789b9d', 'stroke-width': .045, class: 'plan-room', tabindex: 0,
      role: 'button', 'aria-label': `Room ${room.label}, ${fixed(room.width)} by ${fixed(room.depth)} metres, ${fixed(room.area)} square metres`,
      'data-label': room.label
    });
    path.addEventListener('click', () => { state.selected = room.label; state.focused ? drawPlan() : updateInspector(); });
    path.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); state.selected = room.label; updateInspector(); }
    });
    svg.append(path);
    const c = room.labelPosition || center(room.polygon);
    svg.append(svgNode('text', { x: c[0], y: c[1] - (state.dimensions ? .34 : 0), class: 'room-label' }, room.label));
    if (state.dimensions) {
      svg.append(svgNode('text', { x: c[0], y: c[1] + .24, class: 'room-dims' }, `${fixed(room.width)} × ${fixed(room.depth)}`));
      svg.append(svgNode('text', { x: c[0], y: c[1] + .72, class: 'room-dims' }, `${fixed(room.area)} m²`));
    }
  }
  for (const label of plan.labels || []) {
    svg.append(svgNode('text', { x: label.position[0], y: label.position[1], class: 'room-dims', style: 'fill:#50634a;font-size:.31px' }, label.text));
  }
  for (const door of plan.doors || []) {
    const [a, b] = door.segment;
    svg.append(svgNode('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#fffefa', 'stroke-width': .13 }));
  }
  const sx = xmin, sy = ymax + .8;
  svg.append(svgNode('path', { d: `M${sx},${sy - .15}V${sy}H${sx + 2}V${sy - .15}`, fill: 'none', stroke: '#496463', 'stroke-width': .045 }));
  svg.append(svgNode('text', { x: sx + 1, y: sy + .44, class: 'room-dims' }, '2 metres'));
  el('version-caption').textContent = state.version === 'candidate' ? 'Candidate placement · measured circulation' : 'Historical estimate · widths not reconciled';
  el('candidate-button').setAttribute('aria-pressed', String(state.version === 'candidate'));
  el('previous-button').setAttribute('aria-pressed', String(state.version === 'previous'));
  updateInspector();
}

function populateSummary() {
  const { candidate, metrics } = state.data;
  el('nominal').textContent = `${fixed(metrics.nominalWidth)} × ${fixed(metrics.nominalDepth)} m`;
  el('mean').textContent = `${fixed(average(candidate.rooms.map(r => r.area)))} m²`;
  for (const room of candidate.rooms) {
    const option = document.createElement('option'); option.value = room.label; option.textContent = `Room ${room.label} · ${fixed(room.area)} m²`;
    el('room-select').append(option);
  }
  for (const bank of ['A', 'W', 'L', 'E', 'R', 'N']) {
    const rooms = candidate.rooms.filter(r => r.bank === bank);
    if (!rooms.length) continue;
    const tr = document.createElement('tr');
    for (const value of [bank === 'A' ? 'A–D' : bank === 'E' ? 'E–G' : bank, rooms.length,
      `${fixed(average(rooms.map(r => r.width)))} × ${fixed(average(rooms.map(r => r.depth)))} m`,
      `${fixed(average(rooms.map(r => r.area)))} m²`]) {
      const td = document.createElement('td'); td.textContent = value; tr.append(td);
    }
    el('bank-table').append(tr);
  }
  for (const check of state.data.checks || []) {
    const tag = document.createElement('span'); tag.className = `check ${check.passed ? 'good' : 'bad'}`;
    tag.textContent = `${check.passed ? '✓' : '○'} ${check.label}`; el('checks').append(tag);
  }
  for (const [id, key] of [['fit-description', 'description'], ['assumptions', 'assumptionsText'], ['stair-note', 'stairNote']]) {
    if (state.data[key]) el(id).textContent = state.data[key];
  }
}

el('candidate-button').addEventListener('click', () => { state.version = 'candidate'; drawPlan(); });
el('previous-button').addEventListener('click', () => { state.version = 'previous'; drawPlan(); });
el('dimension-button').addEventListener('click', () => {
  state.dimensions = !state.dimensions; el('dimension-button').setAttribute('aria-pressed', String(state.dimensions));
  el('dimension-button').textContent = state.dimensions ? 'Hide dimensions' : 'Show dimensions'; drawPlan();
});
el('focus-button').addEventListener('click', () => {
  state.focused = !state.focused;
  el('focus-button').setAttribute('aria-pressed', String(state.focused));
  el('focus-button').textContent = state.focused ? 'Show full floor' : 'Focus selected room';
  if (state.focused && !state.dimensions) el('dimension-button').click();
  drawPlan();
});
el('room-select').addEventListener('change', event => {
  state.selected = event.target.value; state.focused ? drawPlan() : updateInspector();
});

try {
  const response = await fetch('./plan.json');
  if (!response.ok) throw new Error(`Plan data returned ${response.status}`);
  state.data = await response.json();
  if (state.data.candidate.rooms.length !== 20) throw new Error('The plan must contain twenty room records.');
  populateSummary(); drawPlan();
} catch (error) {
  el('error').style.display = 'block'; el('error').textContent = 'The plan could not load. Please refresh the page.';
  console.error(error);
}
