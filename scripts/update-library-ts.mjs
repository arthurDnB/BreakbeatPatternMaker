import fs from 'node:fs';

const catalog = JSON.parse(fs.readFileSync('public/samples/catalog.json', 'utf8'));

const libraryEntries = catalog.map(s => ({
  id: s.id,
  role: s.role,
  name: s.name,
  path: s.path
}));

const currentCode = fs.readFileSync('src/audio/library.ts', 'utf8');

// Find where KIT_PRESETS begins
const kitPresetIndex = currentCode.indexOf('export interface KitPreset');
if (kitPresetIndex === -1) throw new Error('Could not find KitPreset in library.ts');

const restOfFile = currentCode.slice(kitPresetIndex);

// Add UDNB presets to KIT_PRESETS
const udnbPresets = `  {
    id: 'udnb-signature',
    name: '🔥 UDNB Signature Drum Kit (Personal)',
    description: 'Personal collection: punchy UDNB Kick 01, crisp UDNB Snare 01, snappy Hat 01, and dynamic Perc 01',
    slots: {
      kick: 'udnb-kick-01',
      snare: 'udnb-snare-01',
      hat: 'udnb-hat-01',
      percussion: 'udnb-perc-01',
    },
    levels: {snare: 0.88, percussion: 0.75},
    decays: {snare: 0.88, percussion: 0.80},
  },
  {
    id: 'udnb-heavy-roller',
    name: '⚡ UDNB Heavy Roller (Personal)',
    description: 'Personal collection: deep UDNB Kick 08, hard UDNB Snare 07, tight Hat 14, and metallic Perc 25',
    slots: {
      kick: 'udnb-kick-08',
      snare: 'udnb-snare-07',
      hat: 'udnb-hat-14',
      percussion: 'udnb-perc-25',
    },
    levels: {snare: 0.85, percussion: 0.72},
    decays: {snare: 0.85, percussion: 0.75},
  },
`;

let updatedRest = restOfFile;
if (!updatedRest.includes('udnb-signature')) {
  updatedRest = updatedRest.replace('export const KIT_PRESETS: KitPreset[] = [\n', 'export const KIT_PRESETS: KitPreset[] = [\n' + udnbPresets);
}

const newLibraryTs = `export const LIBRARY = ${JSON.stringify(libraryEntries, null, 2)} as const;\n\n${updatedRest}`;

fs.writeFileSync('src/audio/library.ts', newLibraryTs, 'utf8');
console.log(`Updated src/audio/library.ts with ${libraryEntries.length} samples.`);
