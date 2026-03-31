export interface HouseCategory {
  id: string;
  name: string;
  icon: string;
  image: string;
  count: number;
}

export interface House {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  price: number;
  currency: 'USD' | 'UZS';
  priceType?: 'sale' | 'rent';
  propertyType?: 'apartment' | 'house' | 'commercial' | 'land' | 'cottage' | 'office';
  images: string[];
  panoramaScenes?: {
    id: string;
    title: string;
    imageUrl: string;
    hotSpots?: {
      pitch: number;
      yaw: number;
      type: 'scene' | 'info';
      text?: string;
      sceneId?: string;
    }[];
  }[];
  region: string;
  district: string;
  address: string;
  rooms: number;
  bathrooms: number;
  area: number;
  floor: number;
  totalFloors: number;
  buildYear: number;
  condition: 'yangi' | 'ta\'mirlangan' | 'oddiy';
  features: string[];
  hasParking: boolean;
  hasFurniture: boolean;
  hasElevator?: boolean;
  hasBalcony?: boolean;
  hasMortgage?: boolean;
  mortgageBank?: string;
  mortgagePercent?: number;
  mortgagePeriod?: number;
  hasHalalInstallment?: boolean;
  halalInstallmentBank?: string;
  halalInstallmentMonths?: number;
  halalDownPayment?: number;
  contactName?: string;
  contactPhone?: string;
  coordinates?: [number, number];
  ownerName: string;
  ownerPhone: string;
  createdAt: string;
  creditAvailable?: boolean;
  mortgageAvailable?: boolean;
  creditTerm?: number;
  creditInterestRate?: number;
  initialPayment?: number;
}

export const houseCategories: HouseCategory[] = [
  {
    id: 'kvartira',
    name: 'Kvartira',
    icon: '🏢',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/photo_2026-03-10_01-14-23.jpg',
    count: 0
  },
  {
    id: 'villa',
    name: 'Villa',
    icon: '🏘️',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/photo_2026-03-10_01-15-24.jpg',
    count: 0
  },
  {
    id: 'hovli',
    name: 'Hovli uyi',
    icon: '🏡',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/Gemini_Generated_Image_s963ats963ats963.png',
    count: 0
  },
  {
    id: 'townhouse',
    name: 'Townhouse',
    icon: '🏘️',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/Gemini_Generated_Image_x4lirax4lirax4li.png',
    count: 0
  },
  {
    id: 'penthouse',
    name: 'Penthouse',
    icon: '🏙️',
    image: 'https://pub-1c027d2f9750410cb661aea454f4861c.r2.dev/Katalog%20avto%20katalog/uy%20katigorya/Gemini_Generated_Image_en7uwken7uwken7u.png',
    count: 0
  },
  {
    id: 'office',
    name: 'Ofis',
    icon: '🏢',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=800',
    count: 0
  },
];

// Calculate payment schedules for Uzbekistan market
export function calculatePayment(
  price: number,
  downPaymentPercent: number,
  years: number,
  annualRate: number = 22 // Average rate in Uzbekistan
): {
  downPayment: number;
  loanAmount: number;
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
} {
  const downPayment = (price * downPaymentPercent) / 100;
  const loanAmount = price - downPayment;
  const monthlyRate = annualRate / 100 / 12;
  const months = years * 12;
  
  // Monthly payment formula: P * [r(1+r)^n] / [(1+r)^n - 1]
  const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
  const totalPayment = downPayment + (monthlyPayment * months);
  const totalInterest = totalPayment - price;
  
  return {
    downPayment,
    loanAmount,
    monthlyPayment,
    totalPayment,
    totalInterest
  };
}

// Payment plans for Uzbekistan
export const paymentPlans = [
  { years: 3, label: '3 yil', rate: 20 },
  { years: 6, label: '6 yil', rate: 21 },
  { years: 12, label: '12 yil', rate: 22 },
  { years: 20, label: '20 yil', rate: 24 },
];

// Format currency based on type
export function formatCurrency(amount: number, currency: 'USD' | 'UZS'): string {
  if (currency === 'UZS') {
    return new Intl.NumberFormat('uz-UZ', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}