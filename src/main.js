import './styles.css';
import QRCode from 'qrcode';
import { CampusScene, fallbackMap } from './scene.js';
import { clubs, filterBuildings, floorName, escapeHTML as esc, downloadFile } from './data.js';
import { validateInteriorData, getInteriorLevel } from './interiors.js';
import { calendarDraft, orderedDrafts } from './events.js';
import { icon } from './icons.js';
import { roomReferences, roomReferenceSource } from './room-references.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const base = import.meta.env.BASE_URL;
const state = { selected: null, floor: null, exploded: false, groupsOpen: false, groupDetails: false, timelineOpen: false, pickerOpen: false, groupIndex: 0, search: '', drafts: [], theme: 'night' };
let campus, lod2, interiors, scene, groups, toastTimer, lastFocus, qrRevision = 0;
let renderedGroupId = null, groupVisibilityAnimation, groupSizeAnimation;
const qrCache = new Map();
const narrow = () => matchMedia('(max-width: 700px)').matches;
const crowdedOverlays = () => matchMedia('(max-width: 1100px)').matches;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const house = number => campus.buildings.find(building => building.number === number);
const setHash = hash => history.replaceState(null, '', `#${hash}`);

function setTheme(theme) {
  state.theme = theme === 'day' ? 'day' : 'night';
  document.body.dataset.theme = state.theme;
  const label = `Switch to ${state.theme === 'day' ? 'night' : 'day'} mode`;
  $('#toggle-theme').setAttribute('aria-pressed', state.theme === 'day');
  $('#toggle-theme').setAttribute('aria-label', label);
  $('#toggle-theme').title = label;
  $('meta[name="theme-color"]').content = state.theme === 'day' ? '#e8e5da' : '#151715';
  scene?.setTheme(state.theme);
}

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3800);
}

function modal(content) {
  lastFocus = document.activeElement;
  $('#modal-body').innerHTML = content;
  $('#modal-body .modal-title').id = 'modal-title';
  $('#modal').setAttribute('aria-labelledby', 'modal-title');
  $('#modal').showModal();
}
$('#modal-close').onclick = () => $('#modal').close();
$('#modal').addEventListener('close', () => (lastFocus?.isConnected ? lastFocus : $('#open-tools')).focus({ preventScroll: true }));
$('#modal').addEventListener('click', event => { if (event.target === $('#modal')) $('#modal').close(); });

function travel(number, { fromGroup = false, focus = true } = {}) {
  if (number && !house(number)) return;
  state.selected = number;
  state.floor = null;
  state.exploded = false;
  setPicker(false);
  if (!fromGroup) setGroups(false);
  document.body.classList.toggle('house-open', Boolean(number));
  $('#floor-detail').open = false;
  scene?.select(number, focus);
  $('#location-trail').textContent = number ? `CAMPUS SÜD ${house(number).campus} / HOUSE ${number}` : 'ERLANGEN / CAMPUS SÜD';
  $('#scene-caption').textContent = number ? 'Drag to orbit. Click outside a house to return.' : 'Choose a house to explore.';
  renderHouse();
  renderDirectory();
  if (!fromGroup) setHash(number ? `house-${number}` : 'campus');
}

function setPicker(open, focus = false) {
  state.pickerOpen = open;
  $('#house-picker').hidden = !open;
  $('#all-houses').setAttribute('aria-expanded', open);
  document.body.classList.toggle('picker-open', open);
  if (open) {
    if (narrow()) { setGroups(false); setTimeline(false); }
    renderDirectory();
    if (focus) $('#building-search').focus();
  }
}

