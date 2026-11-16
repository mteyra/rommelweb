# Yellow House 51 · 1. OG

15 November 2026. The resident’s “floor two” drawing is titled **House 51 / 1. OG**: the second physical storey. This revision changes that middle floor only. The completed **2. OG**, provisional **EG**, other houses and folded exterior remain unchanged.

The [annotated drawing](../../data/source/house51-1og-resident-annotation.png) supplies the room splits, new modules, balcony locations, doorway ends and rightward shift. The **blue scribble cancels an incorrect red extension**; it does not request a floor cutout.

## Arrangement and alignment

| Bank | Order in the annotated view |
| --- | --- |
| East, top to bottom | H, G, F, E |
| N, left to right | N4, N3, N2, N1, N0 |
| R, left to right | R3, R2, R1 |
| L, left to right | L3, L2, L1 |
| A, left to right | F, E, D, C, shared A |
| W, top to bottom | W4, W3, W2, W1 |

This gives **23 singles and one shared apartment**. The former G–H, N3–N4 and W1 shared envelopes are split into ordinary singles with their bank hall restored. Shared A remains one gross envelope, with one entrance and no inferred internal divisions.

Two singles are added before D in the A bank. Moving the enlarged bank **3.10 m to the right** makes the left module edge of its first room, F, coincide with **L1’s left module edge at local U = 25.60 m**. Their clear interiors both begin at **U = 25.80 m**. D, C and shared A move with the bank; L1, the L/R banks and the stair remain fixed.

| A-bank element | Local U span |
| --- | --- |
| F | 25.60–28.70 m |
| E | 28.70–31.80 m |
| D | 31.80–34.90 m |
| C | 34.90–38.00 m |
| Shared A | 38.00–44.20 m |

The east balcony occupies the two-module gap between N0 and the stair. The west balcony fills the corresponding gap between the stair and the shifted A bank. Each is modeled as **6.20 × 2.90 m**, with one hallway entrance. Their two-module width follows the arrangement; the 2.90 m depth reuses the accepted balcony assumption from Red. These are not new measured dimensions.

## Fixed dimensions and schematic details

Singles keep **2.70 × 6.00 m clear interiors**, a **3.10 m pitch** and two **0.20 m side allocations**. Halls stay **1.40 m** wide; shared A stays **6.20 × 7.40 m gross**. The stair retains its **2.70 × 7.40 m enclosure**, **1.30 m flight / 1.40 m walkway** split and exact campus position across all three floors.

The independent **629.44 m²** outline is the union of those modules, shared A, halls, balconies and stair. It has no overlapping assigned areas or unassigned residual strips. The W wing stops after W1, above the canceled red extension.

Visible lime marks determine entrance ends. Openings use the existing schematic **0.90 m width**, centered **0.60 m from a clear-room corner**, leaving a **0.15 m jamb**. The new W1 entrance and west balcony have no unambiguous individual lime mark, so their corner placement remains explicitly schematic. Door swings and hinges remain unspecified. Every apartment and balcony connects through its hall to the stairs.

Duplicate E and F labels remain on the drawing; selection cards distinguish the East wing from the A wing. Layout-window symbols stay on the independent outline and remain separate from the preserved folded-façade evidence.

## Reproduce and verify

```sh
npm run layout:yellow-first
npm test
npm run build
```

The [generator](../../scripts/house51-first-floor-layout.mjs) writes the [canonical plan](../../public/data/house51-first-floor-layout.json), replaces only Yellow 1. OG in the study dataset and retires only its provisional fitting entry. Yellow EG and all three House 53 floors remain in the fitting catalog.

The [previous Yellow record](../../tests/fixtures/house51-before-first-floor-layout.json) and [preservation receipt](../evidence/house51-first-floor-preservation.json) compare this revision with `f8d8281`. Regression checks cover the requested left-edge alignment, fixed room dimensions, non-overlap, complete coverage, hallway access, vertical stair alignment and preservation through repeated generation. See [release checks](RELEASE-CHECKS.md) for browser and publication verification.
