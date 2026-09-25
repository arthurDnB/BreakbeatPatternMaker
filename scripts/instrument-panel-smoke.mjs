import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const origin=process.env.APP_URL??'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1360,height:430}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin);await page.locator('.track-instrument-panel[data-role="kick"]>summary').click();
 const panel=page.locator('.track-instrument-panel[data-role="kick"] .drum-slot');
 await panel.waitFor({state:'visible'});
 await page.locator('#kit-shape-kick').evaluate(element=>{element.open=true;});
 const bounds=await panel.evaluate(element=>{const rect=element.getBoundingClientRect();return {top:rect.top,bottom:rect.bottom,height:rect.height,scrollHeight:element.scrollHeight,clientHeight:element.clientHeight,position:getComputedStyle(element).position};});
 assert.equal(bounds.position,'fixed');assert.ok(bounds.top>=0);assert.ok(bounds.bottom<=430,`panel extends below viewport: ${JSON.stringify(bounds)}`);assert.ok(bounds.scrollHeight>bounds.clientHeight,'panel content should remain internally scrollable');
 await panel.evaluate(element=>{element.scrollTop=element.scrollHeight;});
 assert.ok(await panel.evaluate(element=>element.scrollTop>0),'panel content did not scroll');
 assert.deepEqual(errors,[]);
 console.log('Instrument panel: stays inside a short viewport and scrolls through all controls.');
}finally{await browser.close();}
