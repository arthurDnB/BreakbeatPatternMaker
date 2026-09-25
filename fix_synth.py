with open('public/synth.js', 'r', encoding='utf-8') as f:
    text = f.read()

target = """    }
    } else if(role==='scratch') {"""

replacement = """    } else if(role==='scratch') {"""

text = text.replace(target, replacement)

with open('public/synth.js', 'w', encoding='utf-8') as f:
    f.write(text)
