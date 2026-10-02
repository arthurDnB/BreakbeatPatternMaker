import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const root=resolve('site');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
  for(const prefix of ['/','/breakbeat-pattern-maker/']){
    const server=createServer(async(request,response)=>{
      try{
        const url=new URL(request.url,'http://local');
        if(!url.pathname.startsWith(prefix))throw Error('Outside mount');
        const file=resolve(root,decodeURIComponent(url.pathname.slice(prefix.length))||'index.html');
        if(!file.startsWith(root+sep))throw Error('Outside site');
        const bytes=await readFile(file),kind={'.html':'text/html','.js':'text/javascript','.css':'text/css','.wav':'audio/wav'}[extname(file)]??'application/octet-stream';
        response.writeHead(200,{'Content-Type':kind});response.end(bytes);
      }catch{response.writeHead(404);response.end();}
    });
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    const context=await browser.newContext({acceptDownloads:true}),page=await context.newPage(),errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
    try{
      await page.goto(`http://127.0.0.1:${server.address().port}${prefix}`);
      await page.click('#generate');
      await page.locator('#grid .hit').first().waitFor();
      await page.locator('#advanced-generation').evaluate(element=>element.open=true);
      await page.selectOption('#breakLayer','think-passage2');
      await page.route('**/think-passage2-142x.wav',route=>route.abort());
      await page.click('#generate');
      await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Could not load the Think break'));
      assert.equal(await page.locator('th[data-track-id="think-break-layer"]').count(),0);
      await page.unroute('**/think-passage2-142x.wav');
      await page.click('#generate');
      await page.locator('th[data-track-id="think-break-layer"]').waitFor();
      const generatedHits=await page.locator('.hit[data-cell-lane="think-break-layer"]').count();
      assert.ok(generatedHits>0);
      await page.locator('.empty-cell[data-cell-lane="think-break-layer"]').first().click();
      await page.keyboard.press('z');
      assert.ok(await page.locator('.hit[data-cell-lane="think-break-layer"]').count()>generatedHits,'keyboard entry stays on the Think track');
      await page.locator('.empty-cell[data-cell-lane="think-break-layer"]').first().click();
      await page.click('#quick-insert-hit');
      assert.ok(await page.locator('.hit[data-cell-lane="think-break-layer"]').count()>generatedHits+1,'+ Note adds a mapped slice');
      await page.locator('th[data-track-id="think-break-layer"] .sample-track-generation').click();
      assert.equal(await page.locator('#break-browser').evaluate(element=>element.open),true);
      assert.ok(await page.locator('#break-slices button').count()>=10);
      await page.click('#break-close');
      await page.click('#regenerate');
      await page.waitForFunction(()=>document.querySelector('#variation').value==='1');
      const save=page.waitForEvent('download');await page.click('#project-save');
      const projectBytes=await readFile(await(await save).path()),project=JSON.parse(projectBytes.toString());
      assert.ok(project.assets.some(asset=>asset.id==='think-passage2-raw'));
      assert.ok(project.editor.pattern.userTracks.some(track=>track.generatedBreakLayer==='think-passage2'));
      assert.ok(project.editor.pattern.events.filter(hit=>hit.trackId==='think-break-layer'&&!hit.generatedDrumRole).every(hit=>hit.mapped?.instrumentId==='think-passage2-drums'));
      await page.setInputFiles('#project-open',{name:'think-layer.bbproject',mimeType:'application/json',buffer:projectBytes});
      await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Project opened'));
      assert.equal(await page.inputValue('#breakLayer'),'think-passage2');
      assert.ok(await page.locator('.hit[data-cell-lane="think-break-layer"]').count()>0);
      const download=page.waitForEvent('download');await page.click('#export-wav');
      assert.equal((await readFile(await(await download).path())).toString('ascii',0,4),'RIFF');
      await page.selectOption('#breakLayer','off');await page.click('#generate');
      await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Beat generated'));
      assert.equal(await page.locator('.hit[data-cell-lane="think-break-layer"]').count(),2,'Off preserves only the two manually entered Think slices');
      assert.deepEqual(errors,[]);
      console.log(`Think break layer browser checks passed at ${prefix}`);
    }finally{await context.close();await new Promise(done=>server.close(done));}
  }
}finally{await browser.close();}
