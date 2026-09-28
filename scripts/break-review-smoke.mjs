import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
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
  await page.locator('#play-hit').click();
  await page.locator('#play-context').click();
  const windows = await page.evaluate(() => window.__playWindows.slice(-2));
  assert.equal(windows.length, 2);
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
  assert.match(await page.locator('#review-guidance').textContent(), /first-review labels are hidden/);
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
