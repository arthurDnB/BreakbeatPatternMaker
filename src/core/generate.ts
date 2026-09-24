import {ENGINE_VERSION, PPQ, ROLES, bounded, text, type Hit, type Pattern, type Settings} from './model.js';
import {BREAKS} from './breaks.js';
import {PROFILES} from './profiles.js';
import {random} from './random.js';

export function validateSettings(s: Settings): void {
  if (!s || !Object.hasOwn(PROFILES, s.genre)) throw new Error('Unsupported genre.');
  if(s.breakStyle!==undefined&&s.breakStyle!=='genre'&&!Object.hasOwn(BREAKS,s.breakStyle)) throw new Error('Unsupported break preset.');
  if(s.enabledRoles!==undefined&&(!Array.isArray(s.enabledRoles)||s.enabledRoles.some(r=>!ROLES.includes(r))||new Set(s.enabledRoles).size!==s.enabledRoles.length))throw Error('Invalid enabled instruments.');
  text(s.seed, 'seed', 80);
  bounded(s.bpm, 32, 999, 'BPM'); bounded(s.bars, 1, 4, 'bars', true);
  if (![8,16,32,64].includes(s.resolution)) throw new Error('Resolution must be 8, 16, 32 or 64.');
  for (const k of ['complexity','syncopation','ghostAmount','fillAmount'] as const) bounded(s[k],0,1,k);
  if(s.spicy!==undefined) bounded(s.spicy,0,1,'spicy');
  bounded(s.swing,.5,.67,'swing'); bounded(s.humanizeMs,0,10,'humanizeMs');
}

