import type {Genre} from './model.js';

export type V3Family = 'jungle'|'hiphop'|'garage'|'dub'|'breaks'|'experimental';
export type V3Cadence = 'soft'|'funk'|'jungle'|'hats'|'dub'|'garage'|'broken'|'rave';
export interface V3Rule {
 family:V3Family;
 /** Sixteenth positions. Each seed selects one recurring spine; variation never changes it. */
 kicks:number[][]; snares:number[]; snareMotifs?:number[][];
 hats:number[]; hatDetails:number[]; ghosts:number[]; pickups:number[]; percussion:number[];
 accents:[number,number,number,number];
 snareDragMs:number; ghostPushMs:number; hatSwing:number; percussionSwing:number;
 activity:number; ghostGain:number; cadence:V3Cadence; fillStrength:number;
 burstBudget:number; maxRepeats:2|3|4|6|8; reverseChance:number; pitchSteps:number[];
 euclidean?:[pulses:number,steps:number,rotation:number];
 linear?:boolean; spaciousCall?:boolean; melodicPercussion?:boolean;
}
type RuleInput = Pick<V3Rule,'kicks'> & Partial<Omit<V3Rule,'family'|'kicks'>>;
const bases:Record<V3Family,Omit<V3Rule,'family'|'kicks'>>={
 jungle:{snares:[4,12],hats:[0,2,6,8,10,14],hatDetails:[1,4,5,9,12,13],ghosts:[3,7,11,15],pickups:[3,7,14],percussion:[5,13],accents:[.46,.23,.39,.26],snareDragMs:1.5,ghostPushMs:2,hatSwing:.7,percussionSwing:.5,activity:.8,ghostGain:.32,cadence:'jungle',fillStrength:.8,burstBudget:2,maxRepeats:4,reverseChance:.16,pitchSteps:[0,0,7,12]},
 hiphop:{snares:[4,12],hats:[0,4,8,12],hatDetails:[2,6,10,14],ghosts:[3,11,15],pickups:[3,6,14],percussion:[7,15],accents:[.44,.22,.34,.2],snareDragMs:6,ghostPushMs:1,hatSwing:1,percussionSwing:.8,activity:.6,ghostGain:.28,cadence:'funk',fillStrength:.45,burstBudget:1,maxRepeats:3,reverseChance:.05,pitchSteps:[0,0,-2]},
 garage:{snares:[4,12],hats:[2,6,10,14],hatDetails:[1,3,5,7,9,11,13,15],ghosts:[3,11],pickups:[7,15],percussion:[3,7,11,15],accents:[.31,.22,.46,.26],snareDragMs:1,ghostPushMs:1,hatSwing:1,percussionSwing:.85,activity:.72,ghostGain:.27,cadence:'garage',fillStrength:.6,burstBudget:1,maxRepeats:3,reverseChance:.08,pitchSteps:[0,0,7]},
 dub:{snares:[8],hats:[2,6,10,14],hatDetails:[7,15],ghosts:[7,15],pickups:[6,14],percussion:[3,11],accents:[.36,.19,.32,.23],snareDragMs:3,ghostPushMs:1,hatSwing:.75,percussionSwing:.7,activity:.5,ghostGain:.27,cadence:'dub',fillStrength:.45,burstBudget:1,maxRepeats:3,reverseChance:.08,pitchSteps:[0,0,-2,7]},
 breaks:{snares:[4,12],hats:[0,2,6,8,10,14],hatDetails:[3,4,7,11,12,15],ghosts:[3,7,15],pickups:[3,7,11,15],percussion:[6,14],accents:[.48,.26,.42,.28],snareDragMs:1,ghostPushMs:1.5,hatSwing:.7,percussionSwing:.65,activity:.72,ghostGain:.3,cadence:'funk',fillStrength:.7,burstBudget:2,maxRepeats:4,reverseChance:.12,pitchSteps:[0,0,7]},
 experimental:{snares:[4,12],hats:[0,3,6,8,11,14],hatDetails:[1,5,9,13],ghosts:[2,7,10,15],pickups:[3,6,11,14],percussion:[5,13],accents:[.43,.21,.36,.25],snareDragMs:0,ghostPushMs:2,hatSwing:.6,percussionSwing:.8,activity:.9,ghostGain:.31,cadence:'broken',fillStrength:.95,burstBudget:3,maxRepeats:6,reverseChance:.26,pitchSteps:[0,7,12,-12],euclidean:[5,16,1]}
};
const rule=(family:V3Family,input:RuleInput):V3Rule=>({...bases[family],family,...input});

