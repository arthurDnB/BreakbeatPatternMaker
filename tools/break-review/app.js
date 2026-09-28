const element = id => document.getElementById(id);
const colors = { pending: '#e6ac53', accepted: '#4be3a1', rejected: '#71828a', uncertain: '#a68aea' };
let catalogue, review, activeId, selectedId, cursorTime = 1;
let audioContext, playback, saving = Promise.resolve(), saveFailed = false, pointerDrag;
const buffers = new Map();
const canvas = element('waveform');
const painter = canvas.getContext('2d');

function activeCase() { return catalogue.find(item => item.id === activeId); }
function activeReview() { return review.cases.find(item => item.id === activeId); }
function selected() { return activeReview()?.markers.find(marker => marker.id === selectedId); }
function markersInTimeOrder() { return [...activeReview().markers].sort((a, b) => a.time - b.time); }
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

function renderCases() {
  const container = element('case-list');
  container.replaceChildren();
  let completed = 0;
  for (const item of catalogue) {
    const state = review.cases.find(entry => entry.id === item.id);
    if (state.reviewed) completed++;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `case-button ${item.id === activeId ? 'active' : ''} ${state.reviewed ? 'complete' : ''}`;
    const title = document.createElement('span'); title.className = 'case-name'; title.textContent = item.filename;
    const badge = document.createElement('small'); badge.textContent = state.reviewed ? 'Reviewed' : `${state.markers.filter(marker => marker.status === 'pending' || marker.status === 'uncertain').length} open`;
    button.append(title, badge);
    button.onclick = () => { void switchCase(item.id); };
    container.append(button);
  }
  element('progress-count').textContent = `${completed} / ${catalogue.length} reviewed`;
  element('export').disabled = completed !== catalogue.length;
}
function renderMarkers() {
  const state = activeReview(), current = selected();
  const list = element('marker-list');
  list.replaceChildren();
  for (const marker of markersInTimeOrder()) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `marker-item ${marker.status} ${marker.id === selectedId ? 'selected' : ''}`;
    button.setAttribute('role', 'listitem');
    button.setAttribute('aria-label', `${marker.time.toFixed(3)} seconds, ${marker.status}`);
    button.innerHTML = `<span>${marker.time.toFixed(3)} s</span><span>${marker.status}</span>`;
    button.onclick = () => { selectedId = marker.id; cursorTime = marker.time; render(); };
    button.ondblclick = () => { selectedId = marker.id; void playSelected(); };
    list.append(button);
  }
  const open = state.markers.filter(marker => marker.status === 'pending' || marker.status === 'uncertain').length;
  element('marker-count').textContent = `· ${state.markers.length} total · ${open} open`;
  element('selected-time').textContent = current ? `${current.time.toFixed(5)} s` : `${cursorTime.toFixed(5)} s cursor`;
  element('selected-status').textContent = current ? current.status : 'Click a marker or add a hit';
  for (const id of ['accept', 'reject', 'uncertain', 'nudge-left', 'nudge-right', 'play-hit']) element(id).disabled = !current;
  element('accept-rest').disabled = !state.markers.some(marker => marker.status === 'pending');
  element('finish-clip').disabled = !state.listenedFull || open > 0 || !state.markers.some(marker => marker.status === 'accepted') || state.reviewed;
  element('finish-clip').textContent = state.reviewed ? 'Passage reviewed' : 'Mark passage reviewed';
}
function render() {
  const item = activeCase(), state = activeReview();
  if (!item || !state) return;
  element('clip-family').textContent = item.family.toUpperCase();
  element('clip-title').textContent = item.filename;
  element('clip-detail').textContent = `${item.regionSeconds[0].toFixed(2)}–${item.regionSeconds[1].toFixed(2)} seconds · ${state.listenedFull ? 'Full passage played' : 'Play full passage to unlock review'}`;
  element('review-badge').textContent = state.reviewed ? 'Reviewed by ear' : 'Needs review';
  element('review-badge').classList.toggle('done', state.reviewed);
  renderCases(); renderMarkers(); drawWaveform();
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
  stopPlayback();
  activeId = id;
  const state = activeReview();
  selectedId = state.markers.find(marker => marker.status === 'pending')?.id ?? state.markers[0]?.id;
  cursorTime = selected()?.time ?? activeCase().regionSeconds[0] + .5;
  render();
  try { await ensureBuffer(id); if (id === activeId) drawWaveform(); }
  catch (error) { setSaveMessage(error.message, true); }
}
function stopPlayback() {
  if (playback) {
    const previous = playback;
    playback = undefined;
    try { previous.source.stop(); } catch {}
  }
  drawWaveform();
}
async function playWindow(start, end, full = false) {
  const id = activeId;
  try {
    const buffer = await ensureBuffer(id);
    if (id !== activeId) return;
    await audioContext.resume();
    stopPlayback();
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    const speed = Number(element('speed').value);
    source.playbackRate.value = speed;
    source.connect(audioContext.destination);
    const entry = { source, id, start, speed, begun: audioContext.currentTime, duration: end - start, full };
    playback = entry;
    source.onended = () => {
      if (playback !== entry) return;
      playback = undefined;
      if (full && activeId === id) { activeReview().listenedFull = true; change(false); }
      else drawWaveform();
    };
    source.start(0, start, end - start);
    requestAnimationFrame(drawPlayhead);
  } catch (error) { setSaveMessage(error.message, true); }
}
function playFull() { const [start, end] = activeCase().regionSeconds; void playWindow(start, end, true); }
function playSelected() {
  const marker = selected(); if (!marker) return;
  const [start, end] = activeCase().regionSeconds;
  void playWindow(Math.max(start, marker.time - .18), Math.min(end, marker.time + .32));
}
function drawPlayhead() { if (playback) { drawWaveform(); requestAnimationFrame(drawPlayhead); } }

