# House 55 scale and registration audit

Audit date: 15 November 2026. This audit concerns the twenty resident-confirmed room references on **2. OG**. It does not establish a measured interior plan, alter the official exterior source, or support changing the building scale to make an assumed room type fit.

## Source identity and exterior dimensions

The retained CityGML object is `DEBY_LOD2_3166499`, address Erwin-Rommel-Straße 55. Its horizontal coordinates use **ETRS89 / UTM zone 32N, EPSG:25832**; heights use **DHHN2016 / NHN**. The source model creation date is 15 April 2021 and its footprint currency is 14 October 2025. These dates and LoD2's simplified roof representation limit what “exact source geometry” means: the app retains the published surfaces, but they are not a contemporary interior or façade survey.

| Quantity | Value | Meaning |
| --- | ---: | --- |
| Official `measuredHeight` attribute | 9.491 m | Exterior building height; not three measured storey intervals |
| Official base-height attribute | 292.411 m NHN | Model attribute used for the building's base anchor |
| Official roof-height attribute | 301.902 m NHN | Model attribute for the exterior maximum |
| Complete web model, in the study's rotated plan axes | 49.338 × 24.150 m | Bounding rectangle of all exterior vertices; the ground has the same extrema |
| Provisional index-2 envelope section | 44.028 × 24.122 m; 637.124 m² | Horizontal shell intersection at the current unmeasured floor guide |
| That section after the resident's two no-floor exclusions | 561.339 m² | Top-floor study plate; not usable or lettable area |
| Flat roof surface used for screenshot registration | 41.019 × 24.122 m; approximately 510.616 m² | Roof surface 39's plan projection, not the complete building or floor plate |

The complete web model's study-axis bounds are `[-15.132736, -6.605569, 34.204895, 17.544851]` m. The provisional top section's bounds are `[-11.092203, -6.589466, 32.935630, 17.532438]` m. Bounding-rectangle area must not be substituted for polygon area.

The current index-2 guide is `2 × 9.491 / 3 = 6.327333` m above the base attribute: campus Y `9.149333` m, or `298.738333` m NHN. The flat roof used to register the screenshot is at campus Y `11.401` m, or `300.990` m NHN. These are different planes. Plan coordinates registered on that horizontal roof are carried vertically to the study plane; the registration does not measure a floor elevation. The ground-surface coordinates are 1 mm below the base-height attribute, a source-coordinate/attribute distinction retained in the model.

## Small projection distortion, not a missing room-scale factor

`scripts/acquire-lod2.py` converts UTM coordinates to longitude/latitude with PROJ, then uses the same local spherical equirectangular projection as the OSM campus:

```text
x = (longitude − originLongitude) × π/180 × 6371008.8 × cos(originLatitude)
z = −(latitude − originLatitude) × π/180 × 6371008.8
origin = 49.5766° N, 11.0298° E
```

This is useful for aligning the campus sources, but it is not a distance-preserving rotation of UTM coordinates. The audited House 55 edges are approximately **0.13–0.17% shorter** in the web projection than in the retained UTM grid. Both representations are serialized to millimetres; that precision is not a survey-accuracy claim. UTM grid distances themselves should not be described as exact ground-survey distances.

The following pairs are vertex indices on flat `RoofSurface` 39, matched through the original polygon ID rather than through a guessed orientation:

| Source vertices | Edge | Retained UTM grid length | Web length | Web difference |
| --- | --- | ---: | ---: | ---: |
| 23 → 0 | Four-room southwest frontage | 12.083180 m | 12.065928 m | −0.1428% |
| 9 → 10 | Three-room east frontage | 9.155502 m | 9.140471 m | −0.1642% |
| 20 → 21 | West wing exterior run | 11.569170 m | 11.550292 m | −0.1632% |
| 17 → 18 | Complete exterior run above the left block and stairs | 10.461506 m | 10.447012 m | −0.1385% |
| 6 → 7 | Source-aligned three-room R frontage | 8.090303 m | 8.079456 m | −0.1341% |
| 12 → 13 | North frontage | 9.577692 m | 9.564158 m | −0.1413% |

The R edge changes by only 10.85 mm over its entire run. Correcting this projection alone would increase an equal R bay by about 3.62 mm, not provide wall thickness or resolve the former L block's metre-scale shortage. Changing only House 55's scale would also detach it from the shared campus geometry and the registered annotation.

Reproduce those source-to-web comparisons from the repository root with Python's standard library:

