import type {Genre,MelodyPart} from './model.js';
type MelodyVoicePart=Exclude<MelodyPart,'piano'>;

export interface MelodyPartProfile {
  /** Sixteenth-note positions within a bar. */
  motif:readonly number[]; response:readonly number[]; details:readonly number[];
  low:number; high:number; gate:number; maxBeats:number;
  contours:readonly (readonly number[])[];
  progressions:readonly (readonly number[])[];
}
type RhythmProfile=Omit<MelodyPartProfile,'contours'|'progressions'>;
export interface MelodyProfile {bassline:RhythmProfile;lead:RhythmProfile}
const part=(motif:number[],response:number[],details:number[],low:number,high:number,gate:number,maxBeats:number):RhythmProfile=>({motif,response,details,low,high,gate,maxBeats});
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

/** Shared rhythm families; every genre adds an explicit harmonic and melodic vocabulary below. */
const families:Record<Genre,keyof typeof profiles>={
  jungle:'jungle',dnb:'dnb',hiphop:'hiphop',trap:'trap',rap:'hiphop',drill:'drill',breakcore:'breakcore',idm:'idm',hardcore:'rave',experimental:'idm',
  breaks:'breaks',bigbeat:'breaks',nuskoolbreaks:'breaks',electrobreaks:'breaks',breakbeathardcore:'rave',raggajungle:'jungle',atmosphericjungle:'atmospheric',footworkjungle:'jungle',
  downtempo:'mellow',lofihiphop:'hiphop',boombap:'hiphop',mellowbeats:'mellow',liquiddnb:'liquid',jumpup:'dnb',garage:'garage',speedgarage:'garage',twostepgarage:'garage',
  dub:'dub',psydub:'dub',dubstep:'dubstep',brostep:'dubstep',postdubstep:'dubstep',drumfunk:'jungle',amenscience:'breakcore',atmosphericbreakcore:'atmospheric',triphop:'mellow',halftimednb:'dubstep',neurofunk:'neuro'
};
type Style={progressions:readonly (readonly number[])[];bass:readonly (readonly number[])[];lead:readonly (readonly number[])[];bassMotif?:readonly number[];leadMotif?:readonly number[]};
const s=(progressions:number[][],bass:number[][],lead:number[][],bassMotif?:number[],leadMotif?:number[]):Style=>({progressions,bass,lead,bassMotif,leadMotif});
/** Scale degrees are compositional tendencies, not transcriptions of existing songs. */
export const MELODY_GENRES:Record<Genre,Style>={
  jungle:s([[0,0,5,4],[0,3,4,0]],[[0,4,0,2],[0,0,4,1]],[[0,2,4,1],[4,2,0,3]]),
  dnb:s([[0,5,3,4],[0,3,5,4]],[[0,0,4,0],[0,4,2,0]],[[0,2,4,2],[4,2,0,1]]),
  hiphop:s([[0,3,5,4],[0,5,2,4]],[[0,0,2,4],[0,4,2,0]],[[2,1,0,4],[0,2,1,0]]),
  trap:s([[0,0,5,5],[0,6,5,6]],[[0,0,4,0],[0,4,0,0]],[[0,2,1,0],[4,2,1,0]]),
  rap:s([[0,5,3,4]],[[0,4,0,1],[0,0,2,0]],[[0,2,0,4],[2,0,1,0]],[0,8,11],[0,7,12]),
  drill:s([[0,6,5,6],[0,3,6,5]],[[0,0,4,1],[0,4,0,-1]],[[0,1,4,0],[4,1,0,-1]]),
  breakcore:s([[0,5,3,6],[0,2,6,4]],[[0,4,1,0],[0,-1,4,2]],[[0,4,1,3],[4,1,0,-1]]),
  idm:s([[0,4,2,5],[0,6,3,1]],[[0,2,4,1],[0,4,-1,2]],[[0,4,1,5],[2,-1,4,0]]),
  hardcore:s([[0,5,4,5]],[[0,0,4,0],[0,4,0,4]],[[0,4,2,4],[4,2,0,2]]),
  experimental:s([[0,6,2,4]],[[0,4,-1,2],[0,1,4,-1]],[[0,5,2,-1],[4,-1,3,0]],[0,6,13],[0,3,11,14]),
  breaks:s([[0,3,4,0],[0,5,4,0]],[[0,4,0,2],[0,2,4,0]],[[0,2,1,4],[2,4,1,0]]),
  bigbeat:s([[0,5,3,0]],[[0,0,4,2],[0,4,0,2]],[[0,4,2,0],[4,2,0,1]],[0,4,10],[0,8,11]),
  nuskoolbreaks:s([[0,4,5,3]],[[0,4,2,0],[0,2,4,1]],[[0,2,4,1],[4,1,2,0]],[0,7,10],[0,5,12]),
  electrobreaks:s([[0,4,0,5]],[[0,0,4,0],[0,4,0,1]],[[0,4,0,2],[4,0,2,0]],[0,3,8,14],[0,4,8,12]),
  breakbeathardcore:s([[0,5,6,4]],[[0,4,0,2],[0,0,4,2]],[[0,2,4,1],[4,2,0,2]],[0,4,8,11],[0,4,8,14]),
  raggajungle:s([[0,4,5,0]],[[0,4,2,0],[0,2,0,4]],[[0,2,1,4],[2,4,0,1]],[0,7,10],[0,5,11,14]),
  atmosphericjungle:s([[0,5,3,4]],[[0,0,2,0],[0,4,0,2]],[[0,2,4,1],[2,1,0,4]],[0,10],[0,8,13]),
  footworkjungle:s([[0,6,3,4]],[[0,4,1,0],[0,1,4,0]],[[0,4,2,1],[4,1,2,0]],[0,3,7,10],[0,3,9,13]),
  downtempo:s([[0,3,5,4]],[[0,0,2,0],[0,4,0,1]],[[0,2,1,4],[2,1,0,4]]),
  lofihiphop:s([[0,3,5,3]],[[0,0,2,0],[0,2,4,0]],[[2,1,0,2],[0,2,1,4]],[0,9],[0,7,12]),
  boombap:s([[0,5,3,4]],[[0,4,0,2],[0,2,4,0]],[[0,2,1,0],[2,4,1,0]],[0,7,11],[0,6,12]),
  mellowbeats:s([[0,5,3,0]],[[0,0,4,0],[0,2,0,4]],[[0,2,4,2],[2,1,0,2]],[0,9],[0,8]),
  liquiddnb:s([[0,5,3,4],[0,3,5,4]],[[0,0,4,0],[0,2,0,4]],[[0,2,4,1],[2,4,1,0]]),
  jumpup:s([[0,0,4,0]],[[0,4,0,4],[0,0,4,2]],[[0,4,2,0],[4,0,2,4]],[0,3,8,11],[0,4,8,14]),
  garage:s([[0,3,5,4]],[[0,4,2,0],[0,2,4,1]],[[0,2,4,1],[2,4,0,1]]),
  speedgarage:s([[0,0,5,4]],[[0,4,0,2],[0,2,4,0]],[[0,4,2,1],[4,2,0,1]],[0,3,8,11],[0,4,11]),
  twostepgarage:s([[0,5,3,4]],[[0,2,4,0],[0,4,1,0]],[[0,2,1,4],[2,1,4,0]],[0,7,11],[0,6,13]),
  dub:s([[0,4,5,0]],[[0,0,4,0],[0,4,0,2]],[[0,2,0,4],[2,0,4,0]]),
  psydub:s([[0,6,4,5]],[[0,4,1,0],[0,1,4,2]],[[0,4,1,2],[4,1,0,2]],[0,6,10],[0,5,11]),
  dubstep:s([[0,0,5,4]],[[0,0,4,0],[0,4,0,2]],[[0,4,2,0],[4,2,0,1]]),
  brostep:s([[0,6,0,5]],[[0,4,0,4],[0,0,4,1]],[[0,4,1,4],[4,1,0,2]],[0,3,8,11],[0,3,8,14]),
  postdubstep:s([[0,3,5,4]],[[0,2,0,4],[0,4,1,0]],[[0,2,1,4],[2,1,4,0]],[0,7,11],[0,6,13]),
  drumfunk:s([[0,3,5,4]],[[0,4,1,0],[0,1,4,2]],[[0,2,4,1],[4,1,2,0]],[0,5,11],[0,3,10,14]),
  amenscience:s([[0,6,3,5]],[[0,4,-1,2],[0,1,4,-1]],[[0,5,1,3],[4,1,-1,2]],[0,3,10,14],[0,3,7,14]),
  atmosphericbreakcore:s([[0,5,3,6]],[[0,2,4,0],[0,4,1,0]],[[0,2,4,1],[4,2,1,0]],[0,10],[0,8,13]),
  triphop:s([[0,3,5,4]],[[0,0,2,4],[0,4,2,0]],[[0,2,1,0],[2,1,4,0]],[0,7],[0,8,14]),
  halftimednb:s([[0,5,3,4]],[[0,0,4,0],[0,4,2,0]],[[0,2,4,1],[4,2,1,0]],[0,10],[0,8,13]),
  neurofunk:s([[0,6,2,4]],[[0,4,1,0],[0,1,4,2]],[[0,4,1,3],[4,1,0,2]])
};
export function melodyProfile(genre:Genre,partName:MelodyVoicePart):MelodyPartProfile{
  const base=profiles[families[genre]][partName],genreStyle=MELODY_GENRES[genre];
  return {...base,motif:partName==='bassline'?genreStyle.bassMotif??base.motif:genreStyle.leadMotif??base.motif,
    contours:partName==='bassline'?genreStyle.bass:genreStyle.lead,progressions:genreStyle.progressions};
}
