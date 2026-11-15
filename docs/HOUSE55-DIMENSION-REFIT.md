# House 55 · metric audit, left alignment and stairwell access

Computed 15 November 2026 for **2. OG / index 2**. The resident-confirmed counts remain **A–D: 4, E–G: 3, W: 4, L: 3, R: 3, N: 3 — twenty rooms**. This audit adjusts unmeasured study partitions and tests their dimensions. It does not establish actual apartment outlines or supersede a measured plan.

The latest [resident annotation](../data/source/house55-2og-left-correction.png) moves the left rooms to the exterior elbow and identifies the green mark as a **west-hallway entrance into the stairwell**. The red flight outline and full stairwell enclosure are treated separately. The narrower enclosure uses a provisional half-room-width interpretation; it is not a measured stair dimension.

**Only L1–L3, the stairwell and associated hallway/entry geometry change in this correction. The other seventeen room polygons stay exactly as they were.** There are now two hallway spaces: the recorded west entrance connects West hall to the stairwell; an East hall connection is **unconfirmed and not invented**. This incomplete graph does not describe a verified emergency route or prove that the actual building lacks a connection.

The resident describes all top-floor rooms as singles, generally similar in size, with variation closer to “one hand length.” This remains a working hypothesis, not a measured tolerance. Seventeen candidate envelopes now have gross widths near **2.94–3.19 m** and a fitted common depth near **5.40 m**. Each accommodates a **2.70 × 3.30 m rectangle** with a hypothetical 0.10 m inset. **R1–R3 remain unchanged and unresolved** under that test. A packing witness is not an actual living-room position or a verified whole-apartment template.

## Sources and scale

The exterior comes from the retained, address-matched Bavaria LoD2 model `DEBY_LOD2_3166499`, in [the original source subset](../data/source/dorms-lod2.gml). The study uses the orthonormal plan axes from its registered annotation. No building or exterior vertex is rescaled to make rooms fit.

| Quantity | Metric result | Meaning |
| --- | ---: | --- |
| Whole raw-source model, aligned with flat-roof edge 23→0 | Approximately **49.43 × 24.19 m** | An enclosing box in a building-aligned UTM frame; not a rectangular building |
| Whole web model, in the study's axes | Approximately **49.34 × 24.15 m** | Slightly different orientation and the existing local projection |
| Raw flat-roof polygon 39 | **512.168 m²** | Roof-plan polygon; not measured occupied floor area |
| Annotated flat-roof intersection used for these rooms | **510.616 m²** | Web-coordinate region available to this study |
| Full provisional index-2 exterior section | **637.124 m²** | Before the resident's two roof-wing exclusions |
| Retained floor plate after those exclusions | **561.339 m²** | Includes about 50.72 m² beyond the annotated room region, left unassigned |
| Official height attribute | **9.491 m** | Exterior model height; not a measured three-storey interior section |

Six independently matched GML edges are about **0.134–0.164% shorter in the web frame** than in raw UTM. For example, the R frontage is **8.090303 m raw**, **8.079456 m in the web frame**. The conversion difference is millimetres per bay; it cannot explain a former L bay only 2.23 m wide. Raw and web figures also use explicitly recorded axis conventions and must not be mixed at millimetre precision.

The [dimension evidence review](HOUSE55-DIMENSION-EVIDENCE.md) confirms that the older resident sketch labels an approximately **2.70 × 3.30 m living zone**. Its entrance, bathroom and kitchen extend beyond that rectangle, without a dimensioned overall apartment length. Scaling the full raster by its living zone suggests a depth around 6 m, but that illustration is not uniformly calibrated or dimensioned enough to supply a measured full template for House 55. The operator's **16.4 m² category average** includes allocation rules and is not a clear room or gross apartment measurement.

## Historical dimensional check

