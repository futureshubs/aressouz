// House seed data for testing
import * as kv from "./kv_store.tsx";

const uzbekistanRegions = [
  { region: 'Toshkent shahri', districts: ['Chilonzor', 'Yunusobod', 'Mirzo Ulug\'bek', 'Olmazor', 'Yakkasaroy'] },
  { region: 'Toshkent viloyati', districts: ['Chirchiq', 'Angren', 'Olmaliq', 'Bekobod', 'Yangiyo\'l'] },
  { region: 'Samarqand', districts: ['Samarqand shahri', 'Urgut', 'Jomboy', 'Kattaqo\'rg\'on', 'Payariq'] },
  { region: 'Buxoro', districts: ['Buxoro shahri', 'G\'ijduvon', 'Kogon', 'Vobkent', 'Romitan'] },
  { region: 'Andijon', districts: ['Andijon shahri', 'Xo\'jaobod', 'Asaka', 'Paytug\'', 'Marhamat'] },
  { region: 'Farg\'ona', districts: ['Farg\'ona shahri', 'Marg\'ilon', 'Qo\'qon', 'Quvasoy', 'Rishton'] },
  { region: 'Namangan', districts: ['Namangan shahri', 'Chortoq', 'Pop', 'Uchqo\'rg\'on', 'Kosonsoy'] },
  { region: 'Qashqadaryo', districts: ['Qarshi', 'Shahrisabz', 'Koson', 'Muborak', 'Kitob'] },
];

const houseCategories = [
  'kvartira',
  'villa',
  'hovli',
  'townhouse',
  'penthouse',
  'office',
];

const conditions = ['yangi', 'ta\'mirlangan', 'oddiy'];

const houseImages = [
  // Modern apartments
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
  'https://images.unsplash.com/photo-1515263487990-61b07816b324?w=800',
  
  // Villas
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
  'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
  
  // Houses
  'https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=800',
  'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800',
  'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800',
  'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800',
  
  // Townhouses
  'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800',
  'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800',
  
  // Penthouses
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800',
  
  // Offices
  'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?w=800',
];

const houseTitles = {
  kvartira: [
    'Zamonaviy 3 xonali kvartira',
    'Yangi qurilgan kvartira',
    'Katta maydonli kvartira',
    'Shahar markazidagi kvartira',
    'Ta\'mirlangan kvartira',
  ],
  villa: [
    'Hashamatli villa',
    'Hovli bilan villa',
    'Zamonaviy villa',
    'Katta villa uy',
    'Oilaviy villa',
  ],
  hovli: [
    'Keng hovlili uy',
    'Bog\' bilan uy',
    'Oilaviy hovli uy',
    'Zamonaviy hovli uy',
    'Ta\'mirlangan hovli',
  ],
  townhouse: [
    'Zamonaviy townhouse',
    'Keng townhouse',
    'Oilaviy townhouse',
    'Yangi townhouse',
    'Ta\'mirlangan townhouse',
  ],
  penthouse: [
    'Hashamatli penthouse',
    'Panoramali penthouse',
    'Katta penthouse',
    'Zamonaviy penthouse',
    'Premium penthouse',
  ],
  office: [
    'Zamonaviy ofis',
    'Keng ofis maydoni',
    'Markazy ofis',
    'Ta\'mirlangan ofis',
    'Premium ofis',
  ],
};

const houseDescriptions = [
  'Bu uy barcha qulayliklar bilan jihozlangan. Shahar infratuzilmasiga yaqin joylashgan.',
  'Ajoyib joylashuv va zamonaviy ta\'mir. Tinch va osoyishta muhit.',
  'Katta oilalar uchun ideal variant. Barcha qulayliklar mavjud.',
  'Transport va do\'konlarga yaqin. Yaxshi infratuzilma.',
  'Hashamatli va zamonaviy dizayn. Premium class uy.',
  'Ekologik toza hudud. Yashil zona yaqinida.',
  'Yangi qurilgan bino. Barcha hujjatlar tayyor.',
  'Ta\'mirlangan va jihozlangan. Kirish tayyor.',
];

const houseFeatures = [
  'Yangi qurilish',
  'Lift',
  'Parkovka',
  'Xavfsizlik',
  'Bolalar maydoni',
  'Hovuz',
  'Sauna',
  'Fitnes zal'
];

