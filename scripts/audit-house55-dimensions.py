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
        groups.append({
            "name": name, "count": len(labels), "runAxis": axis,
            "nominalRun": source["runMetres"],
            "nominalAverageGrossBay": source["averageGrossBayMetres"],
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
    similar_rooms = [{
        "label": label,
        "grossWidth": polygons[label].bounds[axis + 2] - polygons[label].bounds[axis],
        "grossDepth": polygons[label].bounds[3 - axis] - polygons[label].bounds[1 - axis],
        "grossArea": polygons[label].area,
    } for labels, axis, _ in GROUPS.values() for label in labels if not label.startswith("R")]
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
        later_corrected_groups = {"L1–L3"} if metadata.get("residentCorrections", {}).get("leftSide") else set()
        checked_errors = [error for name, error in mean_errors.items() if name not in later_corrected_groups]
        valid = max(abs(recorded_depth - computed_depth), *map(abs, checked_errors)) <= serialization_tolerance
        depth_verification = {
            "valid": valid,
            "inputMeaning": "Retained width-only modeling priors, not measured apartment depths.",
            "inputDepths": inputs,
            "computedArithmeticMean": computed_depth,
            "recordedTarget": recorded_depth,
            "targetDifference": recorded_depth - computed_depth,
            "actualGroupMeanMinusComputedTarget": mean_errors,
            "laterCorrectedGroups": sorted(later_corrected_groups),
            "laterCorrectionMeaning": "The later L alignment follows source corners and retains its fitted south boundary. Its small source-skew depth change is reported explicitly rather than hidden by widening the historical fit tolerance.",
            "serializationComparisonTolerance": serialization_tolerance,
            "method": "The arithmetic mean minimizes sum_i (D - priorDepth_i)^2. Unchanged group mean depths are independently checked against D; any later source-alignment correction is identified separately.",
            "corridorFacingWallChanges": depth_fit["corridorFacingWallChanges"],
        }
        if not valid:
            raise ValueError(f"Common-depth fit does not reproduce its retained inputs: {depth_verification}")
    report = {
        "status": "Read-only metric feasibility audit; no as-built, occupancy or approval claim.",
        "units": "metres; areas in square metres",
        "residentWorkingHypothesis": {
            "statement": "All top-floor apartments are single rooms, generally similar in size, with dimensional differences described as about a hand length.",
            "meaning": "A repeated single-apartment type with small dimensional variation is a qualitative prior. A hand length is not converted into a measured dimensional tolerance.",
            "latestCorrection": "L starts at the source exterior elbow. The green door enters the stairwell from the west hallway. A narrower stairwell near half one L bay is a provisional interpretation; the eastern connection remains unconfirmed.",
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
            "scope": "Seventeen non-R candidate envelopes; R remains an unresolved width constraint.",
            "meaning": "Projected gross polygon extents, not clear interior dimensions or a measured whole-apartment template.",
            "rooms": similar_rooms,
            "grossWidthRange": [min(row["grossWidth"] for row in similar_rooms), max(row["grossWidth"] for row in similar_rooms)],
            "grossDepthRange": [min(row["grossDepth"] for row in similar_rooms), max(row["grossDepth"] for row in similar_rooms)],
            "grossAreaRange": [min(row["grossArea"] for row in similar_rooms), max(row["grossArea"] for row in similar_rooms)],
            "commonDepthVerification": depth_verification,
        },
        "groups": groups, "rooms": rows,
        "topology": {
            "overlapArea": sum(first.intersection(second).area for i, first in enumerate(pairs) for second in pairs[i + 1:]),
            "outsideAnnotatedArea": outside.area,
            "maximumOutsideDistance": max([annotated.boundary.distance(Point(point)) for point in boundary_points(outside)], default=0),
            "roomArea": sum(polygons[label].area for label in EXPECTED_LABELS),
            "baselineRoomArea": sum(baseline[label].area for label in EXPECTED_LABELS) if baseline else None,
            "stairArea": polygons["Stairs"].area,
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
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    if args.plot:
        draw_plot(
            args.plot, flat, occupied,
            {label: polygon for label, polygon in baseline.items() if label not in baseline_corridors} if baseline else None,
            witnesses, corridors, flight, [record for record in door_records if record["target"] == stair_record["shortLabel"]] if stair_record else [],
        )
    print(json.dumps({
        "report": str(args.output),
        "packingWitnesses": report["packing"]["count"],
        "unresolved": report["packing"]["unresolved"],
        "roomArea": report["topology"]["roomArea"],
        "remainderArea": report["topology"]["remainderArea"],
        "grossGaps": report["topology"]["diagnosticGrossGaps"],
    }, indent=2))


def draw_plot(path, flat, polygons, baseline, witnesses, corridors, flight, stair_doors):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon as Patch

    panels = [(baseline, "Before the left-side and stairwell correction")] if baseline else []
    panels.append((polygons, "Source-aligned L rooms · west stairwell entry · east access unconfirmed"))
    figure, axes = plt.subplots(len(panels), 1, figsize=(16, 8.5 * len(panels)), squeeze=False, layout="constrained")
    for axis, (items, title) in zip(axes[:, 0], panels):
        axis.add_patch(Patch(list(flat.exterior.coords), facecolor="#eeeae3", edgecolor="#41413c", linewidth=2))
        for label, polygon in items.items():
            for part in components(polygon):
                axis.add_patch(Patch(
                    list(part.exterior.coords),
                    facecolor="#bab5a8" if label == "Stairs" else "#c9ccc3",
                    edgecolor="#555a50", linewidth=0.8,
                    hatch="///" if items is polygons and label.startswith("R") else None,
                ))
            point = polygon.representative_point()
            if not (items is polygons and label == "Stairs" and flight is not None):
                axis.text(point.x, point.y, label, ha="center", va="center", fontsize=11)
            witness = witnesses.get(label)
            if items is polygons and witness is not None:
                axis.add_patch(Patch(list(witness.exterior.coords), fill=False, edgecolor="#576d7a", linewidth=1.2, linestyle="--"))
        if items is polygons:
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
        axis.autoscale_view()
        subtitle = (
            "Dashed rectangles: packing witnesses only. Stair flight and landings remain schematic; no east connection is inferred."
            if items is polygons
            else "Retained dimensional candidate; twenty room references. Stairwell and L alignment awaiting this correction."
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
    parser.add_argument("--baseline", type=Path, default=ROOT / "data/source/house55-2og-dimension-baseline.json", help="Earlier study for comparison; defaults to the retained dimensional candidate before the left-side correction.")
    parser.add_argument("--output", type=Path, default=Path("/tmp/house55-dimension-audit.json"))
    parser.add_argument("--plot", type=Path, help="Optional standalone PNG outside published site data.")
    parser.add_argument("--inset", type=float, default=0.1, help="Explicit hypothetical clearance; not a measured wall thickness.")
    arguments = parser.parse_args()
    if arguments.inset < 0:
        parser.error("--inset must be nonnegative")
    protected_inputs = {arguments.study.resolve(), arguments.baseline.resolve()}
    for output in [arguments.output, arguments.plot]:
        if output is None:
            continue
        resolved = output.resolve()
        if resolved in protected_inputs or any(
            resolved.is_relative_to(ROOT / directory)
            for directory in ["public/data", "data/source"]
        ):
            parser.error("Audit outputs must not replace model data, provenance or an input file")
    audit(arguments)