/** Original production recipes, not transcriptions of recordings or claims about an entire genre. */
export const V3_RULES:Record<Genre,V3Rule>={
 jungle:rule('jungle',{snareMotifs:[[4,12],[4,10]],kicks:[[0,6,10],[0,8,11],[0,7,10]],ghosts:[3,7,9,11,15]}),
 dnb:rule('jungle',{kicks:[[0,10],[0,6,10]],hats:[0,2,4,6,8,10,12,14],hatDetails:[3,7,11,15],pickups:[7,14],percussion:[13],activity:.6,ghostGain:.27,burstBudget:1,cadence:'funk',reverseChance:.04,pitchSteps:[0,0,-2]}),
 hiphop:rule('hiphop',{kicks:[[0,6],[0,7,10]],hatDetails:[2,6,10,14,15],percussion:[7],snareDragMs:7}),
 trap:rule('hiphop',{kicks:[[0,6,11],[0,3,14]],snares:[8],hats:[0,2,4,6,8,10,12,14],hatDetails:[3,7,11,15],ghosts:[15],pickups:[3,10,14],percussion:[7,13],snareDragMs:0,ghostPushMs:0,cadence:'hats',activity:.82,burstBudget:2,maxRepeats:6,pitchSteps:[0,-2,-5,-12],fillStrength:.75}),
 rap:rule('hiphop',{kicks:[[0,7],[0,10]],hats:[0,4,8,12],hatDetails:[6,14],ghosts:[11],pickups:[10],percussion:[15],snareDragMs:3,activity:.38,cadence:'soft',fillStrength:.25,maxRepeats:2}),
 drill:rule('dub',{kicks:[[0,7,14],[0,3,10]],hats:[0,3,6,8,11,14],hatDetails:[],ghosts:[7],pickups:[3,11],percussion:[14,15],snareDragMs:0,hatSwing:.35,cadence:'hats',activity:.75,burstBudget:2,maxRepeats:6,pitchSteps:[0,-2,-5,-12],fillStrength:.7}),
 breakcore:rule('experimental',{kicks:[[0,3,9,14],[0,6,11,15]],hats:[0,3,6,8,11,14],hatDetails:[1,4,5,7,9,12,13,15],ghosts:[2,7,9,10,13,15],pickups:[2,7,11,13],maxRepeats:8,burstBudget:3,spaciousCall:true}),
 idm:rule('experimental',{kicks:[[0,5,11],[0,7,13]],snares:[6,12],hats:[0,5,8,14],hatDetails:[3,11],ghosts:[5,10,15],snareDragMs:2,activity:.72,euclidean:[5,12,2],cadence:'broken',burstBudget:2}),
 hardcore:rule('breaks',{kicks:[[0,4,8,12]],hats:[2,6,10,14],hatDetails:[3,7,11,15],ghosts:[11,15],pickups:[7,15],percussion:[7,15],snareDragMs:0,hatSwing:0,percussionSwing:0,cadence:'rave',activity:.6,fillStrength:.85,maxRepeats:6}),
 experimental:rule('experimental',{kicks:[[0,5,14],[0,7,10]],snares:[5,13],hats:[0,2,9,15],hatDetails:[5,12],ghosts:[3,10,14],percussion:[1,6,11],euclidean:[5,14,3],pitchSteps:[0,5,7,12,-7],spaciousCall:true}),
 breaks:rule('breaks',{kicks:[[0,6,8,11],[0,3,8,10]],hatDetails:[3,7,11,15],snareDragMs:2}),
 bigbeat:rule('breaks',{kicks:[[0,2,8,10],[0,3,8,14]],hats:[0,4,8,12],hatDetails:[2,10,14],ghosts:[7,11],percussion:[3,15],snareDragMs:4,activity:.55,ghostGain:.36,accents:[.54,.28,.43,.25],maxRepeats:3}),
 nuskoolbreaks:rule('breaks',{kicks:[[0,7,10],[0,6,11,14]],hats:[0,2,5,6,8,10,13,14],hatDetails:[3,7,11,15],ghosts:[3,15],percussion:[7,11],snareDragMs:0,hatSwing:.25,cadence:'broken',activity:.8,burstBudget:2}),
 electrobreaks:rule('breaks',{kicks:[[0,3,8,14],[0,6,8,11]],hats:[0,2,4,6,8,10,12,14],hatDetails:[7,15],ghosts:[15],percussion:[3,6,11,14],snareDragMs:0,ghostPushMs:0,hatSwing:0,percussionSwing:0,activity:.5,cadence:'garage',reverseChance:0,pitchSteps:[0],maxRepeats:3}),
 breakbeathardcore:rule('breaks',{kicks:[[0,4,8,11,12],[0,4,7,8,12]],hats:[2,6,10,14],hatDetails:[3,7,11,15],ghosts:[3,7,15],cadence:'jungle',activity:.87,fillStrength:.95,burstBudget:3,maxRepeats:6}),
 raggajungle:rule('jungle',{snareMotifs:[[4,12],[4,10]],kicks:[[0,6,11,14],[0,7,10]],hats:[0,2,3,6,8,10,11,14],hatDetails:[5,7,13,15],ghosts:[3,7,9,15],percussion:[5,13,15],cadence:'funk',activity:.86,ghostGain:.35,percussionSwing:1}),
 atmosphericjungle:rule('jungle',{snareMotifs:[[4,12],[4,10]],kicks:[[0,10],[0,7]],hats:[0,2,6,8,10,14],hatDetails:[7,15],ghosts:[3,7,11,15],percussion:[13],snareDragMs:2,activity:.42,ghostGain:.25,cadence:'soft',fillStrength:.32,burstBudget:1,maxRepeats:3,spaciousCall:true,reverseChance:.07,pitchSteps:[0,7]}),
 footworkjungle:rule('jungle',{kicks:[[0,3,6,10,14],[0,3,7,10,13]],snares:[8,12],hats:[0,3,6,8,11,14],hatDetails:[],ghosts:[5,7,13,15],percussion:[2,9,15],pickups:[9,13],cadence:'broken',activity:.83,burstBudget:2,maxRepeats:6,euclidean:[3,8,0],hatSwing:0}),
 downtempo:rule('hiphop',{kicks:[[0,7],[0,10]],hats:[0,4,8,12],hatDetails:[6,14],ghosts:[3,11],percussion:[14],pickups:[6],snareDragMs:5,activity:.32,cadence:'soft',fillStrength:.2,maxRepeats:2}),
 lofihiphop:rule('hiphop',{kicks:[[0,6,10],[0,7,11]],hats:[0,2,8,10],hatDetails:[6,14],ghosts:[3,7,11],percussion:[15],snareDragMs:9,activity:.42,ghostGain:.25,cadence:'soft',fillStrength:.3,maxRepeats:2,pitchSteps:[0,-2]}),
 boombap:rule('hiphop',{kicks:[[0,3,8,10],[0,6,8,14]],hats:[0,2,4,6,8,10,12,14],hatDetails:[7,15],ghosts:[3,11,15],percussion:[7],pickups:[13,15],snareDragMs:4,activity:.68,ghostGain:.34,accents:[.49,.25,.37,.22],fillStrength:.55}),
 mellowbeats:rule('hiphop',{kicks:[[0,10],[0,6]],hats:[0,4,8,14],hatDetails:[10],ghosts:[11],pickups:[14],percussion:[6],snareDragMs:6,activity:.22,ghostGain:.23,cadence:'soft',fillStrength:.15,maxRepeats:2,reverseChance:0,pitchSteps:[0]}),
 liquiddnb:rule('jungle',{kicks:[[0,10],[0,7,10]],hats:[0,2,4,6,8,10,12,14],hatDetails:[1,3,5,7,9,11,13,15],ghosts:[3,7,9,14,15],percussion:[13],pickups:[7,14],snareDragMs:1.5,activity:.82,ghostGain:.32,cadence:'funk',fillStrength:.5,burstBudget:1,maxRepeats:3,reverseChance:.05,pitchSteps:[0,7]}),
 jumpup:rule('jungle',{kicks:[[0,10],[0,8,10]],hats:[0,2,6,8,10,14],hatDetails:[7,15],ghosts:[7,15],percussion:[3],pickups:[3,14],snareDragMs:0,hatSwing:.25,activity:.5,ghostGain:.27,cadence:'rave',fillStrength:.7,burstBudget:1,maxRepeats:4,reverseChance:.04,pitchSteps:[0,-2]}),
 garage:rule('garage',{kicks:[[0,4,8,12]],hatDetails:[3,5,7,11,13,15]}),
 speedgarage:rule('garage',{kicks:[[0,4,8,12]],hats:[2,6,10,14],hatDetails:[3,7,11,15],ghosts:[7,15],percussion:[3,6,11,14],pickups:[3,11,15],snareDragMs:0,hatSwing:.8,activity:.8,cadence:'rave',fillStrength:.8,maxRepeats:4,accents:[.35,.24,.52,.3]}),
 twostepgarage:rule('garage',{kicks:[[0,6,10],[0,7,14],[0,3,10]],hats:[2,6,10,14],hatDetails:[1,3,7,9,11,15],pickups:[3,7,14],percussion:[2,7,10,15],snareDragMs:2,activity:.82,ghostGain:.3}),
 dub:rule('dub',{kicks:[[8]],hats:[2,6,10,14],hatDetails:[],ghosts:[7],percussion:[3,11],pickups:[14],snareDragMs:4,activity:.28,fillStrength:.2,maxRepeats:2,pitchSteps:[0],reverseChance:0}),
 psydub:rule('dub',{kicks:[[0,7,10],[0,6,14]],hats:[0,3,8,11],hatDetails:[6,14],ghosts:[7,15],percussion:[2,5,9,13],pickups:[5,11],activity:.75,cadence:'broken',fillStrength:.65,euclidean:[5,16,2],burstBudget:2,maxRepeats:4,reverseChance:.2,pitchSteps:[0,7,12,-5]}),
 dubstep:rule('dub',{kicks:[[0,6],[0,3,11]],hats:[0,2,6,10,14],hatDetails:[7,15],ghosts:[15],percussion:[3,13],pickups:[14],activity:.42,fillStrength:.35,hatSwing:.8}),
 brostep:rule('dub',{kicks:[[0,3,6],[0,6,14]],hats:[0,2,4,6,10,12,14],hatDetails:[7,15],ghosts:[7,15],percussion:[5,13],pickups:[3,11],snareDragMs:0,hatSwing:0,cadence:'rave',activity:.72,fillStrength:.95,burstBudget:2,maxRepeats:6,reverseChance:.14,pitchSteps:[0,7,-12]}),
 postdubstep:rule('dub',{kicks:[[0,5,11],[0,7,14]],snares:[6,12],hats:[0,3,7,10,14],hatDetails:[5,13],ghosts:[5,11,15],percussion:[2,9,13],pickups:[9,15],snareDragMs:6,hatSwing:1,percussionSwing:1,activity:.58,cadence:'garage',fillStrength:.4,reverseChance:.12}),
 drumfunk:rule('jungle',{snareMotifs:[[4,12],[4,10],[4,14]],kicks:[[0,3,10],[0,6,8,14],[0,7,11]],hats:[0,2,6,8,10,14],hatDetails:[5,13],ghosts:[2,3,7,9,11,15],percussion:[5,13],pickups:[6,9,14],snareDragMs:2,activity:.92,ghostGain:.39,cadence:'funk',fillStrength:.9,linear:true,burstBudget:2,maxRepeats:4,reverseChance:.04,pitchSteps:[0,-2]}),
 amenscience:rule('jungle',{snareMotifs:[[4,12],[4,10],[4,14]],kicks:[[0,6,10,15],[0,7,10],[0,3,8,11]],hats:[0,2,3,6,8,10,11,14],hatDetails:[5,7,13,15],ghosts:[3,7,9,11,15],percussion:[5,13],pickups:[2,9,14],activity:.94,ghostGain:.34,fillStrength:1,burstBudget:3,maxRepeats:8,reverseChance:.26,pitchSteps:[0,7,12,-12]}),
 atmosphericbreakcore:rule('experimental',{kicks:[[0,10],[0,7,11]],hats:[0,4,8,12],hatDetails:[2,6,10,14],ghosts:[3,7,11,15],percussion:[2,6,10,14],pickups:[7,14],snareDragMs:2,activity:.65,ghostGain:.28,spaciousCall:true,melodicPercussion:true,euclidean:undefined,cadence:'jungle',fillStrength:.78,burstBudget:2,maxRepeats:6,reverseChance:.14,pitchSteps:[0,7,12,-12]}),
 triphop:rule('hiphop',{kicks:[[0,7,8],[0,6,11]],hats:[0,4,10,12],hatDetails:[6,14],ghosts:[3,15],percussion:[7,13],pickups:[11],snareDragMs:8,activity:.4,cadence:'dub',fillStrength:.35,pitchSteps:[0,-2,-5],reverseChance:.1}),
 halftimednb:rule('jungle',{kicks:[[0,5,11],[0,7,14]],snares:[8],hats:[0,3,6,10,14],hatDetails:[7,15],ghosts:[7,15],percussion:[2,9,13],pickups:[3,14],activity:.6,cadence:'dub',fillStrength:.5,burstBudget:1,maxRepeats:4}),
 neurofunk:rule('jungle',{kicks:[[0,10,14],[0,6,10],[0,7,10]],hats:[0,2,4,6,8,10,12,14],hatDetails:[5,7,13,15],ghosts:[3,7,15],percussion:[5,11,13],pickups:[3,7,14],snareDragMs:0,ghostPushMs:1,hatSwing:.2,percussionSwing:.3,activity:.78,cadence:'rave',fillStrength:.7,burstBudget:2,maxRepeats:4,reverseChance:.08,pitchSteps:[0,0,-2]})
};