function canvasTime(event) {
  const rect = canvas.getBoundingClientRect();
  const [start, end] = activeCase().regionSeconds;
  return Math.max(start + .00001, Math.min(end - .00001, start + (event.clientX - rect.left) / rect.width * (end - start)));
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
  const [start, end] = activeCase().regionSeconds;
  for (let tick = Math.ceil(start * 4); tick <= Math.floor(end * 4); tick++) {
    const x = (tick / 4 - start) / (end - start) * width;
    painter.strokeStyle = tick % 2 ? '#1b2b30' : '#2b4448';
    painter.beginPath(); painter.moveTo(x, 10); painter.lineTo(x, height - 18); painter.stroke();
    painter.fillStyle = '#789099'; painter.font = '11px Segoe UI, sans-serif'; painter.fillText((tick / 4).toFixed(2) + 's', x + 3, height - 5);
  }
  const buffer = buffers.get(activeId);
  if (buffer) {
    painter.strokeStyle = '#50d8c8'; painter.lineWidth = 1;
    const frameStart = Math.floor(start * buffer.sampleRate), span = (end - start) * buffer.sampleRate;
    const samples = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
    painter.beginPath();
    for (let x = 0; x < Math.ceil(width); x++) {
      const a = Math.max(0, Math.floor(frameStart + x / width * span));
      const b = Math.min(buffer.length, Math.max(a + 1, Math.floor(frameStart + (x + 1) / width * span)));
      let low = 1, high = -1;
      for (const channel of samples) for (let frame = a; frame < b; frame++) { low = Math.min(low, channel[frame]); high = Math.max(high, channel[frame]); }
      painter.moveTo(x + .5, height / 2 - high * (height * .37));
      painter.lineTo(x + .5, height / 2 - low * (height * .37));
    }
    painter.stroke();
  } else {
    painter.fillStyle = '#9caeb6'; painter.font = '14px Segoe UI, sans-serif'; painter.fillText('Loading waveform…', 18, height / 2);
  }
  for (const marker of markersInTimeOrder()) {
    const x = (marker.time - start) / (end - start) * width;
    painter.strokeStyle = colors[marker.status];
    painter.lineWidth = marker.id === selectedId ? 3 : 1.5;
    painter.beginPath(); painter.moveTo(x, 10); painter.lineTo(x, height - 22); painter.stroke();
    if (marker.id === selectedId) { painter.fillStyle = '#f5fffd'; painter.beginPath(); painter.arc(x, 10, 5, 0, Math.PI * 2); painter.fill(); }
  }
  const cursorX = (cursorTime - start) / (end - start) * width;
  painter.strokeStyle = '#ffffff66'; painter.setLineDash([4, 4]); painter.beginPath(); painter.moveTo(cursorX, 0); painter.lineTo(cursorX, height - 20); painter.stroke(); painter.setLineDash([]);
  if (playback) {
    const current = playback.start + (audioContext.currentTime - playback.begun) * playback.speed;
    const x = (current - start) / (end - start) * width;
    painter.strokeStyle = '#fff'; painter.lineWidth = 2; painter.beginPath(); painter.moveTo(x, 0); painter.lineTo(x, height - 18); painter.stroke();
  }
}

