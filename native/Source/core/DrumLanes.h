// Port of src/core/drum-lanes.ts.
#pragma once

#include <set>
#include <string>

#include "PatternModel.h"

namespace bbpm::core {

// drumLane(pattern, role)
DrumLane drumLane(const Pattern& pattern, Role role);

// routedId(id, lane)
std::string routedId(const std::string& id, const std::string& lane);

// admittedHits(generated, track)
std::set<std::string> admittedHits(const Pattern& generated, const UserTrack& track);

// routeGeneratedDrums(generated, layout)
Pattern routeGeneratedDrums(const Pattern& generated, const Pattern& layout);

}  // namespace bbpm::core