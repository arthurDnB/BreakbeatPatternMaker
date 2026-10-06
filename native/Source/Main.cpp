/*
    Breakbeat Pattern Maker - native (JUCE) N0 skeleton.

    What this milestone proves:
      1. the repo can build and run a native JUCE app on this machine;
      2. the frozen IPC contract (schemas/render-plan-v1.schema.json) is
         read by native code rather than re-invented;
      3. the timeline math and event scheduling from the M0 report work:
         seconds = ticks * 60 / (bpm * ppq), meter/tempo events authoritative;
      4. audio can be rendered offline to a WAV for byte-comparable fixtures
         and streamed to the device for listening.

    What it deliberately does NOT do: generate a pattern. The generator core is
    still TypeScript. Porting starts at N1 with src/core/random.ts +
    src/core/model.ts (M0 report section 1.7, portability order).
*/

// Included directly rather than through a generated JuceHeader.h: juceaide,
// which generates that header, is non-functional on the current build machine
// (see the juceaide bypass note in native/CMakeLists.txt).
#include <juce_audio_utils/juce_audio_utils.h>

#include <cmath>
#include <cstdio>
#include <string>
#include <vector>

#if JUCE_WINDOWS
 #include <windows.h>
#endif

namespace
{

constexpr double kTailSeconds = 0.25;

// A minimal but schema-valid RenderPlanV1 document: two bars of 4/4 at 174 BPM,
// 16th-note grid (240 ticks per step at PPQ 960). Kick on 36, snare on 38.
const char* kPlanJson = R"PLAN(
{
  "planVersion": "RenderPlanV1",
  "projectRevision": 1,
  "planRevision": 1,
  "engineVersion": "0.5.1-groove.1",
  "timeline": {
    "ppq": 960,
    "sampleRate": 48000,
    "tempoEvents": [ { "tick": 0, "bpm": 174 } ],
    "meterEvents": [ { "tick": 0, "numerator": 4, "denominator": 4 } ]
  },
  "tracks": [
    { "trackId": "kick",  "kind": "synth", "gain": 0.90, "pan": 0.0 },
    { "trackId": "snare", "kind": "synth", "gain": 0.80, "pan": 0.0 }
  ],
  "events": [
    { "eventId": "k0", "trackId": "kick",  "tick": 0,    "gain": 1.00, "source": { "kind": "synth", "note": 36 } },
    { "eventId": "k1", "trackId": "kick",  "tick": 1440, "gain": 0.85, "source": { "kind": "synth", "note": 36 } },
    { "eventId": "k2", "trackId": "kick",  "tick": 2400, "gain": 0.95, "source": { "kind": "synth", "note": 36 } },
    { "eventId": "k3", "trackId": "kick",  "tick": 3840, "gain": 1.00, "source": { "kind": "synth", "note": 36 } },
    { "eventId": "k4", "trackId": "kick",  "tick": 5280, "gain": 0.85, "source": { "kind": "synth", "note": 36 } },
    { "eventId": "k5", "trackId": "kick",  "tick": 6240, "gain": 0.95, "source": { "kind": "synth", "note": 36 } },
    { "eventId": "s0", "trackId": "snare", "tick": 960,  "gain": 1.00, "source": { "kind": "synth", "note": 38 } },
    { "eventId": "s1", "trackId": "snare", "tick": 2880, "gain": 0.90, "source": { "kind": "synth", "note": 38 } },
    { "eventId": "s2", "trackId": "snare", "tick": 4800, "gain": 1.00, "source": { "kind": "synth", "note": 38 } },
    { "eventId": "s3", "trackId": "snare", "tick": 6720, "gain": 0.90, "source": { "kind": "synth", "note": 38 } }
  ],
  "loopPolicy": { "mode": "pattern", "tailSeconds": 0.25 }
}
)PLAN";

struct PlanEvent
{
    juce::String eventId;
    juce::String trackId;
    int tick = 0;
    double gain = 1.0;
    int note = 36;
};

struct Plan
{
    double bpm = 174.0;
    int ppq = 960;
    double sampleRate = 48000.0;
    int trackCount = 0;
    int totalTicks = 0;
    std::vector<PlanEvent> events;
    juce::String error;

    bool isValid() const { return error.isEmpty() && !events.empty(); }

    double secondsPerTick() const { return 60.0 / (bpm * (double)ppq); }

    juce::String describe() const
    {
        return juce::String("RenderPlanV1 - ") + juce::String(bpm, 1) + " BPM, PPQ " + juce::String(ppq)
             + ", " + juce::String(trackCount) + " tracks, " + juce::String((int)events.size()) + " events, "
             + juce::String(totalTicks) + " ticks";
    }
};

