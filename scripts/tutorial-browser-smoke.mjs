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

  // Test 5: Edge cases: Tray starting Collapsed, Open on DSP, and Open on Slicer
  // Across each state, verify Step 1 always selects Generator and opens tray,
  // and Done, Skip, and Escape each restore the original collapsed/open state and selected tab.
  {
    const context = await browser.newContext({viewport: {width: 1920, height: 1080}});
    const page = await context.newPage();

    // Disable first-run auto-open to control starting states cleanly via replay button
    await page.addInitScript(() => localStorage.setItem('bpm_tutorial_dismissed', '1'));
    await page.goto(url);
    await page.locator('#grid .hit').first().waitFor();

    const overlay = page.locator('#tutorial-overlay');
    const tutorialBtn = page.locator('#tutorial-btn');
    const bottomTray = page.locator('#tray-bottom');
    const tabGen = page.locator('#tab-generator');
    const tabSli = page.locator('#tab-slicer');
    const tabFx = page.locator('#tab-fx');

    const getTrayCollapsed = async () => bottomTray.evaluate(el => el.classList.contains('tray-bottom-collapsed'));
    const getActiveTab = async () => {
      if (await tabSli.evaluate(el => el.classList.contains('active'))) return 'slicer';
      if (await tabFx.evaluate(el => el.classList.contains('active'))) return 'fx';
      return 'generator';
    };

    // Helper to finish tutorial via Done (advance to step 5 then next)
    const completeTutorial = async () => {
      for (let i = 0; i < 4; i++) {
        await page.click('#tutorial-next');
      }
      assert.equal(await page.locator('#tutorial-next').textContent(), 'Done');
      await page.click('#tutorial-next');
      assert.equal(await overlay.isVisible(), false);
    };

    // Helper to dismiss via Skip
    const skipTutorial = async () => {
      await page.click('#tutorial-skip');
      assert.equal(await overlay.isVisible(), false);
    };

    // Helper to dismiss via Escape
    const escapeTutorial = async () => {
      await page.keyboard.press('Escape');
      assert.equal(await overlay.isVisible(), false);
    };

    // --- SCENARIO A: Starting state = Collapsed tray ---
    // A.1: Collapsed -> Start -> Generator visible -> Complete (Done) -> Collapsed restored
    await page.evaluate(() => {
      const b = document.getElementById('tray-bottom');
      if (b && !b.classList.contains('tray-bottom-collapsed')) {
        document.getElementById('toggle-tray-bottom')?.click();
      }
    });
    assert.equal(await getTrayCollapsed(), true, 'Precondition: tray should be collapsed');

    await tutorialBtn.click();
    assert.equal(await overlay.isVisible(), true);
    assert.equal(await getTrayCollapsed(), false, 'Tray must be opened for tutorial');
    assert.equal(await getActiveTab(), 'generator', 'Generator tab must be active');
    await completeTutorial();
    assert.equal(await getTrayCollapsed(), true, 'Tray should be restored to collapsed after Done');

    // A.2: Collapsed -> Start -> Skip -> Collapsed restored
    await tutorialBtn.click();
    assert.equal(await getTrayCollapsed(), false);
    assert.equal(await getActiveTab(), 'generator');
    await skipTutorial();
    assert.equal(await getTrayCollapsed(), true, 'Tray should be restored to collapsed after Skip');

    // A.3: Collapsed -> Start -> Escape -> Collapsed restored
    await tutorialBtn.click();
    assert.equal(await getTrayCollapsed(), false);
    assert.equal(await getActiveTab(), 'generator');
    await escapeTutorial();
    assert.equal(await getTrayCollapsed(), true, 'Tray should be restored to collapsed after Escape');

    // --- SCENARIO B: Starting state = Open on DSP (fx) tab ---
    const setOpenOnTab = async (tabName) => {
      await page.evaluate((targetTab) => {
        const b = document.getElementById('tray-bottom');
        if (b && b.classList.contains('tray-bottom-collapsed')) {
          document.getElementById('toggle-tray-bottom')?.click();
        }
        if (targetTab === 'fx') document.getElementById('tab-fx')?.click();
        else if (targetTab === 'slicer') document.getElementById('tab-slicer')?.click();
        else document.getElementById('tab-generator')?.click();
      }, tabName);
    };

    // B.1: Open on DSP -> Start -> Generator visible -> Complete (Done) -> Open on DSP restored
    await setOpenOnTab('fx');
    assert.equal(await getTrayCollapsed(), false, 'Precondition: tray open');
    assert.equal(await getActiveTab(), 'fx', 'Precondition: active tab is fx');

    await tutorialBtn.click();
    assert.equal(await overlay.isVisible(), true);
    assert.equal(await getTrayCollapsed(), false, 'Tray remains open');
    assert.equal(await getActiveTab(), 'generator', 'Generator tab must be active during step 1');
    assert.equal(await page.locator('#controls').isVisible(), true, 'Controls must be visible');
    await completeTutorial();
    assert.equal(await getTrayCollapsed(), false, 'Tray should remain open after Done');
    assert.equal(await getActiveTab(), 'fx', 'DSP (fx) tab should be restored after Done');

    // B.2: Open on DSP -> Start -> Skip -> Open on DSP restored
    await setOpenOnTab('fx');
    assert.equal(await getActiveTab(), 'fx');
    await tutorialBtn.click();
    assert.equal(await getActiveTab(), 'generator');
    await skipTutorial();
    assert.equal(await getTrayCollapsed(), false);
    assert.equal(await getActiveTab(), 'fx', 'DSP tab restored after Skip');

    // B.3: Open on DSP -> Start -> Escape -> Open on DSP restored
    await setOpenOnTab('fx');
    assert.equal(await getActiveTab(), 'fx');
    await tutorialBtn.click();
    assert.equal(await getActiveTab(), 'generator');
    await escapeTutorial();
    assert.equal(await getTrayCollapsed(), false);
    assert.equal(await getActiveTab(), 'fx', 'DSP tab restored after Escape');

    // --- SCENARIO C: Starting state = Open on Slicer tab ---
    // C.1: Open on Slicer -> Start -> Generator visible -> Complete (Done) -> Open on Slicer restored
    await setOpenOnTab('slicer');
    assert.equal(await getTrayCollapsed(), false, 'Precondition: tray open');
    assert.equal(await getActiveTab(), 'slicer', 'Precondition: active tab is slicer');

    await tutorialBtn.click();
    assert.equal(await overlay.isVisible(), true);
    assert.equal(await getTrayCollapsed(), false, 'Tray remains open');
    assert.equal(await getActiveTab(), 'generator', 'Generator tab must be active during step 1');
    assert.equal(await page.locator('#controls').isVisible(), true, 'Controls must be visible');
    await completeTutorial();
    assert.equal(await getTrayCollapsed(), false, 'Tray should remain open after Done');
    assert.equal(await getActiveTab(), 'slicer', 'Slicer tab should be restored after Done');

    // C.2: Open on Slicer -> Start -> Skip -> Open on Slicer restored
    await setOpenOnTab('slicer');
    assert.equal(await getActiveTab(), 'slicer');
    await tutorialBtn.click();
    assert.equal(await getActiveTab(), 'generator');
    await skipTutorial();
    assert.equal(await getTrayCollapsed(), false);
    assert.equal(await getActiveTab(), 'slicer', 'Slicer tab restored after Skip');

    // C.3: Open on Slicer -> Start -> Escape -> Open on Slicer restored
    await setOpenOnTab('slicer');
    assert.equal(await getActiveTab(), 'slicer');
    await tutorialBtn.click();
    assert.equal(await getActiveTab(), 'generator');
    await escapeTutorial();
    assert.equal(await getTrayCollapsed(), false);
    assert.equal(await getActiveTab(), 'slicer', 'Slicer tab restored after Escape');

    // Final non-destructive assertions
    assert.equal(await page.locator('#play').evaluate(el => el.classList.contains('is-playing')), false);
    assert.equal(await page.locator('#undo').isDisabled(), true);

    await context.close();
  }

  console.log('Guided spotlight tutorial smoke tests passed successfully!');
} finally {
  await browser.close();
  await new Promise(r => server.close(r));
}
