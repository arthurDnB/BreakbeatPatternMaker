function scoreCase(a, b, toleranceMs) {
  const reference = a.onsetsSeconds, candidate = b.onsetsSeconds;
  const rightUsed = new Set(), errors = [], missed = [];
  for (const time of reference) {
    let best = -1, distance = Infinity;
    for (let index = 0; index < candidate.length; index++) {
      if (rightUsed.has(index)) continue;
      const delta = Math.abs(time - candidate[index]);
      if (delta <= toleranceMs / 1000 && delta < distance) { best = index; distance = delta; }
    }
    if (best < 0) missed.push(time);
    else { rightUsed.add(best); errors.push(distance * 1000); }
  }
  const extra = candidate.filter((_, index) => !rightUsed.has(index));
  const precision = candidate.length ? errors.length / candidate.length : 0;
  const recall = reference.length ? errors.length / reference.length : 0;
  const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 1;
  const sortedErrors = [...errors].sort((x, y) => x - y);
  return { referenceCount: reference.length, candidateCount: candidate.length, matched: errors.length, missed, extra, precision, recall, f1,
    meanAbsoluteTimingErrorMs: errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : null,
    p95AbsoluteTimingErrorMs: sortedErrors.length ? sortedErrors[Math.min(sortedErrors.length - 1, Math.ceil(sortedErrors.length * .95) - 1)] : null };
}

export function compareReviews(first, second, tolerancesMs = [5, 10, 20]) {
  if (first?.reviewComplete !== true || second?.reviewComplete !== true) throw Error('Both review files must be marked complete.');
  const bySecond = new Map(second.cases?.map(item => [item.id, item]));
  if (!Array.isArray(first.cases) || first.cases.length !== 8 || bySecond.size !== 8) throw Error('Expected eight recordings in each review.');
  const files = first.cases.map(a => {
    const b = bySecond.get(a.id);
    if (!b || a.family !== b.family || a.sha256 !== b.sha256 || JSON.stringify(a.regionSeconds) !== JSON.stringify(b.regionSeconds)) throw Error(`Review source mismatch for ${a.id}.`);
    return { id: a.id, family: a.family, filename: a.filename, firstCount: a.onsetsSeconds.length, secondCount: b.onsetsSeconds.length,
      tolerances: Object.fromEntries(tolerancesMs.map(ms => [ms, scoreCase(a, b, ms)])) };
  });
  const summary = Object.fromEntries(tolerancesMs.map(ms => {
    const scores = files.map(file => file.tolerances[ms]);
    const matched = scores.reduce((sum, score) => sum + score.matched, 0), firstCount = scores.reduce((sum, score) => sum + score.referenceCount, 0), secondCount = scores.reduce((sum, score) => sum + score.candidateCount, 0);
    const precision = secondCount ? matched / secondCount : 0, recall = firstCount ? matched / firstCount : 0;
    const familyGroups = new Map();
    for (const file of files) { const group = familyGroups.get(file.family) ?? []; group.push(file.tolerances[ms].f1); familyGroups.set(file.family, group); }
    const familyF1 = [...familyGroups.values()].map(group => group.reduce((sum, value) => sum + value, 0) / group.length);
    return [ms, { matched, firstCount, secondCount, precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 1,
      familyMacroF1: familyF1.reduce((sum, value) => sum + value, 0) / familyF1.length }];
  }));
  return { reportType: 'inter-reviewer-onset-agreement', generatedAt: new Date().toISOString(), firstReviewer: first.reviewer ?? 'first-review', secondReviewer: second.reviewer ?? 'second-review',
    interpretation: 'Agreement between two human onset annotations on the same audio, not detector accuracy or proof of industry-standard performance.', summary, files };
}
