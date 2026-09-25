import re

with open('src/core/groove-v3.ts', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Modify generateGrooveV3 to handle patternStructure
replacement = '''
   const events=[...c.hits.values()].sort(compare);
   spice(events,s,c.rule,s.bars*BAR);
   
   if(s.patternStructure === 'groove') {
     // Remove any fill notes that were added by spice
     const toRemove = new Set();
     for(const e of events) if(e.id.includes('-drop')) toRemove.add(e.id);
     events.splice(0, events.length, ...events.filter(e => !toRemove.has(e.id)));
   } else if (s.patternStructure === 'fill') {
     const start = s.bars*BAR - (s.bars*BAR >= PPQ*4 ? PPQ*2 : PPQ);
     const fillNotes = grooveV3Fill(s, start, s.bars*BAR);
     const toRemove = new Set();
     for(const e of events) if(actual(e) >= start) toRemove.add(e.id);
     events.splice(0, events.length, ...events.filter(e => !toRemove.has(e.id)));
     for(const note of fillNotes) { note.id += '-drop'; events.push(note); }
   } else if (s.patternStructure === 'roll' || s.patternStructure === 'build') {
     const start = s.patternStructure === 'build' ? 0 : s.bars*BAR - (s.bars*BAR >= PPQ*4 ? PPQ*2 : PPQ);
     const rollNotes = grooveV3Roll(s, start, s.bars*BAR);
     const toRemove = new Set();
     for(const e of events) if(actual(e) >= start) toRemove.add(e.id);
     events.splice(0, events.length, ...events.filter(e => !toRemove.has(e.id)));
     for(const note of rollNotes) { note.id += '-roll'; events.push(note); }
   }

   for(const hit of events){
'''
text = re.sub(r'   const events=\[\.\.\.c\.hits\.values\(\)\]\.sort\(compare\);\n   spice\(events,s,c\.rule,s\.bars\*BAR\);\n   for\(const hit of events\)\{', replacement, text)

# 2. Remove the durationTicks truncation at the end of generateGrooveV3
text = re.sub(r'    // This field bounds repeat onsets, not the duration of a natural sample tail\.\n    if\(hit\.articulation\)hit\.articulation\.durationTicks=Math\.min\(hit\.articulation\.durationTicks,s\.bars\*BAR-actual\(hit\)\);\n', '', text)

# 3. In spice(), make sure fill notes are identifiable so we can remove them in 'groove' mode
text = re.sub(r"hit\.reason\+=` Bar \$\{phase\.position\+1\} of \$\{phase\.length\}: \$\{phase\.ending\?'phrase resolution':'small \nturnaround'\}\.`;\n     add\(hit\);", "hit.reason+=` Bar ${phase.position+1} of ${phase.length}: ${phase.ending?'phrase resolution':'small turnaround'}.`;\n     hit.id += '-drop';\n     add(hit);", text, flags=re.MULTILINE)


with open('src/core/groove-v3.ts', 'w', encoding='utf-8') as f:
    f.write(text)