The original [twenty-room sketch baseline](../data/source/house55-2og-sketch-baseline.json) had an L run of **6.691933 m / 3 = 2.230644 m per gross bay**. A 2.70 m-wide rectangle cannot fit in such a narrow strip, even before allowing wall thickness. Rotating that rectangle does not help: its minimum projection width at any angle is 2.70 m.

The former unequal hand-stroke divisions also produced B at about **2.689 m** and F at **2.583 m**, while adjacent bays were much wider. These are approximate drawn boundaries, so equalizing them is a reasonable study revision. It does not require changing the confirmed counts.

The R conflict remains in the current envelopes. Their retained frontage has a nominal **2.693 m gross share per room**. The raw source gives **2.697 m** per share. Three exact 2.70 m clear widths would require **8.10 m before partitions or end-wall allowances**. The raw frontage is only about **9.7 mm short in total**: that centimetre-scale difference, against an approximate drawing dimension and LoD2 exterior geometry, cannot prove that the actual apartments fail to fit. LoD2 is not an interior survey, and its numerical coordinate precision does not establish that accuracy.

Partitions also need an unmeasured wall budget. For illustration, two hypothetical 0.10 m separating partitions raise the required run to **8.30 m**, still before end walls. This strengthens the need to measure the R arrangement; it does not validate the illustrative wall thickness or overturn the repeated-single working hypothesis.

## Current correction

L1 starts at **source corner 18**, study X = **2.610996 m**, instead of X = 1 m. L3 ends at the south-notch alignment, **source corner 3**, X = **11.433485 m**. Three equal bays fill that **8.822489 m run**, giving **2.940830 m gross per bay**. Their north edge follows the actual source facade line; L1 no longer extends behind the west elbow.

The L group retains its fitted southern boundary and approximately the earlier common gross depth **D = 5.395477 m**. Following the skewed source facade at the corrected X coordinates reduces its mean projected depth by **1.378 mm**. D originally came from the arithmetic mean of seventeen non-R width-only depths, minimizing squared depth changes from those modeling priors. The prior vector is retained; the audit independently recomputes D, checks the four unchanged groups against it and reports the subsequent L correction separately. This verifies the calculation, not construction accuracy. The other seventeen rooms and all source exterior vertices are unchanged.

The stairwell sits against L3. Its provisional width is **half one L bay, approximately 1.470415 m**. The full enclosure extends from the source north wall to study Y = **9.071859 m**, separating the two hallway spaces. A separate schematic flight retains the approximate Y = **3.405605–7.710483 m** interval. The remaining parts represent upper and lower landings, without a measured stair rise, tread count or landing design.

The west entry is on the enclosure's **left boundary below the flight**. Its **1.10 m displayed opening** is estimated; the resident confirmed where it leads, not its exact width or swing. No east-side opening is added.

Current non-R widths span approximately **2.941–3.193 m**, about **0.252 m**, and their depths remain near **5.40 m**. The exterior-corner correction changes the former width spread; “one hand length” has not been converted into a strict acceptance measurement. Actual partitions, services and full apartment dimensions remain unverified.

### Per-room comparison

The comparison uses the [dimensional baseline immediately before this correction](../data/source/house55-2og-dimension-baseline.json), not the original hand-stroke sketch. Widths and depths are **projected gross polygon extents**, not clear dimensions. Slight source skew makes an extent differ from a nominal divider interval; the R polygons are tapered. Areas subtract holes. Values are rounded to three decimals.

