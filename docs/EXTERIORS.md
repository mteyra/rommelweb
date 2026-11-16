# Exteriors: building meshes, façades and windows

Read this before changing how any building looks from outside. It replaces the per-house photo studies, which are kept in [`archive/`](archive/) as history.

## Rules

1. **The official shell never changes.** `public/data/lod2.json` (Bavarian LoD2 survey, 11 buildings, 289 surfaces) is the truth for footprint, height, roof and position. Never edit, move or rescale it.
2. **Everything else is display geometry.** Façade lines, windows, balconies, entrances and bicycle cages are drawn on top of the shell. A recess is cut from a display copy of a source face (`src/exterior-presentation.js`), never from the source itself.
3. **Exterior work never touches interiors.** Changing an exterior must leave every file in `public/data/` byte-identical, including floor sections and floor plans. See [INTERIORS.md](INTERIORS.md).
4. **Photos give relative placement, not measurements.** Counts, order and rough proportions come from resident photographs. Depths, widths, hidden faces and roof equipment are estimates. Record that in each feature's `evidence` text, and never claim an accuracy percentage.
5. **Storey counts are fixed** (`campus.json` → `levels`). A photo never changes how many floors a house has.

## Houses

| House | Name in data | Campus | Storeys | Exterior code | Photos used |
| --- | --- | --- | --- | --- | --- |
| 49 | Black house | II | 6 | `black-house-photo-details.js` | 6 |
| 51 | Yellow house | I | 3 | `house51-photo-details.js` | 3 |
| 51a | Blue house | II | 3 | `blue-courtyard-photo-details.js` | 7 |
| 53 | Orange house | I | 3 | `house53-photo-details.js` | 3 |
| 53a | Purple house (called **Lila**) | II | 5 | `lila-photo-details.js`, `lila-window-layout.js` | 8 |
| 55 | Red house | I | 3 | `house55-entrance.js`, `house55-window-alignment.js`, plus rear glazing and roof window in `exterior-details.js` | 3 |
| 55a | Grey house (called **Grau**) | II | 6 | `grau-photo-details.js`, `grau-window-layout.js`, `grau-bicycle-details.js` | 7 |
| 57 | White house | I | 3 | `white-house-photo-details.js`, `white-house-bicycle-details.js` | 7 |
| 57a | Turquoise house | II | 8 | `turquoise-photo-details.js`, `turquoise-window-layout.js` | 4 |
| 59 | Green house | I | 3 | none yet; generic older-house façade only | 0 |
| 59a | Pink house | II | 6 | `pink-house-photo-details.js`, `pink-bicycle-details.js` | 4 |

The **older houses** (Campus Süd I) have reddish-brown horizontal plate cladding, colored window frames per house and three aligned window rows. The **newer houses** (Campus Süd II) have vertical larch boarding, narrow windows, colored corner loggias, open galleries and bicycle cages. House colors are in `campus.json` → `color`, and the older-house frame paint is in `windows.js` → `OLD_WINDOW_COLORS`.

## Coordinates and source data

- Metres; **x east, y up, z south**. `y` = source NHN altitude − 289.589 m, so relative base heights are real.
- `lod2.json` → `buildings[]`: `{number, height, baseY, surfaces[], groundPolygons}`. Each surface is `{type: WallSurface | RoofSurface | GroundSurface, points, holes, id}`.
- **A surface's index in `surfaces[]` is its permanent ID.** House modules address walls by index (for example, Lila east = surfaces 9, 4, 1, 3).
- `campus.json`: names, colors, campus, storey count, OSM footprints, and the context paths drawn around the houses.

To find a wall, print each surface's index, type and centroid:

```sh
node -e "const b=require('./public/data/lod2.json').buildings.find(b=>b.number==='57');b.surfaces.forEach((s,i)=>{const p=s.points.slice(0,-1),c=[0,1,2].map(k=>p.reduce((a,q)=>a+q[k],0)/p.length);console.log(i,s.type,c.map(v=>v.toFixed(1)).join(','))})"
```

## How an exterior is drawn

`CampusScene.makeBuilding()` in `src/scene.js` builds each house in this order:

