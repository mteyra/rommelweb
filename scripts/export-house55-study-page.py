#!/usr/bin/env python3
"""Export the measured candidate and historical comparison for the web preview."""
import argparse
import hashlib
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    repo = args.repo.resolve()
    source = repo / "docs/data/house55-measured-plan-candidate.json"
    candidate = json.loads(source.read_text())
    previous = json.loads((repo / "public/house55-study/previous.json").read_text())
    for name, digest in candidate["sourceHashes"].items():
        if hashlib.sha256((repo / name).read_bytes()).hexdigest() != digest:
            raise ValueError(f"Candidate is stale: {name}")
    labels = set("ABCDEFG") | {f"{b}{i}" for b, n in [("W", 4), ("L", 3), ("R", 3), ("N", 3)] for i in range(1, n + 1)}
    if {r["label"] for r in candidate["rooms"]} != labels:
        raise ValueError("Candidate must retain all twenty established room labels.")
    if {r["label"] for r in previous["rooms"]} != labels:
        raise ValueError("Historical comparison has different room identities.")
    metrics, residuals = candidate["metrics"], candidate["residuals"]
    bank_order = {"A": 0, "W": 1, "L": 2, "E": 3, "R": 4, "N": 5}
    candidate["rooms"].sort(key=lambda r: (bank_order[r["bank"]], r["label"]))
    candidate["stair"]["zones"] = [
        {"label": "1.43 m", "polygon": candidate["stair"]["candidateFlightGuardRun"]["polygon"]},
        {"label": "1.29 m", "polygon": candidate["stair"]["walkway"]["polygon"]},
    ]
    candidate["doors"] = [
        {"segment": d["points"], "positionMeasured": False}
        for d in candidate["stair"]["hallConnections"]
    ]
    candidate["labels"] = []
    for corridor in candidate["corridors"]:
        ring = corridor["polygon"]
        bounds = [min(p[0] for p in ring), min(p[1] for p in ring),
                  max(p[0] for p in ring), max(p[1] for p in ring)]
        candidate["labels"].append({
            "text": "1.30 m",
            "position": [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2],
        })
    nominal = metrics["nominalAreaEquivalentModule"]
    output = {
        "schemaVersion": 1,
        "candidateSourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "candidate": candidate,
        "previous": previous,
        "metrics": {"nominalWidth": nominal["width"], "nominalDepth": nominal["depth"]},
        "description": (
            f"The typical area-equivalent module is {nominal['width']:.2f} × {nominal['depth']:.2f} m. "
            f"The six banks vary with the outline: individual envelopes span {metrics['roomAreaMin']:.2f}–"
            f"{metrics['roomAreaMax']:.2f} m², averaging {metrics['roomAreaMean']:.2f} m² across twenty rooms."
        ),
        "assumptionsText": (
            "Partitions and the effective source-edge allowance are assumed to be 20 cm. "
            f"The plan leaves {metrics['unassignedWithinFlatRoofArea']:.2f} m² inside the source roof outline unassigned, "
            f"plus {metrics['unassignedOutsideFlatRoofArea']:.2f} m² of outer roof margins. "
            "These pale areas are not additional hallway width or apartment area."
        ),
        "stairNote": (
            f"The drawn inside length is {candidate['stair']['candidateLength']:.2f} m, with assumed landing lengths "
            "and two offset entrance locations. Only the cross-section is measured; exact doors, treads and elevations remain open."
        ),
        "checks": [
            {"label": "20 room interiors", "passed": len(candidate["rooms"]) == 20},
            {"label": "No room overlaps", "passed": residuals["roomPairOverlapArea"] < 1e-8},
            {"label": "Inside source outline", "passed": residuals["outsideReferenceFlatRoofArea"] < 1e-8},
            {"label": "Connected circulation", "passed": residuals["circulationConnectedIncludingBothLandings"]},
        ],
    }
    target = repo / "public/house55-study/plan.json"
    target.write_text(json.dumps(output, indent=2) + "\n")
    print(f"Wrote {target.relative_to(repo)}")


if __name__ == "__main__":
    main()
