# Red House 55 · second-upper-floor study

Reviewed 15 November 2026. The user selected **older Red House 55, Campus Süd I, 2. Obergeschoss** as the first interior study. This corresponds to above-ground index **2** in the current schema. Their annotated model screenshot supplies a proposed arrangement and identifies missing roof areas and a central stair. It is useful resident evidence, but it is not a dimensioned floor survey.

The implementation stores this study in `public/data/interior-studies.json`, separate from approved `public/data/interiors.json`, which remains empty. The official exterior is unchanged. **Seven sketch-divided bays plus twelve estimated bays produce 19 candidates**, with two floor exclusions, an approximate central stair, a potential corridor and estimated openings. No physical room number, resident, measured door position, opening swing or surveyed interior wall has been established.

![House 55 second-floor resident study with both absent wings removed and compact room markers](preview/single-floor.png)

[Daylight view](preview/house55-day-floor.png) · [Phone view](preview/house55-phone-floor.png)

## What the annotation shows

Locations here refer to the supplied screenshot, not compass directions inferred from its appearance.

- **Bottom-left run:** four bays are divided by red strokes.
- **Right-hand run:** three bays are divided by red strokes. Marks on the lower visible façade are not counted as additional second-floor partitions.
- **Question-mark regions:** the left vertical run, center-left box, center-right box and upper-right run require subdivision estimates.
- **Green crosses:** the two marked regions are reported absent from this floor. They must not be filled with inferred rooms.
- **Blue central feature:** stairs are indicated, but tread/riser dimensions, landings, connections and clearances remain unmeasured.

The visible red divisions are interpreted as room bays for this study. A bay, an apartment and a room record are not necessarily the same unit; their correspondence still needs confirmation.

## Evidence and registration

