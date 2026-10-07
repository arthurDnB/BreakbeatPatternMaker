#pragma once

// bbpm::core::PatternModel - the wave-2 structural types: the subset of the
// src/core/model.ts interfaces that meter.ts, articulation.ts, drum-lanes.ts,
// slice-instrument.ts and reverse-probability.ts read or write.
//
// Wave 1's Model.h deliberately carries only the frozen constants and the pure
// helpers of model.ts; the data shapes live here, because C++ needs a type for
// Hit / Pattern / Settings / DrumLane / SliceInstrument / UserTrack before the
// wave-2 modules can be declared at all.
//
// JavaScript -> C++ mapping notes. Every one of these is observable behaviour,
// not a convenience:
//
//  * `x?: T`                 -> std::optional<T>. `??` treats null and
//                               undefined identically, and the wave-2 code
//                               only ever tests those fields for truthiness
//                               (`if (!hit.mapped)`, `if (!hit.trackId)`,
//                               `config.generationRole === role`), so a null and
//                               an omitted member are the same C++ value.
//  * TypeScript unions are erased at run time. A field typed
//    `'oneShot' | 'slice'` can hold "bogus" in a loaded project, and
//    validateArticulation() must still throw on it, so such fields are plain
//    std::string here - an enum would reject the value at the boundary and the
//    throw path could never be reached.
//  * JsValue keeps the run-time JSON type (bool vs string vs number vs object)
//    for the fields whose TS code branches on `typeof` or on truthiness:
//    `typeof r.reverse !== 'boolean'`, `if (hit.synthNote)`, `if (!hit.mapped)`.
//  * Missing required fields: the TS validators treat `undefined` and the empty
//    value identically - identifier(undefined) and identifier('') throw the
//    same message, and bounded(undefined, ...) and bounded(NaN, ...) do too -
//    so required identifier/name strings default to "" and required numbers to
//    NaN here, exactly where the TS does not distinguish them.
//  * `!hit.trackId` is falsy for BOTH an absent member and the empty string, so
//    Hit::trackId is std::optional<std::string> and the code tests
//    `hasTrackId()`, never `has_value()` alone.

#include <optional>
#include <string>
#include <vector>

#include "Model.h"  // Role, kRoleCount

namespace bbpm::core {

// ---------------------------------------------------------------------------
// JsValue - a JSON scalar tagged with its run-time type
// ---------------------------------------------------------------------------

class JsValue
{
public:
    enum class Kind { Absent, Null, Bool, Number, String, Object, Array };

    Kind kind = Kind::Absent;
    bool boolean = false;
    double number = 0.0;
    std::string text;

    static JsValue absent() { return JsValue(); }
    static JsValue nullValue() {
        JsValue v;
        v.kind = Kind::Null;
        return v;
    }
    static JsValue ofBool(bool value) {
        JsValue v;
        v.kind = Kind::Bool;
        v.boolean = value;
        return v;
    }
    static JsValue ofNumber(double value) {
        JsValue v;
        v.kind = Kind::Number;
        v.number = value;
        return v;
    }
    static JsValue ofString(const std::string& value) {
        JsValue v;
        v.kind = Kind::String;
        v.text = value;
        return v;
    }
    static JsValue ofObject() {
        JsValue v;
        v.kind = Kind::Object;
        return v;
    }
    static JsValue ofArray() {
        JsValue v;
        v.kind = Kind::Array;
        return v;
    }

    bool isAbsent() const { return kind == Kind::Absent; }
    bool isNull() const { return kind == Kind::Null; }
    bool isBool() const { return kind == Kind::Bool; }
    bool isNumber() const { return kind == Kind::Number; }
    bool isString() const { return kind == Kind::String; }
    bool isObject() const { return kind == Kind::Object; }
    bool isArray() const { return kind == Kind::Array; }

    // ECMAScript ToBoolean.
    bool truthy() const {
        switch (kind) {
            case Kind::Absent:
            case Kind::Null:
                return false;
            case Kind::Bool:
                return boolean;
            case Kind::Number:
                return number != 0.0 && number == number;  // NaN is falsy
            case Kind::String:
                return !text.empty();
            case Kind::Object:
            case Kind::Array:
                return true;
        }
        return false;
    }

    // `value === 'someString'` for a JS string literal: false for every type
    // that is not a string, so a numeric `mode` never accidentally matches.
    bool equalsString(const std::string& expected) const {
        return kind == Kind::String && text == expected;
    }

    // `value === role` where role is a Role name string.
    bool equalsRole(Role role) const { return equalsString(roleName(role)); }

