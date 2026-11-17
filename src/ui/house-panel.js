import { $, $$, state, interiors, studies, scene, lastFocus, house, floorNotation, setHash, setLastFocus, modal } from './core.js';
import { setGroups } from './groups.js';
import { roomReferencesDialog, correctionDialog } from './dialogs.js';
import { floorName, escapeHTML as esc } from '../data.js';
import { getDisplayLevel, getLevelWindows, isIndependentLayout, isNewerModuleLayout, isModuleLayout } from '../interior-studies.js';
import { icon } from '../icons.js';
import { studyRoomMeasurements } from '../study-measurements.js';
import { apartmentConcept } from '../apartment-concepts.js';

export function travel(number, { fromGroup = false, focus = true } = {}) {
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

export function renderHouse() {
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

export function selectFloor(floor) {
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
  const independent = isIndependentLayout(level);
  const whiteLayout = independent && state.selected === '57';
  const greenLayout = independent && state.selected === '59';
  const orangeLayout = independent && state.selected === '53';
  const yellowGroundLayout = independent && state.selected === '51' && state.floor === 0;
  const yellowFirstLayout = independent && state.selected === '51' && state.floor === 1;
  const yellowTopLayout = independent && state.selected === '51' && state.floor === 2;
  const newer = isNewerModuleLayout(level);
  const newerInventory = !newer ? '' : [
    ['newer-single', 'single', 'singles'], ['newer-accessible', 'accessible single', 'accessible singles'],
    ['newer-wg3', 'WG3', 'WG3 apartments'], ['newer-wg4', 'WG4', 'WG4 apartments'],
  ].flatMap(([typology, singular, plural]) => {
    const count = level.spaces.filter(space => space.typology === typology).length;
    return count ? [`${count} ${count === 1 ? singular : plural}`] : [];
  }).join(' · ');
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
    : newer ? `Estimated · ${newerInventory || 'Common areas'} · original outline`
    : yellowGroundLayout ? '23 singles · Shared A · Sports & Laundry'
    : yellowFirstLayout ? '23 singles · Shared A · 2 balconies'
    : orangeLayout ? state.floor === 2 ? '20 singles · Hall 1.40 m'
      : state.floor === 1 ? '22 singles · Shared N3–N4 · Bar access'
      : '22 singles · Shared N3–N4 · Bar & common room'
    : sharedApartments ? 'Single rooms & shared envelopes · Hall 1.40 m'
    : independent ? 'Room 2.70 × 6.00 m · Module 3.10 m · Hall 1.40 m'
    : level?.spaces.length ? 'Explore a room or a marked doorway.' : 'Interior plan awaiting a verified layout.';
  $('#floor-stage').classList.toggle('is-study', Boolean(level?.isStudy));
  $('#all-floors').setAttribute('aria-pressed', state.floor === null);
  if (inFloors) $('#scene-caption').textContent = state.floor === null
    ? 'A house on its own. Select a floor to look closer.'
    : 'Almost overhead. Drag to adjust; All levels returns to the stack.';
  $('#floor-detail summary').innerHTML = `${state.floor === null ? 'About these levels' : level?.isStudy ? 'Rooms & drawing key' : esc(level?.label || floorName(state.floor))}<span aria-hidden="true">＋</span>`;
  const spaceButtons = level ? `<div class="room-grid">${level.spaces.map(space => `<button class="room-chip${level.isStudy && space.confidence === 'estimated' ? ' is-estimated' : ''}" data-space="${esc(space.id)}"${level.isStudy ? ` aria-label="${esc(`${space.label}, ${yellowGroundLayout ? 'resident-marked ground-floor layout' : yellowFirstLayout ? 'resident-marked first-floor layout' : yellowTopLayout ? 'resident-marked top-floor layout' : orangeLayout ? 'resident-marked arrangement' : whiteLayout || greenLayout ? 'resident-confirmed arrangement' : space.confidence === 'estimated' ? 'estimated area' : 'resident sketch'}, temporary study label`)}"` : ''}>${esc(space.label)}</button>`).join('')}</div>` : '';
  const dimensionEvidence = newer ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#newer-houses" target="_blank" rel="noopener">Newer apartment estimates & sources ↗</a>'
    : whiteLayout ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#house-57-white" target="_blank" rel="noopener">White’s layout & resident confirmation ↗</a>'
    : greenLayout ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#house-59-green" target="_blank" rel="noopener">Green’s layout & resident confirmation ↗</a>'
    : orangeLayout ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#house-53-orange" target="_blank" rel="noopener">Orange’s layouts & access notes ↗</a>'
    : yellowGroundLayout ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#house-51-eg" target="_blank" rel="noopener">Yellow’s ground-floor layout & room types ↗</a>'
    : yellowFirstLayout ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#house-51-1-og" target="_blank" rel="noopener">Yellow’s first-floor layout & access notes ↗</a>'
    : yellowTopLayout ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#house-51-2-og" target="_blank" rel="noopener">Yellow’s top-floor layout & door marks ↗</a>'
    : independent && state.selected === '55' && state.floor === 0 ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#house-55-eg" target="_blank" rel="noopener">Layout dimensions & assumptions ↗</a>'
    : independent && state.selected === '55' && state.floor === 1 ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#house-55-1-og" target="_blank" rel="noopener">Layout dimensions & assumptions ↗</a>'
    : independent ? '<a class="text-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#house-55-2-og" target="_blank" rel="noopener">Layout dimensions & assumptions ↗</a>' : '';
  const drawingEvidence = newer ? 'Estimated newer-house layout · original outline retained'
    : yellowGroundLayout ? 'Resident-marked ground-floor layout · Yellow House'
    : yellowFirstLayout ? 'Resident-marked first-floor layout · Yellow House'
    : yellowTopLayout ? 'Resident-marked top-floor layout · Yellow House'
    : orangeLayout ? 'Resident-marked arrangement · Orange House'
    : greenLayout ? 'Resident-confirmed arrangement · Green House'
    : whiteLayout ? 'Resident-confirmed arrangement · shared with House 55'
    : sharedApartments ? 'Independent floor layout'
    : 'Independent room layout';
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
  const yellowLayoutNote = yellowGroundLayout
    ? 'Yellow’s ground floor has 23 single rooms, shared apartment A, Sports beside the west hall and Laundry beside the east hall. Sports has a 6.20 × 7.40 m envelope. E’s left module edge in the A wing aligns with the boundary between L1 and L2, and single B sits before shared A. Both upper floors retain their own layouts. '
    : yellowFirstLayout
    ? `Yellow’s first floor has 23 single rooms, shared apartment A and two balconies. The A wing is shifted by one 3.10 m module so F’s left edge aligns with L1. Doorway ends follow the annotation where clear; each item’s note distinguishes marked access from schematic placement. `
    : yellowTopLayout
    ? `Yellow’s top floor has 21 single rooms, including E beside D in the A wing and N0 beside N1. Door positions follow the lime-green marks, and the marked surplus gaps are removed. The two rooms labelled E are distinguished by wing in their cards. 1. OG has its own resident-marked layout. `
    : '';
  const orangeLayoutNote = !orangeLayout ? '' : state.floor === 2
    ? 'Orange’s top floor has 20 single rooms in the resident-marked arrangement. Doorway notes distinguish marked access from schematic placement. '
    : state.floor === 1
    ? 'Orange’s first floor has 22 single rooms, shared apartment N3–N4 and the west balcony. The east enclosure contains a separate stair down to the ground-floor Bar. Doorway notes distinguish marked access from schematic placement. '
    : 'Orange’s ground floor has 22 single rooms, shared apartment N3–N4, the Bar beside the east hall and the Common room beside the west hall. The Bar has a separate stair connection to 1. OG; each opening has its own access note. ';
  const stackLayoutNote = studies?.buildings?.[state.selected]?.levels.some(isNewerModuleLayout)
    ? 'These estimated apartment layouts fit inside the existing exterior sections. Singles and whole shared apartments use newer-house references; their house and floor assignments remain provisional. Unused gray space stays unassigned. Select a floor to review its proposed spaces and evidence.'
    : state.selected === '57' && studies?.buildings?.['57']?.levels.every(isIndependentLayout)
    ? 'White follows Red’s resident-confirmed internal arrangement on all three levels. Its EG common rooms are the east Gym and west Study; 1. OG has only the west balcony. Select a floor for the layout, dimensions and drawing key.'
    : state.selected === '59' && studies?.buildings?.['59']?.levels.every(isIndependentLayout)
    ? 'Green follows Red on 1. OG and 2. OG. EG has the Hausmeister enclosure, Garden room, Storage and the restored single beside the A bank. Select a floor for the layout, dimensions and drawing key.'
    : state.selected === '53' && studies?.buildings?.['53']?.levels.length === 3 && studies.buildings['53'].levels.every(isIndependentLayout)
    ? 'Orange has resident-marked layouts on all three levels. The 2. OG has 20 single rooms; EG and 1. OG each have 22 singles plus shared apartment N3–N4. The first floor has the west balcony and a separate stair down to the Bar. EG has the Bar in the east and the Common room in the west. Select a floor for its rooms, dimensions and access notes.'
    : state.selected === '51'
    ? 'Yellow has independent layouts on all three levels. EG contains 23 singles, shared A, Sports and Laundry; 1. OG retains 23 singles, shared A and two balconies; 2. OG retains 21 singles. Select a floor to review its rooms, dimensions and drawing key.'
    : 'Each plate cuts through the actual exterior at its level. Upper sections follow the stepped roofs. Floor heights and room plans still need verification.';
  const openingPrecision = yellowGroundLayout || yellowFirstLayout || yellowTopLayout || orangeLayout
    ? 'Window positions and exact doorway offsets and widths remain schematic.'
    : 'Window and doorway positions remain schematic.';
  const dimensionNote = whiteLayoutNote + greenLayoutNote + yellowLayoutNote + orangeLayoutNote + (newer
    ? `Proposed inventory: ${newerInventory || 'common and service areas'}. WG3 and WG4 identify whole apartments for three and four people, each with one proposed hallway entrance. Singles use the resident drawing’s 2.92 × 7.20 m bounding envelope. Its 21.02 m² includes bathroom partitions and is not clear living area; the operator’s average single category is 19.4 m². Bedroom and shared-service divisions within WGs remain unresolved. Apartment types, room counts, corridors, stairs, loggias and openings are estimated placements. The original exterior outline is retained in full; unused gray space remains unassigned pending on-site checks.`
    : sharedApartments
    ? `Single rooms have 2.70 × 6.00 m clear rectangles (16.20 m²), with a 0.20 m side wall on each side of every 3.10 m module. Shared apartments are shown as whole gross envelopes; their internal rooms, services and wall positions remain unresolved. Main hall runs are 1.40 m wide. Outline dimensions describe this independent layout. ${openingPrecision}`
    : `Rooms have 2.70 × 6.00 m clear rectangles (16.20 m²), with a 0.20 m side wall on each side of every 3.10 m module. Halls are 1.40 m wide. Outline dimensions describe this independent layout. ${openingPrecision}`);
  $('#floor-detail-content').innerHTML = level?.isStudy
    ? `<p class="study-evidence">${drawingEvidence}</p><div class="study-legend" aria-label="Drawing key"><span data-evidence="estimated">${newer ? 'Estimate' : 'Layout'}</span>${windows.length ? `<span data-evidence="window">${windows.length} layout windows</span>` : ''}${level.wallBands?.length ? '<span data-evidence="wall-band">Wall allowance</span>' : ''}<span data-evidence="dimension">${independent ? 'Layout / m' : 'Exterior / m'}</span></div>${spaceButtons}<p>Lettered labels are temporary, not physical room numbers. Divisions and doorway positions still need verification.</p><p>${dimensionNote}</p>${studyNotes(level)}<small>Source: ${esc(level.source)}</small><div class="floor-reference-actions"><button class="text-button" id="contribute-floor">Correct this study ↗</button>${dimensionEvidence}</div>`
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
  const newerYellowFirst = state.selected === '51' && level.index === 2
    && isIndependentLayout(studies?.buildings?.['51']?.levels.find(item => item.index === 1));
  const newerYellowGround = state.selected === '51' && level.index > 0
    && isIndependentLayout(studies?.buildings?.['51']?.levels.find(item => item.index === 0));
  const notes = (Array.isArray(level.notes) ? level.notes : [level.notes])
    .filter(note => typeof note === 'string' && note.trim())
    .map(note => newerYellowFirst
      // Preserve the accepted top-floor record; its lower-floor status predates
      // the separate first-floor revision and must read as historical here.
      ? note.replace('EG and 1. OG remain exactly as previously drawn and await separate instructions.',
        'that revision left the lower floors unchanged. The current 1. OG arrangement is documented separately.')
        .replace('keep the stair block aligned with the untouched lower floors.',
          'kept the stair block aligned with the lower floors at the time of that revision.')
      : note)
    .map(note => newerYellowGround
      ? note.replace('The current 1. OG arrangement is documented separately.',
        'The current lower-floor arrangements are documented separately.')
        .replace('Only this floor changes; EG, the accepted 2. OG and all other houses are preserved.',
          'That revision changed only 1. OG and preserved the other floors. The current EG arrangement is documented separately.')
      : note);
  return notes.length ? `<ul class="study-notes">${notes.map(note => `<li>${esc(note)}</li>`).join('')}</ul>` : '';
}

export function spaceDialog({ house: number, floor, spaceId, openingId }) {
  if (number !== state.selected || floor !== state.floor || !state.exploded) return;
  const level = getDisplayLevel(interiors, studies, number, floor);
  const space = level?.spaces.find(space => space.id === spaceId);
  const door = openingId ? level?.doors?.find(door => door.id === openingId && [door.spaceId, door.toSpaceId].includes(spaceId)) : null;
  if (!space || openingId && !door) return;
  if (level.isStudy) {
    const item = door || space;
    const estimated = item.confidence === 'estimated';
    const independent = isIndependentLayout(level);
    const whiteLayout = independent && number === '57';
    const greenLayout = independent && number === '59';
    const orangeLayout = independent && number === '53';
    const yellowGroundLayout = independent && number === '51' && floor === 0;
    const yellowFirstLayout = independent && number === '51' && floor === 1;
    const yellowTopLayout = independent && number === '51' && floor === 2;
    const newer = isNewerModuleLayout(level);
    const moduleLayout = isModuleLayout(level);
    const sharedApartments = independent && level.spaces.some(space => space.kind === 'shared');
    const enclosedCommonAreas = independent && level.spaces.some(space => space.kind === 'service');
    const stairConnection = !door && space.stairConnection;
    const linkedLevel = stairConnection ? getDisplayLevel(interiors, studies, number, stairConnection.levelIndex) : null;
    const linkedSpace = linkedLevel?.spaces.find(item => item.id === stairConnection.spaceId);
    const title = `${door ? door.label : space.label} · study`;
    const description = newer
      ? door ? 'An estimated doorway in the newer-house apartment study. Its position, width and actual access await on-site checks.'
        : space.typology === 'newer-single' ? 'A single-apartment envelope based on the resident drawing’s 2.92 × 7.20 m dimensions, placed provisionally within this house’s existing outline. The bounding rectangle includes the bathroom and internal partitions.'
          : space.typology === 'newer-accessible' ? 'A proposed accessible single-apartment envelope. The operator publishes a 30.0 m² category, but this house, floor, rectangular fit and access have not been verified.'
            : space.kind === 'shared' ? `A proposed whole ${space.typology === 'newer-wg3' ? '3' : '4'}-person WG apartment, including its bedrooms and shared kitchen, bathroom and circulation. Its allocation to this floor and internal divisions remain unverified.`
              : space.kind === 'corridor' ? 'Estimated circulation between apartment entrances, common space and the stair core. Its dimensions and actual route need on-site checks.'
                : space.kind === 'stairs' || space.kind === 'lift' ? 'An estimated part of the circulation core. Its position, dimensions and connections between floors remain unverified.'
                  : 'A provisional common or service area within the retained exterior outline. Its function, boundaries and access await on-site checks.'
      : door ? yellowGroundLayout
        ? 'A doorway in Yellow’s resident-marked ground-floor layout. Exact offsets, widths and opening details remain schematic.'
        : yellowFirstLayout
        ? 'A doorway in Yellow’s resident-marked first-floor layout. Exact offsets, widths and opening details remain schematic.'
        : yellowTopLayout
        ? 'A doorway placed from the resident’s lime-green mark. Its exact offset, width and opening details remain schematic.'
        : orangeLayout
        ? 'A doorway in Orange’s resident-marked arrangement. Exact offsets, widths and opening details remain schematic.'
        : 'A schematic doorway in the independent room layout. Its position and opening details remain adjustable.'
        : space.kind === 'room' ? 'A clear room rectangle using the chosen 2.70 × 6.00 m dimensions, arranged within a 3.10 m module.'
          : space.kind === 'shared' ? 'A whole shared-apartment envelope. Its internal rooms, services and wall positions remain unresolved.'
          : whiteLayout && space.label === 'West balcony' ? 'The resident-confirmed west balcony on White’s first floor, reached from the west hall. This level has no east balcony.'
          : greenLayout && space.label === 'Hausmeister' ? 'The resident-marked Hausmeister enclosure occupying the north wing. Its former apartment divisions are removed; internal fittings remain undivided.'
          : greenLayout && space.label === 'Garden room' ? 'The Garden room beside the east hall and Hausmeister enclosure, separated from the hall by a wall with one marked doorway.'
          : greenLayout && space.label === 'Storage' ? 'The large Storage room beside the west hall, enclosed with its own marked doorway.'
          : yellowGroundLayout && space.label === 'Sports room' ? 'The 6.20 × 7.40 m Sports enclosure beside Yellow’s west hall. Its right edge meets E’s left module edge in the A wing, aligned with the boundary between L1 and L2; internal fittings remain undivided.'
          : yellowGroundLayout && space.label === 'Laundry' ? 'The Laundry enclosure beside Yellow’s east hall and N0, with one hallway entrance. Equipment and internal fittings remain undivided.'
          : yellowFirstLayout && space.kind === 'service' ? 'A common area enclosed from the hallway in Yellow’s first-floor layout. Exact dimensions and opening details remain schematic.'
          : orangeLayout && stairConnection && space.kind === 'stairs' ? 'The separate stair connects Orange’s first-floor east enclosure to the ground-floor Bar. Its flight, treads and landing dimensions remain schematic.'
          : orangeLayout && stairConnection && space.kind === 'service' ? 'The ground-floor Bar connects to the separate access stair on 1. OG. Its fixtures and exact stair details remain unresolved.'
          : orangeLayout && space.kind === 'service' ? 'A common area enclosed from the hallway in Orange’s resident-marked arrangement. Exact dimensions and opening details remain schematic.'
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
            : yellowGroundLayout
            ? 'A space in Yellow’s resident-marked ground-floor arrangement. Its drawn dimensions remain schematic.'
            : yellowFirstLayout
            ? 'A space in Yellow’s resident-marked first-floor arrangement. Its drawn dimensions remain schematic.'
            : orangeLayout
            ? 'A space in Orange’s resident-marked arrangement. Its drawn dimensions remain schematic.'
            : 'A proposed space in the independent room layout. Its arrangement still needs verification.';
    const measurement = !door ? studyRoomMeasurements(level, space) : null;
    const concept = space.kind === 'room' && !newer ? apartmentConcept(level, space) : null;
    const dimensions = !measurement ? '' : measurement.areaBasis === 'bounding-apartment-envelope'
      ? `<div class="source-item"><strong>${space.kind === 'shared' ? 'Whole WG apartment envelope · estimated' : 'Apartment bounding envelope · estimated'}</strong><p>≈ ${measurement.shortSpan.toFixed(2)} × ${measurement.longSpan.toFixed(2)} m span · ≈ ${measurement.area.toFixed(2)} m² bounding polygon area</p><p>${space.kind === 'shared' ? 'This area covers the whole shared apartment, not one bedroom or one resident’s share. Bedrooms, kitchen, bathroom, partitions and circulation remain undivided.' : 'The bounding envelope includes the bathroom and internal partitions. Its polygon area is not measured clear living area or the operator’s rental-area calculation.'} Spans follow the placed apartment axes; polygon area excludes recesses and cutouts.</p></div>`
      : measurement.areaBasis === 'clear-room-layout'
      ? `<div class="source-item"><strong>Clear room dimensions</strong><p>${measurement.shortSpan.toFixed(2)} × ${measurement.longSpan.toFixed(2)} m · ${measurement.area.toFixed(2)} m² clear polygon area</p><p>3.10 m module = 0.20 m side wall + 2.70 m clear width + 0.20 m side wall. These are the chosen layout dimensions.</p></div>`
      : measurement.areaBasis === 'shared-apartment-layout'
      ? `<div class="source-item"><strong>Shared apartment envelope · before walls</strong><p>${measurement.shortSpan.toFixed(2)} × ${measurement.longSpan.toFixed(2)} m span · ${measurement.area.toFixed(2)} m² gross polygon area</p><p>Whole apartment envelope, including wall allowances. Internal rooms and services have not yet been divided. Spans follow the layout axes; polygon area excludes recesses and cutouts.</p></div>`
      : `<div class="source-item"><strong>Study envelope · before walls</strong><p>≈ ${measurement.shortSpan.toFixed(1)} × ${measurement.longSpan.toFixed(1)} m span · ≈ ${measurement.area.toFixed(1)} m² gross polygon area</p><p>Not measured living area. Spans follow the building axes; polygon area excludes recesses and cutouts.</p></div>`;
    modal(`<div class="modal-eyebrow">HOUSE ${esc(number)} / ${esc(level.label)}</div><h2 class="modal-title">${esc(title)}</h2><div class="study-card-evidence${estimated ? ' is-estimated' : ''}">${newer ? 'Estimated newer-house placement' : yellowGroundLayout ? 'Resident-marked ground-floor layout' : yellowFirstLayout ? 'Resident-marked first-floor layout' : yellowTopLayout ? 'Resident-marked top-floor layout' : orangeLayout ? 'Resident-marked arrangement' : whiteLayout || greenLayout ? 'Resident-confirmed arrangement' : 'Independent layout'}</div><p class="modal-lead">${esc(description)}</p>${space.kind === 'room' || moduleLayout && space.kind === 'shared' ? '<p class="study-identity-note">This is a temporary study label, not a physical room number or a resident assignment.</p>' : ''}${dimensions}${item.note ? `<p class="study-item-note">${esc(item.note)}</p>` : ''}<div class="modal-actions">${linkedSpace ? `<button class="outline-button" id="view-stair-connection">View ${esc(linkedSpace.label)} on ${esc(floorNotation(stairConnection.levelIndex))} ${stairConnection.direction === 'down' ? '↘' : '↗'}</button>` : ''}<button class="outline-button" id="correct-space-study">Suggest a correction ↗</button></div><p class="source-note">Source: ${esc(level.source)}. Study geometry is separate from approved plans; no resident information or occupancy is published.${newer ? ' <a href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#newer-houses" target="_blank" rel="noopener">Newer apartment estimates & sources ↗</a>' : ''}</p>`);
    if (linkedSpace) $('#view-stair-connection').onclick = () => {
      const returnFocus = lastFocus;
      selectFloor(stairConnection.levelIndex);
      spaceDialog({house: number, floor: stairConnection.levelIndex, spaceId: linkedSpace.id});
      setLastFocus(returnFocus);
    };
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

export function apartmentNotesDialog() {
  const concept = state.apartment?.concept;
  if (!concept) return;
  modal(`<div class="modal-eyebrow">APARTMENT / ARRANGEMENT STUDY</div><h2 class="modal-title">One possible way to live here.</h2><p class="modal-lead">Fixed-size furniture from the older single-room sketch, fitted inside this estimated envelope. This does not establish the apartment type, mirror or actual internal layout.</p><div class="source-list">${(concept.notes || []).map(note => `<div class="source-item"><p>${esc(note)}</p></div>`).join('')}</div>${concept.diagnostics?.length ? `<p class="field-note">${esc(concept.diagnostics.map(item => item.message).join(' '))}</p>` : ''}<p class="source-note"><a href="https://rommelwood.de/wohnen/zimmergrundriss/" target="_blank" rel="noopener">Original resident-association sketches ↗</a> · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#evidence-and-open-questions" target="_blank" rel="noopener">What the evidence establishes ↗</a></p>`);
}
