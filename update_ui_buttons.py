with open('public/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

target = '<button id="slice-play">Audition slice</button>'
replacement = '<button id="slice-play">Audition slice</button><button id="slice-send-kick" class="accent">To Kick</button><button id="slice-send-snare" class="accent">To Snare</button><button id="slice-send-hat" class="accent">To Hat</button>'
text = text.replace(target, replacement)
text = text.replace('<button id="slice-play">Audition \nslice</button>', replacement)

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(text)
