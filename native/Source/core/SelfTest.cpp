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
// SHA-256 (the whole-pattern fixture records digests, so the harness needs one)
// ---------------------------------------------------------------------------

struct Sha256 {
    std::uint32_t state[8];
    std::uint64_t bitLength;
    unsigned char buffer[64];
    std::size_t bufferLength;

    Sha256() { reset(); }

    void reset() {
        static const std::uint32_t initial[8] = {0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
                                                 0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u};
        for (int i = 0; i < 8; ++i) state[i] = initial[i];
        bitLength = 0;
        bufferLength = 0;
    }

    static std::uint32_t rotateRight(std::uint32_t value, int bits) {
        return (value >> bits) | (value << (32 - bits));
    }

    void transform(const unsigned char* block) {
        static const std::uint32_t k[64] = {
            0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u, 0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
            0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u, 0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
            0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu, 0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
            0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u, 0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
            0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u, 0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
            0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u, 0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
            0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u, 0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
            0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u, 0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u};

        std::uint32_t w[64];
        for (int i = 0; i < 16; ++i) {
            w[i] = (static_cast<std::uint32_t>(block[i * 4]) << 24) |
                   (static_cast<std::uint32_t>(block[i * 4 + 1]) << 16) |
                   (static_cast<std::uint32_t>(block[i * 4 + 2]) << 8) |
                   static_cast<std::uint32_t>(block[i * 4 + 3]);
        }
        for (int i = 16; i < 64; ++i) {
            const std::uint32_t s0 = rotateRight(w[i - 15], 7) ^ rotateRight(w[i - 15], 18) ^ (w[i - 15] >> 3);
            const std::uint32_t s1 = rotateRight(w[i - 2], 17) ^ rotateRight(w[i - 2], 19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16] + s0 + w[i - 7] + s1;
        }

        std::uint32_t a = state[0], b = state[1], c = state[2], d = state[3];
        std::uint32_t e = state[4], f = state[5], g = state[6], h = state[7];
        for (int i = 0; i < 64; ++i) {
            const std::uint32_t s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
            const std::uint32_t ch = (e & f) ^ ((~e) & g);
            const std::uint32_t temp1 = h + s1 + ch + k[i] + w[i];
            const std::uint32_t s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
            const std::uint32_t maj = (a & b) ^ (a & c) ^ (b & c);
            const std::uint32_t temp2 = s0 + maj;
            h = g;
            g = f;
            f = e;
            e = d + temp1;
            d = c;
            c = b;
            b = a;
            a = temp1 + temp2;
        }
        state[0] += a;
        state[1] += b;
        state[2] += c;
        state[3] += d;
        state[4] += e;
        state[5] += f;
        state[6] += g;
        state[7] += h;
    }

    // Padding bytes must not be counted as message bits, so the two paths differ.
    void appendByte(unsigned char byte) {
        buffer[bufferLength++] = byte;
        if (bufferLength == 64) {
            transform(buffer);
            bufferLength = 0;
        }
    }

    void update(const unsigned char* data, std::size_t length) {
        bitLength += static_cast<std::uint64_t>(length) * 8u;
        for (std::size_t i = 0; i < length; ++i) appendByte(data[i]);
    }

    std::string finish() {
        const std::uint64_t totalBits = bitLength;
        appendByte(0x80u);
        while (bufferLength != 56) appendByte(0x00u);
        for (int i = 7; i >= 0; --i) {
            appendByte(static_cast<unsigned char>((totalBits >> (i * 8)) & 0xffu));
        }
        char out[65];
        for (int i = 0; i < 8; ++i) {
            std::snprintf(out + i * 8, 9, "%08x", static_cast<unsigned>(state[i]));
        }
        out[64] = '\0';
        return std::string(out);
    }
};

std::string sha256Hex(const std::string& bytes) {
    Sha256 hash;
    hash.update(reinterpret_cast<const unsigned char*>(bytes.data()), bytes.size());
    return hash.finish();
}

// ---------------------------------------------------------------------------
// Canonical JSON (the fixture pins JSON.stringify output byte for byte)
//
// The fixture stores the exact text of JSON.stringify(pattern), so verifying it
// needs both halves of JS JSON: a parser that keeps member insertion order, and
// a serializer that reproduces ECMAScript escaping and number formatting. The
// re-serialized text of a canonical record must equal the recorded text.
// ---------------------------------------------------------------------------

struct JsonValue {
    enum class Type { Null, Bool, Number, String, Array, Object };

    Type type = Type::Null;
    bool boolean = false;
    double number = 0.0;
    std::string string;
    std::vector<JsonValue> array;
    std::vector<std::string> keys;    // object member names, insertion order
    std::vector<JsonValue> values;    // parallel to keys
};

