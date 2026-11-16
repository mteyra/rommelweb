# Photograph-to-façade upgrade

**Grau 55a update:** the [seven-photo exterior reconstruction](GRAU-PHOTO-EXTERIOR.md) supersedes the earlier Grau window rows, ground-glazing placeholders and stair depiction below. It models the photographed bicycle cage, entrance and five open landings, and registers all four elevations while preserving the original dimensions and interiors.

**House 55 update:** the [later exterior refinement](HOUSE55-EXTERIOR-REFINEMENT.md) supersedes this report’s earlier eight-bay courtyard glazing and window-display treatment. It adds the photographed separate entrance, grouped glazing and upright roof-3 dormer, while preserving all internal layouts and source geometry. The other-house work below remains current.

Reviewed 15 November 2026. The resident's six photographs and the architect's gallery support a more recognizable exterior appearance on the existing campus model. This is an **unmeasured appearance study**, not a façade survey. No accuracy percentage is justified.

The official LoD2 coordinates, building placement, roof heights, exterior envelope and source surface segmentation remain unchanged. Existing floor elevations, section data, interior dimensions, room records and the resident-located House 55 top-floor window inventory also remain unchanged. New recesses, frames, rails, glazing and roof details are separate presentation geometry in the existing metre frame.

Read this with [material references](FACADE-REFERENCES.md), [newer-house windows](WINDOW-REFERENCES.md), [older-house windows](OLD-WINDOW-REFERENCES.md) and [geometry provenance](GEOMETRY.md). The feature implementation and its per-feature evidence metadata are in [exterior-details.js](../src/exterior-details.js).

## Evidence and orientation

The resident identifies the buildings in the submitted photographs. Compass directions and source faces are registered by comparing the photographed corners, neighbouring buildings and source footprint. Those registrations do not establish measured opening coordinates.

| Resident photograph | Identified subject | Registration and useful observations |
| --- | --- | --- |
| 1 | Lila, 53a | SSW room elevation on the left is wall 2; ESE elevation on the right comprises walls 9, 4, 1 and 3, including the open stair band. Green corner loggias interrupt ordinary window rows. |
| 2 | Rear of Red, 55; Blue, 51a, behind | Broad red-framed communal glazing occupies the low part of wall 43 below sloped roof 33. The slope has a wide three-part opening and maintenance steps. Small square caps occur on the flat roof. Blue's roof has vegetation, coping and equipment. |
| 3 | Grau, 55a | SSW elevation at left; ESE wall 7 at right. The upper ESE openings concentrate toward the NE part of the face, leaving a broad blank timber area toward the SE corner. |
| 4 | Older cladding and yellow window frames | Larger staggered rectangular panel courses, coloured frames, one horizontal transom, a shallow sill and a dark reveal. This close detail is not a complete registered elevation. |
| 5 | Blue, 51a, close corner | Upper window centers align vertically. Blind position, visible head zone and transom proportions differ between the two photographed upper rows. A lowered blind is a temporary appearance state. |
| 6 | Courtyard: Blue left, Yellow 51 behind, Red 55 right | Confirms the building relationships, older-house frame colours and Red's courtyard entry/glazing on wall 4 beneath roof 3. Blue's ground glazing and adjacent blank timber support an inferred NE wall 2 frontage. |

“Wall 2” and “roof 33” mean zero-based positions in the relevant building's `surfaces` array in [the retained LoD2 data](../public/data/lod2.json). They are source-record identifiers, not architectural bay or room numbers. Floors below use zero-based indexing: floor 0 is the ground floor.

## Registered detail inventory