function renderDirectory() {
  const buildings = filterBuildings(campus.buildings, state.search, 'all');
  $('#building-list').innerHTML = buildings.map(b => `<button class="building-item ${state.selected === b.number ? 'selected' : ''}" data-house="${b.number}" aria-pressed="${state.selected === b.number}"><span class="building-color" style="--house-color:${b.color};background:${b.color}"></span><span class="building-number">${b.number}</span><span class="building-copy"><strong>${esc(b.name)}</strong><small>Süd ${b.campus} · ${b.levels} levels</small></span><span aria-hidden="true">↗</span></button>`).join('') || '<p class="empty-state">No houses found. Try a number or color.</p>';
  $$('#building-list [data-house]').forEach(button => button.onclick = () => { travel(button.dataset.house); $('#all-houses').focus({ preventScroll: true }); });
}

function renderHouse() {
  const b = house(state.selected);
  $('#house-controls').hidden = !b;
  if (!b) return;
  $('#selected-house').textContent = `${b.number} · ${b.name}`;
  $('#explode-building').innerHTML = `${icon('layers')}<span>${state.exploded ? 'Bring it together' : 'Unfold the floors'}</span><span aria-hidden="true">↗</span>`;
  $('#explode-building').setAttribute('aria-expanded', state.exploded);
  $('#explode-building').disabled = !scene;
  $('#floor-controls').hidden = !state.exploded;
  $('#floor-buttons').innerHTML = Array.from({ length: b.levels }, (_, floor) => `<button class="floor-button ${state.floor === floor ? 'active' : ''}" data-floor="${floor}" aria-pressed="${state.floor === floor}">${floor === 0 ? 'EG' : `${floor}. OG`}</button>`).join('');
  $$('[data-floor]').forEach(button => button.onclick = () => selectFloor(Number(button.dataset.floor)));
  renderFloor();
}

function selectFloor(floor) {
  if (!state.selected || (floor !== null && (!Number.isInteger(floor) || floor < 0 || floor >= house(state.selected).levels))) return;
  state.floor = floor;
  if (!state.exploded) { state.exploded = true; scene?.explode(true); renderHouse(); }
  scene?.setFloor(floor);
  $$('[data-floor]').forEach(button => { const active = Number(button.dataset.floor) === floor; button.classList.toggle('active', active); button.setAttribute('aria-pressed', active); });
  renderFloor();
}

function renderFloor() {
  const level = getInteriorLevel(interiors, state.selected, state.floor);
  $('#floor-detail summary').innerHTML = `${state.floor === null ? 'About these levels' : esc(level?.label || floorName(state.floor))}<span aria-hidden="true">＋</span>`;
  $('#floor-detail-content').innerHTML = level ? `<div class="room-grid">${level.spaces.map(space => `<span class="room-chip">${esc(space.label)}</span>`).join('')}</div><p>${level.elevation} m above building base. Approved outlines are visible on this floor.</p><small>${esc(level.source)} · reviewed ${esc(level.reviewedAt)}</small>` : `<p>${state.floor === null ? 'Each plate cuts through the actual exterior at its level. Upper sections follow the stepped roofs. Floor heights and room plans still need verification.' : 'This section follows the exterior at a provisional floor height. It does not identify occupied rooms or usable headroom. Room plans still need verification.'}</p><div class="floor-reference-actions"><button class="text-button" id="room-references">Published room designs ↗</button><button class="text-button" id="contribute-floor">Add a floor detail ↗</button></div>`;
  if ($('#contribute-floor')) $('#contribute-floor').onclick = () => correctionDialog(state.selected, state.floor);
  if ($('#room-references')) $('#room-references').onclick = () => roomReferencesDialog();
}

function setGroups(open, focus = false) {
  const changed = state.groupsOpen !== open;
  if (!open && state.groupsOpen && location.hash.startsWith('#group-')) {
    setHash(state.selected ? `house-${state.selected}` : 'campus');
  }
  state.groupsOpen = open;
  $('#open-groups').setAttribute('aria-expanded', open);
  document.body.classList.toggle('group-open', open);
  if (changed) animateGroupVisibility(open);
  if (!open) {
    qrRevision++;
    $$('.group-copy, .group-qr').forEach(element => element.classList.remove('is-changing'));
  }
  if (open) {
    setPicker(false);
    if (crowdedOverlays()) setTimeline(false);
    renderGroup();
    if (focus) $('#group-next').focus({ preventScroll: true });
  }
}

