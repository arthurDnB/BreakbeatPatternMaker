import re

with open('src/core/model.ts', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace('spicy?: number;', "spicy?: number;\n  patternStructure?: 'groove'|'auto'|'fill'|'roll'|'build';")
with open('src/core/model.ts', 'w', encoding='utf-8') as f:
    f.write(text)

with open('src/core/settings.ts', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace("if(s.spicy!==undefined) bounded(s.spicy,0,1,'spicy');", "if(s.spicy!==undefined) bounded(s.spicy,0,1,'spicy');\n  if(s.patternStructure!==undefined&&!['groove','auto','fill','roll','build'].includes(s.patternStructure))throw Error('Invalid pattern structure.');")
with open('src/core/settings.ts', 'w', encoding='utf-8') as f:
    f.write(text)
