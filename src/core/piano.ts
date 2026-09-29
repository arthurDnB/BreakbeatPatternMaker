import {PPQ,type Hit,type Settings} from './model.js';
import {melodyProfile} from './melody-profiles.js';
import {random} from './random.js';
import {MELODY_SCALES} from './melody.js';

const BAR=4*PPQ;
type ChordSlot={beat:number;gate:number;velocity:number};
const sparse:ChordSlot[]=[{beat:0,gate:3.7,velocity:.66}];
const slow:ChordSlot[]=[{beat:0,gate:1.8,velocity:.64},{beat:2,gate:1.7,velocity:.56}];
const offbeat:ChordSlot[]=[{beat:0,gate:.72,velocity:.64},{beat:1.5,gate:.52,velocity:.5},{beat:3.5,gate:.42,velocity:.58}];
const active:ChordSlot[]=[{beat:0,gate:.8,velocity:.64},{beat:1.5,gate:.55,velocity:.52},{beat:2.5,gate:.62,velocity:.58}];
const chaotic:ChordSlot[]=[{beat:0,gate:.72,velocity:.62},{beat:1,gate:.6,velocity:.49},{beat:2.5,gate:.55,velocity:.56},{beat:3.5,gate:.4,velocity:.46}];
const RHYTHMS={sparse,slow,offbeat,active,chaotic} as const;
const family={
  slow:'sparse',downtempo:'sparse',lofihiphop:'slow',hiphop:'slow',rap:'slow',boombap:'slow',mellowbeats:'sparse',triphop:'sparse',
  garage:'offbeat',speedgarage:'offbeat',twostepgarage:'offbeat',
  jungle:'slow',dnb:'slow',liquiddnb:'sparse',atmosphericjungle:'sparse',raggajungle:'active',drumfunk:'active',jumpup:'active',
  trap:'sparse',drill:'sparse',dub:'sparse',psydub:'sparse',dubstep:'slow',brostep:'active',postdubstep:'slow',halftimednb:'sparse',
  breakcore:'chaotic',amenscience:'chaotic',atmosphericbreakcore:'sparse',idm:'active',experimental:'chaotic',hardcore:'active',
  breaks:'active',bigbeat:'slow',nuskoolbreaks:'active',electrobreaks:'active',breakbeathardcore:'active',footworkjungle:'chaotic',neurofunk:'active'
} as const;
const scalePitch=(key:number,scale:readonly number[],degree:number)=>key+12*Math.floor(degree/scale.length)+scale[((degree%scale.length)+scale.length)%scale.length]!;
const choose=(seed:string,tag:string)=>random(seed,tag)();

/** Genre-aware chord voicings using the same seeded harmonic vocabulary as the bass/lead composer. */
export function generatePiano(settings:Settings,trackId='generated-piano'):Hit[]{
  const key=settings.melodyKey??0,scale=MELODY_SCALES[settings.melodyScale??'natural-minor'].intervals;
  const profile=melodyProfile(settings.genre,'lead'),progressions=profile.progressions;
  const progression=progressions[Math.floor(choose(settings.seed,`piano:progression:${settings.genre}:${settings.variation??0}`)*progressions.length)]!;
  const slots=RHYTHMS[family[settings.genre]],output:Hit[]=[];
  for(let bar=0;bar<settings.bars;bar++){
    const rootScaleDegree=Math.round(progression[Math.floor(bar*progression.length/settings.bars)]!*(scale.length-1)/6);
    const added=RHYTHMS.slow[1]!;
    const barSlots=[...slots];
    if((family[settings.genre]==='sparse'||family[settings.genre]==='slow')&&settings.complexity>.45&&choose(settings.seed,`piano:extra:${bar}`)<(settings.complexity-.35)*.45)barSlots.push({...added,beat:2,gate:1.6,velocity:.42});
    for(const [slotIndex,slot] of barSlots.entries()){
      const swing=slot.beat%1!==0?Math.round((settings.swing-.5)*2*PPQ*.25):0;
      const human=Math.round((choose(settings.seed,`piano:human:${bar}:${slotIndex}`)*2-1)*settings.humanizeMs*settings.bpm*PPQ/60000);
      const baseTick=bar*BAR+Math.round(slot.beat*PPQ),offsetTick=Math.max(-baseTick,Math.min(settings.bars*BAR-1-baseTick,swing+human));
      const chordDegrees=settings.complexity>.28?[0,2,4,6]:[0,2,4];
      if(settings.complexity>.72)chordDegrees.push(8);
      const notes=chordDegrees.map((interval,index)=>{
        let note=scalePitch(key,scale,rootScaleDegree+interval);
        if(index===0)note-=12;
        // Spread inner voices into a warm, open register; keep every tone in the chosen scale.
        if(index===2)note+=12;
        if(index>=3)note+=12;
        while(note<40)note+=12;while(note>88)note-=12;
        return note;
      });
      const durationTicks=Math.max(1,Math.min(Math.round(slot.gate*PPQ),settings.bars*BAR-baseTick));
      notes.forEach((note,voice)=>output.push({
        id:`piano-${bar}-${slotIndex}-${voice}`,role:'percussion',trackId,sourceId:'kit.percussion',baseTick,offsetTick,
        gain:slot.velocity*(voice===0?.88:voice===notes.length-1?.72:1),pan:voice===0?-.06:voice===notes.length-1?.06:0,
        anchor:false,ghost:false,synthNote:{note,durationTicks},
        reason:`Piano chord tone ${voice+1} in ${settings.melodyScale??'natural-minor'}; ${slot.beat%1?'offbeat chord stab':'genre-shaped chord change'}.`
      }));
    }
  }
  return output;
}
