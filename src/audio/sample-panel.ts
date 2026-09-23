import {gridMarkers,transientMarkers,moveMarker} from './chop.js';
import {validateWav,encodeWav} from './wav.js';
import {downloadBytes} from './render.js';
export function setupSamplePanel(stopPattern:()=>void){
  const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
  const button=(id:string)=>el<HTMLButtonElement>(id);
  const seek=el<HTMLInputElement>('sample-seek'),canvas=el<HTMLCanvasElement>('waveform');
  let context:AudioContext|undefined,buffer:AudioBuffer|undefined,source:AudioBufferSourceNode|undefined;
  let assetId='';
  let filename='',offset=0,started=0,raf=0,request=0,playRequest=0;
  let markers:number[]=[],selected=0,drag=-1,dragBefore:number[]=[];
  let past:number[][]=[],future:number[][]=[],sliceEnd:number|undefined,gain:GainNode|undefined;
  const field=el<HTMLFieldSetElement>('chop-controls');
  const peaks:number[][]=[];
  const position=()=>source&&context&&buffer?(sliceEnd!==undefined?Math.min(sliceEnd,offset+context.currentTime-started):source.loop?(offset+context.currentTime-started)%buffer.duration:Math.min(buffer.duration,offset+context.currentTime-started)):offset;
  const message=(s:string)=>{el('sample-status').textContent=s;};
  function draw(){
    const width=canvas.clientWidth,height=160,dpr=devicePixelRatio||1;
    canvas.width=Math.round(width*dpr);canvas.height=height*dpr;
    const ctx=canvas.getContext('2d')!;ctx.scale(dpr,dpr);ctx.fillStyle='#101a25';ctx.fillRect(0,0,width,height);
    if(!buffer){ctx.fillStyle='#a7b6c6';ctx.font='14px Segoe UI';ctx.fillText('Import a WAV to see its waveform',16,84);return;}
    const lane=height/buffer.numberOfChannels;ctx.strokeStyle='#9fd8b0';ctx.lineWidth=1;
    for(let c=0;c<peaks.length;c++){
      ctx.beginPath();const data=peaks[c]!;
      for(let i=0;i<data.length/2;i++){const x=i/(data.length/2)*width;ctx.moveTo(x,(c+.5)*lane-data[i*2]!*lane*.44);ctx.lineTo(x,(c+.5)*lane-data[i*2+1]!*lane*.44);}ctx.stroke();
    }
    if(markers.length){
      ctx.fillStyle='#a9d8ff22';ctx.fillRect(markers[selected]!/buffer.length*width,0,(markers[selected+1]!-markers[selected]!)/buffer.length*width,height);
      for(let i=0;i<markers.length;i++){const x=markers[i]!/buffer.length*width;ctx.fillStyle=i===selected?'#ffcf78':'#a9d8ff';ctx.fillRect(x,0,2,height);if(i<markers.length-1){ctx.font='11px Segoe UI';ctx.fillText(String(i+1),x+4,13);}}
    }
    const current=position();ctx.fillStyle='#fff';ctx.fillRect(current/buffer.duration*width,0,2,height);
    seek.value=String(current);el('sample-time').textContent=`${current.toFixed(2)} / ${buffer.duration.toFixed(2)} s`;
  }
  function stop(reset=false){
    playRequest++;
    offset=reset?0:position();if(source){source.onended=null;source.stop();source.disconnect();source=undefined;}
    gain?.disconnect();gain=undefined;sliceEnd=undefined;cancelAnimationFrame(raf);button('sample-play').textContent='Play sample';draw();
  }
  async function play(){
    if(!buffer)return;if(source){stop();return;}
    stopPattern();const token=++playRequest;context??=new AudioContext();await context.resume();if(token!==playRequest||!buffer)return;
    source=context.createBufferSource();source.buffer=buffer;source.loop=el<HTMLInputElement>('sample-loop').checked;
    source.connect(context.destination);started=context.currentTime;source.start(0,offset>=buffer.duration?0:offset);
    source.onended=()=>{source?.disconnect();source=undefined;offset=0;cancelAnimationFrame(raf);button('sample-play').textContent='Play sample';draw();};
    button('sample-play').textContent='Pause sample';
    const tick=()=>{draw();if(source)raf=requestAnimationFrame(tick);};tick();
  }
  async function load(file:File){
    const token=++request;message('Reading WAV locally…');
    try{
      if(file.size>50*1024*1024)throw new Error('Choose a WAV smaller than 50 MB.');
      const bytes=await file.arrayBuffer();const info=validateWav(bytes);
      context??=new AudioContext();const decoded=await context.decodeAudioData(bytes);
      if(token!==request)return;
      stopPattern();stop(true);buffer=decoded;assetId=crypto.randomUUID();filename=file.name;peaks.length=0;markers=[0,buffer.length];selected=0;past=[];future=[];field.disabled=false;renderSlices();
      for(let c=0;c<buffer.numberOfChannels;c++){
        const data=buffer.getChannelData(c),values:number[]=[],bins=Math.min(1600,data.length);
        for(let bin=0;bin<bins;bin++){let min=1,max=-1;for(let i=Math.floor(bin*data.length/bins);i<Math.floor((bin+1)*data.length/bins);i++){min=Math.min(min,data[i]!);max=Math.max(max,data[i]!);}values.push(max,min);}peaks.push(values);
      }
      seek.max=String(buffer.duration);seek.disabled=false;
      for(const id of ['sample-play','sample-stop','sample-remove','sample-export'])button(id).disabled=false;
      el('sample-meta').textContent=`${filename} · ${info.duration.toFixed(2)} s · ${info.sampleRate.toLocaleString()} Hz source · ${info.channels===1?'Mono':'Stereo'}`;
      message('Ready to chop. Autochop detects attacks or divides an equal grid; audition and adjust slices before arranging.');draw();
    }catch(e){if(token===request)message((e as Error).message+' Your previous sample is kept.');}
  }
  el<HTMLInputElement>('sample-file').onchange=e=>{const input=e.target as HTMLInputElement;const file=input.files?.[0];if(file)void load(file);input.value='';};
  const drop=el('sample-drop');drop.ondragover=e=>{e.preventDefault();drop.classList.add('dragging');};drop.ondragleave=()=>drop.classList.remove('dragging');
  drop.ondrop=e=>{e.preventDefault();drop.classList.remove('dragging');const file=e.dataTransfer?.files[0];if(file)void load(file);};
  button('sample-play').onclick=()=>{play().catch(e=>message(String(e)));};button('sample-stop').onclick=()=>stop(true);
  el<HTMLInputElement>('sample-loop').onchange=()=>{if(source&&sliceEnd===undefined)source.loop=el<HTMLInputElement>('sample-loop').checked;};
  seek.oninput=()=>{const resume=!!source;const value=Number(seek.value);stop();offset=value;draw();if(resume)void play();};
  button('sample-remove').onclick=()=>{request++;stop(true);buffer=undefined;markers=[];past=[];future=[];selected=0;field.disabled=true;renderSlices();filename='';peaks.length=0;seek.disabled=true;seek.value='0';el('sample-time').textContent='0.00 / 0.00 s';el('sample-meta').textContent='No sample loaded';for(const id of ['sample-play','sample-stop','sample-remove','sample-export'])button(id).disabled=true;message('Import a mono or stereo WAV. Audio stays on this device.');draw();};
  button('sample-export').onclick=()=>{if(buffer)downloadBytes(encodeWav(Array.from({length:buffer.numberOfChannels},(_,i)=>buffer!.getChannelData(i)),buffer.sampleRate),filename.replace(/\.wav$/i,'')+'-audition.wav');};
  function renderSlices(){
    const list=el('slice-list');list.replaceChildren();
    selected=Math.max(0,Math.min(selected,markers.length-2));
    for(let i=0;i<markers.length-1;i++){
      const b=document.createElement('button');b.textContent='Slice '+(i+1);b.setAttribute('aria-pressed',String(i===selected));
      b.onclick=()=>{stop();selected=i;offset=markers[i]!/buffer!.sampleRate;renderSlices();draw();};list.append(b);
    }
    button('chop-undo').disabled=!past.length;button('chop-redo').disabled=!future.length;
    button('marker-delete').disabled=!selected;button('marker-apply').disabled=!selected;
    el<HTMLInputElement>('marker-time').disabled=!selected;
    el<HTMLInputElement>('marker-time').value=buffer?(markers[selected]!/buffer.sampleRate).toFixed(6):'0';
    el('slice-info').textContent=buffer?(markers.length-1)+' slices · Selected '+(selected+1)+' · '+((markers[selected+1]!-markers[selected]!)/buffer.sampleRate).toFixed(3)+' s':'Import audio to edit slices.';
  }
  function commit(next:number[]){
    if(JSON.stringify(next)===JSON.stringify(markers))return;
    stop();past.push([...markers]);if(past.length>100)past.shift();future=[];markers=next;renderSlices();draw();
  }
  function add(frame:number){
    if(!buffer)return;
    if(markers.length>=129){message('Maximum 128 slices. Delete a marker before adding another.');return;}
    frame=Math.round(frame);if(frame<=0||frame>=buffer.length||markers.includes(frame))return;
    commit([...markers,frame].sort((a,b)=>a-b));selected=markers.indexOf(frame);renderSlices();draw();
  }
  button('autochop').onclick=()=>{
    if(!buffer)return;
    try{const next=el<HTMLSelectElement>('chop-mode').value==='grid'?gridMarkers(buffer.length,Number(el<HTMLInputElement>('chop-count').value)):transientMarkers(Array.from({length:buffer.numberOfChannels},(_,i)=>buffer!.getChannelData(i)),buffer.sampleRate,Number(el<HTMLInputElement>('chop-sensitivity').value),Number(el<HTMLInputElement>('chop-gap').value));
      commit(next);message('Autochop created '+(markers.length-1)+' slices. Audition and adjust markers; Undo slices restores your previous cuts.');
    }catch(e){message((e as Error).message);}
  };
  button('marker-add').onclick=()=>{if(buffer)add(position()*buffer.sampleRate);};
  button('marker-delete').onclick=()=>{if(selected>0)commit(markers.filter((_,i)=>i!==selected));};
  button('marker-apply').onclick=()=>{if(buffer){const t=Number(el<HTMLInputElement>('marker-time').value);if(!Number.isFinite(t)||t<0){message('Enter a valid start time.');return;}commit(moveMarker(markers,selected,t*buffer.sampleRate));}};
  button('chop-undo').onclick=()=>{if(past.length){stop();future.push([...markers]);markers=past.pop()!;renderSlices();draw();}};
  button('chop-redo').onclick=()=>{if(future.length){stop();past.push([...markers]);markers=future.pop()!;renderSlices();draw();}};
  const frameAt=(event:MouseEvent|PointerEvent)=>{const r=canvas.getBoundingClientRect();return Math.round(Math.max(0,Math.min(1,(event.clientX-r.left)/r.width))*buffer!.length);};
  canvas.ondblclick=e=>{if(buffer)add(frameAt(e));};
  canvas.onpointerdown=e=>{
    if(!buffer)return;stop();const frame=frameAt(e),tolerance=buffer.length*8/canvas.clientWidth;
    drag=markers.findIndex((p,i)=>i>0&&i<markers.length-1&&Math.abs(p-frame)<tolerance);
    if(drag>0){selected=drag;dragBefore=[...markers];canvas.setPointerCapture(e.pointerId);}
    else {selected=Math.max(0,markers.findIndex((p,i)=>i<markers.length-1&&frame>=p&&frame<markers[i+1]!));offset=frame/buffer.sampleRate;}
    renderSlices();draw();
  };
  canvas.onpointermove=e=>{if(buffer&&drag>0){markers=moveMarker(markers,drag,frameAt(e));renderSlices();draw();}};
  canvas.onpointerup=()=>{if(drag>0){const next=[...markers];markers=dragBefore;drag=-1;commit(next);}};
  canvas.onpointercancel=()=>{if(drag>0){markers=dragBefore;drag=-1;renderSlices();draw();}};
  button('slice-play').onclick=()=>{void audition().catch(e=>message(String(e)));};
  async function audition(){
    if(!buffer)return;stop();stopPattern();const token=++playRequest;
    context??=new AudioContext();await context.resume();if(token!==playRequest||!buffer)return;
    const start=markers[selected]!/buffer.sampleRate,duration=(markers[selected+1]!-markers[selected]!)/buffer.sampleRate;
    const ms=Number(el<HTMLInputElement>('slice-fade').value);
    if(!Number.isFinite(ms)||ms<0||ms>10){message('Choose an audition fade from 0 to 10 ms.');return;}
    const fade=Math.min(duration/2,ms/1000),now=context.currentTime;
    source=context.createBufferSource();source.buffer=buffer;gain=context.createGain();source.connect(gain).connect(context.destination);
    gain.gain.setValueAtTime(fade?0:1,now);if(fade){gain.gain.linearRampToValueAtTime(1,now+fade);gain.gain.setValueAtTime(1,now+duration-fade);gain.gain.linearRampToValueAtTime(0,now+duration);}
    offset=start;started=now;sliceEnd=start+duration;source.start(now,start,duration);
    source.onended=()=>{stop();offset=start;draw();};
    message('Auditioning slice '+(selected+1)+' only.');const tick=()=>{draw();if(source)raf=requestAnimationFrame(tick);};tick();
  }
  renderSlices();
  new ResizeObserver(draw).observe(canvas);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  return {stop,getAsset:()=>buffer?{id:assetId,buffer,name:filename,markers:[...markers],selected}:undefined};
}
