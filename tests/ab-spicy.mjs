import { generateGrooveV3 } from '../dist/core/groove-v3.js';

// Mock audio system to avoid Web Audio API issues in Node
global.AudioContext = class {
  constructor() {
    this.state = 'suspended';
    this.sampleRate = 44100;
  }
};
global.document = { createElement: () => ({ getContext: () => ({}) }) };

async function runTest() {
  const seed = 12345;
  const bpm = 174;
  const genre = 'liquiddnb';
  
  const config = {
    algorithm: 'groove-v3',
    genre,
    seed: '12345',
    bpm,
    bars: 4,
    resolution: 16,
    complexity: 0.5,
    syncopation: 0.5,
    swing: 0.5,
    humanizeMs: 0,
    ghostAmount: 0.5,
    fillAmount: 0.5
  };

  console.log(`Running A/B Test for Spicy Slider in Groove v3 - Genre: ${genre}`);

  const pattern15 = generateGrooveV3({ ...config, spicy: 0.15 });
  const pattern100 = generateGrooveV3({ ...config, spicy: 1.0 });

  console.log(`\n--- Pattern with 15% Spicy ---`);
  console.log(`Total Events: ${pattern15.events.length}`);
  const ratchets15 = pattern15.events.filter(e => e.ratchets > 1);
  console.log(`Ratchets/Rolls: ${ratchets15.length}`);
  const gates15 = pattern15.events.filter(e => e.gate && e.gate < 1.0);
  console.log(`Gate adjustments (micro-chops): ${gates15.length}`);

  console.log(`\n--- Pattern with 100% Spicy ---`);
  console.log(`Total Events: ${pattern100.events.length}`);
  const ratchets100 = pattern100.events.filter(e => e.ratchets > 1);
  console.log(`Ratchets/Rolls: ${ratchets100.length}`);
  const gates100 = pattern100.events.filter(e => e.gate && e.gate < 1.0);
  console.log(`Gate adjustments (micro-chops): ${gates100.length}`);

  // Let's print out what types of events are different
  const countRoles = (pattern) => {
      const counts = {};
      pattern.events.forEach(e => {
          counts[e.role] = (counts[e.role] || 0) + 1;
      });
      return counts;
  };
  
  console.log('\nRoles at 15%:', countRoles(pattern15));
  console.log('Roles at 100%:', countRoles(pattern100));
}

runTest().catch(console.error);
