import type {Genre,MelodyPart} from './model.js';

export interface MelodyPartProfile {
  /** Sixteenth-note positions within a bar. */
  motif:readonly number[]; response:readonly number[]; details:readonly number[];
  low:number; high:number; gate:number; maxBeats:number;
}
export interface MelodyProfile {bassline:MelodyPartProfile;lead:MelodyPartProfile}
const part=(motif:number[],response:number[],details:number[],low:number,high:number,gate:number,maxBeats:number):MelodyPartProfile=>({motif,response,details,low,high,gate,maxBeats});
const profiles={
  jungle:{bassline:part([0,6,10],[0,7,11],[3,14],36,55,.72,1.5),lead:part([0,5,9,14],[0,6,11,14],[3,13],60,84,.7,1.5)},
  dnb:{bassline:part([0,8,10],[0,6,10],[3,14],36,55,.84,2),lead:part([0,4,10,14],[0,6,11,14],[3,12],60,84,.78,2)},
  liquid:{bassline:part([0,8],[0,6,10],[14],36,55,.94,2),lead:part([0,6,11],[0,8,12],[4,14],60,84,.95,3)},
  hiphop:{bassline:part([0,7,10],[0,6,11],[14],36,53,.83,2),lead:part([0,6,12],[0,7,11],[3,14],60,82,.82,2)},
  mellow:{bassline:part([0,9],[0,7],[14],36,53,.95,2.5),lead:part([0,8],[0,10],[5,14],60,82,.96,3)},
  trap:{bassline:part([0,6,11],[0,3,10],[14],30,53,.94,3),lead:part([0,7,13],[0,6,11],[10,15],60,84,.65,1.5)},
  drill:{bassline:part([0,7,14],[0,3,10],[6,12],30,53,.85,2),lead:part([0,6,11],[0,3,10],[7,14],60,84,.73,2)},
  garage:{bassline:part([0,3,9],[0,6,11],[7,14],36,55,.66,1.5),lead:part([0,5,11],[0,7,13],[3,14],60,84,.68,1.5)},
  dub:{bassline:part([0,7],[0,10],[14],31,53,.94,3),lead:part([0,11],[0,8],[6,14],60,84,.92,3)},
  dubstep:{bassline:part([0,6,11],[0,8,14],[3,13],30,53,.81,2),lead:part([0,8,12],[0,6,14],[4,11],60,84,.7,2)},
  breaks:{bassline:part([0,6,10],[0,7,14],[3,12],36,55,.76,2),lead:part([0,6,11],[0,5,13],[9,15],60,84,.74,2)},
  rave:{bassline:part([0,4,8,12],[0,4,8,12],[6,14],36,55,.76,1),lead:part([0,4,8,12],[0,6,8,14],[3,11],60,84,.65,1)},
  idm:{bassline:part([0,5,11],[0,7,13],[3,14],36,55,.7,1.5),lead:part([0,3,10,14],[0,5,9,13],[7,15],60,86,.64,1.5)},
  breakcore:{bassline:part([0,3,9,14],[0,6,11,15],[5,13],36,55,.59,1),lead:part([0,3,7,12],[0,5,10,14],[9,15],60,86,.55,1)},
  atmospheric:{bassline:part([0,10],[0,8],[14],36,55,.96,3),lead:part([0,8],[0,10],[5,14],60,86,.98,3)},
  neuro:{bassline:part([0,3,8,11],[0,6,10,14],[7,13],30,55,.7,1.5),lead:part([0,4,9,13],[0,6,11,14],[7,15],60,86,.63,1.5)},
} satisfies Record<string,MelodyProfile>;

/** Every supported genre has an explicit melodic family; individual values can be refined without changing the composer. */
const families:Record<Genre,keyof typeof profiles>={
  jungle:'jungle',dnb:'dnb',hiphop:'hiphop',trap:'trap',rap:'hiphop',drill:'drill',breakcore:'breakcore',idm:'idm',hardcore:'rave',experimental:'idm',
  breaks:'breaks',bigbeat:'breaks',nuskoolbreaks:'breaks',electrobreaks:'breaks',breakbeathardcore:'rave',raggajungle:'jungle',atmosphericjungle:'atmospheric',footworkjungle:'jungle',
  downtempo:'mellow',lofihiphop:'hiphop',boombap:'hiphop',mellowbeats:'mellow',liquiddnb:'liquid',jumpup:'dnb',garage:'garage',speedgarage:'garage',twostepgarage:'garage',
  dub:'dub',psydub:'dub',dubstep:'dubstep',brostep:'dubstep',postdubstep:'dubstep',drumfunk:'jungle',amenscience:'breakcore',atmosphericbreakcore:'atmospheric',triphop:'mellow',halftimednb:'dubstep',neurofunk:'neuro'
};
export function melodyProfile(genre:Genre,partName:MelodyPart):MelodyPartProfile{return profiles[families[genre]][partName];}
