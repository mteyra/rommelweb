# Rommelweb

A spatial community home for **Campus Süd I and II**, Erwin-Rommel-Straße, Erlangen.

**Live demo:** https://mteyra.github.io/rommelweb/

The repository and GitHub Pages demo are public. See [release checks](docs/RELEASE-CHECKS.md) for build, browser and publication verification.

**Red House 55 exterior:** the folded model now follows the latest entrance and backside photos, with aligned window stacks, separate red glazing groups, a recessed entrance and “55” sign, and finer canopy, dormer and drainage details. The original building shape and every internal layout remain unchanged. [Exterior refinement](docs/HOUSE55-EXTERIOR-REFINEMENT.md).

**House 55 module layout:** the campus’s unfolded **2. OG**, the [plan study](https://mteyra.github.io/rommelweb/house55-study/) and the [layout sandbox](https://mteyra.github.io/rommelweb/house55-layout/) now start from one shared plan: **20 clear 2.70 × 6.00 m rooms**, **3.10 m modules**, **1.40 m halls** and a **2.70 m stair split (1.30 + 1.40 m)**. Each module allocates a **0.20 m side wall on each side**, leaving **0.40 m between adjacent clear rooms**. The independent outline follows the latest annotated dimensions; the folded official exterior and its source window placements remain unchanged. [Dimensions and assumptions](docs/HOUSE55-MODULE-LAYOUT.md) · [Sandbox guide](docs/HOUSE55-LAYOUT-SANDBOX.md).

The sandbox can explore alternative rectangle proportions while retaining **16.20 m² per room**. Saved sandbox edits are local variants; they do not automatically change the shared starting plan.

**House 55 / 1. OG:** the floor below reuses that exact core and adds the resident's requested end modules and cutouts. It contains **16 singles and four 6.20 × 7.40 m shared-apartment envelopes**: A, W1, N3–N4 and G–H. The two **9.30 × 2.90 m balcony sections** are enclosed, each with one hallway door near the stair. Its **624.48 m²** footprint and confirmed **8.10 m W-wing return** are unchanged, as is the entire top floor. [First-floor dimensions and derivation](docs/HOUSE55-FIRST-FLOOR-LAYOUT.md).

**House 55 / EG:** the ground floor repeats the updated 1. OG apartments and retains all three blue-marked areas. The east/R **cinema** and west/L **laundry** each occupy **9.30 × 7.40 m**, enclosed with one hallway door near the stair. The **7.83 m² stair-side extension** remains unassigned. Its footprint stays **716.01 m²**. [Ground-floor derivation](docs/HOUSE55-GROUND-FLOOR-LAYOUT.md).

**White House 57:** all three floors now use Red’s completed layout, replacing the previous fitted outlines. The only differences are **no east balcony on 1. OG**, an east/R **Gym** on EG and a west/L **Study** on EG. The west balcony, shared apartments, rooms, halls and stairs retain Red’s geometry. [White-floor comparison and derivation](docs/HOUSE57-MODULE-LAYOUT.md).

**Green House 59:** **2. OG and 1. OG match Red**, including both first-floor balconies. EG restores the missing single dorm and joins the N wing into one **Hausmeister** enclosure. The adjacent east/R space is the **Garden room**, with its marked hallway entrance; the west/L space is **Storage**. [Green-floor annotation and derivation](docs/HOUSE59-MODULE-LAYOUT.md).

**Yellow House 51 / 2. OG:** the resident-marked top floor contains **21 singles**, including the added **E** beside D and **N0** beside N1. Its outline removes the blue-marked excess areas, and all room entrances follow the lime-green positions. The top floor remains unchanged by the subsequent 1. OG update. [Yellow top-floor drawing and derivation](docs/HOUSE51-TOP-FLOOR-LAYOUT.md).

**Yellow House 51 / 1. OG:** the second physical storey has **23 singles, shared A and two balconies**. The enlarged A wing shifts by one 3.10 m module so its leftmost room aligns with **L1’s left edge**. Room dimensions and the stair stay fixed; the blue-covered erroneous extension is omitted. [First-floor drawing and alignment](docs/HOUSE51-FIRST-FLOOR-LAYOUT.md).

**Yellow House 51 / EG:** the ground floor completes Yellow’s three-floor layout with **23 singles, shared A, Sports room and Laundry**. B is inserted before the shared A apartment, which shifts right by one module. Sports occupies the west common area and the former A-bank F module; Laundry extends the east common area beside N0. Both upper floors remain unchanged. [Ground-floor arrangement and assumptions](docs/HOUSE51-GROUND-FLOOR-LAYOUT.md).

**Orange House 53:** all three floors now follow the resident’s annotations: **20 singles on 2. OG**, and **22 singles plus shared N3–N4 on each lower floor**. The 1. OG has two enclosures, with **secondary stairs down from the East enclosure to the EG Bar**, as clarified by the blue arrow. EG also includes the stepped **Common Room**. The main stair keeps its original position on every floor. [Orange drawings and derivation](docs/HOUSE53-MODULE-LAYOUT.md).

All **15 older-house floors** now use independent resident-module layouts. No provisional fitted floors remain, and the current fitting catalog is empty. The [earlier placement method and floor counts](docs/OLD-HOUSES-MODULE-LAYOUT.md) remain available as historical evidence.

The [earlier measured-fit candidate](docs/HOUSE55-MEASURED-PLAN.md), [R-bank alignment](docs/HOUSE55-R-ALIGNMENT.md) and [stair reconciliation](docs/HOUSE55-MEASURED-STAIR-RECONCILIATION.md) remain historical evidence. Their fitted room dimensions, **16.4 m² category-average target**, **1.30 m halls** and **2.72 m stair measurement** do not define the current module layout. See [release checks](docs/RELEASE-CHECKS.md) for publication status.

This independent resident project starts with the actual eleven houses and grows toward a private, verified community. It is not an official FAU, Studierendenwerk or Rommelwood e.V. service.

![Rommelweb dark campus explorer with eleven official exterior models](docs/preview/campus.png)

Preview details: [daylight campus](docs/preview/day-campus.png) · [group carousel](docs/preview/groups.png) · [expanded group details](docs/preview/group-details.png) · [Lila façade](docs/preview/lila-facade-night.png) · [daylight detail](docs/preview/lila-facade-day.png) · [Grey loggias](docs/preview/grey-facade-night.png) · [Red rear façade](docs/preview/red-facade-night.png) · [Blue frontage](docs/preview/blue-shared-front.png) · [isolated house floors](docs/preview/unfolded-levels.png) · [earlier House 55 R-alignment](docs/preview/house55-r-alignment-night.png) · [older-house studies](docs/preview/old-house-top-studies.png) · [apartment concept](docs/preview/apartment-concept-night.png) · [published room references](docs/preview/room-references.png) · [phone layout](docs/preview/mobile.png) · [timeline](docs/preview/timeline.png).

## This release

- An interactive Three.js map using **official Bavarian LoD2 geometry**: 289 wall, roof and ground surfaces across eleven address-matched buildings.
- A full-screen spatial interface with **day/night mode**, defaulting to night, and a lower overview from the southwest. Daylight uses warm off-white ground and neutral light panels; geographical alignment, metre scale, source roof shapes, heights and relative building-base elevations remain unchanged.
- Hover a house to highlight it, then click to focus. A primary click on empty map space restores the campus overview; dragging, cancelled gestures and multi-pointer gestures do not trigger that action. The Rommelweb brand also restores the overview. Drag to orbit and use the wheel to zoom.
- Buildings and their address-label buttons are the navigation, with keyboard access through the labels. The selected house's unfold control starts at bottom left; a selected floor uses a compact control bar below its drawing.
- Photo-informed façade linework: fine vertical timber grooves and weathering on the newer houses, and larger staggered plate courses on the older houses. Colored older-house window frames, transoms, reveals, sills and Blue's differing upper blind/head treatment follow the photographic references. These façade details preserve the official exterior geometry.
- **Lila 53a and Grey 55a** now have photographed corner loggias, recessed stair/landing elevations, railings and lime-colored fascias. Identified upper window rows preserve the observed blank timber spans. Blue **51a** retains vertically aligned upper windows. Roofs have inset beds, coping and low photographic hardware studies; Red **55** has separately identified rear shared glazing and a sloped-roof window. Recesses are cut from a display copy of the source faces, so timber and regular windows do not continue through balcony openings. See the [face-by-face photo study](docs/PHOTO-FACADE-UPGRADE.md).
- The **window and exterior-detail layers remain appearance studies**. Visible counts and relative placements have photographic support; absolute opening sizes, recess depths, hidden faces, roof equipment positions and many ground/lower rows remain estimated. No façade detail establishes an occupied room or modifies a floor plan. See the [newer-window evidence](docs/WINDOW-REFERENCES.md).
- Older houses now have three aligned appearance rows where complete windows fit the source shell, including regular ground-row windows. Their approximately 1.05 × 1.55 m profile and 0.95 m sill come from one unassigned room sketch. Row spacing uses a broad horizontal roof as a visual guide and leaves the floor-section elevations unchanged. No opening establishes a room, occupancy or usable roof space. See the [older-window evidence](docs/OLD-WINDOW-REFERENCES.md).
- Continuous streets and paths from retained OSM geometry: joined outlines at intersections, mapped widths where available and crisp screen-width centerlines otherwise. Decorative trees and gray context-building blocks remain absent.
- An unfolded **level study** isolates the selected house. Selecting a floor hides the other levels and moves to a nearly overhead view. Houses **51, 53, 55, 57 and 59** use independent module-layout outlines for **EG, 1. OG and 2. OG**: all 15 older-house floors. The newer houses retain their existing source-section studies. OSM floor counts and provisional heights remain display guides and do not establish occupancy or usable headroom.
- **Red House 55** has studies for **EG, 1. OG and 2. OG**. The unchanged top floor has **20 clear room rectangles of 16.20 m²**, forty separate side-wall allocations, two connected hallway regions, a stairwell and **22 illustrative doors**. The 1. OG and EG each contain **16 singles, four shared-apartment envelopes and 24 illustrative doors**, including one doorway for each enclosed common section. The 1. OG sections are balconies; EG retains the restored outer strips within its cinema and laundry envelopes and leaves the stair-side extension unassigned. Each module floor has **24 layout-window symbols**, separate from the preserved exterior-window inventory. Room popups distinguish clear single-room area from gross shared-apartment envelopes; shared internal layouts remain undetermined. See the [top-floor layout](docs/HOUSE55-MODULE-LAYOUT.md), [first-floor layout](docs/HOUSE55-FIRST-FLOOR-LAYOUT.md) and [ground-floor layout](docs/HOUSE55-GROUND-FLOOR-LAYOUT.md).
- **White House 57** shares Red’s resident-confirmed arrangement across all three floors. Its top floor repeats the 20 singles; both lower floors repeat the 16 singles and four shared apartments. On 1. OG, the east balcony and its doorway are removed, leaving a **597.51 m²** footprint and the enclosed west balcony. EG retains the **716.01 m²** footprint with Gym beside the east hall and Study beside the west hall. Room selection, dimensions, layout windows, doors and camera controls work throughout. See the [White layout guide](docs/HOUSE57-MODULE-LAYOUT.md).
- **Green House 59** repeats Red’s upper floors, with **20 singles on 2. OG** and **16 singles, four shared apartments and both balconies on 1. OG**. EG contains **14 singles, three shared apartments, one Hausmeister enclosure, Garden room and Storage**. The former N-wing apartments and their short hall form the Hausmeister area, with one entrance. All floors share the same stair geometry. See the [Green layout guide](docs/HOUSE59-MODULE-LAYOUT.md).
- **Yellow House 51 / 2. OG** follows the resident’s annotated arrangement: 21 singles with added E and N0, a trimmed outline and entrances near the marked room corners. The original E in the East bank and new E in the A bank have distinct selection identities. Its stair stays aligned with both lower floors. See the [Yellow top-floor guide](docs/HOUSE51-TOP-FLOOR-LAYOUT.md).
- **Yellow House 51’s lower floors** each have 23 singles and shared A. Its 1. OG has two balconies; EG has a **9.30 × 7.40 m Sports room** and **6.20 × 7.40 m Laundry**. Ground-floor B replaces the module count used upstairs by F, with shared A shifted right. The common-area spans are derived from the chosen modules and the general sketch. All three floors retain aligned stairs. See the [first-floor guide](docs/HOUSE51-FIRST-FLOOR-LAYOUT.md) and [ground-floor guide](docs/HOUSE51-GROUND-FLOOR-LAYOUT.md).
- **Orange House 53** has 20 singles on 2. OG and 22 singles plus shared N3–N4 on each lower floor. The annotated split pairs, added E and N0, trimmed top-floor outline and lime-marked entrances use the fixed module dimensions. The 1. OG’s East enclosure connects by secondary stairs down to the EG Bar; its West enclosure and the stepped EG Common Room remain separate spaces. All three main stair positions stay aligned. See the [Orange layout guide](docs/HOUSE53-MODULE-LAYOUT.md).
- All five older houses keep their own official exterior and have independent resident-module studies across **EG, 1. OG and 2. OG**. The former fitted placements, bank offsets and gray remainders remain in historical fixtures; the current provisional catalog is empty. See the [completed-floor status and archived fits](docs/OLD-HOUSES-MODULE-LAYOUT.md) and [source evidence](docs/OLD-HOUSES-INTERIOR-EVIDENCE.md).
- A framework for approved **room, corridor and physical-door wireframes**, including selectable spaces and doors, a low display cutaway and sourced swing arcs when known. Approved `interiors.json` remains empty; the sketch uses its own `interior-studies.json` dataset and cannot set verified floor heights. Study popups explain their evidence and accept correction-file suggestions. No resident identity or physical room number is assigned.
- Selecting a study room can open an isolated **layout concept**. Bed, desk and wardrobe use fixed approximate dimensions from the published older-room sketch; kitchen and bathroom footprints are explicitly chosen examples. A checked dogleg walking route preserves the recorded entrance and a **0.75 m study guard** where the full arrangement fits, with a partial straight-layout fallback otherwise. Furniture is never scaled to force a fit. Notes disclose service overlap with the rear 3.30 m living-depth aim; actual apartment type, mirror, plumbing, bathroom entry and wall dimensions remain unknown.
- The top-right **Groups** button opens and closes a readable card centered beneath the breadcrumb. Floating previous/next arrows browse groups; **Details** expands into a large centered panel with a smooth transition. Locally generated QR codes lead to public activity pages and known houses: cinema at 55, bicycle workshop at 57, garden behind 59, and Sprachcafé at 51a. House WhatsApp cards remain locked and expose no invite link or private QR.
- A quiet, silent interface: camera, floor, theme and group transitions ease between states; façade line density adjusts to the view, and cached QR codes change with their titles. Reduced-motion preferences are respected. No audio code or media is included.
- **Published room designs**, available under floor details and map information, links to resident sketches for both campuses and the operator's 2026 categories. Approximate living-zone dimensions remain separate from category-average areas and geolocated interior geometry.
- The top-right **Timeline** button is the timeline's sole entry point. Its compact, aligned drawer supports personal event drafts, house links, removal and `.ics` export. Drafts exist only in the open tab's memory and disappear on reload or close; no events are published or sent.
- Groups and Timeline are mutually exclusive at every viewport width. Both animate into and out of view, safely reverse an interrupted transition, and switch immediately for reduced motion.
- A 2D fallback with keyboard-accessible house buttons when WebGL is unavailable.
- Local correction-file downloads for building details. The form uploads nothing.
- A concrete architectural brief, residency-validation workflow and proposed API contract.

## What still requires evidence or infrastructure

**Exteriors:** matching a photo establishes visible features and relative placement, not survey accuracy. Additional elevations and measurements are needed for unseen openings, exact loggia depths, equipment sizes and actual storey levels. The retained LoD2 model supplies the common scale and roof/footprint envelope; its simplified geometry is not a façade survey. No numerical accuracy percentage is claimed.

**Interiors:** the current **House 55, 2. OG** plan uses the resident-measured **2.70 m clear width** and the latest chosen **6.00 m length**, **0.20 m side-wall allocations**, **1.40 m halls**, **2.70 m stair split** and annotated outline. These choices are documented as layout dimensions. The full **7.40 m wing depth is already occupied by 6.00 m room depth + 1.40 m hall**; end-wall and hall-wall thicknesses have not been allocated. Bathroom/kitchen partitions, real door and window details, stair run and landings, floor heights and correspondence to the exterior still need evidence. The operator’s **16.4 m²** remains a category average, and the earlier **2.70 × 3.30 m** room sketch describes a living zone. Neither defines the new **16.20 m²** interior rectangle.

The resident has confirmed Red’s lower-floor arrangement, White’s matching layout with its named exceptions, and Green’s matching upper floors and distinct ground-floor uses. All three Yellow and Orange floors follow their own resident annotations. Yellow EG’s common-area spans derive from the existing modules and a general arrangement sketch; Orange’s secondary stair route from 1. OG to the Bar is separately clarified. Related construction history and matching exterior features do not prove identical apartments or corridors. Full plans identified by house and floor, real elevations, wall dimensions, room types and routes are still needed before approving surveyed geometry. Research found typical-room sketches and planning illustrations, but no verified current full-floor plan suitable for this model. See the [old-house evidence](docs/OLD-HOUSES-INTERIOR-EVIDENCE.md), [interior-plan evidence](docs/INTERIOR-PLAN-EVIDENCE.md) and [contribution format](docs/INTERIOR-FORMAT.md). No numerical accuracy percentage is established.

The existing public map's individual room database has not been republished: its reuse rights are unclear and many coordinates are unsuitable for precise geometry. The public room-data starter contains aggregate metadata and no individual source records. Study labels are independent drawing references, not physical room numbers or occupancy records.

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

The GitHub Actions workflow builds, tests and deploys `dist/` through GitHub Pages on pushes to `main`, using **Settings → Pages → Source: GitHub Actions**. Both the repository and demo are intended for public access. Keep resident records, private invitations and credentials out of source, Git history and static assets.

## Project guide

| Path | Purpose |
| --- | --- |
| `src/scene.js` | Official exterior rendering, OSM paths, hover/picking, day/night materials and separated level sections |
| `src/sections.js` | Horizontal intersections through the source shell, preserving holes and separate parts |
| `src/paths.js` | Path-source normalization, cache validation and lightweight rendering geometry |
| `src/path-network.js` | Development-time buffering and union of explicitly mapped path widths |
| `src/facade.js` | Photo-informed schematic seams clipped to unchanged exterior surfaces |
| `src/windows.js` | Separate newer/older window profiles, house-specific corrections and appearance-only row guides |
| `src/exterior-details.js` | Photo-registered loggias, stair fronts, roof details, shared glazing and explicit window rows |
| `src/exterior-presentation.js` | Cut recesses from display surfaces without editing source geometry or interior sections |
| `src/main.js` | House selection, animated group/QR carousel, theme control, local timeline and dialogs |
| `src/data.js` | Public community listings and small data helpers |
| `src/room-references.js` | Cited room typologies and approximate dimensions, without room placements |
| `src/events.js` | Order personal drafts and export calendar files |
| `src/interiors.js` | Validate approved spaces and doors; interpolate unknown floor guides around verified elevations |
| `src/interior-studies.js` | Validate unmeasured studies, prefer approved records, and apply separate display-floor outlines |
| `src/interior-wireframe.js` | Approved/study cutaways, evidence-styled walls, door gaps and selectable space targets |
| `src/apartment-concepts.js` | Fixed-size furniture and chosen service arrangements, with containment, overlap and connected-path guards |
| `src/apartment-wireframe.js` | Isolated room cutaway and separately qualified furniture/service linework in campus metres |
| `src/styles.css` | Responsive day/night spatial interface and reduced-motion styles |
| `public/data/lod2.json` | Official exterior polygons transformed into campus coordinates |
| `public/data/campus.json` | OSM footprints, storey counts, context and house identity references |
| `public/data/path-network.json` | Precomputed OSM path joins with source records and SHA-256 |
| `public/data/campus.geojson` | OSM reference footprints and context in geographic coordinates |
| `public/data/room-markers.json` | Aggregate room-source research metadata; no individual records |
| `public/data/interiors.json` | Approved interior geometry; empty until plans are reviewed |
| `public/data/interior-studies.json` | All 15 completed resident-module floors across Houses 51, 53, 55, 57 and 59 |
| `public/data/house53-module-layouts.json` | Orange’s three annotated floors, first-floor enclosures, secondary stairs to the Bar and stepped EG Common Room |
| `public/data/house55-module-layout.json` | Shared module plan in annotated drawing coordinates, with dimensions, room rectangles, halls, walls and stair zones |
| `public/data/house55-first-floor-layout.json` | First-floor extension of the same core, with four shared apartments, enclosed balconies and annotated cutouts |
| `public/data/house55-ground-floor-layout.json` | Ground-floor continuation, with enclosed cinema/laundry areas and the retained stair-side extension |
| `public/data/house57-module-layouts.json` | White’s three canonical plans derived from Red, without the east first-floor balcony and with Gym/Study on EG |
| `public/data/house59-module-layouts.json` | Green’s completed upper floors and annotated EG with Hausmeister, Garden room and Storage |
| `public/data/old-house-module-layouts.json` | Empty current fitting catalog; superseded placements and gray remainders remain in historical fixtures |
| `public/house55-layout/shell.json` | Sandbox starting rooms and outline generated from the shared module plan |
| `data/source/` | Retained source subset, snapshots and checksums |
| `data/source/house55-2og-before-module-layout.json` | Exact previous top-floor level, retained for historical tests and exterior-window provenance |
| `data/source/house55-2og-module-breakdown.png` | Resident-supplied room-module and stair annotation |
| `data/source/house55-2og-module-outline.png` | Final annotated outline used by the independent layout |
| `data/source/house55-2og-sketch-baseline.json` | Historical twenty-room sketch used by the previous lower-floor studies |
| `data/source/house55-2og-dimension-baseline.json` | Historical top-floor candidate before the earlier L/stair correction |
| `data/source/house55-2og-left-correction.png` | Earlier resident L-block, stairwell and hallway-door annotation |
| `data/source/house55-2og-wall-offset-baseline.json` | Top floor immediately before the window and wall-face study |
| `data/source/house55-2og-window-marks.png` | Resident window-location marks |
| `data/source/house55-2og-wall-offsets.png` | Resident proposed wall-face offsets |
| `data/source/house55-2og-stair-ratio-baseline.json` | Top-floor window/wall candidate before the latest confirmed overlap and stair alignment |
| `data/source/house55-2og-overlap-reference.png` | W4 overlap reference supplied by the resident |
| `data/source/house55-2og-l-overlap-correction.png` | Resident correction requiring the same overlap at L1 |
| `data/source/house55-stair-ratio-mark.png` | Stair/source-edge relationship clarified as one quarter west and three quarters east |
| `scripts/acquire-lod2.py` | Reproduce official geometry using pinned projection tooling |
| `scripts/acquire-campus.py` | Reproduce the OSM reference and context dataset |
| `scripts/build-path-network.mjs` | Rebuild the path cache; `--check` rejects stale source references |
| `scripts/house53-module-layouts.mjs` | Generate Orange’s three resident-marked floors while preserving every other house |
| `scripts/house55-module-layout.mjs` | Generate the current canonical module plan, campus top floor and sandbox starting data |
| `scripts/house55-first-floor-layout.mjs` | Generate the first-floor plan and update only House 55 / 1. OG |
| `scripts/house55-ground-floor-layout.mjs` | Generate the ground-floor plan and update only House 55 / EG |
| `scripts/house57-module-layout.mjs` | Generate White’s three completed floors from the canonical Red plans |
| `scripts/house59-module-layout.mjs` | Generate Green’s three completed floors and its distinct ground-floor enclosures |
| `scripts/generate-house55-study.mjs` | Historical registration, hallway correction and versioned lower-floor assumptions |
| `scripts/house55-window-wall-study.mjs` | Apply the later window observations and explicit wall-face hypothesis |
| `scripts/house55-r-alignment.mjs` | Reproduce the historical R-bank alignment and separate schematic-flight inset |
| `scripts/old-house-module-layout.mjs` | Historical fixed-module fitter; preserves all current independent floors and emits an empty current catalog |
| `scripts/generate-old-house-studies.mjs` | Historical registration and variable-dimension studies; retained as source evidence |
| `scripts/audit-old-house-studies.py` | Independently inspect transferred geometry, source containment, areas and unresolved regions |
| `docs/ARCHITECTURE.md` | Product, privacy, data model, permissions and staged delivery |
| `docs/GEOMETRY.md` | Detailed geometry provenance, transformations and uncertainties |
| `docs/FACADE-REFERENCES.md` | Inspected photo references and schematic material-line limits |
| `docs/PHOTO-FACADE-UPGRADE.md` | Photographic face registration, observed feature inventory and estimated-detail limits |
| `docs/WINDOW-REFERENCES.md` | Identified-house photographs, narrow-window typology and unmeasured-placement limits |
| `docs/OLD-WINDOW-REFERENCES.md` | Older-house photographs, typical window dimensions, aligned-row character and roof safeguards |
| `docs/OLD-BUILDING-SECTIONS.md` | Older-house roof/floor evidence, clear-height limits and plate-cladding refinement |
| `docs/ROOM-TYPOLOGY-RESEARCH.md` | Public room drawings, dimensions, operator categories and evidence limits |
| `docs/INTERIOR-PLAN-EVIDENCE.md` | Full-floor plan search, usable evidence limits and minimum inputs for an accurate interior |
| `docs/HOUSE55-INTERIOR-STUDY.md` | Confirmed upstairs counts, estimated geometry and versioned lower-floor assumptions |
| `docs/HOUSE55-SCALE-AUDIT.md` | Raw UTM/web distances, exterior versus floor extents, registration and projection limits |
| `docs/HOUSE55-AREA-STUDY.md` | Historical area-stage calculation and wall assumptions before the R-bank alignment |
| `docs/HOUSE55-R-ALIGNMENT.md` | Historical R-bank dimensions, conditional areas, stair relationship and unassigned strip |
| `docs/HOUSE53-MODULE-LAYOUT.md` | Orange’s annotated floor inventories, secondary stair connection, geometry assumptions and reproduction |
| `docs/HOUSE55-MODULE-LAYOUT.md` | Current clear-room dimensions, wall allocations, annotated outline and reproduction |
| `docs/HOUSE57-MODULE-LAYOUT.md` | White’s confirmed arrangement, differences from Red, generation and validation |
| `docs/HOUSE59-MODULE-LAYOUT.md` | Green’s matching upper floors, ground-floor annotation and reproduction |
| `docs/OLD-HOUSES-INTERIOR-EVIDENCE.md` | Public old-house facts, approximate single-room sketch and limits on transferring plans |
| `docs/OLD-HOUSES-MODULE-LAYOUT.md` | Completed-floor status and historical fitting method, counts and gray remainders |
| `docs/OLD-HOUSES-STUDY.md` | Historical template methods, unresolved banks and reproducible transfer audits |
| `docs/HOUSE55-DIMENSION-REFIT.md` | Historical overlap/stair fit and living-zone checks before the area-based refit |
| `docs/RESEARCH.md` | Source register and confirmed campus/community facts |
| `docs/RESIDENT-VALIDATION.md` | Collaborative validation and first-resident pilot |
| `docs/INTERIOR-FORMAT.md` | How to add approved room/corridor outlines, doors, labels and floor elevations |
| `docs/RELEASE-CHECKS.md` | Validation performed and current publication status |
| `docs/api-contract.yaml` | Proposed future API; no deployed endpoints |

## Reproduce and improve the model

Regenerate the current House 55 module layout with:

```sh
npm run layout:build
```

This updates the canonical plan, the campus’s top-floor study and the sandbox starting data together. The standalone study reads the canonical plan directly. The earlier fitting/export scripts document historical stages and should not replace the current generated layout. See [the module guide](docs/HOUSE55-MODULE-LAYOUT.md) for inputs and validation.

Run `npm run layout:first-floor` to regenerate only the 1. OG plan from that top-floor core. It leaves the accepted 2. OG data and standalone views unchanged.

Run `npm run layout:ground-floor` to regenerate EG from the completed 1. OG plan and restore the blue-marked footprint regions. It leaves both upper floors unchanged.

Run `npm run layout:white-house` to regenerate White’s three floors from the completed Red plans, applying the missing east balcony and Gym/Study uses. It updates only House 57. Run `npm run layout:green-house` to regenerate Green’s matching upper floors and annotated EG. Run `node scripts/house53-module-layouts.mjs` to regenerate Orange’s three annotated floors, including the secondary stair connection to the Bar.

Yellow’s floors have separate generators: `npm run layout:yellow-top`, `npm run layout:yellow-first` and `npm run layout:yellow-ground`. Each preserves the other accepted floors. The historical `npm run layout:old-houses` fitter now preserves all 15 independent floors and produces an empty current fitting catalog.

The official source subset is retained so reproduction does not depend on a changing external tile:

```sh
uv run scripts/acquire-lod2.py
python3 scripts/acquire-campus.py
npm run paths:build
```

Read the scripts' `--help` and [geometry notes](docs/GEOMETRY.md) before refreshing sources. Explicit fetches can update upstream data; review the resulting diff and source dates.

Rebuild the path cache whenever mapped paths change. `npm run build` checks that its source digest is current. Polygon union runs during development, not on the browser's animation thread; missing or invalid cache data falls back to the original source centerlines.

`src/windows.js` keeps appearance parameters in `WINDOW_PROFILE` and `OLD_WINDOW_PROFILE`; `getWindowProfile` applies the resident correction for 51a. Candidate openings must fit the source-wall union before their rendering batches are clipped to individual surfaces. `getOldFacadeRowGuides` supplies separate appearance rows for older houses without modifying the floor-section guides. Changing a bay pitch, row offset or frame detail changes an illustration; it does not update the authoritative geometry. Use the [newer](docs/WINDOW-REFERENCES.md) and [older](docs/OLD-WINDOW-REFERENCES.md) window evidence before refining this layer, and collect address-and-direction façade evidence before claiming exact opening positions. House 55 index 2 retains its resident-located complete-floor inventory of 24 openings; invalid placements are reported rather than silently clipped or resized. Its later [photographic exterior refinement](docs/HOUSE55-EXTERIOR-REFINEMENT.md) aligns selected lower rows and suppresses one historical upper-return opening in the folded display only, leaving 23 located display openings. The saved inventory and all independent floor-layout windows remain unchanged.

Start an interior contribution by selecting a house, choosing **Unfold the floors**, opening a level's details and selecting **Add a floor detail**. The downloaded JSON is a proposal, not an automatic geometry edit. Establish plan reuse permission, remove personal/security details, and follow the validation checklist before adding it to the public model.

The [interior schema](docs/INTERIOR-FORMAT.md) and renderer support partial approved plans. Selecting the corresponding unfolded floor can show room/corridor outlines, door openings, labels and a low 1.05 m display cutaway. This display height is not a measured wall or ceiling height. Door swing is drawn only when supplied by the source. Approved `interiors.json` remains empty pending a reviewed plan; see the [interior-plan evidence](docs/INTERIOR-PLAN-EVIDENCE.md).

The separate `interior-studies.json` layer marks all 15 floors of Houses 51, 53, 55, 57 and 59 with `layoutBasis: "resident-module-layout"`. Their `floorOutline` and `layoutWindows` describe the independent layouts; retained `windows` still describe each folded source façade. No current floor uses the earlier `fitted-module-layout` basis. House 55’s lower-floor canonical plans record four shared apartments per floor, enclosed balconies on 1. OG, and ground-floor cinema/laundry areas with the stair-side extension unassigned. White’s canonical plans repeat that geometry with its east balcony removed and Gym/Study uses on EG. Green repeats both upper floors; its EG merges the N wing into Hausmeister and assigns Garden room and Storage to the common enclosures. Yellow follows its own annotations, with shared A on both lower floors, two first-floor balconies and ground-floor Sports room and Laundry. Orange follows its own three drawings, retaining shared N3–N4 downstairs and linking the first-floor East enclosure to the Bar by secondary stairs. Every floor has distinct interaction IDs. Folded source windows remain separate from layout openings, and House 55's resident-confirmed exterior observations are not transferred to another house. Consult the [Yellow ground-floor](docs/HOUSE51-GROUND-FLOOR-LAYOUT.md), [Orange](docs/HOUSE53-MODULE-LAYOUT.md), [White](docs/HOUSE57-MODULE-LAYOUT.md) and [Green](docs/HOUSE59-MODULE-LAYOUT.md) guides for their arrangements and the [historical module study](docs/OLD-HOUSES-MODULE-LAYOUT.md) for superseded fits. `getDisplayLevel` prefers an approved plan on the same floor. A study supplies no approval, floor-height anchor, physical room number, hinge or swing.

Room concepts are computed separately at selection time. `apartmentConcept` uses the recorded door's inward direction and a conservative rectangle inside the actual study polygon, retaining holes and wall-band obstacles. It accepts only fixed footprints that fit without overlapping the entrance landing, chosen walking route or another item. `createApartmentWireframe` displays the result without rescaling the room or source furniture. An omitted service footprint is a fit limitation; an included example is not evidence of an actual kitchen or bathroom.

Verified floor elevations anchor the model; unverified guides interpolate between them and remain provisional. All 15 older-house module floors use their own outlines at the existing provisional elevations; other floor guides produce source exterior sections. A verified elevation still does not turn that exterior section into an approved occupied-area boundary. See the [older-building research](docs/OLD-BUILDING-SECTIONS.md).

## Data credits

**Datenquelle: Bayerische Vermessungsverwaltung – www.geodaten.bayern.de.** Official LoD2-BY, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Coordinates have been reprojected and surfaces converted for web rendering. Individual footprint currency and model creation dates are retained; retrieval on 14 November 2026 is not a new survey.

The shared campus projection is not exactly distance-preserving. The [House 55 scale audit](docs/HOUSE55-SCALE-AUDIT.md) reproduces approximately 0.13–0.17% shorter web frontages than retained UTM grid distances and distinguishes the complete building from its provisional upper-floor section. This small distortion does not explain the interior fit uncertainties.

**© OpenStreetMap contributors**, [ODbL](https://www.openstreetmap.org/copyright). Original OSM geometry, storey counts and derived data remain separately identified. Streets and paths use this retained context; tree points and neighboring-building records are not rendered as decorative objects. Path elevation is a flat display plane because surveyed terrain is unavailable.

House names, color conventions and community facts are referenced to [Rommelwood e.V.](https://rommelwood.de/) and the [Studierendenwerk](https://www.werkswelt.de/). Their original map artwork, photographs, prose, contact lists and private invitations are not included.

Façade photographs are linked in the [material study](docs/FACADE-REFERENCES.md), [newer-window study](docs/WINDOW-REFERENCES.md) and [older-window study](docs/OLD-WINDOW-REFERENCES.md) and are not bundled. Procedural material seams and windows are separate approximate visual annotations. They are not measured façades, exact opening schedules or room placements.

Manrope and JetBrains Mono use the SIL Open Font License; notices are in `public/fonts/LICENSES.txt`. Third-party code retains its package licenses.
