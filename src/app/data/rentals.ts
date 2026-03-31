export interface RentalCatalog {
  id: string;
  name: string;
  icon: string;
  image: string;
  description: string;
  categoryCount: number;
}

export interface RentalCategory {
  id: string;
  name: string;
  catalogId: string;
  icon: string;
  image: string;
  itemCount: number;
}

export interface RentalItem {
  id: string;
  name: string;
  /** Filial KV buyurtmasi uchun majburiy */
  branchId?: string;
  categoryId: string;
  catalogId: string;
  price: number;
  dailyPrice?: number;
  weeklyPrice?: number;
  monthlyPrice?: number;
  image: string;
  images?: string[];
  rating: number;
  reviews: number;
  location: string;
  /** Backend: mavjud soni (0 = tugagan) yoki boolean */
  available: boolean | number;
  description: string;
  features: string[];
  owner?: string;
  deposit?: number;
  minRentalPeriod?: string;
}

export const rentalCatalogs: RentalCatalog[] = [
  {
    id: 'transport',
    name: 'Transport',
    icon: '🚗',
    image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    description: 'Mashinalar, mototsikllar va velosipedlar',
    categoryCount: 4
  },
  {
    id: 'uy-joy',
    name: 'Uy-joy',
    icon: '🏠',
    image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    description: 'Kvartiralar, uylar va ofislar',
    categoryCount: 3
  },
  {
    id: 'texnika',
    name: 'Texnika',
    icon: '💻',
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    description: 'Kompyuterlar, telefonlar va kameralar',
    categoryCount: 5
  },
  {
    id: 'sport',
    name: 'Sport',
    icon: '⚽',
    image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    description: 'Sport anjomlari va velosipedlar',
    categoryCount: 3
  },
  {
    id: 'o-yin-konsol',
    name: "O'yin konsollari",
    icon: '🎮',
    image: 'https://images.unsplash.com/photo-1486401899868-0e435ed85128?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    description: 'PlayStation, Xbox va Nintendo',
    categoryCount: 2
  },
  {
    id: 'uy-jihozlari',
    name: 'Uy jihozlari',
    icon: '🏡',
    image: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    description: 'Mebel va maishiy texnika',
    categoryCount: 4
  },
  {
    id: 'asboblar',
    name: 'Asboblar',
    icon: '🔧',
    image: 'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    description: "Ta'mir va qurilish anjomlari",
    categoryCount: 3
  },
  {
    id: 'tadbirlar',
    name: 'Tadbirlar',
    icon: '🎉',
    image: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    description: 'To\'y va tadbirlar uchun',
    categoryCount: 3
  },
];

