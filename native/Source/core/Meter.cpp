#include "Meter.h"

#include <cmath>
#include <cstddef>

#include "JsError.h"
#include "Model.h"

namespace bbpm::core {
namespace {

bool isAsciiDigit(char value) { return value >= '0' && value <= '9'; }

// JS String.prototype.trim removes white space (tab, vertical tab, form feed,
// space, no-break space and the Unicode space separators) plus line terminators.
bool isJsSpace(char value) {
  switch (value) {
    case ' ':
    case '\t':
    case '\n':
    case '\v':
    case '\f':
    case '\r':
      return true;
    default:
      return false;
  }
}

std::string trimJs(const std::string& value) {
  std::size_t begin = 0;
  std::size_t end = value.size();
  while (begin < end && isJsSpace(value[begin])) ++begin;
  while (end > begin && isJsSpace(value[end - 1])) --end;
  return value.substr(begin, end - begin);
}

// Number.isInteger on a double, including the Infinity / NaN refusals.
bool isWholeNumber(double value) {
  return std::isfinite(value) && std::floor(value) == value;
}

const char kTimeSignatureMessage[] =
    "Time signature must use a numerator from 1 to 32 and denominator 1, 2, 4, 8, 16 or 32 "
    "(for example 7/8).";

}  // namespace

TimeSignature parseTimeSignature(const std::optional<std::string>& signature) {
  // `/^([1-9]\d?)\s*\/(1|2|4|8|16|32)$/` against `(sig ?? '4/4').trim()`.
  const std::string text = trimJs(signature.has_value() ? *signature : std::string("4/4"));
  const std::size_t size = text.size();

  int numerator = 0;
  int denominator = 0;
  if (size > 0 && text[0] >= '1' && text[0] <= '9') {
    std::size_t digits = 1;
    if (digits < size && isAsciiDigit(text[digits])) ++digits;
    numerator = std::stoi(text.substr(0, digits));

    std::size_t cursor = digits;
    while (cursor < size && isJsSpace(text[cursor])) ++cursor;
    if (cursor < size && text[cursor] == '/') {
      // `/^([1-9]\d?)\s*\/\s*(1|2|4|8|16|32)$/` - JS space is allowed on both
      // sides of the slash, so skip it again before matching the denominator.
      std::size_t denominatorStart = cursor + 1;
      while (denominatorStart < size && isJsSpace(text[denominatorStart])) ++denominatorStart;
      const std::string tail = text.substr(denominatorStart);
      int candidate = 0;
      if (tail == "1") {
        candidate = 1;
      } else if (tail == "2") {
        candidate = 2;
      } else if (tail == "4") {
        candidate = 4;
      } else if (tail == "8") {
        candidate = 8;
      } else if (tail == "16") {
        candidate = 16;
      } else if (tail == "32") {
        candidate = 32;
      }
      // The regex admits a one or two digit lead, then the range check refuses
      // anything above 32 with the same message.
      if (candidate != 0 && numerator <= 32) denominator = candidate;
    }
  }

  if (denominator == 0) throw JsError(kTimeSignatureMessage);

  TimeSignature meter;
  meter.numerator = numerator;
  meter.denominator = denominator;
  meter.beatTicks = static_cast<double>(kPpq) * 4.0 / static_cast<double>(denominator);
  meter.barTicks = static_cast<double>(numerator) * meter.beatTicks;
  meter.stepsPerBar = static_cast<double>(numerator) * 16.0 / static_cast<double>(denominator);
  return meter;
}

double barTicks(const Settings& settings) {
  return parseTimeSignature(settings.timeSignature).barTicks;
}

double patternTicks(const Settings& settings) {
  return jsNumber(settings.bars) * barTicks(settings);
}

double patternSeconds(const Settings& settings, std::optional<double> bpm) {
  const double rate = bpm.has_value() ? *bpm : jsNumber(settings.bpm);
  return jsNumber(settings.bars) * (barTicks(settings) / static_cast<double>(kPpq) * 60.0) / rate;
}

TrackerTiming trackerTiming(const Settings& settings, std::optional<double> lpb) {
  const TimeSignature meter = parseTimeSignature(settings.timeSignature);
  // `const lpb = override ?? settings.lpb ?? settings.resolution / 4;` - a
  // present settings.lpb wins even when it is 0 (only null / undefined fall
  // through to the resolution).
  const double steps = lpb.has_value()
                           ? *lpb
                           : (settings.lpb.has_value() ? *settings.lpb
                                                       : jsNumber(settings.resolution) / 4.0);
  const double rowsPerBar = meter.barTicks * steps / static_cast<double>(kPpq);
  if (!isWholeNumber(rowsPerBar) || rowsPerBar < 1.0) {
    throw JsError(jsNumberToString(static_cast<double>(meter.numerator)) + "/" +
                  jsNumberToString(static_cast<double>(meter.denominator)) + " cannot use LPB " +
                  jsNumberToString(steps) +
                  ": each bar must contain a whole number of rows. Choose a compatible LPB.");
  }
  const double lines = rowsPerBar * jsNumber(settings.bars);
  if (lines > 512.0) {
    throw JsError("This meter and length need " + jsNumberToString(lines) +
                  " rows. Choose a lower LPB or fewer bars (maximum 512 rows).");
  }
  TrackerTiming timing;
  timing.meter = meter;
  timing.rowsPerBar = rowsPerBar;
  timing.lines = lines;
  return timing;
}

MeterPosition meterPosition(const Settings& settings, double quarterBeats) {
  const TimeSignature meter = parseTimeSignature(settings.timeSignature);
  const double tick = quarterBeats * static_cast<double>(kPpq);
  MeterPosition position;
  position.bar = std::floor(tick / meter.barTicks) + 1.0;
  position.beat = std::floor(std::fmod(tick, meter.barTicks) / meter.beatTicks) + 1.0;
  position.fraction = std::fmod(tick, meter.beatTicks) / meter.beatTicks;
  return position;
}

std::vector<int> meterGroups(const std::optional<std::string>& signature) {
  const TimeSignature meter = parseTimeSignature(signature);
  std::vector<int> groups;
  if (meter.denominator == 8 && meter.numerator % 3 == 0) {
    groups.assign(static_cast<std::size_t>(meter.numerator / 3), 3);
    return groups;
  }
  if (meter.numerator <= 4) {
    groups.push_back(meter.numerator);
    return groups;
  }
  int left = meter.numerator;
  while (left > 0) {
    const int size = left == 4 ? 2 : (left >= 3 && left != 2 ? 3 : left);
    groups.push_back(size);
    left -= size;
  }
  return groups;
}

}  // namespace bbpm::core