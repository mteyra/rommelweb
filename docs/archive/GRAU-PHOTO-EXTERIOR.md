# Grau 55a — seven-photo exterior reconstruction

This pass updates **Grau / Erwin-Rommel-Straße 55a only**, using the resident's seven November 2026 photographs. The official footprint, placement, **18.198 m height**, six existing storeys, floor sections, apartment layouts, corridors and internal stairs are unchanged. Window corrections belong only to the folded exterior.

## Photograph registration

Compass names below are approximate: the building is rotated, so north faces NNW, east ESE, south SSW and west WNW.

| Photos | Elevation | Evidence used |
| --- | --- | --- |
| 1, 2 | East | Long mesh bicycle enclosure; broad blank timber at the southeast end; staggered tall windows; long third-floor southeast loggia and short fourth-floor northeast return |
| 3 | South and southeast corner | South service porch, lime supports, bicycle-cage return, southwest loggias on floors 2 and 5, southeast loggia return on floor 3 |
| 4 | North entrance | Five open upper landings; solid timber wings; entrance beneath the gallery; blue-tinted door, mailboxes, service cabinet and address fascia |
| 5 | Northeast corner | Confirms east cage wrapping onto the north wing, gray `grau` lettering, and the adjacent central entrance |
| 6, 7 | West | Six ground openings; shifted upper rows; northwest floor-1 loggia and southwest floor-2/floor-5 returns |

Floor 0 is ground level. Green floating streaks in photos 1, 2 and 5 are lens reflections, so they are not modeled as facade lights.

## Exterior changes

- Replace the short ground glass strips with a continuous lime-backed wire-mesh bicycle cage along the east wall, returning at both corners. Fine mesh, posts, fluorescent fixtures, parked bicycle silhouettes, a utility door and the north `grau` wordmark distinguish it from a glazed room.
- Add the south recessed service porch beside the cage, with lime columns and separate gray and glazed service openings.
- Replace the generic north staircase depiction with five horizontal open galleries. Pale slabs and soffits, dark vertical rails, rear openings and small cool fixtures match the frontal photograph. No exposed diagonal stair flight crosses the elevation.
- Model the main entrance in its existing central north source band, directly beneath the address sign. The tall blue-tinted entrance door is separate from the bicycle gate and south service doors.
- Refine all five corner loggias: NW at floor 1; SW at floors 2 and 5; SE at floor 3; NE at floor 4. Each cuts both exterior planes and has a lime fascia/soffit, support column and open picket rails.
- Register separate exterior window rows for east, south and west, preserving the blank north wings and blank southeast portions of the east facade. The east rows include the photographed closer final pair on floors 2 and 4.
- Apply the existing photographic timber weathering to all four Grau elevations and add clipped dark horizontal flashings. Roof dimensions and the existing roof appearance study remain unchanged.

The east window centers are fractions read from planar rectification of photos 1/2 and checked against photo 5. The south and portions of the west are obscured by trees or cropped near the roof; those centers remain estimates. Dark shutters are retained as openings. This is a closer exterior reconstruction, not a measured survey or a claim of verified apartment counts.

The model retains the official size. Recess depths, column sections, rail spacing, door details and bike positions are visual estimates within that envelope. The bicycle count is illustrative. No resident photographs or interiors are bundled.

## Review and preservation

Reviewed renders: [four daylight elevations](../screenshots/house-55a-grau/grau-exterior-four-elevations.webp), [four night corner views](../screenshots/house-55a-grau/grau-exterior-four-corners-night.webp), [entrance and bicycle cage](../screenshots/house-55a-grau/grau-entrance-and-bicycle-cage.webp). All eight viewing directions were rendered in both themes with no browser errors. The [browser receipt](../evidence/grau-exterior-browser.json) records the cameras; the exterior harness omits provisional apartment furnishing to isolate the facade review.

The [complete app check](../evidence/grau-exterior-app-browser.json) covers all six Grau floors on desktop (1440 px) and phone (390 px), day/night switching and fold/unfold controls with the existing apartment studies loaded. No browser errors or horizontal overflow were found. The full automated suite and production build pass.

The automated [Grau checks](../../tests/grau-photo-details.test.mjs) verify real generated geometry: all requested window centers survive cutouts, split south surfaces form one row, both sides of each balcony open on the correct floor, north has five landings over its entrance, signage faces outward, and all geometry remains attached to the existing footprint. Window ray tests check that visible recessed openings remain selectable.

The reproducible [preservation audit](../../scripts/check-grau-preservation.mjs) compares the result with its integration base, `9052cc6`, including the concurrent Black exterior update. It verifies protected source data and interior generators, every dorm's placement and floor geometry, all eleven interior scene meshes, and all ten other dorm exterior outputs in both themes.

The [preservation receipt](../evidence/grau-exterior-preservation.json) passes for all protected files, all eleven dorm interiors/dimensions and the other ten exteriors. Eight Grau geometry tests pass, including 87 window picking rays.

```sh
node --test tests/grau-photo-details.test.mjs
node scripts/check-grau-preservation.mjs 9052cc6 docs/evidence/grau-exterior-preservation.json
npm test
npm run build
```

Implementation: [main exterior](../../src/grau-photo-details.js), [bicycle cage and porch](../../src/grau-bicycle-details.js), [photo window rows](../../src/grau-window-layout.js).
