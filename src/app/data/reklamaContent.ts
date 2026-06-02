import type { LucideIcon } from 'lucide-react';
import {
  ChefHat,
  CreditCard,
  Headphones,
  MapPin,
  MessageCircle,
  Package,
  ShoppingCart,
  Smartphone,
  Store,
  Truck,
  UtensilsCrossed,
} from 'lucide-react';

export type ReklamaMockVariant = 'market' | 'seller' | 'restaurant' | 'support' | 'profile';

export const REKLAMA_NAV = [
  { id: 'tanishuv', label: 'Tanishuv' },
  { id: 'mijoz', label: 'Mijozlar' },
  { id: 'seller', label: 'Seller' },
  { id: 'taom', label: 'Taomlar' },
  { id: 'jarayon', label: 'Jarayon' },
  { id: 'savollar', label: 'Savollar' },
] as const;

export const MIJOZ_IMKONLAR: {
  icon: LucideIcon;
  title: string;
  text: string;
  mock: ReklamaMockVariant;
}[] = [
  {
    icon: ShoppingCart,
    title: 'Market va do‘kondan xarid',
    text: 'Mahsulotlarni ko‘ring, savatga qo‘shing, manzil va to‘lovni tanlang. Buyurtma holatini profilda kuzatasiz.',
    mock: 'market',
  },
  {
    icon: UtensilsCrossed,
    title: 'Taom buyurtma',
    text: 'Restoran menyusidan taom tanlang. Tayyorlanish va yetkazish zanjiri restoran paneli bilan bog‘langan.',
    mock: 'restaurant',
  },
  {
    icon: MessageCircle,
    title: 'Aresso support chat',
    text: 'Savol, shikoyat yoki rasm yuborish — platforma support bilan to‘g‘ridan-to‘g‘ri chat. Filial chat ham mavjud.',
    mock: 'support',
  },
  {
    icon: Package,
    title: 'Buyurtmalar tarixi',
    text: 'Barcha buyurtmalar, to‘lov holati va chek/kvitansiya — bitta profilda.',
    mock: 'profile',
  },
  {
    icon: MapPin,
    title: 'Joylashuv va yetkazish',
    text: 'Hudud tanlash, filial bo‘yicha yetkazish zonasi — qayerda bo‘lsangiz ham mos xizmat.',
    mock: 'market',
  },
  {
    icon: CreditCard,
    title: 'To‘lov usullari',
    text: 'Onlayn to‘lovlar va yetkazishda naqd (buyurtma turiga qarab). Xavfsiz tasdiqlash oqimi.',
    mock: 'profile',
  },
];

export const SAVOLLAR: { q: string; a: string }[] = [
  {
    q: 'Aresso nima?',
    a: 'Bu bitta platformada market, onlayn do‘kon, taom, ijara, xizmatlar va boshqa bo‘limlarni birlashtirgan marketplace. Mijoz ilovadan foydalanadi, biznes esa alohida paneldan boshqaradi.',
  },
  {
    q: 'Pul to‘lashim kerakmi?',
    a: 'Bu sahifa hamkorlik taqdimoti — integratsiya uchun tanishtirish. Seller yoki restoran sifatida ro‘yxatdan o‘tish bo‘yicha shartlarni support bilan kelishasiz.',
  },
  {
    q: 'Seller qanday ulanadi?',
    a: '/seller orqali kirasiz, mahsulot yuklaysiz. Mijozlar market va do‘kon bo‘limida ko‘radi. Buyurtmalar seller panelda real vaqtda yangilanadi.',
  },
  {
    q: 'Restoran qanday ulanadi?',
    a: '/restaurant — menyu va buyurtmalar. Oshxonada tayyorlovchi ekrani (/tayyorlovchi) buyurtmani ko‘radi. Kuryer zanjiri filial bilan bog‘langan.',
  },
  {
    q: 'Mijoz support bilan qanday bog‘lanadi?',
    a: 'Saytda support widget yoki profildan Aresso support chat. Xabar va rasm yuborish mumkin. Support xodimlari /support panelida javob beradi.',
  },
  {
    q: 'Qayerda ishlaydi?',
    a: 'Asosiy manzil: aresso.app. Veb-ilova va PWA — telefonda brauzer orqali ham qulay ishlaydi.',
  },
];

export const JARAYON_QADAMLAR = [
  { icon: Smartphone, title: 'Mijoz ilovani ochadi', desc: 'Market, taom yoki do‘kon bo‘limini tanlaydi' },
  { icon: ShoppingCart, title: 'Buyurtma beradi', desc: 'Savat, manzil, to‘lov — bir oqimda' },
  { icon: Store, title: 'Seller / restoran qabul qiladi', desc: 'Panelda yangi buyurtma ko‘rinadi' },
  { icon: ChefHat, title: 'Tayyorlanadi', desc: 'Tayyorlovchi ekranida navbat (taom uchun)' },
  { icon: Truck, title: 'Yetkaziladi', desc: 'Kuryer va filial logistikasi' },
  { icon: Headphones, title: 'Support yordam', desc: 'Muammo bo‘lsa chat orqali hal qilinadi' },
];

export const HAMKOR_ROLLAR: {
  image: string;
  title: string;
  desc: string;
  link?: string;
  linkLabel?: string;
}[] = [
  {
    image: '/branding/aresso-logo-night.png',
    title: 'Mijoz ilovasi',
    desc: 'aresso.app — xarid, taom, profil, support.',
    link: '/',
    linkLabel: 'Ilovani ochish',
  },
  {
    image: '/icons/icon-192.png',
    title: 'Seller panel',
    desc: 'Mahsulot, buyurtma, inventar boshqaruvi.',
    link: '/seller',
    linkLabel: 'Seller kirish',
  },
  {
    image: '/branding/aresso-tayyorlovchi.png',
    title: 'Taom zanjiri',
    desc: 'Restoran + tayyorlovchi + yetkazish.',
    link: '/restaurant',
    linkLabel: 'Restoran kirish',
  },
  {
    image: '/branding/aresso-kuryer.png',
    title: 'Logistika',
    desc: 'Kuryer paneli — yetkazib berish.',
    link: '/kuryer',
    linkLabel: 'Kuryer haqida',
  },
];
