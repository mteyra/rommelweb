#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["shapely==2.1.2", "matplotlib==3.10.8"]
# ///
"""Audit all five older-house hypotheses without calling the JS geometry pipeline.

The source shell is sliced independently through its planar surface boundaries.
Room areas are gross allocation polygons. Clearance sweeps are geometric probes,
not real wall clearances, accessibility checks, or evidence of actual doorways.
"""
import argparse
import hashlib
import json
import math
import statistics
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import polygonize_full, unary_union
from shapely.validation import explain_validity

ROOT = Path(__file__).resolve().parents[1]
HOUSES = ["51", "53", "55", "57", "59"]
STUDY_AXIS = [0.676 / math.hypot(.676, .737), .737 / math.hypot(.676, .737)]


def load(path):
    return json.loads(Path(path).read_text())


def fingerprint(path):
    path = Path(path)
    return {"path": str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def shape(record, field="polygon"):
    return Polygon(record[field], record.get("holes", []))


def parts(geometry, kind=Polygon):
    if isinstance(geometry, kind):
        return [geometry] if not geometry.is_empty else []
    return [part for child in getattr(geometry, "geoms", []) for part in parts(child, kind)]


def cross(a, b):
    return a[0] * b[1] - a[1] * b[0]


def sub(a, b):
    return [a[i] - b[i] for i in range(len(a))]


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def source_elevations(building, count, approved):
    anchors = {0: 0, count: building["height"]}
    entry = approved.get("buildings", {}).get(building["number"], {})
    if entry.get("approved"):
        anchors.update({level["index"]: level["elevation"] for level in entry["levels"]})
    ordered = sorted(anchors.items())
    return [next(za + (zb - za) * (index - a) / (b - a)
                 for (a, za), (b, zb) in zip(ordered, ordered[1:]) if a <= index < b)
            for index in range(count)]


def surface_section(surface, elevation):
    """Intersect a planar face via sorted ring crossings, without triangulation."""
    rings = [surface["points"], *surface.get("holes", [])]
    outer = rings[0]
    normal = [0., 0., 0.]
    for a, b in zip(outer, outer[1:]):
        normal[0] += (a[1] - b[1]) * (a[2] + b[2])
        normal[1] += (a[2] - b[2]) * (a[0] + b[0])
        normal[2] += (a[0] - b[0]) * (a[1] + b[1])
    drop = max(range(3), key=lambda i: abs(normal[i]))
    axes = [i for i in range(3) if i != drop]
    face = Polygon([[p[i] for i in axes] for p in outer],
                   [[[p[i] for i in axes] for p in ring] for ring in rings[1:]])
    if all(abs(point[1] - elevation) < 1e-9 for ring in rings for point in ring):
        return []
    hits = {}
    for ring in rings:
        for a, b in zip(ring, ring[1:]):
            da, db = a[1] - elevation, b[1] - elevation
            if abs(da) < 1e-9:
                hits[(round(a[0], 7), round(a[2], 7))] = [a[0], a[2]]
            if da * db < 0:
                t = da / (da - db)
                point = [a[i] + (b[i] - a[i]) * t for i in [0, 2]]
                hits[tuple(round(v, 7) for v in point)] = point
    if len(hits) < 2:
        return []
    axis = max(range(2), key=lambda i: max(p[i] for p in hits) - min(p[i] for p in hits))
    ordered = sorted(hits, key=lambda p: p[axis])
    segments = []
    for a, b in zip(ordered, ordered[1:]):
        middle = [(a[0] + b[0]) / 2, elevation, (a[1] + b[1]) / 2]
        if face.buffer(1e-8).covers(Point([middle[i] for i in axes])):
            segments.append(LineString([a, b]))
    return segments


def independent_section(building, elevation):
    ground = [p[1] for surface in building["surfaces"] if surface["type"] == "GroundSurface"
              for p in surface["points"]]
    plane = building["baseY"] + elevation
    sampled = max(plane, max(ground) + .001)
    segments = [segment for surface in building["surfaces"]
                for segment in surface_section(surface, sampled)]
    polygons, cuts, dangles, invalid = polygonize_full(unary_union(segments))
    # Polygonization also emits bounded hole faces. Classify nested boundaries
    # by parity so a courtyard or disconnected island is never silently filled.
    rings = {}
    for polygon in parts(polygons):
        for ring in [polygon.exterior, *polygon.interiors]:
            points = list(ring.coords)
            key = tuple(sorted(set(points)))
            rings[key] = Polygon(points)
    ordered = sorted(rings.values(), key=lambda p: p.area, reverse=True)
    boundaries = []
    for i, polygon in enumerate(ordered):
        containers = [j for j in range(i) if ordered[j].contains(Point(polygon.exterior.coords[0]))]
        boundaries.append({"ring": polygon, "depth": len(containers),
                           "parent": max(containers, default=None)})
    shells = [
        Polygon(item["ring"].exterior.coords,
                [child["ring"].exterior.coords for child in boundaries
                 if child["parent"] == i and child["depth"] % 2])
        for i, item in enumerate(boundaries) if item["depth"] % 2 == 0
    ]
    return unary_union(shells), {
        "relativeFloorElevation": elevation, "absoluteModelPlaneY": plane,
        "sampleY": sampled, "groundSamplingOffset": sampled - plane,
        "cutLineLength": cuts.length, "danglingLineLength": dangles.length,
        "invalidLineLength": invalid.length, "sectionPolygonCount": len(shells),
        "method": "Independent planar-face boundary crossings and Shapely polygonization; no JS triangulation, floorSection, or interior generator used.",
        "elevationMeaning": "Provisional equal-storey interpolation unless an approved elevation anchor exists; this does not establish occupiable floor area.",
    }


def distribution(values):
    values = sorted(values)
    if not values:
        return None
    return {"minimum": values[0], "median": statistics.median(values),
            "maximum": values[-1], "mean": statistics.mean(values),
            "total": sum(values)}


def room_shape_metrics(record, polygon):
    clean = polygon.simplify(.001, preserve_topology=True)
    ring = list(clean.exterior.coords)
    orientation = 1 if sum(cross(a, b) for a, b in zip(ring, ring[1:])) > 0 else -1
    reflex, bends = [], []
    for i, p in enumerate(ring[:-1]):
        a, b = ring[i - 1 if i else -2], ring[(i + 1) % (len(ring) - 1)]
        incoming, outgoing = sub(p, a), sub(b, p)
        lengths = math.hypot(*incoming) * math.hypot(*outgoing)
        if lengths < 1e-12:
            continue
        turn = math.degrees(math.atan2(cross(incoming, outgoing), dot(incoming, outgoing)))
        if orientation * turn < -1:
            reflex.append({"point": list(p), "turnDegrees": turn})
        if 1 < abs(turn) < 80 or 100 < abs(turn) < 179:
            bends.append({"point": list(p), "turnDegrees": turn})
    rectangle = polygon.minimum_rotated_rectangle
    hull = polygon.convex_hull
    rectangle_ring = list(rectangle.exterior.coords)
    side_lengths = sorted(math.dist(a, b) for a, b in zip(rectangle_ring, rectangle_ring[1:]))
    return {
        "id": record["id"], "label": record["shortLabel"],
        "grossAllocationArea": polygon.area, "areaMeaning": "Gross inferred polygon; not measured internal, usable, rental, or net area.",
        "significantCornerCount": len(ring) - 1, "simplificationToleranceMetres": .001,
        "minimumRectangleFillRatio": polygon.area / rectangle.area,
        "minimumRectangleSideLengthsMetres": [side_lengths[0], side_lengths[-1]],
        "enclosingRectangleAspectRatio": side_lengths[-1] / side_lengths[0],
        "grossEnvelopeNarrowerThan270cmReference": side_lengths[0] < 2.7,
        "referenceWidthMeaning": "A gross containing strip narrower than 2.70m cannot hold the approximate 2.70×3.30m typical living-zone example at any rotation. This is a conditional example comparison, not proof of the target house's apartment type.",
        "convexHullFillRatio": polygon.area / hull.area,
        "reflexCorners": reflex, "nonOrthogonalBends": bends,
        "holes": len(polygon.interiors),
        "shapeReviewRequired": polygon.area / rectangle.area < .90 or polygon.area / hull.area < .98
            or any(abs(bend["turnDegrees"]) > 5 for bend in bends),
        "shapeMeaning": "Nonrectangular or bent boundaries expose the limits of the exterior-based deformation. They are not evidence that the physical apartments have these walls.",
    }


def door_graph(level, polygons):
    records = {space["id"]: space for space in level["spaces"]}
    halls = [key for key, record in records.items() if record["kind"] == "corridor"]
    stairs = [key for key, record in records.items() if record["kind"] == "stairs"]
    graph = {key: set() for key in records}
    doors = []
    for door in level["doors"]:
        line = LineString(door["segment"])
        source, target = door["spaceId"], door.get("toSpaceId")
        neighbors = [key for key in halls if line.difference(polygons[key].boundary.buffer(.002)).length < .002]
        on_source = source in polygons and line.difference(polygons[source].boundary.buffer(.002)).length < .002
        on_target = target in polygons and line.difference(polygons[target].boundary.buffer(.002)).length < .002
        # A missing destination is not silently filled from a tempting contact.
        valid = on_source and on_target and source != target
        if valid:
            graph[source].add(target)
            graph[target].add(source)
        doors.append({"id": door["id"], "spaceId": source, "toSpaceId": target,
                      "length": line.length, "onSourceBoundary": on_source, "onTargetBoundary": on_target,
                      "validDeclaredConnection": valid, "geometricallyAdjacentHallIds": neighbors,
                      "segment": door["segment"]})
    reached, pending = set(), list(stairs)
    while pending:
        key = pending.pop()
        if key not in reached:
            reached.add(key)
            pending.extend(graph[key] - reached)
    room_ids = [key for key, record in records.items() if record["kind"] == "room"]
    return {
        "doors": doors, "doorCount": len(doors),
        "validDeclaredDoorCount": sum(door["validDeclaredConnection"] for door in doors),
        "roomCount": len(room_ids),
        "roomsWithRepresentedStairRoute": [records[key]["shortLabel"] for key in room_ids if key in reached],
        "roomsWithoutRepresentedStairRoute": [records[key]["shortLabel"] for key in room_ids if key not in reached],
        "unassignedSpacesWithDeclaredDoor": [
            record["shortLabel"] for key, record in records.items()
            if record["kind"] == "service" and graph[key]
        ],
        "meaning": "Connectivity uses only saved, geometrically valid door endpoints. An absent represented route is an incomplete model, not proof that the real building lacks access or egress.",
    }


def hall_sweeps(level, polygons, access):
    by_id = {space["id"]: space for space in level["spaces"]}

    def approach(door, hall, radius):
        a, b = door["segment"]
        width = math.dist(a, b)
        middle = [(a[i] + b[i]) / 2 for i in range(2)]
        normal = [-(b[1] - a[1]) / width, (b[0] - a[0]) / width]
        candidates = [Point([middle[i] + sign * normal[i] * (radius + .005) for i in range(2)])
                      for sign in [-1, 1]]
        return [point for point in candidates if hall.covers(point)]

    results = []
    for hall in [space for space in level["spaces"] if space["kind"] == "corridor"]:
        polygon = polygons[hall["id"]]
        linked = [door for door in access["doors"]
                  if door["validDeclaredConnection"] and door["toSpaceId"] == hall["id"]]
        stair_doors = [door for door in linked if by_id[door["spaceId"]]["kind"] == "stairs"]
        room_doors = [door for door in linked if by_id[door["spaceId"]]["kind"] == "room"]
        sweeps = []
        for diameter in [.8, 1.0, 1.2, 1.3, 1.5]:
            radius = diameter / 2
            eroded = parts(polygon.buffer(-radius))
            significant = [part for part in eroded if part.area > 1.]
            local_approaches = {
                door["id"]: {i for i, component in enumerate(eroded)
                             for point in approach(door, polygon, radius)
                             if component.buffer(1e-8).covers(point)}
                for door in linked
            }
            stair_components = {i for i, component in enumerate(eroded)
                                for door in stair_doors for point in approach(door, polygon, radius)
                                if component.buffer(1e-8).covers(point)}
            reachable, blocked = [], []
            for door in room_doors:
                nodes = local_approaches[door["id"]]
                if stair_doors:
                    (reachable if nodes & stair_components else blocked).append(by_id[door["spaceId"]]["shortLabel"])
            sweeps.append({
                "diameterMetres": diameter, "largeErodedComponents": len(significant),
                "largeErodedComponentAreas": sorted([part.area for part in significant], reverse=True),
                "localDoorApproaches": [
                    {"doorId": door["id"], "space": by_id[door["spaceId"]]["shortLabel"],
                     "kind": by_id[door["spaceId"]]["kind"],
                     "hasInwardCircularApproach": bool(local_approaches[door["id"]])}
                    for door in linked
                ],
                "roomApproachesReachableFromStair": reachable if stair_doors else None,
                "roomApproachesBlockedAtThisSweep": blocked if stair_doors else None,
            })
        results.append({"id": hall["id"], "label": hall["shortLabel"], "grossPolygonArea": polygon.area,
                        "representedStairOpeningCount": len(stair_doors), "sweeps": sweeps,
                        "meaning": "Circular-diameter sweep inside the gross corridor polygon, using inward door approaches. Openings themselves are not widened or traversed. This is a bottleneck diagnostic, not measured clear width or code compliance."})
    return results


def audit_level(number, level, building, elevation, marker_count, metadata_level):
    floor = unary_union([shape(piece, "outer") for piece in level["floorOutline"]])
    source, section_details = independent_section(building, elevation)
    excluded = unary_union([shape(piece) for piece in level.get("excludedAreas", [])])
    expected_floor = source.difference(excluded)
    polygons = {space["id"]: shape(space) for space in level["spaces"]}
    validity = [{"id": key, "reason": explain_validity(polygon)}
                for key, polygon in polygons.items() if not polygon.is_valid]
    if validity or not floor.is_valid or source.is_empty:
        raise ValueError(f"House {number}/{level['index']}: invalid geometry {validity}, source empty={source.is_empty}")
    partition = unary_union(list(polygons.values()))
    remainder = floor.difference(partition)
    overlaps = []
    items = list(polygons.items())
    for i, (first_id, first) in enumerate(items):
        for second_id, second in items[i + 1:]:
            value = first.intersection(second).area
            if value > 1e-9:
                overlaps.append({"first": first_id, "second": second_id, "area": value})
    outside_source = partition.difference(source)
    source_offset = max([source.boundary.distance(Point(point))
                         for polygon in parts(outside_source)
                         for point in [*polygon.exterior.coords, polygon.representative_point().coords[0]]], default=0)
    outside_published = partition.difference(floor)
    published_offset = max([floor.boundary.distance(Point(point))
                            for polygon in parts(outside_published)
                            for point in [*polygon.exterior.coords, polygon.representative_point().coords[0]]], default=0)
    source_difference = floor.symmetric_difference(expected_floor).area
    # The published section triangulates millimetre-quantized faces and drops
    # bends below 0.2mm. This independent boundary method can take another
    # diagonal on a mildly nonplanar face. Scale its area tolerance by perimeter,
    # while retaining a separate 1mm containment-distance check.
    section_area_tolerance = expected_floor.length * .0002
    rooms = [room_shape_metrics(space, polygons[space["id"]]) for space in level["spaces"] if space["kind"] == "room"]
    services = [space for space in level["spaces"] if space["kind"] == "service"]
    explicit_unassigned = unary_union([polygons[space["id"]] for space in services]).intersection(floor)
    assigned_nonservice = unary_union([polygons[space["id"]] for space in level["spaces"]
                                     if space["kind"] != "service"])
    access = door_graph(level, polygons)
    sweeps = hall_sweeps(level, polygons, access)
    findings = []
    strict_partition_pass = outside_published.area < 1e-5 and sum(item["area"] for item in overlaps) < 1e-5
    numerical_checks = {
        "publishedFloorOutsideAreaWithinScaledTolerance": outside_published.area < floor.length * .0002,
        "publishedFloorOutsideBoundaryOffsetWithinTolerance": published_offset < .0002,
        "pairwiseOverlapWithinTolerance": sum(item["area"] for item in overlaps) < 1e-5,
        "independentSourceSectionAreaWithinTolerance": source_difference < section_area_tolerance,
        "independentSourceBoundaryOffsetWithinTolerance": source_offset < .001,
        "independentSourceSliceHasNoMaterialDangles": section_details["danglingLineLength"] < .001,
        "independentSourceSliceHasNoMaterialInvalidLines": section_details["invalidLineLength"] < .001,
        "allDeclaredDoorSegmentsAdjacent": access["validDeclaredDoorCount"] == access["doorCount"],
    }
    numerical_pass = all(numerical_checks.values())
    if not numerical_pass:
        findings.append({"type": "geometry-defect", "detail": "One or more source, overlap, section, or declared-door checks exceeded numerical tolerances."})
    if access["roomsWithoutRepresentedStairRoute"]:
        findings.append({"type": "incomplete-access-model",
                         "roomReferences": access["roomsWithoutRepresentedStairRoute"],
                         "detail": "No complete route to a stair is represented by the saved door graph. Do not present this layout as a navigation or evacuation plan."})
    distorted = sorted([room for room in rooms if room["shapeReviewRequired"]],
                       key=lambda room: room["minimumRectangleFillRatio"])
    if distorted:
        findings.append({"type": "deformed-room-hypothesis",
                         "roomReferences": [room["label"] for room in distorted],
                         "detail": "Some inherited bank divisions produce tapered or bent walls; source containment does not establish that these are actual apartments."})
    narrow = [room["label"] for room in rooms if room["grossEnvelopeNarrowerThan270cmReference"]]
    if narrow:
        findings.append({"type": "conditional-reference-width-conflict", "roomReferences": narrow,
                         "detail": "Gross envelopes narrower than 2.70m cannot contain the approximate typical living-zone rectangle. The example is not a measured template for these houses, so this flags the shared-type hypothesis rather than the physical building."})
    for hall in sweeps:
        trial = next(sweep for sweep in hall["sweeps"] if sweep["diameterMetres"] == 1.2)
        local_blocked = [entry for entry in trial["localDoorApproaches"] if not entry["hasInwardCircularApproach"]]
        if trial["largeErodedComponents"] > 1 or trial["roomApproachesBlockedAtThisSweep"] or local_blocked:
            findings.append({"type": "gross-corridor-sweep-bottleneck", "hall": hall["label"],
                             "blockedRoomApproaches": trial["roomApproachesBlockedAtThisSweep"],
                             "locallyBlockedDoorApproaches": local_blocked,
                             "largeComponents": trial["largeErodedComponents"],
                             "detail": "A 1.20m circular sweep cannot span every modeled corridor component or represented room approach. It is an illustrative gross-geometry test, not a legal threshold."})
    if marker_count is not None and marker_count != len(rooms):
        findings.append({"type": "incomplete-or-different-inventory",
                         "studyRoomHypotheses": len(rooms), "publicIndexEntries": marker_count,
                         "detail": "The aggregate third-party index differs from the partial study. Unassigned areas and unresolved banks have not been converted into invented rooms."})
    record = {
        "house": number, "floorIndex": level["index"], "floorLabel": ["EG", "1. OG", "2. OG"][level["index"]],
        "numericalGeometryChecksPass": numerical_pass, "numericalChecks": numerical_checks,
        "sourceSection": section_details,
        "strictAreaPartitionChecksPass": strict_partition_pass,
        "sourceFloor": {"officialBuildingId": building["id"], "independentSectionArea": source.area,
                        "explicitExclusionsRemovedFromSourceArea": source.intersection(excluded).area,
                        "expectedRetainedAreaAfterExplicitExclusions": expected_floor.area,
                        "exclusionCount": len(level.get("excludedAreas", [])),
                        "exclusionMeaning": "Only explicit saved no-floor observations are removed. House 55's resident-marked roof projections are not transferred to other houses.",
                        "publishedOutlineArea": floor.area, "symmetricDifferenceArea": source_difference,
                        "sectionDifferenceAreaTolerance": section_area_tolerance,
                        "partitionOutsideIndependentShellArea": outside_source.area,
                        "maximumOutsideBoundaryOffsetMetres": source_offset,
                        "partitionOutsidePublishedOutlineArea": outside_published.area,
                        "maximumPublishedOutlineOffsetMetres": published_offset,
                        "publishedContainmentMeaning": "Residual thin slivers remain visible in the area metric. A separate 0.20mm boundary-distance comparison matches the existing section simplification precision; it is not physical tolerance or an exact-containment claim."},
        "partition": {"spaceCount": len(polygons), "spaceUnionArea": partition.area,
                      "sumSpaceAreas": sum(polygon.area for polygon in polygons.values()),
                      "pairwiseOverlapArea": sum(item["area"] for item in overlaps),
                      "overlapPairs": overlaps,
                      "unmodeledFloorArea": remainder.area,
                      "explicitUnassignedAreaWithinFloor": explicit_unassigned.area,
                      "totalUnassignedOrUnmodeledFloorArea": floor.difference(assigned_nonservice).area,
                      "coveredFraction": partition.area / floor.area,
                      "areaConservationResidual": partition.area + remainder.area - floor.area,
                      "unmodeledComponentAreas": sorted([polygon.area for polygon in parts(remainder)], reverse=True),
                      "unmodeledMeaning": "Remaining source-floor plate, including extra wings or low-roof margins. Geometry alone does not identify usable rooms or circulation.",
                      "explicitUnassignedSpaces": [
                          {"id": space["id"], "label": space["shortLabel"], "grossArea": polygons[space["id"]].area}
                          for space in services]},
        "inventory": {"studyRoomHypotheses": len(rooms), "publicIndexEntries": marker_count,
                      "indexMinusHypotheses": marker_count - len(rooms) if marker_count is not None else None,
                      "indexMeaning": "Aggregate entries in the Rommelwood public map; incomplete, not an operator-certified apartment count or occupancy record."},
        "evidenceStatus": {
            "residentInformedHouse55TopFloor": number == "55" and level["index"] == 2,
            "sourceDescription": level["source"],
            "extrapolatedFromFloorIndex": level.get("extrapolatedFrom"),
            "spaceConfidenceCounts": {confidence: sum(space["confidence"] == confidence for space in level["spaces"])
                                      for confidence in sorted({space["confidence"] for space in level["spaces"]})},
            "windowRecordCount": len(level.get("windows", [])),
            "wallBandRecordCount": len(level.get("wallBands", [])),
            "excludedAreaRecordCount": len(level.get("excludedAreas", [])),
            "meaning": "Resident-informed relative observations apply only to House 55's top floor. Inherited layout and target-specific dimensional fitting do not upgrade confidence.",
        },
        "grossRoomAreaDistribution": distribution([room["grossAllocationArea"] for room in rooms]),
        "roomShapeMetrics": rooms, "doorAccess": access, "corridorSweeps": sweeps,
        "metadataComparison": {
            "sourceFloorAreaDifference": floor.area - metadata_level["sourceFloorArea"],
            "assignedAreaDifference": partition.area - metadata_level["assignedStudyArea"],
            "unassignedAreaDifference": remainder.area - metadata_level["unassignedArea"],
        } if metadata_level else None,
        "findings": findings,
    }
    return record, {"floor": floor, "source": source, "polygons": polygons, "remainder": remainder, "level": level}


def registration_checks(metadata, lod2, donor_level):
    """Independently inspect the saved affine-cage controls, when available."""
    path = ROOT / "scripts/generate-old-house-studies.mjs"
    text = path.read_text().split("export const REGISTRATION =", 1)[1]
    # The manifest is JSON data with a JavaScript trailing comma after the final
    # house. Read only that literal; never import or execute the geometry module.
    literal = text.split("\n};", 1)[0].rstrip().removesuffix(",") + "\n}"
    manifests = json.loads(literal)
    source = lod2["55"]
    template = unary_union([shape(space) for space in donor_level["spaces"]])
    first = manifests["51"]
    cage_points = [[source["surfaces"][first["sourceSurface"]]["points"][i][j] for j in [0, 2]]
                   for i in first["sourceVertexIndexes"]]
    x0, y0 = [min(p[i] for p in cage_points) - 20 for i in [0, 1]]
    x1, y1 = [max(p[i] for p in cage_points) + 20 for i in [0, 1]]
    cage = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]
    results = {}
    for number in HOUSES:
        if number == "55":
            continue
        manifest = manifests[number]
        target = lod2[number]
        a, b, d, e, tx, ty = manifest["rigid"]
        src = [[source["surfaces"][manifest["sourceSurface"]]["points"][i][j] for j in [0, 2]]
               for i in manifest["sourceVertexIndexes"]] + cage
        dst = [[target["surfaces"][manifest["targetSurface"]]["points"][i][j] for j in [0, 2]]
               for i in manifest["targetVertexIndexes"]] + [[a*x+b*y+tx, d*x+e*y+ty] for x, y in cage]
        mapped_polygons, source_polygons, triangle_records = [], [], []
        for index, triangle in enumerate(manifest["triangles"]):
            left, right = [[points[i] for i in triangle] for points in [src, dst]]
            u, v = sub(left[1], left[0]), sub(left[2], left[0])
            p, q = sub(right[1], right[0]), sub(right[2], right[0])
            determinant = cross(u, v)
            matrix = [[(p[i]*v[1]-q[i]*u[1])/determinant, (-p[i]*v[0]+q[i]*u[0])/determinant] for i in range(2)]
            jacobian = cross(p, q) / determinant
            trace = sum(value*value for row in matrix for value in row)
            spread = math.sqrt(max(0, trace*trace - 4*jacobian*jacobian))
            singular = [math.sqrt((trace-spread)/2), math.sqrt((trace+spread)/2)]
            source_polygon, target_polygon = Polygon(left), Polygon(right)
            source_polygons.append(source_polygon)
            mapped_polygons.append(target_polygon)
            if source_polygon.intersection(template).area > .01:
                triangle_records.append({"triangleIndex": index, "areaJacobian": jacobian,
                                         "singularValues": singular, "anisotropyRatio": singular[1]/singular[0]})
        results[number] = {
            "scope": "Initial exterior registration controls, not an assertion that every final room is a piecewise-affine donor polygon.",
            "allUsedTrianglesOrientationPreserving": all(item["areaJacobian"] > 0 for item in triangle_records),
            "targetCageOverlapArea": sum(p.area for p in mapped_polygons) - unary_union(mapped_polygons).area,
            "sourceCageCoverageDifference": unary_union(source_polygons).symmetric_difference(Polygon(cage)).area,
            "usedTriangleAreaJacobianRange": [min(t["areaJacobian"] for t in triangle_records), max(t["areaJacobian"] for t in triangle_records)],
            "maximumUsedTriangleAnisotropy": max(t["anisotropyRatio"] for t in triangle_records),
            "usedTriangles": triangle_records,
            "meaning": "Positive registration can preserve topology while bending or tapering a donor outline. Final-room shape metrics are assessed separately. The registration alone does not validate an interior plan.",
        }
    return results


