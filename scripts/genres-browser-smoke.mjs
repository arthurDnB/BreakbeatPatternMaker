import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {genreDefaults,defaults} from '../dist/core/profiles.js';
import {generate} from '../dist/core/generate.js';
import {Editor} from '../dist/core/editor.js';
import {makeProject} from '../dist/audio/project.js';
import {defaultKitState} from '../dist/audio/drum-kit.js';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1050},acceptDownloads:true}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Saved locally');
 const saved=async()=>{const pending=page.waitForEvent('download');await page.click('#project-save');return JSON.parse(await readFile(await(await pending).path(),'utf8'));};
 assert.equal(await page.inputValue('#algorithm'),'groove-v2');assert.equal(await page.locator('#genre option').count(),38);assert.equal(await page.locator('#genre optgroup').count(),6);
 await page.click('#show-sounds');await page.uncheck('#auto-kit');await page.selectOption('#kit-choice-kick','synth');
 await page.click('#advanced-generation > summary');
 const songBpm=(await saved()).bank.songBpm;
 for(const genre of ['lofihiphop','dub','twostepgarage','drumfunk','amenscience','atmosphericbreakcore','neurofunk']){
  await page.selectOption('#genre',genre);const d=genreDefaults(genre);
  for(const key of ['bpm','swing','resolution','complexity','ghostAmount','fillAmount','spicy'])assert.equal(Number(await page.inputValue('#'+key)),d[key],genre+':'+key);
  assert.equal(await page.inputValue('#kit-choice-kick'),'synth');
  await page.click('#generate');const p=await saved();assert.equal(p.editor.pattern.settings.genre,genre);assert.equal(p.editor.pattern.engineVersion,'0.2.0-groove.1');assert.equal(p.bank.songBpm,songBpm);
 }
 await page.check('#lock-kick');const before=await saved();
 await page.click('#action-variation');const after=await saved();assert.equal(after.editor.pattern.settings.variation,1);assert.equal(after.editor.pattern.settings.seed,before.editor.pattern.settings.seed);
 assert.deepEqual(after.editor.pattern.events.filter(h=>h.role==='kick'),before.editor.pattern.events.filter(h=>h.role==='kick'));
 await page.click('#undo');assert.deepEqual((await saved()).editor.pattern,before.editor.pattern);await page.click('#redo');assert.deepEqual((await saved()).editor.pattern,after.editor.pattern);
 const e=new Editor(generate(defaults()));const legacy=makeProject(e.state,defaults(),defaultKitState(),new Map());legacy.version=1;
 await page.setInputFiles('#project-open',{name:'legacy.bbproject',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Project opened'));
 assert.equal(await page.inputValue('#algorithm'),'legacy-v1');assert.equal(await page.locator('#algorithm option[value="legacy-v1"]').isEnabled(),true);
 await page.click('#generate');assert.deepEqual((await saved()).editor.pattern.events,e.state.pattern.events);
 await page.selectOption('#genre','boombap');await page.click('#generate');await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Saved locally');await page.reload();
 await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Restored local workspace');assert.equal(await page.inputValue('#genre'),'boombap');assert.equal(await page.inputValue('#algorithm'),'groove-v2');
 await page.click('#advanced-generation > summary');await page.screenshot({path:'test-results/genre-engine.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Genre browser: grouped styles, defaults, custom kit, independent song tempo, one-click variation history, legacy reproduction and persistence passed.');
}finally{await browser.close();}
