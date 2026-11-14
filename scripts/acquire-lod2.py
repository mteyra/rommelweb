#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["pyproj==3.8.0"]
# ///
"""Convert retained official dorm CityGML into web surfaces; --fetch refreshes.

Run with `uv run scripts/acquire-lod2.py`, or Python with pyproj installed.
Only the 11 address-matched dorm objects are retained from the public 2 km tile.
"""
import argparse
import datetime
import hashlib
import json
import math
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source"
DEFAULT_OUTPUT = ROOT / "public" / "data" / "lod2.json"
TILE = "646_5492.gml"
METALINK = "https://geodaten.bayern.de/odd/a/lod2/citygml/meta/metalink/09.meta4"
ORIGIN = {"latitude": 49.5766, "longitude": 11.0298}
NUMBERS = {"49", "51", "51a", "53", "53a", "55", "55a", "57", "57a", "59", "59a"}
NS = {
    "c": "http://www.opengis.net/citygml/1.0",
    "b": "http://www.opengis.net/citygml/building/1.0",
    "g": "http://www.opengis.net/gml",
    "x": "urn:oasis:names:tc:ciq:xsdschema:xAL:2.0",
    "gen": "http://www.opengis.net/citygml/generics/1.0",
}


def selected_buildings(root):
    selected = []
    for building in root.findall("c:cityObjectMember/b:Building", NS):
        address = building.find(".//x:ThoroughfareName", NS)
        if address is None or address.text not in {f"Erwin-Rommel-Straße {number}" for number in NUMBERS}:
            continue
        attributes = {item.attrib["name"]: item.find("gen:value", NS).text for item in building.findall("gen:stringAttribute", NS)}
        selected.append((address.text.split()[-1], building, attributes))
    if len(selected) != 11 or {item[0] for item in selected} != NUMBERS:
        raise ValueError("Expected exactly the 11 address-matched dorms; review changed source data")
    return selected


