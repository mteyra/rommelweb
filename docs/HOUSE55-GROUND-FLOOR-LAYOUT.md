# House 55: EG module layout

**Revision: 15 November 2026** · **House 55, EG**

EG derives from the accepted [1. OG layout](HOUSE55-FIRST-FLOOR-LAYOUT.md), including its twenty single apartments, two shared-apartment envelopes, hallway regions and stair core. Their geometry and campus placement are copied exactly, using ground-floor interaction IDs. Both upper-floor plans remain unchanged.

The resident requested that the ground floor retain the blue-marked areas previously removed from 1. OG. Their extents come from the [saved annotation](../data/source/house55-1og-module-breakdown.png) and the confirmed module geometry.

## Restored floor areas

| Area | Dimensions | Area | Basis |
| --- | --- | ---: | --- |
| North-east strip, beside the N wing | 9.30 × 4.50 m | 41.85 m² | Blue-marked strip in the first-floor annotation |
| South-west strip, beside the A wing | 9.30 × 4.50 m | 41.85 m² | Blue-marked strip in the first-floor annotation |
| Stair-side extension | 2.70 × 2.90 m | 7.83 m² | Current stair width and confirmed 2.90 m step |
| Total restored | | 91.53 m² | Union of three non-overlapping additions |

The restored regions remain **unassigned floor area**. No extra apartments, internal partitions, doorways or room uses are inferred. The first floor's two existing 9.30 × 2.90 m common strips remain part of its copied circulation.

The resulting ground-floor outline is **716.01 m²**, comprising the inherited **624.48 m²** plan plus **91.53 m²** restored area. These are model polygon areas, not surveyed usable areas.

## Inherited dimensions

- Twenty single interiors: **2.70 × 6.00 m**, **16.20 m²** each.
- Single-module pitch: **3.10 m**, including **0.20 m** on each side.
- Shared apartments A and W1: **6.20 × 7.40 m**, **45.88 m² gross envelope** each. Internal partitions remain undrawn.
- Main hallway runs: **1.40 m** wide.
- Stair: the same **2.70 × 7.40 m** enclosure and subdivision.
- W inner return: the previously confirmed **8.10 m**.

All twenty-four apartment/stair doorway symbols and twenty-four layout-window symbols keep their first-floor positions. The original folded façade remains separate. No new opening is implied by the restored floor footprint.

## Reproduce and verify

```sh
npm run layout:ground-floor
npm test
npm run build
```

[The ground-floor generator](../scripts/house55-ground-floor-layout.mjs) reads the unchanged [first-floor canonical plan](../public/data/house55-first-floor-layout.json), writes [EG canonical data](../public/data/house55-ground-floor-layout.json), and replaces only House 55 level 0 in the campus study. The [prior EG study](../data/source/house55-eg-before-module-layout.json) preserves the previous geometry and source evidence.

[Geometry tests](../tests/house55-ground-floor-layout.test.mjs) check inherited placement, restored extents, complete coverage, non-overlap, doorway connectivity, window separation, deterministic generation and preservation of both upper floors. Floor heights, actual wall construction and the use of the restored areas remain unresolved.
