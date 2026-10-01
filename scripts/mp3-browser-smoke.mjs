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
  const page=await browser.newPage({acceptDownloads:true});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#grid .hit').first().waitFor();
  async function exportAudio(format){
    const download=page.waitForEvent('download',{timeout:60000});
    await page.click(format==='mp3'?'#export-mp3':'#export-wav');
    const file=await download;return {name:file.suggestedFilename(),bytes:await readFile(await file.path())};
  }
  const wav=await exportAudio('wav'),mp3=await exportAudio('mp3');
  assert.equal(wav.bytes.toString('ascii',0,4),'RIFF');
  assert.match(mp3.name,/\.mp3$/);assert.ok(mp3.bytes.length>1000&&mp3.bytes.length<wav.bytes.length);
  const decoded=await page.evaluate(async bytes=>{
    const context=new AudioContext();
    try{const buffer=await context.decodeAudioData(new Uint8Array(bytes).buffer);let peak=0;for(const value of buffer.getChannelData(0))peak=Math.max(peak,Math.abs(value));return {channels:buffer.numberOfChannels,duration:buffer.duration,peak};}
    finally{await context.close();}
  },[...mp3.bytes]);
  assert.equal(decoded.channels,2);assert.ok(decoded.duration>1&&decoded.peak>.01);
  await page.selectOption('#export-target','song');
  const song=await exportAudio('mp3');assert.match(song.name,/arrangement\.mp3$/);
  assert.ok(song.bytes.length>1000);
  assert.deepEqual(errors,[]);
  console.log('MP3 pattern and song export, playback decoding, and WAV coexistence passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