1. **Source surfaces**, through `presentExteriorSurface()`, which cuts any masked recesses from a display copy.
2. **Façade lines** (`src/facade.js`), using `FACADE_PROFILES.timber` (newer) or `.plates` (older), with seams clipped to each wall.
3. **Windows** (`src/windows.js`), using `WINDOW_PROFILE` (newer) or `OLD_WINDOW_PROFILE` (older). Per-house corrections go in `getWindowProfile()`. Photographed rows replace the generic rows through `output.layoutsBySurface`.
4. **Photo details**: `createExteriorDetails(building)` in `src/exterior-details.js` calls the house's module and returns:
   ```
   { exclusionsBySurface,  // source-face regions to hide (recesses)
     layoutsBySurface,     // photographed window rows per wall
     triangleLayers,       // { materialRole: [flat xyz triangles] }
     segmentLayers,        // { materialRole: [[a, b], ...] } lines
     features }            // [{ id, kind, floor, sourceSurfaceIndices, evidence }]
   ```
5. **Materials**: each layer key is a material role, such as `detailMetal`, `detailGlazing`, `detailRecess`, `detailConcrete`, `detailLime` or a house-specific one like `detailPinkGalleryWall`. Day and night colors for every role are in `SCENE_THEMES` at the top of `src/scene.js`. A new role needs a color in both themes.

## Adding or refining a house

1. **Register the photos.** Decide which source wall each photo shows (index + corners). Note which rows and openings are visible; unseen rows stay generic.
2. **Write the module** `src/<house>-photo-details.js`:
   ```js
   export function addXPhotoDetails({building, base, rows, highest, output, helpers}) {
     const {face, facePoint, faceMask, wall, quad, line, box, railing, faceGlazing,
            cornerLoggia, photographicRows, atY, add, sub, lerp} = helpers;
     const east = face([9, 4], cornerA, cornerB);   // surface indices + outside corners, start → end
     faceMask(east, left, right, bottom, top);      // hide that part of the source face (a recess)
     box('detailMetal', atY(facePoint(east, x, depth), y), east.u, east.inward, w, d, h);
     output.features.push({id, kind, sourceSurfaceIndices: east.indices, evidence: '…'});
   }
   ```
   - `rows` holds the absolute y of each floor. Leave them unchanged.
   - `face()` returns `{u, inward, span}`, measured along the outside from the start corner.
   - `photographicRows(surfaceIndex, start, end, {floor: [fractions]})` places the photographed windows.
3. **Register it** with one line in `createExteriorDetails()` in `src/exterior-details.js`: `if (house === 'X') addXPhotoDetails(photoContext);`.
4. **Test it** in `tests/<house>-photo-details.test.mjs`. Copy an existing one: they check that details stay on their faces, storeys and sources are unchanged, and features carry evidence.
5. **Optionally prove nothing else moved**: `scripts/check-<house>-preservation.mjs` rebuilds the release before your change and compares.
6. **Save screenshots** to `screenshots/house-<number>-<name>/`.

## Windows

### Newer-house windows

`WINDOW_PROFILE`: timber family, about 1.10 m wide, up to 2.55 m high, 3.40 m bay pitch with alternating 0.55 m offsets, starting on the first upper floor. Lila, Grau and Turquoise have exact photographed column positions per face (`*_WINDOW_FRACTIONS`); Blue keeps vertically aligned upper windows.

### Older-house windows

`OLD_WINDOW_PROFILE`: plate family, about **1.05 × 1.55 m with a 0.95 m sill**, 3.25 m bay pitch, three aligned rows including the ground floor. These sizes come from one typical-room sketch. Frame colors identify the house. House 55 has its own aligned window wall (`house55-window-alignment.js`).

Window openings are appearance only. They never imply a room behind them; the floor plans have their own `layoutWindows`.

## Accuracy and limits

| Supported by photos | Still estimated |
| --- | --- |
| Which faces have loggias, galleries, entrances, cages | Recess depths, rail heights, loggia widths |
| Window counts, order and relative position on photographed rows | Absolute opening sizes; rows on unphotographed faces |
| Entrance location, signs, glazing groups | Roof equipment positions and sizes |
| Material type and line rhythm | Exact board pitch, joint positions, weathering |

Each house's archived study (`archive/*-PHOTO-*.md`, `archive/*-EXTERIOR*.md`) records which photo matched which face, if that's needed again.

## Tests

```sh
node --test tests/exterior-*.test.mjs tests/facade.test.mjs tests/windows.test.mjs tests/<house>-photo-details.test.mjs
```

`tests/layout-exterior-reservations.test.mjs` checks that the newer-house floor plans still use their frozen copy of the exterior inputs.

## Screenshots

Exterior screenshots are in `screenshots/house-<number>-<name>/` (for example `house-53a-lila/lila-overview-day.webp`), with campus-wide views in `screenshots/exteriors-overview/`. The index is [screenshots/README.md](screenshots/README.md).
