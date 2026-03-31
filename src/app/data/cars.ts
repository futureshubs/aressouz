export interface Car {
  id: string;
  name: string;
  categoryId: string;
  image: string;
  images: string[];
  year: number;
  brand: string;
  model: string;
  fuelType: string;
  transmission: string;
  seats: number;
  color: string;
  mileage: string;
  features: string[];
  rating: number;
  reviews: number;
  location: string;
  owner: string;
  available: boolean;
  price: number;
  currency: 'USD' | 'UZS';
  oldPrice?: number;
  description: string;
  condition: string; // 'Yangi' yoki 'Ishlatilgan'
  ownerPhone?: string;
  createdAt?: string;
  userId?: string;
  creditAvailable?: boolean;
  mortgageAvailable?: boolean;
  creditTerm?: number;
  creditInterestRate?: number;
  initialPayment?: number;
  hasHalalInstallment?: boolean;
  halalInstallmentMonths?: number;
  halalInstallmentBank?: string;
  halalDownPayment?: number;
}

export interface CarCategory {
  id: string;
  name: string;
  description: string;
  image: string;
  icon: string;
  count: number;
}

export const carCategories: CarCategory[] = [
  {
    id: 'sedan',
    name: 'Sedan',
    description: 'Qulay va iqtisodiy sedanlar',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/photo_2026-03-10_00-00-19.jpg',
    icon: '🚗',
    count: 8,
  },
  {
    id: 'hatchback',
    name: 'Hatchback',
    description: 'Ixcham va shahar uchun qulay',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/photo_2026-03-10_00-28-14.jpg',
    icon: '🚕',
    count: 5,
  },
  {
    id: 'suv',
    name: 'SUV',
    description: 'Katta va kuchli SUV avtomobillar',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/photo_2026-03-10_00-02-47.jpg',
    icon: '🚙',
    count: 6,
  },
  {
    id: 'crossover',
    name: 'Crossover',
    description: 'Sedan va SUV kombinatsiyasi',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/photo_2026-03-10_00-05-25.jpg',
    icon: '🚐',
    count: 7,
  },
  {
    id: 'coupe',
    name: 'Coupe',
    description: '2 eshikli sport dizayn',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/photo_2026-03-10_00-04-26.jpg',
    icon: '🏁',
    count: 4,
  },
  {
    id: 'luxury',
    name: 'Hashamatli',
    description: 'Premium va hashamatli avtomobillar',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/photo_2026-03-10_00-32-28.jpg',
    icon: '✨',
    count: 4,
  },
  {
    id: 'sport',
    name: 'Sport',
    description: 'Tez va sportiv avtomobillar',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/photo_2026-03-10_00-13-12.jpg',
    icon: '🏎️',
    count: 5,
  },
  {
    id: 'electric',
    name: 'Elektr',
    description: 'Ekologik toza elektr avtomobillari',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/photo_2026-03-10_00-23-02.jpg',
    icon: '⚡',
    count: 3,
  },
  {
    id: 'hybrid',
    name: 'Gibrid',
    description: 'Benzin va elektr kombinatsiyasi',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/photo_2026-03-10_00-20-09.jpg',
    icon: '🔋',
    count: 3,
  },
  {
    id: 'minivan',
    name: 'Minivan',
    description: 'Oilaviy va keng minivan avtomobillar',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/Gemini_Generated_Image_jz20hjjz20hjjz20.png',
    icon: '🚐',
    count: 4,
  },
  {
    id: 'pickup',
    name: 'Pickup',
    description: 'Kuchli yuk tashish uchun',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/photo_2026-03-10_00-38-51.jpg',
    icon: '🛻',
    count: 4,
  },
  {
    id: 'van',
    name: 'Van',
    description: 'Tijorat va yuk tashish',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/photo_2026-03-10_00-36-08.jpg',
    icon: '🚚',
    count: 2,
  },
  {
    id: 'convertible',
    name: 'Kabriolet',
    description: 'Ochiq tom bilan sport avtomobil',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/photo_2026-03-10_00-39-35.jpg',
    icon: '🌞',
    count: 3,
  },
  {
    id: 'wagon',
    name: 'Wagon',
    description: 'Keng yuk joyi bilan universal',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/photo_2026-03-10_00-34-38.jpg',
    icon: '🚗',
    count: 2,
  },
  {
    id: 'truck',
    name: 'Fura',
    description: 'Katta yuk tashish uchun yuk mashinasi',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/photo_2026-03-10_00-40-54.jpg',
    icon: '🚛',
    count: 3,
  },
];

