#!/usr/bin/env python3
"""Compare the saved House 55 study with the resident's stair measurements.

These width-only counterfactuals hold the saved longitudinal coordinates and
reference line. They are conflict probes, never a proposed corrected plan.

Example:
    python scripts/audit-house55-stair-measurement.py \
      --output docs/data/house55-stair-measurement-audit.json

The standard-library polygon routines come from audit-house55-recovery.py,
independently of the app's polygon implementation. No app geometry is changed.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path


def compute(repo):
    audit = repo / "scripts/audit-house55-recovery.py"
    spec = importlib.util.spec_from_file_location("house55_independent_audit", audit)
    geom = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(geom)
    provenance_path = repo / "data/source/house55-2og-study-provenance.json"
    study_path = repo / "public/data/interior-studies.json"
    lod_path = repo / "public/data/lod2.json"
    measurement_path = repo / "data/source/house55-2og-stair-measurements.json"
    metadata = json.loads(provenance_path.read_text())
    studies = json.loads(study_path.read_text())
    lod = json.loads(lod_path.read_text())
    measurement = json.loads(measurement_path.read_text())
    widths = measurement["widths"]
    width = float(widths["totalWallToWallMetres"])
    stair_zone = float(widths["stairAndCentralGuardMetres"])
    walkway = float(widths["levelWalkwayMetres"])
    if not all(math.isfinite(w) and w > 0 for w in [width, stair_zone, walkway]):
        raise ValueError("Stair measurements must be positive finite lengths")
    if abs(stair_zone + walkway - width) > 1e-9:
        raise ValueError("The two measured zones do not sum to wall-to-wall width")
    if metadata["currentStage"] != "rAlignment":
        raise ValueError("This diagnostic requires rAlignment; review before adapting")
    level = next(l for l in studies["buildings"]["55"]["levels"] if l["index"] == 2)
    building = next(b for b in lod["buildings"] if b["number"] == "55")
    axes = metadata["registration"]["localAxesInCampusXZ"]
    origin = metadata["registration"]["localOriginInCampusXZ"]

    def local(point):
        return [sum((point[i] - origin[i]) * axes[k][i] for i in range(2))
                for k in ["x", "y"]]

    def polygon(record, key="polygon"):
        return {"outer": list(map(local, record[key])),
                "holes": [list(map(local, h)) for h in record.get("holes", [])]}

    surface = building["surfaces"][39]
    if surface["type"] != "RoofSurface":
        raise ValueError("The retained reference surface is no longer a roof")
    source = [local([p[0], p[2]]) for p in surface["points"]]
    reference_indexes = metadata["rAlignment"]["staircase"]["referenceSourceVertexIndexes"]
    ref_a, ref_b = [source[i] for i in reference_indexes]
    tangent = geom.sub(ref_b, ref_a)
    tangent = [a / math.hypot(*tangent) for a in tangent]
    normal = [tangent[1], -tangent[0]]
    stair = next(s for s in level["spaces"] if s["kind"] == "stairs")
    original = polygon(stair)
    profile = [geom.dot(geom.sub(p, ref_a), normal) for p in original["outer"]]
    old_left, old_right = min(profile), max(profile)
    old_width = old_right - old_left
    if width <= old_width:
        raise ValueError("This expansion diagnostic requires a larger measured width")
    spaces = {s["shortLabel"]: polygon(s) for s in level["spaces"]}
    plate = [t for p in level["floorOutline"]
             for t in geom.signed_triangles(polygon(p, "outer"))]
    flat = geom.signed_triangles({"outer": source})

    def scenario(name, left_share=None):
        # The affine transverse expansion leaves every longitudinal coordinate
        # unchanged, carrying the small end-face skew through the expansion.
        new_left = old_left if left_share is None else -width * left_share
        new_right = new_left + width

        def expand(p):
            before = geom.dot(geom.sub(p, ref_a), normal)
            after = new_left + (before - old_left) * width / old_width
            return [p[i] + normal[i] * (after - before) for i in range(2)]

        candidate = {"outer": list(map(expand, original["outer"]))}
        tri = geom.signed_triangles(candidate)
        candidate_area = geom.polygon_area(candidate)
        intersected_spaces = {}
        for label, shape in spaces.items():
            amount = geom.intersection_area(tri, geom.signed_triangles(shape))
            if amount > 1e-6:
                intersected_spaces[label] = amount
        in_plate = geom.intersection_area(tri, plate)
        in_flat = geom.intersection_area(tri, flat)
        old_area = geom.polygon_area(original)
        scaling_residual = candidate_area - old_area * width / old_width
        if abs(scaling_residual) > 1e-7:
            raise ValueError("Affine expansion failed its independent area-scaling check")
        return {
            "name": name,
            "interpretation": "Width-only conflict probe; not a refitted physical plan.",
            "newWidth": width,
            "newL3SideDistance": -new_left,
            "newR1SideDistance": new_right,
            "newL3ReferenceShare": -new_left / width,
            "L3SideOutwardMotion": old_left - new_left,
            "R1SideOutwardMotion": new_right - old_right,
            "oldArea": old_area,
            "candidateArea": candidate_area,
            "addedArea": candidate_area - old_area,
            "areaScalingResidual": scaling_residual,
            "candidatePolygonStudyCoordinates": candidate["outer"],
            "intersectionWithSavedSpaces": intersected_spaces,
            "outsideSavedFloorPlateArea": max(0, candidate_area - in_plate),
            "outsideSourceFlatRoofProjectionArea": max(0, candidate_area - in_flat),
            "sumIntersectionWithSavedSpaces": sum(intersected_spaces.values()),
            "notAllocatedToSavedSpaces": candidate_area - sum(intersected_spaces.values()),
        }

    l3 = next(r for r in metadata["areaStudy"]["rooms"] if r["label"] == "L3")
    r1 = next(r for r in metadata["rAlignment"]["rooms"] if r["label"] == "R1")
    left_room_edge = next(e for e in l3["edgeOffsets"] if e["kind"] == "bank-end")
    right_room_edge = next(e for e in r1["edgeOffsets"] if e["kind"] == "bank-end")

    def u_at(edge, v):
        return (edge["constant"] - edge["normal"][1] * v) / edge["normal"][0]

    shared_v_low = max(min(p[1] for p in spaces["L3"]["outer"]),
                       min(p[1] for p in spaces["R1"]["outer"]))
    shared_v_high = min(max(p[1] for p in spaces["L3"]["outer"]),
                        max(p[1] for p in spaces["R1"]["outer"]))
    gap_sections = []
    for v in [shared_v_low, shared_v_high]:
        left_point = [u_at(left_room_edge, v), v]
        gap = u_at(right_room_edge, v) - left_point[0]
        normal_gap = (
            right_room_edge["constant"] - geom.dot(right_room_edge["normal"], left_point)
        ) / geom.dot(right_room_edge["normal"], normal)
        gap_sections.append({
            "studyV": v,
            "grossGapAlongStudyU": gap,
            "grossGapAlongReferenceNormal": normal_gap,
            "axisVsNormalGapDifference": normal_gap - gap,
            "minimumGapDeficitAgainstMeasuredWidth": width - normal_gap,
        })
    flight = list(map(local, stair["stairFlight"]))
    flight_profile = [geom.dot(geom.sub(p, ref_a), normal) for p in flight]
    old_flight_width = max(flight_profile) - min(flight_profile)
    return {
        "schemaVersion": 1,
        "purpose": "Historical diagnostic: falsify simultaneous saved wall placement and resident-measured stair width. Superseded by the joint measured-plan candidate.",
        "ratioHypothesesRetired": True,
        "retirementNote": "The resident withdrew the guessed reference percentages. Ratio-based scenarios here explain earlier failed fits and impose no constraint on the new candidate.",
        "units": {"length": "metres", "area": "square metres"},
        "inputHashes": {
            str(p.relative_to(repo)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in [provenance_path, study_path, lod_path, measurement_path]
        },
        "sourceStage": metadata["currentStage"],
        "measurement": {
            "totalWallToWall": width,
            "stairSideIncludingCentralRailingAndGap": stair_zone,
            "levelWalkwaySide": walkway,
            "arithmeticCheck": stair_zone + walkway,
            "sourceRecord": str(measurement_path.relative_to(repo)),
            "limitation": (
                "The stair-side zone includes the central guard/gap and is not clear flight width. "
                "No measured exterior/partition wall thickness, exact rail faces, longitudinal "
                "anchor or floor elevation is introduced by this audit."
            ),
        },
        "currentEnclosure": {
            "width": old_width,
            "l3SideDistance": -old_left,
            "r1SideDistance": old_right,
            "area": geom.polygon_area(original),
            "widthShortfall": width - old_width,
            "requiredWidthIncreaseFraction": width / old_width - 1,
            "symbolicFlightWidth": old_flight_width,
            "symbolicFlightExcessOverMeasuredStairAndGuardZone": old_flight_width - stair_zone,
        },
        "crossSectionDirection": {
            "referenceNormalInStudyUV": normal,
            "angleDegreesFromStudyU": math.degrees(math.atan2(normal[1], normal[0])),
            "qualification": (
                "Study-U gap and reference-normal gap are calculated separately. Their directions "
                "differ by approximately 0.03 degrees in this saved stage, far too little to explain "
                "the roughly 0.65 m deficit. The deficit uses the reference-normal calculation."
            ),
        },
        "sharedL3R1GapSections": gap_sections,
        "assumptions": [
            "Tests compare measured inside width directly with old gross allocation: zero wall allowance is added. These are optimistic width-conflict probes.",
            "Original longitudinal coordinates and reference line stay fixed; only transverse coordinates change.",
            "25/75 and 20/80 are historical placement assumptions, independent of the measured stair/guard versus walkway split.",
            "Inside-width measurement overrides older inferred width, but does not itself locate either wall in campus coordinates.",
            "Printed floating-point precision is calculation precision, not measurement accuracy.",
        ],
        "scenarios": [
            scenario("keep current L3-side wall"),
            scenario("retain historical 25/75 reference split", .25),
            scenario("retain historical 20/80 reference split", .2),
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--repo", type=Path, default=Path(__file__).resolve().parents[1],
        help="Rommelweb checkout to read; defaults to this script's repository",
    )
    parser.add_argument(
        "--output", type=Path,
        help="Write the JSON report here; omit to print it to stdout",
    )
    args = parser.parse_args()
    report = compute(args.repo.resolve())
    text = json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    if args.output:
        args.output.write_text(text)
        print(json.dumps({
            "output": str(args.output.resolve()),
            "sourceStage": report["sourceStage"],
            "measurement": report["measurement"],
            "currentEnclosure": report["currentEnclosure"],
            "crossSectionDirection": report["crossSectionDirection"],
        }, indent=2))
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
