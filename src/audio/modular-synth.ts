import {bounded,type SynthCable,type SynthInstrument,type SynthModule,type SynthModuleType,type SynthPatch,type SynthPreset} from '../core/model.js';
import type {AudioAsset} from './slices.js';

type PortKind='audio'|'control';
type NumberParam={min:number;max:number;initial:number};
type ChoiceParam={choices:readonly string[];initial:string};
type Param=NumberParam|ChoiceParam;
export interface ModuleDefinition {label:string;inputs:Record<string,PortKind>;outputs:Record<string,PortKind>;params:Record<string,Param>}
const n=(min:number,max:number,initial:number):NumberParam=>({min,max,initial});
const c=(choices:readonly string[],initial:string):ChoiceParam=>({choices,initial});
export const SYNTH_MODULES:Record<SynthModuleType,ModuleDefinition>={
  oscillator:{label:'Oscillator',inputs:{pitch:'control',gain:'control'},outputs:{out:'audio'},params:{wave:c(['sine','triangle','saw','square'],'saw'),tune:n(-24,24,0),level:n(0,1,.55),pulse:n(.05,.95,.5)}},
  sample:{label:'Piano sample',inputs:{gain:'control'},outputs:{out:'audio'},params:{level:n(0,1,.8)}},
  mixer:{label:'Mixer',inputs:{a:'audio',b:'audio',c:'audio',d:'audio'},outputs:{out:'audio'},params:{level:n(0,1,.8)}},
  filter:{label:'Multimode filter',inputs:{in:'audio',cutoff:'control',resonance:'control'},outputs:{out:'audio'},params:{mode:c(['lowpass','bandpass','highpass'],'lowpass'),cutoff:n(80,18000,3200),resonance:n(0,.95,.2)}},
  amplifier:{label:'Amplifier',inputs:{in:'audio',gain:'control'},outputs:{out:'audio'},params:{level:n(0,2,1)}},
  envelope:{label:'ADSR envelope',inputs:{},outputs:{out:'control'},params:{attack:n(.001,2,.01),decay:n(.001,4,.25),sustain:n(0,1,.65),release:n(.01,5,.3)}},
  lfo:{label:'LFO',inputs:{},outputs:{out:'control'},params:{wave:c(['sine','triangle','square'],'sine'),rate:n(.05,20,2),depth:n(0,1,.5)}},
  velocity:{label:'Note velocity',inputs:{},outputs:{out:'control'},params:{amount:n(0,1,1)}},
  attenuverter:{label:'CV attenuverter',inputs:{in:'control'},outputs:{out:'control'},params:{amount:n(-1,1,1),offset:n(-1,1,0)}},
  chorus:{label:'Chorus',inputs:{in:'audio'},outputs:{out:'audio'},params:{rate:n(.1,5,.7),depth:n(0,.01,.003),wet:n(0,1,.25)}},
  delay:{label:'Delay',inputs:{in:'audio'},outputs:{out:'audio'},params:{time:n(.02,1,.25),feedback:n(0,.8,.32),wet:n(0,1,.25)}},
  reverb:{label:'Reverb',inputs:{in:'audio'},outputs:{out:'audio'},params:{size:n(.1,1,.5),damp:n(0,1,.4),wet:n(0,1,.2)}},
  output:{label:'Output',inputs:{in:'audio'},outputs:{},params:{level:n(0,1.5,.8)}}
};

export function synthModule(type:SynthModuleType,id:string,x=100,y=100):SynthModule{
  const params:Record<string,number|string>={};
  for(const [key,parameter] of Object.entries(SYNTH_MODULES[type].params))params[key]=parameter.initial;
  return {id,type,x,y,params};
}

