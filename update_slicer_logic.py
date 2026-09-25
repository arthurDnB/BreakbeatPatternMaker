with open('src/audio/sample-panel.ts', 'r', encoding='utf-8') as f:
    text = f.read()

send_logic = """
    function getSelectedSlice() {
      if(!buffer) return;
      const start = markers[selected]!;
      const end = markers[selected+1]!;
      const channels = Array.from({length: buffer.numberOfChannels}, (_, i) => buffer!.getChannelData(i).slice(start, end));
      return { channels, name: filename + ' (Slice ' + (selected+1) + ')', rate: buffer.sampleRate };
    }
    button('slice-send-kick').onclick=()=>{
      const s = getSelectedSlice();
      if(s) sendSlice('kick', crypto.randomUUID(), s.name, s.rate, s.channels);
      message('Slice ' + (selected+1) + ' mapped to the Kick lane!');
    };
    button('slice-send-snare').onclick=()=>{
      const s = getSelectedSlice();
      if(s) sendSlice('snare', crypto.randomUUID(), s.name, s.rate, s.channels);
      message('Slice ' + (selected+1) + ' mapped to the Snare lane!');
    };
    button('slice-send-hat').onclick=()=>{
      const s = getSelectedSlice();
      if(s) sendSlice('hat', crypto.randomUUID(), s.name, s.rate, s.channels);
      message('Slice ' + (selected+1) + ' mapped to the Hi-hat lane!');
    };
"""

target = "    button('slice-play').onclick=()=>{void audition().catch(e=>message(String(e)));};"
text = text.replace(target, target + "\n" + send_logic)

with open('src/audio/sample-panel.ts', 'w', encoding='utf-8') as f:
    f.write(text)
