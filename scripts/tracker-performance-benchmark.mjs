import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
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
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.locator('#grid tbody tr').first().waitFor();
  await page.selectOption('#tracker-bars','4');
  await page.selectOption('#tracker-lpb',process.env.LPB==='16'?'12':'24');
  for(let i=0;i<3;i++)await page.click('#add-synth-track');
  const render=await page.evaluate(targetLpb=>{
    const input=document.querySelector('#tracker-lpb');
    const begin=performance.now();
    input.value=targetLpb;input.dispatchEvent(new Event('change',{bubbles:true}));
    return performance.now()-begin;
  },process.env.LPB??'32');
  if(process.env.NOFOLLOW)await page.click('#tracker-follow-playhead');
  await page.click('#play');
  await page.waitForFunction(()=>document.querySelector('#play')?.classList.contains('is-playing'));
  const profiler=process.env.PROFILE?await page.context().newCDPSession(page):undefined;
  if(profiler){await profiler.send('Profiler.enable');await profiler.send('Profiler.start');}
  await page.evaluate(()=>{
    const samples=[];const longTasks=[];
    const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())longTasks.push(entry.duration);});
    observer.observe({entryTypes:['longtask']});
    let previous=performance.now(),end=previous+3000;
    const tick=now=>{samples.push(now-previous);previous=now;if(now<end)requestAnimationFrame(tick);else{observer.disconnect();window.__trackerPerf={frameIntervals:samples,longTasks};}};
    requestAnimationFrame(tick);
  });
  await page.waitForFunction(()=>window.__trackerPerf!==undefined,{timeout:12000});
  const metrics=await page.evaluate(renderMs=>{
    const grid=document.querySelector('#grid'),data=window.__trackerPerf;
    const intervals=data.frameIntervals.slice(1).sort((a,b)=>a-b);
    const heights=Array.from(grid.querySelectorAll('tbody tr[data-play-row]'),row=>row.getBoundingClientRect().height).sort((a,b)=>a-b);
    return {renderMs:+renderMs.toFixed(1),gridElements:grid.querySelectorAll('*').length,mountedRows:heights.length,totalRows:Number(document.querySelector('#summary').textContent.match(/(\d+) rows/)?.[1]),columnWidths:Array.from(grid.querySelectorAll('thead th'),cell=>+cell.getBoundingClientRect().width.toFixed(1)),rowHeightMin:heights[0],rowHeightP50:heights[Math.floor(heights.length*.5)],rowHeightP95:heights[Math.floor(heights.length*.95)],rowHeightMax:heights.at(-1),longTasks:data.longTasks.length,longTaskMs:+data.longTasks.reduce((a,b)=>a+b,0).toFixed(1),frameP95Ms:+intervals[Math.floor(intervals.length*.95)].toFixed(1)};
  },render);
  console.log(JSON.stringify(metrics,null,2));
  if(profiler){const {profile}=await profiler.send('Profiler.stop');const counts=new Map();for(const id of profile.samples??[])counts.set(id,(counts.get(id)??0)+1);const hottest=profile.nodes.map(node=>({name:node.callFrame.functionName,url:node.callFrame.url.split('/').at(-1),line:node.callFrame.lineNumber+1,samples:counts.get(node.id)??0})).sort((a,b)=>b.samples-a.samples).slice(0,18);console.log(JSON.stringify(hottest,null,2));}
  await page.click('#play');
}finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
