# Campus Süd II window references

Inspected 14 November 2026; updated with the resident's photographs on 15 November 2026. This addendum supports **photo-informed, unmeasured window linework** on the six newer houses. It does not turn the official LoD2 building envelopes into a measured façade or room model. See [the material study](FACADE-REFERENCES.md), [older-house windows](OLD-WINDOW-REFERENCES.md), [the current photograph-to-façade register](PHOTO-FACADE-UPGRADE.md) and [geometry provenance](GEOMETRY.md).

## Resident correction: house 51a

The resident has explicitly corrected the blue house's window pattern: **51a's upper window rows align vertically**. This local observation is authoritative project input and supersedes any previous generic stagger inferred for this house from the shared newer-building style. Use no alternating row offset on 51a. Its exact bay pitch, individual opening coordinates, floor elevations and full face inventory remain unverified. The source photographs still support its tall narrow upper windows and distinct café/shared ground floor.

The resident's fifth close photograph confirms that alignment at the visible corner. The top opening has a visibly lowered slatted blind, leaving two approximately equal visible panes; the opening immediately below has a shorter head zone and a lower transom. The graphics therefore keep their centers aligned but give the top row a **0.55 m illustrative slatted head zone / 0.52 transom fraction**, and the row below a **0.34 m head zone / 0.36 transom fraction**. The fraction is measured from the opening bottom across its height minus the head zone. These values communicate the photograph; they are not measured construction dimensions. A lowered blind is a temporary state, so the image does not prove that every top-floor window has a permanently different frame assembly.

## Construction graphics and face exceptions

Regular openings now have distinct shallow reveal, frame, glass, head/blind and sill layers, with clipped outlines and a single horizontal transom. The layer offsets make the drawing legible and do not enlarge the official building envelope. Dark glass remains glass rather than an inferred opaque room panel. Timber and plate marks are masked at the opening, and room-window candidates intersecting a registered stair/loggia exclusion are rejected as whole windows.

Reviewed photo-to-surface matches can provide explicit rows of window centers for one original wall record. They can identify ground-floor glazing independently of the upper room rhythm, or suppress a face that contains a stair/recess. All centers remain unmeasured visual placements and must pass the existing source-wall containment check. Unspecified faces retain the conservative family fallback. This keeps a photographed shared frontage from becoming an ordinary room grid while allowing source segmentation to remain unchanged.

The API in `src/windows.js` accepts `layoutsBySurface` and `exclusionsBySurface` maps keyed by original source surface objects. Explicit row coordinates use that original wall's local horizontal frame. Mask checks cover an entire coplanar wall group before each construction graphic is clipped back to its original patch. The separate resident-located House 55 inventory retains its original centers and identifiers.

## Primary sources and identifiable houses

