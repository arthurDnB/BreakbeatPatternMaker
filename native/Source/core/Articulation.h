// Port of src/core/articulation.ts.
#pragma once

#include <string>

#include "PatternModel.h"

namespace bbpm::core {

// validateArticulation(hit)
void validateArticulation(const Hit& hit);

// setRatchets(hit, count, rowTicks) -> a copy with ratchets set.
Hit setRatchets(const Hit& hit, double count, double rowTicks);

// articulationLabel(hit)
std::string articulationLabel(const Hit& hit);

}  // namespace bbpm::core