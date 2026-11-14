import './styles.css';
import { CampusScene, fallbackMap } from './scene.js';
import { clubs, filterBuildings, floorName, escapeHTML as esc, downloadFile } from './data.js';
import { icon } from './icons.js';
import { validateInteriorData, getInteriorLevel } from './interiors.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const state = { selected: null, campus: 'all', search: '', floor: null, exploded: false, layer: 'buildings', view: 'map', calendar: new Date() };
let campus, lod2, interiors, scene, toastTimer, lastFocus;
const base = import.meta.env.BASE_URL;

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4200);
}

function modal(html) {
  lastFocus = document.activeElement;
  $('#modal-body').innerHTML = html;
  $('#modal-body .modal-title').id = 'modal-title';
  $('#modal').setAttribute('aria-labelledby', 'modal-title');
  $('#modal').showModal();
}

$('#modal-close').addEventListener('click', () => $('#modal').close());
$('#modal').addEventListener('close', () => lastFocus?.focus());
$('#modal').addEventListener('click', event => { if (event.target === $('#modal')) $('#modal').close(); });

function privateAccess(feature = 'Your resident community') {
  modal(`<div class="modal-eyebrow">${icon('lock')} RESIDENT SPACE · PLANNED</div>
    <h2 class="modal-title">${feature}</h2><p class="modal-lead">The map is open. Your doorstep stays private.</p>
    <p>This first release is the public campus atlas. Resident accounts and the secure service are not connected yet.</p>
    <ol class="modal-list"><li><strong>Verified here, not just at university.</strong> A residence steward confirms your current house membership.</li><li><strong>Access that expires.</strong> Moving out or an expired membership removes private access.</li><li><strong>You choose your visibility.</strong> Neighbor discovery and knocking start switched off. No public names on rooms.</li></ol>
    <div class="notice">WhatsApp invitations will be released only through the secure resident service. Group admins will still need to manage WhatsApp membership and forwarded links.</div>
    <button class="full-button" id="access-blueprint">Read the resident architecture ${icon('arrow')}</button>`);
  $('#access-blueprint').onclick = () => { $('#modal').close(); setView('blueprint'); };
}

function renderDirectory() {
  const focusedHouse = document.activeElement?.classList.contains('building-item') ? document.activeElement.dataset.house : null;
  const buildings = filterBuildings(campus.buildings, state.search, state.campus);
  $('#house-count').textContent = buildings.length;
  $('#building-list').innerHTML = buildings.length ? buildings.map(b => `
    <button class="building-item ${state.selected === b.number ? 'selected' : ''}" data-house="${b.number}" aria-pressed="${state.selected === b.number}">
      <span class="building-swatch" style="--house-color:${b.color}"></span>
      <span class="building-number">${b.number}</span><span class="building-meta"><strong>${b.name}</strong><span>Campus Süd ${b.campus} · ${b.levels} levels</span></span>
      <span class="building-arrow">↗</span>
    </button>`).join('') : '<p class="empty-state">No houses match. Try a street number or color.</p>';
  $$('#building-list [data-house]').forEach(button => button.onclick = () => selectHouse(button.dataset.house));
  if (focusedHouse) $(`#building-list [data-house="${focusedHouse}"]`)?.focus({ preventScroll: true });
}

function welcomeGraphic() {
  return `<svg class="welcome-graphic" viewBox="0 0 250 138" fill="none" aria-hidden="true">
    <path d="m14 102 106-62 116 67-105 29Z" fill="#e4ebd9"/>
    <g stroke="#729177" stroke-width=".8"><path d="m40 91 34-20 29 17-34 20Z M40 91V55l34-20 29 17v36M40 55l29 17 34-20M69 72v36M40 67l29 17 34-20M40 79l29 17 34-20"/>
    <path d="m127 78 37-21 30 17-37 22Z M127 78V28l37-21 30 17v50M127 28l30 17 37-21M157 45v51M127 45l30 17 37-21M127 62l30 17 37-21"/>
    <path d="m88 108 32-18 28 16-32 19Z M88 108V78l32-18 28 16v30M88 78l28 17 32-19M116 95v30M88 93l28 17 32-19"/></g>
    <circle cx="200" cy="44" r="6" fill="#d4e79d"/><path d="M200 50v11M24 112h7m-3-3v6" stroke="#739273"/></svg>`;
}

