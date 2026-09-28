import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

function sampleWav(){
 const frames=4000,buffer=Buffer.alloc(44+frames*2);buffer.write('RIFF',0);buffer.writeUInt32LE(buffer.length-8,4);buffer.write('WAVE',8);buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(8000,24);buffer.writeUInt32LE(16000,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(frames*2,40);
 for(let i=0;i<frames;i++)buffer.writeInt16LE(Math.round(Math.sin(i*.16)*10000),44+i*2);return buffer;
}

const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');await page.locator('.hit').first().waitFor();
 await page.click('#add-user-track');await page.setInputFiles('#user-track-file',{name:'test-texture.wav',mimeType:'audio/wav',buffer:sampleWav()});
 await page.locator('.user-track-name').filter({hasText:'test-texture'}).waitFor();
 const trackId=await page.locator('.user-track-col').getAttribute('data-track-id');assert.ok(trackId);
 await page.locator(`#grid [data-cell-row="0"][data-cell-lane="${trackId}"].empty-cell`).click();await page.click('#quick-insert-hit');
 const hitSelector=`#grid .hit[data-cell-lane="${trackId}"]`;await page.locator(hitSelector).first().waitFor();
 const firstId=await page.locator(hitSelector).first().getAttribute('data-hit');
 await page.click('#undo');assert.equal(await page.locator(hitSelector).count(),0);await page.click('#redo');assert.equal(await page.locator(hitSelector).count(),1);
 await page.locator('#grid').focus();await page.keyboard.press('ArrowDown');const cursor=page.locator('#grid tr[data-play-row="2"] td.cursor-cell');assert.equal(await cursor.getAttribute('data-drop-lane'),trackId);
 await page.click('#generate');
 const jsonDownload=page.waitForEvent('download');if(!await page.locator('#more-actions').evaluate(e=>e.open))await page.click('#more-actions > summary');await page.click('#export');const transfer=JSON.parse(await readFile(await(await jsonDownload).path(),'utf8'));assert.ok(transfer.lanes.some(l=>l.id===trackId));assert.ok(transfer.notes.some(n=>n.id===firstId&&n.lane===trackId));
 const saveDownload=page.waitForEvent('download');await page.click('#project-save');const project=JSON.parse(await readFile(await(await saveDownload).path(),'utf8'));assert.ok(project.editor.pattern.userTracks.some(t=>t.id===trackId));assert.ok(project.assets.some(a=>a.id===trackId));assert.deepEqual(errors,[]);
 console.log('User-track browser smoke: WAV upload, custom tracker lane, keyboard navigation, note entry, undo/redo, generator preservation, JSON lane export, and project sample embedding passed.');
 await context.close();
}finally{await browser.close();}
