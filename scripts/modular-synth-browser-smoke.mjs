import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const root=resolve('site');
const server=createServer(async(req,res)=>{try{
 const path=resolve(root,decodeURIComponent(new URL(req.url,'http://local').pathname.slice(1))||'index.html');
 if(!path.startsWith(root+sep))throw Error('Outside site');
 const bytes=await readFile(path);
 res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.wav':'audio/wav','.json':'application/json'}[extname(path)]??'application/octet-stream'});res.end(bytes);
}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(() => localStorage.setItem('bpm_tutorial_dismissed', '1'));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#grid .hit').first().waitFor();
 for(const [id,value] of [['pianoLushness','0.8'],['pianoTension','0.2'],['pianoDensity','0.25']]){
  await page.locator(`#${id}`).evaluate((element,next)=>{element.value=next;element.dispatchEvent(new Event('input',{bubbles:true}));},value);
  assert.equal(await page.locator(`#${id}-value`).textContent(),Math.round(Number(value)*100)+'%');
 }
 await page.click('#generate-piano');await page.locator('.synth-track-col').first().waitFor();
 await page.click('#add-synth-track');const lane=page.locator('.synth-track-col').last();await lane.waitFor();
 const id=await lane.getAttribute('data-track-id');assert.ok(id);
 await lane.locator('.track-instrument-panel > summary').click();
 await lane.locator('.synth-patch-open').click();
 const dialog=page.locator('#synth-patch-dialog');assert.equal(await dialog.isVisible(),true);
 assert.ok(await dialog.locator('.synth-module').count()>=7);
 await dialog.getByRole('button',{name:'Use this patch'}).click();
 await dialog.locator('[data-node-id="lfo"] [data-port-direction="out"][data-port="out"]').click();
 await dialog.locator('[data-node-id="filter"] [data-port-direction="in"][data-port="cutoff"]').click();
 assert.match(await dialog.locator('.synth-patch-cables h3').textContent(),/7/);
 const from=await dialog.locator('[data-node-id="lfo"] [data-port-direction="out"][data-port="out"]').boundingBox();
 const to=await dialog.locator('[data-node-id="source-a"] [data-port-direction="in"][data-port="pitch"]').boundingBox();
 await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();
 await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:8});await page.mouse.up();
 assert.match(await dialog.locator('.synth-patch-cables h3').textContent(),/8/,'dragging a cable should connect two ports');
 await dialog.locator('[data-node-id="filter"] input[type="number"]').first().fill('1800');
 await dialog.locator('[data-node-id="filter"] input[type="number"]').first().press('Tab');
 await dialog.locator('.synth-patch-toolbar input').fill('Warm bass');
 await dialog.getByRole('button',{name:'Save preset'}).click();
 await dialog.getByRole('button',{name:'Preview'}).click();
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Previewing synth track'));
 await dialog.getByRole('button',{name:'Close'}).click();
 const saved=page.waitForEvent('download');await page.click('#project-save');
 const bytes=await readFile(await(await saved).path()),project=JSON.parse(bytes.toString());
 assert.equal(project.version,9);
 assert.equal(project.draft.pianoLushness,.8);assert.equal(project.draft.pianoTension,.2);assert.equal(project.draft.pianoDensity,.25);
 const track=project.editor.pattern.userTracks.find(item=>item.id===id);assert.ok(track.instrument.patch);
 assert.equal(track.instrument.patch.cables.length,8);
 await page.setInputFiles('#project-open',{name:'modular.bbproject',mimeType:'application/json',buffer:bytes});
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Project opened'));
 await page.locator(`.synth-track-col[data-track-id="${id}"] .track-instrument-panel`).evaluate(element=>element.open=true);
 await page.locator(`.synth-track-col[data-track-id="${id}"] .synth-patch-open`).click();
 assert.equal(await page.locator('#synth-patch-dialog .synth-patch-toolbar select[aria-label="Saved patch"] option').count(),2);
 await page.locator('#synth-patch-dialog').getByRole('button',{name:'Close'}).click();
 await page.waitForFunction(()=>document.querySelector('#save-status')?.textContent==='Saved locally');
 await page.reload();await page.locator(`.synth-track-col[data-track-id="${id}"]`).waitFor();
 await page.locator(`.synth-track-col[data-track-id="${id}"] .track-instrument-panel`).evaluate(element=>element.open=true);
 await page.locator(`.synth-track-col[data-track-id="${id}"] .synth-patch-open`).click();
 assert.equal(await page.locator('#synth-patch-dialog .synth-patch-toolbar select[aria-label="Saved patch"] option').count(),2,'saved presets survive reload');
 assert.deepEqual(errors,[]);
 console.log('Modular synth canvas, cables, exact parameters, preset save, preview and project v9 passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
