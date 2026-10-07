#include "JsValidators.h"

#include <cmath>

#include "JsError.h"
#include "Model.h"

namespace bbpm::core {

void requireBounded(double value, double minimum, double maximum, const std::string& name,
                    bool integer) {
  std::string error;
  if (!bounded(value, minimum, maximum, name, integer, error)) throw JsError(error);
}

void requireIdentifier(const std::string& value, const std::string& name) {
  std::string error;
  if (!identifier(value, name, error)) throw JsError(error);
}

void requireText(const std::string& value, const std::string& name, int maximumBytes) {
  std::string error;
  if (maximumBytes == 120) {
    if (!text(value, name, error)) throw JsError(error);
  } else if (!text(value, name, maximumBytes, error)) {
    throw JsError(error);
  }
}

double toFixedNumber(double value, int digits) {
  // Number(value.toFixed(digits)) rounds half away from zero, on the decimal
  // value. Only the articulation label depends on this.
  if (!std::isfinite(value)) return value;
  const double scale = std::pow(10.0, digits);
  const double scaled = value * scale;
  const double rounded = scaled >= 0.0 ? std::floor(scaled + 0.5) : -std::floor(-scaled + 0.5);
  return rounded / scale;
}

}  // namespace bbpm::core