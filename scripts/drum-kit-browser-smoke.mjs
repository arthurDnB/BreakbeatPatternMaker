import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {encodeWav} from '../dist/audio/wav.js';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173');await page.locator('.hit').first().waitFor();
 const download=async id=>{const pending=page.waitForEvent('download');await page.click(id);return readFile(await (await pending).path());};
 const before=await download('#export'),originalAudio=await download('#export-wav');
 for(const role of ['kick','snare','hat','percussion']){
  const samples=Float32Array.from({length:4410},(_,i)=>Math.sin(i*.17)*.2);
  await page.setInputFiles('#kit-file-'+role,{name:role+'-custom.wav',mimeType:'audio/wav',buffer:Buffer.from(encodeWav([samples],44100))});
  await page.waitForFunction(r=>document.querySelector('#kit-info-'+r).textContent.includes('Active in tracker'),role);
  assert.equal(await page.locator('#kit-use-'+role).isChecked(),true);
 }
 assert.match(await page.locator('.hit.kick').first().textContent(),/kick-custom/);
 const mapped=JSON.parse((await download('#export')).toString());assert.ok(mapped.pattern.events.every(h=>h.slice));assert.notDeepEqual(await download('#export-wav'),originalAudio);
 await page.click('#kit-play-kick');await page.click('#play');assert.equal(await page.locator('#play').textContent(),'Stop');await page.click('#play');
 await page.setInputFiles('#kit-file-snare',{name:'bad.wav',mimeType:'audio/wav',buffer:Buffer.from('bad')});await page.waitForFunction(()=>document.querySelector('#kit-info-snare').textContent.includes('Previous instrument kept'));
 assert.equal(await page.locator('#kit-use-snare').isChecked(),true);assert.match(await page.locator('.hit.snare').first().textContent(),/snare-custom/);
 await page.click('#generate');assert.ok(JSON.parse((await download('#export')).toString()).pattern.events.every(h=>h.slice));
 for(const role of ['kick','snare','hat','percussion'])await page.uncheck('#kit-use-'+role);
 assert.deepEqual(await download('#export'),before);assert.deepEqual(await download('#export-wav'),originalAudio);
 await page.check('#kit-use-kick');await page.click('#kit-remove-kick');assert.equal(await page.locator('#kit-use-kick').isDisabled(),true);
 await page.screenshot({path:'test-results/drum-kit.png',fullPage:true});await page.setViewportSize({width:390,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('Drum kit: separate uploads, activation, grid labels, preview/export, regeneration, fallback, invalid-file recovery and mobile layout passed.');
}finally{await browser.close();}