```bash
python - <<'PY'
import json, math, xml.etree.ElementTree as ET
from pathlib import Path

root = Path(".")
model = json.loads((root / "public/data/lod2.json").read_text())
house = next(b for b in model["buildings"] if b["number"] == "55")
surface = house["surfaces"][39]
ns = {"g": "http://www.opengis.net/gml"}
tree = ET.parse(root / "data/source/dorms-lod2.gml")
polygon = next(p for p in tree.findall(".//g:Polygon", ns)
               if p.attrib["{http://www.opengis.net/gml}id"] == surface["id"])
text = polygon.find("g:exterior/g:LinearRing/g:posList", ns).text
values = list(map(float, text.split()))
utm = [values[i:i+3] for i in range(0, len(values), 3)]
web = surface["points"]
for a, b in [(23, 0), (9, 10), (20, 21), (17, 18), (6, 7), (12, 13)]:
    source = math.hypot(utm[b][0]-utm[a][0], utm[b][1]-utm[a][1])
    shown = math.hypot(web[b][0]-web[a][0], web[b][2]-web[a][2])
    print(f"{a:2} → {b:2}: UTM={source:.6f} m; "
          f"web={shown:.6f} m; change={(shown/source-1)*100:.4f}%")
PY
```

The retained-source checksum and download receipt are in `data/source/lod2-source.json`; the generation script verifies that receipt. The interior study's source digest and exact model identifiers are in `data/source/house55-2og-study-provenance.json`.

## Independent registration checks

The study axes are a rotation of campus X/Z:

```text
right = normalize([0.676, 0.737])
down  = [-right.z, right.x]
```

Their lengths are both 1, their dot product is 0 and their determinant is 1. No scale factor is hidden in the rotation. Their angle is 47.471956°; a length-weighted dominant direction from the source roof edges is approximately 47.507499°, a difference of 0.035543°. Source edges are not perfectly orthogonal, and exact edge clipping remains necessary.

The generator uses seventeen manually observed corners on the same horizontal roof plane. An independent, normalized least-squares fit using QR rather than the generator's normal equations returned:

| Check | Result |
| --- | ---: |
| Independent projective fit RMS | 1.08915 original-image pixels |
| Largest fitted corner residual | 1.76811 pixels |
| Largest leave-one-corner-out residual | 2.75135 pixels, approximately 0.095 m in plan |
| Forward/inverse numerical round trip | Below `2 × 10⁻¹⁴` m |
| Affine-only fit RMS | 10.20545 pixels |

The projective fit is warranted by perspective. Pixel density varies with position and direction, approximately 25–28 pixels per metre around the marked zones; measuring all strokes with one pixels-per-metre constant would be wrong.

The archived PNG is 1317 × 694 pixels. Original manual observations used a 1344 × 702 display canvas. The generator records that canvas and consistently rescales both observations and fitted projections to the original image. Using one consistent display transform for all corner controls and strokes does not change the recovered plan coordinates.

These residuals measure internal fit consistency, **not calibrated measurement accuracy**. The user-drawn strokes are thick and approximate, some roof edges are at other elevations, and the purpose of a stroke may be a room zone rather than an exact wall. Interior boundary interpretation remains uncertain by much more than the numeric fit residual. The four ridge-adjacent controls omitted by the generator must not be mixed into the flat-plane fit.

## Consequences for the twenty-room fit

The resident-confirmed counts are fixed at `4 + 3 + 4 + 3 + 3 + 3 = 20`. The audit found no projection, units or registration error large enough to justify expanding the building.

Before the dimensional refit, the approximate L stroke box was only 6.691933 m wide. Dividing it into three rooms produced 2.230644 m gross bays. The public older-room sketch's approximately 2.70 × 3.30 m **clear living zone** cannot fit unrotated within such a bay. The mismatch concerns the interpretation of the soft box boundary or room arrangement, not the confirmed count.

The fixed R source frontage is a separate limit. Three equally fronting bays provide approximately 2.693152 m each in the web geometry, or 2.696768 m in the retained UTM grid, **before any wall allowance**. Therefore twenty identical copies of a literal 2.70 m-clear-width apartment, all arranged as the current façade-fronting rectangles, are not demonstrated by the evidence. The public sketch is an approximate, unassigned typical room and does not prove that every room has that exact width. Its living-zone dimensions also exclude undimensioned bathroom, kitchen and entrance space.

A defensible refit can regularize bays within their confirmed runs and move inferred corridor boundaries, while preserving source surfaces, twenty references and the resident's stair and R-edge relationships. It must retain an explicit unresolved R typology/width exception and treat repeatable interior cores as a feasibility study, not a measured apartment plan. Additional shape hypotheses on 2. OG must not silently propagate to the already labeled lower-floor extrapolations.
