import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root = resolve('site');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wav': 'audio/wav',
  '.json': 'application/json',
  '.md': 'text/plain'
};

const server = createServer(async (req, res) => {
  try {
    const file = resolve(root, decodeURIComponent(new URL(req.url, 'http://local').pathname).slice(1) || 'index.html');
    if (!file.startsWith(root + sep)) throw Error('Invalid path');
    const bytes = await readFile(file);
    res.writeHead(200, {'Content-Type': mime[extname(file)] ?? 'text/plain'});
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL ?? 'msedge'
});

try {
  // Test 1: Desktop First-Visit Auto-Launch, 5 Steps, Tray Restoration, and Non-destructive behavior
  {
    const context = await browser.newContext({viewport: {width: 1920, height: 1080}});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));

    await page.goto(url);
    await page.locator('#grid .hit').first().waitFor();

    // Verify tutorial auto-launches on first visit
    const overlay = page.locator('#tutorial-overlay');
    assert.equal(await overlay.isVisible(), true, 'Tutorial overlay must auto-open on first visit');
    assert.equal(await page.locator('#tutorial-step-count').textContent(), 'Step 1 of 5');
    assert.equal(await page.locator('#tutorial-step-title').textContent(), 'Generator Settings');

    // Step 1 needs the bottom tray, so verify bottom tray was opened and generator tab is active
    assert.equal(
      await page.locator('#tray-bottom').evaluate(el => el.classList.contains('tray-bottom-collapsed')),
      false,
      'Bottom tray must be opened for generator-settings step'
    );
    assert.equal(
      await page.locator('#tab-generator').evaluate(el => el.classList.contains('active')),
      true,
      'Generator tab must be active'
    );

    // Verify spotlight is positioned and visible
    const spotlight = page.locator('#tutorial-spotlight');
    const spotlightBox = await spotlight.boundingBox();
    assert.ok(spotlightBox && spotlightBox.width > 200 && spotlightBox.height > 50, 'Spotlight box must wrap generator controls');

    // Step 1 controls
    assert.equal(await page.locator('#tutorial-prev').isDisabled(), true, 'Back button must be disabled on step 1');
    assert.equal(await page.locator('#tutorial-next').textContent(), 'Next');

    // Navigate to Step 2: Choosing a layer to generate
    await page.click('#tutorial-next');
    assert.equal(await page.locator('#tutorial-step-count').textContent(), 'Step 2 of 5');
    assert.equal(await page.locator('#tutorial-step-title').textContent(), 'Choose a Layer to Generate');
    assert.equal(await page.locator('#tutorial-prev').isDisabled(), false, 'Back button must be enabled on step 2');
    const trigSpotlight = await spotlight.boundingBox();
    assert.ok(trigSpotlight && trigSpotlight.width > 100, 'Spotlight box must wrap transport triggers');

    // Navigate to Step 3: Playback
    await page.click('#tutorial-next');
    assert.equal(await page.locator('#tutorial-step-count').textContent(), 'Step 3 of 5');
    assert.equal(await page.locator('#tutorial-step-title').textContent(), 'Playback Controls');

    // Navigate to Step 4: Tracker editing
    await page.click('#tutorial-next');
    assert.equal(await page.locator('#tutorial-step-count').textContent(), 'Step 4 of 5');
    assert.equal(await page.locator('#tutorial-step-title').textContent(), 'Tracker Pattern Editor');

    // Navigate to Step 5: Export
    await page.click('#tutorial-next');
    assert.equal(await page.locator('#tutorial-step-count').textContent(), 'Step 5 of 5');
    assert.equal(await page.locator('#tutorial-step-title').textContent(), 'Export Audio');
    assert.equal(await page.locator('#tutorial-next').textContent(), 'Done', 'Last step button should say Done');

    // Test Back navigation back to Step 4, 3, 2, 1
    await page.click('#tutorial-prev');
    assert.equal(await page.locator('#tutorial-step-count').textContent(), 'Step 4 of 5');
    await page.click('#tutorial-prev');
    assert.equal(await page.locator('#tutorial-step-count').textContent(), 'Step 3 of 5');
    await page.click('#tutorial-prev');
    assert.equal(await page.locator('#tutorial-step-count').textContent(), 'Step 2 of 5');
    await page.click('#tutorial-prev');
    assert.equal(await page.locator('#tutorial-step-count').textContent(), 'Step 1 of 5');
    assert.equal(await page.locator('#tutorial-prev').isDisabled(), true);

    // Advance back to step 5 and complete
    await page.click('#tutorial-next'); // 2
    await page.click('#tutorial-next'); // 3
    await page.click('#tutorial-next'); // 4
    await page.click('#tutorial-next'); // 5
    await page.click('#tutorial-next'); // Done

    // Overlay should now be hidden
    assert.equal(await overlay.isVisible(), false, 'Tutorial overlay must be hidden after completion');

    // Bottom tray must be restored to collapsed!
    assert.equal(
      await page.locator('#tray-bottom').evaluate(el => el.classList.contains('tray-bottom-collapsed')),
      true,
      'Bottom tray must be restored to collapsed state after tutorial ends'
    );

    // Verify localStorage has recorded completion
    const dismissed = await page.evaluate(() => localStorage.getItem('bpm_tutorial_dismissed'));
    assert.equal(dismissed, '1', 'Tutorial dismissal must be stored in localStorage');

    // Non-destructive verification: taking tutorial did not trigger playback or edit pattern
    assert.equal(await page.locator('#play').evaluate(el => el.classList.contains('is-playing')), false, 'Playback must not be triggered');
    assert.equal(await page.locator('#undo').isDisabled(), true, 'Undo stack must remain empty (no edits made by tutorial)');

    // Test Replay button
    const tutorialBtn = page.locator('#tutorial-btn');
    assert.equal(await tutorialBtn.isVisible(), true, 'Persistent Tutorial button must be visible in header');
    await tutorialBtn.click();
    assert.equal(await overlay.isVisible(), true, 'Tutorial must reopen on replay click');
    assert.equal(
      await page.locator('#tray-bottom').evaluate(el => el.classList.contains('tray-bottom-collapsed')),
      false,
      'Replay must reopen bottom tray for step 1'
    );

    // Test Escape key to dismiss tutorial
    await page.keyboard.press('Escape');
    assert.equal(await overlay.isVisible(), false, 'Escape key must dismiss tutorial');
    assert.equal(
      await page.locator('#tray-bottom').evaluate(el => el.classList.contains('tray-bottom-collapsed')),
      true,
      'Escape dismissal must restore bottom tray to collapsed state'
    );

    // Verify Quick Start guide remains intact and accessible
    assert.equal(await page.locator('#quick-start-toggle').isVisible(), true, 'Quick start toggle must remain present');

    assert.deepEqual(errors, []);
    await context.close();
  }

  // Test 2: Skip Button and Reload Persistence
  {
    const context = await browser.newContext({viewport: {width: 1920, height: 1080}});
    const page = await context.newPage();

    await page.goto(url);
    await page.locator('#grid .hit').first().waitFor();
    assert.equal(await page.locator('#tutorial-overlay').isVisible(), true);

    // Click Skip immediately
    await page.click('#tutorial-skip');
    assert.equal(await page.locator('#tutorial-overlay').isVisible(), false);
    assert.equal(
      await page.locator('#tray-bottom').evaluate(el => el.classList.contains('tray-bottom-collapsed')),
      true,
      'Skip must restore collapsed tray'
    );

    // Reload the page: tutorial must NOT auto-launch again
    await page.reload();
    await page.locator('#grid .hit').first().waitFor();
    assert.equal(await page.locator('#tutorial-overlay').isVisible(), false, 'Tutorial must not auto-launch after dismissal');
    assert.equal(
      await page.locator('#tray-bottom').evaluate(el => el.classList.contains('tray-bottom-collapsed')),
      true,
      'Generator tray remains collapsed on second visit'
    );

    await context.close();
  }

  // Test 3: Keyboard Focus Trap & Accessibility
  {
    const context = await browser.newContext({viewport: {width: 1920, height: 1080}});
    const page = await context.newPage();

    await page.goto(url);
    await page.locator('#grid .hit').first().waitFor();

    // Verify focus is inside the tutorial dialog
    const focusedTag = await page.evaluate(() => document.activeElement?.id);
    assert.equal(focusedTag, 'tutorial-next', 'Initial focus should be on Next button');

    // Tab moves focus within the toolbox
    await page.keyboard.press('Tab');
    const nextFocused = await page.evaluate(() => document.activeElement?.id);
    // Focus should be skip or prev/next, inside toolbox
    const isInsideToolbox = await page.evaluate(() => {
      const active = document.activeElement;
      return active?.closest('#tutorial-toolbox') !== null;
    });
    assert.equal(isInsideToolbox, true, 'Focus must remain trapped inside tutorial toolbox');

    await page.click('#tutorial-skip');
    await context.close();
  }

  // Test 4: Mobile Viewport (390x844) Responsiveness & Reduced Motion
  {
    const context = await browser.newContext({
      viewport: {width: 390, height: 844},
      isMobile: true,
      hasTouch: true,
      reducedMotion: 'reduce'
    });
    const page = await context.newPage();

    await page.goto(url);
    await page.locator('#grid .hit').first().waitFor();

    assert.equal(await page.locator('#tutorial-overlay').isVisible(), true);
    const toolbox = page.locator('#tutorial-toolbox');
    const box = await toolbox.boundingBox();
    assert.ok(box && box.width <= 390 && box.x >= 0, `Mobile toolbox must fit within viewport: ${JSON.stringify(box)}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390, 'No horizontal overflow on mobile');

    // Can navigate through steps on mobile
    await page.click('#tutorial-next');
    assert.equal(await page.locator('#tutorial-step-count').textContent(), 'Step 2 of 5');

    await page.click('#tutorial-skip');
    assert.equal(await page.locator('#tutorial-overlay').isVisible(), false);

    await context.close();
  }

  console.log('Guided spotlight tutorial smoke tests passed successfully!');
} finally {
  await browser.close();
  await new Promise(r => server.close(r));
}
