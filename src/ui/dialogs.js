import { $, $$, state, campus, lod2, studies, lastFocus, house, setLastFocus, toast, modal } from './core.js';
import { escapeHTML as esc, downloadFile } from '../data.js';
import { isIndependentLayout, isNewerModuleLayout } from '../interior-studies.js';
import { roomReferences, roomReferenceSource } from '../room-references.js';

export function privateAccess(title = 'Your resident community') {
  modal(`<div class="modal-eyebrow">THE RESIDENT SIDE · PLANNED</div><h2 class="modal-title">${esc(title)}</h2><p class="modal-lead">A little community. A private doorstep.</p><p>Private group invitations will require current, verified residency. That service is not connected yet, so no WhatsApp invite or resident QR is exposed here.</p><p>Neighbor discovery and knocking will be opt-in. Membership expires when you leave; group admins still manage WhatsApp removal.</p><a class="outline-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/SOFTWARE.md#planned-resident-services" target="_blank" rel="noopener">Read the resident architecture ↗</a>`);
}

export function toolsDialog() {
  modal(`<div class="modal-eyebrow">ROMMELWEB / FIELD NOTES</div><h2 class="modal-title">A place taking shape.</h2><p class="modal-lead">Eleven real houses. A community we can build together.</p><div class="tool-links"><button class="outline-button" id="tools-rooms">Published room designs ↗</button><button class="outline-button" id="tools-sources">Model & façade sources ↗</button><button class="outline-button" id="tools-correction">Add a building detail ↗</button><button class="outline-button" id="tools-resident">Resident privacy & knocking ↗</button><a class="outline-button" href="https://github.com/mteyra/rommelweb/blob/main/docs/SOFTWARE.md#planned-resident-services" target="_blank" rel="noopener">Architectural brief ↗</a></div><p class="field-note">Click a house to explore · click empty space to return · drag to orbit · scroll to zoom · arrow keys on the map to orbit · Tab to a house label and Enter to explore · Escape to close an overlay.</p><p class="field-note">Independent resident project. <a href="https://rommelwood.de/" target="_blank" rel="noopener">Meet Rommelwood e.V. ↗</a></p>`);
  $('#tools-rooms').onclick = () => roomReferencesDialog();
  $('#tools-sources').onclick = () => { $('#modal').close(); accuracyDialog(); };
  $('#tools-correction').onclick = () => { $('#modal').close(); correctionDialog(); };
  $('#tools-resident').onclick = () => { $('#modal').close(); privateAccess(); };
}

export function roomReferencesDialog(campusId = house(state.selected)?.campus || 'I') {
  const reference = roomReferences[campusId];
  if (!reference) return;
  const alreadyOpen = $('#modal').open;
  const returnFocus = lastFocus;
  modal(`<div class="modal-eyebrow">PUBLISHED ROOM REFERENCES</div><h2 class="modal-title">A first look inside.</h2><p class="modal-lead">Examples from the resident association and operator. These drawings are not assigned to individual rooms on the map.</p><div class="reference-tabs" role="group" aria-label="Choose a campus">${Object.keys(roomReferences).map(id => `<button class="outline-button" data-reference-campus="${id}" aria-pressed="${campusId === id}">Süd ${id} · ${id === 'I' ? 'older' : 'newer'} houses</button>`).join('')}</div><p class="field-note">${esc(reference.houses)}</p><div class="source-list">${reference.plans.map(plan => `<div class="source-item"><strong>${esc(plan.title)}</strong><p>${esc(plan.description)}</p><a href="${plan.url}" target="_blank" rel="noopener">${esc(plan.label)} ↗</a></div>`).join('')}<div class="source-item"><strong>Operator’s 2026 room categories</strong><p>${esc(reference.categories)}</p><p class="field-note">These are category averages, not individual clear-area measurements or a whole shared apartment’s area.</p><a href="${reference.operatorUrl}" target="_blank" rel="noopener">Open the operator’s factsheet · PDF ↗</a></div></div><p class="source-note">Sketch dimensions are approximate; centimetres are inferred from the drawings. Rooms may be mirrored. Clear ceiling height does not establish floor-to-floor height. <a href="${roomReferenceSource}" target="_blank" rel="noopener">Read Rommelwood’s original notes ↗</a></p>`);
  if (alreadyOpen) setLastFocus(returnFocus);
  $$('[data-reference-campus]').forEach(button => button.onclick = () => {
    roomReferencesDialog(button.dataset.referenceCampus);
    $(`[data-reference-campus="${button.dataset.referenceCampus}"]`).focus({ preventScroll: true });
  });
}