export const rentalCategories: RentalCategory[] = [
  // Transport categories
  { id: 'mashinalar', name: 'Mashinalar', catalogId: 'transport', icon: '🚗', image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 24 },
  { id: 'mototsikllar', name: 'Mototsikllar', catalogId: 'transport', icon: '🏍️', image: 'https://images.unsplash.com/photo-1558981852-426c6c22a060?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 12 },
  { id: 'velosipedlar', name: 'Velosipedlar', catalogId: 'transport', icon: '🚴', image: 'https://images.unsplash.com/photo-1576435728678-68d0fbf94e91?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 15 },
  { id: 'elektr-samokat', name: 'Elektr samokatlar', catalogId: 'transport', icon: '🛴', image: 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 8 },
  
  // Uy-joy categories
  { id: 'kvartiralar', name: 'Kvartiralar', catalogId: 'uy-joy', icon: '🏢', image: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 35 },
  { id: 'uylar', name: 'Uylar', catalogId: 'uy-joy', icon: '🏡', image: 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 18 },
  { id: 'ofislar', name: 'Ofislar', catalogId: 'uy-joy', icon: '🏢', image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 12 },
  
  // Texnika categories
  { id: 'kompyuterlar', name: 'Kompyuterlar', catalogId: 'texnika', icon: '💻', image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 28 },
  { id: 'telefonlar-ijara', name: 'Telefonlar', catalogId: 'texnika', icon: '📱', image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 42 },
  { id: 'kameralar', name: 'Kameralar', catalogId: 'texnika', icon: '📷', image: 'https://images.unsplash.com/photo-1606980707123-80f9d4463936?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 18 },
  { id: 'dronlar', name: 'Dronlar', catalogId: 'texnika', icon: '🚁', image: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 10 },
  { id: 'audio-texnika', name: 'Audio texnika', catalogId: 'texnika', icon: '🎧', image: 'https://images.unsplash.com/photo-1545127398-14699f92334b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 22 },
  
  // Sport categories
  { id: 'velosiped-sport', name: 'Sport velosipedlari', catalogId: 'sport', icon: '🚵', image: 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 16 },
  { id: 'sport-anjomlari', name: 'Sport anjomlari', catalogId: 'sport', icon: '🏋️', image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 24 },
  { id: 'kemping', name: 'Kemping anjomlari', catalogId: 'sport', icon: '⛺', image: 'https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 12 },
  
  // O'yin konsollari categories
  { id: 'playstation', name: 'PlayStation', catalogId: 'o-yin-konsol', icon: '🎮', image: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 18 },
  { id: 'xbox-nintendo', name: 'Xbox & Nintendo', catalogId: 'o-yin-konsol', icon: '🎮', image: 'https://images.unsplash.com/photo-1621259182978-fbf93132d53d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 14 },
  
  // Uy jihozlari categories
  { id: 'mebel', name: 'Mebel', catalogId: 'uy-jihozlari', icon: '🛋️', image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 32 },
  { id: 'maishiy-texnika', name: 'Maishiy texnika', catalogId: 'uy-jihozlari', icon: '🔌', image: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 28 },
  { id: 'oshxona', name: 'Oshxona jihozlari', catalogId: 'uy-jihozlari', icon: '🍳', image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 24 },
  { id: 'dekor', name: 'Dekor', catalogId: 'uy-jihozlari', icon: '🎨', image: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 16 },
  
  // Asboblar categories
  { id: 'elektr-asboblar', name: 'Elektr asboblar', catalogId: 'asboblar', icon: '🔨', image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 22 },
  { id: 'qurilish', name: 'Qurilish anjomlari', catalogId: 'asboblar', icon: '🏗️', image: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 18 },
  { id: 'bog-asboblar', name: "Bog' anjomlari", catalogId: 'asboblar', icon: '🌱', image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 14 },
  
  // Tadbirlar categories
  { id: 'toy-jihozlar', name: "To'y jihozlari", catalogId: 'tadbirlar', icon: '💒', image: 'https://images.unsplash.com/photo-1519741497674-611481863552?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 24 },
  { id: 'audio-video-rental', name: 'Audio/Video', catalogId: 'tadbirlar', icon: '🎤', image: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 16 },
  { id: 'yoritish', name: 'Yoritish', catalogId: 'tadbirlar', icon: '💡', image: 'https://images.unsplash.com/photo-1556908220-7d37b83ea9f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080', itemCount: 12 },
];

// Test data removed - using real backend data only
export const rentalItems: RentalItem[] = [];

export const rentalBanners = [
  {
    id: 'banner-1',
    title: 'Transport ijarasi',
    subtitle: '300+ dan ortiq mashinalar',
    image: 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    color: '#14b8a6'
  },
  {
    id: 'banner-2',
    title: 'Uy va kvartiralar',
    subtitle: 'Qulay narxlarda ijara',
    image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    color: '#8b5cf6'
  },
  {
    id: 'banner-3',
    title: 'Texnika ijarasi',
    subtitle: 'Noutbuk, telefon, kamera',
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    color: '#f59e0b'
  },
  {
    id: 'banner-4',
    title: "O'yin konsollari",
    subtitle: 'PlayStation va Xbox',
    image: 'https://images.unsplash.com/photo-1486401899868-0e435ed85128?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    color: '#ec4899'
  },
];
