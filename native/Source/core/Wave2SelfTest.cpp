// Wave-2 JavaScript-parity driver: replays native/tests/vectors/wave2.txt.
//
// Every record names one ported function, describes its input pattern with the
// flat field grammar documented in Wave2Support.h, and carries the canonical
// text of each observable result recorded by
// native/tests/generate-wave2-vectors.mjs from dist/core/*.js. Nothing here
// links JUCE, so it runs headless.
#include "Wave2SelfTest.h"

#include <cstddef>
#include <fstream>
#include <optional>
#include <sstream>
#include <string>
#include <vector>

#include "Articulation.h"
#include "DrumLanes.h"
#include "Meter.h"
#include "Model.h"
#include "PatternModel.h"
#include "ReverseProbability.h"
#include "SliceInstrument.h"
#include "Wave2Support.h"

namespace bbpm::core {
namespace {

std::vector<std::string> splitTabs(const std::string& line) {
  std::vector<std::string> parts;
  std::string current;
  for (std::size_t index = 0; index < line.size(); ++index) {
    if (line[index] == '\t') {
      parts.push_back(current);
      current.clear();
      continue;
    }
    current.push_back(line[index]);
  }
  parts.push_back(current);
  return parts;
}

std::string firstEventId(const Pattern& pattern, const std::string& fallback) {
  return pattern.events.empty() ? fallback : pattern.events[0].id;
}

void runRecord(const std::string& kind, const Fields& fields, Result& result,
               const std::string& where) {
  if (kind == "parse") {
    const std::optional<std::string> input =
        fields.has("in") ? std::optional<std::string>(fields.str("in")) : std::nullopt;
    attempt(result, fields, where, [&] {
      const TimeSignature meter = parseTimeSignature(input);
      result.field(where, fields, "numerator",
                   jsNumberToString(static_cast<double>(meter.numerator)), "n");
      result.field(where, fields, "denominator",
                   jsNumberToString(static_cast<double>(meter.denominator)), "d");
      result.field(where, fields, "beatTicks", jsNumberToString(meter.beatTicks), "beat");
      result.field(where, fields, "barTicks", jsNumberToString(meter.barTicks), "bar");
      result.field(where, fields, "stepsPerBar", jsNumberToString(meter.stepsPerBar), "steps");
    });
    return;
  }

  if (kind == "groups") {
    const std::optional<std::string> input =
        fields.has("in") ? std::optional<std::string>(fields.str("in")) : std::nullopt;
    attempt(result, fields, where, [&] {
      const std::vector<int> groups = meterGroups(input);
      std::string joined;
      for (std::size_t index = 0; index < groups.size(); ++index) {
        if (index != 0) joined += ",";
        joined += jsNumberToString(static_cast<double>(groups[index]));
      }
      result.field(where, fields, "groups", joined, "groups");
    });
    return;
  }

  if (kind == "position") {
    const Settings settings = buildSettings(fields, "settings.");
    const double quarterBeats = fields.num("q", 0.0);
    attempt(result, fields, where, [&] {
      const MeterPosition position = meterPosition(settings, quarterBeats);
      result.field(where, fields, "bar", jsNumberToString(position.bar), "bar");
      result.field(where, fields, "beat", jsNumberToString(position.beat), "beat");
      result.field(where, fields, "fraction", jsNumberToString(position.fraction), "fraction");
    });
    return;
  }

  if (kind == "timing") {
    const Settings settings = buildSettings(fields, "settings.");
    const std::optional<double> lpb =
        fields.has("lpbArg") ? std::optional<double>(fields.num("lpbArg", 0.0)) : std::nullopt;
    const std::optional<double> bpm =
        fields.has("bpmArg") ? std::optional<double>(fields.num("bpmArg", 0.0)) : std::nullopt;
    attempt(result, fields, where, [&] {
      result.field(where, fields, "barTicks", jsNumberToString(barTicks(settings)), "barTicks");
      result.field(where, fields, "ticks", jsNumberToString(patternTicks(settings)), "ticks");
      result.field(where, fields, "seconds", jsNumberToString(patternSeconds(settings, bpm)),
                   "seconds");
      const TrackerTiming timing = trackerTiming(settings, lpb);
      result.field(where, fields, "rowsPerBar", jsNumberToString(timing.rowsPerBar), "rows");
      result.field(where, fields, "lines", jsNumberToString(timing.lines), "lines");
    });
    return;
  }

  if (kind == "avalid") {
    const Hit hit = buildHit(fields, "e0.");
    attempt(result, fields, where, [&] { validateArticulation(hit); });
    return;
  }

  if (kind == "asetic") {
    const Hit hit = buildHit(fields, "e0.");
    const double count = fields.num("count", 1.0);
    const double rowTicks = fields.num("rowTicks", static_cast<double>(kPpq));
    attempt(result, fields, where, [&] {
      const Hit next = setRatchets(hit, count, rowTicks);
      result.field(where, fields, "ratchets",
                   next.ratchets.has_value() ? jsNumberToString(*next.ratchets) : "undefined",
                   "ratchets");
      if (!next.articulation.has_value()) return;
      const Articulation& articulation = *next.articulation;
      result.field(where, fields, "mode",
                   articulation.mode.has_value() ? *articulation.mode : "undefined", "mode");
      result.field(where, fields, "duration",
                   articulation.durationTicks.has_value()
                       ? jsNumberToString(*articulation.durationTicks)
                       : "undefined",
                   "duration");
      result.field(where, fields, "repeats", articulation.repeats.has_value() ? "1" : "0",
                   "repeats");
      result.field(where, fields, "choke", jsValueText(articulation.chokeGroup), "choke");
    });
    return;
  }

  if (kind == "alabel") {
    const Hit hit = buildHit(fields, "e0.");
    attempt(result, fields, where, [&] {
      result.field(where, fields, "label", articulationLabel(hit), "label");
    });
    return;
  }

  if (kind == "lane") {
    const Pattern pattern = buildPattern(fields, "");
    Role role = Role::Kick;
    if (!roleFromName(fields.str("role", "kick"), role)) role = Role::Kick;
    attempt(result, fields, where, [&] {
      const DrumLane lane = drumLane(pattern, role);
      result.field(where, fields, "name", lane.name, "name");
      result.field(where, fields, "visible", lane.visible ? "1" : "0", "visible");
      result.field(where, fields, "genRole", jsValueText(lane.generationRole), "genRole");
    });
    return;
  }

  if (kind == "rid") {
    attempt(result, fields, where, [&] {
      result.field(where, fields, "out", routedId(fields.str("id"), fields.str("lane")), "out");
    });
    return;
  }

  if (kind == "admit") {
    const Pattern pattern = buildPattern(fields, "");
    UserTrack track;
    if (!pattern.userTracks.empty()) track = pattern.userTracks[0];
    attempt(result, fields, where, [&] {
      result.field(where, fields, "out", joinSet(admittedHits(pattern, track), ","), "out");
    });
    return;
  }

  if (kind == "route") {
    const Pattern generated = buildPattern(fields, "g.");
    const Pattern layout = buildPattern(fields, "y.");
    attempt(result, fields, where, [&] {
      result.field(where, fields, "events", eventSummary(routeGeneratedDrums(generated, layout)),
                   "events");
    });
    return;
  }

  if (kind == "svalid") {
    const Pattern pattern = buildPattern(fields, "");
    attempt(result, fields, where, [&] { validateSliceInstruments(pattern); });
    return;
  }

  if (kind == "smap") {
    const Pattern pattern = buildPattern(fields, "");
    Hit hit;
    if (!pattern.events.empty()) hit = pattern.events[0];
    attempt(result, fields, where, [&] {
      const std::optional<SliceInstrument> instrument = mappedInstrument(pattern, hit);
      result.field(where, fields, "id", instrument.has_value() ? instrument->id : "undefined",
                   "id");
    });
    return;
  }

  if (kind == "sresolve" || kind == "sresolveall") {
    const Pattern pattern = buildPattern(fields, "");
    Hit hit;
    if (!pattern.events.empty()) hit = pattern.events[0];
    attempt(result, fields, where, [&] {
      if (kind == "sresolveall") {
        result.field(where, fields, "events", eventSummary(resolvePatternSlices(pattern)), "events");
        return;
      }
      const std::optional<SliceRef> resolved = resolveSlice(pattern, hit);
      std::string text = "undefined";
      if (resolved.has_value()) {
        text = resolved->assetId + "|" + jsNumberToString(resolved->startFrame) + "|" +
               jsNumberToString(resolved->endFrame) + "|" + jsNumberToString(resolved->sampleRate) +
               "|" + resolved->label;
      }
      result.field(where, fields, "ref", text, "ref");
    });
    return;
  }

  if (kind == "reverse") {
    Pattern pattern = buildPattern(fields, "");
    const Settings settings = buildSettings(fields, "settings.");
    applyReverseProbability(pattern.events, settings);
    result.field(where, fields, "out", eventReverseSummary(pattern), "out");
    return;
  }

  result.check(where, "kind", kind, "a handled kind");
}

}  // namespace

namespace {

std::string wave2DirectoryOf(const std::string& path) {
  const std::size_t cut = path.find_last_of("/\\");
  return cut == std::string::npos ? std::string() : path.substr(0, cut);
}

bool wave2IsReadableFile(const std::string& path) {
  std::ifstream probe(path.c_str(), std::ios::binary);
  return probe.is_open();
}

// Mirrors defaultVectorsPath() in SelfTest.cpp: build the path from __FILE__ so
// the executable works no matter which directory it is launched from.
std::string defaultWave2VectorsPath() {
  const std::string relative = "tests/vectors/wave2.txt";

  // Wave2SelfTest.cpp lives in native/Source/core/, so the repository copy is
  // two directories up and then across into native/tests/vectors/.
  const std::string sourceDirectory = wave2DirectoryOf(__FILE__);
  if (!sourceDirectory.empty()) {
    const std::string besideSource = sourceDirectory + "/../../" + relative;
    if (wave2IsReadableFile(besideSource)) return besideSource;
  }

  // Fallbacks: cwd == repository root, or cwd == native/.
  const std::string fromRoot = "native/" + relative;
  if (wave2IsReadableFile(fromRoot)) return fromRoot;
  if (wave2IsReadableFile(relative)) return relative;

  return sourceDirectory.empty() ? relative : (sourceDirectory + "/../../" + relative);
}

}  // namespace

int runWave2SelfTest(const std::string& vectorsPath, std::string& report) {
  const std::string path = vectorsPath.empty() ? defaultWave2VectorsPath() : vectorsPath;
  std::ifstream input(path.c_str(), std::ios::binary);
  std::ostringstream out;
  if (!input) {
    report = "wave2 vectors: cannot open " + path + "\n";
    return 1;
  }

  Result result;
  std::string line;
  long lineNumber = 0;
  long records = 0;
  while (std::getline(input, line)) {
    ++lineNumber;
    if (!line.empty() && line[line.size() - 1] == '\r') line.erase(line.size() - 1);
    if (line.empty() || line[0] == '#') continue;
    const std::vector<std::string> parts = splitTabs(line);
    if (parts.empty() || parts[0].empty()) continue;
    const std::string kind = parts[0];
    const std::string where = kind + ":" + std::to_string(lineNumber);
    Fields fields;
    bool wellFormed = true;
    for (std::size_t index = 1; index < parts.size(); ++index) {
      const std::size_t equals = parts[index].find('=');
      if (equals == std::string::npos) {
        wellFormed = false;
        break;
      }
      std::string decoded;
      if (!decodeVectorField(parts[index].substr(equals + 1), decoded)) {
        wellFormed = false;
        break;
      }
      fields.values[parts[index].substr(0, equals)] = decoded;
    }
    if (!wellFormed) {
      result.check(where, "line", "malformed", "kind<TAB>key=value");
      continue;
    }
    ++records;
    runRecord(kind, fields, result, where);
  }

  out << "wave2 vectors: " << records << " records\n";
  out << "checks: " << result.checks << " failures: " << result.failures << "\n";
  if (!result.problems.empty()) out << "problems:\n" << result.problems;
  const bool ok = result.failures == 0 && records > 0;
  out << (ok ? "PASS\n" : "FAIL\n");
  report = out.str();
  return ok ? 0 : 1;
}

}  // namespace bbpm::core