export const LIBRARY = [
  {
    "id": "acoustic-kick",
    "role": "kick",
    "name": "Acoustic bass drum",
    "path": "/public/samples/acoustic-kick.wav"
  },
  {
    "id": "acoustic-snare",
    "role": "snare",
    "name": "Acoustic snare — firm",
    "path": "/public/samples/acoustic-snare.wav"
  },
  {
    "id": "acoustic-snare-soft",
    "role": "snare",
    "name": "Acoustic snare — soft",
    "path": "/public/samples/acoustic-snare-soft.wav"
  },
  {
    "id": "acoustic-hat",
    "role": "hat",
    "name": "Acoustic closed hat",
    "path": "/public/samples/acoustic-hat.wav"
  },
  {
    "id": "bongo",
    "role": "percussion",
    "name": "Acoustic high bongo",
    "path": "/public/samples/bongo.wav"
  },
  {
    "id": "tambourine",
    "role": "percussion",
    "name": "Tambourine hit",
    "path": "/public/samples/tambourine.wav"
  },
  {
    "id": "808-kick",
    "role": "kick",
    "name": "808 kick — round",
    "path": "/public/samples/808-kick.wav"
  },
  {
    "id": "808-kick-long",
    "role": "kick",
    "name": "808 kick — long",
    "path": "/public/samples/808-kick-long.wav"
  },
  {
    "id": "808-snare",
    "role": "snare",
    "name": "808 snare",
    "path": "/public/samples/808-snare.wav"
  },
  {
    "id": "808-hat",
    "role": "hat",
    "name": "808 closed hat",
    "path": "/public/samples/808-hat.wav"
  },
  {
    "id": "808-openhat",
    "role": "hat",
    "name": "808 open hat",
    "path": "/public/samples/808-openhat.wav"
  },
  {
    "id": "808-clap",
    "role": "percussion",
    "name": "808 clap",
    "path": "/public/samples/808-clap.wav"
  },
  {
    "id": "acoustic-kick-2",
    "role": "kick",
    "name": "Acoustic bass drum — hard strike",
    "path": "/public/samples/acoustic-kick-2.wav"
  },
  {
    "id": "acoustic-kick-muted",
    "role": "kick",
    "name": "Acoustic bass drum — muted",
    "path": "/public/samples/acoustic-kick-muted.wav"
  },
  {
    "id": "808-kick-00",
    "role": "kick",
    "name": "808 kick — tone 0 / decay 0",
    "path": "/public/samples/808-kick-00.wav"
  },
  {
    "id": "808-kick-75",
    "role": "kick",
    "name": "808 kick — tone 75 / decay 75",
    "path": "/public/samples/808-kick-75.wav"
  },
  {
    "id": "acoustic-rimshot",
    "role": "snare",
    "name": "Acoustic snare — rimshot",
    "path": "/public/samples/acoustic-rimshot.wav"
  },
  {
    "id": "marching-snare",
    "role": "snare",
    "name": "Marching snare",
    "path": "/public/samples/marching-snare.wav"
  },
  {
    "id": "808-snare-00",
    "role": "snare",
    "name": "808 snare — tone 0 / snappy 0",
    "path": "/public/samples/808-snare-00.wav"
  },
  {
    "id": "808-snare-75",
    "role": "snare",
    "name": "808 snare — tone 75 / snappy 75",
    "path": "/public/samples/808-snare-75.wav"
  },
  {
    "id": "acoustic-openhat",
    "role": "hat",
    "name": "Acoustic open hat",
    "path": "/public/samples/acoustic-openhat.wav"
  },
  {
    "id": "acoustic-loosehat",
    "role": "hat",
    "name": "Acoustic loose hat",
    "path": "/public/samples/acoustic-loosehat.wav"
  },
  {
    "id": "acoustic-pedalhat",
    "role": "hat",
    "name": "Acoustic pedal hat",
    "path": "/public/samples/acoustic-pedalhat.wav"
  },
  {
    "id": "808-openhat-short",
    "role": "hat",
    "name": "808 open hat — decay 0",
    "path": "/public/samples/808-openhat-short.wav"
  },
  {
    "id": "808-cowbell",
    "role": "percussion",
    "name": "808 cowbell",
    "path": "/public/samples/808-cowbell.wav"
  },
  {
    "id": "808-rim",
    "role": "percussion",
    "name": "808 rim shot",
    "path": "/public/samples/808-rim.wav"
  },
  {
    "id": "808-maracas",
    "role": "percussion",
    "name": "808 maracas",
    "path": "/public/samples/808-maracas.wav"
  },
  {
    "id": "808-lowtom",
    "role": "percussion",
    "name": "808 low tom",
    "path": "/public/samples/808-lowtom.wav"
  },
  {
    "id": "808-hightom",
    "role": "percussion",
    "name": "808 high tom",
    "path": "/public/samples/808-hightom.wav"
  },
  {
    "id": "808-conga",
    "role": "percussion",
    "name": "808 low conga",
    "path": "/public/samples/808-conga.wav"
  },
  {
    "id": "acoustic-claves",
    "role": "percussion",
    "name": "Acoustic claves",
    "path": "/public/samples/acoustic-claves.wav"
  },
  {
    "id": "acoustic-shaker",
    "role": "percussion",
    "name": "Acoustic shaker",
    "path": "/public/samples/acoustic-shaker.wav"
  }
] as const;

