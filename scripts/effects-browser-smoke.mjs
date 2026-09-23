import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173');await page.locator('.hit').first().waitFor();await page.click('#show-sounds');await page.locator('#kit-shape-kick').evaluate(e=>e.open=true);
 assert.equal(await page.locator('#kit-play-kick').textContent(),'Preview');assert.equal(await page.locator('#stop-playback').count(),0);assert.equal(await page.locator('#seed').isVisible(),false);assert.equal(await page.locator('#export').isVisible(),false);
 const download=async id=>{const p=page.waitForEvent('download');await page.click(id);return readFile(await (await p).path());};
 const baseline=await download('#export-wav');await page.check('#kit-reverse-kick');assert.notDeepEqual(await download('#export-wav'),baseline);assert.match(await page.locator('.hit.kick').first().textContent(),/↶/);await page.uncheck('#kit-reverse-kick');
 await page.locator('.hit.snare').first().click();await page.check('#edit-reverse');await page.click('#hit-apply');assert.match(await page.locator('.hit.snare').first().textContent(),/↶/);await page.click('#undo');assert.deepEqual(await download('#export-wav'),baseline);
 await page.click('#effects-snare > summary');
 for(const [key,value] of [['highpass','150'],['lowpass','6000'],['drive','.4'],['delayMs','300'],['feedback','.45'],['mix','.3']]){await page.fill('#fx-'+key+'-snare',value);await page.locator('#fx-'+key+'-snare').dispatchEvent('change');}
 const wet=await download('#export-wav');assert.notDeepEqual(wet,baseline);
 await page.check('#fx-bypass-snare');assert.deepEqual(await download('#export-wav'),baseline);await page.uncheck('#fx-bypass-snare');
 await page.click('#kit-play-snare');await page.click('#play');assert.equal(await page.locator('#play').textContent(),'Stop');await page.click('#play');assert.equal(await page.locator('#play').textContent(),'Play pattern');
 const file=await download('#project-save');assert.equal(JSON.parse(file).kit.snare.effects.drive,.4);
 await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Saved locally');await page.reload();await page.locator('.hit').first().waitFor();await page.click('#show-sounds');await page.locator('#kit-shape-kick').evaluate(e=>e.open=true);await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Restored local workspace');assert.deepEqual(await download('#export-wav'),wet);
 await page.click('#more-actions > summary');assert.equal(await page.locator('#export').isVisible(),true);await download('#export');assert.equal(await page.locator('#export').isVisible(),false);
 await page.click('#advanced-generation > summary');assert.equal(await page.locator('#seed').isVisible(),true);await page.click('#advanced-generation > summary');
 await page.locator('#controls').screenshot({path:'test-results/generator-clean.png'});await page.click('#effects-snare > summary');await page.locator('#drum-slots').screenshot({path:'test-results/instrument-effects.png'});
 await page.setViewportSize({width:390,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('Effects UI: clean toolbar/disclosures, reverse instrument/hit, bypass WAV parity, processed preview, autosave restore and mobile layout passed.');
}finally{await browser.close();}