| Study label | Width before → after (m) | Fitted depth after (m) | Gross area before → after (m²) | 2.70 × 3.30 packing test |
| --- | ---: | ---: | ---: | --- |
| A | 3.021 → 3.021 | 5.390 | 16.266 → 16.266 | Fits |
| B | 3.016 → 3.016 | 5.394 | 16.264 → 16.264 | Fits |
| C | 3.016 → 3.016 | 5.397 | 16.275 → 16.275 | Fits |
| D | 3.016 → 3.016 | 5.401 | 16.275 → 16.275 | Fits |
| E | 3.047 → 3.047 | 5.393 | 16.426 → 16.426 | Fits |
| F | 3.047 → 3.047 | 5.395 | 16.434 → 16.434 | Fits |
| G | 3.047 → 3.047 | 5.398 | 16.424 → 16.424 | Fits |
| W1 | 3.008 → 3.008 | 5.399 | 16.187 → 16.187 | Fits |
| W2 | 3.005 → 3.005 | 5.397 | 16.180 → 16.180 | Fits |
| W3 | 3.003 → 3.003 | 5.394 | 16.172 → 16.172 | Fits |
| W4 | 3.000 → 3.000 | 5.391 | 16.164 → 16.164 | Fits |
| L1 | 3.000 → 2.941 | 5.397 | 16.190 → 15.867 | Fits |
| L2 | 3.000 → 2.941 | 5.394 | 16.183 → 15.859 | Fits |
| L3 | 3.000 → 2.941 | 5.391 | 16.175 → 15.852 | Fits |
| R1 | 2.696 → 2.696 | 5.369 | 14.462 → 14.462 | Unresolved |
| R2 | 2.697 → 2.697 | 5.371 | 14.468 → 14.468 | Unresolved |
| R3 | 2.700 → 2.700 | 5.373 | 14.475 → 14.475 | Unresolved |
| N1 | 3.193 → 3.193 | 5.402 | 17.224 → 17.224 | Fits |
| N2 | 3.188 → 3.188 | 5.395 | 17.191 → 17.191 | Fits |
| N3 | 3.192 → 3.192 | 5.389 | 17.182 → 17.182 | Fits |

The test subtracts a **hypothetical 0.10 m inset** from each polygon, then searches for the reference rectangle in either building-axis orientation. This inset is a sensitivity assumption, **not measured wall thickness or a building-code requirement**. Every reported fit includes explicit rectangle coordinates that a geometry engine verifies are contained in the inset polygon. These are *packing witnesses*: they prove a rectangle can be placed somewhere. They do not establish a window-facing living zone, services, furniture placement or measured wall thickness.

For all three R rooms the inset polygon's bounding strip is narrower than 2.70 m. This independently rules out every rectangle rotation, so the negative result does not depend on the placement search's sampling density.

## Hallways, stairwell and the recorded door

L1 now starts at the source elbow and has a full candidate facade bay. The west connector marked “Thick wall?” remains governed by the exterior source face; LoD2 does not provide interior wall thickness. No thickness was inferred from the red stroke. The unchanged W4 envelope still extends about 0.45 m beyond its exterior elbow, so its actual window face and shape remain unverified.

The two hallway polygons represent distinct spaces. Their current access graph, built only from recorded door segments, is:

- **West hall → stairwell**, through the west entry below the flight. A–D, W1–W4 and L1–L3 have their estimated openings to West hall.
- **East hall → E–G, R1–R3 and N1–N3**, through their estimated openings. An East hall connection to the stairwell has not been mapped.

The former passage below the small stair box is now part of the stairwell landing/enclosure. There is no artificial gap connecting the hallways. A separate flight footprint inside that enclosure does not restore hallway access around it.

The diagnostic exterior-to-envelope separations are:

| Location | Gross geometric gap |
| --- | ---: |
| Between W and L | **3.082 m** |
| Between stairwell and R | **1.105 m** |
| Between R and E | **3.053 m** |
| Former southern bypass | **Closed by the stairwell enclosure** |

The roughly 1.1 m strip beside R is a geometric separation, **not an asserted circulation route, required clearance or egress finding**. R doors face north, and the actual eastern stairwell connection remains unknown. Making that strip pass a chosen sweep test would not justify altering the resident's stairwell correction.

