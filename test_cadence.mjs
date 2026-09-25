
import {v3Chance} from './dist/core/groove-v3-chance.js';
import {genreDefaults} from './dist/core/profiles.js';
const s = {...genreDefaults('amenscience'), algorithm: 'groove-v3', phraseLength: 16, phraseOffset: 12};
console.log('amenscience chance:', v3Chance(s, 'cadence-enabled', '15'));
