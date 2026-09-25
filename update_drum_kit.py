with open('src/audio/drum-kit.ts', 'r', encoding='utf-8') as f:
    text = f.read()

target1 = """      const libList=LIBRARY.filter(s=>s.role===role&&!s.id.startsWith('udnb-')).map(s=>[s.id,s.name]);
    for(const [label,entries] of [['Built-in',[['synth','Synthesized '+title.textContent]]],['UDNB Collection (Personal)',udnbList],['Sample library',libList],['Your sample',[['upload','My upload']]]] as [string,string[][]][]){if(!entries.length)continue;const group=document.createElement('optgroup');group.label=label;for(const [value,text] of entries){const o=document.createElement('option');o.value=value!;o.textContent=text!;group.append(o);}choice.append(group);}"""

replacement1 = """      const libList=LIBRARY.filter(s=>s.role===role&&!s.id.startsWith('udnb-')).map(s=>[s.id,s.name]);
      const builtInList=[['synth','Synthesized '+title.textContent]];
      if(role==='percussion')builtInList.push(['synth-scratch','Vinyl Scratch (Synth)']);
    for(const [label,entries] of [['Built-in',builtInList],['UDNB Collection (Personal)',udnbList],['Sample library',libList],['Your sample',[['upload','My upload']]]] as [string,string[][]][]){if(!entries.length)continue;const group=document.createElement('optgroup');group.label=label;for(const [value,text] of entries){const o=document.createElement('option');o.value=value!;o.textContent=text!;group.append(o);}choice.append(group);}"""

text = text.replace(target1, replacement1)

target2 = """          if(value==='upload'){id=mix[role].uploadId;if(!id||!assets.has(id))throw Error('Upload a WAV first.');}
        else if(value!=='synth'){
            const entry=LIBRARY.find(s=>s.id===value&&s.role===role);if(!entry)throw Error('Unknown library sound.');id='library-'+entry.id;"""

replacement2 = """          if(value==='upload'){id=mix[role].uploadId;if(!id||!assets.has(id))throw Error('Upload a WAV first.');}
        else if(value==='synth-scratch'){
            id='synth-scratch';
            if(!assets.has(id)){
              // Generate vinyl scratch and store it in assets
              const rate=44100;
              const ch=[synthesize('scratch',rate)];
              assets.set(id,{id,name:'Vinyl Scratch (Synth)',sampleRate:rate,channels:ch});
            }
        }
        else if(value!=='synth'){
            const entry=LIBRARY.find(s=>s.id===value&&s.role===role);if(!entry)throw Error('Unknown library sound.');id='library-'+entry.id;"""

text = text.replace(target2, replacement2)

with open('src/audio/drum-kit.ts', 'w', encoding='utf-8') as f:
    f.write(text)
