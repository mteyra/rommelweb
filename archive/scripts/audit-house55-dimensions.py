#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["shapely==2.1.2", "matplotlib==3.10.8"]
# ///
"""Read-only metric and packing audit of House 55's index-2 study.

Run with `uv run scripts/audit-house55-dimensions.py --help`.
The optional packing rectangles are mathematical witnesses, not room layouts.
This script never writes source geometry, studies, provenance or approvals.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET

from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
MAGNITUDE = math.hypot(0.676, 0.737)
RIGHT = (0.676 / MAGNITUDE, 0.737 / MAGNITUDE)
GROUPS = {
    "A–D": (list("ABCD"), 0, "sw-known-four"),
    "E–G": (list("EFG"), 1, "east-known-three"),
    "W1–W4": (["W1", "W2", "W3", "W4"], 1, "west-question"),
    "L1–L3": (["L1", "L2", "L3"], 0, "center-left-question"),
    "R1–R3": (["R1", "R2", "R3"], 0, "center-right-question"),
    "N1–N3": (["N1", "N2", "N3"], 0, "upper-right-question"),
}
EXPECTED_LABELS = {label for labels, _, _ in GROUPS.values() for label in labels}


def local(point):
    x, z = point
    return [x * RIGHT[0] + z * RIGHT[1], -x * RIGHT[1] + z * RIGHT[0]]


def read_json(path):
    return json.loads(path.read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def report_path(path):
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def load_study(path):
    data = read_json(path)
    if "level" in data:
        level = data["level"]
    else:
        level = next(
            level for level in data["buildings"]["55"]["levels"]
            if level["index"] == 2
        )
    if level["index"] != 2:
        raise ValueError("This audit is specifically for House 55 / index 2")
    rooms = [space for space in level["spaces"] if space["kind"] == "room"]
    if {space["shortLabel"] for space in rooms} != EXPECTED_LABELS:
        raise ValueError("Study does not retain the twenty confirmed drawing references")
    polygons = {
        space["shortLabel"]: Polygon(
            [local(point) for point in space["polygon"]],
            [[local(point) for point in ring] for ring in space.get("holes", [])],
        )
        for space in level["spaces"]
    }
    if any(not polygon.is_valid for polygon in polygons.values()):
        raise ValueError("Invalid study polygon; do not repair it silently in the audit")
    outline = unary_union([
        Polygon(
            [local(point) for point in piece["outer"]],
            [[local(point) for point in ring] for ring in piece.get("holes", [])],
        )
        for piece in level["floorOutline"]
    ])
    metadata = data.get("metadata")
    if metadata is None:
        metadata = read_json(ROOT / "data/source/house55-2og-study-provenance.json")
    return level, polygons, outline, metadata


def components(geometry):
    if geometry.is_empty:
        return []
    return list(geometry.geoms) if hasattr(geometry, "geoms") else [geometry]


def boundary_points(geometry):
    return [
        point for polygon in components(geometry)
        for ring in [polygon.exterior, *polygon.interiors]
        for point in ring.coords
    ]


def extent(points):
    xs, ys = zip(*points)
    bounds = [min(xs), min(ys), max(xs), max(ys)]
    return {
        "bounds": bounds,
        "width": bounds[2] - bounds[0],
        "depth": bounds[3] - bounds[1],
    }


def linear_samples(start, stop, count=33):
    return {start + (stop - start) * i / (count - 1) for i in range(count)}


def packing_witness(polygon, width, depth, inset, front):
    """Find an axis-aligned rectangle; never resize or rotate source geometry."""
    available = polygon.buffer(-inset, join_style=2)
    if available.is_empty:
        return None
    x0, y0, x1, y1 = available.bounds
    if x1 - x0 + 1e-8 < width or y1 - y0 + 1e-8 < depth:
        return None
    xs, ys = linear_samples(x0, x1 - width), linear_samples(y0, y1 - depth)
    for point in boundary_points(available):
        for x in [point[0], point[0] - width]:
            if x0 <= x <= x1 - width:
                xs.add(x)
        for y in [point[1], point[1] - depth]:
            if y0 <= y <= y1 - depth:
                ys.add(y)
    for y in sorted(ys, reverse=front == "bottom"):
        for x in sorted(xs, reverse=front == "right"):
            witness = box(x, y, x + width, y + depth)
            # Only a ten-nanometre numerical boundary allowance. The 0.10 m
            # architectural inset is an explicit, independent sensitivity.
            if available.buffer(1e-8).covers(witness):
                return witness
    return None


def stair_alignment_audit(polygons, flight, flat_points):
    """Measure the two resident constraints independently of generator metadata."""
    origin = flat_points[3]
    edge = [flat_points[4][i] - origin[i] for i in range(2)]
    length = math.hypot(*edge)
    down = [value / length for value in edge]
    east = [down[1], -down[0]]

    def projected(point, axis):
        return sum((point[i] - origin[i]) * axis[i] for i in range(2))

    def point_at(u, v):
        return [origin[i] + u * east[i] + v * down[i] for i in range(2)]

    def cross(a, b):
        return a[0] * b[1] - a[1] * b[0]

    # Match the visible corner offset, not an average Y separation. The
    # quantized source return is slightly skew to the study axes.
    west_edge = [flat_points[21][i] - flat_points[22][i] for i in range(2)]
    west_length = math.hypot(*west_edge)
    west_south = [-west_edge[1] / west_length, west_edge[0] / west_length]
    facade_delta = [flat_points[21][i] - flat_points[20][i] for i in range(2)]
    facade_length = math.hypot(*facade_delta)
    w4_corner = max(
        [point for point in polygons["W4"].exterior.coords
         if abs(cross([point[i] - flat_points[20][i] for i in range(2)], facade_delta)) / facade_length < 0.002],
        key=lambda point: point[1],
    )
    w4_offset = sum((w4_corner[i] - flat_points[21][i]) * west_south[i] for i in range(2))

    l_return = [flat_points[18][i] - flat_points[19][i] for i in range(2)]
    l_return_length = math.hypot(*l_return)
    l_west = [-l_return[1] / l_return_length, l_return[0] / l_return_length]
    l_ring = list(polygons["L1"].exterior.coords)
    long_sides = [
        (a, b) for a, b in zip(l_ring, l_ring[1:])
        if math.dist(a, b) > 2
        and abs(sum((b[i] - a[i]) * down[i] for i in range(2))) / math.dist(a, b) > 0.999
    ]
    a, b = min(long_sides, key=lambda pair: sum(projected(point, east) for point in pair))
    direction = [b[i] - a[i] for i in range(2)]
    delta = [a[i] - flat_points[18][i] for i in range(2)]
    l_offset = cross(delta, direction) / cross(l_west, direction)
    l_corner = [flat_points[18][i] + l_west[i] * l_offset for i in range(2)]

    if flight is None:
        raise ValueError("The stair alignment requires a separately identified flight")
    flight_values = [projected(point, down) for point in flight.exterior.coords]
    flight_min, flight_max = min(flight_values), max(flight_values)
    def cross_sections(shape):
        sections = []
        for fraction in [0.05, 0.25, 0.5, 0.75, 0.95]:
            v = flight_min + fraction * (flight_max - flight_min)
            section = shape.intersection(LineString([point_at(-100, v), point_at(100, v)]))
            lines = [part for part in components(section) if isinstance(part, LineString)]
            if len(lines) != 1:
                raise ValueError("Each stair cross-section must span one connected polygon")
            coordinates = [projected(point, east) for point in lines[0].coords]
            west, east_edge = min(coordinates), max(coordinates)
            if not west < 0 < east_edge:
                raise ValueError("The extended reference line must cross the staircase")
            width = east_edge - west
            sections.append({
                "flightFraction": fraction,
                "referenceIntersection": point_at(0, v),
                "lSideWidth": -west, "rSideWidth": east_edge,
                "grossWidth": width,
                "widthMeaning": "Width of the polygon being sectioned, not a surveyed clear dimension.",
                "lSideRatio": -west / width, "rSideRatio": east_edge / width,
            })
        return sections

    sections = cross_sections(polygons["Stairs"])
    flight_sections = cross_sections(flight)
    center = sections[2]
    flight_center = flight_sections[2]
    side_insets = {
        "l3Side": center["lSideWidth"] - flight_center["lSideWidth"],
        "r1Side": center["rSideWidth"] - flight_center["rSideWidth"],
    }
    return {
        "reference": {
            "sourceRoofSurfaceIndex": 39,
            "sourceRoofVertexIndexes": [3, 4],
            "sourceEdge": [flat_points[3], flat_points[4]],
            "towardNorth": [-value for value in down],
            "towardR1": east,
            "meaning": "The resident-marked exterior return is extended as a line; its geometry is not moved.",
        },
        "confirmedRatios": {"l3Side": 0.25, "r1Side": 0.75},
        "orientationClarification": "The resident explicitly clarified that three quarters lies on the R1 side. Side names override ambiguous screen-left/right wording.",
        "overlap": {
            "w4SourceReturn": [flat_points[22], flat_points[21]],
            "w4FacadeEndCorner": list(w4_corner),
            "w4PerpendicularOffset": w4_offset,
            "l1SourceReturn": [flat_points[19], flat_points[18]],
            "l1DividerAtSourceCornerNormal": l_corner,
            "l1PerpendicularOffset": l_offset,
            "equalityResidual": l_offset - w4_offset,
            "meaning": "Equal projected offsets of room dividers past source returns. This confirms relative alignment, not measured masonry thickness or overlapping room interiors.",
        },
        "crossSections": sections,
        "crossSectionsMeaning": "Gross enclosure measured at five positions along the separately drawn flight.",
        "grossWidthAtFlightCenter": center["grossWidth"],
        "lSideWidthAtFlightCenter": center["lSideWidth"],
        "rSideWidthAtFlightCenter": center["rSideWidth"],
        "maximumRatioError": max(abs(section["lSideRatio"] - 0.25) for section in sections),
        "widthVariationAcrossFlight": max(section["grossWidth"] for section in sections) - min(section["grossWidth"] for section in sections),
        "schematicFlight": {
            "crossSections": flight_sections,
            "widthAtCenter": flight_center["grossWidth"],
            "lSideWidthAtCenter": flight_center["lSideWidth"],
            "rSideWidthAtCenter": flight_center["rSideWidth"],
            "l3ShareAtCenter": flight_center["lSideRatio"],
            "r1ShareAtCenter": flight_center["rSideRatio"],
            "sideInsetsFromEnclosure": side_insets,
            "widthVariation": max(section["grossWidth"] for section in flight_sections) - min(section["grossWidth"] for section in flight_sections),
            "lShareRange": [min(section["lSideRatio"] for section in flight_sections), max(section["lSideRatio"] for section in flight_sections)],
            "meaning": "Independent sections of the schematic flight. Its side insets change the split while the gross enclosure and west door remain fixed.",
        },
        "fixedWestEdgeWidthForL3Range20To25Percent": {
            "minimum": center["lSideWidth"] / .25,
            "maximum": center["lSideWidth"] / .20,
            "meaning": "A right-edge-only enclosure shrink below the current quarter-split width would increase the L3 share above 25%.",
        },
        "meaning": "Ratios are recomputed from actual enclosure cross-sections normal to the unchanged source edge. Gross width is derived after retaining the estimated L bays; it is not a surveyed or clear stair dimension.",
    }


def raw_source_metrics(building):
    ns = {
        "gml": "http://www.opengis.net/gml",
        "bldg": "http://www.opengis.net/citygml/building/1.0",
    }
    root = ET.parse(ROOT / "data/source/dorms-lod2.gml").getroot()
    source = next(
        item for item in root.iter()
        if item.attrib.get("{http://www.opengis.net/gml}id") == building["id"]
    )
    surfaces = []
    for bound in source.findall("./bldg:boundedBy", ns):
        surface = list(bound)[0]
        for polygon in surface.findall(".//gml:Polygon", ns):
            positions = polygon.find("./gml:exterior/gml:LinearRing/gml:posList", ns)
            values = list(map(float, positions.text.split()))
            surfaces.append({
                "id": polygon.attrib.get("{http://www.opengis.net/gml}id"),
                "points": [values[i:i + 3] for i in range(0, len(values), 3)],
            })
    roof_id = building["surfaces"][39]["id"]
    matches = [surface for surface in surfaces if surface["id"] == roof_id]
    if len(matches) != 1:
        raise ValueError("The web annotation roof must match exactly one raw GML polygon ID")
    roof = matches[0]["points"]
    if len(roof) != len(building["surfaces"][39]["points"]):
        raise ValueError("Raw/rendered surface order changed; review metric correspondence")
    axis = [roof[0][i] - roof[23][i] for i in range(2)]
    length = math.hypot(*axis)
    axis = [value / length for value in axis]
    down = [-axis[1], axis[0]]
    if sum((roof[21][i] - roof[20][i]) * down[i] for i in range(2)) < 0:
        down = [-value for value in down]
    origin = roof[23]

    def aligned(point):
        delta = [point[i] - origin[i] for i in range(2)]
        return [sum(delta[i] * vector[i] for i in range(2)) for vector in [axis, down]]

    edges = []
    for a, b in [(23, 0), (9, 10), (20, 21), (18, 17), (6, 7), (12, 13)]:
        raw_length = math.dist(roof[a][:2], roof[b][:2])
        points = building["surfaces"][39]["points"]
        web_length = math.dist([points[a][0], points[a][2]], [points[b][0], points[b][2]])
        edges.append({
            "sourceVertexIndexes": [a, b],
            "rawUTMLength": raw_length,
            "webLocalLength": web_length,
            "relativeDifferencePercent": 100 * (web_length / raw_length - 1),
        })
    return {
        "crs": "EPSG:25832",
        "matchedRoofPolygonId": roof_id,
        "alignedAxis": "Source flat-roof edge 23→0; perpendicular toward edge 20→21.",
        "alignedWholeModel": extent([aligned(point) for surface in surfaces for point in surface["points"]]),
        "alignedFlatRoof": extent([aligned(point) for point in roof]),
        "flatRoofPlanArea": Polygon([point[:2] for point in roof]).area,
        "edgeComparisons": edges,
    }


def audit(args):
    level, polygons, floor, metadata = load_study(args.study)
    r_alignment = metadata.get("rAlignment")
    baseline_level, baseline = (None, None)
    if args.baseline:
        baseline_level, baseline, _, _ = load_study(args.baseline)
    space_records = {space["shortLabel"]: space for space in level["spaces"]}
    space_ids = {space["id"]: space for space in level["spaces"]}
    corridors = {
        label: polygons[label] for label, space in space_records.items()
        if space["kind"] == "corridor"
    }
    baseline_corridors = {
        space["shortLabel"]: baseline[space["shortLabel"]]
        for space in baseline_level["spaces"] if space["kind"] == "corridor"
    } if baseline_level else {}
    lod2 = read_json(ROOT / "public/data/lod2.json")
    building = next(item for item in lod2["buildings"] if item["number"] == "55")
    flat = Polygon([local([point[0], point[2]]) for point in building["surfaces"][39]["points"]])
    annotated = floor.intersection(flat)
    occupied = {
        label: polygon for label, polygon in polygons.items()
        if space_records[label]["kind"] != "corridor"
    }
    used = unary_union(list(occupied.values()))
    hall = annotated.difference(used)
    outside = used.difference(annotated)
    witnesses, rows = {}, []
    for label in [label for labels, _, _ in GROUPS.values() for label in labels]:
        polygon = polygons[label]
        front = (
            "bottom" if label in list("ABCD") + ["R1", "R2", "R3"]
            else "right" if label in list("EFG")
            else "left" if label.startswith("W")
            else "top"
        )
        witness = next((
            item for item in [
                packing_witness(polygon, 2.7, 3.3, args.inset, front),
                packing_witness(polygon, 3.3, 2.7, args.inset, front),
            ] if item is not None
        ), None)
        witnesses[label] = witness
        available = polygon.buffer(-args.inset, join_style=2)
        inner_bounds = list(available.bounds)
        inner_spans = [inner_bounds[2] - inner_bounds[0], inner_bounds[3] - inner_bounds[1]]
        rows.append({
            "label": label,
            "grossPolygonArea": polygon.area,
            "projectedBounds": list(polygon.bounds),
            "baselineArea": baseline[label].area if baseline else None,
            "baselineBounds": list(baseline[label].bounds) if baseline else None,
            "packingWitness": list(witness.exterior.coords) if witness is not None else None,
            "packingWitnessMeaning": "Existence witness only; not a measured living-room position.",
            "insetBoundingSpans": inner_spans,
            "impossibleAtAnyRotationByBoundingWidth": min(inner_spans) < 2.7 - 1e-8,
        })
    groups = []
    measurements = {
        item["id"]: item for item in metadata["roomInterpretation"]["zoneMeasurements"]
    }
    for name, (labels, axis, key) in GROUPS.items():
        source = measurements[key]
        selected = [row for row in rows if row["label"] in labels]
        group_bounds = unary_union([polygons[label] for label in labels]).bounds
        current_run = group_bounds[axis + 2] - group_bounds[axis]
        groups.append({
            "name": name, "count": len(labels), "runAxis": axis,
            "nominalRun": current_run,
            "nominalAverageGrossBay": current_run / len(labels),
            "runMeaning": "Current projected envelope extent; slight source skew differs from the nominal division interval.",
            "earlierStageNominalRun": source["runMetres"],
            "grossPolygonArea": sum(row["grossPolygonArea"] for row in selected),
            "baselineGrossPolygonArea": sum(row["baselineArea"] for row in selected) if baseline else None,
            "packingWitnessCount": sum(row["packingWitness"] is not None for row in selected),
        })
    entry_checks = {}
    eroded = hall.buffer(-0.65)
    for label, polygon in occupied.items():
        if space_records[label]["kind"] != "room":
            continue
        x0, y0, x1, y1 = polygon.bounds
        if label in list("ABCD") + ["R1", "R2", "R3"]:
            probe = Point((x0 + x1) / 2, y0 - 0.66)
        elif label in list("EFG"):
            probe = Point(x0 - 0.66, (y0 + y1) / 2)
        elif label.startswith("W"):
            probe = Point(x1 + 0.66, (y0 + y1) / 2)
        else:
            probe = Point((x0 + x1) / 2, y1 + 0.66)
        entry_checks[label] = eroded.covers(probe)
    # Door adjacency comes from the saved segments only. It must not be
    # inferred from a visually tempting passage beside a stairwell.
    access_edges, door_records = [], []
    graph = {label: set() for label in polygons}
    for door in level.get("doors", []):
        target = space_ids[door["spaceId"]]["shortLabel"]
        segment = LineString([local(point) for point in door["segment"]])
        midpoint = segment.interpolate(0.5, normalized=True)
        adjacent = [
            label for label, polygon in corridors.items()
            if polygon.boundary.distance(midpoint) <= 0.002
        ]
        for label in adjacent:
            graph[label].add(target)
            graph[target].add(label)
            access_edges.append({
                "from": label, "to": target, "doorId": door["id"],
                "confidence": door["confidence"],
            })
        door_records.append({
            "id": door["id"], "target": target,
            "segment": list(segment.coords), "width": segment.length,
            "adjacentHallways": adjacent,
            "confidence": door["confidence"],
        })
        if space_records[target]["kind"] == "stairs":
            first, last = segment.coords[0], segment.coords[-1]
            normal = [-(last[1] - first[1]) / segment.length, (last[0] - first[0]) / segment.length]
            entry_checks[target] = any(
                corridors[label].buffer(-0.65).covers(Point(
                    midpoint.x + sign * normal[0] * 0.66,
                    midpoint.y + sign * normal[1] * 0.66,
                ))
                for label in adjacent for sign in [-1, 1]
            )
    access_components, unseen = [], set(graph)
    while unseen:
        pending = [min(unseen)]
        reached = set()
        while pending:
            label = pending.pop()
            if label in reached:
                continue
            reached.add(label)
            pending.extend(graph[label] - reached)
        unseen -= reached
        access_components.append(sorted(reached))
    stair_record = next((space for space in level["spaces"] if space["kind"] == "stairs"), None)
    flight = Polygon([local(point) for point in stair_record["stairFlight"]]) if stair_record and stair_record.get("stairFlight") else None
    flat_points = [local([point[0], point[2]]) for point in building["surfaces"][39]["points"]]
    pairs = list(occupied.values())
    all_spaces = list(polygons.values())
    window_records = [{
        "id": window["id"],
        "roomReference": space_ids[window["spaceId"]]["shortLabel"] if window.get("spaceId") else None,
        "sourceSurfaceIndex": window["sourceSurfaceIndex"],
        "segment": [local(point) for point in window["segment"]],
        "width": LineString(window["segment"]).length,
        "confidence": window["confidence"],
    } for window in level.get("windows", [])]
    band_polygons = [
        Polygon([local(point) for point in band["polygon"]], [[local(point) for point in ring] for ring in band.get("holes", [])])
        for band in level.get("wallBands", [])
    ]
    wall_stage = metadata.get("windowWallStudy", {})
    alignment = stair_alignment_audit(polygons, flight, flat_points) if metadata.get("stairAlignment") else None
    r_run = flat_points[7][0] - flat_points[6][0]
    offset = wall_stage.get("wallOffsets", {}).get("assumedOffsetMetres", 0)
    # A necessary bounding-width condition, not a fitted design solution.
    required_run = 3 * (2.7 + 2 * args.inset)
    west_return_y = (flat_points[21][1] + flat_points[22][1]) / 2
    similar_rooms = [{
        "label": label,
        "grossWidth": polygons[label].bounds[axis + 2] - polygons[label].bounds[axis],
        "grossDepth": polygons[label].bounds[3 - axis] - polygons[label].bounds[1 - axis],
        "grossArea": polygons[label].area,
    } for labels, axis, _ in GROUPS.values() for label in labels]
    depth_fit = metadata.get("dimensionRefit", {}).get("commonDepth")
    depth_verification = None
    if depth_fit:
        inputs = depth_fit["inputDepths"]
        expected = EXPECTED_LABELS - {"R1", "R2", "R3"}
        if len(inputs) != 17 or {item["label"] for item in inputs} != expected:
            raise ValueError("Common-depth provenance must identify exactly the seventeen non-R input rooms")
        computed_depth = sum(item["projectedGrossDepthMetres"] for item in inputs) / len(inputs)
        recorded_depth = depth_fit["candidateGrossDepthMetres"]
        mean_errors = {}
        for name, (labels, _, _) in GROUPS.items():
            if labels[0].startswith("R"):
                continue
            selected = [row["grossDepth"] for row in similar_rooms if row["label"] in labels]
            mean_errors[name] = sum(selected) / len(selected) - computed_depth
        # The provenance and study serialize coordinates to six decimals.
        # This ten-micrometre tolerance compares calculations only; it is
        # not an architectural dimension tolerance or source accuracy claim.
        serialization_tolerance = 0.00001
        later_corrected_groups = set(GROUPS) if metadata.get("areaStudy") else (
            {"L1–L3"} if metadata.get("residentCorrections", {}).get("leftSide") else set()
        )
        checked_errors = [error for name, error in mean_errors.items() if name not in later_corrected_groups]
        valid = max([abs(recorded_depth - computed_depth), *map(abs, checked_errors)]) <= serialization_tolerance
        depth_verification = {
            "valid": valid,
            "supersededByAreaStudy": bool(metadata.get("areaStudy")),
            "inputMeaning": "Retained width-only modeling priors, not measured apartment depths.",
            "inputDepths": inputs,
            "computedArithmeticMean": computed_depth,
            "recordedTarget": recorded_depth,
            "targetDifference": recorded_depth - computed_depth,
            "actualGroupMeanMinusComputedTarget": mean_errors,
            "laterCorrectedGroups": sorted(later_corrected_groups),
            "laterCorrectionMeaning": (
                "Historical arithmetic only: the area-based stage supersedes these depth priors. Current room depths are no longer checked against the former 5.395m target."
                if metadata.get("areaStudy") else
                "The later L alignment follows source corners and retains its fitted south boundary. Its small source-skew depth change is reported explicitly rather than hidden by widening the historical fit tolerance."
            ),
            "serializationComparisonTolerance": serialization_tolerance,
            "method": "The arithmetic mean minimizes sum_i (D - priorDepth_i)^2. Unchanged group mean depths are independently checked against D; any later source-alignment correction is identified separately.",
            "corridorFacingWallChanges": depth_fit["corridorFacingWallChanges"],
        }
        if not valid:
            raise ValueError(f"Common-depth fit does not reproduce its retained inputs: {depth_verification}")
    report = {
        "status": "Read-only metric feasibility audit; no as-built, occupancy or approval claim.",
        "currentStage": metadata.get("currentStage"),
        "units": "metres; areas in square metres",
        "residentWorkingHypothesis": {
            "statement": "All top-floor apartments are single rooms, generally similar in size, with dimensional differences described as about a hand length.",
            "meaning": "A repeated single-apartment type with small dimensional variation is a qualitative prior. A hand length is not converted into a measured dimensional tolerance.",
            "latestCorrection": (
                "The estimated R bank is aligned to both opposite recess endpoints while source exterior, windows and the 1.20m connector study guard remain. The gross stair enclosure retains ¼ L3 / ¾ R1; the flight receives explicit 0.10m insets on both sides. Its neighboring narrow strip is unassigned with no assumed passage. R internal areas remain below the conditional benchmark."
                if r_alignment else
                "L1 matches the visible W4 corner overlap; the fixed source-edge extension divides the stair enclosure into one quarter on the L3 side and three quarters on the R1 side. Absolute dimensions and wall construction are unmeasured."
            ),
        },
        "input": {"path": report_path(args.study), "sha256": digest(args.study)},
        "baseline": {"path": report_path(args.baseline), "sha256": digest(args.baseline)} if args.baseline else None,
        "sourceSHA256": digest(ROOT / "public/data/lod2.json"),
        "rawSourceSHA256": digest(ROOT / "data/source/dorms-lod2.gml"),
        "provenanceSHA256": digest(ROOT / "data/source/house55-2og-study-provenance.json"),
        "studyAxes": {"right": RIGHT, "down": [-RIGHT[1], RIGHT[0]], "transform": "Orthonormal rotation of existing campus x,z."},
        "sourceMetrics": raw_source_metrics(building),
        "webMetrics": {
            "wholeModel": extent([local([point[0], point[2]]) for surface in building["surfaces"] for point in surface["points"]]),
            "retainedStudyFloorArea": floor.area,
            "annotatedFlatIntersectionArea": annotated.area,
            "rawExteriorHeightAttribute": building["height"],
        },
        "packing": {
            "referenceClearLivingZone": [2.7, 3.3],
            "referenceMeaning": "Approximate dimensions from a typical resident sketch, tested numerically as exact values; not a measurement of these twenty rooms.",
            "insetAssumption": args.inset,
            "insetMeaning": "Sensitivity clearance, not measured wall thickness or a building-code requirement.",
            "allowedWitnessOrientations": "Aligned to either study axis. Negative results with a narrow bounding strip also exclude every rotation.",
            "count": sum(row["packingWitness"] is not None for row in rows),
            "unresolved": [row["label"] for row in rows if row["packingWitness"] is None],
            "fullApartmentDimensions": None,
            "fullApartmentMeaning": "No complete apartment dimensions were supplied; living-zone fit cannot establish a repeated whole-apartment layout.",
            "negativeResultMeaning": "A conditional conflict in the current inferred envelopes, not proof that the physical apartments cannot share one type. Approximate reference dimensions and LoD2 uncertainty prevent interpreting a centimetre-scale raw-frontage difference as an interior survey.",
        },
        "shapeSimilarity": {
            "scope": "All twenty current candidate envelopes; their extents do not establish equal internal areas.",
            "meaning": "Projected gross polygon extents, not clear interior dimensions or a measured whole-apartment template.",
            "rooms": similar_rooms,
            "grossWidthRange": [min(row["grossWidth"] for row in similar_rooms), max(row["grossWidth"] for row in similar_rooms)],
            "grossDepthRange": [min(row["grossDepth"] for row in similar_rooms), max(row["grossDepth"] for row in similar_rooms)],
            "grossAreaRange": [min(row["grossArea"] for row in similar_rooms), max(row["grossArea"] for row in similar_rooms)],
            "commonDepthVerification": depth_verification,
        },
        "groups": groups, "rooms": rows,
        "windows": {
            "coverage": level.get("windowCoverage"),
            "count": len(window_records),
            "roomWindowCount": sum(record["roomReference"] is not None for record in window_records),
            "sharedUnassignedWindowCount": sum(record["roomReference"] is None for record in window_records),
            "records": window_records,
            "meaning": "Resident-informed locations; exact centers and widths are estimates. Four shared-area windows do not establish room ownership, doorways or access.",
        },
        "wallFaceHypothesis": {
            "stageMeaning": "Historical 0.20m window/wall-face trial, retained for comparison rather than used as the current R-bank dimensions.",
            "supersededByRAlignment": bool(r_alignment),
            "assumedOffset": offset,
            "sourceExteriorUnchanged": wall_stage.get("unchangedSourceExterior"),
            "sourceRFacadeAxisRun": r_run,
            "candidateRGrossAxisRun": r_run + offset,
            "necessaryGrossRunForThreeReferenceWidthsWithInset": required_run,
            "necessaryExtensionBeyondSourceAlignedR": max(0, required_run - r_run),
            "remainingNecessaryExtensionBeyondCandidate": max(0, required_run - r_run - offset),
            "requirementMeaning": "Historical candidate's necessary width bound under the declared 0.10m-per-side sensitivity. Current witness results are in packing; neither proves a complete apartment layout.",
            "westW4PastExteriorReturn": polygons["W4"].bounds[3] - west_return_y,
            "westW4PastAssumedInnerFace": polygons["W4"].bounds[3] - west_return_y - offset,
            "westReturnMeaning": "Historical comparison against the preceding 0.20m wall-band hypothesis, using a plan-axis average. The current stairAlignment section measures the actual corner-normal overlap and whether L1 matches it; no verified wall assembly is inferred.",
            "wallBandArea": sum(polygon.area for polygon in band_polygons),
            "wallBandOutsideFloorArea": sum(polygon.difference(floor).area for polygon in band_polygons),
            "wallBandMeaning": "Display hypothesis within gross envelopes, not extra usable floor area; independent spaces remain disjoint.",
        },
        "stairAlignment": alignment,
        "areaStudy": metadata.get("areaStudy"),
        "rAlignment": r_alignment,
        "topology": {
            "overlapArea": sum(first.intersection(second).area for i, first in enumerate(pairs) for second in pairs[i + 1:]),
            "allSpaceOverlapArea": sum(first.intersection(second).area for i, first in enumerate(all_spaces) for second in all_spaces[i + 1:]),
            "outsideAnnotatedArea": outside.area,
            "maximumOutsideDistance": max([annotated.boundary.distance(Point(point)) for point in boundary_points(outside)], default=0),
            "roomArea": sum(polygons[label].area for label in EXPECTED_LABELS),
            "baselineRoomArea": sum(baseline[label].area for label in EXPECTED_LABELS) if baseline else None,
            "stairArea": polygons["Stairs"].area,
            "unassigned": [{
                "label": label, "id": space_records[label]["id"], "area": polygon.area,
                "doorwayCount": sum(door["spaceId"] == space_records[label]["id"] for door in level.get("doors", [])),
                "declaredConnections": sorted(graph[label]), "assumedPassage": False,
            } for label, polygon in polygons.items() if space_records[label]["kind"] == "service"],
            "areaConservationResidual": sum(polygon.area for polygon in polygons.values()) - annotated.area,
            "remainderArea": hall.area,
            "baselineRemainderArea": sum(polygon.area for polygon in baseline_corridors.values()) if baseline else None,
            "remainderComponentAreas": sorted([item.area for item in components(hall)], reverse=True),
            "corridorSpaces": [{
                "label": label,
                "area": polygon.area,
                "bounds": list(polygon.bounds),
                "declaredDoorConnections": sorted(graph[label]),
                "erodedComponentsAboveOneSquareMetre": {
                    str(radius): len([item for item in components(polygon.buffer(-radius)) if item.area > 1])
                    for radius in [0.5, 0.6, 0.65, 0.7]
                },
            } for label, polygon in corridors.items()],
            "accessEdges": access_edges,
            "accessComponents": access_components,
            "doorAdjacencyToleranceMetres": 0.002,
            "doorRecords": door_records,
            "accessMeaning": "Edges use saved door segments only. Separate hallways do not imply a verified route through the stairwell; no eastern stairwell door is inferred.",
            "stairwell": {
                "label": stair_record["shortLabel"],
                "area": polygons[stair_record["shortLabel"]].area,
                "bounds": list(polygons[stair_record["shortLabel"]].bounds),
                "declaredHallwayConnections": sorted(graph[stair_record["shortLabel"]]),
                "flight": {
                    "area": flight.area, "bounds": list(flight.bounds),
                    "outsideEnclosureArea": flight.difference(polygons[stair_record["shortLabel"]]).area,
                    "meaning": "Separate schematic flight footprint; tread geometry, rise and exact landing dimensions are unmeasured.",
                } if flight else None,
            } if stair_record else None,
            "erodedComponentsAboveOneSquareMetre": {
                str(radius): len([item for item in components(hall.buffer(-radius)) if item.area > 1])
                for radius in [0.5, 0.6, 0.65, 0.7]
            },
            "midpointProbe1300mmSweep": entry_checks,
            "probeMeaning": "Room boundary-midpoint approaches and the declared stairwell-door approach, offset 0.66m into their respective hallway. These do not establish inter-hallway connectivity, passage through a door, or egress/accessibility compliance.",
            "diagnosticGrossGaps": {
                "westHall": polygons["L1"].bounds[0] - polygons["W3"].bounds[2],
                "stairsToR": polygons["Stairs"].distance(polygons["R1"]),
                "RToE": polygons["R3"].distance(polygons["F"]),
                "stairsSouth": polygons["Stairs"].distance(LineString(flat_points[2:4])),
            },
            "diagnosticGrossGapMeaning": "Distances between gross polygons only. The stairs-to-R gap is an explicitly unassigned strip after R alignment, not an established corridor or door connection.",
            "baselineSymmetricDifferenceArea": {
                label: polygons[label].symmetric_difference(baseline[label]).area
                for label in sorted(EXPECTED_LABELS)
            } if baseline else None,
            "nonLRoomPolygonsUnchanged": all(
                polygons[label].equals_exact(baseline[label], 0)
                for label in EXPECTED_LABELS - {"L1", "L2", "L3"}
            ) if baseline else None,
            "retainedRPolygonsUnchanged": all(
                polygons[label].equals_exact(baseline[label], 0)
                for label in ["R1", "R2", "R3"]
            ) if baseline else None,
            "nonLRRoomPolygonsUnchanged": all(
                polygons[label].equals_exact(baseline[label], 0)
                for label in EXPECTED_LABELS - {"L1", "L2", "L3", "R1", "R2", "R3"}
            ) if baseline else None,
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    for plot_path, with_baseline in [(args.plot, True), (args.plan_plot, False)]:
        if not plot_path:
            continue
        draw_plot(
            plot_path, flat, occupied,
            {label: polygon for label, polygon in baseline.items() if label not in baseline_corridors} if baseline and with_baseline else None,
            witnesses, corridors, flight, [record for record in door_records if record["target"] == stair_record["shortLabel"]] if stair_record else [],
            window_records, band_polygons, alignment, metadata.get("areaStudy"), r_alignment,
        )
    print(json.dumps({
        "report": str(args.output),
        "packingWitnesses": report["packing"]["count"],
        "unresolved": report["packing"]["unresolved"],
        "roomArea": report["topology"]["roomArea"],
        "remainderArea": report["topology"]["remainderArea"],
        "grossGaps": report["topology"]["diagnosticGrossGaps"],
    }, indent=2))


def draw_plot(path, flat, polygons, baseline, witnesses, corridors, flight, stair_doors, windows, wall_bands, alignment, area_study=None, r_alignment=None):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon as Patch

    panels = [(baseline, "Earlier geometry · depth fitted to prior estimates · before the confirmed stair alignment")] if baseline else []
    panels.append((polygons, "House 55 · 2. OG · aligned R-bank study · source shell and confirmed overlap retained"
                   if r_alignment else
                   "House 55 · 2. OG · area-based hypothesis · confirmed overlap and stair split retained"
                   if area_study else
                   "House 55 · 2. OG · matching W4 / L1 overlap · confirmed ¼ L3 / ¾ R1 stair split"))
    figure, axes = plt.subplots(len(panels), 1, figsize=(16, 8.5 * len(panels)), squeeze=False, layout="constrained")
    for axis, (items, title) in zip(axes[:, 0], panels):
        axis.add_patch(Patch(list(flat.exterior.coords), facecolor="#eeeae3", edgecolor="#41413c", linewidth=2))
        for label, polygon in items.items():
            for part in components(polygon):
                axis.add_patch(Patch(
                    list(part.exterior.coords),
                    facecolor="#dbd3df" if label == "Unassigned" else "#bab5a8" if label == "Stairs" else "#c9ccc3",
                    edgecolor="#555a50", linewidth=0.8,
                    hatch="xx" if label == "Unassigned" else "///" if items is polygons and label.startswith("R") else None,
                ))
            point = polygon.representative_point()
            if items is polygons and label == "Unassigned":
                axis.annotate(
                    "Unassigned strip + pocket\nNo assumed passage",
                    xy=(point.x, point.y), xytext=(17, 14.5), ha="center", fontsize=9,
                    arrowprops={"arrowstyle": "->", "color": "#85708d", "linewidth": .8},
                    color="#716078",
                )
            elif not (items is polygons and label == "Stairs" and flight is not None):
                axis.text(point.x, point.y, label, ha="center", va="center", fontsize=11)
            witness = witnesses.get(label)
            if items is polygons and witness is not None:
                axis.add_patch(Patch(list(witness.exterior.coords), fill=False, edgecolor="#576d7a", linewidth=1.2, linestyle="--"))
        if items is polygons:
            for band in wall_bands:
                axis.add_patch(Patch(list(band.exterior.coords), facecolor="#79786e", edgecolor="#67665d", linewidth=0.5, alpha=0.8, zorder=4))
            for window in windows:
                segment = LineString(window["segment"])
                xs, ys = segment.xy
                axis.plot(xs, ys, color="#f9f8f4", linewidth=6.5, solid_capstyle="butt", zorder=5)
                axis.plot(xs, ys, color="#287e9a", linewidth=3.5, solid_capstyle="butt", zorder=6)
            for label, corridor in corridors.items():
                point = corridor.representative_point()
                axis.text(point.x, point.y, label, ha="center", va="center", fontsize=9, color="#79746b")
            if flight is not None:
                axis.add_patch(Patch(
                    list(flight.exterior.coords), facecolor="#aaa497",
                    edgecolor="#655f54", hatch="///", linewidth=0.8,
                ))
                point = flight.representative_point()
                axis.text(point.x, point.y, "Flight", ha="center", va="center", rotation=90, fontsize=9)
                enclosure = polygons["Stairs"].bounds
                axis.text(
                    (enclosure[0] + enclosure[2]) / 2,
                    (enclosure[1] + flight.bounds[1]) / 2,
                    "Landing", ha="center", va="center", rotation=90, fontsize=8,
                )
            for door in stair_doors:
                segment = LineString(door["segment"])
                xs, ys = segment.xy
                axis.plot(xs, ys, color="#3d6678", linewidth=3, solid_capstyle="round")
                point = segment.interpolate(0.5, normalized=True)
                axis.annotate(
                    "West entry\nwidth estimated", xy=(point.x, point.y),
                    xytext=(point.x - 3.0, point.y), ha="right", va="center", fontsize=8,
                    arrowprops={"arrowstyle": "->", "color": "#3d6678", "linewidth": 0.8},
                )
            if alignment:
                overlap = alignment["overlap"]
                for name, corner, label_position, measured in [
                    ("W4", overlap["w4FacadeEndCorner"], (-8.0, 8.1), overlap["w4PerpendicularOffset"]),
                    ("L1", overlap["l1DividerAtSourceCornerNormal"], (4.4, -0.45), overlap["l1PerpendicularOffset"]),
                ]:
                    axis.annotate(
                        f"{name}: {measured:.3f} m overlap",
                        xy=corner, xytext=label_position, ha="center", va="center", fontsize=8,
                        arrowprops={"arrowstyle": "->", "color": "#786553", "linewidth": 0.8},
                        color="#655345", zorder=8,
                    )
                start = alignment["reference"]["sourceEdge"][1]
                north = alignment["reference"]["towardNorth"]
                end = [start[i] + north[i] * 8.9 for i in range(2)]
                axis.annotate(
                    "", xy=end, xytext=start,
                    arrowprops={"arrowstyle": "->", "color": "#a24438", "linewidth": 1.6, "linestyle": "--"},
                    zorder=7,
                )
                inset = axis.inset_axes([0.355, 0.745, 0.265, 0.19])
                inset.set_xlim(-0.02, 1.02)
                inset.set_ylim(-0.9, 1.15)
                inset.add_patch(Patch([(0, 0), (1, 0), (1, 0.45), (0, 0.45)], facecolor="#bab5a8", edgecolor="#655f54"))
                inset.plot([0.25, 0.25], [-0.1, 0.6], color="#a24438", linewidth=1.8)
                inset.text(0.125, 0.22, "¼", ha="center", va="center", fontsize=14)
                inset.text(0.625, 0.22, "¾", ha="center", va="center", fontsize=14)
                inset.text(0.125, -0.17, "L3 side", ha="center", va="center", fontsize=8)
                inset.text(0.625, -0.17, "R1 side", ha="center", va="center", fontsize=8)
                inset.text(0.5, 0.85, "Gross enclosure across the fixed source edge", ha="center", fontsize=9)
                inset.text(
                    0.5, -0.48,
                    f'{alignment["lSideWidthAtFlightCenter"]:.3f} m + {alignment["rSideWidthAtFlightCenter"]:.3f} m = {alignment["grossWidthAtFlightCenter"]:.3f} m gross',
                    ha="center", fontsize=8,
                )
                schematic = alignment["schematicFlight"]
                inset.text(
                    0.5, -0.8,
                    f'Schematic flight: {schematic["l3ShareAtCenter"]:.2%} L3 / {schematic["r1ShareAtCenter"]:.2%} R1 · {schematic["widthAtCenter"]:.2f} m',
                    ha="center", fontsize=8, color="#665d4d",
                )
                inset.axis("off")
        axis.autoscale_view()
        subtitle = (
            "Red: unchanged source edge extended · blue: windows · dashed rectangles: living-zone witnesses only · R internal area remains short"
            if items is polygons
            else "Frozen preceding top-floor study: 20 rooms, two halls and the marked west stairwell entrance. Lower floors not shown."
        )
        axis.set_title(title + "\n" + subtitle, fontsize=14)
        axis.set_aspect("equal")
        axis.invert_yaxis()
        axis.set_xlabel("Study X / m")
        axis.set_ylabel("Study Y / m")
        axis.grid(alpha=0.15)
    path.parent.mkdir(parents=True, exist_ok=True)
    figure.savefig(path, dpi=110)
    plt.close(figure)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--study", type=Path, default=ROOT / "public/data/interior-studies.json")
    parser.add_argument("--baseline", type=Path, default=ROOT / "data/source/house55-2og-stair-ratio-baseline.json", help="Earlier study for comparison; defaults to the retained window/wall-face stage before the resident-confirmed stair ratio.")
    parser.add_argument("--output", type=Path, default=Path("/tmp/house55-dimension-audit.json"))
    parser.add_argument("--plot", type=Path, help="Optional standalone PNG outside published site data.")
    parser.add_argument("--plan-plot", type=Path, help="Optional single-panel PNG of the current plan.")
    parser.add_argument("--inset", type=float, default=0.1, help="Explicit hypothetical clearance; not a measured wall thickness.")
    arguments = parser.parse_args()
    if arguments.inset < 0:
        parser.error("--inset must be nonnegative")
    protected_inputs = {arguments.study.resolve(), arguments.baseline.resolve()}
    for output in [arguments.output, arguments.plot, arguments.plan_plot]:
        if output is None:
            continue
        resolved = output.resolve()
        if resolved in protected_inputs or any(
            resolved.is_relative_to(ROOT / directory)
            for directory in ["public/data", "data/source"]
        ):
            parser.error("Audit outputs must not replace model data, provenance or an input file")
    audit(arguments)
