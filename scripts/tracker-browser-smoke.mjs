import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {encodeWav} from '../dist/audio/wav.js';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');await page.locator('.hit').first().waitFor();
 const download=async id=>{const p=page.waitForEvent('download');await page.click(id);return readFile(await (await p).path());};
 const left=Float32Array.from({length:44100},(_,i)=>Math.sin(i*.1)*.25),right=left.map(x=>x*.5);
 await page.setInputFiles('#sample-file',{name:'groove.wav',mimeType:'audio/wav',buffer:Buffer.from(encodeWav([left,right],44100))});
 await page.waitForFunction(()=>document.querySelector('#sample-meta').textContent.includes('groove.wav'));
 await page.selectOption('#chop-mode','grid');await page.selectOption('#chop-count','4');await page.click('#autochop');
 await page.selectOption('#bars','1');await page.click('#original-groove');assert.equal(Number(await page.inputValue('#bpm')),240);
 assert.equal(await page.locator('.hit').count(),4);assert.match(await page.locator('.hit').first().textContent(),/Slice 1/);
 const original=JSON.parse((await download('#export')).toString());assert.equal(original.pattern.events.length,4);
 const audio=await download('#export-wav');assert.equal(audio.toString('ascii',8,12),'WAVE');assert.ok(audio.length>44100*4);
 await page.click('#play');await page.waitForFunction(()=>document.querySelector('.playing-row'));await page.click('#play');
 await page.locator('.hit').first().click();await page.fill('#edit-pitch','12');await page.fill('#edit-volume','64');await page.click('#hit-apply');
 const changed=JSON.parse((await download('#export')).toString());assert.equal(changed.pattern.events[0].pitch,12);assert.equal(changed.pattern.events[0].gain,.5);
 await page.click('#undo');assert.deepEqual(JSON.parse((await download('#export')).toString()),original);await page.click('#redo');
 await page.locator('#slice-list button').nth(1).click();await page.fill('#marker-time','.3');await page.click('#marker-apply');
 assert.deepEqual(JSON.parse((await download('#export')).toString()),changed); // Existing events keep copied boundaries.
 await page.getByRole('button',{name:'Enter kick at row 1',exact:true}).click();await page.selectOption('#edit-sound','slice');await page.fill('#edit-pitch','0');await page.check('#keyboard-entry');await page.locator('#grid').focus();await page.keyboard.press('z');
 const entered=JSON.parse((await download('#export')).toString());assert.equal(entered.pattern.events.length,5);assert.ok(entered.pattern.events.find(h=>h.role==='kick').slice);
 await page.locator('.hit.kick').click();await page.check('#lock-kick');await page.fill('#edit-volume','10');await page.click('#hit-apply');
 assert.deepEqual(JSON.parse((await download('#export')).toString()),entered);await page.uncheck('#lock-kick');
 await page.locator('.hit.kick').click();await page.keyboard.press('Delete');assert.equal(await page.locator('.hit.kick').count(),0);
 await page.click('#sample-remove');assert.equal(await page.locator('.hit').count(),4);await page.click('#play');assert.equal(await page.locator('#play').textContent(),'Stop');await page.click('#play'); // References retain audio for history.
 await page.screenshot({path:'test-results/tracker-slices.png',fullPage:true});
 await page.setViewportSize({width:390,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('Tracker: reconstruction, slice preview/export, exact undo, boundary snapshots, keyboard entry/delete, locks and retained audio passed.');
}finally{await browser.close();}
