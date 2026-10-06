const element = id => document.getElementById(id);
const colors = { pending: '#e6ac53', accepted: '#4be3a1', rejected: '#71828a', uncertain: '#a68aea' };
const CHECKLIST_LABELS = { listenedFull: 'Listened to the full loop', firstHitChecked: 'Checked the first hit', lastHitChecked: 'Checked the last hit / tail' };
// The checklist is recorded for every passage but only gates the review step on longer and full-loop passages,
// so the fixed two-second session keeps the flow documented in docs/VERIFIED-BREAK-BENCHMARK.md.
const CHECKLIST_REQUIRED_MODES = ['long', 'loop'];
// Onset markers get a forgiving click target: a press within a few pixels either side of a marker selects it
// instead of seeking, and the same slop decides whether a paused click resumes rather than scrubs.
const MARKER_HIT_SLOP_PX = 18;
const STATUS_LABELS = { pending: 'Unchecked', accepted: 'Keep', rejected: 'Reject', uncertain: 'Unsure' };
// Only genuine typing fields swallow the keyboard map. Checkboxes, ranges, selects and buttons keep the keys
// that belong to them (see the keydown handler).
const TEXT_ENTRY_TYPES = ['text', 'search', 'email', 'url', 'tel', 'password', 'number', 'date', 'datetime-local', 'month', 'week', 'time'];
const KEYBOARD_OWNED_TYPES = ['checkbox', 'radio', 'button', 'submit', 'reset'];
let catalogue, review, sessions, sessionId, exportName, activeId, selectedId, cursorTime = 1, zoomFactor = 1, viewCenter = 1;
let audioContext, playback, saving = Promise.resolve(), saveFailed = false, pointerDrag, loopEnabled = false;
// pausedAt remembers where the playhead stopped so the next click near it resumes instead of scrubbing.
// selectionEpoch counts the owner's own passage picks so a pending auto-advance can never override one.
let pausedAt, hoveredMarkerId, autoAdvance = true, selectionEpoch = 0, progressDone = 0, progressTotal = 0;
const buffers = new Map();
const canvas = element('waveform');
const painter = canvas.getContext('2d');