    // `value === undefined`
    bool isUndefined() const { return kind == Kind::Absent; }
};

// ---------------------------------------------------------------------------
// articulation.ts / slice-instrument.ts: nested value objects
// ---------------------------------------------------------------------------

// model.ts:90-92 `RepeatArticulation`. `reverse?: boolean` is checked with
// `typeof r.reverse !== 'boolean'`, so it keeps its run-time type.
//
// Array elements are not guaranteed to be objects: `repeats: [null]` makes
// validateArticulation throw 'Invalid repeat expression.' and makes
// articulationLabel throw a TypeError on `r.gain`, while `repeats: [5]` only
// yields `undefined` property reads.
enum class RepeatElemKind { Object, Nullish, Scalar };

struct RepeatArticulation
{
    std::optional<double> gain;
    std::optional<double> pitch;
    std::optional<double> sourceOffset;
    JsValue reverse;
    std::optional<double> glide;

    RepeatElemKind elemKind = RepeatElemKind::Object;
};

// model.ts:93-97 `Articulation`.
struct Articulation
{
    std::optional<double> durationTicks;
    // `mode: 'natural'|'gate'|'chop'` - a plain string, because the TS checks
    // membership in a literal list rather than the declared type.
    std::optional<std::string> mode;
    std::optional<std::vector<RepeatArticulation>> repeats;
    // Set only when `a.repeats` EXISTS but is not an array (a string, a number,
    // null...). The TS collapses all of those into the same "Repeat expression
    // must match ratchets." throw, and without the flag `repeats = []` and
    // `repeats = 'x'` would be indistinguishable - which matters, because with
    // `ratchets: 0` an empty array passes the length test while a non-array does
    // not. Absent here means "repeats was not a non-array value".
    JsValue repeatsRaw;
    // `if (a.chokeGroup) parts.push('hat choke')` tests truthiness, so a numeric
    // 0 must stay falsy even though `!== 'hat'` still throws in validation.
    JsValue chokeGroup;
};

// model.ts:42 `SliceRef`.
struct SliceRef
{
    std::string assetId;
    double startFrame = 0.0;
    double endFrame = 0.0;
    double sampleRate = 0.0;
    std::string label;
};

// The anonymous slice record inside `SliceInstrument.slices`.
struct Slice
{
    std::string id;
    double note = 0.0;
    double startFrame = 0.0;
    double endFrame = 0.0;
};

// model.ts:43-47 `SliceInstrument`.
struct SliceInstrument
{
    std::string id;
    std::string name;
    std::string assetId;
    double sampleRate = 0.0;
    double startFrame = 0.0;
    double endFrame = 0.0;
    std::vector<Slice> slices;
    // `if (!Array.isArray(instrument.slices) || !instrument.slices.length || ...)`
    // Note `!Array.isArray(...)` is TRUE for every non-array, so an absent, a
    // non-array and an empty array all take that branch and produce the same
    // message; `hasSlices` records whether a real array was supplied, because
    // resolveSlice() distinguishes "no such slice" from "slices is not a list".
    bool hasSlices = false;
    JsValue slicesRaw;  // the non-array value, when there was one
    std::optional<double> loopFadeMs;
};

// ---------------------------------------------------------------------------
// model.ts:101-127 `Hit` (the wave-2 subset)
// ---------------------------------------------------------------------------

struct Hit
{
    // Hit fields that wave 2 reads or passes through. Required fields default
    // to the values the TS validators cannot distinguish from `undefined`.
    std::string id;
    Role role = Role::Kick;
    std::optional<std::string> trackId;  // `!hit.trackId` (absent OR empty)
    std::string sourceId;
    double baseTick = 0.0;
    double offsetTick = 0.0;
    std::optional<double> gain;  // arithmetic: NaN when absent, as in JS
    double pan = 0.0;
    bool anchor = false;
    bool ghost = false;
    std::string reason;

    // `reverse?: boolean` - written by applyReverseProbability and preserved
    // through setRatchets' structuredClone, so it keeps its run-time type.
    JsValue reverse;

    std::optional<double> ratchets;
    // `hit.gate === undefined` is a STRICT comparison in setRatchets, so a null
    // gate and an absent gate take different branches.
    JsValue gate;
    std::optional<std::string> sourceKind;  // `!['oneShot','slice'].includes(...)`
    std::optional<Articulation> articulation;
    // `hit.articulation = null` is NOT `undefined`: the TS skips the whole check
    // for undefined and throws 'Invalid articulation mode.' for null, so the
    // non-object case needs its own slot.
    std::optional<std::string> articulationRaw;

    std::optional<SliceRef> slice;