function renderWelcome() {
  $('#inspector').innerHTML = `<div class="inspector-top"><span class="eyebrow">WELCOME TO THE NEIGHBORHOOD</span><span class="badge">EARLY BUILD</span></div>
    ${welcomeGraphic()}<h2 class="welcome-message">Less next door.<br>More together.</h2>
    <p class="inspector-intro">Find your house, discover a shared space, and imagine a more connected Rommelwood.</p>
    <div class="stats-grid"><div class="stat"><strong>11</strong><span>houses</span></div><div class="stat"><strong>2</strong><span>campuses</span></div><div class="stat"><strong>1</strong><span>community</span></div></div>
    <div class="inspector-section"><div class="section-label">START EXPLORING <span>01 — 03</span></div>
    <button class="club-link" data-select="55"><span class="club-icon">${icon('film')}</span><span><strong>A movie with the neighbors</strong><small>Rommelkino · House 55</small></span><span>↗</span></button>
    <button class="club-link" data-select="57"><span class="club-icon">${icon('bike')}</span><span><strong>A little help with your bike</strong><small>Workshop · House 57</small></span><span>↗</span></button>
    <button class="club-link" data-select="59"><span class="club-icon">${icon('leaf')}</span><span><strong>Something good growing</strong><small>Community garden · House 59</small></span><span>↗</span></button></div>
    <div class="status-card">${icon('lock')}<div><strong>A community built on trust.</strong><p>Resident spaces will be verified, private, and always opt-in.</p><button id="welcome-privacy">How it will work ↗</button></div></div>
    <button id="welcome-sources" class="source-note">Official 3D geometry. Honest unknowns. ↗</button>`;
  $$('[data-select]').forEach(b => b.onclick = () => selectHouse(b.dataset.select));
  $('#welcome-privacy').onclick = () => privateAccess();
  $('#welcome-sources').onclick = accuracyDialog;
}

function selectHouse(number, focus = true) {
  if (number && !campus.buildings.some(b => b.number === number)) return;
  state.selected = number;
  state.floor = null;
  state.exploded = false;
  $('#top-view').setAttribute('aria-pressed', 'false');
  scene?.select(number, focus);
  renderDirectory();
  if (number) {
    renderInspector();
    $('#selection-breadcrumb').textContent = `/ HOUSE ${number}`;
    $('#scene-caption').textContent = 'Select “Unfold levels” to look inside the model.';
  } else {
    renderWelcome();
    $('#selection-breadcrumb').textContent = '';
    $('#scene-caption').textContent = 'Your campus, from a different angle.';
  }
  const hash = number ? `#house-${number}` : '#map';
  history.replaceState(null, '', hash);
  if (matchMedia('(max-width: 760px)').matches && number) $('#inspector').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
}

