with open('src/core/profiles.ts', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    "jungle:{spicy:.35},dnb:{complexity:.5,ghostAmount:.25,fillAmount:.25,spicy:.25},",
    "jungle:{complexity:.85,syncopation:.8,ghostAmount:.75,fillAmount:.85,spicy:.8,resolution:32},dnb:{complexity:.5,ghostAmount:.25,fillAmount:.25,spicy:.25},"
)

with open('src/core/profiles.ts', 'w', encoding='utf-8') as f:
    f.write(text)