// WTF-8: a lone surrogate is stored as its own 3-byte sequence so that a record
// containing "\ud800" survives parse -> serialize unchanged (ES2019 well-formed
// JSON.stringify escapes lone surrogates again instead of emitting them raw).
void appendCodePoint(std::string& out, std::uint32_t code) {
    if (code < 0x80u) {
        out += static_cast<char>(code);
    } else if (code < 0x800u) {
        out += static_cast<char>(0xc0u | (code >> 6));
        out += static_cast<char>(0x80u | (code & 0x3fu));
    } else if (code < 0x10000u) {
        out += static_cast<char>(0xe0u | (code >> 12));
        out += static_cast<char>(0x80u | ((code >> 6) & 0x3fu));
        out += static_cast<char>(0x80u | (code & 0x3fu));
    } else {
        out += static_cast<char>(0xf0u | (code >> 18));
        out += static_cast<char>(0x80u | ((code >> 12) & 0x3fu));
        out += static_cast<char>(0x80u | ((code >> 6) & 0x3fu));
        out += static_cast<char>(0x80u | (code & 0x3fu));
    }
}

bool nextCodePoint(const std::string& text, std::size_t index, std::uint32_t& code, std::size_t& length) {
    const unsigned char first = static_cast<unsigned char>(text[index]);
    std::size_t count = 0;
    std::uint32_t value = 0;
    if (first < 0x80u) {
        code = first;
        length = 1;
        return true;
    }
    if ((first & 0xe0u) == 0xc0u) {
        count = 2;
        value = first & 0x1fu;
    } else if ((first & 0xf0u) == 0xe0u) {
        count = 3;
        value = first & 0x0fu;
    } else if ((first & 0xf8u) == 0xf0u) {
        count = 4;
        value = first & 0x07u;
    } else {
        code = first;
        length = 1;
        return false;
    }
    if (index + count > text.size()) {
        code = first;
        length = 1;
        return false;
    }
    for (std::size_t i = 1; i < count; ++i) {
        const unsigned char next = static_cast<unsigned char>(text[index + i]);
        if ((next & 0xc0u) != 0x80u) {
            code = first;
            length = 1;
            return false;
        }
        value = (value << 6) | (next & 0x3fu);
    }
    code = value;
    length = count;
    return true;
}

class JsonParser {
public:
    explicit JsonParser(const std::string& text) : text_(text) {}

    bool parse(JsonValue& out, std::string& error) {
        position_ = 0;
        skipWhitespace();
        if (!parseValue(out, error, 0)) return false;
        skipWhitespace();
        if (position_ != text_.size()) return fail(error, "trailing characters after the JSON value");
        return true;
    }

private:
    const std::string& text_;
    std::size_t position_ = 0;

    bool fail(std::string& error, const std::string& message) {
        error = message + " at offset " + std::to_string(position_);
        return false;
    }

    bool atEnd() const { return position_ >= text_.size(); }
    char peek() const { return atEnd() ? '\0' : text_[position_]; }

