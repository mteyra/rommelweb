import { $, $$, state, campus, toast, modal, animatePanelVisibility } from './core.js';
import { travel } from './house-panel.js';
import { setGroups } from './groups.js';
import { escapeHTML as esc, downloadFile } from '../data.js';
import { calendarDraft, orderedDrafts } from '../events.js';

export function setTimeline(open, focus = false) {
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

export function renderTimeline() {
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

export function eventDraftDialog() {
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
