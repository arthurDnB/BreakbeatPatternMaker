with open('src/web.ts', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace("    presets();\n  }", "    input('patternStructure').disabled = s.algorithm !== 'groove-v3';\n    presets();\n  }")
with open('src/web.ts', 'w', encoding='utf-8') as f:
    f.write(text)
