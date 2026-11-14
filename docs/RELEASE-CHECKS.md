# Release checks

Checked on 14 November 2026.

## Build and geometry

- `npm test`: **55 passing tests** covering address matching, exterior polygon validity, source heights, independent footprint alignment, source checksums, required attribution, interior-schema approval/provenance, malformed geometry, private-field rejection, anchored floor interpolation, façade clipping, stable detail subsets, source immutability, camera fitting, time-based/reversible/reduced motion, pointer cancellation and empty-space selection, theme interpolation and material coverage, complete-window coverage across source-split walls and holes, older-house appearance rows beneath stepped roofs, 51a-only aligned rows, fallback keyboard activation, unioned paths and cache failures, exterior sections and calendar export.
- `npm run build`: passed, including the path-cache source check. The JavaScript bundle includes Three.js and local QR generation and is about 180 kB gzipped. Vite reports its standard warning for an uncompressed chunk above 500 kB. Polygon-union tooling is a development dependency and is not imported by the application.
- Production assets use the `/rommelweb/` base path.
- The published interior dataset is empty. No individual room numbers, resident identities, occupancy records or private invitations are included.
- Official geometry: eleven address-matched buildings, 289 exterior surfaces; source dates, attribution and checksums retained.
- Night-default charcoal presentation and switchable warm daylight, gray roofs and natural timber tones; older brown walls retained. No schematic trees or gray context buildings. Photo-informed material seams are clipped to the official surfaces. Their direction is sourced; spacing and storey bands remain schematic. Window marks are separately qualified and clipped to each source wall, including source-split faces. Blue House 51a has aligned upper rows following a resident correction; other newer houses retain illustrative offsets. All five older houses have aligned appearance rows with smaller windows and middle transoms, using typology dimensions from a resident sketch. Their full frames fit below local roof edges. Appearance row guides leave actual floor-section guides unchanged and do not establish roof-space occupancy. Newer-house ground-floor glazing, stairs and loggias, and older-house large shared-room glazing remain unmodeled.
- Joined 99 mapped outdoor paths and streets. Forty-five use explicit source width tags; 54 remain centerlines. Tests cover crossing-path unions, bounded corner joins, holes, exact source coordinates, stale-cache rejection and safe fallback.
- Every above-ground floor section closes and remains within the official shell. Tests include courtyard holes, disjoint wings, sloping roofs and more than 400 interior point samples against the source shell. All five older houses have different outlines on successive levels, with top section areas at least 15% smaller than ground sections. These are exterior intersections, not living-area measurements.
- Exterior dimensions and relative positions remain in metres. The closer view is a camera change.
- No audio code, playback APIs or media assets are present. The interface stays silent.
- The new room-reference catalog links to published drawings and 2026 operator charts. No third-party plan artwork or generated room placements enter the model.

## Browser verification

The application was exercised in an isolated headless Firefox instance through WebDriver BiDi. The latest production pass checks the direct map navigation, day/night display, enlarged group UI, exclusive and animated group/timeline panels, older windows, room references and keyboard fallback behavior; retained baseline checks below also cover the unchanged draft-event and approved-plan workflows.

| Area | Observed result |
| --- | --- |
| Desktop, 1440 × 1000 | Eleven house labels; WebGL renders; overlays hidden initially; no horizontal overflow |
| Mobile, 390 × 844 | Map labels, QR overlay, timeline and floor tray usable in both themes without horizontal overflow |
| Small phone, 320 × 568 | Group card and resident-info dialog remain usable; no horizontal overflow |
| Map | House selection, camera focus, three-level sections for older houses and eight-level sections for 57a; individual section selection and provisional-height disclosure |
| Approved-plan renderer | An isolated synthetic room outline and label appear only on their selected floor section; switching floors hides the label. Fixture data remains outside the repository and production build |
| Navigation | Canvas hover highlights and click focuses a house; empty-space primary click restores overview and clears selection; dragging preserves selection; keyboard house labels and brand remain accessible; directory/search and pole removed |
| Appearance | Night is the default; day/night button transitions scene materials and UI; foreground, background, window frames, floors and fallback remain legible in both palettes |
| URL state | Direct house/group URLs select their target; closing a group normalizes its URL to the house |
| Keyboard | House selection retains focus; left/right arrows navigate the group carousel; Escape closes overlays and dialogs |
| Groups | Collapsed desktop card is 528px wide and about 120px high, with a 26px title and 80px QR; sits at 77px and horizontally centered; arrows lie outside both edges; Details animates open/closed; changing group collapses details and moves to its house. Groups bubble toggles the card; no close icon |
| Rapid carousel input | Five immediate next/previous actions settle on the matching title, QR and house; rapid open/close reversals settle with correct visibility/inert state; closing during detail motion stays closed; keyboard focus leaves hidden details correctly |
| Room references | Both campus tabs show their matching sketches and qualifications, retain keyboard focus, return focus to the floor link, and fit the 320px dialog |
| Group links | Public activity QR generated locally and paired with the correct source link; private house cards expose a lock icon, no invitation QR |
| Planned resident controls | Explicitly disclose that authentication, private groups and neighbor services are not connected |
| Timeline | One entry point in the top-right bubble, with no side tab; empty community state; retained tab-memory draft creation, chronological display, detail view, removal and ICS export with Europe/Berlin timezone |
| Calendar export | Text escaping prevents injected properties; multilingual lines fold within the 75-octet limit and unfold losslessly |
| Exclusive panels | At desktop, 390px and 320px, Groups and Timeline deselect each other in both directions. Timeline slides/fades in and out; rapid reversals settle correctly and outgoing panels become inert immediately. Map floor controls hide beneath the timeline on phones |
| Reduced motion | The JavaScript reduced-motion branch switches both panels immediately without a panel animation; tested with an isolated media-query override |
| Local privacy boundary | Application creates no cookies, localStorage or sessionStorage entries |
| Silent experience | No audio/video elements or audio playback code; no sound is introduced by interactions |
| Production assets | Geometry, bundled JavaScript and both local font families load with the `/rommelweb/` base path |
| WebGL failure | Simulated context loss produces an eleven-house SVG fallback with day/night styling; all eleven fallback houses are keyboard buttons with Enter/Space activation, and empty-space deselection remains functional; floor controls close and unfolding is disabled |
| Console | No errors during these interaction checks |

Initial-release checks also exercised correction downloads. The current exterior-section renderer was checked with an isolated synthetic interior fixture; it is not a representation of any real room. Interior validation remains covered by the automated suite.

Browser-test draft events were removed after verification. Preview images show the empty timeline; no synthetic event or notification was added to the published data.

These are targeted release checks, not a complete accessibility audit or a security assessment of the future backend. Resident authorization and messaging do not yet exist.

## Publication

With the user’s authorization, `mteyra/rommelweb` is public and GitHub Pages is enabled with GitHub Actions as its source. HTTPS is enforced.

Live site: https://mteyra.github.io/rommelweb/

The first successful publication is [Publish Rommelweb run 43650092599](https://github.com/mteyra/rommelweb/actions/runs/43650092599), deploying application commit `6552e800a6916e26ada2ce561389645e75857130`. The live URL returned HTTP 200. An isolated Firefox session rendered all eleven WebGL houses and verified house selection, day/night mode, locked house-group placeholders, exclusive Groups/Timeline panels and no audio elements. The CSS, JavaScript, icon, both local fonts and all four data assets returned HTTP 200; there were no browser console errors.

The public demo includes no resident authentication, private records or invitation secrets; those services remain future work.
