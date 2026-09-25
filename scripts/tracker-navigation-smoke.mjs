import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const origin=process.env.APP_URL??'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin);await page.locator('#grid .tracker-value').first().waitFor();
 const first=page.locator('[data-cell-row="0"][data-cell-lane="kick"][data-field="note"]').first();
 await first.click();assert.equal(await first.getAttribute('aria-current'),'location');assert.ok(await first.evaluate(element=>element.classList.contains('is-cursor-field')));
 const lastRow=await page.locator('#grid tbody tr').count()-1;
 await page.keyboard.press('ArrowLeft');
 const last=page.locator(`[data-cell-row="${lastRow}"][data-cell-lane="percussion"][data-field="effect"]`).first();
 assert.equal(await last.getAttribute('aria-current'),'location');
 await page.keyboard.press('ArrowDown');
 const wrapped=page.locator('[data-cell-row="0"][data-cell-lane="percussion"][data-field="effect"]').first();
 assert.equal(await wrapped.getAttribute('aria-current'),'location');
 await page.keyboard.press('ArrowRight');
 const nextRow=page.locator('[data-cell-row="1"][data-cell-lane="kick"][data-field="note"]').first();
 assert.equal(await nextRow.getAttribute('aria-current'),'location');
 await page.keyboard.press('ArrowUp');assert.equal(await first.getAttribute('aria-current'),'location');
 assert.deepEqual(errors,[]);
 console.log('Tracker navigation: cursor highlight and horizontal/vertical pattern-edge wrapping passed.');
}finally{await browser.close();}
