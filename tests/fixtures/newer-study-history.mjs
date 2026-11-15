// Dated older-house receipts precede the separate Campus II study layer.
// Use this reconstruction only for those receipt assertions, never for live
// generator inputs or current geometry-preservation comparisons.
export function withoutNewerStudies(studies) {
  const historical = structuredClone(studies);
  for (const house of ['49', '51a', '53a', '55a', '57a', '59a']) {
    delete historical.buildings[house];
  }
  return historical;
}
