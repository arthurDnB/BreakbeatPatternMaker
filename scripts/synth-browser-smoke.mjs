import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const root=resolve('site');
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const path=resolve(root,decodeURIComponent(pathname.slice(1))||'index.html');
 if(!path.startsWith(root+sep))throw Error('Outside site');
 const bytes=await readFile(path);
 res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.wav':'audio/wav'}[extname(path)]??'application/octet-stream'});res.end(bytes);
}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#grid .hit').first().waitFor();
 await page.click('#add-synth-track');
 const lane=page.locator('.synth-track-col');await lane.waitFor();const trackId=await lane.getAttribute('data-track-id');assert.ok(trackId);
 assert.equal(await page.locator('#synth-octave-label').isVisible(),true);
 await lane.locator('.track-instrument-panel > summary').click();
 const panel=page.locator(`.synth-track-col[data-track-id="${trackId}"] .synth-instrument-card`);assert.equal(await panel.isVisible(),true);
 await panel.locator('select').first().selectOption('pluck');
 await page.locator(`.synth-track-col[data-track-id="${trackId}"] .track-instrument-panel > summary`).click();
 await page.locator(`#grid .empty-cell[data-cell-row="0"][data-cell-lane="${trackId}"]`).click();
 await page.click('#quick-insert-hit');
 const synthHit=page.locator(`#grid .hit[data-cell-lane="${trackId}"]`);await synthHit.first().waitFor();
 assert.equal(await lane.locator('.tracker-value').count(),0); // Header never absorbs tracker note fields.
 assert.equal(await page.locator(`#grid .tracker-value[data-field="instrument"][data-cell-lane="${trackId}"]`).first().textContent(),'SYN');
 await synthHit.first().click();await page.locator('#hit-editor').evaluate(element=>element.open=true);
 assert.equal(await page.locator('#edit-synth-note').isVisible(),true);
 await page.locator('#edit-synth-note').fill('60');await page.locator('#edit-synth-length').selectOption('1920');await page.click('#hit-apply');
 assert.equal(await page.locator(`#grid .tracker-value[data-field="note"][data-cell-lane="${trackId}"]`).first().textContent(),'C-5');
 await page.click('#undo');assert.equal(await page.locator(`#grid .tracker-value[data-field="note"][data-cell-lane="${trackId}"]`).first().textContent(),'C-4');
 await page.click('#redo');assert.equal(await page.locator(`#grid .tracker-value[data-field="note"][data-cell-lane="${trackId}"]`).first().textContent(),'C-5');
 await page.click('#generate');assert.equal(await page.locator(`#grid .hit[data-cell-lane="${trackId}"]`).count(),1);
 const save=page.waitForEvent('download');await page.click('#project-save');const bytes=await readFile(await(await save).path());
 const project=JSON.parse(bytes.toString());assert.equal(project.version,6);
 assert.equal(project.editor.pattern.userTracks.find(track=>track.id===trackId).instrument.preset,'pluck');
 assert.equal(project.editor.pattern.events.find(event=>event.trackId===trackId).synthNote.note,60);
 assert.equal(project.editor.pattern.events.find(event=>event.trackId===trackId).synthNote.durationTicks,1920);
 const wav=page.waitForEvent('download');await page.click('#export-wav');const wavBytes=await readFile(await(await wav).path());assert.equal(wavBytes.toString('ascii',0,4),'RIFF');
 await page.setInputFiles('#project-open',{name:'synth-test.bbproject',mimeType:'application/json',buffer:bytes});
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Project opened'));
 assert.equal(await page.locator(`#grid .tracker-value[data-field="note"][data-cell-lane="${trackId}"]`).first().textContent(),'C-5');
 await page.locator(`#grid .empty-cell[data-cell-row="2"][data-cell-lane="${trackId}"]`).click();await page.keyboard.press('z');
 assert.equal(await page.locator(`#grid .tracker-value[data-field="note"][data-cell-row="2"][data-cell-lane="${trackId}"]`).first().textContent(),'C-4');
 await page.locator(`#grid .hit[data-cell-row="2"][data-cell-lane="${trackId}"]`).first().click();await page.keyboard.press('Control+Enter');
 assert.equal(await page.locator(`#grid .hit[data-cell-row="2"][data-cell-lane="${trackId}"]`).count(),2);
 assert.deepEqual(errors,[]);
 console.log('Synth browser: track creation, preset, keyboard notes and chords, note length, undo/redo, generation, project roundtrip and WAV export passed.');
 await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
