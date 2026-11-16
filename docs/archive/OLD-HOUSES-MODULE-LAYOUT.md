# Old-house layouts · completed floors and historical fits

15 November 2026. All **15 floors** — EG, 1. OG and 2. OG of Houses **51, 53, 55, 57 and 59** — now use independent resident-module layouts. No provisional fitted floors remain, and the current fitting catalog is empty. This document retains the earlier fitting method and historical counts.

Yellow House **51** now has independent layouts on all three floors. The [top floor](HOUSE51-TOP-FLOOR-LAYOUT.md) adds E and N0 and removes the marked surplus areas. The [middle floor](HOUSE51-FIRST-FLOOR-LAYOUT.md) has the shifted A bank, singles and two balconies. The [ground floor](HOUSE51-GROUND-FLOOR-LAYOUT.md) adds B before shared A and contains Sports room and Laundry. The [Yellow historical fixture](../../tests/fixtures/house51-before-top-floor-layout.json) retains the original fitted building and its audit for regression checks.

Orange House **53** now has [resident-marked independent layouts on all three floors](HOUSE53-MODULE-LAYOUT.md): **20 singles on 2. OG**, and **22 singles plus shared N3–N4 on each lower floor**. Its 1. OG has two enclosures; the clarified blue arrow identifies **secondary stairs down from the East enclosure to the EG Bar**. EG also has the stepped **Common Room**. The main stair retains its original position. Orange’s previous provisional building and fitting catalog remain in the [Orange historical fixture](../../tests/fixtures/house53-before-resident-layout.json).

White House **57** now has a separate [resident-confirmed independent layout](HOUSE57-MODULE-LAYOUT.md). It follows Red 55’s internal geometry, with no east balcony on 1. OG and Gym east / Study west on EG. Its former fitted placements are retained in the [historical test fixture](../../tests/fixtures/house57-before-resident-layout.json), together with their original audit, rather than the current placement catalog.

Green House **59** also has a [resident-confirmed independent layout](HOUSE59-MODULE-LAYOUT.md): both upper floors match Red, and EG has Hausmeister, Garden room and Storage. Its former fitting is retained in the [Green historical fixture](../../tests/fixtures/house59-before-resident-layout.json).

## Dimensions and placement

| Element | Assumed dimensions |
| --- | --- |
| Single apartment, clear rectangle | 2.70 × 6.00 m; 16.20 m² |
| Single-apartment pitch | 3.10 m |
| Side allocation | 0.20 m on each side; 0.40 m between adjacent clear rooms |
| Hall | 1.40 m |
| Shared apartment, gross envelope | 6.20 × 7.40 m; 45.88 m² |
| Stair enclosure | 2.70 × 7.40 m |
| Schematic stair split | 1.30 m flight and 1.40 m passage |
| Illustrative door | 0.90 m |

The **2.70 m clear width** comes from the resident’s dorm measurement. The **6.00 m length**, wall allocations and **1.40 m halls** are the chosen House 55 layout assumptions. A shared apartment combines two 3.10 m modules across a 6.00 m room depth plus the perpendicular 1.40 m hall. Both the historical fits and the current resident-module plans inherit these dimensions; they are not new measurements of the other houses.

For the historical fitter, the previous source registration supplied a starting orientation and anchor for each house. The generator placed rigid rectangular room banks, halls and stairs in that frame, shifting whole banks where the existing shell required it. It omitted whole modules that did not fit, without stretching rooms, clipping an apartment at the exterior or changing the floor outline. The current independent plans instead follow the resident’s house-specific arrangement.

In the original twelve-floor fit, lower floors borrowed the shared-apartment pattern, with the same placements repeated on EG and 1. OG where both outlines contained them. Shared envelopes had one entrance and no invented internal partitions. The fitter did not transfer House 55’s cinema, laundry, balcony labels or window observations.

## Historical trial counts

These are the superseded Yellow EG and Orange fits, retained in the [Yellow pre-ground-floor fixture](../../tests/fixtures/house51-before-ground-floor-layout.json) and [Orange historical fixture](../../tests/fixtures/house53-before-resident-layout.json). They count trial apartment envelopes, not the current layouts or residents. The gray remainder excluded the proposed rooms, shared envelopes, halls, stair and side-wall allocations.

| House | Floor | Singles | Shared envelopes | Unassigned gray area |
| --- | --- | ---: | ---: | ---: |
| 51 | EG | 14 | 4 | 293.42 m² |
| 53 | EG | 14 | 4 | 246.41 m² |
| 53 | 1. OG | 14 | 4 | 237.73 m² |
| 53 | 2. OG | 19 | 0 | 164.38 m² |

The former Orange fit omitted one end single from the top-floor W bank. Its lower A and W banks, and Yellow EG’s A and W banks, were each one single shorter than House 55, with shared end envelopes shifted inward by one complete 3.10 m pitch. Small bank translations aligned the connected hallways with each fixed shell. Those historical offsets, omissions and gray remainders remain part of the archived fitting audits.

## Gray space and preserved geometry

In the archived fits, the remainder was the original outline minus the apartment, hall, stair and side-wall allocations. It stayed gray and unassigned: the fitter did not infer whether it represented rooms, circulation, storage, common areas or a shell correction. Those former fitting remainders are absent from the current catalog; explicitly unassigned areas in an accepted plan, such as Red’s stair-side extension, remain separate.

The official exterior models and retained source-window observations remain unchanged. Current independent floor outlines follow each resident-supported arrangement. House 55’s three canonical plans, standalone top-floor study and layout sandbox are preserved. The original twelve-floor preservation record remains valid for the earlier four-house revision; historical fixtures preserve Houses 51, 53, 57 and 59’s former source outlines and fitted audits.

All 15 current older-house floors use `layoutBasis: "resident-module-layout"`. The historical fixtures retain the earlier `fitted-module-layout` floors and their estimated placements. Neither designation turns a layout assumption into a surveyed interior.

## Reproduce

```sh
npm run layout:old-houses
npm test
npm run build
```

The historical fitter is [`scripts/old-house-module-layout.mjs`](../../scripts/old-house-module-layout.mjs). It skips all 15 independent resident-module floors, leaving [`public/data/interior-studies.json`](../../public/data/interior-studies.json) unchanged and producing an empty `houses` catalog in [`public/data/old-house-module-layouts.json`](../../public/data/old-house-module-layouts.json). Use the house-specific generators linked above to reproduce current layouts. Tests still reproduce and check the original four-house fitted geometry using isolated historical fixtures.

The earlier variable-dimension study is retained in [the historical report](OLD-HOUSES-STUDY.md). Original research and source limitations remain in [the evidence ledger](OLD-HOUSES-INTERIOR-EVIDENCE.md).
