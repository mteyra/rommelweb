#!/usr/bin/env python3
"""Recompute House 55's current conditional study using only Python's stdlib.

Example:
  python scripts/audit-house55-recovery.py \
    --repo /home/haunted/Projects/rommelweb \
    --output docs/data/house55-recovery-audit.json

This diagnoses the saved rAlignment study. It does not change the repository,
infer measured dimensions, regenerate the application, or approve an interior.
Polygon intersections use ear triangulation and convex half-plane clipping,
independently of the application's polyclip-ts and the older Shapely audit.
"""

import argparse
from collections import Counter, defaultdict
import hashlib
import json
import math
from pathlib import Path

EPS = 1e-10


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def sub(a, b):
    return [x - y for x, y in zip(a, b)]


def cross(a, b, c):
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])


def open_ring(ring):
    points = [list(p) for p in ring]
    if len(points) > 1 and math.dist(points[0], points[-1]) < EPS:
        points.pop()
    return points


def signed_area(ring):
    points = open_ring(ring)
    if len(points) < 3:
        return 0.0
    # Subtract an origin to limit cancellation at large coordinate values.
    origin = points[0]
    points = [sub(p, origin) for p in points]
    return sum(a[0] * b[1] - a[1] * b[0]
               for a, b in zip(points, points[1:] + points[:1])) / 2


def area(ring):
    return abs(signed_area(ring))


def bounds(points):
    return [min(p[0] for p in points), min(p[1] for p in points),
            max(p[0] for p in points), max(p[1] for p in points)]


def extents(points):
    a, b, c, d = bounds(points)
    return [c - a, d - b]


def half_plane_clip(points, normal, constant):
    """Retain n dot q >= constant, where the normal need not be unit length."""
    result = []
    points = open_ring(points)
    for a, b in zip(points, points[1:] + points[:1]):
        da, db = dot(normal, a) - constant, dot(normal, b) - constant
        if da >= -EPS:
            result.append(a)
        if (da >= 0) != (db >= 0):
            t = da / (da - db)
            result.append([a[i] + t * (b[i] - a[i]) for i in range(2)])
    return result


def clean_ring(ring):
    points = []
    for p in open_ring(ring):
        if not points or math.dist(p, points[-1]) > EPS:
            points.append(p)
    if len(points) > 1 and math.dist(points[0], points[-1]) <= EPS:
        points.pop()
    original_area = area(points)
    changed = True
    while changed and len(points) > 3:
        changed = False
        for i in range(len(points)):
            a, b, c = points[i - 1], points[i], points[(i + 1) % len(points)]
            if abs(cross(a, b, c)) <= EPS and dot(sub(b, a), sub(b, c)) <= EPS:
                points.pop(i)
                changed = True
                break
    if abs(area(points) - original_area) > 1e-7:
        raise ValueError("Ring cleanup changed material area")
    return points


def triangulate(ring):
    """Ear-clip a simple ring; holes are handled as signed separate rings."""
    points = clean_ring(ring)
    if len(points) < 3 or area(points) < EPS:
        return []
    if signed_area(points) < 0:
        points.reverse()
    initial_area = area(points)
    result = []
    while len(points) > 3:
        for i in range(len(points)):
            a, b, c = points[i - 1], points[i], points[(i + 1) % len(points)]
            if cross(a, b, c) <= EPS:
                continue
            other = [p for j, p in enumerate(points)
                     if j not in {(i - 1) % len(points), i, (i + 1) % len(points)}]
            if any(cross(a, b, p) >= -EPS and cross(b, c, p) >= -EPS
                   and cross(c, a, p) >= -EPS for p in other):
                continue
            result.append([a, b, c])
            points.pop(i)
            break
        else:
            raise ValueError("Cannot triangulate ring; invalid or numerically ambiguous geometry")
    result.append(points)
    if abs(sum(area(t) for t in result) - initial_area) > 1e-6:
        raise ValueError("Triangulation failed area conservation")
    return result


def convex_intersection_area(a, b):
    clipped = a
    for p, q in zip(b, b[1:] + b[:1]):
        normal = [p[1] - q[1], q[0] - p[0]]
        clipped = half_plane_clip(clipped, normal, dot(normal, p))
        if len(clipped) < 3:
            return 0.0
    return area(clipped)


