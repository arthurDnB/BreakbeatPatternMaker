// Hand port of the constants and pure helpers of src/core/model.ts.
// See Model.h for the fidelity notes. Standard library only, no JUCE.

#include "Model.h"

#include <charconv>
#include <cmath>
#include <cstddef>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <system_error>

namespace bbpm::core {

// ---------------------------------------------------------------------------
// Wire tables
// ---------------------------------------------------------------------------

const char* const kRoleNames[kRoleCount] = {"kick", "snare", "hat", "percussion"};

namespace {

// model.ts:7 - Genre (also schemas/bbpattern-v1.schema.json:12, same order).
const char* const kGenreItems[] = {
    "jungle", "dnb", "hiphop", "trap", "rap", "drill", "breakcore", "idm",
    "hardcore", "experimental", "breaks", "bigbeat", "nuskoolbreaks",
    "electrobreaks", "breakbeathardcore", "raggajungle", "atmosphericjungle",
    "footworkjungle", "downtempo", "lofihiphop", "boombap", "mellowbeats",
    "liquiddnb", "jumpup", "garage", "speedgarage", "twostepgarage", "dub",
    "psydub", "dubstep", "brostep", "postdubstep", "drumfunk", "amenscience",
    "atmosphericbreakcore", "triphop", "halftimednb", "neurofunk",
};
static_assert(sizeof(kGenreItems) / sizeof(kGenreItems[0]) == 38, "model.ts:7 lists 38 genres");

// model.ts:8-13
const char* const kBreakStyleItems[] = {"genre", "amen", "think", "apache", "funkyDrummer", "hotPants"};
static_assert(sizeof(kBreakStyleItems) / sizeof(kBreakStyleItems[0]) == 6, "model.ts:8 lists 6 break styles");

const char* const kBreakLayerItems[] = {"off", "think-passage2"};
const char* const kGenerationModeItems[] = {"drums", "melody", "both"};
const char* const kMelodyPartItems[] = {"bassline", "lead", "piano"};

const char* const kMelodyScaleItems[] = {
    "major", "natural-minor", "harmonic-minor", "melodic-minor", "dorian",
    "phrygian", "lydian", "mixolydian", "locrian", "major-pentatonic",
    "minor-pentatonic", "blues", "whole-tone", "diminished",
    "double-harmonic", "hirajoshi",
};
static_assert(sizeof(kMelodyScaleItems) / sizeof(kMelodyScaleItems[0]) == 16, "model.ts:12 lists 16 scales");

const char* const kHarmonyStyleItems[] = {"genre", "jazz", "neo-soul", "modal"};

// model.ts:15, :18, :23, :24, :34, :37 - unions declared inline inside Settings.
const char* const kAlgorithmItems[] = {"legacy-v1", "groove-v2", "groove-v3", "groove-v4", "groove-v5", "groove-v5.1"};
static_assert(sizeof(kAlgorithmItems) / sizeof(kAlgorithmItems[0]) == 6, "model.ts:15 lists 6 algorithms");

const char* const kPatternStructureItems[] = {"groove", "auto", "fill", "roll", "build"};
const char* const kChordProgressionItems[] = {
    "auto", "I-V-vi-IV", "vi-IV-I-V", "I-vi-IV-V", "ii-V-I", "iii-VI-ii-V",
    "minor-i-VI-III-VII", "custom",
};
static_assert(sizeof(kChordProgressionItems) / sizeof(kChordProgressionItems[0]) == 8, "model.ts:37 lists 8 progressions");

// model.ts:95, :100, :112, :120, :51, :87 - inline literal unions elsewhere.
const char* const kArticulationModeItems[] = {"natural", "gate", "chop"};
const char* const kEffectCommandItems[] = {"0S", "09", "0B", "0U", "01", "0D", "02", "0C", "0R"};
static_assert(sizeof(kEffectCommandItems) / sizeof(kEffectCommandItems[0]) == 9, "model.ts:100 lists 9 FX commands");

const char* const kHitSourceKindItems[] = {"oneShot", "slice"};
const char* const kHitSpeedModeItems[] = {"repitch", "stretch"};
const char* const kTrackKindItems[] = {"sample", "synth"};

// model.ts:61-82
const char* const kSynthWaveformItems[] = {"sine", "triangle", "saw", "square"};
const char* const kSynthCategoryItems[] = {"Bass", "Lead", "Pad", "Keys & Pluck", "FX"};

const char* const kSynthPresetItems[] = {
    "bass", "pluck", "pad", "piano",
    "reese", "acid303", "sub808", "donk", "neuro-wobble", "dub-sub",
    "supersaw", "chiptune", "sync-lead", "vocal-lead", "sine-whistle",
    "lush-pad", "dark-drone", "warm-strings", "ethereal-pad",
    "bell-pluck", "rhodes-keys", "house-organ",
    "laser-zap", "noise-sweep", "scifi-sweep",
};
static_assert(sizeof(kSynthPresetItems) / sizeof(kSynthPresetItems[0]) == 25, "model.ts:62-68 lists 25 presets");

const char* const kSynthModuleTypeItems[] = {
    "oscillator", "fm-operator", "sample", "mixer", "filter", "amplifier",
    "envelope", "multi-envelope", "lfo", "velocity", "attenuverter", "chorus",
    "delay", "reverb", "output", "distortion", "noise",
};
static_assert(sizeof(kSynthModuleTypeItems) / sizeof(kSynthModuleTypeItems[0]) == 17, "model.ts:82 lists 17 module types");

// model.ts:86 - SynthInstrument.sampleBank
const char* const kSampleBankItems[] = {"upright-kw"};

const char* const kNoteClassNames[] = {"C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"};
static_assert(sizeof(kNoteClassNames) / sizeof(kNoteClassNames[0]) == 12, "model.ts:167 has 12 note classes");

// model.ts:18, :23, :24
const int kPhraseLengthItems[] = {4, 8, 16};
const int kResolutionItems[] = {8, 16, 32, 64};
const int kLpbItems[] = {1, 2, 3, 4, 6, 8, 12, 16, 24, 32};
static_assert(sizeof(kLpbItems) / sizeof(kLpbItems[0]) == 10, "model.ts:24 lists 10 LPB values");

// U+2013 EN DASH, exactly as embedded in model.ts:162.
const char kEnDashUtf8[] = "\xE2\x80\x93";

bool isControlByte(unsigned char c) { return c < 0x20u || c == 0x7fu; }

bool isIdentifierByte(unsigned char c) {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') ||
           c == '.' || c == '_' || c == '-';
}

}  // namespace

const char* roleName(Role role) {
    const int index = static_cast<int>(role);
    if (index < 0 || index >= kRoleCount) return nullptr;
    return kRoleNames[index];
}

bool roleFromName(const std::string& name, Role& role) {
    for (int i = 0; i < kRoleCount; ++i) {
        if (name == kRoleNames[i]) {
            role = static_cast<Role>(i);
            return true;
        }
    }
    return false;
}

const StringTable* stringTables(int& count) {
    static const StringTable kTables[] = {
        {"roles", kRoleNames, kRoleCount},
        {"genres", kGenreItems, 38},
        {"breakStyles", kBreakStyleItems, 6},
        {"breakLayers", kBreakLayerItems, 2},
        {"generationModes", kGenerationModeItems, 3},
        {"melodyParts", kMelodyPartItems, 3},
        {"melodyScales", kMelodyScaleItems, 16},
        {"harmonyStyles", kHarmonyStyleItems, 4},
        {"algorithms", kAlgorithmItems, 6},
        {"patternStructures", kPatternStructureItems, 5},
        {"chordProgressions", kChordProgressionItems, 8},
        {"articulationModes", kArticulationModeItems, 3},
        {"effectCommands", kEffectCommandItems, 9},
        {"hitSourceKinds", kHitSourceKindItems, 2},
        {"hitSpeedModes", kHitSpeedModeItems, 2},
        {"trackKinds", kTrackKindItems, 2},
        {"synthWaveforms", kSynthWaveformItems, 4},
        {"synthCategories", kSynthCategoryItems, 5},
        {"synthPresets", kSynthPresetItems, 25},
        {"synthModuleTypes", kSynthModuleTypeItems, 17},
        {"sampleBanks", kSampleBankItems, 1},
    };
    count = static_cast<int>(sizeof(kTables) / sizeof(kTables[0]));
    return kTables;
}

const IntTable* intTables(int& count) {
    static const IntTable kTables[] = {
        {"phraseLengths", kPhraseLengthItems, 3},
        {"resolutions", kResolutionItems, 4},
        {"lpbs", kLpbItems, 10},
    };
    count = static_cast<int>(sizeof(kTables) / sizeof(kTables[0]));
    return kTables;
}

const StringTable* findStringTable(const std::string& name) {
    int count = 0;
    const StringTable* tables = stringTables(count);
    for (int i = 0; i < count; ++i) {
        if (name == tables[i].name) return &tables[i];
    }
    return nullptr;
}

const IntTable* findIntTable(const std::string& name) {
    int count = 0;
    const IntTable* tables = intTables(count);
    for (int i = 0; i < count; ++i) {
        if (name == tables[i].name) return &tables[i];
    }
    return nullptr;
}

bool tableContains(const StringTable& table, const std::string& value) {
    for (int i = 0; i < table.count; ++i) {
        if (value == table.items[i]) return true;
    }
    return false;
}

bool tableContains(const IntTable& table, int value) {
    for (int i = 0; i < table.count; ++i) {
        if (value == table.items[i]) return true;
    }
    return false;
}

// ---------------------------------------------------------------------------
// ECMAScript String(number)
// ---------------------------------------------------------------------------

std::string jsNumberToString(double value) {
    if (std::isnan(value)) return "NaN";
    if (std::isinf(value)) return value < 0 ? "-Infinity" : "Infinity";
    // JS renders both +0 and -0 as "0".
    if (value == 0.0) return "0";

    const bool negative = value < 0;
    const double magnitude = negative ? -value : value;

    // Shortest decimal that parses back to the same double: exactly the digit
    // set ECMAScript uses before it applies its formatting rules.
    //
    // This deliberately uses std::to_chars rather than a `%.*g` / strtod
    // round-trip search. MSVC's snprintf does not always emit the correctly
    // rounded n-digit form, so that search agreed with String(x) on 376866 of
    // 376868 probed values and fell back to 17 digits on the two it missed
    // (2^-24 printed as "5.9604644775390625e-8" where JS prints
    // "5.960464477539063e-8"), which would break the pinned JSON digests.
    // To_chars with chars_format::scientific and no precision is specified to
    // produce the shortest round-tripping digit string.
    char buffer[64];
    const std::to_chars_result converted =
        std::to_chars(buffer, buffer + sizeof(buffer), magnitude, std::chars_format::scientific);
    if (converted.ec != std::errc()) {
        // Unreachable for a finite double in 64 bytes, but never print garbage.
        std::snprintf(buffer, sizeof(buffer), "%.17e", magnitude);
    } else {
        *converted.ptr = '\0';
    }

    // Split the scientific form into a digit stream plus the exponent of its
    // first digit.
    std::string stream;
    int integerDigits = 0;
    int exponent = 0;
    bool seenPoint = false;
    for (const char* p = buffer; *p != '\0'; ++p) {
        const char c = *p;
        if (c >= '0' && c <= '9') {
            stream.push_back(c);
            if (!seenPoint) ++integerDigits;
        } else if (c == '.') {
            seenPoint = true;
        } else if (c == 'e' || c == 'E') {
            exponent = std::atoi(p + 1);
            break;
        }
    }

    std::size_t leading = 0;
    while (leading < stream.size() && stream[leading] == '0') ++leading;
    std::string digits = stream.substr(leading);
    while (digits.size() > 1 && digits.back() == '0') digits.pop_back();
    if (digits.empty()) digits = "0";

    // value == 0.digits * 10^n
    const int k = static_cast<int>(digits.size());
    const int n = integerDigits + exponent - static_cast<int>(leading);

    std::string out;
    if (k <= n && n <= 21) {
        out = digits + std::string(static_cast<std::size_t>(n - k), '0');
    } else if (0 < n && n <= 21) {
        out = digits.substr(0, static_cast<std::size_t>(n)) + "." + digits.substr(static_cast<std::size_t>(n));
    } else if (-6 < n && n <= 0) {
        out = "0." + std::string(static_cast<std::size_t>(-n), '0') + digits;
    } else {
        const std::string mantissa = (k == 1) ? digits : digits.substr(0, 1) + "." + digits.substr(1);
        const int e = n - 1;
        out = mantissa + "e" + (e >= 0 ? "+" : "-") + std::to_string(e >= 0 ? e : -e);
    }
    return negative ? "-" + out : out;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

bool bounded(double value, double min, double max, const std::string& name, bool integer, std::string& error) {
    if (!std::isfinite(value) || value < min || value > max || (integer && std::floor(value) != value)) {
        error = name + " must be " + (integer ? "an integer" : "a number") + " from " +
                jsNumberToString(min) + " to " + jsNumberToString(max) + ".";
        return false;
    }
    error.clear();
    return true;
}

bool bounded(double value, double min, double max, const std::string& name, std::string& error) {
    return bounded(value, min, max, name, false, error);
}

bool identifier(const std::string& value, const std::string& name, std::string& error) {
    bool ok = value.size() >= 1 && value.size() <= 80;
    if (ok) {
        for (std::size_t i = 0; i < value.size(); ++i) {
            if (!isIdentifierByte(static_cast<unsigned char>(value[i]))) {
                ok = false;
                break;
            }
        }
    }
    if (!ok) {
        error = name + " is not a valid identifier.";
        return false;
    }
    error.clear();
    return true;
}

bool text(const std::string& value, const std::string& name, int maxLength, std::string& error) {
    bool ok = value.size() >= 1 && static_cast<int>(value.size()) <= maxLength;
    if (ok) {
        for (std::size_t i = 0; i < value.size(); ++i) {
            if (isControlByte(static_cast<unsigned char>(value[i]))) {
                ok = false;
                break;
            }
        }
    }
    if (!ok) {
        error = name + " must contain 1" + kEnDashUtf8 + jsNumberToString(static_cast<double>(maxLength)) +
                " UTF-8 bytes without control characters.";
        return false;
    }
    error.clear();
    return true;
}

bool text(const std::string& value, const std::string& name, std::string& error) {
    return text(value, name, 120, error);
}

bool noteNameFor(int note, std::string& out, std::string& error) {
    if (!bounded(static_cast<double>(note), 0.0, 119.0, "note", true, error)) {
        out.clear();
        return false;
    }
    out = std::string(kNoteClassNames[note % 12]) + jsNumberToString(static_cast<double>(note / 12));
    error.clear();
    return true;
}

std::string noteName(int note) {
    std::string out;
    std::string error;
    noteNameFor(note, out, error);
    return out;
}

std::string hex(int n) {
    static const char kDigits[] = "0123456789ABCDEF";
    const long long value = static_cast<long long>(n);
    const bool negative = value < 0;
    unsigned long long magnitude = static_cast<unsigned long long>(negative ? -value : value);

    std::string digits;
    if (magnitude == 0) {
        digits = "0";
    } else {
        while (magnitude > 0) {
            digits.insert(digits.begin(), kDigits[magnitude & 0xfu]);
            magnitude >>= 4;
        }
    }
    std::string out = negative ? "-" + digits : digits;
    if (out.size() < 2) out.insert(out.begin(), '0');  // padStart(2, '0')
    return out;
}

bool isSynthTrackKind(const std::string& kind) { return kind == "synth"; }

const DefaultSource* defaultSources() {
    static const DefaultSource kSources[kRoleCount] = {
        {"kit.kick", Role::Kick, "oneShot", "BPM kick", 48, 0},
        {"kit.snare", Role::Snare, "oneShot", "BPM snare", 48, 1},
        {"kit.hat", Role::Hat, "oneShot", "BPM hat", 48, 2},
        {"kit.percussion", Role::Percussion, "oneShot", "BPM percussion", 48, 3},
    };
    return kSources;
}

}  // namespace bbpm::core
