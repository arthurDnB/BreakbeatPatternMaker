import type {Genre,Role} from './model.js';
export type Family = 'Jungle & DnB'|'Hip-Hop & Downtempo'|'Garage'|'Dub & Bass'|'Breaks & Rave'|'Experimental';
export type FillStyle = 'soft'|'funk'|'jungle'|'hats'|'dub'|'garage'|'broken'|'rave';
export interface GrooveRule {
 family:Family; response:number[]; fillStyle:FillStyle; lateSnareMs:number;
 hatSwing:number; ghostLevel:number; detail:number; maxBursts:number; maxRatchet:number;
 reverse:number; pitch:number; accent:number[]; kickExtras:number[];
 kicks?:number[][];
}
const families:Record<Family,Omit<GrooveRule,'family'|'response'>>={
 'Jungle & DnB':{fillStyle:'jungle',lateSnareMs:1,hatSwing:.8,ghostLevel:.25,detail:.55,maxBursts:3,maxRatchet:6,reverse:.25,pitch:4,accent:[.52,.26,.4,.3],kickExtras:[3,7,11,15]},
 'Hip-Hop & Downtempo':{fillStyle:'funk',lateSnareMs:7,hatSwing:1,ghostLevel:.22,detail:.35,maxBursts:2,maxRatchet:4,reverse:.12,pitch:2,accent:[.42,.23,.34,.2],kickExtras:[3,6,10,14]},
 'Garage':{fillStyle:'garage',lateSnareMs:2,hatSwing:1,ghostLevel:.22,detail:.5,maxBursts:2,maxRatchet:4,reverse:.15,pitch:2,accent:[.32,.23,.48,.27],kickExtras:[3,7,10,15]},
 'Dub & Bass':{fillStyle:'dub',lateSnareMs:3,hatSwing:.9,ghostLevel:.2,detail:.38,maxBursts:2,maxRatchet:4,reverse:.15,pitch:3,accent:[.4,.2,.36,.22],kickExtras:[3,6,11,14]},
 'Breaks & Rave':{fillStyle:'rave',lateSnareMs:0,hatSwing:.8,ghostLevel:.24,detail:.5,maxBursts:3,maxRatchet:6,reverse:.18,pitch:3,accent:[.48,.26,.42,.3],kickExtras:[3,7,11,15]},
 'Experimental':{fillStyle:'broken',lateSnareMs:0,hatSwing:.7,ghostLevel:.26,detail:.7,maxBursts:4,maxRatchet:8,reverse:.35,pitch:7,accent:[.44,.2,.36,.27],kickExtras:[3,5,11,14]}
};
function rule(family:Family,response:number[],extra:Partial<GrooveRule>={}):GrooveRule{return {...families[family],family,response,...extra};}
export const GROOVES:Record<Genre,GrooveRule>={
 jungle:rule('Jungle & DnB',[3,11,15],{kicks:[[0,8,11],[0,6,10],[0,7,11],[0,3,8,10],[0,6,11,14],[0,10,14],[0,3,7,10]]}),
 dnb:rule('Jungle & DnB',[7,14],{detail:.45,maxBursts:2,reverse:.12,kicks:[[0,10],[0,6,10],[0,8,11],[0,7,10],[0,3,10],[0,10,14]]}),
 hiphop:rule('Hip-Hop & Downtempo',[7,14],{kicks:[[0,6],[0,10],[0,7],[0,3,10],[0,6,14],[0,8,10]]}),
 trap:rule('Hip-Hop & Downtempo',[3,11,14],{fillStyle:'hats',lateSnareMs:0,detail:.6,maxRatchet:6,hatSwing:1,pitch:4,kicks:[[0,6,11],[0,3,14],[0,8,11],[0,3,7,14],[0,6,10,14]]}),
 rap:rule('Hip-Hop & Downtempo',[10,14],{detail:.28,lateSnareMs:3,maxBursts:1,fillStyle:'soft',kicks:[[0,7],[0,10],[0,6,14],[0,3,10]]}),
 drill:rule('Dub & Bass',[3,10,14],{fillStyle:'hats',detail:.6,maxRatchet:6,pitch:4,kicks:[[0,7,14],[0,3,10],[0,6,11],[0,3,7,14],[0,7,10,14]]}),
 breakcore:rule('Experimental',[2,7,11,15],{detail:.85,kicks:[[0,3,9,14],[0,6,11,15],[0,3,6,10,13],[0,2,7,11,14],[0,4,7,10,15]]}),
 idm:rule('Experimental',[5,10,15],{lateSnareMs:2,maxBursts:3,kicks:[[0,5,11],[0,7,13],[0,3,8,14],[0,6,10,15],[0,4,9,13]]}),
 hardcore:rule('Breaks & Rave',[7,15],{maxRatchet:6,detail:.45,kicks:[[0,4,8,12],[0,4,8,11,12],[0,4,7,8,12],[0,4,8,12,15]]}),
 experimental:rule('Experimental',[1,6,13,15],{kicks:[[0,5,14],[0,7,10],[0,3,6,11],[0,6,11,14],[0,3,9,14]]}),
 breaks:rule('Breaks & Rave',[3,10,15],{fillStyle:'funk',lateSnareMs:2,detail:.45,kicks:[[0,6,8,11],[0,3,8,10],[0,6,10,14],[0,2,8,11],[0,3,6,10],[0,7,10,14]]}),
 bigbeat:rule('Breaks & Rave',[2,11,14],{fillStyle:'funk',lateSnareMs:4,ghostLevel:.28,detail:.4,kicks:[[0,2,8,10],[0,3,8,14],[0,6,8,10],[0,2,6,10],[0,3,8,11]]}),
 nuskoolbreaks:rule('Breaks & Rave',[5,11,15],{detail:.6,kicks:[[0,7,10],[0,6,11,14],[0,3,8,10],[0,6,10,13],[0,5,8,14],[0,3,7,11]]}),
 electrobreaks:rule('Breaks & Rave',[3,10,14],{fillStyle:'garage',hatSwing:0,reverse:.12,kicks:[[0,3,8,14],[0,6,8,11],[0,3,6,10],[0,6,10,14],[0,2,8,14]]}),
 breakbeathardcore:rule('Breaks & Rave',[3,7,15],{fillStyle:'jungle',detail:.65,maxBursts:4,kicks:[[0,4,8,11,12],[0,4,7,8,12],[0,4,8,10,12],[0,3,4,8,11,12]]}),
 raggajungle:rule('Jungle & DnB',[3,9,15],{detail:.7,ghostLevel:.28,fillStyle:'funk',kicks:[[0,6,11,14],[0,7,10],[0,3,8,10],[0,6,10,14],[0,4,7,11],[0,3,7,11,14]]}),
 atmosphericjungle:rule('Jungle & DnB',[7,15],{detail:.35,maxBursts:2,fillStyle:'soft',ghostLevel:.2,kicks:[[0,10],[0,7],[0,8,11],[0,6,10],[0,10,14]]}),
 footworkjungle:rule('Jungle & DnB',[3,6,13],{fillStyle:'broken',detail:.7,maxRatchet:4,kicks:[[0,3,6,10,14],[0,3,7,10,13],[0,4,7,10,14],[0,3,6,9,12,14]]}),
 downtempo:rule('Hip-Hop & Downtempo',[6,14],{fillStyle:'soft',detail:.25,maxBursts:1,lateSnareMs:5,kicks:[[0,7],[0,10],[0,6,11],[0,3,10],[0,8,14]]}),
 lofihiphop:rule('Hip-Hop & Downtempo',[7,11,15],{fillStyle:'soft',lateSnareMs:9,detail:.3,ghostLevel:.2,kicks:[[0,6,10],[0,7,11],[0,8,10],[0,3,10],[0,7,14]]}),
 boombap:rule('Hip-Hop & Downtempo',[3,10,14],{lateSnareMs:4,ghostLevel:.26,detail:.42,kicks:[[0,3,8,10],[0,6,8,14],[0,7,10],[0,3,10,14],[0,6,10,13]]}),
 mellowbeats:rule('Hip-Hop & Downtempo',[14],{fillStyle:'soft',detail:.22,maxBursts:1,lateSnareMs:6,ghostLevel:.18,kicks:[[0,10],[0,6],[0,7,11],[0,3,10],[0,8,14]]}),
 liquiddnb:rule('Jungle & DnB',[7,14],{fillStyle:'funk',lateSnareMs:2,detail:.4,maxBursts:2,reverse:.12,kicks:[[0,10],[0,7,10],[0,6,10],[0,8,11],[0,10,14]]}),
 jumpup:rule('Jungle & DnB',[3,14],{fillStyle:'rave',detail:.38,lateSnareMs:0,maxBursts:2,ghostLevel:.22,kicks:[[0,6,10],[0,10,14],[0,3,10],[0,8,10],[0,6,11,14]]}),
 garage:rule('Garage',[7,15],{kicks:[[0,4,8,12],[0,4,8,12,15],[0,3,4,8,12],[0,4,7,8,12],[0,4,8,11,12]]}),
 speedgarage:rule('Garage',[3,11,15],{detail:.55,fillStyle:'rave',lateSnareMs:0,kicks:[[0,4,8,12],[0,4,8,11,12],[0,4,7,8,12],[0,3,4,8,12],[0,4,8,12,15]]}),
 twostepgarage:rule('Garage',[3,7,14],{detail:.6,kicks:[[0,6,10],[0,7,14],[0,3,10],[0,7,11,14],[0,3,6,11],[0,4,7,10]]}),
 dub:rule('Dub & Bass',[14],{detail:.25,lateSnareMs:4,maxBursts:1,reverse:.1,kickExtras:[6,14],kicks:[[8],[8,14],[8,11],[8,13],[5,8,14],[8,15]]}),
 psydub:rule('Dub & Bass',[5,11,14],{fillStyle:'broken',detail:.55,maxRatchet:4,pitch:3,kicks:[[0,7,10],[0,6,14],[0,3,8,11],[0,5,11,14],[0,7,11,15]]}),
 dubstep:rule('Dub & Bass',[3,11],{detail:.35,ghostLevel:.2,kicks:[[0,6],[0,3,11],[0,7,14],[0,5,10],[0,6,14],[0,3,8]]}),
 brostep:rule('Dub & Bass',[3,6,15],{fillStyle:'rave',lateSnareMs:0,detail:.6,maxBursts:3,maxRatchet:6,kicks:[[0,3,6],[0,6,14],[0,3,10],[0,5,11],[0,6,13]]}),
 postdubstep:rule('Dub & Bass',[5,9,15],{fillStyle:'garage',detail:.45,lateSnareMs:6,hatSwing:1,kicks:[[0,5,11],[0,7,14],[0,3,10],[0,6,11],[0,7,13]]}),
 drumfunk:rule('Jungle & DnB',[3,9,11,15],{fillStyle:'funk',detail:.75,ghostLevel:.32,lateSnareMs:2,maxBursts:3,kicks:[[0,3,9,10],[0,6,8,14],[0,7,11,14],[0,2,8,10],[0,3,7,11,15]]}),
 amenscience:rule('Jungle & DnB',[3,7,9,15],{detail:.75,maxBursts:4,maxRatchet:8,reverse:.3,pitch:4,kicks:[[0,6,10,15],[0,7,10,13],[0,3,8,11],[0,6,9,14],[0,3,6,10,14]]}),
 atmosphericbreakcore:rule('Experimental',[7,11,15],{detail:.45,maxBursts:3,ghostLevel:.22,pitch:4,lateSnareMs:2,kicks:[[0,10],[0,7,11],[0,6,10],[0,8,14],[0,3,10]]}),
 triphop:rule('Hip-Hop & Downtempo',[3,11],{fillStyle:'dub',detail:.3,lateSnareMs:8,kicks:[[0,7,8],[0,6,11],[0,3,10],[0,8,10],[0,5,11,14]]}),
 halftimednb:rule('Jungle & DnB',[5,11,14],{fillStyle:'dub',detail:.45,maxBursts:2,ghostLevel:.22,kicks:[[0,5,11],[0,7,14],[0,3,10],[0,6,11],[0,5,10,14]]}),
 neurofunk:rule('Jungle & DnB',[3,7,14],{fillStyle:'rave',detail:.6,lateSnareMs:0,hatSwing:.4,maxBursts:3,pitch:2,kicks:[[0,10,14],[0,6,10],[0,7,10],[0,8,11],[0,3,10,14],[0,6,11,14]]})
};
export interface FillNote {role:Role; step:number; gain:number}
const n=(role:Role,step:number,gain:number):FillNote=>({role,step,gain});
// Positions in a four-beat phrase. Explicit fills scale these into the selection.
export const FILL_PHRASES:Record<FillStyle,FillNote[][]>={
 soft:[[n('snare',14,.22),n('hat',15,.27)],[n('percussion',13,.3),n('snare',15,.25)]],
 funk:[[n('snare',12,.55),n('snare',13,.23),n('kick',14,.65),n('snare',15,.36)],[n('kick',12,.65),n('snare',13,.28),n('percussion',14,.4),n('snare',15,.45)]],
 jungle:[[n('snare',12,.6),n('snare',13.5,.25),n('kick',14,.6),n('snare',14.5,.32),n('snare',15.5,.5)],[n('snare',12,.6),n('kick',13.5,.65),n('snare',14,.32),n('snare',15,.48)]],
 hats:[[n('hat',12,.4),n('hat',13,.25),n('hat',14,.32),n('hat',14.5,.23),n('hat',15,.35),n('hat',15.5,.25)]],
 dub:[[n('percussion',12,.36),n('snare',14,.34)],[n('snare',12,.45),n('percussion',15,.3)]],
 garage:[[n('hat',12,.3),n('percussion',13,.35),n('snare',14.5,.23),n('hat',15,.4)]],
 broken:[[n('snare',12,.55),n('percussion',12.75,.3),n('hat',14,.3),n('snare',14.5,.38),n('kick',15.5,.6)]],
 rave:[[n('snare',12,.5),n('snare',13,.57),n('snare',14,.64),n('snare',15,.72)],[n('kick',12,.8),n('snare',14,.55),n('snare',15,.7)]]
};
