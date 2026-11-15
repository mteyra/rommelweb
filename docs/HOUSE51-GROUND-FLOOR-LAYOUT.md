# Yellow House 51 · ground floor

15 November 2026. This revision completes Yellow’s **EG** using its existing top and middle floors and the resident’s general sketch of room counts and types. Both upper-floor plans, every other house and the folded exterior are preserved.

The [ground-floor annotation](../data/source/house51-eg-resident-annotation.png) is retained with SHA-256 `5b5ea5454f08a61209a917af39994ece6756be42de5333469f3e335c0b742b61`. Its proportions are a guide to the arrangement; the dimensions below are derived from the existing module model.

## Rooms and shared areas

| Bank | Ground-floor order in the drawing |
| --- | --- |
| East, top to bottom | H, G, F, E |
| N, left to right | N4, N3, N2, N1, N0 |
| R, left to right | R3, R2, R1 |
| L, left to right | L3, L2, L1 |
| A, left to right | Sports room, E, D, C, B, shared A |
| W, top to bottom | W4, W3, W2, W1 |

The red dividing lines split the earlier G–H, N3–N4 and W1 shared envelopes into singles, as on the completed middle floor. **A remains shared**. Ground-floor B is inserted between C and A, and the shared A envelope shifts **3.10 m to the right**. The former middle-floor A-bank F module becomes part of Sports room. There are **23 singles and one shared apartment**.

N0 occupies the unlabelled single-room rectangle beside N1. The central stair, L/R banks and all other retained singles keep their exact middle-floor positions. Duplicate E labels remain distinct by wing in the selection cards.

## Derived dimensions

Singles retain **2.70 × 6.00 m clear interiors**, **3.10 m module pitch** and **0.20 m side allocations**. Halls are **1.40 m** wide, and shared A is **6.20 × 7.40 m gross**. The original measured 2.70 m room width anchors the model; the remaining dimensions continue the chosen layout assumptions.

| Element | Local U span | Local V span | Derived envelope |
| --- | --- | --- | --- |
| Sports room | 19.40–28.70 m | −7.40–0.00 m | 9.30 × 7.40 m; 68.82 m² |
| A-bank E module | 28.70–31.80 m | −7.40–−1.40 m | 3.10 × 6.00 m |
| D module | 31.80–34.90 m | −7.40–−1.40 m | 3.10 × 6.00 m |
| C module | 34.90–38.00 m | −7.40–−1.40 m | 3.10 × 6.00 m |
| New B module | 38.00–41.10 m | −7.40–−1.40 m | 3.10 × 6.00 m |
| Shifted shared A | 41.10–47.30 m | −7.40–0.00 m | 6.20 × 7.40 m; 45.88 m² |
| Laundry | 10.50–16.70 m | 7.40–14.80 m | 6.20 × 7.40 m; 45.88 m² |

Sports room fills the west common-area gap and former F module, including that module’s short hall segment. Laundry extends the east balcony footprint down to the same outer edge as N0. Both are enclosed spaces with one hall entrance; no equipment or internal partitions are inferred.

The **708.18 m²** independent floor outline is the union of complete modules, shared A, the common rooms, halls and stair. It contains no unassigned residual strips. The **2.70 × 7.40 m** stair enclosure and its coordinate frame stay exactly aligned with both upper floors.

## Openings

The A-bank E doorway is near its bottom-left corner, D near bottom-right and C near bottom-left, following the ground-floor lime marks. Sports opens near its bottom-right corner beside E. Other room doors retain the middle-floor pattern. Marks around the N bank are approximate; the model retains one entrance per room.

The new B doorway continues the bottom-right corner pattern. Shared A retains a left-wall doorway near the bottom after shifting. Laundry inherits the east balcony’s doorway near the stair at the right end of its top wall. B and Laundry have no separate clear doorway mark, so these placements remain schematic.

Room doors use the existing **0.90 m width** and **0.60 m center offset from a clear-room corner**, leaving a **0.15 m jamb**. Hinges and swings remain unspecified. All 24 apartments and both common rooms connect through the halls to the stair.

The former F window is retained on Sports room’s outer wall, B receives a schematic room window, and shared A’s two windows shift with its envelope. There are **26 layout-window symbols**. No additional common-room window pattern is invented; the folded façade evidence remains separate.

## Reproduce and verify

```sh
npm run layout:yellow-ground
npm test
npm run build
```

The [ground-floor generator](../scripts/house51-ground-floor-layout.mjs) writes the [canonical EG plan](../public/data/house51-ground-floor-layout.json), replaces only the EG study and retires Yellow’s last provisional fitting entry. House 53 retains all three provisional floors.

The [preservation receipt](evidence/house51-ground-floor-preservation.json) compares the result against `155d32cb51fe3834c7bc61deb946c3e4e4d6c0e8`. The [pre-ground-floor fixture](../tests/fixtures/house51-before-ground-floor-layout.json) retains the previous Yellow record and fit. Re-running either upper-floor generator preserves the completed-house source description as well as the ground-floor geometry. Final tests, browser views and publication checks are recorded in [release checks](RELEASE-CHECKS.md).
