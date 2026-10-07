#include "PatternModel.h"

#include <cmath>
#include <limits>

namespace bbpm::core {

// `undefined` used in arithmetic is NaN, and every comparison against NaN is
// false, which is what makes an omitted optional number behave like a missing
// JSON member does in the TypeScript.
double jsNumber(const std::optional<double>& value)
{
    return value.has_value() ? *value : std::numeric_limits<double>::quiet_NaN();
}

double jsNumberOr(const std::optional<double>& value, double fallback)
{
    return value.has_value() ? *value : fallback;
}

double jsFalsyNumberOr(const std::optional<double>& value, double fallback)
{
    if (!value.has_value()) {
        return fallback;
    }
    const double number = *value;
    if (number == 0.0 || number != number) {  // 0, -0 and NaN are falsy
        return fallback;
    }
    return number;
}

bool jsTruthy(const std::optional<double>& value)
{
    if (!value.has_value()) {
        return false;
    }
    const double number = *value;
    return number != 0.0 && number == number;
}

std::string jsTemplateString(const std::optional<std::string>& value)
{
    // `${undefined}` is the string "undefined", not an empty string.
    return value.has_value() ? *value : std::string("undefined");
}

}  // namespace bbpm::core