def download(url):
    request = urllib.request.Request(url, headers={"User-Agent": "rommelweb-public-geometry/1.0"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def fetch():
    metalink = ET.fromstring(download(METALINK))
    ns = {"m": "urn:ietf:params:xml:ns:metalink"}
    tile = next(item for item in metalink.findall("m:file", ns) if item.attrib["name"] == TILE)
    expected_hash = tile.find("m:hash[@type='sha-256']", ns).text
    url = tile.find("m:url", ns).text
    raw = download(url)
    if hashlib.sha256(raw).hexdigest() != expected_hash:
        raise ValueError("Downloaded CityGML tile does not match official published checksum")
    root = ET.fromstring(raw)
    selected = selected_buildings(root)
    subset = ET.Element(f"{{{NS['c']}}}CityModel")
    subset.append(root.find("g:boundedBy", NS))
    for _, building, _ in selected:
        member = ET.SubElement(subset, f"{{{NS['c']}}}cityObjectMember")
        member.append(building)
    SOURCE.mkdir(parents=True, exist_ok=True)
    ET.ElementTree(subset).write(SOURCE / "dorms-lod2.gml", encoding="utf-8", xml_declaration=True)
    write_json(SOURCE / "lod2-source.json", {
        "name": TILE, "size": len(raw), "hash": expected_hash, "url": url,
        "metalink": METALINK, "metalinkPublished": metalink.findtext("m:published", namespaces=ns),
        "retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "subsetSha256": hashlib.sha256((SOURCE / "dorms-lod2.gml").read_bytes()).hexdigest(),
    })


def rebuild(output):
    source = SOURCE / "dorms-lod2.gml"
    receipt = json.loads((SOURCE / "lod2-source.json").read_text())
    if receipt.get("subsetSha256") and hashlib.sha256(source.read_bytes()).hexdigest() != receipt["subsetSha256"]:
        raise ValueError("Retained CityGML source differs from source receipt")
    selected = selected_buildings(ET.parse(source).getroot())
    datum = min(float(attributes["HoeheGrund"]) for _, _, attributes in selected)
    transformer = Transformer.from_crs(25832, 4326, always_xy=True)

    def project(point):
        longitude, latitude = transformer.transform(point[0], point[1])
        return [
            round(math.radians(longitude - ORIGIN["longitude"]) * 6371008.8 * math.cos(math.radians(ORIGIN["latitude"])), 3),
            round(point[2] - datum, 3),
            round(-math.radians(latitude - ORIGIN["latitude"]) * 6371008.8, 3),
        ]

    def parse_ring(element):
        flat = list(map(float, element.text.split()))
        if len(flat) % 3:
            raise ValueError("Non-3D source ring")
        points = [project(flat[index:index + 3]) for index in range(0, len(flat), 3)]
        if points[0] != points[-1]:
            raise ValueError("Open polygon ring")
        return points

    buildings = []
    for number, building, attributes in selected:
        surfaces = []
        for bounded in building.findall(".//b:boundedBy", NS):
            surface = list(bounded)[0]
            kind = surface.tag.split("}")[-1]
            for polygon in surface.findall(".//g:Polygon", NS):
                ring = polygon.find("g:exterior/g:LinearRing/g:posList", NS)
                if ring is None:
                    raise ValueError("Unsupported source polygon ring encoding")
                surfaces.append({
                    "type": kind, "points": parse_ring(ring),
                    "holes": [parse_ring(hole) for hole in polygon.findall("g:interior/g:LinearRing/g:posList", NS)],
                    "id": polygon.attrib.get(f"{{{NS['g']}}}id"),
                })
        ground = [surface for surface in surfaces if surface["type"] == "GroundSurface"]
        if not ground or not any(surface["type"] == "RoofSurface" for surface in surfaces):
            raise ValueError(f"Missing ground/roof geometry for {number}")
        buildings.append({
            "number": number, "id": building.attrib[f"{{{NS['g']}}}id"],
            "height": float(building.findtext("b:measuredHeight", namespaces=NS)),
            "baseAltitude": float(attributes["HoeheGrund"]), "baseY": round(float(attributes["HoeheGrund"]) - datum, 3),
            "roofAltitude": float(attributes["HoeheDach"]), "roofTypeCode": building.findtext("b:roofType", namespaces=NS),
            "creationDate": building.findtext("c:creationDate", namespaces=NS), "footprintCurrency": attributes.get("Grundrissaktualitaet"),
            "attributes": attributes, "surfaces": surfaces,
            "groundPolygons": [[[point[0], point[2]] for point in surface["points"]] for surface in ground],
        })
    buildings.sort(key=lambda building: (int(building["number"].rstrip("a")), building["number"]))
    metadata = {
        "source": "Bayerische Vermessungsverwaltung — LoD2-BY",
        "url": "https://geodaten.bayern.de/opengeodata/OpenDataDetail.html?pn=lod2",
        "downloadUrl": receipt["url"], "tile": "LoD2_32_646_5492_2_BY", "sha256": receipt["hash"],
        "retrievedAt": receipt.get("retrievedAt", "2026-11-14"), "metalinkPublished": receipt.get("metalinkPublished", "2026-11-10T22:10:04Z"),
        "license": "CC-BY-4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        "attribution": "Datenquelle: Bayerische Vermessungsverwaltung – www.geodaten.bayern.de",
        "originalHorizontalCRS": "EPSG:25832", "originalVerticalDatum": "DHHN2016 (NHN)",
        "origin": ORIGIN, "verticalDatum": datum, "axis": "x east, y up from campus datum, z south",
        "transformation": "EPSG:25832 to WGS84 with PROJ, then local equirectangular matching campus.json. y = original NHN height minus minimum of 11 building base heights.",
        "precisionNote": "Serialized millimetres do not imply millimetre accuracy. LoD2 models use standard roof forms; not a facade or interior survey.",
        "uncertainties": [
            "No surveyed room geometry, storey elevations, windows, doors or facade detail.",
            "Individual building footprint currency and model creation dates differ; snapshot retrieval is not a survey date.",
            "Terrain between buildings is not included; baseY preserves original inter-building elevation differences.",
            "Ground polygon surfaces can consist of several polygons for one building; do not assume a single rectangle.",
        ],
    }
    write_json(output, {"metadata": metadata, "buildings": buildings})
    print(f"Converted {len(buildings)} official dorm models with {sum(len(building['surfaces']) for building in buildings)} surface polygons to {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true", help="Refresh official metalink and source tile (~18 MB), verify its checksum, retain only dorm objects")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    if args.fetch:
        fetch()
    rebuild(args.output)
