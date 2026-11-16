# House 55 · folded exterior refinement

15 November 2026. The resident requested exterior finishing from three new photographs, with **no internal changes and no drastic remodeling**. This revision changes House 55’s folded appearance only. The source building coordinates, footprint, roof planes, floor outlines, rooms, furniture concepts and layout windows remain unchanged.

## Photographs and registration

| Photograph | Source faces and observations |
| --- | --- |
| Broad backside with stepped right wing | Room wall **16** has four upper windows and five lower columns. The stepped return **28** has a lower window stack and a blank upper portion. Roof edges and thin metal drainage remain subordinate to the existing shape. |
| Wide entrance marked “55” | Low wall **4**, below roof **3**, has three separate red glazing groups divided by brown piers. Glazing returns along wall **45**. The separate narrow entrance is at wall **15**, beneath the existing sloping canopy **18**. Room windows beside it belong to wall **36**. |
| Entrance close-up | Dark entrance recess, red single door with three stacked panes, wide handle stile, street/house sign on the sloping fascia, and a silver downpipe. |

The existing narrow canopy and recess distinguish this entrance from the opposite low frontage on **wall 43 / roof 33**. The older rear glazing and roof-opening study remain on that opposite side. The wide entrance photo supplies an additional upright, three-part dormer on roof 3.

Surface numbers are zero-based source indices in [`public/data/lod2.json`](../../public/data/lod2.json). They identify model faces, not room numbers.

## Folded appearance changes

- **Windows:** lower windows align beneath the retained top-row centers on walls 4, 16 and 36. Wall 16 adds the visible outer lower column. Wall 28 uses one lower stack and a blank top strip. Wall 36 has three upper openings and two lower ones farther from the entrance. The remaining room banks on walls 0, 5 and 43 also align their existing lower columns to the saved upper centers; wall 5 retains its extra ground-floor opening beneath the low step. Those additional alignments are consistency estimates, not new photographic observations.
- **Shared glazing:** three separately recessed groups on wall 4, with preserved opaque brown piers, red lower panels, mullions and horizontal transoms. A separate glazed return follows wall 45.
- **Entrance:** the existing canopy stays in position. A display cutout opens the narrow entrance volume, revealing a dark soffit, one red three-pane door, handle, small intercom and threshold. The “Erwin-Rommel-Straße / 55” sign sits on its fascia.
- **Roof and metalwork:** a small upright roof-3 dormer, maintenance rungs and restrained roof courses; slim canopy trim, frontage gutter and attached downpipes.
- **Cladding:** a muted red-brown tint for House 55, retaining the established panel pattern. The other houses keep their previous materials.

Opening extents, recess depth, frame sections, dormer dimensions and pipe diameters are replaceable visual estimates. The source footprint and maximum roof height stay fixed. Thin attached trim and lettering use shallow surface offsets, as do the existing window sills.

The **24 saved top-floor window observations remain byte-identical**. The folded display suppresses the one old west-hall opening on the now-photographed blank upper return, leaving **23 located display openings**. This does not remove or move a room, change a window in the independent floor layouts, or rewrite the earlier source evidence.

## Implementation and checks

[`house55-window-alignment.js`](../../src/house55-window-alignment.js) supplies House-55-only appearance rows. [`house55-entrance.js`](../../src/house55-entrance.js) adds the entrance detail through the existing exterior presentation layer. The sign belongs to that same exterior group and disappears when the building unfolds.

The preservation check compares **89 source, interior, canonical-plan and sandbox files** with commit `4cd4a6d`, plus generated exterior, window and panel geometry for the **other ten houses**. The checks also cover finite geometry, source-face mask coplanarity, retained cladding piers, one distinct entry, upright dormer glazing and unchanged internal data.

See the [preservation receipt](../evidence/house55-exterior-refinement-preservation.json), [browser checks](../evidence/house55-exterior-refinement-browser.json) and [release checks](RELEASE-CHECKS.md).

The resident photographs are used as references in this conversation. Raw photos, crops and sampled textures are not committed or deployed; the exterior details and address graphic are generated locally.
