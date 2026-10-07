#include "SliceInstrument.h"

#include <cstddef>
#include <set>

#include "JsError.h"
#include "JsValidators.h"
#include "Model.h"

namespace bbpm::core {
namespace {

std::string optionalText(const std::optional<std::string>& value) {
  return value.has_value() ? *value : std::string();
}

}  // namespace

void validateSliceInstruments(const Pattern& pattern) {
  // `if (pattern.sliceInstruments === undefined) return;`
  if (!pattern.hasSliceInstruments) {
    if (pattern.sliceInstrumentsRaw.isUndefined()) return;
    throw JsError("Invalid slice instruments.");
  }
  if (pattern.sliceInstruments.size() > 32) throw JsError("Invalid slice instruments.");

  std::set<std::string> instrumentIds;
  for (const SliceInstrument& instrument : pattern.sliceInstruments) {
    requireIdentifier(instrument.id, "slice instrument");
    requireIdentifier(instrument.assetId, "slice asset");
    requireText(instrument.name, "instrument name");
    if (!instrumentIds.insert(instrument.id).second) throw JsError("Duplicate slice instrument.");
    requireBounded(instrument.sampleRate, 8000.0, 192000.0, "sample rate", true);
    requireBounded(instrument.startFrame, 0.0, 23040000.0, "region start", true);
    requireBounded(instrument.endFrame, instrument.startFrame + 1.0, 23040000.0, "region end", true);
    if (instrument.loopFadeMs.has_value()) {
      requireBounded(*instrument.loopFadeMs, 0.0, 10.0, "loop smoothing");
    }
    if (!instrument.hasSlices || instrument.slices.empty() || instrument.slices.size() > 120) {
      throw JsError("A slice instrument needs 1\xE2\x80\x93" "120 slices.");
    }

    std::set<std::string> sliceIds;
    std::set<double> sliceNotes;
    double previous = instrument.startFrame;
    for (const Slice& slice : instrument.slices) {
      requireIdentifier(slice.id, "slice ID");
      requireBounded(slice.note, 0.0, 119.0, "slice note", true);
      if (!sliceIds.insert(slice.id).second || !sliceNotes.insert(slice.note).second) {
        throw JsError("Duplicate slice key or ID.");
      }
      if (slice.startFrame != previous) {
        throw JsError("Slices must cover the region without gaps.");
      }
      requireBounded(slice.endFrame, slice.startFrame + 1.0, instrument.endFrame, "slice end", true);
      previous = slice.endFrame;
    }
    if (previous != instrument.endFrame) {
      throw JsError("Slices must cover the whole region.");
    }
  }
}

std::optional<SliceInstrument> mappedInstrument(const Pattern& pattern, const Hit& hit) {
  // `if (!hit.mapped) return undefined;`
  if (!hit.mapped.has_value()) return std::nullopt;
  const std::string instrumentId = optionalText(hit.mapped->instrumentId);
  requireIdentifier(instrumentId, "mapped instrument");
  requireBounded(jsNumber(hit.mapped->note), 0.0, 119.0, "mapped note", true);
  for (const SliceInstrument& instrument : pattern.sliceInstruments) {
    if (instrument.id == instrumentId) return instrument;
  }
  throw JsError("Missing mapped slice instrument.");
}

std::optional<SliceRef> resolveSlice(const Pattern& pattern, const Hit& hit) {
  const std::optional<SliceInstrument> instrument = mappedInstrument(pattern, hit);
  if (!instrument.has_value()) return hit.slice;
  const double note = jsNumber(hit.mapped->note);
  for (std::size_t index = 0; index < instrument->slices.size(); ++index) {
    const Slice& slice = instrument->slices[index];
    if (slice.note != note) continue;
    SliceRef resolved;
    resolved.assetId = instrument->assetId;
    resolved.sampleRate = instrument->sampleRate;
    resolved.startFrame = slice.startFrame;
    resolved.endFrame = slice.endFrame;
    resolved.label = instrument->name + " / Slice " + jsNumberToString(static_cast<double>(index + 1));
    return resolved;
  }
  throw JsError("This note has no mapped slice.");
}

Pattern resolvePatternSlices(const Pattern& pattern) {
  Pattern result = pattern;
  result.events.clear();
  result.events.reserve(pattern.events.size());
  for (const Hit& hit : pattern.events) {
    if (!hit.mapped.has_value()) {
      result.events.push_back(hit);
      continue;
    }
    Hit next = hit;
    next.slice = resolveSlice(pattern, hit);
    next.sourceKind = std::string("slice");
    result.events.push_back(next);
  }
  return result;
}

}  // namespace bbpm::core