    // `mapped?: {instrumentId:string; note:number}`. The TS tests truthiness
    // first (`if (!hit.mapped) return undefined`), then reads the members, so a
    // non-object truthy value reaches identifier(undefined).
    struct Mapped
    {
        std::optional<std::string> instrumentId;
        std::optional<double> note;
    };
    std::optional<Mapped> mapped;
    // The run-time value of `hit.mapped`, for the `if (!hit.mapped)` test.
    JsValue mappedRaw;

    // `synthNote?: {note; durationTicks}` - only tested for truthiness.
    JsValue synthNote;

    JsValue generatedDrumRole;

    // `if (!hit.trackId)` as the TS writes it.
    bool hasTrackId() const { return trackId.has_value() && !trackId->empty(); }
};

// ---------------------------------------------------------------------------
// model.ts:14-41 `Settings` (the wave-2 subset)
// ---------------------------------------------------------------------------

struct Settings
{
    std::optional<std::string> algorithm;
    std::optional<std::string> timeSignature;
    std::optional<double> variation;
    // TS marks resolution/bpm/bars required, but the engine's own comment
    // ("omitted patterns follow resolution / 4") shows they can be missing at
    // run time; they are optional so trackerTiming()/patternSeconds() reproduce
    // the `NaN` an omitted value produces in JS arithmetic.
    std::optional<double> resolution;
    std::optional<double> lpb;
    std::string seed;
    std::optional<double> bpm;
    std::optional<double> bars;
    std::optional<double> reverseProbability;
};

// ---------------------------------------------------------------------------
// model.ts:49-60 SampleTrack / UserTrack (the wave-2 subset)
// ---------------------------------------------------------------------------

struct UserTrack
{
    // `track?.kind === 'synth'` - the raw string, never an enum.
    std::optional<std::string> kind;
    std::string id;
    std::string name;
    Role role = Role::Kick;
    // `track.generationRole` is only tested for truthiness and compared with
    // `=== role`, so null and undefined are indistinguishable here.
    JsValue generationRole;
    std::optional<double> generationDensity;
    std::optional<double> generationProbability;
};

// model.ts:6 `DrumLane` - `generationRole: Role|null`, only used in
// `config.generationRole === role` and in truthiness tests.
struct DrumLane
{
    std::string name;
    bool visible = true;
    JsValue generationRole;
};

struct DrumLaneMap
{
    // `pattern.drumLanes?.[role] ?? {name, visible, generationRole: role}`
    std::optional<DrumLane> lanes[kRoleCount];

    std::optional<DrumLane>& at(Role role) { return lanes[static_cast<int>(role)]; }
    const std::optional<DrumLane>& at(Role role) const { return lanes[static_cast<int>(role)]; }
};

// ---------------------------------------------------------------------------
// model.ts:128-133 `Pattern`
// ---------------------------------------------------------------------------

struct Pattern
{
    std::string engineVersion;
    Settings settings;
    double ppq = 0.0;
    std::vector<Hit> events;

    // `layout.drumLanes` is tested with `!layout.drumLanes`, and an empty object
    // is truthy in JS, so presence is a separate bit from "has any lane".
    bool hasDrumLanes = false;
    DrumLaneMap drumLanes;

    // `(layout.userTracks ?? [])` - an absent array and an empty array behave
    // identically, so only one bit is needed.
    std::vector<UserTrack> userTracks;

    // `pattern.sliceInstruments === undefined` returns early, while a non-array
    // value throws; both cases need to be distinguishable from `[]`.
    bool hasSliceInstruments = false;
    JsValue sliceInstrumentsRaw;  // the non-array value, when there was one
    std::vector<SliceInstrument> sliceInstruments;
};

// ---------------------------------------------------------------------------
// Small JS-semantics helpers shared by the wave-2 modules
// ---------------------------------------------------------------------------

// `undefined` in a numeric expression is NaN, so an omitted optional number
// contributes NaN to the arithmetic exactly as JS does.
double jsNumber(const std::optional<double>& value);
// `hit.ratchets ?? 1`, `track.generationDensity ?? 1`, ... - `??` falls back
// only for undefined, never for 0 or NaN.
double jsNumberOr(const std::optional<double>& value, double fallback);
// `value || fallback` for a number: 0, -0 and NaN are falsy, so
// `a.durationTicks || rowTicks` uses the fallback for all three.
double jsFalsyNumberOr(const std::optional<double>& value, double fallback);
// `if (r.pitch || r.glide)` for one number.
bool jsTruthy(const std::optional<double>& value);
// `${settings.seed}` in a template literal.
std::string jsTemplateString(const std::optional<std::string>& value);

}  // namespace bbpm::core
