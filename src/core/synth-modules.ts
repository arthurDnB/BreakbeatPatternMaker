import {bounded,type SynthCable,type SynthInstrument,type SynthModule,type SynthModuleType,type SynthPatch} from './model.js';

// Modular synth *data and validation* live in core so headless compilation
// (src/core/compile.ts, src/core/editor.ts) never imports from the audio layer.
// Pure PCM rendering stays in src/audio/modular-synth.ts, which re-exports these names.
type PortKind='audio'|'control';
type NumberParam={min:number;max:number;initial:number};
type ChoiceParam={choices:readonly string[];initial:string};
type Param=NumberParam|ChoiceParam;
export interface ModuleDefinition {label:string;inputs:Record<string,PortKind>;outputs:Record<string,PortKind>;params:Record<string,Param>}
const n=(min:number,max:number,initial:number):NumberParam=>({min,max,initial});
const c=(choices:readonly string[],initial:string):ChoiceParam=>({choices,initial});
export const SYNTH_MODULES:Record<SynthModuleType,ModuleDefinition>={
  oscillator:{label:'Oscillator',inputs:{pitch:'control',gain:'control'},outputs:{out:'audio'},params:{wave:c(['sine','triangle','saw','square'],'saw'),tune:n(-24,24,0),level:n(0,1,.55),pulse:n(.05,.95,.5),warmth:n(0,1,0)}},
  'fm-operator':{label:'FM / phase operator',inputs:{mod:'audio',indexCv:'control',pitch:'control',gain:'control'},outputs:{out:'audio'},params:{ratio:n(.25,24,1),fineCents:n(-100,100,0),mode:c(['phase','linear','exponential'],'phase'),index:n(0,12,0),deviationHz:n(0,8000,0),expSemitones:n(0,48,0),level:n(0,1,.5)}},
  sample:{label:'Piano sample',inputs:{gain:'control'},outputs:{out:'audio'},params:{level:n(0,1,.8)}},
  mixer:{label:'Mixer',inputs:{a:'audio',b:'audio',c:'audio',d:'audio'},outputs:{out:'audio'},params:{level:n(0,1,.8)}},
  filter:{label:'Multimode filter',inputs:{in:'audio',cutoff:'control',resonance:'control'},outputs:{out:'audio'},params:{mode:c(['lowpass','bandpass','highpass'],'lowpass'),cutoff:n(80,18000,3200),resonance:n(0,.95,.2)}},
  amplifier:{label:'Amplifier',inputs:{in:'audio',gain:'control'},outputs:{out:'audio'},params:{level:n(0,2,1)}},
  envelope:{label:'ADSR envelope',inputs:{},outputs:{out:'control'},params:{attack:n(.001,2,.01),decay:n(.001,4,.25),sustain:n(0,1,.65),release:n(.01,5,.3)}},
  'multi-envelope':{label:'Multistage envelope',inputs:{velocity:'control'},outputs:{out:'control'},params:{delay:n(0,2,0),attack:n(.001,2,.01),hold:n(0,2,0),fall:n(.001,3,.12),breakLevel:n(0,1,.5),decay2:n(.001,4,.25),slope:n(-1,1,0),sustain:n(0,1,.5),release:n(.01,8,.3)}},
  lfo:{label:'LFO',inputs:{},outputs:{out:'control'},params:{wave:c(['sine','triangle','square'],'sine'),rate:n(.05,20,2),depth:n(0,1,.5)}},
  velocity:{label:'Note velocity',inputs:{},outputs:{out:'control'},params:{amount:n(0,1,1)}},
  attenuverter:{label:'CV attenuverter',inputs:{in:'control'},outputs:{out:'control'},params:{amount:n(-1,1,1),offset:n(-1,1,0)}},
  chorus:{label:'Chorus',inputs:{in:'audio'},outputs:{out:'audio'},params:{rate:n(.1,5,.7),depth:n(0,.01,.003),wet:n(0,1,.25)}},
  delay:{label:'Delay',inputs:{in:'audio'},outputs:{out:'audio'},params:{time:n(.02,1,.25),feedback:n(0,.8,.32),wet:n(0,1,.25)}},
  reverb:{label:'Reverb',inputs:{in:'audio'},outputs:{out:'audio'},params:{size:n(.1,1,.5),damp:n(0,1,.4),wet:n(0,1,.2)}},
  distortion:{label:'Distortion / Drive',inputs:{in:'audio'},outputs:{out:'audio'},params:{drive:n(0,10,1.5),tone:n(200,18000,4200),wet:n(0,1,1)}},
  noise:{label:'Noise generator',inputs:{gain:'control'},outputs:{out:'audio'},params:{color:c(['white','pink'],'white'),level:n(0,1,.2)}},
  output:{label:'Output',inputs:{in:'audio'},outputs:{},params:{level:n(0,1.5,.8)}}
};

