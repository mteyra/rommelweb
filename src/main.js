import './styles.css';
import { $, base, state, campus, lod2, interiors, studies, scene, groups, setHash, setData, setScene, setGroupList } from './ui/core.js';
import { travel, renderHouse, selectFloor, spaceDialog, apartmentNotesDialog } from './ui/house-panel.js';
import { setGroups, setGroupDetails, containGroupFocus, stepGroup } from './ui/groups.js';
import { setTimeline, renderTimeline, eventDraftDialog } from './ui/timeline.js';
import { toolsDialog, accuracyDialog } from './ui/dialogs.js';
import { CampusScene, fallbackMap } from './scene.js';
import { validateInteriorData } from './interiors.js';
import { clubs } from './data.js';
import { validateInteriorStudies } from './interior-studies.js';

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

function activateFallback() {
  scene?.dispose();
  setScene(null);
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
    const loaded = await Promise.all(['campus.json', 'lod2.json', 'interiors.json', 'interior-studies.json'].map(async file => {
      const response = await fetch(`${base}data/${file}`);
      if (!response.ok) throw new Error(`Map data unavailable (${response.status})`);
      return response.json();
    }));
    setData({campus: loaded[0], lod2: loaded[1], interiors: loaded[2], studies: loaded[3]});
    validateInteriorData(interiors, campus, lod2);
    validateInteriorStudies(studies, campus, lod2);
    campus.buildings.forEach(building => {
      const model = lod2.buildings.find(item => item.number === building.number);
      Object.assign(building, { height: model.height, baseY: model.baseY, footprint: model.groundPolygons[0] });
    });
    setGroupList([...clubs, ...campus.buildings.map(building => ({ id: `house-${building.number}`, title: `House ${building.number}`, category: `${building.name.toUpperCase()} / WHATSAPP`, house: building.number, location: `Campus Süd ${building.campus}`, description: 'The little conversations that make a house a home. A private space for the people who live here.', source: null }))]);
    try { setScene(new CampusScene($('#scene'), $('#map-labels'), campus, lod2, interiors, number => travel(number), selectFloor, spaceDialog, studies)); }
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