| Evidence | Useful information | Limit |
| --- | --- | --- |
| [Resident annotation supplied for this iteration](../data/source/house55-2og-resident-markup.png) | House 55, second upper floor, red divisions/unknown zones, blue stair and green exclusions | Hand strokes on a perspective model view; no scale, wall thickness, measured door locations or current room labels |
| [Official LoD2 exterior](GEOMETRY.md) | Existing metric coordinates provide reference points for registering the screenshot | Exterior/roof geometry does not supply internal partitions or occupied floor boundaries |
| [Older single-room sketch](https://rommelwood.de/media/images/zimmerskizze.jpg), from [Rommelwood's room-layout page](https://rommelwood.de/wohnen/zimmergrundriss/) | Approximately **2.70 × 3.30 m clear living zone**, with kitchen, bathroom and entrance outside that rectangle; approximately 2.50 m clear ceiling | Unassigned typical room, with variation/mirroring cautions. The 2.70 m width is not a measured structural bay pitch; clear ceiling height is not floor-to-floor height |
| [Current Süd I rental-category chart](https://werkswelt.de/data/uploads/wohnen/mietpreislisten/2026/erlangen/760-campus-sued-i-2026.pdf) | Single-apartment category average of **16.4 m²** | Category averages include the chart's allocation rules. Do not divide a floor area by 16.4 to obtain a room count or construct a rectangle from it |
| [Retained public-map aggregate](../public/data/room-markers.json), sourced from [Rommelwood's map](https://rommelwood.de/map/) | House 55 has **20 markers at source floor 2**, with 24 at floors 0 and 1 | Marker counts are not a verified current floor plan or occupancy count. Their coordinates were previously found unsuitable for precise interior placement |

The refined screenshot registration fits **17 manually observed corners on the same horizontal source-roof plane**, with an approximately **1.09 px RMS fitting residual** and **1.77 px maximum residual**, expressed in the archived image's pixels. The retained provenance records conversion from the manual digitization canvas to that original image. Four ridge controls from the earlier fit were excluded because they are not on the same plane. This measures fit consistency, **not partition accuracy**: hand-stroke placement, roof-versus-interior setbacks, wall thickness and the source model's own limits remain unresolved. The derived lengths below describe source-anchored, rectified annotation runs, not measured clear internal widths.

The source roof plane is used only for horizontal registration. The study remains at the existing provisional index-2 floor elevation; no surveyed floor elevation follows from the fitted roof plane. [Retained provenance](../data/source/house55-2og-study-provenance.json) records the observed controls, transform, source references and interpretation choices.

## Conditional bay-count estimate

The four-bay reference run spans approximately **12.07 m**, or **3.02 m per bay**. The three-bay reference spans approximately **9.14 m**, or **3.05 m per bay**. Together they suggest an illustrative gross pitch near **3.0 m** for comparisons within this sketch.

| Question-mark region | Approximate registered run | Study candidate | Mean gross bay width | Assessment |
| --- | ---: | ---: | ---: | --- |
| Left vertical run | 11.45 m | 4 | 2.86 m | Plausible alongside the typical clear-width reference, subject to end walls and stroke placement |
| Center-left box | 6.69 m | 2 | 3.35 m | Plausible; three would allow only 2.23 m per bay before walls, inconsistent with repeating the cited 2.70 m clear-width type |
| Center-right box | 8.10 m | **3?** | 2.70 m | Weak estimate: this leaves effectively no allowance for partitions or end walls if every room has the cited clear width. Two bays or a different zone boundary/type remain possible |
| Upper-right run | 9.56 m | 3 | 3.19 m | Plausible; four would allow only 2.39 m per bay before walls under the same repeated-room assumption |

The illustrated candidate is therefore **4 + 3 drawn bays, plus 4 + 2 + 3? + 3 inferred bays: 19 in total**. This is a study count, not a verified count or a confidence interval. It relies on interpreting each marked bay as one room and applying a typical width to an unmeasured floor.

The source map's **20 markers** are an unresolved cross-check. Do not add or squeeze in a twentieth room merely to match that total. An omitted subdivision, a different room/apartment typology, map coverage/errors or a changed layout could explain the mismatch; the available evidence does not select among these explanations.

For a run containing `n` repeated rooms, a more useful check is:

```text
run length ≈ n × clear room width
             + (n − 1) × partition thickness
             + end-wall/setback allowances
```

All terms must use the same boundary convention. The current 3.25 m façade-window pitch is an illustrative rendering parameter and supplies no independent evidence for this calculation.

## Implemented display and its limits

The House 55 study uses the existing provisional second-floor envelope section and subtracts the complete plan projections of the two sloping roof wings marked green. This changes only the displayed study plate; every retained LoD2 source vertex and other floor remains unchanged. The bays and corridor are limited to the annotated flat-roof plan. Stepped edge regions outside that annotation remain unassigned rather than receiving an invented room or route.

The central stair follows the blue mark's approximate position and direction. Its displayed treads are symbolic; they do not specify actual riser count, landing geometry or safe clearances. The **potential corridor** is the connected remainder between the candidate bays and stair, not a verified circulation or egress plan.

Every opening is **estimated**, including those beside sketch-divided bays: the generator places illustrative **0.90 m room openings** on candidate corridor-facing boundaries and a **1.10 m stair-access gap**. No door location or width was supplied by the annotation, and no hinge or swing is inferred. These gaps make the interaction framework inspectable; they do not establish real doors.

The renderer uses a low 1.05 m display cutaway, which is not a measured wall or ceiling height. Sketch-following and estimated cells have different evidence tags and solid/dashed wall treatment. Selection shows the evidence note and a correction action; there is no resident-card placeholder for study cells. All labels and IDs are temporary study references, not physical room numbers.

The map uses compact labels **A–G**, **W1–W4**, **L1–L2**, **R1–R3**, and **N1–N3**. They correspond to the seven marked bays and the four estimated regions; they are drawing references only. Room markers and small door buttons open the full label and evidence. Colliding markers hide until there is room to display them, while “Rooms & drawing key” retains a keyboard-accessible list of every space. The near-overhead camera aligns the long building axis horizontally on desktop and vertically on portrait phones without changing geometry.

`getDisplayLevel` prefers an approved floor if one is added later. Study records cannot create approval or floor-height anchors. Approving a future plan requires its own measurements, source/reuse review and independent layout check.

To reproduce the registration and derived study for review:

```sh
node scripts/generate-house55-study.mjs /tmp/house55-study-geometry.json
```

The generator writes the study/provenance result and a review SVG beside it. This command does not itself approve or deploy data. Its computational checks are separate from release QA and do not validate the real-world layout. Current release verification belongs in [RELEASE-CHECKS.md](RELEASE-CHECKS.md).

## Smallest useful resident checks

1. Confirm that the bottom-left and right-hand divisions represent **four and three rooms**, and whether every bay contains one room or an apartment with multiple rooms.
2. Count the doors along each of the four question-mark runs, recording any double-room apartment or shared/service space separately.
3. Measure one typical clear room width and the distance across several consecutive door centers or repeated partitions. Record where those dimensions start and end.
4. Check the **center-right zone first**: its registered length cannot comfortably hold three 2.70 m clear rooms plus walls. Confirm the red boundary and actual subdivision there.
5. Identify the actual floor elevation, stair/landing outline, corridor widths and occupied boundary beside both green exclusions before promoting the study to approved geometry.

Actual door locations, hinge sides and swings stay unknown until observed; the displayed estimated gaps do not resolve them. Physical room numbers remain absent during this study. No resident names, tenancy, contact details or occupancy records are needed. Follow [INTERIOR-FORMAT.md](INTERIOR-FORMAT.md) when approved geometry is ready, and preserve wall-thickness gaps rather than snapping clear-room outlines into a shared partition.

## Publication and interpretation

The resident annotation is implemented as a clearly labeled draft study; it must not silently populate the approved floor-plan dataset. Estimated subdivisions remain distinct from the user's marked divisions, and the tight center-right count and unresolved 19/20 comparison are retained in the study notes. A study cell is not an official room number or evidence of a resident.

External room drawings and photographs are linked, not bundled or traced as an exact House 55 plan. See [INTERIOR-PLAN-EVIDENCE.md](INTERIOR-PLAN-EVIDENCE.md) for the earlier search and [ROOM-TYPOLOGY-RESEARCH.md](ROOM-TYPOLOGY-RESEARCH.md) for the distinction between living-zone dimensions and category-average areas.
