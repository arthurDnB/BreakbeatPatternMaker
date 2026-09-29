import {PPQ,type Hit,type Settings} from './model.js';
import {harmonyPlan} from './harmony.js';
import {MELODY_SCALES} from './melody.js';
import {random} from './random.js';

type ChordFeel='sustain'|'pulse'|'offbeat'|'driving'|'fractured';
const FEEL:Record<Settings['genre'],ChordFeel>={
  jungle:'pulse',dnb:'pulse',hiphop:'pulse',trap:'sustain',rap:'pulse',drill:'sustain',breakcore:'fractured',idm:'driving',hardcore:'driving',experimental:'fractured',
  breaks:'driving',bigbeat:'pulse',nuskoolbreaks:'driving',electrobreaks:'driving',breakbeathardcore:'driving',raggajungle:'driving',atmosphericjungle:'sustain',footworkjungle:'fractured',
  downtempo:'sustain',lofihiphop:'pulse',boombap:'pulse',mellowbeats:'sustain',liquiddnb:'sustain',jumpup:'driving',garage:'offbeat',speedgarage:'offbeat',twostepgarage:'offbeat',
  dub:'sustain',psydub:'sustain',dubstep:'pulse',brostep:'driving',postdubstep:'pulse',drumfunk:'driving',amenscience:'fractured',atmosphericbreakcore:'sustain',triphop:'sustain',halftimednb:'sustain',neurofunk:'driving'
};
const NAMES=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const pc=(note:number)=>((note%12)+12)%12;
const scalePitch=(key:number,scale:readonly number[],degree:number)=>key+12*Math.floor(degree/scale.length)+scale[((degree%scale.length)+scale.length)%scale.length]!;
const pitchesFor=(pitchClass:number,low:number,high:number)=>Array.from({length:high-low+1},(_,index)=>index+low).filter(note=>pc(note)===pitchClass);

function chordName(root:number,third:number,seventh:number,withNine:boolean):string{
  const t=pc(third-root),s=pc(seventh-root);
  const quality=t===3?(s===10?'m7':'mMaj7'):t===4?(s===11?'maj7':'7'):'sus';
  return `${NAMES[pc(root)]}${quality}${withNine?'(9)':''}`;
}

/** Enumerate playable inversions and prefer shared tones and short inner-voice movements. */
function voiceChord(tones:readonly number[],rootPc:number,previous:readonly number[],includeRoot:boolean):number[]{
  const upper=tones.map(tone=>pitchesFor(tone,57,83));
  const bass=includeRoot?pitchesFor(rootPc,43,57):[];
  let winner:number[]=[],best=Infinity;
  const visit=(index:number,notes:number[])=>{
    if(index<upper.length){for(const note of upper[index]!)visit(index+1,[...notes,note]);return;}
    const sorted=[...notes].sort((a,b)=>a-b);
    if(sorted.some((note,i)=>i>0&&note-sorted[i-1]!<3))return;
    const register=Math.abs(sorted[0]!-62)*.28+Math.abs(sorted[sorted.length-1]!-76)*.24;
    const spacing=sorted.slice(1).reduce((sum,note,i)=>sum+Math.max(0,note-sorted[i]!-12)*2,0);
    const motion=previous.length?sorted.reduce((sum,note,i)=>sum+Math.abs(note-(previous[Math.min(i,previous.length-1)]??note)),0)*1.5:0;
    const held=previous.length?sorted.filter(note=>previous.includes(note)).length:0;
    const score=register+spacing+motion-held*3;
    if(score<best){best=score;winner=sorted;}
  };
  visit(0,[]);
  if(!winner.length)winner=tones.map(tone=>pitchesFor(tone,57,83)[0]!).sort((a,b)=>a-b);
  if(!includeRoot)return winner;
  const low=bass.sort((a,b)=>Math.abs(a-49)-Math.abs(b-49))[0]??rootPc+48;
  return [low,...winner];
}

/** Four-part phrase harmony with separate voicing and rhythmic gesture decisions. */
export function generatePiano(settings:Settings,trackId='generated-piano',bassPresent=false):Hit[]{
  const key=settings.melodyKey??0,scale=MELODY_SCALES[settings.melodyScale??'natural-minor'].intervals;
  const feel=FEEL[settings.genre],changes=harmonyPlan(settings),out:Hit[]=[];
  let previous:number[]=[];
  for(const change of changes){
    const degree=Math.round(change.degree*(scale.length-1)/6),root=scalePitch(key,scale,degree);
    const third=scalePitch(key,scale,degree+2),fifth=scalePitch(key,scale,degree+4),seventh=scalePitch(key,scale,degree+6),ninth=scalePitch(key,scale,degree+8);
    const withNine=settings.complexity>=.3,includeRoot=!bassPresent;
    const tonePcs=[...new Set([pc(third),pc(seventh),...(withNine?[pc(ninth)]:[]),...(settings.complexity>=.72?[pc(fifth)]:[])])];
    // Short scales can fold an extension onto an existing chord tone.
    const wanted=settings.complexity>=.72?4:withNine?3:2;
    for(let distance=1;tonePcs.length<wanted&&distance<=scale.length+2;distance++){
      const candidate=pc(scalePitch(key,scale,degree+distance));
      if(!tonePcs.includes(candidate)&&(!includeRoot||candidate!==pc(root)))tonePcs.push(candidate);
    }
    const notes=voiceChord(tonePcs,pc(root),previous,includeRoot);
    previous=notes.slice(includeRoot?1:0);
    const span=change.endTick-change.startTick;
    const offbeat=feel==='offbeat'?Math.min(Math.round(PPQ*.5),Math.round(span*.28)):
      feel==='fractured'&&change.index%2?Math.min(Math.round(PPQ*.25),Math.round(span*.2)):0;
    const startTick=change.startTick+offbeat;
    const gap=feel==='sustain'?Math.round(PPQ*.06):feel==='offbeat'?Math.round(PPQ*.55):Math.round(PPQ*.3);
    const durationTicks=Math.max(1,change.endTick-startTick-gap);
    const name=chordName(root,third,seventh,withNine);
    const human=Math.round((random(settings.seed,`piano:timing:${change.index}`)()*2-1)*settings.humanizeMs*settings.bpm*PPQ/60000);
    const offsetTick=Math.max(-startTick,Math.min(PPQ,Math.round((settings.swing-.5)*offbeat*.5)+human));
    notes.forEach((note,voice)=>out.push({
      id:`piano-${change.index}-${voice}`,role:'percussion',trackId,sourceId:'kit.percussion',baseTick:startTick,offsetTick,
      gain:Math.max(.25,Math.min(.78,.64-(voice===0?.07:0)+(random(settings.seed,`piano:velocity:${change.index}:${voice}`)()-.5)*.08)),
      pan:voice===0?-.05:voice===notes.length-1?.05:0,anchor:false,ghost:false,
      synthNote:{note,durationTicks},reason:`${name}: voice-led ${voice===0&&includeRoot?'root':'chord tone'} ${change.index+1}/${changes.length}.`
    }));
  }
  return out;
}
