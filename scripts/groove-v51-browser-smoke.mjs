import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=resolve('site');
const server=createServer(async(request,response)=>{
  try{
    const file=resolve(root,decodeURIComponent(new URL(request.url,'http://local').pathname).slice(1)||'index.html');
    if(!file.startsWith(root+sep))throw Error('Invalid path');
    const body=await readFile(file);
    response.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.wav':'audio/wav','.json':'application/json'}[extname(file)]??'text/plain'});
    response.end(body);
  }catch{response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('bpm_tutorial_dismissed','1'));
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#grid .hit').first().waitFor();
 await page.click('#tab-generator');
 assert.equal(await page.inputValue('#algorithm'),'groove-v5');
 await page.selectOption('#algorithm','groove-v5.1');
 await page.selectOption('#timeSignature','7/8');await page.selectOption('#meter-lpb','4');
 await page.selectOption('#bars','2');await page.click('#generate');
 await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('28 rows'));
 assert.match(await page.locator('#summary').textContent(),/7\/8/);
 assert.deepEqual(await page.locator('#grid tr.bar-start').evaluateAll(rows=>rows.map(r=>r.dataset.playRow)),['0','14']);
 assert.match(await page.locator('#grid tr[data-play-row="12"] td').nth(1).textContent(),/1\.7/);
 await page.selectOption('#meter-lpb','3');assert.equal(await page.locator('#meter-error').isVisible(),true);
 await page.click('#generate');assert.match(await page.locator('#summary').textContent(),/28 rows/);
 assert.match(await page.locator('#meter-error').textContent(),/whole number/);
 await page.selectOption('#meter-lpb','4');await page.selectOption('#timeSignature','5/4');await page.click('#generate');
 await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('40 rows'));
 await page.click('#undo');assert.match(await page.locator('#summary').textContent(),/7\/8.*28 rows/);
 assert.equal(await page.inputValue('#timeSignature'),'7/8');
 await page.click('#redo');assert.match(await page.locator('#summary').textContent(),/5\/4.*40 rows/);
 await page.selectOption('#timeSignature','custom');await page.fill('#customTimeSignature','11/8');await page.selectOption('#meter-lpb','8');await page.click('#generate');
 await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('88 rows'));
 for(const id of ['generate-bass','generate-melody','generate-piano']){await page.click('#'+id);await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('generated from seed'));}
 await page.click('#play');await page.waitForFunction(()=>document.querySelector('#play').classList.contains('is-playing'));await page.click('#play');
 const backupPromise=page.waitForEvent('download');await page.click('#project-save');const backup=await backupPromise;
 const backupPath=await backup.path(),project=JSON.parse(await readFile(backupPath,'utf8'));
 assert.equal(project.editor.pattern.settings.timeSignature,'11/8');assert.equal(project.editor.pattern.settings.algorithm,'groove-v5.1');
 await page.selectOption('#timeSignature','4/4');await page.click('#generate');
 await page.locator('#project-open').setInputFiles(backupPath);
 await page.waitForFunction(()=>document.querySelector('#summary').textContent.includes('11/8'));
 assert.equal(await page.inputValue('#timeSignature'),'custom');assert.equal(await page.inputValue('#customTimeSignature'),'11/8');
 assert.equal(await page.inputValue('#meter-lpb'),'8');
 const wavPromise=page.waitForEvent('download');await page.click('#export-wav');const wav=await wavPromise;
 const bytes=await readFile(await wav.path());const channels=bytes.readUInt16LE(22),rate=bytes.readUInt32LE(24),duration=bytes.readUInt32LE(40)/(channels*2*rate);
 assert.ok(Math.abs(duration-2*11*.5*60/project.editor.pattern.settings.bpm)<1/rate);
 await page.fill('#customTimeSignature','7/3');assert.match(await page.locator('#meter-error').textContent(),/denominator/);
 await page.fill('#customTimeSignature','32/1');await page.selectOption('#meter-lpb','32');assert.match(await page.locator('#meter-error').textContent(),/512/);
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'test-results/groove-v51-ui.png',fullPage:true});
 console.log('V5.1 browser: controls, LPB errors, bar labels, generation, Undo, project restore, playback and WAV timing passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
