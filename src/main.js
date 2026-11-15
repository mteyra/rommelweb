import './styles.css';
import QRCode from 'qrcode';
import { CampusScene, fallbackMap } from './scene.js';
import { clubs, floorName, escapeHTML as esc, downloadFile } from './data.js';
import { validateInteriorData } from './interiors.js';
import { validateInteriorStudies, getDisplayLevel, getLevelWindows, isIndependentLayout, isFittedModuleLayout, isModuleLayout } from './interior-studies.js';
import { calendarDraft, orderedDrafts } from './events.js';
import { icon } from './icons.js';
import { roomReferences, roomReferenceSource } from './room-references.js';
import { studyRoomMeasurements } from './study-measurements.js';
import { apartmentConcept } from './apartment-concepts.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const base = import.meta.env.BASE_URL;
const state = { selected: null, floor: null, exploded: false, apartment: null, groupsOpen: false, groupDetails: false, timelineOpen: false, groupIndex: 0, drafts: [], theme: 'night' };
let campus, lod2, interiors, studies, scene, groups, toastTimer, lastFocus, qrRevision = 0;
let renderedGroupId = null, groupSizeAnimation;
const groupBackgroundState = new Map();
const panelAnimations = new WeakMap();
const qrCache = new Map();
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const house = number => campus.buildings.find(building => building.number === number);
const floorNotation = floor => floor === 0 ? 'EG' : `${floor}. OG`;
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
  state.apartment = null;
  if (!fromGroup) setGroups(false);
  document.body.classList.toggle('house-open', Boolean(number));
  $('#floor-detail').open = false;
  scene?.select(number, focus);
  $('#location-trail').textContent = number ? `CAMPUS SÜD ${house(number).campus} / HOUSE ${number}` : 'ERLANGEN / CAMPUS SÜD';
  $('#scene-caption').textContent = number ? 'Drag to orbit. Click outside a house to return.' : 'Choose a house to explore.';
  renderHouse();
  if (!fromGroup) setHash(number ? `house-${number}` : 'campus');
}

function renderHouse() {
  const b = house(state.selected);
  $('#house-controls').hidden = !b;
  if (!b) { renderFloor(); return; }
  $('#selected-house').textContent = `${b.number} · ${b.name}`;
  $('#explode-building').innerHTML = `${icon('layers')}<span>${state.exploded ? 'Bring it together' : 'Unfold the floors'}</span><span aria-hidden="true">↗</span>`;
  $('#explode-building').setAttribute('aria-expanded', state.exploded);
  $('#explode-building').disabled = !scene;
  $('#floor-controls').hidden = !state.exploded;
  $('#floor-buttons').innerHTML = Array.from({ length: b.levels }, (_, floor) => `<button class="floor-button ${state.floor === floor ? 'active' : ''}" data-floor="${floor}" aria-pressed="${state.floor === floor}">${floorNotation(floor)}</button>`).join('');
  $$('#floor-buttons [data-floor]').forEach(button => button.onclick = () => selectFloor(Number(button.dataset.floor)));
  renderFloor();
}

function selectFloor(floor) {
  if (!state.selected || (floor !== null && (!Number.isInteger(floor) || floor < 0 || floor >= house(state.selected).levels))) return;
  const focusedFloorLabel = document.activeElement.classList.contains('floor-label');
  state.floor = floor;
  state.apartment = null;
  if (!state.exploded) { state.exploded = true; scene?.explode(true); renderHouse(); }
  scene?.setFloor(floor);
  $$('#floor-buttons [data-floor]').forEach(button => { const active = Number(button.dataset.floor) === floor; button.classList.toggle('active', active); button.setAttribute('aria-pressed', active); });
  renderFloor();
  if (focusedFloorLabel) {
    $(`#floor-buttons [data-floor="${floor}"]`)?.focus({ preventScroll: true });
  }
}

