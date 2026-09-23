import type {BreakStyle} from './model.js';
interface BreakPreset {
  name:string; description:string; kicks:number[][]; hats:number;
  hatSteps:number[]; ghosts:number[]; percussion:number[]; snares:number[];
}
// Original rhythmic interpretations, not transcriptions or bundled recordings.
export const BREAKS:Record<Exclude<BreakStyle,'genre'>,BreakPreset>={
  amen:{name:'Amen-inspired',description:'Broken kick pickups, rolling ghost snares and busy hats.',kicks:[[0,6,10],[0,7,10,15]],hats:2,hatSteps:[0,2,4,6,8,10,12,14],ghosts:[3,7,9,11,15],percussion:[],snares:[4,12]},
  think:{name:'Think-inspired',description:'A lighter, skipping kick motif with crisp percussion responses.',kicks:[[0,3,10],[0,6,14]],hats:2,hatSteps:[0,2,5,6,8,10,13,14],ghosts:[7,11,15],percussion:[3,7,11,15],snares:[4,12]},
  apache:{name:'Apache-inspired',description:'Spaced kicks with a recurring percussion counter-rhythm.',kicks:[[0,8,10],[0,8,14]],hats:2,hatSteps:[0,2,6,8,10,14],ghosts:[7,15],percussion:[1,3,6,9,11,14],snares:[4,12]},
  funkyDrummer:{name:'Funky Drummer-inspired',description:'Steady sixteenth-note hats and ghost snares around the backbeat.',kicks:[[0,7,8],[0,6,10]],hats:1,hatSteps:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],ghosts:[2,3,6,7,10,11,14,15],percussion:[13],snares:[4,12]},
  hotPants:{name:'Hot Pants-inspired',description:'Short kick pickups, open spaces and a busy percussion response.',kicks:[[0,2,7,10],[0,3,8,11]],hats:2,hatSteps:[0,2,4,7,8,10,12,15],ghosts:[3,6,11],percussion:[5,9,13,15],snares:[4,12]},
};
