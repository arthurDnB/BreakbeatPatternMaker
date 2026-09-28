import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
  const page=await browser.newPage();
  await page.goto('http://127.0.0.1:4173');
  await page.locator('.hit').first().waitFor();

  assert.equal(await page.getByRole('slider',{name:'Generation complexity'}).count(),1);
  assert.equal(await page.getByRole('slider',{name:'Generation spice'}).count(),1);
  for(const id of ['syncopation','swing','humanizeMs','ghostAmount','fillAmount']) assert.ok(await page.locator('#'+id).getAttribute('aria-valuetext'),`${id} should expose a spoken value`);
  await page.locator('#syncopation').evaluate(element=>{element.value='.65';element.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.locator('#syncopation').getAttribute('aria-valuetext'),'0.65');

  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.matches(':focus-visible')),true);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle),'solid');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineWidth),'2px');

  const kickPanel=page.locator('.track-instrument-panel[data-role="kick"]');
  await kickPanel.locator(':scope > summary').click();
  assert.equal(await page.getByRole('slider',{name:'Level for Kick'}).count(),1);
  assert.equal(await page.getByRole('slider',{name:'Kick track volume'}).count(),1);
  await page.locator('#track-fader-kick').evaluate(element=>{element.value='.8';element.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await page.locator('#track-fader-kick').getAttribute('aria-valuetext'),'80 percent');
  await page.locator('#kit-shape-kick > summary').click();
  assert.equal(await page.getByRole('slider',{name:'Speed (0.5×–2×) for Kick'}).count(),1);
  await page.locator('#master-dsp-rack > summary').click();
  assert.equal(await page.getByRole('slider',{name:'Master DSP high-pass frequency'}).count(),1);
  await page.locator('#master-dsp-rack > summary').click();

  console.log('Accessibility: named generator/instrument/DSP sliders, changing spoken values and visible keyboard focus passed.');
}finally{await browser.close();}
