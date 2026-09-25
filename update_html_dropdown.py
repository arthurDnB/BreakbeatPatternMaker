import re

with open('public/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

replacement = """<label>Pattern structure<select id="patternStructure">
  <option value="auto" selected>Auto-Fills (Probability-based)</option>
  <option value="groove">Standard Groove (No fills)</option>
  <option value="fill">Beat + Fill Drop</option>
  <option value="roll">Beat + Snare Roll</option>
  <option value="build">100% Snare Roll Build-up</option>
</select></label>
<label>Fill amount <output id="fillAmount-val">"""

text = text.replace('<label>Fill amount <output id="fillAmount-val">', replacement)

with open('public/index.html', 'w', encoding='utf-8') as f:
    f.write(text)
