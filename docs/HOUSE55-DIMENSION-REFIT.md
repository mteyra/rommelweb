# House 55 · matched overlap and staircase alignment

Updated 15 November 2026 for **2. OG / index 2**. L1 now has the same approximately **0.450 m corner overlap as W4**. The resident-marked exterior edge, extended through the staircase, divides its width into **¼ on the L3 side and ¾ on the R1 side**. The resident explicitly confirmed the R1 side for the three-quarter portion; that clarification determines the orientation.

![House 55 top floor: equal W4/L1 corner offsets and the extended reference edge dividing the stairs into one quarter toward L3 and three quarters toward R1](preview/house55-window-wall-study.png)

## The correction

The preceding build used a uniform **0.20 m wall-offset hypothesis**. That did not match the W4 overlap the resident accepted. Its staircase was also sized independently, so the marked reference line crossed at roughly **12% / 88%**, rather than the confirmed **25% / 75%**. Some earlier lower-floor views still showed the older, unenclosed staircase and narrow L bays.

The new stage uses the [accepted W4 overlap](../data/source/house55-2og-overlap-reference.png), [L-block correction](../data/source/house55-2og-l-overlap-correction.png), and [stair reference mark](../data/source/house55-stair-ratio-mark.png):

- **The whole L block moves farther left**, about another **25 cm** relative to the preceding build, so L1 matches W4's corner-normal offset.
- **The three L bays retain their estimated 2.94083 m widths.** Their dividers receive a tiny alignment adjustment to follow the marked source edge. This avoids a ratio that is correct only halfway along a slightly skewed staircase.
- **The stairwell stays flush with L3.** Its opposite side is derived from the quarter/three-quarter relation, giving about **1.781 m gross width**, up from about **1.670 m**. The separate flight, landings and west entry remain identifiable.
- **The L windows follow their shifted rooms**, preserving one window per L room. The top floor still has **20 room windows and four unassigned shared-area windows**.
- **All seventeen top-floor room polygons outside L are unchanged**, including R1–R3. The official exterior vertices and roof exclusions are unchanged.

The corrected core is also repeated on **EG and 1. OG**, following the resident's earlier request to extrapolate it downwards. Each lower floor retains its own complete source plate; extra wings remain unassigned. Their room count, partitions, staircase and doors are explicitly **extrapolated estimates**. Top-floor window observations and wall bands are not copied into lower-floor study records.

## Independent geometric check

The reference is **roof surface 39, vertices 3→4** of the retained House 55 model. It is an existing exterior return, not a moved room divider. The calculation extends that same line north through the staircase.

The W4 overlap is measured **perpendicular to its exterior return at the façade-end corner**. L1 is placed at the same perpendicular offset from its own return. The earlier approximately 0.452 m figure used averaged study-axis coordinates; small source skew explains the difference from the corner-normal result below.

| Constraint | Independently recomputed result |
| --- | ---: |
| Accepted W4 corner overlap | 0.449712 m |
| New L1 corner overlap | 0.449712 m |
| Difference after coordinate serialization | less than 0.000001 m |
| Reference line to L3-side stair wall | 0.445177 m |
| Reference line to R1-side stair wall | 1.335532 m |
| Derived gross staircase width | 1.780710 m |
| L3-side / R1-side split | 25% / 75% |

Let **d** be the distance from the extended reference line to the L3-side stair wall. The confirmed ratio requires the R1-side distance to be **3d**, so the full width is **4d**. With the retained L bay widths and the corrected L1 anchor:

**0.445 m + 1.336 m = 1.781 m gross.**

The independent audit takes five cross-sections across the actual saved staircase, normal to the source edge. The largest ratio error is **8.7e-08**, and width variation across the flight is **1e-07 m**. These are computational checks against rounded model coordinates, not claims of surveying precision.

The **relative alignment is resident-confirmed**. The metre values remain conditional on the inferred L-room widths and the exterior source model. The ratio by itself does not measure an absolute staircase width. It also does not establish clear stair width, riser count, landing dimensions, wall assemblies or the eastern stairwell connection.

## What the visible overlap means

A roof or exterior wall edge and an interior partition need not occupy the same plan line. The accepted W4/L1 overlap is represented as that **projected corner relationship**. It is not a claim that independent apartment interiors share floor area or that the masonry is exactly 45 cm thick.

The room, stair and hall polygons remain disjoint within numerical tolerance. Shaded wall bands are still drawing hypotheses within gross envelopes. The official LoD2 model supplies exterior faces, not paired inside/outside wall faces or verified wall construction.

## What still does not fit

R1–R3 are retained from the preceding build. Their original façade run is approximately **8.079 m**; the earlier hypothetical 0.20 m east-end extension gives a gross model span of approximately **8.279 m**, or about **2.76 m per bay**. The physical exterior façade is unchanged.

