# Plain CMake include fragment for the JUCE-free bbpm core.
#
#   include(${CMAKE_CURRENT_SOURCE_DIR}/Source/core/sources.cmake)
#   add_executable(bbpm_selftest ${BBPM_CORE_SOURCES} ...)
#
# All paths are absolute and derived from CMAKE_CURRENT_LIST_DIR, so the
# fragment may be included from any directory. It defines exactly one variable
# and deliberately does not touch any target or global property.

set(BBPM_CORE_SOURCES
    ${CMAKE_CURRENT_LIST_DIR}/Random.cpp
    ${CMAKE_CURRENT_LIST_DIR}/Model.cpp
    ${CMAKE_CURRENT_LIST_DIR}/SelfTest.cpp)
