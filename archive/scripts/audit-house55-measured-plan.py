#!/usr/bin/env python3
"""Independently audit the House 55 measured-circulation plan candidate.

Uses stdlib triangulation/clipping from audit-house55-recovery.py, not the
candidate generator's SciPy/Shapely checks. Does not regenerate or edit a plan.

  python3 scripts/audit-house55-measured-plan.py \
    --output docs/data/house55-measured-plan-independent-audit.json

The numerical checks establish feasibility of the stated candidate family.
They do not establish that its unmeasured walls, doors or stairs match reality.
"""

import argparse
from collections import Counter
import hashlib
import importlib.util
from itertools import combinations
import json
import math
from pathlib import Path
import statistics


TOLERANCE = 1e-8
CANDIDATE_PATH = "docs/data/house55-measured-plan-candidate.json"


def compute(repo):
    spec = importlib.util.spec_from_file_location(
        "recovery_geometry", repo / "scripts/audit-house55-recovery.py")
    geometry = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(geometry)

    def load(path):
        return json.loads((repo / path).read_text())

    def digest(path):
        return hashlib.sha256((repo / path).read_bytes()).hexdigest()

    candidate = load(CANDIDATE_PATH)
    provenance = load("data/source/house55-2og-study-provenance.json")
    constraints = load("data/source/house55-2og-measured-fit-constraints.json")
    study = load("public/data/interior-studies.json")
    level = next(record for record in study["buildings"]["55"]["levels"]
                 if record["index"] == 2)
    axes = provenance["registration"]["localAxesInCampusXZ"]
    origin = provenance["registration"]["localOriginInCampusXZ"]
    if (candidate["house"] != "55" or candidate["levelIndex"] != 2
            or candidate["coordinateSystem"]["localAxesInCampusXZ"] != axes
            or candidate["coordinateSystem"]["localOriginInCampusXZ"] != origin):
        raise ValueError("Candidate identity or reference frame changed")

    def uv(point):
        return [geometry.dot(geometry.sub(point, origin), axes[key])
                for key in ("x", "y")]

    def canonical_polygon(record, key="outer"):
        return {
            "outer": [uv(point) for point in record[key]],
            "holes": [[uv(point) for point in ring]
                      for ring in record.get("holes", [])],
        }

    def polygon(record):
        return {"outer": record["polygon"], "holes": record.get("holes", [])}

    def triangles(polygons):
        return [triangle for record in polygons
                for triangle in geometry.signed_triangles(record)]

    def area(polygons):
        return sum(geometry.polygon_area(record) for record in polygons)

    def intersection(a, b):
        return geometry.intersection_area(triangles(a), triangles(b))

    def point_segment_distance(point, a, b):
        vector = geometry.sub(b, a)
        length_squared = geometry.dot(vector, vector)
        fraction = (max(0, min(1, geometry.dot(geometry.sub(point, a), vector)
                               / length_squared)) if length_squared else 0)
        return math.dist(point, [a[i] + fraction * vector[i] for i in range(2)])

    def boundary_distance(a, b):
        # Current candidate and source plate have no holes. Containment and
        # overlaps are checked separately before interpreting face distances.
        rings_a = [geometry.open_ring(a["outer"])]
        rings_b = [geometry.open_ring(b["outer"])]
        rings_a += [geometry.open_ring(ring) for ring in a.get("holes", [])]
        rings_b += [geometry.open_ring(ring) for ring in b.get("holes", [])]
        return min(
            point_segment_distance(point, c, d)
            for first, second in [(rings_a, rings_b), (rings_b, rings_a)]
            for ring in first for point in ring
            for other in second
            for c, d in zip(other, other[1:] + other[:1]))

    def shared_axis_aligned_boundary_length(a, b):
        total = 0
        first = geometry.open_ring(a["outer"])
        second = geometry.open_ring(b["outer"])
        for c, d in zip(first, first[1:] + first[:1]):
            axis = 0 if abs(d[0] - c[0]) > abs(d[1] - c[1]) else 1
            other = 1 - axis
            for e, f in zip(second, second[1:] + second[:1]):
                if max(abs(c[other] - d[other]), abs(e[other] - f[other]),
                       abs(c[other] - e[other])) < TOLERANCE:
                    total += max(
                        0, min(max(c[axis], d[axis]), max(e[axis], f[axis]))
                        - max(min(c[axis], d[axis]), min(e[axis], f[axis])))
        return total

    plate = [canonical_polygon(record) for record in level["floorOutline"]]
    voids = [canonical_polygon(record, "polygon")
             for record in level["excludedAreas"]]
    building = next(record for record in load("public/data/lod2.json")["buildings"]
                    if record["number"] == "55")
    roof = building["surfaces"][39]
    if roof["type"] != "RoofSurface":
        raise ValueError("Reference flat roof changed")
    source_points = [uv([point[0], point[2]]) for point in roof["points"]]
    flat = [{"outer": source_points}]
    rooms = [polygon(record) for record in candidate["rooms"]]
    halls = [polygon(record) for record in candidate["corridors"]]
    stair = [polygon(candidate["stair"])]
    clear = rooms + candidate["corridorUnion"] + stair
    areas = [geometry.polygon_area(record) for record in rooms]
    room_pairs = list(combinations(range(len(rooms)), 2))
    hall_names = [record["label"] for record in candidate["corridors"]]
    room_details = []

    for source, room in zip(candidate["rooms"], rooms):
        bounds = geometry.bounds(room["outer"])
        axis = 0 if source["widthAxis"] == "U" else 1
        width = bounds[axis + 2] - bounds[axis]
        depth = bounds[3 - axis] - bounds[1 - axis]
        room_area = geometry.polygon_area(room)
        hall_name = "A–D" if source["bank"] == "A" else source["bank"]
        hall = halls[hall_names.index(hall_name)]
        hall_bounds = geometry.bounds(hall["outer"])
        frontage = max(0, min(bounds[axis + 2], hall_bounds[axis + 2])
                       - max(bounds[axis], hall_bounds[axis]))
        # An explicit centered 2.70 × 3.30 rectangle, before unknown internal
        # service partitions, proves geometric accommodation in each envelope.
        size = [2.7, 3.3] if axis == 0 else [3.3, 2.7]
        lower = [(bounds[i] + bounds[i + 2] - size[i]) / 2 for i in range(2)]
        upper = [lower[i] + size[i] for i in range(2)]
        living_rectangle = {"outer": [
            lower, [upper[0], lower[1]], upper, [lower[0], upper[1]], lower]}
        room_details.append({
            "label": source["label"], "bank": source["bank"],
            "computedWidth": width, "computedDepth": depth,
            "computedArea": room_area,
            "rectangularEnvelopeAreaError": width * depth - room_area,
            "storedDimensionMaxError": max(
                abs(width - source["width"]), abs(depth - source["depth"]),
                abs(room_area - source["area"])),
            "assignedHall": hall_name,
            "hallFaceGap": boundary_distance(room, hall),
            "potentialHallFrontage": frontage,
            "livingRectangleOutsideRoomArea":
                area([living_rectangle]) - intersection([living_rectangle], [room]),
        })

    circulation = halls + [polygon(record) for record in candidate["stair"]["landings"]]
    circulation.append(polygon(candidate["stair"]["walkway"]))
    names = hall_names + ["north landing", "south landing", "walkway"]
    edges = []
    for i, j in combinations(range(len(circulation)), 2):
        overlap = intersection([circulation[i]], [circulation[j]])
        shared = shared_axis_aligned_boundary_length(circulation[i], circulation[j])
        if overlap > TOLERANCE or shared > TOLERANCE:
            edges.append({"a": names[i], "b": names[j],
                          "overlapArea": overlap, "sharedBoundaryLength": shared})
    reachable = {names[0]}
    while True:
        old = set(reachable)
        for edge in edges:
            if edge["a"] in reachable or edge["b"] in reachable:
                reachable.update([edge["a"], edge["b"]])
        if reachable == old:
            break

    connection_records = []
    for connection, (hall_name, landing_name) in zip(
            candidate["stair"]["hallConnections"],
            [("L", "south landing"), ("R", "north landing")]):
        a, b = connection["points"]
        middle = [(a[i] + b[i]) / 2 for i in range(2)]
        distances = []
        for name in [hall_name, landing_name]:
            ring = geometry.open_ring(circulation[names.index(name)]["outer"])
            distances.append(max(
                min(point_segment_distance(point, c, d)
                    for c, d in zip(ring, ring[1:] + ring[:1]))
                for point in [a, middle, b]))
        connection_records.append({
            "label": connection["label"], "indicativeSegmentLength": math.dist(a, b),
            "maximumEndpointAndMidpointBoundaryDistances": distances,
            "openingJambsModelled": connection["openingJambsModelled"],
            "geometricHallMouthWidth": connection["geometricHallMouthWidth"],
        })

    residuals = {
        "sourcePlateSymmetricDifferenceArea":
            area(plate) + area(candidate["floorOutline"])
            - 2 * intersection(plate, candidate["floorOutline"]),
        "sourceFlatRoofSymmetricDifferenceArea":
            area(flat) + area(candidate["referenceFlatRoofOutline"])
            - 2 * intersection(flat, candidate["referenceFlatRoofOutline"]),
        "roomPairOverlapArea": sum(intersection([rooms[i]], [rooms[j]])
                                   for i, j in room_pairs),
        "roomHallOverlapArea": intersection(rooms, candidate["corridorUnion"]),
        "roomStairOverlapArea": intersection(rooms, stair),
        "hallStairOverlapArea": intersection(candidate["corridorUnion"], stair),
        "clearOutsideCanonicalFloorArea": area(clear) - intersection(clear, plate),
        "clearOutsideSourceFlatRoofArea": area(clear) - intersection(clear, flat),
        "clearInResidentNoFloorRegionsArea": intersection(clear, voids),
        "wallsOutsideCanonicalFloorArea":
            area(candidate["walls"]) - intersection(candidate["walls"], plate),
        "wallsOutsideSourceFlatRoofArea":
            area(candidate["walls"]) - intersection(candidate["walls"], flat),
        "wallsInResidentNoFloorRegionsArea": intersection(candidate["walls"], voids),
        "wallClearOverlapArea": intersection(candidate["walls"], clear),
        "unassignedClearOverlapArea": intersection(candidate["unassigned"], clear),
        "unassignedWallOverlapArea":
            intersection(candidate["unassigned"], candidate["walls"]),
        "floorAreaClosureError": area(plate) - area(clear)
            - area(candidate["walls"]) - area(candidate["unassigned"]),
        "meanAreaTargetError": statistics.mean(areas)
            - constraints["fittingTargets"]["meanApartmentEnvelopeAreaSquareMetres"],
    }
    gaps = {
        "minimumRoomRoomFaceGap": min(
            boundary_distance(a, b) for a, b in combinations(rooms, 2)),
        "minimumRoomHallFaceGap": min(
            boundary_distance(a, b) for a in rooms for b in halls),
        "minimumRoomStairFaceGap": min(
            boundary_distance(a, stair[0]) for a in rooms),
        "minimumClearExteriorFaceGap": min(
            boundary_distance(a, b) for a in clear for b in plate),
    }
    corridor_widths = {
        record["label"]: geometry.extents(record["polygon"])[
            0 if record["widthAxis"] == "U" else 1]
        for record in candidate["corridors"]}
    stair_widths = {
        "insideWidth": geometry.extents(candidate["stair"]["polygon"])[0],
        "flightAndGuardWidth": geometry.extents(
            candidate["stair"]["flightGuardZone"]["polygon"])[0],
        "walkwayWidth": geometry.extents(candidate["stair"]["walkway"]["polygon"])[0],
    }
    source_checks = {path: digest(path) == expected
                     for path, expected in candidate["sourceHashes"].items()}
    identities = [record["label"] for record in candidate["rooms"]]
    expected_identities = (["A", "B", "C", "D", "E", "F", "G"]
                           + [f"{bank}{i}" for bank, count in
                              [("W", 4), ("L", 3), ("R", 3), ("N", 3)]
                              for i in range(1, count + 1)])
    hard = constraints["hardMeasurements"]
    # Independent bound for a single identical rectangle across all six banks.
    # Four A–D bays bound its width; R's source/cutout depth bounds its depth.
    # Derive both from canonical source vertices, not fitted dimension records.
    wall_assumption = .20
    source_offset_assumption = .20
    a_outer_span = (min(source_points[i][0] for i in [0, 1])
                    - max(source_points[i][0] for i in [22, 23]))
    a_width_cap = (a_outer_span - 2 * source_offset_assumption
                   - 3 * wall_assumption) / 4
    r_outer_span = (min(source_points[i][1] for i in [6, 7])
                    - max(source_points[i][1] for i in [15, 16]))
    r_depth_cap = (r_outer_span - 2 * source_offset_assumption
                   - hard["hallwayClearWidthMetres"] - wall_assumption)
    area_target = constraints["fittingTargets"]["meanApartmentEnvelopeAreaSquareMetres"]
    identical_room_bound = {
        "family": "Six retained rectilinear banks with the same width/depth orientation "
                  "as this candidate, four A–D bays, three R bays, and fixed source "
                  "reference/cutout lines. Does not cover arbitrary rotated, notched "
                  "or topologically different layouts.",
        "partitionThicknessAssumption": wall_assumption,
        "sourceInwardAllowanceAssumption": source_offset_assumption,
        "hallClearWidth": hard["hallwayClearWidthMetres"],
        "aUsableOuterReferenceSpan": a_outer_span,
        "aWidthFormula": "(A span − 2×source offset − 3×partition) / 4",
        "maximumCommonWidthFromFourABays": a_width_cap,
        "rAvailableOuterReferenceDepth": r_outer_span,
        "rDepthFormula": "R span − 2×source offset − hall width − partition",
        "maximumCommonDepthFromRBank": r_depth_cap,
        "maximumIdenticalRectangleArea": a_width_cap * r_depth_cap,
        "requestedMeanAreaTarget": area_target,
        "areaShortfallFromTarget": area_target - a_width_cap * r_depth_cap,
        "widthRequiredAtRDepthCap": area_target / r_depth_cap,
        "depthRequiredAtAWidthCap": area_target / a_width_cap,
        "identicalTargetAreaRectanglesImpossibleWithinFamily":
            a_width_cap * r_depth_cap < area_target - TOLERANCE,
        "interpretation": "Size variation is necessary to average 16.4 m² within "
                          "this family. This upper bound does not prove that an "
                          "all-identical 15.622 m² arrangement itself fits, nor "
                          "that the candidate's particular variation is real.",
    }
    checks = {
        "currentSourceHashes": all(source_checks.values()),
        "twentyEstablishedRoomIdentities":
            Counter(identities) == Counter(expected_identities),
        "sourceOutlineVoidAndAreaChecks":
            all(abs(value) < TOLERANCE for value in residuals.values()),
        "positiveWallSeparations":
            all(value >= .20 - TOLERANCE for value in gaps.values()),
        "roomGeometryMatchesDimensionRecords": all(
            abs(record["rectangularEnvelopeAreaError"]) < TOLERANCE
            and record["storedDimensionMaxError"] < TOLERANCE
            for record in room_details),
        "everyRoomHasPossibleHallFrontage": all(
            abs(record["hallFaceGap"] - .20) < TOLERANCE
            and record["potentialHallFrontage"] >= .90
            for record in room_details),
        "allSixStraightCorridorsHaveMeasuredWidth":
            len(corridor_widths) == 6 and all(
                abs(width - hard["hallwayClearWidthMetres"]) < TOLERANCE
                for width in corridor_widths.values()),
        "stairCrossSectionMatchesMeasurements":
            abs(stair_widths["insideWidth"] - hard["stairwellInsideWidthMetres"]) < TOLERANCE
            and abs(stair_widths["flightAndGuardWidth"]
                    - hard["stairAndCentralGuardZoneMetres"]) < TOLERANCE
            and abs(stair_widths["walkwayWidth"]
                    - hard["stairLevelWalkwayMetres"]) < TOLERANCE,
        "bothWingsHaveConnectedLandingRoute": len(reachable) == len(names),
        "twoIndicativeHallConnectionsLieOnBothBoundaries":
            len(connection_records) == 2 and all(
                max(record["maximumEndpointAndMidpointBoundaryDistances"]) < TOLERANCE
                for record in connection_records),
        "livingRectangleFitsEveryUnpartitionedEnvelope": all(
            abs(record["livingRectangleOutsideRoomArea"]) < TOLERANCE
            for record in room_details),
    }
    return {
        "schemaVersion": 1, "house": "55", "levelIndex": 2,
        "candidatePath": CANDIDATE_PATH, "candidateSha256": digest(CANDIDATE_PATH),
        "method": "Independent stdlib ear-triangulation, signed polygon intersections, "
                  "canonical source polygons, segment distances and connectivity graph. "
                  "Does not trust the solver's reported feasibility residuals.",
        "numericTolerance": TOLERANCE,
        "toleranceNote": "Numerical length/area tolerance only; not a surveying tolerance. "
                         "Residuals near 1e-13 are floating-point roundoff.",
        "allChecksPassed": all(checks.values()), "checks": checks,
        "sourceHashChecks": source_checks, "roomCount": len(rooms),
        "roomPairsChecked": len(room_pairs), "identities": identities,
        "residuals": residuals, "faceGaps": gaps,
        "areas": {"sum": sum(areas), "min": min(areas), "max": max(areas),
                  "mean": statistics.mean(areas), "populationStd": statistics.pstdev(areas),
                  "coefficientOfVariation": statistics.pstdev(areas) / statistics.mean(areas)},
        "corridorTrueWidths": corridor_widths, "stairWidths": stair_widths,
        "circulationEdges": edges, "hallConnections": connection_records,
        "roomDetails": room_details,
        "conditionalIdenticalRoomBound": identical_room_bound,
        "limitations": [
            "This proves a feasible candidate, not a unique reconstruction of the real floor.",
            "The 16.4 m² mean is imposed from a category benchmark; it is not independent evidence.",
            "The 0.20 m walls/reference offsets are assumptions. Wall bands are not construction details.",
            "Straight corridors are 1.30 m; open intersections are wider. Corridor-end walls are candidate placements.",
            "The two 0.90 m door lines are indicative. The geometry has open 1.30 m mouths; jambs/leaves are not modeled.",
            "The 6.48 m stair length, offset entrances, landing lengths, orientation and vertical construction remain unmeasured.",
            "The 2.70 × 3.30 living rectangle fits before unknown bathroom/kitchen/entry partitions are inserted.",
            "Apartment-to-hall frontage exists, but actual apartment doors and service partitions remain unresolved.",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = compute(args.repo.resolve())
    encoded = json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded)
        print(json.dumps({"output": str(args.output.resolve()),
                          "candidateSha256": report["candidateSha256"],
                          "allChecksPassed": report["allChecksPassed"],
                          "checks": report["checks"], "areas": report["areas"]}, indent=2))
    else:
        print(encoded, end="")
    if not report["allChecksPassed"]:
        raise SystemExit("Candidate independent audit failed; inspect the failed checks.")


if __name__ == "__main__":
    main()
