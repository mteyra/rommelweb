const paths = {
  door: '<path d="M6 21V3h12v18M3 21h18M14 12h.01"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4m-4 6h4M17 9h4m-4 6h4"/>',
  bike: '<circle cx="6" cy="16" r="4"/><circle cx="18" cy="16" r="4"/><path d="m6 16 5-9 7 9M6 16h8l-4-7M9 7h4m3-3h3l-2 6"/>',
  leaf: '<path d="M20 3C6 2 2 9 5 16c6 8 17 1 15-13Z M5 20 16 8M9 15l-1-5m5 1h4"/>',
  chat: '<path d="M20 15a2 2 0 0 1-2 2H9l-5 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z M8 8h8M8 12h5"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="m12 8 4 3-2 5h-4l-2-5 4-3Zm0 0V3m4 8 5-1m-7 6 3 4m-7-4-3 4m1-9-5-1"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  layers: '<path d="m12 3 10 6-10 6L2 9l10-6Zm-10 12 10 6 10-6M2 12l10 6 10-6"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M7 14h2m4 0h2m-8 4h2"/>',
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.pin}</svg>`;
