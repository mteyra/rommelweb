# Other old houses · fixed modules inside existing outlines

15 November 2026. Houses **51 and 53** retain provisional apartment placements on **EG, 1. OG and 2. OG**, covering **six floors** and following the accepted House 55 arrangement. The resident requested that the existing outlines stay intact, with unused space gray until an on-site check.

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

Lower floors borrow the shared-apartment pattern, with the same placements repeated on EG and 1. OG where both outlines contain them. Shared envelopes have one entrance and no invented internal partitions. House 55’s cinema, laundry, balcony labels and window observations are not transferred.

## Current trial counts

These are counts of placed apartment envelopes, not confirmed apartments or residents. The remainder excludes the proposed rooms, shared envelopes, halls, stair and side-wall allocations.

| House | Floor | Singles | Shared envelopes | Unassigned gray area |
| --- | --- | ---: | ---: | ---: |
| 51 | EG | 14 | 4 | 293.42 m² |
| 51 | 1. OG | 14 | 4 | 293.28 m² |
| 51 | 2. OG | 19 | 0 | 192.02 m² |
| 53 | EG | 14 | 4 | 246.41 m² |
| 53 | 1. OG | 14 | 4 | 237.73 m² |
| 53 | 2. OG | 19 | 0 | 164.38 m² |

Houses 51 and 53 omit one end single from the top-floor W bank. Their lower A and W banks are each one single shorter than House 55. The shared end envelopes move inward by one complete 3.10 m pitch. Small bank translations align the connected hallways with each fixed shell. The canonical data records these offsets and every omitted module.

## Gray space and preserved geometry

The remaining floor is the original outline minus the apartment, hall, stair and side-wall allocations. It stays gray and unassigned. It may eventually become a larger room, circulation, storage, a common area or a correction to the shell; this revision makes none of those decisions.

All six current fitted floor outlines and their retained source observations remain unchanged, as do the official exterior models and the complete House 55 record. House 55’s three canonical plans, standalone top-floor study and layout sandbox are also preserved. The original twelve-floor preservation record remains valid for the earlier four-house revision; the historical fixtures preserve Houses 57 and 59’s former source outlines and fitted audits.

The provisional levels use `layoutBasis: "fitted-module-layout"` and mark every placed space and doorway as estimated. Houses 55, 57 and 59 use independent `resident-module-layout` floors. Neither designation turns a layout assumption into a surveyed interior.

## Reproduce

```sh
npm run layout:old-houses
npm test
npm run build
```

The generator is [`scripts/old-house-module-layout.mjs`](../scripts/old-house-module-layout.mjs). It writes the two current target records in [`public/data/interior-studies.json`](../public/data/interior-studies.json) and their placement/remainder audit in [`public/data/old-house-module-layouts.json`](../public/data/old-house-module-layouts.json). It skips houses with independent resident-module floors, preserving Houses 55, 57 and 59 when regenerated. Tests still reproduce and check the original four-house fitted geometry using the isolated historical fixtures.

The earlier variable-dimension study is retained in [the historical report](OLD-HOUSES-STUDY.md). Original research and source limitations remain in [the evidence ledger](OLD-HOUSES-INTERIOR-EVIDENCE.md).
