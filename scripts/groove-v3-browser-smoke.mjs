import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';

await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1050},acceptDownloads:true});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:4173');
  await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Saved locally');
  const download=async selector=>{
    const pending=page.waitForEvent('download');
    await page.click(selector);
    return readFile(await(await pending).path());
  };
  const saved=async()=>JSON.parse(await download('#project-save'));
  const openDetails=async selector=>{
    if(!await page.locator(selector).evaluate(element=>element.open))await page.click(selector+' > summary');
  };

  assert.equal(await page.inputValue('#algorithm'),'groove-v2','new workspaces retain the existing engine default');
  await openDetails('#advanced-generation');
  assert.equal(await page.locator('#algorithm option[value="groove-v3"]').count(),1);
  await page.selectOption('#algorithm','groove-v3');
  for(const genre of ['twostepgarage','boombap','jungle']){
    await page.selectOption('#genre',genre);
    assert.equal(await page.inputValue('#algorithm'),'groove-v3','genre presets retain the selected engine');
  }
  // Small portable project and stable audio fixture; sound quality is covered by renderer tests.
  await page.click('#show-sounds');
  await page.uncheck('#auto-kit');
  for(const role of ['kick','snare','hat','percussion'])await page.selectOption('#kit-choice-'+role,'synth');
  await page.fill('#seed','groove-v3-browser');
  await page.fill('#complexity','1');
  await page.fill('#spicy','1');
  await page.fill('#ghostAmount','1');
  await page.fill('#fillAmount','1');
  await page.selectOption('#bars','2');
  await page.selectOption('#phraseLength','16');
  await page.selectOption('#phraseOffset',{label:'15'});
  await page.click('#generate');
  let project=await saved();
  assert.equal(project.version,3);
  assert.equal(project.editor.pattern.settings.phraseLength,16);
  assert.equal(project.editor.pattern.settings.phraseOffset,14);
  assert.equal(project.editor.pattern.settings.algorithm,'groove-v3');
  assert.ok(project.editor.pattern.events.some(hit=>hit.ratchets>1&&hit.articulation?.repeats?.length>1),'Spicy generates expressive bursts');

  await page.check('#lock-kick');
  const beforeVariation=await saved();
  await page.click('#action-variation');
  const afterVariation=await saved();
  assert.equal(afterVariation.editor.pattern.settings.algorithm,'groove-v3');
  assert.deepEqual(afterVariation.editor.pattern.events.filter(hit=>hit.role==='kick'),beforeVariation.editor.pattern.events.filter(hit=>hit.role==='kick'));
  for(const anchor of beforeVariation.editor.pattern.events.filter(hit=>hit.anchor)){
    assert.deepEqual(afterVariation.editor.pattern.events.find(hit=>hit.id===anchor.id),anchor,'variation preserves each anchor');
  }
  await page.click('#undo');assert.deepEqual((await saved()).editor.pattern,beforeVariation.editor.pattern);
  await page.click('#redo');assert.deepEqual((await saved()).editor.pattern,afterVariation.editor.pattern);
  await page.uncheck('#lock-kick');

  project=await saved();
  const original=project.editor.pattern.events.find(hit=>hit.ratchets>1&&hit.articulation?.repeats?.length>1);
  assert.ok(original,'variation retains expressive burst material');
  const selector='[data-hit="'+original.id+'"]';
  await page.locator(selector).click();
  await openDetails('#hit-articulation');
  assert.equal(Number(await page.inputValue('#edit-burst-span')),original.articulation.durationTicks);
  const nextVolume=Number(await page.inputValue('#edit-volume'))===64?72:64;
  const nextPitch=(original.pitch??0)===7?5:7;
  await page.fill('#edit-volume',String(nextVolume));
  await page.fill('#edit-pitch',String(nextPitch));
  await page.click('#hit-apply');
  const afterTone=await saved();
  const toneHit=afterTone.editor.pattern.events.find(hit=>hit.id===original.id);
  assert.equal(toneHit.gain,nextVolume/128);
  assert.equal(toneHit.pitch,nextPitch);
  assert.deepEqual(toneHit.articulation,original.articulation,'volume and pitch edits preserve musical duration and every repeat expression');

  const nextCount=original.ratchets===5?3:5;
  await page.selectOption('#edit-ratchets',String(nextCount));
  await page.click('#hit-apply');
  const afterRepeats=await saved();
  const repeated=afterRepeats.editor.pattern.events.find(hit=>hit.id===original.id);
  assert.equal(repeated.ratchets,nextCount);
  assert.equal(repeated.articulation.durationTicks,original.articulation.durationTicks,'changing repeats retains musical gesture duration');
  assert.equal(repeated.articulation.repeats,undefined,'changing repeat count clears the old per-repeat expression array');
  await page.click('#undo');assert.deepEqual((await saved()).editor.pattern,afterTone.editor.pattern);
  await page.click('#redo');assert.deepEqual((await saved()).editor.pattern,afterRepeats.editor.pattern);

  await page.click('#lock-selected');
  assert.equal(await page.locator('#edit-ratchets').isDisabled(),true);
  assert.equal(await page.locator('#edit-burst-span').isDisabled(),true);
  assert.equal(await page.locator('#hit-apply').isDisabled(),true);
  await page.click('#lock-selected');
  await page.click('#hit-preview');
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Previewing'));
  const wav=await download('#export-wav');
  assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');assert.ok(wav.length>44);
  await page.click('#play');await page.click('#play');

  // Exercise import rather than merely verifying serialized JSON.
  const portable=await saved();
  await page.selectOption('#genre','dub');await page.click('#generate');
  await page.setInputFiles('#project-open',{name:'groove-v3.bbproject',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(portable))});
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Project opened'));
  const restored=await saved();
  assert.equal(restored.version,3);
  assert.equal(await page.inputValue('#algorithm'),'groove-v3');
  assert.deepEqual(restored.editor.pattern,portable.editor.pattern);
  assert.deepEqual(restored.bank,portable.bank);
  assert.equal(await page.inputValue('#phraseLength'),'16');
  assert.equal(await page.inputValue('#phraseOffset'),'14');
  await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Saved locally');
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('#save-status').textContent==='Restored local workspace');
  assert.equal(await page.inputValue('#algorithm'),'groove-v3');
  assert.deepEqual((await saved()).editor.pattern,portable.editor.pattern);
  await page.locator(selector).click();await openDetails('#hit-articulation');
  await openDetails('#advanced-generation');
  await page.screenshot({path:'test-results/groove-v3-phrasing.png',fullPage:true});
  await page.locator('.tracker-edit').screenshot({path:'test-results/groove-v3-inspector.png'});
  assert.deepEqual(errors,[]);
  console.log('Groove v3 browser: opt-in engine, genre retention, expressive generation, locked anchors, history, inspector articulation preservation, Preview, WAV, project import and autosave passed.');
} finally {
  await browser.close();
}
