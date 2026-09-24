import type {Genre,Role} from './model.js';
export type Family = 'Jungle & DnB'|'Hip-Hop & Downtempo'|'Garage'|'Dub & Bass'|'Breaks & Rave'|'Experimental';
export type FillStyle = 'soft'|'funk'|'jungle'|'hats'|'dub'|'garage'|'broken'|'rave';
export interface GrooveRule {
 family:Family; response:number[]; fillStyle:FillStyle; lateSnareMs:number;
 hatSwing:number; ghostLevel:number; detail:number; maxBursts:number; maxRatchet:number;
 reverse:number; pitch:number; accent:number[]; kickExtras:number[];
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
 jungle:rule('Jungle & DnB',[3,11,15]), dnb:rule('Jungle & DnB',[7,14],{detail:.45,maxBursts:2,reverse:.12}),
 hiphop:rule('Hip-Hop & Downtempo',[7,14]), trap:rule('Hip-Hop & Downtempo',[3,11,14],{fillStyle:'hats',lateSnareMs:0,detail:.6,maxRatchet:6,hatSwing:1,pitch:4}),
 rap:rule('Hip-Hop & Downtempo',[10,14],{detail:.28,lateSnareMs:3,maxBursts:1,fillStyle:'soft'}),
 drill:rule('Dub & Bass',[3,10,14],{fillStyle:'hats',detail:.6,maxRatchet:6,pitch:4}),
 breakcore:rule('Experimental',[2,7,11,15],{detail:.85}), idm:rule('Experimental',[5,10,15],{lateSnareMs:2,maxBursts:3}),
 hardcore:rule('Breaks & Rave',[7,15],{maxRatchet:6,detail:.45}), experimental:rule('Experimental',[1,6,13,15]),
 breaks:rule('Breaks & Rave',[3,10,15],{fillStyle:'funk',lateSnareMs:2,detail:.45}),
 bigbeat:rule('Breaks & Rave',[2,11,14],{fillStyle:'funk',lateSnareMs:4,ghostLevel:.28,detail:.4}),
 nuskoolbreaks:rule('Breaks & Rave',[5,11,15],{detail:.6}), electrobreaks:rule('Breaks & Rave',[3,10,14],{fillStyle:'garage',hatSwing:0,reverse:.12}),
 breakbeathardcore:rule('Breaks & Rave',[3,7,15],{fillStyle:'jungle',detail:.65,maxBursts:4}),
 raggajungle:rule('Jungle & DnB',[3,9,15],{detail:.7,ghostLevel:.28,fillStyle:'funk'}),
 atmosphericjungle:rule('Jungle & DnB',[7,15],{detail:.35,maxBursts:2,fillStyle:'soft',ghostLevel:.2}),
 footworkjungle:rule('Jungle & DnB',[3,6,13],{fillStyle:'broken',detail:.7,maxRatchet:4}),
 downtempo:rule('Hip-Hop & Downtempo',[6,14],{fillStyle:'soft',detail:.25,maxBursts:1,lateSnareMs:5}),
 lofihiphop:rule('Hip-Hop & Downtempo',[7,11,15],{fillStyle:'soft',lateSnareMs:9,detail:.3,ghostLevel:.2}),
 boombap:rule('Hip-Hop & Downtempo',[3,10,14],{lateSnareMs:4,ghostLevel:.26,detail:.42}),
 mellowbeats:rule('Hip-Hop & Downtempo',[14],{fillStyle:'soft',detail:.22,maxBursts:1,lateSnareMs:6,ghostLevel:.18}),
 liquiddnb:rule('Jungle & DnB',[7,14],{fillStyle:'funk',lateSnareMs:2,detail:.4,maxBursts:2,reverse:.12}),
 jumpup:rule('Jungle & DnB',[3,14],{fillStyle:'rave',detail:.38,lateSnareMs:0,maxBursts:2,ghostLevel:.22}),
 garage:rule('Garage',[7,15]), speedgarage:rule('Garage',[3,11,15],{detail:.55,fillStyle:'rave',lateSnareMs:0}),
 twostepgarage:rule('Garage',[3,7,14],{detail:.6}),
 dub:rule('Dub & Bass',[14],{detail:.25,lateSnareMs:4,maxBursts:1,reverse:.1,kickExtras:[6,14]}),
 psydub:rule('Dub & Bass',[5,11,14],{fillStyle:'broken',detail:.55,maxRatchet:4,pitch:3}),
 dubstep:rule('Dub & Bass',[3,11],{detail:.35,ghostLevel:.2}),
 brostep:rule('Dub & Bass',[3,6,15],{fillStyle:'rave',lateSnareMs:0,detail:.6,maxBursts:3,maxRatchet:6}),
 postdubstep:rule('Dub & Bass',[5,9,15],{fillStyle:'garage',detail:.45,lateSnareMs:6,hatSwing:1}),
 drumfunk:rule('Jungle & DnB',[3,9,11,15],{fillStyle:'funk',detail:.75,ghostLevel:.32,lateSnareMs:2,maxBursts:3}),
 amenscience:rule('Jungle & DnB',[3,7,9,15],{detail:.75,maxBursts:4,maxRatchet:8,reverse:.3,pitch:4}),
 atmosphericbreakcore:rule('Experimental',[7,11,15],{detail:.45,maxBursts:3,ghostLevel:.22,pitch:4,lateSnareMs:2}),
 triphop:rule('Hip-Hop & Downtempo',[3,11],{fillStyle:'dub',detail:.3,lateSnareMs:8}),
 halftimednb:rule('Jungle & DnB',[5,11,14],{fillStyle:'dub',detail:.45,maxBursts:2,ghostLevel:.22}),
 neurofunk:rule('Jungle & DnB',[3,7,14],{fillStyle:'rave',detail:.6,lateSnareMs:0,hatSwing:.4,maxBursts:3,pitch:2})
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