Plan parsePlan(const juce::String& text)
{
    Plan plan;
    juce::var root;

    if (juce::JSON::parse(text, root).failed() || !root.isObject())
    {
        plan.error = "plan JSON did not parse";
        return plan;
    }

    if (root.getProperty("planVersion", juce::var()).toString() != "RenderPlanV1")
    {
        plan.error = "planVersion must be RenderPlanV1";
        return plan;
    }

    const juce::var timeline = root.getProperty("timeline", juce::var());

    if (!timeline.isObject())
    {
        plan.error = "timeline is missing";
        return plan;
    }

    plan.ppq = (int)timeline.getProperty("ppq", 960);
    plan.sampleRate = (double)timeline.getProperty("sampleRate", 48000.0);

    if (auto* tempo = timeline.getProperty("tempoEvents", juce::var()).getArray())
        if (!tempo->isEmpty())
            plan.bpm = (double)tempo->getFirst().getProperty("bpm", 174.0);

    if (auto* tracks = root.getProperty("tracks", juce::var()).getArray())
        plan.trackCount = tracks->size();

    if (auto* events = root.getProperty("events", juce::var()).getArray())
    {
        for (const auto& item : *events)
        {
            PlanEvent event;
            event.eventId = item.getProperty("eventId", juce::var()).toString();
            event.trackId = item.getProperty("trackId", juce::var()).toString();
            event.tick = (int)item.getProperty("tick", 0);
            event.gain = (double)item.getProperty("gain", 1.0);

            const juce::var source = item.getProperty("source", juce::var());

            if (source.getProperty("kind", juce::var()).toString() != "synth")
            {
                plan.error = "N0 only renders synth-source events";
                return plan;
            }

            event.note = (int)source.getProperty("note", 36);
            plan.totalTicks = juce::jmax(plan.totalTicks, event.tick);
            plan.events.push_back(event);
        }
    }

    if (plan.events.empty())
        plan.error = "plan has no events";

    return plan;
}

// --- placeholder voices -----------------------------------------------------
// Deterministic on purpose: a fixed-seed xorshift, never std::random_device.

struct Noise
{
    uint32_t state = 0x5eed1234u;

    float next()
    {
        state ^= state << 13;
        state ^= state >> 17;
        state ^= state << 5;
        return (float)((double)state / 4294967295.0 * 2.0 - 1.0);
    }
};

void addKick(juce::AudioBuffer<float>& buffer, int startSample, double rate, double gain)
{
    const int length = (int)(0.35 * rate);
    double phase = 0.0;

    for (int i = 0; i < length; ++i)
    {
        const int index = startSample + i;

        if (index >= buffer.getNumSamples())
            break;

        const double t = (double)i / rate;
        const double frequency = 120.0 * std::exp(-t * 24.0) + 45.0;
        phase += juce::MathConstants<double>::twoPi * frequency / rate;
        const double envelope = std::exp(-t / 0.09);
        const float sample = (float)(std::sin(phase) * envelope * gain);

        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
            buffer.addSample(channel, index, sample);
    }
}

void addSnare(juce::AudioBuffer<float>& buffer, int startSample, double rate, double gain, Noise& noise)
{
    const int length = (int)(0.22 * rate);
    double phase = 0.0;

    for (int i = 0; i < length; ++i)
    {
        const int index = startSample + i;

        if (index >= buffer.getNumSamples())
            break;

        const double t = (double)i / rate;
        phase += juce::MathConstants<double>::twoPi * 180.0 / rate;
        const double envelope = std::exp(-t / 0.06);
        const float sample = (float)((0.7 * noise.next() + 0.3 * std::sin(phase)) * envelope * gain);

        for (int channel = 0; channel < buffer.getNumChannels(); ++channel)
            buffer.addSample(channel, index, sample);
    }
}

struct RenderResult
{
    bool ok = false;
    juce::AudioBuffer<float> buffer;
    int frames = 0;
    double peak = 0.0;
    double rms = 0.0;
    juce::String message;
};

