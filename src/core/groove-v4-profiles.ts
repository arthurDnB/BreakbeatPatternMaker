import type {Genre,Role} from './model.js';
import {V3_RULES,type V3Family} from './groove-v3-profiles.js';

/** Positions are sixteenths within a bar. Half steps are 32nds. */
export interface V4Note {
 role:Role; step:number; gain:number; depth:number; ghost?:boolean;
}
export type V4Gesture='roll'|'reverse'|'pitch'|'chop'|'push';
export interface V4Profile {
 family:V3Family;
 /** A sparse, stable hat pulse survives even at zero complexity. */
 pulseDensity:number;
 /** Genre-specific call/answer phrases. Depth is the minimum Complexity setting. */
 call:readonly V4Note[]; answer:readonly V4Note[];
 /** Maximum number of articulated hits per bar at full Spicy. */
 gestureBudget:number;
 gestures:readonly V4Gesture[];
 fillRole:Role; fillSteps:readonly number[];
 /** Phrase endings are more likely to vary than the opening bar. */
 responseWeight:number;
}
const n=(role:Role,step:number,gain:number,depth:number,ghost=false):V4Note=>({role,step,gain,depth,...(ghost?{ghost:true}:{})});
type Override=Partial<Omit<V4Profile,'family'>>;
const FAMILY:Record<V3Family,Omit<V4Profile,'family'>>={
 jungle:{pulseDensity:.72,call:[n('snare',7,.25,.22,true),n('hat',5.5,.22,.38)],answer:[n('snare',13,.29,.2,true),n('hat',14.5,.24,.4),n('percussion',15,.29,.72)],gestureBudget:3,gestures:['roll','chop','pitch','reverse','push'],fillRole:'snare',fillSteps:[12,13,14,15],responseWeight:1},
 hiphop:{pulseDensity:.56,call:[n('hat',6,.23,.3),n('snare',7,.25,.5,true)],answer:[n('percussion',13,.27,.45),n('snare',15,.23,.64,true)],gestureBudget:2,gestures:['roll','push','pitch'],fillRole:'snare',fillSteps:[13,15],responseWeight:.72},
 garage:{pulseDensity:.76,call:[n('percussion',6.5,.29,.3),n('hat',7,.24,.48)],answer:[n('percussion',13,.27,.34),n('snare',15,.25,.62,true)],gestureBudget:3,gestures:['roll','push','reverse'],fillRole:'hat',fillSteps:[12,13.5,15],responseWeight:.88},
 dub:{pulseDensity:.4,call:[n('percussion',6,.3,.42)],answer:[n('percussion',13,.27,.44),n('hat',15,.24,.7)],gestureBudget:2,gestures:['push','reverse','pitch'],fillRole:'percussion',fillSteps:[12,15],responseWeight:.62},
 breaks:{pulseDensity:.7,call:[n('snare',7,.26,.28,true),n('hat',5.5,.23,.42)],answer:[n('kick',11,.57,.55),n('snare',15,.28,.44,true)],gestureBudget:3,gestures:['roll','chop','reverse','push'],fillRole:'snare',fillSteps:[12,14,15],responseWeight:.92},
 experimental:{pulseDensity:.7,call:[n('percussion',5.5,.25,.3),n('snare',7,.3,.46,true)],answer:[n('hat',12.5,.23,.24),n('snare',13.5,.31,.5,true),n('percussion',15,.32,.7)],gestureBudget:5,gestures:['roll','chop','reverse','pitch','push'],fillRole:'snare',fillSteps:[11.5,13,14.5,15.5],responseWeight:1}
};
function profile(genre:Genre,override:Override={}):V4Profile {
 const family=V3_RULES[genre].family;
 return {...FAMILY[family],family,...override};
}