function animateGroupVisibility(open) {
  const deck = $('#group-deck');
  if (!open && deck.contains(document.activeElement)) $('#open-groups').focus({ preventScroll: true });
  const current = getComputedStyle(deck);
  const from = deck.hidden
    ? { opacity: 0, translate: '0 -8px', scale: '0.985' }
    : { opacity: current.opacity, translate: current.translate, scale: current.scale };
  groupVisibilityAnimation?.cancel();
  deck.inert = !open;
  if (reducedMotion()) {
    deck.hidden = !open;
    return;
  }
  deck.hidden = false;
  const animation = deck.animate([
    from,
    open ? { opacity: 1, translate: '0 0', scale: '1' } : { opacity: 0, translate: '0 -8px', scale: '0.985' },
  ], { duration: open ? 280 : 200, easing: 'cubic-bezier(.22,1,.36,1)' });
  groupVisibilityAnimation = animation;
  animation.finished.then(() => {
    if (groupVisibilityAnimation !== animation) return;
    groupVisibilityAnimation = null;
    deck.hidden = !state.groupsOpen;
  }).catch(() => {});
}

function resizeGroup(update) {
  const deck = $('#group-deck');
  const before = deck.getBoundingClientRect().height;
  groupSizeAnimation?.cancel();
  update();
  const after = deck.getBoundingClientRect().height;
  if (deck.hidden || !state.groupsOpen || reducedMotion() || Math.abs(before - after) < 1) return;
  const animation = deck.animate([{ height: `${before}px` }, { height: `${after}px` }], {
    duration: 300, easing: 'cubic-bezier(.22,1,.36,1)',
  });
  groupSizeAnimation = animation;
  animation.finished.then(() => {
    if (groupSizeAnimation === animation) groupSizeAnimation = null;
  }).catch(() => {});
}

function setGroupDetails(open) {
  resizeGroup(() => {
    state.groupDetails = open;
    $('#group-details').hidden = !open;
    $('#group-toggle-details').setAttribute('aria-expanded', open);
    $('#group-toggle-details').textContent = open ? 'Less ↑' : 'Details ↓';
    $('#group-deck').classList.toggle('details-open', open);
  });
  if (open && !reducedMotion()) $('#group-details').animate([
    { opacity: 0, translate: '0 -3px' }, { opacity: 1, translate: '0 0' },
  ], { duration: 260, easing: 'ease-out' });
}

async function renderGroup() {
  const group = groups[state.groupIndex];
  const revision = ++qrRevision;
  const changing = renderedGroupId !== null && renderedGroupId !== group.id;
  const animated = changing && !reducedMotion();
  if (animated) $$('.group-copy, .group-qr').forEach(element => element.classList.add('is-changing'));
  if (group.source && !qrCache.has(group.source)) {
    qrCache.set(group.source, QRCode.toString(group.source, {
      type: 'svg', margin: 4, width: 144, errorCorrectionLevel: 'M',
      color: { dark: '#292725ff', light: '#eee9e2ff' },
    }).catch(() => null));
  }
  const [svg] = await Promise.all([
    group.source ? qrCache.get(group.source) : null,
    animated ? new Promise(resolve => setTimeout(resolve, 90)) : null,
  ]);
  if (revision !== qrRevision || !state.groupsOpen) return;
  if ($('#group-details').contains(document.activeElement)) $('#group-toggle-details').focus({ preventScroll: true });
  setGroupDetails(false);
  $('#group-title').textContent = group.title;
  $('#group-kicker').textContent = group.category;
  $('#group-description').textContent = group.description;
  $('#group-location').innerHTML = `${icon('pin')} ${esc(group.house ? `House ${group.house} · ${group.location}` : group.location)} ↗`;
  $('#group-location').onclick = () => travel(group.house, { fromGroup: true });
  $('#group-position').textContent = `${String(state.groupIndex + 1).padStart(2, '0')} / ${groups.length}`;
  $('#group-status').textContent = group.source ? 'Public activity page' : 'Invite not connected yet';
  $('#group-qr').classList.toggle('is-locked', !group.source);
  $('#group-qr-label').textContent = group.source ? 'SCAN THE ACTIVITY PAGE' : 'RESIDENT INVITE';
  const action = $('#group-action');
  if (group.source) {
    action.href = group.source;
    action.textContent = 'Visit the group ↗';
    action.onclick = null;
    action.removeAttribute('role');
    $('#group-qr').innerHTML = svg || '<span class="qr-unavailable">Use the link ↗</span>';
    $('#group-qr').setAttribute('aria-label', svg ? `QR code for the public ${group.title} activity page` : 'QR unavailable. Open Details for the activity link.');
  } else {
    action.href = '#resident-access';
    action.setAttribute('role', 'button');
    action.textContent = 'Resident access ↗';
    action.onclick = event => { event.preventDefault(); privateAccess(group.title); };
    $('#group-qr').innerHTML = `${icon('lock')}<span>Residents<br>only</span>`;
    $('#group-qr').setAttribute('aria-label', 'Private resident invitation is not connected. No QR code is published.');
  }
  renderedGroupId = group.id;
  requestAnimationFrame(() => {
    if (revision === qrRevision) $$('.group-copy, .group-qr').forEach(element => element.classList.remove('is-changing'));
  });
}

