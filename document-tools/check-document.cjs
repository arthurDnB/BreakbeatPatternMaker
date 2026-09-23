const {chromium}=require('C:/Users/arthu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const output=path.join(__dirname,'qa');fs.mkdirSync(output,{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage({viewport:{width:1500,height:1100},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(root,'Breakbeat Pattern Maker Project.html')).href);
 await page.screenshot({path:path.join(output,'01-overview.png')});
 for(const [id,file] of [['7-genre-generation-system','02-genres'],['10-renoise-integration-strategy','03-integration'],['14-proposed-internal-data-model','04-model'],['22-example-generated-pattern','05-pattern'],['recommended-order-for-building-the-mvp','06-order']]) {
  await page.locator('[id="'+id+'"]').scrollIntoViewIfNeeded();
  await page.evaluate(id=>window.scrollTo(0,document.getElementById(id).getBoundingClientRect().top+window.scrollY-25),id);
  await page.screenshot({path:path.join(output,file+'.png')});
 }
 const tracker=page.locator('table.tracker');
 await tracker.screenshot({path:path.join(output,'07-full-pattern.png')});
 const checks=await page.evaluate(()=>({
  headings:document.querySelectorAll('h2').length,
  missingTargets:[...document.querySelectorAll('nav a')].filter(a=>!document.getElementById(a.hash.slice(1))).length,
  documentOverflow:document.documentElement.scrollWidth>window.innerWidth,
  overflowingTables:[...document.querySelectorAll('.table-wrap')].filter(x=>x.scrollWidth>x.clientWidth+1).length,
  trackerRows:document.querySelectorAll('table.tracker tbody tr').length,
  sourceLinks:document.querySelectorAll('main a[href^="https:"]').length
 }));
 await page.setViewportSize({width:800,height:1000});
 await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:path.join(output,'08-narrow.png')});
 checks.narrowDocumentOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
 checks.errors=errors;
 fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify(checks,null,2));
 console.log(JSON.stringify(checks));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