function activeCase() { return catalogue.find(item => item.id === activeId); }
function activeReview() { return review.cases.find(item => item.id === activeId); }
function activeSession() { return (sessions ?? []).find(item => item.id === sessionId); }
function sessionCases() { const ids = new Set(review.cases.map(item => item.id)); return catalogue.filter(item => ids.has(item.id)); }
function checklistNeeded() { return CHECKLIST_REQUIRED_MODES.includes(activeReview()?.mode); }
function checklistItems() {
  const state = activeReview();
  const declared = activeSession()?.checklist ?? [];
  const ids = declared.filter(id => CHECKLIST_LABELS[id]).length ? declared.filter(id => CHECKLIST_LABELS[id]) : Object.keys(CHECKLIST_LABELS);
  return ids.map(id => ({ id, label: CHECKLIST_LABELS[id], checked: Boolean(state?.checklist?.[id]) }));
}
function checklistComplete() { return checklistItems().every(item => item.checked); }
function selected() { return activeReview()?.markers.find(marker => marker.id === selectedId); }
function markersInTimeOrder() { return [...activeReview().markers].sort((a, b) => a.time - b.time); }
function statusLabel(status) { return STATUS_LABELS[status] ?? status; }
function nearestMarkerTo(time) {
  return markersInTimeOrder().reduce((best, marker) => !best || Math.abs(marker.time - time) < Math.abs(best.time - time) ? marker : best, null);
}
function nearestVisibleMarker(time) {
  const [start, end] = viewRange();
  return markersInTimeOrder()
    .filter(marker => marker.time >= start && marker.time <= end)
    .reduce((best, marker) => !best || Math.abs(marker.time - time) < Math.abs(best.time - time) ? marker : best, null);
}
// A/R act on the selected marker, or on the one nearest the cursor when nothing is selected yet.
function targetMarker() { return selected() ?? nearestMarkerTo(cursorTime); }
function markerSlopSeconds() {
  const [start, end] = viewRange();
  return (end - start) * MARKER_HIT_SLOP_PX / Math.max(1, canvas.getBoundingClientRect().width);
}
function setStatusText(id, text) {
  const target = element(id);
  if (target && target.textContent !== text) target.textContent = text;
}
function renderPlaybackState() {
  setStatusText('playback-state', playback ? 'Playing' : pausedAt !== undefined ? 'Paused' : 'Stopped');
  element('playback-state')?.classList.toggle('active', Boolean(playback));
}
function setSaveMessage(message, isError = false) {
  const target = element('save-state');
  target.textContent = message;
  target.classList.toggle('error', isError);
}
function save() {
  const snapshot = structuredClone(review);
  setSaveMessage('Saving review…');
  saving = saving.then(async () => {
    const response = await fetch('/api/draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(snapshot) });
    const result = await response.json();
    if (!response.ok) throw Error(result.error ?? 'Unable to save review.');
    saveFailed = false;
    setSaveMessage('Saved locally');
  }).catch(error => { saveFailed = true; setSaveMessage(error.message, true); });
  return saving;
}
function change(affectsReview = true) {
  if (affectsReview) activeReview().reviewed = false;
  render();
  void save();
}

function renderSessions() {
  const select = element('session-select');
  select.replaceChildren();
  for (const session of sessions ?? []) {
    const option = document.createElement('option');
    option.value = session.id;
    option.textContent = `${session.label} · ${session.mode} · ${session.passages ?? 0} passages`;
    option.selected = session.id === sessionId;
    select.append(option);
  }
  select.value = sessionId ?? '';
  const active = activeSession();
  element('session-detail').textContent = active
    ? `${active.mode.toUpperCase()} session${active.reviewed ? ' · all passages reviewed' : ''} · export ${active.exportName ?? ''}`
    : '';
}
function renderCases() {
  const container = element('case-list');
  container.replaceChildren();
  const scoped = sessionCases();
  let completed = 0;
  for (const item of scoped) {
    const state = review.cases.find(entry => entry.id === item.id);
    if (state.reviewed) completed++;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `case-button ${item.id === activeId ? 'active' : ''} ${state.reviewed ? 'complete' : ''}`;
    const title = document.createElement('span'); title.className = 'case-name'; title.textContent = item.filename;
    const badge = document.createElement('small'); badge.textContent = state.reviewed ? 'Reviewed' : `${state.markers.filter(marker => marker.status === 'pending' || marker.status === 'uncertain').length} open`;
    button.append(title, badge);
    button.onclick = () => { void selectCase(item.id); };
    container.append(button);
  }
  progressDone = completed; progressTotal = scoped.length;
  element('progress-count').textContent = `${completed} / ${scoped.length} reviewed`;
  element('export').disabled = completed !== scoped.length;
}
// Any passage the owner picks himself bumps the epoch, so an auto-advance that is still waiting its turn
// yields instead of dragging him off the passage he just chose.
async function selectCase(id) { selectionEpoch += 1; await switchCase(id); }
function renderChecklist() {
  const container = element('checklist');
  const state = activeReview();
  const items = checklistItems();
  container.replaceChildren();
  for (const item of items) {
    const label = document.createElement('label');
    label.className = `checklist-item ${item.checked ? 'checked' : ''}`;
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = `checklist-${item.id}`;
    box.checked = item.checked;
    box.onchange = () => {
      state.checklist = { ...(state.checklist ?? {}), [item.id]: box.checked };
      if (item.id === 'listenedFull') state.listenedFull = box.checked;
      if (!box.checked && state.reviewed) state.reviewed = false;
      change(false);
    };
    const text = document.createElement('span'); text.textContent = item.label;
    label.append(box, text);
    container.append(label);
  }
  const done = items.filter(item => item.checked).length;
  element('checklist-state').textContent = `${done} / ${items.length}${checklistNeeded() ? ' · required before review' : ' · optional for fixed passages'}`;
}
function renderMarkers() {
  const state = activeReview(), current = selected(), ordered = markersInTimeOrder();
  const list = element('marker-list');
  list.replaceChildren();
  for (const marker of ordered) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `marker-item ${marker.status} ${marker.id === selectedId ? 'selected' : ''}`;
    button.setAttribute('role', 'listitem');
    button.setAttribute('aria-label', `${marker.time.toFixed(3)} seconds, ${marker.status}`);
    button.innerHTML = `<span>${marker.time.toFixed(3)} s</span><span>${marker.status}</span>`;
    button.onclick = () => { selectedId = marker.id; cursorTime = marker.time; revealMarker(marker); render(); };
    button.ondblclick = () => { selectedId = marker.id; void playSelected(); };
    list.append(button);
  }
  const open = state.markers.filter(marker => marker.status === 'pending' || marker.status === 'uncertain').length;
  element('marker-count').textContent = `· ${state.markers.length} total · ${open} open`;
  element('selected-time').textContent = current ? `${current.time.toFixed(5)} s` : `${cursorTime.toFixed(5)} s cursor`;
  element('selected-status').textContent = current ? statusLabel(current.status) : 'Click a marker or add a hit';
  // One always-visible line that answers "where am I, what is selected, what did I decide, how far along am I".
  const position = ordered.findIndex(marker => marker.id === selectedId);
  setStatusText('selection-status', current
    ? `Marker ${position + 1} of ${ordered.length} · ${current.time.toFixed(5)} s · ${statusLabel(current.status)}`
    : `No marker selected · cursor ${cursorTime.toFixed(5)} s`);
  for (const id of ['accept', 'reject', 'uncertain', 'nudge-left', 'nudge-right', 'play-hit', 'play-context']) element(id).disabled = !current;
  element('accept-rest').disabled = !state.markers.some(marker => marker.status === 'pending');
  const checklistBlocked = checklistNeeded() && !checklistComplete();
  element('finish-clip').disabled = !state.listenedFull || open > 0 || !state.markers.some(marker => marker.status === 'accepted') || state.reviewed || checklistBlocked;
  element('finish-clip').textContent = state.reviewed ? 'Passage reviewed' : checklistBlocked ? 'Finish the checklist first' : 'Mark passage reviewed';
}
function render() {
  const item = activeCase(), state = activeReview();
  if (!item || !state) return;
  element('clip-family').textContent = item.family.toUpperCase();
  element('clip-title').textContent = item.filename;
  element('clip-detail').textContent = `${item.regionSeconds[0].toFixed(2)}–${item.regionSeconds[1].toFixed(2)} seconds · ${state.mode} passage · ${state.listenedFull ? 'Full passage played' : 'Play full passage to unlock review'}`;
  element('review-badge').textContent = state.reviewed ? 'Reviewed by ear' : 'Needs review';
  element('review-badge').classList.toggle('done', state.reviewed);
  renderSessions(); renderCases(); renderMarkers(); renderChecklist(); updateZoomControls(); renderPlaybackState(); drawWaveform();
}

