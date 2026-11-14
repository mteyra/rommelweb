export const clubs = [
  { id: 'cinema', title: 'Rommelkino', category: 'FILM & CULTURE', house: '55', icon: 'film', color: '#cf7758', description: 'Film nights, a shared screen, and a room full of neighbors.', location: 'Common room · Red house', source: 'https://rommelwood.de/rommelkino/', availability: 'Resident association activity' },
  { id: 'bikes', title: 'Bicycle workshop', category: 'MAKE & REPAIR', house: '57', icon: 'bike', color: '#647e72', description: 'A place to fix a puncture, share tools, and keep Erlangen moving.', location: 'Forest-facing side · White house', source: 'https://rommelwood.de/fahrradwerkstatt/', availability: 'Resident association facility' },
  { id: 'garden', title: 'Community garden', category: 'GROW TOGETHER', house: '59', icon: 'leaf', color: '#67924c', description: 'A little shared green, just behind the green house.', location: 'Behind the Green house', source: 'https://rommelwood.de/garten/', availability: 'Resident association activity' },
  { id: 'language', title: 'Sprachcafé', category: 'MEET & CONNECT', house: '51a', icon: 'chat', color: '#648fb3', description: 'An international meeting place for languages and new connections.', location: 'Community room · Blue house', source: 'https://www.werkswelt.de/index.php?id=sprachcafe&setlang=en', availability: 'Check the operator for current details' },
  { id: 'football', title: 'Erwin Lakers', category: 'SPORT & OUTDOORS', house: null, icon: 'ball', color: '#a68b54', description: 'The dorm’s football community. New teammates welcome.', location: 'Campus-wide · venue to confirm', source: 'https://rommelwood.de/fussball/', availability: 'Resident football team' },
];

export function roomsFor(markers, number, floor) {
  return markers.filter(room => room.house === number && Number(room.floor) === Number(floor))
    .sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

export function filterBuildings(buildings, search, campus) {
  const term = search.trim().toLowerCase();
  return buildings.filter(b => (campus === 'all' || b.campus === campus) &&
    `${b.number} ${b.name} ${b.address} ${b.wings.join(' ')} campus süd ${b.campus}`.toLowerCase().includes(term));
}

export function floorName(floor) { return Number(floor) === 0 ? 'Ground floor · EG' : `Floor ${floor} · ${floor}. OG`; }

export function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export function downloadFile(name, content, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
