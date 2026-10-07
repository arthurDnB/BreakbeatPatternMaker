#pragma once

#include <stdexcept>
#include <string>

namespace bbpm::core {

// The generator modules signal contract violations with `throw new Error(message)`, and the
// message text is part of the observable contract: tests compare it verbatim. This type is the
// C++ carrier for that throw, so a ported module can be checked against the JavaScript message.
class JsError : public std::runtime_error {
public:
    explicit JsError(const std::string& message) : std::runtime_error(message) {}
};

}  // namespace bbpm::core
