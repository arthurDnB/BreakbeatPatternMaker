import { createHash } from 'node:crypto';
import { CHECKLIST_ITEMS, DEFAULT_CHECKLIST, baselineSession, checklistRequired, isChecklistComplete, newChecklist, requiredChecklistIds, reviewIdentityHash } from './break-review-sessions.mjs';

export const REVIEW_STATUSES = ['pending', 'accepted', 'rejected', 'uncertain'];

export function baselineHash(annotations) {
  return createHash('sha256').update(JSON.stringify(annotations.cases)).digest('hex');
}

// The server serves passages from a sessions manifest when one is configured, and the legacy annotations
// file otherwise. A fixed-mode session derives its eight two-second cases from `cases` unchanged.
export function sessionCases(annotations, { sessions, source = 'annotations' } = {}) {
  if (source === 'sessions' && Array.isArray(sessions)) return sessions.flatMap(session => session.passages);
  return annotations.cases.map(item => ({
    ...item,
    sessionId: 'baseline',
    passageId: item.id,
    mode: 'fixed',
    regionLengthSeconds: item.regionSeconds[1] - item.regionSeconds[0],
    referenceState: 'verified',
  }));
}

export function buildSessions(annotations, { sessions, source = 'annotations' } = {}) {
  if (source === 'sessions' && Array.isArray(sessions)) return sessions;
  const cases = sessionCases(annotations, { source });
  const mode = 'fixed';
  return [{
    id: 'baseline',
    label: 'Fixed two-second beats (verified benchmark)',
    mode,
    description: 'The existing eight two-second passages and their listener-verified labels.',
    checklist: [...DEFAULT_CHECKLIST],
    passages: cases,
  }];
}

// Drafts are scoped to one session at a time so switching sessions never overwrites another session's progress.
// With no sessionId the whole catalogue is in scope, which is the legacy single-session behaviour.
export function scopeCatalogue(catalogue, sessionId) {
  if (sessionId === undefined || sessionId === null) return catalogue;
  const scoped = catalogue.filter(item => item.sessionId === sessionId);
  if (!scoped.length) throw Error(`Unknown review session '${sessionId}'.`);
  return scoped;
}

export function initialReview(annotations, { blind = false, sessions, source = 'annotations', sessionId } = {}) {
  const catalogue = scopeCatalogue(sessionCases(annotations, { sessions, source }), sessionId);
  const first = catalogue[0] ?? {};
  return {
    version: 1,
    reviewMode: blind ? 'blind-second-review' : 'reference-review',
    // The legacy hash stays derived from the annotation cases so drafts written before the session model still
    // validate. Only the manifest path uses the identity hash, which ignores per-review fields.
    baselineHash: source !== 'sessions' ? baselineHash(annotations) : reviewIdentityHash(catalogue),
    sessionId: catalogue.some(item => item.sessionId === 'baseline') ? 'baseline' : first.sessionId,
    passageId: first.passageId ?? first.id,
    cases: catalogue.map(item => ({
      id: item.id, sessionId: item.sessionId, passageId: item.passageId, mode: item.mode,
      reviewed: false, listenedFull: false,
      // The first checklist item mirrors `listenedFull`, which the review tool has always set when a passage is
      // played through. Keeping them in step means a draft saved by the older tool stays valid.
      checklist: { ...newChecklist(), listenedFull: false },
      markers: blind ? [] : item.onsetsSeconds.map((time, index) => ({ id: `ref-${index}`, time, status: 'pending' })),
    })),
  };
}

function stripInternal(review) {
  const { _sessions, ...rest } = review;
  return rest;
}

