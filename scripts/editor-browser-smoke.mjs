import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL??'msedge'});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1150},acceptDownloads:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173');await page.locator('.hit').first().waitFor();
 const exported=async()=>{const promise=page.waitForEvent('download');if(!await page.locator('#more-actions').evaluate(e=>e.open))await page.click('#more-actions > summary');await page.click('#export');return JSON.parse(await readFile(await (await promise).path(),'utf8'));};
 const original=await exported();
 await page.check('#lock-kick');
 const hat=page.locator('.hit.hat').first(),hatId=await hat.getAttribute('data-hit');
 await hat.click();await page.click('#lock-selected');assert.ok(await hat.evaluate(e=>e.classList.contains('locked-hit')));
 await page.click('#clear-selection');await page.click('#mutate');const mutated=await exported();
 assert.notDeepEqual(mutated,original);
 assert.deepEqual(mutated.notes.filter(n=>n.lane==='kick'),original.notes.filter(n=>n.lane==='kick'));
 assert.deepEqual(mutated.notes.find(n=>n.id===hatId),original.notes.find(n=>n.id===hatId));
 await page.click('#undo');assert.deepEqual(await exported(),original);
 await page.click('#redo');assert.deepEqual(await exported(),mutated);
 await page.locator('[data-row="28"]').click();await page.locator('[data-row="31"]').click({modifiers:['Shift']});
 assert.equal(await page.locator('tr.selected-row').count(),4);
 await page.selectOption('#view','beginner');assert.equal(await page.locator('tr.selected-row').count(),4);
 await page.selectOption('#view','hybrid');
 await page.click('#fill');const filled=await exported();assert.notDeepEqual(filled,mutated);
 assert.deepEqual(filled.notes.filter(n=>n.row<28),mutated.notes.filter(n=>n.row<28));
 await page.click('#undo');assert.deepEqual(await exported(),mutated);
 await page.click('#redo');assert.deepEqual(await exported(),filled);
 // New edit after undo must discard the redo branch.
 await page.click('#undo');await page.click('#mutate');assert.ok(await page.locator('#redo').isDisabled());
 await page.locator('#clear-selection').click();
 const beforeRegenerate=await exported();await page.click('#regenerate');const regenerated=await exported();
 assert.deepEqual(regenerated.notes.filter(n=>n.lane==='kick'),beforeRegenerate.notes.filter(n=>n.lane==='kick'));
 await page.click('#undo');assert.deepEqual(await exported(),beforeRegenerate);
 // Genre fills can use several lanes; locking every lane makes a fill a no-op.
 await page.check('#lock-snare');await page.check('#lock-hat');await page.check('#lock-percussion');await page.click('#select-ending');const beforeBlocked=await exported();
 await page.click('#fill');assert.match(await page.locator('#status').textContent(),/No editable/);assert.deepEqual(await exported(),beforeBlocked);
 await page.uncheck('#lock-snare');
 // Ctrl+Z belongs to the editor outside text controls.
 await page.locator('#grid').focus();await page.keyboard.press('Control+z');assert.ok(await page.isChecked('#lock-snare'));
 await page.keyboard.press('Control+Shift+z');assert.equal(await page.isChecked('#lock-snare'),false);
 await page.click('#fill');
 const edited=await exported();await writeFile('test-results/edited.bbpattern',JSON.stringify(edited,null,2));
 await page.screenshot({path:'test-results/editor.png',fullPage:true});
 await page.setViewportSize({width:800,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'test-results/editor-narrow.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Editor browser: hit/range selection, lock preservation, mutation, fills, exact export Undo/Redo, regeneration, shortcuts and responsive layout passed.');
}finally{await browser.close();}
