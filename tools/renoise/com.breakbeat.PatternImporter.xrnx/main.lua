local validate=require('validate')
local importer=require('importer')
local dialog
local function safe(fn)
  local ok,err=pcall(fn)
  if not ok then renoise.app():show_error('Breakbeat Pattern Maker\n'..tostring(err)) end
end
local function read(path)
  local file,err=io.open(path,'rb');assert(file,err)
  local data=file:read(1048577);file:close()
  assert(data and #data<=1048576,'File exceeds 1 MiB')
  return data
end
local function load_demo()
  local song=renoise.song()
  assert(not song.transport.playing,'Stop playback before loading the kit.')
  assert(#song.instruments+4<=renoise.Song.MAX_NUMBER_OF_INSTRUMENTS,'Not enough free instrument slots.')
  song:describe_undo('Load Breakbeat Demo Kit')
  local added={}
  local ok,err=pcall(function()
    for _,role in ipairs({'kick','snare','hat','percussion'}) do
      local index=#song.instruments+1
      song:insert_instrument_at(index);added[#added+1]=index
      local instrument=song.instruments[index];instrument.name='BPM '..role
      if #instrument.samples==0 then instrument:insert_sample_at(1) end
      local sample=instrument.samples[1]
      assert(sample.sample_buffer:load_from(renoise.tool().bundle_path..'samples/'..role..'.wav'),'Could not load demo '..role)
      sample.name='BPM '..role;sample.sample_mapping.base_note=48
      sample.sample_mapping.note_range={0,119};sample.sample_mapping.velocity_range={0,127}
      sample.new_note_action=renoise.Sample.NEW_NOTE_ACTION_NOTE_CUT
    end
  end)
  if not ok then
    for i=#added,1,-1 do song:delete_instrument_at(added[i]) end
    error(err,0)
  end
  renoise.app():show_message('Four original demo instruments appended. Import a .bbpattern file next; mappings will detect their names.')
end

local function show_import(payload)
  if dialog and dialog.visible then dialog:close() end
  local song=renoise.song();local vb=renoise.ViewBuilder();local mapping={}
  local rows=vb:column{margin=12,spacing=8}
  rows:add_child(vb:text{text=payload.name,font='bold'})
  rows:add_child(vb:text{text=string.format('%d notes | %d rows | %.2f BPM | LPB %d',#payload.notes,payload.timing.lines,payload.timing.bpm,payload.timing.lpb)})
  rows:add_child(vb:text{text='A new pattern is appended and dedicated tracks are added at the left.\nExisting pattern notes are not overwritten. Instrument slots below are hexadecimal.'})
  for _,source in ipairs(payload.sources) do
    local instrument=math.min(source.instrument,#song.instruments-1)
    for i,item in ipairs(song.instruments) do if item.name==source.label then instrument=i-1 end end
    mapping[source.id]={instrument=instrument,note=source.note}
    local m=mapping[source.id]
    rows:add_child(vb:row{spacing=8,
      vb:text{text=source.label,width=170},
      vb:valuebox{min=0,max=math.min(254,#song.instruments-1),value=instrument,width=65,
        tostring=function(v)return string.format('%02X',v)end,
        tonumber=function(v)return tonumber(v,16)end,
        notifier=function(v)m.instrument=v end},
      vb:text{text='Note (C-4 = 48)'},
      vb:valuebox{min=0,max=119,value=source.note,width=60,notifier=function(v)m.note=v end}
    })
  end
  local apply_timing=false
  rows:add_child(vb:row{spacing=8,
    vb:checkbox{value=false,notifier=function(v)apply_timing=v end},
    vb:text{text='Apply file BPM/LPB/TPL and disable groove (affects the entire song)'}
  })
  rows:add_child(vb:text{text='Unchecked: current BPM/LPB must match and host groove must be off.\nOnly sample instruments are supported. Configure slice keys and tails in Renoise.'})
  if #payload.warnings>0 then rows:add_child(vb:text{text='Export warnings: '..#payload.warnings..' (inspect the file before importing).',font='bold'}) end
  rows:add_child(vb:row{spacing=8,
    vb:button{text='Import into new pattern',notifier=function() safe(function()
      assert(renoise.song()==song,'The song changed. Reopen the import file.')
      local plan=importer.plan(song,payload,mapping,apply_timing)
      local count=importer.apply(song,plan)
      dialog:close()
      renoise.app():show_status('Imported '..count..' breakbeat notes. Use Renoise Undo to undo the import.')
    end)end},
    vb:button{text='Cancel',notifier=function()dialog:close()end}
  })
  dialog=renoise.app():show_custom_dialog('Import Breakbeat Pattern',rows)
end
local function import_file()
  local path=renoise.app():prompt_for_filename_to_read({'bbpattern'},'Open Breakbeat Pattern')
  if path and path~='' then show_import(validate.decode(read(path))) end
end
renoise.tool():add_menu_entry{name='Main Menu:Tools:Breakbeat Pattern Maker:Import Pattern File...',invoke=function()safe(import_file)end}
renoise.tool():add_menu_entry{name='Main Menu:Tools:Breakbeat Pattern Maker:Load Original Demo Kit',invoke=function()safe(load_demo)end}
renoise.tool():add_keybinding{name='Global:Tools:Import Breakbeat Pattern File',invoke=function()safe(import_file)end}
