import {NEW_GENRES} from './new-genres.js';
import {ROLES,bounded,text,type Settings} from './model.js';
import {PROFILES} from './profiles.js';
import {BREAKS} from './breaks.js';

export function validateSettings(s: Settings): void {
  if (!s || !Object.hasOwn(PROFILES, s.genre)) throw new Error('Unsupported genre.');
  if(s.breakStyle!==undefined&&s.breakStyle!=='genre'&&!Object.hasOwn(BREAKS,s.breakStyle)) throw new Error('Unsupported break preset.');
  if(s.enabledRoles!==undefined&&(!Array.isArray(s.enabledRoles)||s.enabledRoles.some(r=>!ROLES.includes(r))||new Set(s.enabledRoles).size!==s.enabledRoles.length))throw Error('Invalid enabled instruments.');
  if(s.algorithm!==undefined&&!['legacy-v1','groove-v2','groove-v3'].includes(s.algorithm))throw Error('Unsupported generation engine.');
  if(s.algorithm==='legacy-v1'&&Object.hasOwn(NEW_GENRES,s.genre))throw Error('This genre requires Groove v2 or Groove v3.');
  if(s.variation!==undefined)bounded(s.variation,0,1000000,'variation',true);
  if(s.phraseLength!==undefined&&(![4,8,16].includes(s.phraseLength)||s.algorithm!=='groove-v3'))throw Error('Phrase context requires Groove v3 and 4, 8 or 16 bars.');
  if(s.phraseOffset!==undefined){if(s.phraseLength===undefined)throw Error('Choose a phrase length before its position.');bounded(s.phraseOffset,0,s.phraseLength-1,'phrase position',true);}
  text(s.seed, 'seed', 80);
  bounded(s.bpm, 32, 999, 'BPM'); bounded(s.bars, 1, 4, 'bars', true);
  if (![8,16,32,64].includes(s.resolution)) throw new Error('Resolution must be 8, 16, 32 or 64.');
  for (const k of ['complexity','syncopation','ghostAmount','fillAmount'] as const) bounded(s[k],0,1,k);
  if(s.spicy!==undefined) bounded(s.spicy,0,1,'spicy');
  bounded(s.swing,.5,.67,'swing'); bounded(s.humanizeMs,0,10,'humanizeMs');
}

