# Other old houses · fixed modules inside existing outlines

15 November 2026. Only **Yellow House 51 / EG** retains a provisional apartment fit based on the accepted House 55 arrangement. Its existing outline stays intact, with unused space gray until an on-site check. This document also retains the earlier fitting method and historical counts.

Yellow House **51 / 2. OG** now has a separate [resident-marked top-floor layout](HOUSE51-TOP-FLOOR-LAYOUT.md) with E and N0 added, blue-marked excess areas removed and room entrances placed at the lime-green marks. Its **1. OG** now also has a [resident-marked layout](HOUSE51-FIRST-FLOOR-LAYOUT.md) with the shifted A bank aligned to L1, split pairs, N0 and two balconies. Only EG retains its former fit. The [Yellow historical fixture](../tests/fixtures/house51-before-top-floor-layout.json) retains the previous building and its fitting audit for regression checks.

Orange House **53** now has [resident-marked independent layouts on all three floors](HOUSE53-MODULE-LAYOUT.md): **20 singles on 2. OG**, and **22 singles plus shared N3–N4 on each lower floor**. Its 1. OG has two enclosures; the clarified blue arrow identifies **secondary stairs down from the East enclosure to the EG Bar**. EG also has the stepped **Common Room**. The main stair retains its original position. Orange’s previous provisional building and fitting catalog remain in the [Orange historical fixture](../tests/fixtures/house53-before-resident-layout.json).

White House **57** now has a separate [resident-confirmed independent layout](HOUSE57-MODULE-LAYOUT.md). It follows Red 55’s internal geometry, with no east balcony on 1. OG and Gym east / Study west on EG. Its former fitted placements are retained in the [historical test fixture](../tests/fixtures/house57-before-resident-layout.json), together with their original audit, rather than the current placement catalog.

Green House **59** also has a [resident-confirmed independent layout](HOUSE59-MODULE-LAYOUT.md): both upper floors match Red, and EG has Hausmeister, Garden room and Storage. Its former fitting is retained in the [Green historical fixture](../tests/fixtures/house59-before-resident-layout.json).

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

The **2.70 m clear width** comes from the resident’s dorm measurement. The **6.00 m length**, wall allocations and **1.40 m halls** are the chosen House 55 layout assumptions. A shared apartment combines two 3.10 m modules across a 6.00 m room depth plus the perpendicular 1.40 m hall. These dimensions are transferred as a trial layout, not new measurements of the other houses.

The previous source registration supplies a starting orientation and anchor for each house. The generator places rigid rectangular room banks, halls and stairs in that frame, shifting whole banks where the existing shell requires it. It omits whole modules that do not fit. It never stretches rooms, clips an apartment at the exterior or changes the floor outline.

In the original twelve-floor fit, lower floors borrowed the shared-apartment pattern, with the same placements repeated on EG and 1. OG where both outlines contained them. Yellow EG retains that method. Shared envelopes have one entrance and no invented internal partitions. The fitter does not transfer House 55’s cinema, laundry, balcony labels or window observations.

## Current trial counts

These are counts of placed apartment envelopes, not confirmed apartments or residents. The remainder excludes the proposed rooms, shared envelopes, halls, stair and side-wall allocations.

| House | Floor | Singles | Shared envelopes | Unassigned gray area |
| --- | --- | ---: | ---: | ---: |
| 51 | EG | 14 | 4 | 293.42 m² |

Yellow EG’s provisional A and W banks are each one single shorter than House 55. Their shared end envelopes move inward by one complete 3.10 m pitch. Small bank translations align the connected hallways with the fixed shell. The current canonical fitting data records these offsets and every omitted module.

## Historical Orange trial counts

These are the superseded House 53 fits, retained for comparison with the resident-marked replacement. They are reproduced from the Orange historical fixture and are absent from the current provisional catalog.

| House | Floor | Singles | Shared envelopes | Unassigned gray area |
| --- | --- | ---: | ---: | ---: |
| 53 | EG | 14 | 4 | 246.41 m² |
| 53 | 1. OG | 14 | 4 | 237.73 m² |
| 53 | 2. OG | 19 | 0 | 164.38 m² |

The former Orange fit omitted one end single from the top-floor W bank. Its lower A and W banks were each one single shorter than House 55, with shared end envelopes shifted inward by one pitch. Those historical offsets, omissions and gray remainders remain part of the archived fitting audit.

## Gray space and preserved geometry

The remaining floor is the original outline minus the apartment, hall, stair and side-wall allocations. It stays gray and unassigned. It may eventually become a larger room, circulation, storage, a common area or a correction to the shell; this revision makes none of those decisions.

Yellow EG’s current fitted floor outline and retained source observations remain unchanged, as do the official exterior models and the complete House 55 record. House 55’s three canonical plans, standalone top-floor study and layout sandbox are also preserved. The original twelve-floor preservation record remains valid for the earlier four-house revision; historical fixtures preserve Houses 51, 53, 57 and 59’s former source outlines and fitted audits.

Yellow EG uses `layoutBasis: "fitted-module-layout"` and marks every placed space and doorway as estimated. Houses 53, 55, 57 and 59, plus House 51 / 1. OG and 2. OG, use independent `resident-module-layout` floors. Neither designation turns a layout assumption into a surveyed interior.

## Reproduce

```sh
npm run layout:old-houses
npm test
npm run build
```

The generator is [`scripts/old-house-module-layout.mjs`](../scripts/old-house-module-layout.mjs). It regenerates only Yellow EG in [`public/data/interior-studies.json`](../public/data/interior-studies.json) and its placement/remainder audit in [`public/data/old-house-module-layouts.json`](../public/data/old-house-module-layouts.json). It skips each independent resident-module floor, preserving Houses 53, 55, 57 and 59 and Yellow’s two upper floors when regenerated. Tests still reproduce and check the original four-house fitted geometry using the isolated historical fixtures.

The earlier variable-dimension study is retained in [the historical report](OLD-HOUSES-STUDY.md). Original research and source limitations remain in [the evidence ledger](OLD-HOUSES-INTERIOR-EVIDENCE.md).
