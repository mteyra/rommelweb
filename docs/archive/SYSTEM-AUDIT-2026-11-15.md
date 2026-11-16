# Rommelweb: recovered system context

Audited 15 November 2026 at commit `d27c1a2` (`main`; local `origin/main` matches). This report concerns the saved repository and fresh local verification. Existing browser receipts were reviewed as historical evidence, not rerun. Application source and published geometry remain unchanged; this recovery adds local documentation, measurement records and reproducible analyses.

## Current product and architecture

Rommelweb is a public spatial community prototype for Campus Süd I and II on Erwin-Rommel-Straße, Erlangen. The eleven houses are the five older buildings **51, 53, 55, 57, 59** and six newer buildings **49, 51a, 53a, 55a, 57a, 59a**. **House Red is older House 55**, with resident wing identifiers 1 and 2; it is distinct from Grey 55a.

The implementation uses Vite, vanilla JavaScript and Three.js. `polyclip-ts` supports polygon operations; `qrcode` generates public-activity QR codes locally. `src/main.js:522` loads four public JSON datasets, validates the interior layers and constructs the scene. `src/scene.js:295` builds official exterior surfaces, separate appearance details, floor sections, wireframes and selection targets. Approved plans take precedence over estimated studies (`src/interior-studies.js:261`).

Working features include building selection, keyboard address labels, day/night appearance, isolated floor stacks, overhead floor inspection, selectable study rooms and doors, optional furniture arrangements, public club links, local correction downloads, volatile calendar drafts and ICS export. The 2D fallback supports building navigation. Authentication, residency verification, private WhatsApp invitations, resident discovery, messages and shared event publishing are future work. The Supabase EU/PostgreSQL/RLS design in `docs/ARCHITECTURE.md:180` is a proposal, not an installed backend.

## Quantified completeness

Counts below were independently recomputed from current public data:

| Component | Current coverage |
|---|---:|
| Address-matched official exteriors | 11 houses / 289 polygons |
| Provisional floor guides | 49 |
| Floors containing estimated interiors | 15: three floors in each older house |
| Newer-house floors without interior studies | 34 |
| Study spaces / room references / door targets | 333 / 258 / 270 |
| Located study windows | 24, all in House 55 / 2. OG |
| Approved measured interior floors | 0 |

`public/data/interiors.json` is empty. Estimated room counts per modelled floor are **51:15, 53:14, 55:20, 57:20, 59:17**. Only House 55's upstairs total is resident-confirmed. Lower floors repeat an estimated core while additional wings remain unassigned. Central L/R banks in 51/53 and the eastern bank in 59 are unresolved (`docs/OLD-HOUSES-STUDY.md:46`).

The saved door graph leaves **147 room references without a represented connection to stairs** across all fifteen floors. In House 55, **A–D, W1–W4 and L1–L3** connect through West hall to the recorded stair entry; **E–G, R1–R3 and N1–N3** lack a saved stair connection. The resident has confirmed separate L and R doors onto the same top-floor landing, so House 55's missing eastern connection is a known implementation omission. The graph does not establish a defect in real-world access.

The retained independent audit reports **3376.704 m² outside study spaces plus 808.618 m² explicitly unassigned**, totalling **4185.322 m²** across the fifteen provisional source planes. These include roof margins and unexplored wings; they are not measured habitable area (`docs/OLD-HOUSES-STUDY.md:70`).

## Evidence hierarchy