export const cars: Car[] = [
  // SEDAN
  {
    id: 'car-1',
    name: 'Toyota Camry 2023',
    categoryId: 'sedan',
    image: 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800&q=80',
      'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=800&q=80',
    ],
    year: 2023,
    brand: 'Toyota',
    model: 'Camry',
    fuelType: 'Benzin',
    transmission: 'Avtomat',
    seats: 5,
    color: 'Oq',
    mileage: '15,000 km',
    features: ['Konditsioner', 'ABS', 'Yonilg\'i tejovchi', 'Bluetooth', 'Orqa kamera', 'Park sensori'],
    rating: 4.8,
    reviews: 124,
    location: 'Toshkent, Chilonzor',
    owner: 'Akmal Rahimov',
    available: true,
    price: 450000,
    currency: 'UZS',
    oldPrice: 500000,
    description: 'Juda yaxshi holatda, yangi shina va to\'liq xizmat ko\'rsatilgan. Ishonchli va qulay avtomobil.',
    condition: 'Yangi',
  },
  {
    id: 'car-2',
    name: 'Honda Accord 2022',
    categoryId: 'sedan',
    image: 'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1590362891991-f776e747a588?w=800&q=80',
    ],
    year: 2022,
    brand: 'Honda',
    model: 'Accord',
    fuelType: 'Benzin',
    transmission: 'Avtomat',
    seats: 5,
    color: 'Kulrang',
    mileage: '22,000 km',
    features: ['Klimat nazorat', 'ABS', 'Cruise control', 'Bluetooth', 'LED chiroqlar'],
    rating: 4.7,
    reviews: 98,
    location: 'Toshkent, Yunusobod',
    owner: 'Sardor Karimov',
    available: true,
    price: 420000,
    currency: 'UZS',
    description: 'Zamonaviy va shinam sedan. Uzoq yo\'llarga zo\'r tanlov.',
    condition: 'Ishlatilgan',
  },

  // SUV
  {
    id: 'car-3',
    name: 'Toyota Land Cruiser Prado',
    categoryId: 'suv',
    image: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&q=80',
    ],
    year: 2023,
    brand: 'Toyota',
    model: 'Land Cruiser Prado',
    fuelType: 'Dizel',
    transmission: 'Avtomat',
    seats: 7,
    color: 'Qora',
    mileage: '8,000 km',
    features: ['4x4', 'Teri o\'rindiqlar', 'Panorama tom', 'Klimat nazorat', 'Multimediya', '7 o\'rindiq'],
    rating: 4.9,
    reviews: 156,
    location: 'Toshkent, Mirzo Ulug\'bek',
    owner: 'Jamshid Alimov',
    available: true,
    price: 850000,
    currency: 'UZS',
    description: 'Premium SUV, har qanday yo\'lda ishonchli. Tog\'lik hududlar uchun ideal.',
    condition: 'Yangi',
  },
  {
    id: 'car-4',
    name: 'Chevrolet Tahoe 2023',
    categoryId: 'suv',
    image: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=800&q=80',
    ],
    year: 2023,
    brand: 'Chevrolet',
    model: 'Tahoe',
    fuelType: 'Benzin',
    transmission: 'Avtomat',
    seats: 8,
    color: 'Oq',
    mileage: '12,000 km',
    features: ['4x4', 'Teri salon', 'Katta ekran', 'Bose audio', 'Issiq o\'rindiqlar', '8 o\'rindiq'],
    rating: 4.8,
    reviews: 87,
    location: 'Toshkent, Yakkasaroy',
    owner: 'Nodir Ergashev',
    available: true,
    price: 900000,
    currency: 'UZS',
    description: 'Katta oila uchun ideal SUV. Juda keng va qulay.',
    condition: 'Yangi',
  },

  // LUXURY
  {
    id: 'car-5',
    name: 'Mercedes-Benz S-Class',
    categoryId: 'luxury',
    image: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&q=80',
    ],
    year: 2023,
    brand: 'Mercedes-Benz',
    model: 'S-Class',
    fuelType: 'Benzin',
    transmission: 'Avtomat',
    seats: 5,
    color: 'Qora',
    mileage: '5,000 km',
    features: ['Premium teri', 'Massaj o\'rindiqlar', 'Burmester audio', 'Panorama tom', 'Night vision', 'Avto parking'],
    rating: 5.0,
    reviews: 234,
    location: 'Toshkent, Shayhontohur',
    owner: 'Ravshan Xudayberganov',
    available: true,
    price: 1500000,
    currency: 'UZS',
    description: 'Eng yuqori darajadagi hashamatli avtomobil. Maxsus tadbirlar uchun.',
    condition: 'Yangi',
  },
  {
    id: 'car-6',
    name: 'BMW 7 Series',
    categoryId: 'luxury',
    image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800&q=80',
    ],
    year: 2023,
    brand: 'BMW',
    model: '7 Series',
    fuelType: 'Benzin',
    transmission: 'Avtomat',
    seats: 5,
    color: 'Kulrang metallik',
    mileage: '7,000 km',
    features: ['Premium salon', 'Massaj', 'Harman Kardon', 'Laser chiroqlar', 'Head-up display', '360 kamera'],
    rating: 4.9,
    reviews: 178,
    location: 'Toshkent, Sergeli',
    owner: 'Aziz Normatov',
    available: true,
    price: 1400000,
    currency: 'UZS',
    description: 'Nemis sifati va hashamati. VIP mijozlar uchun.',
    condition: 'Yangi',
  },

  // SPORT
  {
    id: 'car-7',
    name: 'Chevrolet Camaro',
    categoryId: 'sport',
    image: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&q=80',
    ],
    year: 2022,
    brand: 'Chevrolet',
    model: 'Camaro',
    fuelType: 'Benzin',
    transmission: 'Avtomat',
    seats: 4,
    color: 'Sariq',
    mileage: '18,000 km',
    features: ['V8 motor', 'Sport suspenziya', 'Brembo tormoz', 'Launch control', 'Sport exhaust'],
    rating: 4.7,
    reviews: 92,
    location: 'Toshkent, Olmazor',
    owner: 'Otabek Saidov',
    available: true,
    price: 800000,
    currency: 'UZS',
    description: 'American muscle car. Kuchli va ajoyib dizayn.',
    condition: 'Ishlatilgan',
  },
  {
    id: 'car-8',
    name: 'Ford Mustang GT',
    categoryId: 'sport',
    image: 'https://images.unsplash.com/photo-1584345604476-8ec5f8e8ca3d?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1584345604476-8ec5f8e8ca3d?w=800&q=80',
    ],
    year: 2023,
    brand: 'Ford',
    model: 'Mustang GT',
    fuelType: 'Benzin',
    transmission: 'Mexanik',
    seats: 4,
    color: 'Qizil',
    mileage: '10,000 km',
    features: ['5.0L V8', 'Track mode', 'Performance package', 'Recaro o\'rindiqlar', 'Adaptive suspension'],
    rating: 4.8,
    reviews: 145,
    location: 'Toshkent, Uchtepa',
    owner: 'Jasur Turgunov',
    available: true,
    price: 900000,
    currency: 'UZS',
    description: 'Klassik sport avtomobil. Adrenalin va zavq.',
    condition: 'Yangi',
  },

  // ELECTRIC
  {
    id: 'car-9',
    name: 'Tesla Model 3',
    categoryId: 'electric',
    image: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&q=80',
    images: [
      'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&q=80',
    ],
    year: 2023,
    brand: 'Tesla',
    model: 'Model 3',
    fuelType: 'Elektr',
    transmission: 'Avtomat',
    seats: 5,
    color: 'Oq',
    mileage: '12,000 km',
    features: ['Autopilot', 'Supercharging', 'Premium audio', 'Katta ekran', '0-100 km/s 3.3s', 'OTA yangilanishlar'],
    rating: 4.9,
    reviews: 267,
    location: 'Toshkent, Yashnobod',
    owner: 'Dilshod Yusupov',
    available: true,
    price: 650000,
    currency: 'UZS',
    description: 'Kelajak avtomobili. Ekologik va texnologik.',
    condition: 'Yangi',
  },

  // MINIVAN
  {
    id: 'car-10',
    name: 'Honda Odyssey',
    categoryId: 'minivan',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/Gemini_Generated_Image_jz20hjjz20hjjz20.png',
    images: [
      'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/Gemini_Generated_Image_jz20hjjz20hjjz20.png',
    ],
    year: 2022,
    brand: 'Honda',
    model: 'Odyssey',
    fuelType: 'Benzin',
    transmission: 'Avtomat',
    seats: 8,
    color: 'Kulrang',
    mileage: '25,000 km',
    features: ['8 o\'rindiq', 'Sliding doors', 'Entertainment sistem', 'Klimat nazorat', 'USB portlar', 'Keng salon'],
    rating: 4.6,
    reviews: 76,
    location: 'Toshkent, Bektemir',
    owner: 'Rustam Mahmudov',
    available: true,
    price: 550000,
    currency: 'UZS',
    description: 'Oilaviy sayohatlar uchun eng yaxshi tanlov. Keng va qulay.',
    condition: 'Ishlatilgan',
  },
];