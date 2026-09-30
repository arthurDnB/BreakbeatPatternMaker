import {ROLES,isSynthTrack,type Pattern,type Role,type SliceRef} from '../core/model.js';
import type {AudioAsset} from './slices.js';
import {validateWav} from './wav.js';
import {defaultEffects,validateEffects,type Effects} from './effects.js';
import {LIBRARY,KIT_PRESETS} from './library.js';
import {isVinylTexture} from './vinyl-texture.js';
import {ensureLibraryAudio} from './library-audio.js';
import {resolvePatternSlices} from '../core/slice-instrument.js';
import {assessLayerMono} from './audio-quality.js';

export type DrumKit=Partial<Record<Role,SliceRef>>;
export type SampleShape={decay?:number;playbackRate?:number;speedMode?:'repitch'|'stretch';lowpassHz?:number;attackMs?:number;sourceBpm?:number;followBpm?:boolean};
export type KitLayer={choice:string;slice:SliceRef;level:number;offsetMs:number;phaseInvert:boolean};
export type KitSlot={choice:string;uploadId?:string;assetId?:string;include:boolean;mute:boolean;solo?:boolean;level:number;tune:number;reverse?:boolean;layer?:KitLayer;effects?:Effects;sampleProfiles?:Record<string,SampleShape>} & SampleShape;
export type KitState=Record<Role,KitSlot>;
const SHAPE_KEYS=['decay','playbackRate','speedMode','lowpassHz','attackMs','sourceBpm'] as const;
const sampleKey=(slot:KitSlot)=>slot.assetId??'synth';
function rememberShape(slot:KitSlot){const shape:SampleShape={};for(const key of SHAPE_KEYS)if(slot[key]!==undefined)(shape as Record<string,unknown>)[key]=slot[key];if(slot.followBpm!==undefined)shape.followBpm=slot.followBpm;(slot.sampleProfiles??={})[sampleKey(slot)]=shape;}
function recallShape(slot:KitSlot){const shape=slot.sampleProfiles?.[sampleKey(slot)];for(const key of SHAPE_KEYS){if(shape?.[key]!==undefined)(slot as Record<string,unknown>)[key]=shape[key];else delete slot[key];}if(shape?.followBpm!==undefined)slot.followBpm=shape.followBpm;else delete slot.followBpm;}
export function effectiveSampleSpeed(shape:SampleShape,bpm:number):{rate:number;following:boolean;warning?:string}{
  const manual=shape.playbackRate??1;
  if(!shape.followBpm)return {rate:manual,following:false};
  if(!shape.sourceBpm||!Number.isFinite(shape.sourceBpm))return {rate:manual,following:false,warning:'Enter the original break BPM to follow tempo.'};
  const ratio=bpm/shape.sourceBpm;
  if(!Number.isFinite(ratio)||ratio<.5||ratio>2)return {rate:manual,following:false,warning:'BPM follow needs 0.5×–2× speed. Manual speed is playing.'};
  return {rate:ratio,following:true};
}
export function defaultKitState():KitState{return Object.fromEntries(ROLES.map(r=>[r,{choice:'synth',include:true,mute:false,solo:false,level:1,tune:0,reverse:false,effects:defaultEffects()}])) as KitState;}
export function withDrumKit(pattern:Pattern,kit:DrumKit,mix?:KitState):Pattern{
  pattern=resolvePatternSlices(pattern);
  const userTracks=new Map((pattern.userTracks??[]).map(track=>[track.id,track]));
  const hasSolo=mix&&(Object.values(mix).some(s=>s.solo)||(pattern.userTracks??[]).some(track=>track.solo));
  return {...pattern,events:pattern.events.filter(h=>{
    if(!mix)return true;
    const track=h.trackId?userTracks.get(h.trackId):undefined;
    if(track)return hasSolo?track.solo&&!track.mute:!track.mute;
    if(hasSolo)return !!mix[h.role].solo&&!mix[h.role].mute;
    return !mix[h.role].mute;
  }).flatMap(hit=>{
    const userTrack=hit.trackId?userTracks.get(hit.trackId):undefined;
    if(isSynthTrack(userTrack))return [{...hit,renderGain:hit.gain*userTrack.level,pan:Math.max(-1,Math.min(1,hit.pan+userTrack.pan))}];
    const result=hit.slice?{...hit}:userTrack&&!isSynthTrack(userTrack)?{...hit,slice:{...userTrack.sample}}:!kit[hit.role]?{...hit}:{...hit,slice:{...kit[hit.role]!}};
    if(['groove-v3','groove-v4'].includes(pattern.settings.algorithm??''))result.sourceKind=hit.sourceKind??(hit.slice?'slice':'oneShot');
    if(mix){
      result.reverse=!!hit.reverse||!!mix[hit.role].reverse;
      if(['groove-v3','groove-v4'].includes(pattern.settings.algorithm??'')&&mix[hit.role].reverse&&hit.articulation?.repeats){
        result.articulation={...hit.articulation,repeats:hit.articulation.repeats.map(r=>({...r,reverse:true}))};
      }
      result.gain*=mix[hit.role].level;
      if(userTrack){result.gain*=userTrack.level;result.pan=Math.max(-1,Math.min(1,result.pan+userTrack.pan));}
      result.pitch=Math.max(-48,Math.min(48,(hit.pitch??0)+mix[hit.role].tune));
      const slot=mix[hit.role];
      const soundShape:SampleShape=hit.slice&&hit.slice.assetId!==sampleKey(slot)?slot.sampleProfiles?.[hit.slice.assetId]??{}:slot;
      if(hit.playbackRate!==undefined||hit.speedMode!==undefined||soundShape.playbackRate!==undefined||soundShape.followBpm){
        const speed=hit.playbackRate??effectiveSampleSpeed(soundShape,pattern.settings.bpm).rate;
        if((hit.speedMode??soundShape.speedMode)==='stretch'){
          // The later pitch resampling changes duration too. Compensate its
          // ratio in the stretch stage so the requested hit speed stays musical.
          const compensated=speed/2**((result.pitch??0)/12);
          result.stretchRate=Math.max(.5,Math.min(2,compensated));
          result.playbackRate=1;
        }else result.playbackRate=speed;
      }
      if(hit.lowpassHz!==undefined||soundShape.lowpassHz!==undefined)result.lowpassHz=hit.lowpassHz??soundShape.lowpassHz;
      if(hit.attackMs!==undefined||soundShape.attackMs!==undefined)result.attackMs=hit.attackMs??soundShape.attackMs;
      const slotDecay=soundShape.decay;
      if(slotDecay!==undefined&&slotDecay<1&&hit.decay===undefined){
        result.decay=slotDecay;
      }
    }
    const layer=mix?.[hit.role].layer;
    if(userTrack||!layer||layer.level===0||hit.mapped)return [result];
    let hash=2166136261;
    for(let i=0;i<hit.id.length;i++)hash=Math.imul(hash^hit.id.charCodeAt(i),16777619);
    const layerId=`layer-${hit.id.slice(0,58)}-${(hash>>>0).toString(16)}`;
    const tickShift=Math.round(layer.offsetMs/1000*pattern.settings.bpm/60*960);
    const secondary={...result,id:layerId,layerOf:hit.id,slice:{...layer.slice},sampleTrim:undefined,sourceKind:'oneShot' as const,
      gain:Math.min(1,result.gain*layer.level),phaseInvert:layer.phaseInvert,
      offsetTick:Math.max(-960,Math.min(960,result.offsetTick+tickShift)),reason:'Layer: '+layer.slice.label};
    return [result,secondary];
  })};
}
export function setupDrumKit(assets:Map<string,AudioAsset>,changed:(refreshTracker?:boolean)=>void,audition:(role:Role)=>Promise<void>,getBpm:()=>number,browse?:(role:Role,opener:HTMLElement)=>void,recordUsed?:(id:string)=>void){
  const kit:DrumKit={},mix=defaultKitState(),root=document.getElementById('drum-slots')!;
  let context:AudioContext|undefined;
  const refreshers:(()=>void)[]=[],cancellers:(()=>void)[]=[];let pending=0;
  const loaders=new Map<Role, (id:string)=>Promise<void>>();
  for(const role of ROLES){
    const card=document.createElement('div');card.className='drum-slot';card.dataset.role=role;
    const title=document.createElement('h3');title.textContent={kick:'Kick',snare:'Snare',hat:'Hi-hat',percussion:'Percussion'}[role];
    const makeLabel=(text:string,node:HTMLElement)=>{const l=document.createElement('label');l.textContent=text;if(node instanceof HTMLInputElement||node instanceof HTMLSelectElement)node.setAttribute('aria-label',`${text} for ${title.textContent}`);l.append(node);return l;};
    const checkbox=(id:string,text:string)=>{const i=document.createElement('input');i.type='checkbox';i.id=id;const l=makeLabel(text,i);l.className='loop-label';return {i,l};};
    const include=checkbox('kit-include-'+role,'Generate notes'),mute=checkbox('kit-mute-'+role,'Mute audio'),solo=checkbox('kit-solo-'+role,'Solo audio');
    include.i.title='Use this lane when generating a new pattern. Existing notes stay unchanged.';mute.i.title='Silence this lane in pattern/song playback and WAV exports. Instrument Preview still lets you hear it.';solo.i.title='Solo this lane in playback and export.';
    const choice=document.createElement('select');choice.id='kit-choice-'+role;
    choice.className='sound-select';
    const lofiList=LIBRARY.filter(s=>s.role===role&&s.id.startsWith('lofi2-')&&!isVinylTexture(s.id)).map(s=>[s.id,s.name] as [string,string]);
    const acousticList=LIBRARY.filter(s=>s.role===role&&s.id.startsWith('acoustic-')).map(s=>[s.id,s.name] as [string,string]);
    const tr808List=LIBRARY.filter(s=>s.role===role&&s.id.startsWith('808-')).map(s=>[s.id,s.name] as [string,string]);
    const udnbList=LIBRARY.filter(s=>s.role===role&&s.id.startsWith('udnb-')).map(s=>[s.id,s.name] as [string,string]);
    const otherList=LIBRARY.filter(s=>s.role===role&&!s.id.startsWith('lofi2-')&&!s.id.startsWith('acoustic-')&&!s.id.startsWith('808-')&&!s.id.startsWith('udnb-')).map(s=>[s.id,s.name] as [string,string]);
    const builtInList: [string, string][] = [['synth','Synthesized '+title.textContent]];
    const featured=KIT_PRESETS.flatMap(p=>p.slots[role]).filter((id,index,all)=>id!=='synth'&&all.indexOf(id)===index);
    const featuredList=featured.map(id=>LIBRARY.find(s=>s.id===id&&s.role===role)).filter((s):s is (typeof LIBRARY)[number]=>!!s).map(s=>[s.id,s.name] as [string,string]);
    const soundGroups: [string, [string, string][]][] = [
      ['Built-in Synthesizers', builtInList],
      ['Featured in kits', featuredList],
      ['Lo-Fi Hip-Hop Vol. 2', lofiList],
      ['Acoustic & Studio Classics', acousticList],
      ['Roland TR-808 Vintage', tr808List],
      ['UDNB Collection (Jungle / DnB)', udnbList],
    ];
    if(otherList.length) soundGroups.push(['Other Library Samples', otherList]);
    soundGroups.push(['Your Sample', [['upload','My upload']]]);
    for(const [label,entries] of soundGroups){if(!entries.length)continue;const group=document.createElement('optgroup');group.label=label;for(const [value,text] of entries){const o=document.createElement('option');o.value=value;o.textContent=text;group.append(o);}choice.append(group);}
    const navRow=document.createElement('div');navRow.className='sound-nav-row';
    const prevBtn=document.createElement('button');prevBtn.type='button';prevBtn.className='sound-nav-btn sound-prev-btn';prevBtn.textContent='◀';prevBtn.title='Previous sound ('+title.textContent+')';prevBtn.setAttribute('aria-label','Previous sound for '+title.textContent);
    const nextBtn=document.createElement('button');nextBtn.type='button';nextBtn.className='sound-nav-btn sound-next-btn';nextBtn.textContent='▶';nextBtn.title='Next sound ('+title.textContent+')';nextBtn.setAttribute('aria-label','Next sound for '+title.textContent);
    const stepChoice=(delta:number)=>{const options=Array.from(choice.querySelectorAll('option')).filter(o=>!o.disabled&&o.value!=='upload');if(!options.length)return;const curIdx=options.findIndex(o=>o.value===choice.value);let nextIdx=(curIdx+delta)%options.length;if(nextIdx<0)nextIdx+=options.length;choice.value=options[nextIdx]!.value;choice.dispatchEvent(new Event('change'));setTimeout(()=>{void audition(role).catch(()=>{});},30);};
    prevBtn.onclick=(e)=>{e.preventDefault();stepChoice(-1);};nextBtn.onclick=(e)=>{e.preventDefault();stepChoice(1);};
    navRow.append(prevBtn,choice,nextBtn);
    const browseBtn=document.createElement('button');browseBtn.type='button';browseBtn.className='sound-browse-btn';browseBtn.textContent='Browse sounds';browseBtn.id='kit-browse-'+role;browseBtn.onclick=()=>browse?.(role,browseBtn);navRow.append(browseBtn);
    const soundContainer=document.createElement('label');soundContainer.className='sound-select-label';soundContainer.textContent='Sound';soundContainer.append(navRow);
    const file=document.createElement('input');file.type='file';file.accept='.wav,audio/wav';file.id='kit-file-'+role;file.className='sample-file-input';file.setAttribute('aria-label','Upload '+title.textContent+' WAV');
    const upload=document.createElement('button');upload.id='kit-upload-'+role;upload.textContent='Upload WAV';upload.onclick=()=>file.click();
    const level=document.createElement('input');level.type='range';level.min='0';level.max='1';level.step='.01';level.id='kit-level-'+role;
    const tune=document.createElement('input');tune.type='number';tune.min='-24';tune.max='24';tune.step='1';tune.id='kit-tune-'+role;
    const info=document.createElement('p');info.id='kit-info-'+role;info.setAttribute('role','status');
    const play=document.createElement('button');play.textContent='Preview';play.id='kit-play-'+role;
    const openSlicer=document.createElement('button');openSlicer.type='button';openSlicer.id='kit-open-slicer-'+role;openSlicer.textContent='Chop a break';openSlicer.title='Open the waveform slicer to isolate a hit from an imported break.';
    const clear=document.createElement('button');clear.textContent='Remove upload';clear.id='kit-remove-'+role;
    const heading=document.createElement('div');heading.className='sound-heading';const badge=document.createElement('span');badge.id='kit-badge-'+role;badge.className='sound-badge';heading.append(title,badge);
    const actions=document.createElement('div');actions.className='sound-actions';actions.append(play,upload,openSlicer,clear,file);
    const routing=document.createElement('div');routing.className='sound-routing';routing.append(include.l,mute.l,solo.l);
    const gainLabel=makeLabel('Level',level),gainValue=document.createElement('output');gainValue.id='kit-level-value-'+role;gainValue.htmlFor=level.id;gainLabel.prepend(gainValue);
    const shape=document.createElement('details');shape.className='tone-panel';shape.id='kit-shape-'+role;const shapeSummary=document.createElement('summary');shapeSummary.textContent='Pitch & playback';shape.append(shapeSummary);
    const reverse=checkbox('kit-reverse-'+role,'Reverse all hits in this lane');
    const decay=document.createElement('input');decay.type='range';decay.min='0.05';decay.max='1';decay.step='0.01';decay.id='kit-decay-'+role;
    const decayLabel=makeLabel('Decay / Tightness',decay),decayValue=document.createElement('output');decayValue.id='kit-decay-value-'+role;decayValue.htmlFor=decay.id;decayLabel.prepend(decayValue);
    const sampleControl=(key:string,label:string,min:number,max:number,step:number)=>{
      const field=document.createElement('input');field.type='range';field.min=String(min);field.max=String(max);field.step=String(step);field.id='kit-'+key+'-'+role;
      const output=document.createElement('output');output.id=field.id+'-value';output.htmlFor=field.id;
      const wrapper=makeLabel(label,field);wrapper.prepend(output);return {field,output,wrapper};
    };
    const speed=sampleControl('speed','Speed (0.5×–2×)',.5,2,.01);
    const speedMode=document.createElement('select');speedMode.id='kit-speed-mode-'+role;
    speedMode.append(new Option('Repitch (changes pitch)','repitch'),new Option('Preserve pitch (stretch)','stretch'));
    const lowpass=sampleControl('lowpass','Low-pass tone',200,20000,100);
    const attack=sampleControl('attack','Attack (ms)',0,50,1);
    const sourceBpm=document.createElement('input');sourceBpm.type='number';sourceBpm.id='kit-source-bpm-'+role;sourceBpm.min='40';sourceBpm.max='300';sourceBpm.step='.1';sourceBpm.placeholder='Original BPM';
    const matchBpm=document.createElement('button');matchBpm.type='button';matchBpm.id='kit-match-bpm-'+role;matchBpm.textContent='Match BPM once';matchBpm.title='Set manual speed to current BPM ÷ original BPM once.';
    const followBpm=checkbox('kit-follow-bpm-'+role,'Follow BPM as tempo changes');
    const tempoInfo=document.createElement('p');tempoInfo.id='kit-tempo-info-'+role;tempoInfo.className='sample-tempo-info';tempoInfo.setAttribute('role','status');
    shape.append(makeLabel('Lane pitch (semitones)',tune),makeLabel('Speed mode',speedMode),speed.wrapper,makeLabel('Original break BPM',sourceBpm),matchBpm,followBpm.l,tempoInfo,lowpass.wrapper,attack.wrapper,decayLabel,reverse.l);
    const layerPanel=document.createElement('details');layerPanel.className='tone-panel';layerPanel.id='kit-layer-'+role;
    const layerHeading=document.createElement('summary');layerHeading.textContent='Layer a second sound';layerPanel.append(layerHeading);
    const layerChoice=document.createElement('select');layerChoice.id='kit-layer-choice-'+role;
    layerChoice.append(new Option('None','none'),new Option('My upload','upload'));
    for(const item of LIBRARY.filter(s=>s.role===role&&!isVinylTexture(s.id)))layerChoice.append(new Option(item.name,item.id));
    const layerLevel=sampleControl('layer-level','Layer level',0,1,.01);
    const layerOffset=document.createElement('input');layerOffset.type='number';layerOffset.id='kit-layer-offset-'+role;layerOffset.min='-10';layerOffset.max='10';layerOffset.step='.1';
    const layerInvert=checkbox('kit-layer-invert-'+role,'Invert layer polarity');
    const layerStatus=document.createElement('p');layerStatus.id='kit-layer-status-'+role;layerStatus.className='sample-tempo-info';layerStatus.setAttribute('role','status');
    layerPanel.append(makeLabel('Layer sound',layerChoice),layerLevel.wrapper,makeLabel('Offset (ms)',layerOffset),layerInvert.l,layerStatus);
    card.append(heading,soundContainer,info,actions,routing,gainLabel,shape,layerPanel);root.append(card);
    const fx=document.createElement('details');fx.className='effects-panel';fx.id='effects-'+role;const summary=document.createElement('summary');summary.textContent='Effects';fx.append(summary);
    const bypass=checkbox('fx-bypass-'+role,'Bypass effects');fx.append(bypass.l);
    const effectInputs=new Map<keyof Effects,HTMLInputElement>();
    for(const [key,name,min,max,step] of [['highpass','High-pass (Hz)',0,2000,10],['lowpass','Low-pass (Hz)',200,20000,100],['resonance','Resonance / Q (0–1)',0,1,.05],['punch','Punch attack (0–1)',0,1,.05],['drive','Drive (0–1)',0,1,.05],['delayMs','Delay time (ms)',30,1000,10],['feedback','Feedback (0–0.75)',0,.75,.05],['mix','Delay mix (0–0.6)',0,.6,.05],['wet','FX Wet / Dry (0–1)',0,1,.05]] as const){
        const field=document.createElement('input');field.type='range';field.min=String(min);field.max=String(max);field.step=String(step);field.id='fx-'+key+'-'+role;effectInputs.set(key,field);
        const l=makeLabel(name,field);const out=document.createElement('output');out.id='fx-'+key+'-val-'+role;out.htmlFor=field.id;l.prepend(out);fx.append(l);
        const commit=()=>{const next={...(mix[role].effects??defaultEffects()),[key]:Number(field.value)};try{validateEffects(next);mix[role].effects=next;update();changed();}catch(e){update();info.textContent=String(e);}};
        field.oninput=()=>{out.textContent=key==='wet'?Math.round(Number(field.value)*100)+'%':field.value;};field.onchange=commit;
    }
    card.append(fx);reverse.i.onchange=()=>{mix[role].reverse=reverse.i.checked;update();changed();};
    decay.oninput=()=>{mix[role].decay=Number(decay.value);rememberShape(mix[role]);update();changed();};
    speed.field.oninput=()=>{mix[role].playbackRate=Number(speed.field.value);mix[role].followBpm=false;rememberShape(mix[role]);update();changed(false);};
    speedMode.onchange=()=>{mix[role].speedMode=speedMode.value as 'repitch'|'stretch';rememberShape(mix[role]);update();changed(false);};
    let layerRequest=0;
    layerChoice.onchange=async()=>{
      const selection=layerChoice.value,request=++layerRequest;
      if(selection==='none'){delete mix[role].layer;update();changed(false);return;}
      layerStatus.textContent='Loading layer…';
      try{
        let asset:AudioAsset;
        if(selection==='upload'){
          const uploadId=mix[role].uploadId;
          if(!uploadId||!assets.has(uploadId))throw Error('Upload a sound to this lane first.');
          asset=assets.get(uploadId)!;
        }else{context??=new AudioContext();asset=await ensureLibraryAudio(selection,role,assets,context);}
        if(request!==layerRequest)return;
        mix[role].layer={choice:selection,slice:{assetId:asset.id,startFrame:0,endFrame:asset.channels[0]!.length,sampleRate:asset.sampleRate,label:asset.name},level:.5,offsetMs:0,phaseInvert:false};
        update();changed(false);
      }catch(error){if(request===layerRequest){update();layerStatus.textContent=String(error)+' Previous layer kept.';}}
    };
    layerLevel.field.oninput=()=>{if(!mix[role].layer)return;mix[role].layer!.level=Number(layerLevel.field.value);update();changed(false);};
    layerOffset.onchange=()=>{if(!mix[role].layer)return;const value=Number(layerOffset.value);if(!Number.isFinite(value)||value< -10||value>10){update();return;}mix[role].layer!.offsetMs=value;update();changed(false);};
    layerInvert.i.onchange=()=>{if(!mix[role].layer)return;mix[role].layer!.phaseInvert=layerInvert.i.checked;update();changed(false);};
    lowpass.field.oninput=()=>{mix[role].lowpassHz=Number(lowpass.field.value);rememberShape(mix[role]);update();changed();};
    attack.field.oninput=()=>{mix[role].attackMs=Number(attack.field.value);rememberShape(mix[role]);update();changed();};
    sourceBpm.onchange=()=>{const bpm=Number(sourceBpm.value);if(sourceBpm.value!==''&&(!Number.isFinite(bpm)||bpm<40||bpm>300)){update();tempoInfo.textContent='Original break BPM must be 40–300.';return;}const next=sourceBpm.value===''?undefined:bpm;if(mix[role].sourceBpm===next)return;mix[role].sourceBpm=next;if(next===undefined)mix[role].followBpm=false;rememberShape(mix[role]);update();changed(false);};
    followBpm.i.onchange=()=>{const source=Number(sourceBpm.value);if(followBpm.i.checked&&(!sourceBpm.value||!Number.isFinite(source)||source<40||source>300)){followBpm.i.checked=false;tempoInfo.textContent='Enter the original break BPM (40–300) first.';return;}mix[role].sourceBpm=sourceBpm.value?source:undefined;mix[role].followBpm=followBpm.i.checked;rememberShape(mix[role]);update();changed();};
    matchBpm.onclick=()=>{const source=Number(sourceBpm.value),target=getBpm(),ratio=target/source;
      if(!Number.isFinite(source)||source<40||source>300||!Number.isFinite(target)||ratio<.5||ratio>2){info.textContent='Enter the original break BPM. Matching must result in 0.5×–2× speed.';return;}
      mix[role].sourceBpm=source;mix[role].playbackRate=Math.round(ratio*100)/100;mix[role].followBpm=false;rememberShape(mix[role]);update();changed();
    };
    bypass.i.onchange=()=>{mix[role].effects={...(mix[role].effects??defaultEffects()),bypass:bypass.i.checked};update();changed();};
    let token=0,loading=false;
    const update=()=>{
      play.disabled=loading;upload.disabled=loading;card.setAttribute('aria-busy',String(loading));
      const slot=mix[role];
      const asset=slot.assetId?assets.get(slot.assetId):undefined;
      const layer=slot.layer,layerAsset=layer?assets.get(layer.slice.assetId):undefined;
      layerChoice.value=layer?.choice??'none';(layerChoice.querySelector('option[value="upload"]') as HTMLOptionElement).disabled=!slot.uploadId;
      layerLevel.field.disabled=!layer;layerLevel.field.value=String(layer?.level??.5);layerLevel.output.textContent=Math.round((layer?.level??.5)*100)+'%';
      layerOffset.disabled=!layer;layerOffset.value=String(layer?.offsetMs??0);layerInvert.i.disabled=!layer;layerInvert.i.checked=!!layer?.phaseInvert;
      if(layer&&asset&&layerAsset){const check=assessLayerMono(asset,layerAsset,layer.level,layer.offsetMs,layer.phaseInvert);layerStatus.textContent=check.warning?`Mono cancellation: ${check.monoLossDb.toFixed(1)} dB. Try polarity or offset.`:`Mono check: ${check.monoLossDb.toFixed(1)} dB vs. strongest sound.`;layerStatus.classList.toggle('warning',check.warning);}
      else{layerStatus.textContent=layer?'Layer ready. Add a primary sound to assess mono compatibility.':'No second sound.';layerStatus.classList.remove('warning');}
      if(asset)kit[role]={assetId:asset.id,startFrame:0,endFrame:asset.channels[0]!.length,sampleRate:asset.sampleRate,label:asset.name};else delete kit[role];
      reverse.i.checked=!!slot.reverse;const effects=slot.effects??defaultEffects();bypass.i.checked=effects.bypass;for(const [key,field] of effectInputs){field.value=String(effects[key] ?? (key==='wet'?1:0));const out=document.getElementById('fx-'+key+'-val-'+role);if(out)out.textContent=key==='wet'?Math.round(Number(field.value)*100)+'%':field.value;}
      choice.value=slot.choice;include.i.checked=slot.include;mute.i.checked=slot.mute;solo.i.checked=!!slot.solo;level.value=String(slot.level);tune.value=String(slot.tune);
      decay.value=String(slot.decay??1);decayValue.textContent=(slot.decay!==undefined&&slot.decay<1)?Math.round(slot.decay*100)+'% (Tight)':'100% (Natural)';
      const tempo=getBpm(),effective=effectiveSampleSpeed(slot,tempo);
      speed.field.value=String(slot.playbackRate??1);speed.output.textContent=(slot.playbackRate??1).toFixed(2)+'× manual';
      speedMode.value=slot.speedMode??'repitch';
      followBpm.i.checked=!!slot.followBpm;
      tempoInfo.textContent=effective.warning??(effective.following?`Following ${tempo.toFixed(1)} BPM · ${effective.rate.toFixed(2)}× ${slot.speedMode==='stretch'?'stretch':'repitch'}`:'Manual speed');
      tempoInfo.classList.toggle('warning',!!effective.warning);
      lowpass.field.value=String(slot.lowpassHz??20000);lowpass.output.textContent=(slot.lowpassHz??20000)>=20000?'Open':Math.round(slot.lowpassHz!)+' Hz';
      attack.field.value=String(slot.attackMs??0);attack.output.textContent=(slot.attackMs??0)+' ms';sourceBpm.value=slot.sourceBpm===undefined?'':String(slot.sourceBpm);
      (choice.querySelector('option[value="upload"]') as HTMLOptionElement).disabled=!slot.uploadId;
      clear.disabled=!slot.uploadId;clear.hidden=!slot.uploadId;upload.textContent=slot.uploadId?'Replace WAV':'Upload WAV';
      (choice.querySelector('option[value="upload"]') as HTMLOptionElement).textContent=slot.uploadId?(assets.get(slot.uploadId)?.name??'My upload'):'Upload a WAV to use here';
      gainValue.textContent=Math.round(slot.level*100)+'%';
      const hasFx=effects.highpass>0||effects.lowpass<20000||(effects.resonance??0)>0||(effects.punch??0)>0||effects.drive>0||effects.mix>0;const active=[effects.highpass>0?'High-pass':'',effects.lowpass<20000?'Low-pass':'',(effects.resonance??0)>0?'Resonance':'',(effects.punch??0)>0?'Punch':'',effects.drive>0?'Drive':'',effects.mix>0?'Delay':'',(hasFx&&(effects.wet??1)<1)?Math.round((effects.wet??1)*100)+'% Wet':''].filter(Boolean);
      summary.textContent=effects.bypass?'Effects · bypassed':active.length?'Effects · '+active.join(' + '):'Effects · off';
      badge.textContent=slot.mute?'Muted':slot.solo?'Solo':effects.bypass?'FX bypassed':active.length?'FX on':'Dry';badge.classList.toggle('active',!slot.mute&&!effects.bypass&&active.length>0);badge.title=slot.mute?'Muted in playback and export':summary.textContent;
      shapeSummary.textContent='Pitch & sample shape'+(slot.tune?' · '+(slot.tune>0?'+':'')+slot.tune+' st':'')+(slot.followBpm?' · BPM follow':(slot.playbackRate??1)!==1?' · '+(slot.playbackRate??1).toFixed(2)+'×':'')+(slot.speedMode==='stretch'?' · Pitch preserved':'')+((slot.decay??1)<1?' · Decay '+Math.round((slot.decay??1)*100)+'%':'')+(slot.reverse?' · Reverse':'');
      card.classList.toggle('audio-muted',slot.mute);card.classList.toggle('audio-soloed',!!slot.solo);card.classList.toggle('generation-off',!slot.include);
      info.textContent=(asset?asset.name:'Synthesized '+role)+' · '+Math.round(slot.level*100)+'%'+((slot.decay??1)<1?' · Decay '+Math.round((slot.decay??1)*100)+'%':'')+(slot.reverse?' · Reverse':'')+(slot.solo?' · Solo':'')+(slot.mute?' · Muted':'');
    };
    refreshers.push(update);cancellers.push(()=>{token++;loading=false;});update();
    include.i.onchange=()=>{mix[role].include=include.i.checked;update();changed();};
    mute.i.onchange=()=>{mix[role].mute=mute.i.checked;update();changed();};
    solo.i.onchange=()=>{mix[role].solo=solo.i.checked;update();changed();};
    level.oninput=()=>{mix[role].level=Number(level.value);update();changed();};
    tune.onchange=()=>{const v=Number(tune.value);if(!Number.isInteger(v)||v< -24||v>24){update();return;}mix[role].tune=v;update();changed();};
    async function decode(bytes:ArrayBuffer,name:string,id:string){
      const meta=validateWav(bytes);if(meta.duration>20)throw Error('Single hits must be 20 seconds or shorter.');
      context??=new AudioContext();const decoded=await context.decodeAudioData(bytes);
      let channels:Float32Array[]=Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i));
      const used=[...assets.values()].reduce((n,a)=>n+a.channels.reduce((v,c)=>v+c.byteLength,0),0);
      if(used+channels.reduce((n,c)=>n+c.byteLength,0)>256*1024*1024)throw Error('Session audio limit reached. Save project before refreshing.');
      return {id,name,sampleRate:decoded.sampleRate,channels};
    }
    choice.onchange=async()=>{
      const value=choice.value,request=++token;pending++;loading=true;update();info.textContent='Loading sound…';
      try{
        let id:string|undefined;
        if(value==='upload'){id=mix[role].uploadId;if(!id||!assets.has(id))throw Error('Upload a WAV first.');}
        else if(value!=='synth'){
          context??=new AudioContext();const a=await ensureLibraryAudio(value,role,assets,context);id=a.id;
        }
        if(request!==token)return;rememberShape(mix[role]);mix[role].choice=value;mix[role].assetId=id;recallShape(mix[role]);update();recordUsed?.(value);changed();
      }catch(e){if(request===token){update();const msg=e instanceof TypeError&&e.message.includes('fetch')?'Server unreachable. Ensure local server is running.':String(e);info.textContent=msg+' Previous sound kept.';}}finally{pending--;if(request===token){loading=false;play.disabled=false;upload.disabled=false;card.setAttribute('aria-busy','false');}}
    };
    file.onchange=async()=>{
      const next=file.files?.[0];file.value='';if(!next)return;const request=++token;pending++;loading=true;update();info.textContent='Loading locally…';
      try{
        if(next.size>20*1024*1024)throw Error('Choose a hit under 20 MB.');
        const a=await decode(await next.arrayBuffer(),next.name,crypto.randomUUID());if(request!==token)return;assets.set(a.id,a);
        rememberShape(mix[role]);mix[role].uploadId=a.id;mix[role].assetId=a.id;mix[role].choice='upload';recallShape(mix[role]);
        if(mix[role].layer?.choice==='upload')mix[role].layer!.slice={assetId:a.id,startFrame:0,endFrame:a.channels[0]!.length,sampleRate:a.sampleRate,label:a.name};
        update();changed();
      }catch(e){if(request===token){update();info.textContent=String(e)+' Previous instrument kept.';}}finally{pending--;if(request===token){loading=false;play.disabled=false;upload.disabled=false;card.setAttribute('aria-busy','false');}}
    };
    play.onclick=()=>{void audition(role).catch(e=>info.textContent=String(e));};
    openSlicer.onclick=()=>{const tab=document.getElementById('tab-slicer') as HTMLButtonElement|null;const panel=card.closest('details.track-instrument-panel');if(panel)(panel as HTMLDetailsElement).open=false;if(tab){tab.hidden=false;tab.parentElement?.classList.add('slicer-revealed');tab.click();document.getElementById('tray-bottom')?.scrollIntoView({behavior:'smooth',block:'start'});}};
    clear.onclick=()=>{token++;loading=false;const slot=mix[role];rememberShape(slot);slot.uploadId=undefined;if(slot.choice==='upload'){slot.choice='synth';slot.assetId=undefined;recallShape(slot);}if(slot.layer?.choice==='upload')delete slot.layer;update();changed();};
    loaders.set(role, async(soundId:string)=>{choice.value=soundId;await choice.onchange!(new Event('change'));});
  }
  return {
    kit,mix,get busy(){return pending>0;},snapshot:()=>structuredClone(mix),refreshTempo:()=>refreshers.forEach(f=>f()),
    restore:(state:KitState)=>{cancellers.forEach(f=>f());for(const r of ROLES)mix[r]=structuredClone(state[r]);refreshers.forEach(f=>f());},
    selectSound:async(role:Role,soundId:string)=>{const load=loaders.get(role);if(!load)throw Error('Unknown instrument.');await load(soundId);if(mix[role].choice!==soundId)throw Error(document.getElementById('kit-info-'+role)?.textContent?.replace(' Previous sound kept.','')||'Sound could not be selected.');},
    applyPreset: async(presetId:string)=>{
      const preset=KIT_PRESETS.find(p=>p.id===presetId);
      if(!preset) return;
      for(const r of ROLES){
        if(preset.levels?.[r]!==undefined)mix[r].level=preset.levels[r]!;
        const load=loaders.get(r);if(load)await load(preset.slots[r]);
        if(preset.decays?.[r]!==undefined){mix[r].decay=preset.decays[r]!;rememberShape(mix[r]);}
      }
    }
  };
}
