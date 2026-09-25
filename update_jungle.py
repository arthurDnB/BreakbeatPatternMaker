with open('src/core/groove-v3-profiles.ts', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace(
    "  jungle:rule('jungle',{snareMotifs:[[4,12],[4,10]],kicks:[[0,6,10],[0,8,11],[0,7,10]],ghosts:[3,7,9,11,15]}),",
    "  jungle:rule('jungle',{snareMotifs:[[4,12],[4,10],[4,10,14]],kicks:[[0,10],[0,6,10],[0,7,10]],hats:[0,2,6,8,10,14],hatDetails:[1,5,9,13],ghosts:[3,7,9,11,14,15],percussion:[5,13],pickups:[7,14],activity:.85,ghostGain:.38,fillStrength:.85,burstBudget:3,maxRepeats:6,reverseChance:.15,pitchSteps:[0,0,7,-2]}),"
)

with open('src/core/groove-v3-profiles.ts', 'w', encoding='utf-8') as f:
    f.write(text)
