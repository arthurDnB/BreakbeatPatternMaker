-- Song mutation is isolated here so it can be exercised with a fake host.
local M = {}
local function check(test,message) if not test then error(message,0) end end
local function hex(n) return string.format('%02X',n) end

function M.plan(song, payload, mapping, apply_timing)
  check(not song.transport.playing,'Stop playback before importing.')
  check(song.transport.timing_model==renoise.Transport.TIMING_MODEL_LPB,'Legacy speed timing is unsupported.')
  check(payload.timing.lines<=renoise.Pattern.MAX_NUMBER_OF_LINES,'Pattern is too long for this host.')
  if not apply_timing then
    check(math.abs(song.transport.bpm-payload.timing.bpm)<0.0001 and song.transport.lpb==payload.timing.lpb,
      'BPM/LPB differ. Export for the song timing, or choose Apply file timing (song-wide).')
    check(not song.transport.groove_enabled,'Host groove is active. Disable it, or choose Apply file timing.')
  end
  local bindings={}
  for _,s in ipairs(payload.sources) do
    local m=mapping[s.id]
    check(m and type(m.instrument)=='number' and m.instrument==math.floor(m.instrument) and m.instrument>=0 and m.instrument<=254,'Missing instrument mapping for '..s.label)
    check(type(m.note)=='number' and m.note==math.floor(m.note) and m.note>=0 and m.note<=119,'Invalid note mapping for '..s.label)
    local instrument=song.instruments[m.instrument+1]
    check(instrument~=nil,'Instrument '..hex(m.instrument)..' does not exist.')
    if instrument.phrase_playback_mode~=nil then check(instrument.phrase_playback_mode==renoise.Instrument.PHRASES_OFF,'Disable phrase playback for '..s.label) end
    local eligible={}
    for _,sample in ipairs(instrument.samples) do
      local sm=sample.sample_mapping
      if sample.sample_buffer.has_sample_data and sm and sm.layer==renoise.Instrument.LAYER_NOTE_ON and m.note>=sm.note_range[1] and m.note<=sm.note_range[2] then eligible[#eligible+1]=sm end
    end
    check(#eligible>0,'No loaded sample at the mapped note for '..s.label)
    bindings[s.id]={instrument=m.instrument,note=m.note,object=instrument,eligible=eligible}
  end
  for _,n in ipairs(payload.notes) do
    local found=false; local velocity=math.min(127,n.volume)
    for _,sm in ipairs(bindings[n.source].eligible) do
      if velocity>=sm.velocity_range[1] and velocity<=sm.velocity_range[2] then found=true end
    end
    check(found,'A note falls outside the mapped sample velocity range: '..n.id)
  end
  return {payload=payload,bindings=bindings,apply_timing=apply_timing}
end

function M.apply(song, plan)
  -- The UI re-plans directly before calling this function.
  local p=plan.payload
  local before={bpm=song.transport.bpm,lpb=song.transport.lpb,tpl=song.transport.tpl,
    groove=song.transport.groove_enabled,sequence=song.selected_sequence_index,track=song.selected_track_index,
    sorted=song.sequencer.keep_sequence_sorted}
  local created={}
  local slot,pattern_object
  local function rollback()
    if slot then
      -- No callbacks/yields are used during import, so the appended slot is still ours.
      song.sequencer:delete_sequence_at(slot)
    end
    for i=#created,1,-1 do
      for index,track in ipairs(song.tracks) do
        if track==created[i] then song:delete_track_at(index);break end
      end
    end
    if pattern_object then pattern_object:clear() end
    song.transport.bpm=before.bpm;song.transport.lpb=before.lpb;song.transport.tpl=before.tpl
    song.transport.groove_enabled=before.groove
    song.sequencer.keep_sequence_sorted=before.sorted
    song.selected_sequence_index=before.sequence;song.selected_track_index=before.track
  end
  song:describe_undo('Import Breakbeat Pattern')
  local ok,result=pcall(function()
    song.sequencer.keep_sequence_sorted=false
    local tracks={}
    -- Prepend regular tracks; never insert at/after Master (which can create sends).
    for i=#p.lanes,1,-1 do
      local lane=p.lanes[i]
      song:insert_track_at(1)
      local track=song.tracks[1];created[#created+1]=track
      check(track.max_note_columns>=lane.columns,'Host note-column capacity exceeded.')
      track.name='BB '..lane.name;track.visible_note_columns=lane.columns
      track.volume_column_visible=true;track.panning_column_visible=true;track.delay_column_visible=true
    end
    for i,lane in ipairs(p.lanes) do tracks[lane.id]=i end
    local target=#song.sequencer.pattern_sequence+1
    local pattern_index=song.sequencer:insert_new_pattern_at(target)
    slot=target;pattern_object=song.patterns[pattern_index]
    pattern_object.number_of_lines=p.timing.lines;pattern_object.name=p.name
    for _,n in ipairs(p.notes) do
      local binding=plan.bindings[n.source]
      check(song.instruments[binding.instrument+1]==binding.object,'Instrument mapping changed; import cancelled.')
      local cell=pattern_object:track(tracks[n.lane]):line(n.row+1):note_column(n.column+1)
      cell.note_value=binding.note;cell.instrument_value=binding.instrument
      cell.volume_string=hex(n.volume);cell.panning_string=hex(n.pan);cell.delay_value=n.delay
    end
    -- Read back every generated cell before reporting success.
    for _,n in ipairs(p.notes) do
      local b=plan.bindings[n.source]
      local c=pattern_object:track(tracks[n.lane]):line(n.row+1):note_column(n.column+1)
      check(c.note_value==b.note and c.instrument_value==b.instrument and c.volume_string==hex(n.volume)
        and c.panning_string==hex(n.pan) and c.delay_value==n.delay,'Read-back failed for '..n.id)
    end
    if plan.apply_timing then
      song.transport.bpm=p.timing.bpm;song.transport.lpb=p.timing.lpb;song.transport.tpl=p.timing.tpl
      song.transport.groove_enabled=false
    end
    song.selected_sequence_index=slot;song.selected_track_index=1
    song.sequencer.keep_sequence_sorted=before.sorted
    return #p.notes
  end)
  if not ok then
    local restored,why=pcall(rollback)
    error(tostring(result)..(restored and '\nImport rolled back (an empty unused pattern slot may remain).' or '\nRollback failed: '..tostring(why)..'. Use Renoise Undo immediately.'),0)
  end
  return result
end
return M
