import {LIBRARY,KIT_PRESETS} from './library.js';
import {isVinylTexture} from './vinyl-texture.js';
import type {Role} from '../core/model.js';

type Target={role:Role;mode:'lane'|'hit';current:string;uploadName?:string;opener:HTMLElement;preview:(id:string)=>Promise<void>;apply:(id:string)=>Promise<void>};
const key='bpm_sound_browser_v1';
const catalogIds=new Set<string>(LIBRARY.filter(s=>!isVinylTexture(s.id)).map(s=>s.id));
const family=(id:string)=>id.startsWith('udnb-')?'UDNB':id.startsWith('lofi2-')?'Lo-Fi':id.startsWith('808-')?'TR-808':'Acoustic & other';
const featured=new Set(KIT_PRESETS.flatMap(p=>Object.values(p.slots)));
const valid=(value:unknown):string[]=>Array.isArray(value)?value.filter((id):id is string=>typeof id==='string'&&catalogIds.has(id)).slice(0,100):[];

export function setupSoundBrowser(){
  const dialog=document.getElementById('sound-browser') as HTMLDialogElement;
  const search=document.getElementById('sound-browser-search') as HTMLInputElement;
  const filter=document.getElementById('sound-browser-filter') as HTMLSelectElement;
  const list=document.getElementById('sound-browser-results')!;
  const title=document.getElementById('sound-browser-title')!;
  const status=document.getElementById('sound-browser-status')!;
  const preview=document.getElementById('sound-browser-preview') as HTMLButtonElement;
  const use=document.getElementById('sound-browser-use') as HTMLButtonElement;
  let favorites:string[]=[],recent:string[]=[];
  try{const saved=JSON.parse(localStorage.getItem(key)??'{}');favorites=valid(saved.favorites);recent=valid(saved.recent).slice(0,20);}catch{}
  const save=()=>{try{localStorage.setItem(key,JSON.stringify({favorites,recent}));}catch{}};
  let target:Target|undefined,selected='',visible:string[]=[],busy=false;
  const choices=()=>{
    if(!target)return [] as {id:string;name:string;group:string;special:boolean}[];
    const special=target.mode==='hit'?[{id:'lane',name:'Use lane instrument',group:'Current sound',special:true}]:[{id:'synth',name:'Synthesized '+target.role,group:'Built-in',special:true}];
    if(target.uploadName)special.push({id:'upload',name:target.uploadName,group:'My upload',special:true});
    return [...special,...LIBRARY.filter(s=>s.role===target!.role&&!isVinylTexture(s.id)).map(s=>({id:s.id,name:s.name,group:family(s.id),special:false}))];
  };
  const render=()=>{
    const query=search.value.trim().toLowerCase(),group=filter.value;
    const matches=choices().filter(item=>{
      if(query&&!`${item.name} ${item.id} ${item.group}`.toLowerCase().includes(query))return false;
      if(group==='all')return true;
      if(item.special)return false;
      if(group==='featured')return featured.has(item.id);
      if(group==='favorites')return favorites.includes(item.id);
      if(group==='recent')return recent.includes(item.id);
      return item.group===group;
    });
    if(group==='recent')matches.sort((a,b)=>recent.indexOf(a.id)-recent.indexOf(b.id));
    visible=matches.map(item=>item.id);if(!visible.includes(selected))selected=visible[0]??'';
    list.replaceChildren();
    for(const item of matches){
      const row=document.createElement('div');row.className='sound-browser-row';row.classList.toggle('is-selected',item.id===selected);
      const choose=document.createElement('button');choose.type='button';choose.className='sound-browser-choice';choose.textContent=item.name;choose.setAttribute('aria-pressed',String(item.id===selected));choose.title=item.group;choose.onclick=()=>{selected=item.id;render();list.focus();};
      const meta=document.createElement('span');meta.textContent=item.group;
      row.append(choose,meta);
      if(!item.special){const star=document.createElement('button');star.type='button';star.className='sound-browser-favorite';star.textContent=favorites.includes(item.id)?'★':'☆';star.setAttribute('aria-label',(favorites.includes(item.id)?'Remove favorite ':'Favorite ')+item.name);star.setAttribute('aria-pressed',String(favorites.includes(item.id)));star.onclick=()=>{favorites=favorites.includes(item.id)?favorites.filter(id=>id!==item.id):[item.id,...favorites];save();render();list.focus();};row.append(star);}
      list.append(row);
    }
    const empty=!matches.length;list.hidden=empty;document.getElementById('sound-browser-empty')!.hidden=!empty;
    preview.disabled=use.disabled=busy||!selected;
    status.textContent=busy?'Loading sound…':`${matches.length} sounds${selected?' · '+(matches.find(s=>s.id===selected)?.name??''):''}`;
  };
  const run=async(action:'preview'|'apply')=>{if(!target||!selected||busy)return;const id=selected;let error='';busy=true;render();try{await target[action](id);if(action==='apply'){
    if(catalogIds.has(id)){recent=[id,...recent.filter(v=>v!==id)].slice(0,20);save();}
    dialog.close();
  }else status.textContent='Previewing '+(choices().find(s=>s.id===id)?.name??id);
  }catch(e){error=(e as Error).message;}finally{busy=false;if(dialog.open){render();if(error)status.textContent=error;}}};
  search.oninput=render;filter.onchange=render;preview.onclick=()=>void run('preview');use.onclick=()=>void run('apply');
  (document.getElementById('sound-browser-close') as HTMLButtonElement).onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{target?.opener.focus({preventScroll:true});target=undefined;});
  dialog.addEventListener('keydown',event=>{
    if((event.key==='ArrowDown'||event.key==='ArrowUp')&&event.target!==filter){
      event.preventDefault();if(!visible.length)return;selected=visible[(visible.indexOf(selected)+(event.key==='ArrowDown'?1:visible.length-1))%visible.length]!;render();list.querySelector('.is-selected')?.scrollIntoView({block:'nearest'});
    }else if(event.key==='Enter'&&(event.target===search||event.target===list)){event.preventDefault();void run('apply');}
    else if(event.key===' '&&event.target===list){event.preventDefault();void run('preview');}
  });
  return {open(next:Target){target=next;title.textContent=(next.mode==='hit'?'Hit':'Lane')+' sounds · '+next.role;selected=next.current;search.value='';filter.value='all';render();dialog.showModal();search.focus();},recordUsed(id:string){if(catalogIds.has(id)){recent=[id,...recent.filter(v=>v!==id)].slice(0,20);save();}}};
}
