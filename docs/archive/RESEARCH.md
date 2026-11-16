# Rommelweb: location research and evidence register

Research date: 14 November 2026. This is an independent community project for Campus Süd I and II in Erlangen, beside FAU's southern campus. The accommodation is operated by **Studierendenwerk Erlangen-Nürnberg**; Rommelwood e.V. is the existing resident association. Nothing in this project implies either organization has approved it.

## Established campus identity

The operator identifies Campus Süd I as Erwin-Rommel-Straße **51–59** and Campus Süd II as **49, 51a–59a**, 91058 Erlangen. These are interwoven parts of one residential site, not separate distant campuses. The resident association describes eleven houses.

Primary sources:

- [Studierendenwerk: Campus Süd I](https://www.werkswelt.de/index.php?id=wohnanlage-campus-sud-i)
- [Studierendenwerk: Campus Süd II](https://www.werkswelt.de/index.php?id=wohnanlage-campus-sued-ii)
- [Rommelwood: living at the dormitory](https://rommelwood.de/Wohnen/)
- [Rommelwood: public orientation map](https://rommelwood.de/map/)

The operator lists 285 single apartments and 27 two-room double apartments for Süd I. Süd II has 370 standard and two accessible single apartments, plus 38 places in ten group apartments. These imply 339 + 410 = 749 places. The association also reports 749. DAAD's separate directory reports 342 and 412; those figures disagree with the detailed primary-source breakdown. Use **eleven houses** as the stable headline rather than an apparently live resident count. Capacity does not indicate current occupancy or the number of registered users.

## House identification

House colors and the modern internal building numbers below are copied as factual labels from the public Rommelwood map. Coordinates are its **house markers**, not cadastral centroids. The website uses official Bavarian LoD2 ground, wall and roof polygons for building geometry; the OpenStreetMap footprints remain a separate reference and crosscheck.

| Address suffix | Campus | Resident color label | Internal building number | Public house marker (latitude, longitude) |
| --- | --- | --- | --- | --- |
| 49 | II | Schwarzes Haus / Black | 11 | 49.5772900, 11.0286800 |
| 51 | I | Gelbes Haus / Yellow | — | 49.5767040, 11.0292571 |
| 51a | II | Blaues Haus / Blue | 16 | 49.5764100, 11.0293000 |
| 53 | I | Oranges Haus / Orange | — | 49.5769648, 11.0294919 |
| 53a | II | Lila Haus / Purple | 12 | 49.5772200, 11.0301200 |
| 55 | I | Rotes Haus / Red | — | 49.5764409, 11.0297901 |
| 55a | II | Graues Haus / Gray | 13 | 49.5768800, 11.0301300 |
| 57 | I | Weißes Haus / White | — | 49.5762957, 11.0301632 |
| 57a | II | Türkises Haus / Turquoise | 14 | 49.5766800, 11.0308500 |
| 59 | I | Grünes Haus / Green | — | 49.5760585, 11.0299483 |
| 59a | II | Pinkes Haus / Pink | 15 | 49.5762000, 11.0307400 |

Older room numbers contain internal prefixes 1/2 at address 55, 3/4 at 57, 5/6 at 59, 7/8 at 51, and 9/10 at 53. Do not confuse these prefixes with postal addresses. The displayed building selector should use the postal suffix, with internal number as secondary information.

## What is known about the architecture

[karlundp's completed project page](https://www.karlundp.de/projekt/wohnanlage-fuer-studierende-erlangen/) describes six newer volumes of approximately 23 × 23 metres, varying from three to eight storeys, rotated relative to the older buildings. The central community building has three storeys. The newer buildings have no basements. Residential upper floors are described as nearly identical, with varying loggia positions and external safety staircases. Their ground levels combine shared, service and residential uses.

This establishes the broad form but is **not** a dimensioned as-built model. Floor-to-floor height, façade panels, stair treads, loggia dimensions and internal walls still need measured or approved plans.

The exterior baseline is now [Bayerische Vermessungsverwaltung LoD2-BY](https://geodaten.bayern.de/opengeodata/OpenDataDetail.html?pn=lod2), under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). All eleven houses were matched by explicit street address in tile `LoD2_32_646_5492_2_BY`. Its 289 wall, roof and ground surface polygons and individual height attributes drive the rendered exteriors. LoD2 standardizes exterior forms and does not establish detailed façades, current interior layouts or exact floor elevations. The exploded levels use OSM storey counts and uniform vertical intervals. [GEOMETRY.md](GEOMETRY.md) records the retained source subset, checksums, transformations and per-building source dates.

Related references:

- [Bavarian Chamber of Architects project record](https://www.byak.de/planen-und-bauen/projekt/studentenwohnanlage-campus-sued-erlangen.html): six cubic buildings, architect karlundp, April 2017 completion entry.
- [Architect's inauguration report](https://www.karlundp.de/einweihung-wohnanlage-erlangen/): inauguration on 23 May 2018 and explicit addresses 49/51a/53a/55a/57a/59a.
- [FAU opening report, April 2017](https://www.fau.de/2017/04/news/studium/wohnanlage-campus-sued-feierlich-eroeffnet/).

The dates describe different milestones in a phased project. Do not collapse them into a single unsupported completion claim.

## Room index: useful facts, unreliable physical positions

The public orientation map embeds room labels, explicit `Stockwerk` floor numbers, postal addresses and latitude/longitude points. The research tool in [scripts/extract-room-markers.py](../../scripts/extract-room-markers.py) inspects those fields only, does not execute source JavaScript, and excludes an unrelated off-campus entry.

**The public starter does not redistribute the individual source room records.** [public/data/room-markers.json](../../public/data/room-markers.json) contains aggregate research metadata and an empty `markers` array. A complete room index requires approved source reuse or an independently verified resident contribution. This does not block exterior browsing, floor exploration or contribution exports.

The script exports metadata only by default. `--acknowledge-permission` enables individual-record export after the operator has established appropriate reuse permission; the flag is an acknowledgement, not a grant of rights. Source-coordinate exports still cannot be treated as validated room geometry.

**703 public campus room markers** were observed. They contain no resident identities, occupancy, contact details or access credentials.

| House | Room markers | Explicit floors in public map | Marker count per floor |
| --- | ---: | --- | --- |
| 49 | 70 | 1–5 | 14 on each |
| 51 | 71 | 0, 1, 2 | 25, 25, 21 |
| 51a | 0 | No room data | Unknown |
| 53 | 68 | 0, 1, 2 | 24, 24, 20 |
| 53a | 56 | 1–4 | 14 on each |
| 55 | 68 | 0, 1, 2 | 24, 24, 20 |
| 55a | 70 | 1–5 | 14 on each |
| 57 | 68 | 0, 1, 2 | 24, 24, 20 |
| 57a | 98 | 1–7 | 14 on each |
| 59 | 64 | 0, 1, 2 | 20, 24, 20 |
| 59a | 70 | 1–5 | 14 on each |

`Stockwerk 0` is the ground level in the older houses. Newer houses' public room markers start at 1; this does **not** establish that their ground levels have no rooms. Source marker coverage omits rooms and does not equal total capacity. There is no basis to generate missing room labels or residents.

A point-in-polygon crosscheck against the retrieved OSM building footprints put **247 of 703 room markers outside their corresponding footprint**. Out-of-polygon counts were 51: 37; 53: 44; 53a: 29; 55: 51; 57: 21; 57a: 19; 59: 46. The remaining houses' markers were inside. Neither OSM nor the source points are a survey, so this diagnoses disagreement, not which source is wrong.

**Implementation consequence:** the current public website shows floor exploration and a contribution path for an approved room index. It does not claim to deploy the observed 703 individual labels. Once approved and verified, room labels can populate a floor-specific index. Do not infer walls, door positions, unit sizes, accessibility, corridors or exact neighbour relationships from the research coordinates. An exploded floor slab with an approved room list is honest; a generated apartment plan presented as real is not.

The research establishes no occupant-to-room mapping. The website should never suggest an empty public marker means a vacant room.

## Community anchors already supported by evidence

| Community or service | Publicly described location | Source and limit |
| --- | --- | --- |
| Rommelkino / cinema team | Common room in Red House, address 55 | [Cinema page](https://rommelwood.de/rommelkino/). Describes screenings during lecture term and association membership requirement. A recurring description is not a verified upcoming event. |
| Bicycle workshop / bicycle team | Forest side of White House, address 57 | [Workshop page](https://rommelwood.de/fahrradwerkstatt/). A repair workshop is confirmed; no assumption of a separate cycling club. |
| Garden team | Behind Green House, address 59 | [Garden page](https://rommelwood.de/garten/). Specific beds and entrances need confirmation. |
| Community room / language café | Address 51a | [Studierendenwerk language café](https://www.werkswelt.de/index.php?id=sprachcafe&setlang=en). A shared venue is established; calendar should refer to the current organizer. |
| Dönerteria, formerly SÜDBlick | Address 51a | [Operator announcement](https://www.werkswelt.de/?post=neues-konzept-im-suden-donerteria-offnet). New concept opened May 2026. Older dorm pages still call it SÜDBlick. |
| Network team mailbox | Gray House, address 55a | [Association membership page](https://rommelwood.de/beitritt/). Public physical onboarding path; it is not permission to integrate with their accounts. |
| Erwin Lakers e.V. | Campus-wide; exact building not established | [Football page](https://rommelwood.de/fussball/). Real group; avoid inventing a headquarters. |
| Bar, sports/games, editorial team | Listed by association; exact placement not verified in this research | [Association homepage](https://rommelwood.de/). Keep them unplaced until confirmed. |

The cinema page references existing **house WhatsApp groups**. Their existence is supported, but no invitation URLs were collected or published. A publicly distributed invitation becomes accessible to anybody who receives it; adding a visual lock on a static website does not protect it.

**51a must not be treated as exclusively nonresidential.** Its community room and catering use are confirmed, but the [operator's original planning report](https://www.werkswelt.de/?post=neubau-einer-wohnanlage-am-erlanger-suedcampus) describes group apartments above the community ground floor. That is planning-stage evidence, not a verified as-built room list. The absence of 51a records from the public map is not evidence that it has no residents. Keep resident membership possible and label its interior inventory as pending.

Some source pages list named keyholders and room numbers. Those personal details were intentionally excluded from this dataset and product. Link to the association's relevant page where appropriate; do not mirror stale personal contact lists.

## Existing community infrastructure

Rommelwood already operates an association website with member accounts, newsletters/groups, events, laundry links and network services. Its public onboarding description uses a signed association form and delivery of initial account credentials to the resident's mailbox. That is evidence of an existing in-person/mailbox verification process, not an authorization to access or reuse its private account database.

The sensible integration path is to collaborate with the association and its network team. Shared verification could prevent residents from maintaining duplicate identities, but requires an agreed interface, responsibilities and lifecycle rules. Do not scrape private members or import personal information from public pages to bootstrap a social graph.

## Accuracy and reuse boundaries

- Official exterior surfaces and height attributes come from LoD2-BY under CC BY 4.0. Credit **Datenquelle: Bayerische Vermessungsverwaltung – www.geodaten.bayern.de**, link the licence and identify the subset and coordinate transformation.
- OSM supplies separately identified reference footprints, storey counts and context. Its data needs OSM attribution plus the applicable ODbL notice; see the campus dataset provenance.
- House metadata and aggregate room-count observations come from the resident map. Individual room records are withheld from the public starter. Original tiles, cartography, photographs, page prose and personal details are not copied.
- No explicit open license for the resident association's custom room database was identified. The map's CC-BY-SA 2.0 reference is in its Leaflet tile attribution beside OSM/RRZE imagery and icon credits; it does not clearly license custom `MAP_DATA`.
- Public GitLab repositories [webteam/rommelwood_bs_theme](https://git.rommelwood.de/webteam/rommelwood_bs_theme/-/blob/master/LICENSE) and [webteam/gallery](https://git.rommelwood.de/webteam/gallery/-/blob/master/LICENSE) use MIT. [documents/infodocs](https://git.rommelwood.de/documents/infodocs/-/blob/master/LICENSE) and [documents/artwork](https://git.rommelwood.de/documents/artwork/-/blob/master/LICENSE) use CC-BY-SA 4.0. Those specific repository licenses do not establish a license for the separately served room database.
- Credit and link sources, and coordinate approved bulk reuse and richer interior data with Rommelwood e.V. Resident-submitted original sketches and verified measurements provide an independent path forward.
- Architectural photographs and drawings are references for understanding, not automatically licensed website assets.
- The first model is a georeferenced official exterior model and floor-exploration framework. It is not a complete as-built BIM or an emergency/navigation plan.
- Building heights use official LoD2 attributes. Uniform floor spacing is an implementation assumption until measured; OSM fallback height estimates must not override the official exterior heights.
- Footprints, floor counts, internal plans, dates and group locations need separate provenance. A confirmed address does not validate all geometry attached to it.

## Highest-value next verification with residents

1. Pick one pilot house and confirm its exact address, floors and entrances.
2. Supply an approved empty floor plan or a sketch without names, access codes or sensitive security details.
3. Verify the room-number order and shared-space labels on one representative floor.
4. Establish which interior information may be public and which belongs behind resident authorization.
5. Confirm current group organizers, approved invitation workflow and resident departure handling.
6. Repeat house by house, keeping measurements and reviewer/date records.

Interior modelling can become accurate incrementally. The data model should permit verified polygons and floor elevations to replace provisional slabs without rewriting the community system.
