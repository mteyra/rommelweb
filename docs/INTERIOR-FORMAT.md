# Approved interior geometry format

`public/data/interiors.json` is intentionally empty: no interior geometry has been approved as a measured plan. The separate `public/data/interior-studies.json` contains a clearly labeled, unmeasured House 55 study with sketch-following and estimated cells. Neither dataset assigns residents, and the study has no physical room numbers. The adapter lets approved plans be added later without replacing the public exterior model.

The first chosen interior pilot is **older Red House 55 in Campus Süd I, second floor (2. OG / index 2)**, following the user's selections. House 55 uses the resident house/wing labels 1 & 2; it is not newer house 55a. The user's annotated screenshot now supports a [resident-sketch study](HOUSE55-INTERIOR-STUDY.md), while the [public-source review](INTERIOR-PLAN-EVIDENCE.md#first-interior-pilot-red-house-55) found no usable current whole-floor plan. Estimates stay in the study layer until measurements and review establish approved geometry.

The complete **approved** dataset currently is:

```json
{
  "schemaVersion": 1,
  "buildings": {}
}
```

Use `validateInteriorData(interiors, campus, lod2)` after loading all three datasets. It returns `true` or throws an error naming the invalid field. Only render interior geometry after successful validation. `getInteriorLevel(interiors, house, index)` returns the approved level record or `null`; it is a lookup helper, not a substitute for validation.

## Separate unmeasured study format

`src/interior-studies.js` validates `interior-studies.json` independently with `validateInteriorStudies(studies, campus, lod2)`. It is not an alternate way to mark a plan approved. `getDisplayLevel(interiors, studies, house, index)` returns an approved level first, otherwise an available study marked `isStudy: true`. The study format has no `approved` or `elevation` field and cannot influence the approved floor-height anchors.

The current study covers only **House 55 / index 2**: seven sketch-divided bays plus twelve estimated bays, an approximate central stair and a potential corridor. Its displayed floor omits the two green-marked absent areas. All room openings and the stair-access gap are estimated; no hinges or swings are supplied. The **19 candidate bays** do not establish a current room count, and the source map's 20 markers remain an unresolved cross-check.

The study's `schemaVersion: 1` envelope contains `buildings`, with a source and levels for each house. Levels carry their index, label, source/notes, `floorOutline`, optional `excludedAreas` and `sketchBoundaries`, spaces and doors. `sketchBoundaries` retains source-following line segments for the evidence display. Spaces use `confidence: "sketch"` or `"estimated"`; “sketch” describes correspondence to the resident mark, not measured coordinates. Temporary IDs/labels must not be presented as actual room numbers. Study polygons may include holes, unlike the approved version-1 space format below. Door segments still refer to a space boundary, and any `toSpaceId` must share the complete boundary.

Spaces can supply an optional plain `shortLabel` of up to 16 characters for compact map markers. The full label and confidence remain in the accessible name and popup. Study validation rejects overlapping spaces, floor-filled exclusion zones, spaces covering floor holes, and holes crossing their own outer boundary. Shared edges and a corridor surrounding a separate stair polygon are supported. Rounded study door endpoints allow 2 mm of collinearity tolerance; approved geometry retains its stricter tolerance.

The renderer distinguishes estimated walls with dashed strokes and shows source/evidence notes in floor details and selection dialogs. Study dialogs offer correction suggestions without resident-card placeholders. The corridor is a geometry hypothesis, not an approved route; displayed stair treads are symbolic. A validated study is structurally accepted data, not proof of its real-world layout.

`studyFloorSection` substitutes the study's displayed outline for that floor only. The official LoD2 geometry and provisional elevation remain intact. Other floors retain their original sections. See [HOUSE55-INTERIOR-STUDY.md](HOUSE55-INTERIOR-STUDY.md) for screenshot registration, uncertainty and reproduction notes.

## Partial floor elevations

`getLevelElevations(interiors, house, count, officialHeight)` returns one elevation per above-ground floor, in index order, relative to the building base. Call it only after full interior-data validation. Approved floor elevations are exact anchors. Every unknown floor guide is linearly interpolated between its nearest anchors; the default lower anchor is floor 0 at 0 m, and the terminal anchor is index `count` at the official model height. A verified floor-0 elevation replaces the default lower anchor. The terminal height is an interpolation boundary, not another floor or a measured ceiling height.

This prevents an approved high or low floor elevation from overlapping a neighbouring guide generated by a separate equal-spacing rule. For example, in a six-storey model with height 18 m and an approved floor 2 at 7 m, the guides become `[0, 3.5, 7, 9.75, 12.5, 15.25]`. Only the 7 m anchor is approved measured floor information; interpolated values remain **illustrative guides**. With no approved anchors the result is uniform spacing. Unapproved entries do not influence the result. Adding a later approved floor updates only the surrounding interpolation intervals and leaves existing approved elevations intact.

The helper validates positive floor count/official height and rejects contradictory anchors. It does not modify the input or mark interpolated guides as verified. The renderer must keep approved floor geometry and illustrative guides visibly distinguishable, especially under the old houses' sloped roofs where a roof-height interpolation is not a ceiling model. A typical-room sketch's approximately 2.50 m clear ceiling height also cannot supply floor-to-floor spacing; see [OLD-BUILDING-SECTIONS.md](OLD-BUILDING-SECTIONS.md).

## Exterior sections and approved interior space

The unfolded study now uses `floorSection` in `src/sections.js` to cut thin horizontal sections through the official LoD2 shell at the resulting elevations. The source contour can shrink, contain holes or split into separate parts at upper levels. The renderer no longer repeats the entire ground footprint as a volume on every floor.

These sections describe the exterior at a selected height. They do **not** classify enclosed areas as occupied rooms, calculate usable headroom or establish a ceiling. Even at an approved floor elevation, the shell section remains distinct from the floor's approved `spaces` polygons. Roof voids and room boundaries must come from the reviewed interior source, not from the outline's appearance.

Ground-level contour sampling may move a few millimetres inside the source shell to account for rounded vertices. The displayed plane and approved floor elevation remain unchanged; sample metadata records the numerical offset. It does not alter the geometry submitted in this file. See [GEOMETRY.md](GEOMETRY.md) for the section method.

## Entry structure

`buildings` is an object keyed by exact street number, such as `"55"` or `"57a"`. Every entry requires:

| Field | Meaning |
| --- | --- |
| `approved` | Must be `true` to appear in `interiors.json`. Unapproved drafts cannot enter this asset; explicitly labeled studies use the separate format described above. |
| `source` | Nonempty public source citation or approved plan reference. Do not embed secret download URLs, names or private correspondence. |
| `reviewedAt` | Real completed review date, `YYYY-MM-DD`, not a future date. |
| `reusePermission` | Nonempty explanation of the permission or licence covering reuse and public display of this geometry. The field records a decision; it does not obtain permission. |
| `levels` | At least one approved level. Partial coverage is allowed; omit floors not yet verified. |

Each level requires `index`, `label`, `elevation`, `source`, `reviewedAt` and `spaces`. Index zero is the ground floor. Index must be a whole number within the house's mapped above-ground storey count. Basement data needs a deliberate later schema extension; it cannot be inserted as a negative floor silently.

`elevation` is the floor's **verified height in metres above that building's source base**, not the campus datum and not a uniform-height guess. It must be nonnegative, below the official exterior height and increase with floor index. To obtain world y, add the official building's `baseY` from `lod2.json`. Source and review are recorded per floor because plan sheets can have different provenance.

Every space requires:

| Field | Meaning |
| --- | --- |
| `id` | Stable 1–80 character identifier; globally unique across this dataset. Letters, numbers, dots, underscores, colons and hyphens are accepted. Do not encode a person's identity. |
| `label` | Short plain display text for the physical space. An approved room number can be used here. No resident names, occupancy or contact information. |
| `kind` | One of `room`, `corridor`, `stairs`, `lift`, `shared`, `service`. |
| `polygon` | Simple closed ring of `[campus-local-x, campus-local-z]` positions in metres. At least three distinct vertices followed by a repetition of the first vertex. |

Coordinates use the same horizontal system as the exterior model: origin latitude 49.5766 / longitude 11.0298; x points east and z south. See [GEOMETRY.md](GEOMETRY.md). Polygon points do not include height; the parent floor provides elevation. Open rings, crossings, non-finite coordinates, zero area, zero-length edges and implausibly large local coordinates (for example unconverted UTM values) are rejected. Longitude/latitude values can numerically resemble local metres, so source-coordinate conversion and placement still require review. Polygon holes are not supported by version 1; split complex spaces into meaningful simple geometry or extend the schema deliberately.

Validation checks structural/geometric consistency. It **does not prove** that a submitted layout matches the building, a source grants permission, or text is free of personal information. A human must compare approved polygons against plans, verify floor heights, check their placement within the correct building and review every public field. The shape-field allowlist prevents accidental resident/contact/occupancy columns from being published, but ordinary strings still need review.

## Door geometry and interaction

A level may also contain `doors`. Omit the array when door positions have not been verified. Each door has:

| Field | Meaning |
| --- | --- |
| `id` | Stable geometry ID, unique across all doors and spaces. |
| `label` | Physical opening label, with no resident or occupancy information. |
| `spaceId` | The physical space this door serves, on the same floor. |
| `segment` | Two `[x, z]` endpoints describing the closed opening, on one boundary edge of that space. Accepted width is 0.4–3 m. |
| `toSpaceId` | Optional adjoining space on this floor. If given, it must share the complete opening boundary. |
| `hinge`, `swing` | Optional pair: `hinge` is `start` or `end`; `swing` is `left` or `right` from the hinge toward the other closed-leaf endpoint. In the plan, x is east and z south. Omit both when the source does not identify the swing. |

`toSpaceId` describes shared partition-line topology. Use it only when both submitted space polygons genuinely share that line. Clear-room polygons separated by wall thickness do not meet this condition: preserve their source coordinates and omit the adjacency until a thickness/threshold model is added. Do not silently snap room outlines together or interpret partition-line polygons as clear floor-area measurements.

The renderer draws approved space outlines as a low **1.05 m display cutaway**, with room/corridor floor tint, wall returns, door gaps and—when specified—door-swing arcs. This cut height supports inspection; it is not a measured ceiling or partition height. Door openings are removed from both adjacent drawn wall edges.

Unfolding isolates a house and shows its floor stack. Selecting a floor hides its siblings and moves to a nearly overhead view. Approved room and door targets then support pointer and keyboard selection. The popup identifies the physical space and its plan source; resident profiles and knocking are placeholders for the future authenticated service. Nothing is sent, and no resident is inferred from a room number.

No measured floor plans are currently approved. House 55 / 2. OG displays the separate resident-sketch study; other floors without approved or study records display the source-envelope section with an explicit missing-plan note. See [INTERIOR-PLAN-EVIDENCE.md](INTERIOR-PLAN-EVIDENCE.md) for the plan search and required evidence.

## Fictional template only

The following illustrates structure. Its coordinates and identifier are synthetic, its source fields are blank and `approved` is false. **It intentionally fails validation and must never be displayed as a real room.** Although house 55 is now the chosen pilot, the example's floor 0 and rectangle are not a selected floor or evidence about that house. Replace every example value with verified, permission-cleared material before adding an entry to the public dataset.

```json
{
  "schemaVersion": 1,
  "buildings": {
    "55": {
      "approved": false,
      "source": "",
      "reviewedAt": "",
      "reusePermission": "",
      "levels": [
        {
          "index": 0,
          "label": "Example floor — fictional",
          "elevation": 0,
          "source": "",
          "reviewedAt": "",
          "spaces": [
            {
              "id": "example-only-space-01",
              "label": "Example space — fictional",
              "kind": "room",
              "polygon": [[0, 0], [4, 0], [4, 3], [0, 3], [0, 0]]
            }
          ]
        }
      ]
    }
  }
}
```

## Review and publication

1. Obtain a plan that may be reused publicly. Remove names, signatures, access codes, alarms/security details and occupancy annotations before any repository upload.
2. Identify the exact house and floor. Georeference its plan to the official exterior, check scale, orientation, common reference points and actual floor elevation.
3. Trace physical spaces and assign stable nonpersonal IDs. Keep label/room-number evidence alongside the approved source reference.
4. Review geometry and reuse permission; fill source and completed review dates. Publish only the necessary physical-space fields.
5. Run `npm test` and inspect each newly added floor visually before deploying.

Public access to the repository and Pages demo is authorized. Treat source files, Git history and deployed assets as public: they must contain no private resident data, invitation secrets or credentials. Access to a resident's profile, tenancy, room association, contact details or messages must never be expressed by adding fields to this file. That information belongs in the separate authenticated backend described in [ARCHITECTURE.md](ARCHITECTURE.md).
