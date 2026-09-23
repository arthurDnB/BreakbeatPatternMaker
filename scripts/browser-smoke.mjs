import {PROFILES} from '../dist/core/profiles.js';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1080},acceptDownloads:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');
 await page.locator('.hit').first().waitFor();
 assert.equal(await page.locator('tbody tr').count(),32);
 await page.locator('.hit').first().click();assert.match(await page.locator('#explanation').textContent(),/downbeat/);
 await page.selectOption('#view','renoise');assert.match(await page.locator('.hit').first().textContent(),/C-4 00/);
 await page.selectOption('#view','beginner');assert.equal(await page.locator('.hit').first().textContent(),'Kick');
 await page.selectOption('#view','hybrid');
 const exportFile=async()=>{const result=page.waitForEvent('download');if(!await page.locator('#more-actions').evaluate(e=>e.open))await page.click('#more-actions > summary');await page.click('#export');const download=await result;return JSON.parse(await readFile(await download.path(),'utf8'));};
 assert.equal(await page.locator('#genre option').count(),Object.keys(PROFILES).length);
 const slide=async(id,value)=>page.locator(id).evaluate((el,v)=>{el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},value);
 await slide('#bpm-slider',175.5);assert.equal(await page.inputValue('#bpm'),'175.5');
 await page.fill('#bpm','350');assert.equal(await page.inputValue('#bpm-slider'),'350');
 await page.reload();await page.locator('.hit').first().waitFor();
 await page.click('#advanced-generation > summary');
 const first=await exportFile();await page.click('#generate');assert.deepEqual(await exportFile(),first);
 await page.selectOption('#genre','hiphop');assert.equal(await page.inputValue('#bpm'),'90');
 await page.fill('#bpm','92');await page.selectOption('#genre','dnb');assert.equal(await page.inputValue('#bpm'),'174');
 await page.click('#generate');const next=await exportFile();assert.equal(next.genre,'dnb');assert.equal(next.timing.bpm,174);
 await page.fill('#seed','');await page.click('#generate');assert.match(await page.locator('#status').textContent(),/seed/);
 assert.deepEqual(await exportFile(),next); // Invalid input cannot replace the last good export.
 await page.fill('#seed','ui-test');await page.click('#generate');
 await page.click('#play');assert.equal(await page.locator('#play').textContent(),'Stop');
 await page.click('#play');assert.equal(await page.locator('#play').textContent(),'Play pattern');
 await page.selectOption('#genre','trap');await page.selectOption('#resolution','32');
 await slide('#complexity',.88);assert.equal(await page.locator('#complexity-value').textContent(),'88%');
 await page.click('#generate');const complex=await exportFile();assert.equal(complex.genre,'trap');
 await slide('#complexity',.12);await page.click('#generate');assert.ok((await exportFile()).notes.length<complex.notes.length);
 await page.click('#undo');assert.equal(await page.inputValue('#complexity'),'0.88');assert.equal(await page.locator('#complexity-value').textContent(),'88%');assert.deepEqual(await exportFile(),complex);
 await page.click('#redo');assert.equal(await page.locator('#complexity-value').textContent(),'12%');
 for(const genre of Object.keys(PROFILES)){await page.selectOption('#genre',genre);await page.click('#generate');assert.equal((await exportFile()).genre,genre);}
 for(const breakStyle of ['amen','think','apache','funkyDrummer','hotPants']) {
 await page.selectOption('#breakStyle',breakStyle);await page.click('#generate');
 assert.ok((await exportFile()).name.includes(breakStyle));
 assert.ok((await page.locator('#break-description').textContent()).length>20);
}
 await page.click('#undo');assert.equal(await page.inputValue('#breakStyle'),'funkyDrummer');
 await page.click('#redo');assert.equal(await page.inputValue('#breakStyle'),'hotPants');
 await page.screenshot({path:'test-results/workbench.png',fullPage:true});
 await page.setViewportSize({width:800,height:900});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'test-results/workbench-narrow.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Browser: generation, views, explanations, deterministic download, genre defaults, BPM override, invalid input, playback, responsive layout passed.');
}finally{await browser.close();}
