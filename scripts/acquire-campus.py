#!/usr/bin/env python3
"""Rebuild public campus geometry from retained OSM data; --fetch refreshes sources.

No extra Python packages required. Only public buildings, roads, paths and trees
are requested. Residential identities, contacts and occupancy are never fetched.
"""
import argparse
import datetime
import json
import math
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data" / "source"
OUT = ROOT / "public" / "data"
ORIGIN = {"latitude": 49.5766, "longitude": 11.0298}
RADIUS = 6371008.8
BOUNDS = {"west": 11.0280, "south": 49.5755, "east": 11.0316, "north": 49.5778}
QUERY = """[out:json][timeout:60];(
way[building](49.5755,11.0280,49.5778,11.0316);
way[highway](49.5755,11.0280,49.5778,11.0316);
node[natural=tree](49.5755,11.0280,49.5778,11.0316);
);out body geom;"""
# Address-to-colour/wing mapping, published by the resident association.
HOUSES = {
    "49": ("Black", "#97a8b2", [11]),
    "51": ("Yellow", "#f5cc6b", [7, 8]),
    "51a": ("Blue", "#72aaff", [16]),
    "53": ("Orange", "#f4a56e", [9, 10]),
    "53a": ("Purple", "#b49af5", [12]),
    "55": ("Red", "#f17e7f", [1, 2]),
    "55a": ("Grey", "#a5b6bb", [13]),
    "57": ("White", "#e9f1ec", [3, 4]),
    "57a": ("Turquoise", "#72dcca", [14]),
    "59": ("Green", "#acd394", [5, 6]),
    "59a": ("Pink", "#eb9dbb", [15]),
}


def request(url, data=None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": "rommelweb-public-map-research/1.0"})
    with urllib.request.urlopen(req, timeout=90) as response:
        return response.read()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def fetch(endpoint):
    raw = request(endpoint, urllib.parse.urlencode({"data": QUERY}).encode())
    data = json.loads(raw)
    if "elements" not in data or data.get("remark"):
        raise ValueError(f"Incomplete Overpass response: {data.get('remark', 'no elements')}")
    write_json(SOURCE / "osm-raw.json", data)
    html = request("https://rommelwood.de/map/").decode("utf-8")
    markers = []
    # Select only house markers; do not persist the complete HTML or other data.
    for match in re.finditer(r"'house_([^']+)': \{(.*?)group: 'HOUSES',\s*\}", html, re.S):
        number, block = match.groups()
        markers.append({
            "number": number,
            "lat": float(re.search(r"location_latitude: ([\d.]+)", block)[1]),
            "lon": float(re.search(r"location_longitude: ([\d.]+)", block)[1]),
        })
    if set(marker["number"] for marker in markers) != set(HOUSES):
        raise ValueError("Resident map house markers changed; review before replacing data")
    write_json(SOURCE / "house-markers.json", markers)
    write_json(SOURCE / "retrieval.json", {"retrievedAt": datetime.datetime.now(datetime.timezone.utc).isoformat()})


def project(lon, lat):
    return [
        round(math.radians(lon - ORIGIN["longitude"]) * RADIUS * math.cos(math.radians(ORIGIN["latitude"])), 3),
        round(-math.radians(lat - ORIGIN["latitude"]) * RADIUS, 3),
    ]


def centroid(points):
    signed_double_area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:]))
    if abs(signed_double_area) < 0.01:
        raise ValueError("Degenerate footprint")
    return [round(sum((a[d] + b[d]) * (a[0] * b[1] - b[0] * a[1]) for a, b in zip(points, points[1:])) / (3 * signed_double_area), 3) for d in (0, 1)]


