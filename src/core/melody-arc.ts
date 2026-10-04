import {barTicks} from './meter.js';
import {harmonyAt,harmonyPlan} from './harmony.js';
import {melodyProfile} from './melody-profiles.js';
import {MELODY_SCALES} from './melody.js';
import {random} from './random.js';
import {PPQ,type Hit,type Settings} from './model.js';

/** Absolute song position keeps the hook recognizable when an arrangement changes slots. */
export interface MelodyArcContext {startBar:number;songBars:number;section?:string}

const clamp=(value:number,low:number,high:number)=>Math.max(low,Math.min(high,value));
const roll=(s:Settings,stage:string,key:string)=>random(s.seed,`lead-arc:${s.genre}:${s.variation??0}:${stage}:${key}`)();
const pc=(note:number)=>((note%12)+12)%12;
const scaleDegree=(key:number,scale:readonly number[],degree:number)=>key+12*Math.floor(degree/scale.length)+scale[((degree%scale.length)+scale.length)%scale.length]!;
function inRegister(pitchClass:number,low:number,high:number,target:number):number{
 let best=low,bestCost=Infinity;
 for(let note=low;note<=high;note++)if(pc(note)===pitchClass){const cost=Math.abs(note-target);if(cost<bestCost){best=note;bestCost=cost;}}
 return best;
}
function sectionEnergy(section:string|undefined):number{
 const name=(section??'').toLowerCase();
 if(/intro|opening|break|outro|ending/.test(name))return .65;
 if(/build|rise/.test(name))return .82;
 if(/drop|chorus|hook/.test(name))return 1;
 return .9;
}

/** Hook, answer, altered hook, cadence: one motif develops over four song bars. */
export function generateLeadArc(s:Settings,trackId:string,context:MelodyArcContext={startBar:0,songBars:s.bars}):Hit[]{
 const profile=melodyProfile(s.genre,'lead'),BAR=barTicks(s),STEP=BAR/16;
 const key=s.melodyKey??0,scale=MELODY_SCALES[s.melodyScale??'natural-minor'].intervals;
 const harmony=harmonyPlan({...s,bars:context.songBars}),contour=profile.contours[Math.floor(roll(s,'motif','contour')*profile.contours.length)]!;
 const motif=profile.motif,output:Hit[]=[];
 let previous:number|undefined;
 const recent:number[]=[];
 for(let bar=0;bar<s.bars;bar++){
  const globalBar=context.startBar+bar,phrase=globalBar%4,energy=sectionEnergy(context.section);
  const base=phrase===1?profile.response:motif;
  // The answer enters after the downbeat. The cadence leaves a breath before the next hook.
  const core=base.map((step,i)=>phrase===1&&i===0?Math.min(15,step+2):step)
    .filter((step,i)=>!(phrase===3&&i===base.length-1&&base.length>2)&&!(energy<.7&&i===base.length-1&&base.length>2));
  const slots=new Set(core);
  for(const detail of profile.details){
   if((s.complexity>=.35+.5*roll(s,'detail-threshold',String(detail)))&&
      roll(s,'detail',`${globalBar}:${detail}`)<s.complexity*energy)slots.add(detail);
  }
  if(phrase===3&&(s.spicy??0)>=.35&&core.length&&roll(s,'pickup',String(globalBar))<(s.spicy??0)){
   const pickup=core.at(-1)!+.5;if(pickup<16)slots.add(pickup);
  }
  const steps=[...slots].sort((a,b)=>a-b);
  for(const [index,step] of steps.entries()){
   const tick=Math.round(bar*BAR+step*STEP),next=Math.round(bar*BAR+(steps[index+1]??16)*STEP);
   const chord=harmonyAt(harmony,context.startBar*BAR+tick),rootDegree=Math.round(chord.degree*(scale.length-1)/6);
   const coreIndex=core.indexOf(step),detail=coreIndex<0,arrival=index===0||index===steps.length-1||step%4===0;
   let offset=contour[(coreIndex<0?index:coreIndex)%contour.length]!;
   if(phrase===1)offset+=index===0?1:-1;
   if(phrase===3&&index===steps.length-1)offset=0;
   if(phrase===2&&index===Math.floor(steps.length/2))offset+=2; // one phrase high point
   if(detail)offset+=roll(s,'neighbor',`${globalBar}:${step}`)<.5?-1:1;
   // Strong arrivals are chord tones. Connecting notes may move by scale step.
   if(arrival&&!detail)offset=[0,2,4].reduce((best,tone)=>Math.abs(tone-offset)<Math.abs(best-offset)?tone:best,0);
   const pitchClass=pc(scaleDegree(key,scale,rootDegree+offset));
   const isPeak=phrase===2&&index===Math.floor(steps.length/2);
   const registerHigh=profile.high-(phrase===2?0:phrase===3?8:5);
   const centre=(profile.low+registerHigh)/2;
   const target=isPeak?registerHigh:previous??centre;
   let pitch=inRegister(pitchClass,profile.low,registerHigh,target);
   if(isPeak)pitch=Math.max(...[0,2,4].map(tone=>inRegister(pc(scaleDegree(key,scale,rootDegree+tone)),profile.low,registerHigh,registerHigh)));
   if(!isPeak&&previous!==undefined&&Math.abs(pitch-previous)>7){
    const resolution=pc(scaleDegree(key,scale,rootDegree+(pitch>previous?2:0)));
    const resolved=inRegister(resolution,profile.low,registerHigh,previous);
    if(Math.abs(resolved-previous)<Math.abs(pitch-previous))pitch=resolved;
   }
   if(recent.length>=3){
    const [a,b,c]=recent.slice(-3);
    if(a!<b!&&b!<c!&&c!<pitch&&b!-a!<=4&&c!-b!<=4&&pitch-c!<=4){
     if(isPeak&&output.length){
      let revised=b!;
      for(let candidate=b!-1;candidate>=profile.low;candidate--)if(scale.includes(pc(candidate-key))){revised=candidate;break;}
      output.at(-1)!.synthNote!.note=revised;
      recent[recent.length-1]=revised;
     }else{
      const root=pc(scaleDegree(key,scale,rootDegree));
      pitch=inRegister(root,profile.low,registerHigh,c!-3);
     }
    }
   }
   recent.push(pitch);if(recent.length>3)recent.shift();
   previous=pitch;
   const shifted=step%2===1?Math.round((s.swing-.5)*2*STEP*.55):0;
   const humanize=Math.round((roll(s,'humanize',`${globalBar}:${step}`)*2-1)*s.humanizeMs*s.bpm*PPQ/60000);
   const offsetTick=clamp(shifted+humanize,-tick,Math.min(PPQ,s.bars*BAR-1-tick));
   const durationTicks=Math.max(1,Math.min(Math.round(Math.min(next-tick,profile.maxBeats*PPQ)*profile.gate*(phrase===3?.82:1)),s.bars*BAR-tick));
   const gain=clamp((detail?.49:arrival?.8:.67)*energy+(phrase===2&&arrival?.06:0),.3,1);
   output.push({id:`melody-lead-${tick}`,role:'percussion',trackId,sourceId:'kit.percussion',baseTick:tick,offsetTick,gain,pan:0,anchor:false,ghost:false,
    synthNote:{note:pitch,durationTicks},reason:`Lead ${phrase===1?'motif response':phrase===3?'motif cadence':phrase===2?'motif variation':'motif hook'}: ${arrival?'chord-tone arrival':'connecting tone'} in song bar ${globalBar+1}.`});
  }
 }
 return output;
}
