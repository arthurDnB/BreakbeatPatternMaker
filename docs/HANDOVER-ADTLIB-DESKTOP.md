# ADTLib Integration & Breakbeat Deconstruction Engine
## Engineering Handover & Technical Specification for DeepSeek Harness (BPM Desktop C++ / JUCE)

> **Document Status:** Active Architectural Handover  
> **Author & Lead:** Antigravity (Project Lead & Integrator)  
> **Assigned Implementer:** DeepSeek Harness (Junior Developer & Scaffolder — NVIDIA NIM)  
> **Technical Overseer:** OpenAI Codex (Senior Specialist — DSP & Core Systems)  
> **Product Owner:** Arthur (The Boss)  
> **Target Subsystem:** `native/` (C++17 + JUCE 7.0.12 Desktop Application)  
> **Key References:**
> 1. [Dr. Jason Hockman: "Breakbeat Deconstruction: From hip hop to drum & bass and beyond" (Ableton Loop 2016)](https://youtu.be/eJf9Jptq7VY)
> 2. [Carl Southall, Ryan Stables, Jason Hockman: ADTLib (Automatic Drum Transcription Library)](https://github.com/CarlSouthall/ADTLib)
> 3. Existing BPM Docs: [`docs/NATIVE-PORT-PLAN.md`](file:///c:/Users/arthu/Downloads/Breakbeat%20Pattern%20Maker/docs/NATIVE-PORT-PLAN.md), [`docs/BREAK-TRANSCRIPTION.md`](file:///c:/Users/arthu/Downloads/Breakbeat%20Pattern%20Maker/docs/BREAK-TRANSCRIPTION.md), [`docs/VERIFIED-BREAK-BENCHMARK.md`](file:///c:/Users/arthu/Downloads/Breakbeat%20Pattern%20Maker/docs/VERIFIED-BREAK-BENCHMARK.md)

---

## 1. Executive Summary & Purpose

Breakbeat Pattern Maker (BPM) currently features a preview break transcription system in the browser (`src/audio/break-analysis.ts`) that detects raw transient onsets using a 3-band energy rise and spectral flux algorithm. However, as explicitly documented in [`docs/BREAK-TRANSCRIPTION.md`](file:///c:/Users/arthu/Downloads/Breakbeat%20Pattern%20Maker/docs/BREAK-TRANSCRIPTION.md#L16):
> *"The original recording stays intact. A kick and hat sounding together remain together in their slice. This release does not classify drum types, separate stems, estimate velocity, time-stretch, or automatically compose genre patterns from unlabeled slices."*

This creates a fundamental bottleneck: the user can slice a classic break (e.g., Amen, Think, Apache, Funky Drummer), but the app only sees opaque, chronological slices (`C-0`, `C#0`, `D-0`). It cannot distinguish a Kick from a Snare or a Hi-Hat.

**The Mission for DeepSeek Harness:**  
Implement **ADTLib (Automatic Drum Transcription)** natively in the C++17 / JUCE desktop application (`native/`). This equips BPM Desktop with neural-network-backed drum transcription capable of:
1. Detecting and classifying polyphonic drum onsets into **Kick Drum (`KD`)**, **Snare Drum (`SD`)**, and **Hi-Hat (`HH`)**.
2. Deconstructing recorded breaks directly into discrete BPM tracker drum lanes (`LaneId::Kick`, `LaneId::Snare`, `LaneId::ClosedHat`, etc.).
3. Preserving authentic human micro-timing, ghost notes, and dynamic velocities.
4. Enabling BPM's **Groove V5 engine** to resequence authentic sliced breakbeats across all 38 genres, fulfilling Dr. Jason Hockman's vision of breakbeat deconstruction.

---

## 2. Musical & Historical Context: Dr. Jason Hockman's Deconstruction Philosophy

In his lecture at Ableton Loop 2016 (*"Breakbeat Deconstruction: From hip hop to drum & bass and beyond"*), Dr. Jason Hockman outlines the technical and cultural evolution of breakbeat manipulation. Understanding these principles is essential for implementing the feature correctly in BPM.

```
       [ Vintage Vinyl Break (1960s-70s Funk) ]
       (Clyde Stubblefield / Gregory Coleman)
                         │
                         ▼
     [ Early Hardware Sampling (Akai S612 / S950) ]
     - Pitched up (+8 / 33rpm -> 45rpm) to save memory
     - Pitched down / re-triggered transients
     - Low frequencies shifted up -> Cleared room for 808 sub-bass
                         │
                         ▼
     [ Automatic Drum Transcription (ADTLib) ]
     - STFT Spectrogram (2048 window, 512 hop)
     - 2-Layer BiLSTM + Soft Attention (KD / SD / HH models)
     - Adaptive Peak Picking & Refractory Suppression
                         │
                         ▼
  ┌──────────────────────┴──────────────────────┐
  ▼                                             ▼
[ Discrete Drum Lanes ]             [ Groove V5 Resequencing ]
- Kick Lane                         - Amen Science Chop
- Snare Lane (+ Ghosts)             - Atmospheric Jungle Cadence
- Hi-Hat / Shuffle Lane             - Halftime / Breakcore Mutation
```

### 2.1 The Technical Imperatives from Hockman's Lecture
1. **Memory Scarcity and Transposition:** Early samplers had minimal memory (Akai S612: 1.2s; S950: 750kB). Producers pitched 33 RPM records up to 45 RPM to shorten sample length, sampled them, and then transposed or pitched them back down.
2. **Frequency Clearance for Sub-Bass:** Speeding up or high-passing break slices shifted the acoustic kick fundamentals (typically 50–90 Hz) upwards into the punch region (120–200 Hz). This cleared the ultra-low spectrum for sustained 808 kicks, sine subs, and Reese basslines—the bedrock of Jungle and Drum & Bass.
3. **Deconstruction into Functional Roles:** A drummer in a room does not play isolated stems; the microphone captures the bleed of the kick, snare, cymbals, room acoustics, and tape saturation. Resequencing requires knowing *which* transient belongs to *which* instrument role so they can be re-triggered in novel syncopations.
4. **Preservation of Micro-Timing & Swing:** The human feel of legendary breaks comes from laid-back snares (often 5–20 ms behind the grid) and swung 16th-note ghost hits. Transcription must not brutally quantize hits to a rigid grid; it must preserve continuous millisecond onset offsets (`Hit.offsetTick`).

---

## 3. ADTLib Architectural Anatomy (`CarlSouthall/ADTLib`)

ADTLib was created by Carl Southall, Ryan Stables, and Jason Hockman at the Digital Media Technology (DMT) Lab, Birmingham City University.

### 3.1 Audio Preprocessing & Feature Extraction
* **Sampling Rate:** $f_s = 44,100\text{ Hz}$ (single-channel mono).
* **Short-Time Fourier Transform (STFT):**
  * Frame size: $N_{\text{frame}} = 2048$ samples ($\approx 46.44\text{ ms}$).
  * Hop size: $H = 512$ samples ($\approx 11.61\text{ ms}$, $\approx 86.13\text{ fps}$).
  * Window: Standard periodic Hann window.
  * FFT Size: 2048 points $\rightarrow 1024$ linear magnitude bins ($k = 0 \dots 1023$).
  * Dynamic range / magnitude scaling: Linear spectral magnitude $|X(m, k)|$.

### 3.2 Deep Learning Architecture (Soft Attention BiLSTM)
ADTLib employs three separate neural network checkpoints trained specifically for each drum class:
* `KickADTLibAll`
* `SnareADTLibAll`
* `HihatADTLibAll`

Each model uses the identical network topology:

```
Input Frame x(t): 1024 Spectral Magnitude Bins
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ Layer 1: Bidirectional LSTM                            │
│ Forward:  20 units                                     │
│ Backward: 20 units                                     │
│ Output s1(t): 40 features                              │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ Layer 2: Bidirectional LSTM                            │
│ Forward:  20 units                                     │
│ Backward: 20 units                                     │
│ Output s2(t): 40 features                              │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ Soft Attention Mechanism (Context Window = 5 frames)   │
│ Context range: j in [-2, -1, 0, +1, +2]                │
│ Match vector:                                          │
│   m_j(t) = tanh( [s2(t+j) ; s1(t)] * W_att[j] )        │
│ Attention logits:                                      │
│   e_j(t) = m_j(t) * W_sm[j]                            │
│ Attention weights:                                     │
│   a(t) = softmax( [e_-2(t), ..., e_+2(t)] )            │
│ Context vector:                                        │
│   z(t) = sum_{j=-2}^{+2} ( a_j(t) * s2(t+j) )          │
└────────────────────────────────────────────────────────┘
                    │
                    ▼
┌────────────────────────────────────────────────────────┐
│ Dense Classification & Activation                      │
│ presoft(t) = z(t) * W_out + b_out   (40 -> 2 classes)  │
│ pred(t) = softmax( presoft(t) )                        │
│ Output Activation AF(t) = pred(t)[1] (Onset Prob)      │
└────────────────────────────────────────────────────────┘
```

#### Network Parameter Sizing (Why Native C++ is Optimal)
Because the network uses only $2 \times 20$ hidden units per layer:
* Layer 1 BiLSTM: $2 \times [4 \times (1024 \times 20 + 20 \times 20 + 20)] \approx 167\text{k}$ parameters.
* Layer 2 BiLSTM: $2 \times [4 \times (40 \times 20 + 20 \times 20 + 20)] \approx 9.9\text{k}$ parameters.
* Soft Attention + Dense: $\approx 10\text{k}$ parameters.
* **Total size per instrument model:** $\approx 187\text{k}$ floating-point values ($\approx 750\text{ KB}$ raw binary).
* **All 3 models combined (KD + SD + HH):** $\approx 2.25\text{ MB}$ total!
* **Conclusion for DeepSeek Harness:** This network is tiny enough to evaluate in pure C++ without heavy external ML runtimes.

### 3.3 Post-Processing & Peak Picking Algorithm (`meanPPmm`)
The raw model output is a continuous Activation Function $AF(t) \in [0, 1]$ over frames $t = 0 \dots T-1$.
ADTLib applies an adaptive dynamic threshold followed by local maximum extraction and refractory suppression:

```python
# Parameters from PPParams.npy: shape (3, 3) -> [Lambda, mi, ma] for [KD, SD, HH]
def meanPPmm(Track, Lambda, mi, ma, hop=512, fs=44100, dif=0.05):
    # 1. Compute dynamic threshold
    m = np.mean(Track) * Lambda
    if ma != 0 and m > ma:
        m = ma
    if mi != 0 and m < mi:
        m = mi
        
    # 2. Find local maxima exceeding threshold m
    onsets = []
    values = []
    for i in range(len(Track) - 2):
        if Track[i+1] > Track[i] and Track[i+1] >= Track[i+2] and Track[i+1] > m:
            onsets.append(i + 1)
            values.append(Track[i+1])
            
    # 3. Convert frame indices to seconds
    onsets = (np.array(onsets) * hop) / float(fs)
    
    # 4. Refractory suppression: eliminate hits closer than 50 ms (dif = 0.05s)
    # Keeping the hit with the larger activation value
    # ...
    return onsets
```

---

## 4. Desktop C++ / JUCE Integration Architecture

The native desktop version (`native/`) is built with **C++17 and JUCE 7.0.12** using Visual Studio Build Tools 2019 (MSVC 14.29) and Ninja.

### 4.1 Strict Constraints (From `docs/NATIVE-PORT-PLAN.md`)
1. **No Python Runtime at Execution:** The desktop application cannot require Python, NumPy, or TensorFlow to be installed on the user's PC.
2. **Deterministic & Portable:** Audio analysis must produce identical, byte-reproducible onset detections across platforms.
3. **Non-Blocking Background Threading:** Audio analysis runs on a worker thread (`juce::Thread`), leaving the JUCE message thread responsive and the audio device glitch-free.
4. **Clean Code Separation:** Pure DSP & math logic belongs in `native/Source/audio/` or `native/Source/core/` with standalone console test targets. GUI components belong in `native/Source/ui/`.

### 4.2 Component Architecture Diagram

```
[ User drops drum WAV into BPM Desktop ]
                     │
                     ▼
  ┌─────────────────────────────────────────────────────────┐
  │ native/Source/ui/BreakImportDialog                      │
  │ - Region selection (Start / End seconds)                │
  │ - Sensitivity sliders (KD, SD, HH)                      │
  │ - Waveform display with color-coded markers             │
  └──────────────────────────┬──────────────────────────────┘
                             │ Launches background job
                             ▼
  ┌─────────────────────────────────────────────────────────┐
  │ native/Source/audio/AdtWorkerThread : juce::Thread      │
  │ - Reads audio buffer channels                           │
  │ - Reports progress (0.0 .. 1.0) via std::atomic<float>  │
  │ - Checks threadShouldExit() for instant cancellation   │
  └──────────┬──────────────────────────────┬───────────────┘
             │                              │
             ▼                              ▼
  ┌─────────────────────────┐   ┌───────────────────────────┐
  │ AdtSpectrogramExtractor │   │ AdtInferenceEngine        │
  │ - juce::dsp::FFT(11)    │   │ - 2-Layer BiLSTM Evaluator│
  │ - Hann window           │   │ - 5-frame Soft Attention  │
  │ - 2048 win, 512 hop     │   │ - Model weights (.bin)    │
  └──────────┬──────────────┘   └───────────┬───────────────┘
             │                              │
             └──────────────┬───────────────┘
                            ▼
  ┌─────────────────────────────────────────────────────────┐
  │ AdtPostProcessor                                        │
  │ - meanPPmm thresholding & peak picking                  │
  │ - 50ms refractory suppression                           │
  │ - Output: vector<AdtOnset> { timestamp, role, strength }│
  └─────────────────────────┬───────────────────────────────┘
                            │
                            ▼
  ┌─────────────────────────────────────────────────────────┐
  │ native/Source/core/BreakDeconstructor                   │
  │ - Slices audio buffer at detected onsets                │
  │ - Constructs bbpm::core::SliceInstrument                │
  │ - Allocates hits to DrumLanes (Kick, Snare, Hats)       │
  │ - Preserves micro-timing (offsetTick)                   │
  │ - Populates bbpm::core::Pattern                         │
  └─────────────────────────────────────────────────────────┘
```

---

## 5. Step-by-Step Implementation Ladder for DeepSeek Harness

DeepSeek Harness must execute the implementation in **5 structured waves**, each gated by tracked fixtures and verified before proceeding to the next.

```
Wave A: Offline Weight Extraction & Test Vector Generation (Python)
Wave B: Native C++ STFT & Spectrogram Extractor (JUCE DSP)
Wave C: Native C++ BiLSTM & Soft Attention Inference Core
Wave D: Post-Processing Peak Picker & Transcription Pipeline
Wave E: BPM Core Tracker Bridge & JUCE Import UI
```

---

### Wave A: Offline Weight Extraction & Vector Generation Tooling

Before writing C++ code, DeepSeek Harness will create an offline Python utility to convert the legacy TensorFlow 1.x checkpoints from `CarlSouthall/ADTLib` into compact, modern binary weight files and recorded test vectors.

#### A.1 Weight Converter Script (`tools/adt/export_adt_weights.py`)
* Reads `ADTLib/files/{Kick,Snare,Hihat}ADTLibAll.{meta,index,data}`.
* Extracts the weight matrices and bias vectors:
  - Layer 1 Forward & Backward LSTM: $W_{\text{xi}}, W_{\text{hi}}, b_i, W_{\text{xf}}, W_{\text{hf}}, b_f, W_{\text{xc}}, W_{\text{hc}}, b_c, W_{\text{xo}}, W_{\text{ho}}, b_o$.
  - Layer 2 Forward & Backward LSTM: Same parameter structure.
  - Soft Attention: $W_{\text{att}}[0\dots 4]$ (shape $80 \times 40$), $W_{\text{sm}}[0\dots 4]$ (shape $40 \times 40$).
  - Dense Output: $W_{\text{out}}$ (shape $40 \times 2$), $b_{\text{out}}$ (shape 2).
  - Post-processing: $PPParams[0\dots 2, 0\dots 2]$ (from `PPParams.npy`).
* Serializes each model to a contiguous, alignment-safe binary format:
  `native/resources/adt/kick_model.bin`  
  `native/resources/adt/snare_model.bin`  
  `native/resources/adt/hihat_model.bin`

#### A.2 Binary Header Specification (`AdtModelFormat.h`)
```cpp
#pragma once
#include <cstdint>

#pragma pack(push, 1)
struct AdtModelHeader {
    char magic[4];          // "ADTM"
    uint32_t version;       // 1
    uint32_t inputBins;     // 1024
    uint32_t hiddenUnits;   // 20
    uint32_t contextFrames; // 5 (attention_number = 2)
    uint32_t numClasses;    // 2
    float lambda;           // from PPParams
    float mi;               // from PPParams
    float ma;               // from PPParams
};
#pragma pack(pop)
```

#### A.3 Test Vectors Generation (`native/tests/vectors/adt-vectors.txt`)
* Runs the reference Python ADTLib on the 8 verified real break excerpts defined in [`benchmarks/verified-real-breaks.json`](file:///c:/Users/arthu/Downloads/Breakbeat%20Pattern%20Maker/benchmarks/verified-real-breaks.json) (Amen, Apache, Funky Drummer, etc.).
* Outputs:
  1. Input audio hash & frame count.
  2. Selected spectrogram slices (mean, max, sample bins).
  3. Frame-by-frame activation curves $AF(t)$ for KD, SD, HH.
  4. Final detected onsets (timestamp in seconds, role).

---

### Wave B: Native C++ STFT & Spectrogram Extractor

Create `native/Source/audio/AdtSpectrogram.h` and `AdtSpectrogram.cpp`.

#### B.1 Specification
* Inherits or uses `juce::dsp::FFT(11)` ($2^{11} = 2048$).
* Uses `juce::dsp::WindowingMethod::hann` with periodic Hann window.
* Hop size: exactly 512 samples.
* For each frame $n$:
  1. Window 2048 input samples into an aligned float buffer `[2048 * 2]` (real/imaginary interleaved).
  2. Execute `fft.performRealOnlyForwardTransform(buffer)`.
  3. Compute magnitude for bins $0 \dots 1023$:
     $$\text{mag}[k] = \sqrt{\text{re}[k]^2 + \text{im}[k]^2}$$
* Verify numerical parity against Python `madmom.audio.spectrogram.Spectrogram` within $10^{-5}$ tolerance.

---

### Wave C: Native C++ BiLSTM & Soft Attention Inference Core

Create `native/Source/audio/AdtInferenceEngine.h` and `AdtInferenceEngine.cpp`.

#### C.1 BiLSTM Cell Formulation
For an LSTM cell with input $x_t \in \mathbb{R}^{D}$ and previous state $h_{t-1} \in \mathbb{R}^{H}, c_{t-1} \in \mathbb{R}^{H}$:
$$i_t = \sigma(W_{xi} x_t + W_{hi} h_{t-1} + b_i)$$
$$f_t = \sigma(W_{xf} x_t + W_{hf} h_{t-1} + b_f)$$
$$\tilde{c}_t = \tanh(W_{xc} x_t + W_{hc} h_{t-1} + b_c)$$
$$c_t = f_t \odot c_{t-1} + i_t \odot \tilde{c}_t$$
$$o_t = \sigma(W_{xo} x_t + W_{ho} h_{t-1} + b_o)$$
$$h_t = o_t \odot \tanh(c_t)$$

* Forward pass iterates $t = 0 \dots T-1$.
* Backward pass iterates $t = T-1 \dots 0$.
* Combined output: $s(t) = [h_{\text{fw}}(t) \, ; \, h_{\text{bw}}(t)] \in \mathbb{R}^{2H}$.

#### C.2 Soft Attention Evaluation
* For frame $t$, collect Layer 2 output vectors across $j \in \{-2, -1, 0, +1, +2\}$:
  Pad boundary frames with zero vectors where $t+j < 0$ or $t+j \ge T$.
* Compute matching vectors:
  $$m_j(t) = \tanh\left( [s_2(t+j) \, ; \, s_1(t)] \cdot W_{\text{att}}[j] \right)$$
* Compute softmax attention scores:
  $$e_j(t) = m_j(t) \cdot W_{\text{sm}}[j]$$
  $$a_j(t) = \frac{\exp(e_j(t))}{\sum_{k=-2}^{+2} \exp(e_k(t))}$$
* Weighted sum context vector:
  $$z(t) = \sum_{j=-2}^{+2} a_j(t) \cdot s_2(t+j)$$
* Final output onset probability:
  $$\text{logit}(t) = z(t) \cdot W_{\text{out}} + b_{\text{out}}$$
  $$AF(t) = \text{softmax}(\text{logit}(t))[1]$$

---

### Wave D: Post-Processing Peak Picker & Transcription Pipeline

Create `native/Source/audio/AdtPostProcessor.h` and `AdtPostProcessor.cpp`.

#### D.1 Post-Processing Logic
```cpp
namespace bbpm::audio {

struct OnsetEvent {
    double timeSeconds;
    float activation;
    core::Role role; // Kick, Snare, or HiHat
};

std::vector<double> pickPeaks(const std::vector<float>& track,
                             float lambda, float mi, float ma,
                             int hop = 512, double fs = 44100.0,
                             double minDistanceSec = 0.05);

} // namespace bbpm::audio
```
1. Compute mean: $m = \text{mean}(track) \times \lambda$.
2. Clamp: if $ma \ne 0$ and $m > ma \implies m = ma$; if $mi \ne 0$ and $m < mi \implies m = mi$.
3. Peak condition: $track[i] > track[i-1]$ and $track[i] \ge track[i+1]$ and $track[i] > m$.
4. Convert index to time: $t = (i \times hop) / fs$.
5. Refractory suppression: if $t[k] - t[k-1] < 0.05\text{s}$, retain the candidate with higher activation.

---

### Wave E: BPM Tracker Bridge & JUCE Import UI

#### E.1 Bridge into BPM Core Tracker Model (`BreakDeconstructor.h/cpp`)
1. **Audio Slice Extraction:**
   - Sort all unique onset timestamps across KD, SD, HH: $t_0 < t_1 < \dots < t_N$.
   - Create a `bbpm::core::SliceInstrument` (`native/Source/core/SliceInstrument.h`):
     - `instrument.id = "inst-break-" + uuid`
     - `instrument.name = sourceFileName`
     - Each slice has `startFrame = round(t_k * fs)`, `endFrame = round(t_{k+1} * fs)`.
2. **Hit Allocation to Tracker Lanes:**
   - Map KD onsets $\to$ `Role::Kick` (default `LaneId::Kick`).
   - Map SD onsets $\to$ `Role::Snare` (default `LaneId::Snare`).
   - Map HH onsets $\to$ `Role::ClosedHat` (default `LaneId::ClosedHat`).
   - For each hit, assign:
     ```cpp
     hit.mapped = Hit::Mapped { instrument.id, sliceIndex };
     hit.role = detectedRole;
     ```
3. **Micro-Timing Calculation:**
   Given the source tempo $BPM$ and ticks-per-beat ($PPQ = 96$):
   $$\text{ticksPerSecond} = \frac{BPM \times PPQ}{60}$$
   $$\text{exactTick} = t \times \text{ticksPerSecond}$$
   $$\text{row} = \lfloor \text{exactTick} / \text{ticksPerRow} \rfloor$$
   $$\text{offsetTick} = \text{exactTick} - (\text{row} \times \text{ticksPerRow})$$
   Assign `hit.baseTick = row * ticksPerRow` and `hit.offsetTick = offsetTick`.
   This perfectly preserves the organic swing and human timing of the original break!

#### E.2 Resequencing with Groove V5
Once the break is deconstructed into labeled slices (`Kick`, `Snare`, `Hat`), BPM's Groove V5 composition engine can take over:
* The user selects any of the 38 genre profiles (e.g., `amen-science`, `atmospheric-dnb`, `halftime-dnb`, `liquid-roller`, `oldskool-hardcore`).
* Instead of triggering default synthesized one-shots, Groove V5 triggers the corresponding sliced hits from the user's authentic breakbeat!
* Slices maintain their pitch, timbre, and character, while playing the syncopated anchor motif, ghost notes, and turnaround cadences of the chosen genre.

---

## 6. Verification & Quality Gates

DeepSeek Harness must satisfy all gates before marking work complete:

### Gate 1: Deterministic C++ Self-Tests
* Add `bbpm_adt_selftest.exe` to `native/CMakeLists.txt`.
* Must replay `native/tests/vectors/adt-vectors.txt` with zero failures.
* Spectrogram values: max difference $< 10^{-4}$.
* Activation curves $AF(t)$: max difference $< 10^{-4}$.
* Detected onsets: 100% agreement with reference timestamps within $\pm 1\text{ ms}$.

### Gate 2: Verified Real Break Benchmark
* Test against [`benchmarks/verified-real-breaks.json`](file:///c:/Users/arthu/Downloads/Breakbeat%20Pattern%20Maker/benchmarks/verified-real-breaks.json) covering:
  - `amen-su700` (Amen Brother)
  - `apache-mono` (Apache)
  - `funky-mono` (Funky Drummer)
  - `think-mono` (Think About It)
* Benchmark script: `npm.cmd run audit:breaks`.
* Macro F1 score at $\pm 10\text{ ms}$ must exceed the current baseline ($F_1 > 0.613$).

### Gate 3: Regression Zero-Tolerance
* Ensure all existing 416 unit tests continue to pass:
  ```cmd
  npm.cmd test
  ```
* Ensure native build links cleanly without warnings:
  ```cmd
  native\build.cmd
  ```

---

## 7. Mandatory Protocol Checklist for DeepSeek Harness (from `AGENTS.md`)

Before and after every commit:
- [ ] **Step 1:** Run `git pull origin main` and review latest entries in `DEVELOPMENT-LOG.md`.
- [ ] **Step 2:** Verify all tests pass (`npm.cmd test`, `native\build.cmd`).
- [ ] **Step 3:** Document work in `DEVELOPMENT-LOG.md` under `## Change Log` (Date, Assistant Name: `DeepSeek Harness`, Bullet points detailing changed files and rationale).
- [ ] **Step 4:** Git commit and push:
  ```bash
  git add .
  git commit -m "feat(native): ADTLib drum transcription engine Wave X (DeepSeek Harness)"
  git push origin main
  ```
- [ ] **Step 5:** Notify office lead via `office verify` or wake up Antigravity.

---

*This specification is approved and handed over for execution by Antigravity (Project Lead & Integrator).*
