import {PPQ,type Genre,type Role,type Settings} from './model.js';
import {V3_RULES} from './groove-v3-profiles.js';

export type GestureStyle='shuffle'|'pocket'|'hat-roll'|'skip'|'space'|'rave'|'fracture';
export interface Development {style:GestureStyle; call:number; answer:number; ending:number; minGapMs:number; chop:boolean}
const development=(style:GestureStyle,call:number,answer:number,ending:number,minGapMs:number,chop=false):Development=>({style,call,answer,ending,minGapMs,chop});
const FAMILY={
 jungle:development('shuffle',1,2,3,22), hiphop:development('pocket',0,1,2,38),
 garage:development('skip',1,2,3,24), dub:development('space',0,1,2,32),
 breaks:development('shuffle',1,2,3,25), experimental:development('fracture',1,3,5,12,true)
};
const overrides:Partial<Record<Genre,Development>>={
 dnb:development('shuffle',1,1,2,25), liquiddnb:development('shuffle',1,1,2,28), atmosphericjungle:development('space',0,1,2,30),
 jumpup:development('rave',0,1,2,28), neurofunk:development('shuffle',1,2,3,22),
 drumfunk:development('shuffle',1,2,3,24), amenscience:development('fracture',1,3,5,14,true),
 trap:development('hat-roll',1,2,3,14), drill:development('hat-roll',1,2,3,16), footworkjungle:development('hat-roll',1,2,3,18),
 downtempo:development('pocket',0,1,1,45), mellowbeats:development('pocket',0,1,1,50), rap:development('pocket',0,1,1,40),
 dub:development('space',0,1,1,45), psydub:development('space',1,2,3,24), brostep:development('rave',0,2,4,20),
 postdubstep:development('skip',1,2,2,28), hardcore:development('rave',0,2,4,20),
 breakbeathardcore:development('rave',1,2,4,18), atmosphericbreakcore:development('fracture',0,2,4,18,true),
 bigbeat:development('shuffle',0,1,2,32), electrobreaks:development('skip',1,1,2,25)
};
export const developmentFor=(genre:Genre):Development=>overrides[genre]??FAMILY[V3_RULES[genre].family];

/** A stored pattern is a section of a phrase, not a live randomizer during playback. */
export function phrasePosition(s:Settings,localBar:number){
 const length=s.phraseLength??s.bars,position=((s.phraseOffset??0)+localBar)%length;
 const ending=position===length-1,turnaround=!ending&&(position+1)%4===0;
 return {position,length,ending,turnaround,response:ending||position%2===1};
}
export interface SupportNote {role:Role;step:number;gain:number;ghost?:boolean}
const n=(role:Role,step:number,gain:number,ghost=false):SupportNote=>({role,step,gain,ghost});
// Original call/answer recipes. Positions are sixteenths; half steps add 32nd detail.
// Hat/ghost interaction differs from repeating a snare sample in isolation.
export const SUPPORT:Record<GestureStyle,SupportNote[][]>={
 shuffle:[[n('hat',5.5,.22),n('snare',6.5,.25,true)],[n('snare',13,.23,true),n('hat',13.5,.26),n('snare',14.5,.31,true)]],
 pocket:[[n('hat',6,.22),n('snare',7,.24,true)],[n('percussion',13,.27),n('hat',14,.25),n('snare',15,.28,true)]],
 'hat-roll':[[n('hat',5,.22),n('percussion',6.5,.25)],[n('hat',13,.22),n('hat',14.5,.29),n('percussion',15,.26)]],
 skip:[[n('hat',5,.23),n('percussion',6.5,.28)],[n('percussion',13,.28),n('hat',13.5,.2),n('snare',15,.24,true)]],
 space:[[n('hat',6,.2)],[n('percussion',13,.24),n('snare',15,.24,true)]],
 rave:[[n('hat',6,.26)],[n('snare',13,.36,true),n('hat',14,.3),n('snare',15,.46)]],
 fracture:[[n('percussion',5.5,.25),n('snare',7,.26,true)],[n('hat',12.5,.25),n('snare',13.5,.32,true),n('percussion',14.5,.31)]]
};
export const musicalSpans=[PPQ/8,PPQ/4,PPQ/2,PPQ] as const;
