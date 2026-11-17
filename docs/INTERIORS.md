# Interiors: floor plans, rooms and dimensions

Read this before changing any floor plan, room, door or interior file. It replaces the per-house study documents, which are kept in [`archive/`](archive/) as history. The app links to the sections below from each floor.

## Rules

0. **The older houses are final.** All 15 floors of Houses 51, 53, 55, 57 and 59 are finished, resident-approved layouts and will not change. `tests/older-houses-final.test.mjs` fails if a single byte of them changes. Don't edit, regenerate differently or "improve" them, and never update that test's fingerprints. Their generators stay only as the record of how each plan was built.
1. **Exteriors are fixed.** Never move, rescale or reshape a building to make rooms fit. The official LoD2 shell in `public/data/lod2.json` is the outer limit; see [EXTERIORS.md](EXTERIORS.md).
2. **Generate, don't hand-edit.** Change a newer-house floor by editing its generator in `scripts/` and running it. Never edit `public/data/interior-studies.json` by hand.
3. **One floor at a time.** Each generator rewrites only its own house or floor, and its tests check that every other floor stays byte-identical.
4. **Nothing is surveyed.** Older houses follow the resident's annotated sketches; newer houses are estimates. Keep every space `confidence: "estimated"` and never claim an accuracy percentage.
5. **No occupancy.** Labels such as "Room G" are drawing references, not real room numbers. Never attach people to rooms. See the privacy rules in [SOFTWARE.md](SOFTWARE.md#privacy-rules).
6. **Shared apartments are envelopes.** Their internal walls are unknown, so don't draw them.

## How floor plans reach the screen

```
scripts/<house>-*.mjs  ──writes──▶  public/data/<house>-*-layout(s).json   canonical plan, drawing coordinates
        │                            (not loaded by the app)
        └──────────writes──────────▶  public/data/interior-studies.json     every floor of every house, campus coordinates
                                                │  (the only interior file the app loads, with interiors.json)
                                                ▼
src/interior-studies.js   validate, pick the level to display, outline tests
src/interior-wireframe.js walls, door gaps, selectable room targets
src/study-measurements.js dimension labels and exterior dimension runs
src/apartment-concepts.js furniture layout for one selected room
src/ui/house-panel.js     floor panel text, room and door cards, links to this file
```

`public/data/interiors.json` is for approved, surveyed plans. It is empty and takes precedence over studies once a floor is approved (`src/interiors.js`).

### Coordinates and naming

- **Campus coordinates:** metres; x east, y up, z south. Floor polygons use `[x, z]`.
- **Drawing coordinates:** canonical plans use their own metre frame (`u`, `v`). `coordinateFrame` places them on campus by rigid rotation and translation only (`originCampusXZ`, `axisU`, `axisV`), never by scaling.
- **Floor index:** `0` = EG (ground floor), `1` = 1. OG, `2` = 2. OG, and so on.
- **Sides:** "east/R" and "west/L" follow the resident's sketches. Room banks are named by letter: A–E, G–H, L, N, R, W.

### Level record in `interior-studies.json`

```
buildings["55"].levels[i] = {
  index, label, layoutBasis,          // "resident-module-layout" (older) | "fitted-newer-module-layout" (newer)
  floorOutline,                       // the floor's own outline (older houses no longer use the LoD2 section)
  spaces: [{id, label, shortLabel, kind, confidence, note, polygon}],
           // kind: room | shared | service | corridor | stairs | lift
  doors:  [{id, label, spaceId, toSpaceId, confidence, note, segment}],
  windows,             // exterior window inventory (appearance only)
  layoutWindows,       // window symbols drawn in the plan
  wallBands, dimensionGuides, source, notes
}
```

## The module system (older houses)

All five older houses (Campus Süd I: 51, 53, 55, 57, 59) share one module, measured by the resident in House 55:

| Element | Size |
| --- | --- |
| Single room, clear interior | **2.70 × 6.00 m = 16.20 m²** |
| Side wall allocation | 0.20 m on each side of every room |
| Module pitch | **3.10 m** (0.20 + 2.70 + 0.20); 0.40 m between neighbouring rooms |
| Hallway | **1.40 m** |
| Wing depth | 7.40 m = 6.00 m room + 1.40 m hall |
| Stair | **2.70 m** = 1.30 m flight + 1.40 m walkway |
| Shared apartment (Red pattern) | 6.20 × 7.40 m envelope |
| Doors | 0.90 m, centred on the room-to-hall boundary (illustrative) |

These numbers are defined once in `public/data/house55-module-layout.json` → `dimensions`, and every other older-house generator reuses them.

Not allocated yet: end-wall and hall-wall thickness, bathroom and kitchen partitions, real door and window positions, stair runs, and exact floor heights. Don't confuse these sizes with two other figures: the operator's **16.4 m²** is a category average, and the older **2.70 × 3.30 m** sketch is a living zone.

## Older houses

Every older house has three floors (EG, 1. OG, 2. OG), all following resident annotations. The source images are in `data/source/house5X-*-annotation.png`.

| House | EG | 1. OG | 2. OG |
| --- | --- | --- | --- |
| 51 Yellow | 23 singles, shared A, Sports, Laundry | 23 singles, shared A, 2 balconies | 21 singles |
| 53 Orange | 22 singles, shared N3–N4, Bar, Common room | 22 singles, shared N3–N4, West balcony, East enclosure | 20 singles |
| 55 Red | 16 singles, 4 shared, Cinema, Laundry | 16 singles, 4 shared, 2 balconies | 20 singles |
| 57 White | 16 singles, 4 shared, Gym, Study | 16 singles, 4 shared, West balcony | 20 singles |
| 59 Green | 14 singles, 3 shared, Hausmeister, Garden room, Storage | 16 singles, 4 shared, 2 balconies | 20 singles |

The house chain: Red is the reference plan. White and Green are generated from Red with listed differences. Yellow and Orange have their own annotated plans built from the same modules.

### House 55 (Red)

Generators: `house55-module-layout.mjs` (2. OG, also writes the sandbox data), then `house55-first-floor-layout.mjs`, then `house55-ground-floor-layout.mjs`. Each lower floor is derived from the floor above, so run them in that order.

#### House 55 2. OG

20 single rooms in six hallway runs (4 southwest, 3 east, 4 west, 3 left, 3 right, 3 north), two connected hallways and the stair. The independent outline follows the resident's annotated dimensions: shell area 478.78 m², of which rooms 324 m², side walls 48 m², halls 86.8 m² and stair 19.98 m². The plan has 22 illustrative doors and 24 layout-window symbols, which are separate from the exterior window inventory. Data: `public/data/house55-module-layout.json`.

#### House 55 1. OG

This floor reuses the 2. OG core and adds the resident's end modules and cutouts. It has **16 singles and four shared-apartment envelopes** (W1, A, N3–N4, G–H; 6.20 × 7.40 m each), and two enclosed **9.30 × 2.90 m balconies**, each with one hallway door near the stair. Footprint: **624.48 m²**, with a confirmed 8.10 m W-wing return. Data: `house55-first-floor-layout.json`.

#### House 55 EG

This floor repeats the 1. OG apartments. The east/R **Cinema** and west/L **Laundry** are each **9.30 × 7.40 m**, enclosed, with one hallway door near the stair. A **7.83 m²** stair-side extension stays unassigned. Footprint: **716.01 m²**. Data: `house55-ground-floor-layout.json`.

#### House 55 layout sandbox

`public/house55-layout/` is a standalone page for trying other room proportions while keeping 16.20 m² per room. Saved edits stay in the visitor's browser and never change the shared plan. Its starting data, `shell.json`, is written by `npm run layout:build`.

### House 57 (White)

All three floors use Red's completed layout. The only differences: **no east balcony on 1. OG** (footprint 597.51 m², west balcony kept), and on EG an east/R **Gym** and a west/L **Study** in place of Cinema and Laundry. Generator: `house57-module-layout.mjs` → `house57-module-layouts.json`.

### House 59 (Green)

**2. OG and 1. OG match Red**, including both 1. OG balconies. EG restores the missing single and joins the N wing (the former N3–N4 apartment and its short hall) into one **Hausmeister** enclosure with one entrance. The east/R space is the **Garden room** and the west/L space is **Storage**. EG has 14 singles and 3 shared apartments (W1, A, G–H). Generator: `house59-module-layout.mjs` → `house59-module-layouts.json`.

### House 51 (Yellow)

The three floors have separate generators that build down from the top: `house51-top-floor-layout.mjs`, then `house51-first-floor-layout.mjs`, then `house51-ground-floor-layout.mjs`. All three keep the stairs aligned.

#### House 51 2. OG

**21 singles**, including an added **E** beside D and **N0** beside N1. The outline removes the resident's blue-marked excess areas. Room entrances follow the lime-green marks. The original E in the East bank and the new E in the A bank have different IDs. Data: `house51-top-floor-layout.json`.

#### House 51 1. OG

**23 singles, shared A and two balconies.** The enlarged A wing shifts by one 3.10 m module, so its leftmost room aligns with L1's left edge. The blue-covered erroneous extension is omitted. Data: `house51-first-floor-layout.json`.

#### House 51 EG

**23 singles, shared A, Sports and Laundry**, with Sports and Laundry at 6.20 × 7.40 m each. E's left module edge aligns with the wall line between L1 and L2. The A bank runs E–D–C–B–shared A, reusing the four middle-floor module slots. Sports takes the 6.20 m west common-area span, and Laundry extends the east common area beside N0. Data: `house51-ground-floor-layout.json`.

### House 53 (Orange)

**2. OG: 20 singles.** EG and 1. OG each have **22 singles plus the shared N3–N4**, using the annotated split pairs, the added E and N0, and a trimmed top-floor outline. The 1. OG has two enclosures: the **East enclosure connects by secondary stairs down to the EG Bar** (resident's blue arrow), and the West enclosure is a balcony. EG also has a stepped **Common room**. The main stair keeps the same position on every floor. Generator: `house53-module-layouts.mjs` → `house53-module-layouts.json`.

## Newer houses

The six Campus Süd II houses have estimated apartment placements within their unchanged exterior outlines (34 floors in total). The generator is `new-house-module-layout.mjs` → `new-house-module-layouts.json`, and its notes record the fitting method.

| Type | Size |
| --- | --- |
| Single, bounding envelope incl. partitions | **2.92 × 7.20 m** (pitch 3.12 m, 0.10 m side allocation) |
| Shared apartment (WG) for 3 | 8.76 × 8.00 m |
| Shared apartment (WG) for 4 | 11.68 × 8.00 m |
| Accessible apartment | 5.00 × 6.00 m |
| Hallway | 1.40 m |

| House | Floors | Placed |
| --- | --- | --- |
| 49 Black | EG + 5 | 72 singles, 1 WG |
| 51a Blue | EG + 2 | EG community and bike room; 6 WG4 on the upper floors |
| 53a Lila | EG + 4 | 58 singles, 1 WG |
| 55a Grau | EG + 5 | 70 singles (1 accessible), 1 WG |
| 57a Turquoise | EG + 7 | 100 singles (1 accessible), 1 WG |
| 59a Pink | EG + 5 | 70 singles |

Total: 380 apartments and 408 places. Typical upper floors have 14 singles. WG internal subdivisions are not inferred. The placements avoid photographed balcony and gallery recesses, using a frozen copy of the exterior inputs (`data/source/newer-layout-exterior-reservations.json`), so exterior work can never shift them. Labels are temporary design references.

## Older-house history

Before the final module layouts, the older floors went through earlier stages: plans "fitted" with variable room sizes, area and alignment studies of House 55, and a standalone House 55 study page. All of that code, its tests and that page are in the top-level `archive/` folder, and the write-ups are in `docs/archive/` (start with `OLD-HOUSES-STUDY.md` and `HOUSE55-INTERIOR-STUDY.md`). Don't revive those methods. The current generators only share one helper with them, `scripts/lib/older-house-registration.mjs`, which places a House 55-based plan onto another house's official outline.

## Evidence and open questions

- **What exists:** resident annotations and tape measurements for House 55; typical-room sketches from the operator and Rommelwood; operator room categories. No verified full-floor plan of any house was found.
- **What would improve the model most:** full floor plans identified by house and floor; wall thicknesses; bathroom and kitchen layouts; floor-to-floor heights; door positions.
- **How corrections arrive:** the app's "Add a floor detail" downloads a JSON proposal. Nothing uploads automatically. The format is in `archive/INTERIOR-FORMAT.md`.

## Change checklist (newer houses only)

1. Edit `scripts/new-house-module-layout.mjs`.
2. Run `npm run layout:new-houses`.
3. Run its tests: `node --test tests/new-house-module-layout.test.mjs tests/older-houses-final.test.mjs tests/interior-studies.test.mjs tests/study-ui.test.mjs`. The older-house lock must still pass.
4. Check the floor in the app (`npm run dev`, select the house, then **Unfold the floors**).
5. Add new screenshots to `screenshots/house-<number>-<name>/`.
