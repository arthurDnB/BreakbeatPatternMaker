// Shared plumbing for the wave-2 JavaScript-parity vectors.
//
// The vector file is written by native/tests/generate-wave2-vectors.mjs, which
// drives the COMPILED browser engine (dist/core/*.js) and records both the
// inputs and the canonical text of every observable result. Here the same call
// is made against the C++ port and the two texts are compared, so a divergence
// names the record, the field and both values.
//
// Line grammar:  kind<TAB>key=value<TAB>key=value...
//   * the first token selects which ported function is exercised;
//   * a value keeps a byte raw iff 0x20 <= b <= 0x7E and b is neither '%' nor
//     TAB, otherwise it is '%' followed by two UPPERCASE hex digits;
//   * keys prefixed with "e<N>." / "t<N>." / "si<N>." / "l<role>." describe one
//     pattern; "g." and "y." describe the two patterns routeGeneratedDrums
//     takes. An expected value is only compared when the key is present, so a
//     record for a thrown error carries just "ok=0" and "err=".
#pragma once

#include <map>
#include <optional>
#include <set>
#include <string>
#include <vector>

#include "PatternModel.h"

namespace bbpm::core {

// Inverse of the generator's escaping.
bool decodeVectorField(const std::string& encoded, std::string& out);

// Canonical text of a JavaScript value: undefined/null/true/false/number/string.
std::string jsValueText(const JsValue& value);

struct Fields {
  std::map<std::string, std::string> values;

  bool has(const std::string& key) const;
  std::string str(const std::string& key, const std::string& fallback = std::string()) const;
  double num(const std::string& key, double fallback) const;
  bool flag(const std::string& key) const;
  // Every distinct N in keys shaped "<prefix><N>.<something>", ascending.
  std::vector<int> indices(const std::string& prefix) const;
  // A JsValue-valued key: "u" undefined, "z" null, "b<0|1>", "n<number>",
  // "s<text>"; anything else is treated as a plain string.
  JsValue js(const std::string& key) const;
};

struct Result {
  long checks = 0;
  long failures = 0;
  std::string problems;
  void check(const std::string& where, const std::string& label, const std::string& actual,
             const std::string& expected);
  void field(const std::string& where, const Fields& fields, const std::string& label,
             const std::string& actual, const std::string& key);
};

Hit buildHit(const Fields& fields, const std::string& prefix);
Settings buildSettings(const Fields& fields, const std::string& prefix);
Pattern buildPattern(const Fields& fields, const std::string& base);
std::string eventSummary(const Pattern& pattern);
std::string eventReverseSummary(const Pattern& pattern);
std::string joinSet(const std::set<std::string>& values, const std::string& separator);

// Runs body(); when the record expects an error, the thrown message must equal
// the recorded one, and when it expects success, nothing may be thrown.
template <typename Body>
void attempt(Result& result, const Fields& fields, const std::string& where, Body body) {
  const bool expectOk = fields.has("ok") ? fields.flag("ok") : true;
  try {
    body();
    if (!expectOk) result.check(where, "ok", "returned normally", "should have thrown");
  } catch (const std::exception& error) {
    const std::string message = error.what();
    if (expectOk) {
      result.check(where, "error", message, "no error expected");
    } else {
      result.check(where, "error", message, fields.str("err"));
    }
  }
}

}  // namespace bbpm::core