// The single mixing path. Called with the plan's own rate for fixture renders
// and with the device rate for playback, so both hear the same thing.
RenderResult renderPlan(const Plan& plan, double sampleRate)
{
    RenderResult result;

    if (!plan.isValid())
    {
        result.message = plan.error;
        return result;
    }

    const double tail = kTailSeconds > 0.0 ? kTailSeconds : 0.25;
    const double totalSeconds = (double)plan.totalTicks * plan.secondsPerTick() + tail;
    const int frames = (int)std::ceil(totalSeconds * sampleRate) + 1;

    result.buffer.setSize(2, frames);
    result.buffer.clear();

    Noise noise;

    for (const auto& event : plan.events)
    {
        const int startSample = (int)std::llround((double)event.tick * plan.secondsPerTick() * sampleRate);

        if (event.note <= 36)
            addKick(result.buffer, startSample, sampleRate, event.gain * 0.9);
        else
            addSnare(result.buffer, startSample, sampleRate, event.gain * 0.7, noise);
    }

    // Master trim only - no normalisation, so the peak stays a real measurement.
    result.buffer.applyGain(0, frames, 0.7f);

    result.peak = (double)result.buffer.getMagnitude(0, frames);
    result.rms = (double)result.buffer.getRMSLevel(0, 0, frames);
    result.frames = frames;
    result.ok = true;
    return result;
}

juce::String writeWav(const juce::File& target, const Plan& plan, const juce::AudioBuffer<float>& buffer)
{
    target.deleteFile();
    std::unique_ptr<juce::FileOutputStream> stream(target.createOutputStream());

    if (stream == nullptr)
        return "could not open " + target.getFullPathName() + " for writing";

    juce::WavAudioFormat format;
    std::unique_ptr<juce::AudioFormatWriter> writer(
        format.createWriterFor(stream.get(), plan.sampleRate, (unsigned int)buffer.getNumChannels(), 16, {}, 0));

    if (writer == nullptr)
        return "could not create a WAV writer";

    stream.release(); // the writer owns the stream now
    writer->writeFromAudioSampleBuffer(buffer, 0, buffer.getNumSamples());
    writer.reset();

    return {};
}

void attachParentConsole()
{
#if JUCE_WINDOWS
    if (AttachConsole(ATTACH_PARENT_PROCESS))
    {
        FILE* dummy = nullptr;
        freopen_s(&dummy, "CONOUT$", "w", stdout);
        freopen_s(&dummy, "CONOUT$", "w", stderr);
    }
#endif
}

int runOfflineRender(const juce::String& commandLine)
{
    const juce::StringArray tokens = juce::StringArray::fromTokens(commandLine, true);
    juce::File target = juce::File::getCurrentWorkingDirectory().getChildFile("n0-render.wav");

    const int flagIndex = tokens.indexOf("--render");

    if (flagIndex >= 0 && tokens.size() > flagIndex + 1)
        target = juce::File::getCurrentWorkingDirectory().getChildFile(tokens[flagIndex + 1]);

    const Plan plan = parsePlan(juce::String(kPlanJson));

    if (!plan.isValid())
    {
        std::printf("N0 render failed: %s\n", plan.error.toRawUTF8());
        return 2;
    }

    const RenderResult render = renderPlan(plan, plan.sampleRate);

    if (!render.ok)
    {
        std::printf("N0 render failed: %s\n", render.message.toRawUTF8());
        return 2;
    }

    const juce::String error = writeWav(target, plan, render.buffer);

    if (error.isNotEmpty())
    {
        std::printf("N0 render failed: %s\n", error.toRawUTF8());
        return 2;
    }

    const juce::String summary = "N0 native render\nplan: " + plan.describe()
                               + "\nframes: " + juce::String(render.frames)
                               + "\npeak: " + juce::String(render.peak, 6)
                               + "\nrms: " + juce::String(render.rms, 6)
                               + "\nfile: " + target.getFullPathName()
                               + "\nbytes: " + juce::String(target.getSize()) + "\n";

    target.withFileExtension(".txt").replaceWithText(summary);
    std::printf("%s", summary.toRawUTF8());
    return 0;
}

class MainComponent : public juce::AudioAppComponent
{
public:
    MainComponent()
    {
        addAndMakeVisible(playButton);
        addAndMakeVisible(stopButton);
        addAndMakeVisible(renderButton);
        addAndMakeVisible(infoLabel);

        infoLabel.setJustificationType(juce::Justification::topLeft);
        infoLabel.setColour(juce::Label::textColourId, juce::Colours::lightgrey);

        playButton.onClick = [this] { startPlayback(); };
        stopButton.onClick = [this] { stopPlayback(); };
        renderButton.onClick = [this] { renderToFile(); };

        setSize(560, 260);
        setAudioChannels(0, 2);
    }

    ~MainComponent() override { shutdownAudio(); }

    void prepareToPlay(int, double sampleRate) override
    {
        deviceRate = sampleRate;

        if (rendered == nullptr || !juce::approximatelyEqual(renderedRate, sampleRate))
            rebuild(sampleRate);
    }

