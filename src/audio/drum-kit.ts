import {ROLES,type Pattern,type Role,type SliceRef} from '../core/model.js';
import type {AudioAsset} from './slices.js';
import {validateWav} from './wav.js';
import {defaultEffects,validateEffects,type Effects} from './effects.js';
import {LIBRARY,KIT_PRESETS} from './library.js';

export type DrumKit=Partial<Record<Role,SliceRef>>;
export type KitSlot={choice:string;uploadId?:string;assetId?:string;include:boolean;mute:boolean;solo?:boolean;level:number;tune:number;decay?:number;reverse?:boolean;effects?:Effects};
export type KitState=Record<Role,KitSlot>;
export function defaultKitState():KitState{return Object.fromEntries(ROLES.map(r=>[r,{choice:'synth',include:true,mute:false,solo:false,level:1,tune:0,reverse:false,effects:defaultEffects()}])) as KitState;}
export function withDrumKit(pattern:Pattern,kit:DrumKit,mix?:KitState):Pattern{
  const hasSolo=mix&&Object.values(mix).some(s=>s.solo);
  return {...pattern,events:pattern.events.filter(h=>{
    if(!mix)return true;
    if(hasSolo)return !!mix[h.role].solo&&!mix[h.role].mute;
    return !mix[h.role].mute;
  }).map(hit=>{
    const result=hit.slice||!kit[hit.role]?{...hit}:{...hit,slice:{...kit[hit.role]!}};
    if(mix){
      result.reverse=!!hit.reverse||!!mix[hit.role].reverse;
      result.gain*=mix[hit.role].level;
      result.pitch=Math.max(-48,Math.min(48,(hit.pitch??0)+mix[hit.role].tune));
      const slotDecay=mix[hit.role].decay;
      if(slotDecay!==undefined&&slotDecay<1&&hit.decay===undefined){
        result.decay=slotDecay;
      }
    }
    return result;
  })};
}
export function setupDrumKit(assets:Map<string,AudioAsset>,changed:()=>void,audition:(role:Role)=>Promise<void>){
  const kit:DrumKit={},mix=defaultKitState(),root=document.getElementById('drum-slots')!;
  let context:AudioContext|undefined;
  const refreshers:(()=>void)[]=[],cancellers:(()=>void)[]=[];let pending=0;
  const loaders=new Map<Role, (id:string)=>Promise<void>>();
  for(const role of ROLES){
    const card=document.createElement('div');card.className='drum-slot';card.dataset.role=role;
    const title=document.createElement('h3');title.textContent={kick:'Kick',snare:'Snare',hat:'Hi-hat',percussion:'Percussion'}[role];
    const makeLabel=(text:string,node:HTMLElement)=>{const l=document.createElement('label');l.textContent=text;l.append(node);return l;};
    const checkbox=(id:string,text:string)=>{const i=document.createElement('input');i.type='checkbox';i.id=id;const l=makeLabel(text,i);l.className='loop-label';return {i,l};};
    const include=checkbox('kit-include-'+role,'Generate notes'),mute=checkbox('kit-mute-'+role,'Mute audio'),solo=checkbox('kit-solo-'+role,'Solo audio');
    include.i.title='Use this lane when generating a new pattern. Existing notes stay unchanged.';mute.i.title='Silence this lane in pattern/song playback and WAV exports. Instrument Preview still lets you hear it.';solo.i.title='Solo this lane in playback and export.';
    const choice=document.createElement('select');choice.id='kit-choice-'+role;
    const udnbList=LIBRARY.filter(s=>s.role===role&&s.id.startsWith('udnb-')).map(s=>[s.id,s.name]);
    const libList=LIBRARY.filter(s=>s.role===role&&!s.id.startsWith('udnb-')).map(s=>[s.id,s.name]);
    for(const [label,entries] of [['Built-in',[['synth','Synthesized '+title.textContent]]],['UDNB Collection (Personal)',udnbList],['Sample library',libList],['Your sample',[['upload','My upload']]]] as [string,string[][]][]){if(!entries.length)continue;const group=document.createElement('optgroup');group.label=label;for(const [value,text] of entries){const o=document.createElement('option');o.value=value!;o.textContent=text!;group.append(o);}choice.append(group);}
    const file=document.createElement('input');file.type='file';file.accept='.wav,audio/wav';file.id='kit-file-'+role;file.className='sample-file-input';file.setAttribute('aria-label','Upload '+title.textContent+' WAV');
    const upload=document.createElement('button');upload.id='kit-upload-'+role;upload.textContent='Upload WAV';upload.onclick=()=>file.click();
    const level=document.createElement('input');level.type='range';level.min='0';level.max='1';level.step='.01';level.id='kit-level-'+role;
    const tune=document.createElement('input');tune.type='number';tune.min='-24';tune.max='24';tune.step='1';tune.id='kit-tune-'+role;
    const info=document.createElement('p');info.id='kit-info-'+role;info.setAttribute('role','status');
    const play=document.createElement('button');play.textContent='Preview';play.id='kit-play-'+role;
    const clear=document.createElement('button');clear.textContent='Remove upload';clear.id='kit-remove-'+role;
    const heading=document.createElement('div');heading.className='sound-heading';const badge=document.createElement('span');badge.id='kit-badge-'+role;badge.className='sound-badge';heading.append(title,badge);
    const actions=document.createElement('div');actions.className='sound-actions';actions.append(play,upload,clear,file);
    const routing=document.createElement('div');routing.className='sound-routing';routing.append(include.l,mute.l,solo.l);
    const gainLabel=makeLabel('Level',level),gainValue=document.createElement('output');gainValue.id='kit-level-value-'+role;gainValue.htmlFor=level.id;gainLabel.prepend(gainValue);
    const shape=document.createElement('details');shape.className='tone-panel';shape.id='kit-shape-'+role;const shapeSummary=document.createElement('summary');shapeSummary.textContent='Pitch & playback';shape.append(shapeSummary);
    const reverse=checkbox('kit-reverse-'+role,'Reverse all hits in this lane');
    const decay=document.createElement('input');decay.type='range';decay.min='0.05';decay.max='1';decay.step='0.01';decay.id='kit-decay-'+role;
    const decayLabel=makeLabel('Decay / Tightness',decay),decayValue=document.createElement('output');decayValue.id='kit-decay-value-'+role;decayValue.htmlFor=decay.id;decayLabel.prepend(decayValue);
    shape.append(makeLabel('Lane pitch (semitones)',tune),decayLabel,reverse.l);
    card.append(heading,makeLabel('Sound',choice),info,actions,routing,gainLabel,shape);root.append(card);
    const fx=document.createElement('details');fx.className='effects-panel';fx.id='effects-'+role;const summary=document.createElement('summary');summary.textContent='Effects';fx.append(summary);
    const bypass=checkbox('fx-bypass-'+role,'Bypass effects');fx.append(bypass.l);
    const effectInputs=new Map<keyof Effects,HTMLInputElement>();
    for(const [key,name,min,max,step] of [['highpass','High-pass (Hz)',0,2000,10],['lowpass','Low-pass (Hz)',200,20000,100],['resonance','Resonance / Q (0–1)',0,1,.05],['punch','Punch attack (0–1)',0,1,.05],['drive','Drive (0–1)',0,1,.05],['delayMs','Delay time (ms)',30,1000,10],['feedback','Feedback (0–0.75)',0,.75,.05],['mix','Delay mix (0–0.6)',0,.6,.05]] as const){
      const field=document.createElement('input');field.type='number';field.min=String(min);field.max=String(max);field.step=String(step);field.id='fx-'+key+'-'+role;effectInputs.set(key,field);fx.append(makeLabel(name,field));
      field.onchange=()=>{const next={...(mix[role].effects??defaultEffects()),[key]:Number(field.value)};try{validateEffects(next);mix[role].effects=next;update();changed();}catch(e){update();info.textContent=String(e);}};
    }
    card.append(fx);reverse.i.onchange=()=>{mix[role].reverse=reverse.i.checked;update();changed();};
    decay.oninput=()=>{mix[role].decay=Number(decay.value);update();changed();};
    bypass.i.onchange=()=>{mix[role].effects={...(mix[role].effects??defaultEffects()),bypass:bypass.i.checked};update();changed();};
    let token=0,loading=false;
    const update=()=>{
      play.disabled=loading;upload.disabled=loading;card.setAttribute('aria-busy',String(loading));
      const slot=mix[role],asset=slot.assetId?assets.get(slot.assetId):undefined;
      if(asset)kit[role]={assetId:asset.id,startFrame:0,endFrame:asset.channels[0]!.length,sampleRate:asset.sampleRate,label:asset.name};else delete kit[role];
      reverse.i.checked=!!slot.reverse;const effects=slot.effects??defaultEffects();bypass.i.checked=effects.bypass;for(const [key,field] of effectInputs)field.value=String(effects[key]);
      choice.value=slot.choice;include.i.checked=slot.include;mute.i.checked=slot.mute;solo.i.checked=!!slot.solo;level.value=String(slot.level);tune.value=String(slot.tune);
      decay.value=String(slot.decay??1);decayValue.textContent=(slot.decay!==undefined&&slot.decay<1)?Math.round(slot.decay*100)+'% (Tight)':'100% (Natural)';
      (choice.querySelector('option[value="upload"]') as HTMLOptionElement).disabled=!slot.uploadId;
      clear.disabled=!slot.uploadId;clear.hidden=!slot.uploadId;upload.textContent=slot.uploadId?'Replace WAV':'Upload WAV';
      (choice.querySelector('option[value="upload"]') as HTMLOptionElement).textContent=slot.uploadId?(assets.get(slot.uploadId)?.name??'My upload'):'Upload a WAV to use here';
      gainValue.textContent=Math.round(slot.level*100)+'%';
      const active=[effects.highpass>0?'High-pass':'',effects.lowpass<20000?'Low-pass':'',(effects.resonance??0)>0?'Resonance':'',(effects.punch??0)>0?'Punch':'',effects.drive>0?'Drive':'',effects.mix>0?'Delay':''].filter(Boolean);
      summary.textContent=effects.bypass?'Effects · bypassed':active.length?'Effects · '+active.join(' + '):'Effects · off';
      badge.textContent=slot.mute?'Muted':slot.solo?'Solo':effects.bypass?'FX bypassed':active.length?'FX on':'Dry';badge.classList.toggle('active',!slot.mute&&!effects.bypass&&active.length>0);badge.title=slot.mute?'Muted in playback and export':summary.textContent;
      shapeSummary.textContent='Pitch & playback'+(slot.tune?' · '+(slot.tune>0?'+':'')+slot.tune+' st':'')+((slot.decay??1)<1?' · Decay '+Math.round((slot.decay??1)*100)+'%':'')+(slot.reverse?' · Reverse':'');
      card.classList.toggle('audio-muted',slot.mute);card.classList.toggle('audio-soloed',!!slot.solo);card.classList.toggle('generation-off',!slot.include);
      info.textContent=(asset?asset.name:'Synthesized '+role)+' · '+Math.round(slot.level*100)+'%'+((slot.decay??1)<1?' · Decay '+Math.round((slot.decay??1)*100)+'%':'')+(slot.reverse?' · Reverse':'')+(slot.solo?' · Solo':'')+(slot.mute?' · Muted':'');
    };
    refreshers.push(update);cancellers.push(()=>{token++;loading=false;});update();
    include.i.onchange=()=>{mix[role].include=include.i.checked;update();changed();};
    mute.i.onchange=()=>{mix[role].mute=mute.i.checked;update();changed();};
    solo.i.onchange=()=>{mix[role].solo=solo.i.checked;update();changed();};
    level.oninput=()=>{mix[role].level=Number(level.value);update();changed();};
    tune.onchange=()=>{const v=Number(tune.value);if(!Number.isInteger(v)||v< -24||v>24){update();return;}mix[role].tune=v;update();changed();};
    async function decode(bytes:ArrayBuffer,name:string,id:string,library=false){
      const meta=validateWav(bytes);if(meta.duration>20)throw Error('Single hits must be 20 seconds or shorter.');
      context??=new AudioContext();const decoded=await context.decodeAudioData(bytes);
      let channels=Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i));
      if(library){
        let peak=0;for(const c of channels)for(const v of c)peak=Math.max(peak,Math.abs(v));
        let first=0;while(first<decoded.length-1&&channels.every(c=>Math.abs(c[first]!)<peak*.005))first++;
        first=Math.max(0,first-Math.round(decoded.sampleRate*.002));
        const target={kick:.9,snare:.68,hat:.4,percussion:.65}[role],scale=peak?Math.min(4,target/peak):1;
        channels=channels.map(c=>Float32Array.from(c.subarray(first),v=>v*scale));
      }
      const used=[...assets.values()].reduce((n,a)=>n+a.channels.reduce((v,c)=>v+c.byteLength,0),0);
      if(used+channels.reduce((n,c)=>n+c.byteLength,0)>256*1024*1024)throw Error('Session audio limit reached. Save project before refreshing.');
      return {id,name,sampleRate:decoded.sampleRate,channels};
    }
    async function fetchSampleBytes(path:string):Promise<ArrayBuffer>{
      const rel=path.replace(/^\//,'');
      const urls=[new URL('../../'+rel,import.meta.url).href,'./'+rel,'/'+rel];
      for(const url of urls){
        try{const res=await fetch(url);if(res.ok)return await res.arrayBuffer();}catch{}
      }
      throw Error('Cannot reach server for sample. Ensure local server is running (npm start).');
    }
    choice.onchange=async()=>{
      const value=choice.value,request=++token;pending++;loading=true;update();info.textContent='Loading sound…';
      try{
        let id:string|undefined;
        if(value==='upload'){id=mix[role].uploadId;if(!id||!assets.has(id))throw Error('Upload a WAV first.');}
        else if(value!=='synth'){
          const entry=LIBRARY.find(s=>s.id===value&&s.role===role);if(!entry)throw Error('Unknown library sound.');id='library-'+entry.id;
          if(!assets.has(id)){const bytes=await fetchSampleBytes(entry.path);const a=await decode(bytes,entry.name,id,true);if(request!==token)return;assets.set(id,a);}
        }
        if(request!==token)return;mix[role].choice=value;mix[role].assetId=id;update();changed();
      }catch(e){if(request===token){update();const msg=e instanceof TypeError&&e.message.includes('fetch')?'Server unreachable. Ensure local server is running.':String(e);info.textContent=msg+' Previous sound kept.';}}finally{pending--;if(request===token){loading=false;play.disabled=false;upload.disabled=false;card.setAttribute('aria-busy','false');}}
    };
    file.onchange=async()=>{
      const next=file.files?.[0];file.value='';if(!next)return;const request=++token;pending++;loading=true;update();info.textContent='Loading locally…';
      try{
        if(next.size>20*1024*1024)throw Error('Choose a hit under 20 MB.');
        const a=await decode(await next.arrayBuffer(),next.name,crypto.randomUUID());if(request!==token)return;assets.set(a.id,a);
        mix[role].uploadId=a.id;mix[role].assetId=a.id;mix[role].choice='upload';update();changed();
      }catch(e){if(request===token){update();info.textContent=String(e)+' Previous instrument kept.';}}finally{pending--;if(request===token){loading=false;play.disabled=false;upload.disabled=false;card.setAttribute('aria-busy','false');}}
    };
    play.onclick=()=>{void audition(role).catch(e=>info.textContent=String(e));};
    clear.onclick=()=>{token++;loading=false;const slot=mix[role];slot.uploadId=undefined;if(slot.choice==='upload'){slot.choice='synth';slot.assetId=undefined;}update();changed();};
    loaders.set(role, async(soundId:string)=>{choice.value=soundId;await choice.onchange!(new Event('change'));});
  }
  return {
    kit,mix,get busy(){return pending>0;},snapshot:()=>structuredClone(mix),
    restore:(state:KitState)=>{cancellers.forEach(f=>f());for(const r of ROLES)mix[r]=structuredClone(state[r]);refreshers.forEach(f=>f());},
    applyPreset: async(presetId:string)=>{
      const preset=KIT_PRESETS.find(p=>p.id===presetId);
      if(!preset) return;
      for(const r of ROLES){
        if(preset.levels?.[r]!==undefined)mix[r].level=preset.levels[r]!;
        if(preset.decays?.[r]!==undefined)mix[r].decay=preset.decays[r]!;
        const load=loaders.get(r);if(load)await load(preset.slots[r]);
      }
    }
  };
}