function renderFloor() {
  const level = getDisplayLevel(interiors, studies, state.selected, state.floor);
  const extrapolated = level?.isStudy && level.extrapolatedFrom !== undefined;
  const transferred = level?.isStudy && state.selected !== '55';
  const independent = isIndependentLayout(level);
  const whiteLayout = independent && state.selected === '57';
  const greenLayout = independent && state.selected === '59';
  const fitted = isFittedModuleLayout(level);
  const moduleLayout = isModuleLayout(level);
  const sharedApartments = moduleLayout && level.spaces.some(space => space.kind === 'shared');
  const windows = getLevelWindows(level);
  const inFloors = Boolean(state.selected && state.exploded);
  document.body.classList.toggle('apartment-open', Boolean(state.apartment));
  $('#apartment-controls').hidden = !state.apartment;
  $('#house-controls').hidden = !state.selected || Boolean(state.apartment);
  document.body.classList.toggle('floors-open', inFloors);
  document.body.classList.toggle('floor-plan-open', inFloors && state.floor !== null);
  document.body.dataset.view = state.apartment ? 'apartment' : !state.selected ? 'campus' : !inFloors ? 'house' : state.floor === null ? 'floors' : 'floor';
  $('#floor-stage').hidden = !inFloors;
  $('#floor-stage-title').textContent = inFloors ? `House ${state.selected} / ${state.floor === null ? 'Floor study' : level?.isStudy ? floorNotation(state.floor) : level?.label || floorName(state.floor)}` : '';
  $('#floor-stage-note').textContent = state.floor === null ? 'Choose a level to look inside.'
    : fitted ? 'Provisional module placement · original outline'
    : sharedApartments ? 'Single rooms & shared envelopes · Hall 1.40 m'
    : independent ? 'Room 2.70 × 6.00 m · Module 3.10 m · Hall 1.40 m'
    : extrapolated ? 'Extrapolated study · exterior in model metres.'
      : windows.length ? 'Blue windows · exterior in model metres.'
      : level?.isStudy ? `${transferred ? 'Template study' : 'Resident sketch'} · exterior in model metres.`
      : level?.spaces.length ? 'Explore a room or a marked doorway.' : 'Interior plan awaiting a verified layout.';
  $('#floor-stage').classList.toggle('is-study', Boolean(level?.isStudy));
  $('#all-floors').setAttribute('aria-pressed', state.floor === null);
  if (inFloors) $('#scene-caption').textContent = state.floor === null
    ? 'A house on its own. Select a floor to look closer.'
    : 'Almost overhead. Drag to adjust; All levels returns to the stack.';
  $('#floor-detail summary').innerHTML = `${state.floor === null ? 'About these levels' : level?.isStudy ? 'Rooms & drawing key' : esc(level?.label || floorName(state.floor))}<span aria-hidden="true">＋</span>`;
  const spaceButtons = level ? `<div class="room-grid">${level.spaces.map(space => `<button class="room-chip${level.isStudy && space.confidence === 'estimated' ? ' is-estimated' : ''}" data-space="${esc(space.id)}"${level.isStudy ? ` aria-label="${esc(`${space.label}, ${whiteLayout || greenLayout ? 'resident-confirmed arrangement' : space.confidence === 'estimated' ? 'estimated area' : 'resident sketch'}, temporary study label`)}"` : ''}>${esc(space.label)}</button>`).join('')}</div>` : '';
  const dimensionEvidence = fitted ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/OLD-HOUSES-MODULE-LAYOUT.md" target="_blank" rel="noopener">Module placement & field checks ↗</a>'
    : whiteLayout ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/HOUSE57-MODULE-LAYOUT.md" target="_blank" rel="noopener">White’s layout & resident confirmation ↗</a>'
    : greenLayout ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/HOUSE59-MODULE-LAYOUT.md" target="_blank" rel="noopener">Green’s layout & resident confirmation ↗</a>'
    : independent && state.selected === '55' && state.floor === 0 ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/HOUSE55-GROUND-FLOOR-LAYOUT.md" target="_blank" rel="noopener">Layout dimensions & assumptions ↗</a>'
    : independent && state.selected === '55' && state.floor === 1 ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/HOUSE55-FIRST-FLOOR-LAYOUT.md" target="_blank" rel="noopener">Layout dimensions & assumptions ↗</a>'
    : independent ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/HOUSE55-MODULE-LAYOUT.md" target="_blank" rel="noopener">Layout dimensions & assumptions ↗</a>'
    : level?.isStudy && state.selected === '55' && state.floor === 2
    ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/HOUSE55-R-ALIGNMENT.md" target="_blank" rel="noopener">Area study & measurements ↗</a>'
    : level?.isStudy ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/OLD-HOUSES-STUDY.md" target="_blank" rel="noopener">Assumptions & fit checks ↗</a>' : '';
  const drawingEvidence = fitted ? 'Provisional module placement · original outline retained'
    : greenLayout ? 'Resident-confirmed arrangement · Green House'
    : whiteLayout ? 'Resident-confirmed arrangement · shared with House 55'
    : sharedApartments ? 'Independent floor layout'
    : independent ? 'Independent room layout'
    : transferred ? 'Template study · this house is not internally surveyed'
      : extrapolated ? 'Extrapolated study · see source notes' : 'A resident-informed study';
  const whiteLayoutNote = !whiteLayout ? '' : state.floor === 0
    ? 'White follows Red’s internal arrangement, with the Gym in the east common room and the Study in the west common room. '
    : state.floor === 1
    ? 'White follows Red’s internal arrangement with only the west balcony on this level. '
    : 'White follows Red’s internal arrangement on this level. ';
  const greenLayoutNote = !greenLayout ? '' : state.floor === 0
    ? 'Green’s ground floor has one Hausmeister enclosure across the north wing, a Garden room beside the east hall and Storage beside the west hall. The extra single beside the A bank is restored. '
    : state.floor === 1
    ? 'Green follows Red’s internal arrangement, including both balconies on this level. '
    : 'Green follows Red’s internal arrangement on this level. ';
  const stackLayoutNote = state.selected === '57' && studies?.buildings?.['57']?.levels.every(isIndependentLayout)
    ? 'White follows Red’s resident-confirmed internal arrangement on all three levels. Its EG common rooms are the east Gym and west Study; 1. OG has only the west balcony. Select a floor for the layout, dimensions and drawing key.'
    : state.selected === '59' && studies?.buildings?.['59']?.levels.every(isIndependentLayout)
    ? 'Green follows Red on 1. OG and 2. OG. EG has the Hausmeister enclosure, Garden room, Storage and the restored single beside the A bank. Select a floor for the layout, dimensions and drawing key.'
    : 'Each plate cuts through the actual exterior at its level. Upper sections follow the stepped roofs. Floor heights and room plans still need verification.';
  const dimensionNote = whiteLayoutNote + greenLayoutNote + (fitted
    ? 'Single rooms use 2.70 × 6.00 m clear rectangles (16.20 m²), with a 0.20 m side wall on each side of a 3.10 m module. Shared apartments, where placed, use 6.20 × 7.40 m gross envelopes. Hall runs use 1.40 m. These dimensions are borrowed from the House 55 layout for this provisional fit. The current exterior outline is retained in full; unused gray space remains unassigned. Room counts, positions and access await on-site checks.'
    : sharedApartments
    ? 'Single rooms have 2.70 × 6.00 m clear rectangles (16.20 m²), with a 0.20 m side wall on each side of every 3.10 m module. Shared apartments are shown as whole gross envelopes; their internal rooms, services and wall positions remain unresolved. Main hall runs are 1.40 m wide. Outline dimensions describe this independent layout. Window and doorway positions remain schematic.'
    : independent
    ? 'Rooms have 2.70 × 6.00 m clear rectangles (16.20 m²), with a 0.20 m side wall on each side of every 3.10 m module. Halls are 1.40 m wide. Outline dimensions describe this independent layout. Window and doorway positions remain schematic.'
    : `Exterior lengths follow the building-shell section at an estimated floor height. Its low-roof margins remain unassigned; these lengths are not apartment spans. Zoom in to reveal smaller runs.${level?.dimensionGuides?.length ? ' The blue R-bank guide measures the estimated room allocation separately.' : ''}`);
  $('#floor-detail-content').innerHTML = level?.isStudy
    ? `<p class="study-evidence">${drawingEvidence}</p><div class="study-legend" aria-label="Drawing key">${extrapolated || transferred || moduleLayout ? '' : '<span data-evidence="sketch">Sketch</span>'}<span data-evidence="estimated">${moduleLayout ? 'Layout' : 'Estimate'}</span>${windows.length ? `<span data-evidence="window">${windows.length} ${moduleLayout ? 'layout windows' : 'windows'}</span>` : ''}${level.wallBands?.length ? `<span data-evidence="wall-band">${moduleLayout ? 'Wall allowance' : 'Possible wall'}</span>` : ''}${level.excludedAreas?.length ? '<span data-evidence="excluded">Excluded</span>' : ''}<span data-evidence="dimension">${independent ? 'Layout / m' : 'Exterior / m'}</span></div>${spaceButtons}<p>Lettered labels are temporary, not physical room numbers. Divisions and doorway positions still need verification.</p><p>${dimensionNote}</p>${studyNotes(level)}<small>Source: ${esc(level.source)}</small><div class="floor-reference-actions"><button class="text-button" id="contribute-floor">Correct this study ↗</button>${dimensionEvidence}</div>`
    : level ? `${spaceButtons}<p>${level.elevation} m above building base. Approved room and doorway geometry; walls shown as a low cutaway.</p><small>${esc(level.source)} · reviewed ${esc(level.reviewedAt)}</small>`
      : `<p>${state.floor === null ? stackLayoutNote : 'This is the exterior section at a provisional floor height. A house-and-floor plan is needed to place its rooms, corridors and doors accurately.'}</p><div class="floor-reference-actions"><button class="text-button" id="room-references">Published room designs ↗</button><button class="text-button" id="contribute-floor">Add a floor detail ↗</button></div>`;
  $$('#floor-detail-content [data-space]').forEach(button => button.onclick = () => spaceDialog({house: state.selected, floor: state.floor, spaceId: button.dataset.space}));
  if ($('#contribute-floor')) $('#contribute-floor').onclick = () => correctionDialog(state.selected, state.floor);
  if ($('#room-references')) $('#room-references').onclick = () => roomReferencesDialog();
  if (state.apartment) {
    const room = level.spaces.find(space => space.id === state.apartment.spaceId);
    const partial = state.apartment.concept.diagnostics.some(item => item.code.endsWith('-omitted'));
    $('#floor-stage-title').textContent = `House ${state.selected} / ${floorNotation(state.floor)} / ${room?.shortLabel || room?.label}`;
    $('#floor-stage-note').textContent = partial
      ? 'Partial concept · some items do not fit this envelope.'
      : 'Layout concept · services and mirror unverified.';
    $('#apartment-arrangement-label').textContent = partial ? 'Partial arrangement' : 'One possible arrangement';
    $('#scene-caption').textContent = 'Drag to orbit. Click empty space to return to the floor.';
  }
}

