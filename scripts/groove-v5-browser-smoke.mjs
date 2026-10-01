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
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#grid .hit').first().waitFor();

  // Test selecting Groove V5
  await page.selectOption('#algorithm','groove-v5');
  assert.equal(await page.locator('#patternStructure').isDisabled(), false, 'Pattern structure must be enabled in V5');
  assert.equal(await page.locator('#hat-density').isDisabled(), false, 'Lane density must be enabled in V5');
  assert.equal(await page.locator('#phrase-length-field').evaluate(e => e.hidden), false, 'Phrase length field must not have hidden attribute in V5');
  await page.click('#generate');
  await page.waitForFunction(()=>document.querySelector('#summary')?.textContent?.length>0);
  const initialHitCount=await page.locator('#grid .hit').count();
  assert.ok(initialHitCount>0,'V5 must produce audible drum hits');

  // Test Variation with V5
  await page.click('#regenerate');
  await page.waitForFunction(()=>document.querySelector('#summary')?.textContent?.length>0);
  const variedHitCount=await page.locator('#grid .hit').count();
  assert.ok(variedHitCount>0,'V5 variation must produce hits');

  // Test Undo with V5
  await page.click('#undo');
  assert.equal(await page.locator('#grid .hit').count(),initialHitCount,'Undo should revert variation');

  // Test Exact Hits with V5
  await page.locator('#advanced-generation>summary').click();
  await page.selectOption('#hit-target-mode','exact');
  await page.fill('#hit-target-number','28');
  await page.locator('#hit-target-number').press('Tab');
  await page.click('#generate');
  await page.waitForFunction(()=>document.querySelector('#summary')?.textContent?.includes('28 hits'));
  assert.equal(await page.locator('#grid .hit').count(),28,'Exact hit budget must apply to V5');

  // Dubstep's sparse pilot vocabulary cannot satisfy the generic 32-note default.
  await page.selectOption('#genre','dubstep');
  await page.selectOption('#hit-target-mode','exact');
  assert.equal(await page.inputValue('#hit-target-number'),'22','V5 should choose the feasible profile capacity');
  assert.equal(await page.locator('#hit-target-number').getAttribute('max'),'22');
  await page.fill('#hit-target-number','32');
  await page.locator('#hit-target-number').press('Tab');
  assert.equal(await page.inputValue('#hit-target-number'),'22','Impossible manual targets must be clamped');
  await page.click('#generate');
  assert.equal(await page.locator('#grid .hit').count(),22,'The suggested Dubstep target must generate successfully');

  assert.deepEqual(errors,[]);
  console.log('Groove V5 browser controls, variation, exact-hit capacity, and undo passed.');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
