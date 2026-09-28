import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
  const context=await browser.newContext({viewport:{width:700,height:800}});
  const page=await context.newPage();
  await page.goto(process.env.APP_URL??'http://127.0.0.1:4173');
  await page.locator('#grid .hit').first().waitFor();

  await page.selectOption('#view','hybrid');
  for(const id of ['pattern-history-panel','arranger','advanced-generation','master-dsp-rack']) await page.locator('#'+id).evaluate(element=>element.open=true);
  await page.locator('.track-instrument-panel[data-role="kick"] > summary').click();
  await page.locator('#grid').evaluate(element=>{element.scrollTop=90;element.scrollLeft=120;});
  await page.evaluate(()=>scrollTo(0,220));
  await page.waitForTimeout(650);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('bpm_workspace_preferences_v1')));
  assert.equal(saved.view,'hybrid');
  assert.ok(saved.gridScrollTop>0);assert.ok(saved.gridScrollLeft>0);assert.ok(saved.pageScrollTop>0);
  assert.equal(saved.openPanels.arranger,true);assert.equal(saved.openPanels['pattern-history-panel'],true);assert.equal(saved.openPanels['advanced-generation'],true);assert.equal(saved.openPanels['master-dsp-rack'],true);
  assert.ok(saved.openTrackRoles.includes('kick'));

  await page.reload();
  await page.locator('#grid .hit').first().waitFor();
  await page.waitForTimeout(650);
  assert.equal(await page.inputValue('#view'),'hybrid');
  for(const id of ['pattern-history-panel','arranger','advanced-generation','master-dsp-rack']) assert.equal(await page.locator('#'+id).evaluate(element=>element.open),true,id+' should restore open');
  assert.equal(await page.locator('.track-instrument-panel[data-role="kick"]').evaluate(element=>element.open),true);
  const restored=await page.evaluate(()=>({gridTop:document.querySelector('#grid').scrollTop,gridLeft:document.querySelector('#grid').scrollLeft,pageTop:scrollY}));
  assert.ok(Math.abs(restored.gridTop-saved.gridScrollTop)<=2);
  assert.ok(Math.abs(restored.gridLeft-saved.gridScrollLeft)<=2);
  assert.ok(Math.abs(restored.pageTop-saved.pageScrollTop)<=2);
  console.log('Workspace state: tracker view, open panels, instrument accordion and scroll positions survive reload.');
  await context.close();
}finally{await browser.close();}
