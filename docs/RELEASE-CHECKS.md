# Initial release checks

Checked on 14 November 2026.

## Build and geometry

- `npm test`: **17 passing tests** covering address matching, exterior polygon validity, source heights, independent footprint alignment, source checksums, required attribution, interior-schema approval/provenance, malformed geometry, private-field rejection and anchored floor interpolation.
- `npm run build`: passed. The JavaScript bundle includes Three.js and is about 161 kB gzipped. Vite reports its standard warning for an uncompressed chunk above 500 kB.
- Production assets use the `/rommelweb/` base path.
- The published interior dataset is empty. No individual room numbers, resident identities, occupancy records or private invitations are included.
- Official geometry: eleven address-matched buildings, 289 exterior surfaces; source dates, attribution and checksums retained.

## Browser verification

The application was exercised in an isolated headless Firefox instance through WebDriver BiDi, against both the development server and the generated production build.

| Area | Observed result |
| --- | --- |
| Desktop, 1440 × 1000 | Eleven directory entries and house labels; WebGL renders; no horizontal overflow |
| Mobile, 390 × 844 | Map, directory, inspector and dialogs usable without horizontal overflow |
| Map | House selection, camera focus, eight-level unfolding for 57a, individual floor selection, top view |
| Navigation | Campus filtering, direct house URL, community and architectural-brief views |
| Keyboard | Focus retained after house selection, unfolding and calendar navigation; Escape closes dialogs; skip target follows active view |
| Planned resident controls | Explicitly disclose that authentication, private groups and neighbor services are not connected |
| Calendar | Month navigation; local ICS export with Europe/Berlin timezone, escaped text and UTF-8-safe line folding |
| Corrections | Reject out-of-range floors; allow correction and download an unreviewed proposal |
| Local privacy boundary | Application creates no cookies, localStorage or sessionStorage entries |
| WebGL failure | Simulated context loss produces an eleven-house SVG fallback; directory remains functional; unfolding is disabled |
| Interior extension | A separate temporary build with clearly synthetic test geometry showed the approved outline/label only on its selected floor, including top view; other floors remained unknown |
| Console | No errors during these interaction checks |

The synthetic interior fixture stayed outside the repository and deployment output. It is not a representation of any real room.

These are targeted release checks, not a complete accessibility audit or a security assessment of the future backend. Resident authorization and messaging do not yet exist.

## Publication

GitHub's Pages setup API returned HTTP 422:

> Your current plan does not support GitHub Pages for this repository.

The existing `mteyra/rommelweb` repository is private. Making its source public requires the user's approval; an account plan supporting Pages for private repositories is another route. The source and Actions workflow are ready for activation.

Once that account/repository condition is resolved, enable **Settings → Pages → Source: GitHub Actions**, run the **Publish Rommelweb** workflow and verify the resulting Pages URL. The URL alone is not evidence of a completed deployment.