function viewRange() {
  const [regionStart, regionEnd] = activeCase().regionSeconds;
  const duration = (regionEnd - regionStart) / zoomFactor;
  const start = Math.max(regionStart, Math.min(regionEnd - duration, viewCenter - duration / 2));
  return [start, start + duration];
}
function updateZoomControls() {
  if (!activeId) return;
  const [regionStart, regionEnd] = activeCase().regionSeconds;
  const [start, end] = viewRange();
  element('zoom-level').textContent = `${zoomFactor}×`;
  element('zoom-out').disabled = zoomFactor <= 1;
  element('zoom-in').disabled = zoomFactor >= 128;
  const pan = element('wave-pan');
  pan.disabled = zoomFactor <= 1;
  pan.value = String(Math.round((start - regionStart) / Math.max(.000001, regionEnd - regionStart - (end - start)) * 100));
}
function setZoom(factor, anchorTime = viewCenter, anchorRatio = .5) {
  zoomFactor = Math.max(1, Math.min(128, factor));
  const [regionStart, regionEnd] = activeCase().regionSeconds;
  const duration = (regionEnd - regionStart) / zoomFactor;
  const start = Math.max(regionStart, Math.min(regionEnd - duration, anchorTime - anchorRatio * duration));
  viewCenter = start + duration / 2;
  updateZoomControls(); drawWaveform();
}
function revealMarker(marker) {
  const [start, end] = viewRange();
  if (marker.time < start || marker.time > end) { viewCenter = marker.time; updateZoomControls(); }
}

