import {GROOVES} from './core/groove-profiles.js';
import {NEW_GENRES} from './core/new-genres.js';
import {newBank,arrange,songTimeline,songPosition,moveSequenceStep,slotLabel,addPatternSlot,duplicatePatternSlot,deletePatternSlot,type Bank} from './core/bank.js';
import {makeProject,readProject,localProject} from './audio/project.js';
import {defaultKitState} from './audio/drum-kit.js';
import {setupDrumKit,withDrumKit} from './audio/drum-kit.js';
import {KIT_PRESETS,GENRE_KITS} from './audio/library.js';
import {setupSamplePanel} from './audio/sample-panel.js';
import {downloadBytes} from './audio/render.js';
import {renderPerformance,renderSequence} from './audio/performance.js';
import {encodeWav} from './audio/wav.js';
import {reconstruct,sliceReference,type AudioAsset} from './audio/slices.js';
import {BREAKS} from './core/breaks.js';
import {defaults,genreDefaults,PROFILES} from './core/profiles.js';
import {generate} from './core/generate.js';
import {compile,serialize} from './core/compile.js';
import {ROLES,hex,noteName,type Hit,type Role,type Genre,type BreakStyle,type Pattern,type Transfer} from './core/model.js';
import {Editor,emptySelection,locked,selectedIds} from './core/editor.js';
import {defaultEffects,type Effects} from './audio/effects.js';


const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=(id:string)=>el<HTMLInputElement>(id);
let pattern:Pattern,transfer:Transfer;
let editor:Editor;
let bank:Bank|undefined,pendingSlot:number|undefined;
let draggedStep:number|undefined;
let mode:'pattern'|'arrangement'|undefined;
const slotEditors=new Map<number,Editor>();
let persistenceReady=false,saveTimer:ReturnType<typeof setTimeout>|undefined;
let saveQueue:Promise<unknown>=Promise.resolve();
let rowAnchor=0,cursorLane:Role='kick',playToken=0;
const assets=new Map<string,AudioAsset>();

