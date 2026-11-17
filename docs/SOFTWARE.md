# Software: app structure, features and workflow

Read this before changing the app, the UI, the build or the tests. For building appearance see [EXTERIORS.md](EXTERIORS.md); for floor plans see [INTERIORS.md](INTERIORS.md).

## Stack

Vite 7 and vanilla JavaScript (ES modules), Three.js for 3D, `polyclip-ts` for polygon operations, `qrcode` for local QR codes. There is no framework, no backend and no runtime network calls apart from loading the site's own files. Node 22 or newer.

## Commands

```sh
npm ci                  # install
npm run dev             # local server; prints the URL (base path /rommelweb/)
npm test                # all tests, about 2 minutes
node --test tests/X.test.mjs   # one file
npm run build           # checks the path cache, then builds dist/
npm run preview         # serve the build
```

Pushing to `main` runs `.github/workflows/pages.yml`: `npm ci`, `npm test`, `npm run build`, then a deploy to GitHub Pages at https://mteyra.github.io/rommelweb/.

Floor-plan generators (the older-house plans are final; their generators reproduce them exactly and are kept as a record):

| Generator | Regenerates |
| --- | --- |
| `npm run layout:build` | House 55 2. OG, the canonical module plan and the sandbox data |
| `npm run layout:first-floor` / `layout:ground-floor` | House 55 1. OG / EG |
| `npm run layout:yellow-top` / `layout:yellow-first` / `layout:yellow-ground` | House 51 floors |
| `npm run layout:orange-house` / `layout:white-house` / `layout:green-house` | Houses 53, 57, 59 |
| `npm run layout:new-houses` | The six newer houses |
| `npm run paths:build` | `public/data/path-network.json` from OSM paths |

Source data refresh: `uv run scripts/acquire-lod2.py` and `python3 scripts/acquire-campus.py`. Both rebuild from the retained source subset in `data/source/`.

## Startup

`src/main.js` → `init()`:

1. Fetches `campus.json`, `lod2.json`, `interiors.json` and `interior-studies.json` from `public/data/`.
2. Validates them (`validateInteriorData`, `validateInteriorStudies`).
3. Creates `new CampusScene(...)` from `src/scene.js`, which also loads `path-network.json`.
4. Binds the UI. Without WebGL it calls `activateFallback()`, a 2D map with keyboard-accessible house buttons.

UI state lives in one object at the top of `main.js`:
`state = {selected, floor, exploded, apartment, groupsOpen, groupDetails, timelineOpen, groupIndex, drafts, theme}`.

## Where each feature lives

| Feature | Code |
| --- | --- |
| Select a house, hover, return to overview | `main.js` `travel()`, `renderHouse()`; `scene.js` `select()`, `pickAt()`, `setHovered()`, `reset()` |
| Unfold floors, pick a floor, top view | `main.js` `selectFloor()`, `renderFloor()`; `scene.js` `explode()`, `setFloor()`, `setTop()` |
| Room and door dialog | `main.js` `spaceDialog()`, `studyNotes()` |
| Furniture concept for a room | `apartment-concepts.js` (layout), `apartment-wireframe.js` (drawing); `scene.js` `focusApartment()` |
| Dimension labels | `study-measurements.js`; `scene.js` `renderExteriorDimensions()` |
| Day / night | `main.js` `setTheme()`; `scene.js` `SCENE_THEMES`, `applyTheme()` |
| Groups carousel and QR codes | `main.js` `setGroups()`, `renderGroup()`, `stepGroup()`; group data in `data.js` `clubs` |
| Timeline drafts and `.ics` export | `main.js` `setTimeline()`, `renderTimeline()`, `eventDraftDialog()`; `events.js` |
| About, accuracy and correction download | `main.js` `toolsDialog()`, `accuracyDialog()`, `correctionDialog()`; `data.js` `downloadFile()` |
| Published room types | `room-references.js`; `main.js` `roomReferencesDialog()` |
| Streets and paths | `paths.js` (runtime), `path-network.js` (build time) |
| Floor sections through the shell | `sections.js` |
| Layout, responsive design, motion | `styles.css` (one file); reduced motion via `prefers-reduced-motion` |

`index.html` holds the static shell: header, Groups and Timeline buttons, panels and data credits.

## Source files

