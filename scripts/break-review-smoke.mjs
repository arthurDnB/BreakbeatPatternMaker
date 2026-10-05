import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { startBreakReviewServer } from './break-review-server.mjs';

// Local-only browser check; requires the eight WAV paths in the ignored source map.
const draftFile = `test-results/break-transcription/review-smoke-${randomUUID()}.json`;
const { server, url } = await startBreakReviewServer({ port: 0, draftFile });
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL ?? 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await page.locator('#case-list button').first().waitFor();
  assert.equal(await page.locator('#case-list button').count(), 8);
  assert.match(await page.locator('#clip-title').textContent(), /Amen Brother/);
  await page.locator('#waveform').screenshot({ path: 'test-results/break-transcription/review-ui.png' });
  assert.equal(await page.locator('#zoom-level').textContent(), '1×');
  await page.locator('#zoom-in').click();
  assert.equal(await page.locator('#zoom-level').textContent(), '2×');
  await page.locator('#waveform').hover();
  await page.mouse.wheel(0, -100);
  assert.equal(await page.locator('#zoom-level').textContent(), '4×');
  assert.equal(await page.locator('#wave-pan').isDisabled(), false);
  await page.locator('#wave-pan').evaluate(input => { input.value = '100'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#zoom-fit').click();
  assert.equal(await page.locator('#zoom-level').textContent(), '1×');
  assert.equal(await page.locator('#wave-pan').isDisabled(), true);
  for (let index = 0; index < 7; index++) await page.locator('#zoom-in').click();
  assert.equal(await page.locator('#zoom-level').textContent(), '128×');
  assert.equal(await page.locator('#zoom-in').isDisabled(), true);
  await page.locator('#zoom-fit').click();
  await page.evaluate(() => {
    const original = AudioBufferSourceNode.prototype.start;
    window.__playWindows = [];
    AudioBufferSourceNode.prototype.start = function (...args) {
      window.__playWindows.push(args);
      return original.apply(this, args);
    };
  });
  await page.locator('#play-full').click();
  await page.getByText('Full passage played').waitFor({ timeout: 10000 });
  // The first Amen label sits at 0.00001 s, exactly on the region start, where hit only and hit + context both
  // clamp to offset 0. Move to the next label so the lead-in comparison is meaningful.
  await page.locator('#marker-list .marker-item').nth(1).click();
  await page.locator('#play-hit').click();
  await page.locator('#play-context').click();
  const windows = await page.evaluate(() => window.__playWindows.slice(-2));
  assert.equal(windows.length, 2);
  assert.ok(windows[0][1] > 0, 'an interior label must audition from inside the region');
  assert.ok(windows[0][1] > windows[1][1], 'hit only should omit the context lead-in');
  assert.ok(windows[0][2] < windows[1][2], 'hit only should have a shorter audition window');
  await page.locator('#accept-rest').click();
  await page.locator('#finish-clip').click();
  await page.getByText('1 / 8 reviewed').waitFor();
  await page.reload();
  await page.getByText('1 / 8 reviewed').waitFor();
  assert.equal(await page.locator('#export').isDisabled(), true);
  assert.deepEqual(errors, []);
  await page.setViewportSize({ width: 390, height: 780 });
  const mobile = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
    overflow: [...document.querySelectorAll('body *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1).slice(0, 8).map(node => `${node.tagName.toLowerCase()}#${node.id}.${node.className}`) }));
  await page.screenshot({ path: 'test-results/break-transcription/review-mobile.png', fullPage: true });
  assert.equal(mobile.scrollWidth <= mobile.width + 1, true, JSON.stringify(mobile));
  console.log('Local break review: audio playback, marker decisions, autosave, reload and mobile layout passed.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await rm(draftFile, { force: true });
}

const blindDraft = `test-results/break-transcription/blind-smoke-${randomUUID()}.json`;
const blindExport = `test-results/break-transcription/blind-export-${randomUUID()}.json`;
const blindServer = await startBreakReviewServer({ port: 0, draftFile: blindDraft, exportFile: blindExport, blindReview: true });
let blindBrowser;
try {
  const stateResponse = await fetch(blindServer.url + 'api/state');
  const state = await stateResponse.json();
  assert.equal(state.mode, 'blind-second-review');
  assert.equal(state.cases.some(item => 'onsetsSeconds' in item), false);
  assert.ok(state.review.cases.every(item => item.markers.length === 0));
  blindBrowser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL ?? 'msedge' });
  const page = await blindBrowser.newPage();
  await page.goto(blindServer.url);
  // The app bootstraps through a top-level await, so the page can finish loading before the
  // state fetch resolves and the blind guidance is written. Wait for it instead of racing it.
  await page.waitForFunction(() => document.querySelector('#review-guidance').textContent.startsWith('Independent second review'), null, { timeout: 15000 });
  assert.equal(await page.locator('#marker-list .marker-item').count(), 0);
  await page.locator('#play-full').click();
  await page.getByText('Full passage played').waitFor({ timeout: 10000 });
  await page.locator('#add').click();
  await page.getByText('1 total · 0 open').waitFor();
  await page.getByText('Saved locally').waitFor();
  const saved = await (await fetch(blindServer.url + 'api/state')).json();
  assert.equal(saved.review.cases[0].markers.length, 1);
  assert.deepEqual(await page.locator('#export').isDisabled(), true);
  console.log('Blind second review: zero exposed reference labels, manual onset creation and separate autosave passed.');
} finally {
  await blindBrowser?.close();
  await new Promise(resolve => blindServer.server.close(resolve));
  await rm(blindDraft, { force: true });
  await rm(blindExport, { force: true });
}

// Full-loop session: loop playback, the visible position readout and the required checklist that gates review.
const loopDraft = `test-results/break-transcription/loop-smoke-${randomUUID()}.json`;
// Every session keeps its own draft next to the primary one, so this run gets its own manifest with per-run draft
// names. Otherwise a previous run's reviewed passage would be loaded here and the "1 / 4 reviewed" step would drift.
const loopSessions = `test-results/break-transcription/loop-smoke-sessions-${randomUUID()}.json`;
const loopRun = randomUUID();
const loopManifest = JSON.parse(await readFile('benchmarks/break-review-sessions.json', 'utf8'));
for (const session of loopManifest.sessions) {
  session.draftName = `loop-smoke-${loopRun}-${session.id}-draft.json`;
  session.blindDraftName = `loop-smoke-${loopRun}-${session.id}-second-review-draft.json`;
}
await writeFile(loopSessions, `${JSON.stringify(loopManifest, null, 2)}\n`);
const loopDrafts = loopManifest.sessions.map(session => `test-results/break-transcription/${session.draftName}`);
const loopServer = await startBreakReviewServer({ port: 0, draftFile: loopDraft, sessionsFile: loopSessions });
let loopBrowser;
try {
  loopBrowser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL ?? 'msedge' });
  const page = await loopBrowser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(loopServer.url);
  await page.locator('#case-list button').first().waitFor();
  assert.equal(await page.locator('#session-select').inputValue(), 'baseline');
  assert.equal(await page.locator('#case-list button').count(), 8);
  await page.locator('#session-select').selectOption('full-loops');
  // Switching sessions is an async round trip (POST /api/session then GET /api/state), so wait for the new list.
  await page.waitForFunction(() => document.querySelectorAll('#case-list button').length === 4);
  assert.equal(await page.locator('#session-select').inputValue(), 'full-loops');
  assert.equal(await page.locator('#loop-toggle').isChecked(), false);
  await page.locator('#loop-toggle').check();
  assert.match(await page.locator('#loop-state').textContent(), /Loop on/);
  await page.locator('#play-full').click();
  // Arming playback fetches and decodes the passage first, so the readout appears shortly after the click.
  await page.waitForFunction(() => /Position \d/.test(document.querySelector('#play-position').textContent), null, { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('#checklist-listenedFull')?.checked === true, null, { timeout: 20000 });
  assert.match(await page.locator('#loop-state').textContent(), /Looping · pass/);
  assert.match(await page.locator('#checklist-state').textContent(), /required before review/);
  assert.equal(await page.locator('#finish-clip').isDisabled(), true);
  assert.equal(await page.locator('#finish-clip').textContent(), 'Finish the checklist first');
  await page.locator('#stop').click();
  await page.locator('#checklist-firstHitChecked').check();
  await page.locator('#checklist-lastHitChecked').check();
  assert.match(await page.locator('#checklist-state').textContent(), /^3 \/ 3/);
  await page.locator('#accept-rest').click();
  assert.equal(await page.locator('#finish-clip').isDisabled(), false);
  await page.locator('#finish-clip').click();
  await page.getByText('1 / 4 reviewed').waitFor();
  assert.deepEqual(errors, []);
  console.log('Full-loop session: session switching, loop toggle, position readout and the required checklist passed.');
} finally {
  await loopBrowser?.close();
  await new Promise(resolve => loopServer.server.close(resolve));
  await rm(loopDraft, { force: true });
  await rm(loopSessions, { force: true });
  for (const draft of loopDrafts) await rm(draft, { force: true });
}