function stepGroup(delta) {
  state.groupIndex = (state.groupIndex + delta + groups.length) % groups.length;
  const group = groups[state.groupIndex];
  travel(group.house, { fromGroup: true });
  renderGroup();
  setHash(`group-${group.id}`);
}

function setTimeline(open, focus = false) {
  state.timelineOpen = open;
  $('#timeline-panel').hidden = !open;
  $('#open-timeline').setAttribute('aria-expanded', open);
  document.body.classList.toggle('timeline-open', open);
  if (open) {
    setPicker(false);
    if (crowdedOverlays()) setGroups(false);
    renderTimeline();
    if (focus) $('#close-timeline').focus({ preventScroll: true });
  }
}

function renderTimeline() {
  const drafts = orderedDrafts(state.drafts);
  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Europe/Berlin' }).format(new Date());
  let previousDay = '';
  $('#timeline-content').innerHTML = `<div class="timeline-day"><span class="timeline-dot"></span><span>${esc(today)}</span><small>NOW</small></div>${drafts.length ? drafts.map(event => {
    const day = new Date(`${event.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const label = event.date !== previousDay ? `<div class="timeline-day"><span class="timeline-dot"></span><span>${day}</span></div>` : '';
    previousDay = event.date;
    return `${label}<article class="timeline-entry"><span class="timeline-time">${esc(event.time)}</span><button class="timeline-event-button" data-event="${event.id}"><span class="timeline-audience">LOCAL DRAFT · HOUSE ${esc(event.house)}</span><strong>${esc(event.title)}</strong><small>${esc(event.description || 'A plan taking shape.')}</small><span class="timeline-location">View plan ↗</span></button></article>`;
  }).join('') : `<div class="timeline-empty"><span class="timeline-dot"></span><h3>Room for something good.</h3><p>No community events are connected yet.</p><p>Start a little plan. Keep it here, or export it to your calendar.</p></div>`}<p class="timeline-note">Europe/Berlin · ${drafts.length ? 'These drafts belong only to this open tab.' : 'A quiet board, waiting for the community.'}</p>`;
  $$('[data-event]').forEach(button => button.onclick = () => eventDialog(button.dataset.event));
  $('#open-timeline').dataset.count = String(drafts.length);
  $('#open-timeline').setAttribute('aria-label', `Open timeline${drafts.length ? `, ${drafts.length} local drafts` : ''}`);
}

function eventDraftDialog() {
  modal(`<div class="modal-eyebrow">A SMALL PLAN</div><h2 class="modal-title">Make something happen.</h2><p class="modal-lead">Add a draft to this tab’s timeline. Nothing is published or sent.</p><form id="event-form"><label class="form-field">What’s the plan?<input name="title" required maxlength="120" placeholder="Sunday bike ride…"></label><div class="form-row"><label class="form-field">Date<input type="date" name="date" required></label><label class="form-field">Time · Berlin<input type="time" name="time" required value="18:00"></label></div><div class="form-row"><label class="form-field">Minutes<input type="number" name="duration" min="15" max="1440" step="15" value="60" required></label><label class="form-field">House<select name="house">${campus.buildings.map(b => `<option ${b.number === state.selected ? 'selected' : ''}>${b.number}</option>`).join('')}</select></label></div><label class="form-field">A few words<textarea name="description" maxlength="1500" rows="3" placeholder="Meet by the entrance, bring a friend…"></textarea></label><button class="full-button" type="submit">Add to my local timeline ↗</button><p class="field-note">Export a draft to keep it after closing or reloading this tab.</p></form>`);
  $('#event-form').onsubmit = event => {
    event.preventDefault();
    const draft = { id: crypto.randomUUID(), ...Object.fromEntries(new FormData(event.target)) };
    state.drafts.push(draft);
    $('#modal').close();
    setTimeline(true);
    toast('Draft added to this tab’s timeline.');
  };
}

function eventDialog(id) {
  const event = state.drafts.find(draft => draft.id === id);
  if (!event) return;
  modal(`<div class="modal-eyebrow">LOCAL DRAFT · HOUSE ${esc(event.house)}</div><h2 class="modal-title">${esc(event.title)}</h2><p class="modal-lead">${esc(event.date)} · ${esc(event.time)} Europe/Berlin · ${esc(event.duration)} min</p><p class="event-description">${esc(event.description)}</p><div class="modal-actions"><button class="full-button" id="export-event">Export calendar file ↓</button><button class="outline-button" id="event-place">Find House ${esc(event.house)} ↗</button><button class="text-button" id="remove-event">Remove this draft</button></div><p class="field-note">A personal draft. No invitations or notifications have been sent.</p>`);
  $('#export-event').onclick = () => downloadFile('rommelweb-event-draft.ics', calendarDraft(event), 'text/calendar;charset=utf-8');
  $('#event-place').onclick = () => { $('#modal').close(); setTimeline(false); travel(event.house); };
  $('#remove-event').onclick = () => { state.drafts = state.drafts.filter(draft => draft.id !== id); $('#modal').close(); renderTimeline(); toast('Local draft removed.'); };
}

function privateAccess(title = 'Your resident community') {
  modal(`<div class="modal-eyebrow">THE RESIDENT SIDE · PLANNED</div><h2 class="modal-title">${esc(title)}</h2><p class="modal-lead">A little community. A private doorstep.</p><p>Private group invitations will require current, verified residency. That service is not connected yet, so no WhatsApp invite or resident QR is exposed here.</p><p>Neighbor discovery and knocking will be opt-in. Membership expires when you leave; group admins still manage WhatsApp removal.</p><a class="outline-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/ARCHITECTURE.md" target="_blank" rel="noopener">Read the resident architecture ↗</a>`);
}

function toolsDialog() {
  modal(`<div class="modal-eyebrow">ROMMELWEB / FIELD NOTES</div><h2 class="modal-title">A place taking shape.</h2><p class="modal-lead">Eleven real houses. A community we can build together.</p><div class="tool-links"><button class="outline-button" id="tools-rooms">Published room designs ↗</button><button class="outline-button" id="tools-sources">Model & façade sources ↗</button><button class="outline-button" id="tools-correction">Add a building detail ↗</button><button class="outline-button" id="tools-resident">Resident privacy & knocking ↗</button><a class="outline-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/ARCHITECTURE.md" target="_blank" rel="noopener">Architectural brief ↗</a></div><p class="field-note">Click a house to explore · click empty space to return · drag to orbit · scroll to zoom · arrow keys on the map to orbit · / to find a house · Escape to close an overlay.</p><p class="field-note">Independent resident project. <a href="https://rommelwood.de/" target="_blank" rel="noopener">Meet Rommelwood e.V. ↗</a></p>`);
  $('#tools-rooms').onclick = () => roomReferencesDialog();
  $('#tools-sources').onclick = () => { $('#modal').close(); accuracyDialog(); };
  $('#tools-correction').onclick = () => { $('#modal').close(); correctionDialog(); };
  $('#tools-resident').onclick = () => { $('#modal').close(); privateAccess(); };
}

function roomReferencesDialog(campusId = house(state.selected)?.campus || 'I') {
  const reference = roomReferences[campusId];
  if (!reference) return;
  const alreadyOpen = $('#modal').open;
  const returnFocus = lastFocus;
  modal(`<div class="modal-eyebrow">PUBLISHED ROOM REFERENCES</div><h2 class="modal-title">A first look inside.</h2><p class="modal-lead">Examples from the resident association and operator. These drawings are not assigned to individual rooms on the map.</p><div class="reference-tabs" role="group" aria-label="Choose a campus">${Object.keys(roomReferences).map(id => `<button class="outline-button" data-reference-campus="${id}" aria-pressed="${campusId === id}">Süd ${id} · ${id === 'I' ? 'older' : 'newer'} houses</button>`).join('')}</div><p class="field-note">${esc(reference.houses)}</p><div class="source-list">${reference.plans.map(plan => `<div class="source-item"><strong>${esc(plan.title)}</strong><p>${esc(plan.description)}</p><a href="${plan.url}" target="_blank" rel="noopener">${esc(plan.label)} ↗</a></div>`).join('')}<div class="source-item"><strong>Operator’s 2026 room categories</strong><p>${esc(reference.categories)}</p><p class="field-note">These are category averages including proportional communal areas, not clear-room dimensions or a whole shared apartment’s area.</p><a href="${reference.operatorUrl}" target="_blank" rel="noopener">Open the operator’s factsheet · PDF ↗</a></div></div><p class="source-note">Sketch dimensions are approximate; centimetres are inferred from the drawings. Rooms may be mirrored. Clear ceiling height does not establish floor-to-floor height. <a href="${roomReferenceSource}" target="_blank" rel="noopener">Read Rommelwood’s original notes ↗</a></p>`);
  if (alreadyOpen) lastFocus = returnFocus;
  $$('[data-reference-campus]').forEach(button => button.onclick = () => {
    roomReferencesDialog(button.dataset.referenceCampus);
    $(`[data-reference-campus="${button.dataset.referenceCampus}"]`).focus({ preventScroll: true });
  });
}

function accuracyDialog() {
  const model = lod2.buildings.find(building => building.number === state.selected);
  modal(`<div class="modal-eyebrow">THE MODEL / ${state.selected ? `HOUSE ${state.selected}` : 'CAMPUS'}</div><h2 class="modal-title">Real shape. Visible craft.</h2><div class="source-list"><div class="source-item"><strong>Verified exterior source</strong><p>Eleven address-matched LoD2 models, 289 wall, roof and ground surfaces.${model ? ` House ${state.selected}: ${model.height.toFixed(2)} m high, model date ${model.creationDate}.` : ''} Source geometry remains in metres; the camera makes the houses feel closer.</p><a href="${lod2.metadata.url}" target="_blank" rel="noopener">Bavaria’s official model ↗</a></div><div class="source-item"><strong>Photo-informed façade linework</strong><p>Vertical timber seams and staggered window frames on the newer residential houses; horizontal plates on the older ones. These are schematic material patterns. Seam spacing, floor bands and opening positions are not a measured façade survey.</p><a href="https://github.com/mteyra/rommelweb/blob/main/docs/FACADE-REFERENCES.md" target="_blank" rel="noopener">Material references ↗</a> · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/WINDOW-REFERENCES.md" target="_blank" rel="noopener">Window study ↗</a></div><div class="source-item"><strong>Interiors still need your knowledge</strong><p>Floor counts come from OSM. Unfolded floor intervals are provisional until approved plans arrive. There are no invented room numbers, resident locations or occupancy records.</p></div></div><p class="source-note">Datenquelle: Bayerische Vermessungsverwaltung – <a href="https://www.geodaten.bayern.de" target="_blank" rel="noopener">www.geodaten.bayern.de</a> · CC BY 4.0. Reprojected for the web. Floor references © OpenStreetMap contributors, ODbL. LoD2 footprint reference: 2025-10-14. No façade photographs are bundled.</p>`);
}