The public [older-room sketch](https://rommelwood.de/media/images/zimmerskizze.jpg), linked from [Rommelwood's layout page](https://rommelwood.de/wohnen/zimmergrundriss/), gives an approximate **2.70 × 3.30 m living zone**. It does not dimension a complete apartment, bathroom, kitchen or entrance. The operator's 16.4 m² category average is also not a gross apartment rectangle.

Under the same hypothetical **0.10 m inset on every side** used in the earlier audit, three 2.70 m clear widths need at least:

**3 × (2.70 + 2 × 0.10) = 8.70 m gross.**

That is another **0.42 m across the R row** beyond the current candidate. This is a necessary bounding-width condition, not a sufficient full-apartment design. The current inset R envelopes remain too narrow for the tested rectangle; rotating it does not resolve that width bound. This does not prove that the physical apartments are impossible or a different type—the reference dimensions and inferred wall allowances are not an interior survey.

The latest alignment change **does not create a new L-room packing problem**: seventeen living-zone witnesses still fit, with only R1–R3 unresolved. No bathroom, kitchen, service section or furniture layout has been invented to fill the remaining area.

## Current room dimensions

Comparison: [the immediately preceding window/wall-face study](../data/source/house55-2og-stair-ratio-baseline.json), commit `448569d`. Values below are **study-axis bounding extents before walls**, not measured living dimensions. L's tiny source-parallel alignment changes these projected bounds by millimetres while retaining the nominal perpendicular bay width. Areas subtract holes.

| Reference | Bounding width before → after (m) | Bounding depth after (m) | Gross area after (m²) | Living-zone test |
| --- | ---: | ---: | ---: | --- |
| A | 3.021 → 3.021 | 5.390 | 16.266 | Fits |
| B | 3.016 → 3.016 | 5.394 | 16.264 | Fits |
| C | 3.016 → 3.016 | 5.397 | 16.275 | Fits |
| D | 3.016 → 3.016 | 5.401 | 16.275 | Fits |
| E | 3.047 → 3.047 | 5.393 | 16.426 | Fits |
| F | 3.047 → 3.047 | 5.395 | 16.434 | Fits |
| G | 3.047 → 3.047 | 5.398 | 16.424 | Fits |
| W1 | 3.008 → 3.008 | 5.399 | 16.187 | Fits |
| W2 | 3.005 → 3.005 | 5.397 | 16.180 | Fits |
| W3 | 3.003 → 3.003 | 5.394 | 16.172 | Fits |
| W4 | 3.000 → 3.000 | 5.391 | 16.164 | Fits |
| L1 | 2.941 → 2.944 | 5.398 | 15.869 | Fits |
| L2 | 2.941 → 2.944 | 5.394 | 15.860 | Fits |
| L3 | 2.941 → 2.944 | 5.392 | 15.853 | Fits |
| R1 | 2.762 → 2.762 | 5.369 | 14.820 | Unresolved |
| R2 | 2.764 → 2.764 | 5.371 | 14.827 | Unresolved |
| R3 | 2.766 → 2.766 | 5.374 | 14.833 | Unresolved |
| N1 | 3.193 → 3.193 | 5.402 | 17.224 | Fits |
| N2 | 3.188 → 3.188 | 5.395 | 17.191 | Fits |
| N3 | 3.192 → 3.192 | 5.389 | 17.182 | Fits |

Dashed rectangles in the drawing are mathematical packing witnesses, not actual room layouts or window-facing living areas. The audit records each witness and verifies containment. The approximately 5.40 m gross depth remains an earlier fitting prior, not a measurement; its original input vector and independent mean check are preserved.

## Connectivity and consistency

The top floor has **23 spaces and 21 door targets**: twenty rooms, two halls, one stairwell, twenty estimated room doors and the resident-marked west stairwell entry. Windows create no new access targets.

- West hall connects to A–D, W1–W4, L1–L3 and the stairwell through their recorded entries.
- East hall connects to E–G, R1–R3 and N1–N3. Its connection into the stairwell remains unconfirmed.

| Diagnostic | Current result |
| --- | ---: |
| Gross separation between W and L | 2.633 m |
| Gross separation between stairwell and R | 1.241 m |
| Gross separation between R and E | 2.853 m |
| Room/stair/hall numerical overlap | 0.000000099 m² |
| Flight area outside its enclosure | 0.000000000 m² |
| Maximum exterior containment residual | 0.075 mm |
| Rounding area outside annotated source region | 0.000439 m² |

The existing containment limits remain **0.2 mm / 0.001 m²**. Shared serialized corners avoid numerical slivers. All twenty room-approach probes and the west stairwell approach pass within their respective halls. These checks do not establish inter-hall connectivity or real clear circulation widths. Browser and interaction checks are recorded in [RELEASE-CHECKS.md](RELEASE-CHECKS.md).

## Sources and reproduction

The exterior remains Bavaria LoD2 **`DEBY_LOD2_3166499`**, with an aligned raw-source extent around **49.43 × 24.19 m** and height **9.491 m**. These are enclosing dimensions, not a rectangular floor plan. The retained provisional top-floor plate is **561.339 m²** after the two resident-marked exclusions. Its annotated room region is **510.616 m²**; other section margins remain unassigned.

[Provenance](../data/source/house55-2og-study-provenance.json) retains the latest annotations, the explicit R1-side clarification and the new `stairAlignment` stage. Earlier stages are retained as history. [The machine-readable audit](data/house55-dimension-audit.json) recomputes the overlap and ratio from actual source/study polygons rather than copying the generator's claimed dimensions.

```sh
node scripts/generate-house55-study.mjs /tmp/house55-study.json --write-study --write-provenance
uv run scripts/audit-house55-dimensions.py \
  --output docs/data/house55-dimension-audit.json \
  --plot docs/preview/house55-dimension-audit.png \
  --plan-plot docs/preview/house55-window-wall-study.png
```

These commands regenerate study artifacts without changing official geometry, approving an interior or publishing a deployment. See the earlier [scale audit](HOUSE55-SCALE-AUDIT.md) and [dimension-source review](HOUSE55-DIMENSION-EVIDENCE.md) for the source limits. The most useful unresolved measurements are still **one R living-zone clear width** and **the R-to-east-hall corner relationship**; the requested W4/L1 overlap and staircase ratio now agree in the model.
