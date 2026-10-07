// Throwaway CLI wrapper for the wave-2 parity self test.
//
//   bbpm_wave2_selftest.exe                       (finds the vectors itself)
//   bbpm_wave2_selftest.exe <vectorsPath>         (explicit file)
//
// Exit code 0 = every recorded value matched; 1 = a mismatch, no vector file at
// all, or an unreadable file. Nothing here links JUCE.

#include <cstdio>
#include <string>

#include "core/Wave2SelfTest.h"

int main(int argc, char** argv) {
  const std::string path = (argc > 1 && argv != nullptr && argv[1] != nullptr) ? std::string(argv[1]) : std::string();
  std::string report;
  const int failures = bbpm::core::runWave2SelfTest(path, report);
  std::fputs(report.c_str(), stdout);
  return failures;
}