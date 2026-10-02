export type KnobFormat=(value:number)=>string;
export interface RotaryKnobOptions {
  id:string;
  label:string;
  ariaLabel?:string;
  value:number;
  min:number;
  max:number;
  step:number;
  scale?:'linear'|'log';
  format?:KnobFormat;
  onInput?:(value:number)=>void;
  onCommit?:(value:number)=>void;
}
export interface RotaryKnob {
  element:HTMLDivElement;
  dial:HTMLDivElement;
  field:HTMLInputElement;
  output:HTMLOutputElement;
  setValue:(value:number)=>void;
  setDisabled:(disabled:boolean)=>void;
}

function clamp(value:number,min:number,max:number){return Math.max(min,Math.min(max,value));}
function snap(value:number,min:number,max:number,step:number){return clamp(min+Math.round((value-min)/step)*step,min,max);}
function clean(value:number){return Number(value.toPrecision(12));}

export function createRotaryKnob(options:RotaryKnobOptions):RotaryKnob {
  const root=document.createElement('div');root.className='rotary-knob-control';root.dataset.knob=options.id;
  const caption=document.createElement('div');caption.className='rotary-knob-caption';
  const title=document.createElement('span');title.textContent=options.label;
  const output=document.createElement('output');output.htmlFor=options.id;output.className='rotary-knob-value';caption.append(title,output);
  const row=document.createElement('div');row.className='rotary-knob-row';
  const dial=document.createElement('div');dial.className='rotary-knob-dial';dial.id=options.id+'-knob';dial.tabIndex=0;dial.setAttribute('role','slider');dial.setAttribute('aria-label',options.ariaLabel??options.label);
  const ring=document.createElement('span');ring.className='rotary-knob-ring';const indicator=document.createElement('span');indicator.className='rotary-knob-indicator';ring.append(indicator);dial.append(ring);
  const field=document.createElement('input');field.type='number';field.id=options.id;field.className='rotary-knob-entry';field.min=String(options.min);field.max=String(options.max);field.step=String(options.step);field.setAttribute('aria-label','Set '+(options.ariaLabel??options.label));
  row.append(dial,field);root.append(caption,row);
  const format=options.format??(value=>String(clean(value)));
  let value=snap(options.value,options.min,options.max,options.step);
  const normalize=(candidate:number)=>{
    const bounded=snap(candidate,options.min,options.max,options.step);
    if(options.scale==='log'&&options.min>0)return Math.log(bounded/options.min)/Math.log(options.max/options.min);
    if(options.scale==='log')return Math.log1p(bounded)/Math.log1p(options.max);
    return (bounded-options.min)/(options.max-options.min);
  };
  const denormalize=(amount:number)=>{
    const t=clamp(amount,0,1);
    if(options.scale==='log'&&options.min>0)return options.min*Math.pow(options.max/options.min,t);
    if(options.scale==='log')return Math.expm1(t*Math.log1p(options.max));
    return options.min+t*(options.max-options.min);
  };
  const draw=(writeField=true)=>{
    const portion=normalize(value),angle=-135+portion*270;
    dial.style.setProperty('--knob-angle',angle+'deg');dial.setAttribute('aria-valuemin',String(options.min));dial.setAttribute('aria-valuemax',String(options.max));dial.setAttribute('aria-valuenow',String(clean(value)));dial.setAttribute('aria-valuetext',format(value));
    output.value=format(value);output.textContent=format(value);if(writeField)field.value=String(clean(value));
  };
  const change=(candidate:number,commit=false)=>{
    if(!Number.isFinite(candidate))return;
    value=snap(candidate,options.min,options.max,options.step);draw();options.onInput?.(value);if(commit)options.onCommit?.(value);
  };
  draw();
  field.oninput=()=>{const next=field.valueAsNumber;if(!Number.isFinite(next))return;value=clamp(next,options.min,options.max);draw(false);options.onInput?.(value);};
  field.onchange=()=>{const next=field.valueAsNumber;if(!Number.isFinite(next)){draw();return;}change(next,true);};
  dial.onkeydown=event=>{
    const multiplier=event.shiftKey?1:10;let next=value;
    if(event.key==='ArrowUp'||event.key==='ArrowRight')next+=options.step*multiplier;
    else if(event.key==='ArrowDown'||event.key==='ArrowLeft')next-=options.step*multiplier;
    else if(event.key==='PageUp')next+=options.step*50;
    else if(event.key==='PageDown')next-=options.step*50;
    else if(event.key==='Home')next=options.min;
    else if(event.key==='End')next=options.max;
    else return;
    event.preventDefault();change(next,true);
  };
  let drag:{y:number;normalized:number}|undefined;
  dial.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();dial.focus();drag={y:event.clientY,normalized:normalize(value)};dial.setPointerCapture(event.pointerId);dial.classList.add('is-dragging');};
  dial.onpointermove=event=>{if(!drag||!dial.hasPointerCapture(event.pointerId))return;const sensitivity=event.shiftKey?0.1:1;change(denormalize(drag.normalized-(event.clientY-drag.y)/150*sensitivity));};
  const endDrag=(event:PointerEvent)=>{if(!drag)return;drag=undefined;dial.classList.remove('is-dragging');if(dial.hasPointerCapture(event.pointerId))dial.releasePointerCapture(event.pointerId);options.onCommit?.(value);};
  dial.onpointerup=endDrag;dial.onpointercancel=endDrag;
  return {element:root,dial,field,output,setValue(next){if(Number.isFinite(next)){value=snap(next,options.min,options.max,options.step);draw(document.activeElement!==field);}},setDisabled(disabled){dial.setAttribute('aria-disabled',String(disabled));dial.tabIndex=disabled?-1:0;field.disabled=disabled;}};
}