function correctionDialog(number = state.selected || '', floor = state.floor) {
  modal(`<div class="modal-eyebrow">FROM THE OUTSIDE IN</div><h2 class="modal-title">You know this place.</h2><p class="modal-lead">Make a correction file to share with the project. Nothing is uploaded.</p><form id="correction-form"><div class="form-row"><label class="form-field">House<select name="house" required><option value="">Choose a house</option>${campus.buildings.map(b => `<option value="${b.number}" ${b.number === number ? 'selected' : ''}>${b.number} · ${b.name}</option>`).join('')}</select></label><label class="form-field">Floor, if relevant<input type="number" name="floor" min="0" max="7" placeholder="0 = ground floor" value="${floor == null ? '' : floor}"></label></div><label class="form-field">What needs adding?<select name="kind"><option value="interior">Floor plan / room numbering</option><option value="facade">Façade / materials / openings</option><option value="entrance">Entrance / accessibility</option><option value="community">Club or shared space</option></select></label><label class="form-field">Your observation<textarea name="observation" required maxlength="3000" rows="4"></textarea></label><label class="form-field">Evidence or drawing reference<input name="evidence" maxlength="500" placeholder="Source, measurement or drawing date"></label><p class="field-note">Building details only: leave out resident names, private invitations, occupancy and access codes.</p><button class="full-button" type="submit">Download correction ↓</button></form>`);
  $('#correction-form').onsubmit = event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.target));
    if (values.floor !== '' && Number(values.floor) >= house(values.house).levels) {
      event.target.elements.floor.setCustomValidity(`This model has floors 0–${house(values.house).levels - 1}. Describe a floor-count change in your observation.`);
      event.target.elements.floor.reportValidity();
      return;
    }
    downloadFile(`rommelweb-house-${values.house}-correction.json`, JSON.stringify({ schemaVersion: 1, status: 'unreviewed-proposal', createdAt: new Date().toISOString(), ...values }, null, 2));
    $('#modal').close();
    toast('Correction downloaded.');
  };
  $('#correction-form').elements.floor.oninput = event => event.target.setCustomValidity('');
  $('#correction-form').elements.house.onchange = () => $('#correction-form').elements.floor.setCustomValidity('');
}

