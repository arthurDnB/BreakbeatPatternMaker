// Implementation of the golden-vector self test. See SelfTest.h for the format
// of native/tests/vectors/random-model.txt and for the usage contract.
//
// Faithfulness notes
// - One check per recorded JS value: every non-comment, non-blank vector line
//   contributes exactly one comparison (a structural problem on a line - an
//   unknown table, a non-numeric index - is counted as a failure instead).
// - Strings and integers are compared exactly.
// - Doubles are compared as TEXT: the file records ECMAScript String(x) ("float"
//   lines) and the port reproduces it with jsNumberToString(), so the check is
//   an exact decimal-text equality, not a tolerance. "floatbits" lines pin the
//   IEEE-754 bit pattern as a second, tolerance-free view of the same value.
// - The reported outcome of a throwing helper is the same string the generator
//   recorded: probe() writes "ok" for success and "throw:<message>" otherwise.

#include "SelfTest.h"

#include "Model.h"
#include "Random.h"

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <limits>
#include <map>
#include <memory>
#include <string>
#include <vector>

namespace bbpm::core {

namespace {

// ---------------------------------------------------------------------------
// %XX field decoding
// ---------------------------------------------------------------------------

const int kMaxReported = 20;

int hexDigit(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    return -1;
}

// Encoder inverse (generate-vectors.mjs encodeField): %XX becomes the raw byte,
// everything else is copied. A stray '%' that is not followed by two hex digits
// is passed through unchanged.
std::string decodeField(const std::string& encoded) {
    std::string out;
    out.reserve(encoded.size());
    for (std::size_t i = 0; i < encoded.size(); ++i) {
        if (encoded[i] == '%' && i + 2 < encoded.size()) {
            const int hi = hexDigit(encoded[i + 1]);
            const int lo = hexDigit(encoded[i + 2]);
            if (hi >= 0 && lo >= 0) {
                out.push_back(static_cast<char>((hi << 4) | lo));
                i += 2;
                continue;
            }
        }
        out.push_back(encoded[i]);
    }
    return out;
}

// ---------------------------------------------------------------------------
// Parsed line
// ---------------------------------------------------------------------------

struct Part {
    std::string key;
    std::string value;
};

struct Line {
    int number = 0;
    std::string rawName;  // first field, still %XX-encoded (used in messages)
    std::string kind;     // first ';'-separated field, decoded
    std::vector<Part> parts;
    std::string value;  // second field, decoded
};

bool partValue(const Line& line, const std::string& key, std::string& out) {
    for (std::size_t i = 0; i < line.parts.size(); ++i) {
        if (line.parts[i].key == key) {
            out = line.parts[i].value;
            return true;
        }
    }
    return false;
}

bool parseLine(const std::string& raw, int number, Line& line, std::string& error) {
    const std::size_t tab = raw.find('\t');
    if (tab == std::string::npos) {
        error = "no TAB separator";
        return false;
    }
    if (raw.find('\t', tab + 1) != std::string::npos) {
        error = "more than one TAB separator";
        return false;
    }

    line.number = number;
    line.rawName = raw.substr(0, tab);
    line.value = decodeField(raw.substr(tab + 1));

    std::size_t start = 0;
    while (start <= line.rawName.size()) {
        std::size_t end = line.rawName.find(';', start);
        if (end == std::string::npos) end = line.rawName.size();
        const std::string piece = line.rawName.substr(start, end - start);

        if (line.kind.empty()) {
            line.kind = decodeField(piece);
        } else {
            const std::size_t equals = piece.find('=');
            if (equals == std::string::npos) {
                error = "name field has a ';'-separated part without '=': \"" + piece + "\"";
                return false;
            }
            Part part;
            part.key = decodeField(piece.substr(0, equals));
            part.value = decodeField(piece.substr(equals + 1));
            line.parts.push_back(part);
        }

        if (end == line.rawName.size()) break;
        start = end + 1;
    }

    if (line.kind.empty()) {
        error = "empty name field";
        return false;
    }
    return true;
}

std::string label(const Line& line) {
    return "line " + std::to_string(line.number) + ": " + line.rawName;
}

// ---------------------------------------------------------------------------
// Value parsing
// ---------------------------------------------------------------------------

bool parseIntStrict(const std::string& text, long long& out) {
    if (text.empty()) return false;
    std::size_t i = 0;
    bool negative = false;
    if (text[0] == '-') {
        negative = true;
        i = 1;
    } else if (text[0] == '+') {
        i = 1;
    }
    if (i >= text.size()) return false;

    long long value = 0;
    for (; i < text.size(); ++i) {
        if (text[i] < '0' || text[i] > '9') return false;
        value = value * 10 + (text[i] - '0');
    }
    out = negative ? -value : value;
    return true;
}

bool parseUintStrict(const std::string& text, unsigned long long& out) {
    if (text.empty()) return false;
    unsigned long long value = 0;
    for (std::size_t i = 0; i < text.size(); ++i) {
        if (text[i] < '0' || text[i] > '9') return false;
        value = value * 10ull + static_cast<unsigned long long>(text[i] - '0');
    }
    out = value;
    return true;
}

// The three non-finite spellings the generator can emit, plus std::strtod for
// everything else (MSVC 19.29; deliberately not <charconv>, whose MSVC 19.29
// floating-point support is incomplete).
bool parseDoubleLiteral(const std::string& text, double& out) {
    if (text == "NaN") {
        out = std::numeric_limits<double>::quiet_NaN();
        return true;
    }
    if (text == "Infinity" || text == "+Infinity") {
        out = std::numeric_limits<double>::infinity();
        return true;
    }
    if (text == "-Infinity") {
        out = -std::numeric_limits<double>::infinity();
        return true;
    }
    const char* begin = text.c_str();
    char* end = nullptr;
    const double value = std::strtod(begin, &end);
    if (end == begin || end == nullptr || *end != '\0') return false;
    out = value;
    return true;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

class Runner {
public:
    int checks = 0;
    int failures = 0;
    std::vector<std::string> problems;

    void checkString(const std::string& actual, const std::string& expected, const std::string& where) {
        ++checks;
        if (actual == expected) return;
        ++failures;
        record(where + "\n  expected: \"" + expected + "\"\n  actual:   \"" + actual + "\"");
    }

    void checkLong(long long actual, long long expected, const std::string& where) {
        ++checks;
        if (actual == expected) return;
        ++failures;
        record(where + "\n  expected: " + std::to_string(expected) + "\n  actual:   " + std::to_string(actual));
    }

    void checkUint(unsigned long long actual, unsigned long long expected, const std::string& where) {
        ++checks;
        if (actual == expected) return;
        ++failures;
        record(where + "\n  expected: " + std::to_string(expected) + "\n  actual:   " + std::to_string(actual));
    }

    // A malformed or unknown vector line: a failure, but no compared value.
    void fail(const std::string& where, const std::string& message) {
        ++failures;
        record(where + "\n  " + message);
    }

private:
    void record(const std::string& message) {
        if (static_cast<int>(problems.size()) < kMaxReported) problems.push_back(message);
    }
};

// Helpers that parse a vector field and report a structural failure when it is
// not what the format promises.
bool partLong(const Line& line, Runner& runner, const std::string& key, long long& out) {
    std::string text;
    if (!partValue(line, key, text)) {
        runner.fail(label(line), "missing " + key + "=");
        return false;
    }
    if (!parseIntStrict(text, out)) {
        runner.fail(label(line), key + "= is not an integer: \"" + text + "\"");
        return false;
    }
    return true;
}

bool valueUint(const Line& line, Runner& runner, unsigned long long& out) {
    if (!parseUintStrict(line.value, out)) {
        runner.fail(label(line), "value is not an unsigned integer: \"" + line.value + "\"");
        return false;
    }
    return true;
}

bool valueDouble(const Line& line, Runner& runner, double& out) {
    if (!parseDoubleLiteral(line.value, out)) {
        runner.fail(label(line), "value is not a number: \"" + line.value + "\"");
        return false;
    }
    return true;
}

// One comparison for the "ok" / "throw:<message>" probe convention.
void checkProbe(Runner& runner, bool ok, const std::string& error, const std::string& expected,
                const std::string& where) {
    runner.checkString(ok ? std::string("ok") : ("throw:" + error), expected, where);
}

// ---------------------------------------------------------------------------
// Draw cache: draw.i / float.i / floatbits.i are successive draws of one
// generator, so each (seed, stream) pair gets a generator that is advanced
// sequentially. Rewinding (out-of-order index) restarts the stream, which keeps
// the test correct even if the vector order ever changes.
// ---------------------------------------------------------------------------

struct DrawCache {
    struct Stream {
        Stream(const std::string& seed, const std::string& stream) : rng(seed, stream) {}
        Random rng;
        int next = 0;
        std::uint32_t last = 0;
    };

    std::map<std::string, std::shared_ptr<Stream> > streams;

    std::uint32_t at(const std::string& seed, const std::string& stream, int index) {
        const std::string key = seed + '\x1f' + stream;
        std::shared_ptr<Stream>& entry = streams[key];
        if (!entry) entry = std::make_shared<Stream>(seed, stream);
        if (index < entry->next - 1) {
            entry->rng = Random(seed, stream);
            entry->next = 0;
            entry->last = 0;
        }
        while (entry->next <= index) {
            entry->last = entry->rng.nextUint32();
            ++entry->next;
        }
        return entry->last;
    }
};

double doubleFromDraw(std::uint32_t draw) {
    return static_cast<double>(draw) / 4294967296.0;
}

std::string floatBits(std::uint32_t draw) {
    const double value = doubleFromDraw(draw);
    std::uint64_t bits = 0;
    static_assert(sizeof(double) == sizeof(bits), "IEEE-754 binary64 expected");
    std::memcpy(&bits, &value, sizeof(bits));
    char buffer[32];
    std::snprintf(buffer, sizeof(buffer), "%016llx", static_cast<unsigned long long>(bits));
    return std::string(buffer);
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

void dispatchLine(const Line& line, Runner& runner, DrawCache& draws) {
    const std::string& kind = line.kind;
    const std::string where = label(line);

    if (kind == "const") {
        std::string key;
        if (!partValue(line, "k", key)) {
            runner.fail(where, "missing k=");
            return;
        }
        if (key == "engineVersion") {
            runner.checkString(kEngineVersion, line.value, where);
        } else if (key == "ppq") {
            long long expected = 0;
            if (parseIntStrict(line.value, expected)) runner.checkLong(kPpq, expected, where);
            else runner.fail(where, "ppq value is not an integer: \"" + line.value + "\"");
        } else if (key == "transferFormat") {
            runner.checkString(kTransferFormat, line.value, where);
        } else if (key == "transferVersion") {
            long long expected = 0;
            if (parseIntStrict(line.value, expected)) runner.checkLong(kTransferVersion, expected, where);
            else runner.fail(where, "transferVersion value is not an integer: \"" + line.value + "\"");
        } else if (key == "roleCount") {
            long long expected = 0;
            if (parseIntStrict(line.value, expected)) runner.checkLong(kRoleCount, expected, where);
            else runner.fail(where, "roleCount value is not an integer: \"" + line.value + "\"");
        } else {
            runner.fail(where, "unknown const key \"" + key + "\"");
        }
        return;
    }

    if (kind == "string") {
        std::string table;
        if (!partValue(line, "table", table)) {
            runner.fail(where, "missing table=");
            return;
        }
        const StringTable* found = findStringTable(table);
        if (found == nullptr) {
            runner.fail(where, "no such string table: \"" + table + "\"");
            return;
        }
        std::string marker;
        if (partValue(line, "size", marker)) {
            long long expected = 0;
            if (!parseIntStrict(line.value, expected)) {
                runner.fail(where, "table size is not an integer: \"" + line.value + "\"");
                return;
            }
            runner.checkLong(found->count, expected, where);
            return;
        }
        long long index = 0;
        if (!partLong(line, runner, "index", index)) return;
        if (index < 0 || index >= found->count) {
            runner.fail(where, "index out of range for table \"" + table + "\"");
            return;
        }
        runner.checkString(found->items[index], line.value, where);
        return;
    }

    if (kind == "int") {
        std::string table;
        if (!partValue(line, "table", table)) {
            runner.fail(where, "missing table=");
            return;
        }
        const IntTable* found = findIntTable(table);
        if (found == nullptr) {
            runner.fail(where, "no such int table: \"" + table + "\"");
            return;
        }
        std::string marker;
        if (partValue(line, "size", marker)) {
            long long expected = 0;
            if (!parseIntStrict(line.value, expected)) {
                runner.fail(where, "table size is not an integer: \"" + line.value + "\"");
                return;
            }
            runner.checkLong(found->count, expected, where);
            return;
        }
        long long index = 0;
        if (!partLong(line, runner, "index", index)) return;
        if (index < 0 || index >= found->count) {
            runner.fail(where, "index out of range for table \"" + table + "\"");
            return;
        }
        long long expected = 0;
        if (!parseIntStrict(line.value, expected)) {
            runner.fail(where, "value is not an integer: \"" + line.value + "\"");
            return;
        }
        runner.checkLong(found->items[index], expected, where);
        return;
    }

    if (kind == "source") {
        long long index = 0;
        if (!partLong(line, runner, "index", index)) return;
        if (index < 0 || index >= kRoleCount) {
            runner.fail(where, "source index out of range");
            return;
        }
        std::string field;
        if (!partValue(line, "field", field)) {
            runner.fail(where, "missing field=");
            return;
        }
        const DefaultSource& source = defaultSources()[index];
        if (field == "id") {
            runner.checkString(source.id, line.value, where);
        } else if (field == "role") {
            runner.checkString(roleName(source.role), line.value, where);
        } else if (field == "kind") {
            runner.checkString(source.kind, line.value, where);
        } else if (field == "label") {
            runner.checkString(source.label, line.value, where);
        } else if (field == "note") {
            long long expected = 0;
            if (parseIntStrict(line.value, expected)) runner.checkLong(source.note, expected, where);
            else runner.fail(where, "note is not an integer: \"" + line.value + "\"");
        } else if (field == "instrument") {
            long long expected = 0;
            if (parseIntStrict(line.value, expected)) runner.checkLong(source.instrument, expected, where);
            else runner.fail(where, "instrument is not an integer: \"" + line.value + "\"");
        } else {
            runner.fail(where, "unknown source field \"" + field + "\"");
        }
        return;
    }

    if (kind == "seed" || kind == "draw" || kind == "float" || kind == "floatbits") {
        std::string seed;
        std::string stream;
        if (!partValue(line, "seed", seed)) {
            runner.fail(where, "missing seed=");
            return;
        }
        if (!partValue(line, "stream", stream)) {
            runner.fail(where, "missing stream=");
            return;
        }

        if (kind == "seed") {
            unsigned long long expected = 0;
            if (!valueUint(line, runner, expected)) return;
            runner.checkUint(randomSeedHash(seed, stream), expected, where);
            return;
        }

        long long index = 0;
        if (!partLong(line, runner, "i", index)) return;
        if (index < 0) {
            runner.fail(where, "negative draw index");
            return;
        }
        const std::uint32_t draw = draws.at(seed, stream, static_cast<int>(index));

        if (kind == "draw") {
            unsigned long long expected = 0;
            if (!valueUint(line, runner, expected)) return;
            runner.checkUint(draw, expected, where);
        } else if (kind == "float") {
            // Exact decimal text: the file holds ECMAScript String(draw / 2^32)
            // and jsNumberToString() exists to reproduce it byte for byte.
            runner.checkString(jsNumberToString(doubleFromDraw(draw)), line.value, where);
        } else {
            runner.checkString(floatBits(draw), line.value, where);
        }
        return;
    }

    if (kind == "jsnum") {
        std::string literal;
        if (!partValue(line, "in", literal)) {
            runner.fail(where, "missing in=");
            return;
        }
        double value = 0.0;
        if (!parseDoubleLiteral(literal, value)) {
            runner.fail(where, "in= is not a number: \"" + literal + "\"");
            return;
        }
        runner.checkString(jsNumberToString(value), line.value, where);
        return;
    }

    if (kind == "noteName") {
        long long note = 0;
        if (!partLong(line, runner, "in", note)) return;
        runner.checkString(noteName(static_cast<int>(note)), line.value, where);
        return;
    }

    if (kind == "noteNameFail") {
        long long note = 0;
        if (!partLong(line, runner, "in", note)) return;
        std::string out;
        std::string error;
        if (noteNameFor(static_cast<int>(note), out, error)) {
            runner.fail(where, "expected a failure, got \"" + out + "\"");
        } else {
            runner.checkString(error, line.value, where);
        }
        return;
    }

    if (kind == "hex") {
        long long n = 0;
        if (!partLong(line, runner, "in", n)) return;
        runner.checkString(hex(static_cast<int>(n)), line.value, where);
        return;
    }

    if (kind == "bounded") {
        std::string literal;
        if (!partValue(line, "in", literal)) {
            runner.fail(where, "missing in=");
            return;
        }
        double value = 0.0;
        if (!parseDoubleLiteral(literal, value)) {
            runner.fail(where, "in= is not a number: \"" + literal + "\"");
            return;
        }
        std::string minText;
        std::string maxText;
        std::string name;
        long long integer = 0;
        double min = 0.0;
        double max = 0.0;
        if (!partValue(line, "min", minText)) {
            runner.fail(where, "missing min=");
            return;
        }
        if (!parseDoubleLiteral(minText, min)) {
            runner.fail(where, "min= is not a number: \"" + minText + "\"");
            return;
        }
        if (!partValue(line, "max", maxText)) {
            runner.fail(where, "missing max=");
            return;
        }
        if (!parseDoubleLiteral(maxText, max)) {
            runner.fail(where, "max= is not a number: \"" + maxText + "\"");
            return;
        }
        if (!partLong(line, runner, "integer", integer)) return;
        if (!partValue(line, "name", name)) {
            runner.fail(where, "missing name=");
            return;
        }
        std::string error;
        const bool ok = bounded(value, min, max, name, integer != 0, error);
        checkProbe(runner, ok, error, line.value, where);
        return;
    }

    if (kind == "identifier" || kind == "text") {
        std::string value;
        std::string name;
        if (!partValue(line, "value", value)) {
            runner.fail(where, "missing value=");
            return;
        }
        if (!partValue(line, "name", name)) {
            runner.fail(where, "missing name=");
            return;
        }
        std::string error;
        bool ok = false;
        if (kind == "identifier") {
            ok = identifier(value, name, error);
        } else {
            long long maxLength = 0;
            if (!partLong(line, runner, "max", maxLength)) return;
            ok = text(value, name, static_cast<int>(maxLength), error);
        }
        checkProbe(runner, ok, error, line.value, where);
        return;
    }

    if (kind == "isSynth") {
        std::string marker;
        if (!partValue(line, "in", marker)) {
            runner.fail(where, "missing in=");
            return;
        }
        // generate-vectors.mjs passes { kind: value } except for the "undefined"
        // case, which has no object at all -> `track?.kind` is undefined.
        const std::string trackKind = (marker == "undefined") ? std::string() : marker;
        runner.checkString(isSynthTrackKind(trackKind) ? "true" : "false", line.value, where);
        return;
    }

    runner.fail(where, "unknown vector kind \"" + kind + "\"");
}

// ---------------------------------------------------------------------------
// defaultVectorsPath helpers
// ---------------------------------------------------------------------------

std::string directoryOf(const std::string& path) {
    const std::size_t cut = path.find_last_of("/\\");
    return cut == std::string::npos ? std::string() : path.substr(0, cut);
}

bool isReadableFile(const std::string& path) {
    std::ifstream probe(path.c_str(), std::ios::binary);
    return probe.is_open();
}

}  // namespace

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

SelfTestResult runSelfTest(const std::string& vectorsPath) {
    SelfTestResult result;

    std::ifstream input(vectorsPath.c_str(), std::ios::binary);
    if (!input.is_open()) {
        result.ok = false;
        result.checks = 0;
        result.failures = 1;
        result.report = "bbpm native core self test\nvectors: " + vectorsPath +
                        "\nFAIL: cannot open the reference vector file\n";
        return result;
    }

    Runner runner;
    DrawCache draws;
    std::string raw;
    int lineNumber = 0;

    while (std::getline(input, raw)) {
        ++lineNumber;
        if (!raw.empty() && raw[raw.size() - 1] == '\r') raw.erase(raw.size() - 1);
        if (raw.empty() || raw[0] == '#') continue;

        Line line;
        std::string parseError;
        if (!parseLine(raw, lineNumber, line, parseError)) {
            runner.fail("line " + std::to_string(lineNumber) + ": " + raw,
                        "malformed vector line: " + parseError);
            continue;
        }
        dispatchLine(line, runner, draws);
    }

    const bool ok = runner.failures == 0 && runner.checks > 0;

    std::string report = "bbpm native core self test\n";
    report += "vectors: " + vectorsPath + "\n";
    if (!runner.problems.empty()) {
        report += "first mismatches:\n";
        for (std::size_t i = 0; i < runner.problems.size(); ++i) report += runner.problems[i] + "\n";
        if (runner.failures > static_cast<int>(runner.problems.size())) {
            report += "(+" + std::to_string(runner.failures - static_cast<int>(runner.problems.size())) +
                      " further mismatches not shown)\n";
        }
    }
    report += "checks: " + std::to_string(runner.checks) + " failures: " + std::to_string(runner.failures) + "\n";
    report += ok ? "PASS\n" : "FAIL\n";

    result.ok = ok;
    result.checks = runner.checks;
    result.failures = runner.failures;
    result.report = report;
    return result;
}

std::string defaultVectorsPath() {
#if defined(BBPM_VECTORS_PATH)
    return BBPM_VECTORS_PATH;
#else
    const std::string relative = "tests/vectors/random-model.txt";

    // SelfTest.cpp lives in native/Source/core/, so the repository copy is two
    // directories up and then across into native/tests/vectors/.
    const std::string sourceDirectory = directoryOf(__FILE__);
    if (!sourceDirectory.empty()) {
        const std::string besideSource = sourceDirectory + "/../../" + relative;
        if (isReadableFile(besideSource)) return besideSource;
    }

    // Fallbacks: cwd == repository root, or cwd == native/.
    const std::string fromRoot = "native/" + relative;
    if (isReadableFile(fromRoot)) return fromRoot;
    if (isReadableFile(relative)) return relative;

    return sourceDirectory.empty() ? relative : (sourceDirectory + "/../../" + relative);
#endif
}

int runSelfTestCli(int argc, char** argv) {
    const std::string path = (argc > 1 && argv != nullptr && argv[1] != nullptr)
                                 ? std::string(argv[1])
                                 : defaultVectorsPath();
    const SelfTestResult result = runSelfTest(path);
    std::fputs(result.report.c_str(), stdout);
    return result.ok ? 0 : 1;
}

}  // namespace bbpm::core
