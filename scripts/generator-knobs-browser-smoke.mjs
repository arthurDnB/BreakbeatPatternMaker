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
    response.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.wav':'audio/wav','.json':'application/json'}[extname(file)]??'text/plain'});
    response.end(await readFile(file));
  }catch{response.writeHead(404);response.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('bpm_tutorial_dismissed','1'));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.click('#tab-generator');
  await page.locator('.gen-knob-shell[data-knob-id="complexity"]').waitFor();
  assert.equal(await page.locator('#controls .gen-knob-shell').count(),17,'all generator ranges should be knobs');

  const row=await Promise.all(['complexity','spicy','reverseProbability'].map(async id=>page.locator(`.gen-knob-shell[data-knob-id="${id}"]`).boundingBox()));
  assert.ok(row.every(Boolean),'dynamics knobs should be visible');
  assert.ok(Math.max(...row.map(box=>box.y))-Math.min(...row.map(box=>box.y))<8,'dynamics knobs should share a row');
  assert.ok(row[0].x<row[1].x&&row[1].x<row[2].x,'dynamics knobs should progress left to right');

  const complexity=page.locator('.gen-knob-dial[data-for="complexity"]');
  await complexity.hover();
  const help=page.locator('#gen-knob-help-complexity');
  await help.waitFor({state:'visible'});
  assert.match(await help.textContent(),/Complexity.*rhythmic detail/i);
  const helpBox=await help.boundingBox();
  assert.ok(helpBox.x>=0&&helpBox.y>=0&&helpBox.x+helpBox.width<=1440&&helpBox.y+helpBox.height<=900,'help should fit the viewport');
  const valueBox=await page.locator('#complexity-value').boundingBox();
  assert.ok(helpBox.x+helpBox.width<=valueBox.x||valueBox.x+valueBox.width<=helpBox.x||helpBox.y+helpBox.height<=valueBox.y||valueBox.y+valueBox.height<=helpBox.y,'help must not cover its value');

  const before=Number(await page.inputValue('#complexity'));
  await complexity.focus();
  await complexity.press('ArrowUp');
  assert.ok(Number(await page.inputValue('#complexity'))>before,'keyboard should update the original range');
  assert.equal(await help.isVisible(),false,'help should hide while adjusting by keyboard');
  assert.equal(await complexity.getAttribute('aria-valuenow'),await page.inputValue('#complexity'));
  await complexity.press('Home');
  assert.equal(Number(await page.inputValue('#complexity')),Number(await page.locator('#complexity').getAttribute('min')));

  const reverse=page.locator('.gen-knob-dial[data-for="reverseProbability"]');
  const box=await reverse.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  assert.equal(await page.locator('#gen-knob-help-reverseProbability').isVisible(),false,'help should hide while turning a knob');
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2-80,{steps:5});
  await page.mouse.up();
  assert.equal(await page.locator('#gen-knob-help-reverseProbability').isVisible(),false,'help should stay hidden until leaving the knob');
  assert.ok(Number(await page.inputValue('#reverseProbability'))>0,'pointer drag should change the original range');
  assert.match(await page.locator('#reverseProbability-value').textContent(),/[1-9]/,'linked value should update');

  await page.setViewportSize({width:390,height:844});
  await page.locator('.gen-knob-dial[data-for="pianoLushness"]').scrollIntoViewIfNeeded();
  await page.locator('.gen-knob-dial[data-for="pianoLushness"]').hover();
  const mobileHelp=await page.locator('#gen-knob-help-pianoLushness').boundingBox();
  assert.ok(mobileHelp.x>=0&&mobileHelp.x+mobileHelp.width<=390,'mobile help should fit the viewport');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'generator should not overflow narrow screens');
  assert.deepEqual(errors,[]);
  console.log('Generator knob layout, tooltip, keyboard, pointer, and mobile checks passed.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
