import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.audioStarts=[];const original=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(at,...args){window.audioStarts.push({at,now:this.context.currentTime,duration:this.buffer.duration,loop:this.loop});return original.call(this,at,...args);};});
 await page.goto('http://127.0.0.1:4173');await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Saved locally');
 await page.selectOption('#genre','amenscience');await page.waitForTimeout(1200);
 await page.locator('#advanced-generation').evaluate(e=>e.open=true);
 await page.fill('#seed','break-042');await page.selectOption('#patternStructure','auto');await page.locator('#generate').click({force:true});
 await page.click('#slot-1');await page.click('#slot-0');
 await page.evaluate(()=>window.audioStarts=[]);await page.click('#play');
 const first=await page.evaluate(()=>window.audioStarts[0]);assert.equal(first.loop,true);assert.ok(first.at>first.now,'buffer must start in the future');
 await page.waitForTimeout(first.duration*3000);
 assert.equal(await page.evaluate(()=>window.audioStarts.length),1,'current pattern must not be re-rendered/restarted each loop');
 await page.click('#slot-1');await page.waitForFunction(()=>document.querySelector('#slot-1').getAttribute('aria-pressed')==='true',{},{timeout:20000});
 const starts=await page.evaluate(()=>window.audioStarts);assert.equal(starts.length,2);assert.ok(starts[1].at>starts[1].now);
 assert.ok(Math.abs((starts[1].at-first.at)/first.duration-Math.round((starts[1].at-first.at)/first.duration))<1e-7,'slot switch is on the audio buffer boundary');
 await page.click('#play');
 await page.selectOption('#algorithm','groove-v2');assert.equal(await page.isDisabled('#patternStructure'),true);
 await page.selectOption('#algorithm','groove-v3');await page.selectOption('#patternStructure','build');
 assert.equal(await page.isDisabled('#spicy'),false);assert.equal(await page.isDisabled('#complexity'),false);assert.equal(await page.isDisabled('#swing'),true);assert.equal(await page.isDisabled('#fillAmount'),true);
 await page.selectOption('#patternStructure','auto');assert.equal(await page.isDisabled('#swing'),false);assert.equal(await page.isDisabled('#fillAmount'),false);
 assert.deepEqual(errors,[]);await writeFile('test-results/loop-playback-after.json',JSON.stringify({starts,errors},null,2));
 console.log('Loop browser: audio-clock looping, future scheduling, boundary slot switch and structure controls passed.');
}finally{await browser.close();}
