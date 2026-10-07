#include "Wave2Support.h"

#include <cstddef>
#include <cstdlib>
#include <stdexcept>
#include <string>

#include "Model.h"

namespace bbpm::core {
namespace {

int hexDigit(char character) {
  if (character >= '0' && character <= '9') return character - '0';
  if (character >= 'A' && character <= 'F') return character - 'A' + 10;
  if (character >= 'a' && character <= 'f') return character - 'a' + 10;
  return -1;
}

Role roleOrDefault(const std::string& name) {
  Role role = Role::Kick;
  if (!roleFromName(name, role)) return Role::Kick;
  return role;
}

bool startsWith(const std::string& value, const std::string& prefix) {
  return value.size() >= prefix.size() && value.compare(0, prefix.size(), prefix) == 0;
}

}  // namespace

bool decodeVectorField(const std::string& encoded, std::string& out) {
  out.clear();
  for (std::size_t index = 0; index < encoded.size(); ++index) {
    if (encoded[index] != '%') {
      out.push_back(encoded[index]);
      continue;
    }
    if (index + 2 >= encoded.size()) return false;
    const int high = hexDigit(encoded[index + 1]);
    const int low = hexDigit(encoded[index + 2]);
    if (high < 0 || low < 0) return false;
    out.push_back(static_cast<char>((high << 4) | low));
    index += 2;
  }
  return true;
}

std::string jsValueText(const JsValue& value) {
  switch (value.kind) {
    case JsValue::Kind::Absent:
      return "undefined";
    case JsValue::Kind::Null:
      return "null";
    case JsValue::Kind::Bool:
      return value.boolean ? "true" : "false";
    case JsValue::Kind::Number:
      return jsNumberToString(value.number);
    case JsValue::Kind::String:
      return value.text;
    case JsValue::Kind::Object:
      return "<object>";
    case JsValue::Kind::Array:
      return "<array>";
  }
  return "undefined";
}

bool Fields::has(const std::string& key) const { return values.find(key) != values.end(); }

std::string Fields::str(const std::string& key, const std::string& fallback) const {
  const std::map<std::string, std::string>::const_iterator entry = values.find(key);
  return entry == values.end() ? fallback : entry->second;
}

double Fields::num(const std::string& key, double fallback) const {
  const std::map<std::string, std::string>::const_iterator entry = values.find(key);
  if (entry == values.end()) return fallback;
  return std::strtod(entry->second.c_str(), nullptr);
}

bool Fields::flag(const std::string& key) const {
  const std::map<std::string, std::string>::const_iterator entry = values.find(key);
  return entry != values.end() && entry->second != "0" && !entry->second.empty();
}

std::vector<int> Fields::indices(const std::string& prefix) const {
  std::set<int> found;
  for (std::map<std::string, std::string>::const_iterator entry = values.begin();
       entry != values.end(); ++entry) {
    const std::string& key = entry->first;
    if (!startsWith(key, prefix)) continue;
    std::size_t index = prefix.size();
    int value = 0;
    std::size_t digits = 0;
    while (index < key.size() && key[index] >= '0' && key[index] <= '9') {
      value = value * 10 + (key[index] - '0');
      ++index;
      ++digits;
    }
    if (digits == 0) continue;
    if (index >= key.size() || key[index] != '.') continue;
    found.insert(value);
  }
  return std::vector<int>(found.begin(), found.end());
}

JsValue Fields::js(const std::string& key) const {
  const std::map<std::string, std::string>::const_iterator entry = values.find(key);
  if (entry == values.end() || entry->second.empty()) return JsValue::absent();
  const std::string& spec = entry->second;
  switch (spec[0]) {
    case 'u':
      return JsValue::absent();
    case 'z':
      return JsValue::nullValue();
    case 'b':
      return JsValue::ofBool(spec.size() > 1 && spec[1] == '1');
    case 'n':
      return JsValue::ofNumber(std::strtod(spec.c_str() + 1, nullptr));
    case 's':
      return JsValue::ofString(spec.substr(1));
    default:
      return JsValue::ofString(spec);
  }
}

void Result::check(const std::string& where, const std::string& label, const std::string& actual,
                   const std::string& expected) {
  ++checks;
  if (actual == expected) return;
  ++failures;
  if (failures <= 40) {
    problems += "  " + where + " [" + label + "] expected <" + expected + "> got <" + actual +
                ">\n";
  }
}

void Result::field(const std::string& where, const Fields& fields, const std::string& label,
                   const std::string& actual, const std::string& key) {
  if (!fields.has(key)) return;
  check(where, label, actual, fields.str(key));
}

Hit buildHit(const Fields& fields, const std::string& prefix) {
  Hit hit;
  hit.id = fields.str(prefix + "id");
  hit.role = roleOrDefault(fields.str(prefix + "role", "kick"));
  if (fields.has(prefix + "trackId")) hit.trackId = fields.str(prefix + "trackId");
  hit.sourceId = fields.str(prefix + "sourceId");
  hit.baseTick = fields.num(prefix + "baseTick", 0.0);
  hit.offsetTick = fields.num(prefix + "offsetTick", 0.0);
  if (fields.has(prefix + "gain")) hit.gain = fields.num(prefix + "gain", 0.0);
  hit.pan = fields.num(prefix + "pan", 0.0);
  hit.anchor = fields.flag(prefix + "anchor");
  hit.ghost = fields.flag(prefix + "ghost");
  hit.reason = fields.str(prefix + "reason");
  hit.reverse = fields.js(prefix + "reverse");
  if (fields.has(prefix + "ratchets")) hit.ratchets = fields.num(prefix + "ratchets", 0.0);
  hit.gate = fields.js(prefix + "gate");
  if (fields.has(prefix + "sourceKind")) hit.sourceKind = fields.str(prefix + "sourceKind");
  hit.synthNote = fields.js(prefix + "synthNote");
  hit.generatedDrumRole = fields.js(prefix + "genRole");

  // Hit::articulationRaw is optional<string>: present means "articulation existed but was not a
  // non-null object", which the TS distinguishes from absent.
  if (fields.flag(prefix + "a.raw")) hit.articulationRaw = std::string("raw");
  bool articulationKeys = false;
  for (std::map<std::string, std::string>::const_iterator entry = fields.values.begin();
       entry != fields.values.end(); ++entry) {
    if (!startsWith(entry->first, prefix + "a.")) continue;
    if (entry->first == prefix + "a.raw") continue;
    articulationKeys = true;
    break;
  }
  if (articulationKeys) {
    Articulation articulation;
    if (fields.has(prefix + "a.mode")) articulation.mode = fields.str(prefix + "a.mode");
    if (fields.has(prefix + "a.duration")) {
      articulation.durationTicks = fields.num(prefix + "a.duration", 0.0);
    }
    articulation.chokeGroup = fields.js(prefix + "a.choke");
    const std::vector<int> repeatIndices = fields.indices(prefix + "a.r");
    if (fields.flag(prefix + "a.repeats") || !repeatIndices.empty()) {
      std::vector<RepeatArticulation> repeats;
      for (std::size_t position = 0; position < repeatIndices.size(); ++position) {
        const std::string repeatPrefix =
            prefix + "a.r" + std::to_string(repeatIndices[position]) + ".";
        RepeatArticulation repeat;
        const std::string element = fields.str(repeatPrefix + "kind", "object");
        repeat.elemKind = element == "null"
                              ? RepeatElemKind::Nullish
                              : (element == "scalar" ? RepeatElemKind::Scalar : RepeatElemKind::Object);
        if (fields.has(repeatPrefix + "gain")) repeat.gain = fields.num(repeatPrefix + "gain", 0.0);
        if (fields.has(repeatPrefix + "pitch")) repeat.pitch = fields.num(repeatPrefix + "pitch", 0.0);
        if (fields.has(repeatPrefix + "glide")) repeat.glide = fields.num(repeatPrefix + "glide", 0.0);
        if (fields.has(repeatPrefix + "offset")) {
          repeat.sourceOffset = fields.num(repeatPrefix + "offset", 0.0);
        }
        repeat.reverse = fields.js(repeatPrefix + "reverse");
        repeats.push_back(repeat);
      }
      articulation.repeats = repeats;
    } else if (fields.flag(prefix + "a.repeatsRaw")) {
      articulation.repeatsRaw = JsValue::ofString("raw");
    }
    hit.articulation = articulation;
  }

  if (fields.has(prefix + "m.id") || fields.has(prefix + "m.note")) {
    Hit::Mapped mapped;
    if (fields.has(prefix + "m.id")) mapped.instrumentId = fields.str(prefix + "m.id");
    if (fields.has(prefix + "m.note")) mapped.note = fields.num(prefix + "m.note", 0.0);
    hit.mapped = mapped;
  } else if (fields.flag(prefix + "m.raw")) {
    // `mapped` was truthy but not an object with an id, so the TS reaches
    // identifier(undefined, 'mapped instrument') and throws. A present-but-empty
    // Mapped reproduces that throw.
    hit.mapped = Hit::Mapped{};
    hit.mappedRaw = JsValue::ofString("raw");
  }

  if (fields.has(prefix + "s.assetId")) {
    SliceRef slice;
    slice.assetId = fields.str(prefix + "s.assetId");
    slice.startFrame = fields.num(prefix + "s.start", 0.0);
    slice.endFrame = fields.num(prefix + "s.end", 0.0);
    slice.sampleRate = fields.num(prefix + "s.rate", 0.0);
    slice.label = fields.str(prefix + "s.label");
    hit.slice = slice;
  }
  return hit;
}

Settings buildSettings(const Fields& fields, const std::string& prefix) {
  Settings settings;
  if (fields.has(prefix + "seed")) settings.seed = fields.str(prefix + "seed");
  if (fields.has(prefix + "algorithm")) settings.algorithm = fields.str(prefix + "algorithm");
  if (fields.has(prefix + "timeSignature")) {
    settings.timeSignature = fields.str(prefix + "timeSignature");
  }
  if (fields.has(prefix + "variation")) settings.variation = fields.num(prefix + "variation", 0.0);
  if (fields.has(prefix + "resolution")) settings.resolution = fields.num(prefix + "resolution", 0.0);
  if (fields.has(prefix + "lpb")) settings.lpb = fields.num(prefix + "lpb", 0.0);
  if (fields.has(prefix + "bpm")) settings.bpm = fields.num(prefix + "bpm", 0.0);
  if (fields.has(prefix + "bars")) settings.bars = fields.num(prefix + "bars", 0.0);
  if (fields.has(prefix + "reverseProbability")) {
    settings.reverseProbability = fields.num(prefix + "reverseProbability", 0.0);
  }
  return settings;
}

Pattern buildPattern(const Fields& fields, const std::string& base) {
  Pattern pattern;
  pattern.engineVersion = fields.str(base + "engineVersion", kEngineVersion);
  pattern.settings = buildSettings(fields, base + "settings.");
  pattern.ppq = fields.num(base + "ppq", static_cast<double>(kPpq));

  const std::vector<int> events = fields.indices(base + "e");
  for (std::size_t position = 0; position < events.size(); ++position) {
    pattern.events.push_back(buildHit(fields, base + "e" + std::to_string(events[position]) + "."));
  }

  if (fields.flag(base + "hasLanes")) {
    pattern.hasDrumLanes = true;
    for (int index = 0; index < kRoleCount; ++index) {
      const Role role = static_cast<Role>(index);
      const std::string prefix = base + "l" + roleName(role) + ".";
      if (!fields.has(prefix + "name") && !fields.has(prefix + "visible") &&
          !fields.has(prefix + "genRole")) {
        continue;
      }
      DrumLane lane;
      lane.name = fields.str(prefix + "name");
      lane.visible = fields.has(prefix + "visible") ? fields.flag(prefix + "visible") : true;
      lane.generationRole = fields.js(prefix + "genRole");
      pattern.drumLanes.at(role) = lane;
    }
  }

  const std::vector<int> tracks = fields.indices(base + "t");
  for (std::size_t position = 0; position < tracks.size(); ++position) {
    const std::string prefix = base + "t" + std::to_string(tracks[position]) + ".";
    UserTrack track;
    track.id = fields.str(prefix + "id");
    track.name = fields.str(prefix + "name");
    track.role = roleOrDefault(fields.str(prefix + "role", "kick"));
    if (fields.has(prefix + "kind")) track.kind = fields.str(prefix + "kind");
    track.generationRole = fields.js(prefix + "genRole");
    if (fields.has(prefix + "density")) track.generationDensity = fields.num(prefix + "density", 1.0);
    if (fields.has(prefix + "probability")) {
      track.generationProbability = fields.num(prefix + "probability", 1.0);
    }
    pattern.userTracks.push_back(track);
  }

  if (fields.flag(base + "siRaw")) {
    pattern.sliceInstrumentsRaw = JsValue::ofString("raw");
  } else if (fields.flag(base + "si") || !fields.indices(base + "si").empty()) {
    pattern.hasSliceInstruments = true;
    const std::vector<int> instruments = fields.indices(base + "si");
    for (std::size_t position = 0; position < instruments.size(); ++position) {
      const std::string prefix = base + "si" + std::to_string(instruments[position]) + ".";
      SliceInstrument instrument;
      instrument.id = fields.str(prefix + "id");
      instrument.name = fields.str(prefix + "name");
      instrument.assetId = fields.str(prefix + "assetId");
      instrument.sampleRate = fields.num(prefix + "rate", 0.0);
      instrument.startFrame = fields.num(prefix + "start", 0.0);
      instrument.endFrame = fields.num(prefix + "end", 0.0);
      if (fields.has(prefix + "loopFade")) instrument.loopFadeMs = fields.num(prefix + "loopFade", 0.0);
      const std::vector<int> slices = fields.indices(prefix + "s");
      if (fields.flag(prefix + "slices") || !slices.empty()) {
        instrument.hasSlices = true;
        for (std::size_t slicePosition = 0; slicePosition < slices.size(); ++slicePosition) {
          const std::string slicePrefix = prefix + "s" + std::to_string(slices[slicePosition]) + ".";
          Slice slice;
          slice.id = fields.str(slicePrefix + "id");
          slice.note = fields.num(slicePrefix + "note", 0.0);
          slice.startFrame = fields.num(slicePrefix + "start", 0.0);
          slice.endFrame = fields.num(slicePrefix + "end", 0.0);
          instrument.slices.push_back(slice);
        }
      } else if (fields.flag(prefix + "slicesRaw")) {
        instrument.slicesRaw = JsValue::ofString("raw");
      }
      pattern.sliceInstruments.push_back(instrument);
    }
  }
  return pattern;
}

std::string eventSummary(const Pattern& pattern) {
  std::string summary;
  for (std::size_t index = 0; index < pattern.events.size(); ++index) {
    const Hit& hit = pattern.events[index];
    if (index != 0) summary += "~";
    summary += hit.id + "|" + roleName(hit.role) + "|" + hit.sourceId + "|" +
               (hit.trackId.has_value() ? *hit.trackId : std::string("-")) + "|" + hit.reason +
               "|" + (hit.sourceKind.has_value() ? *hit.sourceKind : std::string("-")) + "|" +
               (hit.slice.has_value()
                    ? (hit.slice->assetId + ":" + jsNumberToString(hit.slice->startFrame) + "-" +
                       jsNumberToString(hit.slice->endFrame))
                    : std::string("-"));
  }
  return summary;
}

std::string eventReverseSummary(const Pattern& pattern) {
  std::string summary;
  for (std::size_t index = 0; index < pattern.events.size(); ++index) {
    if (index != 0) summary += ",";
    summary += pattern.events[index].id + "=" + jsValueText(pattern.events[index].reverse);
  }
  return summary;
}

std::string joinSet(const std::set<std::string>& values, const std::string& separator) {
  std::string joined;
  bool first = true;
  for (std::set<std::string>::const_iterator entry = values.begin(); entry != values.end(); ++entry) {
    if (!first) joined += separator;
    first = false;
    joined += *entry;
  }
  return joined;
}

}  // namespace bbpm::core