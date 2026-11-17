import { setGroupDetails } from './groups.js';

export const $ = selector => document.querySelector(selector);
export const $$ = selector => [...document.querySelectorAll(selector)];
export const base = import.meta.env.BASE_URL;
export const state = { selected: null, floor: null, exploded: false, apartment: null, groupsOpen: false, groupDetails: false, timelineOpen: false, groupIndex: 0, drafts: [], theme: 'night' };
// Loaded data, the 3D scene, the group list and the element to refocus after a dialog.
// Other modules read these live; they change them only through the setters below.
export let campus, lod2, interiors, studies, scene, groups, lastFocus;
let toastTimer;
const panelAnimations = new WeakMap();
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const house = number => campus.buildings.find(building => building.number === number);
export const floorNotation = floor => floor === 0 ? 'EG' : `${floor}. OG`;
export const setHash = hash => history.replaceState(null, '', `#${hash}`);

export function setData(values) { ({campus, lod2, interiors, studies} = values); }
export const setScene = value => { scene = value; };
export const setGroupList = value => { groups = value; };
export const setLastFocus = value => { lastFocus = value; };

export function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3800);
}

export function modal(content) {
  lastFocus = document.activeElement;
  $('#modal-body').innerHTML = content;
  $('#modal-body .modal-title').id = 'modal-title';
  $('#modal').setAttribute('aria-labelledby', 'modal-title');
  $('#modal').showModal();
}
$('#modal-close').onclick = () => $('#modal').close();
$('#modal').addEventListener('close', () => (lastFocus?.isConnected ? lastFocus : $('#open-tools')).focus({ preventScroll: true }));
$('#modal').addEventListener('click', event => { if (event.target === $('#modal')) $('#modal').close(); });

export function animatePanelVisibility(panel, toggle, open, offset = '0 -8px') {
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
