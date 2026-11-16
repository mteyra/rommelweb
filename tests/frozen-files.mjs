// Release receipts list the files a task left untouched, with their hashes.
// Tests re-check those hashes so later work can't silently change accepted
// data, source annotations or code.
//
// frozenFile(path) says where to read a recorded file today:
// - documentation and screenshots are not frozen (returns null): they get
//   moved, rewritten and re-rendered as the project is documented;
// - files changed later for an approved reason are read from a dated copy
//   in tests/fixtures;
// - everything else is read from its own path.

// Exterior-only refinement, 16 November 2026.
const EXTERIOR_BEFORE_20261116 = ['src/exterior-details.js', 'src/facade.js', 'src/windows.js', 'src/scene.js'];

// Documentation links in the standalone House 55 pages, November 2026.
const BEFORE_DOCS_REORGANIZATION = ['public/house55-layout/index.html', 'public/house55-study/index.html'];

export function frozenFile(path) {
  if (path === 'README.md' || /^docs\/.*\.(md|yaml|png|webp|svg)$/.test(path)) return null;
  if (BEFORE_DOCS_REORGANIZATION.includes(path)) {
    return `tests/fixtures/before-docs-reorganization/${path.replaceAll('/', '_')}.txt`;
  }
  if (EXTERIOR_BEFORE_20261116.includes(path)) {
    return `tests/fixtures/exterior-before-20261116/${path.slice(4)}.txt`;
  }
  return path;
}
