import { $, $$, state, groups, reducedMotion, setHash, animatePanelVisibility } from './core.js';
import { travel } from './house-panel.js';
import { setTimeline } from './timeline.js';
import { privateAccess } from './dialogs.js';
import QRCode from 'qrcode';
import { escapeHTML as esc } from '../data.js';
import { icon } from '../icons.js';

let qrRevision = 0;
let renderedGroupId = null, groupSizeAnimation;
const groupBackgroundState = new Map();
const qrCache = new Map();

export function setGroups(open, focus = false) {
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

export function setGroupDetails(open, { animate = true, focus = true } = {}) {
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

export function containGroupFocus(event) {
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

export function stepGroup(delta) {
  state.groupIndex = (state.groupIndex + delta + groups.length) % groups.length;
  const group = groups[state.groupIndex];
  travel(group.house, { fromGroup: true });
  renderGroup();
  setHash(`group-${group.id}`);
}
