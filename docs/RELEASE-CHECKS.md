# Release checks

Checked on 15 November 2026.

## Build and geometry

- `npm test`: **86 passing tests** covering address matching, exterior polygon validity, source heights, independent footprint alignment, source checksums, required attribution, interior-schema approval/provenance, malformed geometry, private-field rejection, anchored floor interpolation, façade clipping, stable detail subsets, source immutability, camera fitting, time-based/reversible/reduced motion, pointer cancellation and empty-space selection, theme interpolation and material coverage, complete-window coverage across source-split walls and holes, older-house appearance rows beneath stepped roofs, 51a-only aligned rows, fallback keyboard activation, unioned paths and cache failures, exterior sections and calendar export. New coverage includes isolated house/floor visibility, hidden-target picking, physical door validation and apertures, door-target priority, unknown swing handling, late path-cache replacement during isolation, approved-plan bounds and every real floor/stack fitting between the phone controls.
- `npm run build`: passed, including the path-cache source check. The JavaScript bundle includes Three.js and local QR generation and is about 189 kB gzipped. Vite reports its standard warning for an uncompressed chunk above 500 kB. Polygon-union tooling is a development dependency and is not imported by the application.
- New study tests cover strict geometry-only fields, exact-floor isolation, approved-plan precedence, source preservation, floor exclusions, corridor holes and stair picking, shared door gaps after rounding, dashed estimates, compact labels, desktop/portrait plan orientation, overlapping-space rejection and holes crossing concave boundaries. The actual House 55 study is independently checked against its floor outline and both excluded roof wings.
- Production assets use the `/rommelweb/` base path.
- Approved `interiors.json` remains empty. Separate `interior-studies.json` contains only House 55 / 2. OG: seven sketch-divided bays, twelve estimated bays, central sketch stairs, a potential corridor and twenty estimated access gaps. No physical room numbers, resident identities, occupancy records or private invitations are included.
- Official geometry: eleven address-matched buildings, 289 exterior surfaces; source dates, attribution and checksums retained.
- Night-default charcoal presentation and switchable warm daylight, gray roofs and natural timber tones; older brown walls retained. No schematic trees or gray context buildings. Photo-informed material seams are clipped to the official surfaces. Their direction is sourced; spacing and storey bands remain schematic. Window marks are separately qualified and clipped to each source wall, including source-split faces. Blue House 51a has aligned upper rows following a resident correction; other newer houses retain illustrative offsets. All five older houses have aligned appearance rows with smaller windows and middle transoms, using typology dimensions from a resident sketch. Their full frames fit below local roof edges. Appearance row guides leave actual floor-section guides unchanged and do not establish roof-space occupancy. Newer-house ground-floor glazing, stairs and loggias, and older-house large shared-room glazing remain unmodeled.
- Joined 99 mapped outdoor paths and streets. Forty-five use explicit source width tags; 54 remain centerlines. Tests cover crossing-path unions, bounded corner joins, holes, exact source coordinates, stale-cache rejection and safe fallback.
- Every above-ground floor section closes and remains within the official shell. Tests include courtyard holes, disjoint wings, sloping roofs and more than 400 interior point samples against the source shell. All five older houses have different outlines on successive levels, with top section areas at least 15% smaller than ground sections. These are exterior intersections, not living-area measurements.
- Exterior dimensions and relative positions remain in metres. The closer view is a camera change.
- No audio code, playback APIs or media assets are present. The interface stays silent.
- The new room-reference catalog links to published drawings and 2026 operator charts. No third-party plan artwork is bundled. The new room candidates come from the resident annotation and explicit count estimates; they remain separate from measured-plan approval.

## Browser verification

The application was exercised in an isolated headless Firefox instance through WebDriver BiDi. This pass checks the House 55 resident study in its actual production build, including room/door selection, exclusion geometry, readable compact markers, floor alignment, day/night mode, drawing-key access and desktop/phone controls. It also rechecks group details, panel exclusivity and return navigation. The previous pass covered the lower overview, isolated floor navigation, centered group dialog, compact timeline, focus handoff and physical-door framework. Scene navigation was also exercised against the production build at its `/rommelweb/` base path. Retained baseline checks below cover unchanged exterior appearance, room references and draft-event workflows.