/** Production starting points. Tune a genre here without changing the engine stages. */
export const V4_PROFILES:Record<Genre,V4Profile>={
 jungle:profile('jungle',{answer:[n('snare',9,.27,.3,true),n('snare',13,.3,.4,true),n('hat',14.5,.24,.58)],fillSteps:[11,13,14.5,15.5]}),
 dnb:profile('dnb',{pulseDensity:.85,call:[n('hat',7,.22,.36)],answer:[n('snare',15,.22,.62,true),n('hat',14.5,.25,.72)],gestureBudget:2,gestures:['roll','push'],fillSteps:[14,15]}),
 hiphop:profile('hiphop',{answer:[n('snare',11,.22,.42,true),n('percussion',15,.26,.64)]}),
 trap:profile('trap',{pulseDensity:.88,call:[n('hat',5.5,.24,.24),n('hat',7.5,.2,.5)],answer:[n('hat',13.5,.24,.24),n('hat',14.5,.25,.5),n('hat',15.5,.19,.78)],gestureBudget:4,gestures:['roll','pitch','push'],fillRole:'hat',fillSteps:[12,13,14,15]}),
 rap:profile('rap',{pulseDensity:.42,call:[n('hat',6,.21,.5)],answer:[n('percussion',15,.23,.72)],gestureBudget:1,gestures:['push'],fillSteps:[15]}),
 drill:profile('drill',{pulseDensity:.74,call:[n('hat',5.5,.22,.3),n('percussion',6.5,.24,.58)],answer:[n('hat',13.5,.22,.25),n('kick',14,.58,.74),n('hat',15.5,.24,.72)],gestureBudget:4,gestures:['roll','pitch','push'],fillRole:'hat',fillSteps:[11,13,14.5,15.5]}),
 breakcore:profile('breakcore',{call:[n('snare',2.5,.29,.22,true),n('percussion',7.5,.28,.44),n('hat',9.5,.24,.68)],answer:[n('snare',11.5,.3,.22,true),n('hat',13.5,.22,.4),n('snare',15.5,.37,.64)],gestureBudget:6,fillSteps:[10,11.5,13,14.5,15.5]}),
 idm:profile('idm',{call:[n('percussion',5.5,.26,.28),n('hat',10.5,.21,.52)],answer:[n('snare',13.5,.29,.32,true),n('percussion',15,.3,.55)],gestureBudget:4,fillSteps:[11.5,13,14.5]}),
 hardcore:profile('hardcore',{pulseDensity:.72,call:[n('hat',6,.25,.35)],answer:[n('snare',14,.42,.55),n('hat',15,.3,.7)],gestureBudget:3,gestures:['roll','pitch'],fillSteps:[12,13,14,15]}),
 experimental:profile('experimental',{call:[n('percussion',3.5,.27,.24),n('snare',10.5,.31,.5,true)],answer:[n('hat',12.5,.24,.3),n('percussion',14.5,.29,.52)]}),
 breaks:profile('breaks',{call:[n('snare',7,.24,.35,true),n('hat',5.5,.25,.55)],answer:[n('kick',11,.55,.58),n('snare',15,.27,.68,true)]}),
 bigbeat:profile('bigbeat',{pulseDensity:.5,call:[n('percussion',7,.35,.5)],answer:[n('snare',15,.34,.7)],gestureBudget:2,gestures:['roll','push'],fillSteps:[12,15]}),
 nuskoolbreaks:profile('nuskoolbreaks',{call:[n('hat',5.5,.25,.3),n('percussion',7,.3,.55)],answer:[n('kick',11,.58,.4),n('snare',15,.31,.7,true)],gestures:['roll','chop','push']}),
 electrobreaks:profile('electrobreaks',{pulseDensity:.9,call:[n('percussion',6,.27,.4)],answer:[n('percussion',14,.31,.55)],gestureBudget:2,gestures:['roll','pitch'],fillRole:'percussion',fillSteps:[12,14]}),
 breakbeathardcore:profile('breakbeathardcore',{call:[n('snare',7,.32,.3,true),n('hat',9.5,.25,.5)],answer:[n('snare',13,.37,.32,true),n('percussion',15,.37,.6)],gestureBudget:4,fillSteps:[11,12.5,14,15]}),
 raggajungle:profile('raggajungle',{call:[n('percussion',5,.3,.26),n('snare',7,.25,.48,true)],answer:[n('percussion',13,.32,.3),n('snare',15,.3,.55,true)],fillSteps:[11,13,15]}),
 atmosphericjungle:profile('atmosphericjungle',{pulseDensity:.4,call:[n('hat',6,.21,.54)],answer:[n('snare',15,.22,.46,true),n('percussion',13,.25,.74)],gestureBudget:2,gestures:['push','reverse'],fillSteps:[15],responseWeight:.58}),
 footworkjungle:profile('footworkjungle',{call:[n('percussion',6.5,.27,.25),n('snare',9,.24,.5,true)],answer:[n('kick',13,.57,.35),n('hat',15.5,.22,.65)],gestureBudget:4,gestures:['roll','push','chop'],fillRole:'hat',fillSteps:[11,12.5,14,15.5]}),
 downtempo:profile('downtempo',{pulseDensity:.38,call:[n('hat',6,.2,.62)],answer:[n('percussion',14,.23,.72)],gestureBudget:1,gestures:['push'],fillSteps:[15],responseWeight:.55}),
 lofihiphop:profile('lofihiphop',{pulseDensity:.55,call:[n('snare',7,.22,.45,true)],answer:[n('hat',14,.22,.52),n('snare',15,.22,.75,true)],gestureBudget:1,gestures:['push','pitch'],fillSteps:[15],responseWeight:.65}),
 boombap:profile('boombap',{call:[n('snare',7,.27,.27,true),n('hat',6.5,.23,.51)],answer:[n('kick',10.5,.54,.58),n('snare',15,.29,.66,true)],gestureBudget:2,gestures:['roll','push'],fillSteps:[13,15]}),
 mellowbeats:profile('mellowbeats',{pulseDensity:.3,call:[n('hat',6,.18,.7)],answer:[n('percussion',14,.22,.82)],gestureBudget:1,gestures:['push'],fillSteps:[15],responseWeight:.45}),
 liquiddnb:profile('liquiddnb',{pulseDensity:.85,call:[n('hat',5.5,.21,.38),n('snare',7,.22,.6,true)],answer:[n('snare',15,.24,.45,true),n('hat',13.5,.21,.68)],gestureBudget:2,gestures:['roll','push'],fillSteps:[14,15],responseWeight:.68}),
 jumpup:profile('jumpup',{pulseDensity:.67,call:[n('hat',7,.25,.5)],answer:[n('snare',14,.36,.55),n('hat',15,.26,.68)],gestureBudget:2,gestures:['roll','push'],fillSteps:[14,15]}),
 garage:profile('garage',{call:[n('percussion',6.5,.27,.35),n('hat',7,.23,.5)],answer:[n('snare',11,.28,.5,true),n('percussion',15,.3,.68)]}),
 speedgarage:profile('speedgarage',{pulseDensity:.92,call:[n('percussion',6.5,.33,.27),n('hat',7.5,.24,.55)],answer:[n('snare',13,.34,.38,true),n('percussion',15,.34,.62)],gestureBudget:3,fillSteps:[12,13.5,15]}),
 twostepgarage:profile('twostepgarage',{pulseDensity:.74,call:[n('hat',5.5,.24,.27),n('percussion',7,.31,.48)],answer:[n('snare',11,.26,.48,true),n('percussion',13.5,.3,.62)],gestures:['push','roll','reverse'],fillSteps:[13,15]}),
 dub:profile('dub',{pulseDensity:.32,call:[n('percussion',6,.24,.55)],answer:[n('percussion',14,.24,.72)],gestureBudget:1,gestures:['push'],fillSteps:[15],responseWeight:.4}),
 psydub:profile('psydub',{pulseDensity:.65,call:[n('percussion',5.5,.24,.28),n('hat',9.5,.22,.5)],answer:[n('percussion',13.5,.3,.35),n('hat',15,.23,.66)],gestureBudget:3,fillSteps:[12,14.5,15.5]}),
 dubstep:profile('dubstep',{pulseDensity:.53,call:[n('hat',7,.22,.5)],answer:[n('percussion',13,.28,.6)],gestureBudget:2,gestures:['roll','push'],fillSteps:[13,15]}),
 brostep:profile('brostep',{pulseDensity:.7,call:[n('hat',6.5,.26,.28)],answer:[n('snare',14,.45,.44),n('percussion',15,.34,.68)],gestureBudget:4,gestures:['roll','pitch','reverse','chop'],fillRole:'snare',fillSteps:[12,13,14,15]}),
 postdubstep:profile('postdubstep',{pulseDensity:.47,call:[n('percussion',7,.26,.42)],answer:[n('hat',13.5,.24,.48),n('snare',15,.23,.72,true)],gestureBudget:2,gestures:['push','reverse'],fillSteps:[15]}),
 drumfunk:profile('drumfunk',{call:[n('snare',6.5,.3,.22,true),n('percussion',9.5,.26,.45)],answer:[n('snare',13.5,.3,.22,true),n('hat',14.5,.24,.52),n('snare',15.5,.32,.7,true)],gestureBudget:3,gestures:['roll','chop','push'],fillSteps:[11.5,13.5,15]}),
 amenscience:profile('amenscience',{pulseDensity:.9,call:[n('snare',6.5,.28,.2,true),n('hat',9.5,.24,.42)],answer:[n('snare',11.5,.35,.23,true),n('snare',13.5,.34,.5,true),n('hat',15.5,.23,.7)],gestureBudget:5,fillSteps:[11.5,12.5,13.5,14.5,15.5]}),
 atmosphericbreakcore:profile('atmosphericbreakcore',{pulseDensity:.48,call:[n('hat',6.5,.22,.4),n('percussion',9.5,.26,.62)],answer:[n('snare',11.5,.29,.26,true),n('hat',13.5,.22,.5),n('snare',15.5,.33,.72,true)],gestureBudget:4,fillSteps:[11.5,13,14.5,15.5],responseWeight:.8}),
 triphop:profile('triphop',{pulseDensity:.45,call:[n('hat',6,.22,.52),n('snare',7,.24,.66,true)],answer:[n('percussion',13,.25,.48)],gestureBudget:2,gestures:['push','reverse'],fillSteps:[13,15]}),
 halftimednb:profile('halftimednb',{pulseDensity:.65,call:[n('hat',6.5,.22,.3)],answer:[n('snare',15,.25,.58,true),n('percussion',13,.28,.72)],gestureBudget:2,gestures:['roll','push'],fillSteps:[14,15]}),
 neurofunk:profile('neurofunk',{pulseDensity:.86,call:[n('percussion',5.5,.27,.28),n('hat',7.5,.23,.5)],answer:[n('snare',13.5,.27,.4,true),n('percussion',15,.31,.62)],gestureBudget:3,gestures:['roll','pitch','push'],fillSteps:[12,14,15]})
};
