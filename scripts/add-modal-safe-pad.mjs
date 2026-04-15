/**
 * fixed inset-0 overlaylarga app-safe-pad — Telegram / notch ostida qolmasin.
 * allaqachon app-safe-pad | app-safe-pt bo‘lsa o‘zgartirmaydi.
 */
import fs from 'fs';
import path from 'path';

const SKIP = new Set(['src/app/AppContent.tsx', 'src/app/components/Checkout-backup.tsx']);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist') continue;
      walk(p, out);
    } else if (e.name.endsWith('.tsx')) out.push(p);
  }
  return out;
}

const srcRoot = path.join(process.cwd(), 'src');
const files = walk(srcRoot);
let changedFiles = 0;
let changedLines = 0;

for (const fp of files) {
  const rel = path.relative(process.cwd(), fp).replace(/\\/g, '/');
  if (SKIP.has(rel)) continue;

  let text = fs.readFileSync(fp, 'utf8');
  const lines = text.split('\n');
  let fileHit = false;

  const next = lines.map((line) => {
    if (!line.includes('fixed inset-0')) return line;
    if (line.includes('app-safe-pad') || line.includes('app-safe-pt')) return line;
    // className / classList bo‘lmagan (izoh, string) — ehtiyotkorlik
    if (!line.includes('className')) return line;

    const replaced = line.replace(/\bfixed inset-0\b/g, 'fixed inset-0 app-safe-pad');
    if (replaced !== line) {
      fileHit = true;
      changedLines += (replaced.match(/fixed inset-0 app-safe-pad/g) || []).length;
    }
    return replaced;
  });

  if (fileHit) {
    fs.writeFileSync(fp, next.join('\n'), 'utf8');
    changedFiles += 1;
    console.log(rel);
  }
}

console.log(`\nDone: ${changedFiles} files, ~${changedLines} replacements.`);
