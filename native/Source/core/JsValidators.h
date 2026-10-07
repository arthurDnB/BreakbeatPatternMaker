// Throwing wrappers over the Model.h validators, so a ported module can refuse
// with exactly the message the TypeScript module throws.
#pragma once

#include <string>

namespace bbpm::core {

// bounded(value, min, max, name, integer = false)
void requireBounded(double value, double minimum, double maximum, const std::string& name,
                    bool integer = false);

// identifier(value, name)
void requireIdentifier(const std::string& value, const std::string& name);

// text(value, name, maximumBytes = 120)
void requireText(const std::string& value, const std::string& name, int maximumBytes = 120);

// Number(value.toFixed(digits)); used by the articulation label only.
double toFixedNumber(double value, int digits);

}  // namespace bbpm::core