let context:AudioContext|undefined,timer:ReturnType<typeof setInterval>|undefined;
const playingSources=new Set<AudioBufferSourceNode>();
function showHitEditor(){el<HTMLDetailsElement>('hit-editor').open=true;el('inspector-hint').hidden=true;if(matchMedia('(max-width:800px)').matches)requestAnimationFrame(()=>el('hit-editor').scrollIntoView({behavior:'smooth',block:'start'}));}
function status(message:string,error=false){el('status').textContent=message;el('status').classList.toggle('error',error);}
function syncHud() {
  const bpmVal = document.getElementById('hud-bpm-val');
  if (bpmVal && Number.isFinite(Number(input('bpm').value))) {
    bpmVal.textContent = (input('transport-target').value==='song' && bank ? bank.songBpm : pattern?.settings.bpm ?? Number(input('bpm').value)).toFixed(1);
  }
  const barsVal = document.getElementById('hud-bars-val');
  if (barsVal && pattern?.settings?.bars) {
    const bars=input('transport-target').value==='song' && bank ? bank.sequence.reduce((n,s)=>n+bank!.slots[s.slot]!.editor!.pattern.settings.bars*s.repeats,0) : pattern.settings.bars;
    barsVal.textContent = `${bars} BAR${bars !== 1 ? 'S' : ''}`;
  }
  const sidePattern = document.getElementById('hud-pattern-name');
  if (sidePattern && bank) {
    const slot = bank.slots[bank.active];
    sidePattern.textContent = `${slot?.name ?? 'A'} (${pattern?.settings.bars ?? 2} Bars)`;
  }
  const sideTempo = document.getElementById('hud-tempo-val');
  if (sideTempo) {
    sideTempo.textContent = `${(pattern?.settings.bpm ?? Number(input('bpm').value)).toFixed(1)} BPM`;
  }
  const sideKit = document.getElementById('hud-kit-name');
  if (sideKit) {
    const kitSelect = document.getElementById('generator-kit-select') as HTMLSelectElement | null;
    const txt = kitSelect?.selectedOptions[0]?.text?.replace(/^[^\w\s]+/, '')?.trim() ?? 'Custom Kit';
    sideKit.textContent = txt.length > 16 ? txt.slice(0, 14) + '…' : txt;
  }
}
function updateHudPosition(row: number) {
  const posVal = document.getElementById('hud-pos-val');
  if (posVal && transfer?.timing?.lpb) {
    const position = row / transfer.timing.lpb;
    const bar = Math.floor(position / 4) + 1;
    const beat = Math.floor(position % 4) + 1;
    posVal.textContent = `${String(bar).padStart(2, '0')}.${beat}`;
  }
}
function resetHud() {
  const posVal = document.getElementById('hud-pos-val');
  if (posVal) posVal.textContent = '01.1';
}
function getTrackerStep(): number {
  const select = document.getElementById('tracker-step-select') as HTMLSelectElement | null;
  if (select && Number.isInteger(Number(select.value))) {
    return Number(select.value);
  }
  const editStep = input('edit-step');
  if (editStep && Number.isInteger(Number(editStep.value))) {
    return Number(editStep.value);
  }
  return 1;
}
function settings(){
  const s=defaults(input('genre').value as Genre);
  s.algorithm=input('algorithm').value as 'groove-v2'|'legacy-v1';s.variation=Number(input('variation').value);
  s.enabledRoles=ROLES.filter(r=>kitPanel.mix[r].include);
  s.breakStyle=input('breakStyle').value as BreakStyle;
  s.seed=input('seed').value;s.bpm=Number(input('bpm').value);s.bars=Number(input('bars').value);
  s.resolution=Number(input('resolution').value) as typeof s.resolution;
  s.spicy=Number(input('spicy').value);
  for(const name of ['complexity','syncopation','swing','humanizeMs','ghostAmount','fillAmount'] as const)s[name]=Number(input(name).value);
  return s;
}
function flashTrackMeter(role: Role, level = 1){
  const bar=document.querySelector(`#track-meter-${role} .track-meter-bar`) as HTMLElement|null;
  if(!bar)return;
  const pct=Math.max(15,Math.min(100,Math.round(level*100)));
  bar.classList.remove('decaying');
  bar.style.width=pct+'%';
  void bar.offsetWidth;
  bar.classList.add('decaying');
}
function render(){
  const container=el('grid'),scrollTop=container.scrollTop,scrollLeft=container.scrollLeft;
  const active=document.activeElement as HTMLElement|null;
  const focusHit=active?.dataset.hit,focusRow=active?.dataset.row;
  const selected=selectedIds(editor.state);
  container.replaceChildren();
  const table=document.createElement('table');
  const head=document.createElement('thead'),header=document.createElement('tr');
  for(const [i,label] of ['Row','Beat',...ROLES.map(role=>role==='percussion'?'Percussion':role[0]!.toUpperCase()+role.slice(1))].entries()){
    const th=document.createElement('th');
    if(i<2) th.textContent=label;
    else{
      const role=ROLES[i-2]!;
      th.className='track-col-header track-'+role;
      const strip=document.createElement('div');
      strip.className='track-strip';
      const top=document.createElement('div');
      top.className='track-strip-top';
      const b=document.createElement('button');
      b.className='lane-settings';
      b.textContent=label;
      b.setAttribute('aria-label','Open '+label+' instrument settings');
      b.title=label+' settings';
      b.onclick=()=>{document.getElementById('studio-layout')?.classList.remove('tray-right-collapsed');el<HTMLDetailsElement>('sounds-panel').open=true;el('kit-choice-'+role).closest('.drum-slot')?.scrollIntoView({behavior:'smooth',block:'nearest'});el('kit-choice-'+role).focus({preventScroll:true});};
      const btns=document.createElement('div');
      btns.className='track-strip-btns';
      const muteBtn=document.createElement('button');
      muteBtn.className='track-header-mute'+(kitPanel.mix[role].mute?' is-muted':'');
      muteBtn.textContent='M';
      muteBtn.title=(kitPanel.mix[role].mute?'Unmute ':'Mute ')+label;
      muteBtn.onclick=(e)=>{e.stopPropagation();kitPanel.mix[role].mute=!kitPanel.mix[role].mute;const cb=input('kit-mute-'+role) as HTMLInputElement|null;if(cb)cb.checked=kitPanel.mix[role].mute;render();dirty();};
      const soloBtn=document.createElement('button');
      soloBtn.className='track-header-solo'+(kitPanel.mix[role].solo?' is-soloed':'');
      soloBtn.textContent='S';
      soloBtn.title=(kitPanel.mix[role].solo?'Unsolo ':'Solo ')+label;
      soloBtn.onclick=(e)=>{e.stopPropagation();kitPanel.mix[role].solo=!kitPanel.mix[role].solo;const cb=input('kit-solo-'+role) as HTMLInputElement|null;if(cb)cb.checked=!!kitPanel.mix[role].solo;render();dirty();};
      btns.append(muteBtn,soloBtn);
      top.append(b,btns);
      const mixer=document.createElement('div');
      mixer.className='track-strip-mixer';
      const fader=document.createElement('input');
      fader.type='range';fader.min='0';fader.max='1';fader.step='0.01';
      fader.id='track-fader-'+role;
      fader.className='track-header-fader';
      fader.value=String(kitPanel.mix[role].level);
      fader.title=label+' volume: '+Math.round(kitPanel.mix[role].level*100)+'%';
      fader.setAttribute('aria-label',label+' track volume');
      const volLabel=document.createElement('span');
      volLabel.id='track-vol-'+role;
      volLabel.className='track-header-vol';
      volLabel.textContent=Math.round(kitPanel.mix[role].level*100)+'%';
      fader.oninput=()=>{const val=Number(fader.value);kitPanel.mix[role].level=val;volLabel.textContent=Math.round(val*100)+'%';fader.title=label+' volume: '+Math.round(val*100)+'%';const kitLvl=document.getElementById('kit-level-'+role) as HTMLInputElement|null;if(kitLvl){kitLvl.value=String(val);kitLvl.dispatchEvent(new Event('input'));}dirty();};
      mixer.append(fader,volLabel);
      const meter=document.createElement('div');
      meter.id='track-meter-'+role;
      meter.className='track-header-meter';
      meter.title=label+' activity';
      const meterBar=document.createElement('div');
      meterBar.className='track-meter-bar';
      meter.append(meterBar);
      strip.append(top,mixer,meter);
      th.append(strip);
    }
    header.append(th);
  }
  head.append(header);table.append(head);
  const body=document.createElement('tbody');
  const view=input('view').value;
  for(let row=0;row<transfer.timing.lines;row++){
    const isBar=row%(transfer.timing.lpb*4)===0,isBeat=row%transfer.timing.lpb===0;
    const tr=document.createElement('tr');tr.className=(isBar?'bar-start ':'')+(isBeat?'beat':'');tr.dataset.playRow=String(row);
    const range=editor.state.selection.rows;
    if(range&&row>=range[0]&&row<=range[1])tr.classList.add('selected-row');
    const position=row/transfer.timing.lpb;
    const labels=[String(row).padStart(2,'0'),`${Math.floor(position/4)+1}.${Math.floor(position%4)+1}${position%1?` +${(position%1).toFixed(2)}`:''}`];
    for(const [index,value] of labels.entries()){
      const td=document.createElement('td');
      if(index===0){
        const button=document.createElement('button');button.className='row-select';button.dataset.row=String(row);button.textContent=value;
        button.setAttribute('aria-label',`Select row ${row}`);button.setAttribute('aria-pressed',String(!!range&&row>=range[0]&&row<=range[1]));
        button.onclick=e=>selectRows(e.shiftKey?rowAnchor:row,row,!e.shiftKey);td.append(button);
      }else td.textContent=value;
      tr.append(td);
    }
    for(const lane of ROLES.map(id=>({id,name:id[0]!.toUpperCase()+id.slice(1)}))){
      const td=document.createElement('td');td.classList.toggle('cursor-cell',row===rowAnchor&&lane.id===cursorLane);
      const notes=transfer.notes.filter(n=>n.row===row&&n.lane===lane.id);
      if(!notes.length){
        const empty=document.createElement('button');
        empty.className='empty-cell';
        empty.textContent=view==='renoise'?'··· ·· ·· ··':view==='beginner'?'····':'··· ··';
        empty.setAttribute('aria-label','Enter '+lane.id+' at row '+row);
        empty.onclick=()=>{
          rowAnchor=row;cursorLane=lane.id;
          editor.state.selection=emptySelection();
          updateEntry();
          render();
          el('grid').focus();
          void auditionRole(lane.id);
        };
        empty.ondblclick=()=>{
          rowAnchor=row;cursorLane=lane.id;
          editor.state.selection=emptySelection();
          updateEntry();
          writeEntry(false);
          render();
          el('grid').focus();
          void auditionRole(lane.id);
        };
        td.append(empty);
      }
      for(const n of notes){
        const hit=pattern.events.find(e=>e.id===n.id)!;
        const source=transfer.sources.find(s=>s.id===n.source)!;
        const button=document.createElement('button');button.className=`hit ${lane.id}${hit.ghost?' ghost':''}`;
        button.dataset.hit=hit.id;button.classList.toggle('selected-hit',selected.has(hit.id));
        button.classList.toggle('locked-hit',locked(editor.state,hit));button.setAttribute('aria-pressed',String(selected.has(hit.id)));
        const sound=hit.slice??drumKit[hit.role];
        const reverse=hit.reverse||kitPanel.mix[hit.role].reverse;
        const label=sound?(hit.ghost?'Ghost · ':'')+sound.label:hit.ghost?'Ghost snare':lane.name;
        const tracker=`${noteName(source.note+(hit.pitch??0))} ${hex(source.instrument)} ${hex(n.volume)} ${hex(n.pan)} ${hex(n.delay)}`;
        const articulation=(hit.ratchets&&hit.ratchets>1?'×'+hit.ratchets:'')+(hit.gate!==undefined?(hit.ratchets&&hit.ratchets>1?' · ':'')+'Gate '+Math.round(hit.gate*100)+'%':'');
        const badge=(articulation?articulation+' ':'')+(reverse?'↶ ':'')+(locked(editor.state,hit)?'🔒 ':'');
        button.textContent=badge+(view==='beginner'?(hit.ghost?'Ghost':lane.name):view==='renoise'?tracker:`${label} · ${tracker}`);
        button.title=`${label}, row ${row}, volume ${hex(n.volume)}, delay ${hex(n.delay)}${articulation}`;
        button.onclick=e=>{
          showHitEditor();
          if(e.shiftKey){selectRows(rowAnchor,row,false);return;}
          const ids=editor.state.selection.ids;
          editor.state.selection={rows:null,ids:e.ctrlKey||e.metaKey?(ids.includes(hit.id)?ids.filter(id=>id!==hit.id):[...ids,hit.id]):[hit.id]};
          rowAnchor=row;cursorLane=lane.id;render();
        };
        td.append(button);
      }
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(body);container.append(table);
  container.scrollTop=scrollTop;container.scrollLeft=scrollLeft;
  if(focusHit)container.querySelector<HTMLElement>(`[data-hit="${focusHit}"]`)?.focus({preventScroll:true});
  else if(focusRow)container.querySelector<HTMLElement>(`[data-row="${focusRow}"]`)?.focus({preventScroll:true});
  el('summary').textContent=`${transfer.timing.bars} bars · ${transfer.timing.lines} rows · LPB ${transfer.timing.lpb} · ${transfer.notes.length} hits · ${pattern.settings.bpm.toFixed(1)} BPM · ${(pattern.settings.enabledRoles??ROLES).join(' + ')}`;
  el('generation-summary').textContent=(pattern.settings.enabledRoles??ROLES).map(r=>r==='hat'?'Hi-hat':r[0]!.toUpperCase()+r.slice(1)).join(' + ')+' · '+pattern.settings.bars+' bars · '+pattern.settings.bpm.toFixed(1)+' BPM';
  input('export').disabled=false;input('play').disabled=false;input('copy').disabled=false;
  const range=editor.state.selection.rows;
  el('selection-status').textContent=range?`Rows ${range[0]}–${range[1]} · ${selected.size} hits selected`:selected.size?`${selected.size} hit${selected.size===1?'':'s'} selected`:'Whole pattern · no selection';
  const allLocked=selected.size>0&&[...selected].every(id=>editor.state.lockedIds.includes(id));
  el('lock-selected').textContent=allLocked?'Unlock selected hits':'Lock selected hits';input('lock-selected').disabled=selected.size===0;
  el('mutate').textContent=range||selected.size?'Mutate selection':'Mutate pattern';
  input('fill').disabled=!range;
  input('undo').disabled=!editor.undoLabel;input('redo').disabled=!editor.redoLabel;
  el('undo').title=editor.undoLabel?`Undo ${editor.undoLabel}`:'Nothing to undo';el('redo').title=editor.redoLabel?`Redo ${editor.redoLabel}`:'Nothing to redo';
  for(const role of ['kick','snare','hat','percussion'] as const)input(`lock-${role}`).checked=editor.state.lockedRoles.includes(role);
  for(const id of ['row-start','row-end']){input(id).max=String(transfer.timing.lines-1);}
  input('row-start').value=String(range?.[0]??0);input('row-end').value=String(range?.[1]??transfer.timing.lines-1);
  const chosen=pattern.events.find(hit=>hit.id===editor.state.selection.ids.at(-1));
  const note=chosen&&transfer.notes.find(n=>n.id===chosen.id),source=note&&transfer.sources.find(s=>s.id===note.source);
  updateEntry(chosen);
  el('explanation').textContent=chosen&&note&&source?`${chosen.reason} Row ${note.row}, instrument ${hex(source.instrument)}, ${noteName(source.note)}, volume ${hex(note.volume)}, pan ${hex(note.pan)}, delay ${hex(note.delay)}.${locked(editor.state,chosen)?' Locked: editing will preserve this hit.':''} ${note.delay?`The delay is ${(note.delay/256*60000/transfer.timing.bpm/transfer.timing.lpb).toFixed(2)} ms into this row.`:''}`:range?'This row range is the target for mutation and fills. Locked hits and main anchors remain intact.':'Select a hit to inspect it. Ctrl/Cmd-click adds hits; Shift-click a row number selects a range.';
  syncHud();
}
function selectRows(start:number,end:number,anchor=true){
  if(!Number.isInteger(start)||!Number.isInteger(end)||Math.min(start,end)<0||Math.max(start,end)>=transfer.timing.lines){status('Choose row numbers within this pattern.',true);return;}
  if(anchor)rowAnchor=start;
  editor.state.selection={ids:[],rows:[Math.min(start,end),Math.max(start,end)]};render();
}
function syncControls(){
  const s=editor.state.pattern.settings;
  input('algorithm').value=s.algorithm??'legacy-v1';input('variation').value=String(s.variation??0);
  for(const [key,value] of Object.entries(s))if(key!=='enabledRoles')input(key).value=String(value);
  for(const r of ROLES)kitPanel.mix[r].include=!s.enabledRoles||s.enabledRoles.includes(r);kitPanel.restore(kitPanel.snapshot());
  presets();
}
function refresh(){for(const [owner,drafts] of hitDrafts)for(const id of drafts.keys())if(!owner.state.pattern.events.some(h=>h.id===id))drafts.delete(id);pattern=editor.state.pattern;transfer=compile(pattern);render();stashSlot();renderBank();scheduleSave();}
function edit(action:()=>boolean,message:string){
  try{stop();const changed=action();refresh();status(changed?message:'No editable change: selected hits may be locked or protected anchors.');}
  catch(e){status((e as Error).message,true);}
}
function stop(){
  if(timer)clearInterval(timer);timer=undefined;
  for(const source of playingSources){try{source.stop();}catch{}source.disconnect();}playingSources.clear();
  mode=undefined;pendingSlot=undefined;el('transport-state').textContent='Stopped';el('play-arrangement').textContent='Play arrangement';el('bank-status').textContent='';document.querySelectorAll('.playing-step').forEach(e=>e.classList.remove('playing-step'));
  playToken++;el('play').textContent=input('transport-target').value==='song'?'Play song':'Play pattern';el('song-position').textContent='Song stopped';document.querySelector('.playing-row')?.classList.remove('playing-row');
  resetHud();
}
function build(){
  if(pendingCount()){status('Apply or Revert pending hit edits before generating a new pattern.',true);return;}
  stop();
  try{const requested=settings();if(!requested.enabledRoles?.length)throw Error('Include at least one instrument before generating.');const next=generate(requested);if(editor)editor.replace(next);else editor=new Editor(next);refresh();status(`Generated seed “${pattern.settings.seed}”. Locked hits and lanes were preserved. Undo restores the previous pattern.`);}
  catch(e){status((e as Error).message,true);}
}
function download(){
  el<HTMLDetailsElement>('more-actions').open=false;
  const url=URL.createObjectURL(new Blob([patternJSON()],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=`${transfer.genre}-${transfer.seed.replace(/[^a-zA-Z0-9_-]/g,'_')}.json`;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);status('Pattern JSON downloaded. Use Export pattern WAV for playable audio.');
}
const samplePanel=setupSamplePanel(stop);
async function auditionRole(role: Role) {
  flashTrackMeter(role, kitPanel.mix[role].level);
  stop();samplePanel.stop();context??=new AudioContext();const token=playToken;await context.resume();if(token!==playToken)return;
  const one=generate({...defaults(),bars:1});one.events=[{id:'preview',role,sourceId:'kit.'+role,baseTick:0,offsetTick:0,gain:1,pan:0,anchor:false,ghost:false,reason:'Instrument preview.'}];
  const mix=kitPanel.snapshot();mix[role].mute=false;mix[role].solo=true;
  const audio=renderPerformance(withDrumKit(one,drumKit,mix),assets,context.sampleRate,effectMap());
  const b=context.createBuffer(2,audio.channels[0]!.length,audio.sampleRate);audio.channels.forEach((c,i)=>b.copyToChannel(new Float32Array(c),i));
  const source=context.createBufferSource();source.buffer=b;source.connect(context.destination);playingSources.add(source);source.onended=()=>{playingSources.delete(source);source.disconnect();};source.start();
}
const kitPanel=setupDrumKit(assets,()=>{
  stop();samplePanel.stop();
  const ks=document.getElementById('kit-preset-select') as HTMLSelectElement | null;
  const gks=document.getElementById('generator-kit-select') as HTMLSelectElement | null;
  const matching=KIT_PRESETS.find(p=>ROLES.every(r=>kitPanel.mix[r].choice===p.slots[r]));
  const matchedId=matching?matching.id:'custom';
  if(ks) ks.value=matchedId;
  if(gks) gks.value=matchedId;
  if(editor)refresh();
},auditionRole);
const drumKit=kitPanel.kit;
function effectMap(){return Object.fromEntries(ROLES.map(r=>[r,kitPanel.mix[r].effects]));}
function audioBuffer(audio:ReturnType<typeof renderPerformance>){const b=context!.createBuffer(2,audio.channels[0]!.length,audio.sampleRate);audio.channels.forEach((c,i)=>b.copyToChannel(new Float32Array(c),i));return b;}
function startSource(buffer:AudioBuffer,at:number){const s=context!.createBufferSource();s.buffer=buffer;s.connect(context!.destination);playingSources.add(s);s.onended=()=>{playingSources.delete(s);s.disconnect();};s.start(at);}
async function play(){
 if(mode){stop();return;}if(input('transport-target').value==='song'){await playArrangement();return;}stop();samplePanel.stop();const token=playToken;context??=new AudioContext();await context.resume();if(token!==playToken)return;
 let audio=renderPerformance(withDrumKit(pattern,drumKit,kitPanel.mix),assets,context.sampleRate,effectMap()),buffer=audioBuffer(audio);
 let next=context.currentTime+.08,start=next,duration=audio.duration,boundary:{at:number;slot:number;duration:number}|undefined;
 mode='pattern';el('transport-state').textContent='Pattern playing';el('play').textContent='Stop';
 let lastMeterRow = -1;
 const schedule=()=>{const now=context!.currentTime;
  if(boundary&&now>=boundary.at){const b=boundary;boundary=undefined;activateSlot(b.slot);start=b.at;duration=b.duration;el('bank-status').textContent='Playing '+bank!.slots[b.slot]!.name;}
  if(next<=now+.12){
    if(pendingSlot!==undefined){
      const slot=pendingSlot;pendingSlot=undefined;
      audio=renderPerformance(withDrumKit(bank!.slots[slot]!.editor!.pattern,drumKit,kitPanel.mix),assets,context!.sampleRate,effectMap());
      buffer=audioBuffer(audio);boundary={at:next,slot,duration:audio.duration};
    } else {
      audio=renderPerformance(withDrumKit(pattern,drumKit,kitPanel.mix),assets,context!.sampleRate,effectMap());
      buffer=audioBuffer(audio);
    }
    startSource(buffer,Math.max(next,now));next+=audio.duration;
  }
  const row=Math.floor((Math.max(0,now-start)%duration)/duration*transfer.timing.lines);
  document.querySelector('.playing-row')?.classList.remove('playing-row');
  document.querySelector('[data-play-row="'+row+'"]')?.classList.add('playing-row');
  updateHudPosition(row);
  if(row!==lastMeterRow){
    lastMeterRow=row;
    const hasSolo=ROLES.some(r=>kitPanel.mix[r].solo);
    for(const n of transfer.notes.filter(note=>note.row===row)){
      const audible=hasSolo?(kitPanel.mix[n.lane].solo&&!kitPanel.mix[n.lane].mute):!kitPanel.mix[n.lane].mute;
      if(audible){
        const hit=pattern.events.find(e=>e.id===n.id);
        flashTrackMeter(n.lane,(hit?.gain??1)*kitPanel.mix[n.lane].level);
      }
    }
  }
 };schedule();timer=setInterval(schedule,25);
}
function stashSlot(){if(!editor)return;bank??=newBank(editor.state.pattern);bank.slots[bank.active]!.editor=structuredClone(editor.state);slotEditors.set(bank.active,editor);}
function activateSlot(index:number){stashSlot();bank!.active=index;editor=slotEditors.get(index)??new Editor(bank!.slots[index]!.editor!.pattern);if(!slotEditors.has(index))editor.state=structuredClone(bank!.slots[index]!.editor!);rowAnchor=0;syncControls();refresh();}
function chooseSlot(index:number){if(index===bank!.active){pendingSlot=undefined;return;}if(mode==='pattern'){stashSlot();pendingSlot=index;el('bank-status').textContent='Queued '+bank!.slots[index]!.name+' - next pattern boundary';return;}stop();activateSlot(index);}
function renderBank(){if(!bank)return;const host=el('bank-slots');host.replaceChildren();
 const heading = document.querySelector('.pattern-bank .grid-heading');
 if(heading && !document.getElementById('bank-toolbar')){
  const tb=document.createElement('div');tb.id='bank-toolbar';tb.className='bank-toolbar';
  const addBtn=document.createElement('button');addBtn.id='bank-add-slot';addBtn.className='bank-tool-btn';addBtn.textContent='+ New';addBtn.title='Add blank pattern slot';
  addBtn.onclick=()=>{stop();stashSlot();const newIdx=addPatternSlot(bank!,undefined,null);slotEditors.delete(newIdx);renderBank();scheduleSave();status('Added new pattern slot.');};
  const dupBtn=document.createElement('button');dupBtn.id='bank-dup-slot';dupBtn.className='bank-tool-btn';dupBtn.textContent='⧉ Dup';dupBtn.title='Duplicate active pattern';
  dupBtn.onclick=()=>{stop();stashSlot();const newIdx=duplicatePatternSlot(bank!,bank!.active);slotEditors.delete(newIdx);activateSlot(newIdx);renderBank();scheduleSave();status('Duplicated active pattern.');};
  tb.append(addBtn,dupBtn);heading.append(tb);
 }
 bank.slots.forEach((slot,i)=>{const card=document.createElement('div');card.className='bank-slot'+(bank!.active===i?' active':'');
  const label=slotLabel(i);
  const title=document.createElement('strong');title.textContent=label+(bank!.active===i?' - Editing':'');card.append(title);
  const name=document.createElement('input');name.value=slot.name;name.maxLength=40;name.setAttribute('aria-label','Slot '+label+' name');name.onchange=()=>{slot.name=name.value.trim()||label;renderBank();scheduleSave();};card.append(name);
  const rename=document.createElement('button');rename.textContent='⋯';rename.setAttribute('aria-label','Rename '+label);rename.onclick=()=>{name.style.display='block';name.focus();name.select();};card.append(rename);
  title.title='Double-click to rename';title.ondblclick=()=>{name.style.display='block';name.focus();name.select();};
  const b=document.createElement('button');b.id='slot-'+i;b.setAttribute('aria-pressed',String(bank!.active===i));b.title=slot.editor?'Edit '+slot.name+'; queues during playback':'Copy current pattern into '+slot.name;b.textContent=slot.editor?slot.name:'+ '+slot.name;b.onclick=()=>{if(!slot.editor){stop();stashSlot();slot.editor=structuredClone(editor.state);slotEditors.delete(i);activateSlot(i);status('Copied pattern. Generate a variation or edit this slot.');}else chooseSlot(i);};card.append(b);
  if(slot.editor){const preview=document.createElement('button');preview.id='slot-preview-'+i;preview.textContent='▶';preview.setAttribute('aria-label','Preview '+slot.name);preview.onclick=()=>{if(mode==='pattern'&&i!==bank!.active){chooseSlot(i);return;}stop();input('transport-target').value='pattern';syncHud();activateSlot(i);void play().catch(e=>status(String(e),true));};card.append(preview);}
  if(bank!.slots.length>1){const del=document.createElement('button');del.className='slot-del-btn';del.textContent='✕';del.title='Delete '+slot.name;del.setAttribute('aria-label','Delete '+slot.name);del.onclick=(e)=>{e.stopPropagation();stop();stashSlot();deletePatternSlot(bank!,i);slotEditors.clear();activateSlot(bank!.active);renderBank();scheduleSave();status('Deleted pattern.');};card.append(del);}
  host.append(card);});
 input('song-bpm').value=String(bank.songBpm);syncHud();
 let firstBar=1;
 const seq=el('sequence');seq.replaceChildren();bank.sequence.forEach((step,i)=>{const row=document.createElement('div');row.className='sequence-step';row.dataset.step=String(i);const title=document.createElement('span');title.textContent=String(i+1)+'. '+bank!.slots[step.slot]!.name;row.append(title);
 const barCount=bank!.slots[step.slot]!.editor!.pattern.settings.bars*step.repeats;
 const range=document.createElement('small');range.className='sequence-range';range.textContent='Bars '+firstBar+'–'+(firstBar+barCount-1);firstBar+=barCount;row.append(range);
 title.draggable=true;title.title='Drag this heading to reorder the song';row.setAttribute('aria-label','Step '+(i+1)+': '+bank!.slots[step.slot]!.name+', '+range.textContent);
 row.ondragstart=e=>{if((e.target as HTMLElement).closest('input,button')){e.preventDefault();return;}draggedStep=i;e.dataTransfer?.setData('text/plain',String(i));if(e.dataTransfer)e.dataTransfer.effectAllowed='move';};
 row.ondragover=e=>{if(draggedStep!==undefined){e.preventDefault();row.classList.add('drop-target');}};
 row.ondragleave=()=>row.classList.remove('drop-target');
 row.ondragend=()=>{draggedStep=undefined;document.querySelectorAll('.drop-target').forEach(e=>e.classList.remove('drop-target'));};
 row.ondrop=e=>{e.preventDefault();if(draggedStep===undefined)return;stop();moveSequenceStep(bank!,draggedStep,i);draggedStep=undefined;renderBank();scheduleSave();};
 const label=document.createElement('label');label.textContent='Repeats ';const count=document.createElement('input');count.type='number';count.min='1';count.max='16';count.value=String(step.repeats);count.setAttribute('aria-label','Repeats for step '+(i+1));count.onchange=()=>{const v=Number(count.value);if(!Number.isInteger(v)||v<1||v>16){count.value=String(step.repeats);return;}stop();step.repeats=v;renderBank();scheduleSave();};label.append(count);row.append(label);
 for(const [text,delta] of [['Move up',-1],['Move down',1],['Remove',0]] as const){const b=document.createElement('button');b.textContent=text;b.disabled=delta!==0&&(i+delta<0||i+delta>=bank!.sequence.length);b.onclick=()=>{stop();if(delta===0)bank!.sequence.splice(i,1);else moveSequenceStep(bank!,i,i+delta);renderBank();scheduleSave();const focusStep=Math.min(delta===0?i:i+delta,bank!.sequence.length-1);el('sequence').querySelector<HTMLElement>('[data-step="'+focusStep+'"] button:not(:disabled)')?.focus();};row.append(b);}seq.append(row);});
 const select=el<HTMLSelectElement>('append-slot'),value=select.value;select.replaceChildren();bank.slots.forEach((s,i)=>{if(s.editor){const o=document.createElement('option');o.value=String(i);o.textContent=s.name;select.append(o);}});if(Array.from(select.options).some(o=>o.value===value))select.value=value;
 const bars=bank.sequence.reduce((n,s)=>n+bank!.slots[s.slot]!.editor!.pattern.settings.bars*s.repeats,0);el('arrangement-info').textContent=bars+' bars - '+(bars*240/bank.songBpm).toFixed(1)+' seconds - '+bank.songBpm+' BPM · max 170s';input('play-arrangement').disabled=!bars;input('export-arrangement').disabled=!bars;input('append-step').disabled=bank.sequence.length>=64;
}
function arrangementAudio(rate:number){stashSlot();return renderSequence(arrange(bank!).map(p=>withDrumKit(p,drumKit,kitPanel.mix)),assets,rate,effectMap());}
el('append-step').onclick=()=>{stop();if(bank!.sequence.length>=64)return;bank!.sequence.push({slot:Number(input('append-slot').value),repeats:1});renderBank();scheduleSave();};
function revealPlaybackItem(container:HTMLElement, item:Element|null, inset=0){
 if(!item||!container.clientHeight)return;
 const bounds=container.getBoundingClientRect(),target=item.getBoundingClientRect();
 if(target.bottom>bounds.bottom)container.scrollTop+=target.bottom-bounds.bottom;
 else if(target.top<bounds.top+inset)container.scrollTop-=bounds.top+inset-target.top;
}
async function playArrangement(){
 if(mode){stop();return;}
 stop();samplePanel.stop();context??=new AudioContext();const token=playToken;
 await context.resume();if(token!==playToken)return;
 const audio=arrangementAudio(context.sampleRate),timeline=songTimeline(bank!),buffer=audioBuffer(audio),start=context.currentTime+.05;
 input('transport-target').value='song';syncHud();
 startSource(buffer,start);mode='arrangement';el('transport-state').textContent='Song playing';el('play-arrangement').textContent='Stop arrangement';el('play').textContent='Stop';
 let lastPosition='';
 timer=setInterval(()=>{
  const elapsed=context!.currentTime-start,position=songPosition(timeline,Math.max(0,elapsed));
  if(position){
   if(bank!.active!==position.slot)activateSlot(position.slot);
   document.querySelectorAll('.playing-step').forEach(e=>e.classList.remove('playing-step'));
   document.querySelector('[data-step="'+position.step+'"]')?.classList.add('playing-step');
   document.querySelector('.playing-row')?.classList.remove('playing-row');
   document.querySelector('[data-play-row="'+position.row+'"]')?.classList.add('playing-row');
   const beat=Math.max(0,elapsed)*bank!.songBpm/60;
   el('hud-pos-val').textContent=String(Math.floor(beat/4)+1).padStart(2,'0')+'.'+(Math.floor(beat%4)+1);
   const key=position.step+':'+position.repeat+':'+position.row;
   if(key!==lastPosition){
    lastPosition=key;
    revealPlaybackItem(el('grid'),document.querySelector('.playing-row'),el('grid').querySelector('thead')?.getBoundingClientRect().height??0);
    const tray=document.querySelector<HTMLElement>('#tray-left .tray-body');if(tray)revealPlaybackItem(tray,document.querySelector('.playing-step'));
    el('transport-state').textContent='Song · Step '+(position.step+1)+' / '+bank!.sequence.length;
    el('song-position').textContent='Step '+(position.step+1)+' / '+bank!.sequence.length+' · '+bank!.slots[position.slot]!.name+' · Repeat '+(position.repeat+1)+' / '+bank!.sequence[position.step]!.repeats;
    const solo=ROLES.some(r=>kitPanel.mix[r].solo);
    for(const note of transfer.notes.filter(n=>n.row===position.row))if(!kitPanel.mix[note.lane].mute&&(!solo||kitPanel.mix[note.lane].solo))flashTrackMeter(note.lane,kitPanel.mix[note.lane].level*(pattern.events.find(h=>h.id===note.id)?.gain??1));
   }
  }else{
   document.querySelectorAll('.playing-step,.playing-row').forEach(e=>e.classList.remove('playing-step','playing-row'));
   el('song-position').textContent='Song ending · effect tails';
  }
  if(elapsed>=buffer.duration)stop();
 },25);
}
function exportArrangement(){
 const audio=arrangementAudio(44100);
 downloadBytes(encodeWav(audio.channels,audio.sampleRate),'breakbeat-arrangement.wav');
 status('Full song exported at '+bank!.songBpm+' BPM with continuous effects and final tails.');
}
el('play-arrangement').onclick=()=>{playArrangement().catch(e=>{stop();status(String(e),true);});};
el('export-arrangement').onclick=()=>{try{exportArrangement();}catch(e){status(String(e),true);}};
el('transport-target').onchange=()=>{stop();syncHud();};
el('export-target').onchange=()=>{input('export-mode').disabled=input('export-target').value==='song';};
el('song-bpm').onchange=()=>{
 const bpm=Number(input('song-bpm').value);
 if(!Number.isFinite(bpm)||bpm<32||bpm>999){input('song-bpm').value=String(bank!.songBpm);status('Song tempo must be between 32 and 999 BPM.',true);return;}
 stop();bank!.songBpm=bpm;renderBank();scheduleSave();status('Song tempo updated. Pattern tempos are unchanged.');
};
function syncSliders(){
  const bpm=Number(input('bpm').value);
  input('bpm-slider').max=String(Math.max(300,Number.isFinite(bpm)?bpm:300));
  input('bpm-slider').value=String(bpm);
  el('complexity-value').textContent=Math.round(Number(input('complexity').value)*100)+'%';
  input('complexity').setAttribute('aria-valuetext',el('complexity-value').textContent!);
  const spicyVal=Number(input('spicy').value);
  const spicyEl=document.getElementById('spicy-value');
  if(spicyEl){
    const pct=Math.round(spicyVal*100);
    const tag=spicyVal>=0.7?' 🔥 Chaos':spicyVal>=0.35?' 🌶️ Spicy':spicyVal>0?' 🌶️ Mild':' Off';
    spicyEl.textContent=pct+'%'+tag;
    input('spicy').setAttribute('aria-valuetext',spicyEl.textContent);
  }
  syncHud();
}
function breakDescription(){
  const key=input('breakStyle').value as BreakStyle;
  el('break-description').textContent=key==='genre'?'Use the selected genre’s rhythm.':BREAKS[key].description+' Genre still controls tempo suggestions, detail and fill intensity.';
}
function presets(){
  breakDescription();
  syncSliders();
  const genre=input('genre').value as Genre;
  const isNew=Object.hasOwn(NEW_GENRES,genre);input('algorithm').querySelector<HTMLOptionElement>('[value="legacy-v1"]')!.disabled=isNew;
  if(isNew&&input('algorithm').value==='legacy-v1')input('algorithm').value='groove-v2';
  const p=PROFILES[genre];el('genre-description').textContent=p.description??'A repeating motif with '+GROOVES[genre].fillStyle+' fills and instrument-specific groove.';const container=el('presets');container.replaceChildren();
  for(const bpm of p.presets){const button=document.createElement('button');button.textContent=String(bpm);button.onclick=()=>{input('bpm').value=String(bpm);syncSliders();dirty();};container.append(button);}
}
function dirty(){scheduleSave();status('Settings changed. Press Generate to apply; the displayed pattern remains the export target.');}

el('generate').onclick=build;
el('clear-selection').onclick=()=>{editor.state.selection=emptySelection();render();};
el('select-range').onclick=()=>selectRows(Number(input('row-start').value),Number(input('row-end').value));
el('select-ending').onclick=()=>selectRows(transfer.timing.lines-transfer.timing.lpb,transfer.timing.lines-1);
el('lock-selected').onclick=()=>edit(()=>editor.toggleSelectedLocks(),'Selected hit locks updated. Drum-lane locks still take precedence.');
for(const role of ['kick','snare','hat','percussion'] as const)el(`lock-${role}`).onchange=()=>edit(()=>editor.toggleRole(role),`${role} lane lock updated.`);
el('mutate').onclick=()=>edit(()=>editor.mutate(),'Variation applied. Locked hits and main anchors are unchanged. Preview and export now use this edit.');
el('fill').onclick=()=>edit(()=>editor.fill(),'Fill applied to the selected rows. Locked hits and main anchors are unchanged.');
function history(direction:'undo'|'redo'){
  stop();if(editor[direction]()){syncControls();refresh();status(direction==='undo'?'Undid the last edit.':'Redid the last edit.');}
}
el('undo').onclick=()=>history('undo');el('redo').onclick=()=>history('redo');
document.addEventListener('keydown',event=>{
  if((event.target as HTMLElement).closest('input,select,textarea,[contenteditable="true"]'))return;
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();history(event.shiftKey?'redo':'undo');}
  else if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();history('redo');}
});
el('regenerate').onclick=()=>{if(pendingCount()){status('Apply or Revert pending hit edits before generating a variation.',true);return;}edit(()=>editor.variation(),'Related variation generated. Seed, core motif, anchors and locks are retained.');syncControls();};
el('export-wav').onclick=()=>{
  try{
    if(input('export-target').value==='song'){exportArrangement();return;}
    const modeEl=document.getElementById('export-mode') as HTMLSelectElement | null;
    const isLoop=modeEl?.value!=='tail';
    const audio=renderPerformance(
      withDrumKit(pattern,drumKit,kitPanel.mix),
      assets,
      44100,
      effectMap(),
      isLoop ? {loop:true} : {trimSilence:true,maxTailSeconds:3}
    );
    const filename=isLoop?transfer.genre+'-pattern.wav':transfer.genre+'-pattern-tail.wav';
    downloadBytes(encodeWav(audio.channels,audio.sampleRate),filename);
    status(isLoop
      ? `Seamless loop WAV exported (${pattern.settings.bars} bars, ${(audio.channels[0]!.length/audio.sampleRate).toFixed(2)}s) with wrapped tails.`
      : `Pattern WAV exported with natural decay tail (${(audio.channels[0]!.length/audio.sampleRate).toFixed(2)}s).`
    );
  }
  catch(e){status((e as Error).message,true);}
};
el('export').onclick=download;el('play').onclick=()=>{play().catch(e=>status(String(e),true));};
el('copy').onclick=async()=>{
  el<HTMLDetailsElement>('more-actions').open=false;
  try{await navigator.clipboard.writeText(patternJSON());status('Copied pattern JSON for inspection or sharing. Use WAV export for audio.');}
  catch{status('Clipboard unavailable. Download pattern JSON works without clipboard permission.',true);}
};
input('bpm').addEventListener('input',()=>{syncSliders();});
input('bpm-slider').addEventListener('input',()=>{input('bpm').value=input('bpm-slider').value;syncSliders();});
input('complexity').addEventListener('input',syncSliders);
input('spicy').addEventListener('input',syncSliders);

el('breakStyle').onchange=()=>{breakDescription();dirty();};
function restoreGenerationDefaults(){
 const genre=input('genre').value as Genre;
 input('algorithm').querySelector<HTMLOptionElement>('[value="legacy-v1"]')!.disabled=Object.hasOwn(NEW_GENRES,genre);
 for(const [key,value] of Object.entries(genreDefaults(genre)))input(key).value=String(value);
 const autoKit=document.getElementById('auto-kit') as HTMLInputElement | null;
 if(autoKit&&autoKit.checked){
   const defaultKitId=GENRE_KITS[genre]||'acoustic-break';
   void kitPanel.applyPreset(defaultKitId);
   const ks=document.getElementById('kit-preset-select') as HTMLSelectElement | null;
   if(ks) ks.value=defaultKitId;
   const gks=document.getElementById('generator-kit-select') as HTMLSelectElement | null;
   if(gks) gks.value=defaultKitId;
 }
 presets();scheduleSave();status(PROFILES[genre].name+' generation defaults loaded, including BPM and advanced settings. Press Generate to apply to the pattern.');
}
el('restore-defaults').onclick=restoreGenerationDefaults;
el('view').onchange=()=>render();el('genre').onchange=restoreGenerationDefaults;
for(const control of document.querySelectorAll('#controls input, #controls select'))control.addEventListener('input',dirty);
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
for(const family of ['Jungle & DnB','Hip-Hop & Downtempo','Garage','Dub & Bass','Breaks & Rave','Experimental']){
 const group=document.createElement('optgroup');group.label=family;
 for(const [value,profile] of Object.entries(PROFILES).sort(([a],[b])=>a==='jungle'?-1:b==='jungle'?1:0)){
  if(GROOVES[value as Genre].family!==family)continue;
  const option=document.createElement('option');option.value=value;option.textContent=profile.name;group.append(option);
 }
 el('genre').append(group);
}

for(const [value,preset] of Object.entries(BREAKS)){
  const option=document.createElement('option');option.value=value;option.textContent=preset.name;el('breakStyle').append(option);
}
function initKitPresetSelect(selectId: string){
  const kitSelect=document.getElementById(selectId) as HTMLSelectElement | null;
  if(!kitSelect) return;
  kitSelect.replaceChildren();
  const customOpt=document.createElement('option');
  customOpt.value='custom';
  customOpt.textContent='Custom Kit';
  kitSelect.append(customOpt);
  for(const p of KIT_PRESETS){
    const opt=document.createElement('option');
    opt.value=p.id;
    opt.textContent=p.name;
    kitSelect.append(opt);
  }
  kitSelect.onchange=async()=>{
    if(kitSelect.value!=='custom'){
      await kitPanel.applyPreset(kitSelect.value);
      const otherId=selectId==='kit-preset-select'?'generator-kit-select':'kit-preset-select';
      const other=document.getElementById(otherId) as HTMLSelectElement | null;
      if(other) other.value=kitSelect.value;
      dirty();
    }
  };
}
initKitPresetSelect('kit-preset-select');
initKitPresetSelect('generator-kit-select');

function patternJSON(){
  const pattern=withDrumKit(editor.state.pattern,drumKit,kitPanel.mix);
  if(!pattern.events.length||ROLES.some(r=>kitPanel.mix[r].level!==1||kitPanel.mix[r].tune!==0||kitPanel.mix[r].mute||kitPanel.mix[r].reverse||(kitPanel.mix[r].effects&&!kitPanel.mix[r].effects!.bypass&&(kitPanel.mix[r].effects!.highpass>0||kitPanel.mix[r].effects!.lowpass<20000||kitPanel.mix[r].effects!.drive>0||kitPanel.mix[r].effects!.mix>0)))||pattern.events.some(h=>h.slice||h.pitch||h.fineOffset||h.reverse||h.ratchets&&h.ratchets>1||h.gate!==undefined))return JSON.stringify({...JSON.parse(serialize(transfer)),format:'breakbeat-notes',version:1,pattern,effects:effectMap(),audioAssets:[...new Set(pattern.events.flatMap(h=>h.slice?[h.slice.assetId]:[]))].map(id=>{const a=assets.get(id);return {id,name:a?.name,sampleRate:a?.sampleRate};}),notice:'Audio assets are not included. Export WAV to preserve the sound.'},null,2);
  return serialize(transfer);
}
function currentAsset(){
  const current=samplePanel.getAsset();if(!current)throw Error('Import and chop a sample first.');
  if(!assets.has(current.id)&&[...assets.values()].reduce((sum,a)=>sum+a.channels.reduce((n,c)=>n+c.byteLength,0),0)+current.buffer.length*current.buffer.numberOfChannels*4>256*1024*1024)throw Error('Session audio limit reached (256 MB). Export your WAV before refreshing to start a new session.');
  if(!assets.has(current.id))assets.set(current.id,{id:current.id,name:current.name,sampleRate:current.buffer.sampleRate,channels:Array.from({length:current.buffer.numberOfChannels},(_,i)=>current.buffer.getChannelData(i))});
  return {...current,asset:assets.get(current.id)!};
}
const hitFields=['edit-row','edit-lane','edit-sound','edit-volume','edit-pan','edit-delay','edit-pitch','edit-reverse','edit-ratchets','edit-gate'] as const;
type HitDraft=Partial<Record<typeof hitFields[number],string>>;
const hitDrafts=new Map<Editor,Map<string,HitDraft>>();
let draftTargets:{slot:number;id:string}[]=[];
let entryKey:string|undefined,entryOwner:Editor|undefined,entryBaseline:HitDraft={},pitchGesture:HitDraft|undefined,pitchCancelled=false;
function draftMap(){let map=hitDrafts.get(editor);if(!map){map=new Map();hitDrafts.set(editor,map);}return map;}
function fieldValue(id:typeof hitFields[number]){return id==='edit-reverse'?String(input(id).checked):input(id).value;}
function setField(id:typeof hitFields[number],value:string){if(id==='edit-reverse')input(id).checked=value==='true';else input(id).value=value;}
function captureHitDraft(){if(!entryKey||entryOwner!==editor)return;const draft:HitDraft={};for(const id of hitFields)if(fieldValue(id)!==entryBaseline[id])draft[id]=fieldValue(id);if(Object.keys(draft).length)draftMap().set(entryKey,draft);else draftMap().delete(entryKey);updateDraftStatus();}
function pendingCount(){return [...hitDrafts.values()].reduce((n,m)=>n+m.size,0);}
function updateDraftStatus(){
 const hit=pattern?.events.find(h=>h.id===entryKey),isLocked=!!hit&&locked(editor.state,hit),pending=!!entryKey&&draftMap().has(entryKey);
 el('hit-draft-status').textContent=!hit?'Select a hit, or use Insert hit to create a note at the cursor.':isLocked?'Locked — unlock to edit.':pending?'Pending changes · Preview includes these values. Apply or Revert. Kept in this session when switching hits.':pendingCount()?pendingCount()+' other hit draft(s) kept in this session.':'Saved hit · Pitch slider saves on release; other edits use Apply.';
 input('hit-revert').disabled=!pending;input('hit-unlock').hidden=!isLocked;el('hit-unlock').textContent=hit&&editor.state.lockedRoles.includes(hit.role)?'Unlock lane and hit':'Unlock hit';
 for(const id of [...hitFields,'edit-pitch-slider'])input(id).disabled=isLocked;
 input('hit-apply').disabled=!hit||isLocked||!pending;input('hit-insert').disabled=isLocked;
 el('hit-preview').textContent=pending?'Preview pending hit':'Preview selected hit';
 el('hit-draft-status').classList.toggle('pending',pending);
 const select=el<HTMLSelectElement>('hit-drafts');select.replaceChildren();const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Go to a pending hit…';select.append(placeholder);draftTargets=[];
 for(const [slot,owner] of slotEditors)for(const id of hitDrafts.get(owner)?.keys()??[]){const h=owner.state.pattern.events.find(h=>h.id===id);if(!h)continue;const option=document.createElement('option');option.value=String(draftTargets.length);option.textContent=(bank?.slots[slot]?.name??String(slot))+' · '+h.role+' · row '+compile(owner.state.pattern).notes.find(n=>n.id===id)?.row;select.append(option);draftTargets.push({slot,id});}
 el('hit-drafts-label').hidden=!draftTargets.length;
}
for(const id of hitFields)input(id).addEventListener('input',captureHitDraft);
function revertHitDraft(){if(entryKey)draftMap().delete(entryKey);pitchGesture=undefined;render();}
el('hit-revert').onclick=revertHitDraft;
el('hit-drafts').onchange=()=>{if(input('hit-drafts').value==='')return;const target=draftTargets[Number(input('hit-drafts').value)];if(!target)return;stop();activateSlot(target.slot);editor.state.selection={ids:[target.id],rows:null};showHitEditor();render();};
el('hit-unlock').onclick=()=>edit(()=>{const hit=pattern.events.find(h=>h.id===entryKey);if(!hit)return false;return editor.unlockHit(hit.id);},'Unlocked hit and its lane.');
window.addEventListener('beforeunload',event=>{if(pendingCount()){event.preventDefault();event.returnValue='';}});
function syncHitPitch(){
 const value=Number(input('edit-pitch').value);
 if(input('edit-pitch').value!==''&&Number.isFinite(value)&&value>=-48&&value<=48){
  input('edit-pitch-slider').value=String(value);
  const label=(value>0?'+':'')+value+' st';el('edit-pitch-value').textContent=label;
  input('edit-pitch-slider').setAttribute('aria-valuetext',value+' semitones');
 }else el('edit-pitch-value').textContent='−48 to +48 st';
}
input('edit-pitch-slider').addEventListener('pointerdown',()=>{pitchCancelled=false;pitchGesture={...(entryKey?draftMap().get(entryKey):{})};});
input('edit-pitch-slider').addEventListener('input',()=>{if(pitchCancelled){syncHitPitch();return;}input('edit-pitch').value=input('edit-pitch-slider').value;syncHitPitch();captureHitDraft();});
input('edit-pitch-slider').addEventListener('change',()=>{
 if(pitchCancelled){syncHitPitch();return;}
 const hit=pattern.events.find(h=>h.id===entryKey);if(!hit||locked(editor.state,hit))return;
 const pitch=Number(input('edit-pitch').value);if(pitch===(hit.pitch??0)){pitchGesture=undefined;return;}
 stop();if(editor.write({...hit,pitch},hit.id)){const draft=draftMap().get(hit.id);if(draft){delete draft['edit-pitch'];if(!Object.keys(draft).length)draftMap().delete(hit.id);}pitchGesture=undefined;refresh();status('Pitch saved. One Undo restores the previous pitch.');}
});
input('edit-pitch-slider').addEventListener('pointercancel',()=>{if(entryKey&&pitchGesture){if(Object.keys(pitchGesture).length)draftMap().set(entryKey,pitchGesture);else draftMap().delete(entryKey);}pitchGesture=undefined;render();});
input('edit-pitch-slider').addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key)){pitchCancelled=false;pitchGesture={...(entryKey?draftMap().get(entryKey):{})};}if(event.key==='Escape'){event.preventDefault();event.stopPropagation();pitchCancelled=true;if(entryKey){const restore=pitchGesture??{...draftMap().get(entryKey)};if(!pitchGesture)delete restore['edit-pitch'];if(Object.keys(restore).length)draftMap().set(entryKey,restore);else draftMap().delete(entryKey);}pitchGesture=undefined;render();}});
input('edit-pitch').addEventListener('input',syncHitPitch);
function updateEntry(hit?:Hit){
  input('edit-row').max=String(transfer.timing.lines-1);rowAnchor=Math.min(rowAnchor,transfer.timing.lines-1);
  if(hit){
    const n=transfer.notes.find(n=>n.id===hit.id)!;input('edit-row').value=String(n.row);input('edit-lane').value=hit.role;
    input('edit-volume').value=String(n.volume);input('edit-pan').value=String(n.pan);input('edit-delay').value=String(n.delay);input('edit-pitch').value=String(hit.pitch??0);input('edit-reverse').checked=!!hit.reverse;input('edit-ratchets').value=String(hit.ratchets??1);const gateSelect=el<HTMLSelectElement>('edit-gate');gateSelect.querySelector('[data-custom]')?.remove();if(hit.gate!==undefined&&!Array.from(gateSelect.options).some(o=>Number(o.value)===hit.gate)){const option=document.createElement('option');option.dataset.custom='true';option.value=String(hit.gate);option.textContent=Math.round(hit.gate*100)+'%';gateSelect.append(option);}gateSelect.value=String(hit.gate??0);input('edit-sound').value='keep';
  }else{input('edit-row').value=String(rowAnchor);input('edit-lane').value=cursorLane;}
  el('inspector-context').textContent=hit?hit.role+' · row '+input('edit-row').value:'Row '+rowAnchor+' · '+cursorLane;
  entryKey=hit?.id;entryOwner=editor;entryBaseline=Object.fromEntries(hitFields.map(id=>[id,fieldValue(id)]));
  if(entryKey){const draft=draftMap().get(entryKey);if(draft){for(const id of hitFields){if(draft[id]===entryBaseline[id])delete draft[id];if(draft[id]!==undefined)setField(id,draft[id]!);}if(!Object.keys(draft).length)draftMap().delete(entryKey);}}
  syncHitPitch();
  input('hit-preview').disabled=editor.state.selection.ids.length!==1;
  input('hit-apply').disabled=editor.state.selection.ids.length!==1;
  input('hit-delete').disabled=selectedIds(editor.state).size===0;
  updateDraftStatus();
  el('edit-target').textContent=hit?((hit.slice??drumKit[hit.role])?'Sound: '+(hit.slice??drumKit[hit.role])!.label:'Sound: demo '+hit.role)+' · '+(locked(editor.state,hit)?'Locked':'Editable'):'Cursor: row '+rowAnchor+' / '+cursorLane;
}
function entryHit(replace:boolean,pitchOverride?:number){
  const row=Number(input('edit-row').value),delay=Number(input('edit-delay').value),volume=Number(input('edit-volume').value),pan=Number(input('edit-pan').value),pitch=pitchOverride??Number(input('edit-pitch').value);
  if(!Number.isInteger(row)||row<0||row>=transfer.timing.lines||!Number.isInteger(delay)||delay<0||delay>255||!Number.isInteger(volume)||volume<0||volume>128||!Number.isInteger(pan)||pan<0||pan>128)throw Error('Use valid integer row, delay, volume and pan values.');
  const role=input('edit-lane').value as Role,prior=replace?pattern.events.find(h=>h.id===editor.state.selection.ids[0]):undefined;
  if(replace&&!prior)throw Error('Select one hit to edit.');
  const tick=(row+delay/256)*960/transfer.timing.lpb;
  const hit:Hit={id:prior?.id??'entry-'+crypto.randomUUID(),role,sourceId:'kit.'+role,baseTick:Math.floor(tick),fineOffset:tick-Math.floor(tick),offsetTick:0,gain:volume/128,pan:pan/64-1,pitch,reverse:input('edit-reverse').checked,ratchets:Number(input('edit-ratchets').value),...(Number(input('edit-gate').value)?{gate:Number(input('edit-gate').value)}:{}),anchor:prior?.anchor??false,ghost:prior?.ghost??false,reason:'A manually entered tracker hit.'};
  const oldNote=prior&&transfer.notes.find(n=>n.id===prior.id);
  if(prior&&oldNote?.row===row&&oldNote.delay===delay){hit.baseTick=prior.baseTick;hit.offsetTick=prior.offsetTick;hit.fineOffset=prior.fineOffset;}
  const sound=input('edit-sound').value;
  if(sound==='slice'){const a=currentAsset();hit.slice=sliceReference(a.asset,a.markers,a.selected);}
  else if(sound==='keep'&&prior?.slice)hit.slice={...prior.slice};
  compile({...pattern,events:[hit]});return {hit,prior};
}
function writeEntry(replace:boolean,pitchOverride?:number){const {hit,prior}=entryHit(replace,pitchOverride);const changed=editor.write(hit,prior?.id);if(changed&&entryKey)draftMap().delete(entryKey);return changed;}
el('original-groove').onclick=()=>{
  try{
    if(editor.state.lockedIds.length||editor.state.lockedRoles.length)throw Error('Unlock hits and lanes before replacing the pattern with the original groove.');
    const a=currentAsset();const next=reconstruct(a.asset,a.markers,settings());stop();samplePanel.stop();editor.replace(next);syncControls();refresh();
    status('Original groove reconstructed from '+a.markers.slice(0,-1).length+' slices. BPM inferred from the selected bar count. Play pattern or export WAV to hear it.');
  }catch(e){status((e as Error).message,true);}
};
el('hit-preview').onclick=async()=>{
 try{if(editor.state.selection.ids.length!==1)return;const {hit}=entryHit(true);
 flashTrackMeter(hit.role, (hit.gain ?? 1) * kitPanel.mix[hit.role].level);
 stop();samplePanel.stop();context??=new AudioContext();const token=playToken;await context.resume();if(token!==playToken)return;
 const one=structuredClone(pattern);one.events=[{...hit,baseTick:0,offsetTick:0,fineOffset:0}];
 const audio=renderPerformance(withDrumKit(one,drumKit,kitPanel.mix),assets,context.sampleRate,effectMap());startSource(audioBuffer(audio),context.currentTime);
 status('Previewing the inspector values, including pending changes. Pattern playback and exports use saved hits.');
 }catch(e){status(String(e),true);}
};
el('hit-insert').onclick=()=>edit(()=>writeEntry(false),'Inserted tracker hit.');
el('hit-apply').onclick=()=>edit(()=>writeEntry(true),'Updated tracker hit.');
el('hit-delete').onclick=()=>edit(()=>editor.deleteSelected(),'Deleted unlocked selected hits.');
el('grid').addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === ' ') {
    event.preventDefault();
    void play().catch(e => status(String(e), true));
    return;
  }
  if (event.key === 'Tab') {
    event.preventDefault();
    const curIdx = ROLES.indexOf(cursorLane);
    const nextIdx = event.shiftKey ? (curIdx + 3) % 4 : (curIdx + 1) % 4;
    cursorLane = ROLES[nextIdx]!;
    editor.state.selection = emptySelection();
    updateEntry();
    render();
    el('grid').focus();
    return;
  }
  if (event.key.startsWith('Arrow')) {
    event.preventDefault();
    rowAnchor = Math.max(0, Math.min(transfer.timing.lines - 1, rowAnchor + (event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0)));
    cursorLane = ROLES[Math.max(0, Math.min(3, ROLES.indexOf(cursorLane) + (event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0)))]!;
    editor.state.selection = emptySelection();
    updateEntry();
    render();
    el('grid').focus();
    return;
  }
  if (!input('keyboard-entry').checked || event.repeat) return;
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    if (editor.state.selection.ids.length === 0) {
      const hitAtCursor = pattern.events.find(e => {
        const n = transfer.notes.find(note => note.id === e.id);
        return n && n.row === rowAnchor && n.lane === cursorLane;
      });
      if (hitAtCursor) {
        editor.state.selection = {ids: [hitAtCursor.id], rows: null}; edit(() => editor.deleteSelected(), 'Deleted hit at row ' + rowAnchor + '.');
        el('grid').focus();
        return;
      }
    }
    edit(() => editor.deleteSelected(), 'Deleted unlocked hits.');
    el('grid').focus();
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    const step = getTrackerStep();
    const hitAtCursor = pattern.events.find(e => {
      const n = transfer.notes.find(note => note.id === e.id);
      return n && n.row === rowAnchor && n.lane === cursorLane;
    });
    try {
      stop();
      const changed = writeEntry(!!hitAtCursor);
      if (changed) {
        void auditionRole(cursorLane);
        rowAnchor = Math.min(transfer.timing.lines - 1, rowAnchor + step);
        editor.state.selection = emptySelection();
      }
      refresh();
      el('grid').focus();
      status(changed ? 'Note entered.' : 'The target is locked.');
    } catch (e) { status((e as Error).message, true); }
    return;
  }
  const velMap: Record<string, number> = {'1': 16, '2': 32, '3': 48, '4': 64, '5': 80, '6': 96, '7': 112, '8': 120, '9': 128};
  if (velMap[event.key]) {
    const hitAtCursor = pattern.events.find(e => {
      const n = transfer.notes.find(note => note.id === e.id);
      return n && n.row === rowAnchor && n.lane === cursorLane;
    });
    if (hitAtCursor && !locked(editor.state, hitAtCursor)) {
      event.preventDefault();
      const gain = velMap[event.key]! / 128;
      editor.write({ ...hitAtCursor, gain }, hitAtCursor.id);
      void auditionRole(cursorLane);
      refresh();
      el('grid').focus();
      status(`Velocity set to ${velMap[event.key]} (0x${hex(velMap[event.key]!)}).`);
      return;
    }
  }
  if (event.key === '+' || event.key === '=' || event.key === '-' || event.key === '_') {
    const hitAtCursor = pattern.events.find(e => {
      const n = transfer.notes.find(note => note.id === e.id);
      return n && n.row === rowAnchor && n.lane === cursorLane;
    });
    if (hitAtCursor && !locked(editor.state, hitAtCursor)) {
      event.preventDefault();
      const delta = (event.key === '+' || event.key === '=') ? 1 : -1;
      const pitch = (hitAtCursor.pitch ?? 0) + delta;
      if (pitch >= -48 && pitch <= 48) {
        editor.write({ ...hitAtCursor, pitch }, hitAtCursor.id);
        void auditionRole(cursorLane);
        refresh();
        el('grid').focus();
        status(`Pitch transposed to ${pitch > 0 ? '+' : ''}${pitch} st.`);
        return;
      }
    }
  }
  const lowerNotes = ['z', 's', 'x', 'd', 'c', 'v', 'g', 'b', 'h', 'n', 'j', 'm'];
  const upperNotes = ['q', '2', 'w', '3', 'e', 'r', '5', 't', '6', 'y', '7', 'u'];
  const keyLower = event.key.toLowerCase();
  let semitone = -1;
  const lowIdx = lowerNotes.indexOf(keyLower);
  if (lowIdx >= 0) semitone = lowIdx;
  else {
    const upIdx = upperNotes.indexOf(keyLower);
    if (upIdx >= 0) semitone = 12 + upIdx;
  }
  if (semitone < 0) return;
  event.preventDefault();
  const basePitch = Number(input('edit-pitch').value), step = getTrackerStep(), sound = input('edit-sound').value;
  try {
    stop();
    const hitAtCursor = pattern.events.find(e => {
      const n = transfer.notes.find(note => note.id === e.id);
      return n && n.row === rowAnchor && n.lane === cursorLane;
    });
    const changed = writeEntry(!!hitAtCursor, basePitch + semitone);
    if (changed) {
      void auditionRole(cursorLane);
      rowAnchor = Math.min(transfer.timing.lines - 1, rowAnchor + step);
      editor.state.selection = emptySelection();
    }
    refresh();
    input('edit-pitch').value = String(basePitch);
    syncHitPitch();
    input('edit-sound').value = sound;
    el('grid').focus();
    status(changed ? 'Keyboard note entered.' : 'The target is locked.');
  } catch (e) { status((e as Error).message, true); }
});