function studyNotes(level) {
  const notes = (Array.isArray(level.notes) ? level.notes : [level.notes]).filter(note => typeof note === 'string' && note.trim());
  return notes.length ? `<ul class="study-notes">${notes.map(note => `<li>${esc(note)}</li>`).join('')}</ul>` : '';
}

function spaceDialog({ house: number, floor, spaceId, openingId }) {
  if (number !== state.selected || floor !== state.floor || !state.exploded) return;
  const level = getDisplayLevel(interiors, studies, number, floor);
  const space = level?.spaces.find(space => space.id === spaceId);
  const door = openingId ? level?.doors?.find(door => door.id === openingId && [door.spaceId, door.toSpaceId].includes(spaceId)) : null;
  if (!space || openingId && !door) return;
  if (level.isStudy) {
    const item = door || space;
    const estimated = item.confidence === 'estimated';
    const extrapolated = level.extrapolatedFrom !== undefined;
    const independent = isIndependentLayout(level);
    const whiteLayout = independent && number === '57';
    const greenLayout = independent && number === '59';
    const fitted = isFittedModuleLayout(level);
    const moduleLayout = isModuleLayout(level);
    const sharedApartments = independent && level.spaces.some(space => space.kind === 'shared');
    const enclosedCommonAreas = independent && level.spaces.some(space => space.kind === 'service');
    const title = `${door ? door.label : space.label} · study`;
    const description = fitted
      ? door ? 'A proposed doorway in the fitted module layout. Its location and actual access await on-site checks.'
        : space.kind === 'room' ? 'A 2.70 × 6.00 m clear room rectangle placed within this house’s existing outline using the House 55 module.'
          : space.kind === 'shared' ? 'A proposed whole shared-apartment envelope using the House 55 module. Its internal rooms and services remain undivided.'
            : space.kind === 'corridor' ? 'A proposed 1.40 m hallway connecting the fitted apartments. Its location and access await on-site checks.'
              : 'A proposed space within the retained exterior outline. Its location and actual arrangement await on-site checks.'
      : independent
      ? door ? 'A schematic doorway in the independent room layout. Its position and opening details remain adjustable.'
        : space.kind === 'room' ? 'A clear room rectangle using the chosen 2.70 × 6.00 m dimensions, arranged within a 3.10 m module.'
          : space.kind === 'shared' ? 'A whole shared-apartment envelope. Its internal rooms, services and wall positions remain unresolved.'
          : whiteLayout && space.label === 'West balcony' ? 'The resident-confirmed west balcony on White’s first floor, reached from the west hall. This level has no east balcony.'
          : greenLayout && space.label === 'Hausmeister' ? 'The resident-marked Hausmeister enclosure occupying the north wing. Its former apartment divisions are removed; internal fittings remain undivided.'
          : greenLayout && space.label === 'Garden room' ? 'The Garden room beside the east hall and Hausmeister enclosure, separated from the hall by a wall with one marked doorway.'
          : greenLayout && space.label === 'Storage' ? 'The large Storage room beside the west hall, enclosed with its own marked doorway.'
          : space.kind === 'service' ? whiteLayout || greenLayout
            ? `A resident-confirmed common area in ${whiteLayout ? 'White' : 'Green'}’s layout, enclosed from the hallway with its own marked doorway.`
            : 'A common area enclosed from the hallway, with its own marked doorway.'
          : space.kind === 'corridor' ? enclosedCommonAreas
            ? 'A 1.40 m wide hallway connecting the apartments and enclosed common areas.'
            : sharedApartments
            ? 'Circulation joining the 1.40 m hall runs and retained common areas.'
            : 'A 1.40 m wide hallway in the independent room layout.'
            : whiteLayout
            ? 'A space in White’s resident-confirmed arrangement shared with Red. Its drawn dimensions remain schematic.'
            : greenLayout
            ? 'A space in Green’s resident-confirmed arrangement. Its drawn dimensions remain schematic.'
            : 'A proposed space in the independent room layout. Its arrangement still needs verification.'
      : number !== '55'
      ? 'An estimated layout transferred from House 55 and adapted to this house’s exterior. Its rooms, corridors, openings and apartment types have not been verified in this house.'
      : extrapolated
      ? `This ${door ? 'doorway' : space.kind === 'stairs' ? 'stair area' : space.kind} is extrapolated from a study of ${floorNotation(level.extrapolatedFrom)}. The source notes identify the version used; its position on this floor still needs verification.`
      : door
      ? estimated ? 'Estimated doorway position. The opening, hinge and direction still need verification.' : 'Doorway marked in the resident sketch. Its position and dimensions still need verification.'
      : space.kind === 'room'
        ? estimated ? 'An estimated room division within the resident sketch.' : 'A room area marked in the resident sketch; its boundaries are approximate.'
        : space.kind === 'stairs'
          ? estimated ? 'Estimated stair area. Its shape and connections between floors are unverified.' : 'Stair area marked in the resident sketch. Its exact shape and connections between floors are unverified.'
          : estimated ? 'An estimated space within the resident sketch.' : 'A space marked in the resident sketch; its boundaries are approximate.';
    const measurement = !door ? studyRoomMeasurements(level, space) : null;
    const concept = space.kind === 'room' ? apartmentConcept(level, space) : null;
    const dimensions = !measurement ? '' : measurement.areaBasis === 'clear-room-layout'
      ? `<div class="source-item"><strong>Clear room dimensions</strong><p>${measurement.shortSpan.toFixed(2)} × ${measurement.longSpan.toFixed(2)} m · ${measurement.area.toFixed(2)} m² clear polygon area</p><p>3.10 m module = 0.20 m side wall + 2.70 m clear width + 0.20 m side wall. These are the chosen layout dimensions.</p></div>`
      : measurement.areaBasis === 'shared-apartment-layout'
      ? `<div class="source-item"><strong>Shared apartment envelope · before walls</strong><p>${measurement.shortSpan.toFixed(2)} × ${measurement.longSpan.toFixed(2)} m span · ${measurement.area.toFixed(2)} m² gross polygon area</p><p>Whole apartment envelope, including wall allowances. Internal rooms and services have not yet been divided. Spans follow the layout axes; polygon area excludes recesses and cutouts.</p></div>`
      : `<div class="source-item"><strong>Study envelope · before walls</strong><p>≈ ${measurement.shortSpan.toFixed(1)} × ${measurement.longSpan.toFixed(1)} m span · ≈ ${measurement.area.toFixed(1)} m² gross polygon area</p><p>Not measured living area. Spans follow the building axes; polygon area excludes recesses and cutouts.</p></div>`;
    modal(`<div class="modal-eyebrow">HOUSE ${esc(number)} / ${esc(level.label)}</div><h2 class="modal-title">${esc(title)}</h2><div class="study-card-evidence${estimated ? ' is-estimated' : ''}">${fitted ? 'Provisional placement' : whiteLayout || greenLayout ? 'Resident-confirmed arrangement' : independent ? 'Independent layout' : extrapolated ? 'Assumed layout' : estimated ? 'Estimated' : 'Resident sketch'}</div><p class="modal-lead">${esc(description)}</p>${space.kind === 'room' || moduleLayout && space.kind === 'shared' ? '<p class="study-identity-note">This is a temporary study label, not a physical room number or a resident assignment.</p>' : ''}${dimensions}${item.note ? `<p class="study-item-note">${esc(item.note)}</p>` : ''}<div class="modal-actions"><button class="outline-button" id="correct-space-study">Suggest a correction ↗</button></div><p class="source-note">Source: ${esc(level.source)}. Study geometry is separate from approved plans; no resident information or occupancy is published.</p>`);
    $('#correct-space-study').onclick = () => {
      correctionDialog(number, floor);
      const observation = $('#correction-form').elements.observation;
      observation.value = `House ${number}, ${level.label}, study label “${item.label}”: `;
      observation.focus({ preventScroll: true });
    };
    if (concept?.status === 'concept') {
      const button = document.createElement('button');
      button.id = 'explore-apartment';
      button.className = 'outline-button';
      button.textContent = 'Explore a layout concept ↗';
      button.onclick = () => {
        const active = scene?.focusApartment(space.id);
        if (!active) return;
        state.apartment = {spaceId: space.id, concept: active};
        $('#modal').close();
        $('#floor-detail').open = false;
        renderFloor();
        $('#back-to-floor').focus({preventScroll: true});
      };
      $('#modal-body .modal-actions').prepend(button);
    } else if (concept?.diagnostics?.length) {
      const note = document.createElement('p');
      note.className = 'field-note';
      note.textContent = `No furniture fit is asserted here. ${concept.diagnostics.map(item => item.message).join(' ')}`;
      $('#modal-body .modal-actions').before(note);
    }
    return;
  }
  const residentPreview = space.kind === 'room' ? `<div class="space-person-placeholder">${icon('lock')}<strong>Resident card · coming later</strong><p>A resident can choose what to share here once verified access is connected.</p></div><button class="full-button" disabled>Knocking · not connected</button>` : '';
  modal(`<div class="modal-eyebrow">HOUSE ${esc(number)} / ${esc(level.label)}</div><h2 class="modal-title">${esc(space.label)}</h2><p class="modal-lead">${esc(door ? door.label : space.kind === 'room' ? 'A room in the house.' : space.kind.replace('-', ' '))}</p>${residentPreview}<p class="source-note">Physical space from ${esc(level.source)} · reviewed ${esc(level.reviewedAt)}. No resident information or occupancy is published.</p>`);
}

