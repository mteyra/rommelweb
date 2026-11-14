# Campus Süd I: upper floors, roof space and plate cladding

Research addendum, 14 November 2026. Covers the older houses at Erwin-Rommel-Straße **51, 53, 55, 57 and 59**. Read alongside [GEOMETRY.md](GEOMETRY.md) and [FACADE-REFERENCES.md](FACADE-REFERENCES.md).

The public evidence supports the articulated exterior and one approximate typical-room ceiling height. It does **not** establish the occupied outline of every floor, internal slab elevations, or a complete room layout. The resident's observation that the upper floors differ and the triangular roof section is unoccupied is valuable project input; it remains separate from a surveyed interior plan.

## Evidence and its limits

| Evidence | What can be used | What it does not establish |
| --- | --- | --- |
| [Bavarian official LoD2 dataset](https://geodaten.bayern.de/opengeodata/OpenDataDetail.html?pn=lod2), preserved in this repository | Exact source wall and roof polygons, differing roof heights, sloping planes and exterior silhouette | Occupancy, ceiling surfaces, slab thickness, room walls, or verified storey elevations |
| [Rommelwood room-layout page](https://rommelwood.de/wohnen/zimmergrundriss/) and its [older single-apartment sketch](https://rommelwood.de/media/images/zimmerskizze.jpg) | The sketch states “Wohnraumsabmaße ca 270x330” and “Decke durchgehend 250”: approximately **2.70 × 3.30 m living-room dimensions** and **2.50 m continuous clear ceiling height**, with centimetres inferred from the drawing's coherent furniture dimensions | No house number, floor, orientation, survey date or placement in a whole-building plan. The 2.50 m dimension is not floor-to-floor height |
| Same page's [older accessible double-apartment drawing](https://rommelwood.de/media/images/grundriss.png) | A typical apartment arrangement and approximate internal dimensions | No assignment to a particular building/floor and no whole-floor outline or ceiling-height evidence |
| [Studierendenwerk Campus Süd I gallery](https://www.werkswelt.de/index.php?id=wohnanlage-campus-sud-i), especially [wh-e-rommel.jpg](https://www.werkswelt.de/data/uploads/wohnen/wh-e-rommel.jpg) and [wh-e-rommel3.jpg](https://www.werkswelt.de/data/uploads/wohnen/wh-e-rommel3.jpg) | Visibly different wall/roof heights, sloping roof planes beside triangular wall areas, and horizontal façade plate courses distinct from roof covering | Photographs do not reveal the occupied volume behind an opaque triangular wall. They do not identify every photographed face by address or compass direction |
| [karlundp's 2013 competition project](https://www.karlundp.de/projekt/wb-wohnanlage-fuer-studierende-erlangen/), including its [section](https://www.karlundp.de/wp-content/uploads/2017/04/Erlangen-200-Schnitt.jpg), [east elevation](https://www.karlundp.de/wp-content/uploads/2017/04/Erlangen-200-Ansicht-OST.jpg), and [north elevation](https://www.karlundp.de/wp-content/uploads/2017/04/Erlangen-200-Ansicht-NORD.jpg) | Context for the relationship between existing houses and the proposed new development | Competition drawings are not an as-built record. Existing houses appear as background silhouettes; these images do not supply reliable old-house floor dimensions |
| [2014 renovation report](https://www.marktspiegel.de/nuernberg/c-lokales/joachim-herrmann-uebergab-foerdermittelbescheid_a7003) | Reports renovation of house 55 and work at houses 57/59, with completion then planned for autumn 2014 | No detailed section, material specification or evidence that every photographed feature is current |

The Rommelwood page explicitly warns that rooms can differ and be mirrored. It also identifies differences between accessible and other double apartments. These are reasons to retain the sketches as typical-room references, rather than repeating their furniture or boundaries across a generated floor plan.

## Consequences for floor modelling

1. **Preserve the source envelope.** Intersecting horizontal study planes with the official exterior can reveal stepped outlines and reductions at higher elevations. Repeating the ground footprint at every storey cannot represent those changes.
2. **Call those intersections exterior sections.** A section through an exterior roof/wall shell is not automatically an occupied floor outline. Roof voids, service spaces and internal setbacks require separate interior evidence.
3. **Keep roof space separate from selectable floors.** Apply the resident's report of an unoccupied triangular roof area as explicit project feedback. Do not infer an extra resident floor from roof peaks or fill a sloped roof volume with generated rooms.
4. **Keep vertical intervals provisional.** A dominant high flat roof plane may provide a reproducible exterior guide for a study. It is not a measured top-floor ceiling. Uniform division of the total roof-peak height is also not a verified storey model.
5. **Do not substitute clear height for storey height.** The approximate 2.50 m ceiling dimension omits slab thickness and other construction. It cannot determine all floor elevations without another measurement.
6. **Do not generate exact room boundaries or counts.** Use a reviewed interior submission for each floor before showing exact selectable rooms. A typical apartment sketch supplies neither the room index nor its placement.

The next useful resident evidence is one sketch per distinct floor, labeled with house number and floor, showing the occupied perimeter, the roof void boundary, stairs and corridors. One known floor-to-floor measurement or a dimensioned building section would resolve the largest remaining vertical uncertainty. No resident names, current occupancy or private contact details are needed.

## Plate treatment: avoid a brick-grid appearance

This is a refinement of the earlier façade study, not a new measured material specification. The older operator photograph shows **long horizontal plate courses with comparatively faint short vertical joints**. A procedural pattern with equally prominent horizontal and vertical strokes turns that character into a brick-like lattice.

Give the long horizontal lines visual priority. Reduce or omit short vertical joints in the campus overview and let restrained joints emerge only close to the façade. Keep them clipped to the official wall polygons. The previous study's numeric pitch ranges were optional display parameters; they are not measured modules and should not constrain the final rendering.

The sloped roof has a different, smaller overlapping course pattern. Keep it separate from wall plates. “Slate-like” remains a description of the photographed appearance; neither the roof nor wall product composition has been verified.

## Reference-image handling

The linked photographs and sketches were inspected as references. No open licence for bundling those images was established. They are not copied into the published website, used as traced textures, or presented as current measured plans. The source geometry and original schematic line treatment retain their separate provenance.
