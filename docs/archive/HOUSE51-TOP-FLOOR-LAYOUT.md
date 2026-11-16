# Yellow House 51 · top floor

15 November 2026. This revision changes **only House 51 / 2. OG** for the resident’s review. Yellow’s **EG and 1. OG remain exactly as before**, and the completed Red, White and Green plans are preserved.

The [resident’s drawing](../../data/source/house51-2og-resident-annotation.png) supplies the room arrangement, two added dorms, blue areas to remove and lime-green doorway positions. It is retained with SHA-256 `1f898a8bcfc9a1030232d294554a3328c3b4001ca6dcc0d85e38abc4a80072d9`.

## Arrangement

The top floor uses Red’s fixed module dimensions and connected central core. The A bank adds **E beside D**, and the N bank adds **N0 beside N1**. The W bank retains **W4, W3 and W2** as shown in the Yellow drawing. The result is **21 single rooms**:

| Bank | Order in the annotated view |
| --- | --- |
| East, top to bottom | G, F, E |
| N, left to right | N3, N2, N1, N0 |
| R, left to right | R3, R2, R1 |
| L, left to right | L3, L2, L1 |
| A, left to right | E, D, C, B, A |
| W, top to bottom | W4, W3, W2 |

Both E labels are retained. Their full cards identify **A wing** or **East wing**, and their room, door and window IDs are distinct.

The independent **501.72 m² outline** follows the union of the modules, their halls and the stair enclosure, leaving no unassigned residual area. The blue excess areas are removed from this floor plan. The official folded exterior remains a separate source model. Yellow’s existing orientation and core offset are retained so the top-floor stair stays aligned with the unchanged lower floors.

## Dimensions and doors

Clear rooms are **2.70 × 6.00 m**, with a **3.10 m module pitch** and a **0.20 m allocation on each side**. Halls are **1.40 m** wide. The **2.70 × 7.40 m** stair enclosure retains the **1.30 m flight / 1.40 m passage** split used in Red.

These are the previously chosen module assumptions. The measured 2.70 m clear room width is the original physical anchor; the new drawing supplies relative doorway positions, not a measurement of each jamb.

| Room(s) | Door wall | Position along that wall |
| --- | --- | --- |
| G, East E | Right | Near bottom |
| F | Right | Near top |
| R3, R1 | Bottom | Near left |
| R2 | Bottom | Near right |
| N3, N1 | Top | Near right |
| N2, N0 | Top | Near left |
| A-bank E, C, A | Bottom | Near left |
| D, B | Bottom | Near right |
| L3, L2 | Top | Near left |
| L1 | Top | Near right |
| W4, W2 | Left | Near top |
| W3 | Left | Near bottom |

The model uses **0.90 m openings**, with their centers **0.60 m from the marked clear-room corner**, leaving a **0.15 m jamb**. Width and corner clearance are schematic. Hinge positions and door swings remain unspecified. Every room entrance connects to its bank hall and onward to the stairs.

## Reproduce and verify

```sh
npm run layout:yellow-top
npm test
npm run build
```

The [generator](../../scripts/house51-top-floor-layout.mjs) writes the [canonical top-floor plan](../../public/data/house51-top-floor-layout.json), updates only Yellow’s top-floor study and removes only that floor from the provisional fitting catalog. The remaining fitting generator skips independent layouts per floor.

The [preservation receipt](../evidence/house51-top-floor-preservation.json) compares Yellow’s lower floors, every other house and protected exterior/layout files with commit `c73bc342664cfb1cf66789bb6057f0573c44721f`. The [historical Yellow fixture](../../tests/fixtures/house51-before-top-floor-layout.json) preserves the previous provisional building and its fitting audit, keeping earlier regression checks reproducible. [Release checks](RELEASE-CHECKS.md) record final geometry, browser and publication verification.