    void skipWhitespace() {
        while (!atEnd()) {
            const char c = text_[position_];
            if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
                ++position_;
            } else {
                break;
            }
        }
    }

    bool parseValue(JsonValue& out, std::string& error, int depth) {
        if (depth > 200) return fail(error, "JSON nesting is too deep");
        if (atEnd()) return fail(error, "unexpected end of the JSON text");
        const char c = text_[position_];
        if (c == '{') return parseObject(out, error, depth);
        if (c == '[') return parseArray(out, error, depth);
        if (c == '"') {
            out.type = JsonValue::Type::String;
            return parseString(out.string, error);
        }
        if (c == 't') return parseLiteral("true", out, true, error);
        if (c == 'f') return parseLiteral("false", out, false, error);
        if (c == 'n') {
            if (text_.compare(position_, 4, "null") != 0) return fail(error, "invalid JSON literal");
            position_ += 4;
            out.type = JsonValue::Type::Null;
            return true;
        }
        return parseNumber(out, error);
    }

    bool parseLiteral(const char* literal, JsonValue& out, bool value, std::string& error) {
        const std::size_t length = std::strlen(literal);
        if (text_.compare(position_, length, literal) != 0) return fail(error, "invalid JSON literal");
        position_ += length;
        out.type = JsonValue::Type::Bool;
        out.boolean = value;
        return true;
    }

    bool parseHex4(std::uint32_t& out, std::string& error) {
        if (position_ + 4 > text_.size()) return fail(error, "truncated \\u escape");
        std::uint32_t value = 0;
        for (int i = 0; i < 4; ++i) {
            const int digit = hexDigit(text_[position_ + static_cast<std::size_t>(i)]);
            if (digit < 0) return fail(error, "invalid \\u escape");
            value = (value << 4) | static_cast<std::uint32_t>(digit);
        }
        position_ += 4;
        out = value;
        return true;
    }

    bool parseString(std::string& out, std::string& error) {
        out.clear();
        if (peek() != '"') return fail(error, "expected a JSON string");
        ++position_;
        while (true) {
            if (atEnd()) return fail(error, "unterminated JSON string");
            const unsigned char c = static_cast<unsigned char>(text_[position_]);
            if (c == '"') {
                ++position_;
                return true;
            }
            if (c == '\\') {
                ++position_;
                if (atEnd()) return fail(error, "unterminated JSON escape");
                const char escape = text_[position_++];
                switch (escape) {
                    case '"': out += '"'; break;
                    case '\\': out += '\\'; break;
                    case '/': out += '/'; break;
                    case 'b': out += '\b'; break;
                    case 'f': out += '\f'; break;
                    case 'n': out += '\n'; break;
                    case 'r': out += '\r'; break;
                    case 't': out += '\t'; break;
                    case 'u': {
                        std::uint32_t unit = 0;
                        if (!parseHex4(unit, error)) return false;
                        if (unit >= 0xd800u && unit <= 0xdbffu) {
                            // A high surrogate is only a pair if a low one follows.
                            if (position_ + 1 < text_.size() && text_[position_] == '\\' &&
                                text_[position_ + 1] == 'u') {
                                const std::size_t save = position_;
                                position_ += 2;
                                std::uint32_t low = 0;
                                if (!parseHex4(low, error)) return false;
                                if (low >= 0xdc00u && low <= 0xdfffu) {
                                    appendCodePoint(out, 0x10000u + ((unit - 0xd800u) << 10) + (low - 0xdc00u));
                                    break;
                                }
                                position_ = save;
                            }
                            appendCodePoint(out, unit);  // lone high surrogate
                            break;
                        }
                        appendCodePoint(out, unit);
                        break;
                    }
                    default:
                        return fail(error, "invalid JSON escape");
                }
                continue;
            }
            if (c < 0x20u) return fail(error, "unescaped control character in a JSON string");
            out += static_cast<char>(c);
            ++position_;
        }
    }

    bool parseNumber(JsonValue& out, std::string& error) {
        const std::size_t start = position_;
        if (peek() == '-') ++position_;
        if (atEnd()) return fail(error, "invalid JSON number");
        if (peek() == '0') {
            ++position_;
            if (!atEnd() && text_[position_] >= '0' && text_[position_] <= '9') {
                return fail(error, "invalid JSON number (leading zero)");
            }
        } else if (peek() >= '1' && peek() <= '9') {
            while (!atEnd() && text_[position_] >= '0' && text_[position_] <= '9') ++position_;
        } else {
            return fail(error, "invalid JSON value");
        }
        if (!atEnd() && text_[position_] == '.') {
            ++position_;
            if (atEnd() || text_[position_] < '0' || text_[position_] > '9') {
                return fail(error, "invalid JSON number (empty fraction)");
            }
            while (!atEnd() && text_[position_] >= '0' && text_[position_] <= '9') ++position_;
        }
        if (!atEnd() && (text_[position_] == 'e' || text_[position_] == 'E')) {
            ++position_;
            if (!atEnd() && (text_[position_] == '+' || text_[position_] == '-')) ++position_;
            if (atEnd() || text_[position_] < '0' || text_[position_] > '9') {
                return fail(error, "invalid JSON number (empty exponent)");
            }
            while (!atEnd() && text_[position_] >= '0' && text_[position_] <= '9') ++position_;
        }
        const std::string token = text_.substr(start, position_ - start);
        out.type = JsonValue::Type::Number;
        out.number = std::strtod(token.c_str(), nullptr);
        return true;
    }

    bool parseArray(JsonValue& out, std::string& error, int depth) {
        out.type = JsonValue::Type::Array;
        ++position_;
        skipWhitespace();
        if (peek() == ']') {
            ++position_;
            return true;
        }
        while (true) {
            JsonValue item;
            if (!parseValue(item, error, depth + 1)) return false;
            out.array.push_back(item);
            skipWhitespace();
            if (peek() == ',') {
                ++position_;
                skipWhitespace();
                continue;
            }
            if (peek() == ']') {
                ++position_;
                return true;
            }
            return fail(error, "expected ',' or ']' in a JSON array");
        }
    }

    bool parseObject(JsonValue& out, std::string& error, int depth) {
        out.type = JsonValue::Type::Object;
        ++position_;
        skipWhitespace();
        if (peek() == '}') {
            ++position_;
            return true;
        }
        while (true) {
            std::string key;
            if (peek() != '"') return fail(error, "expected a quoted member name");
            if (!parseString(key, error)) return false;
            skipWhitespace();
            if (peek() != ':') return fail(error, "expected ':' after a member name");
            ++position_;
            skipWhitespace();
            JsonValue item;
            if (!parseValue(item, error, depth + 1)) return false;
            // JSON.parse keeps the first insertion position and the last value.
            std::size_t existing = out.keys.size();
            for (std::size_t i = 0; i < out.keys.size(); ++i) {
                if (out.keys[i] == key) {
                    existing = i;
                    break;
                }
            }
            if (existing == out.keys.size()) {
                out.keys.push_back(key);
                out.values.push_back(item);
            } else {
                out.values[existing] = item;
            }
            skipWhitespace();
            if (peek() == ',') {
                ++position_;
                skipWhitespace();
                continue;
            }
            if (peek() == '}') {
                ++position_;
                return true;
            }
            return fail(error, "expected ',' or '}' in a JSON object");
        }
    }
};