function renderInspector() {
  const b = campus.buildings.find(b => b.number === state.selected);
  const model = lod2.buildings.find(m => m.number === b.number);
  const houseClubs = clubs.filter(c => c.house === b.number);
  $('#inspector').innerHTML = `<div class="inspector-top"><span class="eyebrow">YOUR NEIGHBORHOOD / SÜD ${b.campus}</span><button class="close-inspector" id="close-inspector" aria-label="Back to campus overview">×</button></div>
    <div class="inspector-title"><span class="house-number" style="--house-color:${b.color}">${b.number}</span><div><span class="eyebrow">ERWIN-ROMMEL-STRASSE</span><h2 class="house-name">${b.name}</h2><span class="wing-label">Internal ${b.wings.length > 1 ? 'wings' : 'house'} ${b.wings.join(' + ')}</span></div></div>
    <div class="stats-grid"><div class="stat"><strong>${b.levels}</strong><span>mapped levels</span></div><div class="stat"><strong>${model.height.toFixed(1)}<small> m</small></strong><span>LoD2 height</span></div></div>
    <div class="model-status"><span class="status-dot"></span> OFFICIAL EXTERIOR MODEL <button id="building-evidence">ⓘ</button></div>
    <button id="explode-building" class="full-button" ${scene ? '' : 'disabled'} aria-pressed="${state.exploded}">${icon('layers')} ${state.exploded ? 'Reassemble exterior' : 'Unfold levels'} <span>↗</span></button>
    <div class="floor-controls ${state.exploded ? 'open' : ''}" id="floor-controls" ${state.exploded ? '' : 'hidden'}>
      <div class="section-label">LEVEL STUDY <button id="all-floors">Show all</button></div>
      <div class="floor-grid">${Array.from({ length: b.levels }, (_, i) => `<button class="floor-button ${state.floor === i ? 'active' : ''}" data-floor="${i}" aria-pressed="${state.floor === i}">${i === 0 ? 'EG' : `${i}. OG`}</button>`).join('')}</div>
      <p class="info-note">Floor count from OSM. ${interiors.buildings[b.number] ? 'Approved floor elevations anchor this study; other levels are interpolated.' : 'Equal floor spacing is illustrative; actual floor heights and interior walls still need plans.'}</p>
      <div id="floor-detail"></div>
    </div>
    <div class="inspector-section"><div class="section-label">THE HOUSE COMMUNITY ${icon('lock')}</div>
      <button id="house-group" class="club-link"><span class="club-icon">${icon('chat')}</span><span><strong>House ${b.number} group</strong><small>WhatsApp · verified residents only</small></span>${icon('lock')}</button>
      <button id="neighbors" class="club-link"><span class="club-icon">${icon('pin')}</span><span><strong>Meet your neighbors</strong><small>Opt-in discovery & knocking · planned</small></span><span>↗</span></button>
    </div>
    ${houseClubs.length ? `<div class="inspector-section"><div class="section-label">ROOTED HERE <span>${houseClubs.length}</span></div>${houseClubs.map(c => `<button class="club-link" data-club="${c.id}"><span class="club-icon">${icon(c.icon)}</span><span><strong>${c.title}</strong><small>${c.location}</small></span><span>↗</span></button>`).join('')}</div>` : `<div class="info-note">Know a shared space in this house? Help us place it on the map.</div>`}
    <button id="correct-house" class="outline-button">Add a detail about this house ${icon('arrow')}</button>
    <p class="source-note">LoD2-BY · footprint reference ${model.footprintCurrency}<br>Exterior model ${model.creationDate} · <button id="model-source">View evidence ↗</button></p>`;
  $('#close-inspector').onclick = () => selectHouse(null);
  $('#building-evidence').onclick = accuracyDialog;
  $('#model-source').onclick = accuracyDialog;
  $('#explode-building').onclick = () => {
    state.exploded = !state.exploded;
    state.floor = null;
    scene?.explode(state.exploded);
    scene?.setFloor(null);
    renderInspector();
    $('#explode-building').focus({ preventScroll: true });
    $('#scene-caption').textContent = state.exploded ? 'Level study · floor positions and interiors are provisional.' : 'Official exterior · roof and wall surfaces from LoD2-BY.';
  };
  $$('.floor-button').forEach(button => button.onclick = () => selectFloor(Number(button.dataset.floor)));
  $('#all-floors').onclick = () => selectFloor(null);
  $('#house-group').onclick = () => privateAccess(`House ${b.number} · WhatsApp`);
  $('#neighbors').onclick = neighborDialog;
  $('#correct-house').onclick = () => contributeDialog(b.number);
  $$('[data-club]').forEach(button => button.onclick = () => clubDialog(button.dataset.club));
  renderFloor();
}

function selectFloor(floor) {
  if (!state.selected) return;
  state.floor = floor;
  if (!state.exploded) { state.exploded = true; scene?.explode(true); renderInspector(); }
  scene?.setFloor(floor);
  $$('.floor-button').forEach(button => {
    const active = Number(button.dataset.floor) === floor;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active);
  });
  renderFloor();
}

function renderFloor() {
  if (!$('#floor-detail')) return;
  if (state.floor == null) { $('#floor-detail').innerHTML = '<p class="field-note">Choose a level to inspect its room-data status.</p>'; return; }
  const level = getInteriorLevel(interiors, state.selected, state.floor);
  $('#floor-detail').innerHTML = `<div class="section-label">${esc(level?.label || floorName(state.floor))}</div>${level ?
    `<div class="room-grid">${level.spaces.map(space => `<span class="room-chip" title="${esc(space.kind)}">${esc(space.label)}</span>`).join('')}</div><p class="info-note">Approved plan geometry · ${level.elevation} m above building base. Select top view to inspect the outlines.</p><p class="source-note">${esc(level.source)} · reviewed ${esc(level.reviewedAt)}. Geometry only; no occupancy information.</p>` :
    `<div class="floor-empty">${icon('layers')}<strong>Let’s map this floor together.</strong><p>Verified room numbering and interior boundaries haven’t been added. No room layout is inferred.</p><button id="contribute-floor">Add a floor detail ↗</button></div>`}`;
  if ($('#contribute-floor')) $('#contribute-floor').onclick = () => contributeDialog(state.selected, state.floor);
}

