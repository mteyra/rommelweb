# Resident-assisted validation

Status: **proposed collaboration workflow** · 14 November 2026

The campus model should improve through evidence, one building at a time. This guide is for correcting architecture and wayfinding. It is not an invitation to collect or publish residents' names, occupancy, phone numbers or private WhatsApp links.

## What is already grounded

The [public Rommelwood map](https://rommelwood.de/map/) identifies these eleven structures:

| Campus Süd I | Campus Süd II |
|---|---|
| 51 — yellow | 49 — black / house 11 |
| 53 — orange | 53a — purple / house 12 |
| 55 — red | 55a — gray / house 13 |
| 57 — white | 57a — turquoise / house 14 |
| 59 — green | 59a — pink / house 15 |
| — | 51a — blue / house 16, community hub |

The public map also provides room markers. A marker means a source placed a label at a point and level. It does not establish the four walls of a room. No reuse license for that custom database has been established, so the public starter publishes aggregate metadata only, with no individual room records. The source's floor naming may differ from the labels residents use, so ground-floor and basement conventions need checking.

House 51a's communal use is confirmed. The [official planning account](https://www.werkswelt.de/?post=neubau-einer-wohnanlage-am-erlanger-suedcampus) describes group apartments above its communal ground floor; its current residential arrangement still needs validation. Do not treat the community label as proof that nobody lives there.

Public facility pages identify the cinema with house 55, the bike workshop with house 57 on the forest side, and the garden behind house 59. The model should preserve uncertainty about precise entrances, boundaries and access arrangements.

The architect's [Campus Süd II project page](https://www.karlundp.de/projekt/wohnanlage-fuer-studierende-erlangen/) supplies general building information. General project dimensions and storey ranges are not evidence that every building has the same height or internal layout.

The exterior baseline now comes from [Bavaria's official LoD2-BY dataset](https://geodaten.bayern.de/opengeodata/OpenDataDetail.html?pn=lod2): all eleven address-matched houses have source wall, roof and ground polygons. This gives us a stronger starting point than a footprint extrusion. LoD2 remains a standardized exterior model; it does not establish windows, doors, interior rooms or exact floor elevations. The exploded level study uses uniform floor intervals, which residents and approved plans can help replace with verified elevations. See [GEOMETRY.md](GEOMETRY.md) for dates, source checksums, transformations and accuracy limits.

## The first useful contribution

Pick a building you know well. The most useful initial package is:

1. Its address and the house/color name residents actually use.
2. A count of occupied above-ground levels, with the exact displayed names: for example `EG`, `1. OG`, and so on.
3. Basement, split-level and roof information listed separately.
4. Entrances marked on a simple orientation sketch, including a north arrow or an obvious campus landmark.
5. Whether the room markers in the original source belong to the right floor and roughly the right side of the building; their republication needs separate permission.
6. A permitted plan or a simple dimensioned sketch for one representative level.

A rough sketch with two measured dimensions is more useful than an attractive drawing with an uncertain scale. If a dimension is a guess, say so. If different floors differ, describe the exception instead of marking every floor identical.

## Evidence collection rules

- Use plans you are entitled to share and record who permits their reuse. Public visibility alone does not settle copyright or republishing permission.
- Remove personal names, occupancy annotations, contact details, keys/access codes, private group links and unrelated information before sharing a plan.
- Do not upload leases, ID documents or an administrator's resident list.
- Photos should focus on architecture. Avoid identifiable residents, visible room interiors and personal notices.
- Do not enter restricted spaces, use prohibited roof access or conduct intrusive measurements to validate the model.
- Dimensions can come from approved drawings or ordinary permitted observations. Record units and the measuring method.
- Distinguish a publicly usable asset from a plan approved only for the eventual resident area.

The current public repository and GitHub Pages build are public publication surfaces. Sensitive or restricted plans must not be attached to public GitHub issues or commits. A protected submission channel must exist before receiving them. Descriptive corrections without private material can use a repository issue.

## Validation record

Use this structure for each contribution. Keep unresolved fields explicitly unknown.

```yaml
building_address: "Erwin-Rommel-Straße 55"
building_label: "Red house"
subject: "Floor labels and east entrance"
observed_at: "YYYY-MM-DD"
submitted_by_display_name: "Optional display name"
source_type: "resident_observation" # or approved_plan / measured / public_source
source_url: null
reuse_permission: "Describe owner permission or source license"
publication_scope: "public" # or resident_only / not_for_publication
orientation_reference: "North arrow / named street or landmark"
units: "metres"
claims:
  - field: "level_labels"
    value: [] # Exact labels; leave empty until known
    confidence: "unknown"
  - field: "entrance_position"
    value: null
    confidence: "unknown"
dimensions: []
exceptions: []
personal_data_removed: true
review_status: "submitted"
```

Do not place a real person's private contact information in this record. A display name is attribution only, not proof that a claim is correct.

## Review and model update

1. **Register:** record the contribution, source, reuse terms and observation date.
2. **Classify:** separate footprint, height, level count, room labels, room geometry, entrance and facility claims.
3. **Cross-check:** compare with the existing map and official/project sources; seek a second knowledgeable reviewer for major structural corrections.
4. **Measure agreement:** check orientation, units, known dimensions, address alignment and common control points. Never force a plan to fit by stretching it independently in two directions without recording that distortion.
5. **Resolve conflicts:** retain both claims and mark the disputed component uncertain until stronger evidence exists.
6. **Stage:** produce a preview and a before/after comparison. Preserve stable IDs when only geometry or labels change.
7. **Approve:** a geometry maintainer records what was accepted, by whom and why.
8. **Publish:** publish only data approved for that audience, with updated provenance and accuracy labels.

Architectural review is separate from residency verification. A useful map correction does not grant resident access or stewardship.

### Geometry completion levels

| Level | Model can honestly show | Evidence needed |
|---|---|---|
| A — site | Relative location and sourced footprint | Attributed geospatial source; official LoD2 supplied for all eleven |
| B — envelope | Official standard-form height, roof and wall surfaces | LoD2 baseline supplied; detailed/current condition still needs validation |
| C — levels | Correct floor labels and elevation separation | Per-building level verification |
| D — markers | Sourced room/facility labels at approximate positions | Validated marker source and floor assignment |
| E — plan | Room/corridor polygons, stairs and common spaces | Scaled, reusable plan or validated measurements |
| F — maintained twin | Versioned corrections after renovations | Named maintainer and periodic review |

These levels need not advance together. A building can have reliable room labels and an estimated roof height. Its interface should say both.

## Questions to settle with residents

- Does each address have one entrance or several separately named entrances?
- Which exact labels are used for ground floor, basement, mezzanines and upper floors?
- Which source room labels are outdated, missing or assigned to the wrong level?
- Are the repeating floors truly identical? Which floors or wings are exceptions?
- What are the approximate floor-to-floor heights, and how were they measured?
- Where are the cinema entrance, bike workshop entrance, shared rooms and accessible approaches?
- Is the community building numbered 51a / house 16 in day-to-day use as well as on the source map?
- Which clubs are still active, where do they meet, and who has agreed to maintain each description?
- Which building/club notices and events may be publicly visible?
- Who will take responsibility for membership approval, moderation and WhatsApp offboarding during the pilot?

Do not request real group invitation URLs until protected server storage and the enrollment workflow are operational.

## Pilot readiness

Before enrolling residents, agree on a named operator, at least two trained stewards, the verification method, membership renewal, a moderation contact and administrator handover. Use test accounts first.

The pilot must demonstrate that expiry, revocation and moves between buildings remove old access immediately; direct API calls obey the same rules as the UI; private group links do not leak into builds or logs; and blocked/hidden residents cannot be enumerated.

Run one deliberate correction through the geometry review workflow and one event through draft, edit conflict, publication and cancellation. A resident should be able to opt out of discovery, request their data and leave the service. Only then expand beyond the first building.

The detailed technical plan and acceptance checks are in [ARCHITECTURE.md](ARCHITECTURE.md).
