# Rommelweb

A spatial community home for **Campus Süd I and II**, Erwin-Rommel-Straße, Erlangen.

**Pages deployment target:** https://mteyra.github.io/rommelweb/

Deployment is awaiting an account or repository change: GitHub's current free plan rejected Pages for this private repository. The repository remains private, and no approval to make it public has been given. The build and publishing workflow are ready. See [release checks](docs/RELEASE-CHECKS.md).

This independent resident project starts with the actual eleven houses and grows toward a private, verified community. It is not an official FAU, Studierendenwerk or Rommelwood e.V. service.

![Rommelweb dark campus explorer with eleven official exterior models](docs/preview/campus.png)

Preview details: [group carousel](docs/preview/groups.png) · [timber linework](docs/preview/timber-detail.png) · [unfolded levels](docs/preview/unfolded-levels.png) · [phone layout](docs/preview/mobile.png) · [timeline](docs/preview/timeline.png).

## This release

- An interactive Three.js map using **official Bavarian LoD2 geometry**: 289 wall, roof and ground surfaces across eleven address-matched buildings.
- A dark, full-screen spatial interface with closer camera framing. Geographical alignment, metre scale, source roof shapes, height attributes and relative building-base elevations remain unchanged.
- A hiking-style signpost with camera-relative arrows and straight-line distances to nearby houses, plus a compact searchable **All houses** picker.
- Clickable houses, smooth camera focus, orbit/zoom and top view.
- Photo-informed façade linework: vertical timber seams on the newer houses and staggered horizontal plates on the older houses. Seam spacing and floor bands are schematic; source polygons are unchanged. Decorative trees and gray context blocks have been removed.
- An exploded **level study**, using OSM floor counts. Its equal floor spacing is provisional.
- A group carousel with locally generated QR codes for public activity pages and map links to their known houses: cinema at 55, bicycle workshop at 57, garden behind 59, and Sprachcafé at 51a. House WhatsApp cards remain locked and expose no invite link or private QR.
- A right-side timeline for personal event drafts, with house links, removal and `.ics` export. Drafts exist only in the open tab's memory and disappear on reload or close; no events are published or sent.
- A responsive house picker and a 2D fallback when WebGL is unavailable.
- Local correction-file downloads for building details. The form uploads nothing.
- A concrete architectural brief, residency-validation workflow and proposed API contract.

## What still requires evidence or infrastructure

**Interiors:** approved room numbers, room and corridor boundaries, real floor elevations, entrances, stairs and accessible routes. The existing public map's individual room database has not been republished: its reuse rights are unclear and many coordinates are unsuitable for precise geometry. The public room-data starter contains aggregate research metadata and no individual room records.

**Resident services:** authentication, residency verification, WhatsApp invitations, discoverability, knocking, messages, shared event publishing and personal connection graphs. The interface explains these planned features; it does not simulate a secure backend.

GitHub Pages is a static host. Private records and invite secrets must be retrieved from a separate authenticated service with current-membership and scope checks on every request. See the [architectural brief](docs/ARCHITECTURE.md).

## Develop

Requires Node.js 22 or newer.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

The base path is `/rommelweb/`. `npm run dev` prints the complete local URL. Dependencies, fonts, geometry and UI assets are served locally; the running map does not contact map tiles, analytics, geolocation or a third-party CDN. QR codes are generated in the browser from public activity URLs, without a QR service. External pages open only when their link or QR is followed.

The GitHub Actions workflow is configured to build, test and deploy `dist/` through GitHub Pages on pushes to `main`. Pages activation is currently blocked by the private-repository/free-plan restriction above. Once the user approves public repository visibility or enables a plan supporting private-repository Pages, configure **Settings → Pages → Source: GitHub Actions**. The intended website audience is public; source-repository privacy does not protect resident data in a static build.

## Project guide

