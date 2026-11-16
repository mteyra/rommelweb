# Façade reference study

Inspected 14 November 2026; updated from six resident-supplied photographs on 15 November 2026. This study supports a wireframe material layer for the two building generations. The official LoD2 source remains the authority for the rendered exterior envelope. Photographs establish visible surface character; they do not supply measured elevation drawings. The [window reference study](WINDOW-REFERENCES.md) supports the separate window construction layer.

## Resident photograph update · 15 November 2026

The resident identified Lila **53a**, Grau **55a**, Blau **51a**, the rear of Rot **55**, and a courtyard view with Blau on the left, Gelb **51** behind, and Rot on the right. The fourth photograph is a close view of older cladding with yellow window frames. The fifth shows a corner of Blau with aligned upper windows. These descriptions improve house identification; orientation and feature registration are recorded separately in [the photograph-to-façade study](PHOTO-FACADE-UPGRADE.md).

The close photographs support larger, clearly separated rectangular plates on the older buildings and narrow, unevenly weathered vertical boards on the newer buildings. The implementation now uses paired timber groove lines with small deterministic width/brightness variation and occasional shorter grain strokes. A separate restrained silver-gray/ochre fill gives adjacent board pairs a softly correlated color field, with broad vertical variation. This is an original procedural study: it uses no raster texture, sampled photograph colors, or copied image pixels. Fine and distant timber layers retain the same board positions, and coplanar source patches share their pattern and color phase.

The color layer stays exactly on the source wall plane and subtracts both source holes and the union of window/recess masks. It intersects board bands before triangulation, avoiding invisible source-triangle diagonals that would multiply the mesh size. The current six-house fixture stays below **60,000 color vertices**, including all registered façade masks, so day/night color transitions remain practical. The correlated pairs and selected gray/ochre palette are rendering choices; they do not describe measured boards, documented maintenance, or exact weathering on unseen faces.

The old-house detail shows about four panel courses over the approximate regular window height. Using the **1.55 m typology reference** gives roughly **0.39 m per course**. Perspective, incomplete course edges and the unassigned room sketch prevent a measured conclusion. A **0.38 m course height and 1.15 m plate length** are therefore appearance settings, not new building measurements. They replace the earlier finer pattern. This changes neither wall thickness nor any internal study.

## Reference register

These are source links, not assets bundled with the website. The photographs were inspected at their available resolution. Their capture dates and present-day condition are not independently verified.

