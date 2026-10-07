#include "ReverseProbability.h"

#include <string>

#include "Model.h"
#include "Random.h"

namespace bbpm::core {

void applyReverseProbability(std::vector<Hit>& hits, const Settings& settings) {
  const double probability = jsNumberOr(settings.reverseProbability, 0.0);
  // `if (probability <= 0) return;` - NaN intentionally falls through, as in JS.
  if (probability <= 0.0) return;
  const std::string variation = jsNumberToString(jsNumberOr(settings.variation, 0.0));
  const std::string engine =
      settings.algorithm.has_value() ? *settings.algorithm : std::string("legacy-v1");
  for (Hit& hit : hits) {
    if (hit.synthNote.truthy()) continue;
    const std::string stream = "reverse-note:" + engine + ":" + variation + ":" + hit.id;
    if (random(settings.seed, stream)() < probability) hit.reverse = JsValue::ofBool(true);
  }
}

}  // namespace bbpm::core