function neighborDialog() {
  modal(`<div class="modal-eyebrow">${icon('chat')} THE DIGITAL DOORSTEP · PROPOSED</div><h2 class="modal-title">A friendly knock.<br>On your terms.</h2>
    <p class="modal-lead">You can belong without putting your name on a public door.</p>
    <div class="neighbor-preview"><span class="avatar-placeholder">↗</span><div><strong>A verified neighbor would like to say hello.</strong><p>Only when you’ve chosen to be discoverable.</p></div><span class="badge">CONCEPT</span></div>
    <ol class="modal-list"><li><strong>Choose your circle.</strong> Stay hidden, or opt into building, floor or shared-interest discovery. Room disclosure stays optional.</li><li><strong>Receive a request.</strong> No unrestricted stranger messages, live location, online status or read receipts.</li><li><strong>Accept, ignore, block or report.</strong> Requests expire. Rate limits and moderation apply.</li></ol>
    <div class="notice">This is an interaction concept. There are no resident profiles, accounts or messages in this public release.</div>`);
}

function clubDialog(id) {
  const c = clubs.find(c => c.id === id);
  modal(`<div class="modal-eyebrow">${icon(c.icon)} ${c.category}</div><h2 class="modal-title">${c.title}</h2><p class="modal-lead">${c.description}</p>
    <p>${icon('pin')} ${c.location}</p><div class="notice">This is a sourced community listing. Schedules, membership and access arrangements should be checked with the organizers.</div>
    <div class="modal-actions"><a class="full-button" href="${c.source}" target="_blank" rel="noopener">Visit the official activity page ↗</a>${c.house ? `<button class="outline-button" id="club-map">Find House ${c.house} on the map</button>` : ''}</div>`);
  if ($('#club-map')) $('#club-map').onclick = () => { $('#modal').close(); setView('map'); selectHouse(c.house); };
}

function accuracyDialog() {
  const number = state.selected;
  const model = number ? lod2.buildings.find(b => b.number === number) : null;
  modal(`<div class="modal-eyebrow">SOURCE REGISTER / ${number ? `HOUSE ${number}` : 'CAMPUS'}</div><h2 class="modal-title">Real geometry.<br>Visible unknowns.</h2>
    <p class="modal-lead">The exterior comes from Bavaria’s official LoD2 open data, with all eleven buildings matched by street address.</p>
    <div class="source-list">
      <div class="source-item"><span class="badge">SOURCED</span><div><strong>Exterior walls, roof surfaces & height</strong><p>LoD2-BY ${model ? `· model height ${model.height} m · created ${model.creationDate}` : '· 289 model surfaces'}. Standardized exterior models, not façade or interior surveys.</p><a href="${lod2.metadata.url}" target="_blank" rel="noopener">Bayerische Vermessungsverwaltung ↗</a></div></div>
      <div class="source-item"><span class="badge">MAPPED</span><div><strong>Storey counts, paths and trees</strong><p>OpenStreetMap, retrieved 14 November 2026. Community-maintained and subject to corrections.</p><a href="${number ? campus.buildings.find(b => b.number === number).osmUrl : campus.metadata.sources[0].url}" target="_blank" rel="noopener">Inspect OpenStreetMap source ↗</a></div></div>
      <div class="source-item"><span class="badge pending">PROVISIONAL</span><div><strong>Floor spacing & interior layout</strong><p>Exploded levels use evenly spaced footprint envelopes. Verified room walls, floor elevations, doors and entrances are still needed. A public room index exists but has not been imported into this release.</p></div></div>
    </div><p class="field-note">Footprint reference date: ${model?.footprintCurrency || '2025-10-14'}. Retrieval date is not a survey date. The terrain surface is schematic; relative building base elevations are preserved.</p>
    <p class="source-note">Datenquelle: Bayerische Vermessungsverwaltung – <a href="https://www.geodaten.bayern.de" target="_blank" rel="noopener">www.geodaten.bayern.de</a> · <a href="${lod2.metadata.licenseUrl}" target="_blank" rel="noopener">CC BY 4.0</a>. Reprojected and converted for web display. Context © OpenStreetMap contributors, ODbL.</p>`);
}

