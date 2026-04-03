export const MARKETING_DOC_SLUGS = [
  'privacy',
  'terms',
  'cookies',
  'about',
  'partnership',
  'careers',
] as const;

export type MarketingDocSlug = (typeof MARKETING_DOC_SLUGS)[number];

export function isValidMarketingSlug(s: string): s is MarketingDocSlug {
  return (MARKETING_DOC_SLUGS as readonly string[]).includes(s);
}

export type MarketingSection = { heading: string; paragraphs: string[] };

export type MarketingDoc = {
  title: string;
  intro?: string;
  sections: MarketingSection[];
  updated?: string;
};

const DOCS: Record<MarketingDocSlug, MarketingDoc> = {
  privacy: {
    title: 'Maxfiylik siyosati',
    intro:
      'Ushbu hujjat Aresso marketplace platformasida shaxsiy ma’lumotlaringiz qanday yig‘ilishi, ishlatilishi va himoyalanishini tushuntiradi.',
    updated: '2026',
    sections: [
      {
        heading: '1. Ma’lumotlar egasi',
        paragraphs: [
          'Platformadan foydalanish orqali siz ushbu siyosatga rozilik bildirasiz. Ma’lumotlarni qayta ishlash O‘zbekiston Respublikasining amaldagi qonunchiligiga muvofiq amalga oshiriladi.',
        ],
      },
      {
        heading: '2. Yig‘iladigan ma’lumotlar',
        paragraphs: [
          'Telefon raqami, ism, yetkazib berish manzili, buyurtma tarixi, to‘lov holati (to‘lov provayderlari orqali), qurilma va brauzer texnik ma’lumotlari, qo‘llab-quvvatlash chatidagi xabarlar.',
        ],
      },
      {
        heading: '3. Maqsad',
        paragraphs: [
          'Buyurtmalarni bajarish, yetkazib berish, mijozlarni qo‘llab-quvvatlash, firibgarlikning oldini olish, xizmat sifatini yaxshilash va qonuniy talablarga rioya qilish.',
        ],
      },
      {
        heading: '4. Uchinchi tomonlar',
        paragraphs: [
          'To‘lov, yetkazib berish va analitika uchun ishonchli hamkorlar ishtirok etishi mumkin. Ular faqat xizmat ko‘rsatish uchun zarur bo‘lgan hajmda ma’lumot oladi.',
        ],
      },
      {
        heading: '5. Saqlash muddati',
        paragraphs: [
          'Ma’lumotlar qonuniy yoki operatsion zarurat bo‘lgan muddatda saqlanadi, so‘ngra xavfsiz o‘chiriladi yoki anonimlashtiriladi.',
        ],
      },
      {
        heading: '6. Huquqlaringiz',
        paragraphs: [
          'O‘z ma’lumotlaringizga kirish, tuzatish yoki o‘chirishni so‘rash, rozilikni qaytarish huquqiga egasiz. So‘rovlar uchun qo‘llab-quvvatlash orqali bog‘laning.',
        ],
      },
    ],
  },
  terms: {
    title: 'Foydalanish shartlari',
    intro: 'Aresso platformasidan foydalanish qoidalari. Xizmatdan foydalanish ushbu shartlarni qabul qilganingizni anglatadi.',
    updated: '2026',
    sections: [
      {
        heading: '1. Xizmat',
        paragraphs: [
          'Aresso mahsulotlar, onlayn do‘konlar, taomlar, ijara va boshqa marketplace xizmatlarini birlashtiruvchi platformadir. Ayrim xizmatlar uchinchi tomon (filial, sotuvchi) tomonidan bajariladi.',
        ],
      },
      {
        heading: '2. Hisob va autentifikatsiya',
        paragraphs: [
          'SMS orqali kirish va boshqa usullar qo‘llanilishi mumkin. Hisob xavfsizligi uchun ma’lumotlaringizni boshqalar bilan ulashmang.',
        ],
      },
      {
        heading: '3. Buyurtma va to‘lov',
        paragraphs: [
          'Narxlar va mavjudlik filial/sotuvchiga bog‘liq. To‘lov provayderlari qoidalariga rioya qilinishi kerak. Buyurtma bekor qilish va qaytarish — tegishli bo‘lim qoidalari va filial siyosatiga muvofiq.',
        ],
      },
      {
        heading: '4. Taqiqlangan harakatlar',
        paragraphs: [
          'Firibgarlik, noto‘g‘ri ma’lumot, platformani buzish, spam va qonunga zid harakatlar taqiqlanadi. Qoidalar buzilsa, akkaunt cheklanishi yoki to‘xtatilishi mumkin.',
        ],
      },
      {
        heading: '5. Mas’uliyat chegarasi',
        paragraphs: [
          'Platforma oraliq vositachi sifatida ishlaydi. Filial va sotuvchilar o‘z mahsulotlari uchun javobgardir. Texnik uzilishlar yoki force-majeure holatlarida xizmat vaqtincha to‘xtashi mumkin.',
        ],
      },
      {
        heading: '6. O‘zgarishlar',
        paragraphs: [
          'Shartlar yangilanishi mumkin. Muhim o‘zgarishlar ilova orqali yoki boshqa mos usul bilan xabar qilinadi.',
        ],
      },
    ],
  },
  cookies: {
    title: 'Cookie va shunga o‘xshash texnologiyalar',
    intro: 'Brauzeringizda saqlanadigan kichik fayllar va ularning roli.',
    updated: '2026',
    sections: [
      {
        heading: '1. Cookie nima?',
        paragraphs: [
          'Cookie — sayt yoki ilova sessiyasini eslab qolish, tili va sozlamalarni saqlash uchun ishlatiladigan ma’lumot.',
        ],
      },
      {
        heading: '2. Qanday cookie ishlatamiz?',
        paragraphs: [
          'Kirish holati, xavfsizlik, savat va buyurtma jarayoni, tahlil (anonimlashtirilgan) va ishlashni yaxshilash.',
        ],
      },
      {
        heading: '3. Boshqarish',
        paragraphs: [
          'Brauzer sozlamalaridan cookie ni cheklash yoki o‘chirish mumkin; bu ayrim funksiyalarning ishlashiga ta’sir qilishi mumkin.',
        ],
      },
    ],
  },
  about: {
    title: 'Biz haqimizda',
    intro:
      'Aresso — O‘zbekistonda mahsulotlar, do‘konlar, taomlar va ijara xizmatlarini bitta ekotizemda birlashtiruvchi marketplace.',
    sections: [
      {
        heading: 'Missiyamiz',
        paragraphs: [
          'Mijoz va sotuvchi o‘rtasida ishonchli, qulay va zamonaviy tajriba yaratish. Filial va kuryerlar bilan real vaqtda aloqa.',
        ],
      },
      {
        heading: 'Nima taklif qilamiz',
        paragraphs: [
          'Market, onlayn do‘konlar, taom buyurtmasi, ijara va boshqa vertikallar; xavfsiz to‘lov integratsiyalari va buyurtmalarni kuzatish.',
        ],
      },
    ],
  },
  partnership: {
    title: 'Hamkorlik',
    intro: 'Biznesingizni Aresso orqali kengaytirish imkoniyati.',
    sections: [
      {
        heading: 'Kimlar uchun',
        paragraphs: [
          'Filial tarmoqlari, restoranlar, ijara operatorlari, logistika va xizmat ko‘rsatuvchi kompaniyalar.',
        ],
      },
      {
        heading: 'Qanday bog‘lanish',
        paragraphs: [
          'Hamkorlik bo‘yicha taklif va savollar uchun qo‘llab-quvvatlash pochtasi orqali yozing. Jamoamiz imkoniyatlarni muhokama qilish uchun siz bilan bog‘lanadi.',
        ],
      },
    ],
  },
  careers: {
    title: 'Vakansiyalar',
    intro: 'Aresso jamoasiga qo‘shilish istagidamisiz?',
    sections: [
      {
        heading: 'Ish imkoniyatlari',
        paragraphs: [
          'Ochiq lavozimlar vaqt-vaqt bilan yangilanadi. Hozircha maxsus portal yo‘q — CV va yo‘nalishni qo‘llab-quvvatlash orqali yuborishingiz mumkin.',
        ],
      },
      {
        heading: 'Kontakt',
        paragraphs: [
          'HR yoki umumiy so‘rovlar uchun support pochtasi orqali “Vakansiya” mavzusi bilan murojaat qiling.',
        ],
      },
    ],
  },
};

export function getMarketingDoc(slug: MarketingDocSlug): MarketingDoc {
  return DOCS[slug];
}
