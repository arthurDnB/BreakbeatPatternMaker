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
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#grid tbody tr').first().waitFor();
  await page.selectOption('#tracker-bars','4');await page.selectOption('#tracker-lpb','32');
  for(let i=0;i<3;i++)await page.click('#add-synth-track');
  assert.match(await page.locator('#summary').innerText(),/512 rows/);
  assert.ok(await page.locator('#grid tbody tr[data-play-row]').count()<90,'Only nearby tracker rows should be mounted');

  const first=page.locator('#grid [data-cell-row="0"][data-cell-lane="kick"][data-field="note"]').first();
  await first.click();await page.keyboard.press('End');
  const last=page.locator('#grid [data-cell-row="511"][data-cell-lane="kick"][data-field="note"]').first();
  await last.waitFor();assert.equal(await last.getAttribute('aria-current'),'location','End focuses an unmounted row');
  await page.keyboard.press('Home');await first.waitFor();assert.equal(await first.getAttribute('aria-current'),'location','Home returns to row zero');
  await page.locator('#grid [data-row="0"]').click();
  await page.locator('#grid').evaluate(grid=>{grid.scrollTop=grid.scrollHeight;});
  await page.locator('#grid [data-row="511"]').waitFor();
  await page.locator('#grid [data-row="511"]').click({modifiers:['Shift']});
  assert.match(await page.locator('#selection-status').textContent(),/Rows 0–511/,'Row selection spans rows outside the viewport');
  assert.ok(await page.locator('#grid tbody tr[data-play-row]').count()<90);

  await page.locator('#grid').evaluate(grid=>{grid.scrollTop=0;});
  await page.locator('#grid [data-play-row="0"]').waitFor();
  const source=page.locator('#grid .hit').first(),row=Number(await source.getAttribute('data-cell-row')),lane=await source.getAttribute('data-cell-lane');
  if(row<10){await source.dragTo(page.locator(`#grid [data-drop-row="${row+1}"][data-drop-lane="${lane}"]`));
    assert.ok(await page.locator(`#grid [data-cell-row="${row+1}"][data-cell-lane="${lane}"].hit`).count()>0,'Dragging moves the hit one row');}
  await page.click('#play');await page.waitForFunction(()=>document.querySelector('#play')?.classList.contains('is-playing'));
  await page.waitForTimeout(500);assert.ok(await page.locator('#grid .playing-row').count()<=1,'Playhead marks at most one row');
  await page.click('#play');
  await page.click('#generate-piano');
  await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Piano chords generated'));
  await page.locator('#grid').evaluate(grid=>{grid.scrollTop=0;});
  await page.locator('#grid [data-play-row="0"]').waitFor();
  const layout=await page.evaluate(()=>{
    const rows=Array.from(document.querySelectorAll('#grid tbody tr[data-play-row]'));
    let overlap=0,stacked=0,worst=null;
    for(const row of rows){
      if(Array.from(row.querySelectorAll('td')).some(cell=>cell.querySelectorAll('.tracker-hit-card').length>1))stacked++;
      const next=rows.find(other=>Number(other.dataset.playRow)===Number(row.dataset.playRow)+1);
      if(next){const value=row.getBoundingClientRect().bottom-next.getBoundingClientRect().top;if(value>overlap){overlap=value;worst={row:Number(row.dataset.playRow),height:row.getBoundingClientRect().height,allocated:next.getBoundingClientRect().top-row.getBoundingClientRect().top,maxStack:Math.max(...Array.from(row.querySelectorAll('td'),cell=>cell.querySelectorAll('.tracker-hit-card').length))};}}
    }
    return {overlap,stacked,worst};
  });
  assert.ok(layout.stacked>0,'The piano fixture must contain a stacked chord row');
  assert.ok(layout.overlap<1,`Virtual rows must not overlap after chord generation (${JSON.stringify(layout)})`);
  assert.deepEqual(errors,[]);
  console.log('Tracker virtualization checks passed: bounded DOM, offscreen keyboard focus, range selection, dragging, and playback.');
}finally{
  await browser.close();await new Promise(resolve=>server.close(resolve));
}