const JsonValue* objectFind(const JsonValue& object, const std::string& key) {
    if (object.type != JsonValue::Type::Object) return nullptr;
    for (std::size_t i = 0; i < object.keys.size(); ++i) {
        if (object.keys[i] == key) return &object.values[i];
    }
    return nullptr;
}

void serializeString(const std::string& value, std::string& out) {
    out += '"';
    std::size_t index = 0;
    while (index < value.size()) {
        std::uint32_t code = 0;
        std::size_t length = 1;
        if (!nextCodePoint(value, index, code, length)) {
            char buffer[8];
            std::snprintf(buffer, sizeof(buffer), "\\u%04x",
                          static_cast<unsigned>(static_cast<unsigned char>(value[index])));
            out += buffer;
            ++index;
            continue;
        }
        if (code == '"') {
            out += "\\\"";
        } else if (code == '\\') {
            out += "\\\\";
        } else if (code == 0x08u) {
            out += "\\b";
        } else if (code == 0x09u) {
            out += "\\t";
        } else if (code == 0x0au) {
            out += "\\n";
        } else if (code == 0x0cu) {
            out += "\\f";
        } else if (code == 0x0du) {
            out += "\\r";
        } else if (code < 0x20u || (code >= 0xd800u && code <= 0xdfffu)) {
            char buffer[8];
            std::snprintf(buffer, sizeof(buffer), "\\u%04x", static_cast<unsigned>(code));
            out += buffer;
        } else {
            out.append(value, index, length);
        }
        index += length;
    }
    out += '"';
}

void serializeJson(const JsonValue& value, std::string& out) {
    switch (value.type) {
        case JsonValue::Type::Null:
            out += "null";
            return;
        case JsonValue::Type::Bool:
            out += value.boolean ? "true" : "false";
            return;
        case JsonValue::Type::Number:
            // JSON.stringify() falls back to null for a non-finite number.
            out += std::isfinite(value.number) ? jsNumberToString(value.number) : std::string("null");
            return;
        case JsonValue::Type::String:
            serializeString(value.string, out);
            return;
        case JsonValue::Type::Array:
            out += '[';
            for (std::size_t i = 0; i < value.array.size(); ++i) {
                if (i != 0) out += ',';
                serializeJson(value.array[i], out);
            }
            out += ']';
            return;
        case JsonValue::Type::Object:
            out += '{';
            for (std::size_t i = 0; i < value.keys.size(); ++i) {
                if (i != 0) out += ',';
                serializeString(value.keys[i], out);
                out += ':';
                serializeJson(value.values[i], out);
            }
            out += '}';
            return;
    }
}

std::string canonicalJson(const JsonValue& value) {
    std::string out;
    serializeJson(value, out);
    return out;
}

// The recorded text of a scalar setting: a string is recorded without quotes,
// a number as ECMAScript String(x), a boolean as true/false.
std::string canonicalScalar(const JsonValue& value) {
    switch (value.type) {
        case JsonValue::Type::String:
            return value.string;
        case JsonValue::Type::Number:
            return jsNumberToString(value.number);
        case JsonValue::Type::Bool:
            return value.boolean ? "true" : "false";
        case JsonValue::Type::Null:
            return "null";
        case JsonValue::Type::Array:
        case JsonValue::Type::Object:
            return canonicalJson(value);
    }
    return std::string();
}

bool containsKeyDeep(const JsonValue& value, const std::string& key) {
    if (value.type == JsonValue::Type::Object) {
        for (std::size_t i = 0; i < value.keys.size(); ++i) {
            if (value.keys[i] == key) return true;
            if (containsKeyDeep(value.values[i], key)) return true;
        }
    } else if (value.type == JsonValue::Type::Array) {
        for (std::size_t i = 0; i < value.array.size(); ++i) {
            if (containsKeyDeep(value.array[i], key)) return true;
        }
    }
    return false;
}

template <std::size_t N>
bool isListed(const char* const (&list)[N], const std::string& value) {
    for (std::size_t i = 0; i < N; ++i) {
        if (value == list[i]) return true;
    }
    return false;
}

