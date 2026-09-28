/** One-to-one onset matching. Times are source-relative seconds. */
export function scoreOnsets(detected, reference, toleranceMs) {
  const tolerance = toleranceMs / 1000;
  const predictions = [...detected].sort((a, b) => a - b);
  const truth = [...reference].sort((a, b) => a - b);
  const errors = [], falsePositive = [], missed = [];
  let i = 0, j = 0;
  while (i < predictions.length && j < truth.length) {
    const delta = predictions[i] - truth[j];
    if (Math.abs(delta) <= tolerance) {
      errors.push(Math.abs(delta) * 1000); i++; j++;
    } else if (delta < 0) falsePositive.push(predictions[i++]);
    else missed.push(truth[j++]);
  }
  falsePositive.push(...predictions.slice(i));
  missed.push(...truth.slice(j));
  const tp = errors.length, precision = tp / Math.max(1, predictions.length);
  const recall = tp / Math.max(1, truth.length);
  const sorted = errors.sort((a, b) => a - b);
  return {
    tp, falsePositive: falsePositive.length, missed: missed.length,
    precision, recall, f1: 2 * precision * recall / Math.max(1e-9, precision + recall),
    meanErrorMs: sorted.reduce((sum, value) => sum + value, 0) / Math.max(1, tp),
    medianErrorMs: sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null,
    p95ErrorMs: sorted.length ? sorted[Math.ceil(sorted.length * .95) - 1] : null,
    falsePositiveSeconds: falsePositive, missedSeconds: missed,
  };
}

export function familyMacroF1(rows, families, field = 'f1') {
  const values = families.map(family => {
    const items = rows.filter(row => row.family === family);
    if (!items.length) throw Error(`No benchmark files for ${family}`);
    return items.reduce((sum, row) => sum + row[field], 0) / items.length;
  });
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function chooseSettings(settings, rowsFor, trainingFamilies, defaults) {
  const ranked = settings.map(setting => ({
    setting,
    score: familyMacroF1(rowsFor(setting), trainingFamilies),
    distance: Math.abs(setting.sensitivity - defaults.sensitivity) + Math.abs(setting.minGapMs - defaults.minGapMs) / 100,
  })).sort((a, b) => b.score - a.score || a.distance - b.distance || a.setting.sensitivity - b.setting.sensitivity || a.setting.minGapMs - b.setting.minGapMs);
  return ranked[0];
}