| House | Feature and retained source faces | Current appearance treatment | Evidence boundary |
| --- | --- | --- | --- |
| Lila 53a | ESE stair elevation, walls 9/4/1/3 | Open recessed landings, guardrails, rear glazing and subordinate tread cues; estimated horizontal band 7.80–14.80 m from the SE corner | Open stair position is photographically identified. The 1.65 m recess and internal detail are illustrative; they create no interior route. |
| Lila 53a | SE loggia at floor 4; NE at floor 2; NW at floor 3 | Green corner recesses, soffits, rails and rear glazing; respective main/return widths 7.30/3.30 m, 6.00/3.25 m and 6.80/3.25 m | Corners and relative floors are identified. Widths, depths, rail spacing and rear glazing are estimates. |
| Lila 53a | NNE ground level, wall 7 | Recessed bicycle frontage with fine mesh and green supports | Architect photograph 527 identifies the bicycle use and broad frontage. Exact opening limits and subdivisions are unmeasured. |
| Grau 55a | NNW stair elevation, grouped walls 2/0/4/6 | Open landing band 7.84–14.81 m from the NW corner, with rails and recess detail | Architect photograph 342 supports the central stair on wall 0. Band limits and depth remain estimated. |
| Grau 55a | SW loggias at floors 5 and 2; SE at floor 3; NE at floor 4; NW at floor 1 | Green corner recesses and rails. SE floor 3 has a long 9.90 m ESE arm and short 3.20 m SSW return; the other main arms are 6.90–7.30 m | Corners and relative floors are identified. All numerical recess extents remain visual estimates. |
| Grau 55a | Ground glazing near the NE corner, north faces 6/4 and east face 7 | Separate broad ground frontage, independent of the upper window rhythm | Broad glazing is photo-informed. Bay count, limits and depth are estimated; no room identity is assigned. |
| Blue 51a | SW ground level, wall 6 | Shared glazing at model distances 0.18–13.70 m from the W corner toward the S corner; blank timber toward the S corner | Architect photograph 158 supports this face and partial frontage. The extent comes from coarse perspective correction, not the raw image-width fraction; bay divisions and depth remain estimated. |
| Blue 51a | NE courtyard ground level, wall 2 | Shared glazing at model distances 0.18–5.50 m from the north/NW end toward the E corner | Resident photograph 6 and the source plan support this contextual orientation. Face registration and opening extent remain uncertain. |
| Blue 51a | Upper window construction; explicit SW wall 6 rows | Six aligned centers on each of floors 1 and 2; differing illustrative blind/head and transom treatment | Resident correction and photograph 5 support alignment; photograph 158 supplies the SW row targets. Temporary blind positions do not prove different permanent window assemblies. |
| Red 55 | Rear wall 43, low frontage beneath roof 33 | Broad red-framed glazing with lower panels and nine illustrative divisions | The opening and location are observed. Nine is an estimated subdivision count. This is not a row of apartment windows. |
| Red 55 | SW courtyard wall 4, low frontage beneath roof 3 | Broad red-framed entrance/shared glazing with eight illustrative bays and two entry-leaf cues, set 0.18 m inside the ends of the source low edge | Resident photograph 6 locates the courtyard entrance facing Blue. Subdivisions and door cues remain estimated; no canopy, sign, interior layout or occupancy is inferred. |
| Red 55 | Sloped roof 33 | Three-part roof opening, estimated at 2.32 × 1.14 m, with fine maintenance rungs | Opening type and steps are visible. Dimensions, slope offsets and rung spacing are unmeasured; no occupied storey is inferred. |
| Newer timber houses | Broad flat source roofs | Inset roof beds, light vegetation marks and inward coping; equipment silhouettes on photographed roofs 51a/53a/55a | General roof character is visible. The 0.46 m inset allowance, equipment dimensions and placements are illustrative, beneath the retained roof cap. |
| Older houses; Red roof detail | Existing stepped/sloped roof edges; Red roof 39 | Fine coping lines; twelve low square cap silhouettes on Red roof 39 only | Roof outlines remain source geometry. Approximately twelve caps are distinguishable across visible roof portions; the model count and sparse placement are estimates, not a mechanical-services inventory. |

The numeric values above record replaceable implementation settings. They must not be copied into a measured building schedule.

## Photo row targets

Coarse planar rectification of oblique photographs was used to estimate relative window centers on a few identified faces. It provides unmeasured visual placement; no calibrated metric error bound has been established. Vegetation, perspective, shadows and recesses limit visibility. An explicit row target must still pass source-wall containment and recess exclusion checks, so its count is not a promise of the final rendered opening count.