| Area | Observed result |
| --- | --- |
| Desktop, 1440 × 1000 and 1920 × 1087 | Eleven house labels; WebGL renders; overlays hidden initially; requested lower southwest overview; no horizontal overflow |
| Mobile, 390 × 844 | Map labels, QR overlay, timeline and floor tray usable in both themes without horizontal overflow |
| Small phone, 320 × 568 | Group card and resident-info dialog remain usable; no horizontal overflow |
| Map | Unfolding isolates the selected house and separates its floors; floor labels select a nearly overhead view with siblings hidden. All levels restores the stack; collapse and empty-space selection restore the campus. Old three-level and 57a eight-level cases pass |
| House 55 / 2. OG study | Both green-marked wings are absent, central stairs remain independently selectable inside the corridor hole, and all 19 candidate room bays render. Compact room and doorway targets open evidence cards; estimated counts and positions are disclosed. Correction forms prefill House 55, floor 2 and the selected study reference. The drawing key lists all 21 spaces. Markers do not overlap; hidden markers can be reached by zooming or through the space list. Switching to 1. OG hides all study targets |
| Approved-plan renderer | Browser-only synthetic rooms, corridor and doors render as a low cutaway in the stack. Space and doorway targets activate only on the selected floor; clicking a door opens its physical-room card with an unconnected resident placeholder. A corridor has no resident placeholder. Switching floors hides the old targets; the room list provides access on small screens. Fixture data remains outside the repository and production build |
| Floor controls | Floor-label keyboard activation moves focus to the matching stable tray button. Mobile trays are compact, floors scroll horizontally, and open details are bounded. The selected-floor desktop bar sits below the drawing and the compact mobile tray stays at the bottom. House 55 aligns horizontally on desktop and vertically on portrait phones. Camera fitting reserves space for title and controls; no hidden source objects intercept floor clicks |
| Navigation | Canvas hover highlights and click focuses a house; empty-space primary click restores overview and clears selection; dragging preserves selection; keyboard house labels and brand remain accessible; directory/search and pole removed |
| Appearance | Night is the default; day/night button transitions scene materials and UI; foreground, background, window frames, floors and fallback remain legible in both palettes |
| URL state | Direct house/group URLs select their target; closing a group normalizes its URL to the house |
| Keyboard | House selection retains focus; left/right arrows navigate the group carousel; Escape closes overlays and dialogs |
| Groups | Compact desktop card remains centered beneath the location with exterior carousel arrows. Details morphs into a centered 760px dialog with a 220px QR, group icon, full description and actions. Carousel travel preserves expanded mode. Back/Escape returns to the compact card; expanded Close closes it. Background is inert while expanded, with a contained keyboard focus loop |
| Rapid carousel input | Five immediate next/previous actions settle on the matching title, QR and house; rapid open/close reversals settle with correct visibility/inert state; closing during detail motion stays closed; keyboard focus leaves hidden details correctly |
| Room references | Both campus tabs show their matching sketches and qualifications, retain keyboard focus, return focus to the floor link, and fit the 320px dialog |
| Group links | Public activity QR generated locally and paired with the correct source link; private house cards expose a lock icon, no invitation QR |
| Planned resident controls | Explicitly disclose that authentication, private groups and neighbor services are not connected |
| Timeline | One entry point in the top-right bubble; right edge aligns with that bubble. The empty panel measures approximately 304 × 403px on desktop, replacing the tall empty drawer. Retained tab-memory draft creation, chronological display, detail view, removal and ICS export use Europe/Berlin timezone |
| Calendar export | Text escaping prevents injected properties; multilingual lines fold within the 75-octet limit and unfold losslessly |
| Exclusive panels | At desktop, 390px and 320px, Groups and Timeline deselect each other in both directions. Timeline slides/fades in and out; rapid reversals settle correctly and outgoing panels become inert immediately. Map floor controls hide beneath the timeline on phones |
| Reduced motion | The JavaScript reduced-motion branch switches both panels immediately without a panel animation; tested with an isolated media-query override |
| Local privacy boundary | Application creates no cookies, localStorage or sessionStorage entries |
| Silent experience | No audio/video elements or audio playback code; no sound is introduced by interactions |
| Production assets | Geometry, bundled JavaScript and both local font families load with the `/rommelweb/` base path |
| WebGL failure | Simulated context loss produces an eleven-house SVG fallback with day/night styling; all eleven fallback houses are keyboard buttons with Enter/Space activation, and empty-space deselection remains functional; floor controls close and unfolding is disabled |
| Console | No errors during these interaction checks |

Initial-release checks also exercised correction downloads. Earlier approved-plan renderer checks used an isolated synthetic fixture; that fixture is not published or a representation of a real room. This release instead exercises the actual resident-sketch study for Red House 55 / 2. OG. Its 19 candidates remain provisional; a current measured plan is still needed to approve the layout. The archived annotation, registration and generator preserve the evidence for future corrections.

Browser-test draft events were removed after verification. Preview images show the empty timeline; no synthetic event or notification was added to the published data.

These are targeted release checks, not a complete accessibility audit or a security assessment of the future backend. Resident authorization and messaging do not yet exist.

## Publication

With the user’s authorization, `mteyra/rommelweb` is public and GitHub Pages is enabled with GitHub Actions as its source. HTTPS is enforced.

Live site: https://mteyra.github.io/rommelweb/

The first successful publication is [Publish Rommelweb run 43650092599](https://github.com/mteyra/rommelweb/actions/runs/43650092599), deploying application commit `6552e800a6916e26ada2ce561389645e75857130`. The live URL returned HTTP 200. An isolated Firefox session rendered all eleven WebGL houses and verified house selection, day/night mode, locked house-group placeholders, exclusive Groups/Timeline panels and no audio elements. The CSS, JavaScript, icon, both local fonts and all four data assets returned HTTP 200; there were no browser console errors.

The public demo includes no resident authentication, private records or invitation secrets; those services remain future work.
