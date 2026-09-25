with open('src/audio/performance.ts', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("    if(pattern.settings.algorithm==='groove-v3')return planV3Voices(pattern,hit,channels,sourceRate,from,to,origin,position,rate);", "    if(pattern.settings.algorithm==='groove-v3')return planV3Voices(pattern,hit,channels,sourceRate,from,to,origin,options.loop ? Infinity : position,rate);")

with open('src/audio/performance.ts', 'w', encoding='utf-8') as f:
    f.write(text)
