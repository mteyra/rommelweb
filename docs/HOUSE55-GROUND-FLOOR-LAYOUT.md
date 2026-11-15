# House 55: EG module layout

**Revision: 15 November 2026** · **House 55, EG**

EG derives from the accepted [1. OG layout](HOUSE55-FIRST-FLOOR-LAYOUT.md), including its sixteen single apartments, four shared-apartment envelopes, hallway regions and stair core. Their geometry and campus placement are copied exactly, using ground-floor interaction IDs. The two larger common sections are enclosed as cinema and laundry, each with one hallway door near the stair. The **716.01 m²** ground-floor footprint and the entire accepted top-floor plan remain unchanged.

The resident requested that the ground floor retain the blue-marked areas previously removed from 1. OG. Their extents come from the [saved annotation](../data/source/house55-1og-module-breakdown.png) and the confirmed module geometry. The latest [ground-floor shared-pair annotation](../data/source/house55-ground-floor-shared-pairs-annotation.png) additionally joins N3–N4 and G–H into shared apartments; the [common-area wall annotation](../data/source/house55-common-enclosure-annotation.png) encloses the two common sections.

## Restored floor areas

| Area | Dimensions | Area | Basis |
| --- | --- | ---: | --- |
| North-east strip, beside the N wing | 9.30 × 4.50 m | 41.85 m² | Blue-marked strip in the first-floor annotation |
| South-west strip, beside the A wing | 9.30 × 4.50 m | 41.85 m² | Blue-marked strip in the first-floor annotation |
| Stair-side extension | 2.70 × 2.90 m | 7.83 m² | Current stair width and confirmed 2.90 m step |
| Total restored | | 91.53 m² | Union of three non-overlapping additions |

Each restored outer strip combines with its adjacent **9.30 × 2.90 m** first-floor balcony footprint to form one **9.30 × 7.40 m** ground-floor common room. The cinema occupies the east/R side; the laundry occupies the west/L side. This use assignment follows the resident's earlier account that R hallway glazing overlooks the cinema and L glazing overlooks laundry, preserved in the [stair reconciliation](HOUSE55-MEASURED-STAIR-RECONCILIATION.md) and [recovered photo notes](CONTEXT-RECOVERY-2026-11-15.md). Those earlier glazing observations do not establish passage doors; the new hallway doorways follow the resident's latest explicit markings.

Each common room is separated from the adjacent hall and has one illustrative **0.90 m doorway near the stair end** of the long hallway boundary. The closing return also separates it from the perpendicular hall. Equipment, furniture, internal service partitions and actual wall construction remain undrawn. Only the **2.70 × 2.90 m stair-side extension**, **7.83 m²**, remains unassigned footprint.

The resulting ground-floor outline is **716.01 m²**, comprising the inherited **624.48 m²** plan plus **91.53 m²** restored area. These are model polygon areas, not surveyed usable areas.

## Inherited dimensions

- Sixteen single interiors: **2.70 × 6.00 m**, **16.20 m²** each.
- Single-module pitch: **3.10 m**, including **0.20 m** on each side.
- Shared apartments A, W1, N3–N4 and G–H: **6.20 × 7.40 m**, **45.88 m² gross envelope** each. Each absorbs its perpendicular hallway allowance; the remaining hall ends at its single entrance. Internal partitions and net usable areas remain undetermined.
- Main hallway runs: **1.40 m** wide.
- Stair: the same **2.70 × 7.40 m** enclosure and subdivision.
- W inner return: the previously confirmed **8.10 m**.

There are **25 spaces and 24 doorway symbols**: sixteen singles, four shared apartments, two common rooms, two hallway regions and the stair; twenty apartment entrances, two common-room entrances and two stair connections. Their entrances align with the updated first floor, and all **24 layout-window symbols** are retained. The original folded façade remains separate.

| Model component | Area |
| --- | ---: |
| Sixteen clear singles | 259.20 m² |
| Thirty-two single-room side-wall strips | 38.40 m² |
| Four gross shared apartments | 183.52 m² |
| Main bank hallways | 69.44 m² |
| Cinema | 68.82 m² |
| Laundry | 68.82 m² |
| Stair enclosure | 19.98 m² |
| Unassigned stair-side extension | 7.83 m² |
| Total | 716.01 m² |

The common-room and shared-apartment areas are model envelopes, with no deduction for future internal construction.

## Reproduce and verify

```sh
npm run layout:first-floor
npm run layout:ground-floor
npm test
npm run build
```

[The ground-floor generator](../scripts/house55-ground-floor-layout.mjs) reads the updated [first-floor canonical plan](../public/data/house55-first-floor-layout.json), writes [EG canonical data](../public/data/house55-ground-floor-layout.json), and replaces only House 55 level 0 in the campus study. Regenerate 1. OG first so both floors share the same apartment revision. The [prior EG study](../data/source/house55-eg-before-module-layout.json) preserves the previous geometry and source evidence.

[Geometry tests](../tests/house55-ground-floor-layout.test.mjs) check inherited placement, restored extents, complete coverage, non-overlap, doorway connectivity, window separation, deterministic generation and preservation of the supplied upper-floor data. The ground-floor generator does not edit either upper floor. Floor heights, actual wall construction, exact openings and the stair-side extension's use remain unresolved.
