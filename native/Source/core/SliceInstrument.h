// Port of src/core/slice-instrument.ts.
#pragma once

#include <optional>
#include <string>

#include "PatternModel.h"

namespace bbpm::core {

// validateSliceInstruments(pattern)
void validateSliceInstruments(const Pattern& pattern);

// mappedInstrument(pattern, hit)
std::optional<SliceInstrument> mappedInstrument(const Pattern& pattern, const Hit& hit);

// resolveSlice(pattern, hit)
std::optional<SliceRef> resolveSlice(const Pattern& pattern, const Hit& hit);

// resolvePatternSlices(pattern)
Pattern resolvePatternSlices(const Pattern& pattern);

}  // namespace bbpm::core