with open('src/web.ts', 'r', encoding='utf-8') as f:
    text = f.read()

target = """const samplePanel=setupSamplePanel(stop, (role, id, name, rate, channels) => {
  assets.set(id, {id, name, sampleRate: rate, channels});
  kitPanel.mix[role].uploadId = id;
  kitPanel.mix[role].choice = 'upload';
  kitPanel.restore(kitPanel.mix);
  scheduleSave();
});"""

replacement = """const samplePanel=setupSamplePanel(stop, (role, id, name, rate, channels) => {
  assets.set(id, {id, name, sampleRate: rate, channels});
  kitPanel.mix[role].uploadId = id;
  kitPanel.mix[role].assetId = id;
  kitPanel.mix[role].choice = 'upload';
  kitPanel.restore(kitPanel.mix);
  scheduleSave();
});"""

text = text.replace(target, replacement)

with open('src/web.ts', 'w', encoding='utf-8') as f:
    f.write(text)