| Path | Purpose |
| --- | --- |
| `src/scene.js` | Official exterior rendering, camera-relative directions, framing and provisional exploded levels |
| `src/facade.js` | Photo-informed schematic seams clipped to unchanged exterior surfaces |
| `src/main.js` | Signpost, house picker, group/QR carousel, local timeline and dialogs |
| `src/data.js` | Public community listings and small data helpers |
| `src/events.js` | Order personal drafts and export calendar files |
| `src/interiors.js` | Validate approved plans and interpolate unknown floor guides around verified elevations |
| `src/styles.css` | Responsive dark spatial interface |
| `public/data/lod2.json` | Official exterior polygons transformed into campus coordinates |
| `public/data/campus.json` | OSM footprints, storey counts, context and house identity references |
| `public/data/campus.geojson` | OSM reference footprints and context in geographic coordinates |
| `public/data/room-markers.json` | Aggregate room-source research metadata; no individual records |
| `public/data/interiors.json` | Approved interior geometry; empty until plans are reviewed |
| `data/source/` | Retained source subset, snapshots and checksums |
| `scripts/acquire-lod2.py` | Reproduce official geometry using pinned projection tooling |
| `scripts/acquire-campus.py` | Reproduce the OSM reference and context dataset |
| `docs/ARCHITECTURE.md` | Product, privacy, data model, permissions and staged delivery |
| `docs/GEOMETRY.md` | Detailed geometry provenance, transformations and uncertainties |
| `docs/FACADE-REFERENCES.md` | Inspected photo references and schematic material-line limits |
| `docs/RESEARCH.md` | Source register and confirmed campus/community facts |
| `docs/RESIDENT-VALIDATION.md` | Collaborative validation and first-resident pilot |
| `docs/INTERIOR-FORMAT.md` | How to add approved room outlines, labels and floor elevations |
| `docs/RELEASE-CHECKS.md` | Validation performed and current publication status |
| `docs/api-contract.yaml` | Proposed future API; no deployed endpoints |

## Reproduce and improve the model

The official source subset is retained so reproduction does not depend on a changing external tile:

```sh
uv run scripts/acquire-lod2.py
python3 scripts/acquire-campus.py
```

Read the scripts' `--help` and [geometry notes](docs/GEOMETRY.md) before refreshing sources. Explicit fetches can update upstream data; review the resulting diff and source dates.

Start an interior contribution by selecting a house, choosing **Unfold the floors**, opening a level's details and selecting **Add a floor detail**. The downloaded JSON is a proposal, not an automatic geometry edit. Establish plan reuse permission, remove personal/security details, and follow the validation checklist before adding it to the public model.

The [interior schema](docs/INTERIOR-FORMAT.md) and renderer already support partial approved plans. Their room outlines and labels appear when selecting the corresponding unfolded floor. Verified floor elevations anchor the model; unverified guides interpolate between them and remain provisional.

## Data credits

**Datenquelle: Bayerische Vermessungsverwaltung – www.geodaten.bayern.de.** Official LoD2-BY, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Coordinates have been reprojected and surfaces converted for web rendering. Individual footprint currency and model creation dates are retained; retrieval on 14 November 2026 is not a new survey.

**© OpenStreetMap contributors**, [ODbL](https://www.openstreetmap.org/copyright). Original OSM geometry, storey counts and derived data remain separately identified. Retained context data is not rendered as decorative trees or neighboring gray blocks.

House names, color conventions and community facts are referenced to [Rommelwood e.V.](https://rommelwood.de/) and the [Studierendenwerk](https://www.werkswelt.de/). Their original map artwork, photographs, prose, contact lists and private invitations are not included.

Façade photographs are linked in the [reference study](docs/FACADE-REFERENCES.md) and are not bundled. Procedural material seams are approximate visual annotations, not measured façades or inferred windows.

Manrope and JetBrains Mono use the SIL Open Font License; notices are in `public/fonts/LICENSES.txt`. Third-party code retains its package licenses.
