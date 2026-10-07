// Port of src/core/reverse-probability.ts.
#pragma once

#include <vector>

#include "PatternModel.h"

namespace bbpm::core {

// applyReverseProbability(hits, settings) - mutates the hits in place.
void applyReverseProbability(std::vector<Hit>& hits, const Settings& settings);

}  // namespace bbpm::core