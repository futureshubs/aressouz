/**
 * Ijara bo‘limi — foydalanuvchi roziligi matni (savat / ijara rozilik modali).
 * Huquqiy matn o‘zgarganda faqat shu faylni yangilang.
 */
export const RENTAL_TERMS_TITLE = 'IJARA SHARTLARI VA FOYDALANUVCHI ROZILIGI';

export const RENTAL_TERMS_CLAUSES: ReadonlyArray<{ n: number; title: string; body: string }> = [
  {
    n: 1,
    title: 'Umumiy rozilik',
    body: "Foydalanuvchi platformada ro‘yxatdan o‘tish yoki xizmatdan foydalanishni boshlash orqali ushbu ijara shartlarini to‘liq va so‘zsiz qabul qilgan hisoblanadi.",
  },
  {
    n: 2,
    title: 'Shaxsiy ma’lumotlarga rozilik',
    body: "Foydalanuvchi o‘zining shaxsiy ma’lumotlarini (F.I.O, telefon, pasport ma’lumotlari va boshqalar) yig‘ish, qayta ishlash, saqlash va zarur hollarda uchinchi shaxslarga berilishiga rozilik bildiradi.",
  },
  {
    n: 3,
    title: 'To‘lov majburiyatlari',
    body: "Foydalanuvchi ijara uchun belgilangan to‘lovlarni o‘z vaqtida amalga oshirishga majbur. Kechikish holatida platforma jarima qo‘llash yoki xizmatni to‘xtatish huquqiga ega.",
  },
  {
    n: 4,
    title: 'Ruxsatsiz sotish taqiqlanadi',
    body: "Foydalanuvchi ijaraga olingan mahsulotni sotish, garovga qo‘yish yoki boshqa shaxsga berish huquqiga ega emas. Agar ushbu holat aniqlansa, foydalanuvchi mahsulotning to‘liq bozor qiymatini hamda kamida 2 barobar miqdorida jarimani to‘lash majburiyatini oladi.",
  },
  {
    n: 5,
    title: 'Zarar uchun javobgarlik',
    body: "Foydalanuvchi mahsulotga yetkazilgan har qanday zarar (sinish, yo‘qolish, ishlamay qolish va boshqalar) uchun to‘liq moddiy javobgar hisoblanadi va zararni to‘liq qoplaydi.",
  },
  {
    n: 6,
    title: 'Qaytarilmagan yoki yo‘qolgan mahsulot',
    body: "Mahsulot belgilangan muddatda qaytarilmasa yoki yo‘qolgan bo‘lsa, foydalanuvchi mahsulotning to‘liq qiymatini va qo‘shimcha jarimani to‘lashga majbur.",
  },
  {
    n: 7,
    title: 'Akkaunt javobgarligi',
    body: "Foydalanuvchi o‘z akkaunti orqali amalga oshirilgan barcha harakatlar uchun shaxsan javobgar. Login va parolni boshqalarga berish taqiqlanadi.",
  },
  {
    n: 8,
    title: 'Bloklash va bekor qilish',
    body: "Platforma qoidalar buzilganda foydalanuvchi akkauntini ogohlantirishsiz bloklash yoki xizmatni to‘xtatish huquqiga ega.",
  },
  {
    n: 9,
    title: 'Majburiy undirish',
    body: "Foydalanuvchi qarzdorlik yuzaga kelgan taqdirda platforma tomonidan qarzni majburiy undirish (uchinchi shaxslar orqali ham) amalga oshirilishiga rozilik bildiradi.",
  },
  {
    n: 10,
    title: 'Shartlarni o‘zgartirish',
    body: "Platforma ushbu shartlarni istalgan vaqtda o‘zgartirish huquqiga ega. Yangilangan shartlar e’lon qilingan paytdan boshlab kuchga kiradi.",
  },
  {
    n: 11,
    title: 'Yakuniy tasdiq',
    body: "“Roziman” tugmasini bosish yoki xizmatdan foydalanishni davom ettirish foydalanuvchining ushbu shartlarning barchasiga roziligini bildiradi.",
  },
];
