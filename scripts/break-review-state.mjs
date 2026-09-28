import { createHash } from 'node:crypto';

export const REVIEW_STATUSES = ['pending', 'accepted', 'rejected', 'uncertain'];

export function baselineHash(annotations) {
  return createHash('sha256').update(JSON.stringify(annotations.cases)).digest('hex');
}

export function initialReview(annotations) {
  return {
    version: 1,
    baselineHash: baselineHash(annotations),
    cases: annotations.cases.map(item => ({
      id: item.id, reviewed: false, listenedFull: false,
      markers: item.onsetsSeconds.map((time, index) => ({ id: `ref-${index}`, time, status: 'pending' })),
    })),
  };
}

export function validateReview(review, annotations) {
  if (review?.version !== 1 || review.baselineHash !== baselineHash(annotations) || !Array.isArray(review.cases) || review.cases.length !== annotations.cases.length) {
    throw Error('Review draft does not match the current benchmark references.');
  }
  const expected = new Map(annotations.cases.map(item => [item.id, item]));
  const seen = new Set();
  for (const item of review.cases) {
    const source = expected.get(item.id);
    if (!source || seen.has(item.id) || typeof item.reviewed !== 'boolean' || typeof item.listenedFull !== 'boolean' || !Array.isArray(item.markers) || item.markers.length > 120) throw Error('Invalid review case.');
    seen.add(item.id);
    const markerIds = new Set();
    for (const marker of item.markers) {
      if (typeof marker.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(marker.id) || markerIds.has(marker.id) || !Number.isFinite(marker.time) || marker.time <= source.regionSeconds[0] || marker.time >= source.regionSeconds[1] || !REVIEW_STATUSES.includes(marker.status)) throw Error(`Invalid marker in ${item.id}.`);
      markerIds.add(marker.id);
    }
    const accepted = item.markers.filter(marker => marker.status === 'accepted').sort((a, b) => a.time - b.time);
    if (accepted.some((marker, index) => index && marker.time - accepted[index - 1].time < .005)) throw Error(`Accepted markers are too close in ${item.id}.`);
    if (item.reviewed && (!item.listenedFull || !accepted.length || item.markers.some(marker => marker.status === 'pending' || marker.status === 'uncertain'))) throw Error(`Finish listening and deciding markers in ${item.id} before marking it reviewed.`);
  }
  return structuredClone(review);
}

export function verifiedAnnotations(review, annotations) {
  const valid = validateReview(review, annotations);
  if (valid.cases.some(item => !item.reviewed)) throw Error('Review all eight passages before exporting verified labels.');
  const byId = new Map(valid.cases.map(item => [item.id, item]));
  return {
    ...annotations,
    annotationMethod: 'Listener-reviewed onset references from the local Break Review tool; each passage was played in full and every retained marker was accepted by the reviewer.',
    reviewComplete: true,
    reviewedAt: new Date().toISOString(),
    cases: annotations.cases.map(item => ({
      ...item,
      onsetsSeconds: byId.get(item.id).markers.filter(marker => marker.status === 'accepted').map(marker => Number(marker.time.toFixed(5))).sort((a, b) => a - b),
    })),
  };
}
