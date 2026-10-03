import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {LIBRARY} from '../dist/audio/library.js';

const root=resolve('site');
const server=createServer(async(request,response)=>{
 try{
  const url=new URL(request.url,'http://localhost');
  const relative=decodeURIComponent(url.pathname.slice(1))||'index.html';
  const file=resolve(root,relative);
  if(!file.startsWith(root+sep))throw Error('Outside site');
  const data=await readFile(file);
  response.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.wav':'audio/wav','.json':'application/json'}[extname(file)]??'text/plain'});
  response.end(data);
 }catch{response.writeHead(404);response.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
 const context=await browser.newContext({acceptDownloads:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#grid .hit').first().waitFor();
 assert.equal(await page.inputValue('#algorithm'),'groove-v5','new workspaces default to V5');
 await page.click('#tab-generator');
 await page.locator('#advanced-generation>summary').click();
 assert.equal(await page.inputValue('#hat-density'),'1');
 await page.locator('#hat-density').fill('2');
 assert.equal(await page.locator('#hat-density-value').textContent(),'200%');
 await page.selectOption('#algorithm','groove-v3');
 assert.equal(await page.locator('#hat-density').isDisabled(),true);
 await page.selectOption('#algorithm','groove-v4');
 assert.equal(await page.inputValue('#algorithm'),'groove-v4');
 assert.equal(await page.locator('#hat-density').isDisabled(),false);
 await page.selectOption('#genre','amenscience');
 assert.equal(await page.inputValue('#hat-density'),'1','Genre defaults should restore neutral density');
 await page.locator('#hat-density').fill('2');
 await page.locator('#generate').click();
 await page.waitForFunction(()=>document.querySelector('#grid .hit'));
 assert.equal(await page.inputValue('#algorithm'),'groove-v4');
 const projectDownload=page.waitForEvent('download');
 await page.locator('#project-save').click();
 const project=JSON.parse((await readFile(await(await projectDownload).path())).toString());
 assert.equal(project.editor.pattern.settings.algorithm,'groove-v4');
 assert.equal(project.editor.pattern.settings.laneDensity.hat,2);
 assert.equal(project.draft.laneDensity.hat,2);
 assert.ok(project.editor.pattern.events.length>0);
 await page.setInputFiles('#project-open',{name:'density.bbproject',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Project opened'));
 assert.equal(await page.inputValue('#hat-density'),'2');
 for(const role of ['kick','snare','hat','percussion']){
  const sound=LIBRARY.filter(item=>item.role===role).at(-1);
  await page.evaluate(value=>{document.querySelector(`.track-instrument-panel[data-role="${value}"]`).open=true;},role);
  await page.selectOption('#kit-choice-'+role,sound.id);
  await page.waitForFunction(({role,name})=>document.querySelector('#kit-info-'+role).textContent.includes(name),sound);
 }
 await page.evaluate(()=>document.querySelectorAll('.track-instrument-panel').forEach(panel=>panel.open=false));
 const wavDownload=page.waitForEvent('download',{timeout:10000}).catch(()=>undefined);
 await page.locator('#export-wav').click();
 const wav=await wavDownload;
 assert.ok(wav,`WAV export failed: ${await page.locator('#status').textContent()} ${errors.join('; ')}`);
 const bytes=await readFile(await wav.path());
 assert.equal(bytes.toString('ascii',0,4),'RIFF');
 assert.deepEqual(errors,[]);
 console.log('Groove engine browser: V5 default, V4 selection, generation, project save and WAV export passed.');
 await context.close();
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