The [karlundp completed-project page](https://www.karlundp.de/projekt/wohnanlage-fuer-studierende-erlangen/) publishes the photographs below, credited to **Jens Weber**. House colors are cross-referenced with the [resident association's public map](https://rommelwood.de/map/). A readable house name establishes the photographed building's identity; it does not establish the compass direction of every visible wall.

| House | Inspected photograph | Evidence and limits |
| --- | --- | --- |
| 49, Schwarz | [Architect photograph 272](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-272.jpg) | Readable “schwarz” lettering identifies its open, covered bicycle area. Vertical timber, a thin storey trim and metal mesh are clear. This close crop does not inventory its upper windows. |
| 51a, Blau | [Architect photograph 158](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-158.jpg) | The photographed café glazing carries the SÜDBlick name. The [operator's April 2026 announcement](https://www.werkswelt.de/?post=neues-konzept-im-suden-donerteria-offnet) explicitly places the former SÜDBlick at 51a. The photograph shows two upper rows of narrow windows, a partly glazed café ground floor and substantial blank timber. The café's current name is Dönerteria; old photographic branding should not become current model signage. |
| 53a, Lila | [Architect photograph 527](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-527.jpg) | Readable “lila” identifies an especially useful close view: dark narrow frames, lower transoms, head strips, staggered opening positions, green corner loggias and an open bicycle ground level. |
| 55a, Grau | [Architect photograph 342](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-342.jpg) | Readable “grau” identifies a view of both the room-window elevation and the exterior stair elevation. The latter includes broad open landings and a large blank timber strip. |
| 57a, Türkis | [Architect photograph 490](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-490.jpg) | Readable “türkis” and the entrance address identify the tower. Its exposed stair landings, adjacent blank timber, green loggias and room-window elevation are distinct façade types. This night photograph is useful for structure, not for reproducing lighting or resident activity. |
| 59a, Pink | [Operator entrance photograph](https://www.werkswelt.de/data/uploads/wohnen/slider/campus-sued/e-rommelsstr-59a_eingang.jpg) | The entrance sign explicitly says Erwin-Rommel-Straße 59a. It confirms the recessed entrance, metal stair railing, timber and blank wall beside the entrance. It is not a complete upper-floor elevation. |
| Complex-wide detail | [Architect photograph 939](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-939.jpg) | Close view of several successive window rows, dark frames, lower transoms, head strips and side-to-side offsets. No readable house identifier in this crop, so retain it as a system reference. |
| Loggia detail | [Architect photograph 637](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-637.jpg) | Green wall/ceiling surfaces, deep open recess, dark metal guardrail with vertical bars and glazing behind the recess. These are not ordinary windows flush with the outer wall. |
| Roof and context | [Architect aerial 947](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-947.jpg), [aerial 446](https://www.karlundp.de/wp-content/uploads/2023/08/Campus_Sued_Erlangen-446.jpg) | Flat, lightly vegetated roof surfaces with shallow perimeter edges and some small equipment. No measured equipment locations or roof construction details are established. |

The `/2023/08/` upload path is not a verified photography date. These are primary project references available at the time of research, not a promise that every shutter, finish or ground-floor use is unchanged today.

## What the references support

**Opening shape.** Room windows are tall and slim, with dark frames and a horizontal transom, usually in the lower part. The architect explicitly describes floor-to-ceiling windows. The lower pane should therefore not automatically be treated as a solid wall panel. A dark head strip or blind zone is visible above many openings. Photographs contain different blind positions; the top-row treatment for 51a above is a visual reference pose rather than an asserted permanent distinction.

**Horizontal rhythm.** Photographs 527 and 939 show successive rows shifting sideways within the façade's room-width rhythm. The observed arrangement also includes aligned pairs and irregular interruptions: it does **not** establish one universal checkerboard or an exact two-row cycle on every face. In particular, **51a uses vertically aligned rows according to the resident correction above**; it must not inherit a generic stagger.

**Material and floor boundaries.** Narrow vertical timber boards fill the wall between openings. Thin dark horizontal strips separate storeys. These strips help the window rows read as part of the building, but the photographs do not measure their elevations.

**Different façade types.** Exterior safety stairs have broad open landings with vertical metal railings, with substantial blank timber to one side. Green corner loggias occupy wider recesses and move between levels; ordinary room-window linework must not fill them. Ground floors combine bicycle, service, shared and residential uses. The architect's text confirms this mixed program. There is no factual basis for copying an upper residential row around every ground-floor face.

**51a is not a windowless community box.** Photograph 158 shows ordinary tall upper windows across both visible faces. Its café frontage uses larger glazing, while adjacent ground-wall areas are blank or have separate narrow openings. The [operator's planning report](https://www.werkswelt.de/?post=neubau-einer-wohnanlage-am-erlanger-suedcampus) described group apartments over the shared ground floor. That is additional evidence of mixed use, not an as-built room schedule.

## Dimensions and rendering boundary

The resident association's [typical newer-room sketch](https://rommelwood.de/media/images/grundriss_neue_zimmer.svg), linked by its [room-plan page](https://rommelwood.de/wohnen/zimmergrundriss/), annotates a window width of approximately **1.10 m**. Its dimension units are inferred from the consistent furniture and room annotations. The sketch provides **no window height**, façade bay pitch, elevation drawing, house assignment or full opening schedule. The page warns that room layouts can be mirrored and that the window can lie on either the bed or desk side.

Consequently:

- Approximately 1.10 m is a defensible **typology reference**, not a survey measurement for every opening.
- Any selected opening height, transom height, head-strip depth, bay spacing, offset and recess depth remains an explicitly unmeasured visual parameter.
- Use separate, replaceable window linework clipped to the existing wall surfaces and holes. Preserve the official shell, metre scale, roofline and silhouette.
- Keep generic upper-window cues distinct from room labels, room counts and resident positions. A procedural opening must never create a geolocated room record.
- Preserve known blank, stair, loggia and shared-ground exceptions where a face can be identified. Where direction is still unverified, describe the result as schematic character rather than a complete house-specific elevation.
- During the floor study, do not let illustrative openings imply approved floor elevations or occupied roof space.

This is sufficient to give the newer houses their recognizable narrow-window character now. Exact façade reconstruction still needs address-and-direction photographs or elevation drawings, one reliable scale dimension, and a reviewed opening inventory.

## Source-wall segmentation and 57a orientation

A LoD2 wall record is not a façade bay, blank panel or room boundary. The eastern side of 57a consists of adjacent source patches of approximately 7.01 m and 15.87 m span. Rejecting both independently because neither reaches a 20 m display threshold would leave a whole broad elevation blank for a technical reason.

There is a useful, explicitly **inferred** orientation match in photograph 490. The identified Türkis/57a is foreground, and the identified Pink/59a is behind and to its left. The public site coordinates place 59a south of 57a. Combined with 57a's fragmented north-northwest source elevation and the photographed exterior stair, this supports identifying the photographed room-window side as the eastern/east-southeastern elevation. That side should not be interpreted as universally blank. The photograph still shows broad blank corner areas and green loggia interruptions; it does not provide their measured offsets.

The appearance implementation can share one provisional rhythm across adjacent, nearly coplanar source patches, then clip each graphic back to the exact original surface. In the current study, adjacency uses a shared-vertex tolerance of 2 mm, normal-angle tolerance of 0.75° and plane tolerance of 0.08 m. A fallback display group needs a span of at least 20 m and one source patch spanning at least 12 m. A registered explicit layout bypasses those span heuristics but still requires full opening containment and the exclusion checks. These are **algorithm settings**, not measurements of façade construction or proof of a wall's function. In 57a the fallback allows the broad eastern wall while leaving the heavily fragmented north-northwest face without a generic window grid.

No source vertices are merged or moved by this grouping. The original patches, polygon holes and exterior envelope remain unchanged. The fallback stair/recess suppression remains a conservative display heuristic; photographed face exceptions are listed separately in the current feature register. Completing every face accurately still requires a reviewed façade inventory.

## Reuse and attribution

No open redistribution licence was established for these photographs or the resident room sketch. They are linked as references and were inspected outside the repository. No source photograph, crop, traced texture or copied drawing is bundled by this study. New procedural linework should remain an original illustrative layer. Official LoD2 geometry and OSM paths retain their separate attribution and licence requirements.
