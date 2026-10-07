// Port of src/core/meter.ts.
//
// The TypeScript module reports every refusal by THROWING an Error whose message
// is part of the observable contract, so these ports throw bbpm::core::JsError
// instead of returning a bool plus an error string.
#pragma once

#include <optional>
#include <string>
#include <vector>

#include "PatternModel.h"

namespace bbpm::core {

struct TimeSignature {
  int numerator = 4;
  int denominator = 4;
  double beatTicks = 0.0;
  double barTicks = 0.0;
  double stepsPerBar = 0.0;
};

struct TrackerTiming {
  TimeSignature meter;
  double rowsPerBar = 0.0;
  double lines = 0.0;
};

struct MeterPosition {
  double bar = 0.0;
  double beat = 0.0;
  double fraction = 0.0;
};

// parseTimeSignature(sig?)
TimeSignature parseTimeSignature(const std::optional<std::string>& signature);

// barTicks(settings) / patternTicks(settings)
double barTicks(const Settings& settings);
double patternTicks(const Settings& settings);

// patternSeconds(settings, bpm = settings.bpm)
double patternSeconds(const Settings& settings, std::optional<double> bpm = std::nullopt);

// trackerTiming(settings, lpb = settings.lpb ?? settings.resolution / 4)
TrackerTiming trackerTiming(const Settings& settings, std::optional<double> lpb = std::nullopt);

// meterPosition(settings, quarterBeats)
MeterPosition meterPosition(const Settings& settings, double quarterBeats);

// meterGroups(sig?)
std::vector<int> meterGroups(const std::optional<std::string>& signature);

}  // namespace bbpm::core