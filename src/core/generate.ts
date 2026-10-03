import type {Settings} from './model.js';
import {validateSettings} from './settings.js';
import {generateLegacy} from './generate-legacy.js';
import {generateGroove} from './groove.js';
import {generateGrooveV3} from './groove-v3.js';
import {generateGrooveV4} from './groove-v4.js';
import {generateGrooveV5} from './groove-v5.js';
import {balanceExactHits} from './exact-hits.js';
import {NEW_GENRES} from './new-genres.js';
import {applyReverseProbability} from './reverse-probability.js';
export {validateSettings} from './settings.js';
export function generate(settings:Settings){
 validateSettings(settings);
 let pattern;
 if(settings.algorithm==='groove-v5'){
  pattern=generateGrooveV5(settings);
  // A requested Think layer is merged by Editor before its final hit budget.
  if(settings.hitTarget!==undefined&&settings.breakLayer!=='think-passage2')balanceExactHits(pattern,[],[]);
 }else if(settings.algorithm==='groove-v4'){
  pattern=generateGrooveV4(settings);
  if(settings.hitTarget!==undefined)balanceExactHits(pattern,[],[]);
 }else if(settings.algorithm==='groove-v3')pattern=generateGrooveV3(settings);
 else pattern=settings.algorithm==='groove-v2'||Object.hasOwn(NEW_GENRES,settings.genre)?generateGroove(settings):generateLegacy(settings);
 applyReverseProbability(pattern.events,settings);
 return pattern;
}
