#!/usr/bin/env python3
"""Render the saved House 55 plan against the resident's stair-width evidence.

This writes only an analysis SVG and, when ImageMagick is available, its PNG.
It never changes public geometry. Run from any directory:

  python3 scripts/render-house55-measurement-audit.py

The default audit input is docs/data/house55-stair-measurement-audit.json.
During recovery, /tmp/rommelweb-stair-width-conflicts.json is a fallback.
Pass --audit PATH to select an explicit compatible calculation receipt.
SVG generation uses only the Python standard library.
"""

import argparse
import hashlib
import html
import json
import math
from pathlib import Path
import shutil
import subprocess


def read(path):
    return json.loads(path.read_text())


def centroid(ring):
    cross_sum = cx = cy = 0.0
    for a, b in zip(ring, ring[1:]):
        cross = a[0] * b[1] - b[0] * a[1]
        cross_sum += cross
        cx += (a[0] + b[0]) * cross
        cy += (a[1] + b[1]) * cross
    return [cx / (3 * cross_sum), cy / (3 * cross_sum)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--audit", type=Path)
    parser.add_argument("--no-png", action="store_true")
    args = parser.parse_args()
    repo = args.repo.resolve()
    audit_path = args.audit or repo / "docs/data/house55-stair-measurement-audit.json"
    if not audit_path.exists() and args.audit is None:
        audit_path = Path("/tmp/rommelweb-stair-width-conflicts.json")
    audit = read(audit_path)
    measurement_path = repo / "data/source/house55-2og-stair-measurements.json"
    measurement = read(measurement_path)
    for name, expected in audit["inputHashes"].items():
        actual = hashlib.sha256((repo / name).read_bytes()).hexdigest()
        if actual != expected:
            raise ValueError(f"Stale audit: {name} no longer matches its calculation receipt.")
    widths = measurement["widths"]
    total = widths["totalWallToWallMetres"]
    first = widths["stairAndCentralGuardMetres"]
    second = widths["levelWalkwayMetres"]
    if not math.isclose(first + second, total, abs_tol=1e-10):
        raise ValueError("Measured width components do not sum to total.")
    if not math.isclose(total, audit["measurement"]["totalWallToWall"], abs_tol=1e-10):
        raise ValueError("The receipt does not use the current measured width.")
    studies = read(repo / "public/data/interior-studies.json")
    level = next(x for x in studies["buildings"]["55"]["levels"] if x["index"] == 2)
    rooms = [x for x in level["spaces"] if x["kind"] == "room"]
    if len(rooms) != 20:
        raise ValueError("This analysis plate expects the saved twenty-room candidate.")
    provenance = read(repo / "data/source/house55-2og-study-provenance.json")
    registration = provenance["registration"]
    origin = registration["localOriginInCampusXZ"]
    axes = registration["localAxesInCampusXZ"]

    def local(point):
        q = [point[i] - origin[i] for i in range(2)]
        return [sum(q[i] * axes[k][i] for i in range(2)) for k in ("x", "y")]

    floor = [{"outer": list(map(local, p["outer"])),
              "holes": [list(map(local, h)) for h in p.get("holes", [])]}
             for p in level["floorOutline"]]
    spaces = [{**s, "outer": list(map(local, s["polygon"])),
               "holes": [list(map(local, h)) for h in s.get("holes", [])]}
              for s in level["spaces"]]
    probe = next(x for x in audit["scenarios"]
                 if x["name"] == "retain historical 25/75 reference split")
    probe_ring = probe["candidatePolygonStudyCoordinates"]
    points = [p for piece in floor for p in piece["outer"]]
    xmin, xmax = min(p[0] for p in points), max(p[0] for p in points)
    ymin, ymax = min(p[1] for p in points), max(p[1] for p in points)
    scale = min(858 / (xmax - xmin), 565 / (ymax - ymin))
    xoff = 48 + (858 - (xmax - xmin) * scale) / 2
    yoff = 200 + (565 - (ymax - ymin) * scale) / 2

    def screen(point):
        return [xoff + (point[0] - xmin) * scale,
                yoff + (point[1] - ymin) * scale]

    def path(rings):
        commands = []
        for ring in rings:
            q = list(map(screen, ring))
            commands.append("M" + " L".join(f"{x:.3f},{y:.3f}" for x, y in q) + " Z")
        return " ".join(commands)

    def space_path(space):
        return path([space["outer"], *space["holes"]])

    floor_path = path([r for p in floor for r in [p["outer"], *p["holes"]]])
    probe_path = path([probe_ring])
    escape = html.escape
    svg = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="1040" viewBox="0 0 1400 1040">',
        '<title>House 55 top floor: recovered stair measurement conflicts with saved candidate</title>',
        '<desc>All twenty saved study rooms with an uncorrected 2.72 metre stair-width probe. '
        'The measured 1.43 and 1.29 metre components are shown separately without confirmed plan orientation.</desc>',
        '<style>'
        'text{font-family:"DejaVu Sans",sans-serif;fill:#172b36}'
        '.small{font-size:13px;fill:#536671}.body{font-size:15px}'
        '.label{font-size:16px;font-weight:700;paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round}'
        '.kicker{font-size:13px;letter-spacing:1.1px;font-weight:700}'
        '.number{font-size:23px;font-weight:700}.red{fill:#b32d37}'
        '.blue{fill:#235777}.muted{fill:#536671}'
        '</style>',
        '<defs>',
        '<pattern id="conflict" width="7" height="7" patternUnits="userSpaceOnUse">'
        '<rect width="7" height="7" fill="#f8c9c7"/>'
        '<path d="M-2,2 L2,-2 M0,7 L7,0 M5,9 L9,5" stroke="#bf4350" stroke-width="1.4"/></pattern>',
        f'<mask id="outside-floor"><rect width="1400" height="1040" fill="white"/>'
        f'<path d="{floor_path}" fill="black" fill-rule="evenodd"/></mask>',
    ]
    for label in ("L3", "R1"):
        space = next(s for s in spaces if s.get("shortLabel") == label)
        svg.append(f'<clipPath id="clip-{label}"><path d="{space_path(space)}" clip-rule="evenodd"/></clipPath>')
    svg += ['</defs>', '<rect width="1400" height="1040" fill="#fafbf9"/>']

    def text(x, y, value, klass="body", **attrs):
        extra = " ".join(f'{key.replace("_", "-")}="{escape(str(v), quote=True)}"'
                         for key, v in attrs.items())
        svg.append(f'<text x="{x:.3f}" y="{y:.3f}" class="{klass}" {extra}>{escape(value)}</text>')

    def line(x1, y1, x2, y2, stroke="#d7dfe1", width=1, dash=None):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        svg.append(f'<line x1="{x1:.3f}" y1="{y1:.3f}" x2="{x2:.3f}" y2="{y2:.3f}" '
                   f'stroke="{stroke}" stroke-width="{width}"{d}/>')

    def rect(x, y, w, h, fill, stroke="none", radius=0):
        svg.append(f'<rect x="{x:.3f}" y="{y:.3f}" width="{w:.3f}" height="{h:.3f}" '
                   f'fill="{fill}" stroke="{stroke}" rx="{radius}"/>')

    text(48, 39, "ROMMELWEB  /  HOUSE RED · 55  /  2. OG", "kicker")
    text(48, 87, "The measured stairwell does not fit the saved candidate.",
         style="font-size:30px;font-weight:700")
    text(48, 117, "Recovered resident measurement: 2.72 m inside wall to inside wall. Analysis dated 15 November 2026.", "body")
    line(48, 139, 1352, 139)
    text(48, 174, "SAVED CANDIDATE — NOT A CORRECTED PLAN", "kicker red")
    text(48, 195, "Twenty room references; every room dimension remains estimated.", "small")
    line(931, 164, 931, 835)
    text(967, 174, "ONE MEASURED CROSS-SECTION", "kicker")
    text(967, 202, "1.43 m + 1.29 m = 2.72 m", "number")
    text(967, 225, "Width sum only; orientation to L / R unregistered.", "small")

    svg.append(f'<path d="{floor_path}" fill="#ecefe9" stroke="#697b80" stroke-width="1.6" fill-rule="evenodd"/>')
    for space in spaces:
        fill = {"room": "#f6f0e2", "stairs": "#b9d4dd",
                "corridor": "#e0edf0", "service": "#e5e5e0"}[space["kind"]]
        svg.append(f'<path d="{space_path(space)}" fill="{fill}" stroke="#778789" '
                   'stroke-width="1.0" fill-rule="evenodd"/>')
    svg.append(f'<path d="{probe_path}" fill="#d2555c" fill-opacity=".10" stroke="none"/>')
    for label in ("L3", "R1"):
        svg.append(f'<path d="{probe_path}" fill="url(#conflict)" clip-path="url(#clip-{label})"/>')
    svg.append(f'<path d="{probe_path}" fill="#d42642" mask="url(#outside-floor)"/>')
    for door in level.get("doors", []):
        a, b = [screen(local(p)) for p in door["segment"]]
        line(*a, *b, stroke="#fafbf9", width=3.5)
    svg.append(f'<path d="{probe_path}" fill="none" stroke="#b32d37" stroke-width="2.6" stroke-dasharray="7 4"/>')
    for space in spaces:
        if space["kind"] == "room":
            x, y = screen(centroid(space["outer"]))
            text(x, y + 5, space["shortLabel"], "label", text_anchor="middle")
    stairs = next(s for s in spaces if s["kind"] == "stairs")
    sx, sy = screen(centroid(stairs["outer"]))
    text(sx, sy, "saved", "small", text_anchor="middle", font_size="10")
    text(sx, sy + 14, "stairs", "small", text_anchor="middle", font_size="10")
    # A width marker is outside the plate, with a leader to the probe.
    px, py = screen(probe_ring[0])
    text(px + 28, py + 42, "2.72 m probe", "small red", font_weight="700")
    line(px + 12, py + 33, px + 2, py + 5, stroke="#b32d37", width=1.4)
    bar_y = 793
    line(54, bar_y, 54 + 5 * scale, bar_y, stroke="#334e5c", width=2)
    for x in (54, 54 + 5 * scale):
        line(x, bar_y - 5, x, bar_y + 5, stroke="#334e5c", width=1.4)
    text(54, bar_y + 23, "0", "small")
    text(54 + 5 * scale, bar_y + 23, "5 m", "small", text_anchor="end")
    text(195, bar_y + 4, "Saved floor plate · stored study axes", "small")
    text(195, bar_y + 24, "Source exterior is unchanged.", "small")

    # Width bars share one scale, but do not assert spatial orientation.
    bw = 356 / total
    bx, by, bh = 967, 265, 48
    rect(bx, by, first * bw, bh, "#235777")
    rect(bx + first * bw, by, second * bw, bh, "#95c2d4")
    text(bx + first * bw / 2, by + 31, f"{first:.2f} m", "body",
         text_anchor="middle", style="fill:white;font-weight:700")
    text(bx + (first + second / 2) * bw, by + 31, f"{second:.2f} m", "body",
         text_anchor="middle", font_weight="700")
    text(bx, 339, "Flight + central railing / gap", "small")
    text(bx + 197, 339, "Level walkway", "small")
    text(bx, 361, "Clear flight width and central gap are not separated.", "small")
    old = audit["currentEnclosure"]
    gap = [x["grossGapAlongStudyU"] for x in audit["sharedL3R1GapSections"]]
    text(bx, 408, "SAVED ENCLOSURE", "kicker muted")
    rect(bx, 427, old["width"] * bw, 31, "#adbcc1")
    text(bx + old["width"] * bw + 12, 450, f'{old["width"]:.3f} m', "body")
    text(bx, 481, "Old inferred allocation; no longer a viable width.", "small")
    text(bx, 526, "ENTIRE SAVED L3–R1 GAP", "kicker muted")
    rect(bx, 545, sum(gap) / 2 * bw, 31, "#c5cec8")
    text(bx, 601, f"{min(gap):.3f}–{max(gap):.3f} m at the checked sections", "body")
    text(bx, 624, "Even the whole gap is too narrow.", "small red", font_weight="700")
    line(bx, 649, 1352, 649)
    text(bx, 687, f'+{old["widthShortfall"]:.3f} m', "number red")
    text(bx, 713, "required beyond the old stair enclosure", "body")
    deficits = [x["minimumGapDeficitAgainstMeasuredWidth"] for x in audit["sharedL3R1GapSections"]]
    text(bx, 753, f"≥ {min(deficits):.3f}–{max(deficits):.3f} m", "number red")
    text(bx, 779, "missing from the entire saved inter-room gap", "body")
    text(bx, 808, "Measured inside width versus saved gross spans:", "small")
    text(bx, 829, "no wall thickness added; an optimistic comparison.", "small")

    line(48, 850, 1352, 850)
    rect(49, 877, 19, 15, "url(#conflict)")
    text(82, 890, "Red hatch = probe overlaps saved L3 / R1", "body")
    line(498, 883, 528, 883, stroke="#b32d37", width=2.6, dash="7 4")
    text(541, 890, "Dashed red = width-only conflict test", "body")
    text(49, 926, "Probe holds the old length and historical 25 / 75 reference split: 0.68 m + 2.04 m.", "body")
    overlaps = probe["intersectionWithSavedSpaces"]
    text(49, 954, f'Saved-room intersections: L3 {overlaps["L3"]:.3f} m² · R1 {overlaps["R1"]:.3f} m². '
         f'Outside the saved floor plate: {probe["outsideSavedFloorPlateArea"]:.3f} m².', "body red")
    text(49, 985, "The historical reference split is independent of the measured 1.43 / 1.29 split. This probe supplies no replacement wall coordinates.", "small")
    text(49, 1008, "Inputs: saved interior-study JSON · retained rAlignment provenance · resident stair measurements · independently calculated width-conflict audit.", "small")
    svg.append("</svg>")
    out = repo / "docs/screenshots/house-55-red/house55-measured-stair-conflict.svg"
    out.write_text("\n".join(svg) + "\n")
    print(out)
    if not args.no_png:
        magick = shutil.which("magick") or shutil.which("convert")
        if not magick:
            raise RuntimeError("SVG written. Install ImageMagick or use --no-png.")
        png = out.with_suffix(".png")
        subprocess.run([magick, "-background", "#fafbf9", str(out), str(png)], check=True)
        print(png)


if __name__ == "__main__":
    main()
