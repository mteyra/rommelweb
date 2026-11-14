#!/usr/bin/env python3
"""Inspect non-personal room facts from Rommelwood's public orientation map.

Uses an allowlist and plain text parsing; never executes retrieved JavaScript.
Publishes summary metadata only unless reuse permission is explicitly acknowledged.
Do not treat source point coordinates as surveyed room geometry.
"""

import argparse
import collections
import datetime
import json
from pathlib import Path
import re
import urllib.request


SOURCE = "https://rommelwood.de/map/"
HOUSES = {"49", "51", "51a", "53", "53a", "55", "55a", "57", "57a", "59", "59a"}
ENTRY = re.compile(r"  'room_([^']+)': \{(.*?)\n  \},", re.S)


def extract(html):
    markers = []
    excluded = []
    for room_id, body in ENTRY.findall(html):
        # Only room labels and explicit map fields; never names or contact details.
        fields = {}
        patterns = {
            "house": r"Erwin-Rommel-Str\. ([^,]+),",
            "floor": r"Stockwerk (\d+)",
            "latitude": r"location_latitude: ([\d.]+)",
            "longitude": r"location_longitude: ([\d.]+)",
        }
        for field, pattern in patterns.items():
            match = re.search(pattern, body)
            fields[field] = match.group(1) if match else None
        if fields["house"] not in HOUSES:
            excluded.append(room_id)
            continue
        if None in fields.values():
            raise ValueError(f"Incomplete map entry for room {room_id}")
        if not re.fullmatch(r"(?:\d+[AB]?|\d+\.\d+\.\d+)", room_id):
            raise ValueError(f"Unexpected room label: {room_id}")
        marker = {
            "id": room_id,
            "house": fields["house"],
            "floor": int(fields["floor"]),
            "latitude": float(fields["latitude"]),
            "longitude": float(fields["longitude"]),
        }
        if not (49.5755 < marker["latitude"] < 49.5780
                and 11.0280 < marker["longitude"] < 11.0320):
            raise ValueError(f"Out-of-campus marker: {room_id}")
        markers.append(marker)
    if not markers:
        raise ValueError("No room markers found; the source format may have changed")
    if len({m["id"] for m in markers}) != len(markers):
        raise ValueError("Duplicate room labels in the source")
    markers.sort(key=lambda m: (int(re.match(r"\d+", m["house"])[0]),
                                m["house"].endswith("a"), m["floor"], m["id"]))
    return markers, excluded


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--html", type=Path, help="Use a previously downloaded public map HTML")
    parser.add_argument("--output", type=Path, default=Path("public/data/room-markers.json"))
    parser.add_argument(
        "--acknowledge-permission",
        action="store_true",
        help="Include individual source records only after establishing reuse permission. This flag does not grant permission.",
    )
    args = parser.parse_args()
    if args.html:
        html = args.html.read_text(encoding="utf-8")
    else:
        request = urllib.request.Request(SOURCE, headers={"User-Agent": "rommelweb-research/0.1"})
        with urllib.request.urlopen(request, timeout=30) as response:
            html = response.read().decode("utf-8")
    markers, excluded = extract(html)
    summary = {}
    for house in sorted({m["house"] for m in markers}):
        rooms = [m for m in markers if m["house"] == house]
        summary[house] = {
            "markerCount": len(rooms),
            "floors": dict(sorted(collections.Counter(m["floor"] for m in rooms).items())),
        }
    data = {
        "source": SOURCE,
        "retrieved": datetime.date.today().isoformat(),
        "description": "Research summary of the public room index. Individual source records are withheld from the starter until reuse and geometry are validated. No resident identity, occupancy, contact information or access credentials.",
        "geometryStatus": "unverified-orientation-points",
        "recordsStatus": "permission-acknowledged-export" if args.acknowledge_permission else "metadata-only",
        "observedMarkerCount": len(markers),
        "usage": "Build a verified room index from approved plans or resident contributions. Do not draw room walls from source orientation coordinates or interpret a marker as an occupant.",
        "coverage": "Incomplete: no room markers for 51a; modern ground-floor and group-living rooms may be absent.",
        "rights": "Source: Rommelwood public map. No explicit open license for its custom room database was identified. Public starter contains aggregate research metadata only; full records require established reuse permission. Original cartography, prose, imagery and personal details are not copied.",
        "summary": summary,
        "markers": markers if args.acknowledge_permission else [],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Observed {len(markers)} campus room markers; exported {len(data['markers'])} individual records to {args.output}")
    print(f"Excluded {len(excluded)} records outside the campus house allowlist")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
