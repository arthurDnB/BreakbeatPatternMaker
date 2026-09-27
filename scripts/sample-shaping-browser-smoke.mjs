import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {LIBRARY} from '../dist/audio/library.js';

const root=resolve('site');
const server=createServer(async(request,response)=>{
 try{
  const relative=decodeURIComponent(new URL(request.url,'http://local').pathname.slice(1))||'index.html';
  const file=resolve(root,relative);if(!file.startsWith(root+sep))throw Error('Outside site');
  const data=await readFile(file);
  response.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.wav':'audio/wav','.json':'application/json'}[extname(file)]??'text/plain'});response.end(data);
 }catch{response.writeHead(404);response.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
 const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.stack??error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#grid .hit.snare').first().waitFor();
 await page.waitForFunction(()=>document.querySelector('#kit-choice-snare').value!=='synth');
 await page.evaluate(()=>{document.querySelector('.track-instrument-panel[data-role="snare"]').open=true;document.querySelector('#kit-shape-snare').open=true;});
 const originalSound=await page.inputValue('#kit-choice-snare');
 const otherSound=originalSound==='synth'?LIBRARY.find(entry=>entry.role==='snare').id:'synth';
 const setRange=async(id,value)=>page.locator(id).evaluate((field,next)=>{field.value=String(next);field.dispatchEvent(new Event('input',{bubbles:true}));},value);
 await setRange('#kit-speed-snare',1.25);
 await page.locator('#kit-source-bpm-snare').fill('110');
 await page.locator('#kit-match-bpm-snare').click();
 assert.equal(await page.inputValue('#kit-speed-snare'),'1.5');
 await setRange('#kit-lowpass-snare',4500);await setRange('#kit-attack-snare',12);await setRange('#kit-decay-snare',.5);
 await page.selectOption('#kit-choice-snare',otherSound);
 await page.waitForFunction(choice=>document.querySelector('#kit-choice-snare').value===choice&&!document.querySelector('#kit-info-snare').textContent.includes('Loading'),otherSound);
 assert.equal(await page.inputValue('#kit-speed-snare'),'1');
 await page.selectOption('#kit-choice-snare',originalSound);
 await page.waitForTimeout(1200);
 assert.equal(await page.inputValue('#kit-choice-snare'),originalSound,await page.locator('#kit-info-snare').textContent());
 assert.equal(await page.inputValue('#kit-speed-snare'),'1.5',await page.locator('#kit-info-snare').textContent());
 await page.evaluate(()=>document.querySelector('.track-instrument-panel[data-role="snare"]').open=false);
 await page.locator('#grid .hit.snare').first().click();
 await page.locator('#hit-editor').evaluate(element=>element.open=true);
 await page.locator('#hit-sample-controls').evaluate(element=>element.open=true);
 await page.locator('#edit-speed-override').check();await setRange('#edit-speed',1.8);
 await page.locator('#edit-lowpass-override').check();await setRange('#edit-lowpass',2300);
 await page.locator('#hit-preview').click();
 await page.locator('#hit-apply').click();
 const download=page.waitForEvent('download');await page.locator('#project-save').click();
 const project=JSON.parse((await readFile(await(await download).path())).toString());
 assert.equal(project.kit.snare.playbackRate,1.5);
 assert.equal(project.kit.snare.sampleProfiles[project.kit.snare.assetId??'synth'].playbackRate,1.5);
 assert.equal(project.kit.snare.lowpassHz,4500);
 assert.equal(project.kit.snare.attackMs,12);
 assert.equal(project.kit.snare.decay,.5);
 const edited=project.editor.pattern.events.find(hit=>hit.playbackRate===1.8);
 assert.ok(edited);assert.equal(edited.lowpassHz,2300);
 await page.evaluate(()=>document.querySelector('.track-instrument-panel[data-role="snare"]').open=true);
 await page.locator('#kit-open-slicer-snare').click();
 assert.equal(await page.locator('#tab-slicer').isVisible(),true);
 assert.equal(await page.locator('#sample-drop').isVisible(),true);
 assert.deepEqual(errors,[]);
 console.log('Sample shaping browser: BPM match, sample settings, hit overrides, preview and project save passed.');
 await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
