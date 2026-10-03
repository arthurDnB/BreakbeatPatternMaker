import type {Settings} from './model.js';
import {generateGrooveV5,grooveV5Fill} from './groove-v5.js';
import {v51ProfileFor} from './groove-v51-profiles.js';
import {validateSettings} from './settings.js';
export function generateGrooveV51(s:Settings){
 const settings:Settings={...s,algorithm:'groove-v5.1'};
 validateSettings(settings);
 return generateGrooveV5(settings,v51ProfileFor(s.genre));
}
export const grooveV51Fill=(s:Settings,start:number,end:number)=>grooveV5Fill(s,start,end,v51ProfileFor(s.genre));