function contributeDialog(number = state.selected || '', floor = state.floor) {
  modal(`<div class="modal-eyebrow">BUILDING THE MAP TOGETHER</div><h2 class="modal-title">You know this place.<br>Help us get it right.</h2><p class="modal-lead">Create a correction file for the project. Nothing is sent or published from this form.</p>
    <form id="correction-form"><div class="form-row"><label class="form-field">House<select name="house" required><option value="">Choose a house</option>${campus.buildings.map(b => `<option value="${b.number}" ${b.number === number ? 'selected' : ''}>${b.number} · ${b.name}</option>`).join('')}</select></label>
    <label class="form-field">Floor, if relevant<input name="floor" type="number" min="0" max="7" placeholder="0 = ground floor" value="${floor == null ? '' : floor}"></label></div>
    <label class="form-field">What needs adding or correcting?<select name="kind"><option value="interior">Floor layout / room numbering</option value="entrance">Entrance / accessibility</option><option value="geometry">Building geometry</option><option value="community">Shared space / club location</option></select></label>
    <label class="form-field">Your observation<textarea name="observation" required rows="4" maxlength="3000" placeholder="For example: the entrance is on the east side; the ground floor is labelled EG…"></textarea></label>
    <label class="form-field">Evidence / plan reference (optional)<input name="evidence" maxlength="500" placeholder="A measurement, drawing date, or source URL"></label>
    <p class="field-note">Include only building information you are allowed to share. Leave out resident names, access codes, private invitations and occupancy details.</p>
    <button type="submit" class="full-button">Download correction file ↓</button></form>`);
  $('#correction-form').onsubmit = e => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.target));
    const building = campus.buildings.find(b => b.number === values.house);
    if (values.floor !== '' && Number(values.floor) >= building.levels) {
      e.target.elements.floor.setCustomValidity(`The current model has floors 0–${building.levels - 1}. Describe a floor-count correction in the observation instead.`);
      e.target.elements.floor.reportValidity();
      return;
    }
    downloadFile(`rommelweb-house-${values.house}-correction.json`, JSON.stringify({ schemaVersion: 1, status: 'unreviewed-proposal', createdAt: new Date().toISOString(), ...values }, null, 2));
    $('#modal').close();
    toast('Correction downloaded. Share it with the project when you are ready.');
  };
  $('#correction-form').elements.floor.oninput = e => e.target.setCustomValidity('');
  $('#correction-form').elements.house.onchange = () => $('#correction-form').elements.floor.setCustomValidity('');
}