function apartmentNotesDialog() {
  const concept = state.apartment?.concept;
  if (!concept) return;
  modal(`<div class="modal-eyebrow">APARTMENT / ARRANGEMENT STUDY</div><h2 class="modal-title">One possible way to live here.</h2><p class="modal-lead">Fixed-size furniture from the older single-room sketch, fitted inside this estimated envelope. This does not establish the apartment type, mirror or actual internal layout.</p><div class="source-list">${(concept.notes || []).map(note => `<div class="source-item"><p>${esc(note)}</p></div>`).join('')}</div>${concept.diagnostics?.length ? `<p class="field-note">${esc(concept.diagnostics.map(item => item.message).join(' '))}</p>` : ''}<p class="source-note"><a href="https://rommelwood.de/wohnen/zimmergrundriss/" target="_blank" rel="noopener">Original resident-association sketches ↗</a> · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/OLD-HOUSES-INTERIOR-EVIDENCE.md" target="_blank" rel="noopener">What the evidence establishes ↗</a></p>`);
}

function setGroups(open, focus = false) {
  const changed = state.groupsOpen !== open;
  if (open) {
    setTimeline(false);
    if (changed && state.groupDetails) setGroupDetails(false, { animate: false, focus: false });
  } else {
    setGroupModality(false);
  }
  if (!open && state.groupsOpen && location.hash.startsWith('#group-')) {
    setHash(state.selected ? `house-${state.selected}` : 'campus');
  }
  state.groupsOpen = open;
  $('#open-groups').setAttribute('aria-expanded', open);
  document.body.classList.toggle('group-open', open);
  if (changed) animatePanelVisibility($('#group-deck'), $('#open-groups'), open);
  if (!open) {
    qrRevision++;
    $$('.group-copy, .group-qr, .group-details').forEach(element => element.classList.remove('is-changing'));
  }
  if (open) {
    renderGroup();
    if (focus) $('#group-next').focus({ preventScroll: true });
  }
}