| Reference | Source | Direct image inspected | What it establishes |
| --- | --- | --- | --- |
| OLD-1 | [Studierendenwerk Campus Süd I gallery](https://www.werkswelt.de/index.php?id=wohnanlage-campus-sud-i) | [wh-e-rommel.jpg](https://www.werkswelt.de/data/uploads/wohnen/wh-e-rommel.jpg) | Clear view of horizontal reddish-brown façade plates with short staggered vertical joints, colored window frames, sloping roof planes and stepped parapets |
| OLD-2 | Same operator gallery | [wh-e-rommel2.jpg](https://www.werkswelt.de/data/uploads/wohnen/wh-e-rommel2.jpg) | Broader view of the older articulated buildings; horizontal cladding lines and different wall/roof heights |
| OLD-3 | Same operator gallery | [wh-e-rommel3.jpg](https://www.werkswelt.de/data/uploads/wohnen/wh-e-rommel3.jpg) | Horizontal panel courses continue over a triangular wall beside a sloping roof; red-framed glazing and separate roof covering |
| NEW-1 | [TOPOS, project landscape architects](https://topos-planung.de/studentisches_wohnen_erlangen/) | [Wohnen_Erlangen_Slide_6.jpg](https://topos-planung.de/wp-content/uploads/2019/02/Wohnen_Erlangen_Slide_6.jpg) | Close view of narrow vertical timber boards, thin horizontal joints at storey boundaries, tall dark-framed windows and green loggia surfaces |
| NEW-2 | [Studierendenwerk Campus Süd II gallery](https://www.werkswelt.de/index.php?id=wohnanlage-campus-sued-ii) | [campus-sued-e-rommel59a-aussen4.jpg](https://www.werkswelt.de/data/uploads/wohnen/slider/campus-sued/campus-sued-e-rommel59a-aussen4.jpg) | Repeated timber/window bands, horizontally staggered window positions between some floors, and open green corner loggias |
| NEW-3 | Same operator gallery | [e-rommelsstr-59a_eingang.jpg](https://www.werkswelt.de/data/uploads/wohnen/slider/campus-sued/e-rommelsstr-59a_eingang.jpg) | The visible sign identifies 59a; close view of vertical boards, dark trim, recessed entrance and vertical metal guardrail bars |
| TEXT-1 | [karlundp project description](https://www.karlundp.de/projekt/wohnanlage-fuer-studierende-erlangen/) | Project text; gallery photography credited to Jens Weber | Explicitly identifies untreated larch façades, prefabricated storey-height façade elements and floor-to-ceiling windows; loggia locations vary between floors |

OLD-1 through OLD-3 are operator references for addresses **51, 53, 55, 57 and 59** as a group. Their captions do not identify every photographed façade by exact house number and compass direction. NEW-1 and NEW-2 show the newer complex, **49, 51a, 53a, 55a, 57a and 59a**. A filename containing “59a” is not enough to assign every building in a multi-building photograph to that address. NEW-3 has readable address signage but still does not establish a georeferenced elevation.

## Observed material character

### Campus Süd II: vertical timber

The dominant fine-grain direction is **vertical**. Thin, closely spaced timber boards fill larger façade areas between windows. Horizontal dark trim separates successive storeys. The photographed wood varies from warm brown to weathered gray; exposure, lighting and photographic date affect its appearance.

Windows are tall and dark-framed. Some have visible dark shutters or blinds. Window positions do not form one universally aligned vertical grid: NEW-1 and NEW-2 show shifts between floors. Bright green surfaces and metal railings occur at open loggias. The photographs do not establish their complete arrangement on every building face.

Use vertical seam lines to communicate the timber character. The exact board widths, joint gaps, window dimensions, sill levels and façade-element boundaries have not been measured. The façade system is shared across the newer buildings, but a repeated procedural pattern does not establish identical details. The later window study identifies house 51a in a photograph: its two upper storeys have the same broad window character, while its shared ground floor needs separate treatment.

### Campus Süd I: horizontal rectangular plates

The older buildings have **horizontal courses of elongated rectangular plates**, with short vertical joints offset between courses. OLD-1 makes this especially clear. These surfaces should not receive the newer buildings' vertical timber pattern.

The photographed cladding is dark brown or reddish-brown. Window frames carry brighter house colors, including yellow, orange and red in these references. Openings vary in size and position. The roofs show smaller overlapping gray/slate-like courses. “Slate-like” describes appearance; no verified roof or façade material specification was located, so the code and documentation should not assert a particular product or composition.

Keep the plate lines within the existing wall polygons, including triangular and stepped wall areas. The official sloped roofs and parapets must retain their geometry. A wall's horizontal courses and a roof's covering are separate patterns.

## Conservative rendering guidance

The following numbers are **optional visual parameters**, not measurements of the dorms. They describe a restrained starting point for a procedural line treatment and must remain replaceable by measured façade data.

| Layer | Suggested starting treatment | Evidence status |
| --- | --- | --- |
| New-house timber | Current 0.14 m board pitch, paired shallow groove lines and sparse shorter grain; reduce density at a distance | Orientation and variable weathering observed; board pitch, groove gap and grain invented for rendering |
| Old-house plate courses | Current 0.38 m horizontal course pitch | Approximately four courses over the reference window height; still unmeasured |
| Old-house plate joints | Current 1.15 m plate length, with half-length offsets on alternate courses | Elongated staggered pattern observed; module and stagger amount inferred |
| Storey separator emphasis | Use existing provisional floor intervals only as a subtle visualization guide | Thin bands observed on new houses; actual separator elevations unmeasured |
| Windows, doors and loggias | Retain source geometry; apply separate construction graphics and identified face exceptions | See [window references](WINDOW-REFERENCES.md) and [the current feature register](PHOTO-FACADE-UPGRADE.md); exact coordinates and the complete house/face inventory remain unmeasured |

Implementation principles:

1. Keep every official LoD2 surface, hole, roofline and height unchanged. Clip new seam segments to the actual surface polygon and its holes. Subtract window and identified recess masks as a union, so neither hatch nor storey joints run through glazing or an open stair/loggia feature. Overlapping masks must not restore material lines.
2. Make generated seams a distinct **schematic façade detail** layer. They are visual annotation, not additional surveyed geometry, room boundaries or structural members.
3. Keep silhouette and roof edges clearer than material seams. Fine detail should emerge when zooming in without turning the campus overview into a dense wire mesh.
4. Apply material directions in each wall's local plane. “Vertical” follows world elevation; horizontal courses follow level intersections with the wall.
5. Do not use procedural windows to imply exact room counts or neighbor locations. The separate newer-house upper-window layer is a photo-informed appearance study. Measured façade reconstruction still needs per-house, per-face references with orientation and review status.
6. Hide the schematic material layer during the provisional exploded-floor study unless it is explicitly shown as illustrative. Do not make repeated floor slabs look like independently verified façade sections.
7. Remove the schematic trees, decorative gray volumes and other unwanted context from the scene as requested. Their disappearance is a presentation choice, not evidence that those real-world features are absent. Retain source context data separately.

## Accuracy boundary and next verification

The evidence supports a recognizable distinction: **vertical timber on the newer cubes; staggered horizontal plates on the older articulated houses**. It does not support calling every seam, window or loggia placement exact.

For one house at a time, obtain façade photographs labeled by address and direction, then compare them against the unchanged LoD2 envelope. Record at least one known dimension, board/panel module, floor elevations and opening offsets. Confirm whether the image represents the current façade. Keep geometry provenance separate from visual-style provenance.

## Image reuse

No open redistribution licence was established for these reference photographs. They are linked and used for observation only. No source photograph, crop, traced texture or screenshot belongs in the deployed assets on this basis. The original procedural seam treatment is not a copy of a source image. The official geometry continues to carry its own CC BY 4.0 credit; the OSM reference layer retains its separate ODbL attribution.