/** Editable starting point for a legacy preset; old projects keep their original PCM until a patch is chosen. */
export function starterPatch(preset:SynthPreset,source:'oscillator'|'sample'='oscillator'):SynthPatch{
  const sampled=source==='sample';
  const nodes=[synthModule(sampled?'sample':'oscillator','source-a',40,70),...(!sampled?[synthModule('oscillator','source-b',40,320)]:[]),synthModule('mixer','mix',300,80),synthModule('filter','filter',540,80),synthModule('amplifier','amp',790,80),synthModule('envelope','env',540,310),synthModule('lfo','lfo',300,350),synthModule('output','out',1040,80)];
  if(!sampled){nodes[0]!.params.wave=preset==='pluck'?'triangle':preset==='piano'?'sine':'saw';nodes[1]!.params.wave=preset==='bass'?'sine':'triangle';nodes[1]!.params.tune=preset==='bass'?-12:0;nodes[1]!.params.level=preset==='bass'?.18:.3;}
  const filter=nodes.find(node=>node.id==='filter')!,env=nodes.find(node=>node.id==='env')!;
  filter.params.cutoff=preset==='bass'?1400:preset==='pad'?2300:6000;
  env.params.attack=preset==='pad'?.14:.006;env.params.decay=preset==='piano'?1.4:preset==='pad'?.45:.22;env.params.sustain=preset==='piano'?.12:preset==='pluck'?.12:.55;env.params.release=preset==='pad'?.75:preset==='piano'?.8:.14;
  const cable=(from:string,out:string,to:string,input:string,depth=1):SynthCable=>({from,out,to,input,depth});
  const cables=[cable('source-a','out','mix','a'),...(!sampled?[cable('source-b','out','mix','b')]:[]),cable('mix','out','filter','in'),cable('filter','out','amp','in'),cable('env','out','amp','gain'),cable('amp','out','out','in')];
  return {version:1,nodes,cables};
}

/** Preserve customized legacy synth settings when the musician explicitly opens modular editing. */
export function patchFromInstrument(instrument:SynthInstrument):SynthPatch{
  if(instrument.patch)return structuredClone(instrument.patch);
  const patch=starterPatch(instrument.preset,instrument.sample||instrument.sampleBank?'sample':'oscillator');
  const source=patch.nodes.find(node=>node.id==='source-a')!;
  if(source.type==='oscillator')source.params.wave=instrument.waveform;
  const filter=patch.nodes.find(node=>node.id==='filter')!;filter.params.cutoff=instrument.lowpassHz;
  const env=patch.nodes.find(node=>node.id==='env')!;
  for(const key of ['attack','decay','sustain','release'] as const)env.params[key]=instrument[key];
  return patch;
}

/** Validate port types, parameter bounds and acyclic routing before a patch is saved or rendered. */
export function validateSynthPatch(patch:SynthPatch):SynthModule[]{
  if(!patch||patch.version!==1||!Array.isArray(patch.nodes)||!Array.isArray(patch.cables)||patch.nodes.length<3||patch.nodes.length>32||patch.cables.length>64)throw Error('Invalid modular synth patch.');
  const nodes=new Map<string,SynthModule>();
  for(const node of patch.nodes){
    if(!node||typeof node.id!=='string'||!/^[a-zA-Z0-9._-]{1,80}$/.test(node.id)||nodes.has(node.id)||!Object.hasOwn(SYNTH_MODULES,node.type))throw Error('Invalid or duplicate synth module.');
    bounded(node.x,0,4000,'module x');bounded(node.y,0,4000,'module y');
    const spec=SYNTH_MODULES[node.type];
    if(!node.params||typeof node.params!=='object'||Array.isArray(node.params)||Object.keys(node.params).some(key=>!Object.hasOwn(spec.params,key)))throw Error('Invalid synth module parameters.');
    for(const [key,parameter] of Object.entries(spec.params)){
      const value=node.params[key];
      if('choices' in parameter){if(typeof value!=='string'||!parameter.choices.includes(value))throw Error(`Invalid ${node.type} ${key}.`);}
      else bounded(value,parameter.min,parameter.max,`${node.type} ${key}`);
    }
    nodes.set(node.id,node);
  }
  if(patch.nodes.filter(node=>node.type==='output').length!==1||!patch.nodes.some(node=>['oscillator','sample'].includes(node.type)))throw Error('A synth patch needs one output and an audio source.');
  const incoming=new Map<string,number>(patch.nodes.map(node=>[node.id,0])),next=new Map<string,string[]>(patch.nodes.map(node=>[node.id,[]])),seen=new Set<string>();
  for(const edge of patch.cables){
    const from=nodes.get(edge?.from),to=nodes.get(edge?.to),kind=from&&SYNTH_MODULES[from.type].outputs[edge.out];
    if(!from||!to||!kind||SYNTH_MODULES[to.type].inputs[edge.input]!==kind||edge.from===edge.to)throw Error('Synth cable ports do not match.');
    bounded(edge.depth,-1,1,'cable depth');
    const key=`${edge.from}:${edge.out}:${edge.to}:${edge.input}`;if(seen.has(key))throw Error('Duplicate synth cable.');seen.add(key);
    incoming.set(to.id,incoming.get(to.id)!+1);next.get(from.id)!.push(to.id);
  }
  const queue=patch.nodes.filter(node=>incoming.get(node.id)===0),order:SynthModule[]=[];
  for(let cursor=0;cursor<queue.length;cursor++){
    const node=queue[cursor]!;order.push(node);
    for(const id of next.get(node.id)!){const left=incoming.get(id)!-1;incoming.set(id,left);if(left===0)queue.push(nodes.get(id)!);}
  }
  if(order.length!==patch.nodes.length)throw Error('Synth patch feedback loops are not supported.');
  const output=patch.nodes.find(node=>node.type==='output')!;
  const reaches=new Set(patch.nodes.filter(node=>['oscillator','sample'].includes(node.type)).map(node=>node.id));
  for(const node of order)if(patch.cables.some(edge=>edge.to===node.id&&SYNTH_MODULES[nodes.get(edge.from)!.type].outputs[edge.out]==='audio'&&reaches.has(edge.from)))reaches.add(node.id);
  if(!reaches.has(output.id))throw Error('Connect an audio source to the synth output.');
  return order;
}

