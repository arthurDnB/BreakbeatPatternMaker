import {PPQ,type Hit,type Settings} from './model.js';
import {harmonyPlan} from './harmony.js';
import {MELODY_SCALES} from './melody.js';
import {random} from './random.js';

type ChordFeel='sustain'|'pulse'|'offbeat'|'driving'|'fractured';
type ChordGesture={tick:number;length:number;weight:number;voices:'full'|'upper'|'shell';label:string};
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

/** Phrase-local comping: a clear chord statement, then optional lighter answers.
 * Repeated gestures use the same harmony; they never spill into the next change. */
function comping(change:{startTick:number;endTick:number;index:number},feel:ChordFeel,settings:Settings):ChordGesture[]{
  const span=change.endTick-change.startTick,complexity=settings.complexity,spicy=settings.spicy??0;
  const first=feel==='offbeat'?Math.round(span*.25):feel==='fractured'&&change.index%2?Math.round(span*.125):0;
  const answerChance=random(settings.seed,`piano:answer:${settings.variation??0}:${change.index}`)();
  const reply=feel==='sustain'?.66:feel==='pulse'?.54:feel==='offbeat'?.65:feel==='driving'?.47:.58;
  const plan:{fraction:number;weight:number;voices:ChordGesture['voices'];label:string}[]=[{fraction:first/span,weight:1,voices:'full',label:'statement'}];
  if(complexity>=.38&&answerChance<reply*(.45+complexity*.65)){
    const fraction=feel==='sustain'?.68:feel==='pulse'?.5:feel==='offbeat'?.75:feel==='driving'?.5:.625;
    plan.push({fraction,weight:.64,voices:'shell',label:'answer'});
  }
  if(complexity>=.76&&spicy>=.38&&change.index%2===1&&
      random(settings.seed,`piano:pickup:${settings.variation??0}:${change.index}`)()<spicy*.68){
    plan.push({fraction:.875,weight:.45,voices:'upper',label:'pickup'});
  }
  plan.sort((a,b)=>a.fraction-b.fraction);
  return plan.map((gesture,index)=>{
    const tick=change.startTick+Math.min(span-1,Math.round(gesture.fraction*span));
    const next=index+1<plan.length?change.startTick+Math.round(plan[index+1]!.fraction*span):change.endTick;
    const tail=feel==='sustain'&&index===0?Math.round(PPQ*.08):Math.round(PPQ*(index===0?.18:.12));
    return {tick,length:Math.max(1,next-tick-tail),weight:gesture.weight,voices:gesture.voices,label:gesture.label};
  });
}

function gestureVoices(notes:readonly number[],includeRoot:boolean,kind:ChordGesture['voices']):number[]{
  if(kind==='full')return [...notes];
  const upper=notes.slice(includeRoot?1:0);
  if(kind==='upper')return upper.slice(-Math.min(2,upper.length));
  // Leave the low root to the bass or the first attack; guide tones answer softly.
  return upper.slice(0,Math.min(3,upper.length));
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
    const intervals:Record<string,number[]>={maj9:[4,11,14,16],m9:[3,10,14,17],m11:[3,10,14,17,19],maj13:[4,11,14,21],dom13:[4,10,14,21],dom7b9:[4,7,10,13],m7b5:[3,6,10,14], 'm6/9':[3,9,14,16],dom7sharp11:[4,10,14,18],quartal:[5,10,15,19]};
    const chromatic=change.quality!=='scale';
    const tonePcs=[...new Set(chromatic?intervals[change.quality]!.map(interval=>pc(key+scalePitch(0,scale,degree)+interval)): [pc(third),pc(seventh),...(withNine?[pc(ninth)]:[]),...(settings.complexity>=.72?[pc(fifth)]:[])])];
    // Short scales can fold an extension onto an existing chord tone.
    const wanted=settings.complexity>=.72?4:withNine?3:2;
    for(let distance=1;tonePcs.length<wanted&&distance<=scale.length+2;distance++){
      const candidate=pc(scalePitch(key,scale,degree+distance));
      if(!tonePcs.includes(candidate)&&(!includeRoot||candidate!==pc(root)))tonePcs.push(candidate);
    }
    const notes=voiceChord(tonePcs,pc(root),previous,includeRoot);
    previous=notes.slice(includeRoot?1:0);
    const name=chromatic?`${NAMES[pc(root)]}${change.quality}`:chordName(root,third,seventh,withNine);
    comping(change,feel,settings).forEach((gesture,gestureIndex)=>{
      const selected=gestureVoices(notes,includeRoot,gesture.voices);
      const human=Math.round((random(settings.seed,`piano:timing:${change.index}:${gestureIndex}`)()*2-1)*settings.humanizeMs*settings.bpm*PPQ/60000);
      const swung=gestureIndex>0?Math.round((settings.swing-.5)*PPQ*.35):0;
      const offsetTick=Math.max(-gesture.tick,Math.min(PPQ,swung+human));
      selected.forEach((note,voice)=>out.push({
        id:`piano-${change.index}-${gestureIndex}-${voice}`,role:'percussion',trackId,sourceId:'kit.percussion',baseTick:gesture.tick,offsetTick,
        gain:Math.max(.18,Math.min(.78,(.64-(voice===0&&includeRoot&&gestureIndex===0?.07:0))*gesture.weight+
          (random(settings.seed,`piano:velocity:${change.index}:${gestureIndex}:${voice}`)()-.5)*.07)),
        pan:voice===0?-.05:voice===selected.length-1?.05:0,anchor:false,ghost:false,
        synthNote:{note,durationTicks:gesture.length},reason:`${name}: ${gesture.label} ${change.index+1}/${changes.length}.`
      }));
    });
  }
  return out;
}
