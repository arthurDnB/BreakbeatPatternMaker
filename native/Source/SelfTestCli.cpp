// Throwaway CLI wrapper for the JUCE-free core self test.
//
// native/Source/core/SelfTest.cpp deliberately defines no main(), so that both
// this console target and any future JUCE unit test can drive it. The vectors it
// reads are generated from the COMPILED browser engine by
// native/tests/generate-vectors.mjs, which is what makes the C++ port's fidelity
// checkable without running both engines side by side.
//
//   bbpm_selftest.exe [vectorsPath]
//
// Exit code 0 = every recorded value matched; 1 = at least one mismatch, no
// vector file at all, or an unreadable file. Nothing here links JUCE.

#include "core/SelfTest.h"

int main(int argc, char** argv)
{
    return bbpm::core::runSelfTestCli(argc, argv);
}
