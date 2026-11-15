# House 55: current module layout

**Revision: 15 November 2026** · **House 55, 2. OG**

The current layout starts from the resident’s **2.70 m clear room width** and the latest requested dimensions and annotations. It places **twenty 2.70 × 6.00 m clear interior rectangles** in an independently drawn outline. The campus’s unfolded top floor, [standalone plan](https://mteyra.github.io/rommelweb/house55-study/) and [sandbox starting layout](https://mteyra.github.io/rommelweb/house55-layout/) use this same plan.

The folded campus building retains its official LoD2 exterior, roof geometry and original exterior-window placements. Its shape is not stretched to fit these new interior dimensions.

## Dimensions and provenance

| Element | Current value | Basis |
| --- | --- | --- |
| Clear room width | 2.70 m | Resident-measured width stated for this revision |
| Clear room length | 6.00 m | Latest user-directed layout assumption |
| Clear interior rectangle | 16.20 m² | 2.70 × 6.00 m |
| Side walls | 0.20 m on each side of every room | Latest requested allocation |
| Room-module width | 3.10 m | 0.20 + 2.70 + 0.20 m |
| Space between neighbouring clear rooms | 0.40 m | Both rooms retain their own 0.20 m side strip |
| Hallway width | 1.40 m | Latest requested layout width |
| Stair width | 2.70 m | Requested 1.30 m flight column + 1.40 m walkway |
| Room count | 20 | Retained resident-confirmed count |
| Doors, relocated windows, treads and landing lengths | Illustrative | Arrangement aids, not new measurements |

The **6.00 m rectangle includes the intended entrance, kitchen and bathroom zones**; their internal partitions have not yet been drawn. **16.20 m²** is the area of this clear interior polygon. It is not the operator’s **16.4 m² category average**, and it is not the **2.70 × 3.30 m living zone** from the older published room sketch.

Every room has two separately drawn side strips. This deliberately yields **0.40 m between adjacent clear interiors** and **3.10 m pitch**. Substituting one shared 0.20 m wall would change the requested module and is not the current model.

The supplied annotations are retained as [module breakdown](../data/source/house55-2og-module-breakdown.png) and [final outline](../data/source/house55-2og-module-outline.png). They establish this revision’s requested layout; they do not turn the drawing into a surveyed floor plan.

## Annotated outline

| Run | Derivation |
| --- | --- |
| 7.40 m | 6.00 m room depth + 1.40 m hall |
| 9.30 m | Three modules × 3.10 m |
| 12.40 m | Four modules × 3.10 m |
| 21.30 m | 9.30 m bank + 2.70 m stair + 9.30 m bank |
| 1.90 m | 9.30 − 7.40 m return |
| 5.00 m | 12.40 − 7.40 m return |

The six banks preserve **A–D (4)**, **W1–W4 (4)**, **L1–L3 (3)**, **R1–R3 (3)**, **E–G (3)** and **N1–N3 (3)**. The generated outline follows the final annotation’s arrangement and these exact runs. It is translated and rotated into campus coordinates without rescaling or fitting to the LoD2 shell.

The idealized plan contains **324.00 m²** of clear room rectangles, **48.00 m²** of side-wall allocations, **86.80 m²** of bank hallways and **19.98 m²** of stair area, totaling **478.78 m²**. These are areas of the generated plan, not surveyed building areas.

## What remains unresolved

The complete **7.40 m wing depth** is already used by **6.00 m room depth + 1.40 m hall**. There is no extra depth for an end wall or a wall between the room and hallway. Those wall thicknesses must be resolved before treating this as a full construction layout.

The stair block is currently **2.70 × 7.40 m**. The width split is prescribed; the **4.60 m flight run**, **1.40 m end landings**, tread marks and **0.90 m door openings** are illustrative. The drawing includes two hallway-to-stair connections and twenty room-to-hall doors. Real door location, hinge, swing, stair construction and access between storeys remain unverified.

The 24 relocated layout-window symbols preserve the familiar count of twenty room references plus four shared openings. Their **1.05 m symbol width** and new positions are schematic. They do not move the original source façade windows or establish measured openings in the new outline.

Floor heights remain provisional. Bathroom/kitchen partitions, actual net usable area after those partitions, and the physical relationship between this independent layout and the exterior need further evidence. Lower floors and other houses have not inherited the new modules.

## One plan, three views

| View / file | Role |
| --- | --- |
| [Canonical module data](../public/data/house55-module-layout.json) | Exact drawing-coordinate outline, room polygons, modules, side walls, halls, stair zones and assumptions |
| [Campus study data](../public/data/interior-studies.json) | House 55 level 2 receives the same plan in campus coordinates, marked `layoutBasis: "resident-module-layout"` |
| [Standalone study](../public/house55-study/study.js) | Reads the canonical module data directly |
| [Sandbox starting data](../public/house55-layout/shell.json) | Same outline and twenty starting room rectangles; editing variants retain 16.20 m² each |

The campus renders `layoutWindows` with the independent floor. Its retained `windows` and `windowCoverage` remain the folded façade inventory. Source windows continue to be validated against their original LoD2 wall surfaces; relocated layout windows are validated against the independent plan. Outline labels say **Layout / m**, and room popups report **2.70 × 6.00 m / 16.20 m² clear polygon area**.

The sandbox can change proportions and placement. Those local or shared variants do not automatically rewrite the canonical plan; **Reset to the module layout** restores its starting version. See the [sandbox guide](HOUSE55-LAYOUT-SANDBOX.md).

## Reproduce and check

```sh
npm run layout:build
npm test
npm run build
```

[`scripts/house55-module-layout.mjs`](../scripts/house55-module-layout.mjs) generates the canonical JSON, the campus top-floor study and the sandbox starting data together. It uses the retained registration axes only for rigid orientation and centering. It validates the resulting study before writing it and preserves the saved source-window inventory.

Focused checks cover exact clear dimensions, bank pitch, side-wall allocations, hallway width, outline runs, containment, non-overlap, door connections, source-window preservation, and camera framing of the independent floor. See [module tests](../tests/house55-module-layout.test.mjs), [window tests](../tests/house55-windows.test.mjs), [study tests](../tests/interior-studies.test.mjs) and [camera tests](../tests/scene-views.test.mjs). Publication and browser verification belong in [release checks](RELEASE-CHECKS.md).

## Historical evidence

The exact preceding top-floor level is saved in [`house55-2og-before-module-layout.json`](../data/source/house55-2og-before-module-layout.json). Historical tests use that snapshot to preserve the earlier stair ratios, R-bank dimensions and lower-floor ancestry without imposing them on this new layout.

The [R-bank alignment](HOUSE55-R-ALIGNMENT.md), [measured-fit candidate](HOUSE55-MEASURED-PLAN.md), [stair reconciliation](HOUSE55-MEASURED-STAIR-RECONCILIATION.md) and earlier shell exporters describe prior stages. Their **16.4 m² target**, **1.30 m hallway** and **2.72 m measured stair cross-section** remain recorded evidence. The latest user-directed layout adopts the explicit values above; it does not claim that the previous measurements have changed.
