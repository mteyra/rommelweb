# House Red: the module-layout sandbox

**[Open the interactive sandbox](https://mteyra.github.io/rommelweb/house55-layout/)** · [Current plan and assumptions](HOUSE55-MODULE-LAYOUT.md)

The starting layout is shared with House 55’s unfolded **2. OG** in the campus and the [standalone plan study](https://mteyra.github.io/rommelweb/house55-study/). It contains twenty **2.70 × 6.00 m clear room rectangles**, each with **16.20 m²** of interior area. The outline follows the latest annotated module plan, independently of the folded official exterior.

The sandbox remains editable: changing one side recalculates the other as `16.2 / side`. These edits explore alternative proportions of the clear interior rectangle. They do not rewrite the shared starting plan or the campus geometry.

## Use it

1. Select a room on the plan or in the dropdown.
2. Set **Apply dimensions to** to this room, its bank, or all twenty rooms.
3. Type a clear side length, move the width slider, or drag a resize handle. Dimension arrows follow the rectangle; its area stays at **16.20 m²**.
4. Leave **Keep bank together when resizing** on to repack the row after a change. **Pack this bank** and **Pack banks** use the chosen gap. The starting **40 cm gap** preserves the two separate **20 cm side-wall allocations** between adjacent clear rooms.
5. Drag a room to position it. **Drag the whole bank together**, or Shift while dragging, moves the row. Hold Alt while dragging to bypass edge snapping.
6. Use **Focus room**, zoom buttons or the mouse wheel to inspect an area. Drag empty space to pan. Arrow keys move a focused room or resize handle; Shift increases the step from 1 cm to 10 cm.
7. **Share layout** creates a link containing that version. **Download layout** and **Load layout** preserve the full-precision coordinates in JSON. **Reset to the module layout** restores the shared starting positions and 40 cm gap.

Undo and redo cover resizing, packing, dragging, rotation, importing and resetting. Changes save in this browser. A shared link is a snapshot; later edits do not change it.

## Starting dimensions

| Element | Starting layout |
| --- | --- |
| Clear room interior | 2.70 × 6.00 m = 16.20 m² |
| Room module across a bank | 0.20 + 2.70 + 0.20 = 3.10 m |
| Between adjacent clear rooms | 0.40 m: one 0.20 m allocation from each room |
| Twenty clear interiors | 324.00 m² total |
| Hallways | 1.40 m wide |
| Stair split | 1.30 m flight column + 1.40 m walkway = 2.70 m |
| Three-room / four-room banks | 9.30 m / 12.40 m |
| Wing depth | 6.00 + 1.40 = 7.40 m |

The room labels remain A–D, W1–W4, L1–L3, E–G, R1–R3 and N1–N3. They identify drawing references, not physical room numbers or residents.

The shell is generated from the annotated outline. Its runs use **7.40, 9.30, 12.40, 21.30, 1.90 and 5.00 m**. It is fixed during a sandbox editing session, but it is not the old LoD2-constrained top-floor shell. The former missing-wing overlays and roof-fit constraints are not applied to this independent outline.

## Editing limits

Width and length can range from **1.62 to 10 metres**, with their product fixed at **16.20**. Rooms can move and rotate by 90°. The editor keeps full precision while rounding displayed dimensions.

Packing operates within each bank and does not solve the whole floor. Orange marks flag positive-area room overlaps or a room crossing the complete concave shell. Touching boundaries are allowed. A conflict-free status checks room containment and room overlap; it does not establish a complete architectural fit.

Hall and stair guides start visible. They show the prescribed **1.40 m halls** and **2.70 m stair split**, and remain advisory during editing. Moving rooms can obstruct them. Changing a bank’s gap can also depart from the starting wall allocations.

The full **7.40 m wing depth** is already consumed by the **6.00 m room** and **1.40 m hall**. End-wall and hallway-wall thicknesses are not additionally allocated. Bathroom/kitchen partitions, actual door and window positions, storey elevations and stair run/landing details remain unresolved. The preceding 16.4 m² rectangle experiment and 1.30/2.72 m guide values are historical versions.

## Files and reproduction

- [Module generator](../scripts/house55-module-layout.mjs)
- [Shared canonical plan](../public/data/house55-module-layout.json)
- [Sandbox shell, starting rooms and provenance](../public/house55-layout/shell.json)
- [Rectangle geometry](../public/house55-layout/geometry.js)
- [Module checks](../tests/house55-module-layout.test.mjs) and [sandbox geometry checks](../tests/house55-layout.test.mjs)
- [Current module assumptions](HOUSE55-MODULE-LAYOUT.md)
- [Historical measured-fit study](HOUSE55-MEASURED-PLAN.md)
- [Release verification](RELEASE-CHECKS.md)

```sh
npm run layout:build
node --test tests/house55-module-layout.test.mjs tests/house55-layout.test.mjs
npm run build
```

The earlier shell exporter is a historical tool; use `layout:build` for the active module plan. Saved/shared layouts include the shell SHA-256 and fixed area. Imports must match this shell, all twenty labels, finite coordinates, valid rotations and **16.20 m²** per room. Old 16.4 m² or old-shell layouts are rejected, and the current browser-storage key is separate from the earlier sandbox.

The editor uploads no layouts. Shared coordinates are contained in the link fragment; changes on this page do not automatically update the campus or standalone plan.
