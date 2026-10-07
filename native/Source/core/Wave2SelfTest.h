// Wave-2 JavaScript-parity vectors (meter, articulation, drum lanes, slice
// instruments, reverse probability). See native/tests/vectors/README.md.
#pragma once

#include <string>

namespace bbpm::core {

// Replays the vector file and returns 0 when every recorded value matched.
int runWave2SelfTest(const std::string& vectorsPath, std::string& report);

}  // namespace bbpm::core