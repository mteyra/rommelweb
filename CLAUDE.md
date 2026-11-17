# Rommelweb: notes for AI assistants

A static Three.js map of the eleven student houses at Campus Süd, Erlangen. Vite + vanilla JS, no backend. Live at https://mteyra.github.io/rommelweb/.

## Read only the guide for your task

| Task touches | Read |
| --- | --- |
| How a building looks from outside: façades, windows, balconies, `*-photo-details.js` | `docs/EXTERIORS.md` |
| Floor plans, rooms, room sizes, `scripts/house*-layout*.mjs`, `interior-studies.json` | `docs/INTERIORS.md` |
| UI, panels, scene, build, tests, deploy, privacy | `docs/SOFTWARE.md` |
| Finding a picture of a house or floor | `docs/screenshots/README.md` (filenames only; open an image only if needed) |

Don't read `docs/archive/` unless a guide points there, and never read the top-level `archive/` (superseded code) unless asked. Don't read `docs/evidence/` or `docs/data/`: they're machine records for tests. Large files to search rather than read whole: `public/data/*.json`, `src/scene.js`, `src/main.js`. Styles: `src/styles.css` lists the 15 files in `src/styles/` and what each covers.

## Hard rules

- The 15 older-house floors (Houses 51, 53, 55, 57, 59) are final. Never change them or the fingerprints in `tests/older-houses-final.test.mjs`.
- Never change `public/data/lod2.json` or rescale, move or reshape a building.
- Exterior work must leave every `public/data/` file unchanged; interior work must leave exteriors unchanged.
- Change floor plans through their generator script (`npm run layout:*`), never by hand-editing `interior-studies.json`.
- No resident names, room numbers, occupancy or contact data anywhere. No analytics, trackers or third-party requests.
- Everything not from survey data is an estimate; say so, and never claim an accuracy percentage.

## Commands

`npm run dev` · `npm test` (364 tests, about 2 minutes; `node --test tests/<file>` for one) · `npm run build`

If a receipt test fails on a hash after an intended change, follow "Release receipts" in `docs/SOFTWARE.md`.
