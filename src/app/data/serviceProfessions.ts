import { PROFESSION_VISUALS } from './professionVisualsData';

export const PROFESSION_OTHER = 'Boshqa';

export type ProfessionCategory = {
  id: string;
  label: string;
  professions: readonly string[];
};

/** Dunyo bo‘ylab keng tarqalgan kasblar — guruhlar bo‘yicha */
export const PROFESSION_CATEGORIES: readonly ProfessionCategory[] = [
  {
    id: 'construction',
    label: "Qurilish va ta'mirlash",
    professions: [
      'Santexnik',
      'Elektrik',
      'Gazchi',
      'Konditsioner ustasi',
      'Isitish tizimi ustasi',
      "Usta (ta'mirlash)",
      "Bo'yoqchi",
      'Duradgor',
      'Temirchi',
      'Payvandchi',
      'Plitka ustasi',
      'Shifta ustasi',
      'Gipsokarton ustasi',
      'Deraza va eshik o‘rnatuvchi',
      'Mebel yig‘uvchi',
      'Mebel ustasi',
      'Zamin (laminat/parket) ustasi',
      'Fasad ustasi',
      'Tom ustasi',
      'Beton va armatura ustasi',
      'Qurilish muhandisi',
      'Arxitektor',
      'Loyiha menejeri (qurilish)',
      'Geodezist',
      'Exkavator operatori',
      'Kran operatori',
      'Boshqa qurilish mutaxassisi',
    ],
  },
  {
    id: 'home',
    label: 'Uy va maishiy xizmatlar',
    professions: [
      'Tozalovchi',
      "Bog'bon",
      'Landshaft dizayneri',
      'Chilangar',
      'Kiyim yuvish xizmati',
      'Uy buyumlari ta’miri',
      'Maishiy texnika ustasi',
      'Televizor ustasi',
      'Kir yuvish mashinasi ustasi',
      'Muzlatgich ustasi',
      'Changyutgich ustasi',
      'Uy hayvonlari parvarishi',
      'Uy hayvonlari tarbiyachisi',
      'Nanny / enaga',
      'Qariyalar parvarishi',
      'Uy-joy menejeri',
      'Xovliqchi / qo‘riqchi',
      'Boshqa uy xizmati',
    ],
  },
  {
    id: 'beauty',
    label: "Go'zallik va salomatlik",
    professions: [
      'Sartarosh / barber',
      'Stilist',
      'Kosmetolog',
      'Vizajist',
      'Manikyur / pedikyur ustasi',
      'Massajist',
      'Spa mutaxassisi',
      'Tatu master',
      'Piercing master',
      'Terapevt',
      'Stomatolog',
      'Hamshira',
      'Laborant',
      'Farmatsevt',
      'Optometrist',
      'Fizioterapevt',
      'Psixolog',
      'Nutritionist / dietolog',
      'Fitness trener',
      'Yoga instruktori',
      'Boshqa salomatlik mutaxassisi',
    ],
  },
  {
    id: 'transport',
    label: 'Transport va logistika',
    professions: [
      'Haydovchi',
      'Taksi haydovchisi',
      'Yuk tashuvchi haydovchi',
      'Avtobus haydovchisi',
      'Kuryer',
      'Logist',
      'Ekspeditor',
      'Avtomexanik',
      'Avtoelektrik',
      'Avtoyuvuvchi',
      'Avto deteyling ustasi',
      'Velosiped / skuter ta’miri',
      'Boshqa transport xizmati',
    ],
  },
  {
    id: 'food',
    label: 'Oziq-ovqat va restoran',
    professions: [
      'Oshpaz',
      'Konditer',
      'Pishiriqchi',
      'Barista',
      'Barmen',
      'Ofitsiant',
      'Restoran menejeri',
      'Oshxona yordamchisi',
      'Food stylist',
      'Catering mutaxassisi',
      'Boshqa oziq-ovqat xizmati',
    ],
  },
  {
    id: 'it',
    label: 'IT va texnologiya',
    professions: [
      'Dasturchi (Frontend)',
      'Dasturchi (Backend)',
      'Dasturchi (Full-stack)',
      'Mobile dasturchi',
      'DevOps muhandisi',
      'Sistem administratori',
      'Kiberxavfsizlik mutaxassisi',
      'Ma’lumotlar tahlilchisi (Data analyst)',
      'Data scientist',
      'Sun’iy intellekt muhandisi',
      'QA / test muhandisi',
      'Product manager (IT)',
      'UI/UX dizayner',
      'Technical writer',
      'IT qo‘llab-quvvatlash (Helpdesk)',
      'Telekommunikatsiya muhandisi',
      'Elektronika muhandisi',
      'Robototexnika muhandisi',
      'Boshqa IT mutaxassisi',
    ],
  },
  {
    id: 'design_media',
    label: 'Dizayn va media',
    professions: [
      'Grafik dizayner',
      'Brend dizayneri',
      'Interyer dizayneri',
      'Moda dizayneri',
      'Fotograf',
      'Videograf',
      'Montajchi (video)',
      'Animator',
      'Illustrator',
      'SMM mutaxassisi',
      'Kontent menejeri',
      'Copywriter',
      'Jurnalist',
      'Muxbir',
      'Ovoz rejissyori',
      'Musiqachi',
      'DJ',
      'Aktyor / aktrisa',
      'Rejissyor',
      'Boshqa media mutaxassisi',
    ],
  },
  {
    id: 'education',
    label: "Ta'lim va ilm",
    professions: [
      "O'qituvchi (maktab)",
      "O'qituvchi (universitet)",
      'Repetitor',
      'Til o‘qituvchisi',
      'Tarjimon',
      'Simultane tarjimon',
      'Tadqiqotchi',
      'Ilmiy xodim',
      'Kutubxonachi',
      'Maktabgacha tarbiyachi',
      'Logoped',
      'Defektolog',
      'Boshqa ta’lim mutaxassisi',
    ],
  },
  {
    id: 'business',
    label: 'Biznes va moliya',
    professions: [
      'Buxgalter',
      'Moliyachi',
      'Auditor',
      'Bank xodimi',
      'Sug‘urta agenti',
      'HR menejeri',
      'Rekruter',
      'Biznes konsultant',
      'Marketing menejeri',
      'Sotuv menejeri',
      'Mijozlar bilan ishlash menejeri',
      'Loyiha menejeri',
      'Operatsion menejeri',
      'CEO / direktor',
      'Yurist',
      'Advokat',
      'Notarius yordamchisi',
      'Boshqa biznes mutaxassisi',
    ],
  },
  {
    id: 'agriculture',
    label: "Qishloq xo'jaligi",
    professions: [
      'Fermer',
      'Agronom',
      'Veterinar',
      'Hayvon parvarishi',
      'Asalarichi',
      'Issiqxona mutaxassisi',
      'Traktorist',
      'Qishloq xo‘jaligi texnikasi ustasi',
      'Boshqa qishloq xo‘jaligi mutaxassisi',
    ],
  },
  {
    id: 'industry',
    label: 'Ishlab chiqarish va sanoat',
    professions: [
      'Tokar',
      'Frezerchi',
      'CNC operatori',
      'Sifat nazoratchisi (QC)',
      'Ishlab chiqarish muhandisi',
      'Mexanik muhandis',
      'Kimyo muhandisi',
      'Energiya muhandisi',
      'Neft va gaz mutaxassisi',
      'Konchi',
      'Zavod operatori',
      'Ombor xodimi',
      'Yuklovchi',
      'Boshqa sanoat mutaxassisi',
    ],
  },
  {
    id: 'trade',
    label: 'Savdo va xizmat',
    professions: [
      'Sotuvchi',
      'Kassir',
      'Merchandayzer',
      'Do‘kon menejeri',
      'Franshiza menejeri',
      'Ko‘chma savdo vakili',
      'Xo‘jalik menejeri',
      'Mehmonxona xodimi',
      'Resepsionist',
      'Tur gid',
      'Travel agent',
      'Agentlik xodimi',
      'Xavfsizlik xodimi',
      'Yo‘riqchi / qo‘riqchi',
      'Boshqa savdo xizmati',
    ],
  },
  {
    id: 'arts',
    label: "San'at va ko'ngilochar",
    professions: [
      'Rassom',
      'Haykaltarosh',
      'Kulol',
      'Zargar',
      'Soat ustasi',
      'Antiqvar mutaxassisi',
      'Event planner',
      'To‘y tashkilotchisi',
      'Dekorator',
      'Florist',
      'Boshqa san’at ustasi',
    ],
  },
  {
    id: 'public',
    label: 'Davlat va jamoat',
    professions: [
      'Huquqni muhofaza qilish xodimi',
      'Yong‘in xavfsizligi xodimi',
      'Tez tibbiy yordam xodimi',
      'Ijtimoiy xodim',
      'Municipal xodim',
      'Boshqa davlat xizmatchisi',
    ],
  },
] as const;