| House / source face | Floor → visible row target | Registration |
| --- | --- | --- |
| Blue 51a / SW wall 6 | 2 → 6; 1 → 6 | Both rows use the same estimated fractions from W toward S: 0.08, 0.20, 0.36, 0.49, 0.64 and 0.73. |
| Lila 53a / SSW wall 2 | 4 → 6; 3 → 7; 2 → 7; 0 → 2 visible openings only | Centers progress from the SE corner toward the SW corner. Ground targets at estimated fractions 0.15 and 0.32 have partial coverage; vegetation obscures the remainder, so two is not a ground-floor total. |
| Lila 53a / NNE wall 7 | 4 → 5; 3 → 4; 2 → 4; 1 → 5 | Centers progress from the NW corner toward the NE corner. Architect photograph 527 complements the resident's view. |
| Grau 55a / ESE wall 7 | 5 → 5; 4 → 4; 3 → 4 | Centers progress from the NE corner toward the SE corner and occupy roughly the NE 60% of the face. |

Only these observed rows override the family fallback. Unspecified rows remain schematic, and the partial Lila ground row records only its two visible targets. All fractions in this table are estimated positions along a source face after coarse perspective interpretation, not raw pixel fractions or surveyed offsets. A source wall patch does not indicate a room boundary, and neither these targets nor generic window counts enter the room index. The separate House 55 / 2. OG inventory retains its 24 original approximate centers and identifiers.

## Remaining mapping limits

Architect photograph 158 shows Blue's café glazing over only part of its ground floor, substantial blank timber and separate narrow openings on the return. The Yellow/Red background relationship supports the SW café face, wall 6. Its implemented 0.18–13.70 m band extends over about 60% of the approximately 22.7 m source face from W toward S. This is a coarse perspective-adjusted model extent: a raw image-width fraction cannot be substituted because the near and far ends have different apparent scales.

Resident photograph 6 supplies a separate courtyard view. The implemented NE wall 2 band runs 0.18–5.50 m from its north/NW end at source plan coordinate `[-27.730, 14.365]` toward the E corner `[-12.330, 31.066]`. That orientation and extent remain contextual estimates; they do not establish a complete ground-floor inventory. The two Blue ground bands must not be interpreted as verified continuity around a corner.

About ten square caps can be distinguished on the broad right flat roof in resident photograph 2, with about two more on the left return. The implementation places twelve sparse candidates on roof 39 only. Occlusion and low contrast prevent a complete services count, and neither those candidate positions nor their total is a verified roof inventory.

The full opening inventory for every house and direction, ground-floor divisions, measured recess depths, rail sections, roof-bed build-up and equipment locations remain unresolved. Source geometry remains authoritative for the envelope while those appearance details remain replaceable.

## Public references and image handling

The primary public source is the [karlundp project page](https://www.karlundp.de/projekt/wohnanlage-fuer-studierende-erlangen/), with gallery photography credited to Jens Weber:

| Photograph | Role in this review |
| --- | --- |
| [527](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-527.jpg) | Identified Lila, opposite elevation, bicycle ground floor and loggias |
| [342](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-342.jpg) | Identified Grau and central open stair elevation |
| [158](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-158.jpg) | Blue's former SÜDBlick café frontage, upper windows and blank ground-wall areas |
| [490](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-490.jpg) | Türkis stair/window distinction and complex context |
| [939](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-939.jpg) | Window construction, transoms and varied opening positions |
| [637](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-637.jpg) | Green loggia recess, soffit, railing and rear glazing |
| [947](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-947.jpg), [446](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-446.jpg) | Vegetated flat roofs, coping and equipment character |
| [272](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-272.jpg) | Identified Schwarz bicycle frontage and mesh detail |

The upload path does not establish the date of photography. Historical café branding is not current model signage. No open redistribution licence was established for the reference photographs. Raw resident photographs, public photographs, crops and sampled textures are not committed or deployed; the new graphics are original procedural geometry. Source geometry and map data retain their separate attribution.