export function synthModule(type:SynthModuleType,id:string,x=100,y=100):SynthModule{
  const params:Record<string,number|string>={};
  for(const [key,parameter] of Object.entries(SYNTH_MODULES[type].params))params[key]=parameter.initial;
  return {id,type,x,y,params};
}

/** Editable starting point for a preset or real instrument emulation; old projects keep their original PCM until a patch is chosen. */
export function starterPatch(preset:string,source:'oscillator'|'sample'='oscillator'):SynthPatch{
  const sampled=source==='sample';
  const cable=(from:string,out:string,to:string,input:string,depth=1):SynthCable=>({from,out,to,input,depth});

  if(preset==='nylon-guitar'){
    const nodes=[
      synthModule('oscillator','source-a',40,70),
      synthModule('oscillator','source-b',40,280),
      synthModule('noise','noise',40,490),
      synthModule('mixer','mix',280,80),
      synthModule('filter','filter',520,80),
      synthModule('amplifier','amp',760,80),
      synthModule('chorus','chorus',1000,80),
      synthModule('output','out',1240,80),
      synthModule('envelope','env',520,320),
      synthModule('envelope','noise-env',280,490)
    ];
    nodes[0]!.params.wave='triangle';nodes[0]!.params.tune=0;nodes[0]!.params.level=0.75;
    nodes[1]!.params.wave='triangle';nodes[1]!.params.tune=0.04;nodes[1]!.params.level=0.35;
    nodes[2]!.params.color='pink';nodes[2]!.params.level=0.12;
    nodes[3]!.params.level=0.85;
    nodes[4]!.params.mode='lowpass';nodes[4]!.params.cutoff=2800;nodes[4]!.params.resonance=0.22;
    nodes[5]!.params.level=1;
    nodes[6]!.params.rate=0.6;nodes[6]!.params.depth=0.002;nodes[6]!.params.wet=0.18;
    nodes[7]!.params.level=0.9;
    nodes[8]!.params.attack=0.003;nodes[8]!.params.decay=0.85;nodes[8]!.params.sustain=0.08;nodes[8]!.params.release=0.32;
    nodes[9]!.params.attack=0.001;nodes[9]!.params.decay=0.04;nodes[9]!.params.sustain=0;nodes[9]!.params.release=0.02;
    const cables=[
      cable('source-a','out','mix','a'),cable('source-b','out','mix','b'),cable('noise','out','mix','c'),
      cable('noise-env','out','noise','gain'),cable('mix','out','filter','in'),cable('filter','out','amp','in'),
      cable('env','out','amp','gain'),cable('env','out','filter','cutoff',0.45),cable('amp','out','chorus','in'),cable('chorus','out','out','in')
    ];
    return {version:1,nodes,cables};
  }
  if(preset==='rhodes-model-v2'){
    const nodes=[
      synthModule('fm-operator','modulator',40,70),
      synthModule('multi-envelope','tine-env',40,310),
      synthModule('fm-operator','carrier',300,70),
      synthModule('oscillator','body',300,330),
      synthModule('velocity','velocity',40,550),
      synthModule('mixer','mix',560,70),
      synthModule('multi-envelope','amp-env',560,310),
      synthModule('amplifier','amp',820,70),
      synthModule('chorus','chorus',1060,70),
      synthModule('output','out',1300,70)
    ];
    const get=(id:string)=>nodes.find(node=>node.id===id)!.params;
    Object.assign(get('modulator'),{ratio:7,index:0,level:.65});
    Object.assign(get('tine-env'),{attack:.001,fall:.22,breakLevel:0,decay2:.03,sustain:0,release:.08});
    Object.assign(get('carrier'),{ratio:1,index:1.5,level:.58});
    Object.assign(get('body'),{wave:'sine',level:.35,warmth:.08});
    Object.assign(get('mix'),{level:.7});
    Object.assign(get('amp-env'),{attack:.002,fall:1.8,breakLevel:.27,decay2:.7,sustain:.17,release:.42});
    Object.assign(get('amp'),{level:.8});
    Object.assign(get('chorus'),{rate:.75,depth:.002,wet:.12});
    const cables=[
      cable('tine-env','out','modulator','gain'),
      cable('modulator','out','carrier','mod',.7),
      cable('velocity','out','carrier','indexCv',.04),
      cable('carrier','out','mix','a'),cable('body','out','mix','b'),
      cable('mix','out','amp','in'),cable('amp-env','out','amp','gain'),
      cable('amp','out','chorus','in'),cable('chorus','out','out','in')
    ];
    return {version:1,nodes,cables};
  }
  if(preset==='rhodes'||preset==='rhodes-keys'){
    const nodes=[
      synthModule('oscillator','source-a',40,70),
      synthModule('oscillator','source-b',40,280),
      synthModule('mixer','mix',280,80),
      synthModule('filter','filter',520,80),
      synthModule('amplifier','amp',760,80),
      synthModule('chorus','chorus',1000,80),
      synthModule('output','out',1240,80),
      synthModule('envelope','env',520,320),
      synthModule('lfo','lfo',280,340)
    ];
    nodes[0]!.params.wave='sine';nodes[0]!.params.tune=0;nodes[0]!.params.level=0.85;nodes[0]!.params.warmth=0.15;
    nodes[1]!.params.wave='triangle';nodes[1]!.params.tune=12;nodes[1]!.params.level=0.28;
    nodes[2]!.params.level=0.8;
    nodes[3]!.params.mode='lowpass';nodes[3]!.params.cutoff=3600;nodes[3]!.params.resonance=0.15;
    nodes[4]!.params.level=1;
    nodes[5]!.params.rate=0.85;nodes[5]!.params.depth=0.003;nodes[5]!.params.wet=0.35;
    nodes[6]!.params.level=0.9;
    nodes[7]!.params.attack=0.004;nodes[7]!.params.decay=1.6;nodes[7]!.params.sustain=0.18;nodes[7]!.params.release=0.45;
    nodes[8]!.params.wave='sine';nodes[8]!.params.rate=4.8;nodes[8]!.params.depth=0.15;
    const cables=[
      cable('source-a','out','mix','a'),cable('source-b','out','mix','b'),cable('mix','out','filter','in'),
      cable('filter','out','amp','in'),cable('env','out','amp','gain'),cable('env','out','filter','cutoff',0.3),
      cable('amp','out','chorus','in'),cable('chorus','out','out','in')
    ];
    return {version:1,nodes,cables};
  }
  if(preset==='overdrive-guitar'){
    const nodes=[
      synthModule('oscillator','source-a',40,70),
      synthModule('oscillator','source-b',40,280),
      synthModule('mixer','mix',260,80),
      synthModule('distortion','dist',480,80),
      synthModule('filter','filter',700,80),
      synthModule('amplifier','amp',920,80),
      synthModule('delay','delay',1140,80),
      synthModule('reverb','reverb',1360,80),
      synthModule('output','out',1580,80),
      synthModule('envelope','env',480,320),
      synthModule('lfo','lfo',40,490)
    ];
    nodes[0]!.params.wave='saw';nodes[0]!.params.tune=0;nodes[0]!.params.level=0.75;
    nodes[1]!.params.wave='saw';nodes[1]!.params.tune=0.07;nodes[1]!.params.level=0.65;
    nodes[2]!.params.level=0.8;
    nodes[3]!.params.drive=4.5;nodes[3]!.params.tone=3200;nodes[3]!.params.wet=1;
    nodes[4]!.params.mode='lowpass';nodes[4]!.params.cutoff=2900;nodes[4]!.params.resonance=0.35;
    nodes[5]!.params.level=1;
    nodes[6]!.params.time=0.18;nodes[6]!.params.feedback=0.32;nodes[6]!.params.wet=0.28;
    nodes[7]!.params.size=0.55;nodes[7]!.params.damp=0.4;nodes[7]!.params.wet=0.22;
    nodes[8]!.params.level=0.85;
    nodes[9]!.params.attack=0.008;nodes[9]!.params.decay=0.6;nodes[9]!.params.sustain=0.72;nodes[9]!.params.release=0.28;
    nodes[10]!.params.wave='sine';nodes[10]!.params.rate=5.4;nodes[10]!.params.depth=0.08;
    const cables=[
      cable('source-a','out','mix','a'),cable('source-b','out','mix','b'),cable('lfo','out','source-a','pitch',0.05),
      cable('mix','out','dist','in'),cable('dist','out','filter','in'),cable('filter','out','amp','in'),
      cable('env','out','amp','gain'),cable('amp','out','delay','in'),cable('delay','out','reverb','in'),cable('reverb','out','out','in')
    ];
    return {version:1,nodes,cables};
  }
  if(preset==='upright-piano'){
    const nodes=[
      synthModule('oscillator','source-a',40,70),
      synthModule('oscillator','source-b',40,280),
      synthModule('mixer','mix',280,80),
      synthModule('filter','filter',520,80),
      synthModule('amplifier','amp',760,80),
      synthModule('reverb','reverb',1000,80),
      synthModule('output','out',1240,80),
      synthModule('envelope','env',520,320)
    ];
    nodes[0]!.params.wave='triangle';nodes[0]!.params.tune=0;nodes[0]!.params.level=0.75;
    nodes[1]!.params.wave='sine';nodes[1]!.params.tune=0.03;nodes[1]!.params.level=0.55;nodes[1]!.params.warmth=0.1;
    nodes[2]!.params.level=0.85;
    nodes[3]!.params.mode='lowpass';nodes[3]!.params.cutoff=4200;nodes[3]!.params.resonance=0.18;
    nodes[4]!.params.level=1;
    nodes[5]!.params.size=0.5;nodes[5]!.params.damp=0.45;nodes[5]!.params.wet=0.22;
    nodes[6]!.params.level=0.9;
    nodes[7]!.params.attack=0.003;nodes[7]!.params.decay=1.4;nodes[7]!.params.sustain=0.12;nodes[7]!.params.release=0.6;
    const cables=[
      cable('source-a','out','mix','a'),cable('source-b','out','mix','b'),cable('mix','out','filter','in'),
      cable('filter','out','amp','in'),cable('env','out','amp','gain'),cable('env','out','filter','cutoff',0.4),
      cable('amp','out','reverb','in'),cable('reverb','out','out','in')
    ];
    return {version:1,nodes,cables};
  }
  if(preset==='strings'||preset==='warm-strings'){
    const nodes=[
      synthModule('oscillator','source-a',40,70),
      synthModule('oscillator','source-b',40,280),
      synthModule('mixer','mix',280,80),
      synthModule('filter','filter',520,80),
      synthModule('amplifier','amp',760,80),
      synthModule('chorus','chorus',1000,80),
      synthModule('reverb','reverb',1240,80),
      synthModule('output','out',1480,80),
      synthModule('envelope','env',520,320),
      synthModule('lfo','lfo',40,490)
    ];
    nodes[0]!.params.wave='saw';nodes[0]!.params.tune=0;nodes[0]!.params.level=0.65;
    nodes[1]!.params.wave='saw';nodes[1]!.params.tune=0.09;nodes[1]!.params.level=0.6;
    nodes[2]!.params.level=0.8;
    nodes[3]!.params.mode='lowpass';nodes[3]!.params.cutoff=2400;nodes[3]!.params.resonance=0.25;
    nodes[4]!.params.level=1;
    nodes[5]!.params.rate=0.7;nodes[5]!.params.depth=0.003;nodes[5]!.params.wet=0.35;
    nodes[6]!.params.size=0.75;nodes[6]!.params.damp=0.35;nodes[6]!.params.wet=0.3;
    nodes[7]!.params.level=0.85;
    nodes[8]!.params.attack=0.18;nodes[8]!.params.decay=0.55;nodes[8]!.params.sustain=0.8;nodes[8]!.params.release=0.55;
    nodes[9]!.params.wave='sine';nodes[9]!.params.rate=5.2;nodes[9]!.params.depth=0.06;
    const cables=[
      cable('source-a','out','mix','a'),cable('source-b','out','mix','b'),cable('lfo','out','source-a','pitch',0.05),
      cable('lfo','out','source-b','pitch',0.05),cable('mix','out','filter','in'),cable('filter','out','amp','in'),
      cable('env','out','amp','gain'),cable('amp','out','chorus','in'),cable('chorus','out','reverb','in'),cable('reverb','out','out','in')
    ];
    return {version:1,nodes,cables};
  }
  if(preset==='flute'){
    const nodes=[
      synthModule('oscillator','source-a',40,70),
      synthModule('oscillator','source-b',40,280),
      synthModule('noise','noise',40,490),
      synthModule('mixer','mix',280,80),
      synthModule('filter','filter',520,80),
      synthModule('amplifier','amp',760,80),
      synthModule('reverb','reverb',1000,80),
      synthModule('output','out',1240,80),
      synthModule('envelope','env',520,320),
      synthModule('lfo','lfo',280,340)
    ];
    nodes[0]!.params.wave='sine';nodes[0]!.params.tune=0;nodes[0]!.params.level=0.8;nodes[0]!.params.warmth=0.05;
    nodes[1]!.params.wave='triangle';nodes[1]!.params.tune=12;nodes[1]!.params.level=0.2;
    nodes[2]!.params.color='white';nodes[2]!.params.level=0.08;
    nodes[3]!.params.level=0.85;
    nodes[4]!.params.mode='lowpass';nodes[4]!.params.cutoff=3400;nodes[4]!.params.resonance=0.15;
    nodes[5]!.params.level=1;
    nodes[6]!.params.size=0.7;nodes[6]!.params.damp=0.4;nodes[6]!.params.wet=0.28;
    nodes[7]!.params.level=0.9;
    nodes[8]!.params.attack=0.045;nodes[8]!.params.decay=0.35;nodes[8]!.params.sustain=0.75;nodes[8]!.params.release=0.22;
    nodes[9]!.params.wave='sine';nodes[9]!.params.rate=5.5;nodes[9]!.params.depth=0.08;
    const cables=[
      cable('source-a','out','mix','a'),cable('source-b','out','mix','b'),cable('noise','out','mix','c'),
      cable('lfo','out','source-a','pitch',0.06),cable('mix','out','filter','in'),cable('filter','out','amp','in'),
      cable('env','out','amp','gain'),cable('amp','out','reverb','in'),cable('reverb','out','out','in')
    ];
    return {version:1,nodes,cables};
  }
  if(preset==='brass'){
    const nodes=[
      synthModule('oscillator','source-a',40,70),
      synthModule('oscillator','source-b',40,280),
      synthModule('mixer','mix',280,80),
      synthModule('filter','filter',520,80),
      synthModule('amplifier','amp',760,80),
      synthModule('reverb','reverb',1000,80),
      synthModule('output','out',1240,80),
      synthModule('envelope','env',520,320)
    ];
    nodes[0]!.params.wave='saw';nodes[0]!.params.tune=0;nodes[0]!.params.level=0.7;
    nodes[1]!.params.wave='saw';nodes[1]!.params.tune=0.11;nodes[1]!.params.level=0.65;
    nodes[2]!.params.level=0.8;
    nodes[3]!.params.mode='lowpass';nodes[3]!.params.cutoff=4200;nodes[3]!.params.resonance=0.32;
    nodes[4]!.params.level=1;
    nodes[5]!.params.size=0.65;nodes[5]!.params.damp=0.35;nodes[5]!.params.wet=0.2;
    nodes[6]!.params.level=0.9;
    nodes[7]!.params.attack=0.038;nodes[7]!.params.decay=0.42;nodes[7]!.params.sustain=0.68;nodes[7]!.params.release=0.24;
    const cables=[
      cable('source-a','out','mix','a'),cable('source-b','out','mix','b'),cable('mix','out','filter','in'),
      cable('filter','out','amp','in'),cable('env','out','amp','gain'),cable('env','out','filter','cutoff',0.5),
      cable('amp','out','reverb','in'),cable('reverb','out','out','in')
    ];
    return {version:1,nodes,cables};
  }
  if(preset==='slap-bass'){
    const nodes=[
      synthModule('oscillator','source-a',40,70),
      synthModule('oscillator','source-b',40,280),
      synthModule('mixer','mix',260,80),
      synthModule('distortion','dist',480,80),
      synthModule('filter','filter',700,80),
      synthModule('amplifier','amp',920,80),
      synthModule('output','out',1160,80),
      synthModule('envelope','env',480,320)
    ];
    nodes[0]!.params.wave='triangle';nodes[0]!.params.tune=0;nodes[0]!.params.level=0.75;
    nodes[1]!.params.wave='sine';nodes[1]!.params.tune=-12;nodes[1]!.params.level=0.65;nodes[1]!.params.warmth=0.25;
    nodes[2]!.params.level=0.85;
    nodes[3]!.params.drive=1.8;nodes[3]!.params.tone=4500;nodes[3]!.params.wet=0.45;
    nodes[4]!.params.mode='lowpass';nodes[4]!.params.cutoff=2800;nodes[4]!.params.resonance=0.42;
    nodes[5]!.params.level=1;
    nodes[6]!.params.level=0.9;
    nodes[7]!.params.attack=0.002;nodes[7]!.params.decay=0.26;nodes[7]!.params.sustain=0.32;nodes[7]!.params.release=0.12;
    const cables=[
      cable('source-a','out','mix','a'),cable('source-b','out','mix','b'),cable('mix','out','dist','in'),
      cable('dist','out','filter','in'),cable('filter','out','amp','in'),cable('env','out','amp','gain'),
      cable('env','out','filter','cutoff',0.55),cable('amp','out','out','in')
    ];
    return {version:1,nodes,cables};
  }
  if(preset==='vibraphone'){
    const nodes=[
      synthModule('oscillator','source-a',40,70),
      synthModule('oscillator','source-b',40,280),
      synthModule('mixer','mix',280,80),
      synthModule('filter','filter',520,80),
      synthModule('amplifier','amp',760,80),
      synthModule('reverb','reverb',1000,80),
      synthModule('output','out',1240,80),
      synthModule('envelope','env',520,320),
      synthModule('lfo','lfo',280,340)
    ];
    nodes[0]!.params.wave='sine';nodes[0]!.params.tune=0;nodes[0]!.params.level=0.85;
    nodes[1]!.params.wave='sine';nodes[1]!.params.tune=24;nodes[1]!.params.level=0.22;
    nodes[2]!.params.level=0.8;
    nodes[3]!.params.mode='lowpass';nodes[3]!.params.cutoff=5500;nodes[3]!.params.resonance=0.12;
    nodes[4]!.params.level=1;
    nodes[5]!.params.size=0.7;nodes[5]!.params.damp=0.3;nodes[5]!.params.wet=0.32;
    nodes[6]!.params.level=0.9;
    nodes[7]!.params.attack=0.002;nodes[7]!.params.decay=2.1;nodes[7]!.params.sustain=0.06;nodes[7]!.params.release=0.75;
    nodes[8]!.params.wave='sine';nodes[8]!.params.rate=3.8;nodes[8]!.params.depth=0.2;
    const cables=[
      cable('source-a','out','mix','a'),cable('source-b','out','mix','b'),cable('mix','out','filter','in'),
      cable('filter','out','amp','in'),cable('env','out','amp','gain'),cable('amp','out','reverb','in'),cable('reverb','out','out','in')
    ];
    return {version:1,nodes,cables};
  }
  if(preset==='reese'){
    const nodes=[
      synthModule('oscillator','source-a',40,70),
      synthModule('oscillator','source-b',40,280),
      synthModule('mixer','mix',260,80),
      synthModule('distortion','dist',480,80),
      synthModule('filter','filter',700,80),
      synthModule('amplifier','amp',920,80),
      synthModule('chorus','chorus',1140,80),
      synthModule('output','out',1360,80),
      synthModule('envelope','env',480,320)
    ];
    nodes[0]!.params.wave='saw';nodes[0]!.params.tune=-0.16;nodes[0]!.params.level=0.7;
    nodes[1]!.params.wave='saw';nodes[1]!.params.tune=0.16;nodes[1]!.params.level=0.7;
    nodes[2]!.params.level=0.85;
    nodes[3]!.params.drive=2.5;nodes[3]!.params.tone=2800;nodes[3]!.params.wet=0.65;
    nodes[4]!.params.mode='lowpass';nodes[4]!.params.cutoff=950;nodes[4]!.params.resonance=0.35;
    nodes[5]!.params.level=1;
    nodes[6]!.params.rate=0.5;nodes[6]!.params.depth=0.003;nodes[6]!.params.wet=0.3;
    nodes[7]!.params.level=0.85;
    nodes[8]!.params.attack=0.01;nodes[8]!.params.decay=0.35;nodes[8]!.params.sustain=0.75;nodes[8]!.params.release=0.18;
    const cables=[
      cable('source-a','out','mix','a'),cable('source-b','out','mix','b'),cable('mix','out','dist','in'),
      cable('dist','out','filter','in'),cable('filter','out','amp','in'),cable('env','out','amp','gain'),
      cable('amp','out','chorus','in'),cable('chorus','out','out','in')
    ];
    return {version:1,nodes,cables};
  }
  if(preset==='acid303'){
    const nodes=[
      synthModule('oscillator','source-a',40,70),
      synthModule('distortion','dist',260,80),
      synthModule('filter','filter',480,80),
      synthModule('amplifier','amp',700,80),
      synthModule('delay','delay',920,80),
      synthModule('output','out',1140,80),
      synthModule('envelope','env',480,320)
    ];
    nodes[0]!.params.wave='saw';nodes[0]!.params.tune=0;nodes[0]!.params.level=0.85;
    nodes[1]!.params.drive=2.2;nodes[1]!.params.tone=6000;nodes[1]!.params.wet=0.7;
    nodes[2]!.params.mode='lowpass';nodes[2]!.params.cutoff=1600;nodes[2]!.params.resonance=0.82;
    nodes[3]!.params.level=1;
    nodes[4]!.params.time=0.22;nodes[4]!.params.feedback=0.35;nodes[4]!.params.wet=0.25;
    nodes[5]!.params.level=0.85;
    nodes[6]!.params.attack=0.003;nodes[6]!.params.decay=0.22;nodes[6]!.params.sustain=0.12;nodes[6]!.params.release=0.14;
    const cables=[
      cable('source-a','out','dist','in'),cable('dist','out','filter','in'),cable('filter','out','amp','in'),
      cable('env','out','amp','gain'),cable('env','out','filter','cutoff',0.85),cable('amp','out','delay','in'),cable('delay','out','out','in')
    ];
    return {version:1,nodes,cables};
  }
  if(preset==='sub808'){
    const nodes=[
      synthModule('oscillator','source-a',40,70),
      synthModule('filter','filter',280,80),
      synthModule('amplifier','amp',520,80),
      synthModule('output','out',760,80),
      synthModule('envelope','env',280,320)
    ];
    nodes[0]!.params.wave='sine';nodes[0]!.params.tune=-12;nodes[0]!.params.level=0.9;nodes[0]!.params.warmth=0.35;
    nodes[1]!.params.mode='lowpass';nodes[1]!.params.cutoff=420;nodes[1]!.params.resonance=0.15;
    nodes[2]!.params.level=1.1;
    nodes[3]!.params.level=0.95;
    nodes[4]!.params.attack=0.002;nodes[4]!.params.decay=0.85;nodes[4]!.params.sustain=0.45;nodes[4]!.params.release=0.22;
    const cables=[
      cable('source-a','out','filter','in'),cable('filter','out','amp','in'),cable('env','out','amp','gain'),cable('amp','out','out','in')
    ];
    return {version:1,nodes,cables};
  }
  if(preset==='supersaw'){
    const nodes=[
      synthModule('oscillator','source-a',40,70),
      synthModule('oscillator','source-b',40,280),
      synthModule('mixer','mix',280,80),
      synthModule('filter','filter',520,80),
      synthModule('amplifier','amp',760,80),
      synthModule('chorus','chorus',1000,80),
      synthModule('delay','delay',1240,80),
      synthModule('reverb','reverb',1480,80),
      synthModule('output','out',1720,80),
      synthModule('envelope','env',520,320)
    ];
    nodes[0]!.params.wave='saw';nodes[0]!.params.tune=-0.15;nodes[0]!.params.level=0.7;
    nodes[1]!.params.wave='saw';nodes[1]!.params.tune=0.15;nodes[1]!.params.level=0.7;
    nodes[2]!.params.level=0.8;
    nodes[3]!.params.mode='lowpass';nodes[3]!.params.cutoff=7500;nodes[3]!.params.resonance=0.25;
    nodes[4]!.params.level=1;
    nodes[5]!.params.rate=1.2;nodes[5]!.params.depth=0.004;nodes[5]!.params.wet=0.4;
    nodes[6]!.params.time=0.25;nodes[6]!.params.feedback=0.35;nodes[6]!.params.wet=0.25;
    nodes[7]!.params.size=0.7;nodes[7]!.params.damp=0.3;nodes[7]!.params.wet=0.25;
    nodes[8]!.params.level=0.85;
    nodes[9]!.params.attack=0.008;nodes[9]!.params.decay=0.45;nodes[9]!.params.sustain=0.75;nodes[9]!.params.release=0.28;
    const cables=[
      cable('source-a','out','mix','a'),cable('source-b','out','mix','b'),cable('mix','out','filter','in'),
      cable('filter','out','amp','in'),cable('env','out','amp','gain'),cable('amp','out','chorus','in'),
      cable('chorus','out','delay','in'),cable('delay','out','reverb','in'),cable('reverb','out','out','in')
    ];
    return {version:1,nodes,cables};
  }
  if(preset==='warm-pad'||preset==='lush-pad'){
    const nodes=[
      synthModule('oscillator','source-a',40,70),
      synthModule('oscillator','source-b',40,280),
      synthModule('mixer','mix',280,80),
      synthModule('filter','filter',520,80),
      synthModule('amplifier','amp',760,80),
      synthModule('chorus','chorus',1000,80),
      synthModule('reverb','reverb',1240,80),
      synthModule('output','out',1480,80),
      synthModule('envelope','env',520,320),
      synthModule('lfo','lfo',280,340)
    ];
    nodes[0]!.params.wave='triangle';nodes[0]!.params.tune=0;nodes[0]!.params.level=0.65;
    nodes[1]!.params.wave='saw';nodes[1]!.params.tune=0.08;nodes[1]!.params.level=0.55;
    nodes[2]!.params.level=0.8;
    nodes[3]!.params.mode='lowpass';nodes[3]!.params.cutoff=1900;nodes[3]!.params.resonance=0.28;
    nodes[4]!.params.level=1;
    nodes[5]!.params.rate=0.6;nodes[5]!.params.depth=0.003;nodes[5]!.params.wet=0.38;
    nodes[6]!.params.size=0.85;nodes[6]!.params.damp=0.4;nodes[6]!.params.wet=0.35;
    nodes[7]!.params.level=0.85;
    nodes[8]!.params.attack=0.24;nodes[8]!.params.decay=0.65;nodes[8]!.params.sustain=0.78;nodes[8]!.params.release=0.75;
    nodes[9]!.params.wave='sine';nodes[9]!.params.rate=0.4;nodes[9]!.params.depth=0.35;
    const cables=[
      cable('source-a','out','mix','a'),cable('source-b','out','mix','b'),cable('mix','out','filter','in'),
      cable('lfo','out','filter','cutoff',0.3),cable('filter','out','amp','in'),cable('env','out','amp','gain'),
      cable('amp','out','chorus','in'),cable('chorus','out','reverb','in'),cable('reverb','out','out','in')
    ];
    return {version:1,nodes,cables};
  }
  if(preset==='bell-pluck'){
    const nodes=[
      synthModule('oscillator','source-a',40,70),
      synthModule('oscillator','source-b',40,280),
      synthModule('mixer','mix',280,80),
      synthModule('filter','filter',520,80),
      synthModule('amplifier','amp',760,80),
      synthModule('delay','delay',1000,80),
      synthModule('reverb','reverb',1240,80),
      synthModule('output','out',1480,80),
      synthModule('envelope','env',520,320)
    ];
    nodes[0]!.params.wave='triangle';nodes[0]!.params.tune=0;nodes[0]!.params.level=0.75;
    nodes[1]!.params.wave='sine';nodes[1]!.params.tune=19;nodes[1]!.params.level=0.35;
    nodes[2]!.params.level=0.85;
    nodes[3]!.params.mode='lowpass';nodes[3]!.params.cutoff=4800;nodes[3]!.params.resonance=0.22;
    nodes[4]!.params.level=1;
    nodes[5]!.params.time=0.28;nodes[5]!.params.feedback=0.4;nodes[5]!.params.wet=0.3;
    nodes[6]!.params.size=0.65;nodes[6]!.params.damp=0.3;nodes[6]!.params.wet=0.25;
    nodes[7]!.params.level=0.9;
    nodes[8]!.params.attack=0.002;nodes[8]!.params.decay=0.65;nodes[8]!.params.sustain=0.08;nodes[8]!.params.release=0.45;
    const cables=[
      cable('source-a','out','mix','a'),cable('source-b','out','mix','b'),cable('mix','out','filter','in'),
      cable('filter','out','amp','in'),cable('env','out','amp','gain'),cable('amp','out','delay','in'),
      cable('delay','out','reverb','in'),cable('reverb','out','out','in')
    ];
    return {version:1,nodes,cables};
  }

  // Fallback / legacy general starter patch (e.g. 'bass', 'piano' with sample)
  const nodes=[synthModule(sampled?'sample':'oscillator','source-a',40,70),...(!sampled?[synthModule('oscillator','source-b',40,320)]:[]),synthModule('mixer','mix',300,80),synthModule('filter','filter',540,80),synthModule('amplifier','amp',790,80),synthModule('envelope','env',540,310),synthModule('lfo','lfo',300,350),synthModule('output','out',1040,80)];
  if(!sampled){
    const isPluck=preset==='pluck'||preset==='bell-pluck'||preset==='rhodes-keys';
    const isSine=preset==='piano'||preset==='sub808'||preset==='sine-whistle';
    const isSquare=preset==='chiptune'||preset==='house-organ'||preset==='neuro-wobble'||preset==='dub-sub';
    nodes[0]!.params.wave=isPluck?'triangle':isSine?'sine':isSquare?'square':'saw';
    const isSubBass=preset==='bass'||preset==='sub808'||preset==='dub-sub'||preset==='donk'||preset==='acid303'||preset==='neuro-wobble';
    nodes[1]!.params.wave=isSubBass?'sine':preset==='supersaw'||preset==='reese'?'saw':'triangle';
    nodes[1]!.params.tune=isSubBass?-12:preset==='reese'?.15:preset==='supersaw'?.2:0;
    nodes[1]!.params.level=isSubBass?.25:.3;
    nodes[1]!.params.warmth=isSubBass?0.2:0;
  }
  const filter=nodes.find(node=>node.id==='filter')!,env=nodes.find(node=>node.id==='env')!;
  const isLowCutoff=preset==='sub808'?240:preset==='dub-sub'?380:preset==='reese'?920:preset==='dark-drone'?1100:preset==='bass'?1400:preset==='acid303'?1850:preset==='pad'?2300:6000;
  filter.params.cutoff=isLowCutoff;
  const isSlowEnv=preset==='pad'||preset==='lush-pad'||preset==='dark-drone'||preset==='warm-strings'||preset==='ethereal-pad';
  env.params.attack=isSlowEnv?.14:.006;
  env.params.decay=preset==='piano'?1.4:isSlowEnv?.45:.22;
  env.params.sustain=preset==='piano'?.12:preset==='pluck'?.12:preset==='bell-pluck'?.08:isSlowEnv?.65:.55;
  env.params.release=preset==='piano'?.8:isSlowEnv?.75:.14;
  const cables=[cable('source-a','out','mix','a'),...(!sampled?[cable('source-b','out','mix','b')]:[]),cable('mix','out','filter','in'),cable('filter','out','amp','in'),cable('env','out','amp','gain'),cable('amp','out','out','in')];
  return {version:1,nodes,cables};
}

