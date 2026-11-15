# House 55: 1. OG module layout

**Revision: 15 November 2026** · **House 55, 1. OG**

This revision extends the approved [2. OG module plan](HOUSE55-MODULE-LAYOUT.md) into the floor below. The top-floor plan, its campus placement and its standalone study and sandbox remain unchanged. The 1. OG retains the same stair and eighteen single-room placements; it adds two single rooms and replaces the A and W1 end units with two larger shared-apartment envelopes.

The supplied [shared-envelope sketch](../data/source/house55-1og-shared-envelope.png), [module breakdown](../data/source/house55-1og-module-breakdown.png) and [final outline](../data/source/house55-1og-module-outline.png) establish the requested additions and cutouts. These are resident-directed modeling assumptions rather than surveyed construction dimensions.

## Apartments and circulation

| Element | Layout dimension | Basis |
| --- | --- | --- |
| Twenty single-room interiors | 2.70 × 6.00 m; 16.20 m² each | Approved top-floor module |
| Single-room module pitch | 3.10 m | 0.20 + 2.70 + 0.20 m |
| Main hall runs | 1.40 m wide | Approved top-floor module |
| Shared apartments A and W1 | 6.20 × 7.40 m; 45.88 m² each | Two 3.10 m modules by 6.00 m room depth + 1.40 m perpendicular hall |
| Stair enclosure | 2.70 × 7.40 m | Same placement and subdivision as 2. OG |
| Retained common strips | Two rectangles, each 9.30 × 2.90 m | Final outline; 7.40 − 4.50 m |

Each shared apartment absorbs its two modules and the perpendicular hallway within its envelope. The remaining hallway ends at the apartment entrance. The **45.88 m²** is the whole gross model envelope, including future walls and services; it is not a private-bedroom area or a measured usable area. Its internal bedroom, kitchen and bathroom partitions remain undrawn.

The W and A wings each span five modules (**15.50 m**): one two-module shared apartment and three singles. The N and E wings each span four modules (**12.40 m**), adding single-room study labels **N4** and **H**. L and R each retain three singles. There are twenty single apartments and two shared-apartment envelopes in this drawing, with no resident assignment or physical room-number claim.

The blue-marked outer strips and stair spur are removed. The two retained 2.90 m strips join the adjacent circulation as common areas; they do not establish additional apartments. The final outline's 2.90 m dimension supersedes the earlier sketch's 240 cm note.

## Closing the dimension chain

The outline retains the approved top-floor core and every final annotated run except W's upper inner return. The resident explicitly confirmed **8.10 m** for that return, including the newly added 3.10 m module:

**15.50 m W wing − 7.40 m core = 8.10 m return.**

The 5.00 m annotation describes the previous four-module wing. Keeping 5.00 m while adding the fifth module would require changing another dimension or moving the inherited core. This reconciliation is recorded explicitly in the canonical plan.

Clockwise from W's upper-left corner, the confirmed runs are:

**7.40, 8.10, 12.00, 2.90, 9.30, 4.50, 12.40, 7.40, 5.00, 12.40, 7.40, 5.00, 12.00, 2.90, 9.30, 4.50, 15.50, 7.40, 8.10, 15.50 m.**

The resulting footprint is **624.48 m²**:

| Model component | Area |
| --- | ---: |
| Twenty clear singles | 324.00 m² |
| Forty single-room side-wall strips | 48.00 m² |
| Two gross shared apartments | 91.76 m² |
| Main bank hallways | 86.80 m² |
| Two common strips | 53.94 m² |
| Stair enclosure | 19.98 m² |
| Total | 624.48 m² |

These are generated polygon areas. The same outstanding wall-depth and opening-position assumptions as the top floor apply. Shared-apartment wall allocations are contained within the gross envelope and are not added to this total separately.

## Files and reproduction

- [Canonical first-floor plan](../public/data/house55-first-floor-layout.json) records module geometry, shared envelopes, circulation, source hash and the dimension reconciliation.
- [Generator](../scripts/house55-first-floor-layout.mjs) reads the approved top-floor plan and replaces only House 55 level 1 in the campus study.
- [Previous 1. OG](../data/source/house55-1og-before-module-layout.json) preserves the preceding study and original source-window inventory.
- [Geometry checks](../tests/house55-first-floor-layout.test.mjs) verify dimensions, exact coverage, connectivity, inherited placements and preservation.

```sh
npm run layout:first-floor
npm test
npm run build
```

The plan uses the top floor's exact campus coordinate frame, without recentering or rescaling the enlarged floor. Its separately placed layout-window symbols are schematic. The folded exterior retains the original LoD2 geometry and façade window evidence. EG and every other house retain their preceding studies.