def conditional_envelope_checks(house_metadata, level):
    """Measure separately declared comparison polygons without claiming net area."""
    by_label = {space["shortLabel"]: space for space in level["spaces"] if space["kind"] == "room"}
    rooms = []
    for bank, bank_metadata in house_metadata.get("banks", {}).items():
        fit = bank_metadata.get("straightFit", {})
        if not fit.get("accepted"):
            continue
        for index, rings in enumerate(fit.get("internalEnvelopePolygons", [])):
            label = f"{bank}{index + 1}"
            space = by_label.get(label)
            if space is None:
                raise ValueError(f'Missing accepted {bank}-bank comparison room {label} on floor {level["index"]}')
            envelope, gross = Polygon(rings[0], rings[1:]), shape(space)
            rooms.append({
                "id": space["id"], "label": label,
                "grossAllocationArea": gross.area,
                "conditionalComparisonEnvelopeArea": envelope.area,
                "conditionalComparisonOutsideGrossRoomArea": envelope.difference(gross).area,
                "differenceFromGeneratorComparisonArea": envelope.area - fit["internalArea"],
                "targetComparisonArea": fit["parameters"]["targetInternalAreaSquareMetres"],
                "targetComparisonResidual": envelope.area - fit["parameters"]["targetInternalAreaSquareMetres"],
            })
    if not rooms:
        return None
    return {
        "method": "Independent Shapely area and containment measurements of the separately declared internal comparison polygons; this is not a second derivation of the wall-allowance model.",
        "meaning": "These polygons depend on assumed exterior/partition allowances and a borrowed category-average benchmark. They are neither measured clear/rental/net areas nor established bath/kitchen/room boundaries.",
        "rooms": rooms,
        "allComparisonPolygonsInsideGrossRoomsWithinNumericalTolerance": all(
            room["conditionalComparisonOutsideGrossRoomArea"] < 1e-5 for room in rooms),
        "maximumComparisonAreaArithmeticDifference": max(
            abs(room["differenceFromGeneratorComparisonArea"]) for room in rooms),
    }


