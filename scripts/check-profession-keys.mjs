import { readFileSync } from 'fs';

const svc = readFileSync('src/app/data/serviceProfessions.ts', 'utf8');
const vis = readFileSync('src/app/data/professionVisualsData.ts', 'utf8');

const profNames = [];
for (const m of svc.matchAll(/professions:\s*\[([\s\S]*?)\]/g)) {
  for (const q of m[1].matchAll(/'([^']+)'/g)) profNames.push(q[1]);
  for (const q of m[1].matchAll(/"([^"]+)"/g)) profNames.push(q[1]);
}

const keys = [...vis.matchAll(/^\s+'((?:\\'|[^'])+)':/gm)].map((m) => m[1].replace(/\\'/g, "'"));

const missing = profNames.filter((n) => !keys.includes(n));
const extra = keys.filter((k) => k !== 'Boshqa' && !profNames.includes(k));

console.log('profNames', profNames.length);
console.log('visual keys', keys.length);
console.log('missing', missing.length, missing);
console.log('extra', extra.length, extra);
