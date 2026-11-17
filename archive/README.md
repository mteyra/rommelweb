# Archive: earlier interior stages

Code from the stages before the older houses got their final module layouts. Nothing here runs as part of the app, the build or `npm test`, and nothing current depends on it. It's kept so the history in `docs/archive/` stays traceable.

The folders mirror where each file used to live:

| Path | What it was |
| --- | --- |
| `scripts/generate-old-house-studies.mjs`, `old-house-module-layout.mjs`, `audit-old-house-studies.py` | Fitted variable-size rooms into the older houses, then fixed modules into their old outlines |
| `scripts/house55-*.mjs`, `extrapolate-house55-levels.mjs`, `generate-house55-study.mjs` | House 55 window-wall, R-alignment, area and stair studies, and the floor extrapolation |
| `scripts/*house55*.py` | House 55 measurement audits, the measured-plan fit and the study-page export |
| `tests/` | The tests of those stages |
| `public/house55-study/` | The old standalone House 55 study page (variable 15.4–17.5 m² rooms) |
| `public/data/old-house-module-layouts.json` | The provisional-fit catalog, empty once every older floor was final |
| `data/source/` | Baselines those studies produced |
| `tests/fixtures/` | A snapshot only those stages used |

Import paths inside these files point to their old locations, so they don't run from here without moving them back. Git history has every version.
