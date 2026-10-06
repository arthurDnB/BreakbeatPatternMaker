#pragma once

// Port of src/core/random.ts ("Versioned FNV-1a + Mulberry32").
//
// Determinism contract (src/core/random.ts:1): "Never use Math.random in
// generation." This file reproduces the TypeScript stream exactly - the same
// FNV-1a seed hash, the same 32-bit Mulberry32 state walk and the same float
// conversion - so a pattern generated natively is bit-identical to one
// generated in the browser.
//
// No JUCE, no third-party headers, standard library only: the whole point of
// src/core/ is that it stays platform-free.
//
// JavaScript semantics reproduced here (this is the whole determinism
// contract, so it is spelled out rather than assumed):
//   * Math.imul(a, b)   -> the low 32 bits of the product; uint32_t
//                          multiplication has exactly those bits, so
//                          `(uint32_t)a * (uint32_t)b` is the faithful port
//                          (int32 vs uint32 does not matter, the low 32 bits do);
//   * `>>> n` / `>>> 0` -> logical shift on uint32_t;
//   * `state + 0x6D2B79F5` wraps modulo 2^32 -> uint32_t addition;
//   * `t ^= t + Math.imul(...)`: JS adds two int32 values exactly and the
//     `^=` truncates to 32 bits afterwards; wrapping uint32_t arithmetic
//     produces the same 32 bits;
//   * the seed hash in random.ts iterates CODE POINTS (`for (const c of ...)`),
//     not UTF-16 code units, and hashes `c.charCodeAt(0)` - so an astral code
//     point contributes its HIGH SURROGATE (0xD800 + ((cp - 0x10000) >> 10)),
//     not the code point itself.

#include <cstdint>
#include <string>

namespace bbpm::core {

// The three literals in src/core/random.ts, exported so the vector file and
// SelfTest.h can pin them instead of trusting a copy.
inline constexpr uint32_t kFnvOffsetBasis = 2166136261u;  // `let state = 2166136261`
inline constexpr uint32_t kFnvPrime = 16777619u;
inline constexpr uint32_t kMulberryStep = 0x6D2B79F5u;

// FNV-1a over `${seed}\0${stream}` with the code-point/high-surrogate rule
// above. Returns the state after hashing, i.e. the state a generator created
// from the same pair starts at.
//
// The std::string inputs are UTF-8. Bytes that are not valid UTF-8 cannot occur
// in a JavaScript string, so they are outside the ported contract; defensively
// they are hashed as their own byte value.
uint32_t randomSeedHash(const std::string& seed, const std::string& stream);

// The C++ analogue of the closure returned by `random(seed, stream)` in
// src/core/random.ts. Construction performs the seed hash; no draw is consumed.
class Random
{
public:
    Random(const std::string& seed, const std::string& stream);

    // The raw 32-bit draw, `(t ^ (t >>> 14)) >>> 0`, before the division by
    // 2^32. random.ts does not expose it, but the vector file pins it so the
    // 32-bit stream is checkable without float rounding.
    uint32_t nextUint32();

    // The public `() => number`: nextUint32() / 4294967296.
    double nextDouble();

    // So `random(seed, stream)()` reads exactly like the TypeScript call site.
    double operator()() { return nextDouble(); }

    // The FNV-1a state the generator starts from (== randomSeedHash(seed, stream)).
    uint32_t initialState() const { return state_; }

private:
    uint32_t state_;
};

// Mirror of `random(seed, stream): () => number` - returns a fresh generator.
Random random(const std::string& seed, const std::string& stream);

}  // namespace bbpm::core
