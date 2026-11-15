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


def internal_from_planes(record):
    """Rebuild half-plane intersections with an independent geometry engine."""
    result = box(-100, -100, 100, 100)
    for edge in record["edgeOffsets"]:
        nx, ny = edge["normal"]
        assert abs(math.hypot(nx, ny) - 1) < 1e-8
        c = edge["constant"] + edge["allowance"]
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


def main():
    provenance_path = "data/source/house55-2og-study-provenance.json"
    study_path = "public/data/interior-studies.json"
    metadata = load(provenance_path)["areaStudy"]
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
    for record in metadata["rooms"]:
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
    assert abs(total - region.area) < 0.001, "Assigned rooms/halls/stairs must cover the same region"
    north_recess = max(source[15][1], source[16][1])
    r_front = min(spaces[label].bounds[1] for label in ["R1", "R2", "R3"])
    params = metadata["parameters"]
    r_clear = r_front - north_recess - params["recessBandMetres"] - params["allocationBoundaryHalfWallMetres"]
    assert abs(r_clear - params["minimumConnectorClearStudyGuardMetres"]) < 1e-5
    r_bank = next(b for b in metadata["banks"] if b["bank"] == "R")
    extra = r_bank["unconstrainedTargetGrowth"] - r_bank["corridorWallGrowth"]
    measurements = []
    for a, b in [(23, 0), (22, 23), (20, 21), (19, 20), (18, 17), (2, 3),
                 (6, 7), (8, 9), (9, 10), (12, 13), (11, 12), (15, 16)]:
        measurements.append({"roofVertices": [a, b], "lengthMetres": math.dist(source[a], source[b]),
                             "meaning": "Model exterior segment, not a clear internal span."})
    report = {
        "status": "Conditional area benchmark; all wall allowances and apartment depths remain unmeasured.",
        "studySHA256": digest(study_path), "provenanceSHA256": digest(provenance_path),
        "baselineSHA256": digest(metadata["baseline"]["path"]),
        "parameters": params, "rooms": rows, "exteriorMeasurements": measurements,
        "rConnector": {
            "grossGap": r_front - north_recess, "conditionalClearGap": r_clear,
            "extraDepthToForceTarget": extra, "conditionalClearGapIfTargetForced": r_clear - extra,
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
            "allSpaceOverlap": overlap, "areaConservationResidual": total - region.area,
        },
        "limits": [
            "16.4m² is a published apartment-category average, used here as a conditional internal-envelope target.",
            "Bathroom/service partition areas are unknown and are not deducted from the internal envelope.",
            "Room count and relative placements do not measure bank frontage, wall thickness or clear corridor widths.",
            "Longer rooms cannot establish whether the narrow R frontages match the approximate 2.70m living-zone example.",
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
                                  facecolor="#c7c2b2", edgecolor="#79746c", hatch="///", linewidth=.8))
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
    ax.annotate("R reaches the corridor limit\n14.73–14.74 m² retained",
                xy=(18, 3.7), xytext=(15.8, -2.4), fontsize=10, ha="center", color="#825a30",
                arrowprops={"arrowstyle": "->", "color": "#9e7b4a", "lw": .9})
    ax.text(7.1, -5.8, "16.40 m² benchmark\n17 rooms approach it\n3 R rooms remain short",
            ha="center", va="top", fontsize=12, linespacing=1.6, color="#415b51")
    ax.set_title("House 55 · 2. OG · area-based study with exterior measurements\n"
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