export function accuracyDialog() {
  const model = lod2.buildings.find(building => building.number === state.selected);
  const independentHouses = Object.entries(studies?.buildings || {}).filter(([number, building]) =>
    building.levels.length === (campus?.buildings?.find(item => item.number === number)?.levels ?? 3) && building.levels.every(isIndependentLayout)).map(([number]) => number);
  const independentHouseNames = independentHouses.length > 2
    ? `${independentHouses.slice(0, -1).join(', ')} and ${independentHouses.at(-1)}` : independentHouses.join(' and ');
  const completedFloorSources = `${independentHouses.length === 1 ? 'House' : 'Houses'} ${independentHouseNames} ${independentHouses.length === 1 ? 'uses' : 'use'} independent layouts on all three levels, with 2.70 × 6.00 m clear rooms, 3.10 m modules and 1.40 m halls. Their outlines follow these chosen dimensions; shared apartments retain whole envelopes with unresolved internal divisions.`;
  const whiteLayoutSources = independentHouses.includes('57')
    ? ' White follows Red’s resident-confirmed internal arrangement, with an east Gym and west Study on EG and only the west balcony on 1. OG.'
    : '';
  const greenLayoutSources = independentHouses.includes('59')
    ? ' Green follows Red on both upper floors, including both first-floor balconies. EG has one north-wing Hausmeister enclosure, an east Garden room, west Storage and the restored A-bank single.'
    : '';
  const orangeLayoutSources = independentHouses.includes('53')
    ? ' Orange House 53 follows the resident’s drawings on all three levels. Its top floor has 20 single rooms; EG and 1. OG each have 22 singles and shared apartment N3–N4. The first floor has the west balcony and a separate stair down to the Bar, following the clarified blue arrow. EG has the Bar beside the east hall and the Common room beside the west hall. Doorway notes distinguish marked access from schematic placement; exact offsets, widths and stair details remain unmeasured.'
    : '';
  const yellowGroundSources = isIndependentLayout(studies?.buildings?.['51']?.levels.find(level => level.index === 0))
    ? ' Yellow House 51’s EG has a resident-marked layout of 23 single rooms, shared apartment A, Sports beside the west hall and Laundry beside the east hall. Sports has a 6.20 × 7.40 m envelope; E’s left module edge in the A wing aligns with the boundary between L1 and L2. Single B sits before shared A; both upper floors retain their completed arrangements.'
    : '';
  const yellowFirstSources = isIndependentLayout(studies?.buildings?.['51']?.levels.find(level => level.index === 1))
    ? ' Yellow House 51’s 1. OG has a resident-marked layout of 23 single rooms, shared apartment A and two balconies. The A wing shifts by one 3.10 m module to align F’s left edge with L1. Doorway notes distinguish annotated ends from schematic access; exact offsets and widths remain unmeasured.'
    : '';
  const yellowTopSources = isIndependentLayout(studies?.buildings?.['51']?.levels.find(level => level.index === 2))
    ? ' Yellow House 51’s 2. OG has a resident-marked layout of 21 single rooms, including E in the A wing and N0. The marked gaps are removed and door positions follow the annotated drawing.'
    : '';
  const newerHouses = Object.entries(studies?.buildings || {}).filter(([, building]) => building.levels.some(isNewerModuleLayout)).map(([number]) => number);
  const newerSources = newerHouses.length
    ? ` Newer houses ${newerHouses.join(', ')} show estimated apartment placements within their unchanged exterior outlines. Singles use a 2.92 × 7.20 m bounding envelope, including internal partitions; its polygon area is not clear living area. WGs represent whole shared apartments for three or four people. House and floor assignments, internal divisions, circulation and openings remain provisional, and unused gray space stays unassigned.`
    : '';
  const foldedExteriorSource = independentHouses.length > 1 ? 'The folded exteriors retain their source models.' : 'The folded exterior retains its source model.';
  modal(`<div class="modal-eyebrow">THE MODEL / ${state.selected ? `HOUSE ${state.selected}` : 'CAMPUS'}</div><h2 class="modal-title">Real shape. Visible craft.</h2><div class="source-list"><div class="source-item"><strong>Verified exterior source</strong><p>Eleven address-matched LoD2 models, 289 wall, roof and ground surfaces.${model ? ` House ${state.selected}: ${model.height.toFixed(2)} m high, model date ${model.creationDate}.` : ''} Source geometry remains in metres; the camera makes the houses feel closer.</p><a href="${lod2.metadata.url}" target="_blank" rel="noopener">Bavaria’s official model ↗</a></div><div class="source-item"><strong>Photo-informed façade linework</strong><p>Timber grooves, weathering and staggered older-house plates follow photographic references. Lila and Grey include identified recessed balconies and stair fronts; mapped window rows retain their blank timber spans. Blue’s upper rows align, and Red has separately identified rear and roof glazing. Recess depths, equipment positions and unseen openings remain estimated. Source exterior dimensions remain unchanged.</p><a href="https://github.com/mteyra/rommelweb/blob/main/docs/EXTERIORS.md#accuracy-and-limits" target="_blank" rel="noopener">Photo study and limits ↗</a> · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/EXTERIORS.md#how-an-exterior-is-drawn" target="_blank" rel="noopener">Material references ↗</a> · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/EXTERIORS.md#newer-house-windows" target="_blank" rel="noopener">Newer windows ↗</a> · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/EXTERIORS.md#older-house-windows" target="_blank" rel="noopener">Older windows ↗</a></div><div class="source-item"><strong>Interior studies, with visible limits</strong><p>${esc(completedFloorSources + whiteLayoutSources + greenLayoutSources + orangeLayoutSources + yellowGroundSources + yellowFirstSources + yellowTopSources + newerSources)} ${foldedExteriorSource} Floor heights and actual access still need measured plans. Optional furniture arrangements are concepts, and temporary labels identify no resident or physical room number.</p><a href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#house-55-2-og" target="_blank" rel="noopener">Red’s layout dimensions ↗</a>${whiteLayoutSources ? ' · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#house-57-white" target="_blank" rel="noopener">White’s layout & resident confirmation ↗</a>' : ''}${greenLayoutSources ? ' · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#house-59-green" target="_blank" rel="noopener">Green’s layout & resident confirmation ↗</a>' : ''}${orangeLayoutSources ? ' · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#house-53-orange" target="_blank" rel="noopener">Orange’s layouts & access notes ↗</a>' : ''}${yellowGroundSources ? ' · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#house-51-eg" target="_blank" rel="noopener">Yellow’s ground-floor layout & room types ↗</a>' : ''}${yellowFirstSources ? ' · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#house-51-1-og" target="_blank" rel="noopener">Yellow’s first-floor layout & access notes ↗</a>' : ''}${yellowTopSources ? ' · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#house-51-2-og" target="_blank" rel="noopener">Yellow’s top-floor layout & door marks ↗</a>' : ''}${newerSources ? ' · <a href="https://github.com/mteyra/rommelweb/blob/main/docs/INTERIORS.md#newer-houses" target="_blank" rel="noopener">Newer apartment estimates & sources ↗</a>' : ''}</div></div><p class="source-note">Datenquelle: Bayerische Vermessungsverwaltung – <a href="https://www.geodaten.bayern.de" target="_blank" rel="noopener">www.geodaten.bayern.de</a> · CC BY 4.0. Reprojected for the web. Floor references © OpenStreetMap contributors, ODbL. LoD2 footprint reference: 2025-10-14. No façade photographs are bundled.</p>`);
}

export function correctionDialog(number = state.selected || '', floor = state.floor) {
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
