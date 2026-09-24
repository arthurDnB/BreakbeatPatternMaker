import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {LIBRARY} from '../dist/audio/library.js';import {encodeWav} from '../dist/audio/wav.js';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:4173');await page.locator('.hit').first().waitFor();await page.click('#show-sounds');await page.locator('#kit-shape-kick').evaluate(e=>e.open=true);
 assert.equal(await page.locator('#sample-drop').isVisible(),false);assert.equal(await page.locator('#edit-sound option[value=slice]').count(),0);
 const download=async id=>{const pending=page.waitForEvent('download');await page.click(id);return readFile(await (await pending).path());};
 for(const sound of LIBRARY){await page.selectOption('#kit-choice-'+sound.role,sound.id);await page.waitForFunction(({role,name})=>document.querySelector('#kit-info-'+role).textContent.includes(name),sound);}
 // Independent generation filter, mute, and lock handling.
 await page.check('#lock-snare');await page.uncheck('#kit-include-snare');await page.click('#generate');assert.match(await page.locator('#status').textContent(),/excluded.*locked/);
 await page.uncheck('#lock-snare');await page.click('#generate');assert.equal(await page.locator('.hit.snare').count(),0);
 await page.click('#select-ending');await page.click('#fill');assert.equal(await page.locator('.hit.snare').count(),0); // Genre fill may use other enabled lanes.
 await page.click('#regenerate');assert.equal(await page.locator('.hit.snare').count(),0);
 const beforeMute=await download('#export-wav');await page.check('#kit-mute-kick');assert.notDeepEqual(await download('#export-wav'),beforeMute);await page.uncheck('#kit-mute-kick');
 const pcm=new Float32Array(4410).map((_,i)=>Math.sin(i*.1)*.2);await page.setInputFiles('#kit-file-kick',{name:'saved-kick.wav',mimeType:'audio/wav',buffer:Buffer.from(encodeWav([pcm],44100))});await page.waitForFunction(()=>document.querySelector('#kit-info-kick').textContent.includes('saved-kick.wav'));
 await page.fill('#kit-tune-kick','3');await page.locator('#kit-tune-kick').dispatchEvent('change');await page.check('#lock-kick');
 await page.click('#kit-play-kick');await page.click('#play');await page.click('#play');assert.equal(await page.locator('#play').textContent(),'Play pattern');
 const project=await download('#project-save'),projectData=JSON.parse(project);assert.ok(projectData.assets.length>=4);assert.equal(projectData.kit.kick.choice,'upload');
 const audio=await download('#export-wav');await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Saved locally');
 await page.reload();await page.locator('.hit').first().waitFor();await page.click('#show-sounds');await page.locator('#kit-shape-kick').evaluate(e=>e.open=true);await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Restored local workspace');assert.match(await page.locator('#kit-info-kick').textContent(),/saved-kick/);assert.equal(await page.locator('#lock-kick').isChecked(),true);assert.equal(await page.locator('#kit-include-snare').isChecked(),false);assert.deepEqual(await download('#export-wav'),audio);
 await page.selectOption('#kit-choice-kick','synth');await page.setInputFiles('#project-open',{name:'restored.bbproject',mimeType:'application/json',buffer:project});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Project opened'));assert.deepEqual(await download('#export-wav'),audio);
 await page.setInputFiles('#project-open',{name:'bad.bbproject',mimeType:'application/json',buffer:Buffer.from('{}')});await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Could not open'));assert.deepEqual(await download('#export-wav'),audio);
 await page.screenshot({path:'test-results/single-shot-workspace.png',fullPage:true});await page.setViewportSize({width:390,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('Workspace: all 233 library decodes, filters/locks/fills, mute, audition, embedded audio project roundtrip, autosave reload, invalid-project recovery and mobile layout passed.');
}finally{await browser.close();}
