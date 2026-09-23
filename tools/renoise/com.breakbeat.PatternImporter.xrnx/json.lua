-- Small, strict JSON decoder. Lua 5.1 compatible; never evaluates input.
local M = { null = {} }
local array_mt, object_mt = {}, {}
function M.is_array(v) return type(v) == 'table' and getmetatable(v) == array_mt end
function M.is_object(v) return type(v) == 'table' and getmetatable(v) == object_mt end
function M.decode(input)
  assert(type(input) == 'string' and #input <= 1048576, 'File exceeds 1 MiB')
  local i, len, nodes = 1, #input, 0
  if input:sub(1,3) == '\239\187\191' then i = 4 end
  local function fail(message) error(message .. ' at byte ' .. i, 0) end
  local function ws() local _, last = input:find('^[ \t\r\n]*',i); i = (last or i-1)+1 end
  local function utf8(n)
    if n < 128 then return string.char(n) end
    if n < 2048 then return string.char(192+math.floor(n/64),128+n%64) end
    if n < 65536 then return string.char(224+math.floor(n/4096),128+math.floor(n/64)%64,128+n%64) end
    return string.char(240+math.floor(n/262144),128+math.floor(n/4096)%64,128+math.floor(n/64)%64,128+n%64)
  end
  local escapes = {['"']='"',['\\']='\\',['/']='/',b='\b',f='\f',n='\n',r='\r',t='\t'}
  local function hex4()
    local s = input:sub(i,i+3)
    if #s ~= 4 or not s:match('^%x%x%x%x$') then fail('Invalid Unicode escape') end
    i = i + 4; return tonumber(s,16)
  end
  local function str()
    i = i + 1; local pieces = {}
    while i <= len do
      local c = input:sub(i,i); i=i+1
      if c == '"' then return table.concat(pieces) end
      if c == '\\' then
        c=input:sub(i,i); i=i+1
        if c == 'u' then
          local n=hex4()
          if n >= 0xD800 and n <= 0xDBFF then
            if input:sub(i,i+1) ~= '\\u' then fail('Missing low surrogate') end
            i=i+2; local low=hex4()
            if low < 0xDC00 or low > 0xDFFF then fail('Invalid low surrogate') end
            n=0x10000+(n-0xD800)*1024+low-0xDC00
          elseif n >= 0xDC00 and n <= 0xDFFF then fail('Unexpected low surrogate') end
          pieces[#pieces+1]=utf8(n)
        else
          if not escapes[c] then fail('Invalid escape') end
          pieces[#pieces+1]=escapes[c]
        end
      else
        if c:byte() < 32 then fail('Unescaped control character') end
        pieces[#pieces+1]=c
      end
    end
    fail('Unterminated string')
  end
  local parse
  parse=function(depth)
    if depth>16 then fail('JSON nesting limit exceeded') end
    nodes=nodes+1; if nodes>100000 then fail('JSON node limit exceeded') end
    ws(); local c=input:sub(i,i)
    if c=='"' then return str() end
    if c=='{' or c=='[' then
      local object=c=='{'; local close=object and '}' or ']'
      local result=setmetatable({},object and object_mt or array_mt)
      i=i+1; ws(); if input:sub(i,i)==close then i=i+1;return result end
      while true do
        local key
        if object then
          ws(); if input:sub(i,i)~='"' then fail('Expected object key') end
          key=str(); if result[key]~=nil then fail('Duplicate object key') end
          ws(); if input:sub(i,i)~=':' then fail('Expected colon') end
          i=i+1
        else key=#result+1 end
        result[key]=parse(depth+1); ws(); c=input:sub(i,i); i=i+1
        if c==close then return result end
        if c~=',' then fail('Expected comma or closing bracket') end
      end
    end
    for token,value in pairs({['true']=true,['false']=false,['null']=M.null}) do
      if input:sub(i,i+#token-1)==token then i=i+#token; return value end
    end
    local start=i
    if c=='-' then i=i+1 end
    c=input:sub(i,i)
    if c=='0' then i=i+1
    elseif c:match('[1-9]') then repeat i=i+1 until not input:sub(i,i):match('%d')
    else fail('Expected JSON value') end
    if input:sub(i,i)=='.' then
      i=i+1; if not input:sub(i,i):match('%d') then fail('Invalid fraction') end
      repeat i=i+1 until not input:sub(i,i):match('%d')
    end
    if input:sub(i,i):match('[eE]') then
      i=i+1; if input:sub(i,i):match('[+-]') then i=i+1 end
      if not input:sub(i,i):match('%d') then fail('Invalid exponent') end
      repeat i=i+1 until not input:sub(i,i):match('%d')
    end
    local n=tonumber(input:sub(start,i-1))
    if not n or n~=n or n==math.huge or n==-math.huge then fail('Non-finite number') end
    return n
  end
  local result=parse(0); ws(); if i<=len then fail('Trailing data') end
  return result
end
return M
