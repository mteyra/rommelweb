# Rommelweb recovery and House Red mathematical review

**Current direction:** both wings' hallways are now confirmed **1.30 m wide**. The resident explicitly withdrew the guessed stair alignment percentages; retire all 20/80 and 25/75 reference splits. The old W4/L1 exact overlap and projected R-bank length are also proposals rather than measured anchors. Use the [new measured-width candidate](HOUSE55-MEASURED-PLAN.md) and [canonical fitting constraints](../data/source/house55-2og-measured-fit-constraints.json). The historical recovery below records how the earlier model arose.

**Latest recovered measurement changes the conclusion:** the resident measured **2.72 m inside wall to inside wall**, comprising **1.43 m flight plus central railing/gap** and **1.29 m level walkway**. The split was confirmed in the current conversation. The interrupted recovery below missed this later message and its two additional tape photographs. Its 1.780710 m staircase and apartment table describe the saved candidate, which now fails the measured width constraint. Read [the measurement reconciliation](HOUSE55-MEASURED-STAIR-RECONCILIATION.md) first. All seven photographs and exact conversation evidence are preserved in the separate private recovery archive.

**Further observation:** every hallway on the **L, W and A–D side measures 1.30 m wide**, and the resident subsequently checked the **other wing and confirmed 1.30 m there too**. Treating this as clear wall-to-wall width is the stated working interpretation. The separately measured stair walkway remains 1.29 m. Retained in [the hallway measurement record](../data/source/house55-2og-hallway-measurements.json).

Recovered on 15 November 2026 from the previous conversation, its surviving photos, GitHub, the repository history, source geometry, and an independent numerical audit.

