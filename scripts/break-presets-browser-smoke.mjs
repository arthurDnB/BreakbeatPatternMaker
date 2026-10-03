import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const root = resolve('site');
const prefix = '/';
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://local');
    if (!url.pathname.startsWith(prefix)) throw Error();
    const file = resolve(root, decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html');
    if (!file.startsWith(root + sep)) throw Error();
    const bytes = await readFile(file);
    res.writeHead(200, {
      'Content-Type': {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.wav': 'audio/wav',
        '.svg': 'image/svg+xml'
      }[extname(file)] ?? 'text/plain'
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end();
  }
});

await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL ?? 'msedge'
});

try {
  const context = await browser.newContext({viewport: {width: 1400, height: 950}});
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('bpm_tutorial_dismissed', '1'));

  await page.goto(`http://127.0.0.1:${server.address().port}${prefix}`);
  await page.locator('#grid .hit').first().waitFor();

  // Test 1: Open Break Browser and verify default pre-loaded Think Break preset
  await page.click('#import-break');
  await page.locator('#break-browser[open]').waitFor();
  assert.equal(await page.locator('#break-preset-select').inputValue(), 'think-142x');

  // Wait for slices to populate
  await page.waitForFunction(() => document.querySelectorAll('#break-slices button').length >= 10);
  const thinkSliceCount = await page.locator('#break-slices button').count();
  assert.equal(thinkSliceCount, 10, 'Think Break should have exactly 10 slices');

  // Check calculated tempo display
  const tempoText = await page.locator('#break-tempo').textContent();
  const parsedTempo = parseFloat(tempoText);
  assert.ok(parsedTempo >= 150 && parsedTempo <= 155, `Tempo should be around 153 BPM, got: ${tempoText}`);

  // Test auditioning
  await page.click('#break-reconstructed');
  await page.waitForFunction(() => document.querySelector('#break-status').textContent.includes('Reconstructed region looping'));
  await page.click('#break-stop');

  // Test 2: Switch to Amen Break preset
  await page.selectOption('#break-preset-select', 'amen-classic');
  await page.waitForFunction(() => {
    const text = document.querySelector('#break-status')?.textContent ?? '';
    return text.includes('Amen Break') && text.includes('loaded');
  });
  await page.waitForFunction(() => document.querySelectorAll('#break-slices button').length >= 16);
  const amenSliceCount = await page.locator('#break-slices button').count();
  assert.equal(amenSliceCount, 18, 'Amen Break should have 18 slices');

  // Test 3: Create instrument & pattern
  const oldSlotCount = await page.locator('.bank-slot').count();
  await page.click('#break-create');
  await page.waitForFunction(() => !document.querySelector('#break-browser').open);

  // Verify pattern slot was created
  await page.waitForFunction((count) => document.querySelectorAll('.bank-slot').length > count, oldSlotCount);
  const firstNote = page.locator('#grid .tracker-value[data-field="note"][data-hit]').first();
  assert.equal(await firstNote.textContent(), 'C-0', 'First slice hit mapped to C-0');

  // Test 4: Waveform Slicer preset loading in bottom tray
  await page.click('#bar-tray-bottom .bar-expand-btn');
  await page.evaluate(() => {
    const tab = document.getElementById('tab-slicer');
    if (tab) {
      tab.hidden = false;
      tab.parentElement?.classList.add('slicer-revealed');
      tab.click();
    }
  });

  await page.locator('#sample-drop').waitFor({state: 'visible'});
  await page.selectOption('#sample-preset-select', 'apache-bongo');
  await page.waitForFunction(() => {
    const text = document.querySelector('#sample-status')?.textContent ?? '';
    return text.includes('Apache Break') && text.includes('loaded');
  });
  await page.waitForFunction(() => document.querySelectorAll('#slice-list button').length >= 12);
  const apacheSlices = await page.locator('#slice-list button').count();
  assert.ok(apacheSlices >= 12, 'Apache break slices loaded in Waveform Slicer');

  assert.deepEqual(errors, [], 'No page errors should occur during break preset workflow');
  console.log('Break presets browser smoke tests passed successfully!');
  await context.close();
} finally {
  await browser.close();
  await new Promise(r => server.close(r));
}