/** Preserve customized legacy synth settings when the musician explicitly opens modular editing. */
export function patchFromInstrument(instrument:SynthInstrument):SynthPatch{
  if(instrument.patch)return structuredClone(instrument.patch);
  const patch=starterPatch(instrument.preset,instrument.sample||instrument.sampleBank?'sample':'oscillator');
  const source=patch.nodes.find(node=>node.id==='source-a');
  if(source&&source.type==='oscillator')source.params.wave=instrument.waveform;
  const filter=patch.nodes.find(node=>node.id==='filter');
  if(filter)filter.params.cutoff=instrument.lowpassHz;
  const env=patch.nodes.find(node=>node.id==='env');
  if(env)for(const key of ['attack','decay','sustain','release'] as const)env.params[key]=instrument[key];
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
  const isSource=(node:SynthModule)=>['oscillator','fm-operator','sample','noise'].includes(node.type);
  if(patch.nodes.filter(node=>node.type==='output').length!==1||!patch.nodes.some(isSource))throw Error('A synth patch needs one output and an audio source.');
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
  const reaches=new Set(patch.nodes.filter(isSource).map(node=>node.id));
  for(const node of order)if(patch.cables.some(edge=>edge.to===node.id&&SYNTH_MODULES[nodes.get(edge.from)!.type].outputs[edge.out]==='audio'&&reaches.has(edge.from)))reaches.add(node.id);
  if(!reaches.has(output.id))throw Error('Connect an audio source to the synth output.');
  return order;
}