function snapshot(){
  if(kitPanel.busy)throw Error('Wait for the sample to finish loading.');
  let draft=pattern.settings;try{const candidate=settings();generate(candidate);draft=candidate;}catch{}
  stashSlot();return makeProject(editor.state,draft,kitPanel.snapshot(),assets,bank);
}
function scheduleSave(){
  if(!persistenceReady)return;clearTimeout(saveTimer);el('save-status').textContent='Saving locally…';
  saveTimer=setTimeout(()=>{try{const value=snapshot();saveQueue=saveQueue.catch(()=>{}).then(()=>localProject(value)).then(()=>{el('save-status').textContent='Saved locally';}).catch(e=>{el('save-status').textContent='Autosave unavailable — use Save project';console.error(e);});}catch(e){el('save-status').textContent=String(e);}},600);
}
function applyProject(raw:unknown){
  const {project:p,assets:loaded}=readProject(raw);if(pendingCount()&&!confirm('Opening this project discards pending hit edits. Continue?'))return false;hitDrafts.clear();stop();samplePanel.stop();
  assets.clear();loaded.forEach((a,id)=>assets.set(id,a));kitPanel.restore(p.kit);
  bank=p.bank?structuredClone(p.bank):newBank(p.editor.pattern);slotEditors.clear();
  editor=new Editor(p.editor.pattern);editor.state=structuredClone(p.editor);rowAnchor=0;
  input('algorithm').value=p.draft.algorithm??'legacy-v1';input('variation').value=String(p.draft.variation??0);
  for(const [key,value] of Object.entries(p.draft))if(key!=='enabledRoles')input(key).value=String(value);
  presets();refresh();return true;
}
el('project-save').onclick=()=>{try{if(pendingCount())throw Error('Apply or Revert pending hit edits before saving a project backup.');const data=snapshot();downloadBytes(new TextEncoder().encode(JSON.stringify(data)).buffer,'breakbeat-project.bbproject','application/json');status('Project saved with sample audio, kit, pattern and settings.');}catch(e){status(String(e),true);}};
el('project-open').onchange=async e=>{const field=e.target as HTMLInputElement,file=field.files?.[0];field.value='';if(!file)return;
  try{if(file.size>384*1024*1024)throw Error('Project exceeds 384 MB.');const raw=JSON.parse(await file.text());if(applyProject(raw)){scheduleSave();status('Project opened. Samples and instrument choices restored.');}}catch(e){status('Could not open project: '+String(e),true);}
};
el('project-new').onclick=()=>{
  if(!confirm('Start a new project? Save project first to keep your current work.'))return;
  hitDrafts.clear();stop();samplePanel.stop();assets.clear();bank=undefined;slotEditors.clear();kitPanel.restore(defaultKitState());editor=new Editor(generate(genreDefaults('jungle')));syncControls();
  const genre=input('genre').value as Genre,defaultKitId=GENRE_KITS[genre]||'acoustic-break';
  void kitPanel.applyPreset(defaultKitId);
  const ks=document.getElementById('kit-preset-select') as HTMLSelectElement | null;if(ks)ks.value=defaultKitId;const gks=document.getElementById('generator-kit-select') as HTMLSelectElement | null;if(gks)gks.value=defaultKitId;
  refresh();status('New project started.');
};
presets();build();
// Do not overwrite a stored workspace with the initial default pattern.
try{
  const saved=await localProject();
  if(saved){applyProject(saved);el('save-status').textContent='Restored local workspace';}
  else{
    const genre=input('genre').value as Genre,defaultKitId=GENRE_KITS[genre]||'acoustic-break';
    void kitPanel.applyPreset(defaultKitId);
    const ks=document.getElementById('kit-preset-select') as HTMLSelectElement | null;if(ks)ks.value=defaultKitId;const gks=document.getElementById('generator-kit-select') as HTMLSelectElement | null;if(gks)gks.value=defaultKitId;
  }
}catch(e){el('save-status').textContent='Could not restore autosave — use Open project';}
persistenceReady=true;