export function generate(settings: Settings): Pattern {
  validateSettings(settings);
  const s = {...settings};
  const chosenBreak=s.breakStyle&&s.breakStyle!=='genre'?BREAKS[s.breakStyle]:undefined;
  const profile=chosenBreak?{...PROFILES[s.genre],...chosenBreak,fourFloor:false}:PROFILES[s.genre];
  const streams = Object.fromEntries(['skeleton','kicks','hats','ghosts','fills','percussion'].map(x=>[x,random(s.seed,x)]));
  const dice = (stream: string) => streams[stream]!();
  const skeleton = profile.kicks[Math.floor(dice('skeleton') * profile.kicks.length)]!;
  const hits = new Map<string, Hit>();
  const grid = PPQ * 4 / s.resolution;
  const add = (role: Hit['role'], tick: number, gain: number, anchor: boolean, ghost: boolean, reason: string, exact = false) => {
    const baseTick = exact ? tick : Math.round(tick / grid) * grid;
    if (baseTick < 0 || baseTick >= s.bars * PPQ * 4) return;
    const id = `${role}-${baseTick}`;
    const prior = hits.get(id);
    if (prior && (prior.anchor || (!prior.ghost && ghost))) return;
    hits.set(id, {id,role,sourceId:`kit.${role}`,baseTick,offsetTick:0,gain,pan:0,anchor,ghost,reason});
  };
  for (let bar = 0; bar < s.bars; bar++) {
    const start = bar * PPQ * 4;
    if(profile.snares) {
      for(const step of skeleton) add('kick',start+step*240,step===0?.9:.76,step===0||!!profile.fourFloor,false,profile.fourFloor?'A quarter-note kick drives the four-on-the-floor pulse.':step===0?'The downbeat kick anchors the bar.':'This kick repeats the syncopated motif.');
      const snares=!chosenBreak&&s.genre==='drill'&&bar%2===1?[8,14]:profile.snares;
      for(const step of snares) add('snare',start+step*240,.9,true,false,step===8?'This beat-3 snare establishes a half-time backbeat.':'This snare anchors a recurring phrase accent.');
      const hats=profile.hatSteps??Array.from({length:16/profile.hats},(_,i)=>i*profile.hats);
      for(const step of hats) add('hat',start+step*240,step%4===0?.46:.32,false,false,'This recurring hat spacing defines the pulse and gaps.');
      if(bar%2===1&&dice('kicks')<s.syncopation*s.complexity) add('kick',start+15*240,.6,false,false,'A response kick anticipates the next downbeat.');
      if(s.resolution>=16) {
        for(let step=0;step<16;step++) {
          if(hats.includes(step)) continue;
          if(dice('hats')<s.complexity*(profile.detail??.4)) add('hat',start+step*240,.24,false,false,'Complexity adds a quiet subdivision around the recurring hat motif.');
        }
        for(const step of profile.ghosts) if(dice('ghosts')<s.ghostAmount) add('snare',start+step*240,.22,false,true,'This quiet ghost snare connects the main accents.');
        for(const step of profile.percussion??[]) if(dice('percussion')<s.complexity) add('percussion',start+step*240,.35,false,false,'A recurring percussion counter-rhythm adds an offbeat response.');
        if(profile.rolls&&s.resolution>=32&&s.complexity>.5) {
          const spacing=s.resolution===64&&s.complexity>.85?60:120;
          for(let tick=(s.genre==='breakcore'?12:14)*240;tick<3840;tick+=spacing) if(tick%240!==0) add('hat',start+tick,.27,false,false,spacing===60?'A 1/64 hat burst ends the phrase.':'A 1/32 hat burst ends the phrase.',true);
        }
      }
      continue;
    }
    for (const step of skeleton) add('kick',start+step*240,step===0?.88:.72,step===0,false,step===0?'The downbeat kick anchors the bar.':'This kick develops the repeated syncopated motif.');
    for (const step of [4,12]) add('snare',start+step*240,.9,true,false,'The main snare marks beats 2 and 4.');
    if (bar%2===1 && dice('kicks')<s.syncopation*s.complexity) {
      add('kick',start+ (s.genre==='hiphop'?14:3)*240,.6,false,false,'A response-bar kick changes the motif without moving its anchor.');
    }
    for(let step=0;step<16;step+=profile.hats) {
      if(s.genre==='hiphop' && step===14 && dice('hats')>s.complexity) continue;
      add('hat',start+step*240,step%4===0?.48:.34,false,false,'Alternating hat accents make the subdivision audible.');
    }
    if(s.resolution>=16) {
      for(let step=1;step<16;step+=2) {
        if(dice('hats')<s.complexity*(s.genre==='hiphop'?.18:.4)) add('hat',start+step*240,.25,false,false,'A quiet hat adds detail between the regular pulses.');
      }
      for(const step of profile.ghosts) {
        if(dice('ghosts')<s.ghostAmount) add('snare',start+step*240,.20+dice('ghosts')*.08,false,true,'This quiet ghost snare connects the backbeats without replacing them.');
      }
      if(s.genre==='jungle' && dice('percussion')<s.complexity) add('percussion',start+13*240,.35,false,false,'A percussion pickup adds a response after the backbeat.');
    }
  }
  if (s.resolution>=16 && dice('fills')<s.fillAmount*profile.fill) {
    const end = s.bars*PPQ*4;
    const step = s.complexity>.6 && s.genre!=='hiphop' ? 120 : 240;
    for(let t=end-480;t<end;t+=step) add('snare',t,.3+.25*(t-(end-480))/480,false,false,'This repeated snare forms a short phrase-ending fill.',true);
  }
  const events=[...hits.values()].sort((a,b)=>a.baseTick-b.baseTick||ROLES.indexOf(a.role)-ROLES.indexOf(b.role));
  for(const hit of events) {
    if(chosenBreak)hit.reason=chosenBreak.name+' rhythm: '+hit.reason;
    const swingUnit=240;
    const swingDelay=Math.floor(hit.baseTick/swingUnit)%2===1 ? (s.swing-.5)*2*swingUnit : 0;
    const jitter=random(s.seed,`humanize:${hit.id}`);
    const cap=hit.anchor?Math.min(1,s.humanizeMs):s.humanizeMs;
    const jitterTicks=(jitter()*2-1)*cap*s.bpm*PPQ/60000;
    hit.offsetTick=hit.baseTick===0?0:Math.round(swingDelay+jitterTicks);
    if(s.humanizeMs>0) hit.gain=Math.min(1,hit.gain*(.95+jitter()*.1));
    hit.gain=Math.round(hit.gain*10000)/10000;
  }
  if (s.spicy && s.spicy > 0) {
    const spicyDice = random(s.seed, 'spicy');
    for (const hit of events) {
      if (hit.anchor) continue;
      if (spicyDice() < s.spicy * 0.45) {
        const pool = s.spicy > 0.75 ? [2, 3, 4, 6, 8] : s.spicy > 0.4 ? [2, 3, 4] : [2];
        hit.ratchets = pool[Math.floor(spicyDice() * pool.length)];
        hit.gate = s.spicy > 0.6 ? (spicyDice() > 0.5 ? 0.5 : 0.75) : 0.8;
        hit.reason += ` (Spicy ×${hit.ratchets} ratchet)`;
      }
      if ((hit.role === 'percussion' || hit.ghost || hit.role === 'hat') && spicyDice() < s.spicy * 0.3) {
        hit.reverse = true;
        hit.reason += ' (Spicy reverse)';
      }
      if ((hit.role === 'hat' || hit.role === 'percussion' || hit.ghost) && spicyDice() < s.spicy * 0.35) {
        const shift = Math.floor(spicyDice() * 14) - 7;
        if (shift !== 0) {
          hit.pitch = shift;
          hit.reason += ` (Spicy pitch ${shift > 0 ? '+' : ''}${shift})`;
        }
      }
    }
  }
  return {engineVersion:ENGINE_VERSION,settings:s,ppq:PPQ,events:events.filter(h=>!s.enabledRoles||s.enabledRoles.includes(h.role))};
}