// ---------------------------------------------------------------------------
// Wave-3 whole-pattern fixture (contract / case / settings / setting / pattern /
// tolerance / policy records, see native/tests/vectors/README.md)
//
// Faithfulness notes
// - The prose-only records (contract, tolerance, policy) pin statements, not
//   values, so they are validated as a SET: every key must be one of the
//   reviewed keys, appear exactly once, and carry non-empty text. The set sizes
//   are checked at the end of the file. "contract;key=numberFormat" additionally
//   re-derives the four formatting facts it states.
// - The value records are cross-checked against each other and against the text:
//   a pattern record must be canonical JSON.stringify output, its sha256 must
//   equal both its own field and the case record's digest, its byte count must
//   equal the decoded length, and eventCount/ppq/engineVersion/settings must
//   agree with the case, settings and setting records of the same group.
// - This proves the fixture is internally consistent and canonical. It does NOT
//   prove the port generates the same patterns: the generator is not ported yet
//   (wave 4), so nothing here compares a generated pattern with these records.
// ---------------------------------------------------------------------------

const char* const kContractKeys[8] = {"hashScope",       "memberOrder", "numberFormat",
                                      "reasonField",     "layerOf",     "engineVersionLiteral",
                                      "comparison",      "toleranceScope"};
const char* const kToleranceQuantities[11] = {"maxNormalizedSampleError", "pcm16Golden", "onsetPosition",
                                              "peak",                      "rms",         "per100msWindow",
                                              "dcOffset",                  "stereoCorrelation",
                                              "spectral",                  "truePeak",    "clippedSampleCount"};
const char* const kPolicyKeys[2] = {"gainErrors", "nonSilence"};
const char* const kEngineVersionLiterals[6] = {"0.1.0",         "0.2.0-groove.1", "0.3.0-groove.3",
                                               "0.4.0-groove.1", "0.5.0-groove.1", "0.5.1-groove.1"};

struct PatternGroup {
    bool open = false;
    bool settingsSeen = false;
    bool patternSeen = false;
    std::string id;
    std::string digest;
    std::string engineVersion;
    std::string source;
    long long ppq = 0;
    long long eventCount = 0;
    long long knobs = 0;
    long long settingLines = 0;
    // One `setting` record per TOP-LEVEL settings key; element/member records
    // describe those values in more detail and are extra (see handleSettingRecord).
    long long topLevelSettingLines = 0;
    JsonValue settings;
    std::string settingsText;
};

struct PatternFixture {
    PatternGroup group;
    int groupsCompleted = 0;
    bool sawFixtureRecords = false;
    bool shaChecked = false;
    std::vector<std::string> contractSeen;
    std::vector<std::string> toleranceSeen;
    std::vector<std::string> policySeen;

