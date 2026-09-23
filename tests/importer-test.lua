package.path=TOOL_DIR..'/?.lua;'..package.path
local json=require('json')
local validate=require('validate')
local importer=require('importer')
local function rejects(fn)
  local ok=pcall(fn);assert(not ok,'Expected rejection')
end
local good=validate.decode(GOOD_JSON)
assert(#good.notes>0)
assert(validate.decode(OTHER_JSON).genre=='hiphop')
assert(json.decode('{"unicode":"\\uD83D\\uDE00","bool":false}').bool==false)
assert(#json.decode('"\\uD83D\\uDE00"')==4)
for _,invalid in ipairs({'{"a":1,"a":2}','[1,]','{"a":}','01','1e999','1.','true false','"\\uDC00"','"\\x"',string.rep('[',18)..'0'..string.rep(']',18)}) do rejects(function()json.decode(invalid)end) end
for _,invalid in ipairs({
 GOOD_JSON:gsub('"version": 1','"version": 2',1),
 GOOD_JSON:gsub('"row": 0','"row": 99999',1),
 GOOD_JSON:gsub('"delay": 0','"delay": 256',1),
 GOOD_JSON:gsub('"format":','"evil": true, "format":',1),
 GOOD_JSON:gsub('"notes": %[' ,'"notes": {} ,"unused": [',1)
}) do rejects(function()validate.decode(invalid)end) end

renoise={Transport={TIMING_MODEL_LPB=1},Pattern={MAX_NUMBER_OF_LINES=512},Instrument={PHRASES_OFF=0,LAYER_NOTE_ON=1}}
local function mock()
  local writes=0;local fail_at=nil
  local song={tracks={{name='Original',max_note_columns=12}},instruments={},patterns={},selected_sequence_index=1,selected_track_index=1}
  song.transport={playing=false,timing_model=1,bpm=165,lpb=4,tpl=12,groove_enabled=false}
  for i=1,4 do song.instruments[i]={name='sample',phrase_playback_mode=0,samples={{sample_buffer={has_sample_data=true},sample_mapping={layer=1,note_range={0,119},velocity_range={0,127}}}}} end
  local function pattern()
    local p={tracks={},number_of_lines=64,name='Original'}
    function p:track(index)
      if not self.tracks[index] then
        local t={lines={}}
        function t:line(index)
          if not self.lines[index] then
            local line={columns={}}
            function line:note_column(index)
              if not self.columns[index] then
                local values={}
                self.columns[index]=setmetatable({}, {__index=values,__newindex=function(_,key,value)
                  writes=writes+1
                  if fail_at and writes==fail_at then fail_at=nil;error('Injected host write failure') end
                  values[key]=value
                end})
              end
              return self.columns[index]
            end
            self.lines[index]=line
          end
          return self.lines[index]
        end
        self.tracks[index]=t
      end
      return self.tracks[index]
    end
    function p:clear() self.tracks={} end
    return p
  end
  song.patterns[1]=pattern();song.patterns[1]:track(1):line(1):note_column(1).note_value=60
  song.sequencer={pattern_sequence={1},keep_sequence_sorted=true}
  function song.sequencer:insert_new_pattern_at(index)
    local p=pattern();for i=1,#song.tracks do p:track(i) end
    song.patterns[#song.patterns+1]=p;table.insert(self.pattern_sequence,index,#song.patterns);return #song.patterns
  end
  function song.sequencer:delete_sequence_at(index)table.remove(self.pattern_sequence,index)end
  function song:describe_undo(name)self.undo_name=name end
  function song:insert_track_at(index)
    table.insert(self.tracks,index,{name='New',max_note_columns=12})
    for _,p in ipairs(self.patterns) do local dummy=pattern();table.insert(p.tracks,index,dummy:track(1)) end
  end
  function song:delete_track_at(index)
    table.remove(self.tracks,index);for _,p in ipairs(self.patterns)do table.remove(p.tracks,index)end
  end
  function song:inject_failure(n)fail_at=writes+n end
  return song
end
local mapping={}
for _,s in ipairs(good.sources)do mapping[s.id]={instrument=s.instrument,note=s.note}end

local song=mock();local original=song.tracks[1];local count=importer.apply(song,importer.plan(song,good,mapping,false))
assert(count==#good.notes and #song.sequencer.pattern_sequence==2)
assert(song.tracks[#song.tracks]==original and song.patterns[1]:track(#song.tracks):line(1):note_column(1).note_value==60)
assert(song.transport.bpm==165 and song.sequencer.keep_sequence_sorted)
local p=song.patterns[song.sequencer.pattern_sequence[2]]
for _,n in ipairs(good.notes)do
  local lane
  for i,l in ipairs(good.lanes)do if l.id==n.lane then lane=i end end
  local c=p:track(lane):line(n.row+1):note_column(n.column+1)
  assert(c.delay_value==n.delay and c.instrument_value==mapping[n.source].instrument and c.volume_string==string.format('%02X',n.volume))
end

song=mock();song.transport.bpm=90
rejects(function()importer.plan(song,good,mapping,false)end);assert(#song.tracks==1)
importer.apply(song,importer.plan(song,good,mapping,true));assert(song.transport.bpm==165)
song=mock();song.transport.groove_enabled=true
rejects(function()importer.plan(song,good,mapping,false)end)
importer.apply(song,importer.plan(song,good,mapping,true));assert(not song.transport.groove_enabled)
song=mock();song.transport.playing=true;rejects(function()importer.plan(song,good,mapping,true)end)
song=mock();song.instruments[1].samples[1].sample_buffer.has_sample_data=false
rejects(function()importer.plan(song,good,mapping,false)end);assert(#song.tracks==1 and #song.sequencer.pattern_sequence==1)
song=mock();song.instruments[1].samples[1].sample_mapping.velocity_range={0,1}
rejects(function()importer.plan(song,good,mapping,false)end)

song=mock();original=song.tracks[1];song:inject_failure(7)
rejects(function()importer.apply(song,importer.plan(song,good,mapping,false))end)
assert(#song.tracks==1 and song.tracks[1]==original and #song.sequencer.pattern_sequence==1)
assert(song.patterns[1]:track(1):line(1):note_column(1).note_value==60)
assert(song.transport.bpm==165 and song.transport.lpb==4 and song.selected_sequence_index==1 and song.sequencer.keep_sequence_sorted)
print('Lua: strict JSON, schema checks, note roundtrip, preflight, timing policy and injected-failure rollback passed.')
