# Geometry, provenance and accuracy

This release combines an **official LoD2 exterior model** of all eleven dorms with OSM storey counts, rendered streets/paths and separately retained reference/context data. The building walls, standard roof forms, footprints and heights come from Bavarian surveying open data. The dark spatial presentation adds photo-informed schematic material seams while retaining the source geometry. Unfolded levels are thin horizontal sections through that exterior, at provisional or approved floor elevations. LoD2 is still a simplified exterior model, not a complete as-built twin. Interior walls, individual floor elevations, window/door positions and room geometry remain unverified in the current empty interior dataset.

## Official exterior model

The decisive source is [Bayerische Vermessungsverwaltung LoD2-BY](https://geodaten.bayern.de/opengeodata/OpenDataDetail.html?pn=lod2), an open dataset under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Its official 2 × 2 km tile `LoD2_32_646_5492_2_BY` includes all eleven dorms with explicit addresses. The original geometry combines ALKIS building footprints with heights derived from laser, cadastral 3D measurement and/or photogrammetric sources; individual source codes are preserved without asserting that every building used the same method.

The 17,582,898-byte source tile was downloaded on 14 November 2026 and verified against the SHA-256 hash in the official metalink (published 10 November 2026). The retained `data/source/dorms-lod2.gml` is an unchanged geometry subset containing only the eleven address-matched building objects. `lod2-source.json` records both original tile and retained subset checksums. The tile snapshot date is **not** a new survey date. The source records a footprint currency of 14 October 2025; model creation dates vary by building.

`public/data/lod2.json` contains **289 authoritative exterior surface polygons**: `WallSurface`, `RoofSurface` and `GroundSurface`. The older five houses have articulated roof planes; the six newer buildings have the official standard roof representation. All source polygons, including the old houses' complex outlines, are preserved. Use these surfaces for exteriors; do not rebuild them from rectangles.

| House | Official `measuredHeight` (m) | Ground altitude (m NHN) |
| --- | ---: | ---: |
| 49 | 18.097 | 290.003 |
| 51 | 10.605 | 291.696 |
| 51a | 10.351 | 292.340 |
| 53 | 10.236 | 291.364 |
| 53a | 15.111 | 289.589 |
| 55 | 9.491 | 292.411 |
| 55a | 18.198 | 290.202 |
| 57 | 9.672 | 292.230 |
| 57a | 23.458 | 291.249 |
| 59 | 9.745 | 292.257 |
| 59a | 18.333 | 291.989 |

The source serializes millimetres; this does not mean millimetre surveying accuracy. Roof forms are standardized LoD2 approximations and do not include every facade or roof detail.

## Source layers

| Field | Source | Meaning / confidence |
| --- | --- | --- |
| Exterior wall, roof and ground polygons; height | [Bavarian LoD2-BY](https://geodaten.bayern.de/opengeodata/OpenDataDetail.html?pn=lod2), exact address match | Official standard-form exterior model; geometry and source dates retained |
| Secondary footprint/context layer | [OpenStreetMap](https://www.openstreetmap.org/#map=18/49.5766/11.0298), retained OSM way IDs | Independently mapped footprint; retained for reference/context and crosschecking |
| Building address | LoD2 address fields and each reference OSM way's `addr:street` and `addr:housenumber` | Both geometry sources matched by explicit street address, not nearest-marker guessing |
| Storeys | Each OSM way's `building:levels` | Mapped above-ground storey count; ground floor included |
| House colours / wing IDs | [Rommelwood house register](https://rommelwood.de/wohnen/h%C3%A4user/) | Source-backed community naming convention; render colours chosen for legibility |
| Public house label point | [Rommelwood map](https://rommelwood.de/map/) | Approximate label position; use polygon centroid for 3D labels |
| Floor-study sections | Horizontal intersections through official LoD2 surfaces at provisional or approved elevations | Exterior cross-sections, including holes and separate parts; not occupied floor boundaries or headroom measurements. Unknown elevations interpolate from official height and mapped storeys. |
| Roof | Official LoD2 `RoofSurface` polygons | Standard-form model, including complex older-house roofs; details below LoD2 are absent |
| Streets and paths | Retained outdoor OSM highway ways; mapped `width` where present | Mapped horizontal alignment. Known widths render as ribbons; unknown widths as centerlines. Flat display elevation is not terrain data. |
| Trees and neighboring buildings | Retained OSM nodes/ways | Research/reference data only; no schematic trees or gray neighboring blocks are drawn |
| Façade material seams | [Inspected architect/operator photographs](FACADE-REFERENCES.md) | Direction and broad material character observed; procedural seam pitch, joint positions and floor bands are illustrative |
| Room index | Permission-gated contribution dataset | No individual room markers republished from the existing site; aggregate research only. Accepted room records need an approved source and explicit floor labels. |

Data was retrieved on 14 November 2026. The exact OSM base timestamp is retained in `public/data/campus.json` and `data/source/osm-raw.json`.

## Dark spatial presentation

The camera now frames the campus more closely. No building has been enlarged, moved toward its neighbors or independently rescaled: the shared coordinate system remains measured in metres. Camera movement, perspective and viewport fitting change the view, not the source dimensions.

The thin hiking-style signpost uses camera-relative bearings and straight-line distances from the selected building center, or the overview origin, to destination building centers. These are visual navigation aids, not measured walking routes or verified entrance locations. The north indicator rotates with the view. Dragging orbits, the wheel zooms and the Rommelweb brand restores the overview; the separate zoom/top-view dock is removed.

Streets and paths are drawn from retained OSM coordinates. Outdoor ways with a valid mapped width have restrained gray ribbons and edges; other ways retain centerlines rather than receiving an invented physical width. Indoor highway ways are omitted. Schematic trees and gray context-building volumes remain absent. Paths and the ground guide use flat display planes because no surveyed terrain model is available.

The display network buffers the **45 explicitly tagged widths**, joins corners and unions overlaps; it preserves the centerline coordinates of all **99 outdoor ways**. The other **54 ways** retain screen-width linework. Road and footpath fills are disjoint, and the shared outer boundary removes the old per-segment seams at crossings. Rounded joins and caps are display choices, not surveyed kerb geometry. They do not establish a routable graph or accessible entrances.

`npm run paths:build` produces `public/data/path-network.json` from the retained context. The cache includes all normalized source records and a SHA-256 digest. Both the build gate and runtime validate those references; missing, stale or failed cache loads use original source centerlines. Polygon union is computed once during development, so browsers do not repeat it. `polyclip-ts` is a development dependency and is absent from the application bundle.

`src/facade.js` generates surface-clipped seam segments without editing the LoD2 rings. New houses use vertical timber lines; old houses emphasize long horizontal plate courses and keep short staggered joints faint to avoid a brick-grid appearance. **Seam pitches are rendering parameters, not measured construction dimensions.** Thin storey-joint marks on newer houses use provisional floor elevations. Natural timber and older brown façade tones remain distinct from neutral charcoal/gray roofs. These display colors are not measured surface finishes. The material marks disappear with the assembled exterior when switching to the unfolded level study.

Fine façade strokes blend into a coarser subset when their projected spacing becomes too small, reducing shimmer during orbiting without changing any source surface. Camera and floor transitions use elapsed time and share a smooth start/stop curve; folding restores the assembled source shell after the section plates return. Reduced-motion mode places the camera and plates immediately.

The broad patterns are grounded in the [façade reference study](FACADE-REFERENCES.md), refined by the [older-building addendum](OLD-BUILDING-SECTIONS.md). No source photos, traced textures, invented windows or claimed exact loggia positions are added. Material detail, official exterior surfaces and future approved interior geometry retain separate evidence status.

## Thin exterior sections

`src/sections.js` intersects the official wall, roof and ground shell with a horizontal plane for each level. It retains closed outlines, holes and disconnected parts. The rendered study consists of thin filled planes and their boundary lines, separated vertically for inspection. It does not stack repeated full-footprint building volumes. Higher cuts through the older houses can shrink or separate into wings where the source roof geometry requires it.

The section's elevation comes from `getLevelElevations`: verified records remain exact anchors, and unknown guides interpolate between the nearest anchors, with the official model height as the terminal boundary. With no approved records the initial spacing is uniform. That boundary is not a verified ceiling, and a section through the shell is not an occupied-area calculation. OSM fallback `height` fields are 3 m × storeys and must not replace official exterior heights.

At ground level, the serialized base altitude and rounded ground vertices differ by a few millimetres. `floorSection` samples just inside the shell when needed to obtain a closed contour, while keeping the displayed section at its requested guide or approved elevation. It retains the actual sample elevation and offset as metadata. This is numerical handling of the source representation, not additional surveying precision.

No roof cap, roof-space occupancy or usable headroom is inferred during unfolding. The [older-building evidence](OLD-BUILDING-SECTIONS.md) includes a typical-room sketch with approximately 2.50 m clear ceiling height; it does not establish floor-to-floor heights or complete occupied outlines. Approved space polygons remain a separate layer, displayed only for the selected floor under the [interior format](INTERIOR-FORMAT.md).

## Building register

| Street number | Campus | Community house/wing | OSM way | Above-ground storeys |
| --- | --- | --- | --- | ---: |
| 49 | II | 11 | [408479447](https://www.openstreetmap.org/way/408479447) | 6 |
| 51 | I | 7 / 8 | [45017880](https://www.openstreetmap.org/way/45017880) | 3 |
| 51a | II | 16 | [369941495](https://www.openstreetmap.org/way/369941495) | 3 |
| 53 | I | 9 / 10 | [45017886](https://www.openstreetmap.org/way/45017886) | 3 |
| 53a | II | 12 | [408479297](https://www.openstreetmap.org/way/408479297) | 5 |
| 55 | I | 1 / 2 | [45017890](https://www.openstreetmap.org/way/45017890) | 3 |
| 55a | II | 13 | [408479296](https://www.openstreetmap.org/way/408479296) | 6 |
| 57 | I | 3 / 4 | [45017866](https://www.openstreetmap.org/way/45017866) | 3 |
| 57a | II | 14 | [403754283](https://www.openstreetmap.org/way/403754283) | 8 |
| 59 | I | 5 / 6 | [45017868](https://www.openstreetmap.org/way/45017868) | 3 |
| 59a | II | 15 | [403754282](https://www.openstreetmap.org/way/403754282) | 6 |

The [architect's project description](https://www.karlundp.de/projekt/wohnanlage-fuer-studierende-erlangen/) describes the six newer buildings as roughly 23 × 23 m cubes, with three to eight storeys and without basements. Individual outlines and exterior projections follow the official LoD2 polygons. The rough architectural dimensions do not determine individual geometry. OSM-derived reference polygons remain separately identified in `campus.json`.

House 51a has confirmed communal uses. The [operator's original planning report](https://www.werkswelt.de/?post=neubau-einer-wohnanlage-am-erlanger-suedcampus) also describes group apartments above its shared ground floor. Its current internal arrangement is unverified; neither its community label nor missing room markers establishes that it is exclusively nonresidential.

## Coordinates

`campus.geojson` uses WGS84 longitude, latitude. `campus.json` adds local projected coordinates in metres around `(latitude 49.5766, longitude 11.0298)`:

```text
x = radians(longitude − 11.0298) × 6371008.8 × cos(radians(49.5766))
z = −radians(latitude − 49.5766) × 6371008.8
```

The 3D axes are x east, y up, z south. Horizontal coordinates are rounded to 1 mm for stable serialization; **that decimal precision does not imply millimetre accuracy**. The local projection is appropriate for this small visual model, but must not be used for surveying, navigation safety or construction.

LoD2 source coordinates use EPSG:25832 (ETRS89 / UTM zone 32N), transformed to WGS84 through PROJ before the same local projection. Vertical positions preserve the original DHHN2016 height differences: `y = source NHN altitude − 289.589 m`, the minimum source ground altitude across the eleven buildings. `baseY` is each building’s ground offset. The model does not yet include surveyed terrain between houses.

OSM queries return complete ways crossing the geographic query bounds. Some retained contextual roads and neighbouring buildings extend beyond the dorm. Preserve those source coordinates; any later restriction of the visible extent should be a rendering clip, not a source-geometry edit.

## Room-marker discrepancy

Research of the existing public resident map found 703 dorm room point markers across ten of the eleven houses. House 51a has none. These individual markers are **not republished in this repository** because permission to reuse the assembled room database has not been established. The public build's room-data envelope contains aggregate counts only and an empty marker list. An approved source or resident contribution must populate the room index. The source used explicit floor labels; no room-number parsing was necessary. New-house source points began at floor 1, so absence of floor-0 rooms does not mean that the ground floor is absent.

A ray-casting containment check against the address-matched OSM polygons finds **247 of 703 points outside their building footprint**:

| House | Point markers | Outside OSM footprint |
| --- | ---: | ---: |
| 49 | 70 | 0 |
| 51 | 71 | 37 |
| 53 | 68 | 44 |
| 53a | 56 | 29 |
| 55 | 68 | 51 |
| 55a | 70 | 0 |
| 57 | 68 | 21 |
| 57a | 98 | 19 |
| 59 | 64 | 46 |
| 59a | 70 | 0 |

This comparison uses the retained OSM reference footprints, not the official LoD2 geometry used for the current exterior. It does not establish which underlying geometry is wrong. It establishes that the compared datasets cannot support exact interior placement together. Once reuse permission or contributed records exist, the safe UI is a numbered-room list for each source floor, clearly marked with its provenance. The current UI leaves individual room records unpopulated. A future floorplan should be georeferenced and independently checked, not generated by snapping these points inward or subdividing the footprint into imaginary rooms. Marker labels for houses 51, 51a and 59 also lie outside their OSM polygons, further demonstrating that the map uses approximate annotation locations.

## Reproduce or refresh

From the repository root, with Python 3 and no added packages:

```sh
# Deterministically rebuild from retained source snapshot (no network)
python3 scripts/acquire-campus.py

# Explicitly refresh public sources, then rebuild
python3 scripts/acquire-campus.py --fetch
```

After changing the retained path source, run `npm run paths:build`. The normal application build rejects a stale cache; inspect changes to both the source and derived network before committing.

The script requests only public building ways, highway ways and tree nodes in a small campus bounding box. It retains complete OSM responses and sanitized house-marker facts. It does not persist the source site's whole HTML or scrape resident identities. It fails if all 11 distinct expected address-tagged dorm footprints cannot be found. Room acquisition is separate.

For the official exterior model, `uv` resolves the pinned `pyproj` dependency from inline script metadata:

```sh
# Rebuild from the retained 11-building CityGML subset
uv run scripts/acquire-lod2.py

# Refresh official metalink/tile, verify its hash, subset, rebuild
uv run scripts/acquire-lod2.py --fetch
```

A normal rebuild performs no source fetch. For fully offline rebuilding, Python with pyproj 3.8.0 already installed can run the script directly.

After refresh, review the diff, especially changed addresses, footprints, levels and new omissions. A new OSM snapshot can correct geometry and can also introduce mistakes. Source-data refresh should not silently become production.

## Licence and attribution

The official LoD2-derived database (`data/source/dorms-lod2.gml`, `public/data/lod2.json`) is **CC BY 4.0**. Credit **Datenquelle: Bayerische Vermessungsverwaltung – www.geodaten.bayern.de**, link the source and licence, and indicate that data has been subsetted and coordinate-transformed for this visualization.

The OSM-derived database in `data/source/osm-raw.json`, `public/data/campus.geojson`, `public/data/path-network.json` and the OSM-derived geometry/tag fields of `public/data/campus.json` is made available under the [Open Database Licence 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Keep **© OpenStreetMap contributors**, with a visible link to [OpenStreetMap copyright and licence information](https://www.openstreetmap.org/copyright), on the map. The downloadable GeoJSON represents the OSM reference and context layer. The rendered dorm exteriors come from the separately licensed `lod2.json`.

House naming and aggregate room-research facts come from the cited public resident association pages. Individual room marker records have not been republished without reuse permission. No licence is asserted over third-party website text or photographs, and none of their photos or descriptive prose is reproduced in the model. This project is not affiliated with or an official service of FAU, Studierendenwerk or Rommelwood e.V.
