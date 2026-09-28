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
 const context=await browser.newContext({viewport:{width:1440,height:950},acceptDownloads:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.locator('#grid .hit').first().waitFor();
 const save=async()=>{const download=page.waitForEvent('download');await page.click('#project-save');return JSON.parse((await readFile(await(await download).path())).toString());};
 assert.equal(await page.locator('#melody-options').isVisible(),false);
 await page.selectOption('#generationMode','both');assert.equal(await page.locator('#melody-options').isVisible(),true);
 await page.selectOption('#melodyPart','lead');await page.selectOption('#melodyKey','2');await page.selectOption('#melodyScale','blues');
 await page.click('#generate');
 const first=await save();
 const lead=first.editor.pattern.userTracks.find(track=>track.generatedPart==='lead');assert.ok(lead);
 const firstNotes=first.editor.pattern.events.filter(hit=>hit.trackId===lead.id),firstDrums=first.editor.pattern.events.filter(hit=>!hit.trackId);
 assert.ok(firstNotes.length&&firstDrums.length);
 assert.equal(first.editor.pattern.settings.generationMode,'both');assert.equal(first.editor.pattern.settings.melodyScale,'blues');
 await page.selectOption('#generationMode','drums');await page.locator('#advanced-generation>summary').click();await page.fill('#seed','browser-new-drums');await page.click('#generate');
 const drumOnly=await save();
 assert.deepEqual(drumOnly.editor.pattern.events.filter(hit=>hit.trackId===lead.id),firstNotes);
 assert.notDeepEqual(drumOnly.editor.pattern.events.filter(hit=>!hit.trackId),firstDrums);
 await page.selectOption('#generationMode','melody');await page.fill('#seed','browser-new-melody');await page.click('#generate');
 const melodyOnly=await save();
 assert.deepEqual(melodyOnly.editor.pattern.events.filter(hit=>!hit.trackId),drumOnly.editor.pattern.events.filter(hit=>!hit.trackId));
 assert.notDeepEqual(melodyOnly.editor.pattern.events.filter(hit=>hit.trackId===lead.id),firstNotes);
 await page.click('#undo');assert.deepEqual((await save()).editor.pattern,drumOnly.editor.pattern);
 await page.click('#redo');assert.deepEqual((await save()).editor.pattern,melodyOnly.editor.pattern);
 const wav=page.waitForEvent('download');await page.click('#export-wav');assert.equal((await readFile(await(await wav).path())).toString('ascii',0,4),'RIFF');
 await page.setInputFiles('#project-open',{name:'melody.bbproject',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(melodyOnly))});
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Project opened'));
 assert.equal(await page.inputValue('#generationMode'),'melody');assert.equal(await page.inputValue('#melodyScale'),'blues');
 assert.equal(await page.locator(`.synth-track-col[data-track-id="${lead.id}"]`).count(),1);
 assert.deepEqual(errors,[]);
 console.log('Melody browser: three generation modes, scale controls, Undo/Redo, project roundtrip and WAV passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
