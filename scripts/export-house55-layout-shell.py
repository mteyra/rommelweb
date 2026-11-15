#!/usr/bin/env python3
"""Export the active digital-twin floor mask for the fixed-area room sandbox."""

import argparse
import hashlib
import json
import math
from pathlib import Path


def export(repo):
    source_hashes = {}

    def load(path):
        data = (repo / path).read_bytes()
        source_hashes[path] = hashlib.sha256(data).hexdigest()
        return json.loads(data)

    studies = load("public/data/interior-studies.json")
    approved = load("public/data/interiors.json")
    provenance = load("data/source/house55-2og-study-provenance.json")
    lod2 = load("public/data/lod2.json")
    comparison = load("public/house55-study/plan.json")
    if approved.get("buildings", {}).get("55"):
        raise ValueError("Review the exporter: an approved House 55 interior now exists.")
    level = next(p for p in studies["buildings"]["55"]["levels"] if p["index"] == 2)
    if level.get("layoutBasis") == "resident-module-layout":
        raise ValueError(
            "The active floor uses the independent module layout. "
            "Regenerate it and the sandbox together with npm run layout:build."
        )
    if len(level["floorOutline"]) != 1:
        raise ValueError("Review sandbox schema before exporting multiple floor components.")
    axes = provenance["registration"]["localAxesInCampusXZ"]
    origin = provenance["registration"]["localOriginInCampusXZ"]
    axis_u, axis_v = axes["x"], axes["y"]
    dot = lambda a, b: sum(x * y for x, y in zip(a, b))
    if any(abs(x) > 1e-9 for x in [
        dot(axis_u, axis_u) - 1, dot(axis_v, axis_v) - 1, dot(axis_u, axis_v),
        axis_u[0] * axis_v[1] - axis_u[1] * axis_v[0] - 1,
    ]):
        raise ValueError("The source-to-study transform must be a rigid rotation.")

    def transform(point):
        q = [point[i] - origin[i] for i in range(2)]
        return [dot(q, axis_u), dot(q, axis_v)]

    def ring(points):
        return [transform(point) for point in points]

    piece = level["floorOutline"][0]
    shell = {
        "outline": ring(piece["outer"]),
        "holes": [ring(hole) for hole in piece.get("holes", [])],
    }
    normalized = json.dumps(shell, ensure_ascii=False, separators=(",", ":"))
    shell_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    records = {r["label"]: r for r in provenance["areaStudy"]["rooms"]}
    records.update({r["label"]: r for r in provenance["rAlignment"]["rooms"]})

    def placement(points):
        twice_area = sum(
            a[0] * b[1] - b[0] * a[1] for a, b in zip(points, points[1:])
        )
        if abs(twice_area) < 1e-9:
            raise ValueError("A source room polygon is degenerate.")
        center = [
            sum(
                (a[axis] + b[axis]) * (a[0] * b[1] - b[0] * a[1])
                for a, b in zip(points, points[1:])
            ) / (3 * twice_area)
            for axis in range(2)
        ]
        extents = [
            max(p[axis] for p in points) - min(p[axis] for p in points)
            for axis in range(2)
        ]
        return center, min(extents), max(extents)

    rooms, source_placement = [], {}
    for space in level["spaces"]:
        if space["kind"] != "room":
            continue
        label = space["shortLabel"]
        bank = records[label]["bank"]
        rotation = 90 if bank in ("W", "E") else 0
        polygon = ring(space["polygon"])
        center, width, depth = placement(polygon)
        rooms.append({
            "id": label, "label": label, "bank": bank,
            "x": center[0], "y": center[1],
            "width": 3.0, "depth": 16.4 / 3.0, "rotation": rotation,
        })
        source_placement[label] = {
            "sourceId": space["id"], "polygon": polygon,
            "x": center[0], "y": center[1], "width": width, "depth": depth,
            "rotation": rotation, "status": "previous-estimated-room-allocation",
        }
    if len(rooms) != 20 or len({room["id"] for room in rooms}) != 20:
        raise ValueError("Expected twenty unique House 55 top-floor room labels.")

    banks = []
    for bank in ("A", "W", "L", "R", "E", "N"):
        members = [room for room in rooms if room["bank"] == bank]
        axis = "y" if bank in ("W", "E") else "x"
        members.sort(key=lambda room: room[axis])
        banks.append({
            "id": bank, "roomIds": [room["id"] for room in members], "axis": axis,
            "anchor": [members[0]["x"], members[0]["y"]],
            "anchorStatus": "initial-room-center-not-a-measured-wall-anchor",
        })
    excluded = [
        {"id": item["id"], "label": item["label"], "polygon": ring(item["polygon"]),
         "alreadyExcluded": True}
        for item in level.get("excludedAreas", [])
    ]
    if len(excluded) != 2:
        raise ValueError("Expected the two resident-marked no-floor cutouts.")
    building = next(b for b in lod2["buildings"] if b["number"] == "55")
    roof = building["surfaces"][39]
    if roof["type"] != "RoofSurface":
        raise ValueError("The retained flat-roof guide source changed.")
    flat = ring([[p[0], p[2]] for p in roof["points"]])
    candidate = comparison["candidate"]
    candidate_shell = candidate["floorOutline"][0]
    if len(candidate_shell["outer"]) != len(shell["outline"]) or any(
        math.dist(a, b) > 1e-9
        for a, b in zip(candidate_shell["outer"], shell["outline"])
    ) or candidate_shell.get("holes", []) != shell["holes"]:
        raise ValueError("Comparison candidate and active digital twin use different masks.")
    stair = candidate["stair"]
    overlays = {
        "defaultVisible": False, "positionAssumed": True,
        "status": "measured-width-references-with-estimated-plan-positions",
        "corridors": [
            {"label": c["label"], "polygon": c["polygon"], "width": 1.30,
             "positionAssumed": True}
            for c in candidate["corridors"]
        ],
        "stair": {
            "polygon": stair["polygon"], "width": 2.72, "positionAssumed": True,
            "lengthMeasured": False,
            "zones": [
                {"label": "Flight + railing/gap", "width": 1.43,
                 "polygon": stair["flightGuardZone"]["polygon"]},
                {"label": "Level walkway", "width": 1.29,
                 "polygon": stair["walkway"]["polygon"]},
            ],
        },
    }
    dimensions = [
        {"a": a, "b": b, "length": math.dist(a, b)}
        for a, b in zip(shell["outline"], shell["outline"][1:])
        if math.dist(a, b) > 1e-9
    ]
    return {
        "schemaVersion": 1, "house": "55", "levelIndex": 2,
        "units": "metres", "targetArea": 16.4,
        "coordinateFrame": {
            "name": "studyUV", "originCampusXZ": origin,
            "axisU": axis_u, "axisV": axis_v,
            "rotationDegrees": math.degrees(math.atan2(axis_u[1], axis_u[0])),
        },
        "sourceHashes": source_hashes,
        "shell": shell, "shellHash": shell_hash,
        "shellHashMethod": "SHA-256 of UTF-8 compact JSON of shell in retained ring order.",
        "excludedVoids": excluded,
        "flatRoofGuide": {"outline": flat, "holes": []},
        "rooms": rooms, "sourcePlacement": source_placement, "banks": banks,
        "referenceOverlays": overlays, "dimensions": dimensions,
        "notes": [
            "The shell is the active digital-twin House 55 index-2 floorOutline, "
            "transformed by a rigid rotation without rescaling.",
            "Both resident no-floor cutouts are already removed through the concave "
            "outline; excludedVoids are overlays, not additional holes.",
            "Initial rectangles each have exactly 16.4 square metres at prior room "
            "centers. Their initial placement is editable and may conflict.",
            "Reference hallway and stair widths are measured; their displayed "
            "positions and stair length remain estimates.",
            "This keeps the digital twin's existing provisional floor elevation "
            "and low-roof margins; it is not a new building survey.",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument(
        "--output", type=Path, default=Path("public/house55-layout/shell.json")
    )
    args = parser.parse_args()
    repo = args.repo.resolve()
    output = args.output if args.output.is_absolute() else repo / args.output
    data = export(repo)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + ".tmp")
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(output)
    print(f"Exported {len(data['rooms'])} rooms and exact twin shell to {output}")
    print(f"Shell SHA-256: {data['shellHash']}")


if __name__ == "__main__":
    main()
