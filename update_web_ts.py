with open('src/web.ts', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace("s.spicy=Number(input('spicy').value);", "s.spicy=Number(input('spicy').value);\n  const ps=input('patternStructure').value; if(['groove','auto','fill','roll','build'].includes(ps)) s.patternStructure = ps as any;")
with open('src/web.ts', 'w', encoding='utf-8') as f:
    f.write(text)