def draw(report, drawings, metadata, path):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import PathPatch, Patch as Legend
    from matplotlib.path import Path as PlotPath
    from shapely.geometry.polygon import orient

    def add_polygon(axis, polygon, project, **style):
        polygon = orient(polygon, sign=1)
        vertices, codes = [], []
        for ring in [polygon.exterior, *polygon.interiors]:
            points = [project(point) for point in ring.coords]
            vertices.extend(points)
            codes.extend([PlotPath.MOVETO, *([PlotPath.LINETO] * (len(points)-2)), PlotPath.CLOSEPOLY])
        axis.add_patch(PathPatch(PlotPath(vertices, codes), **style))

    colors = {"room": "#c9d7cc", "corridor": "#f7f5ef", "stairs": "#b4a892", "service": "#d8cddd"}
    fig, axes = plt.subplots(5, 3, figsize=(20, 24), layout="constrained")
    fig.set_facecolor("#faf9f5")
    for row, number in enumerate(HOUSES):
        axis_u = STUDY_AXIS
        if number != "55":
            a, b, d, e, _, _ = metadata["houses"][number]["registration"]["rigidCageTransform"]
            axis_u = [a*STUDY_AXIS[0]+b*STUDY_AXIS[1], d*STUDY_AXIS[0]+e*STUDY_AXIS[1]]
            norm = math.hypot(*axis_u)
            axis_u = [value/norm for value in axis_u]
        axis_v = [-axis_u[1], axis_u[0]]
        frames = []
        for column in range(3):
            panel = drawings[(number, column)]
            center = drawings[(number, 2)]["floor"].centroid
            project = lambda point: [dot(sub(point, [center.x, center.y]), axis_u),
                                     dot(sub(point, [center.x, center.y]), axis_v)]
            frames.append((panel, project))
        extents = [point for panel, project in frames for polygon in parts(panel["floor"])
                   for point in map(project, polygon.exterior.coords)]
        xlim = (min(p[0] for p in extents)-1.8, max(p[0] for p in extents)+1.8)
        ylim = (max(p[1] for p in extents)+1.8, min(p[1] for p in extents)-1.8)
        for column, (panel, project) in enumerate(frames):
            axis = axes[row, column]
            record = report["houses"][number]["levels"][column]
            axis.set_facecolor("#faf9f5")
            for polygon in parts(panel["floor"]):
                add_polygon(axis, polygon, project, facecolor="#e8e4db", edgecolor="#373c37", lw=1.2)
            for polygon in parts(panel["remainder"]):
                add_polygon(axis, polygon, project, facecolor="#e8e4db", edgecolor="#a49f94", lw=.3, hatch="///")
            review = {room["id"] for room in record["roomShapeMetrics"] if room["shapeReviewRequired"]}
            for space in panel["level"]["spaces"]:
                polygon = panel["polygons"][space["id"]]
                fill = "#e8cbb1" if space["id"] in review else colors.get(space["kind"], "#e8e4db")
                add_polygon(axis, polygon, project, facecolor=fill,
                            edgecolor="#61665d", lw=.55, hatch="xx" if space["kind"] == "service" else None)
                # Small stair-side residues are legible through their hatch;
                # a word label would cover the adjacent stair and doorway.
                if polygon.area > (10 if space["kind"] == "service" else 3):
                    p = project(list(polygon.representative_point().coords)[0])
                    axis.text(*p, space["shortLabel"], fontsize=6.5, ha="center", va="center",
                              rotation=90 if space["kind"] == "stairs" else 0)
            for door in panel["level"]["doors"]:
                a, b = map(project, door["segment"])
                axis.plot([a[0], b[0]], [a[1], b[1]], color="#2c8196", lw=1.5)
            inventory = record["inventory"]
            areas = record["grossRoomAreaDistribution"]
            missing = len(record["doorAccess"]["roomsWithoutRepresentedStairRoute"])
            axis.set_title(f'House {number} · {record["floorLabel"]} · {inventory["studyRoomHypotheses"]} room hypotheses / {inventory["publicIndexEntries"]} index entries', fontsize=10, loc="left")
            axis.text(.0, -.02,
                      f'Gross rooms {areas["minimum"]:.1f}–{areas["maximum"]:.1f} m² · unmodeled plate {record["partition"]["unmodeledFloorArea"]:.1f} m²\n'
                      f'{missing} rooms without a represented stair route · all interiors remain estimates',
                      transform=axis.transAxes, fontsize=8, color="#62665c", va="top")
            axis.set_xlim(*xlim)
            axis.set_ylim(*ylim)
            axis.set_aspect("equal")
            axis.axis("off")
    fig.suptitle("Old-house interior hypotheses · independent geometry audit\n"
                 "Each house retains its own source shell at a provisional floor height. These are comparative studies, not verified plans.",
                 fontsize=17, x=.025, ha="left")
    fig.legend(handles=[
        Legend(facecolor=colors["room"], label="Gross room hypothesis"),
        Legend(facecolor="#e8cbb1", label="Bent/tapered geometry to review"),
        Legend(facecolor=colors["corridor"], edgecolor="#777", label="Gross corridor"),
        Legend(facecolor=colors["stairs"], label="Inferred stair"),
        Legend(facecolor=colors["service"], hatch="xx", label="Explicitly unassigned"),
        Legend(facecolor="#e8e4db", hatch="///", label="Unmodeled source-floor area"),
    ], loc="outside lower center", ncol=3, frameon=False, fontsize=10)
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=140)
    plt.close(fig)


