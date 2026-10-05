import {bounded,type SynthModule,type SynthPatch} from '../core/model.js';
import type {AudioAsset} from './slices.js';
import {validateSynthPatch} from '../core/synth-modules.js';
export {SYNTH_MODULES,patchFromInstrument,starterPatch,synthModule,validateSynthPatch} from '../core/synth-modules.js';

// Renderer only: patch data and validation were moved to ../core/synth-modules.js.
export function modularTailSeconds(patch:SynthPatch):number{
  const envelopes=patch.nodes.filter(node=>node.type==='envelope'||node.type==='multi-envelope');
  const release=Math.max(.05,...envelopes.map(node=>Number(node.params.release)));
  const delay=patch.nodes.some(node=>node.type==='delay')?1.8:0;
  const reverb=patch.nodes.some(node=>node.type==='reverb')?2.2:0;
  return Math.min(patch.nodes.some(node=>node.type==='multi-envelope')?8:4,release+Math.max(delay,reverb));
}

const clamp=(value:number,low:number,high:number)=>Math.max(low,Math.min(high,value));
const polyBlep=(phase:number,step:number)=>phase<step?((phase/step)*2-(phase/step)**2-1):phase>1-step?(((phase-1)/step)**2+2*((phase-1)/step)+1):0;
function oscillator(wave:string,phase:number,step:number,pulse:number){
  if(wave==='sine')return Math.sin(phase*2*Math.PI);
  if(wave==='triangle')return 1-4*Math.abs(phase-.5);
  if(wave==='square')return (phase<pulse?1:-1)+polyBlep(phase,step)-polyBlep((phase-pulse+1)%1,step);
  return 2*phase-1-polyBlep(phase,step);
}
function envelope(time:number,held:number,attack:number,decay:number,sustain:number,release:number){
  const level=(t:number)=>t<attack?t/attack:sustain+(1-sustain)*Math.exp(-(t-attack)/decay);
  return time<held?level(time):level(held)*Math.exp(-8*(time-held)/release);
}
function multiEnvelope(time:number,held:number,p:Record<string,number|string>){
  const delay=Number(p.delay),attack=Number(p.attack),hold=Number(p.hold),fall=Number(p.fall);
  const decay2=Number(p.decay2),breakLevel=Number(p.breakLevel),sustain=Number(p.sustain);
  const curve=2**Number(p.slope);
  const levelAt=(t:number)=>{
    let u=t-delay;
    if(u<=0)return 0;
    if(u<attack)return (u/attack)**curve;
    u-=attack;
    if(u<hold)return 1;
    u-=hold;
    if(u<fall)return 1-(1-breakLevel)*(u/fall)**curve;
    u-=fall;
    if(u<decay2)return breakLevel+(sustain-breakLevel)*(u/decay2)**curve;
    return sustain;
  };
  return time<held?levelAt(time):levelAt(held)*Math.exp(-8*(time-held)/Number(p.release));
}

