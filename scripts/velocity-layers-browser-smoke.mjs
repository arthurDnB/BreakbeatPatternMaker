import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=resolve('site');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wav':'audio/wav','.json':'application/json'};
const server=createServer(async(request,response)=>{
  try{
    const file=resolve(root,decodeURIComponent(new URL(request.url,'http://local').pathname).slice(1)||'index.html');
    if(!file.startsWith(root+sep))throw Error('Invalid path');
    const body=await readFile(file);
    response.writeHead(200,{'Content-Type':mime[extname(file)]??'text/plain'});
    response.end(body);
  }catch{response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
  const page=await browser.newPage({acceptDownloads:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('bpm_tutorial_dismissed', '1'));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#grid .hit').first().waitFor();
  await page.selectOption('#kit-preset-select','acoustic-break');
  await page.waitForFunction(()=>['kick','snare'].every(role=>document.querySelector('#kit-info-'+role)?.textContent?.includes('3 velocity layers')));
  const save=page.waitForEvent('download');
  await page.click('#project-save');
  const project=JSON.parse(await readFile(await(await save).path(),'utf8'));
  for(const role of ['kick','snare'])for(const band of ['soft','medium','accent']){
    const layer=project.kit[role].velocityLayers[band];
    assert.ok(layer.slice.assetId.startsWith('library-'));
    assert.ok(project.assets.some(asset=>asset.id===layer.slice.assetId));
  }
  await page.setInputFiles('#project-open',{name:'velocity-layers.bbproject',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Project opened'));
  assert.ok((await page.locator('#kit-info-snare').textContent()).includes('3 velocity layers'));
  const wavDownload=page.waitForEvent('download');
  await page.click('#export-wav');
  const wav=await readFile(await(await wavDownload).path());
  assert.equal(wav.toString('ascii',0,4),'RIFF');
  await page.locator('.track-instrument-panel[data-role="kick"]>summary').click();
  await page.selectOption('#kit-choice-kick','acoustic-kick-clean');
  await page.waitForFunction(()=>!document.querySelector('#kit-info-kick')?.textContent?.includes('3 velocity layers'));
  const manualSave=page.waitForEvent('download');
  await page.click('#project-save');
  const manualProject=JSON.parse(await readFile(await(await manualSave).path(),'utf8'));
  assert.equal(manualProject.kit.kick.velocityLayers,undefined);
  assert.deepEqual(errors,[]);
  console.log('Velocity-layer preset, project audio, WAV export, and manual fallback passed.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
