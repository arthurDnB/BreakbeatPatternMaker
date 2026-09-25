with open('src/web.ts', 'r', encoding='utf-8') as f:
    text = f.read()

target1 = "let audio=renderPerformance(withDrumKit(pattern,drumKit,kitPanel.mix),assets,context.sampleRate,effectMap()),buffer=audioBuffer(audio);"
replacement1 = "let audio=renderPerformance(withDrumKit(pattern,drumKit,kitPanel.mix),assets,context.sampleRate,effectMap(),{loop:true}),buffer=audioBuffer(audio);"
text = text.replace(target1, replacement1)

target2 = "audio=renderPerformance(withDrumKit(bank!.slots[slot]!.editor!.pattern,drumKit,kitPanel.mix),assets,context!.sampleRate,effectMap());"
replacement2 = "audio=renderPerformance(withDrumKit(bank!.slots[slot]!.editor!.pattern,drumKit,kitPanel.mix),assets,context!.sampleRate,effectMap(),{loop:true});"
text = text.replace(target2, replacement2)

target3 = "audio=renderPerformance(withDrumKit(pattern,drumKit,kitPanel.mix),assets,context!.sampleRate,effectMap());"
replacement3 = "audio=renderPerformance(withDrumKit(pattern,drumKit,kitPanel.mix),assets,context!.sampleRate,effectMap(),{loop:true});"
text = text.replace(target3, replacement3)

with open('src/web.ts', 'w', encoding='utf-8') as f:
    f.write(text)