export const ALL_PROFESSIONS: string[] = Array.from(
  new Set(PROFESSION_CATEGORIES.flatMap((c) => [...c.professions])),
).sort((a, b) => a.localeCompare(b, 'uz'));

export const ALL_PROFESSIONS_WITH_OTHER: string[] = [...ALL_PROFESSIONS, PROFESSION_OTHER];

export function isKnownProfession(value: string): boolean {
  return ALL_PROFESSIONS.includes(value);
}

export function resolveProfessionForForm(storedProfession?: string): {
  profession: string;
  customProfession: string;
} {
  const raw = String(storedProfession || '').trim();
  if (!raw) return { profession: '', customProfession: '' };
  if (raw === PROFESSION_OTHER || isKnownProfession(raw)) {
    return { profession: raw, customProfession: '' };
  }
  return { profession: PROFESSION_OTHER, customProfession: raw };
}

export function filterProfessionCategories(query: string): ProfessionCategory[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...PROFESSION_CATEGORIES];
  return PROFESSION_CATEGORIES.map((cat) => ({
    ...cat,
    professions: cat.professions.filter((p) => p.toLowerCase().includes(q)),
  })).filter((cat) => cat.professions.length > 0);
}

export function countFilteredProfessions(query: string): number {
  return filterProfessionCategories(query).reduce((n, c) => n + c.professions.length, 0);
}