1. **Bavarian LoD2:** authoritative source exterior planes, standard roof forms, footprints and heights; no interior partitions or exact storey elevations. Ten building models were created on 2021-04-15 and House 57 on 2025-01-23. Common footprint currency is 2025-10-14; the November 2026 download is not a new survey (`docs/GEOMETRY.md:7`).
2. **OSM:** independently mapped storey counts, paths and context. Floor guides interpolate using exterior height until approved elevations exist (`src/interiors.js:160`).
3. **House 55 resident evidence:** twenty upstairs rooms, twenty-four windows, bank arrangement, separate L/R landing doors and relative overlap/stair alignment. The stairwell is **2.72 m inside width**, divided into **1.43 m flight/central guard zone plus 1.29 m walkway**. All western L/W/A–D hallways are reported **1.30 m wide**. Full room dimensions, wall thicknesses, stair length and elevations remain unmeasured. See the [measurement reconciliation](HOUSE55-MEASURED-STAIR-RECONCILIATION.md).
4. **Operator and typical-room references:** 16.4 m² is a category average; 2.70 × 3.30 m describes an approximate living zone. Neither fixes a complete individual apartment.
5. **Transferred plans and appearance studies:** conditional hypotheses. Façade photographs support visible character and relative placement; furniture arrangements support geometric fit only.

Preserve the distinction between numerical consistency and physical accuracy. The published data provide no statistical basis for an overall accuracy percentage.

## Active revision and stale documentation

The key history is: `8f2e2b1` initial House 55 sketch → `3eac42c` corrected twenty-room core → `31e360f` dimensional fit → `7bbf21d` L/stair correction → `448569d` window/wall study → `9738610` stair ratio → `0064399` area fit → **`7665017` current R alignment and old-house studies** → **`d27c1a2` façade appearance only**.

The generator applies window/wall, stair alignment, area fit, then R alignment, before refreshing lower floors (`scripts/generate-house55-study.mjs:804`). Its active provenance stage is `rAlignment`. The final exterior commit preserves the seven public datasets from `7665017` (`docs/RELEASE-CHECKS.md:13`).

Read current JSON alongside `HOUSE55-R-ALIGNMENT.md`, `OLD-HOUSES-STUDY.md`, current release checks and active provenance. Some older passages remain misleading: `GEOMETRY.md:128` describes superseded R bays; `GEOMETRY.md:132` says 23 spaces although House 55 now has **24**, including the unassigned strip; `GEOMETRY.md:94` and `ARCHITECTURE.md:71` call loggias/stair fronts unmodelled despite the latest appearance release. Parts of `INTERIOR-FORMAT.md` still describe only House 55.

## Verified engineering gap and priorities

The approved-plan validator checks individual rings but omits whole-floor overlap and source containment (`src/interiors.js:101`). A read-only synthetic probe supplied two identical 4 × 4 m rooms at campus coordinates [900,900], far outside House 55; `validateInteriorData` returned true. Current real approved data are empty. The study validator already has stronger containment/overlap checks (`src/interior-studies.js:147`).

Priorities for the next work:

1. Implement the resident-confirmed separate L/R landing doors and jointly refit the central geometry around the 2.72 m measured stairwell and 1.30 m western hallways. Obtain stair length, door/landing positions, representative clear room dimensions and floor heights. See [the measurement reconciliation](HOUSE55-MEASURED-STAIR-RECONCILIATION.md).
2. Consolidate current measurements, assumptions and uncertainty into one canonical constraint record; keep historical stages explicitly historical.
3. Add robust overlap/containment validation before importing measured plans.
4. Extend the geometry schema for physical walls, clear boundaries, door thresholds, approved polygon holes, basements/split levels and cross-floor connections.
5. Verify lower-floor wings and other houses independently before expanding repeated cores.

## Fresh verification

The latest verification passed **164/164 tests** with zero failures in **182.5 seconds**. Production build and path-cache checks passed: 99 OSM ways, 45 mapped widths. JavaScript output is **787.08 kB / 227.20 kB gzip**; only the existing bundle-size advisory remains. Logs: `/tmp/rommelweb-repo-audit-tests-20261115.log` and `/tmp/rommelweb-repo-audit-build-20261115.log`. Five checked live JSON datasets match the local files byte for byte.

Rendering already skips GPU redraw when unchanged (`src/scene.js:1099`). Future scaling work should target startup loading/construction: all study JSON (~776 kB) and floor wireframes are currently prepared together. This is an optimization opportunity, not an observed runtime failure.
