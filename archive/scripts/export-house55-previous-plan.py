#!/usr/bin/env python3
"""Export the audited historical House 55 plan for visual comparison only."""

import argparse
import hashlib
import json
import math
from pathlib import Path


AUDIT_PATH = "docs/data/house55-recovery-audit.json"
STUDY_PATH = "public/data/interior-studies.json"
EXPECTED_AUDIT_INPUTS = {
    "data/source/house55-2og-study-provenance.json",
    STUDY_PATH,
    "public/data/lod2.json",
    "data/source/house55-2og-r-alignment-baseline.json",
}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def export_plan(repo):
    audit_bytes = (repo / AUDIT_PATH).read_bytes()
    audit = json.loads(audit_bytes)
    if str(audit["house"]) != "55" or audit["levelIndex"] != 2:
        raise ValueError("Expected the House 55 top-floor historical audit.")
    if audit["currentStage"] != "rAlignment":
        raise ValueError("Review this exporter before changing its historical stage.")
    if set(audit["inputs"]) != EXPECTED_AUDIT_INPUTS:
        raise ValueError("The historical audit must name its four expected inputs.")

    verified_bytes = {}
    for path, evidence in audit["inputs"].items():
        data = (repo / path).read_bytes()
        if sha256(data) != evidence["sha256"]:
            raise ValueError(f"Historical audit input changed: {path}; refresh the audit.")
        verified_bytes[path] = data

    study = json.loads(verified_bytes[STUDY_PATH])
    level = next(
        item for item in study["buildings"]["55"]["levels"] if item["index"] == 2
    )
    transform = audit["raw"]["transform"]
    origin = transform["originCampusXZ"]
    axis_u, axis_v = transform["axisU"], transform["axisV"]
    if not all(
        abs(value) < 1e-9
        for value in (
            sum(x * x for x in axis_u) - 1,
            sum(x * x for x in axis_v) - 1,
            sum(x * y for x, y in zip(axis_u, axis_v)),
        )
    ):
        raise ValueError("Historical study axes must be orthonormal.")

    def point(value):
        if len(value) != 2 or not all(math.isfinite(x) for x in value):
            raise ValueError("Expected a finite campus X/Z point.")
        offset = [value[i] - origin[i] for i in range(2)]
        return [
            sum(offset[i] * axis[i] for i in range(2))
            for axis in (axis_u, axis_v)
        ]

    def polygon(record, outer_key):
        return {
            "outer": [point(p) for p in record[outer_key]],
            "holes": [[point(p) for p in ring] for ring in record.get("holes", [])],
        }

    rooms = []
    for record in audit["raw"]["rooms"]:
        ring = record["internalPolygonStudyCoordinates"]
        if len(ring) < 4 or any(
            len(p) != 2 or not all(math.isfinite(x) for x in p) for p in ring
        ):
            raise ValueError(f"Invalid audited room polygon: {record['room']}")
        extents = [
            max(p[axis] for p in ring) - min(p[axis] for p in ring)
            for axis in range(2)
        ]
        rooms.append(
            {
                "label": record["room"],
                "bank": record["bank"],
                "polygon": ring,
                "width": min(extents),
                "depth": max(extents),
                "area": record["conditionalInternalArea"],
            }
        )
    labels = {room["label"] for room in rooms}
    source_labels = {
        space["shortLabel"] for space in level["spaces"] if space["kind"] == "room"
    }
    if len(rooms) != 20 or len(labels) != 20 or labels != source_labels:
        raise ValueError("Expected the same twenty unique historical room references.")

    stairs = [space for space in level["spaces"] if space["kind"] == "stairs"]
    if len(stairs) != 1:
        raise ValueError("Expected one historical stair enclosure.")
    corridors = [
        {
            "label": space["shortLabel"],
            "polygons": [polygon(space, "polygon")],
        }
        for space in level["spaces"]
        if space["kind"] == "corridor"
    ]
    return {
        "schemaVersion": 1,
        "house": "55",
        "levelIndex": 2,
        "label": "Previous plan",
        "status": "historical-comparison-only",
        "units": {"length": "metres", "area": "square metres"},
        "coordinateFrame": {
            "name": "studyUV",
            "originCampusXZ": origin,
            "axisU": axis_u,
            "axisV": axis_v,
        },
        "sourceHashes": {
            AUDIT_PATH: sha256(audit_bytes),
            **{path: value["sha256"] for path, value in audit["inputs"].items()},
        },
        "notes": [
            "Historical polygons only; no withdrawn stair-share constraint is applied.",
            "Rooms use the audited conditional internal envelopes; widths and depths "
            "are study-axis bounding extents, not surveyed wall-face dimensions.",
            "Corridors and stair retain the former gross allocation polygons.",
            "Door targets are omitted because their gross allocation positions do "
            "not establish openings on the displayed internal room faces.",
            "New measurement evidence is outside this historical audit's four inputs.",
        ],
        "floorOutline": [polygon(record, "outer") for record in level["floorOutline"]],
        "rooms": rooms,
        "corridors": corridors,
        "stair": {
            "polygon": polygon(stairs[0], "polygon")["outer"],
            "zones": [],
        },
        "doors": [],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument(
        "--output", type=Path, default=Path("public/house55-study/previous.json")
    )
    args = parser.parse_args()
    repo = args.repo.resolve()
    result = export_plan(repo)
    destination = args.output if args.output.is_absolute() else repo / args.output
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(destination.name + ".tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(destination)
    print(f"Exported {len(result['rooms'])} historical rooms to {destination}")


if __name__ == "__main__":
    main()