async function ensureBuffer(id) {
  if (buffers.has(id)) return buffers.get(id);
  if (!audioContext) audioContext = new AudioContext();
  const response = await fetch(`/api/audio/${encodeURIComponent(id)}`);
  if (!response.ok) throw Error('Could not load this WAV.');
  const buffer = await audioContext.decodeAudioData(await response.arrayBuffer());
  buffers.set(id, buffer);
  return buffer;
}
async function switchCase(id) {
  // The active passage has to move before playback stops: stopPlayback() redraws the waveform from the active
  // review case, and a session switch has already replaced `review` with a case list that may not hold the
  // previous passage.
  activeId = id;
  pausedAt = undefined;
  hoveredMarkerId = undefined;
  stopPlayback();
  const state = activeReview();
  zoomFactor = 1;
  const [regionStart, regionEnd] = activeCase().regionSeconds;
  viewCenter = (regionStart + regionEnd) / 2;
  selectedId = state.markers.find(marker => marker.status === 'pending')?.id ?? state.markers[0]?.id;
  cursorTime = selected()?.time ?? activeCase().regionSeconds[0] + .5;
  render();
  try { await ensureBuffer(id); if (id === activeId) drawWaveform(); }
  catch (error) { setSaveMessage(error.message, true); }
}
async function loadSession(id) {
  const response = await fetch('/api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: id }) });
  const result = await response.json();
  if (!response.ok) throw Error(result.error ?? 'Could not switch review session.');
  const stateResponse = await fetch('/api/state');
  if (!stateResponse.ok) throw Error('Could not reload the review state.');
  applyState(await stateResponse.json());
  const next = review.cases.find(item => !item.reviewed)?.id ?? review.cases[0]?.id ?? catalogue[0]?.id;
  if (next) await selectCase(next);
}
function stopPlayback() {
  if (playback) {
    const previous = playback;
    playback = undefined;
    try { previous.source.stop(); } catch {}
  }
  updateLoopStatus(); updatePosition(); renderPlaybackState(); drawWaveform();
}
function playbackTime() {
  if (!playback) return undefined;
  return playback.offset + Math.max(0, audioContext.currentTime - playback.begun) * playback.speed;
}
function updateLoopStatus() {
  const target = element('loop-state');
  target.classList.toggle('active', loopEnabled);
  target.textContent = !loopEnabled ? 'Loop off' : playback?.loop ? `Looping · pass ${playback.pass}` : 'Loop on';
}
function updatePosition() {
  const target = element('play-position');
  const current = playbackTime(), item = activeCase();
  if (!item) { target.textContent = 'Position —'; return; }
  if (current === undefined) {
    // A paused playhead still has a position worth showing: it is what a click near it will resume.
    target.textContent = pausedAt !== undefined ? `Paused at ${pausedAt.toFixed(3)} / ${item.regionSeconds[1].toFixed(3)} s` : 'Position —';
    return;
  }
  const absolute = playback.windowStart + Math.min(current, playback.duration);
  target.textContent = `Position ${absolute.toFixed(3)} / ${item.regionSeconds[1].toFixed(3)} s`;
}
function armSource(entry) {
  const source = audioContext.createBufferSource();
  source.buffer = entry.buffer;
  source.playbackRate.value = entry.speed;
  source.connect(audioContext.destination);
  entry.source = source;
  entry.begun = audioContext.currentTime;
  entry.offset = 0;
  source.onended = () => { if (playback === entry) finishSource(entry); };
  source.start(0, entry.windowStart, entry.duration);
}
function markListenedFull() {
  // A finished pass is the evidence the checklist asks the reviewer to attest to, so record the full-listen item in
  // the passage's own checklist as well as the playback flag the transport and the finish gate read directly.
  const state = activeReview();
  state.listenedFull = true;
  state.checklist = { ...(state.checklist ?? {}), listenedFull: true };
}
function finishSource(entry) {
  // Full-passage listening is what unlocks the review step, so the first completed pass counts even while the
  // loop keeps repeating. Passages restart from their own start, never from the recording start.
  if (entry.loop && activeId === entry.id) {
    entry.pass += 1;
    markListenedFull();
    armSource(entry);
    updateLoopStatus(); updatePosition();
    change(false);
    return;
  }
  playback = undefined;
  if (entry.full && activeId === entry.id) { markListenedFull(); change(false); renderPlaybackState(); }
  else { updateLoopStatus(); updatePosition(); renderPlaybackState(); drawWaveform(); }
}
let playQueue = Promise.resolve();
function playWindow(start, end, full = false) {
  // Transport clicks are armed in order. Clicking Hit only and then Hit + context in quick succession used to
  // race on the buffer and context awaits, so the paired auditions could play in either order; queueing makes
  // each click audition immediately after the previous one is armed, and the last click is still the one heard.
  const queued = playQueue.then(() => armWindow(start, end, full));
  playQueue = queued.catch(() => {});
  return queued;
}
async function armWindow(start, end, full = false) {
  const id = activeId;
  try {
    const buffer = await ensureBuffer(id);
    if (id !== activeId) return;
    await audioContext.resume();
    stopPlayback();
    pausedAt = undefined;
    const speed = Number(element('speed').value);
    const entry = { id, buffer, speed, begun: audioContext.currentTime, offset: 0, duration: end - start, windowStart: start, full, loop: Boolean(full && loopEnabled), pass: 1 };
    playback = entry;
    armSource(entry);
    updateLoopStatus(); updatePosition(); renderPlaybackState();
    requestAnimationFrame(drawPlayhead);
  } catch (error) { setSaveMessage(error.message, true); }
}
function playFull() { const [start, end] = activeCase().regionSeconds; void playWindow(start, end, true); }
function playSelected(context = false) {
  const marker = selected(); if (!marker) return;
  const [start, end] = activeCase().regionSeconds;
  if (context) {
    void playWindow(Math.max(start, marker.time - .18), Math.min(end, marker.time + .32));
    return;
  }
  const next = activeReview().markers
    .filter(item => item.id !== marker.id && item.status !== 'rejected' && item.time > marker.time)
    .reduce((nearest, item) => Math.min(nearest, item.time), end);
  const hitStart = Math.max(start, marker.time - .006);
  const hitEnd = Math.min(end, marker.time + .35, next - .005);
  void playWindow(hitStart, Math.max(hitStart + .01, hitEnd));
}
function drawPlayhead() { if (playback) { updatePosition(); drawWaveform(); requestAnimationFrame(drawPlayhead); } }
// ---- Fast listening transport -------------------------------------------------------------------------------
// The whole point of the review page is listening, so one gesture has to start audio. These helpers keep the
// pointer and the keyboard reaching the same two verbs: play from a point, and stop. `pausedAt` is the bridge —
// it survives a pause so the next Space (or a click near the playhead) resumes instead of scrubbing.
function auditionFrom(time) {
  const [regionStart, regionEnd] = activeCase().regionSeconds;
  cursorTime = clampTime(time);
  // Keep a short audible tail when the pointer lands on the last pixel of the passage.
  void playWindow(Math.max(regionStart, Math.min(cursorTime, regionEnd - .05)), regionEnd, false);
}
function startAudition(time) { pausedAt = undefined; auditionFrom(time); }
function pausePlayback() {
  const current = playbackTime();
  if (current !== undefined && playback) pausedAt = clampTime(playback.windowStart + Math.min(current, playback.duration));
  stopPlayback();
  if (pausedAt !== undefined) cursorTime = pausedAt;
  render();
}
function togglePlayback() {
  if (!activeId) return;
  if (playback) { pausePlayback(); return; }
  startAudition(pausedAt ?? cursorTime);
}
function togglePlaybackAt(time) {
  if (!activeId) return;
  if (playback) { pausePlayback(); return; }
  // A click on the remembered playhead resumes it; a click anywhere else scrubs there and plays.
  const resumes = pausedAt !== undefined && Math.abs(time - pausedAt) <= markerSlopSeconds();
  startAudition(resumes ? pausedAt : time);
}
function seekPlayhead(time) {
  pausedAt = undefined;
  cursorTime = clampTime(time);
  if (playback) auditionFrom(cursorTime);
}
function moveSelection(step) {
  const ordered = markersInTimeOrder();
  if (!ordered.length) return;
  const index = ordered.findIndex(marker => marker.id === selectedId);
  const next = index === -1
    ? ordered[step > 0 ? 0 : ordered.length - 1]
    : ordered[Math.max(0, Math.min(ordered.length - 1, index + step))];
  selectedId = next.id;
  revealMarker(next);
  seekPlayhead(next.time);
  render();
}

function canvasTime(event) {
  const rect = canvas.getBoundingClientRect();
  const [regionStart, regionEnd] = viewRange();
  return Math.max(regionStart + .00001, Math.min(regionEnd - .00001, regionStart + (event.clientX - rect.left) / rect.width * (regionEnd - regionStart)));
}
function clampTime(value) {
  const [start, end] = activeCase().regionSeconds;
  return Number(Math.max(start + .00001, Math.min(end - .00001, value)).toFixed(5));
}
function drawWaveform() {
  if (!activeId) return;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  painter.setTransform(ratio, 0, 0, ratio, 0, 0);
  const width = rect.width, height = rect.height;
  painter.fillStyle = '#060a0c'; painter.fillRect(0, 0, width, height);
  const [start, end] = viewRange();
  const span = end - start;
  const tickSize = span > 1 ? .25 : span > .5 ? .1 : span > .12 ? .025 : span > .04 ? .01 : .0025;
  const firstTick = Math.ceil(start / tickSize - 1e-8), lastTick = Math.floor(end / tickSize + 1e-8);
  for (let tick = firstTick; tick <= lastTick; tick++) {
    const time = tick * tickSize;
    const x = (time - start) / span * width;
    painter.strokeStyle = tick % 4 ? '#1b2b30' : '#2b4448';
    painter.beginPath(); painter.moveTo(x, 10); painter.lineTo(x, height - 18); painter.stroke();
    painter.fillStyle = '#789099'; painter.font = '11px Segoe UI, sans-serif'; painter.fillText(time.toFixed(span < .12 ? 3 : 2) + 's', x + 3, height - 5);
  }
  const buffer = buffers.get(activeId);
  if (buffer) {
    painter.strokeStyle = '#50d8c8'; painter.lineWidth = 1;
    const frameStart = Math.floor(start * buffer.sampleRate), sampleSpan = (end - start) * buffer.sampleRate;
    const samples = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
    painter.beginPath();
    for (let x = 0; x < Math.ceil(width); x++) {
      const a = Math.max(0, Math.floor(frameStart + x / width * sampleSpan));
      const b = Math.min(buffer.length, Math.max(a + 1, Math.floor(frameStart + (x + 1) / width * sampleSpan)));
      let low = 1, high = -1;
      for (const channel of samples) for (let frame = a; frame < b; frame++) { low = Math.min(low, channel[frame]); high = Math.max(high, channel[frame]); }
      painter.moveTo(x + .5, height / 2 - high * (height * .37));
      painter.lineTo(x + .5, height / 2 - low * (height * .37));
    }
    painter.stroke();
  } else {
    painter.fillStyle = '#9caeb6'; painter.font = '14px Segoe UI, sans-serif'; painter.fillText('Loading waveform…', 18, height / 2);
  }
  // Show the forgiving hit target of the marker under the pointer, so the slop is visible rather than a surprise.
  const hovered = hoveredMarkerId !== undefined ? activeReview().markers.find(marker => marker.id === hoveredMarkerId) : undefined;
  if (hovered && hovered.time >= start && hovered.time <= end) {
    const x = (hovered.time - start) / span * width;
    const half = Math.max(6, MARKER_HIT_SLOP_PX);
    painter.fillStyle = 'rgba(140, 243, 232, .12)';
    painter.fillRect(x - half, 0, half * 2, height);
  }
  for (const marker of markersInTimeOrder()) {
    if (marker.time < start || marker.time > end) continue;
    const x = (marker.time - start) / span * width;
    painter.strokeStyle = colors[marker.status];
    painter.lineWidth = marker.id === selectedId ? 3 : 1.5;
    painter.beginPath(); painter.moveTo(x, 10); painter.lineTo(x, height - 22); painter.stroke();
    if (marker.id === selectedId) { painter.fillStyle = '#f5fffd'; painter.beginPath(); painter.arc(x, 10, 5, 0, Math.PI * 2); painter.fill(); }
  }
  if (cursorTime >= start && cursorTime <= end) {
    const cursorX = (cursorTime - start) / span * width;
  painter.strokeStyle = '#ffffff66'; painter.setLineDash([4, 4]); painter.beginPath(); painter.moveTo(cursorX, 0); painter.lineTo(cursorX, height - 20); painter.stroke(); painter.setLineDash([]);
  }
  if (playback) {
    const current = playback.windowStart + Math.min(playbackTime(), playback.duration);
    const x = (current - start) / span * width;
    painter.strokeStyle = '#fff'; painter.lineWidth = 2; painter.beginPath(); painter.moveTo(x, 0); painter.lineTo(x, height - 18); painter.stroke();
  }
}

// A/R act on the selected marker, falling back to the one nearest the cursor so a keypress after a click near a
// marker still decides something instead of silently doing nothing.
function editStatus(status) {
  const marker = targetMarker(); if (!marker) return;
  selectedId = marker.id; cursorTime = marker.time;
  marker.status = status; revealMarker(marker); change();
}
function canPlaceMarker(marker, time) {
  return !activeReview().markers.some(other => other.id !== marker.id && other.status === 'accepted' && Math.abs(other.time - time) < .005);
}
function nudge(amount) {
  const marker = selected(); if (!marker) return;
  const time = clampTime(marker.time + amount);
  if (!canPlaceMarker(marker, time)) return;
  marker.time = time; marker.status = 'accepted'; cursorTime = time; change();
}
function addMarker() {
  const time = clampTime(cursorTime);
  const nearby = activeReview().markers.find(marker => Math.abs(marker.time - time) < .005);
  if (nearby) { selectedId = nearby.id; render(); return; }
  const marker = { id: `new-${crypto.randomUUID()}`, time, status: 'accepted' };
  activeReview().markers.push(marker); selectedId = marker.id; change();
}
function nextUnreviewedId() {
  const scoped = sessionCases();
  const index = scoped.findIndex(item => item.id === activeId);
  for (let step = 1; step <= scoped.length; step++) {
    const candidate = scoped[(index + step + scoped.length) % scoped.length];
    if (candidate && !review.cases.find(entry => entry.id === candidate.id)?.reviewed) return candidate.id;
  }
  return undefined;
}
// Auto-advance waits a beat so the passage visibly flips to Reviewed, and the epoch guard means a passage the
// owner explicitly clicks during that beat always wins over the automatic jump.
async function advanceToNextPassage(nextId, epoch) {
  await new Promise(resolve => setTimeout(resolve, 450));
  if (epoch !== selectionEpoch || activeId === nextId) return;
  if (review.cases.find(entry => entry.id === nextId)?.reviewed) return;
  try { await switchCase(nextId); } catch (error) { setSaveMessage(error.message, true); }
}
function finishClip() {
  const state = activeReview();
  if (!state.listenedFull || state.markers.some(marker => marker.status === 'pending' || marker.status === 'uncertain') || !state.markers.some(marker => marker.status === 'accepted')) return;
  if (checklistNeeded() && !checklistComplete()) return;
  state.reviewed = true; change(false);
  if (!autoAdvance) return;
  const next = nextUnreviewedId();
  if (next) void advanceToNextPassage(next, selectionEpoch);
}

function updateHover(event) {
  const time = canvasTime(event);
  const nearest = nearestVisibleMarker(time);
  const id = nearest && Math.abs(nearest.time - time) <= markerSlopSeconds() ? nearest.id : undefined;
  if (id === hoveredMarkerId) return;
  hoveredMarkerId = id;
  canvas.style.cursor = id ? 'pointer' : 'crosshair';
  drawWaveform();
}
canvas.addEventListener('pointerdown', event => {
  if (!activeId) return;
  const time = canvasTime(event);
  const nearest = nearestVisibleMarker(time);
  if (nearest && Math.abs(nearest.time - time) <= markerSlopSeconds()) {
    // Inside a marker's forgiving target: select it and arm a drag. Whether this turns out to be a plain click
    // (listen from the marker) or a drag (move the onset) is decided on pointerup.
    selectedId = nearest.id; cursorTime = nearest.time;
    pointerDrag = { id: nearest.id, startX: event.clientX, time: nearest.time, changed: false, moved: false };
  } else {
    selectedId = undefined; cursorTime = clampTime(time);
    pointerDrag = { id: undefined, startX: event.clientX, time: cursorTime, changed: false, moved: false };
  }
  canvas.setPointerCapture(event.pointerId);
  render();
});
canvas.addEventListener('pointermove', event => {
  if (!activeId) return;
  if (!pointerDrag) { updateHover(event); return; }
  if (!pointerDrag.moved && !pointerDrag.changed && Math.abs(event.clientX - pointerDrag.startX) < 3) return;
  pointerDrag.moved = true;
  if (!pointerDrag.id) return;
  const marker = activeReview().markers.find(item => item.id === pointerDrag.id);
  if (!marker) return;
  const time = clampTime(canvasTime(event));
  if (!canPlaceMarker(marker, time)) return;
  marker.time = time; marker.status = 'accepted'; cursorTime = time;
  activeReview().reviewed = false; pointerDrag.changed = true; renderMarkers(); drawWaveform();
});
function releasePointer() {
  const drag = pointerDrag;
  pointerDrag = undefined;
  if (!drag) return;
  if (drag.changed) { void save(); return; }
  if (drag.moved) return;                       // a drag that moved nothing is not a click
  if (drag.id) { selectedId = drag.id; cursorTime = drag.time; }
  togglePlaybackAt(drag.time);                  // plain click: listen from here (or pause if already playing)
}
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
canvas.addEventListener('pointerleave', () => {
  if (pointerDrag || hoveredMarkerId === undefined) return;
  hoveredMarkerId = undefined; canvas.style.cursor = 'crosshair'; drawWaveform();
});
new ResizeObserver(drawWaveform).observe(canvas);
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const [start, end] = viewRange();
  const anchor = start + ratio * (end - start);
  setZoom(zoomFactor * (event.deltaY < 0 ? 2 : .5), anchor, ratio);
}, { passive: false });
element('zoom-in').onclick = () => setZoom(zoomFactor * 2, selected()?.time ?? viewCenter);
element('zoom-out').onclick = () => setZoom(zoomFactor / 2, selected()?.time ?? viewCenter);
element('zoom-fit').onclick = () => {
  const [start, end] = activeCase().regionSeconds;
  setZoom(1, (start + end) / 2);
};
element('wave-pan').oninput = event => {
  const [regionStart, regionEnd] = activeCase().regionSeconds;
  const duration = (regionEnd - regionStart) / zoomFactor;
  const travel = regionEnd - regionStart - duration;
  viewCenter = regionStart + duration / 2 + travel * Number(event.target.value) / 100;
  drawWaveform();
};