function setView(view) {
  state.view = view;
  $('.skip-link').href = view === 'map' ? '#directory' : `#${view}-view`;
  for (const id of ['map', 'community', 'events', 'blueprint']) $(`#${id}-view`).hidden = view !== id;
  $$('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  history.replaceState(null, '', view === 'map' && state.selected ? `#house-${state.selected}` : `#${view}`);
  if (view === 'community') renderCommunity();
  if (view === 'events') renderEvents();
  if (view === 'blueprint') renderBlueprint();
  if (view === 'map') requestAnimationFrame(() => scene?.resize());
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function renderCommunity() {
  $('#community-view').innerHTML = `<div class="page-heading"><div><div class="eyebrow">GOOD THINGS HAPPEN BETWEEN HOUSES</div><h1 class="content-title">Find your people.<br>Start with a place.</h1><p class="content-lead">A movie. A repaired bike. A new language. The beginnings of a neighborhood are already here.</p></div><button id="community-layer" class="outline-button">${icon('pin')} See the community on the map</button></div>
    <div class="community-grid">${clubs.map(c => `<article class="community-card" style="--card-color:${c.color}"><div class="card-top"><span class="club-icon">${icon(c.icon)}</span><span class="eyebrow">${c.category}</span></div><h2>${c.title}</h2><p>${c.description}</p><div class="card-location">${icon('pin')} ${c.location}</div><button data-open-club="${c.id}" class="card-action">Discover this community <span>↗</span></button></article>`).join('')}
      <article class="community-card proposal-card"><div class="card-top">${icon('chat')}<span class="eyebrow">THE NEXT CONNECTION</span></div><h2>What’s your thing?</h2><p>A biking team? A cooking circle? Help make a place for it.</p><div class="card-location">New community proposal</div><button class="card-action" id="propose-club">Add a suggestion <span>＋</span></button></article></div>
    <div class="privacy-strip">${icon('lock')}<div><strong>Connected places today. Consenting people tomorrow.</strong><p>Personal connections will be private and require consent from both people. No resident social graph is collected in this release.</p></div><button id="community-neighbors">The knocking concept ↗</button></div>`;
  $$('[data-open-club]').forEach(b => b.onclick = () => clubDialog(b.dataset.openClub));
  $('#community-neighbors').onclick = neighborDialog;
  $('#propose-club').onclick = () => contributeDialog();
  $('#community-layer').onclick = () => { setView('map'); selectHouse(null); setLayer('community'); };
}

function setLayer(layer) {
  state.layer = layer;
  $$('[data-layer]').forEach(b => b.classList.toggle('active', b.dataset.layer === layer));
  scene?.setCommunity(layer === 'community', clubs);
  if (!scene) toast('Use the Community tab to explore activity locations.');
}

function renderEvents() {
  const focusedControl = ['previous-month', 'next-month', 'today-month'].includes(document.activeElement?.id) ? document.activeElement.id : null;
  const date = state.calendar;
  const year = date.getFullYear(), month = date.getMonth();
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  $('#events-view').innerHTML = `<div class="page-heading"><div><div class="eyebrow">MAKE ROOM FOR A LITTLE TOGETHER</div><h1 class="content-title">Good plans.<br>Even better company.</h1><p class="content-lead">A calendar for the whole neighborhood, with space for every house and club.</p></div><button id="draft-event" class="full-button">${icon('calendar')} Plan an event locally</button></div>
    <div class="calendar-layout"><section class="calendar-month"><div class="calendar-nav"><h2>${date.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</h2><div><button id="previous-month" aria-label="Previous month">←</button><button id="today-month">Today</button><button id="next-month" aria-label="Next month">→</button></div></div>
      <div class="calendar-grid">${['MON','TUE','WED','THU','FRI','SAT','SUN'].map(d => `<span class="calendar-weekday">${d}</span>`).join('')}${Array.from({length:offset}, () => '<span class="calendar-day outside"></span>').join('')}${Array.from({length:count},(_,i) => `<div class="calendar-day ${today.getFullYear()===year && today.getMonth()===month && today.getDate()===i+1 ? 'today' : ''}"><span>${i+1}</span></div>`).join('')}</div></section>
      <aside class="event-panel"><span class="eyebrow">THE COMMUNITY CALENDAR</span>${icon('calendar')}<h2>A place for<br>what’s next.</h2><p>No live event feed is connected yet. Check the original activity pages for current arrangements.</p><div class="notice">Your planning tool works locally. Publishing, private audiences and organizer permissions need the resident service.</div><button id="event-groups" class="outline-button">Explore the existing communities ↗</button></aside></div>
    <div class="privacy-strip">${icon('lock')}<div><strong>The right people can edit. The right neighbors can see.</strong><p>Planned: scoped house and club organizers, draft/publish controls, public or resident-only audiences, and revocable calendar access.</p></div></div>`;
  $('#previous-month').onclick = () => { state.calendar = new Date(year, month-1, 1); renderEvents(); };
  $('#next-month').onclick = () => { state.calendar = new Date(year, month+1, 1); renderEvents(); };
  $('#today-month').onclick = () => { state.calendar = new Date(); renderEvents(); };
  $('#draft-event').onclick = eventDraftDialog;
  $('#event-groups').onclick = () => setView('community');
  if (focusedControl) $(`#${focusedControl}`).focus({ preventScroll: true });
}

function eventDraftDialog() {
  modal(`<div class="modal-eyebrow">LOCAL EVENT PLANNER</div><h2 class="modal-title">Start with a plan.</h2><p class="modal-lead">Download a calendar draft. This doesn’t publish an event or invite anyone.</p>
    <form id="event-form"><label class="form-field">Event name<input name="title" required maxlength="120" placeholder="For example: Sunday bike ride"></label>
    <div class="form-row"><label class="form-field">Date<input type="date" name="date" required></label><label class="form-field">Time · Europe/Berlin<input type="time" name="time" required value="18:00"></label></div>
    <div class="form-row"><label class="form-field">Duration (minutes)<input type="number" name="duration" min="15" max="1440" step="15" value="60" required></label><label class="form-field">House<select name="house">${campus.buildings.map(b => `<option>${b.number}</option>`).join('')}</select></label></div>
    <label class="form-field">Short description<textarea name="description" maxlength="1500" rows="3" placeholder="What do you have in mind?"></textarea></label>
    <p class="field-note">The downloaded .ics file contains what you type here. Keep private details out of files you plan to share.</p><button class="full-button" type="submit">Download calendar draft (.ics) ↓</button></form>`);
  $('#event-form').onsubmit = e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    const escapeICS = s => String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r/g,'');
    const date = d.date.replaceAll('-', '') + 'T' + d.time.replace(':','') + '00';
    const stamp = new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+Z/,'Z');
    const contents = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Rommelweb//Local Draft//EN','CALSCALE:GREGORIAN',
      'BEGIN:VTIMEZONE','TZID:Europe/Berlin','BEGIN:DAYLIGHT','DTSTART:19700329T020000','RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU','TZOFFSETFROM:+0100','TZOFFSETTO:+0200','END:DAYLIGHT','BEGIN:STANDARD','DTSTART:19701025T030000','RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU','TZOFFSETFROM:+0200','TZOFFSETTO:+0100','END:STANDARD','END:VTIMEZONE',
      'BEGIN:VEVENT',`UID:${crypto.randomUUID()}@rommelweb.local`,`DTSTAMP:${stamp}`,`DTSTART;TZID=Europe/Berlin:${date}`,`DURATION:PT${d.duration}M`,
      `SUMMARY:${escapeICS(d.title)}`,`LOCATION:Erwin-Rommel-Straße ${d.house}\\, Erlangen`,`DESCRIPTION:${escapeICS('LOCAL DRAFT — not published or confirmed.\n' + d.description)}`,'STATUS:TENTATIVE','CLASS:PRIVATE','END:VEVENT','END:VCALENDAR'];
    // RFC 5545 lines are folded at 75 UTF-8 octets without splitting characters.
    const folded = contents.map(line => { let out='', chunk='', bytes=0; for (const char of line) { const n=new TextEncoder().encode(char).length; if(bytes+n>74){out+=chunk+'\r\n ';chunk='';bytes=1;}chunk+=char;bytes+=n;}return out+chunk; }).join('\r\n')+'\r\n';
    downloadFile('rommelweb-event-draft.ics', folded, 'text/calendar;charset=utf-8');
    $('#modal').close(); toast('Calendar draft downloaded. Nothing was published.');
  };
}

