import type {Genre} from './model.js';
import type {V5Profile,V5Layer} from './groove-v5-contract.js';
import {v5ProfileFor} from './groove-v5-baseline.js';

const hats=(id:string,steps:number[],minimum:number,gain:number):V5Layer=>({id,role:'hat',minimum,notes:steps.map(step=>({step,gain:step%4===2?gain:gain*.72}))});
const motif=(id:string,kicks:number[],snares:number[])=>({id,bars:1 as const,notes:[...kicks.map(step=>({bar:0,step,role:'kick' as const,gain:step===0?.96:.82})),...snares.map(step=>({bar:0,step,role:'snare' as const,gain:.93}))]});
const base=(genre:Genre):V5Profile=>({...structuredClone(v5ProfileFor(genre)),genre});
/** V5.1-only recipes. See docs/groove-v51-research.md for sources and limitations. */
export const V51_PROFILE_OVERRIDES:Partial<Record<Genre,V5Profile>>={
 dnb:{...base('dnb'),anchors:[motif('dnb-two-step',[0,10],[4,12]),motif('dnb-roller',[0,11],[4,12])],
  layers:[hats('dnb-eighths',[0,2,4,6,8,10,12,14],0,.55),hats('dnb-sixteenths',[1,3,5,7,9,11,13,15],.4,.38),
   {id:'dnb-ghost',role:'snare',minimum:.65,notes:[{step:7,gain:.3,ghost:true},{step:15,gain:.37,ghost:true}]}],
  timing:{kick:{swing:0,dragMs:0},snare:{swing:.15,dragMs:3},hat:{swing:.6,dragMs:0},percussion:{swing:.5,dragMs:0}}},
 halftimednb:{...base('halftimednb'),anchors:[motif('halftime-space',[0],[8])],
  layers:[hats('half-sparse',[2,6,10,14],0,.42),hats('half-detail',[3,11],.7,.28),{id:'half-pickup',role:'kick',minimum:.6,notes:[{step:14,gain:.64,syncopated:true}]}],
  cadences:[{id:'half-ending',role:'hat',minimum:.6,notes:[{step:14,gain:.4},{step:15,gain:.3}]}],responseWeight:.35},
 neurofunk:{...base('neurofunk'),anchors:[motif('neuro-machine',[0,9],[4,12])],
  layers:[hats('neuro-clock',[0,2,4,6,8,10,12,14],0,.56),hats('neuro-gears',[1,3,5,7,9,11,13,15],.25,.43),
   {id:'neuro-pickup',role:'kick',minimum:.65,notes:[{step:15,gain:.76,syncopated:true}]}],
  cadences:[{id:'neuro-chop',role:'snare',minimum:.6,notes:[{step:14,gain:.48},{step:15,gain:.6,rollRepeats:3}]}],
  timing:{kick:{swing:0,dragMs:0},snare:{swing:0,dragMs:0},hat:{swing:.1,dragMs:0},percussion:{swing:0,dragMs:0}},
  spice:{gestures:['chop','roll','pitch'],roles:['hat','snare'],maxPerBar:4,maxRepeats:4,minRepeatMs:14,pitchSteps:[0,-5,7]}},
 drumfunk:{...base('drumfunk'),anchors:[{id:'drumfunk-live',bars:2,notes:[...motif('a',[0,7],[4,12]).notes,...motif('b',[0,10,14],[4,12]).notes.map(n=>({...n,bar:1}))]}],
  layers:[hats('drumfunk-cymbal',[0,2,4,6,8,10,12,14],0,.45),{id:'drumfunk-buzz',role:'snare',minimum:.25,notes:[3,7,11,15].map((step,i)=>({step,gain:.28+i*.07,ghost:true}))},
   {id:'drumfunk-kick',role:'kick',minimum:.65,notes:[{step:5.5,gain:.6,syncopated:true},{step:13.5,gain:.54,syncopated:true}]}],
  cadences:[{id:'drumfunk-live-roll',role:'snare',minimum:.4,notes:[{step:13,gain:.3,ghost:true},{step:14.5,gain:.48,rollRepeats:3},{step:15.5,gain:.66}]}],
  timing:{kick:{swing:.55,dragMs:0},snare:{swing:.4,dragMs:4},hat:{swing:.7,dragMs:1},percussion:{swing:.55,dragMs:0}}},
 jumpup:{...base('jumpup'),anchors:[motif('jumpup-drive',[0,10,14],[4,12])],
  layers:[hats('jumpup-upbeats',[2,6,10,14],0,.8),hats('jumpup-pulse',[0,4,8,12],.45,.38),
   {id:'jumpup-kick',role:'kick',minimum:.8,notes:[{step:7,gain:.76,syncopated:true}]}],
  cadences:[{id:'jumpup-turnaround',role:'snare',minimum:.65,notes:[{step:14,gain:.65},{step:15,gain:.8}]}],responseWeight:.55,
  spice:{gestures:['roll','pitch'],roles:['hat','snare'],maxPerBar:2,maxRepeats:4,minRepeatMs:18,pitchSteps:[0,7]}}
};
export const v51ProfileFor=(genre:Genre):V5Profile=>V51_PROFILE_OVERRIDES[genre]??v5ProfileFor(genre);
