# Native (C++/JUCE) desktop build of Breakbeat Pattern Maker.
#
# N0 scope: prove the toolchain, load the frozen RenderPlanV1 contract
# (schemas/render-plan-v1.schema.json), schedule its events against the
# timeline math (seconds = ticks * 60 / (bpm * ppq)) and render audio with
# placeholder voices. No generator logic is ported yet - that starts at N1
# with src/core/random.ts + src/core/model.ts per the M0 portability order.
#
# Build (from the repo root) - this resolves the toolchain for you:
#   native\build.cmd
#
# Equivalently, from a shell that already has CMake >= 3.22 and cl.exe on PATH:
#   cmake -S native -B native/build -G Ninja -DCMAKE_BUILD_TYPE=Release
#   cmake --build native/build
#
# JUCE licence note: JUCE is fetched under its AGPLv3 option. Anything that
# links it and is distributed must carry source under AGPLv3, and JUCE's
# splash/licence terms apply until a commercial licence is bought. Confirm
# before any public release.

cmake_minimum_required(VERSION 3.20)

project(BreakbeatNative VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)

# Pinned: JUCE 7.0.12 is the last JUCE 7 release and builds with MSVC 14.29
# (Visual Studio 2019 Build Tools). Note that every JUCE 7/8 tag declares
# `cmake_minimum_required(VERSION 3.22)`, which is *newer* than the CMake 3.20
# bundled with those Build Tools, so the build uses the portable Kitware CMake
# unpacked under the gitignored native/tools/ - see native/build.cmd.
FetchContent_Declare(JUCE
    GIT_REPOSITORY https://github.com/juce-framework/JUCE.git
    GIT_TAG 7.0.12
    GIT_SHALLOW TRUE)

FetchContent_MakeAvailable(JUCE)

juce_add_gui_app(BreakbeatNative
    PRODUCT_NAME "Breakbeat Pattern Maker"
    COMPANY_NAME "Arthur DnB"
    # Explicit: the default is derived from COMPANY_NAME and contained spaces.
    BUNDLE_ID "com.arthurdnb.breakbeat-pattern-maker")

# --- juceaide bypass (machine-specific, but harmless elsewhere) ---------------
# juceaide.exe is JUCE's build-time code generator. On this machine it dies with
# an access violation (0xC0000005) on *every* invocation, including
# `juceaide.exe --help`, because the A-Volute "Nahimic" audio overlay that ships
# with Dell Alienware Sound Center injects NahimicOSD.dll into newly started x64
# processes. Windows Error Reporting names it: "Faulting module name:
# NahimicOSD.dll, version 2.2.25.0, exception code 0xc0000005". The same fault
# killed this app's own first run; native/run.cmd clears it by stopping the two
# user-level Nahimic helpers (the service itself needs administrator rights).
#
# Two JUCE steps would call juceaide:
#   * juce_generate_juce_header() -> JuceHeader.h
#     Deliberately NOT called below. Source/Main.cpp includes
#     <juce_audio_utils/juce_audio_utils.h> directly instead, which is the
#     documented JUCE 7 usage anyway.
#   * _juce_add_resources_rc() -> BreakbeatNative_resources.rc
#     Cannot be switched off for a GUI app (_NO_RESOURCERC is private to
#     juce_add_console_app), and it cannot be short-circuited by placing the
#     file first either: ninja re-runs a custom command that has never produced
#     a build-log entry, so an existing output is not enough. The invocation is
#     therefore patched out of JUCE's own JUCEUtils.cmake by the tracked,
#     idempotent native/patch-juce.ps1 (run automatically by native/build.cmd),
#     which replaces it with a configure-time file(WRITE) stub. The
#     configure_file() below then overwrites that stub with the real version
#     resource. Nothing in the build calls juceaide.
# Keep native/resources/BreakbeatNative_resources.rc in step with project()
# VERSION above.
get_target_property(BBPM_JUCE_GENERATED_SOURCES BreakbeatNative JUCE_GENERATED_SOURCES_DIRECTORY)
configure_file(
    "${CMAKE_CURRENT_SOURCE_DIR}/resources/BreakbeatNative_resources.rc"
    "${BBPM_JUCE_GENERATED_SOURCES}/BreakbeatNative_resources.rc"
    COPYONLY)

target_sources(BreakbeatNative PRIVATE
    Source/Main.cpp)

target_compile_definitions(BreakbeatNative PRIVATE
    JUCE_WEB_BROWSER=0
    JUCE_USE_CURL=0
    JUCE_APPLICATION_NAME_STRING="$<TARGET_PROPERTY:BreakbeatNative,JUCE_PRODUCT_NAME>"
    JUCE_APPLICATION_VERSION_STRING="$<TARGET_PROPERTY:BreakbeatNative,JUCE_VERSION>"
    JUCE_STRICT_REFCOUNTEDPOINTER=1)

target_link_libraries(BreakbeatNative PRIVATE
    juce::juce_audio_utils
    PUBLIC
    juce::juce_recommended_config_flags)

# --- JUCE-free core and its self tests ---------------------------------------
# Source/core/ is the C++ port of the browser engine's pure modules (Random,
# Model, Meter, Articulation, ...). It is plain C++17 with no JUCE dependency, so
# it builds as its own console targets and can be verified WITHOUT running the
# app:
#
#   native\build\bbpm_selftest.exe          (finds the vectors itself)
#   native\build\bbpm_selftest.exe <path>   (explicit file)
#
#   native\build\bbpm_wave2_selftest.exe
#   native\build\bbpm_wave2_selftest.exe <path>
#
# bbpm_selftest replays native/tests/vectors/random-model.txt and patterns.txt
# (number formatting, model tables and whole patterns), and
# bbpm_wave2_selftest replays native/tests/vectors/wave2.txt (meter,
# articulation, drum lanes, slice instruments, reverse probability). Every value
# in those files is recorded from the COMPILED browser engine (dist/core/*.js) by
# native/tests/generate-vectors.mjs and generate-pattern-vectors.mjs and
# generate-wave2-vectors.mjs. Those files are the cross-engine contract: a
# mismatch means the port diverged from the shipped generator, and it exits 1.
include(${CMAKE_CURRENT_SOURCE_DIR}/Source/core/sources.cmake)

add_executable(bbpm_selftest
    ${BBPM_CORE_SOURCES}
    ${CMAKE_CURRENT_SOURCE_DIR}/Source/core/SelfTest.cpp
    Source/SelfTestCli.cpp)

target_include_directories(bbpm_selftest PRIVATE Source)

add_executable(bbpm_wave2_selftest
    ${BBPM_CORE_SOURCES}
    ${CMAKE_CURRENT_SOURCE_DIR}/Source/core/Wave2SelfTest.cpp
    ${CMAKE_CURRENT_SOURCE_DIR}/Source/core/Wave2Support.cpp
    Source/Wave2SelfTestCli.cpp)

target_include_directories(bbpm_wave2_selftest PRIVATE Source)
