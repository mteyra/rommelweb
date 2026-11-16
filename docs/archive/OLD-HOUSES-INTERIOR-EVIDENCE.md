# Older houses: evidence for extending the interior study

Reviewed **15 November 2026** for **Campus Süd I: 51, 53, 55, 57 and 59**. The evidence supports a shared historical complex and related apartment types. It does **not** establish identical floor plans, complete current room inventories, or measured interior geometry across the five houses.

House 55's resident-confirmed counts and relative alignments remain evidence for House 55. A transferred layout is a **template study**, even when it fits another house's exterior well. No source supports a numerical “95% accurate” claim.

## What is established

| Evidence | Supported fact | Limit |
| --- | --- | --- |
| [Resident house register](https://rommelwood.de/wohnen/h%C3%A4user/) | The five older addresses, color names and paired house/wing identifiers below | Wing identifiers do not locate individual rooms or internal stairs |
| [Operator history](https://www.werkswelt.de/index.php?id=1970er&setlang=en) | Completion of the Erwin-Rommel-Straße development in **1979/80** | No old-house architect, floor plans or dimensions supplied |
| [Publicly released energy certificate](https://media.frag-den-staat.de/files/foi/601766/Energieausweis_geschwaerzt.pdf), issued 2018 | Addresses 51–59, building year **1979**, **312 apartments** | A complex-level record, not a current apartment schedule. Its energy-reference area is not usable apartment area |
| [Operator's 2016 extension report](https://www.werkswelt.de/?post=richtfest-beim-wohnheim-bauprojekt-erlangen-campus-sued) | Describes the existing old buildings as **Doppelhäuser**, alongside the new development | This does not say that their floor plans are identical |
| [Current Süd I operator page](https://www.werkswelt.de/index.php?id=wohnanlage-campus-sud-i) and [2026 chart](https://werkswelt.de/data/uploads/wohnen/mietpreislisten/2026/erlangen/760-campus-sued-i-englisch-2026.pdf) | Single apartments have a kitchenette and bathroom; **16.4 m²** is a published category average. Double and accessible accommodation also exist | No per-house/floor type distribution or measured clear area |
| [2014 BayernLabo funding report, printed p. 65](https://bayernlabo.de/fileadmin/user_upload/foerderinstitut/85_downloadcenter/bayernlabo-foerderbericht-2014-es.pdf#page=65) | Refurbishment of house **55**, **68 student places** | Historical funding scope, not a present floor plan |
| [2014 refurbishment report](https://www.marktspiegel.de/nuernberg/c-lokales/joachim-herrmann-uebergab-foerdermittelbescheid_a7003) | Houses **57/59** had **132 student places plus a staff apartment** in that project | The extra use is not located; it must not be assigned to a guessed floor or room |

The historical apartment total is consistent with 285 singles plus 27 doubles. The public map's 339 older-house markers instead match 285 plus 54 double-apartment bedrooms numerically. **Markers, bedrooms/places and apartments are different quantities.** These records do not resolve every difference between historical totals and current directory/category listings.

## House and floor evidence

The [public orientation map](https://rommelwood.de/map/) was checked again on the review date using the metadata-only extractor. It still returns the following aggregate counts. The retained OSM `building:levels` tags independently indicate **three levels** for each old house.

| Address | Resident name | House/wing identifiers | EG / index 0 markers | 1. OG markers | 2. OG markers |
| --- | --- | --- | ---: | ---: | ---: |
| 51 | Yellow | 7 & 8 | 25 | 25 | 21 |
| 53 | Orange | 9 & 10 | 24 | 24 | 20 |
| 55 | Red | 1 & 2 | 24 | 24 | 20 |
| 57 | White | 3 & 4 | 24 | 24 | 20 |
| 59 | Green | 5 & 6 | 20 | 24 | 20 |

OSM references: [51](https://www.openstreetmap.org/way/45017880), [53](https://www.openstreetmap.org/way/45017886), [55](https://www.openstreetmap.org/way/45017890), [57](https://www.openstreetmap.org/way/45017866), [59](https://www.openstreetmap.org/way/45017868).

These are **source-index totals, not verified room polygons or current occupancy**. Marker coordinates are unsuitable for precise partitions, and no open reuse licence for the individual database was established. The source was not republished; the fresh extraction in `/tmp/rommel-old-house-room-summary.json` contains no individual records.

The differing totals directly limit a whole-building copy. Repeating House 55's twenty-room study across all fifteen old-house floors would show a partial assumed core, not a complete inventory. Additional spaces must remain unassigned until evidence identifies their number, type and location. The matching 53/55/57 totals are compatible with related designs, but do not prove matching corridors, accessible units or mirror orientation.

## What the older single-apartment sketch can supply

The [resident layout page](https://rommelwood.de/wohnen/zimmergrundriss/) presents an [older single-apartment sketch](https://rommelwood.de/media/images/zimmerskizze.jpg) separately from the newer houses. It warns about variations and mirroring. The source has no house number, floor, room identifier, measurement date or complete scale/dimension chain.

Visually supported organization:

- A windowed living zone, with bed on the sketch's left and desk on its right.
- A wardrobe near the transition to the entrance area; kitchenette along the entrance area's right side.
- Bathroom with toilet, shower and washbasin at the lower right, with a diagonal corner/entry; the apartment entrance is at lower left.
- A small hatched rectangle beside the bathroom is **unlabeled**. Its use and construction are unknown.

The labels give an approximate **2.70 × 3.30 m living zone**, **2.50 m clear ceiling**, and furniture dimensions of bed **0.97 × 2.17 m**, desk **0.75 × 1.55 m**, wardrobe **1.00 × 0.60 m**, and shelf approximately **0.62 × 0.27 m**. Centimetres are inferred from the source labels' consistent scale. The complete apartment, bathroom, kitchenette, interior doors and wall thicknesses are **not dimensioned**.

This can support a schematic typology illustration and optional furniture cues. It cannot establish a measured service-core template or determine the correct mirror for every room. The [accessible double-apartment drawing](https://rommelwood.de/media/images/grundriss.png) describes a different type; it must not be substituted for an ordinary single.

## Defensible transfer to the other houses

1. Preserve each house's official exterior and its own floor sections. Register an explicit template transform to that source; retain residuals and any clipped or unassigned areas. A good exterior fit is geometric compatibility, not interior verification.
2. Mark transferred rooms, corridors, stairs and doors as **estimated template geometry** with House 55 and its version as the source. Do not copy House 55's resident-confirmed status or physical room numbers into another house.
3. Keep room counts, room placement, dimensions, service layout and floor elevations as separate evidence questions. Do not generate extra apartments solely to make a marker total match.
4. Treat the [16.4 m² area scenario](HOUSE55-AREA-STUDY.md) and its wall allowances as assumptions. Do not enlarge a source shell, absorb low roof strips, close a passage or shrink a furnished template silently to force a target.
5. Render bathroom/kitchen/furniture as a separate **schematic arrangement** only where it fits the candidate room and door/window orientation. Unknown mirror direction and unmeasured partition positions remain explicit; a poor fit is a recorded conflict.

No current, address-and-floor-matched whole-floor plan was obtained from the targeted operator, association, refurbishment/funding and architect searches. The karlundp competition and completed-project drawings concern **newer Süd II**; their “nearly identical” upper-floor description is not evidence about the old houses. A Scherzer/Kalau renovation article found during this search concerns **Alexandrinum**, not this complex, and was excluded.

The next decisive evidence is one identified floor sketch or plan per old-house variant, with stairs, corridor routes, double/accessibility units and a few measured exterior-to-partition spans. It can replace a template incrementally. Public drawings remain source links; no source photograph or copyrighted plan is bundled here.