function animatePanelVisibility(panel, toggle, open, offset = '0 -8px') {
  if (!open && panel.contains(document.activeElement)) toggle.focus({ preventScroll: true });
  const current = getComputedStyle(panel);
  const resting = { opacity: 0, translate: offset, scale: '0.985' };
  const from = panel.hidden
    ? resting
    : { opacity: current.opacity, translate: current.translate, scale: current.scale };
  panelAnimations.get(panel)?.cancel();
  panelAnimations.delete(panel);
  panel.inert = !open;
  if (reducedMotion()) {
    panel.hidden = !open;
    if (panel.id === 'group-deck' && !open) setGroupDetails(false, { animate: false, focus: false });
    return;
  }
  panel.hidden = false;
  const animation = panel.animate([
    from,
    open ? { opacity: 1, translate: '0 0', scale: '1' } : resting,
  ], { duration: open ? 300 : 220, easing: 'cubic-bezier(.22,1,.36,1)' });
  panelAnimations.set(panel, animation);
  animation.finished.then(() => {
    if (panelAnimations.get(panel) !== animation) return;
    panelAnimations.delete(panel);
    panel.hidden = !open;
    if (panel.id === 'group-deck' && !open) setGroupDetails(false, { animate: false, focus: false });
  }).catch(() => {});
}

