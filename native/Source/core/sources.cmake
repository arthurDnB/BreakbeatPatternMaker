# Plain CMake include fragment for the JUCE-free bbpm core.
#
#   include(${CMAKE_CURRENT_SOURCE_DIR}/Source/core/sources.cmake)
#   add_executable(bbpm_selftest ${BBPM_CORE_SOURCES} ...)
#
# All paths are absolute and derived from CMAKE_CURRENT_LIST_DIR, so the
# fragment may be included from any directory. It defines only variables and
# deliberately does not touch any target or global property.
#
# BBPM_CORE_SOURCES      the reusable ported modules - no test code, no main().
# BBPM_CORE_SELFTEST_SOURCES
#                        the optional self-test machinery. SelfTest.cpp drives
#                        the wave-1/3 whole-pattern and number fixtures;
#                        Wave2SelfTest.cpp + Wave2Support.cpp drive the wave-2
#                        fixture. Each driver is linked into its own console
#                        target so a failure names one file.

set(BBPM_CORE_SOURCES
    ${CMAKE_CURRENT_LIST_DIR}/Random.cpp
    ${CMAKE_CURRENT_LIST_DIR}/Model.cpp
    ${CMAKE_CURRENT_LIST_DIR}/PatternModel.cpp
    ${CMAKE_CURRENT_LIST_DIR}/JsValidators.cpp
    ${CMAKE_CURRENT_LIST_DIR}/Meter.cpp
    ${CMAKE_CURRENT_LIST_DIR}/Articulation.cpp
    ${CMAKE_CURRENT_LIST_DIR}/DrumLanes.cpp
    ${CMAKE_CURRENT_LIST_DIR}/SliceInstrument.cpp
    ${CMAKE_CURRENT_LIST_DIR}/ReverseProbability.cpp)

set(BBPM_CORE_SELFTEST_SOURCES
    ${CMAKE_CURRENT_LIST_DIR}/SelfTest.cpp
    ${CMAKE_CURRENT_LIST_DIR}/Wave2SelfTest.cpp
    ${CMAKE_CURRENT_LIST_DIR}/Wave2Support.cpp)
