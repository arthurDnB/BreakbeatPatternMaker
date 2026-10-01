import type {Settings} from './model.js';
import {validateSettings} from './settings.js';
import {generateLegacy} from './generate-legacy.js';
import {generateGroove} from './groove.js';
import {generateGrooveV3} from './groove-v3.js';
import {generateGrooveV4} from './groove-v4.js';
import {balanceExactHits} from './exact-hits.js';
import {NEW_GENRES} from './new-genres.js';
export {validateSettings} from './settings.js';
export function generate(settings:Settings){
 validateSettings(settings);
 if(settings.algorithm==='groove-v4'){
  const pattern=generateGrooveV4(settings);
  if(settings.hitTarget!==undefined)balanceExactHits(pattern,[],[]);
  return pattern;
 }
 if(settings.algorithm==='groove-v3')return generateGrooveV3(settings);
 return settings.algorithm==='groove-v2'||Object.hasOwn(NEW_GENRES,settings.genre)?generateGroove(settings):generateLegacy(settings);
}
