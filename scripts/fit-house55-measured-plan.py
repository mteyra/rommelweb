#!/usr/bin/env python3
"""Reproducible measured-circulation candidate for House 55 / 2. OG.

Run with:
  uv run --with scipy --with shapely python scripts/fit-house55-measured-plan.py \
    --output docs/data/house55-measured-plan-candidate.json

This is an underdetermined candidate, not recovered/surveyed room geometry.
Only the exterior/floor mask, room counts and resident circulation widths are
hard evidence. The requested 16.4 m² mean is a category-average fitting target.
No production interior geometry is changed.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy.optimize import minimize
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union


def polygons(geometry):
    if geometry.is_empty:
        return []
    if geometry.geom_type == "Polygon":
        return [{
            "outer": [list(p) for p in geometry.exterior.coords],
            "holes": [[list(p) for p in ring.coords] for ring in geometry.interiors],
        }]
    return [p for g in geometry.geoms for p in polygons(g)]


def outer(geometry):
    return [list(p) for p in geometry.exterior.coords]


def compute(repo):
    paths = [
        "data/source/house55-2og-measured-fit-constraints.json",
        "data/source/house55-2og-stair-measurements.json",
        "data/source/house55-2og-hallway-measurements.json",
        "data/source/house55-2og-study-provenance.json",
        "public/data/interior-studies.json",
        "public/data/lod2.json",
    ]
    payloads = [(repo / p).read_bytes() for p in paths]
    constraints, stair_measurement, hallway_measurement, provenance, study, lod = [
        json.loads(p) for p in payloads
    ]
    hashes = {p: hashlib.sha256(b).hexdigest() for p, b in zip(paths, payloads)}
    axes = provenance["registration"]["localAxesInCampusXZ"]
    origin = provenance["registration"]["localOriginInCampusXZ"]

    def uv(point):
        return [
            sum((point[i] - origin[i]) * axes[k][i] for i in range(2))
            for k in ["x", "y"]
        ]

    level = next(l for l in study["buildings"]["55"]["levels"] if l["index"] == 2)
    building = next(b for b in lod["buildings"] if b["number"] == "55")
    surface = building["surfaces"][39]
    if surface["type"] != "RoofSurface":
        raise ValueError("Reference source surface 39 changed")
    source = [uv([p[0], p[2]]) for p in surface["points"]]
    flat = Polygon(source)
    floor = unary_union([
        Polygon([uv(p) for p in poly["outer"]],
                [[uv(p) for p in h] for h in poly.get("holes", [])])
        for poly in level["floorOutline"]
    ])
    h = float(hallway_measurement["hallways"]["reportedWidthMetres"])
    sw = float(stair_measurement["widths"]["totalWallToWallMetres"])
    fg = float(stair_measurement["widths"]["stairAndCentralGuardMetres"])
    walk = float(stair_measurement["widths"]["levelWalkwayMetres"])
    if abs(fg + walk - sw) > 1e-10:
        raise ValueError("Measured stair zones must sum to total clear width")
    measured = constraints["hardMeasurements"]
    if abs(measured["hallwayClearWidthMetres"] - h) > 1e-10:
        raise ValueError("Canonical hallway records disagree")
    if abs(measured["stairwellInsideWidthMetres"] - sw) > 1e-10:
        raise ValueError("Canonical staircase records disagree")
    area_target = float(constraints["fittingTargets"]["meanApartmentEnvelopeAreaSquareMetres"])
    bank_names = ["A", "W", "L", "R", "N", "E"]
    count = np.array([constraints["topology"]["roomCounts"][b] for b in bank_names])
    if count.tolist() != [4, 4, 3, 3, 3, 3]:
        raise ValueError("This parameterization requires the documented twenty-room topology")
    wall = .20  # Full separation between clear faces, NOT a half-wall offset.
    source_offset = .20
    half_h = h / 2
    front = half_h + wall

    # Conservative rectangular clear bounds: use the inward endpoint extremum
    # of each observed (slightly skewed) source edge, then a 0.20m source offset.
    # This treats source roof boundaries as reference lines, not measured walls.
    def inward(indices, axis, direction):
        values = [source[i][axis] for i in indices]
        return ((max(values) + source_offset) if direction == "increasing"
                else (min(values) - source_offset))

    c = {
        "Aleft": inward([22, 23], 0, "increasing"),
        "Aright": inward([0, 1], 0, "decreasing"),
        "Abottom": inward([23, 0], 1, "decreasing"),
        "Wleft": inward([20, 21], 0, "increasing"),
        "Wtop": inward([19, 20], 1, "increasing"),
        "Ltop": inward([17, 18], 1, "increasing"),
        "Rbottom": inward([6, 7], 1, "decreasing"),
        "Nleft": inward([13, 14], 0, "increasing"),
        "Nright": inward([11, 12], 0, "decreasing"),
        "Ntop": inward([12, 13], 1, "increasing"),
        "Eright": inward([9, 10], 0, "decreasing"),
        "Ebottom": inward([8, 9], 1, "decreasing"),
        "Lhall": inward([2, 3], 1, "decreasing") - half_h,
        "Rhall": inward([15, 16], 1, "increasing") + half_h,
    }

    def banks(p):
        ha, hw, he, hn, sx = p
        return [
            ("A", 4, box(c["Aleft"], ha + front, c["Aright"], c["Abottom"]), 0),
            ("W", 4, box(c["Wleft"], c["Wtop"], hw - front, ha - front), 1),
            ("L", 3, box(hw + front, c["Ltop"], sx - wall, c["Lhall"] - front), 0),
            ("R", 3, box(sx + sw + wall, c["Rhall"] + front, he - front, c["Rbottom"]), 0),
            ("N", 3, box(c["Nleft"], c["Ntop"], c["Nright"], hn - front), 0),
            ("E", 3, box(he + front, hn + front, c["Eright"], c["Ebottom"]), 1),
        ]

    def dimensions(p):
        widths, depths = [], []
        for _, n, shape, axis in banks(p):
            b = shape.bounds
            widths.append((b[axis + 2] - b[axis] - wall * (n - 1)) / n)
            depths.append(b[3 - axis] - b[1 - axis])
        return np.array(widths), np.array(depths)

    def objective(p):
        width, depth = dimensions(p)
        # Numerical regularization expresses similarity only; these are not
        # claimed measured room dimensions. Area variance has strongest weight.
        return float(np.sum(count * (width * depth - area_target) ** 2)
                     + 2 * np.sum(count * (width - 2.8) ** 2)
                     + np.sum(count * (depth - 5.86) ** 2))

    def positive_dimensions(p):
        w, d = dimensions(p)
        return np.r_[w - 2.3, 3.5 - w, d - 4.8, 7 - d]

    result = minimize(
        objective, [10.536, .95, 23.57, .093, 10.69], method="SLSQP",
        bounds=[(9.8, 11.2), (0, 1.8), (22.8, 25), (-.5, 1.3), (9.8, 11.8)],
        constraints=[
            {"type": "eq", "fun": lambda p: float(
                np.sum(count * np.prod(dimensions(p), axis=0)) - sum(count) * area_target)},
            {"type": "ineq", "fun": positive_dimensions},
        ],
        options={"maxiter": 2000, "ftol": 1e-11},
    )
    if not result.success:
        raise ValueError("Candidate optimization failed: " + result.message)
    ha, hw, he, hn, sx = [float(v) for v in result.x]
    rooms, room_shapes = [], []
    summaries = []
    for name, n, shape, axis in banks(result.x):
        b = list(shape.bounds)
        width = (b[axis + 2] - b[axis] - wall * (n - 1)) / n
        depth = b[3 - axis] - b[1 - axis]
        summaries.append({
            "bank": name, "count": n, "clearWidth": width,
            "clearDepth": depth, "clearEnvelopeAreaPerRoom": width * depth,
            "widthAxis": "U" if axis == 0 else "V",
        })
        for i in range(n):
            cell = b[:]
            cell[axis] = b[axis] + i * (width + wall)
            cell[axis + 2] = cell[axis] + width
            room_shape = box(*cell)
            label = (chr(ord("A") + i) if name == "A" else
                     chr(ord("E") + i) if name == "E" else name + str(i + 1))
            rooms.append({
                "label": label, "bank": name, "polygon": outer(room_shape),
                "width": width, "depth": depth, "area": room_shape.area,
                "widthAxis": "U" if axis == 0 else "V",
                "kind": "candidate-clear-apartment-envelope",
                "containsBathroomKitchenEntryUnknown": True,
                "partitionThicknessAssumption": wall,
            })
            room_shapes.append(room_shape)

    corridor_shapes = [
        box(c["Aleft"], ha-half_h, hw+half_h, ha+half_h),
        box(hw-half_h, c["Wtop"], hw+half_h, ha+half_h),
        box(hw-half_h, c["Lhall"]-half_h, sx, c["Lhall"]+half_h),
        box(sx+sw, c["Rhall"]-half_h, he+half_h, c["Rhall"]+half_h),
        box(he-half_h, hn-half_h, he+half_h, c["Ebottom"]),
        box(c["Nleft"], hn-half_h, c["Nright"], hn+half_h),
    ]
    corridor_names = ["A–D", "W", "L", "R", "E", "N"]
    corridor_axes = [1, 0, 1, 1, 0, 1]
    corridors = [{
        "label": name, "polygon": outer(shape), "width": h,
        "measuredClearWidth": h, "widthAxis": "U" if axis == 0 else "V",
        "normalWidthComputedFromPolygon": shape.bounds[axis+2] - shape.bounds[axis],
        "junctions": "Overlapping clear corridor strips form open turns; 1.30m refers to each straight branch.",
        "unassignedEndPocketSeparation": "A candidate 0.20m partition closes the strip where there is no opposing room.",
    } for name, shape, axis in zip(corridor_names, corridor_shapes, corridor_axes)]
    sy0, sy1 = c["Rhall"] - half_h, c["Lhall"] + half_h
    stair_shape = box(sx, sy0, sx+sw, sy1)
    north_landing = box(sx, sy0, sx+sw, sy0+h)
    south_landing = box(sx, sy1-h, sx+sw, sy1)
    walkway_shape = box(sx+fg, sy0, sx+sw, sy1)
    flight_run = box(sx, sy0+h, sx+fg, sy1-h)
    same_floor_stair_route = unary_union([north_landing, south_landing, walkway_shape])
    corridor_union = unary_union(corridor_shapes)
    circulation_union = unary_union([corridor_union, same_floor_stair_route])
    clear_union = unary_union(room_shapes + corridor_shapes + [stair_shape])
    # Every isolated clear face receives a positive outward wall allowance.
    # Taking the union removes walls across connected open corridor junctions.
    walls = clear_union.buffer(wall, join_style=2).difference(clear_union).intersection(floor)
    unassigned = floor.difference(clear_union.union(walls))
    door_segments = [
        {"label": "L hall → south landing", "points": [[sx, sy1-h+.20], [sx, sy1-.20]]},
        {"label": "R hall → north landing", "points": [[sx+sw, sy0+.20], [sx+sw, sy0+h-.20]]},
    ]
    for door in door_segments:
        door["indicativeDoorSpan"] = LineString(door["points"]).length
        door["openingJambsModelled"] = False
        door["geometricHallMouthWidth"] = h
        door["measuredPosition"] = False

    overlaps = []
    for i, room in enumerate(room_shapes):
        for j in range(i+1, len(room_shapes)):
            if room.intersection(room_shapes[j]).area > 1e-8:
                overlaps.append([rooms[i]["label"], rooms[j]["label"],
                                 room.intersection(room_shapes[j]).area])
    room_corridor_overlap = sum(r.intersection(corridor_union).area for r in room_shapes)
    room_stair_overlap = sum(r.intersection(stair_shape).area for r in room_shapes)
    outside_floor = clear_union.difference(floor).area
    outside_flat = clear_union.difference(flat).area
    separation = min(r.distance(cor) for r in room_shapes for cor in corridor_shapes)
    room_room_gap = min(a.distance(b) for i, a in enumerate(room_shapes)
                        for b in room_shapes[i+1:])
    room_stair_gap = min(r.distance(stair_shape) for r in room_shapes)
    if (overlaps or room_corridor_overlap > 1e-8 or room_stair_overlap > 1e-8
            or outside_floor > 1e-8 or outside_flat > 1e-8
            or separation < wall-1e-8 or room_room_gap < wall-1e-8
            or room_stair_gap < wall-1e-8
            or circulation_union.geom_type != "Polygon"):
        raise ValueError("Candidate failed independent polygon feasibility checks")
    areas = np.array([r["area"] for r in rooms])
    widths = np.array([r["width"] for r in rooms])
    depths = np.array([r["depth"] for r in rooms])
    nominal_width = float(np.mean(widths))
    nominal_depth = area_target / nominal_width
    return {
        "schemaVersion": 1, "house": "55", "levelIndex": 2,
        "status": "jointly-fitted-candidate-not-a-survey",
        "coordinateSystem": {"units": "metres", "axes": "study U,V", "localAxesInCampusXZ": axes,
                             "localOriginInCampusXZ": origin},
        "sourceHashes": hashes,
        "floorOutline": polygons(floor), "referenceFlatRoofOutline": polygons(flat),
        "rooms": rooms, "bankDimensions": summaries, "corridors": corridors,
        "corridorUnion": polygons(corridor_union),
        "stair": {
            "polygon": outer(stair_shape), "width": sw, "candidateLength": sy1-sy0,
            "lengthMeasured": False,
            "flightGuardZone": {"width": fg, "polygon": outer(box(sx, sy0, sx+fg, sy1)),
                                "isClearFlightWidth": False},
            "walkway": {"width": walk, "polygon": outer(walkway_shape)},
            "candidateFlightGuardRun": {"polygon": outer(flight_run), "length": sy1-sy0-2*h},
            "landings": [{"label": "north", "polygon": outer(north_landing), "candidateLength": h},
                         {"label": "south", "polygon": outer(south_landing), "candidateLength": h}],
            "sameFloorClearRoute": polygons(same_floor_stair_route),
            "hallConnections": door_segments,
            "routeQualification": "Two offset candidate hall entrances join one connected same-floor landing/walkway route. The0.90m lines are indicative door locations within geometrically open1.30m hall mouths; jambs and door leaves are unmodeled. Landing lengths, stair treads and risers are unmeasured.",
        },
        "walls": polygons(walls), "unassigned": polygons(unassigned),
        "metrics": {
            "roomCount": len(rooms), "roomAreaTotal": float(areas.sum()),
            "roomAreaMean": float(areas.mean()), "roomAreaMin": float(areas.min()),
            "roomAreaMax": float(areas.max()), "roomAreaPopulationStd": float(areas.std()),
            "meanClearWidth": nominal_width, "meanClearDepth": float(depths.mean()),
            "clearWidthRange": [float(widths.min()), float(widths.max())],
            "clearDepthRange": [float(depths.min()), float(depths.max())],
            "nominalAreaEquivalentModule": {"width": nominal_width, "depth": nominal_depth,
                                           "area": area_target,
                                           "roundedDisplay": "~3.0 × 5.5 m",
                                           "definition": "Mean of twenty clear bay widths, with depth=16.4/meanWidth. Individual banks differ."},
            "floorPlateArea": floor.area, "flatRoofProjectionArea": flat.area,
            "corridorUnionArea": corridor_union.area, "stairEnvelopeArea": stair_shape.area,
            "wallAllowanceArea": walls.area, "unassignedArea": unassigned.area,
            "unassignedWithinFlatRoofArea": unassigned.intersection(flat).area,
            "unassignedOutsideFlatRoofArea": unassigned.difference(flat).area,
        },
        "residuals": {
            "meanAreaTarget": float(areas.mean()-area_target),
            "roomPairOverlapArea": sum(o[2] for o in overlaps),
            "roomCorridorOverlapArea": room_corridor_overlap,
            "roomStairOverlapArea": room_stair_overlap,
            "outsideRetainedFloorPlateArea": outside_floor,
            "outsideReferenceFlatRoofArea": outside_flat,
            "minimumRoomToRoomClearFaceGap": room_room_gap,
            "minimumRoomToCorridorClearFaceGap": separation,
            "minimumRoomToStairClearFaceGap": room_stair_gap,
            "straightCorridorWidthMaxError": max(abs(cor["normalWidthComputedFromPolygon"]-h)
                                                for cor in corridors),
            "stairZoneSumError": fg+walk-sw,
            "circulationConnectedIncludingBothLandings": circulation_union.geom_type == "Polygon",
            "partitionAndAreaClosureError": floor.area-clear_union.area-walls.area-unassigned.area,
        },
        "solver": {
            "method": "SciPy SLSQP, five corridor/stair position variables",
            "success": bool(result.success), "message": str(result.message),
            "iterations": int(result.nit), "objective": float(result.fun),
            "parameters": dict(zip(["A_hall_V", "W_hall_U", "E_hall_U", "N_hall_V",
                                    "stair_left_U"], [float(v) for v in result.x])),
            "sourceDerivedFixedClearBounds": c,
            "objectiveDefinition": "Sum over20 rooms of (area−16.4)² +2(width−2.8)² +(depth−5.86)². Area mean16.4 is imposed exactly; regularizers express similarity, not measured dimensions.",
            "optimalityQualification": "One feasible local optimum in a stated six-bank rectilinear family, not proof of a unique or globally correct floor plan.",
        },
        "assumptions": [
            "All dimensions describe the inside apartment envelope, including unresolved bathroom, kitchenette and entry areas; these are not pure living-room areas.",
            "The sixteen-point-four square metre mean is an operator category benchmark applied at the resident's request, not a survey of these twenty apartments.",
            "All six hallway branches use the resident's measured1.30m clear width; open turns overlap the straight strips.",
            "The measured stair width2.72m is kept inside faces;1.43m includes the stair and central guard/gap, while1.29m is the level walkway.",
            "All room partitions and clear-room-to-hall/stair separations assume0.20m full thickness. Source boundaries use a separate0.20m effective inward reference allowance; this is not a measured exterior wall thickness.",
            "Candidate partitions enclose the corridor ends beside unassigned source-edge pockets. Their locations are not measured and must be verified.",
            "The retained exterior floor plate and recorded no-floor regions are unchanged. The clear candidate also fits inside the reference flat-roof projection.",
            "The6.48m stair length,1.30m landing lengths, long walkway and offset hall entrances are candidate arrangements. Stairs need further elevation, riser/tread and landing evidence.",
            "Wall allowance polygons are geometric partition bands, not a construction takeoff. Apartment door openings, stair-hall jambs/door leaves and wall materials remain unmodeled; stair-hall door segments are indicative locations within fully open1.30m hall mouths.",
            "Remaining plate regions are explicitly unassigned, including roof margins; they are not silently classified as rooms or additional corridor width.",
            "No previous20/80 or25/75 stair/reference-line ratio, former L/W overlap, R endpoint alignment or generated window-center coordinates are used as hard constraints.",
            "Twenty room identities and broad six-bank adjacency are retained. Exact surveyed window/door positions and internal bathroom/service partitions still require verification.",
        ],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    data = compute(args.repo.resolve())
    encoded = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded)
        print(json.dumps({"output": str(args.output), "metrics": data["metrics"],
                          "residuals": data["residuals"]}, indent=2))
    else:
        print(encoded, end="")


if __name__ == "__main__":
    main()
