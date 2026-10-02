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
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.locator('#grid .hit').first().waitFor();
 await page.click('#bar-tray-bottom .bar-expand-btn');
 await page.locator('#advanced-generation>summary').click();
 await page.selectOption('#hit-target-mode','exact');
 await page.fill('#hit-target-number','36');
 await page.locator('#hit-target-number').press('Tab');
 assert.equal(await page.inputValue('#hit-target-slider'),'36');
 await page.click('#generate');
 await page.waitForFunction(()=>document.querySelector('#summary')?.textContent?.includes('36 hits'));
 assert.equal(await page.locator('#grid .hit').count(),36);
 await page.click('#regenerate');
 await page.waitForFunction(()=>document.querySelector('#summary')?.textContent?.includes('36 hits'));
 assert.equal(await page.locator('#grid .hit').count(),36);
 await page.click('#undo');
 assert.equal(await page.locator('#grid .hit').count(),36);
 await page.click('#generate-melody');
 await page.waitForFunction(()=>document.querySelector('#summary')?.textContent?.includes('36 drum hits +'));
 assert.ok((await page.locator('#summary').textContent()).includes('synth notes'));
 console.log('Exact Hits browser control, Generate, Variation and Undo passed.');
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