| File | Role |
| --- | --- |
| `main.js` | App entry, state, every panel and dialog, links to these docs |
| `scene.js` | `CampusScene`: Three.js scene, camera, picking, buildings, floors, themes |
| `data.js` | Group listings and small helpers (`floorName`, `escapeHTML`, `downloadFile`) |
| `events.js`, `icons.js`, `room-references.js` | Timeline helpers, inline SVG icons, room-type references |
| `sections.js`, `paths.js`, `path-network.js` | Geometry helpers for floors and paths |
| `interiors.js`, `interior-studies.js`, `interior-wireframe.js`, `study-measurements.js`, `apartment-*.js` | Interiors; see [INTERIORS.md](INTERIORS.md) |
| `facade.js`, `windows.js`, `exterior-*.js`, `*-photo-details.js`, `*-window-layout.js`, `*-bicycle-details.js`, `house55-*.js` | Exteriors; see [EXTERIORS.md](EXTERIORS.md) |

Standalone page, copied as-is into the build: `public/house55-layout/` (House 55 layout sandbox).

## Data files (`public/data/`)

| File | Loaded by app | Contents |
| --- | --- | --- |
| `lod2.json` | yes | Official building surfaces |
| `campus.json` | yes | Names, colors, storeys, OSM footprints and context |
| `interior-studies.json` | yes | Every floor plan of every house |
| `interiors.json` | yes | Approved surveyed plans (empty) |
| `path-network.json` | yes | Precomputed paths with a source hash |
| `house5X-*.json`, `new-house-module-layouts.json` | no | Canonical plans written by the generators |
| `campus.geojson`, `room-markers.json` | no | Reference footprints and aggregate room-research counts |

`data/source/` holds the retained raw sources (LoD2 GML, OSM), resident annotations and historical baselines. Treat it as read-only input.

## Tests

371 tests in `tests/*.test.mjs` (Node's built-in runner), about 100 seconds in total. They cover:

- **Final older houses:** `older-houses-final.test.mjs` locks all 15 older-house floors byte for byte. Never update its fingerprints.

- **Per house:** `house5X-*.test.mjs` (floor plans) and `<house>-photo-details.test.mjs` (exteriors).
- **UI:** `study-ui.test.mjs` runs the real `main.js` panel code in a VM and checks wording, links and controls; also `theme`, `motion`, `fallback` and `scene-views`.
- **Geometry:** `sections`, `paths`, `path-network`, `geometry`, `windows`, `facade`.

**Release receipts.** `docs/evidence/*-preservation.json` record, for each past task, the hashes of the files it left untouched, and tests re-check them. `tests/frozen-files.mjs` decides where each recorded file is read today:
- Docs and screenshots are not frozen.
- Code changed later for an approved reason is read from a dated copy in `tests/fixtures/`.
- Files moved into `archive/` are read from there.
- Everything else must still match.

If a test fails with a hash mismatch after you intentionally change data or code, add a dated fixture copy and map it there. Don't edit the receipt.

## Privacy rules

These are hard rules for the public static site:

- No analytics, ads, map tiles, third-party CDN, geolocation, camera or microphone.
- No cookies or browser storage written by the app. Exception: the House 55 sandbox saves its own local variants.
- Forms (corrections, events) stay in memory and only download a file chosen by the user. Nothing is uploaded.
- No resident names, contacts, room numbers or resident-to-room links, ever. Room labels are drawing references.
- Private actions (WhatsApp groups, messaging) explain that they need a future secure service. Hiding something in the UI is never presented as security.
- External links use `rel="noopener"` and open only when clicked.

## Planned resident services

Not built yet: accounts, residency verification with expiry, private WhatsApp invites, neighbor discovery and "knocking", messages, and shared event publishing. GitHub Pages can't hold private data, so these need a separate authenticated service with per-request membership checks. The proposed design is Supabase in the EU (Postgres with row-level security). It's specified in [archive/ARCHITECTURE.md](archive/ARCHITECTURE.md) (product, data model, roles, staged delivery) and [archive/api-contract.yaml](archive/api-contract.yaml).

Before any resident pilot, the archived [privacy boundary](archive/PRIVACY-BOUNDARY.md) checklist has to be met: revoked members fail every request, invite secrets never reach static files, profiles are hidden by default, and moderation exists before messaging.

## Documentation map

| Path | Read when |
| --- | --- |
| `docs/EXTERIORS.md`, `INTERIORS.md`, `SOFTWARE.md` | Always the starting point |
| `docs/screenshots/README.md` | Looking for a picture of a house, floor or UI state |
| `docs/archive/` | Only for history or a source detail the guides don't cover |
| `archive/` | Never, unless asked: superseded scripts, tests and pages from earlier interior stages |
| `docs/evidence/`, `docs/data/` | Never by hand; machine records read by tests |

## Known issues

- One 930 KB JavaScript bundle (Vite warns). Three.js could be split into its own chunk.
- `styles.css` (about 3,900 lines) and `main.js` (about 870 lines) are single large files.
