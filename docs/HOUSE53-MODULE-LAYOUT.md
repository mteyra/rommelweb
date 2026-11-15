# Orange House 53 · EG, 1. OG and 2. OG

15 November 2026. Orange now follows its own three resident drawings, replacing its former provisional shell fit. Other houses, the original Orange exterior, its source window evidence and its main stair position remain unchanged.

Sources: [2. OG annotation](../data/source/house53-2og-resident-annotation.png), [1. OG annotation](../data/source/house53-1og-resident-annotation.png), [EG annotation](../data/source/house53-eg-resident-annotation.png). The resident subsequently clarified that **the small blue arrow beside N0 on 1. OG denotes stairs down into the ground-floor Bar**. It does not request a deeper enclosure or remove an area.

## Floor arrangement

| Floor | Singles | Shared apartments | Other enclosures |
| --- | ---: | --- | --- |
| 2. OG | 20 | None | None |
| 1. OG | 22 | N3–N4 | West balcony; east enclosure with stairs down to the Bar |
| EG | 22 | N3–N4 | Bar and stepped Common room |

The following bank order uses the annotated view, which is rotated relative to the local U/V coordinate system.

| Bank | 2. OG | 1. OG and EG |
| --- | --- | --- |
| W, top to bottom | W2, W3, W4 | W1, W2, W3, W4 |
| L, left to right | L1, L2, L3 | L1, L2, L3 |
| R, left to right | R1, R2, R3 | R1, R2, R3 |
| E, top to bottom | E, F, G | E, F, G, H |
| N, left to right | N0, N1, N2, N3 | N0, N1, N2, shared N3–N4 |
| A, left to right | B, C, D, E | A, B, C, D, E |

On **2. OG**, the blue-covered terminal A and both core-side excess areas are removed. W1 is absent. The red marks add E beside D and N0 beside N1.

Both lower floors split the former W1, A and G–H paired envelopes into ordinary single modules. Shared N3–N4 remains one gross enclosure, with its internal arrangement unresolved. The two rooms labeled E retain their drawing labels; selection cards distinguish **A wing** and **East wing**.

On **1. OG**, the west balcony and eastern Bar-access enclosure occupy the two core-side gaps. Their **6.20 m widths** follow the fixed module grid. Their **2.90 m depths** retain the existing balcony assumption; the drawings provide no new measured depths. The secondary Bar stair is independent of the unchanged main stair. Its location and connection follow the resident’s clarification; exact flight, tread, landing and rise dimensions remain schematic.

On **EG**, Bar fills the eastern **6.20 × 7.40 m** gap. The western Common room follows the stepped outline: a **1.40 × 1.40 m** notch beside E remains public hallway. The notch uses the existing hall width as a schematic dimension, rather than a measurement inferred from drawn pixels. This gives **45.88 m²** for Bar and **43.92 m²** for Common room. The Common room’s lime doorway sits on the short step edge.

## Dimensions and alignment

Singles retain **2.70 × 6.00 m clear interiors**, a **3.10 m module pitch**, and two **0.20 m side allocations**. The public halls remain **1.40 m** wide. Shared N3–N4 remains an assumed **6.20 × 7.40 m gross envelope**.

Corresponding room columns use one grid across all three floors. The former arbitrary A/N bank offsets used to fit the old source shell are removed. This is an explicit regularization of the annotated arrangement, not new surveyed evidence for absolute bank positions. The L/R central modules retain the accepted template geometry.

Orange retains its original rigid orientation and scale. Its existing local **[0, −0.20] m** core translation is absorbed into the coordinate-frame origin. The main stair therefore remains at its original campus position on all three floors, retaining the **2.70 × 7.40 m enclosure**, **1.30 m flight** and **1.40 m walkway**.

| Floor | Complete independent outline |
| --- | ---: |
| 2. OG | 478.78 m² |
| 1. OG | 606.50 m² |
| EG | 662.30 m² |

Each outline is the union of rooms, side allocations, shared envelope where present, circulation, stair and common enclosures. There are no positive-area overlaps, holes or residual unassigned shell patches. These layout areas do not establish surveyed floor areas.

Lime marks determine doorway ends independently on each floor. In particular, **EG R2 has the opposite-end entrance from R2 on both upper floors**. Door openings retain a schematic **0.90 m width**, centered **0.60 m** from the marked clear-room corner, leaving a **0.15 m jamb**. No additional ground-floor hall entrance is inferred for Bar: the nearby lime mark belongs to N0, and the clarified stairs provide its connection from 1. OG. Door swings and hinges remain unspecified.

## Reproduce and verify

```sh
npm run layout:orange-house
npm test
npm run build
```

The [generator](../scripts/house53-module-layouts.mjs) writes the [canonical three-floor plans](../public/data/house53-module-layouts.json), updates only Orange’s interior study records and retires its former provisional catalog entries. The separate Yellow EG release is retained. All fifteen older-house floors now use independent module layouts, leaving the provisional catalog empty.

The [historical Orange fixture](../tests/fixtures/house53-before-resident-layout.json) retains the prior fit. The [preservation receipt](evidence/house53-layout-preservation.json) compares this release with commit `00df697`, protecting the completed Yellow EG, every other house and original exterior/source data. Geometry checks cover inventories, fixed dimensions, complete disjoint coverage, matching doorway boundaries, access to the main stair, secondary Bar access, vertical alignment and regeneration. See [release checks](RELEASE-CHECKS.md) for browser verification.
