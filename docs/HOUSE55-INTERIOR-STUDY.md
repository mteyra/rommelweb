# Red House 55 · resident sketch and lower-floor studies

Reviewed 15 November 2026. The user selected **older Red House 55, Campus Süd I, 2. Obergeschoss** as the first interior study. This corresponds to above-ground index **2** in the current schema. Their annotated model screenshot supplies a proposed arrangement and identifies missing roof areas and a central stair. They subsequently corrected the stair and R1–R3 alignment and requested extrapolation to **1. OG and EG (indexes 1 and 0)**. These are resident observations and explicitly requested layout assumptions, not a dimensioned floor survey.

The implementation stores all three study floors in `public/data/interior-studies.json`, separate from approved `public/data/interiors.json`, which remains empty. The official exterior is unchanged. The resident has now confirmed **20 rooms on 2. OG**, across all six hallway runs. Seven bay layouts follow the original sketch and thirteen layouts remain estimated; confirmed counts do not establish wall coordinates. L1–L3 occupy the existing left-block outline, with L3 against the attached stair. Each lower floor repeats 20 shared-layout references as estimates, leaving extra wings unassigned. No physical room number, resident, measured door position, opening swing or surveyed interior wall has been established.

![House 55 second-floor resident study with both absent wings removed and compact room markers](preview/single-floor.png)

[1. OG extrapolation](preview/house55-first-floor.png) · [EG extrapolation](preview/house55-ground-floor.png) · [Daylight view](preview/house55-day-floor.png) · [Phone view](preview/house55-phone-floor.png)

## What the annotation shows

Locations here refer to the supplied screenshot, not compass directions inferred from its appearance.

- **Bottom-left run:** four bays are divided by red strokes.
- **Right-hand run:** three bays are divided by red strokes. Marks on the lower visible façade are not counted as additional second-floor partitions.
- **Original question-mark regions:** the left vertical run, center-left box, center-right box and upper-right run initially required count estimates. The resident has since confirmed their counts; divider positions remain estimated.
- **Green crosses:** the two marked regions are reported absent from this floor. They must not be filled with inferred rooms.
- **Blue central feature:** stairs are indicated, but tread/riser dimensions, landings, connections and clearances remain unmeasured.

The latest resident check confirms the room counts represented by these hallway runs. It does not establish room identities, physical numbers, tenancy or precise apartment/partition boundaries.

## Accepted resident revisions

The resident's follow-ups establish the following revisions:

- **Stair against the left block:** the earlier alignment moved it approximately **0.447 m** to the then-labeled L2 wall, preserving width, run and orientation and producing about **2.98 m of shared boundary**. With the same block now divided into three rooms, that adjoining room is **L3**. The stair does not move again. These dimensions describe model alignment, not a new survey.
- **R1–R3 toward the stair:** shift the block approximately **0.20 m** and align its rear wall and end edges with the source-plan boundary. The generator uses `RoofSurface` 39 vertices **6–7** and adjacent edges **5–6** and **7–8** to avoid small geometric protrusions. The resident has confirmed three rooms here; clear widths and internal wall locations remain unmeasured.
- **Twenty upstairs rooms:** after double-checking, the resident confirmed the existing counts in every hallway except the left block, which has **three rooms rather than two**. L1–L3 divide its unchanged outer outline. The current six counts are **4 + 3 + 4 + 3 + 3 + 3 = 20**.
- **Repeat the corrected shared arrangement below:** EG and 1. OG inherit it as a layout assumption. The user requested extrapolation; no independently observed lower-floor drawing or dimensions were supplied.

These corrections supersede the earlier approximate positioning. The original annotated screenshot remains archived unchanged, and provenance records the derived revisions separately.

## Evidence and registration

