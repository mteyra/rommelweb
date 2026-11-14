# Room typologies: public evidence and model limits

Inspected 14 November 2026. This addendum supports a compact source-linked room-reference catalog. It does not populate `interiors.json`, assign a layout to a room number, or establish an occupied floor outline. See [OLD-BUILDING-SECTIONS.md](OLD-BUILDING-SECTIONS.md) for the older roofs and [INTERIOR-FORMAT.md](INTERIOR-FORMAT.md) for reviewed geometry.

## What is feasible now

A small catalog can distinguish **older single apartments, older double/shared apartments, newer single apartments, newer accessible singles, and newer shared-group rooms**. Each entry can show its campus, published category area, facilities, evidence date and a link to the original drawing or operator page. A separate dimension note can describe the living zone in a resident sketch.

These are different kinds of measurements. The operator's rental-category area is **not** a measured clear-room rectangle. Its 2026 footnotes say the areas are averages and allocate communal spaces proportionally when determining categories. Do not use those values to generate a scaled room outline, derive furniture fit, or calculate occupancy.

## Current operator sources

| Source | Relevant evidence |
| --- | --- |
| [Campus Süd I operator page](https://www.werkswelt.de/index.php?id=wohnanlage-campus-sud-i) | Single apartments with private kitchenette/bathroom; double apartments with two separate rooms and shared facilities; three doubles described as wheelchair-friendly |
| [Campus Süd I 2026 category chart](https://werkswelt.de/data/uploads/wohnen/mietpreislisten/2026/erlangen/760-campus-sued-i-englisch-2026.pdf) | Category codes and average areas, effective 1 January 2026; table on PDF page 2 and qualifications on page 3 |
| [Campus Süd II operator page](https://www.werkswelt.de/index.php?id=wohnanlage-campus-sued-ii) | Standard and accessible single apartments; shared groups of three or four people; loggias on corridors |
| [Campus Süd II 2026 category chart](https://werkswelt.de/data/uploads/wohnen/mietpreislisten/2026/erlangen/766-campus-sued-ii-englisch-2026.pdf) | Category codes, average areas and qualifications on PDF page 2 |

Suggested concise catalog data:

| Campus | Reference type | Published area | Interpretation |
| --- | --- | ---: | --- |
| I | Single apartment, E1 | 16.4 m² | Operator category average, including the chart's allocation rules |
| I | Double-apartment share, M1 | 20.2 m² | Category average for the listed double-share accommodation; not the whole two-room apartment outline |
| II | Single apartment, E1 | 19.4 m² | Operator category average |
| II | Accessible single apartment, E2 | 30.0 m² | Operator category average and accessibility description; no verified route, threshold or door-clearance survey |
| II | Shared-group place, G1/G2 | 23.7–25.6 m² | Two category averages, not the private bedroom's clear dimensions |

The charts also list less common categories: Süd I G1/G2/G3 at 23.9/26.9/29.0 m², and Süd II M1 at 40.1 m². Their exact house, floor and layout are not supplied. Keep them in the source reference rather than inventing additional plan types.

The older operator web page describes a whole double apartment as 40.7 m², while the chart uses the double-share category figure above. They have different stated scope and rounding/allocation context; do not silently multiply one into the other or present a reconciled measurement.

Both PDFs use the **same example 3D single-room graphic**, despite the different campuses. Their footnotes explicitly characterize graphics as examples. That rendering therefore cannot validate the real layout of either campus, and it should not be traced into the model. Prices are time-sensitive and are unnecessary for this spatial reference feature.

## Resident drawings with actual annotations

All three drawings are linked from [Rommelwood's room-layout page](https://rommelwood.de/wohnen/zimmergrundriss/). The page warns about room-to-room differences and mirroring. It gives no survey date or complete house/floor/room-number mapping.

### Older single apartment

[Original sketch](https://rommelwood.de/media/images/zimmerskizze.jpg).

- Living zone approximately **2.70 × 3.30 m**.
- Continuous clear ceiling approximately **2.50 m**.
- The sketch includes a bathroom, kitchenette, bed, desk and wardrobe.

The image prints the dimensions as 270 × 330 and ceiling 250. Centimetres are inferred consistently from the furniture dimensions. The living-zone rectangle is not the entire apartment. Clear ceiling height excludes floor/ceiling construction and does not establish floor-to-floor spacing.

### Older accessible double apartment

[Original drawing](https://rommelwood.de/media/images/grundriss.png).

The page explicitly labels this as an accessible double apartment in the older houses. It shows two separate rooms with shared kitchen/bathroom/circulation. The page says other double apartments differ in the bathroom, corridor and kitchen. This is useful as a source-linked example; it is not a universal template for every older double.

Accessibility is the source's description. No complete verification of door clearances, thresholds, turning circles, lift access or the route from the street was found. Do not turn this catalog label into an accessible-route guarantee.

### Newer room

[Original dimensioned SVG](https://rommelwood.de/media/images/grundriss_neue_zimmer.svg).

The SVG was inspected visually as well as for its text annotations. Its useful approximate values are:

| Feature in this sketch | Approximate dimension |
| --- | ---: |
| Clear living-zone width × depth | **2.92 × 3.50 m** |
| Bed shown | 1.06 × 2.16 m |
| Desk shown | 0.77 × 1.60 m |
| Window width annotation | 1.10 m |

Again, the source prints centimetre-scale numbers without an explicit unit legend; the conversion is inferred from coherent furniture dimensions. These are annotations from a resident sketch, not certified construction dimensions. The overall drawing contains further offsets, service spaces and entry details; publishing a reconstructed complete plan would need separate review.

The accompanying text specifically says rooms may be mirrored and the window may independently sit on the bed side or desk side. A single mirror toggle cannot represent every actual variant. The sketch does not provide a ceiling height, house number, floor index or room number. It can support a typical-room reference, not the placement of that room on the digital twin.

## Whole-floor and architect evidence

The [architect's completed-project description](https://www.karlundp.de/projekt/wohnanlage-fuer-studierende-erlangen/) says residential upper floors have nearly identical plans, with loggia positions varying between levels. It describes exterior safety stairs, prefabricated wet rooms and lightweight internal partitions. This supports the existence of repeatable typologies, but it does not supply the numbered floor-plan dataset or justify copying one floor to every house.

The [2013 competition page](https://www.karlundp.de/projekt/wb-wohnanlage-fuer-studierende-erlangen/) contains a [site plan with schematic floor layouts](https://www.karlundp.de/wp-content/uploads/2017/04/Erlangen500-Lageplan.jpg) and an [exploded concept view](https://www.karlundp.de/wp-content/uploads/2017/04/Wettbewerbsdetail.jpg). These are **proposal-stage drawings**, with a building arrangement/numbering scheme that differs from the final eleven-house register. The small floor drawings lack current room identifiers and a reliable floor/address mapping. They must not become as-built interiors.

The [2022 Baukulturpreis brochure](https://www.karlundp.de/wp-content/uploads/2022/07/2022_Baukulturpreis_Broschuere_2022-06-29.pdf), printed pages 10–11 (PDF pages 12–13), has project facts and exterior photography, not dimensioned interior plans. Its completion entry is May 2018. The [Bavarian Chamber's 2018 project record](https://www.byak.de/planen-und-bauen/projekt/studentenwohnanlage-campus-sued-erlangen.html) and [BauNetz project page](https://www.baunetz-architekten.de/karlundp/2353659/projekt/6493122) likewise provide building/project context and photographs, not an address-matched room plan.

Public procurement notices found for the new development describe work packages and refer to the procurement platform for drawings. No usable public as-built floor set was obtained from those notices. Searches of the operator, architect, association and published project records located no complete, numbered, current floor set in this review. This is a limitation of the evidence obtained, not proof that such records do not exist.

## Further photo references

The architect's current project gallery provides two useful detailed views:

- [Frontal timber façade](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-939.jpg): vertical board lines, thin dark storey strips and window offsets between floors.
- [Close board and loggia view](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-882.jpg): fine board texture, weathering and a green recessed loggia.

The page credits Jens Weber. The upload path is not an established capture date, and neither photograph has a verified house/face registration. They refine the material references in [FACADE-REFERENCES.md](FACADE-REFERENCES.md); they do not establish exact window coordinates or a more accurate path alignment than the retained mapped data.

## Publication and next evidence

No open redistribution licence was established for these sketches, architectural graphics or photographs. The new SVG contains no observed licence grant. The catalog can link to the original sources and summarize the limited factual dimensions above without bundling or tracing their artwork. Keep each value's provenance and qualification next to it.

Store catalog records separately from geolocated interior geometry. A useful record distinguishes `areaKind: operator-category-average` from `dimensionKind: resident-sketch-living-zone`, records the campus and source date, and leaves house/floor/room assignment empty. Do not offer a false “show my exact room” action.

The next step toward actual rooms is one permission-cleared plan for one identified floor, plus a verified elevation and enough reference points to align it. Review room numbers and mirrored variants separately. No occupant names, room-to-person associations, private invitations or security details are needed for that work.
