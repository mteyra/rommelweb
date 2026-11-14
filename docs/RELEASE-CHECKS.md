# Release checks

Checked on 14 November 2026.

## Build and geometry

- `npm test`: **44 passing tests** covering address matching, exterior polygon validity, source heights, independent footprint alignment, source checksums, required attribution, interior-schema approval/provenance, malformed geometry, private-field rejection, anchored floor interpolation, façade clipping, stable detail subsets, source immutability, camera fitting, camera-relative bearings, time-based/reversible/reduced motion, pointer cancellation, unioned paths and cache failures, exterior sections and calendar export.
- `npm run build`: passed, including the path-cache source check. The JavaScript bundle includes Three.js and local QR generation and is about 176 kB gzipped. Vite reports its standard warning for an uncompressed chunk above 500 kB. Polygon-union tooling is a development dependency and is not imported by the application.
- Production assets use the `/rommelweb/` base path.
- The published interior dataset is empty. No individual room numbers, resident identities, occupancy records or private invitations are included.
- Official geometry: eleven address-matched buildings, 289 exterior surfaces; source dates, attribution and checksums retained.
- Neutral charcoal presentation, gray roofs and natural timber tones; older brown walls retained. No schematic trees or gray context buildings. Photo-informed material seams are clipped to the official surfaces. Their direction is sourced; spacing and storey bands remain schematic.
- Joined 99 mapped outdoor paths and streets. Forty-five use explicit source width tags; 54 remain centerlines. Tests cover crossing-path unions, bounded corner joins, holes, exact source coordinates, stale-cache rejection and safe fallback.
- Every above-ground floor section closes and remains within the official shell. Tests include courtyard holes, disjoint wings, sloping roofs and more than 400 interior point samples against the source shell. All five older houses have different outlines on successive levels, with top section areas at least 15% smaller than ground sections. These are exterior intersections, not living-area measurements.
- Exterior dimensions and relative positions remain in metres. The closer view is a camera change.
- No audio code, playback APIs or media assets are present. The interface stays silent.
- The new room-reference catalog links to published drawings and 2026 operator charts. No third-party plan artwork or generated room placements enter the model.

## Browser verification

The application was exercised in an isolated headless Firefox instance through WebDriver BiDi. The latest production pass checks the changed UI, motion, room references and fallback behavior; retained baseline checks below also cover the unchanged draft-event and approved-plan workflows.

| Area | Observed result |
| --- | --- |
| Desktop, 1440 × 1000 | Eleven house labels; WebGL renders; overlays hidden initially; no horizontal overflow |
| Mobile, 390 × 844 | Compact signpost, house picker, QR overlay, timeline and floor tray usable without horizontal overflow |
| Small phone, 320 × 568 | Group card and resident-info dialog remain usable; no horizontal overflow |
| Map | House selection, camera focus, three-level sections for older houses and eight-level sections for 57a; individual section selection and provisional-height disclosure |
| Approved-plan renderer | An isolated synthetic room outline and label appear only on their selected floor section; switching floors hides the label. Fixture data remains outside the repository and production build |
| Navigation | Branched post works by pointer; arrows respond to keyboard orbit; picker reaches all houses; brand restores overview; zoom/top-view button dock removed |
| Bearing continuity | Crossing the ±π heading boundary rotates by the small angular difference instead of a full turn |
| URL state | Direct house/group URLs select their target; closing a group normalizes its URL to the house |
| Keyboard | House selection retains focus; left/right arrows navigate the group carousel; Escape closes overlays and dialogs |
| Groups | Collapsed desktop strip is under 135px high and horizontally centered; arrows lie outside both edges; Details expands, changing group collapses; carousel moves to its house |
| Rapid carousel input | Five immediate next/previous actions settle on the matching title, QR and house; closing during transition stays closed; keyboard focus leaves hidden details correctly |
| Room references | Both campus tabs show their matching sketches and qualifications, retain keyboard focus, return focus to the floor link, and fit the 320px dialog |
| Group links | Public activity QR generated locally and paired with the correct source link; private house cards expose a lock icon, no invitation QR |
| Planned resident controls | Explicitly disclose that authentication, private groups and neighbor services are not connected |
| Timeline | Empty community state; tab-memory draft creation, chronological display, detail view, removal and ICS export with Europe/Berlin timezone |
| Calendar export | Text escaping prevents injected properties; multilingual lines fold within the 75-octet limit and unfold losslessly |
| Mobile overlays | Opening timeline hides groups; opening the picker hides other main overlays |
| Local privacy boundary | Application creates no cookies, localStorage or sessionStorage entries |
| Silent experience | No audio/video elements or audio playback code; no sound is introduced by interactions |
| Production assets | Geometry, bundled JavaScript and both local font families load with the `/rommelweb/` base path |
| WebGL failure | Simulated context loss during a floor study produces an eleven-house SVG fallback; directory remains functional; floor controls close and unfolding is disabled |
| Console | No errors during these interaction checks |

Initial-release checks also exercised correction downloads. The current exterior-section renderer was checked with an isolated synthetic interior fixture; it is not a representation of any real room. Interior validation remains covered by the automated suite.

Browser-test draft events were removed after verification. Preview images show the empty timeline; no synthetic event or notification was added to the published data.

These are targeted release checks, not a complete accessibility audit or a security assessment of the future backend. Resident authorization and messaging do not yet exist.

## Publication

GitHub's Pages setup API returned HTTP 422:

> Your current plan does not support GitHub Pages for this repository.

The existing `mteyra/rommelweb` repository is private. Making its source public requires the user's approval; an account plan supporting Pages for private repositories is another route. The source and Actions workflow are ready for activation.

Once that account/repository condition is resolved, enable **Settings → Pages → Source: GitHub Actions**, run the **Publish Rommelweb** workflow and verify the resulting Pages URL. The URL alone is not evidence of a completed deployment.
