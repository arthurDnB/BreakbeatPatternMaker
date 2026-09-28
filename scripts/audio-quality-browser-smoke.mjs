import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {LIBRARY} from '../dist/audio/library.js';
import {encodeWav} from '../dist/audio/wav.js';

const root=resolve('site');
const server=createServer(async(req,res)=>{
  try{
    const path=new URL(req.url,'http://local').pathname;
    const file=resolve(root,'.'+decodeURIComponent(path==='/'?'/index.html':path));
    if(!file.startsWith(root+sep))throw Error('Outside site');
    const content=await readFile(file);
    res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.wav':'audio/wav','.json':'application/json'}[extname(file)]??'application/octet-stream'});
    res.end(content);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
  const page=await browser.newPage({acceptDownloads:true}),errors=[];
  page.on('pageerror',error=>errors.push(error.stack??error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#grid .hit').first().waitFor();
  await page.waitForFunction(()=>typeof document.querySelector('#project-save').onclick==='function');
  await page.click('#show-sounds');
  await page.locator('.track-instrument-panel[data-role="kick"]').evaluate(node=>node.open=true);
  await page.locator('#kit-shape-kick').evaluate(node=>node.open=true);
  await page.selectOption('#kit-speed-mode-kick','stretch');
  await page.locator('#kit-speed-kick').fill('1.25');
  assert.equal(await page.inputValue('#kit-speed-mode-kick'),'stretch');
  const sound=LIBRARY.find(item=>item.role==='kick'&&!item.id.includes('vinyl'));
  assert.ok(sound);
  await page.locator('#kit-layer-kick').evaluate(node=>node.open=true);
  await page.selectOption('#kit-layer-choice-kick',sound.id);
  await page.waitForFunction(()=>document.querySelector('#kit-layer-status-kick').textContent.includes('Layer ready')||document.querySelector('#kit-layer-status-kick').textContent.includes('Mono check'));
  await page.locator('#kit-layer-level-kick').fill('0.4');
  await page.locator('#kit-layer-offset-kick').fill('3');
  await page.locator('#kit-layer-offset-kick').dispatchEvent('change');
  await page.check('#kit-layer-invert-kick');
  await page.locator('.track-instrument-panel[data-role="kick"]').evaluate(node=>node.open=false);
  let saved;
  try{[saved]=await Promise.all([page.waitForEvent('download',{timeout:15000}),page.click('#project-save')]);}
  catch(error){throw Error(`Project save did not download: ${await page.locator('#status').textContent()} · errors ${errors.join(' | ')} · ${error}`);}
  const project=JSON.parse(await readFile(await saved.path(),'utf8'));
  assert.equal(project.kit.kick.speedMode,'stretch');
  assert.equal(project.kit.kick.layer.choice,sound.id);
  assert.equal(project.kit.kick.layer.offsetMs,3);
  assert.equal(project.kit.kick.layer.phaseInvert,true);
  let wav;
  try{[wav]=await Promise.all([page.waitForEvent('download',{timeout:30000}),page.click('#export-wav')]);}
  catch(error){throw Error(`WAV export did not download: ${await page.locator('#status').textContent()} · ${error}`);}
  assert.equal((await readFile(await wav.path())).toString('ascii',0,4),'RIFF');
  await page.setInputFiles('#project-open',{name:'quality.bbproject',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Project opened'));
  await page.locator('.track-instrument-panel[data-role="kick"]').evaluate(node=>node.open=true);
  await page.locator('#kit-shape-kick').evaluate(node=>node.open=true);
  await page.locator('#kit-layer-kick').evaluate(node=>node.open=true);
  assert.equal(await page.inputValue('#kit-speed-mode-kick'),'stretch');
  assert.equal(await page.inputValue('#kit-layer-choice-kick'),sound.id);
  const upload=(frequency)=>Buffer.from(encodeWav([Float32Array.from({length:4000},(_,i)=>.2*Math.sin(2*Math.PI*frequency*i/8000))],8000));
  await page.setInputFiles('#kit-file-kick',{name:'layer-one.wav',mimeType:'audio/wav',buffer:upload(90)});
  await page.waitForFunction(()=>document.querySelector('#kit-upload-kick').textContent==='Replace WAV');
  await page.selectOption('#kit-layer-choice-kick','upload');
  await page.waitForFunction(()=>document.querySelector('#kit-layer-status-kick').textContent.includes('Mono check'));
  await page.setInputFiles('#kit-file-kick',{name:'layer-two.wav',mimeType:'audio/wav',buffer:upload(120)});
  await page.waitForFunction(()=>document.querySelector('#kit-layer-status-kick').textContent.includes('Mono check'));
  await page.click('#kit-remove-kick');
  assert.equal(await page.inputValue('#kit-layer-choice-kick'),'none');
  assert.deepEqual(errors,[]);
  console.log('Audio quality UI: stretch, layer selection, offset, polarity, upload replacement/removal, WAV and project roundtrip passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