function resizeGroup(update, animate = true) {
  const deck = $('#group-deck');
  const before = deck.getBoundingClientRect();
  groupSizeAnimation?.cancel();
  groupSizeAnimation = null;
  update();
  const after = deck.getBoundingClientRect();
  const changed = ['x', 'y', 'width', 'height'].some(key => Math.abs(before[key] - after[key]) > 1);
  if (!animate || deck.hidden || !state.groupsOpen || reducedMotion() || !changed) return;
  const frame = rect => ({
    left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`,
    height: `${rect.height}px`, transform: 'none',
  });
  const animation = deck.animate([frame(before), frame(after)], {
    duration: 380, easing: 'cubic-bezier(.22,1,.36,1)',
  });
  groupSizeAnimation = animation;
  animation.finished.then(() => {
    if (groupSizeAnimation === animation) groupSizeAnimation = null;
  }).catch(() => {});
}

function setGroupModality(open) {
  const deck = $('#group-deck');
  $('#group-backdrop').hidden = !open;
  document.body.classList.toggle('group-details-open', open);
  if (open) {
    deck.setAttribute('role', 'dialog');
    deck.setAttribute('aria-modal', 'true');
    deck.setAttribute('aria-labelledby', 'group-title');
    deck.removeAttribute('aria-label');
    for (const element of [...$('#app').children, $('#skip-to-map')]) {
      if (element === deck || element.id === 'group-backdrop') continue;
      if (!groupBackgroundState.has(element)) groupBackgroundState.set(element, element.inert);
      element.inert = true;
    }
  } else {
    deck.removeAttribute('role');
    deck.removeAttribute('aria-modal');
    deck.removeAttribute('aria-labelledby');
    deck.setAttribute('aria-label', 'Explore campus groups');
    for (const [element, wasInert] of groupBackgroundState) element.inert = wasInert;
    groupBackgroundState.clear();
  }
}

function setGroupDetails(open, { animate = true, focus = true } = {}) {
  if (open && !state.groupsOpen) return;
  const changed = state.groupDetails !== open;
  resizeGroup(() => {
    state.groupDetails = open;
    $('#group-details').hidden = !open;
    $('#group-toggle-details').setAttribute('aria-expanded', open);
    $('#group-toggle-details').textContent = open ? 'Less ↑' : 'Details ↓';
    $('#group-deck').classList.toggle('details-open', open);
    setGroupModality(open);
  }, animate);
  if (changed && focus && state.groupsOpen) {
    $(open ? '#group-back' : '#group-toggle-details').focus({ preventScroll: true });
  }
  if (changed && open && animate && !reducedMotion()) $('#group-details').animate([
    { opacity: 0, translate: '0 -3px' }, { opacity: 1, translate: '0 0' },
  ], { duration: 300, easing: 'ease-out' });
}

function containGroupFocus(event) {
  if (!state.groupDetails || !state.groupsOpen || event.key !== 'Tab' || $('#modal').open) return;
  const controls = $$('#group-deck button:not(:disabled), #group-deck a[href]')
    .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');
  const first = controls[0], last = controls.at(-1);
  if (!first) return;
  if ((event.shiftKey && (document.activeElement === first || !$('#group-deck').contains(document.activeElement))) ||
      (!event.shiftKey && document.activeElement === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus({ preventScroll: true });
  }
}

async function renderGroup() {
  const group = groups[state.groupIndex];
  const revision = ++qrRevision;
  const changing = renderedGroupId !== null && renderedGroupId !== group.id;
  const animated = changing && !reducedMotion();
  if (animated) $$('.group-copy, .group-qr, .group-details').forEach(element => element.classList.add('is-changing'));
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
  resizeGroup(() => {
    $('#group-title').textContent = group.title;
    $('#group-kicker').textContent = group.category;
    $('#group-description').textContent = group.description;
    $('#group-symbol').innerHTML = icon(group.icon || 'chat');
  });
  $('#group-location').innerHTML = `${icon('pin')} ${esc(group.house ? `House ${group.house} · ${group.location}` : group.location)} ↗`;
  $('#group-location').onclick = () => {
    if (state.groupDetails) setGroupDetails(false);
    travel(group.house, { fromGroup: true });
  };
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
    if (revision === qrRevision) $$('.group-copy, .group-qr, .group-details').forEach(element => element.classList.remove('is-changing'));
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
  if (open) setGroups(false);
  const changed = state.timelineOpen !== open;
  state.timelineOpen = open;
  $('#open-timeline').setAttribute('aria-expanded', open);
  document.body.classList.toggle('timeline-open', open);
  if (changed) animatePanelVisibility($('#timeline-panel'), $('#open-timeline'), open, '16px 0');
  if (open) {
    renderTimeline();
    if (focus) $('#close-timeline').focus({ preventScroll: true });
  }
}

function renderTimeline() {
  const drafts = orderedDrafts(state.drafts);
  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Europe/Berlin' }).format(new Date());
  let previousDay = '';
  $('#timeline-panel').classList.toggle('is-empty', !drafts.length);
  $('#timeline-content').innerHTML = `<div class="timeline-day"><span class="timeline-dot"></span><span>${esc(today)}</span><small>NOW</small></div>${drafts.length ? drafts.map(event => {
    const day = new Date(`${event.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    const label = event.date !== previousDay ? `<div class="timeline-day"><span class="timeline-dot"></span><span>${day}</span></div>` : '';
    previousDay = event.date;
    return `${label}<article class="timeline-entry"><span class="timeline-time">${esc(event.time)}</span><button class="timeline-event-button" data-event="${event.id}"><span class="timeline-audience">LOCAL DRAFT · HOUSE ${esc(event.house)}</span><strong>${esc(event.title)}</strong><small>${esc(event.description || 'A plan taking shape.')}</small><span class="timeline-location">View plan ↗</span></button></article>`;
  }).join('') : `<div class="timeline-empty"><span class="timeline-dot"></span><h3>Your next good plan.</h3><p>The community calendar isn’t connected yet. Start a personal draft, then export it to your calendar.</p></div>`}<p class="timeline-note">Europe/Berlin${drafts.length ? ' · Drafts stay in this tab' : ''}</p>`;
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
  modal(`<div class="modal-eyebrow">ROMMELWEB / FIELD NOTES</div><h2 class="modal-title">A place taking shape.</h2><p class="modal-lead">Eleven real houses. A community we can build together.</p><div class="tool-links"><button class="outline-button" id="tools-rooms">Published room designs ↗</button><button class="outline-button" id="tools-sources">Model & façade sources ↗</button><button class="outline-button" id="tools-correction">Add a building detail ↗</button><button class="outline-button" id="tools-resident">Resident privacy & knocking ↗</button><a class="outline-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/ARCHITECTURE.md" target="_blank" rel="noopener">Architectural brief ↗</a></div><p class="field-note">Click a house to explore · click empty space to return · drag to orbit · scroll to zoom · arrow keys on the map to orbit · Tab to a house label and Enter to explore · Escape to close an overlay.</p><p class="field-note">Independent resident project. <a href="https://rommelwood.de/" target="_blank" rel="noopener">Meet Rommelwood e.V. ↗</a></p>`);
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
  modal(`<div class="modal-eyebrow">PUBLISHED ROOM REFERENCES</div><h2 class="modal-title">A first look inside.</h2><p class="modal-lead">Examples from the resident association and operator. These drawings are not assigned to individual rooms on the map.</p><div class="reference-tabs" role="group" aria-label="Choose a campus">${Object.keys(roomReferences).map(id => `<button class="outline-button" data-reference-campus="${id}" aria-pressed="${campusId === id}">Süd ${id} · ${id === 'I' ? 'older' : 'newer'} houses</button>`).join('')}</div><p class="field-note">${esc(reference.houses)}</p><div class="source-list">${reference.plans.map(plan => `<div class="source-item"><strong>${esc(plan.title)}</strong><p>${esc(plan.description)}</p><a href="${plan.url}" target="_blank" rel="noopener">${esc(plan.label)} ↗</a></div>`).join('')}<div class="source-item"><strong>Operator’s 2026 room categories</strong><p>${esc(reference.categories)}</p><p class="field-note">These are category averages, not individual clear-area measurements or a whole shared apartment’s area.</p><a href="${reference.operatorUrl}" target="_blank" rel="noopener">Open the operator’s factsheet · PDF ↗</a></div></div><p class="source-note">Sketch dimensions are approximate; centimetres are inferred from the drawings. Rooms may be mirrored. Clear ceiling height does not establish floor-to-floor height. <a href="${roomReferenceSource}" target="_blank" rel="noopener">Read Rommelwood’s original notes ↗</a></p>`);
  if (alreadyOpen) lastFocus = returnFocus;
  $$('[data-reference-campus]').forEach(button => button.onclick = () => {
    roomReferencesDialog(button.dataset.referenceCampus);
    $(`[data-reference-campus="${button.dataset.referenceCampus}"]`).focus({ preventScroll: true });
  });
}

function accuracyDialog() {
  const model = lod2.buildings.find(building => building.number === state.selected);
  const independentHouses = Object.entries(studies?.buildings || {}).filter(([number, building]) =>
    building.levels.length === (campus?.buildings?.find(item => item.number === number)?.levels ?? 3) && building.levels.every(isIndependentLayout)).map(([number]) => number);
  const independentHouseNames = independentHouses.length > 2
    ? `${independentHouses.slice(0, -1).join(', ')} and ${independentHouses.at(-1)}` : independentHouses.join(' and ');
  const completedFloorSources = independentHouses.length
    ? `${independentHouses.length === 1 ? 'House' : 'Houses'} ${independentHouseNames} ${independentHouses.length === 1 ? 'uses' : 'use'} independent layouts on all three levels, with 2.70 × 6.00 m clear rooms, 3.10 m modules and 1.40 m halls. Their outlines follow these chosen dimensions; shared apartments retain whole envelopes with unresolved internal divisions.`
    : 'House 55’s top floor now shows an independent layout with 2.70 × 6.00 m clear rooms, 3.10 m modules and 1.40 m halls. Its outline follows these chosen dimensions.';
  const otherRedLevels = (studies?.buildings?.['55']?.levels || []).filter(level => level.index !== 2);
  const independentRedLevels = otherRedLevels.filter(isIndependentLayout);
  const remainingRedFloors = otherRedLevels.filter(level => !isIndependentLayout(level)).map(level => floorNotation(level.index));
  const partialFloorSources = independentHouses.includes('55') ? '' : independentRedLevels.length
    ? ` House 55’s ${independentRedLevels.map(level => floorNotation(level.index)).join(' and ')} ${independentRedLevels.length === 1 ? 'also uses' : 'also use'} an independent layout${independentRedLevels.some(level => level.spaces.some(space => space.kind === 'shared')) ? ', including shared apartment envelopes whose internal divisions remain unresolved' : ''}. ${remainingRedFloors.length ? `House 55’s ${remainingRedFloors.join(' and ')} and other older houses` : 'Other older houses'} retain their earlier template studies.`
    : ' Other floors and older houses retain their earlier template studies.';
  const whiteLayoutSources = independentHouses.includes('57')
    ? ' White follows Red’s resident-confirmed internal arrangement, with an east Gym and west Study on EG and only the west balcony on 1. OG.'
    : '';
  const greenLayoutSources = independentHouses.includes('59')
    ? ' Green follows Red on both upper floors, including both first-floor balconies. EG has one north-wing Hausmeister enclosure, an east Garden room, west Storage and the restored A-bank single.'
    : '';
  const fittedHouses = Object.entries(studies?.buildings || {}).filter(([number, building]) =>
    number !== '55' && building.levels.some(isFittedModuleLayout)).map(([number]) => number);
  const otherFloorSources = fittedHouses.length
    ? ` Houses ${fittedHouses.join(', ')} use provisional modules fitted within their original outlines. Unused gray space stays unassigned, and their rooms and access await on-site checks.`
    : independentHouses.length ? ' Other older houses retain their earlier template studies.' : '';
  const foldedExteriorSource = independentHouses.length > 1 ? 'The folded exteriors retain their source models.' : 'The folded exterior retains its source model.';
  modal(`<div class="modal-eyebrow">THE MODEL / ${state.selected ? `HOUSE ${state.selected}` : 'CAMPUS'}</div><h2 class="modal-title">Real shape. Visible craft.</h2><div class="source-list"><div class="source-item"><strong>Verified exterior source</strong><p>Eleven address-matched LoD2 models, 289 wall, roof and ground surfaces.${model ? ` House ${state.selected}: ${model.height.toFixed(2)} m high, model date ${model.creationDate}.` : ''} Source geometry remains in metres; the camera makes the houses feel closer.</p><a href="${lod2.metadata.url}" target="_blank" rel="noopener">Bavaria’s official model ↗</a></div><div class="source-item"><strong>Photo-informed façade linework</strong><p>Timber grooves, weathering and staggered older-house plates follow photographic references. Lila and Grey include identified recessed balconies and stair fronts; mapped window rows retain their blank timber spans. Blue’s upper rows align, and Red has separately identified rear and roof glazing. Recess depths, equipment positions and unseen openings remain estimated. Source exterior dimensions remain unchanged.</p><a href="https://github.com/mteyra/rommelweb/blob/main/docs/PHOTO-FACADE-UPGRADE.md" target="_blank" rel="noopener">Photo study and limits ↗</a> · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/FACADE-REFERENCES.md" target="_blank" rel="noopener">Material references ↗</a> · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/WINDOW-REFERENCES.md" target="_blank" rel="noopener">Newer windows ↗</a> · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/OLD-WINDOW-REFERENCES.md" target="_blank" rel="noopener">Older windows ↗</a></div><div class="source-item"><strong>Interior studies, with visible limits</strong><p>${esc(completedFloorSources + partialFloorSources + whiteLayoutSources + greenLayoutSources + otherFloorSources)} ${foldedExteriorSource} Floor heights and actual access still need measured plans. Optional furniture arrangements are concepts, and temporary labels identify no resident or physical room number.</p><a href="https://github.com/mteyra/rommelweb/blob/main/docs/HOUSE55-MODULE-LAYOUT.md" target="_blank" rel="noopener">Red’s layout dimensions ↗</a>${whiteLayoutSources ? ' · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/HOUSE57-MODULE-LAYOUT.md" target="_blank" rel="noopener">White’s layout & resident confirmation ↗</a>' : ''}${greenLayoutSources ? ' · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/HOUSE59-MODULE-LAYOUT.md" target="_blank" rel="noopener">Green’s layout & resident confirmation ↗</a>' : ''} · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/${fittedHouses.length ? 'OLD-HOUSES-MODULE-LAYOUT.md' : 'OLD-HOUSES-STUDY.md'}" target="_blank" rel="noopener">Other houses’ fit checks ↗</a></div></div><p class="source-note">Datenquelle: Bayerische Vermessungsverwaltung – <a href="https://www.geodaten.bayern.de" target="_blank" rel="noopener">www.geodaten.bayern.de</a> · CC BY 4.0. Reprojected for the web. Floor references © OpenStreetMap contributors, ODbL. LoD2 footprint reference: 2025-10-14. No façade photographs are bundled.</p>`);
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
  state.apartment = null;
  state.exploded = false;
  state.floor = null;
  $('#map-labels').replaceChildren();
  fallbackMap($('#scene'), campus, number => travel(number));
  $('#scene-caption').textContent = '2D view · choose a house to explore.';
  renderHouse();
}

async function init() {
  try {
    [campus, lod2, interiors, studies] = await Promise.all(['campus.json', 'lod2.json', 'interiors.json', 'interior-studies.json'].map(async file => {
      const response = await fetch(`${base}data/${file}`);
      if (!response.ok) throw new Error(`Map data unavailable (${response.status})`);
      return response.json();
    }));
    validateInteriorData(interiors, campus, lod2);
    validateInteriorStudies(studies, campus, lod2);
    campus.buildings.forEach(building => {
      const model = lod2.buildings.find(item => item.number === building.number);
      Object.assign(building, { height: model.height, baseY: model.baseY, footprint: model.groundPolygons[0] });
    });
    groups = [...clubs, ...campus.buildings.map(building => ({ id: `house-${building.number}`, title: `House ${building.number}`, category: `${building.name.toUpperCase()} / WHATSAPP`, house: building.number, location: `Campus Süd ${building.campus}`, description: 'The little conversations that make a house a home. A private space for the people who live here.', source: null }))];
    try { scene = new CampusScene($('#scene'), $('#map-labels'), campus, lod2, interiors, number => travel(number), selectFloor, spaceDialog, studies); }
    catch (error) { console.warn('3D unavailable; using the map fallback.', error); activateFallback(); }
    setTheme(state.theme);
    await scene?.pathLoad;
    $('#scene-loading').hidden = true;
    renderTimeline();
    renderHouse();
    $('#home-button').onclick = () => travel(null);
    $('#close-house').onclick = () => { travel(null); $('#home-button').focus({ preventScroll: true }); };
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
    $('#group-back').onclick = () => setGroupDetails(false);
    $('#group-close').onclick = () => setGroups(false);
    $('#group-backdrop').onclick = () => setGroupDetails(false);
    $('#group-deck').addEventListener('keydown', event => {
      containGroupFocus(event);
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
      state.apartment = null;
      state.floor = null;
      scene?.explode(state.exploded);
      scene?.setFloor(null);
      renderHouse();
      if (!state.exploded) $('#scene-caption').textContent = 'Photo-informed linework on the official exterior.';
    };
    $('#all-floors').onclick = () => selectFloor(null);
    $('#back-to-floor').onclick = () => selectFloor(state.floor);
    $('#apartment-notes').onclick = apartmentNotesDialog;
    document.addEventListener('rommel:webgl-lost', activateFallback);
    document.addEventListener('keydown', event => {
      if ($('#modal').open) return;
      if (event.key === 'Escape') {
        if (state.groupDetails && state.groupsOpen) { setGroupDetails(false); }
        else if (state.timelineOpen) { setTimeline(false); $('#open-timeline').focus(); }
        else if (state.groupsOpen) { setGroups(false); $('#open-groups').focus(); }
        else if (state.apartment) { selectFloor(state.floor); }
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
