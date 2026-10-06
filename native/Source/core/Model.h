#pragma once

// bbpm::core::Model - hand port of src/core/model.ts (engine 0.1.0) for the
// native (JUCE-free) core. Constants and pure helpers only: no audio, no UI, no
// DOM. Every string below is a wire value of the frozen RenderPlanV1 /
// bbpattern-v1 contracts, so nothing here may be "tidied up".
//
// Notes on fidelity
// - C++ is statically typed, so the `value: unknown` type guards of the TS
//   helpers cannot be reproduced literally: the `typeof value !== '...'` branch
//   is unreachable at a C++ call site and only the value branch is ported.
// - Error text is reproduced byte for byte, including the EN DASH (U+2013) in
//   text() and the exact JS number formatting (jsNumberToString).
// - `Number.isFinite` is reproduced as !std::isfinite, and `Number.isInteger`
//   as std::floor(v) == v.
// - `new TextEncoder().encode(v).length` is the UTF-8 byte length, i.e.
//   std::string::size() for a string that is already UTF-8. (A JS string may
//   hold lone surrogates, which encode to 3 bytes each; such a string has no
//   UTF-8 representation and therefore cannot arrive here.)

#include <cstdint>
#include <string>

namespace bbpm::core {

// model.ts:1-2
inline constexpr const char* kEngineVersion = "0.1.0";
inline constexpr int kPpq = 960;

// model.ts:138-139 - Transfer (the exported pattern file) header contract.
inline constexpr const char* kTransferFormat = "breakbeat-pattern";
inline constexpr int kTransferVersion = 1;

// model.ts:3-4 - ROLES order is part of the wire contract (instrument index).
enum class Role { Kick = 0, Snare = 1, Hat = 2, Percussion = 3 };
inline constexpr int kRoleCount = 4;
extern const char* const kRoleNames[kRoleCount];

const char* roleName(Role role);
bool roleFromName(const std::string& name, Role& role);

// A named ordered list of wire strings / wire integers. The vector file and the
// self test address these by `name`, so adding a table is backwards compatible.
struct StringTable {
    const char* name;
    const char* const* items;
    int count;
};

struct IntTable {
    const char* name;
    const int* items;
    int count;
};

const StringTable* stringTables(int& count);
const IntTable* intTables(int& count);
const StringTable* findStringTable(const std::string& name);
const IntTable* findIntTable(const std::string& name);
bool tableContains(const StringTable& table, const std::string& value);
bool tableContains(const IntTable& table, int value);

// ECMAScript Number::toString(x, 10) for a finite double, i.e. what String(x)
// produces in JS. Needed because bounded()/text() interpolate numbers into their
// messages and those messages are asserted by the self test.
std::string jsNumberToString(double value);

// model.ts:152-156. Returns true when the value is acceptable; otherwise fills
// `error` with the exact message JS would throw. The 5-argument overload is
// `integer = false`.
bool bounded(double value, double min, double max, const std::string& name, bool integer, std::string& error);
bool bounded(double value, double min, double max, const std::string& name, std::string& error);

// model.ts:157-159. Byte-wise equivalent to /^[a-zA-Z0-9._-]{1,80}$/.
bool identifier(const std::string& value, const std::string& name, std::string& error);

// model.ts:160-164. `maxLength` is the UTF-8 byte budget (JS default 120).
bool text(const std::string& value, const std::string& name, int maxLength, std::string& error);
bool text(const std::string& value, const std::string& name, std::string& error);

// model.ts:165-168. noteNameFor() returns false and fills `error` when the note
// is out of the 0..119 integer range (the bounded() call JS makes first).
bool noteNameFor(int note, std::string& out, std::string& error);
std::string noteName(int note);

// model.ts:169 - lowercase-free hex, uppercase, zero padded to 2 characters.
std::string hex(int n);

// model.ts:89 - `track?.kind === 'synth'`. An omitted/undefined kind is the
// empty string here.
bool isSynthTrackKind(const std::string& kind);

// model.ts:148-151 - DEFAULT_SOURCES, one entry per role in ROLES order.
struct DefaultSource {
    const char* id;
    Role role;
    const char* kind;
    const char* label;
    int note;
    int instrument;
};
const DefaultSource* defaultSources();

}  // namespace bbpm::core
