#include "DrumLanes.h"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <map>
#include <vector>

#include "JsError.h"
#include "Model.h"
#include "Random.h"

namespace bbpm::core {
namespace {

const char* defaultName(Role role) {
  switch (role) {
    case Role::Kick:
      return "Kick";
    case Role::Snare:
      return "Snare";
    case Role::Hat:
      return "Hat";
    case Role::Percussion:
      return "Percussion";
  }
  return "Kick";
}

// Decodes one UTF-8 code point; the JS `for (const char of id)` loop visits code
// POINTS, and charCodeAt(0) of an astral point is its high surrogate.
struct CodePoint {
  std::uint32_t value;
  std::size_t length;
  bool astral;
};

CodePoint decode(const std::string& value, std::size_t index) {
  const unsigned char lead = static_cast<unsigned char>(value[index]);
  std::size_t length = 1;
  std::uint32_t code = lead;
  if ((lead & 0xE0u) == 0xC0u) {
    length = 2;
    code = lead & 0x1Fu;
  } else if ((lead & 0xF0u) == 0xE0u) {
    length = 3;
    code = lead & 0x0Fu;
  } else if ((lead & 0xF8u) == 0xF0u) {
    length = 4;
    code = lead & 0x07u;
  } else if (lead >= 0x80u) {
    code = 0xFFFDu;
  }
  if (index + length > value.size()) {
    return {0xFFFDu, 1, false};
  }
  for (std::size_t extra = 1; extra < length; ++extra) {
    code = (code << 6) | (static_cast<unsigned char>(value[index + extra]) & 0x3Fu);
  }
  return {code, length, length == 4};
}

// String.prototype.slice(0, maximumUnits) counts UTF-16 code units.
std::string utf16Slice(const std::string& value, int maximumUnits) {
  std::size_t index = 0;
  int units = 0;
  while (index < value.size()) {
    const CodePoint point = decode(value, index);
    const int cost = point.astral ? 2 : 1;
    if (units + cost > maximumUnits) break;
    units += cost;
    index += point.length;
  }
  return value.substr(0, index);
}

std::string lowerHex8(std::uint32_t value) {
  char buffer[16];
  std::snprintf(buffer, sizeof(buffer), "%08x", value);
  return std::string(buffer);
}

bool isSynthTrack(const std::optional<std::string>& kind) {
  return isSynthTrackKind(kind.has_value() ? *kind : std::string());
}

struct Target {
  std::string id;
  Role role;
  std::string name;
  bool custom;
};

}  // namespace

DrumLane drumLane(const Pattern& pattern, Role role) {
  const std::optional<DrumLane>& configured = pattern.drumLanes.at(role);
  if (pattern.hasDrumLanes && configured.has_value()) return *configured;
  DrumLane lane;
  lane.name = defaultName(role);
  lane.visible = true;
  lane.generationRole = JsValue::ofString(roleName(role));
  return lane;
}

std::string routedId(const std::string& id, const std::string& lane) {
  std::uint32_t hash = 2166136261u;
  std::size_t index = 0;
  while (index < id.size()) {
    const CodePoint point = decode(id, index);
    const std::uint32_t unit =
        point.astral ? 0xD800u + ((point.value - 0x10000u) >> 10) : point.value;
    hash = (hash ^ unit) * 16777619u;
    index += point.length;
  }
  return lane + "-" + utf16Slice(id, 60) + "-" + lowerHex8(hash);
}

std::set<std::string> admittedHits(const Pattern& generated, const UserTrack& track) {
  std::vector<const Hit*> anchors;
  std::vector<const Hit*> optional;
  for (const Hit& hit : generated.events) {
    if (hit.hasTrackId() || !track.generationRole.equalsRole(hit.role)) continue;
    if (hit.anchor) {
      anchors.push_back(&hit);
    } else {
      optional.push_back(&hit);
    }
  }

  const double density = jsNumberOr(track.generationDensity, 1.0);
  const double probability = jsNumberOr(track.generationProbability, 1.0);

  std::vector<const Hit*> ranked;
  if (density < 1.0) {
    struct Scored {
      const Hit* hit;
      double score;
    };
    std::vector<Scored> scored;
    scored.reserve(optional.size());
    for (const Hit* hit : optional) {
      const double gain = jsNumber(hit->gain);
      const double ghost = hit->ghost ? 0.35 : 0.0;
      const std::string stream = "track-density:" + track.id + ":" + hit->id;
      scored.push_back({hit, gain - ghost + random(generated.settings.seed, stream)() * 0.15});
    }
    std::stable_sort(scored.begin(), scored.end(), [](const Scored& a, const Scored& b) {
      const double scoreDelta = b.score - a.score;
      if (scoreDelta != 0.0 && scoreDelta == scoreDelta) return scoreDelta < 0.0;
      const double tickDelta = a.hit->baseTick - b.hit->baseTick;
      if (tickDelta != 0.0 && tickDelta == tickDelta) return tickDelta < 0.0;
      return a.hit->id < b.hit->id;
    });
    const double keep = std::floor(static_cast<double>(optional.size()) * density + 0.5);
    for (std::size_t index = 0; index < scored.size(); ++index) {
      if (static_cast<double>(index) >= keep) break;
      ranked.push_back(scored[index].hit);
    }
  } else {
    ranked = optional;
  }

  std::set<std::string> admitted;
  for (const Hit* hit : anchors) admitted.insert(hit->id);
  for (const Hit* hit : ranked) {
    if (probability >= 1.0) {
      admitted.insert(hit->id);
      continue;
    }
    const std::string variation = jsNumberToString(jsNumberOr(generated.settings.variation, 0.0));
    const std::string stream = "track-chance:" + track.id + ":" + variation + ":" + hit->id;
    if (random(generated.settings.seed, stream)() < probability) admitted.insert(hit->id);
  }
  return admitted;
}

Pattern routeGeneratedDrums(const Pattern& generated, const Pattern& layout) {
  bool layoutRole = false;
  for (const UserTrack& track : layout.userTracks) {
    if (!isSynthTrack(track.kind) && track.generationRole.truthy()) {
      layoutRole = true;
      break;
    }
  }
  if (!layout.hasDrumLanes && !layoutRole) return generated;

  std::vector<std::vector<Target>> targets(static_cast<std::size_t>(kRoleCount));
  for (int index = 0; index < kRoleCount; ++index) {
    const Role role = static_cast<Role>(index);
    for (int laneIndex = 0; laneIndex < kRoleCount; ++laneIndex) {
      const Role lane = static_cast<Role>(laneIndex);
      const DrumLane config = drumLane(layout, lane);
      if (!config.visible || !config.generationRole.equalsRole(role)) continue;
      targets[static_cast<std::size_t>(index)].push_back(
          {std::string(roleName(lane)), lane, config.name, false});
    }
    for (const UserTrack& track : layout.userTracks) {
      if (isSynthTrack(track.kind) || !track.generationRole.equalsRole(role)) continue;
      targets[static_cast<std::size_t>(index)].push_back({track.id, track.role, track.name, true});
    }
  }

  bool unmapped = false;
  for (const Hit& hit : generated.events) {
    if (!hit.hasTrackId()) {
      unmapped = true;
      break;
    }
  }
  bool anyTarget = false;
  for (const std::vector<Target>& list : targets) {
    if (!list.empty()) {
      anyTarget = true;
      break;
    }
  }
  if (unmapped && !anyTarget) {
    throw JsError(
        "Assign a generation role to at least one drum or sample track before generating a beat.");
  }

  std::map<std::string, std::set<std::string>> admitted;
  for (const UserTrack& track : layout.userTracks) {
    if (isSynthTrack(track.kind) || !track.generationRole.truthy()) continue;
    admitted[track.id] = admittedHits(generated, track);
  }

  std::vector<Hit> events;
  for (const Hit& hit : generated.events) {
    if (hit.hasTrackId()) {
      events.push_back(hit);
      continue;
    }
    for (const Target& lane : targets[static_cast<std::size_t>(hit.role)]) {
      if (lane.custom) {
        const std::map<std::string, std::set<std::string>>::const_iterator found =
            admitted.find(lane.id);
        if (found == admitted.end() || found->second.find(hit.id) == found->second.end()) continue;
      }
      Hit next = hit;
      if (lane.custom || lane.role != hit.role) next.id = routedId(hit.id, lane.id);
      next.role = lane.role;
      next.sourceId = "kit." + std::string(roleName(lane.role));
      if (lane.custom) {
        next.trackId = lane.id;
        next.generatedDrumRole = JsValue::ofString(roleName(hit.role));
      }
      next.reason = hit.reason + " Routed to " + lane.name + ".";
      events.push_back(next);
    }
  }

  Pattern result = generated;
  result.hasDrumLanes = layout.hasDrumLanes;
  result.drumLanes = layout.drumLanes;
  result.events = events;
  return result;
}

}  // namespace bbpm::core