def main(args):
    studies, metadata, lod, campus, approved, markers = map(load, [
        args.study, args.metadata, ROOT/"public/data/lod2.json", ROOT/"public/data/campus.json",
        ROOT/"public/data/interiors.json", ROOT/"public/data/room-markers.json"])
    lod = {building["number"]: building for building in lod["buildings"]}
    campus = {building["number"]: building for building in campus["buildings"]}
    if any(number not in studies["buildings"] for number in HOUSES):
        raise ValueError("Wait for all five old-house studies to be generated before this audit")
    report = {
        "schemaVersion": 1, "status": "Independent geometric audit of unverified interior hypotheses.",
        "inputs": [fingerprint(path) for path in [args.study, args.metadata, ROOT/"public/data/lod2.json",
                   ROOT/"public/data/interiors.json", ROOT/"public/data/campus.json", ROOT/"public/data/room-markers.json",
                   ROOT/"scripts/generate-old-house-studies.mjs"]],
        "numericalTolerances": {"strictAreaPartition": 1e-5, "pairwiseOverlapArea": 1e-5,
                                "publishedFloorContainmentArea": "published perimeter × 0.0002m",
                                "publishedFloorContainmentMaxOffsetMetres": .0002,
                                "independentSectionDifferenceArea": "retained source perimeter × 0.0002m",
                                "independentSectionBoundaryOffsetMetres": .001,
                                "doorBoundaryDistanceMetres": .002,
                                "conditionalEnvelopeOutsideRoomArea": 1e-5,
                                "conditionalEnvelopeAreaArithmeticDifference": 2e-5,
                                "meaning": "Numerical comparison tolerances for independently sliced and serialized geometry, not survey accuracy or permitted physical construction deviations."},
        "publicIndexSource": {"url": markers["source"], "retrieved": markers["retrieved"],
                              "meaning": markers["description"], "coverage": markers["coverage"]},
        "donor": {"house": "55", "floorIndex": 2, "meaning": "Only House 55's top floor has resident-informed relative layout constraints. Its dimensions, lower-floor repetitions, and all target-house interiors remain estimates."},
        "generatorMethod": metadata["method"], "generatorMethodVersion": metadata.get("methodVersion"),
        "houses": {},
        "limits": [
            "Source-shell containment and disjoint polygons establish a consistent drawing, not actual apartment positions, dimensions, doorways, or floor elevations.",
            "Room distributions use gross allocation polygons. Separately labeled conditional-envelope comparisons measure declared hypothesis polygons; they do not establish measured clear, rental, or net area.",
            "Positive piecewise-affine deformation can bend straight room walls. Orange rooms identify shape assumptions that need plans or resident correction.",
            "Only recorded doors create access edges. Missing stair connections are an explicit incomplete-model finding and must not be concealed by inventing a doorway.",
            "The 1.20m circular corridor sweep is a comparative gross-geometry diagnostic, not a building-code, escape-route, or accessibility determination.",
            "Unassigned wings, low-roof margins, and the unresolved House 59 east bank are not silently counted as apartments.",
        ],
    }
    drawings, all_levels = {}, []
    donor = next(level for level in studies["buildings"]["55"]["levels"] if level["index"] == 2)
    registrations = registration_checks(metadata, lod, donor)
    for number in HOUSES:
        building = lod[number]
        levels = sorted(studies["buildings"][number]["levels"], key=lambda level: level["index"])
        if [level["index"] for level in levels] != [0, 1, 2]:
            raise ValueError(f"House {number} needs exactly EG, 1. OG, and 2. OG")
        elevations = source_elevations(building, campus[number]["levels"], approved)
        house_meta = metadata["houses"].get(number, {})
        record = {"officialBuildingId": building["id"], "levelCount": len(levels),
                  "comparisonWithHouse55": registrations.get(number),
                  "bankCountHypotheses": house_meta.get("banks"), "levels": []}
        for level in levels:
            index = level["index"]
            marker_count = markers["summary"].get(number, {}).get("floors", {}).get(str(index))
            metadata_level = next((item for item in house_meta.get("levels", []) if item["index"] == index), None)
            audit, drawing = audit_level(number, level, building, elevations[index], marker_count, metadata_level)
            comparison = conditional_envelope_checks(house_meta, level)
            audit["conditionalEnvelopeComparison"] = comparison
            if comparison:
                audit["numericalChecks"]["declaredComparisonEnvelopesInsideRooms"] = comparison[
                    "allComparisonPolygonsInsideGrossRoomsWithinNumericalTolerance"]
                audit["numericalChecks"]["declaredComparisonAreaArithmeticMatches"] = comparison[
                    "maximumComparisonAreaArithmeticDifference"] < 2e-5
                if not all(audit["numericalChecks"].values()) and audit["numericalGeometryChecksPass"]:
                    audit["findings"].append({
                        "type": "conditional-envelope-numerical-defect",
                        "detail": "A declared conditional comparison envelope does not fit its displayed room or match its own reported area within numerical tolerances.",
                    })
                audit["numericalGeometryChecksPass"] = all(audit["numericalChecks"].values())
            record["levels"].append(audit)
            drawings[(number, index)] = drawing
            all_levels.append(audit)
        report["houses"][number] = record
    report["summary"] = {
        "houseCount": len(HOUSES), "floorCount": len(all_levels),
        "allNumericalGeometryChecksPass": all(level["numericalGeometryChecksPass"] for level in all_levels),
        "studyRoomHypotheses": sum(level["inventory"]["studyRoomHypotheses"] for level in all_levels),
        "publicIndexEntries": sum(level["inventory"]["publicIndexEntries"] or 0 for level in all_levels),
        "maximumPairwiseOverlapArea": max(level["partition"]["pairwiseOverlapArea"] for level in all_levels),
        "maximumIndependentSectionDifferenceArea": max(level["sourceFloor"]["symmetricDifferenceArea"] for level in all_levels),
        "roomHypothesesWithoutRepresentedStairRoute": sum(len(level["doorAccess"]["roomsWithoutRepresentedStairRoute"]) for level in all_levels),
        "roomHypothesesFlaggedForShapeReview": sum(room["shapeReviewRequired"] for level in all_levels for room in level["roomShapeMetrics"]),
        "unmodeledSourceFloorArea": sum(level["partition"]["unmodeledFloorArea"] for level in all_levels),
        "explicitUnassignedAreaWithinFloors": sum(
            level["partition"]["explicitUnassignedAreaWithinFloor"] for level in all_levels),
        "totalUnassignedOrUnmodeledFloorArea": sum(
            level["partition"]["totalUnassignedOrUnmodeledFloorArea"] for level in all_levels),
        "meaning": "Counts sum separate floor hypotheses, not unique verified apartments or residents. Numerical consistency does not resolve shape, inventory, or access evidence gaps.",
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    draw(report, drawings, metadata, args.plot)
    print(json.dumps({"report": str(args.output), "plot": str(args.plot), **report["summary"]}, indent=2))
    if not report["summary"]["allNumericalGeometryChecksPass"]:
        raise SystemExit(2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--study", type=Path, default=ROOT/"public/data/interior-studies.json")
    parser.add_argument("--metadata", type=Path, default=ROOT/"data/source/old-house-study-provenance.json")
    parser.add_argument("--output", type=Path, default=ROOT/"docs/evidence/old-house-studies-audit.json")
    parser.add_argument("--plot", type=Path, default=ROOT/"docs/screenshots/older-houses/old-house-studies-overview.png")
    main(parser.parse_args())
