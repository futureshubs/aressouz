import * as kv from "./kv_store.tsx";

export interface Car {
  id: string;
  name: string;
  brand: string;
  model: string;
  year: number;
  price: number;
  mileage: number;
  fuel: string;
  transmission: string;
  color: string;
  description: string;
  images: string[];
  categoryId: string;
  region: string;
  district: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  phone: string;
  condition: 'new' | 'used';
  engineVolume?: number;
  bodyType?: string;
  driveType?: string;
  features?: string[];
  paymentTypes?: string[];
}

export async function seedCars() {
  const cars: Car[] = [
    {
      id: 'car-1',
      name: 'Tesla Model 3',
      brand: 'Tesla',
      model: 'Model 3',
      year: 2024,
      price: 45000,
      mileage: 0,
      fuel: 'electric',
      transmission: 'automatic',
      color: 'Oq',
      description: 'Yangi elektr avtomobili. Premium komplektatsiya, avtopilot.',
      images: ['https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800'],
      categoryId: 'electric',
      region: 'Toshkent',
      district: 'Yunusobod',
      userId: 'seed-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      phone: '998901234567',
      condition: 'new',
      engineVolume: 0,
      bodyType: 'Sedan',
      driveType: 'Oldingi',
      features: ['Avtopilot', 'Premium audio', 'Isitish', 'Panorama tom', 'Teri salon'],
      paymentTypes: ['cash', 'credit', 'mortgage'],
    },
    {
      id: 'car-2',
      name: 'Toyota Camry',
      brand: 'Toyota',
      model: 'Camry',
      year: 2023,
      price: 35000,
      mileage: 15000,
      fuel: 'petrol',
      transmission: 'automatic',
      color: 'Qora',
      description: 'A\'lo holatda Toyota Camry. Barcha qo\'shimcha jihozlar bilan.',
      images: ['https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?w=800'],
      categoryId: 'sedan',
      region: 'Andijon viloyati',
      district: 'Andijon shahri',
      userId: 'seed-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      phone: '998901234568',
      condition: 'used',
      engineVolume: 2.5,
      bodyType: 'Sedan',
      driveType: 'Oldingi',
      features: ['Klimat kontrol', 'Teri salon', 'ABS', 'Havo yostiqlari', 'Multimedia'],
      paymentTypes: ['cash', 'credit'],
    },
    {
      id: 'car-3',
      name: 'BMW X5',
      brand: 'BMW',
      model: 'X5',
      year: 2022,
      price: 65000,
      mileage: 25000,
      fuel: 'diesel',
      transmission: 'automatic',
      color: 'Kulrang',
      description: 'Premium krossover. Sport komplektatsiya, panorama tom.',
      images: ['https://images.unsplash.com/photo-1555215695-3004980ad54e?w=800'],
      categoryId: 'suv',
      region: 'Toshkent',
      district: 'Chilonzor',
      userId: 'seed-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      phone: '998901234569',
      condition: 'used',
      engineVolume: 3.0,
      bodyType: 'SUV',
      driveType: 'To\'liq',
      features: ['Sport paket', 'Panorama tom', 'Teri salon', 'Isitish', 'Premium audio', 'Kamera'],
      paymentTypes: ['cash', 'mortgage'],
    },
  ];

  for (const car of cars) {
    await kv.set(`car:${car.id}`, car);
  }

  return cars;
}

export async function clearCars() {
  const allCars = await kv.getByPrefix('car:');
  for (const car of allCars) {
    await kv.del(`car:${car.id}`);
  }
}