const CATEGORY_EMOJIS: Record<string, string> = {
  construction: '🔧',
  home: '🏠',
  beauty: '💄',
  transport: '🚗',
  food: '👨‍🍳',
  it: '💻',
  design_media: '🎨',
  education: '📚',
  business: '💼',
  agriculture: '🌾',
  industry: '🏭',
  trade: '🛒',
  arts: '🎭',
  public: '🏛️',
};

/** Maxsus yuqori sifatli rasmlar (R2) */
const PREMIUM_PROFESSION_IMAGES: Partial<Record<string, string>> = {
  Haydovchi:
    'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/Gemini_Generated_Image_6q15fn6q15fn6q15.png',
  Oshpaz:
    'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/Gemini_Generated_Image_xckco8xckco8xckc.png',
  Konditer:
    'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/Gemini_Generated_Image_x2ys40x2ys40x2ys.png',
  Kosmetolog:
    'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/Gemini_Generated_Image_tga32jtga32jtga3.png',
  'Sartarosh / barber':
    'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/5deeecfdf112f9ff386ca4e5f411cade.jpg',
  Massajist:
    'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/7203.jpg',
  Fotograf:
    'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/photographer-man-taking-photos-village_53876-121297.avif',
  Videograf:
    'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/filming-in-action-stockcake.webp',
};

export type ProfessionGridItem = {
  id: string;
  name: string;
  categoryId: string;
  categoryLabel: string;
  emoji: string;
  image?: string;
};

function professionSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'kasb'
  );
}

export function getProfessionVisual(name: string, categoryId: string) {
  const visual = PROFESSION_VISUALS[name];
  const premiumImage = PREMIUM_PROFESSION_IMAGES[name];
  return {
    emoji: visual?.icon ?? CATEGORY_EMOJIS[categoryId] ?? '👷',
    image: premiumImage ?? visual?.image,
  };
}

export function getProfessionGridItems(): ProfessionGridItem[] {
  const items = PROFESSION_CATEGORIES.flatMap((cat) =>
    cat.professions.map((name) => {
      const visual = getProfessionVisual(name, cat.id);
      return {
        id: professionSlug(name),
        name,
        categoryId: cat.id,
        categoryLabel: cat.label,
        emoji: visual.emoji,
        image: visual.image,
      };
    }),
  );
  const otherVisual = PROFESSION_VISUALS[PROFESSION_OTHER];
  items.push({
    id: 'boshqa',
    name: PROFESSION_OTHER,
    categoryId: 'other',
    categoryLabel: 'Boshqa',
    emoji: otherVisual?.icon ?? '⭐',
    image: otherVisual?.image,
  });
  return items;
}

export function filterProfessionGridCategories(query: string): Array<ProfessionCategory & { items: ProfessionGridItem[] }> {
  const q = query.trim().toLowerCase();
  const allItems = getProfessionGridItems();
  const byName = new Map(allItems.map((i) => [i.name, i]));

  const source = q
    ? filterProfessionCategories(query)
    : [...PROFESSION_CATEGORIES, { id: 'other', label: 'Boshqa', professions: [PROFESSION_OTHER] as readonly string[] }];

  return source
    .map((cat) => ({
      ...cat,
      items: cat.professions
        .map((name) => byName.get(name))
        .filter((item): item is ProfessionGridItem => Boolean(item)),
    }))
    .filter((cat) => cat.items.length > 0);
}
