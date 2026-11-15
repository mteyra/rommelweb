# House 55: apartment dimensions and equal-size feasibility

Reviewed **15 November 2026** for **older Red House 55, Campus Süd I, 2. OG / index 2**. The resident has confirmed twenty rooms and the six hallway counts. This review tests what public sources can establish about their dimensions. It does not change the geometry or apply newer-house dimensions to the older building.

**Public sources supplied no verified full single-apartment dimensions, address-matched top-floor plan, or proof of identical dimensions for all twenty apartments.** The resident subsequently described the rooms as broadly similar singles, with variation of “one hand length.” This supports a common-type working hypothesis; approximately **0.20 m** is a modeling interpretation of that phrase, not a measured tolerance. The published sources below remain useful checks, but cannot independently prove an exact replacement.

## Original older single-apartment sketch

The [Rommelwood room-layout page](https://rommelwood.de/wohnen/zimmergrundriss/) links this [original single-apartment sketch](https://rommelwood.de/media/images/zimmerskizze.jpg). The image was downloaded again and visually inspected for this review.

| Printed or visible evidence | What it establishes | Limit |
| --- | --- | --- |
| “Wohnraumsabmaße ca 270x330” | Approximately **2.70 × 3.30 m** for the living zone | This rectangle ends before the entrance, kitchenette and bathroom. It is not the complete apartment footprint |
| “Decke durchgehend 250” | Approximately **2.50 m** clear ceiling height | No slab thickness or floor-to-floor height |
| Bed 97 × 217; desk 75 × 155; wardrobe 100 × 60 | Furniture dimensions consistent with centimetre units | Furniture is not an independent survey reference for the apartment boundary |
| Window starts about 60 and ends about 165 from the left; sill about 95, extending to the ceiling | Approximate window position and width in this example | No house, floor, orientation or current room assignment |
| Entrance, kitchen and bathroom drawn below the living zone | A complete single apartment needs additional service and entrance space | No total apartment length, structural width, exterior-wall thickness or partition-thickness dimension is printed |

The image does not print a unit legend; centimetres are inferred consistently from its furniture and ceiling annotations. It supplies neither a scale bar nor a complete dimension chain. Although the service area appears to continue within the same drawn width, **2.70 m must not be relabeled as an outside-wall or structural-module width**. Extending a pixel scale from the living zone through the rest of the raster would produce a drawing-based estimate, not a measured full-apartment dimension.

The page warns that rooms can differ and be mirrored. It supplies no measurement date or identification of the apartment used for the sketch. Its warning does not quantify single-room size variation, so it also cannot establish that a particular unusually narrow study cell represents a real variant.

## Other older apartment dimensions

The same page labels its [second drawing](https://rommelwood.de/media/images/grundriss.png) as an accessible double apartment. Its printed dimensions include:

| Area in that drawing | Printed dimensions |
| --- | --- |
| Room A | **2.68 × 3.40 m** |
| Room B | **2.68 × 4.58 m** |
| Kitchen | **4.11 × 2.89 m**, less a small corner |
| Bathroom | **2.56 × 1.66 m**, less the service connection area |
| Hall | **2.59 × 1.26 m** |

These are two unequal bedrooms within a different apartment type. They demonstrate that the older complex has more than one room arrangement, **not** that House 55's twenty top-floor rooms include this type. The page says non-accessible double apartments differ in their bathroom, hall and kitchen proportions, and cautions about the measurements. The room dimensions must not be added as overlapping rectangles to manufacture a complete apartment area.

## Operator areas and their meaning

The [current Campus Süd I operator page](https://www.werkswelt.de/index.php?id=wohnanlage-campus-sud-i) covers **Erwin-Rommel-Straße 51–59**. It lists 285 furnished single apartments at **16.4 m²**, 27 double apartments with two separate rooms at **40.7 m²**, and three wheelchair-friendly double apartments. It does not assign accommodation types or dimensions to House 55's second floor.

The [2026 German rental-category chart](https://werkswelt.de/data/uploads/wohnen/mietpreislisten/2026/erlangen/760-campus-sued-i-2026.pdf) gives:

| Category | Published average area |
| --- | ---: |
| E1 single apartment | 16.4 m² |
| M1 place in a double apartment | 20.2 m² |
| G1 / G2 / G3 shared accommodation categories | 23.9 / 26.9 / 29.0 m² |

Its table and notes are on PDF page 2. The [English 2026 chart](https://werkswelt.de/data/uploads/wohnen/mietpreislisten/2026/erlangen/760-campus-sued-i-englisch-2026.pdf) has the table on page 2 and qualifications on page 3. The notes explicitly say that areas are averages and that communal areas, location and particular features enter the category calculation. The graphics are examples. The earlier [2024 chart](https://www.werkswelt.de/data/uploads/wohnen/mietpreislisten/2024/er/760-campus-sued-i-2024.pdf) and [2022 chart](https://werkswelt.de/data/uploads/wohnen/mietpreislisten/2022/760-erwin-rommel-2022.pdf) do not provide the missing dimensioned House 55 plan.

Consequently:

- **16.4 m² is not a verified clear area for each of the twenty apartments.**
- Dividing 16.4 m² by 2.70 m gives an arithmetic quotient, not a sourced full apartment depth. The two values describe different measurement scopes.
- Equal polygon areas would not prove equal usable areas, shapes or internal room arrangements.
- The double-apartment total and per-place category average have different stated scopes; do not silently reconcile them into an exact footprint.

## Consequence for the current top-floor study

The current study preserves the resident-confirmed counts: **4 southwest + 3 east + 4 west + 3 left + 3 right + 3 north = 20**. It uses similar single-apartment envelopes as the resident-supported hypothesis, while keeping all geometry estimated. See [HOUSE55-INTERIOR-STUDY.md](HOUSE55-INTERIOR-STUDY.md), the [dimensional fit](HOUSE55-DIMENSION-REFIT.md) and [retained registration provenance](../data/source/house55-2og-study-provenance.json).

The earlier left-block sketch run was approximately **6.692 m**, yielding **2.231 m gross per bay** when divided into three. Three 2.70 m clear living-zone widths would require at least 8.10 m before walls. That conflict prompted revision of the inferred block, while preserving the confirmed count. It describes the frozen earlier sketch, not the current top-floor L dimensions.

An earlier top-floor candidate fitted a common gross depth of approximately **5.40 m** to seventeen non-R rooms by moving five inferred corridor-facing boundaries. That depth came from the preceding width-only candidate, minimizing squared changes from modeling priors. The latest correction retains L's nominal **2.94083 m gross bays** while matching its overlap to W4's approximately **0.449712 m perpendicular overlap**. All seventeen non-L upstairs room polygons remain unchanged from the immediate [window/wall-stage baseline](../data/source/house55-2og-stair-ratio-baseline.json). Neither the fitted depth nor the source-relative alignment measures full apartment dimensions.

The non-R width spread remains roughly **0.25 m**. “One hand length” supplies no precise tolerance, so the earlier roughly 0.20 m interpretation is not an acceptance threshold. The former **1.47 m half-bay stairwell** and arbitrary **0.20 m L offset** are historical candidates. The resident's new [stair mark](../data/source/house55-stair-ratio-mark.png) and explicit clarification instead require **one quarter on the L3/west side and three quarters on the R1/east side** of extended roof edge 3–4. This gives approximately **1.78071 m gross width** conditional on the inferred L bays and exterior model; it does not measure clear stair width. The west-hall entry retains its estimated 1.10 m opening, and east access remains unknown.

R retains the preceding stage's separate **0.20 m extension**, giving approximately **2.76 m gross bays** while preserving the original exterior window wall. Its living-zone fit under a hypothetical wall inset remains unresolved; this does not establish a different actual apartment type. EG and 1. OG now repeat the corrected core at the user's request, with their own full floor outlines and additional wings unassigned. This is an explicitly unverified extrapolation; observed top-floor windows and possible wall bands are not copied down.

For a measured clear width `w` in a run of `n` apartments, the usable run must accommodate `n × w` plus the actual intervening wall thicknesses and end conditions. The exact allowance depends on whether the run was measured between wall faces, wall centres or exterior surfaces. The current LoD2-derived envelope and hand-drawn partition study do not establish those conventions.

A useful computational study can keep the confirmed count and approximate hallway relationships fixed, compare feasible candidate dimensions, and explicitly label the remaining choices as assumptions. It cannot establish that the resulting candidate is the built layout. Neither twenty times a published category area nor the available exterior-section area proves that twenty identical apartments fit with the necessary corridors, stairs, walls and service spaces.

## Evidence needed to settle the dimensions

The highest-value next input is one identified top-floor apartment's **full internal outline**, including entry, kitchenette and bathroom, with width and depth measured between specified wall faces. Combine that with the actual left-block span and its three partition positions, plus representative widths and depths in the other hallway runs. Record whether the twenty rooms share a type or include genuine variants, and check corridor/stair boundaries independently.

No current, dimensioned whole-floor House 55 plan was obtained from the targeted operator, association, address, refurbishment and older-building searches. This records the limits of the reviewed sources, not a claim that such plans do not exist. The 1979/80 history and later refurbishment records establish context, not interior dimensions.

## Source handling

The old single and double source images are linked, not copied into the repository or traced as surveyed plans. Fresh copies used for inspection remain in `/tmp/rommel-dimension-evidence/`. Their SHA-256 values were:

- Single sketch: `471ed54636951ff8fae2206bdb629871b6bf8750ed27ea15d29bacc67a494c63`
- Double sketch: `f22ef98da86779117a0c0f8525c7e1fa47fe2a7e1fd95c9ac09b94265e5e7e52`

No open redistribution licence was established for these drawings. The factual notes above retain their approximate nature and lack of assignment to House 55.