function validateChecklist(item, mode) {
  if (item.checklist === undefined) return;
  if (typeof item.checklist !== 'object' || item.checklist === null || Array.isArray(item.checklist)) throw Error(`Invalid checklist in ${item.id}.`);
  for (const [key, value] of Object.entries(item.checklist)) {
    if (!CHECKLIST_ITEMS.some(known => known.id === key) || typeof value !== 'boolean') throw Error(`Invalid checklist in ${item.id}.`);
  }
  // `listenedFull` predates the checklist and stays authoritative for full listening, so the checklist follows
  // it rather than contradicting it. That keeps drafts written by the earlier tool valid.
  item.checklist.listenedFull = item.listenedFull;
  if (!item.reviewed || !checklistRequired(mode)) return;
  if (!isChecklistComplete({ checklist: DEFAULT_CHECKLIST }, item.checklist)) throw Error(`Finish the checklist in ${item.id} before marking it reviewed.`);
}

export function validateReview(review, annotations, { blind = false, sessions, source = 'annotations', sessionId } = {}) {
  // Session scoping exists only for manifest-driven sessions. The legacy annotations file always validates its
  // full eight cases against the legacy hash, so a sessionId carried in an old-style draft changes nothing.
  const scoped = source === 'sessions' && sessionId !== undefined ? sessionId : null;
  const catalogue = scopeCatalogue(sessionCases(annotations, { sessions, source }), scoped);
  const legacyScope = source !== 'sessions';
  const expectLegacyHash = source !== 'sessions';
  const hashMatches = expectLegacyHash ? review?.baselineHash === baselineHash(annotations) : review?.baselineHash === reviewIdentityHash(catalogue);
  if (review?.version !== 1 || !hashMatches || !Array.isArray(review.cases) || review.cases.length !== catalogue.length) {
    throw Error('Review draft does not match the current benchmark references.');
  }
  if (source === 'sessions') {
    const expectedSession = sessionId ?? catalogue[0]?.sessionId;
    if (review.sessionId !== undefined && review.sessionId !== expectedSession) throw Error(`Review draft belongs to session '${review.sessionId}', not '${expectedSession}'.`);
    if (catalogue.some(item => item.sessionId !== expectedSession)) throw Error('Review draft mixes passages from more than one session.');
  }
  if (blind && review.reviewMode !== 'blind-second-review' || !blind && review.reviewMode === 'blind-second-review') throw Error('Review draft mode does not match this reviewer. Use the separate blind second-review draft.');
  const expected = new Map(catalogue.map(item => [item.id, item]));
  const seen = new Set();
  for (const item of review.cases) {
    const sourceCase = expected.get(item.id);
    if (!sourceCase || seen.has(item.id) || typeof item.reviewed !== 'boolean' || typeof item.listenedFull !== 'boolean' || !Array.isArray(item.markers) || item.markers.length > 120) throw Error('Invalid review case.');
    seen.add(item.id);
    if (item.sessionId !== undefined && item.sessionId !== sourceCase.sessionId) throw Error(`Review case ${item.id} belongs to a different session.`);
    if (item.mode !== undefined && item.mode !== sourceCase.mode) throw Error(`Review case ${item.id} has a stale mode.`);
    validateChecklist(item, sourceCase.mode);
    const markerIds = new Set();
    for (const marker of item.markers) {
      if (typeof marker.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(marker.id) || markerIds.has(marker.id) || !Number.isFinite(marker.time) || marker.time <= sourceCase.regionSeconds[0] || marker.time >= sourceCase.regionSeconds[1] || !REVIEW_STATUSES.includes(marker.status)) throw Error(`Invalid marker in ${item.id}.`);
      markerIds.add(marker.id);
    }
    const accepted = item.markers.filter(marker => marker.status === 'accepted').sort((a, b) => a.time - b.time);
    if (accepted.some((marker, index) => index && marker.time - accepted[index - 1].time < .005)) throw Error(`Accepted markers are too close in ${item.id}.`);
    if (item.reviewed && (!item.listenedFull || !accepted.length || item.markers.some(marker => marker.status === 'pending' || marker.status === 'uncertain'))) throw Error(`Finish listening and deciding markers in ${item.id} before marking it reviewed.`);
  }
  if (source === 'sessions' && review.passageId !== undefined && !catalogue.some(item => item.passageId === review.passageId)) throw Error('Review draft names a passage outside its session.');
  if (legacyScope && review.sessionId !== undefined && !catalogue.some(item => item.sessionId === review.sessionId)) throw Error('Review draft names an unknown session.');
  if (legacyScope && review.passageId !== undefined && !catalogue.some(item => item.passageId === review.passageId)) throw Error('Review draft names an unknown passage.');
  return structuredClone(stripInternal(review));
}

