#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["shapely==2.1.2", "matplotlib==3.10.8"]
# ///
"""Independently reconstruct the conditional wall-inset areas and draw their limits."""
import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import Polygon, LineString, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
R = (0.676 / math.hypot(0.676, 0.737), 0.737 / math.hypot(0.676, 0.737))


def local(point):
    x, z = point
    return (x * R[0] + z * R[1], -x * R[1] + z * R[0])


def polygon(record, key="polygon"):
    return Polygon([local(p) for p in record[key]],
                   [[local(p) for p in ring] for ring in record.get("holes", [])])


def load(path):
    return json.loads((ROOT / path).read_text())


def digest(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def internal_from_planes(record, hall_growth=0):
    """Rebuild half-plane intersections with an independent geometry engine."""
    result = box(-100, -100, 100, 100)
    for edge in record["edgeOffsets"]:
        nx, ny = edge["normal"]
        assert abs(math.hypot(nx, ny) - 1) < 1e-8
        c = edge["constant"] + edge["allowance"]
        if hall_growth and edge["kind"] == "hall-allocation":
            assert abs(nx) < 1e-8 and abs(ny - 1) < 1e-8, "R growth must face north"
            c -= hall_growth
        px, py = nx * c, ny * c
        tx, ty = -ny, nx
        half_plane = Polygon([
            (px - tx * 300, py - ty * 300),
            (px + tx * 300, py + ty * 300),
            (px + tx * 300 + nx * 300, py + ty * 300 + ny * 300),
            (px - tx * 300 + nx * 300, py - ty * 300 + ny * 300),
        ])
        result = result.intersection(half_plane)
    return result


def extra_depth_for_target(records):
    """Translate only the R hall plane; do not substitute an earlier bank width."""
    target = sum(record["targetArea"] for record in records)
    low, high = 0.0, 10.0
    assert sum(internal_from_planes(record, high).area for record in records) >= target
    for _ in range(60):
        middle = (low + high) / 2
        if sum(internal_from_planes(record, middle).area for record in records) < target:
            low = middle
        else:
            high = middle
    return (low + high) / 2


def stair_profile(level, source, spaces):
    """Measure enclosure and schematic flight separately at their shared middle."""
    stair = next(space for space in level["spaces"] if space["kind"] == "stairs")
    flight = Polygon([local(point) for point in stair["stairFlight"]])
    origin = source[3]
    length = math.dist(source[3], source[4])
    along = [(source[4][i] - origin[i]) / length for i in range(2)]
    east = [along[1], -along[0]]
    project = lambda point, axis: sum((point[i] - origin[i]) * axis[i] for i in range(2))
    flight_v = [project(point, along) for point in flight.exterior.coords]
    v = (min(flight_v) + max(flight_v)) / 2
    point_at = lambda u: [origin[i] + v * along[i] + u * east[i] for i in range(2)]
    cut = LineString([point_at(-100), point_at(100)])
    profiles = {}
    for name, shape in [("grossEnclosure", spaces["Stairs"]), ("schematicFlight", flight)]:
        section = shape.intersection(cut)
        assert isinstance(section, LineString), "One connected stair section required"
        values = [project(point, east) for point in section.coords]
        west, east_edge = min(values), max(values)
        assert west < 0 < east_edge
        profiles[name] = {"width": east_edge - west, "l3Width": -west, "r1Width": east_edge,
                          "l3Share": -west / (east_edge - west),
                          "r1Share": east_edge / (east_edge - west)}
    gross, schematic = profiles["grossEnclosure"], profiles["schematicFlight"]
    profiles["measuredSideInsets"] = {
        "l3Side": gross["l3Width"] - schematic["l3Width"],
        "r1Side": gross["r1Width"] - schematic["r1Width"],
    }
    profiles["flightOutsideEnclosureArea"] = flight.difference(spaces["Stairs"]).area
    profiles["rightOnlyShrinkMeaning"] = (
        "With the west enclosure edge fixed, reducing only the R1-side width increases "
        "the L3 fraction above its current 25%. The displayed flight instead has two "
        "explicit schematic side insets; no measured stair width is inferred."
    )
    return profiles


def main():
    provenance_path = "data/source/house55-2og-study-provenance.json"
    study_path = "public/data/interior-studies.json"
    provenance = load(provenance_path)
    metadata = provenance["areaStudy"]
    alignment = provenance.get("rAlignment")
    current_stage = provenance.get("currentStage", "areaStudy")
    assert current_stage in ["areaStudy", "rAlignment"], "Review a later geometry stage before auditing"
    assert bool(alignment) == (current_stage == "rAlignment")
    current_records = [
        next(record for record in alignment["rooms"] if record["label"] == old["label"])
        if alignment and old["bank"] == "R" else old
        for old in metadata["rooms"]
    ]
    level = next(p for p in load(study_path)["buildings"]["55"]["levels"] if p["index"] == 2)
    building = next(b for b in load("public/data/lod2.json")["buildings"] if b["number"] == "55")
    baseline = load(metadata["baseline"]["path"])["level"]
    spaces = {s["shortLabel"]: polygon(s) for s in level["spaces"]}
    previous = {s["shortLabel"]: polygon(s) for s in baseline["spaces"]}
    source = [local([p[0], p[2]]) for p in building["surfaces"][39]["points"]]
    flat = Polygon(source)
    plates = unary_union([polygon(p, "outer") for p in level["floorOutline"]])
    region = flat.intersection(plates)
    internal, rows = {}, []
    for record in current_records:
        label = record["label"]
        inferred = internal_from_planes(record)
        saved = Polygon([local(p) for p in record["internalPolygon"]])
        gross = spaces[label]
        assert abs(gross.area - record["grossArea"]) < 1e-5, label
        assert abs(inferred.area - record["internalArea"]) < 1e-5, label
        assert inferred.symmetric_difference(saved).area < 2e-5, label
        assert inferred.difference(gross).area < 2e-5, label
        internal[label] = inferred
        rows.append({
            "room": label, "bank": record["bank"],
            "recordStage": "rAlignment" if alignment and record["bank"] == "R" else "areaStudy",
            "grossArea": gross.area, "conditionalInternalArea": inferred.area,
            "removedPerimeterAllocation": gross.area - inferred.area,
            "target": record["targetArea"], "shortfall": record["targetArea"] - inferred.area,
            "targetMet": abs(inferred.area - record["targetArea"]) < 0.02,
            "grossDepth": record["grossDepth"],
            "internalStudyAxisExtents": [
                inferred.bounds[2] - inferred.bounds[0],
                inferred.bounds[3] - inferred.bounds[1],
            ],
        })
    assert len(rows) == 20 and sum(row["targetMet"] for row in rows) == 17
    assert level["windows"] == baseline["windows"], "Window evidence must remain unchanged"
    assert level["floorOutline"] == baseline["floorOutline"], "Area fit must not resize the building"
    overlap = sum(a.intersection(b).area for i, a in enumerate(spaces.values())
                  for b in list(spaces.values())[i + 1:])
    assert overlap < 1e-5, overlap
    hall_names = ["West hall", "East hall"]
    total = sum(p.area for p in spaces.values())
    assert abs(total - region.area) < 0.001, "Rooms/halls/stairs/unassigned must cover the same region"
    north_recess = max(source[15][1], source[16][1])
    r_front = min(spaces[label].bounds[1] for label in ["R1", "R2", "R3"])
    params = metadata["parameters"]
    r_clear = r_front - north_recess - params["recessBandMetres"] - params["allocationBoundaryHalfWallMetres"]
    assert abs(r_clear - params["minimumConnectorClearStudyGuardMetres"]) < 1e-5
    r_records = [record for record in current_records if record["bank"] == "R"]
    extra = extra_depth_for_target(r_records)
    per_room_extra = {record["label"]: extra_depth_for_target([record]) for record in r_records}
    service_records = [space for space in level["spaces"] if space["kind"] == "service"]
    service_ids = {space["id"] for space in service_records}
    service_doors = [door for door in level["doors"] if door["spaceId"] in service_ids]
    service_area = sum(spaces[space["shortLabel"]].area for space in service_records)
    stair = stair_profile(level, source, spaces)
    assert abs(stair["grossEnclosure"]["l3Share"] - .25) < 1e-5
    assert stair["flightOutsideEnclosureArea"] < 1e-5
    alignment_audit = None
    if alignment:
        alignment_baseline = load(alignment["baseline"]["path"])["level"]
        baseline_rooms = {space["shortLabel"]: space for space in alignment_baseline["spaces"] if space["kind"] == "room"}
        assert all(space == baseline_rooms[space["shortLabel"]]
                   for space in level["spaces"] if space["kind"] == "room" and not space["shortLabel"].startswith("R"))
        assert level["floorOutline"] == alignment_baseline["floorOutline"]
        assert level["windows"] == alignment_baseline["windows"]
        assert len(service_records) == 1 and not service_doors
        assert abs(service_area - alignment["unassigned"]["area"]) < 1e-5
        assert not alignment["unassigned"]["assumedPassage"]
        assert all(abs(value - .1) < 1e-5 for value in stair["measuredSideInsets"].values())
        endpoint_residuals = {}
        for key, index, record in [("left", 16, r_records[0]), ("right", 15, r_records[2])]:
            plane = next(edge for edge in record["edgeOffsets"] if edge["kind"] == "bank-end")
            endpoint_residuals[key] = sum(plane["normal"][i] * source[index][i] for i in range(2)) - plane["constant"]
        assert max(map(abs, endpoint_residuals.values())) < 1e-8
        r_union = unary_union([spaces[label] for label in ["R1", "R2", "R3"]])
        facade = next(edge for edge in r_records[0]["edgeOffsets"] if edge["kind"] == "external-facade")
        points = [point for point in r_union.exterior.coords
                  if abs(sum(facade["normal"][i] * point[i] for i in range(2)) - facade["constant"]) < 1e-5]
        facade_length = max(math.dist(a, b) for a in points for b in points)
        alignment_audit = {
            "baselineSHA256": digest(alignment["baseline"]["path"]),
            "unchangedNonRRoomCount": 17, "recessEndpointPlaneResiduals": endpoint_residuals,
            "oppositeRecessLength": math.dist(source[15], source[16]),
            "alignedEstimatedBankFacadeLength": facade_length,
            "unchangedSourceFacadeLength": math.dist(source[6], source[7]),
            "meaning": "Estimated bank side lines align to both opposite recess endpoints. Slight retained side slopes explain the bank/recess length difference. The source shell edge is unchanged.",
        }
    measurements = []
    for a, b in [(23, 0), (22, 23), (20, 21), (19, 20), (18, 17), (2, 3),
                 (6, 7), (8, 9), (9, 10), (12, 13), (11, 12), (15, 16)]:
        measurements.append({"roofVertices": [a, b], "lengthMetres": math.dist(source[a], source[b]),
                             "meaning": "Model exterior segment, not a clear internal span."})
    report = {
        "status": "Conditional area benchmark; all wall allowances and apartment depths remain unmeasured.",
        "currentStage": current_stage,
        "studySHA256": digest(study_path), "provenanceSHA256": digest(provenance_path),
        "baselineSHA256": digest(metadata["baseline"]["path"]),
        "parameters": params, "rooms": rows, "exteriorMeasurements": measurements,
        "historicalAreaStudyMeaning": "The retained areaStudy baseline measures the change from the preceding depth study. R plane records are superseded only when currentStage is rAlignment.",
        "rAlignment": alignment_audit, "staircase": stair,
        "rConnector": {
            "grossGap": r_front - north_recess, "conditionalClearGap": r_clear,
            "extraDepthToForceTarget": extra, "conditionalClearGapIfTargetForced": r_clear - extra,
            "extraDepthToForceEachRoomTarget": per_room_extra,
            "targetGrowthMeaning": "Independent half-plane solve for the three-room mean to equal 16.4m², translating only the north-facing hall plane. Individual depths are also shown; none is applied.",
            "meaning": "1.20m is a declared study guard. No building-code or real clearance finding.",
        },
        "areaBudget": {
            "fixedAnnotationRegion": region.area,
            "grossRoomsBefore": sum(previous[r["room"]].area for r in rows),
            "grossRoomsAfter": sum(spaces[r["room"]].area for r in rows),
            "conditionalInternalEnvelopeTotal": sum(r["conditionalInternalArea"] for r in rows),
            "hallRemainderBefore": sum(previous[n].area for n in hall_names),
            "hallRemainderAfter": sum(spaces[n].area for n in hall_names),
            "stairArea": spaces["Stairs"].area,
            "unassignedServiceArea": service_area,
            "allSpaceOverlap": overlap, "areaConservationResidual": total - region.area,
        },
        "unassigned": {
            "spaceCount": len(service_records), "area": service_area,
            "doorwayCount": len(service_doors), "assumedPassage": False,
            "meaning": "Explicit unassigned stair-side strip and connected pocket; no service function, occupancy, or passage is established.",
        },
        "limits": [
            "16.4m² is a published apartment-category average, used here as a conditional internal-envelope target.",
            "Bathroom/service partition areas are unknown and are not deducted from the internal envelope.",
            "Room count and relative placements do not measure bank frontage, wall thickness or clear corridor widths.",
            "A living-zone packing witness cannot establish a complete apartment layout or remove the remaining R internal-area shortfall.",
        ],
    }
    path = ROOT / "docs/data/house55-area-audit.json"
    path.write_text(json.dumps(report, indent=2) + "\n")
    draw(level, source, spaces, internal, rows, report)
    print(json.dumps({"report": str(path), "areaBudget": report["areaBudget"],
                      "rConnector": report["rConnector"]}, indent=2))


def draw(level, source, spaces, internal, rows, report):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.patches import Polygon as Patch

    fig, ax = plt.subplots(figsize=(16, 10.2), layout="constrained")
    fig.set_facecolor("#f8f7f3")
    ax.set_facecolor("#f8f7f3")
    flat = Polygon(source)
    ax.add_patch(Patch(list(flat.exterior.coords), facecolor="#e5e1d7", edgecolor="#55564e", linewidth=1.2))
    for row in rows:
        label = row["room"]
        gross, inset = spaces[label], internal[label]
        ax.add_patch(Patch(list(gross.exterior.coords), facecolor="#bbb8ad", edgecolor="#6d6b60", linewidth=.7))
        ax.add_patch(Patch(list(inset.exterior.coords),
                          facecolor="#efdfc8" if not row["targetMet"] else "#d8e1dc",
                          edgecolor="#936b40" if not row["targetMet"] else "#6e8b82", linewidth=.7,
                          hatch="//" if not row["targetMet"] else None))
        p = inset.representative_point()
        ax.text(p.x, p.y, f'{label}\n{row["conditionalInternalArea"]:.2f} m²',
                fontsize=9.5, ha="center", va="center", color="#343b35")
    for s in level["spaces"]:
        if s["kind"] != "room":
            p = spaces[s["shortLabel"]].representative_point()
            if s["kind"] == "stairs":
                ax.add_patch(Patch(list(spaces[s["shortLabel"]].exterior.coords),
                                  facecolor="#c7c2b2", edgecolor="#79746c", linewidth=.8))
                flight = Polygon([local(point) for point in s["stairFlight"]])
                ax.add_patch(Patch(list(flight.exterior.coords), facecolor="#aaa497",
                                  edgecolor="#655f54", hatch="///", linewidth=.7))
                split = report["staircase"]
                ax.annotate(
                    f'Enclosure: {split["grossEnclosure"]["l3Share"]:.0%} L3 / {split["grossEnclosure"]["r1Share"]:.0%} R1\n'
                    f'Schematic flight: {split["schematicFlight"]["l3Share"]:.2%} / {split["schematicFlight"]["r1Share"]:.2%}\n'
                    f'{split["schematicFlight"]["width"]:.2f} m with two 0.10 m side insets',
                    xy=(p.x, p.y), xytext=(7.2, -1.4), fontsize=8, ha="center", color="#665d4d",
                    arrowprops={"arrowstyle": "->", "color": "#79746c", "lw": .8},
                )
            elif s["kind"] == "service":
                ax.add_patch(Patch(list(spaces[s["shortLabel"]].exterior.coords),
                                  facecolor="#dbd3df", edgecolor="#85708d", hatch="xx", linewidth=.7))
                ax.annotate(
                    f'Unassigned: {spaces[s["shortLabel"]].area:.2f} m²\nNo doorway or assumed passage',
                    xy=(p.x, p.y), xytext=(17.0, 14.5), fontsize=9, ha="center", color="#716078",
                    arrowprops={"arrowstyle": "->", "color": "#85708d", "lw": .8},
                )
            else:
                ax.text(p.x, p.y, s["shortLabel"], fontsize=8, color="#686760", ha="center")
    for band in level["wallBands"]:
        p = polygon(band)
        ax.add_patch(Patch(list(p.exterior.coords), facecolor="#726e60", alpha=.8, linewidth=0))
    for w in level["windows"]:
        line = LineString([local(p) for p in w["segment"]])
        ax.plot(*line.xy, color="#318396", linewidth=2.6, solid_capstyle="butt")
    for measure in report["exteriorMeasurements"]:
        a, b = [source[i] for i in measure["roofVertices"]]
        length = math.dist(a, b)
        tangent = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
        normal = (-tangent[1], tangent[0])
        mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        from shapely.geometry import Point
        if flat.contains(Point(mid[0] + normal[0] * .05, mid[1] + normal[1] * .05)):
            normal = tuple(-v for v in normal)
        offset = 1.18
        aa = tuple(a[i] + normal[i] * offset for i in range(2))
        bb = tuple(b[i] + normal[i] * offset for i in range(2))
        ax.annotate("", xy=aa, xytext=bb,
                    arrowprops={"arrowstyle": "|-|", "color": "#797d75", "lw": .8})
        for p, q in [(a, aa), (b, bb)]:
            ax.plot([p[0], q[0]], [p[1], q[1]], color="#b3b6ae", lw=.6)
        angle = math.degrees(math.atan2(-tangent[1], tangent[0]))
        if angle > 90:
            angle -= 180
        if angle < -90:
            angle += 180
        ax.text((aa[0] + bb[0]) / 2, (aa[1] + bb[1]) / 2,
                f'{length:.2f} m', rotation=angle, ha="center", va="center", fontsize=8,
                bbox={"facecolor": "#f8f7f3", "edgecolor": "none", "pad": 1.7})
    r_areas = [row["conditionalInternalArea"] for row in rows if row["bank"] == "R"]
    ax.annotate(f'R retains the 1.20 m study guard\n{min(r_areas):.2f}–{max(r_areas):.2f} m²',
                xy=(18, 3.7), xytext=(17.4, -2.4), fontsize=10, ha="center", color="#825a30",
                arrowprops={"arrowstyle": "->", "color": "#9e7b4a", "lw": .9})
    ax.text(7.1, -5.8, "16.40 m² benchmark\n17 rooms approach it\n3 R rooms remain short",
            ha="center", va="top", fontsize=12, linespacing=1.6, color="#415b51")
    ax.set_title("House 55 · 2. OG · conditional areas after R alignment\n"
                 "Areas: conditional internal envelopes · lengths: model exterior edges",
                 fontsize=16, loc="left", pad=20)
    fig.supxlabel("Assumptions: 0.30 m marked end walls · 0.20 m window façades · 0.10 m at each shared boundary\n"
                  "16.4 m² is a category average. Internal service partitions are unknown. All interior dimensions remain estimates.",
                  fontsize=10, color="#5c635c")
    ax.set_aspect("equal")
    ax.set_xlim(-12.5, 34.5)
    ax.set_ylim(20.2, -9.2)
    ax.axis("off")
    fig.savefig(ROOT / "docs/preview/house55-area-study.png", dpi=160)
    plt.close(fig)


if __name__ == "__main__":
    main()
