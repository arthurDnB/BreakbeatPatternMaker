local json = require('json')
local M = {}
local function check(test, message) if not test then error(message,0) end end
local function num(n,min,max,name,integer)
  check(type(n)=='number' and n==n and n>=min and n<=max and (not integer or n==math.floor(n)), 'Invalid '..name)
end
local function str(s,max,name)
  check(type(s)=='string' and #s>0 and #s<=max and not s:find('[%z\1-\31\127]'), 'Invalid '..name)
end
local function id(s) str(s,80,'ID'); check(s:match('^[%w._-]+$'), 'Invalid ID characters') end
local function object(v,fields,name)
  check(json.is_object(v), name..' must be an object')
  local allowed={}; for field in fields:gmatch('%S+') do allowed[field]=true;check(v[field]~=nil,name..'.'..field..' is required') end
  for field in pairs(v) do check(allowed[field],name..' has unsupported field '..tostring(field)) end
end
local function array(v,min,max,name) check(json.is_array(v) and #v>=min and #v<=max,name..' must be an array of '..min..'..'..max..' entries') end
function M.decode(input)
  local p=json.decode(input)
  object(p,'format version engineVersion name genre seed timing sources lanes notes warnings','pattern')
  check(p.format=='breakbeat-pattern' and p.version==1,'Unsupported pattern format/version')
  str(p.engineVersion,32,'engine version');str(p.name,120,'name');str(p.seed,80,'seed')
  check(p.genre=='jungle' or p.genre=='dnb' or p.genre=='hiphop' or p.genre=='trap' or p.genre=='rap' or p.genre=='drill' or p.genre=='breakcore' or p.genre=='idm' or p.genre=='hardcore' or p.genre=='experimental' or p.genre=='breaks' or p.genre=='bigbeat' or p.genre=='nuskoolbreaks' or p.genre=='electrobreaks' or p.genre=='breakbeathardcore' or p.genre=='raggajungle' or p.genre=='atmosphericjungle' or p.genre=='footworkjungle' or p.genre=='downtempo' or p.genre=='lofihiphop' or p.genre=='boombap' or p.genre=='mellowbeats' or p.genre=='liquiddnb' or p.genre=='jumpup' or p.genre=='garage' or p.genre=='speedgarage' or p.genre=='twostepgarage' or p.genre=='dub' or p.genre=='psydub' or p.genre=='dubstep' or p.genre=='brostep' or p.genre=='postdubstep' or p.genre=='drumfunk' or p.genre=='amenscience' or p.genre=='atmosphericbreakcore' or p.genre=='triphop' or p.genre=='halftimednb' or p.genre=='neurofunk','Unsupported genre')
  object(p.timing,'bpm lpb tpl bars beatsPerBar lines','timing')
  local t=p.timing
  num(t.bpm,32,999,'BPM');num(t.lpb,1,32,'LPB',true);num(t.tpl,1,16,'TPL',true)
  num(t.bars,1,4,'bars',true);num(t.lines,1,512,'lines',true)
  check(t.beatsPerBar==4 and t.lines==t.bars*4*t.lpb,'Inconsistent pattern length')
  array(p.sources,1,32,'sources');array(p.lanes,1,4,'lanes');array(p.notes,1,4096,'notes');array(p.warnings,0,4096,'warnings')
  for _,warning in ipairs(p.warnings) do str(warning,240,'warning') end
  local roles={kick=true,snare=true,hat=true,percussion=true}
  local sources,lanes,ids,cells={},{},{},{}
  for _,s in ipairs(p.sources) do
    object(s,'id role kind label note instrument','source');id(s.id);str(s.label,80,'label')
    check(not sources[s.id],'Duplicate source ID');check(roles[s.role],'Unsupported source role')
    check(s.kind=='oneShot' or s.kind=='slice','Unsupported source kind')
    num(s.note,0,119,'source note',true);num(s.instrument,0,254,'source instrument',true)
    sources[s.id]=s
  end
  for _,l in ipairs(p.lanes) do
    object(l,'id name columns','lane');check(roles[l.id] and not lanes[l.id],'Invalid or duplicate lane')
    str(l.name,80,'lane name');num(l.columns,1,12,'columns',true);lanes[l.id]=l
  end
  for _,n in ipairs(p.notes) do
    object(n,'id lane source row column volume pan delay','note');id(n.id)
    check(not ids[n.id],'Duplicate note ID');ids[n.id]=true
    check(lanes[n.lane] and sources[n.source] and sources[n.source].role==n.lane,'Invalid note lane/source')
    num(n.row,0,t.lines-1,'row',true);num(n.column,0,lanes[n.lane].columns-1,'column',true)
    num(n.volume,0,128,'volume',true);num(n.pan,0,128,'pan',true);num(n.delay,0,255,'delay',true)
    local key=n.lane..':'..n.row..':'..n.column
    check(not cells[key],'Two notes target the same cell');cells[key]=true
  end
  return p
end
return M
