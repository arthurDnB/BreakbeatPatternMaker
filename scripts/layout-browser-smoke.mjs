import {chromium} from 'playwright';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4173');
  await page.locator('.hit').first().waitFor();
  const viewports=[[1920,1080],[1440,900],[1366,768],[1024,768],[800,900],[600,900],[390,844],[320,700]];
  for(const [width,height] of viewports){
    await page.setViewportSize({width,height});
    await page.waitForTimeout(200);
    const metrics=await page.evaluate(()=>({
      gridTop:document.querySelector('#grid').getBoundingClientRect().top,
      chassis:document.querySelector('main.daw-chassis').getBoundingClientRect(),
      documentWidth:document.documentElement.scrollWidth,
      ids:[...document.querySelectorAll('[id]')].map(element=>element.id),
    }));
    console.log(`${width}x${height}: tracker starts at ${Math.round(metrics.gridTop)}px`);
    assert.ok(metrics.gridTop<760,`tracker should remain near the top at ${width}px`);
    assert.equal(metrics.documentWidth,width,`page should not scroll horizontally at ${width}px`);
    assert.ok(metrics.chassis.left>=0&&metrics.chassis.right<=width+1,`workspace shell should fit at ${width}px`);
    assert.equal(new Set(metrics.ids).size,metrics.ids.length);
    assert.equal(await page.locator('#hit-editor').evaluate(element=>element.open),false);
    if(width>=1024) await page.screenshot({path:`test-results/workspace-${width}.png`,fullPage:true});
  }

  await page.setViewportSize({width:1366,height:768});
  await page.goto('http://127.0.0.1:4173');
  await page.locator('.hit').first().waitFor();
  await page.locator('.hit.snare').first().click();
  await page.locator('#hit-editor > summary').click();
  assert.equal(await page.locator('#hit-editor').evaluate(element=>element.open),true);
  assert.equal(await page.locator('#edit-lane').inputValue(),'snare');
  await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
  assert.ok(await page.locator('#play').evaluate(element=>element.getBoundingClientRect().top>=0&&element.getBoundingClientRect().bottom<innerHeight));

  await page.setViewportSize({width:390,height:844});
  await page.reload();
  await page.locator('.hit').first().waitFor();
  await page.locator('.hit.snare').first().click();
  await page.locator('#hit-editor > summary').click();
  await page.locator('#edit-pitch-slider').fill('5');
  assert.equal(await page.locator('#edit-pitch').inputValue(),'5');
  assert.equal(await page.locator('#hit-apply').isDisabled(),true);
  await page.locator('#hit-editor > summary').click();
  await page.locator('.hit.snare').first().waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'test-results/workspace-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('Responsive layout: 8 viewports, tracker overflow, sticky transport, contextual editors and mobile editing passed.');
}finally{await browser.close();}
