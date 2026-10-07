#pragma once

// Golden-vector self test for the JUCE-free core (Random + Model + the wave-3
// whole-pattern fixture checks).
//
// It reads the plain-text reference vectors that native/tests/generate-vectors.mjs
// and native/tests/generate-pattern-vectors.mjs produce from the COMPILED browser
// engine (dist/core/*.js) and re-runs every recorded case against the C++ port,
// counting one check per compared value. There is no main() here: a CLI (or a
// JUCE unit test) calls the entry point below. Standard library only, no JUCE, no
// third-party headers.
//
// Two files are replayed today:
//   native/tests/vectors/random-model.txt   987 checks (Random + Model values)
//   native/tests/vectors/patterns.txt      1568 checks (whole-pattern records:
//     contract / tolerance / policy prose pins, jsnum formatting, and case ->
//     settings -> setting -> pattern groups re-serialized byte for byte)
// The `case`/`settings`/`setting`/`pattern` kinds only prove the recorded
// evidence is canonical and internally consistent; no generator is ported yet,
// so nothing here compares a GENERATED pattern with these records.
//
// Vector file format (see native/tests/vectors/random-model.txt)
//   * '#' lines are section headers; blank lines are ignored.
//   * every other line is  name<TAB>value
//   * `name` is a ';'-separated list of k=v pairs, the FIRST field being the
//     kind ("const", "string", "draw", ...).
//   * both fields are %XX-escaped ASCII: any byte outside 0x20..0x7E, plus '%'
//     (0x25) and TAB (0x09), is written as %XX with UPPERCASE hex (UTF-8 bytes
//     are escaped one byte at a time, so a seed round-trips byte for byte).
//   * the format has no escape for a literal ';' inside a value, so no vector
//     value may contain one.
//
// Usage
//   SelfTestResult r = runSelfTest("native/tests/vectors/random-model.txt");
//   if (!r.ok) { std::cerr << r.report; return 1; }
//
// or, for a throwaway CLI:
//   int runSelfTestCli(int argc, char** argv);   // argv[1] = optional path

#include <string>

namespace bbpm::core {

struct SelfTestResult {
    // true only when at least one check ran and none of them failed.
    bool ok = false;
    // number of compared values (one per vector line, i.e. one per recorded
    // JS value): 981 for the vector file shipped in native/tests/vectors/.
    int checks = 0;
    int failures = 0;
    // Human-readable report: the path, the first mismatches (capped), the
    // checks/failures line and a final PASS or FAIL line. Always populated.
    std::string report;
};

// Parses `vectorsPath` and returns the verdict. When the file cannot be opened
// the result is ok=false, checks=0, failures=1 and `report` starts with
// "FAIL: cannot open the reference vector file" - it never throws and never
// silently passes.
SelfTestResult runSelfTest(const std::string& vectorsPath);

// Best-effort location of the shipped vector file, derived from this
// translation unit's path (or from the BBPM_VECTORS_PATH macro when the build
// defines it), with "native/tests/vectors/random-model.txt" relative to the
// current directory as a fallback. It returns a path, not a promise: the file
// may not exist, which runSelfTest() reports loudly.
std::string defaultVectorsPath();

// Convenience CLI body (NOT a main()): uses argv[1] when present and otherwise
// defaultVectorsPath(), prints the report to stdout and returns 0 on PASS,
// 1 on FAIL. A parent TU supplies the one-line main() that calls it, or uses
// runSelfTest() directly.
int runSelfTestCli(int argc, char** argv);

}  // namespace bbpm::core
