# Release checks

Checked on 14 November 2026.

## Build and geometry

- `npm test`: **27 passing tests** covering address matching, exterior polygon validity, source heights, independent footprint alignment, source checksums, required attribution, interior-schema approval/provenance, malformed geometry, private-field rejection, anchored floor interpolation, façade clipping, source immutability, camera fitting, camera-relative bearings and calendar export.
- `npm run build`: passed. The JavaScript bundle includes Three.js and local QR generation and is about 171 kB gzipped. Vite reports its standard warning for an uncompressed chunk above 500 kB.
- Production assets use the `/rommelweb/` base path.
- The published interior dataset is empty. No individual room numbers, resident identities, occupancy records or private invitations are included.
- Official geometry: eleven address-matched buildings, 289 exterior surfaces; source dates, attribution and checksums retained.
- Dark redesign: no schematic trees or gray context blocks. Photo-informed material seams are clipped to the official surfaces. Their direction is sourced; spacing and storey bands remain schematic.
- Exterior dimensions and relative positions remain in metres. The closer view is a camera change.

## Browser verification

The application was exercised in an isolated headless Firefox instance through WebDriver BiDi, against both the development server and the generated production build.

| Area | Observed result |
| --- | --- |
| Desktop, 1440 × 1000 | Eleven house labels; WebGL renders; overlays hidden initially; no horizontal overflow |
| Mobile, 390 × 844 | Compact signpost, house picker, QR overlay, timeline and floor tray usable without horizontal overflow |
| Small phone, 320 × 568 | Group card and resident-info dialog remain usable; no horizontal overflow |
| Map | House selection, camera focus, eight-level unfolding for 57a, individual floor selection and unknown-plan disclosure |
| Navigation | Sign arrows respond to keyboard camera orbit; compact picker reaches all houses; group carousel moves to the associated house |
| View and URL state | Top view survives house selection and toggles back correctly; direct group URLs select the right house; closing a group normalizes its URL to the house |
| Keyboard | House selection retains focus; left/right arrows navigate the group carousel; Escape closes overlays and dialogs |
| Groups | Public activity QR generated locally and paired with the correct source link; private house cards expose a lock icon, no invitation QR |
| Planned resident controls | Explicitly disclose that authentication, private groups and neighbor services are not connected |
| Timeline | Empty community state; tab-memory draft creation, chronological display, detail view, removal and ICS export with Europe/Berlin timezone |
| Calendar export | Text escaping prevents injected properties; multilingual lines fold within the 75-octet limit and unfold losslessly |
| Mobile overlays | Opening timeline hides groups; opening the picker hides other main overlays |
| Local privacy boundary | Application creates no cookies, localStorage or sessionStorage entries |
| Production assets | Geometry, bundled JavaScript and both local font families load with the `/rommelweb/` base path |
| WebGL failure | Simulated context loss produces an eleven-house SVG fallback; directory remains functional; unfolding is disabled |
| Console | No errors during these interaction checks |

Initial-release checks also exercised correction downloads and a separate temporary build with clearly synthetic interior geometry: an approved outline/label appeared only on its selected floor, including top view; other floors remained unknown. Interior validation remains covered by the automated suite. The synthetic fixture stayed outside the repository and deployment output. It is not a representation of any real room.

Browser-test draft events were removed after verification. Preview images show the empty timeline; no synthetic event or notification was added to the published data.

These are targeted release checks, not a complete accessibility audit or a security assessment of the future backend. Resident authorization and messaging do not yet exist.

## Publication

GitHub's Pages setup API returned HTTP 422:

> Your current plan does not support GitHub Pages for this repository.

The existing `mteyra/rommelweb` repository is private. Making its source public requires the user's approval; an account plan supporting Pages for private repositories is another route. The source and Actions workflow are ready for activation.

Once that account/repository condition is resolved, enable **Settings → Pages → Source: GitHub Actions**, run the **Publish Rommelweb** workflow and verify the resulting Pages URL. The URL alone is not evidence of a completed deployment.
