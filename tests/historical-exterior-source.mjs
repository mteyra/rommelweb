// Dated release receipts retain their original hashes after an authorized
// exterior-only refinement. Geometry/data assertions still read live inputs.
export function historicalExteriorSource(path) {
  return ['src/exterior-details.js', 'src/facade.js', 'src/windows.js', 'src/scene.js'].includes(path)
    ? `tests/fixtures/exterior-before-20261116/${path.slice(4)}.txt` : path;
}
