import {patternTicks} from '../core/meter.js';
import {noteName,type Pattern,type Settings,type SliceInstrument} from '../core/model.js';
import {transcribeBreak,type AudioAsset} from './slices.js';
import {validateWav} from './wav.js';
import {renderPerformance} from './performance.js';
import type {BreakAnalysis} from './break-analysis.js';
import {getBreakPreset, getBreakPresetAsset} from './break-presets.js';

interface Cut {frame:number;id:string;note:number;manual:boolean}
export function setupBreakPanel(options:{settings:()=>Settings;assets:Map<string,AudioAsset>;stop:()=>void;create:(pattern:Pattern)=>void;update:(instrument:SliceInstrument)=>void}){
  const dialog=document.createElement('dialog');dialog.id='break-browser';dialog.setAttribute('aria-labelledby','break-title');
  dialog.innerHTML=`<header><div><h2 id="break-title">Import break</h2><small>Slice transcription (preview) · Curated presets &amp; WAV import · Audio stays on this device</small></div><button id="break-close" aria-label="Close break editor">Close</button></header>
  <p>Select a classic break preset or choose a custom WAV. Review the detected or verified slices, audition dry playback, and create a tracker instrument.</p>
  <div class="break-preset-bar">
    <label id="break-preset-label">Break preset
      <select id="break-preset-select">
        <optgroup label="Classic Break (author re-performance)">
          <option value="think-142x" selected>Think Break (1.42x Classic) · 1 Bar · 153 BPM</option>
        </optgroup>
        <optgroup label="Acoustic Break Recreations">
          <option value="amen-classic">Amen Break · 2 Bars · 165 BPM · 16 Slices</option>
          <option value="apache-bongo">Apache Break · 2 Bars · 165 BPM · 12 Slices</option>
          <option value="funky-drummer">Funky Drummer · 2 Bars · 100 BPM · 16 Slices</option>
          <option value="hot-pants">Hot Pants · 2 Bars · 110 BPM · 12 Slices</option>
        </optgroup>
        <option value="custom">Custom WAV file…</option>
      </select>
    </label>
    <label id="break-upload-label">WAV file <input id="break-file" type="file" accept=".wav,audio/wav"></label>
  </div>
  <fieldset id="break-controls" disabled><legend>Region and detection</legend><div class="break-controls">
  <label>Start (seconds)<input id="break-start" type="number" min="0" step=".001" value="0"></label>
  <label>End (seconds)<input id="break-end" type="number" min="0" step=".001" value="0"></label>
  <button id="break-region">Apply region</button><label>Bars (4/4)<select id="break-bars"><option>1</option><option selected>2</option><option>3</option><option>4</option></select></label><output id="break-tempo"></output>
  <label>Sensitivity<input id="break-sensitivity" type="range" min="0" max="1" step=".05" value=".35"></label>
  <label>Minimum spacing (ms)<input id="break-gap" type="number" min="10" max="1000" value="35"></label>
  <button id="break-detect">Detect slices</button><button id="break-cancel" disabled>Cancel analysis</button><button id="break-reset">Reset markers</button>
  </div></fieldset>
  <canvas id="break-wave" tabindex="0" aria-label="Break waveform. Left and right select slices; Space previews; Delete removes a marker; plus and minus zoom."></canvas>
  <div class="break-controls"><label>Zoom<input id="break-zoom" type="range" min="1" max="16" step="1" value="1"></label><label>Scroll waveform<input id="break-scroll" type="range" min="0" max="1" step=".001" value="0"></label><button id="break-undo">Undo markers</button><button id="break-redo">Redo markers</button></div>
  <div id="break-slices" role="group" aria-label="Mapped slices"></div>
  <fieldset id="break-review" disabled><legend>Review</legend><div class="break-controls"><label>Selected marker (seconds)<input id="break-marker" type="number" step=".0001" min="0"></label><button id="break-move">Move marker</button><button id="break-add">Add marker</button><button id="break-delete">Delete marker</button><button id="break-preview-slice">Preview slice</button><button id="break-original">Original</button><button id="break-reconstructed">Reconstructed</button><button id="break-stop">Stop</button><label>Loop smoothing (ms)<input id="break-fade" type="number" min="0" max="10" step=".5" value="0"></label></div></fieldset>
  <p id="break-status" role="status">Choose a WAV up to 50 MB / 2 minutes or select a curated preset. Double-click the waveform to add a marker.</p>
  <footer><button id="break-create" class="accent" disabled>Create instrument &amp; pattern</button><small>Original timing · no quantization · up to 120 slices</small></footer>`;
  document.body.append(dialog);
  const el=<T extends HTMLElement>(id:string)=>dialog.querySelector<T>('#break-'+id)!;
  const input=(id:string)=>el<HTMLInputElement>(id),button=(id:string)=>el<HTMLButtonElement>(id);
  const canvas=el<HTMLCanvasElement>('wave');
  let asset:AudioAsset|undefined,editing:SliceInstrument|undefined,region:[number,number]=[0,1],cuts:Cut[]=[],selected=0;
  let past:Cut[][]=[],future:Cut[][]=[],worker:Worker|undefined,context:AudioContext|undefined,source:AudioBufferSourceNode|undefined;
  let loading=false;
  let opener:HTMLElement|undefined,serial=0,loadToken=0,playToken=0,drag=-1,before:Cut[]=[];
  const say=(message:string)=>{el('status').textContent=message;};
  const frames=()=>[...cuts.map(c=>c.frame),region[1]];
  const windowFrames=()=>{const width=(region[1]-region[0])/Number(input('zoom').value),left=region[0]+(region[1]-region[0]-width)*Number(input('scroll').value);return {left,width};};
  function stop(){playToken++;if(source){source.onended=null;source.stop();source.disconnect();source=undefined;}}
  function cancel(){worker?.terminate();worker=undefined;button('cancel').disabled=true;button('detect').disabled=!asset;}
  function save(next:Cut[]){if(JSON.stringify(next)===JSON.stringify(cuts))return;stop();cancel();past.push(structuredClone(cuts));if(past.length>100)past.shift();future=[];cuts=next;render();}
  function draw(){
    const width=Math.max(1,canvas.clientWidth),height=180,dpr=devicePixelRatio||1;
    canvas.width=Math.round(width*dpr);canvas.height=height*dpr;const ctx=canvas.getContext('2d')!;ctx.scale(dpr,dpr);ctx.fillStyle='#080d0d';ctx.fillRect(0,0,width,height);
    if(!asset)return;const view=windowFrames(),channels=asset.channels.length,lane=height/channels;
    ctx.strokeStyle='#76b8aa';
    for(let c=0;c<channels;c++){ctx.beginPath();const data=asset.channels[c]!;for(let x=0;x<width;x++){
      let min=0,max=0;const from=Math.max(0,Math.floor(view.left+x/width*view.width)),to=Math.min(data.length,Math.ceil(view.left+(x+1)/width*view.width));
      for(let f=from;f<to;f++){min=Math.min(min,data[f]!);max=Math.max(max,data[f]!);}ctx.moveTo(x,(c+.5)*lane-max*lane*.45);ctx.lineTo(x,(c+.5)*lane-min*lane*.45);
    }ctx.stroke();}
    for(let i=0;i<cuts.length;i++){const cut=cuts[i]!,x=(cut.frame-view.left)/view.width*width,end=((cuts[i+1]?.frame??region[1])-view.left)/view.width*width;
      if(i===selected){ctx.fillStyle='#00d6b522';ctx.fillRect(x,0,end-x,height);}ctx.fillStyle=cut.manual?'#ffd58a':'#9bccff';ctx.fillRect(x,0,1,height);if(x>=0&&x<width)ctx.fillText(noteName(cut.note),x+3,14);
    }
  }
  function render(){
    selected=Math.max(0,Math.min(cuts.length-1,selected));el<HTMLFieldSetElement>('controls').disabled=!asset;el<HTMLFieldSetElement>('review').disabled=!asset;
    const list=el('slices');list.replaceChildren();
    cuts.forEach((cut,i)=>{const b=document.createElement('button');b.textContent=noteName(cut.note)+' · '+(i+1);b.setAttribute('aria-pressed',String(selected===i));b.onclick=()=>{selected=i;render();};list.append(b);});
    button('detect').disabled=!asset||!!worker;button('undo').disabled=!past.length;button('redo').disabled=!future.length;button('create').disabled=loading||!asset||!cuts.length||cuts.length>120;
    button('delete').disabled=selected<=0;button('move').disabled=selected<=0;
    if(asset){input('marker').value=String(cuts[selected]!.frame/asset.sampleRate);el('tempo').textContent=(patternTicks({...options.settings(),bars:Number(input('bars').value)})/960*60*asset.sampleRate/(region[1]-region[0])).toFixed(2)+' BPM';}
    button('create').textContent=editing?'Apply slice changes':'Create instrument & pattern';draw();
  }
  const guard=(fn:()=>void)=>()=>{try{fn();}catch(error){say((error as Error).message);}};
  function newCut(frame:number):Cut{const used=new Set(cuts.map(c=>c.note));let note=0;while(used.has(note))note++;if(note>119)throw Error('Maximum 120 slices. Remove a marker or choose a shorter region.');return {frame,id:'slice-'+serial++,note,manual:true};}
  function move(frame:number){if(selected<=0||!Number.isFinite(frame))return;frame=Math.round(frame);const next=structuredClone(cuts);next[selected]!.frame=Math.max(next[selected-1]!.frame+1,Math.min((next[selected+1]?.frame??region[1])-1,frame));next[selected]!.manual=true;save(next);}
  function add(frame:number){frame=Math.round(frame);if(frame<=region[0]||frame>=region[1]||cuts.some(c=>c.frame===frame))throw Error('Choose a new position inside the region.');save([...cuts,newCut(frame)].sort((a,b)=>a.frame-b.frame));selected=cuts.findIndex(c=>c.frame===frame);render();}
  const definition=():SliceInstrument=>{if(!asset)throw Error('Import a break first.');const base=editing??transcribeBreak(asset,frames(),{...options.settings(),bars:Number(input('bars').value)}).sliceInstruments![0]!;return {...base,loopFadeMs:Number(input('fade').value),slices:cuts.map((cut,i)=>({id:cut.id,note:cut.note,startFrame:cut.frame,endFrame:cuts[i+1]?.frame??region[1]}))};};
  function pattern(){if(!asset)throw Error('Import a break first.');const p=transcribeBreak(asset,frames(),{...options.settings(),bars:Number(input('bars').value)},Number(input('fade').value));p.sliceInstruments=[definition()];p.events.forEach((hit,i)=>{hit.mapped={instrumentId:p.sliceInstruments![0]!.id,note:cuts[i]!.note};});return p;}
  async function play(kind:'original'|'reconstructed'|'slice'){
    if(!asset)return;stop();options.stop();const token=playToken;context??=new AudioContext({sampleRate:asset.sampleRate});await context.resume();if(token!==playToken||!dialog.open)return;
    let channels:Float32Array[],rate=asset.sampleRate;
    if(kind==='original')channels=asset.channels.map(c=>c.slice(...region));
    else {const p=pattern();if(kind==='slice'){p.events=[{...p.events[selected]!,baseTick:0,offsetTick:0,fineOffset:0}];}const rendered=renderPerformance(p,new Map([[asset.id,asset]]),rate,{}, {loop:kind==='reconstructed',trimSilence:true});channels=rendered.channels;}
    const buffer=context.createBuffer(channels.length,channels[0]!.length,rate);channels.forEach((c,i)=>buffer.copyToChannel(new Float32Array(c),i));source=context.createBufferSource();source.buffer=buffer;source.loop=kind!=='slice';source.connect(context.destination);source.start();say(kind==='slice'?'Previewing '+noteName(cuts[selected]!.note):kind==='original'?'Original region looping (dry).':'Reconstructed region looping (dry).');
  }
  function initialize(a:AudioAsset,instrument?:SliceInstrument){
    cancel();stop();asset=a;editing=instrument?structuredClone(instrument):undefined;region=instrument?[instrument.startFrame,instrument.endFrame]:[0,a.channels[0]!.length];serial=120;
    cuts=instrument?instrument.slices.map(s=>({frame:s.startFrame,id:s.id,note:s.note,manual:true})):[{frame:0,id:'slice-0',note:0,manual:true}];
    past=[];future=[];selected=0;input('start').value=String(region[0]/a.sampleRate);input('end').value=String(region[1]/a.sampleRate);input('zoom').value='1';input('scroll').value='0';input('fade').value=String(instrument?.loopFadeMs??0);
    for(const id of ['start','end','region'])el<HTMLInputElement>(id).disabled=!!instrument;
    el('upload-label').hidden=!!instrument;el('preset-label').hidden=!!instrument;
    if(!instrument)el<HTMLSelectElement>('preset-select').value='custom';
    render();say(instrument?'Edit markers, then Apply. Referenced slices and locked hits are protected.':a.name+' loaded. Set the region and bar count, then Detect slices.');
  }
  async function loadPreset(presetId:string){
    const preset=getBreakPreset(presetId);if(!preset)return;
    const token=++loadToken;loading=true;cancel();stop();render();say('Loading '+preset.name+'…');
    try{
      const a=await getBreakPresetAsset(preset.id,options.assets);
      if(token!==loadToken||!dialog.open)return;
      asset=a;editing=undefined;region=[0,preset.totalFrames];serial=120;
      cuts=preset.sliceMarkers.slice(0,-1).map((frame,i)=>({frame,id:'slice-'+serial++,note:i,manual:true}));
      past=[];future=[];selected=0;
      input('start').value='0';input('end').value=String(region[1]/a.sampleRate);
      input('bars').value=String(preset.bars);input('zoom').value='1';input('scroll').value='0';
      input('fade').value=String(preset.defaultFadeMs);
      for(const id of ['start','end','region'])el<HTMLInputElement>(id).disabled=false;
      el('upload-label').hidden=false;el('preset-label').hidden=false;el<HTMLSelectElement>('preset-select').value=preset.id;
      render();say(preset.name+' loaded with '+cuts.length+' curated slices. Compare Original and Reconstructed, or click Create instrument & pattern.');
    }catch(error){if(token===loadToken)say((error as Error).message);}
    finally{if(token===loadToken){loading=false;render();}}
  }
  el<HTMLSelectElement>('preset-select').onchange=()=>{
    const val=el<HTMLSelectElement>('preset-select').value;
    if(val==='custom')input('file').click();
    else void loadPreset(val);
  };
  input('file').onchange=async()=>{const file=input('file').files?.[0];if(!file)return;const token=++loadToken;loading=true;cancel();render();say('Decoding WAV locally…');try{
    if(file.size>50*1024*1024)throw Error('Choose a WAV up to 50 MB.');const bytes=await file.arrayBuffer(),info=validateWav(bytes);
    // Decode at source rate so frame coordinates and dry reconstruction remain exact.
    const offline=new OfflineAudioContext(info.channels,1,info.sampleRate),buffer=await offline.decodeAudioData(bytes);if(token!==loadToken||!dialog.open)return;
    el<HTMLSelectElement>('preset-select').value='custom';
    initialize({id:crypto.randomUUID(),name:file.name,sampleRate:buffer.sampleRate,channels:Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i))});
  }catch(error){if(token===loadToken)say((error as Error).message);}finally{if(token===loadToken){loading=false;render();}}input('file').value='';};
  button('region').onclick=guard(()=>{if(!asset)return;const start=Math.round(Number(input('start').value)*asset.sampleRate),end=Math.round(Number(input('end').value)*asset.sampleRate);if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>asset.channels[0]!.length||start>=end)throw Error('Choose a valid region inside the recording.');cancel();stop();region=[start,end];cuts=[{frame:start,id:'slice-'+serial++,note:0,manual:true}];past=[];future=[];render();say('Region updated; markers reset for this region.');});
  button('detect').onclick=guard(()=>{
    if(!asset)return;cancel();worker=new Worker(new URL('./break-analysis-worker.js',import.meta.url),{type:'module'});const active=worker;
    button('detect').disabled=true;button('cancel').disabled=false;say('Analyzing locally…');
    worker.onerror=()=>{if(worker===active){cancel();say('Analysis failed. Your previous markers are kept.');}};
    worker.onmessage=event=>{if(worker!==active)return;if(event.data.error){cancel();say(event.data.error);return;}if(!event.data.result){say('Analyzing locally… '+Math.round(event.data.progress*100)+'%');return;}
      const result=event.data.result as BreakAnalysis;cancel();if(result.overflow){say('More than 120 slices detected. Reduce sensitivity, increase spacing, or shorten the region. Previous markers kept.');return;}
      const pinned=cuts.filter(c=>c.manual),used=new Set(pinned.map(c=>c.note));
      const next=result.markers.slice(0,-1).map(frame=>{const existing=pinned.find(c=>c.frame===frame);if(existing)return {...existing};let note=0;while(used.has(note))note++;used.add(note);return {frame,id:'slice-'+serial++,note,manual:false};});
      save(next);say(next.length+' slices detected. Gold markers were reviewed and kept. Compare Original and Reconstructed before creating the pattern.');
    };
    worker.postMessage({channels:asset.channels,rate:asset.sampleRate,options:{sensitivity:Number(input('sensitivity').value),minGapMs:Number(input('gap').value),startFrame:region[0],endFrame:region[1],manualMarkers:cuts.filter(c=>c.manual).map(c=>c.frame)}});
  });
  button('cancel').onclick=()=>{cancel();say('Analysis cancelled. Previous markers kept.');};
  button('reset').onclick=()=>{save([{frame:region[0],id:'slice-'+serial++,note:0,manual:true}]);say('Markers reset. Undo markers restores them.');};
  button('undo').onclick=()=>{if(past.length){cancel();stop();future.push(structuredClone(cuts));cuts=past.pop()!;render();}};
  button('redo').onclick=()=>{if(future.length){cancel();stop();past.push(structuredClone(cuts));cuts=future.pop()!;render();}};
  button('move').onclick=guard(()=>{if(asset)move(Number(input('marker').value)*asset.sampleRate);});
  button('add').onclick=guard(()=>{if(asset)add(Number(input('marker').value)*asset.sampleRate);});
  button('delete').onclick=()=>{if(selected>0)save(cuts.filter((_,i)=>i!==selected));};
  input('zoom').oninput=draw;input('scroll').oninput=draw;input('bars').onchange=render;
  const frameAt=(e:PointerEvent|MouseEvent)=>{const rect=canvas.getBoundingClientRect(),view=windowFrames();return Math.round(view.left+Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width))*view.width);};
  canvas.ondblclick=e=>{if(asset)guard(()=>add(frameAt(e)))();};
  canvas.onpointerdown=e=>{if(!asset)return;const frame=frameAt(e),tolerance=windowFrames().width*7/canvas.clientWidth;drag=cuts.findIndex((c,i)=>i>0&&Math.abs(c.frame-frame)<=tolerance);if(drag>0){selected=drag;before=structuredClone(cuts);cancel();stop();canvas.setPointerCapture(e.pointerId);}else selected=Math.max(0,cuts.findIndex((c,i)=>frame>=c.frame&&frame<(cuts[i+1]?.frame??region[1])));render();canvas.focus();};
  canvas.onpointermove=e=>{if(drag>0){cuts[drag]!.frame=Math.max(cuts[drag-1]!.frame+1,Math.min((cuts[drag+1]?.frame??region[1])-1,frameAt(e)));cuts[drag]!.manual=true;draw();}};
  canvas.onpointerup=()=>{if(drag>0){const next=cuts;cuts=before;drag=-1;save(next);}};
  canvas.onpointercancel=()=>{if(drag>0){cuts=before;drag=-1;render();}};
  canvas.onkeydown=e=>{if(['ArrowLeft','ArrowRight',' ','Delete','+','-'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft'||e.key==='ArrowRight'){selected+=e.key==='ArrowLeft'?-1:1;render();}if(e.key===' ')void play('slice').catch(error=>say(error.message));if(e.key==='Delete')button('delete').click();if(e.key==='+'||e.key==='-'){input('zoom').value=String(Math.max(1,Math.min(16,Number(input('zoom').value)+(e.key==='+'?1:-1))));draw();}};
  for(const kind of ['original','reconstructed','slice'] as const)button(kind==='slice'?'preview-slice':kind).onclick=()=>{void play(kind).catch(error=>say(error.message));};
  button('stop').onclick=stop;
  button('create').onclick=guard(()=>{if(!asset)return;const next=pattern();options.assets.set(asset.id,asset);if(editing)options.update(next.sliceInstruments![0]!);else options.create(next);dialog.close();});
  button('close').onclick=()=>dialog.close();dialog.onclose=()=>{loadToken++;loading=false;cancel();stop();opener?.focus();};
  dialog.addEventListener('keydown',e=>e.stopPropagation());new ResizeObserver(draw).observe(canvas);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  return {open:(instrument?:SliceInstrument)=>{opener=document.activeElement as HTMLElement;options.stop();if(instrument){const a=options.assets.get(instrument.assetId);if(!a)throw Error('Missing instrument audio.');initialize(a,instrument);input('bars').value=String(options.settings().bars);el('preset-label').hidden=true;}else{el('preset-label').hidden=false;el<HTMLSelectElement>('preset-select').value='think-142x';void loadPreset('think-142x');}dialog.showModal();render();if(instrument)input('marker').focus();else el('preset-select').focus();}};
}