const ownerNames = [
  'Aziz Rahimov',
  'Dilshod Karimov',
  'Farrux Toshmatov',
  'Sardor Aliyev',
  'Nodir Yusupov',
  'Jasur Mahmudov',
  'Bobur Usmanov',
  'Rustam Sharipov',
  'Davron Ismoilov',
  'Otabek Haydarov',
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generatePhoneNumber(): string {
  const prefixes = ['+998 90', '+998 91', '+998 93', '+998 94', '+998 95', '+998 97', '+998 98', '+998 99'];
  const prefix = randomChoice(prefixes);
  const number = randomInt(1000000, 9999999);
  return `${prefix} ${Math.floor(number / 10000)} ${number % 10000}`;
}

export async function seedHouses() {
  console.log('🌱 Starting house seed...');
  
  const houses = [];
  
  for (let i = 0; i < 30; i++) {
    const regionData = randomChoice(uzbekistanRegions);
    const categoryId = randomChoice(houseCategories);
    const condition = randomChoice(conditions);
    
    let price: number;
    let rooms: number;
    let area: number;
    let floor: number;
    let totalFloors: number;
    
    // Generate realistic data based on category
    switch (categoryId) {
      case 'kvartira':
        price = randomInt(40000, 200000); // USD
        rooms = randomInt(1, 4);
        area = randomInt(45, 120);
        floor = randomInt(1, 16);
        totalFloors = randomInt(floor, 16);
        break;
      case 'villa':
        price = randomInt(250000, 800000); // USD
        rooms = randomInt(4, 8);
        area = randomInt(200, 500);
        floor = randomInt(1, 3);
        totalFloors = randomInt(1, 3);
        break;
      case 'hovli':
        price = randomInt(80000, 320000); // USD
        rooms = randomInt(3, 6);
        area = randomInt(100, 300);
        floor = 1;
        totalFloors = randomInt(1, 2);
        break;
      case 'townhouse':
        price = randomInt(160000, 400000); // USD
        rooms = randomInt(3, 5);
        area = randomInt(150, 250);
        floor = randomInt(1, 3);
        totalFloors = randomInt(2, 3);
        break;
      case 'penthouse':
        price = randomInt(400000, 1200000); // USD
        rooms = randomInt(3, 6);
        area = randomInt(180, 400);
        floor = randomInt(10, 20);
        totalFloors = floor;
        break;
      case 'office':
        price = randomInt(65000, 400000); // USD
        rooms = randomInt(2, 10);
        area = randomInt(50, 300);
        floor = randomInt(1, 12);
        totalFloors = randomInt(floor, 12);
        break;
      default:
        price = randomInt(80000, 240000); // USD
        rooms = randomInt(2, 4);
        area = randomInt(60, 120);
        floor = randomInt(1, 9);
        totalFloors = randomInt(floor, 9);
    }
    
    const houseId = `house-seed-${Date.now()}-${i}`;
    const imageCount = randomInt(3, 6);
    const images = Array.from({ length: imageCount }, () => randomChoice(houseImages));
    
    // Generate features
    const featureCount = randomInt(3, 6);
    const features: string[] = [];
    const availableFeatures = [...houseFeatures];
    for (let j = 0; j < featureCount; j++) {
      if (availableFeatures.length === 0) break;
      const index = randomInt(0, availableFeatures.length - 1);
      features.push(availableFeatures[index]);
      availableFeatures.splice(index, 1);
    }
    
    const bathrooms = randomInt(1, Math.max(1, Math.floor(rooms / 2)));
    
    // Random currency (70% UZS, 30% USD)
    const currency: 'USD' | 'UZS' = Math.random() > 0.3 ? 'UZS' : 'USD';
    
    // Price based on currency
    let finalPrice: number;
    if (currency === 'UZS') {
      finalPrice = price * 12700; // Convert to UZS
    } else {
      finalPrice = price;
    }
    
    const house = {
      id: houseId,
      categoryId,
      title: randomChoice(houseTitles[categoryId]),
      description: randomChoice(houseDescriptions),
      price: finalPrice,
      currency,
      images,
      region: regionData.region.toLowerCase(),
      district: randomChoice(regionData.districts).toLowerCase(),
      address: `${randomInt(1, 100)}-uy, ${randomInt(1, 50)}-ko\'cha`,
      rooms,
      bathrooms,
      area,
      floor,
      totalFloors,
      buildYear: randomInt(2010, 2025),
      condition,
      features,
      hasParking: Math.random() > 0.4,
      hasFurniture: Math.random() > 0.5,
      ownerName: randomChoice(ownerNames),
      ownerPhone: generatePhoneNumber(),
      createdAt: new Date().toISOString(),
    };
    
    houses.push(house);
    await kv.set(`house:${houseId}`, house);
  }
  
  console.log(`✅ Successfully seeded ${houses.length} houses`);
  return houses;
}

export async function clearHouses() {
  console.log('🗑️ Clearing existing houses...');
  const houses = await kv.getByPrefix('house:');
  for (const house of houses) {
    if (house && house.id) {
      await kv.del(`house:${house.id}`);
    }
  }
  console.log(`✅ Cleared ${houses.length} houses`);
}