function renderBlueprint() {
  $('#blueprint-view').innerHTML = `<div class="page-heading"><div><div class="eyebrow">THE LONG VIEW / ARCHITECTURAL BRIEF</div><h1 class="content-title">A digital twin.<br>A real community.</h1><p class="content-lead">An accurate sense of place, a private sense of belonging, and a framework we can improve together.</p></div><a class="outline-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/ARCHITECTURE.md" target="_blank" rel="noopener">Read the full architectural brief ↗</a></div>
    <div class="blueprint-grid"><article class="blueprint-card"><span class="eyebrow">01 / THE OPEN CAMPUS</span><h2>A map everyone<br>can explore.</h2><p>Official LoD2 roof and wall geometry. Eleven real addresses. Real community spaces. Each model carries its source and its unknowns.</p><span class="badge">LIVE FOUNDATION</span></article>
    <article class="blueprint-card"><span class="eyebrow">02 / THE RESIDENT COMMONS</span><h2>Membership<br>that means something.</h2><p>A separate authenticated service with steward verification, expiring residency, private invitations and narrowly scoped event editors.</p><span class="badge pending">DESIGNED · NOT CONNECTED</span></article>
    <article class="blueprint-card"><span class="eyebrow">03 / THE PRIVATE DOORSTEP</span><h2>Connection<br>with consent.</h2><p>Optional discoverability. A polite knock before a conversation. Blocks, reports and limits. Room location is never the price of belonging.</p><span class="badge pending">PROPOSED</span></article></div>
    <section class="roadmap"><div><span class="eyebrow">ONE BUILDING AT A TIME</span><h2>From the outside in.</h2><p>The exterior is the beginning. Your knowledge makes it a twin.</p></div><ol>
      <li class="roadmap-step"><span>01</span><div><strong>Give the campus its shape</strong><p>Official exterior geometry, model inspection and a live public atlas.</p><small class="badge">THIS RELEASE</small></div></li>
      <li class="roadmap-step"><span>02</span><div><strong>Verify what’s inside</strong><p>Floor elevations, approved room numbering, corridors, entrances and accessible routes—with residents.</p></div></li>
      <li class="roadmap-step"><span>03</span><div><strong>Open one verified house</strong><p>EU-hosted backend, expiring memberships, scoped organizers, abuse handling and revocation tests.</p></div></li>
      <li class="roadmap-step"><span>04</span><div><strong>Let the neighborhood grow</strong><p>House groups, events, opt-in neighbors and consent-based connections across the campus.</p></div></li></ol></section>
    <div class="privacy-strip">${icon('layers')}<div><strong>Public frontend. Private API. Permission checked on every request.</strong><p>Proposed stack: Three.js + GitHub Pages, with Supabase Auth, EU Postgres, private schemas, row-level policies and server functions. No private records or invite secrets belong in this repository.</p></div></div>
    <div class="blueprint-links"><button id="blueprint-accuracy">Read the model evidence ↗</button><button id="blueprint-contribute">Contribute a floor detail ↗</button><a href="https://github.com/mteyra/rommelweb" target="_blank" rel="noopener">Follow the project on GitHub ↗</a></div>`;
  $('#blueprint-accuracy').onclick = accuracyDialog;
  $('#blueprint-contribute').onclick = () => contributeDialog();
}

