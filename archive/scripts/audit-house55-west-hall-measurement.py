#!/usr/bin/env python3
"""Conditional House 55 west-hall analysis, not a production plan refit."""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import math

def compute(repo):
    REPO = repo
    spec = importlib.util.spec_from_file_location(
        "geom", REPO / "scripts/audit-house55-recovery.py")
    geom = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(geom)
    paths = ["data/source/house55-2og-study-provenance.json",
             "public/data/interior-studies.json", "public/data/lod2.json",
             "data/source/house55-2og-hallway-measurements.json",
             "data/source/house55-2og-stair-measurements.json"]
    meta, study, lod, measurement, stair_measurement = [
        json.loads((REPO / p).read_text()) for p in paths]
    if meta["currentStage"] != "rAlignment":
        raise ValueError("This diagnostic requires rAlignment; review before adapting")
    level = next(l for l in study["buildings"]["55"]["levels"] if l["index"] == 2)
    building = next(b for b in lod["buildings"] if b["number"] == "55")
    axes = meta["registration"]["localAxesInCampusXZ"]
    origin = meta["registration"]["localOriginInCampusXZ"]
    local = lambda p: [sum((p[i] - origin[i]) * axes[k][i] for i in range(2))
                       for k in ["x", "y"]]
    source = [local([p[0], p[2]]) for p in building["surfaces"][39]["points"]]
    spaces = {s["shortLabel"]: list(map(local, s["polygon"])) for s in level["spaces"]}
    records = {r["label"]: r for r in meta["areaStudy"]["rooms"]}
    measured_clear_width = float(measurement["hallways"]["reportedWidthMetres"])
    if not math.isfinite(measured_clear_width) or measured_clear_width <= 0:
        raise ValueError("Reported hallway width must be a positive finite length")
    room_hall_half_wall = 0.10
    source_boundary_allowance = 0.20


    def source_plane(pair, toward):
        p, q = [source[i] for i in pair]
        tangent = geom.sub(q, p)
        normal = [-tangent[1], tangent[0]]
        normal = [n / math.hypot(*normal) for n in normal]
        if geom.dot(normal, toward) < 0:
            normal = [-n for n in normal]
        return {"normal": normal, "constant": geom.dot(normal, p)}


    def opposite_room_plane(label):
        edge = next(e for e in records[label]["edgeOffsets"] if e["kind"] == "bank-end")
        return {"normal": [-n for n in edge["normal"]],
                "constant": -edge["constant"]}


    def internal_polygon(record, hall=None, zero_allowance=False):
        result = [[-100, -100], [100, -100], [100, 100], [-100, 100]]
        for original in record["edgeOffsets"]:
            edge = hall if hall is not None and original["kind"] == "hall-allocation" else original
            offset = 0 if zero_allowance else edge["allowance"]
            result = geom.half_plane_clip(result, edge["normal"], edge["constant"] + offset)
        return result


    def point_on_plane(plane, fixed_axis, fixed_value):
        point = [0.0, 0.0]
        point[fixed_axis] = fixed_value
        free = 1 - fixed_axis
        point[free] = (
            plane["constant"] - plane["normal"][fixed_axis] * fixed_value
        ) / plane["normal"][free]
        return point


    run_specs = [
        {
            "name": "W hall beside L1 end wall",
            "bank": "W", "referenceRoom": "W3", "oppositeRoom": "L1",
            "opposingPlane": opposite_room_plane("L1"), "opposingAllowance": .10,
            "fixedAxis": 1,
            "range": [min(p[1] for p in spaces["L1"]), max(p[1] for p in spaces["L1"])],
            "fullyOpposedRooms": ["W3"],
            "partlyOpposedRooms": ["W2", "W4"],
            "classification": "Regular corridor between room banks.",
        },
        {
            "name": "W outer end beside source recess 18-19",
            "bank": "W", "referenceRoom": "W1", "sourceVertices": [18, 19],
            "opposingPlane": source_plane([18, 19], [-1, 0]),
            "opposingAllowance": source_boundary_allowance, "fixedAxis": 1,
            "range": [source[19][1], source[18][1]],
            "fullyOpposedRooms": ["W1"], "partlyOpposedRooms": ["W2"],
            "classification": "Widened end segment/pocket in the current model; whether resident's uniform-width statement includes this full endpoint geometry needs registration.",
        },
        {
            "name": "A-D hall opposite W4 end wall",
            "bank": "A", "referenceRoom": "C", "oppositeRoom": "W4",
            "opposingPlane": opposite_room_plane("W4"), "opposingAllowance": .10,
            "fixedAxis": 0,
            "range": [min(p[0] for p in spaces["W4"]), max(p[0] for p in spaces["W4"])],
            "fullyOpposedRooms": ["C"], "partlyOpposedRooms": ["B", "D"],
            "classification": "Regular corridor between room banks; the W-bank turn is a junction rather than another corridor-width sample.",
        },
        {
            "name": "A-D outer end beside source recess 21-22",
            "bank": "A", "referenceRoom": "A", "sourceVertices": [21, 22],
            "opposingPlane": source_plane([21, 22], [0, 1]),
            "opposingAllowance": source_boundary_allowance, "fixedAxis": 0,
            "range": [source[22][0], source[21][0]],
            "fullyOpposedRooms": ["A"], "partlyOpposedRooms": ["B"],
            "classification": "Widened end segment/pocket in the current model; the same registration qualification applies.",
        },
        {
            "name": "L hall beside source edge 2-3",
            "bank": "L", "referenceRoom": "L2", "sourceVertices": [2, 3],
            "opposingPlane": source_plane([2, 3], [0, -1]),
            "opposingAllowance": source_boundary_allowance, "fixedAxis": 0,
            "range": [source[2][0], max(p[0] for p in spaces["L3"])],
            "fullyOpposedRooms": ["L2", "L3"], "partlyOpposedRooms": ["L1"],
            "classification": "Regular corridor beside a source boundary. Resident photos identify overlook glazing; .20m remains a hypothetical boundary offset, not measured glazing thickness.",
        },
    ]

    runs = []
    for run in run_specs:
        plane = run["opposingPlane"]
        old_front = next(e for e in records[run["referenceRoom"]]["edgeOffsets"]
                         if e["kind"] == "hall-allocation")
        gross_target = measured_clear_width + room_hall_half_wall + run["opposingAllowance"]
        new_front = {
            "kind": "hall-allocation", "normal": plane["normal"],
            "constant": plane["constant"] + gross_target,
            "allowance": room_hall_half_wall,
        }
        samples = []
        for coordinate in run["range"]:
            opposing_point = point_on_plane(plane, run["fixedAxis"], coordinate)
            gross = (
                old_front["constant"] - geom.dot(old_front["normal"], opposing_point)
            ) / geom.dot(old_front["normal"], plane["normal"])
            new_point = [opposing_point[i] + gross_target * plane["normal"][i]
                         for i in range(2)]
            old_point = [opposing_point[i] + gross * plane["normal"][i] for i in range(2)]
            samples.append({
                "fixedStudyCoordinate": coordinate,
                "opposingGrossPoint": opposing_point,
                "currentHallFrontPoint": old_point,
                "conditionalHallFrontPoint": new_point,
                "currentGrossNormalGap": gross,
                "currentConditionalClearWidth": gross - room_hall_half_wall - run["opposingAllowance"],
                "conditionalClearWidth": gross_target - room_hall_half_wall - run["opposingAllowance"],
                "roomDepthIncreaseAtSection": gross - gross_target,
            })
        examples = []
        for label in run["fullyOpposedRooms"]:
            record = records[label]
            old_inner = internal_polygon(record)
            new_inner = internal_polygon(record, new_front)
            new_gross = internal_polygon(record, new_front, zero_allowance=True)
            if abs(geom.area(old_inner) - record["internalArea"]) > 1e-6:
                raise ValueError(f"Old room reconstruction mismatch: {label}")
            extents = geom.extents(new_inner)
            depth_axis = 0 if record["bank"] == "W" else 1
            examples.append({
                "room": label, "oldConditionalInternalArea": geom.area(old_inner),
                "conditionalInternalArea": geom.area(new_inner),
                "areaIncrease": geom.area(new_inner) - geom.area(old_inner),
                "conditionalInternalStudyAxisWidth": extents[1 - depth_axis],
                "conditionalInternalStudyAxisDepth": extents[depth_axis],
                "oldInternalStudyAxisDepth": geom.extents(old_inner)[depth_axis],
                "conditionalInternalPolygon": new_inner,
                "conditionalGrossPolygon": new_gross,
            })
        runs.append({
            **run, "currentHallPlane": old_front, "conditionalHallPlane": new_front,
            "targetGrossNormalGap": gross_target, "samples": samples,
            "fullyOpposedRoomExamples": examples,
        })

    alternatives = []
    for regular_index, source_index, label in [(0, 1, "W1"), (2, 3, "A")]:
        regular, source_run = runs[regular_index], runs[source_index]
        source_plane_record = source_run["opposingPlane"]
        straight_front = regular["conditionalHallPlane"]
        axis = regular["fixedAxis"]
        room = records[label]
        old_hall = next(e for e in room["edgeOffsets"] if e["kind"] == "hall-allocation")
        front_points = [p for p in spaces[label]
                        if abs(geom.dot(old_hall["normal"], p) - old_hall["constant"]) < 1e-5]
        if len(front_points) < 2:
            raise ValueError("Cannot identify the example room's saved hall frontage")
        representative = sum(p[axis] for p in front_points) / len(front_points)
        samples = []
        for coordinate in [*source_run["range"], representative]:
            front_point = point_on_plane(straight_front, axis, coordinate)
            # The required opposite finished face is one clear corridor width plus
            # the room-side half-wall away from the gross front. The signed distance
            # of that face from the retained roof/source plane is an EFFECTIVE
            # source-to-clear-face offset. It is not physical wall thickness.
            required_clear_face = [
                front_point[i] - straight_front["normal"][i] *
                (measured_clear_width + room_hall_half_wall) for i in range(2)
            ]
            required_offset = geom.dot(source_plane_record["normal"], required_clear_face) \
                - source_plane_record["constant"]
            assumed_front = point_on_plane(source_run["conditionalHallPlane"], axis, coordinate)
            samples.append({
                "fixedStudyCoordinate": coordinate,
                "isRepresentativeRoomFrontage": coordinate == representative,
                "requiredOppositeFinishedFacePoint": required_clear_face,
                "effectiveSourceToClearHallFaceOffset": required_offset,
                "increaseOverEarlierSourceBoundaryAllowance": required_offset - source_boundary_allowance,
                "frontStepIfEarlierOffsetsRetained": abs(
                    assumed_front[1 - axis] - front_point[1 - axis]),
            })
        old_inner = internal_polygon(room)
        new_inner = internal_polygon(room, straight_front)
        extents = geom.extents(new_inner)
        depth_axis = 0 if room["bank"] == "W" else 1
        alternatives.append({
            "bank": regular["bank"],
            "exampleRoom": label,
            "anchor": regular["name"],
            "sourceEnd": source_run["name"],
            "continuedStraightHallPlane": straight_front,
            "samples": samples,
            "conditionalExample": {
                "oldInternalArea": geom.area(old_inner),
                "conditionalInternalArea": geom.area(new_inner),
                "conditionalInternalStudyAxisWidth": extents[1 - depth_axis],
                "conditionalInternalStudyAxisDepth": extents[depth_axis],
            },
            "meaning": (
                "Keeping the opposite room-end finished face as the straight-corridor anchor "
                "allows a straight room front only if the source-to-clear-hall-face offset is "
                "reinterpreted here. This may include unresolved roof overhang/registration "
                "versus wall faces. The computed offset is not measured physical wall thickness."
            ),
        })

    reference_indexes = meta["rAlignment"]["staircase"]["referenceSourceVertexIndexes"]
    ref_a, ref_b = [source[i] for i in reference_indexes]
    tangent = geom.sub(ref_b, ref_a)
    tangent = [value / math.hypot(*tangent) for value in tangent]
    stair_normal = [tangent[1], -tangent[0]]
    old_l3_distance = -min(
        geom.dot(geom.sub(p, ref_a), stair_normal) for p in spaces["Stairs"])
    measured_stair_width = float(stair_measurement["widths"]["totalWallToWallMetres"])
    if not math.isfinite(measured_stair_width) or measured_stair_width <= 0:
        raise ValueError("Stair width must be a positive finite length")
    reference_share = .25
    current_w_run = runs[0]
    w_front_fixed_l = current_w_run["conditionalHallPlane"]
    # Rigid westward L translation is along the stair reference normal. Its
    # component normal to the L1/W corridor is used in the exact plane offset.
    l1_to_right_normal = [-n for n in w_front_fixed_l["normal"]]
    translation_projection = geom.dot(l1_to_right_normal, stair_normal)
    coupled_cases = []
    for total_boundary_to_clear_offset in [0.0, 0.2]:
        gross_width = measured_stair_width + total_boundary_to_clear_offset
        delta = reference_share * gross_width - old_l3_distance
        projected_delta = delta * translation_projection
        coupled_front = {
            **w_front_fixed_l,
            "constant": w_front_fixed_l["constant"] + projected_delta,
        }
        w3_old = internal_polygon(records["W3"])
        w3_new = internal_polygon(records["W3"], coupled_front)
        coupled_cases.append({
            "tauCombinedBoundaryToStairClearFaceOffsets": total_boundary_to_clear_offset,
            "tauIsMeasured": False,
            "conditionalGrossStairWidth": gross_width,
            "deltaRigidWestwardLTranslation": delta,
            "translationVectorStudyUV": [-delta * n for n in stair_normal],
            "translationComponentAlongCorridorNormal": projected_delta,
            "epsilonWFrontGrowthRange": [
                s["roomDepthIncreaseAtSection"] - projected_delta
                for s in current_w_run["samples"]
            ],
            "conditionalWFrontPlane": coupled_front,
            "conditionalW3Example": {
                "oldInternalArea": geom.area(w3_old),
                "conditionalInternalArea": geom.area(w3_new),
                "areaIncrease": geom.area(w3_new) - geom.area(w3_old),
                "conditionalInternalStudyAxisDepth": geom.extents(w3_new)[0],
            },
        })

    result = {
        "schemaVersion": 1,
        "purpose": "Historical fixed-boundary western hallway diagnostic, superseded by the joint measured-plan candidate.",
        "units": {"length": "metres", "area": "square metres"},
        "sourceStage": meta["currentStage"],
        "measurement": {
            "clearWidth": measured_clear_width,
            "sourceRecord": paths[3],
            "userStatement": measurement["sourceEvidence"]["text"],
            "scope": "This diagnostic evaluates western L, W and A-D branches. The current resident record also confirms 1.30 m in the eastern wing.",
            "faceConvention": "Treat 130cm as clear finished-face width, explicitly an interpretation of the conventional meaning pending wall-face confirmation.",
        },
        "inputHashes": {p: hashlib.sha256((REPO / p).read_bytes()).hexdigest() for p in paths},
        "assumptions": [
            "Opposing gross source or room end faces remain fixed independently for each diagnostic run.",
            "0.10m corridor-side allocation for an internal room boundary, and 0.20m for a source boundary. These offsets are assumptions, not new measurements.",
            "New room fronts are parallel to their opposing boundary, leaving 1.30m after those hypothetical allowances.",
            "Examples are limited to rooms whose complete front opposes the sampled run. Junctions and partially opposed rooms are not assigned fabricated front continuations.",
            "For corner pockets, imposing 1.30m throughout is a conditional interpretation, not proof that every landing, turn, recess or pocket is also 1.30m across.",
            "Stepped fronts are required only if all current opposing planes AND their .20/.10m offsets are fixed. A different effective source-to-finished-face offset can instead support a straight front; neither solution is established as physical construction.",
            "Source roof boundary 2-3 may correspond to overlook glazing. Its assumed 0.20m allowance requires verification against actual finished faces.",
            "Stair measurements are independent constraints and are not yet simultaneously applied. No final fitted apartment areas are claimed.",
        ],
        "runs": runs,
        "straightFrontAlternative": alternatives,
        "coupledOneDimensionalFamily": {
            "purpose": "Retired historical ratio-based alternative. It illustrates coupling but is not a constraint on the joint measured-plan candidate.",
            "ratioHypothesisRetired": True,
            "stairMeasurementSourceRecord": paths[4],
            "measuredStairClearWidth": measured_stair_width,
            "historicalL3ReferenceShare": reference_share,
            "oldL3SideReferenceDistance": old_l3_distance,
            "variables": {
                "delta": "Rigid westward translation of all L-room polygons along the stair reference normal; preserves their untrimmed widths/areas.",
                "epsilon": "W-room front advance into the western corridor; negative means W rooms become shallower.",
                "tau": "Unknown combined distances from gross stair allocation boundaries to the measured stair clear faces; values 0 and .20m are illustrative assumptions.",
            },
            "deltaEquation": "delta = 0.25 * (measured_stair_clear_width + tau) - old_L3_side_reference_distance",
            "corridorEquation": "epsilon = current_clear_W - measured_clear_W - delta * projection",
            "projection": translation_projection,
            "simplifiedEquation": "delta + epsilon ≈ current_clear_W - 1.30",
            "cases": coupled_cases,
            "remainingConstraints": [
                "Historical W4/L1 overlap alignment is not enforced by this rigid-translation family.",
                "The R bank, source end containment and complete staircase length/landing/door arrangement remain unresolved.",
                "The 25/75 reference fraction is historical relative evidence, not a new measured placement.",
                "Gross allocation versus measured finished-face offsets remain assumptions; tau=.20m is not established wall thickness.",
                "Untrimmed L polygons retain dimensions under rigid translation; this does not assert their translated containment in the physical floor.",
                "Other western corridor runs and source-end effective offsets are not simultaneously refitted here.",
                "The separate stair-width probes already demonstrate room overlap and floor-containment conflicts when expanding the saved enclosure.",
            ],
        },
        "crossingAndJunctionRooms": {
            "boundaryTransitionRooms": ["W2", "B"],
            "junctionAdjacentPartialFronts": ["W4", "D", "L1"],
            "qualification": "These rooms do not receive complete fitted fronts or area claims from the run-by-run examples. The independent variants are not a single coherent revised floor.",
        },
    }
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1],
                        help="Rommelweb checkout; defaults to this script's repository")
    parser.add_argument("--output", type=Path,
                        help="Write JSON here; omit to print JSON to stdout")
    args = parser.parse_args()
    report = compute(args.repo.resolve())
    text = json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    if args.output:
        args.output.write_text(text)
        print(json.dumps({"output": str(args.output.resolve()),
                          "sourceStage": report["sourceStage"],
                          "measuredClearWidth": report["measurement"]["clearWidth"],
                          "runs": len(report["runs"]),
                          "straightFrontAlternatives": len(report["straightFrontAlternative"])}, indent=2))
    else:
        print(text, end="")


if __name__ == "__main__":
    main()