**Repository:** [mteyra/rommelweb](https://github.com/mteyra/rommelweb). **Demo:** <https://mteyra.github.io/rommelweb/>. Local HEAD and live remote `main` both resolved to `d27c1a2b518757b6607dce8baf0764084c80134d` during this review. The current interior stage is **`rAlignment`**, introduced in `7665017`; `d27c1a2` subsequently changed exterior appearance. This recovery adds analysis artifacts, without changing the app or its geometry.

## 1. What we are building

Rommelweb is the resident's independent digital twin and community interface for **Campus Süd I and II / Rommelwood**, Erwin-Rommel-Straße, Erlangen. It should eventually connect realistic houses, floors, rooms and doors with opt-in resident/community features. It is not an official operator or university service.

Recovered product choices:

- Preserve the real exterior dimensions and house identities. Improve visible detail without rescaling buildings to make inferred rooms fit.
- Use a quiet, spatial interface: hover highlights; click focuses a house; click empty space returns to overview; dragging must not deselect accidentally.
- Unfold one house, isolate a floor almost overhead, then inspect rooms and doors.
- Keep Groups and Timeline compact, mutually exclusive and at the top right. Community cards expand centrally and use public QR destinations.
- No sound. No decorative trees or gray context buildings. The old navigation-pole idea was abandoned.
- Public GitHub Pages was explicitly accepted “for now.” Authentication, verified residency, private group invitations, knocking, messaging and shared calendars remain future services. Personal data cannot become static demo content.
- House Red's top floor is the first interior reference. The resident asked for repetition below and transfers to other old houses, but these remain unverified extrapolations.
- “Do not force it if it doesn't make sense” is a recovered requirement. Accuracy aspirations, including >95%, are not measurements.

## 2. What currently exists

The application uses Vite, vanilla JavaScript, Three.js, polygon clipping and locally generated QR codes. It has no operational resident backend.

| Component | Audited current state |
| --- | --- |
| Exterior buildings | 11 address-matched Bavarian LoD2 models, 289 source surfaces |
| Floor guides | 49 provisional planes from exterior heights and mapped storey counts |
| Interior studies | 15 floors: EG, 1. OG and 2. OG of Houses 51, 53, 55, 57 and 59 |
| Study inventory | 333 spaces, including 258 room references, 270 door targets and 24 located window records |
| Approved interiors | None; `public/data/interiors.json` remains empty |
| Newer-house interiors | 34 provisional floor guides without interior studies |
| Community features | Public group information/links and volatile personal event drafts |

The 24 located window records belong to the House 55 top-floor study; this is not the total number of façade windows rendered across campus. Room references in transferred studies are not a verified dorm inventory.

Ten LoD2 models were created in April 2021; House 57's model was created in January 2025. The source footprint currency is October 2025. The November 2026 download is not a new survey.

Architecture details and the implementation audit are in [SYSTEM-AUDIT-2026-11-15.md](SYSTEM-AUDIT-2026-11-15.md).

## 3. Recovered House Red decisions

**Identity:** older Red House **55**, **2. Obergeschoss**, schema index **2**.

The resident confirmed **20 rooms**:

| Drawing bank | References | Count |
| --- | --- | ---: |
| Southwest | A–D | 4 |
| West | W1–W4 | 4 |
| East | E–G | 3 |
| Left center | L1–L3 | 3 |
| Right center | R1–R3 | 3 |
| North | N1–N3 | 3 |

These are drawing labels, not physical room numbers.

Preserve the following facts and qualifications:

1. The original green-marked regions have **no floor at this level**. They cannot be filled with inferred rooms.
2. L has **three rooms**, correcting the first two-room interpretation.
3. The stair adjoins L3, formerly labeled L2 before the count correction.
4. L1 should reproduce the same source-relative overlap as W4; the whole L bank was to move together.
5. The extended marked exterior edge divides the stair reference **¼ on the L3 side and ¾ on the R1 side**. Use these room-side names rather than image left/right.
6. The green hallway mark identifies an actual door into the stairwell from the L/west hallway.
7. There are **24 observed exterior window locations** in the top-floor study, with one window per L room.
8. The rooms are described as broadly similar singles, with possibly “one hand length” variation. The resident expressed uncertainty; neither a precise 0.20 m tolerance nor identical room types was measured.
9. Thicker walls at four marked outside ends were a hypothesis. The implemented 0.30/0.20/0.10 m allowances are modeling choices.
10. The latest R request aligns its sides to the opposite recess, approximately 8.99 m. This does not replace or stretch the original 8.08 m exterior segment.
11. Requested repetition to EG/1. OG and other older houses does not verify those layouts, extra wings or room counts.

### Revision order

| Commit | Meaning |
| --- | --- |
| `8f2e2b1` | First resident-sketch interior |
| `3eac42c` | Corrected 20 rooms and lower-floor repetition |
| `31e360f` | Scale/dimension audit and refit |
| `7bbf21d` | Earlier L/stair/entry correction |
| `448569d` | Window observations and wall-offset hypothesis |
| `9738610` | Matched overlap and quarter/three-quarter stair relation |
| `0064399` | Conditional area fit |
| `7665017` | **Current R alignment**, old-house studies and room concepts |
| `d27c1a2` | Exterior photo refinements; preserved interior data |

The provenance JSON intentionally contains all historical stages. Older L dimensions, the half-bay stair, the common 5.395 m depth, 2.76 m R bays and 14.73–14.74 m² R areas are superseded. Do not revive them by taking an isolated old paragraph as current.

## 4. The exact work lost at the crash

The prior thread is `01a1db74-f0ac-7ab3-90eb-0190ba7acab6`. Its last substantive request appeared at 11:47 UTC and was repeated at 11:48 UTC on 15 November. It was followed by “Input is too long” failures; the photos were not incorporated into a completed interior revision.

> [Image #1] this is what the stairs look like in house red.
> I'm not sure about the dimensions, but it looks like this.
> [Image #2]
>
> [Image #3] Door towards. the "L" hallway. from the stairs.
>
> [Image #4] this is the SAME door but from the other side. The windows on the right are just windows not doors, and they overlook the washingmachine area.
> The view looks like this; [Image #5]
>
> The "R" hallway also has the same overlooking the cinema room.
>
> Work on the internals of house red again and implement.
> THINK DEEP. CALCULATE.

All five original images survived in `/tmp`. Copies and a checksum manifest are retained locally outside this public repository at:

`/home/haunted/Projects/rommelweb-recovery/2026-11-15/photos/`

The recovered conversation summary is retained beside that folder. Raw photographs were not published.

### What the photographs add

- **Photos 1–2:** a descending flight beside a wall, with red tubular/mesh railing and a **level walkway parallel to the flight**, leading toward the far window/door. The flight cannot simply occupy almost the entire enclosure width while that side walkway is omitted.
- **Photo 3:** the resident identifies the glazed red door as the entry toward the **L hallway**, photographed from the stair landing.
- **Photo 4:** the same door from the L hallway. The tall wired glazing along the right is **windows**, not passage doors.
- **Photo 5:** the glazing overlooks the laundry/drying area at a lower elevation, with timber roof structure and a skylight. This establishes a tall common-space volume adjacent to the upper hall.
- **Resident statement:** an analogous R-hall overlook is above the cinema. No supplied photo is explicitly an R-hall view.

The photos do not establish metric dimensions, a complete stair arrangement on all storeys, exact doorway endpoints, or which original excluded polygon corresponds to each common-space volume. They support a geometric revision, but first require registration to the plan.

**New confirmation in this recovery chat:** asked whether L and R each have their own door directly onto the same top-floor stair landing, the resident answered **“Yes—one door to L, one to R.”** This resolves the connection topology. Both hallway-to-landing connections are confirmed; the saved model still represents only the L entry. Exact positions, widths and swings remain unmeasured.

## 5. Independent mathematical reconstruction

Reproduce with Python's standard library:

```sh
python scripts/audit-house55-recovery.py \
  --repo . \
  --output docs/data/house55-recovery-audit.json
```

The script verifies the active stage and frozen baseline hash, reads the saved polygons, independently reconstructs internal envelopes from half-planes, triangulates polygons, checks overlaps and containment, and computes area, stair and sensitivity results. It does not import the app's polygon implementation. The [JSON audit](data/house55-recovery-audit.json) records input SHA-256 values and both full floating-point and rounded results.

### Coordinates and perimeter assumptions

Campus X/Z metres are rotated into the retained plan axes:

```text
u =  0.6759509953 x + 0.7369465733 z
v = -0.7369465733 x + 0.6759509953 z
```

This is an orthonormal rotation through **47.47195594°**, with determinant 1 and no scale multiplier.

For an inward unit boundary normal `n`, boundary constant `c`, and chosen allowance `t`, the internal envelope retains:

```text
n · [u,v] ≥ c + t
```

Intersect these half-planes, then compute polygon area by the shoelace formula:

```text
A = ½ |Σ (uᵢ vᵢ₊₁ − uᵢ₊₁ vᵢ)|
```

Allowances are **0.20 m ordinary exterior**, **0.30 m four marked outside ends**, and **0.10 m per room at allocation boundaries**. Unknown bathroom/kitchen partition footprints are not deducted.

### Saved conditional room dimensions — before measured stair reconciliation

The dimensions below are bounding extents in the study axes after those allowances. Slightly skewed polygons need not have exactly the rectangular area `width × depth`. These are calculated candidate envelopes, not measured wall-face dimensions. At least the central placement must change to accommodate the now-measured 2.72 m staircase; do not present this table as a corrected final layout.

| Bank | Approximate internal width × full depth | Conditional area per room |
| --- | --- | --- |
| A–D | 2.741–2.747 × 5.978–5.989 m | 16.400 m² |
| W1–W4 | 2.752–2.757 × 5.964–5.972 m | 16.400 m² |
| E–G | 2.779–2.781 × 5.901–5.906 m | 16.400 m² |
| L1–L3 | 2.744 × 5.982–5.987 m | 16.407 / 16.400 / 16.393 m² |
| R1–R3 | 2.796–2.800 × 5.752–5.757 m | 16.068 / 16.076 / 16.083 m² |
| N1–N3 | 2.889–2.895 × 5.672–5.684 m | 16.400 m² |

E/W rooms run across the other study axis; their width is the bay direction and depth the long room direction. The audit includes each complete polygon and coordinate bounds.

The **2.70 × 3.30 m published sketch is a living zone**, with entrance, bathroom and kitchenette outside that rectangle. It cannot be used as the full apartment footprint.

### Area conservation

| Current core allocation | Gross polygon area |
| --- | ---: |
| Twenty room envelopes | 374.616433 m² |
| West hall | 59.653161 m² |
| East hall | 59.446948 m² |
| Stair enclosure | 13.977191 m² |
| Unassigned strip/pocket | 2.922438 m² |
| **Sum** | **510.616171 m²** |
| **Independently intersected annotated core** | **510.616159 m²** |

The difference is approximately **0.0000124 m²**, consistent with numerical serialization/clipping residue. This checks the candidate's accounting; it does not measure reality.

Three different areas must remain distinct:

- **637.124358 m²:** raw horizontal shell section, retained from provenance rather than independently resectioned by this new script.
- **561.338565 m²:** saved study plate after the two resident no-floor exclusions.
- **510.616159 m²:** flat-roof registration core intersected with that plate and allocated above.

The remaining **50.722406 m²** between the plate and core lies in outer low-roof strips. It is not additional established habitable apartment area. The complete exterior's approximately **49.338 × 24.150 m** bounding box is yet another quantity, not the floor polygon.

### The 16.4 m² interpretation

The current conditional internal envelopes total:

```text
Σ Ainternal = 327.027422 m²
Mean        = 327.027422 / 20 = 16.351371 m²
Rounded to the operator's displayed precision = 16.4 m²
```

Consequently, R1–R3 being around 16.07–16.08 m² **does not contradict a category average of 16.4 m²**. The category also is not restricted to these twenty rooms. Conversely, matching that rounded average is not validation: the preceding fit deliberately targeted 16.4 for seventeen rooms.

The total difference from twenty exact 16.4 m² envelopes is only **0.972578 m²**. It provides no reason by itself to expand the source building.

### R bank sensitivity

Keep these lengths separate:

```text
Opposite source recess:                    8.989488 m
Aligned candidate extent on façade plane:  8.978521 m
Original exterior edge 6 → 7:              8.079456 m
```

The model's northern connector is **1.50 m gross**, interpreted as **1.20 m** after its declared allowances. Moving the R hall front by approximately **0.115959 m** to force the three-room mean to 16.4 m² would reduce that interpreted connector to **1.084041 m**. Individual depth increases would be approximately 0.118628 / 0.115959 / 0.113291 m.

This conflicts with the model's chosen 1.20 m guard. The guard is a design assumption, not a verified legal requirement. More importantly, there is no measured per-room 16.4 m² constraint to justify the operation.

### Stairs: what the algebra establishes

Current inferred enclosure width is **1.780710 m**, split:

```text
L3 side: 0.445178 m = 25%
R1 side: 1.335532 m = 75%
```

Holding the L3 side fixed and shrinking only the R1 side by `δ > 0` gives:

```text
L3 fraction = 0.4451775 / (1.7807095 − δ) > 25%
```

Thus that operation cannot reduce the L3 share toward 20%. The prior implementation instead inset the **symbolic flight** by 0.10 m on each side, producing **1.580710 m** and **21.8369% / 78.1631%**. It preserved the enclosure rather than implementing a right-wall shrink.

The recovered photos add a different requirement: explicitly allocate a parallel walkway, railing and stair flight. A suitable cross-section equation is:

```text
enclosure width =
left wall allowance + stair clear width + rail/separation
+ parallel walkway clear width + right wall allowance
```

The current 1.580710 m flight inside a 1.780710 m enclosure leaves only **0.20 m total outside the flight**. It does not represent the photographed side walkway. This identifies a schematic-model deficiency; it does not tell us which inferred enclosure boundary should move.

The neighboring **0.290–0.292 m gross strip** remains unassigned. It cannot be silently relabeled as the missing passage.

### Vertical consistency

The current equal-storey approximation places the top floor at:

```text
Yfloor = 2.822 + 2 × 9.491 / 3 = 9.149333 m
Yflat exterior roof = 11.401 m
Separation = 2.251667 m
```

This is before roof/slab construction is deducted. It cannot simultaneously support a literal **2.50 m clear ceiling** at that same flat-roof location. The sketch's height is unassigned and the floor plane is provisional: this is an incompatible pair of assumptions, not evidence that the real building has a height fault.

Use actual floor-to-floor/landing elevations and clear ceiling heights before revising the vertical model. Do not divide the exterior maximum height into three and call the resulting planes measured storeys.

## 6. Why the real plan is not uniquely solved yet

Six banks with confirmed counts give fourteen possible internal divider positions and six possible hallway fronts in a simplified initial parameterization. These are **not twenty remaining degrees of freedom** after existing alignment, slope and equality constraints. A residual rank calculation requires an explicit parameter vector and independent constraint Jacobian.

The current solution is selected partly by priors: equal interpolated bays, assumed wall offsets, borrowed area targets and earlier screenshot interpretations. These do not become independent measurements because a solver satisfies them.

For subsequent refinement, use a constraint model:

```text
θ = wall faces, divider positions, openings, floor heights,
    stair/landing boundaries and void geometry

minimize Σ [(predicted measurementᵢ(θ) − observedᵢ) / σᵢ]²
```

Only use `σᵢ` where measurement uncertainty is actually known; do not invent statistical confidence for hand marks. Treat confirmed counts/adjacencies as discrete constraints, distinguish them from geometric priors, preserve exterior source geometry, and retain competing hypotheses where evidence does not determine one solution.

## 7. Next work, in dependency order

1. **Register the new photo evidence.** Associate L glazing/laundry and R glazing/cinema with plan edges and actual vertical voids. Do not create passage doors through glazing.
2. **Implement the now-confirmed stair/hall topology with photo registration.** The saved graph connects A–D, W1–W4 and L1–L3 to the recorded stair door: eleven rooms. E–G, R1–R3 and N1–N3 form a nine-room component without a modeled stair entry. The resident has now confirmed a separate R door directly onto the same landing. Its endpoint geometry must be reconciled with the photographed walkway; do not invent access through the narrow residual strip.
3. **Measure the stair cross-section and elevations.** Enclosure wall-to-wall width, flight clear width, railing width, side walkway, end landings, complete riser count and floor-to-floor height provide high-value independent constraints.
4. **Measure one identified R apartment and one L apartment.** Record full entrance-to-window depth, clear width, kitchenette/bathroom outline and wall-face convention. Then cumulative divider/door positions along the other banks.
5. **Refit House 55 with those independent constraints.** Review its plan and a vertical section together, including common-space voids. Keep a source/observation/assumption label on every parameter.
6. **Strengthen approved-plan validation before promotion.** Add whole-floor containment, overlap, physical wall/door geometry and vertical connectivity. Promote only the measured portions; then revisit extrapolated floors.

The resident's explicit confirmation of the two landing doors supersedes the earlier “east connection unknown” wording in historical documentation. It does not determine a door's metric position or verify the extrapolated floors.

## 8. Validation and limits of this recovery

- Remote and local `main` identity checked directly.
- Independent numerical reconstruction passed; area, internal-envelope containment, overlap and source-hash checks passed.
- Full existing test suite passed: **28 test files**, zero failures.
- Production build and outdoor path-cache check passed. The existing bundle-size advisory remains.
- Five original new photographs inspected and preserved locally.
- No new browser regression run, survey, physical room-number assignment, app geometry edit or publication is claimed.

The recovery restores the prior decisions and the precise unfinished work. The defensible current result is a dimensioned, internally consistent **candidate** plus a now-clear list of physical facts needed to turn House Red into a verified reference floor.