function activateFallback() {
  scene?.dispose();
  scene = null;
  state.exploded = false;
  state.floor = null;
  $('#map-labels').replaceChildren();
  fallbackMap($('#scene'), campus, number => travel(number));
  $('#scene-caption').textContent = '2D view · choose a house to explore.';
  renderHouse();
}

async function init() {
  try {
    [campus, lod2, interiors] = await Promise.all(['campus.json', 'lod2.json', 'interiors.json'].map(async file => {
      const response = await fetch(`${base}data/${file}`);
      if (!response.ok) throw new Error(`Map data unavailable (${response.status})`);
      return response.json();
    }));
    validateInteriorData(interiors, campus, lod2);
    campus.buildings.forEach(building => {
      const model = lod2.buildings.find(item => item.number === building.number);
      Object.assign(building, { height: model.height, baseY: model.baseY, footprint: model.groundPolygons[0] });
    });
    groups = [...clubs, ...campus.buildings.map(building => ({ id: `house-${building.number}`, title: `House ${building.number}`, category: `${building.name.toUpperCase()} / WHATSAPP`, house: building.number, location: `Campus Süd ${building.campus}`, description: 'The little conversations that make a house a home. A private space for the people who live here.', source: null }))];
    try { scene = new CampusScene($('#scene'), $('#map-labels'), campus, lod2, interiors, number => travel(number), selectFloor); }
    catch (error) { console.warn('3D unavailable; using the map fallback.', error); activateFallback(); }
    setTheme(state.theme);
    await scene?.pathLoad;
    $('#scene-loading').hidden = true;
    renderDirectory();
    renderTimeline();
    $('#home-button').onclick = () => travel(null);
    $('#close-house').onclick = () => { travel(null); $('#all-houses').focus({ preventScroll: true }); };
    $('#all-houses').onclick = () => setPicker(!state.pickerOpen, true);
    $('#building-search').oninput = event => { state.search = event.target.value; renderDirectory(); };
    $('#open-groups').onclick = () => {
      if (!state.groupsOpen) {
        state.groupIndex = state.selected ? groups.findIndex(group => group.id === `house-${state.selected}`) : 0;
        travel(groups[state.groupIndex].house, { fromGroup: true });
      }
      setGroups(!state.groupsOpen, true);
      if (state.groupsOpen) setHash(`group-${groups[state.groupIndex].id}`);
    };
    $('#group-prev').onclick = () => stepGroup(-1);
    $('#group-next').onclick = () => stepGroup(1);
    $('#group-toggle-details').onclick = () => setGroupDetails(!state.groupDetails);
    $('#group-deck').addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); event.stopPropagation(); stepGroup(event.key === 'ArrowLeft' ? -1 : 1); }
    });
    $('#open-timeline').onclick = () => setTimeline(!state.timelineOpen, true);
    $('#close-timeline').onclick = () => { setTimeline(false); $('#open-timeline').focus(); };
    $('#draft-event').onclick = eventDraftDialog;
    $('#open-tools').onclick = toolsDialog;
    $('#toggle-theme').onclick = () => setTheme(state.theme === 'night' ? 'day' : 'night');
    $('#accuracy-button').onclick = accuracyDialog;
    $('#explode-building').onclick = () => {
      state.exploded = !state.exploded;
      state.floor = null;
      scene?.explode(state.exploded);
      scene?.setFloor(null);
      renderHouse();
      $('#scene-caption').textContent = state.exploded ? 'Sections through the exterior. Room plans come next.' : 'Photo-informed linework on the official exterior.';
    };
    $('#all-floors').onclick = () => selectFloor(null);
    matchMedia('(max-width: 1100px)').addEventListener('change', event => {
      if (event.matches && state.groupsOpen && state.timelineOpen) setTimeline(false);
    });
    document.addEventListener('rommel:webgl-lost', activateFallback);
    document.addEventListener('keydown', event => {
      if ($('#modal').open) return;
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !document.activeElement.isContentEditable) { event.preventDefault(); setPicker(true, true); }
      if (event.key === 'Escape') {
        if (state.pickerOpen) { setPicker(false); $('#all-houses').focus(); }
        else if (state.timelineOpen) { setTimeline(false); $('#open-timeline').focus(); }
        else if (state.groupsOpen) { setGroups(false); $('#open-groups').focus(); }
      }
    });
    const followLocation = () => {
      const hash = location.hash.slice(1);
      if (hash === 'campus') travel(null);
      if (hash.startsWith('house-')) travel(hash.slice(6));
      if (hash.startsWith('group-')) {
        const index = groups.findIndex(group => group.id === hash.slice(6));
        if (index >= 0) { state.groupIndex = index; travel(groups[index].house, { fromGroup: true }); setGroups(true); }
      }
    };
    window.addEventListener('hashchange', followLocation);
    followLocation();
    document.body.dataset.ready = 'true';
  } catch (error) {
    console.error(error);
    $('#scene-loading').innerHTML = '<strong>The campus couldn’t load.</strong><small>Check your connection, then reload.</small><button id="reload-map" class="outline-button">Try again</button>';
    $('#reload-map').onclick = () => location.reload();
  }
}
init();