export function modularTailSeconds(patch:SynthPatch):number{
  const envelopes=patch.nodes.filter(node=>node.type==='envelope');
  const release=Math.max(.05,...envelopes.map(node=>Number(node.params.release)));
  const delay=patch.nodes.some(node=>node.type==='delay')?1.8:0;
  const reverb=patch.nodes.some(node=>node.type==='reverb')?2.2:0;
  return Math.min(4,release+Math.max(delay,reverb));
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

/** Sample-accurate, deterministic per-note graph renderer shared by preview, song and exports. */
export function renderModularSynthNote(note:number,durationSeconds:number,rate:number,patch:SynthPatch,sample?:AudioAsset,rootNote=60,channel=0,velocity=1):Float32Array{
  bounded(note,0,119,'synth note',true);bounded(durationSeconds,.001,40,'synth note duration');
  if(!Number.isInteger(rate)||rate<8000||rate>192000)throw Error('Invalid synth sample rate.');
  const order=validateSynthPatch(patch),length=Math.ceil((durationSeconds+modularTailSeconds(patch))*rate),data=new Float32Array(length);
  const incoming=new Map(patch.nodes.map(node=>[node.id,patch.cables.filter(edge=>edge.to===node.id)]));
  const state=new Map<string,{phase:number;x1:number;x2:number;y1:number;y2:number;line?:Float32Array;write:number;combs?:Float32Array[];combWrites?:number[];combLow?:number[]}>(order.map(node=>[node.id,{phase:0,x1:0,x2:0,y1:0,y2:0,write:0}]));
  const baseFrequency=440*2**((note-69)/12),sampleStep=sample?sample.sampleRate/rate*2**((note-rootNote)/12):0;
  for(const node of order){
    const st=state.get(node.id)!;
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
          value=oscillator(String(p.wave),st.phase,step,Number(p.pulse))*Number(p.level)*(connected(node,'gain')?clamp(input(node,'gain'),0,2):1);
          st.phase=(st.phase+step)%1;break;
        }
        case 'sample':{
          if(!sample)throw Error('The modular piano sample is missing.');
          const source=frame*sampleStep,index=Math.floor(source),fraction=source-index;
          const data=sample.channels[Math.min(channel,sample.channels.length-1)]!;
          value=((data[index]??0)*(1-fraction)+(data[index+1]??0)*fraction)*Number(p.level)*(connected(node,'gain')?clamp(input(node,'gain'),0,2):1);break;
        }
        case 'mixer':value=(input(node,'a')+input(node,'b')+input(node,'c')+input(node,'d'))*Number(p.level);break;
        case 'envelope':value=envelope(time,durationSeconds,Number(p.attack),Number(p.decay),Number(p.sustain),Number(p.release));break;
        case 'lfo':{
          const phase=(time*Number(p.rate))%1,wave=String(p.wave);
          value=(wave==='square'?(phase<.5?1:-1):wave==='triangle'?1-4*Math.abs(phase-.5):Math.sin(phase*2*Math.PI))*Number(p.depth);break;
        }
        case 'velocity':value=clamp(velocity,0,1)*Number(p.amount);break;
        case 'attenuverter':value=clamp(input(node,'in')*Number(p.amount)+Number(p.offset),-2,2);break;
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