document.addEventListener('click',event=>{const more=el<HTMLDetailsElement>('more-actions');if(!more.contains(event.target as Node))more.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape')el<HTMLDetailsElement>('more-actions').open=false;});

// Workspace navigation changes presentation only, preserving edit and audio behavior.
el('show-sounds').onclick=()=>{el<HTMLDetailsElement>('sounds-panel').open=true;el('sounds-panel').scrollIntoView({behavior:'smooth',block:'nearest'});el('sounds-panel').querySelector('summary')?.focus();};
el('show-arrangement').onclick=()=>{el<HTMLDetailsElement>('arranger').open=true;el('arranger').scrollIntoView({behavior:'smooth',block:'nearest'});el('arranger').querySelector('summary')?.focus();};

el('back-to-pattern').onclick=()=>{el('grid').scrollIntoView({behavior:'smooth',block:'start'});el('grid').focus({preventScroll:true});};

document.querySelector('.tracker-edit')!.addEventListener('keydown',event=>{const e=event as KeyboardEvent;if((e.target as HTMLElement).id==='edit-pitch-slider')return;if(e.key==='Escape'){e.preventDefault();revertHitDraft();}else if(e.key==='Enter'&&(e.target as HTMLElement).matches('input[type=number]')&&!input('hit-apply').disabled){e.preventDefault();el('hit-apply').click();}});

// ============================================================================
// IN-PLACE TRACKER CONTROLLER & LIVE WORKFLOW
// Quick toolbar actions, step-advance, tactile transposition & rolls
// ============================================================================

function initTrackerLiveBar() {
  const stepSelect = document.getElementById('tracker-step-select') as HTMLSelectElement | null;
  if (stepSelect) {
    stepSelect.addEventListener('change', () => {
      input('edit-step').value = stepSelect.value;
      el('grid').focus();
    });
    input('edit-step').addEventListener('input', () => {
      stepSelect.value = input('edit-step').value;
    });
  }

  const quickInsert = document.getElementById('quick-insert-hit');
  if (quickInsert) {
    quickInsert.onclick = () => {
      const step = getTrackerStep();
      const hitAtCursor = pattern.events.find(e => {
        const n = transfer.notes.find(note => note.id === e.id);
        return n && n.row === rowAnchor && n.lane === cursorLane;
      });
      try {
        stop();
        const changed = writeEntry(!!hitAtCursor);
        if (changed) {
          void auditionRole(cursorLane);
          rowAnchor = Math.min(transfer.timing.lines - 1, rowAnchor + step);
          editor.state.selection = emptySelection();
        }
        refresh();
        el('grid').focus();
        status(changed ? 'Inserted note at cursor.' : 'The target is locked.');
      } catch (e) {
        status((e as Error).message, true);
      }
    };
  }

  const quickDelete = document.getElementById('quick-delete-hit');
  if (quickDelete) {
    quickDelete.onclick = () => {
      if (editor.state.selection.ids.length === 0) {
        const hitAtCursor = pattern.events.find(e => {
          const n = transfer.notes.find(note => note.id === e.id);
          return n && n.row === rowAnchor && n.lane === cursorLane;
        });
        if (hitAtCursor) {
          editor.state.selection = {ids: [hitAtCursor.id], rows: null}; edit(() => editor.deleteSelected(), 'Deleted hit at row ' + rowAnchor + '.');
          el('grid').focus();
          return;
        }
      }
      edit(() => editor.deleteSelected(), 'Deleted unlocked hits.');
      el('grid').focus();
    };
  }

  const quickGhost = document.getElementById('quick-ghost-hit');
  if (quickGhost) {
    quickGhost.onclick = () => {
      const hitAtCursor = pattern.events.find(e => {
        const n = transfer.notes.find(note => note.id === e.id);
        return n && n.row === rowAnchor && n.lane === cursorLane;
      });
      if (hitAtCursor && !locked(editor.state, hitAtCursor)) {
        editor.write({ ...hitAtCursor, ghost: !hitAtCursor.ghost }, hitAtCursor.id);
        refresh();
        el('grid').focus();
        status(hitAtCursor.ghost ? 'Removed ghost flag.' : 'Converted to ghost note.');
      } else {
        status('Move cursor to an editable hit to toggle ghost.', true);
      }
    };
  }

  const quickRoll2 = document.getElementById('quick-roll-2');
  if (quickRoll2) {
    quickRoll2.onclick = () => {
      const hitAtCursor = pattern.events.find(e => {
        const n = transfer.notes.find(note => note.id === e.id);
        return n && n.row === rowAnchor && n.lane === cursorLane;
      });
      if (hitAtCursor && !locked(editor.state, hitAtCursor)) {
        const nextRatchets = hitAtCursor.ratchets === 2 ? 1 : 2;
        editor.write({ ...hitAtCursor, ratchets: nextRatchets }, hitAtCursor.id);
        refresh();
        el('grid').focus();
        status(nextRatchets === 2 ? 'Set 2 ratchets (roll ×2).' : 'Cleared roll ratchets.');
      } else {
        status('Move cursor to an editable hit to set ratchets.', true);
      }
    };
  }

  const quickRoll4 = document.getElementById('quick-roll-4');
  if (quickRoll4) {
    quickRoll4.onclick = () => {
      const hitAtCursor = pattern.events.find(e => {
        const n = transfer.notes.find(note => note.id === e.id);
        return n && n.row === rowAnchor && n.lane === cursorLane;
      });
      if (hitAtCursor && !locked(editor.state, hitAtCursor)) {
        const nextRatchets = hitAtCursor.ratchets === 4 ? 1 : 4;
        editor.write({ ...hitAtCursor, ratchets: nextRatchets }, hitAtCursor.id);
        refresh();
        el('grid').focus();
        status(nextRatchets === 4 ? 'Set 4 ratchets (roll ×4).' : 'Cleared roll ratchets.');
      } else {
        status('Move cursor to an editable hit to set ratchets.', true);
      }
    };
  }

  const shiftPitch = (delta: number) => {
    const hitAtCursor = pattern.events.find(e => {
      const n = transfer.notes.find(note => note.id === e.id);
      return n && n.row === rowAnchor && n.lane === cursorLane;
    });
    if (hitAtCursor && !locked(editor.state, hitAtCursor)) {
      const pitch = (hitAtCursor.pitch ?? 0) + delta;
      if (pitch >= -48 && pitch <= 48) {
        editor.write({ ...hitAtCursor, pitch }, hitAtCursor.id);
        void auditionRole(cursorLane);
        refresh();
        el('grid').focus();
        status(`Pitch transposed to ${pitch > 0 ? '+' : ''}${pitch} st.`);
      }
    } else {
      status('Move cursor to an editable hit to transpose pitch.', true);
    }
  };

  const quickPitchUp = document.getElementById('quick-pitch-up');
  if (quickPitchUp) quickPitchUp.onclick = () => shiftPitch(1);
  const quickPitchDown = document.getElementById('quick-pitch-down');
  if (quickPitchDown) quickPitchDown.onclick = () => shiftPitch(-1);

  // Setup tap tempo
  const tapBtn = document.getElementById('hud-bpm-tap');
  if (tapBtn) {
    let tapTimes: number[] = [];
    tapBtn.addEventListener('click', () => {
      const now = performance.now();
      tapTimes = tapTimes.filter(t => now - t < 2500);
      tapTimes.push(now);
      if (tapTimes.length >= 2) {
        let intervalSum = 0;
        for (let i = 1; i < tapTimes.length; i++) {
          intervalSum += tapTimes[i]! - tapTimes[i - 1]!;
        }
        const avgInterval = intervalSum / (tapTimes.length - 1);
        if (avgInterval > 0) {
          const calculatedBpm = Math.max(32, Math.min(300, Math.round((60000 / avgInterval) * 10) / 10));
          stop();
          if(input('transport-target').value==='song'){bank!.songBpm=calculatedBpm;renderBank();scheduleSave();return;}
          input('bpm').value = calculatedBpm.toFixed(1);
          input('bpm-slider').value = calculatedBpm.toFixed(1);
          pattern.settings.bpm = calculatedBpm;
          syncHud();
          refresh();
        }
      }
      tapBtn.classList.add('flash');
      setTimeout(() => tapBtn.classList.remove('flash'), 120);
    });
  }
}

initTrackerLiveBar();

function initSubnavTabs() {
  const tabTracker = document.getElementById('tab-tracker');
  const tabSounds = document.getElementById('tab-sounds');
  const tabArranger = document.getElementById('tab-arranger');

  const setTabActive = (activeBtn: HTMLElement | null) => {
    [tabTracker, tabSounds, tabArranger].forEach(btn => {
      if (btn) btn.classList.toggle('active', btn === activeBtn);
    });
  };

  if (tabTracker) {
    tabTracker.onclick = () => {
      setTabActive(tabTracker);
      el('grid').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      el('grid').focus();
    };
  }

  if (tabSounds) {
    tabSounds.onclick = () => {
      setTabActive(tabSounds);
      document.getElementById('studio-layout')?.classList.remove('tray-right-collapsed');
      el<HTMLDetailsElement>('sounds-panel').open = true;
      el('sounds-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
  }

  if (tabArranger) {
    tabArranger.onclick = () => {
      setTabActive(tabArranger);
      document.getElementById('studio-layout')?.classList.remove('tray-left-collapsed');
      el<HTMLDetailsElement>('arranger').open = true;
      el('arranger').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
  }
}

initSubnavTabs();

function initWorkspaceTrays() {
  const shell = document.getElementById('studio-layout');
  const bottomTray = document.getElementById('tray-bottom');

  const toggleLeft = document.getElementById('toggle-tray-left');
  const railLeft = document.getElementById('rail-tray-left');
  const toggleRight = document.getElementById('toggle-tray-right');
  const railRight = document.getElementById('rail-tray-right');
  const toggleBottom = document.getElementById('toggle-tray-bottom');
  const barBottom = document.getElementById('bar-tray-bottom');

  const setTrayLeft = (collapsed: boolean) => {
    if (!shell) return;
    shell.classList.toggle('tray-left-collapsed', collapsed);
    if (toggleLeft) toggleLeft.textContent = collapsed ? '▶' : '◀';
    try { localStorage.setItem('bpm_tray_left', collapsed ? '1' : '0'); } catch {}
  };

  const setTrayRight = (collapsed: boolean) => {
    if (!shell) return;
    shell.classList.toggle('tray-right-collapsed', collapsed);
    if (toggleRight) toggleRight.textContent = collapsed ? '◀' : '▶';
    try { localStorage.setItem('bpm_tray_right', collapsed ? '1' : '0'); } catch {}
  };

  const setTrayBottom = (collapsed: boolean) => {
    if (!bottomTray) return;
    bottomTray.classList.toggle('tray-bottom-collapsed', collapsed);
    if (toggleBottom) toggleBottom.textContent = collapsed ? '▲' : '▼';
    try { localStorage.setItem('bpm_tray_bottom', collapsed ? '1' : '0'); } catch {}
  };

  if (toggleLeft) toggleLeft.onclick = () => setTrayLeft(!shell?.classList.contains('tray-left-collapsed'));
  if (railLeft) railLeft.onclick = () => setTrayLeft(false);

  if (toggleRight) toggleRight.onclick = () => setTrayRight(!shell?.classList.contains('tray-right-collapsed'));
  if (railRight) railRight.onclick = () => setTrayRight(false);

  if (toggleBottom) toggleBottom.onclick = () => setTrayBottom(!bottomTray?.classList.contains('tray-bottom-collapsed'));
  if (barBottom) barBottom.onclick = () => setTrayBottom(false);

  // Restore states from localStorage if saved
  try {
    if (localStorage.getItem('bpm_tray_left') === '1') setTrayLeft(true);
    if (localStorage.getItem('bpm_tray_right') === '1') setTrayRight(true);
    if (localStorage.getItem('bpm_tray_bottom') === '1') setTrayBottom(true);
  } catch {}

  // Keyboard shortcuts Alt+1 (Left), Alt+2 (Bottom), Alt+3 (Right)
  window.addEventListener('keydown', (e) => {
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      if (e.key === '1') {
        e.preventDefault();
        setTrayLeft(!shell?.classList.contains('tray-left-collapsed'));
      } else if (e.key === '2') {
        e.preventDefault();
        setTrayBottom(!bottomTray?.classList.contains('tray-bottom-collapsed'));
      } else if (e.key === '3') {
        e.preventDefault();
        setTrayRight(!shell?.classList.contains('tray-right-collapsed'));
      }
    }
  });

  const origShowSounds = el('show-sounds').onclick;
  el('show-sounds').onclick = (e) => {
    setTrayRight(false);
    origShowSounds?.call(el('show-sounds'), e);
  };

  const origShowArranger = el('show-arrangement').onclick;
  el('show-arrangement').onclick = (e) => {
    setTrayLeft(false);
    origShowArranger?.call(el('show-arrangement'), e);
  };
}

function initBottomRack(){
  const doScramble = () => {
    edit(() => editor.scramble(), 'Scrambled breakbeat chops! Anchors and locks preserved. Use Undo to revert.');
  };
  const doMutate = () => {
    edit(() => editor.mutate(), 'Variation applied. Locked hits and main anchors are unchanged. Preview and export now use this edit.');
  };
  const doVariation = () => {
    el('regenerate').click();
  };

  const scrambleBtn = document.getElementById('action-scramble');
  if(scrambleBtn){
    scrambleBtn.onclick = e => {e.stopPropagation();doScramble();};
  }
  const mutateBtn = document.getElementById('action-mutate');
  if(mutateBtn){
    mutateBtn.onclick = e => {e.stopPropagation();doMutate();};
  }
  const variationBtn = document.getElementById('action-variation');
  if(variationBtn){
    variationBtn.onclick = e => {e.stopPropagation();doVariation();};
  }

  const tabGen = document.getElementById('tab-generator');
  const tabSli = document.getElementById('tab-slicer');
  const tabFx = document.getElementById('tab-fx');
  const pnlGen = document.getElementById('controls');
  const pnlSli = document.getElementById('sample-drop');
  const pnlFx = document.getElementById('quick-fx-panel');

  function switchBottomTab(tabId: 'generator'|'slicer'|'fx'){
    if(!tabGen || !tabSli || !tabFx || !pnlGen || !pnlSli || !pnlFx) return;
    tabGen.classList.toggle('active', tabId==='generator');
    tabGen.setAttribute('aria-selected', String(tabId==='generator'));
    tabSli.classList.toggle('active', tabId==='slicer');
    tabSli.setAttribute('aria-selected', String(tabId==='slicer'));
    tabFx.classList.toggle('active', tabId==='fx');
    tabFx.setAttribute('aria-selected', String(tabId==='fx'));

    if(tabId==='generator'){
      pnlGen.style.display = '';
      pnlGen.hidden = false;
      pnlSli.hidden = true;
      pnlSli.style.display = 'none';
      pnlFx.hidden = true;
      pnlFx.style.display = 'none';
      status('Bottom rack: Beat Generator active.');
    }else if(tabId==='slicer'){
      pnlGen.style.display = 'none';
      pnlGen.hidden = true;
      pnlSli.hidden = false;
      pnlSli.removeAttribute('hidden');
      pnlSli.style.display = '';
      pnlFx.hidden = true;
      pnlFx.style.display = 'none';
      window.dispatchEvent(new Event('resize'));
      status('Bottom rack: Waveform Slicer active.');
    }else if(tabId==='fx'){
      pnlGen.style.display = 'none';
      pnlGen.hidden = true;
      pnlSli.hidden = true;
      pnlSli.style.display = 'none';
      pnlFx.hidden = false;
      pnlFx.removeAttribute('hidden');
      pnlFx.style.display = '';
      syncDspControls();
      status('Bottom rack: Master DSP active.');
    }
  }

  if(tabGen) tabGen.onclick = () => switchBottomTab('generator');
  if(tabSli) tabSli.onclick = () => switchBottomTab('slicer');
  if(tabFx) tabFx.onclick = () => switchBottomTab('fx');

  // Resilient delegated listener on document to ensure buttons always work regardless of DOM updates
  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement | null)?.closest('button');
    if (!target) return;
    if (target.id === 'action-scramble') {
      doScramble();
    } else if (target.id === 'action-mutate') {
      doMutate();
    } else if (target.id === 'action-variation') {
      doVariation();
    } else if (target.id === 'tab-generator') {
      switchBottomTab('generator');
    } else if (target.id === 'tab-slicer') {
      switchBottomTab('slicer');
    } else if (target.id === 'tab-fx') {
      switchBottomTab('fx');
    } else if (target.id === 'dsp-reset') {
      resetDsp();
    }
  });

  function resetDsp(){
    const sel = document.getElementById('dsp-role-select') as HTMLSelectElement | null;
    const target = sel?.value || 'all';
    const rolesToUpdate = target === 'all' ? ROLES : [target as Role];
    const def = defaultEffects();
    for(const r of rolesToUpdate){
      kitPanel.mix[r].effects = { ...def };
      for(const key of ['highpass','lowpass','resonance','drive','punch','delayMs','feedback','mix'] as const){
        const rackInput = document.getElementById('fx-' + key + '-' + r) as HTMLInputElement | null;
        if(rackInput) rackInput.value = String(def[key]);
      }
      const bypassInput = document.getElementById('fx-bypass-' + r) as HTMLInputElement | null;
      if(bypassInput) bypassInput.checked = false;
    }
    syncDspControls();
    dirty();
    status(target === 'all' ? 'Master DSP: all track effects restored to defaults.' : `Master DSP: ${target} effects restored to defaults.`);
  }

  const dspResetBtn = document.getElementById('dsp-reset');
  if(dspResetBtn) dspResetBtn.onclick = resetDsp;

  function syncDspControls(){
    const sel = document.getElementById('dsp-role-select') as HTMLSelectElement | null;
    if(!sel) return;
    const target = sel.value || 'all';
    const sampleRole: Role = target === 'all' ? 'snare' : target as Role;
    const fx = kitPanel.mix[sampleRole].effects ?? defaultEffects();
    const bypassCb = document.getElementById('dsp-bypass') as HTMLInputElement | null;
    if(bypassCb) bypassCb.checked = !!fx.bypass;
    const setVal = (id: string, textId: string, val: number, unit = '') => {
      const inp = document.getElementById(id) as HTMLInputElement | null;
      const out = document.getElementById(textId);
      if(inp) inp.value = String(val);
      if(out) out.textContent = val + unit;
    };
    setVal('dsp-hp', 'dsp-hp-val', fx.highpass, ' Hz');
    setVal('dsp-lp', 'dsp-lp-val', fx.lowpass, ' Hz');
    const resEl = document.getElementById('dsp-res') as HTMLInputElement | null;
    if(resEl) resEl.value = String(fx.resonance ?? 0);
    const resOut = document.getElementById('dsp-res-val');
    if(resOut) resOut.textContent = (fx.resonance ?? 0).toFixed(2);

    const driveEl = document.getElementById('dsp-drive') as HTMLInputElement | null;
    if(driveEl) driveEl.value = String(fx.drive);
    const driveOut = document.getElementById('dsp-drive-val');
    if(driveOut) driveOut.textContent = fx.drive.toFixed(2);

    const punchEl = document.getElementById('dsp-punch') as HTMLInputElement | null;
    if(punchEl) punchEl.value = String(fx.punch ?? 0);
    const punchOut = document.getElementById('dsp-punch-val');
    if(punchOut) punchOut.textContent = (fx.punch ?? 0).toFixed(2);

    setVal('dsp-delay', 'dsp-delay-val', fx.delayMs, ' ms');
    const fbEl = document.getElementById('dsp-feedback') as HTMLInputElement | null;
    if(fbEl) fbEl.value = String(fx.feedback);
    const fbOut = document.getElementById('dsp-feedback-val');
    if(fbOut) fbOut.textContent = Math.round(fx.feedback * 100) + '%';

    const mixEl = document.getElementById('dsp-mix') as HTMLInputElement | null;
    if(mixEl) mixEl.value = String(fx.mix);
    const mixOut = document.getElementById('dsp-mix-val');
    if(mixOut) mixOut.textContent = Math.round(fx.mix * 100) + '%';
  }

  function updateDspParam(key: keyof Effects, val: number | boolean){
    const sel = document.getElementById('dsp-role-select') as HTMLSelectElement | null;
    const target = sel?.value || 'all';
    const rolesToUpdate = target === 'all' ? ROLES : [target as Role];
    for(const r of rolesToUpdate){
      const cur = kitPanel.mix[r].effects ?? defaultEffects();
      kitPanel.mix[r].effects = { ...cur, [key]: val };
      const rackInput = document.getElementById('fx-' + key + '-' + r) as HTMLInputElement | null;
      if(rackInput) rackInput.value = String(val);
    }
    syncDspControls();
    dirty();
  }

  const dspSel = document.getElementById('dsp-role-select');
  if(dspSel) dspSel.onchange = () => syncDspControls();

  const dspBypass = document.getElementById('dsp-bypass') as HTMLInputElement | null;
  if(dspBypass) dspBypass.onchange = () => updateDspParam('bypass', dspBypass.checked);

  const bindSlider = (id: string, key: keyof Effects) => {
    const inp = document.getElementById(id) as HTMLInputElement | null;
    if(inp) inp.oninput = () => updateDspParam(key, Number(inp.value));
  };
  bindSlider('dsp-hp', 'highpass');
  bindSlider('dsp-lp', 'lowpass');
  bindSlider('dsp-res', 'resonance');
  bindSlider('dsp-drive', 'drive');
  bindSlider('dsp-punch', 'punch');
  bindSlider('dsp-delay', 'delayMs');
  bindSlider('dsp-feedback', 'feedback');
  bindSlider('dsp-mix', 'mix');
}

initWorkspaceTrays();
initBottomRack();

