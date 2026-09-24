import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const existingCatalog = JSON.parse(fs.readFileSync('public/samples/catalog.json', 'utf8'));

// Filter out any previous udnb entries in case script is re-run
const baseCatalog = existingCatalog.filter(s => !s.id.startsWith('udnb-'));

const categories = [
  { folder: 'Kicks', prefix: 'UDNB_kick', role: 'kick', idPrefix: 'udnb-kick', namePrefix: 'UDNB Kick' },
  { folder: 'Snares', prefix: 'UDNB_snare', role: 'snare', idPrefix: 'udnb-snare', namePrefix: 'UDNB Snare' },
  { folder: 'Hats', prefix: 'UDNB_hats', role: 'hat', idPrefix: 'udnb-hat', namePrefix: 'UDNB Hi-Hat' },
  { folder: 'Percs', prefix: 'UDNB_perc', role: 'percussion', idPrefix: 'udnb-perc', namePrefix: 'UDNB Percussion' },
];

const newEntries = [];

for (const cat of categories) {
  const dir = path.join('Drums', cat.folder);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.wav')).sort();
  for (const file of files) {
    const numMatch = file.match(/\d+/);
    if (!numMatch) continue;
    const num = numMatch[0];
    const id = `${cat.idPrefix}-${num}`;
    const name = `${cat.namePrefix} ${num}`;
    const targetFile = `${id}.wav`;
    const targetPath = path.join('public/samples', targetFile);
    
    // Copy the file
    const srcBytes = fs.readFileSync(path.join(dir, file));
    fs.writeFileSync(targetPath, srcBytes);
    
    const hash = crypto.createHash('sha256').update(srcBytes).digest('hex');
    newEntries.push({
      id,
      role: cat.role,
      name,
      path: `/public/samples/${targetFile}`,
      license: 'CC0-1.0',
      author: 'arthurDnB (Personal collection)',
      source: `Drums/${cat.folder}/${file}`,
      sha256: hash
    });
  }
}

const fullCatalog = [...baseCatalog, ...newEntries];
fs.writeFileSync('public/samples/catalog.json', JSON.stringify(fullCatalog, null, 2));

console.log(`Successfully added ${newEntries.length} UDNB samples. Total catalog size: ${fullCatalog.length}`);