export function verifiedAnnotations(review, annotations, { reviewer = 'primary-listener', sessions, source = 'annotations', sessionId } = {}) {
  // The scope is the caller's explicit sessionId. A legacy (manifest-free) call has no session scope at all:
  // inferring one from `review.sessionId` would hand the legacy eight cases to the manifest identity hash.
  const scope = sessionId;
  const scoped = scopeCatalogue(sessionCases(annotations, { sessions, source }), scope);
  const valid = validateReview(stripInternal(review), annotations, { blind: reviewer === 'independent-blind-listener', sessions, source, sessionId: scope });
  if (valid.cases.some(item => !item.reviewed)) throw Error(`Review all ${scoped.length} passages before exporting verified labels.`);
  const byId = new Map(valid.cases.map(item => [item.id, item]));
  // The export carries the reviewed passages of this session only. Labels from other sessions and from other
  // reviewers are never merged in: a blind second review exports exactly what the second listener entered.
  return {
    ...annotations,
    annotationMethod: reviewer === 'independent-blind-listener'
      ? 'Independent blind second-listener onset references from the local Break Review tool; labels were entered without access to the first review.'
      : 'Listener-reviewed onset references from the local Break Review tool; each passage was played in full and every retained marker was accepted by the reviewer.',
    reviewer,
    reviewComplete: true,
    sessionId: scope ?? annotations.cases[0]?.sessionId,
    reviewedAt: new Date().toISOString(),
    cases: scoped.map(item => ({
      id: item.id, family: item.family, filename: item.filename, sha256: item.sha256,
      sessionId: item.sessionId, passageId: item.passageId, mode: item.mode,
      regionSeconds: [...item.regionSeconds],
      onsetsSeconds: (byId.get(item.id)?.markers ?? []).filter(marker => marker.status === 'accepted').map(marker => Number(marker.time.toFixed(5))).sort((a, b) => a - b),
    })),
  };
}

export function sessionSummaries(review, { sessions, source = 'annotations', annotations } = {}) {
  const catalogue = source === 'sessions' && Array.isArray(sessions) ? sessions : buildSessions(annotations, { source });
  return catalogue.map(session => {
    const ids = new Set(session.passages.map(passage => passage.id));
    const states = review.cases.filter(item => ids.has(item.id));
    return {
      id: session.id, label: session.label, mode: session.mode, description: session.description,
      exportName: session.exportName, checklist: [...requiredChecklistIds(session)],
      reviewedPassages: states.filter(item => item.reviewed).length, passages: session.passages.length,
    };
  });
}

export function normalizeReviewRequest(body, annotations, { sessions, source = 'annotations' } = {}) {
  if (source !== 'sessions' || !Array.isArray(sessions) || !Array.isArray(body?.cases)) return body;
  const byId = new Map(sessions.flatMap(session => session.passages).map(passage => [passage.id, passage]));
  return {
    ...body,
    cases: body.cases.map(item => {
      const passage = byId.get(item.id);
      return passage ? { ...item, sessionId: passage.sessionId, passageId: item.passageId ?? item.id, mode: passage.mode } : item;
    }),
  };
}

export function selectSessionExport(review, { sessions, source = 'annotations', annotations, sessionId } = {}) {
  const catalogue = source === 'sessions' && Array.isArray(sessions) ? sessions : buildSessions(annotations, { source });
  const session = catalogue.find(candidate => candidate.id === sessionId) ?? baselineSession(catalogue);
  const ids = new Set(session.passages.map(passage => passage.id));
  const states = review.cases.filter(item => ids.has(item.id));
  return {
    session,
    cases: session.passages.map(passage => passage.id),
    reviewed: states.length > 0 && states.every(item => item.reviewed),
    label: session.mode === 'loop' ? 'Listened to the full loop' : 'Listened to the full passage',
  };
}
