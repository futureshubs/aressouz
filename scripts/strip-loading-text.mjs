import fs from 'node:fs'
import path from 'path'

const ROOT = path.join(process.cwd(), 'src')

const PHRASES = [
  'Mahsulotlar yuklanmoqda…',
  'Mahsulotlar yuklanmoqda...',
  'Rasm yuklanmoqda...',
  'Video yuklanmoqda...',
  'Chek yuklanmoqda...',
  'Kuryerlar yuklanmoqda...',
  'Auksionlar yuklanmoqda…',
  'Sharhlar yuklanmoqda...',
  'Sharhlar yuklanmoqda…',
  'Avtomobillar yuklanmoqda…',
  'Statistika yuklanmoqda...',
  'Analitika yuklanmoqda...',
  'Hisobotlar yuklanmoqda...',
  'Ishchilar yuklanmoqda...',
  'Rastalar yuklanmoqda...',
  'Sotuv va ombor tarixi yuklanmoqda…',
  "Statistika ma'lumotlari yuklanmoqda...",
  "Profil ma'lumotlari yuklanmoqda...",
  'Yutuqlar yuklanmoqda…',
  'Ishtirokchilar yuklanmoqda…',
  'Takliflar yuklanmoqda…',
  'Analitika yuklanmoqda…',
  'Banklar yuklanmoqda…',
  "3D ko'rinish yuklanmoqda...",
  'So‘mkalar yuklanmoqda...',
  'Filiallar ro‘yxati yuklanmoqda…',
  'Ustalar yuklanmoqda...',
  "To'lovlar yuklanmoqda...",
  'Suhbatlar yuklanmoqda...',
  'Xabarlar yuklanmoqda...',
  'Yuklanmoqda...',
  'Yuklanmoqda…',
  'Saqlanmoqda...',
  'Yuklanmoqda: ',
  'Kuryer panel yuklanmoqda...',
  'Manzil matni (ko‘cha, aholi punkti) yuklanmoqda…',
  'Xaritani siljiting — manzil yuklanmoqda…',
  'Support chat ochilmoqda…',
  'Kod yuklanmoqda…',
]

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.name === 'node_modules' || e.name === '.history') continue
    if (e.isDirectory()) walk(p, out)
    else if (/\.(tsx|ts|jsx|js)$/.test(e.name)) out.push(p)
  }
  return out
}

let n = 0
for (const file of walk(ROOT)) {
  let s = fs.readFileSync(file, 'utf8')
  const orig = s
  for (const ph of PHRASES) {
    s = s.split(ph).join('')
  }
  s = s.replace(/aria-label="Yuklanmoqda"/g, 'aria-hidden')
  s = s.replace(/<span className="sr-only">Yuklanmoqda<\/span>\s*/g, '')
  if (s !== orig) {
    fs.writeFileSync(file, s)
    n++
  }
}
console.log('updated files:', n)