export interface KitPreset {
  id: string;
  name: string;
  description: string;
  slots: Record<'kick'|'snare'|'hat'|'percussion', string>;
}

export const KIT_PRESETS: KitPreset[] = [
  {
    id: 'acoustic-break',
    name: '🥁 Acoustic Break (Jungle / DnB / Breaks)',
    description: 'Punchy acoustic kick, crisp rimshot crack, tight hat, rolling shaker',
    slots: {
      kick: 'acoustic-kick-2',
      snare: 'acoustic-rimshot',
      hat: 'acoustic-hat',
      percussion: 'acoustic-shaker',
    }
  },
  {
    id: 'trap-808',
    name: '🎛️ 808 Trap & Sub (Trap / Drill / Hip-Hop)',
    description: 'Deep 808 long sub kick, snappy 808 snare, 808 hat, 808 clap',
    slots: {
      kick: '808-kick-long',
      snare: '808-snare-75',
      hat: '808-hat',
      percussion: '808-clap',
    }
  },
  {
    id: 'electronic-dance',
    name: '⚡ Electronic & Big Beat (Electro / Big Beat / House)',
    description: 'Punchy 808-75 kick, crisp 808-75 snare, open hat, 808 clap',
    slots: {
      kick: '808-kick-75',
      snare: '808-snare-75',
      hat: '808-openhat-short',
      percussion: '808-clap',
    }
  },
  {
    id: 'hardcore-rave',
    name: '💥 Hardcore Rave (Breakcore / Gabber)',
    description: 'Raw punchy 808 kick, rapid-fire marching snare, loose hat, rim click',
    slots: {
      kick: '808-kick-00',
      snare: 'marching-snare',
      hat: 'acoustic-loosehat',
      percussion: '808-rim',
    }
  },
  {
    id: 'lofi-soul',
    name: '🍂 Lo-Fi Soul & BoomBap (Chill / Hip-Hop)',
    description: 'Warm acoustic kick-2, tight rimshot crack, pedal hat, shaker',
    slots: {
      kick: 'acoustic-kick-2',
      snare: 'acoustic-rimshot',
      hat: 'acoustic-pedalhat',
      percussion: 'acoustic-shaker',
    }
  },
  {
    id: 'uk-garage',
    name: '🏙️ UK Garage & 2-Step (Garage / Dubstep)',
    description: 'Punchy acoustic kick, crisp firm snare, short open hat, 808 rim',
    slots: {
      kick: 'acoustic-kick-2',
      snare: 'acoustic-snare',
      hat: '808-openhat-short',
      percussion: '808-rim',
    }
  },
];

export const GENRE_KITS: Record<string, string> = {
  jungle: 'acoustic-break',
  dnb: 'acoustic-break',
  raggajungle: 'acoustic-break',
  atmosphericjungle: 'acoustic-break',
  footworkjungle: 'acoustic-break',
  breaks: 'acoustic-break',
  trap: 'trap-808',
  drill: 'trap-808',
  rap: 'trap-808',
  hiphop: 'lofi-soul',
  breakcore: 'hardcore-rave',
  hardcore: 'hardcore-rave',
  breakbeathardcore: 'hardcore-rave',
  idm: 'lofi-soul',
  experimental: 'lofi-soul',
  bigbeat: 'electronic-dance',
  electrobreaks: 'electronic-dance',
  nuskoolbreaks: 'electronic-dance',
  garage: 'uk-garage',
  dubstep: 'uk-garage',
  two_step: 'uk-garage',
};
