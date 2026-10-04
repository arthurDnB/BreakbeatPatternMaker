import type {SynthInstrument,SynthModuleType,SynthPatch} from '../core/model.js';
import {patchFromInstrument,starterPatch,synthModule,SYNTH_MODULES,validateSynthPatch} from '../audio/modular-synth.js';
import {validateSynthInstrument} from '../audio/synth-instrument.js';

type Options={trackName:string;instrument:SynthInstrument;apply:(patch:SynthPatch)=>void;preview:(patch:SynthPatch,note?:number)=>void};
type SavedPatch={name:string;patch:SynthPatch};
const STORAGE='breakbeat-modular-patches-v1';
const savedPatches=():SavedPatch[]=>{try{const value=JSON.parse(localStorage.getItem(STORAGE)??'[]');return Array.isArray(value)?value.filter(item=>item&&typeof item.name==='string'&&item.patch).slice(0,24):[];}catch{return [];}};
const savePatches=(items:SavedPatch[])=>localStorage.setItem(STORAGE,JSON.stringify(items.slice(0,24)));

/** Dedicated keyboard-accessible patch canvas; the tracker popover stays compact. */
export function openSynthPatchEditor(options:Options):HTMLDialogElement{
  document.getElementById('synth-patch-dialog')?.remove();
  let patch=patchFromInstrument(options.instrument),active=!!options.instrument.patch;
  const check=(candidate:SynthPatch)=>{validateSynthPatch(candidate);validateSynthInstrument({...options.instrument,patch:candidate});};
  const dialog=document.createElement('dialog');dialog.id='synth-patch-dialog';dialog.className='synth-patch-dialog';
  const shell=document.createElement('div');shell.className='synth-patch-shell';
  const header=document.createElement('header');header.className='synth-patch-header';
  const title=document.createElement('div');title.innerHTML='<strong>Modular Synth</strong><small></small>';title.querySelector('small')!.textContent=options.trackName;
  const actions=document.createElement('div');actions.className='synth-patch-actions';
  const pitchSelect=document.createElement('select');pitchSelect.className='synth-preview-pitch';pitchSelect.setAttribute('aria-label','Preview pitch');
  pitchSelect.innerHTML='<option value="24">C1 (33 Hz Sub)</option><option value="36">C2 (65 Hz Bass)</option><option value="48">C3 (131 Hz Low-Mid)</option><option value="60" selected>C4 (261 Hz Mid C)</option><option value="72">C5 (523 Hz Treble)</option>';
  const isInitialBass=options.instrument.preset==='bass'||options.instrument.preset==='sub808'||options.trackName.toLowerCase().includes('bass');
  if(isInitialBass)pitchSelect.value='36';
  const preview=document.createElement('button');preview.type='button';preview.textContent='▶ Preview';preview.onclick=()=>{try{check(patch);options.preview(patch,Number(pitchSelect.value));}catch(error){showError(error);}};
  const enable=document.createElement('button');enable.type='button';enable.className='accent';enable.textContent=active?'Patch active':'Use this patch';
  const close=document.createElement('button');close.type='button';close.textContent='Close';close.onclick=()=>dialog.close();
  actions.append(pitchSelect,preview,enable,close);header.append(title,actions);
  const toolbar=document.createElement('div');toolbar.className='synth-patch-toolbar';
  const factory=document.createElement('select');factory.setAttribute('aria-label','Factory patch');
  factory.innerHTML=`<option value="">Factory starting patch…</option>
<optgroup label="Real & Acoustic Instruments">
  <option value="nylon-guitar">Nylon String Guitar</option>
  <option value="rhodes">Rhodes Electric Piano</option>
  <option value="overdrive-guitar">Overdrive Lead Guitar</option>
  <option value="upright-piano">Acoustic Upright Piano</option>
  <option value="strings">Bowed Cello / Strings</option>
  <option value="flute">Acoustic Flute</option>
  <option value="brass">Brass Section</option>
  <option value="slap-bass">Electric Slap Bass</option>
  <option value="vibraphone">Vibraphone Mallet</option>
</optgroup>
<optgroup label="Electronic & Synth Classics">
  <option value="reese">Reese Bass (DnB)</option>
  <option value="acid303">Acid 303 Bass</option>
  <option value="sub808">Sub 808 Bass</option>
  <option value="supersaw">Supersaw Anthem</option>
  <option value="warm-pad">Warm Analog Pad</option>
  <option value="bell-pluck">Bell Pluck</option>
</optgroup>
<optgroup label="Basic Starting Points">
  <option value="bass">Bass</option>
  <option value="pluck">Pluck</option>
  <option value="pad">Pad</option>
  <option value="piano">Piano (Legacy)</option>
</optgroup>`;
  const addType=document.createElement('select');addType.setAttribute('aria-label','Module to add');
  for(const [type,spec] of Object.entries(SYNTH_MODULES)){const opt=document.createElement('option');opt.value=type;opt.textContent=spec.label;opt.disabled=type==='sample'&&!options.instrument.sample&&!options.instrument.sampleBank;addType.append(opt);}
  const add=document.createElement('button');add.type='button';add.textContent='+ Add module';
  const patchName=document.createElement('input');patchName.type='text';patchName.maxLength=40;patchName.placeholder='Patch name';patchName.setAttribute('aria-label','Patch name');
  const save=document.createElement('button');save.type='button';save.textContent='Save preset';
  const recall=document.createElement('select');recall.setAttribute('aria-label','Saved patch');
  const load=document.createElement('button');load.type='button';load.textContent='Load';
  const removeSaved=document.createElement('button');removeSaved.type='button';removeSaved.textContent='Delete preset';
  toolbar.append(factory,addType,add,patchName,save,recall,load,removeSaved);
  const message=document.createElement('p');message.className='synth-patch-message';message.setAttribute('role','status');
  const layout=document.createElement('div');layout.className='synth-patch-layout';
  const viewport=document.createElement('div');viewport.className='synth-patch-viewport';viewport.tabIndex=0;viewport.setAttribute('aria-label','Synth module patch canvas');
  const stage=document.createElement('div');stage.className='synth-patch-stage';
  const wires=document.createElementNS('http://www.w3.org/2000/svg','svg');wires.classList.add('synth-patch-wires');wires.setAttribute('viewBox','0 0 1800 1100');
  stage.append(wires);viewport.append(stage);
  const sidebar=document.createElement('aside');sidebar.className='synth-patch-sidebar';
  const guide=document.createElement('p');guide.textContent='Drag from an output port to a matching input. Drag module headers to move them. Select a cable below to adjust its depth or remove it.';
  const cableList=document.createElement('div');cableList.className='synth-patch-cables';sidebar.append(guide,cableList);
  layout.append(viewport,sidebar);shell.append(header,toolbar,message,layout);dialog.append(shell);document.body.append(dialog);
  const showError=(error:unknown)=>{message.textContent=String(error);message.classList.add('error');};
  const clearError=()=>{message.textContent=active?'Patch changes are saved with this track and project.':'Preview the draft, then choose Use this patch to activate it.';message.classList.remove('error');};
  const update=(candidate:SynthPatch)=>{try{check(candidate);if(active)options.apply(candidate);patch=candidate;render();clearError();}catch(error){showError(error);}};
  enable.onclick=()=>{try{check(patch);options.apply(patch);active=true;enable.textContent='Patch active';clearError();}catch(error){showError(error);}};
  factory.onchange=()=>{
    if(!factory.value)return;
    const isBass=['bass','sub808','reese','acid303','slap-bass'].includes(factory.value);
    pitchSelect.value=isBass?'36':'60';
    const sampled=(factory.value==='piano'||factory.value==='upright-piano')&&!!(options.instrument.sample||options.instrument.sampleBank);
    update(starterPatch(factory.value,sampled?'sample':'oscillator'));
  };
  add.onclick=()=>{const candidate=structuredClone(patch),type=addType.value as SynthModuleType,id=`module-${Date.now().toString(36)}-${candidate.nodes.length}`;candidate.nodes.push(synthModule(type,id,400+(candidate.nodes.length%4)*240,550+Math.floor(candidate.nodes.length/4)*210));update(candidate);};
  const refreshSaved=()=>{recall.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Saved presets…';recall.append(placeholder);for(const item of savedPatches()){const opt=document.createElement('option');opt.value=item.name;opt.textContent=item.name;recall.append(opt);}};
  save.onclick=()=>{try{check(patch);const name=patchName.value.trim();if(!name)throw Error('Enter a patch name first.');const items=savedPatches().filter(item=>item.name!==name);items.unshift({name,patch:structuredClone(patch)});savePatches(items);refreshSaved();recall.value=name;clearError();}catch(error){showError(error);}};
  load.onclick=()=>{const item=savedPatches().find(entry=>entry.name===recall.value);if(item)update(structuredClone(item.patch));};
  removeSaved.onclick=()=>{if(!recall.value)return;savePatches(savedPatches().filter(item=>item.name!==recall.value));refreshSaved();clearError();};
  let source:{node:string;port:string}|undefined,dragLine:SVGPathElement|undefined;
  const portCentre=(node:string,port:string,direction:'in'|'out')=>{
    const element=stage.querySelector<HTMLElement>(`[data-node-id="${CSS.escape(node)}"] [data-port-direction="${direction}"][data-port="${CSS.escape(port)}"]`);
    if(!element)return {x:0,y:0};const rect=element.getBoundingClientRect(),stageRect=stage.getBoundingClientRect();
    return {x:rect.left+rect.width/2-stageRect.left,y:rect.top+rect.height/2-stageRect.top};
  };
  const route=(a:{x:number;y:number},b:{x:number;y:number})=>`M ${a.x} ${a.y} C ${a.x+Math.max(40,(b.x-a.x)*.45)} ${a.y}, ${b.x-Math.max(40,(b.x-a.x)*.45)} ${b.y}, ${b.x} ${b.y}`;
  const redrawWires=()=>{
    wires.replaceChildren();
    for(const edge of patch.cables){const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',route(portCentre(edge.from,edge.out,'out'),portCentre(edge.to,edge.input,'in')));path.classList.add(SYNTH_MODULES[patch.nodes.find(node=>node.id===edge.from)!.type].outputs[edge.out]==='control'?'control':'audio');wires.append(path);}
    if(source){dragLine=document.createElementNS('http://www.w3.org/2000/svg','path');dragLine.classList.add('drag');wires.append(dragLine);}else dragLine=undefined;
  };
  const connect=(to:string,input:string)=>{
    if(!source)return;
    const candidate=structuredClone(patch);candidate.cables.push({from:source.node,out:source.port,to,input,depth:1});source=undefined;update(candidate);
  };
  const nodeCard=(node:SynthPatch['nodes'][number])=>{
    const spec=SYNTH_MODULES[node.type],card=document.createElement('article');card.className='synth-module';card.dataset.nodeId=node.id;card.style.left=node.x+'px';card.style.top=node.y+'px';
    const heading=document.createElement('div');heading.className='synth-module-heading';heading.textContent=spec.label;
    if(node.type!=='output'){
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${spec.label}`);remove.onclick=()=>{const candidate=structuredClone(patch);candidate.nodes=candidate.nodes.filter(item=>item.id!==node.id);candidate.cables=candidate.cables.filter(edge=>edge.from!==node.id&&edge.to!==node.id);update(candidate);};heading.append(remove);
    }
    heading.addEventListener('pointerdown',event=>{
      if((event.target as Element).closest('button'))return;
      event.preventDefault();heading.setPointerCapture(event.pointerId);const startX=event.clientX,startY=event.clientY,originX=node.x,originY=node.y;
      const move=(pointer:PointerEvent)=>{card.style.left=Math.max(0,Math.min(3900,originX+pointer.clientX-startX))+'px';card.style.top=Math.max(0,Math.min(3900,originY+pointer.clientY-startY))+'px';redrawWires();};
      const finish=()=>{heading.removeEventListener('pointermove',move);heading.removeEventListener('pointerup',finish);const candidate=structuredClone(patch),target=candidate.nodes.find(item=>item.id===node.id)!;target.x=parseFloat(card.style.left);target.y=parseFloat(card.style.top);update(candidate);};
      heading.addEventListener('pointermove',move);heading.addEventListener('pointerup',finish,{once:true});
    });
    const ports=document.createElement('div');ports.className='synth-module-ports';
    for(const [direction,definitions] of [['in',spec.inputs],['out',spec.outputs]] as const){
      const column=document.createElement('div');column.className='synth-port-column';
      for(const [port,kind] of Object.entries(definitions)){
        const button=document.createElement('button');button.type='button';button.className=`synth-port ${kind}`;button.dataset.port=port;button.dataset.portDirection=direction;button.textContent=direction==='in'?`◀ ${port}`:`${port} ▶`;button.setAttribute('aria-label',`${spec.label} ${port} ${kind} ${direction==='in'?'input':'output'}`);
        if(direction==='out'){
          button.onpointerdown=event=>{event.stopPropagation();source={node:node.id,port};redrawWires();};
          button.onclick=()=>{source={node:node.id,port};redrawWires();};
        }else button.onclick=()=>connect(node.id,port);
        column.append(button);
      }
      ports.append(column);
    }
    const parameters=document.createElement('div');parameters.className='synth-module-parameters';
    for(const [name,definition] of Object.entries(spec.params)){
      const label=document.createElement('label');label.textContent=name;
      if('choices' in definition){const select=document.createElement('select');for(const choice of definition.choices){const opt=document.createElement('option');opt.value=choice;opt.textContent=choice;select.append(opt);}select.value=String(node.params[name]);select.onchange=()=>{const candidate=structuredClone(patch);candidate.nodes.find(item=>item.id===node.id)!.params[name]=select.value;update(candidate);};label.append(select);}
      else {const field=document.createElement('input');field.type='number';field.min=String(definition.min);field.max=String(definition.max);field.step=String(definition.max<=2?.01:definition.max<=24?.1:1);field.value=String(node.params[name]);field.onchange=()=>{const candidate=structuredClone(patch);candidate.nodes.find(item=>item.id===node.id)!.params[name]=Number(field.value);update(candidate);};label.append(field);}
      parameters.append(label);
    }
    card.append(heading,ports,parameters);return card;
  };
  const render=()=>{
    stage.querySelectorAll('.synth-module').forEach(element=>element.remove());
    for(const node of patch.nodes)stage.append(nodeCard(node));
    cableList.replaceChildren();const heading=document.createElement('h3');heading.textContent=`Cables (${patch.cables.length})`;cableList.append(heading);
    patch.cables.forEach((edge,index)=>{
      const row=document.createElement('div');row.className='synth-cable-row';
      const name=document.createElement('span');name.textContent=`${edge.from}.${edge.out} → ${edge.to}.${edge.input}`;
      const depth=document.createElement('input');depth.type='number';depth.min='-1';depth.max='1';depth.step='0.01';depth.value=String(edge.depth);depth.setAttribute('aria-label',`Cable ${index+1} depth`);depth.onchange=()=>{const candidate=structuredClone(patch);candidate.cables[index]!.depth=Number(depth.value);update(candidate);};
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label',`Remove cable ${index+1}`);remove.onclick=()=>{const candidate=structuredClone(patch);candidate.cables.splice(index,1);update(candidate);};
      row.append(name,depth,remove);cableList.append(row);
    });
    requestAnimationFrame(redrawWires);
  };
  const connectOnPointerUp=(event:PointerEvent)=>{
    if(!source)return;
    const target=(event.target as Element).closest<HTMLElement>('[data-port-direction="in"]');
    if(target){const to=target.closest<HTMLElement>('[data-node-id]');if(to)connect(to.dataset.nodeId!,target.dataset.port!);}
    else redrawWires();
  };
  stage.addEventListener('pointerup',connectOnPointerUp);
  stage.addEventListener('pointermove',event=>{if(source&&dragLine){const a=portCentre(source.node,source.port,'out'),rect=stage.getBoundingClientRect();dragLine.setAttribute('d',route(a,{x:event.clientX-rect.left,y:event.clientY-rect.top}));}});
  dialog.addEventListener('close',()=>dialog.remove());
  refreshSaved();clearError();render();dialog.showModal();return dialog;
}