    void getNextAudioBlock(const juce::AudioSourceChannelInfo& info) override
    {
        info.clearActiveBufferRegion();

        if (rendered == nullptr || !playing)
            return;

        const int available = rendered->getNumSamples() - position;

        if (available <= 0)
        {
            playing = false;
            return;
        }

        const int count = juce::jmin(info.numSamples, available);

        for (int channel = 0; channel < info.buffer->getNumChannels(); ++channel)
            info.buffer->copyFrom(channel, info.startSample, *rendered, juce::jmin(channel, rendered->getNumChannels() - 1), position, count);

        position += count;
    }

    void releaseResources() override {}

    void paint(juce::Graphics& g) override
    {
        g.fillAll(juce::Colour(0xff0a0a0a));
        g.setColour(juce::Colours::white.withAlpha(0.08f));
        g.drawRect(getLocalBounds(), 1);
    }

    void resized() override
    {
        auto area = getLocalBounds().reduced(16);
        auto controls = area.removeFromTop(36);

        playButton.setBounds(controls.removeFromLeft(110).reduced(2));
        stopButton.setBounds(controls.removeFromLeft(110).reduced(2));
        renderButton.setBounds(controls.removeFromLeft(170).reduced(2));
        infoLabel.setBounds(area.reduced(2));
        updateInfo();
    }

private:
    void rebuild(double sampleRate)
    {
        renderedRate = sampleRate;
        plan = parsePlan(juce::String(kPlanJson));

        const RenderResult render = renderPlan(plan, sampleRate);

        if (render.ok)
            rendered = std::make_unique<juce::AudioBuffer<float>>(std::move(render.buffer));
        else
        {
            rendered = std::make_unique<juce::AudioBuffer<float>>(2, (int)sampleRate);
            rendered->clear();
        }

        position = 0;
    }

    void startPlayback()
    {
        position = 0;
        playing = true;
        updateInfo();
    }

    void stopPlayback()
    {
        playing = false;
        updateInfo();
    }

    void renderToFile()
    {
        const juce::File target = juce::File::getCurrentWorkingDirectory().getChildFile("n0-render.wav");
        const RenderResult render = renderPlan(plan, plan.sampleRate);
        const juce::String error = render.ok ? writeWav(target, plan, render.buffer) : render.message;
        lastMessage = error.isEmpty() ? ("Rendered " + juce::String(render.frames) + " frames to " + target.getFileName())
                                      : ("Render failed: " + error);
        updateInfo();
    }

    void updateInfo()
    {
        lastMessage = lastMessage.isEmpty()
            ? (playing ? "Playing N0 render" : "Idle - press Play or Render to WAV")
            : lastMessage;

        infoLabel.setText(plan.describe() + "\ndevice rate: " + juce::String(deviceRate)
                            + "\n\n" + lastMessage
                            + "\n\nN0 skeleton: the plan is parsed from the frozen RenderPlanV1"
                            + "\ncontract; the generator core is still TypeScript and is ported at N1.",
                          juce::dontSendNotification);
    }

    juce::TextButton playButton { "Play" };
    juce::TextButton stopButton { "Stop" };
    juce::TextButton renderButton { "Render to WAV" };
    juce::Label infoLabel;

    Plan plan;
    std::unique_ptr<juce::AudioBuffer<float>> rendered;
    double renderedRate = 0.0;
    double deviceRate = 48000.0;
    int position = 0;
    bool playing = false;
    juce::String lastMessage;
};

class MainWindow : public juce::DocumentWindow
{
public:
    explicit MainWindow(const juce::String& name)
        : DocumentWindow(name, juce::Colour(0xff0a0a0a), DocumentWindow::allButtons)
    {
        setUsingNativeTitleBar(true);
        setContentOwned(new MainComponent(), true);
        setResizable(true, false);
        centreWithSize(getWidth(), getHeight());
        setVisible(true);
    }

    void closeButtonPressed() override { juce::JUCEApplication::getInstance()->systemRequestedQuit(); }

private:
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(MainWindow)
};

} // namespace

class BreakbeatNativeApplication : public juce::JUCEApplication
{
public:
    const juce::String getApplicationName() override { return "Breakbeat Pattern Maker"; }
    const juce::String getApplicationVersion() override { return "0.1.0-native-n0"; }
    bool moreThanOneInstanceAllowed() override { return true; }

    void initialise(const juce::String& commandLine) override
    {
        attachParentConsole();

        if (commandLine.contains("--render"))
        {
            setApplicationReturnValue(runOfflineRender(commandLine));
            quit();
            return;
        }

        mainWindow = std::make_unique<MainWindow>(getApplicationName());
    }

    void shutdown() override { mainWindow.reset(); }

    void systemRequestedQuit() override { quit(); }

private:
    std::unique_ptr<MainWindow> mainWindow;
};

START_JUCE_APPLICATION(BreakbeatNativeApplication)
