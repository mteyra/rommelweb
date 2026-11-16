# Yellow House 51 · ground floor

15 November 2026. This revision completes Yellow’s **EG** using its existing top and middle floors and the resident’s general sketch of room counts and types. Both upper-floor plans, every other house and the folded exterior are preserved.

The [ground-floor annotation](../../data/source/house51-eg-resident-annotation.png) is retained with SHA-256 `5b5ea5454f08a61209a917af39994ece6756be42de5333469f3e335c0b742b61`. Its proportions are a guide to the arrangement; the dimensions below are derived from the existing module model. The resident’s follow-up corrects the Sports width: **“the Dorm E leftmost edge, should align with the edge between L1 and L2.”**

## Rooms and shared areas

| Bank | Ground-floor order in the drawing |
| --- | --- |
| East, top to bottom | H, G, F, E |
| N, left to right | N4, N3, N2, N1, N0 |
| R, left to right | R3, R2, R1 |
| L, left to right | L3, L2, L1 |
| A, left to right | Sports room, E, D, C, B, shared A |
| W, top to bottom | W4, W3, W2, W1 |

The red dividing lines split the earlier G–H, N3–N4 and W1 shared envelopes into singles, as on the completed middle floor. **A remains shared**, and B sits between C and A. The ground-floor E–D–C–B singles reuse the middle-floor F–E–D–C module slots, followed by shared A in the same position as upstairs. There are **23 singles and one shared apartment**.

The initial ground-floor version made Sports one module too wide. The corrected E module starts at **U = 25.60 m**, exactly at the L1/L2 module boundary, with its clear left edge at **25.80 m** after the 0.20 m side allocation. Sports is **6.20 m** wide. The entire E–D–C–B–A bank and its hall move **3.10 m left** relative to that first version; all apartment dimensions remain fixed.

N0 occupies the unlabelled single-room rectangle beside N1. The central stair, L/R banks and all other retained singles keep their exact middle-floor positions. Duplicate E labels remain distinct by wing in the selection cards.

## Derived dimensions

Singles retain **2.70 × 6.00 m clear interiors**, **3.10 m module pitch** and **0.20 m side allocations**. Halls are **1.40 m** wide, and shared A is **6.20 × 7.40 m gross**. The original measured 2.70 m room width anchors the model; the remaining dimensions continue the chosen layout assumptions.

| Element | Local U span | Local V span | Derived envelope |
| --- | --- | --- | --- |
| Sports room | 19.40–25.60 m | −7.40–0.00 m | 6.20 × 7.40 m; 45.88 m² |
| A-bank E module | 25.60–28.70 m | −7.40–−1.40 m | 3.10 × 6.00 m |
| D module | 28.70–31.80 m | −7.40–−1.40 m | 3.10 × 6.00 m |
| C module | 31.80–34.90 m | −7.40–−1.40 m | 3.10 × 6.00 m |
| New B module | 34.90–38.00 m | −7.40–−1.40 m | 3.10 × 6.00 m |
| Shared A | 38.00–44.20 m | −7.40–0.00 m | 6.20 × 7.40 m; 45.88 m² |
| Laundry | 10.50–16.70 m | 7.40–14.80 m | 6.20 × 7.40 m; 45.88 m² |

Sports room extends the west common-area gap to the outer facade and stops at E’s corrected edge. Laundry extends the east balcony footprint down to the same outer edge as N0. Both are enclosed spaces with one hall entrance; no equipment or internal partitions are inferred.

The **685.24 m²** independent floor outline is the union of complete modules, shared A, the common rooms, halls and stair. It contains no unassigned residual strips. The **2.70 × 7.40 m** stair enclosure and its coordinate frame stay exactly aligned with both upper floors.

## Openings

The A-bank E doorway is near its bottom-left corner, D near bottom-right and C near bottom-left, following the ground-floor lime marks. Sports opens near its bottom-right corner beside E. Other room doors retain the middle-floor pattern. Marks around the N bank are approximate; the model retains one entrance per room.

The new B doorway continues the bottom-right corner pattern. Shared A retains a left-wall doorway near the bottom after shifting. Laundry inherits the east balcony’s doorway near the stair at the right end of its top wall. B and Laundry have no separate clear doorway mark, so these placements remain schematic.

Room doors use the existing **0.90 m width** and **0.60 m center offset from a clear-room corner**, leaving a **0.15 m jamb**. Hinges and swings remain unspecified. All 24 apartments and both common rooms connect through the halls to the stair.

The A-bank layout windows move left with their apartments. Sports keeps one schematic window, also shifted left to stay within its narrowed outer wall. There are **26 layout-window symbols**. The folded façade evidence remains separate and unchanged.

## Reproduce and verify

```sh
npm run layout:yellow-ground
npm test
npm run build
```

The [ground-floor generator](../../scripts/house51-ground-floor-layout.mjs) writes the [canonical EG plan](../../public/data/house51-ground-floor-layout.json), replaces only the EG study and retires Yellow’s last provisional fitting entry. The subsequent [Orange release](HOUSE53-MODULE-LAYOUT.md) completes the remaining three floors and leaves the provisional catalog empty.

The [original preservation receipt](../evidence/house51-ground-floor-preservation.json) records the first ground-floor version against `155d32cb51fe3834c7bc61deb946c3e4e4d6c0e8`. The [Sports correction receipt](../evidence/house51-ground-sports-correction-preservation.json) compares this alignment fix against `f7a4e8c8b03f13e71d7ca0a365bef9610fa36722`. The [pre-ground-floor fixture](../../tests/fixtures/house51-before-ground-floor-layout.json) retains the earlier Yellow record and fit. Re-running either upper-floor generator preserves the completed-house source description as well as the ground-floor geometry. Final tests, browser views and publication checks are recorded in [release checks](RELEASE-CHECKS.md).
