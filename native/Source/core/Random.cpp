#include "Random.h"

namespace bbpm::core
{
namespace
{

bool isContinuationByte(const std::string& text, std::size_t index)
{
    return index < text.size() && ((static_cast<unsigned char>(text[index]) & 0xC0u) == 0x80u);
}

// Decodes one code point from UTF-8 at `index`, mirroring what `for (const c
// of s)` yields for a well-formed JavaScript string. Malformed bytes are
// returned as their own code point and consumed one at a time (defensive only:
// a JS string cannot produce them).
uint32_t codePointAt(const std::string& text, std::size_t& index)
{
    const uint32_t b0 = static_cast<unsigned char>(text[index]);

    if (b0 < 0x80u)
    {
        ++index;
        return b0;
    }

    if (b0 >= 0xC2u && b0 <= 0xDFu && isContinuationByte(text, index + 1))
    {
        const uint32_t codePoint = ((b0 & 0x1Fu) << 6)
                                 | (static_cast<unsigned char>(text[index + 1]) & 0x3Fu);
        index += 2;
        return codePoint;
    }

    if (b0 >= 0xE0u && b0 <= 0xEFu && isContinuationByte(text, index + 1) && isContinuationByte(text, index + 2))
    {
        const uint32_t codePoint = ((b0 & 0x0Fu) << 12)
                                 | ((static_cast<unsigned char>(text[index + 1]) & 0x3Fu) << 6)
                                 | (static_cast<unsigned char>(text[index + 2]) & 0x3Fu);

        if (codePoint >= 0x800u && (codePoint < 0xD800u || codePoint > 0xDFFFu))
        {
            index += 3;
            return codePoint;
        }
    }

    if (b0 >= 0xF0u && b0 <= 0xF4u && isContinuationByte(text, index + 1)
        && isContinuationByte(text, index + 2) && isContinuationByte(text, index + 3))
    {
        const uint32_t codePoint = ((b0 & 0x07u) << 18)
                                 | ((static_cast<unsigned char>(text[index + 1]) & 0x3Fu) << 12)
                                 | ((static_cast<unsigned char>(text[index + 2]) & 0x3Fu) << 6)
                                 | (static_cast<unsigned char>(text[index + 3]) & 0x3Fu);

        if (codePoint >= 0x10000u && codePoint <= 0x10FFFFu)
        {
            index += 4;
            return codePoint;
        }
    }

    ++index;
    return b0;
}

// `c.charCodeAt(0)` for the one-code-point string `for (const c of s)` produces:
// the code point for BMP characters, the high surrogate for astral ones.
uint32_t charCodeAt0(uint32_t codePoint)
{
    return codePoint <= 0xFFFFu ? codePoint : 0xD800u + ((codePoint - 0x10000u) >> 10);
}

// One iteration of the FNV-1a loop:
//   state = Math.imul(state ^ c.charCodeAt(0), 16777619) >>> 0
void hashCharacter(uint32_t& state, uint32_t codePoint)
{
    state = (state ^ charCodeAt0(codePoint)) * kFnvPrime;
}

}  // namespace

uint32_t randomSeedHash(const std::string& seed, const std::string& stream)
{
    uint32_t state = kFnvOffsetBasis;

    for (std::size_t index = 0; index < seed.size();)
        hashCharacter(state, codePointAt(seed, index));

    // The "\0" separator inside `${seed}\0${stream}`; its own code point, so a
    // seed that ends mid-sequence still hashes the same way in both languages.
    hashCharacter(state, 0u);

    for (std::size_t index = 0; index < stream.size();)
        hashCharacter(state, codePointAt(stream, index));

    return state;
}

Random::Random(const std::string& seed, const std::string& stream)
    : state_(randomSeedHash(seed, stream))
{
}

uint32_t Random::nextUint32()
{
    // state = (state + 0x6D2B79F5) >>> 0;
    state_ = state_ + kMulberryStep;

    // let t = Math.imul(state ^ (state >>> 15), state | 1);
    uint32_t t = (state_ ^ (state_ >> 15)) * (state_ | 1u);

    // t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    t ^= t + ((t ^ (t >> 7)) * (t | 61u));

    // return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return t ^ (t >> 14);
}

double Random::nextDouble()
{
    return static_cast<double>(nextUint32()) / 4294967296.0;
}

Random random(const std::string& seed, const std::string& stream)
{
    return Random(seed, stream);
}

}  // namespace bbpm::core