element('play-full').onclick = playFull;
element('play-hit').onclick = () => { void playSelected(); };
element('play-context').onclick = () => { void playSelected(true); };
element('stop').onclick = () => { pausedAt = undefined; stopPlayback(); };
element('auto-advance').onchange = event => { autoAdvance = event.target.checked; };
element('loop-toggle').onchange = event => {
  loopEnabled = event.target.checked;
  if (playback?.full) playback.loop = loopEnabled;
  updateLoopStatus();
};
element('session-select').onchange = async event => {
  selectionEpoch += 1;
  pausedAt = undefined;
  stopPlayback();
  try { await loadSession(event.target.value); }
  catch (error) { setSaveMessage(error.message, true); }
};
element('accept').onclick = () => editStatus('accepted');
element('reject').onclick = () => editStatus('rejected');
element('uncertain').onclick = () => editStatus('uncertain');
element('nudge-left').onclick = () => nudge(-.001);
element('nudge-right').onclick = () => nudge(.001);
element('add').onclick = addMarker;
element('accept-rest').onclick = () => { for (const marker of activeReview().markers) if (marker.status === 'pending') marker.status = 'accepted'; change(); };
element('finish-clip').onclick = finishClip;
element('export').onclick = async () => {
  try {
    await saving;
    if (saveFailed) throw Error('The review draft did not save. Retry a marker edit before exporting.');
    const response = await fetch('/api/export', { method: 'POST' });
    if (!response.ok) throw Error((await response.json()).error ?? 'Export failed.');
    const url = URL.createObjectURL(await response.blob());
    const blind = element('review-guidance').textContent.startsWith('Independent second review');
    const link = document.createElement('a'); link.href = url; link.download = exportName ?? (blind ? 'second-review-labels.json' : 'verified-real-breaks.json'); link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaveMessage(blind ? 'Second-review labels saved locally and downloaded' : 'Verified labels saved locally and downloaded');
  } catch (error) { setSaveMessage(error.message, true); }
};
document.addEventListener('keydown', event => {
  if (!activeId || event.ctrlKey || event.metaKey || event.altKey) return;
  const focus = document.activeElement, tag = focus?.tagName, type = tag === 'INPUT' ? focus.type : '';
  // Never hijack typing, the session picker, or a key that belongs to the focused control. Tab/Shift+Tab and Enter
  // are untouched, so checkboxes and buttons keep working; Space and the arrows stay with a focused range/checkbox.
  if (tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && TEXT_ENTRY_TYPES.includes(type))) return;
  if (event.key === ' ' && tag === 'INPUT' && KEYBOARD_OWNED_TYPES.includes(type)) return;
  if (event.key === 'Escape') { pausedAt = undefined; stopPlayback(); return; }
  if (event.key === ' ') { event.preventDefault(); togglePlayback(); return; }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    if (tag === 'INPUT' && type === 'range') return;
    event.preventDefault(); moveSelection(event.key === 'ArrowRight' ? 1 : -1); return;
  }
  if (event.key.toLowerCase() === 'f') { event.preventDefault(); playFull(); return; }
  if (event.key.toLowerCase() === 'a') { event.preventDefault(); editStatus('accepted'); return; }
  if (event.key.toLowerCase() === 'r') { event.preventDefault(); editStatus('rejected'); return; }
  if (event.key.toLowerCase() === 'u') { event.preventDefault(); editStatus('uncertain'); return; }
  if (event.key === ',' || event.key === '.') { event.preventDefault(); nudge((event.key === ',' ? -1 : 1) * (event.shiftKey ? .01 : .001)); return; }
});

function applyState(data) {
  catalogue = data.cases;
  review = data.review;
  sessions = data.sessions;
  sessionId = data.sessionId;
  exportName = data.exportName;
}

try {
  const response = await fetch('/api/state');
  if (!response.ok) throw Error((await response.json()).error ?? 'Could not load review state.');
  const data = await response.json();
  applyState(data);
  if (data.mode === 'blind-second-review') {
    element('review-guidance').textContent = 'Independent second review · first-review labels are hidden. Listen to each full passage, place every onset yourself, then mark the passage reviewed.';
    element('export').textContent = 'Download second-review labels';
    document.title = 'Blind second break onset review';
  }
  setSaveMessage('Saved locally');
  await switchCase(review.cases.find(item => !item.reviewed)?.id ?? review.cases[0]?.id ?? catalogue[0].id);
} catch (error) { setSaveMessage(error.message, true); element('clip-title').textContent = 'Review could not start'; }