The audit analyzes each hallway separately, including inward-buffer components and approach probes. West hall is approximately **92.207 m²** and East hall **85.222 m²**. Each retains one component larger than 1 m² after a 0.65 m inward buffer, and all twenty room-approach probes plus the west stairwell-door approach pass within their respective hallway. The stairwell approach uses its saved west-door segment rather than the former bottom-edge midpoint. These diagnostics do not establish passage through a doorway, verified wall thickness, obstructions, or emergency/accessibility compliance. The full access graph remains incomplete.

Room, enclosure and hallway areas, source-containment residuals and numerical overlap are retained in the machine-readable report. The current room/stairwell overlap is **zero**. The maximum source-containment disagreement is approximately **0.103 mm**, with **0.000744 m²** outside the annotated source region. These fall within the existing **0.2 mm / 0.001 m²** bounds for source-rounding disagreement; they are computational checks, not architectural accuracy claims.

## What the current envelopes do and do not establish

A uniform full-apartment template containing an exact 2.70 × 3.30 m living rectangle cannot fit **all twenty current candidate envelopes under the tested 0.10 m inset** while the strict R polygons are retained. This is a conditional result about the model, not an impossibility result about the physical house. Resolving it requires evidence about the R partitions, their corner/service arrangement, or the reference drawing's exact dimensions and applicability. This refit does not extend R3 beyond its accepted alignment merely to make the comparison succeed.

Seventeen living-zone fits do not establish seventeen complete apartment templates. The fitted envelope depth is about **5.40 m gross**. Under the 0.10 m inset sensitivity that leaves about **5.20 m** along its depth axis, or about **1.90 m** beyond a 3.30 m living rectangle in a straight arrangement. The entrance, bath, kitchen, walls and shafts have not been fitted or measured. A longer exact whole-apartment template could still fail these envelopes. The public sketch supplies no reliable measured complete depth with which to settle that question.

The highest-value confirmations are the **eastern stairwell connection**, actual enclosure/flight/door dimensions, **one R living-zone clear width**, and the **complete depth of a typical single apartment including its service section**. These would test the current access graph and fitted envelopes. The twenty confirmed counts remain fixed.

## Reproduce the audit

[The machine-readable audit](data/house55-dimension-audit.json) contains the exact inputs and results. The standalone drawing below distinguishes the comparison polygons from the hypothetical packing rectangles.

![Before and after the left-side correction, showing source-aligned L rooms, separate flight and stairwell, a west entry and an unconfirmed eastern connection; dashed rectangles are packing witnesses only](preview/house55-dimension-audit.png)

[The audit script](../scripts/audit-house55-dimensions.py) reads the official GML, current web geometry and selected study. Its default comparison is the retained [dimensional baseline](../data/source/house55-2og-dimension-baseline.json), captured from source commit `31e360f9124db6ea114454b6c58688b965ded940`. The earlier [hand-stroke baseline](../data/source/house55-2og-sketch-baseline.json) remains available for the historical comparison. All required model inputs are in the repository.

The [retained provenance](../data/source/house55-2og-study-provenance.json) contains the seventeen width-only input depths, subsequent fit and left-correction evidence. The audit independently recomputes the depth mean, verifies the four unchanged group means, reports the later L adjustment, checks all seventeen non-L room polygons against the dimensional baseline and analyzes the two hallway components and recorded door graph. It matches the annotated web roof to the raw GML by its exact polygon ID.

The script does not change model or approval records and rejects output paths that would overwrite source data or its inputs. Its Python dependencies are declared for an isolated `uv` environment; they are not website dependencies. Regenerate the published audit artifacts with:

```sh
uv run scripts/audit-house55-dimensions.py \
  --output docs/data/house55-dimension-audit.json \
  --plot docs/preview/house55-dimension-audit.png
```

Without those output flags, the script writes its JSON report to `/tmp/house55-dimension-audit.json`. `--study` also accepts a generator review JSON, and `--baseline` accepts an alternate comparison file. The report includes input hashes, exact source-edge comparisons, every room's polygon metrics, packing-witness coordinates, negative bounding-width proofs and circulation diagnostics. Future geometry changes should regenerate the report and this dated table.
