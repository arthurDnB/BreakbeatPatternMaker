import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const origin=process.env.APP_URL??'http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin);await page.locator('#play').waitFor({state:'visible'});
 const play=page.locator('#play'),state=page.locator('#transport-state');
 assert.equal(await state.isVisible(),false);
 const stopped=await play.boundingBox();await page.evaluate(()=>{const button=document.querySelector('#play'),state=document.querySelector('#transport-state');button?.classList.add('is-playing');button?.setAttribute('aria-label','Stop playback');if(state){state.hidden=false;state.textContent='Pattern playing';}});
 const playing=await play.boundingBox();
 assert.deepEqual({x:playing.x,y:playing.y},{x:stopped.x,y:stopped.y});
 assert.equal(await state.isVisible(),false);
 await page.evaluate(()=>{const button=document.querySelector('#play'),state=document.querySelector('#transport-state');button?.classList.remove('is-playing');button?.setAttribute('aria-label','Play pattern');if(state){state.hidden=false;state.textContent='Stopped';}});
 const stoppedAgain=await play.boundingBox();assert.deepEqual({x:stoppedAgain.x,y:stoppedAgain.y},{x:stopped.x,y:stopped.y});
 assert.deepEqual(errors,[]);
 console.log('Transport layout: status label stays hidden and the play button does not move on start/stop.');
}finally{await browser.close();}