| Evidence | Useful information | Limit |
| --- | --- | --- |
| [Resident annotation supplied for this iteration](../data/source/house55-2og-resident-markup.png) | House 55, second upper floor, red divisions/unknown zones, blue stair and green exclusions | Hand strokes on a perspective model view; no scale, wall thickness, measured door locations or current room labels |
| Subsequent resident corrections, recorded in [study provenance](../data/source/house55-2og-study-provenance.json) | Stair against the left block, R1–R3 alignment, confirmed six hallway counts totaling 20 upstairs, requested repetition below | Count confirmation and alignment observations do not survey partition/door positions. Lower-floor repetition remains assumed |
| [Official LoD2 exterior](GEOMETRY.md) | Existing metric coordinates provide reference points for registering the screenshot | Exterior/roof geometry does not supply internal partitions or occupied floor boundaries |
| [Older single-room sketch](https://rommelwood.de/media/images/zimmerskizze.jpg), from [Rommelwood's room-layout page](https://rommelwood.de/wohnen/zimmergrundriss/) | Approximately **2.70 × 3.30 m clear living zone**, with kitchen, bathroom and entrance outside that rectangle; approximately 2.50 m clear ceiling | Unassigned typical room, with variation/mirroring cautions. The 2.70 m width is not a measured structural bay pitch; clear ceiling height is not floor-to-floor height |
| [Current Süd I rental-category chart](https://werkswelt.de/data/uploads/wohnen/mietpreislisten/2026/erlangen/760-campus-sued-i-2026.pdf) | Single-apartment category average of **16.4 m²** | Category averages include the chart's allocation rules. Do not divide a floor area by 16.4 to obtain a room count or construct a rectangle from it |
| [Retained public-map aggregate](../public/data/room-markers.json), sourced from [Rommelwood's map](https://rommelwood.de/map/) | House 55 has **20 markers at source floor 2**, with 24 at floors 0 and 1 | Marker counts are not a verified current floor plan or occupancy count. Their coordinates were previously found unsuitable for precise interior placement |

The refined screenshot registration fits **17 manually observed corners on the same horizontal source-roof plane**, with an approximately **1.09 px RMS fitting residual** and **1.77 px maximum residual**, expressed in the archived image's pixels. The retained provenance records conversion from the manual digitization canvas to that original image. Four ridge controls from the earlier fit were excluded because they are not on the same plane. This measures fit consistency, **not partition accuracy**: hand-stroke placement, roof-versus-interior setbacks, wall thickness and the source model's own limits remain unresolved. The derived lengths below describe source-anchored, rectified annotation runs, not measured clear internal widths.

The source roof plane is used only for horizontal registration. All three study floors retain the existing provisional guides: approximately **0, 3.164 and 6.327 m above the source building base**. No surveyed floor elevation follows from the fitted roof plane or the repeated layout. [Retained provenance](../data/source/house55-2og-study-provenance.json) records the observed controls, transform, source references and interpretation choices.

## Resident-confirmed upstairs counts

The resident's latest check was: “I double checked. We have the correct count for all the hallways except for L1, L2. There should also be a third dorm there L3.”

| Hallway run / drawing labels | Confirmed 2. OG room count | Partition-position evidence |
| --- | ---: | --- |
| Southwest / A–D | 4 | Original sketch divisions; unmeasured |
| East / E–G | 3 | Original sketch divisions; unmeasured |
| West / W1–W4 | 4 | Estimated dividers within the marked region |
| Left / L1–L3 | 3 | Revised equal subdivision of the unchanged left block; unmeasured |
| Right / R1–R3 | 3 | Estimated dividers within the corrected outer alignment |
| North / N1–N3 | 3 | Estimated dividers within the marked region |
| **Total** | **20** | **Counts confirmed by the resident; geometry remains a study** |

The original study had 19 candidates because it inferred only two left-block rooms. Its alternative two-room interpretation of the R block is also superseded by the resident's confirmation. Those earlier alternatives describe the research history, not the current count.

The confirmed upstairs total now agrees with the public map's **20 floor-2 markers**. This resolves the count comparison, not the map-coordinate or room-number evidence. The map also reports **24 markers on each lower floor**. EG and 1. OG currently repeat 20 shared-layout references as assumptions and leave extra wings unassigned; their full counts and additional spaces remain unverified.

The earlier inference assumed repeated rooms could be compared with one typical **2.70 m clear living-zone width**. That unassigned typology cannot override the resident's count or establish every room's width. The left and right runs need measured partition positions and room dimensions. Keep the boundary convention explicit when checking a measured run:

```text
run length ≈ n × clear room width
             + (n − 1) × partition thickness
             + end-wall/setback allowances
```

All terms must use the same boundary convention; the equation is not a reason to change a resident-confirmed count. The current 3.25 m façade-window pitch is an illustrative rendering parameter and supplies no independent interior measurement.

## Implemented display and its limits

The **2. OG** study uses the existing provisional second-floor envelope section and subtracts the complete plan projections of the two sloping roof wings marked green. This changes only that displayed study plate; every retained LoD2 source vertex remains unchanged. The bays and corridor are limited to the annotated flat-roof plan. Stepped edge regions outside that annotation remain unassigned.

The **EG and 1. OG** studies retain their complete original exterior-section outlines, including lower wings beneath the two green-marked upper roof areas. They do not inherit the upper exclusions. Only the corrected shared room/stair/corridor arrangement is repeated; the additional areas have no assigned room, route or use. The generator retains shared interior dividers and opening coordinates while clipping outer space edges to each floor's own source outline. This handles small source-coordinate differences without moving official vertices. Every lower-floor space and opening is `estimated`, and `extrapolatedFrom: 2` states the source of the assumption. Floor-specific IDs prevent interactions from being attached to a different level.

The central stair follows the blue mark's direction and accepted left-block alignment, now adjoining L3. Its displayed treads are symbolic; they do not specify actual riser count, landing geometry, connections between floors or safe clearances. The **potential corridor** is the remainder between the study rooms and stair, not a verified circulation or egress plan. Its lower-floor repetition is also an estimate.

Every opening is **estimated**, including those beside sketch-divided bays: the generator places illustrative **0.90 m room openings** on candidate corridor-facing boundaries and a **1.10 m stair-access gap**. No door location or width was supplied by the annotation, and no hinge or swing is inferred. These gaps make the interaction framework inspectable; they do not establish real doors.

The renderer uses a low 1.05 m display cutaway, which is not a measured wall or ceiling height. On 2. OG, sketch-following and estimated cells retain their separate evidence tags and solid/dashed wall treatment. Lower floors have no inherited `sketchBoundaries` and identify their repeated layouts as assumed from 2. OG. Selection shows the evidence note and a correction action; there is no resident-card placeholder for study cells. All labels and IDs are temporary study references, not physical room numbers.

The map uses compact labels **A–G**, **W1–W4**, **L1–L3**, **R1–R3**, and **N1–N3**. Upstairs they represent the 20 resident-confirmed rooms through unmeasured sketch/estimated geometry; on lower floors they identify assumed repetitions. They are drawing references only. Room markers and small door buttons open the full label and evidence. Colliding markers hide until there is room to display them, while “Rooms & drawing key” retains a keyboard-accessible list of every space. The near-overhead camera aligns the long building axis horizontally on desktop and vertically on portrait phones without changing geometry.

`getDisplayLevel` prefers an approved floor if one is added later. Study records cannot create approval or floor-height anchors. Approving a future plan requires its own measurements, source/reuse review and independent layout check.

To reproduce the registration and derived study for review:

```sh
node scripts/generate-house55-study.mjs /tmp/house55-study-geometry.json
```

By default the generator writes a review JSON and SVG outside the repository. The JSON's `level` is the corrected 2. OG record; `levels` contains EG, 1. OG and 2. OG, with registration, corrections and lower-floor assumptions retained in `metadata`. After review, `--write-study` updates House 55's study records, and `--write-provenance` refreshes the archived metadata. Neither option changes approved interiors or deploys the website. Computational checks are separate from release QA and do not validate the real-world layout. Current release verification belongs in [RELEASE-CHECKS.md](RELEASE-CHECKS.md).

## Smallest useful resident checks

1. Measure the actual partition positions and clear widths in **L1–L3 and R1–R3**. Their counts are confirmed; equal spacing and typical-room dimensions remain assumptions.
2. Locate and measure each real door opening, recording its room reference and whether it serves a shared/service space. Supply physical room numbers only when confirmed.
3. Measure clear widths and distances across several consecutive partitions or door centers, recording the exact endpoints and wall-thickness convention.
4. Identify the actual floor elevation, stair/landing outline, corridor widths and occupied boundary beside both upper exclusions before approving geometry.
5. Check EG and 1. OG separately: confirm which upstairs walls repeat, identify the additional wings and any shared/service spaces, and record their actual counts, doors and circulation. Upstairs count confirmation does not verify the lower floors.

Actual door locations, hinge sides and swings stay unknown until observed; the displayed estimated gaps do not resolve them. Physical room numbers remain absent during this study. No resident names, tenancy, contact details or occupancy records are needed. Follow [INTERIOR-FORMAT.md](INTERIOR-FORMAT.md) when approved geometry is ready, and preserve wall-thickness gaps rather than snapping clear-room outlines into a shared partition.

## Publication and interpretation

The resident annotation, confirmed upstairs counts and accepted alignment corrections are implemented as clearly labeled studies; they must not silently populate the approved floor-plan dataset. Partition and door geometry remain unmeasured, and lower-floor repetition remains assumed. The former upstairs 19/20 discrepancy and alternative R count are superseded, while lower-floor completeness and all actual room-number assignments remain unresolved. A study cell is not an official room number or evidence of a resident, and an unassigned lower wing must not be presented as empty or occupied.

External room drawings and photographs are linked, not bundled or traced as an exact House 55 plan. See [INTERIOR-PLAN-EVIDENCE.md](INTERIOR-PLAN-EVIDENCE.md) for the earlier search and [ROOM-TYPOLOGY-RESEARCH.md](ROOM-TYPOLOGY-RESEARCH.md) for the distinction between living-zone dimensions and category-average areas.