def signed_triangles(polygon):
    return [(triangle, sign)
            for ring, sign in [(polygon["outer"], 1),
                               *[(hole, -1) for hole in polygon.get("holes", [])]]
            for triangle in triangulate(ring)]


def intersection_area(triangles_a, triangles_b):
    # The signed expansion handles both polygon holes and multiple components.
    total = 0.0
    for a, sa in triangles_a:
        ba = bounds(a)
        for b, sb in triangles_b:
            bb = bounds(b)
            if ba[2] < bb[0] or bb[2] < ba[0] or ba[3] < bb[1] or bb[3] < ba[1]:
                continue
            total += sa * sb * convex_intersection_area(a, b)
    return max(0.0, total) if total > -1e-7 else total


def polygon_area(polygon):
    return area(polygon["outer"]) - sum(area(h) for h in polygon.get("holes", []))


def round_numbers(value, places=6):
    if isinstance(value, float):
        return round(value, places)
    if isinstance(value, dict):
        return {key: round_numbers(item, places) for key, item in value.items()}
    if isinstance(value, list):
        return [round_numbers(item, places) for item in value]
    return value


def compute(repo):
    provenance_path = "data/source/house55-2og-study-provenance.json"
    study_path = "public/data/interior-studies.json"
    lod_path = "public/data/lod2.json"

    def load(path):
        return json.loads((repo / path).read_text())

    def digest(path):
        return hashlib.sha256((repo / path).read_bytes()).hexdigest()

    metadata = load(provenance_path)
    if metadata.get("currentStage") != "rAlignment":
        raise ValueError("This diagnostic requires currentStage=rAlignment; review before adapting")
    house, index = str(metadata["house"]), metadata["levelIndex"]
    if house != "55" or index != 2:
        raise ValueError("Expected the House 55 / index 2 provenance contract")
    current = metadata["rAlignment"]
    baseline = current["baseline"]
    if digest(baseline["path"]) != baseline["sha256"]:
        raise ValueError("The frozen R-alignment baseline does not match its declared SHA256")
    prior_level = load(baseline["path"])["level"]
    study = load(study_path)["buildings"][house]
    level = next(item for item in study["levels"] if item["index"] == index)
    building = next(item for item in load(lod_path)["buildings"] if item["number"] == house)
    axes = metadata["registration"]["localAxesInCampusXZ"]
    axis_u, axis_v = axes["x"], axes["y"]
    origin = metadata["registration"]["localOriginInCampusXZ"]
    if any(abs(value) > 1e-9 for value in [
        dot(axis_u, axis_u) - 1, dot(axis_v, axis_v) - 1, dot(axis_u, axis_v)
    ]):
        raise ValueError("Study axes are not an orthonormal frame")

    def local(p):
        offset = sub(p, origin)
        return [dot(offset, axis_u), dot(offset, axis_v)]

    def polygon(record, key="polygon"):
        return {"outer": [local(p) for p in record[key]],
                "holes": [[local(p) for p in h] for h in record.get("holes", [])]}

    # Surface 39 and its vertex numbering are the current stage's declared
    # reference system. Verify its type and plane rather than guessing a face.
    roof_surface_index = 39
    roof = building["surfaces"][roof_surface_index]
    roof_y = metadata["registration"]["sourcePlaneCampusY"]
    if roof["type"] != "RoofSurface" or any(abs(p[1] - roof_y) > 1e-8 for p in roof["points"]):
        raise ValueError("The stage's source roof face no longer matches its registration plane")
    flat = [local([p[0], p[2]]) for p in roof["points"]]
    flat_triangles = signed_triangles({"outer": flat})
    plates = [polygon(p, "outer") for p in level["floorOutline"]]
    plate_triangles = [t for p in plates for t in signed_triangles(p)]
    core_area = intersection_area(flat_triangles, plate_triangles)
    spaces = {s["shortLabel"]: polygon(s) for s in level["spaces"]}
    space_triangles = {name: signed_triangles(p) for name, p in spaces.items()}
    source_records = {r["label"]: r for r in metadata["areaStudy"]["rooms"]}
    source_records.update({r["label"]: r for r in current["rooms"]})
    parameters = current["parameters"]
    target = parameters["targetInternalAreaSquareMetres"]
    # A finite initial clipping square is a computational device. Validate it
    # comfortably contains the source footprint; never use it as a room size.
    radius = 2 * max(1, *(abs(v) for p in flat for v in p))

    def internal(record, hall_growth=0):
        points = [[-radius, -radius], [radius, -radius],
                  [radius, radius], [-radius, radius]]
        for edge in record["edgeOffsets"]:
            if abs(math.hypot(*edge["normal"]) - 1) > 1e-8:
                raise ValueError("Perimeter offsets require unit normals")
            growth = hall_growth if edge["kind"] == "hall-allocation" else 0
            if growth and (abs(edge["normal"][0]) > 1e-8 or abs(edge["normal"][1] - 1) > 1e-8):
                raise ValueError("Sensitivity solve only supports the current north-facing R front")
            points = half_plane_clip(points, edge["normal"],
                                     edge["constant"] + edge["allowance"] - growth)
        if not points or any(abs(v) >= radius - 1e-6 for p in points for v in p):
            raise ValueError("An internal polygon is empty or escaped the clipping seed")
        return clean_ring(points)

    rows, by_kind = [], defaultdict(float)
    bank_counts = Counter()
    residuals = {"maxInternalAreaVsProvenance": 0.0, "maxGrossAreaVsProvenance": 0.0,
                 "maxInternalOutsideGross": 0.0, "maxInternalVsSavedPolygonSymmetricDifference": 0.0}
    for space in level["spaces"]:
        name = space["shortLabel"]
        gross = polygon_area(spaces[name])
        by_kind[space["kind"]] += gross
        if space["kind"] != "room":
            continue
        record = source_records[name]
        inferred = internal(record)
        inferred_area = area(inferred)
        inferred_triangles = signed_triangles({"outer": inferred})
        saved = [local(p) for p in record["internalPolygon"]]
        saved_triangles = signed_triangles({"outer": saved})
        inside_gross = intersection_area(inferred_triangles, space_triangles[name])
        residuals["maxInternalOutsideGross"] = max(residuals["maxInternalOutsideGross"],
                                                   inferred_area - inside_gross)
        residuals["maxInternalVsSavedPolygonSymmetricDifference"] = max(
            residuals["maxInternalVsSavedPolygonSymmetricDifference"],
            inferred_area + area(saved) - 2 * intersection_area(inferred_triangles, saved_triangles))
        residuals["maxInternalAreaVsProvenance"] = max(residuals["maxInternalAreaVsProvenance"],
                                                      abs(inferred_area - record["internalArea"]))
        residuals["maxGrossAreaVsProvenance"] = max(residuals["maxGrossAreaVsProvenance"],
                                                   abs(gross - record["grossArea"]))
        bank_counts[record["bank"]] += 1
        rows.append({"room": name, "bank": record["bank"],
                     "recordStage": "rAlignment" if record["bank"] == "R" else "areaStudy",
                     "grossArea": gross, "conditionalInternalArea": inferred_area,
                     "perimeterAllocationArea": gross - inferred_area,
                     "benchmarkArea": target, "benchmarkMinusInternalArea": target - inferred_area,
                     "grossStudyAxisBounds": bounds(spaces[name]["outer"]),
                     "grossStudyAxisExtents": extents(spaces[name]["outer"]),
                     "internalStudyAxisBounds": bounds(inferred),
                     "internalStudyAxisExtents": extents(inferred),
                     "internalPolygonStudyCoordinates": inferred + [inferred[0]]})
    if len(rows) != metadata["roomInterpretation"]["confirmedRoomCount"]:
        raise ValueError("Current room count differs from retained resident count")
    if any(v > 2e-5 for v in residuals.values()):
        raise ValueError(f"Room reconstruction failed tolerance: {residuals}")

    labels = list(spaces)
    pairwise_overlap = sum(
        intersection_area(space_triangles[a], space_triangles[b])
        for i, a in enumerate(labels) for b in labels[i + 1:])
    total = sum(by_kind.values())
    conservation = total - core_area
    if pairwise_overlap > 1e-5 or abs(conservation) > 1e-3:
        raise ValueError("Current spaces fail independent overlap/area-conservation checks")
    plate_area = sum(polygon_area(p) for p in plates)
    internal_total = sum(r["conditionalInternalArea"] for r in rows)
    floor_budget = {
        "sourceRoofProjectionArea": area(flat),
        "retainedStudyPlateArea": plate_area,
        "annotatedCoreIntersectionArea": core_area,
        "retainedPlateOutsideAnnotatedCoreArea": plate_area - core_area,
        "spaceAreasByKind": dict(by_kind),
        "hallAreasByLabel": {s["shortLabel"]: polygon_area(spaces[s["shortLabel"]])
                            for s in level["spaces"] if s["kind"] == "corridor"},
        "allSpaceAreaSum": total, "areaConservationResidual": conservation,
        "pairwiseSpaceIntersectionAreaSum": pairwise_overlap,
        "conditionalInternalEnvelopeTotal": internal_total,
        "conditionalMeanInternalEnvelopeArea": internal_total / len(rows),
        "conditionalMeanRoundedToPublishedOneDecimal": round(internal_total / len(rows), 1),
        "categoryBenchmarkTimesRoomCount": target * len(rows),
        "benchmarkTotalMinusConditionalInternalTotal": target * len(rows) - internal_total,
    }

    r_records = [source_records[r["label"]] for r in current["rooms"]]
    recess_indices = current["rConnector"]["northRecessSourceVertexIndexes"]
    recess_v = max(flat[i][1] for i in recess_indices)
    r_front = min(bounds(spaces[r["label"]]["outer"])[1] for r in r_records)
    gross_gap = r_front - recess_v
    clear_gap = gross_gap - parameters["recessBandMetres"] - parameters["allocationBoundaryHalfWallMetres"]

    def growth_for_target(records):
        mean = lambda delta: sum(area(internal(r, delta)) for r in records) / len(records)
        if mean(0) >= target:
            return 0.0
        low, high = 0.0, 1.0
        while mean(high) < target and high < radius / 2:
            high *= 2
        if mean(high) < target:
            raise ValueError("Cannot bracket the R sensitivity target")
        for _ in range(80):
            middle = (low + high) / 2
            if mean(middle) < target:
                low = middle
            else:
                high = middle
        return (low + high) / 2

    shared_growth = growth_for_target(r_records)
    sensitivity = {
        "grossNorthConnectorGap": gross_gap, "conditionalNorthConnectorGap": clear_gap,
        "declaredConnectorStudyGuard": parameters["minimumConnectorClearStudyGuardMetres"],
        "sharedHallFrontGrowthForMeanBenchmark": shared_growth,
        "conditionalConnectorIfMeanBenchmarkForced": clear_gap - shared_growth,
        "individualRooms": [
            {"room": r["label"], "hallFrontGrowthToBenchmark": growth_for_target([r]),
             "conditionalConnectorIfIndividuallyForced": clear_gap - growth_for_target([r]),
             "internalAreaGainForOneCentimetreDepth": area(internal(r, .01)) - area(internal(r))}
            for r in r_records],
    }
    facade = next(e for e in r_records[0]["edgeOffsets"] if e["kind"] == "external-facade")
    facade_points = [p for r in r_records for p in spaces[r["label"]]["outer"]
                     if abs(dot(facade["normal"], p) - facade["constant"]) < 1e-5]
    source_facade_indices = [6, 7]
    source_facade = [flat[i] for i in source_facade_indices]
    if any(math.dist(a, local(b)) > 1e-8
           for a, b in zip(source_facade, current["alignment"]["sourceFacadeSegment"])):
        raise ValueError("Retained R source facade does not match the source roof vertices")
    alignment = {
        "oppositeRecessLength": math.dist(*(flat[i] for i in recess_indices)),
        "candidateBankExtentAlongFacadePlane": max(math.dist(a, b) for a in facade_points for b in facade_points),
        "sourceFacadeSegmentLength": math.dist(*source_facade),
        "sourceRoofSurfaceIndex": roof_surface_index,
        "sourceRoofSurfaceId": roof["id"],
        "recessSourceVertexIndices": recess_indices,
        "facadeSourceVertexIndices": source_facade_indices,
    }
    stair_record = next(s for s in level["spaces"] if s["kind"] == "stairs")
    stair_points = spaces[stair_record["shortLabel"]]["outer"]
    flight = [local(p) for p in stair_record["stairFlight"]]
    ref_a, ref_b = [flat[i] for i in current["staircase"]["referenceSourceVertexIndexes"]]
    tangent = sub(ref_b, ref_a)
    tangent = [v / math.hypot(*tangent) for v in tangent]
    normal = [tangent[1], -tangent[0]]

    def across_profile(points):
        offsets = [dot(sub(p, ref_a), normal) for p in points]
        west, east = min(offsets), max(offsets)
        width = east - west
        return {"width": width, "l3SideDistance": -west, "r1SideDistance": east,
                "l3Share": -west / width, "r1Share": east / width}

    enclosure, flight_profile = across_profile(stair_points), across_profile(flight)
    staircase = {
        "enclosure": enclosure, "symbolicFlight": flight_profile,
        "enclosureArea": polygon_area(spaces[stair_record["shortLabel"]]),
        "enclosureStudyAxisBounds": bounds(stair_points),
        "flightStudyAxisBounds": bounds(flight),
        "flightEdgeLengths": [math.dist(a, b) for a, b in zip(flight, flight[1:])],
        "sideInsetL3": enclosure["l3SideDistance"] - flight_profile["l3SideDistance"],
        "sideInsetR1": enclosure["r1SideDistance"] - flight_profile["r1SideDistance"],
        "rightOnlyShrinkDerivativeAtZero": enclosure["l3SideDistance"] / enclosure["width"] ** 2,
        "rightOnlyShrinkEquation": "L3_fraction(delta) = L3_side_distance / (gross_width - delta)",
        "interpretation": "A positive right-only shrink increases the L3 share. Flight insets are symbolic assumptions.",
    }
    left_r_plane = next(e for e in r_records[0]["edgeOffsets"] if e["kind"] == "bank-end")
    cross_sections = []
    for v in [r_front, max(p[1] for p in stair_points)]:
        nx, ny = left_r_plane["normal"]
        r_left = [(left_r_plane["constant"] - ny * v) / nx, v]
        cross_sections.append({
            "studyV": v,
            "grossStripWidth": dot(sub(r_left, ref_a), normal) - enclosure["r1SideDistance"],
        })
    unassigned_records = [s for s in level["spaces"] if s["kind"] == "service"]
    unassigned_ids = {s["id"] for s in unassigned_records}
    unassigned = {
        "grossArea": sum(polygon_area(spaces[s["shortLabel"]]) for s in unassigned_records),
        "crossSectionsBesideStair": cross_sections,
        "doorTargetCount": sum(
            d["spaceId"] in unassigned_ids or d["toSpaceId"] in unassigned_ids
            for d in level["doors"]),
        "interpretation": "Residual strip and connected pocket, with no established use or circulation function.",
    }
    adjacency = defaultdict(set)
    for door in level["doors"]:
        a, b = door["spaceId"], door["toSpaceId"]
        adjacency[a].add(b)
        adjacency[b].add(a)
    reachable, pending = set(), [stair_record["id"]]
    while pending:
        item = pending.pop()
        if item not in reachable:
            reachable.add(item)
            pending.extend(adjacency[item] - reachable)
    graph = {
        "roomCount": len(rows), "windowCount": len(level["windows"]), "doorTargetCount": len(level["doors"]),
        "spaceCountsByKind": dict(Counter(s["kind"] for s in level["spaces"])),
        "roomsWithNoRepresentedDoorGraphRouteToStair": [
            s["shortLabel"] for s in level["spaces"] if s["kind"] == "room" and s["id"] not in reachable],
        "interpretation": "This audits saved connectivity only. The resident has confirmed separate L and R doors onto the same landing; the missing R connection is an implementation omission, not missing topological evidence or a claim about actual exits.",
    }
    floor_y = metadata["floorGeometry"]["provisionalPlaneCampusY"]
    height = {
        "sourceBaseCampusY": building["baseY"], "sourceBaseAltitudeNHN": building["baseAltitude"],
        "sourceMaximumBuildingHeight": building["height"],
        "provisionalFloorCampusY": floor_y,
        "provisionalFloorAboveBase": floor_y - building["baseY"],
        "equalStoreyGuideRecomputedAboveBase": index * building["height"] / len(study["levels"]),
        "sourceFlatRoofCampusY": roof_y,
        "sourceFlatRoofAboveProvisionalFloor": roof_y - floor_y,
        "interpretation": "Difference between an exterior roof surface and an assumed floor plane; no slab deduction or clear-ceiling measurement.",
    }
    preserved = {
        "floorOutlineEqualsFrozenPreAlignmentBaseline": level["floorOutline"] == prior_level["floorOutline"],
        "windowsEqualFrozenPreAlignmentBaseline": level["windows"] == prior_level["windows"],
        "unchangedNonRRoomRecords": sum(
            s == next(p for p in prior_level["spaces"] if p["id"] == s["id"])
            for s in level["spaces"] if s["kind"] == "room" and source_records[s["shortLabel"]]["bank"] != "R"),
    }
    raw = {
        "transform": {"originCampusXZ": origin, "axisU": axis_u, "axisV": axis_v,
                      "angleDegrees": math.degrees(math.atan2(axis_u[1], axis_u[0])),
                      "determinant": axis_u[0] * axis_v[1] - axis_u[1] * axis_v[0]},
        "rooms": rows, "floorBudget": floor_budget, "rAlignment": alignment,
        "rSensitivity": sensitivity, "staircase": staircase, "heights": height,
        "unassigned": unassigned, "doorGraph": graph,
        "numericalChecks": residuals, "preserved": preserved,
    }
    return {
        "schemaVersion": 1, "currentStage": metadata["currentStage"], "house": house, "levelIndex": index,
        "inputs": {path: {"sha256": digest(path)} for path in [provenance_path, study_path, lod_path, baseline["path"]]},
        "method": "Independent stdlib half-plane clipping, shoelace areas, ear triangulation and signed triangle intersections; no application modules imported.",
        "units": {"length": "metres", "area": "square metres", "coordinates": "campus metres rotated into retained study axes"},
        "rounding": "raw retains floating-point calculation output; rounded displays six decimals. Neither precision represents measurement accuracy.",
        "assumptions": parameters,
        "identifiability": {
            "roomCountsByBank": dict(bank_counts),
            "potentialDividerPositionParametersBeforeOtherConstraints": sum(n - 1 for n in bank_counts.values()),
            "potentialSharedHallFrontOffsetsBeforeOtherConstraints": len(bank_counts),
            "notARemainingFreedomCount": True,
            "explanation": "The counts describe a simplified initial parameterization, not the remaining rank or degrees of freedom of the current constrained model. Resident alignments, inherited divider slopes, fixed ends, equal-bay interpolation, shared hall fronts and area targets fix or couple parameters. Exact residual rank would require an explicit parameter vector and independent constraint Jacobian. Area targets and equality are modeling assumptions, not measurements.",
            "missingPhysicalEvidence": ["Registered wall faces and thicknesses", "Floor elevations",
                                        "Bathroom/kitchen/entrance partitions", "Door endpoints",
                                        "Stair length, landings and vertical construction"],
            "supersedingEvidence": {
                "path": "data/source/house55-2og-stair-measurements.json",
                "note": "The resident measured 2.72 m wall-to-wall, split into 1.43 m flight/guard and 1.29 m walkway, and confirmed two landing doors. This script reconstructs the old saved geometry; its dimensions are not a measurement-compliant replacement.",
            },
        },
        "retainedMetadataNotIndependentlyRecomputed": {
            "rawShellSectionArea": metadata["floorGeometry"]["sourceSectionAreaMetresSquared"],
            "rawShellSectionMeaning": "Copied for context from provenance. This script independently intersects the saved study plate and roof plan; it does not resection the complete 3D shell.",
        },
        "interpretation": [
            "Conditional internal envelopes omit unknown internal service-partition footprints.",
            "A published category-average area does not constrain every individual room to that exact area.",
            "Agreement with the category average is not independent validation because most rooms were fitted to that benchmark.",
            "No geometry was changed, and no measured floor plan, physical room number, occupancy, or compliant route is asserted.",
        ],
        "raw": raw, "rounded": round_numbers(raw),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo", type=Path, required=True, help="rommelweb checkout to read")
    parser.add_argument("--output", type=Path, required=True, help="JSON report destination")
    args = parser.parse_args()
    report = compute(args.repo.resolve())
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n")
    print(json.dumps({"output": str(args.output.resolve()), "currentStage": report["currentStage"],
                      "floorBudget": report["rounded"]["floorBudget"],
                      "numericalChecks": report["raw"]["numericalChecks"]}, indent=2))


if __name__ == "__main__":
    main()