/** Sample-accurate, deterministic per-note graph renderer shared by preview, song and exports. */
export function renderModularSynthNote(note:number,durationSeconds:number,rate:number,patch:SynthPatch,sample?:AudioAsset,rootNote=60,channel=0,velocity=1):Float32Array{
  bounded(note,0,119,'synth note',true);bounded(durationSeconds,.001,40,'synth note duration');
  if(!Number.isInteger(rate)||rate<8000||rate>192000)throw Error('Invalid synth sample rate.');
  const order=validateSynthPatch(patch),length=Math.ceil((durationSeconds+modularTailSeconds(patch))*rate),data=new Float32Array(length);
  const incoming=new Map(patch.nodes.map(node=>[node.id,patch.cables.filter(edge=>edge.to===node.id)]));
  const state=new Map<string,{phase:number;x1:number;x2:number;y1:number;y2:number;seed?:number;line?:Float32Array;write:number;combs?:Float32Array[];combWrites?:number[];combLow?:number[]}>(order.map(node=>[node.id,{phase:0,x1:0,x2:0,y1:0,y2:0,write:0}]));
  const baseFrequency=440*2**((note-69)/12),sampleStep=sample?sample.sampleRate/rate*2**((note-rootNote)/12):0;
  for(const node of order){
    const st=state.get(node.id)!;
    if(node.type==='noise')st.seed=(((note+1)*1103515245+12345)>>>0);
    if(node.type==='chorus')st.line=new Float32Array(Math.ceil(rate*.06));
    if(node.type==='delay')st.line=new Float32Array(Math.max(1,Math.ceil(Number(node.params.time)*rate)));
    if(node.type==='reverb'){
      st.combs=[.0297,.0331,.0371,.0411].map(seconds=>new Float32Array(Math.max(1,Math.round(seconds*rate))));
      st.combWrites=[0,0,0,0];st.combLow=[0,0,0,0];
    }
  }
  const values=new Map<string,number>();
  const outputNode=order.find(node=>node.type==='output')!;
  const input=(node:SynthModule,port:string)=>incoming.get(node.id)!.reduce((sum,edge)=>edge.input===port?sum+(values.get(edge.from)??0)*edge.depth:sum,0);
  const connected=(node:SynthModule,port:string)=>incoming.get(node.id)!.some(edge=>edge.input===port);
  for(let frame=0;frame<length;frame++){
    const time=frame/rate;values.clear();
    for(const node of order){
      const p=node.params,st=state.get(node.id)!;let value=0;
      switch(node.type){
        case 'oscillator':{
          const semitones=Number(p.tune)+input(node,'pitch')*12;
          const frequency=clamp(baseFrequency*2**(semitones/12),0,rate*.44),step=frequency/rate;
          let oscVal=oscillator(String(p.wave),st.phase,step,Number(p.pulse));
          const warmth=Number(p.warmth??0);
          if(warmth>0){
            const driven=oscVal*(1+warmth*1.8)+Math.sin(st.phase*4*Math.PI)*(warmth*.22);
            oscVal=Math.tanh(driven);
          }
          value=oscVal*Number(p.level)*(connected(node,'gain')?clamp(input(node,'gain'),0,2):1);
          st.phase=(st.phase+step)%1;break;
        }
        case 'fm-operator':{
          const base=baseFrequency*Number(p.ratio)*2**((Number(p.fineCents)/100+input(node,'pitch')*12)/12);
          const mod=clamp(input(node,'mod'),-1,1),cv=connected(node,'indexCv')?input(node,'indexCv'):0;
          const mode=String(p.mode);
          let frequency=base;
          if(mode==='linear')frequency+=Number(p.deviationHz)*clamp(1+cv,0,2)*mod;
          else if(mode==='exponential')frequency*=2**(Number(p.expSemitones)*clamp(1+cv,0,2)*mod/12);
          frequency=clamp(frequency,0,rate*.44);
          const index=mode==='phase'?clamp(Number(p.index)+cv*12,0,12):0;
          const signal=Math.sin(st.phase*2*Math.PI+index*mod);
          value=signal*Number(p.level)*(connected(node,'gain')?clamp(input(node,'gain'),0,2):1);
          st.phase=(st.phase+frequency/rate)%1;break;
        }
        case 'sample':{
          if(!sample)throw Error('The modular piano sample is missing.');
          const source=frame*sampleStep,index=Math.floor(source),fraction=source-index;
          const data=sample.channels[Math.min(channel,sample.channels.length-1)]!;
          value=((data[index]??0)*(1-fraction)+(data[index+1]??0)*fraction)*Number(p.level)*(connected(node,'gain')?clamp(input(node,'gain'),0,2):1);break;
        }
        case 'mixer':value=(input(node,'a')+input(node,'b')+input(node,'c')+input(node,'d'))*Number(p.level);break;
        case 'envelope':value=envelope(time,durationSeconds,Number(p.attack),Number(p.decay),Number(p.sustain),Number(p.release));break;
        case 'multi-envelope':value=multiEnvelope(time,durationSeconds,p)*(connected(node,'velocity')?clamp(input(node,'velocity'),0,1):1);break;
        case 'lfo':{
          const phase=(time*Number(p.rate))%1,wave=String(p.wave);
          value=(wave==='square'?(phase<.5?1:-1):wave==='triangle'?1-4*Math.abs(phase-.5):Math.sin(phase*2*Math.PI))*Number(p.depth);break;
        }
        case 'velocity':value=clamp(velocity,0,1)*Number(p.amount);break;
        case 'attenuverter':value=clamp(input(node,'in')*Number(p.amount)+Number(p.offset),-2,2);break;
        case 'distortion':{
          const signal=input(node,'in'),drive=Number(p.drive??1.5),wet=Number(p.wet??1);
          const driven=signal*(1+drive*2);
          const clipped=Math.tanh(driven);
          const toneCutoff=clamp(Number(p.tone??4200),200,rate*.45);
          const toneFilter=Math.exp(-2*Math.PI*toneCutoff/rate);
          st.y1=(1-toneFilter)*clipped+toneFilter*(st.y1??0);
          value=signal*(1-wet)+st.y1*wet;
          break;
        }
        case 'noise':{
          const color=String(p.color??'white');
          st.seed=((st.seed!*1664525+1013904223)>>>0);
          let noiseSample=(st.seed/2147483648)-1;
          if(color==='pink'){
            st.x1=(st.x1??0)*.99765+noiseSample*.0990460;
            st.x2=(st.x2??0)*.96300+noiseSample*.2965164;
            st.y1=(st.y1??0)*.57000+noiseSample*1.0526913;
            noiseSample=(st.x1+st.x2+st.y1+noiseSample*.1848)*.15;
          }
          value=noiseSample*Number(p.level)*(connected(node,'gain')?clamp(input(node,'gain'),0,2):1);
          break;
        }
        case 'filter':{
          const cutoff=clamp(Number(p.cutoff)*2**(input(node,'cutoff')*4),30,rate*.47);
          const resonance=clamp(Number(p.resonance)+input(node,'resonance')*.25,0,.95);
          const omega=2*Math.PI*cutoff/rate,cos=Math.cos(omega),alpha=Math.sin(omega)/(2*(.55+resonance*7));
          const mode=String(p.mode),a0=1+alpha;
          const b0=mode==='highpass'?(1+cos)/2:mode==='bandpass'?alpha:(1-cos)/2;
          const b1=mode==='highpass'?-(1+cos):mode==='bandpass'?0:1-cos;
          const b2=mode==='highpass'?(1+cos)/2:mode==='bandpass'?-alpha:(1-cos)/2;
          const signal=input(node,'in');
          value=(b0*signal+b1*st.x1+b2*st.x2-(-2*cos)*st.y1-(1-alpha)*st.y2)/a0;
          st.x2=st.x1;st.x1=signal;st.y2=st.y1;st.y1=clamp(value,-8,8);
          value=st.y1;break;
        }
        case 'amplifier':value=input(node,'in')*Number(p.level)*(connected(node,'gain')?clamp(input(node,'gain'),0,2):1);break;
        case 'chorus':{
          const line=st.line!,delay=(.018+Number(p.depth)*Math.sin(time*Number(p.rate)*2*Math.PI+channel*Math.PI))*rate;
          const position=(st.write-delay+line.length)%line.length,index=Math.floor(position),fraction=position-index;
          const wet=line[index]!* (1-fraction)+line[(index+1)%line.length]!*fraction,signal=input(node,'in');
          value=signal*(1-Number(p.wet))+wet*Number(p.wet);line[st.write]=signal;st.write=(st.write+1)%line.length;break;
        }
        case 'delay':{
          const line=st.line!,signal=input(node,'in'),wet=line[st.write]!;
          value=signal*(1-Number(p.wet))+wet*Number(p.wet);line[st.write]=signal+wet*Number(p.feedback);st.write=(st.write+1)%line.length;break;
        }
        case 'reverb':{
          const signal=input(node,'in');let wet=0;
          for(let index=0;index<4;index++){
            const line=st.combs![index]!,write=st.combWrites![index]!,tap=line[write]!;
            const low=st.combLow![index]!+(tap-st.combLow![index]!)*(1-Number(p.damp)*.85);
            st.combLow![index]=low;line[write]=signal+low*(.45+Number(p.size)*.4);st.combWrites![index]=(write+1)%line.length;wet+=tap*.25;
          }
          value=signal*(1-Number(p.wet))+wet*Number(p.wet);break;
        }
        case 'output':value=input(node,'in')*Number(p.level);break;
      }
      values.set(node.id,value);
    }
    const raw=values.get(outputNode.id)??0;
    const edge=Math.min(1,(length-1-frame)/Math.max(1,Math.round(rate*.005)));
    data[frame]=Math.tanh(raw)*Math.max(0,edge);
  }
  return data;
}