function activateFallback() {
  scene?.dispose();
  scene = null;
  $('#map-labels').replaceChildren();
  fallbackMap($('#scene'), campus, selectHouse);
  $('.map-controls').hidden = true;
  $('.compass').hidden = true;
  $('.map-hint').textContent = '2D FALLBACK · SELECT A HOUSE';
  $('#scene-caption').textContent = 'WebGL unavailable. Building directory and 2D map remain available.';
  if (state.selected) renderInspector();
}

async function init() {
  try {
    const files = await Promise.all(['campus.json', 'lod2.json', 'interiors.json'].map(async file => {
      const response = await fetch(`${base}data/${file}`);
      if (!response.ok) throw new Error(`Map data unavailable (${response.status})`);
      return response.json();
    }));
    [campus, lod2, interiors] = files;
    validateInteriorData(interiors, campus, lod2);
    campus.buildings.forEach(b => {
      const model = lod2.buildings.find(m => m.number === b.number);
      b.height = model.height;
      b.baseY = model.baseY;
      b.footprint = model.groundPolygons[0];
    });
    renderDirectory(); renderWelcome();
    try { scene = new CampusScene($('#scene'), $('#map-labels'), campus, lod2, interiors, selectHouse, selectFloor); }
    catch (error) { console.warn('3D unavailable; showing map fallback.', error); activateFallback(); }
    $('#scene-loading').hidden = true;
    $$('.nav-button').forEach(b => b.onclick = () => setView(b.dataset.view));
    $('.brand').onclick = e => { e.preventDefault(); setView('map'); selectHouse(null); };
    $('#resident-entry').onclick = () => privateAccess();
    $('#contribute').onclick = () => contributeDialog();
    $('#building-search').oninput = e => { state.search = e.target.value; renderDirectory(); };
    $$('[data-campus]').forEach(b => b.onclick = () => {
      state.campus = b.dataset.campus; $$('[data-campus]').forEach(el => el.classList.toggle('active', el === b)); renderDirectory();
    });
    $('#zoom-in').onclick = () => scene?.zoom(0.8);
    $('#zoom-out').onclick = () => scene?.zoom(1.25);
    $('#reset-view').onclick = () => selectHouse(null);
    $('#campus-home').onclick = () => selectHouse(null);
    $('#top-view').onclick = e => {
      const button = e.currentTarget, enabled = button.getAttribute('aria-pressed') !== 'true';
      button.setAttribute('aria-pressed', enabled); scene?.setTop(enabled);
    };
    $('#accuracy-button').onclick = accuracyDialog;
    $$('[data-layer]').forEach(b => b.onclick = () => setLayer(b.dataset.layer));
    document.addEventListener('keydown', e => {
      if (e.key === '/' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName) && !$('#modal').open) {
        e.preventDefault(); setView('map'); $('#building-search').focus();
      }
    });
    document.addEventListener('rommel:webgl-lost', activateFallback);
    const hash = location.hash.slice(1);
    if (hash.startsWith('house-')) selectHouse(hash.slice(6));
    else if (['community','events','blueprint'].includes(hash)) setView(hash);
    document.body.dataset.ready = 'true';
  } catch (error) {
    console.error(error);
    $('#scene-loading').innerHTML = '<strong>The map couldn’t load.</strong><span>Check your connection and reload. No personal data has been requested.</span><button id="reload-map" class="outline-button">Try again</button>';
    $('#reload-map').onclick = () => location.reload();
  }
}
init();