    // The digest is only exercised on the first record that carries one, so the
    // wave-1 and wave-2 vector files keep their exact check counts.
    void ensureShaChecked(Runner& runner, const std::string& where) {
        if (shaChecked) return;
        shaChecked = true;
        runner.checkString(sha256Hex(""), "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                           where + " (sha256 self check, empty input)");
        runner.checkString(sha256Hex("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
                           where + " (sha256 self check, abc)");
    }

    bool alreadySeen(const std::vector<std::string>& seen, const std::string& key) const {
        for (std::size_t i = 0; i < seen.size(); ++i) {
            if (seen[i] == key) return true;
        }
        return false;
    }

    void finish(Runner& runner, const std::string& where) {
        if (!sawFixtureRecords) return;
        if (group.open && !group.patternSeen) {
            runner.fail(where, "case \"" + group.id + "\" has no pattern record");
        }
        runner.checkUint(static_cast<unsigned long long>(contractSeen.size()), 8u, where + " (contract key set)");
        runner.checkUint(static_cast<unsigned long long>(toleranceSeen.size()), 11u, where + " (tolerance quantity set)");
        runner.checkUint(static_cast<unsigned long long>(policySeen.size()), 2u, where + " (policy key set)");
    }
};

void handleStatementRecord(const std::string& kind, const Line& line, Runner& runner, const std::string& where,
                           PatternFixture& fixture) {
    fixture.sawFixtureRecords = true;

    const bool isContract = (kind == "contract");
    const std::string field = isContract || kind == "policy" ? "key" : "quantity";
    std::string key;
    if (!partValue(line, field, key)) {
        runner.fail(where, "missing " + field + "=");
        return;
    }
    std::vector<std::string>* seen = isContract ? &fixture.contractSeen : (kind == "policy" ? &fixture.policySeen : &fixture.toleranceSeen);
    const bool known = isContract ? isListed(kContractKeys, key)
                                  : (kind == "policy" ? isListed(kPolicyKeys, key) : isListed(kToleranceQuantities, key));
    if (!known) {
        runner.fail(where, "unknown " + kind + " " + field + " \"" + key + "\"");
        return;
    }
    if (fixture.alreadySeen(*seen, key)) {
        runner.fail(where, "duplicate " + kind + " " + field + " \"" + key + "\"");
        return;
    }
    if (line.value.empty()) {
        runner.fail(where, "empty " + kind + " statement text");
        return;
    }
    seen->push_back(key);

    if (isContract && key == "numberFormat") {
        // Re-derive the four facts the statement asserts.
        runner.checkString(jsNumberToString(1.0), "1", where + " (contract: 1 not 1.0)");
        runner.checkString(jsNumberToString(0.5), "0.5", where + " (contract: 0.5 not 0.50)");
        runner.checkString(jsNumberToString(1e21), "1e+21", where + " (contract: 1e21 prints as 1e+21)");
        runner.checkString(jsNumberToString(-0.0), "0", where + " (contract: -0 prints as 0)");
    }
}

void handleCaseRecord(const Line& line, Runner& runner, const std::string& where, PatternFixture& fixture) {
    fixture.sawFixtureRecords = true;
    if (fixture.group.open && !fixture.group.patternSeen) {
        runner.fail(where, "previous case \"" + fixture.group.id + "\" has no pattern record");
    }

    PatternGroup group;
    group.open = true;
    if (!partValue(line, "id", group.id)) {
        runner.fail(where, "missing id=");
        return;
    }
    std::string frozen;
    std::string axes;
    std::string genre;
    std::string algorithm;
    std::string seed;
    if (!partValue(line, "source", group.source) || !partValue(line, "frozen", frozen) ||
        !partValue(line, "axes", axes) || !partValue(line, "genre", genre) ||
        !partValue(line, "algorithm", algorithm) || !partValue(line, "seed", seed) ||
        !partValue(line, "engineVersion", group.engineVersion)) {
        runner.fail(where, "case record is missing a field");
        return;
    }
    if (!partLong(line, runner, "ppq", group.ppq)) return;
    if (!partLong(line, runner, "eventCount", group.eventCount)) return;

    // Publish the group immediately: this record CLOSES the previous group even
    // when a later check rejects this one, so a follow-up case= mismatch is
    // reported against the id just declared instead of a stale one.
    fixture.group = group;

    if (group.source != "matrix" && group.source != "synthetic") {
        runner.fail(where, "unknown case source \"" + group.source + "\"");
        return;
    }
    if (axes.empty() || genre.empty() || algorithm.empty() || seed.empty()) {
        runner.fail(where, "empty case field (axes/genre/algorithm/seed)");
        return;
    }
    if (line.value.size() != 64) {
        runner.fail(where, "case digest is not 64 hex characters");
        return;
    }
    // Zero is legal: `roles-empty` renders no events at all.
    if (group.eventCount < 0) {
        runner.fail(where, "eventCount= is negative");
        return;
    }

    group.digest = line.value;
    // A frozen matrix case is the only kind of record allowed to claim frozen=yes.
    runner.checkString(group.source == "matrix" ? "yes" : "no", frozen, where + " (frozen iff the case came from the matrix)");
    runner.checkLong(group.ppq, 960, where + " (ppq is the frozen 960)");
    runner.checkString(isListed(kEngineVersionLiterals, group.engineVersion) ? "known" : ("unknown:" + group.engineVersion),
                       "known", where + " (engine version literal)");
    fixture.group.digest = group.digest;
}

void checkRecordedScalar(const JsonValue* value, const std::string& type, const std::string& expected, Runner& runner,
                         const std::string& where) {
    if (value == nullptr) {
        runner.fail(where, "the settings value has no such member or element");
        return;
    }
    if (type == "string") {
        if (value->type != JsonValue::Type::String) {
            runner.fail(where, "recorded type string does not match the JSON value");
            return;
        }
        runner.checkString(value->string, expected, where);
        return;
    }
    if (type == "number") {
        if (value->type != JsonValue::Type::Number) {
            runner.fail(where, "recorded type number does not match the JSON value");
            return;
        }
        runner.checkString(jsNumberToString(value->number), expected, where);
        return;
    }
    if (type == "boolean") {
        if (value->type != JsonValue::Type::Bool) {
            runner.fail(where, "recorded type boolean does not match the JSON value");
            return;
        }
        runner.checkString(value->boolean ? "true" : "false", expected, where);
        return;
    }
    if (type == "null") {
        if (value->type != JsonValue::Type::Null) {
            runner.fail(where, "recorded type null does not match the JSON value");
            return;
        }
        runner.checkString("null", expected, where);
        return;
    }
    if (type == "any") {
        runner.checkString(canonicalScalar(*value), expected, where);
        return;
    }
    runner.fail(where, "unknown recorded scalar type \"" + type + "\"");
}

void handleSettingsRecord(const Line& line, Runner& runner, const std::string& where, PatternFixture& fixture) {
    fixture.sawFixtureRecords = true;
    fixture.ensureShaChecked(runner, where);
    if (!fixture.group.open || fixture.group.patternSeen) {
        runner.fail(where, "settings record outside a case group");
        return;
    }
    if (fixture.group.settingsSeen) {
        runner.fail(where, "duplicate settings record for case \"" + fixture.group.id + "\"");
        return;
    }
    std::string caseId;
    std::string sha;
    if (!partValue(line, "case", caseId) || !partValue(line, "sha256", sha)) {
        runner.fail(where, "settings record is missing case= or sha256=");
        return;
    }
    if (caseId != fixture.group.id) {
        runner.fail(where, "case= \"" + caseId + "\" does not match the open case \"" + fixture.group.id + "\"");
        return;
    }
    long long knobs = 0;
    if (!partLong(line, runner, "knobs", knobs)) return;

    JsonValue parsed;
    std::string error;
    if (!JsonParser(line.value).parse(parsed, error)) {
        runner.fail(where, "settings value is not JSON: " + error);
        return;
    }
    runner.checkString(sha256Hex(line.value), sha, where + " (settings digest)");
    runner.checkString(canonicalJson(parsed) == line.value ? "canonical" : "rebuilt-text-differs", "canonical",
                       where + " (settings text is JSON.stringify output)");
    if (parsed.type != JsonValue::Type::Object) {
        runner.fail(where, "settings value is not a JSON object");
        return;
    }
    fixture.group.settings = parsed;
    fixture.group.settingsText = line.value;
    fixture.group.knobs = knobs;
    fixture.group.settingsSeen = true;
}

void handleSettingRecord(const Line& line, Runner& runner, const std::string& where, PatternFixture& fixture) {
    fixture.sawFixtureRecords = true;
    if (!fixture.group.settingsSeen) {
        runner.fail(where, "setting record before the settings record of its case");
        return;
    }
    std::string caseId;
    std::string key;
    std::string type;
    if (!partValue(line, "case", caseId) || !partValue(line, "key", key) || !partValue(line, "type", type)) {
        runner.fail(where, "setting record is missing case=, key= or type=");
        return;
    }
    if (caseId != fixture.group.id) {
        runner.fail(where, "case= \"" + caseId + "\" does not match the open case \"" + fixture.group.id + "\"");
        return;
    }
    ++fixture.group.settingLines;
    if (type != "member" && type != "element") ++fixture.group.topLevelSettingLines;

    const JsonValue* member = objectFind(fixture.group.settings, key);
    if (type == "member") {
        std::string inner;
        std::string innerType;
        if (!partValue(line, "member", inner) || !partValue(line, "mtype", innerType)) {
            runner.fail(where, "member setting is missing member= or mtype=");
            return;
        }
        if (member == nullptr || member->type != JsonValue::Type::Object) {
            runner.fail(where, "settings[\"" + key + "\"] is not a JSON object");
            return;
        }
        checkRecordedScalar(objectFind(*member, inner), innerType, line.value, runner,
                            where + " (settings[\"" + key + "\"].\"" + inner + "\")");
        return;
    }
    if (type == "element") {
        long long index = 0;
        std::string elementType;
        if (!partLong(line, runner, "index", index)) return;
        if (!partValue(line, "etype", elementType)) {
            runner.fail(where, "element setting is missing etype=");
            return;
        }
        if (member == nullptr || member->type != JsonValue::Type::Array) {
            runner.fail(where, "settings[\"" + key + "\"] is not a JSON array");
            return;
        }
        if (index < 0 || static_cast<std::size_t>(index) >= member->array.size()) {
            runner.fail(where, "element index " + std::to_string(index) + " is outside the array");
            return;
        }
        checkRecordedScalar(&member->array[static_cast<std::size_t>(index)], elementType, line.value, runner,
                            where + " (settings[\"" + key + "\"][" + std::to_string(index) + "])");
        return;
    }
    if (member == nullptr) {
        runner.fail(where, "settings has no key \"" + key + "\"");
        return;
    }
    if (type == "string" || type == "number" || type == "boolean") {
        checkRecordedScalar(member, type, line.value, runner, where + " (settings[\"" + key + "\"])");
        return;
    }
    if (type == "array" || type == "object") {
        const bool isArray = member->type == JsonValue::Type::Array;
        const bool isObject = member->type == JsonValue::Type::Object;
        if ((type == "array" && !isArray) || (type == "object" && !isObject)) {
            runner.fail(where, "settings[\"" + key + "\"] is not a JSON " + type);
            return;
        }
        const std::size_t count = isArray ? member->array.size() : member->keys.size();
        runner.checkString(jsNumberToString(static_cast<double>(count)), line.value,
                           where + " (size of settings[\"" + key + "\"])");
        return;
    }
    runner.fail(where, "unknown setting type \"" + type + "\"");
}

void handlePatternRecord(const Line& line, Runner& runner, const std::string& where, PatternFixture& fixture) {
    fixture.sawFixtureRecords = true;
    fixture.ensureShaChecked(runner, where);
    if (!fixture.group.open || fixture.group.patternSeen) {
        runner.fail(where, "pattern record outside a case group");
        return;
    }
    std::string caseId;
    std::string sha;
    if (!partValue(line, "case", caseId) || !partValue(line, "sha256", sha)) {
        runner.fail(where, "pattern record is missing case= or sha256=");
        return;
    }
    if (caseId != fixture.group.id) {
        runner.fail(where, "case= \"" + caseId + "\" does not match the open case \"" + fixture.group.id + "\"");
        return;
    }
    long long bytes = 0;
    if (!partLong(line, runner, "bytes", bytes)) return;
    if (!fixture.group.settingsSeen) {
        runner.fail(where, "pattern record has no settings record");
        return;
    }

    JsonValue parsed;
    std::string error;
    if (!JsonParser(line.value).parse(parsed, error)) {
        runner.fail(where, "pattern value is not JSON: " + error);
        return;
    }

    runner.checkLong(static_cast<long long>(line.value.size()), bytes, where + " (pattern byte length)");
    runner.checkString(sha256Hex(line.value), sha, where + " (pattern digest)");
    runner.checkString(sha, fixture.group.digest, where + " (digest agrees with the case record)");
    runner.checkString(canonicalJson(parsed) == line.value ? "canonical" : "rebuilt-text-differs", "canonical",
                       where + " (pattern text is JSON.stringify output)");
    if (parsed.type != JsonValue::Type::Object) {
        runner.fail(where, "pattern value is not a JSON object");
        return;
    }

    // Member order is contractual (the frozen hash is over the text), and the
    // legacy engine builds the pattern object in a different order than v2+.
    std::string order;
    for (std::size_t i = 0; i < parsed.keys.size(); ++i) {
        if (i != 0) order += ",";
        order += parsed.keys[i];
    }
    const std::string expectedOrder = fixture.group.engineVersion == "0.1.0"
                                          ? "engineVersion,settings,ppq,events"
                                          : "engineVersion,ppq,settings,events";
    runner.checkString(order, expectedOrder, where + " (top-level JSON member order)");

    const JsonValue* events = objectFind(parsed, "events");
    if (events == nullptr || events->type != JsonValue::Type::Array) {
        runner.fail(where, "pattern has no events array");
        return;
    }
    runner.checkLong(static_cast<long long>(events->array.size()), fixture.group.eventCount,
                     where + " (eventCount agrees with the case record)");

    const JsonValue* ppq = objectFind(parsed, "ppq");
    const JsonValue* engineVersion = objectFind(parsed, "engineVersion");
    const JsonValue* settings = objectFind(parsed, "settings");
    if (ppq == nullptr || ppq->type != JsonValue::Type::Number || engineVersion == nullptr ||
        engineVersion->type != JsonValue::Type::String || settings == nullptr) {
        runner.fail(where, "pattern is missing ppq, engineVersion or settings");
        return;
    }
    runner.checkString(jsNumberToString(ppq->number), jsNumberToString(static_cast<double>(fixture.group.ppq)),
                       where + " (ppq agrees with the case record)");
    runner.checkString(engineVersion->string, fixture.group.engineVersion,
                       where + " (engineVersion agrees with the case record)");
    runner.checkString(canonicalJson(*settings), fixture.group.settingsText,
                       where + " (settings agree with the settings record)");
    runner.checkLong(fixture.group.topLevelSettingLines, fixture.group.knobs,
                     where + " (top-level setting records equal the recorded knob count)");

    // layerOf is render-only (src/core/model.ts:116) and must never be serialized.
    runner.checkString(containsKeyDeep(parsed, "layerOf") ? "present" : "absent", "absent",
                       where + " (layerOf is never serialized)");

    int missingReason = 0;
    for (std::size_t i = 0; i < events->array.size(); ++i) {
        const JsonValue& event = events->array[i];
        const JsonValue* reason = event.type == JsonValue::Type::Object ? objectFind(event, "reason") : nullptr;
        if (reason == nullptr || reason->type != JsonValue::Type::String || reason->string.empty()) ++missingReason;
    }
    runner.checkLong(missingReason, 0, where + " (every event carries a non-empty reason)");

    fixture.group.patternSeen = true;
    ++fixture.groupsCompleted;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

void dispatchLine(const Line& line, Runner& runner, DrawCache& draws, PatternFixture& fixture) {
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

    // Wave-3 whole-pattern fixture records.
    if (kind == "contract" || kind == "tolerance" || kind == "policy") {
        handleStatementRecord(kind, line, runner, where, fixture);
        return;
    }
    if (kind == "case") {
        handleCaseRecord(line, runner, where, fixture);
        return;
    }
    if (kind == "settings") {
        handleSettingsRecord(line, runner, where, fixture);
        return;
    }
    if (kind == "setting") {
        handleSettingRecord(line, runner, where, fixture);
        return;
    }
    if (kind == "pattern") {
        handlePatternRecord(line, runner, where, fixture);
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
    PatternFixture fixture;
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
        dispatchLine(line, runner, draws, fixture);
    }

    fixture.finish(runner, "wave-3 fixture");

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
