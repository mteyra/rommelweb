// Release receipts list the files a task left untouched, with their hashes.
// Tests re-check those hashes so later work can't silently change accepted
// data, source annotations or code.
//
// frozenFile(path) says where to read a recorded file today:
// - documentation and screenshots are not frozen (returns null): they get
//   moved, rewritten and re-rendered as the project is documented;
// - files changed later for an approved reason are read from a dated copy
//   in tests/fixtures;
// - files moved into archive/ are read from there;
// - everything else is read from its own path.

import {existsSync} from 'node:fs';

// Exterior-only refinement, 16 November 2026.
const EXTERIOR_BEFORE_20261116 = ['src/exterior-details.js', 'src/facade.js', 'src/windows.js', 'src/scene.js'];

// Documentation links in the standalone House 55 pages, November 2026.
const BEFORE_DOCS_REORGANIZATION = ['public/house55-layout/index.html', 'public/house55-study/index.html'];

// Old interior stages archived, November 2026: these current files dropped
// their calls into the archived old-stage scripts.
const BEFORE_OLD_STAGE_ARCHIVE = [
  'package.json',
  'scripts/house51-first-floor-layout.mjs', 'scripts/house51-ground-floor-layout.mjs',
  'scripts/house51-top-floor-layout.mjs', 'scripts/house53-module-layouts.mjs',
  'scripts/house57-module-layout.mjs', 'scripts/house59-module-layout.mjs',
  'tests/house51-first-floor-layout.test.mjs', 'tests/house51-ground-floor-layout.test.mjs',
  'tests/house51-top-floor-layout.test.mjs', 'tests/house53-module-layouts.test.mjs',
  'tests/house57-module-layout.test.mjs', 'tests/house59-module-layout.test.mjs',
  'tests/house55-exterior-refinement.test.mjs',
];

// Stylesheet split into src/styles/, November 2026: the original single
// file is kept as a dated copy.
const BEFORE_STYLE_SPLIT = ['src/styles.css'];

const root = new URL('../', import.meta.url);

export function frozenFile(path) {
  if (path === 'README.md' || /^docs\/.*\.(md|yaml|png|webp|svg)$/.test(path)) return null;
  if (BEFORE_DOCS_REORGANIZATION.includes(path)) {
    return `tests/fixtures/before-docs-reorganization/${path.replaceAll('/', '_')}.txt`;
  }
  if (EXTERIOR_BEFORE_20261116.includes(path)) {
    return `tests/fixtures/exterior-before-20261116/${path.slice(4)}.txt`;
  }
  if (BEFORE_STYLE_SPLIT.includes(path)) return 'tests/fixtures/before-style-split/styles.css.txt';
  if (BEFORE_OLD_STAGE_ARCHIVE.includes(path)) {
    return `tests/fixtures/before-old-stage-archive/${path.replaceAll('/', '_')}.txt`;
  }
  if (!existsSync(new URL(path, root)) && existsSync(new URL(`archive/${path}`, root))) return `archive/${path}`;
  return path;
}