def build():
    data = json.loads((SOURCE / "osm-raw.json").read_text())
    markers = json.loads((SOURCE / "house-markers.json").read_text())
    retrieval = SOURCE / "retrieval.json"
    retrieved_at = json.loads(retrieval.read_text())["retrievedAt"] if retrieval.exists() else "2026-11-14"
    buildings, context, features = [], [], []
    for element in data["elements"]:
        tags = element.get("tags", {})
        osm_url = f"https://www.openstreetmap.org/{element['type']}/{element['id']}"
        if element["type"] == "node":
            geo = {"type": "Point", "coordinates": [element["lon"], element["lat"]]}
            points = project(element["lon"], element["lat"])
        else:
            coordinates = [[point["lon"], point["lat"]] for point in element["geometry"]]
            geo = {"type": "Polygon", "coordinates": [coordinates]} if tags.get("building") else {"type": "LineString", "coordinates": coordinates}
            points = [project(*point) for point in coordinates]
        number = tags.get("addr:housenumber")
        is_dorm = tags.get("building") == "dormitory" and tags.get("addr:street") == "Erwin-Rommel-Straße" and number in HOUSES
        if is_dorm:
            if coordinates[0] != coordinates[-1]:
                raise ValueError(f"House {number} footprint is not closed")
            name, colour, wings = HOUSES[number]
            levels = int(tags["building:levels"])
            marker = next(item for item in markers if item["number"] == number)
            building = {
                "id": f"house-{number}", "number": number,
                "address": f"Erwin-Rommel-Straße {number}",
                "campus": "II" if number.endswith("a") or number == "49" else "I",
                "name": f"{name} house", "color": colour, "wings": wings,
                "levels": levels, "height": levels * 3.0, "floorHeight": 3,
                "heightStatus": "estimated",
                "heightNote": "Visualization uses 3 m per storey. No surveyed heights or detailed roof geometry available.",
                "footprint": points, "centroid": centroid(points), "coordinates": coordinates,
                "marker": project(marker["lon"], marker["lat"]),
                "osmId": element["id"], "osmUrl": osm_url, "tags": tags,
                "geometryStatus": "OSM mapped footprint", "levelsStatus": "OSM building:levels",
                "interiorStatus": "Room point locations available separately; walls and dimensions unverified.",
            }
            buildings.append(building)
            features.append({"type": "Feature", "id": building["id"], "properties": {key: value for key, value in building.items() if key not in ["footprint", "centroid", "coordinates", "marker"]}, "geometry": geo})
        else:
            item_id = f"{element['type']}/{element['id']}"
            features.append({"type": "Feature", "id": item_id, "properties": {"osmId": element["id"], "osmType": element["type"], "osmUrl": osm_url, **tags}, "geometry": geo})
            item = {"id": item_id, "kind": "tree" if tags.get("natural") == "tree" else "building" if tags.get("building") else "path", "tags": tags, "points": points, "osmUrl": osm_url}
            if item["kind"] == "building":
                item["levels"] = int(tags.get("building:levels", 1))
                item["height"] = item["levels"] * 3
            context.append(item)
    if len(buildings) != 11 or set(building["number"] for building in buildings) != set(HOUSES):
        raise ValueError("Expected all 11 uniquely address-tagged dorm footprints; review changed OSM data")
    buildings.sort(key=lambda building: (int(building["number"].rstrip("a")), building["number"]))
    metadata = {
        "version": 1, "retrievedAt": retrieved_at, "osmTimestamp": data["osm3s"]["timestamp_osm_base"],
        "origin": ORIGIN,
        "projection": {"type": "local equirectangular", "units": "metres", "axes": {"x": "east", "z": "south", "y": "up"}, "earthRadius": RADIUS, "formula": "x = radians(lon - origin.longitude) * radius * cos(radians(origin.latitude)); z = -radians(lat - origin.latitude) * radius"},
        "license": "ODbL-1.0", "attribution": "© OpenStreetMap contributors", "copyrightUrl": "https://www.openstreetmap.org/copyright",
        "sources": [
            {"id": "osm", "url": "https://www.openstreetmap.org/#map=18/49.5766/11.0298", "usage": "All footprints, building level counts and context geometry"},
            {"id": "rommelmap", "url": "https://rommelwood.de/map/", "usage": "House marker labels and points"},
            {"id": "houses", "url": "https://rommelwood.de/wohnen/h%C3%A4user/", "usage": "Colour and wing number convention"},
        ],
        "bounds": BOUNDS,
        "uncertainties": [
            "Building heights are an estimated 3m per storey, not measured.",
            "OSM footprints and levels are mapped, not survey-certified.",
            "Detailed pitched roof profiles, facades, interior walls and room polygons are not modeled.",
            "Nearby contextual buildings/ways extend outside query bounds; UI should clip its own drawing extent.",
        ],
    }
    write_json(OUT / "campus.json", {"metadata": metadata, "buildings": buildings, "context": context})
    write_json(OUT / "campus.geojson", {"type": "FeatureCollection", "metadata": metadata, "features": features})
    print(f"Rebuilt {len(buildings)} dorms and {len(context)} context elements from retained public source data.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fetch", action="store_true", help="Refresh public Overpass and resident-map house markers before rebuilding")
    parser.add_argument("--endpoint", default="https://overpass-api.de/api/interpreter", help="Overpass interpreter endpoint for --fetch")
    args = parser.parse_args()
    if args.fetch:
        fetch(args.endpoint)
    build()