function editStatus(status) { const marker = selected(); if (!marker) return; marker.status = status; change(); }
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
function finishClip() {
  const state = activeReview();
  if (!state.listenedFull || state.markers.some(marker => marker.status === 'pending' || marker.status === 'uncertain') || !state.markers.some(marker => marker.status === 'accepted')) return;
  state.reviewed = true; change(false);
}

canvas.addEventListener('pointerdown', event => {
  if (!activeId) return;
  const time = canvasTime(event), width = canvas.getBoundingClientRect().width;
  const nearest = markersInTimeOrder().reduce((best, marker) => !best || Math.abs(marker.time - time) < Math.abs(best.time - time) ? marker : best, null);
  const threshold = (activeCase().regionSeconds[1] - activeCase().regionSeconds[0]) * 12 / width;
  if (nearest && Math.abs(nearest.time - time) <= threshold) {
    selectedId = nearest.id; cursorTime = nearest.time;
    pointerDrag = { id: nearest.id, startX: event.clientX, changed: false };
    canvas.setPointerCapture(event.pointerId);
  } else { selectedId = undefined; cursorTime = clampTime(time); }
  render();
});
canvas.addEventListener('pointermove', event => {
  if (!pointerDrag || !activeId || Math.abs(event.clientX - pointerDrag.startX) < 3 && !pointerDrag.changed) return;
  const marker = activeReview().markers.find(item => item.id === pointerDrag.id);
  if (!marker) return;
  const time = clampTime(canvasTime(event));
  if (!canPlaceMarker(marker, time)) return;
  marker.time = time; marker.status = 'accepted'; cursorTime = time;
  activeReview().reviewed = false; pointerDrag.changed = true; renderMarkers(); drawWaveform();
});
canvas.addEventListener('pointerup', () => { if (pointerDrag?.changed) void save(); pointerDrag = undefined; });
canvas.addEventListener('pointercancel', () => { if (pointerDrag?.changed) void save(); pointerDrag = undefined; });
new ResizeObserver(drawWaveform).observe(canvas);

element('play-full').onclick = playFull;
element('play-hit').onclick = () => { void playSelected(); };
element('stop').onclick = stopPlayback;
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
    const link = document.createElement('a'); link.href = url; link.download = 'verified-real-breaks.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setSaveMessage('Verified labels saved locally and downloaded');
  } catch (error) { setSaveMessage(error.message, true); }
};
document.addEventListener('keydown', event => {
  if (!activeId || ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (event.key === 'Escape') { stopPlayback(); return; }
  if (event.key === ' ' && !['BUTTON'].includes(document.activeElement?.tagName)) { event.preventDefault(); void playSelected(); return; }
  if (['ArrowLeft', 'ArrowRight'].includes(event.key) && !['BUTTON'].includes(document.activeElement?.tagName)) {
    event.preventDefault(); const ordered = markersInTimeOrder(), index = ordered.findIndex(marker => marker.id === selectedId);
    const next = ordered[Math.max(0, Math.min(ordered.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)))];
    if (next) { selectedId = next.id; cursorTime = next.time; render(); }
  }
  if (event.key.toLowerCase() === 'f') { event.preventDefault(); playFull(); }
  if (event.key.toLowerCase() === 'a') { event.preventDefault(); editStatus('accepted'); }
  if (event.key.toLowerCase() === 'r') { event.preventDefault(); editStatus('rejected'); }
  if (event.key.toLowerCase() === 'u') { event.preventDefault(); editStatus('uncertain'); }
  if (event.key === ',' || event.key === '.') { event.preventDefault(); nudge((event.key === ',' ? -1 : 1) * (event.shiftKey ? .01 : .001)); }
});

try {
  const response = await fetch('/api/state');
  if (!response.ok) throw Error((await response.json()).error ?? 'Could not load review state.');
  const data = await response.json(); catalogue = data.cases; review = data.review;
  setSaveMessage('Saved locally');
  await switchCase(review.cases.find(item => !item.reviewed)?.id ?? catalogue[0].id);
} catch (error) { setSaveMessage(error.message, true); element('clip-title').textContent = 'Review could not start'; }
