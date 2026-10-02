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
const url=`http://127.0.0.1:${server.address().port}/`;
const box=async(page,selector)=>page.locator(selector).boundingBox();
try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  await page.goto(url);
  await page.locator('#grid .hit').first().waitFor();
  assert.equal(await page.locator('#tray-bottom').evaluate(el=>el.classList.contains('tray-bottom-collapsed')),true,'Generator starts collapsed');
  const triggersParent=await page.locator('#generate').evaluate(el=>el.closest('#transport')!==null);
  assert.equal(triggersParent,true,'#generate must be docked inside #transport');
  assert.equal(await page.locator('#generate').isVisible(),true,'#generate must be visible when drawer is collapsed');
  assert.equal(await page.locator('#generate-bass').isVisible(),true,'#generate-bass must be visible when drawer is collapsed');
  assert.equal(await page.locator('#generate-melody').isVisible(),true,'#generate-melody must be visible when drawer is collapsed');
  assert.equal(await page.locator('#generate-piano').isVisible(),true,'#generate-piano must be visible when drawer is collapsed');
  assert.equal(await page.locator('#regenerate').isVisible(),true,'#regenerate must be visible when drawer is collapsed');
  const stage=await box(page,'#stage-center');
  const grid=await box(page,'#grid');
  assert.ok(stage.height>600&&grid.height>500,'Tracker should fill the workspace');
  const play=await box(page,'#play');
  const genBtn=await box(page,'#generate');
  assert.ok(genBtn.x < play.x, '#generate button must be placed to the left of Play');
  assert.ok(Math.abs(play.x+play.width/2-960)<3,'Play button stays centered in the viewport');
  await page.click('#tab-generator');
  const openedPlay=await box(page,'#play');
  const openedGrid=await box(page,'#grid');
  assert.equal(openedPlay.x,play.x,'Opening generator must not move Play');
  assert.ok(openedGrid.height>=grid.height-3,`Generator drawer must not shrink the tracker (${grid.height} → ${openedGrid.height})`);
  await page.click('#tab-fx-chain');
  assert.equal(await page.locator('#dsp-dock').isVisible(),true);
  assert.equal(await page.locator('#re-track-dsp-panel').evaluate(el=>el.parentElement.id),'dsp-dock-body');
  const effects=await page.locator('.dsp-dock .stompbox-unit').all();
  assert.equal(effects.length,5);
  const first=await effects[0].boundingBox();
  const second=await effects[1].boundingBox();
  assert.ok(second.y>first.y,'DSP effects should stack vertically in the inspector');
  await page.click('#close-dsp-dock');
  await page.click('#tab-generator');
  await page.click('#play');
  const playingPlay=await box(page,'#play');
  assert.equal(playingPlay.x,play.x,'Playback state must not move Play');
  assert.equal(playingPlay.y,play.y,'Playback state must not move Play vertically');
  await page.click('#play');
  await page.close();

  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await mobile.goto(url);
  await mobile.locator('#grid .hit').first().waitFor();
  const mobilePlay=await box(mobile,'#play');
  assert.ok(mobilePlay&&mobilePlay.y>700&&mobilePlay.y+mobilePlay.height<=844,`Mobile Play should stay fixed at the bottom (${JSON.stringify(mobilePlay)})`);
  assert.ok(Math.abs(mobilePlay.x+mobilePlay.width/2-195)<3,'Mobile Play should stay centered');
  const mobileSelection=await box(mobile,'#tracker-selection-menu>summary');
  assert.ok(mobileSelection.x>=0&&mobileSelection.x+mobileSelection.width<=390,'Mobile selection menu should fit within the viewport');
  assert.ok((await box(mobile,'#stage-center')).height>500,'Mobile tracker should keep its full height');
  await mobile.locator('#tracker-selection-menu>summary').click();
  assert.equal(await mobile.locator('#lock-kick').isVisible(),true);
  await mobile.close();
  console.log('Workstation layout checks passed.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
