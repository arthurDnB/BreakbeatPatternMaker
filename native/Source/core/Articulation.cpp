#include "Articulation.h"

#include <cstddef>
#include <vector>

#include "JsError.h"
#include "JsValidators.h"
#include "Model.h"

namespace bbpm::core {
namespace {

bool knownMode(const std::optional<std::string>& mode) {
  if (!mode.has_value()) return false;
  return *mode == "natural" || *mode == "gate" || *mode == "chop";
}

}  // namespace

void validateArticulation(const Hit& hit) {
  if (hit.sourceKind.has_value() && *hit.sourceKind != "oneShot" && *hit.sourceKind != "slice") {
    throw JsError("Invalid sound source kind.");
  }

  // `const a = hit.articulation; if (a === undefined) return;`
  if (!hit.articulation.has_value()) {
    if (!hit.articulationRaw.has_value()) return;
    // `!a || typeof a !== 'object'`
    throw JsError("Invalid articulation mode.");
  }

  const Articulation& articulation = *hit.articulation;
  if (!knownMode(articulation.mode)) throw JsError("Invalid articulation mode.");
  requireBounded(jsNumber(articulation.durationTicks), 1.0, 4.0 * static_cast<double>(kPpq),
                 "articulation duration", true);
  if (!articulation.chokeGroup.isUndefined() && !articulation.chokeGroup.equalsString("hat")) {
    throw JsError("Invalid choke group.");
  }

  if (articulation.repeats.has_value() || !articulation.repeatsRaw.isUndefined()) {
    if (!articulation.repeats.has_value()) throw JsError("Repeat expression must match ratchets.");
    const std::vector<RepeatArticulation>& repeats = *articulation.repeats;
    const double expected = jsNumberOr(hit.ratchets, 1.0);
    if (static_cast<double>(repeats.size()) != expected || repeats.size() > 8) {
      throw JsError("Repeat expression must match ratchets.");
    }
    for (const RepeatArticulation& repeat : repeats) {
      if (repeat.elemKind != RepeatElemKind::Object) throw JsError("Invalid repeat expression.");
      requireBounded(jsNumber(repeat.gain), 0.0, 1.0, "repeat gain");
      if (repeat.pitch.has_value()) requireBounded(*repeat.pitch, -24.0, 24.0, "repeat pitch");
      if (repeat.glide.has_value()) requireBounded(*repeat.glide, -24.0, 24.0, "repeat glide");
      if (repeat.sourceOffset.has_value()) {
        requireBounded(*repeat.sourceOffset, 0.0, 0.95, "repeat source offset");
      }
      if (!repeat.reverse.isUndefined() && !repeat.reverse.isBool()) {
        throw JsError("Invalid repeat reverse flag.");
      }
    }
  }
}

Hit setRatchets(const Hit& hit, double count, double rowTicks) {
  Hit next = hit;
  next.ratchets = count;
  if (next.articulation.has_value()) {
    Articulation& articulation = *next.articulation;
    articulation.mode = count > 1.0 ? std::string("gate")
                                    : (hit.gate.isUndefined() ? std::string("natural")
                                                              : std::string("gate"));
    articulation.durationTicks = jsFalsyNumberOr(articulation.durationTicks, rowTicks);
    articulation.repeats.reset();
    articulation.repeatsRaw = JsValue::absent();
  }
  return next;
}

std::string articulationLabel(const Hit& hit) {
  if (!hit.articulation.has_value()) return std::string();
  const Articulation& articulation = *hit.articulation;
  const std::string mode = articulation.mode.has_value() ? *articulation.mode : std::string();

  std::vector<std::string> parts;
  parts.push_back(mode == "natural" ? "Natural tail"
                                    : (mode == "chop" ? "Micro-chop" : "Gated"));

  const double ratchets = jsNumberOr(hit.ratchets, 1.0);
  if (ratchets > 1.0) {
    const double durationTicks = jsNumber(articulation.durationTicks);
    const double beats = toFixedNumber(durationTicks / static_cast<double>(kPpq), 3);
    parts.push_back(jsNumberToString(ratchets) + " hits over " + jsNumberToString(beats) + " beat" +
                    (durationTicks == static_cast<double>(kPpq) ? "" : "s"));
  }

  if (articulation.repeats.has_value()) {
    bool contour = false;
    bool movement = false;
    bool reverse = false;
    for (const RepeatArticulation& repeat : *articulation.repeats) {
      if (!(repeat.gain.has_value() && *repeat.gain == 1.0)) contour = true;
      if (jsTruthy(repeat.pitch) || jsTruthy(repeat.glide)) movement = true;
      if (repeat.reverse.truthy()) reverse = true;
    }
    if (contour) parts.push_back("velocity contour");
    if (movement) parts.push_back("pitch movement");
    if (reverse) parts.push_back("reverse accent");
  }

  if (articulation.chokeGroup.truthy()) parts.push_back("hat choke");

  std::string joined;
  for (std::size_t index = 0; index < parts.size(); ++index) {
    if (index != 0) joined += " \xC2\xB7 ";  // ' · ', U+00B7
    joined += parts[index];
  }
  return joined;
}

}  // namespace bbpm::core