export interface Store {
  id: string;
  name: string;
  description: string;
  image: string;
  logo: string;
  rating: number;
  reviews: number;
  category: string;
  address: string;
  phone: string;
  workingHours: string;
  isOpen: boolean;
  deliveryTime: string;
  minOrder: number;
  deliveryFee: number;
  tags: string[];
  products: StoreProduct[];
}

export interface StoreProduct {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  inStock: boolean;
}

export const stores: Store[] = [
  {
    id: "store-1",
    name: "TechMart Elektronika",
    description: "Toshkentdagi eng yaxshi elektronika do'koni. Rasmiy Apple, Samsung va boshqa brendlar",
    image: "https://images.unsplash.com/photo-1601524909162-ae8725290836?w=1200&q=80",
    logo: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=200&q=80",
    rating: 4.8,
    reviews: 1247,
    category: "Elektronika",
    address: "Toshkent, Amir Temur ko'chasi 129",
    phone: "+998 90 123 45 67",
    workingHours: "09:00 - 21:00",
    isOpen: true,
    deliveryTime: "45-60 min",
    minOrder: 100000,
    deliveryFee: 25000,
    tags: ["Tez yetkazish", "Kafolat", "Rasmiy"],
    products: [
      {
        id: "p1",
        name: "iPhone 15 Pro",
        price: 15999000,
        image: "https://images.unsplash.com/photo-1761907174062-c8baf8b7edb3?w=400&q=80",
        description: "256GB Natural Titanium",
        inStock: true
      },
      {
        id: "p2",
        name: "MacBook Air M3",
        price: 13999000,
        image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&q=80",
        description: "13-inch, 8GB RAM, 256GB SSD",
        inStock: true
      },
      {
        id: "p3",
        name: "AirPods Pro",
        price: 2999000,
        image: "https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=400&q=80",
        description: "2-chi avlod, Type-C",
        inStock: true
      }
    ]
  },
  {
    id: "store-2",
    name: "Digital World",
    description: "Zamonaviy gadjetlar va aksessuarlar. Samsung, Xiaomi, Huawei rasmiy dileri",
    image: "https://images.unsplash.com/photo-1531747056595-07f6cbbe10ad?w=1200&q=80",
    logo: "https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=200&q=80",
    rating: 4.6,
    reviews: 856,
    category: "Elektronika",
    address: "Toshkent, Buyuk Ipak Yo'li 87",
    phone: "+998 90 234 56 78",
    workingHours: "10:00 - 20:00",
    isOpen: true,
    deliveryTime: "30-45 min",
    minOrder: 50000,
    deliveryFee: 20000,
    tags: ["Chegirma", "Aksiya", "24/7 Qo'llab-quvvatlash"],
    products: [
      {
        id: "p4",
        name: "Samsung Galaxy S24 Ultra",
        price: 14499000,
        image: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=400&q=80",
        description: "512GB Titanium Gray",
        inStock: true
      },
      {
        id: "p5",
        name: "Galaxy Watch 6",
        price: 3499000,
        image: "https://images.unsplash.com/photo-1579586337278-3befd40fd17a?w=400&q=80",
        description: "44mm, LTE",
        inStock: true
      }
    ]
  },
  {
    id: "store-3",
    name: "Audio Pro",
    description: "Professional audio qurilmalar va aksessuarlar. Sony, Bose, JBL mahsulotlari",
    image: "https://images.unsplash.com/photo-1545127398-14699f92334b?w=1200&q=80",
    logo: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=200&q=80",
    rating: 4.9,
    reviews: 432,
    category: "Audio",
    address: "Toshkent, Mustaqillik 45",
    phone: "+998 90 345 67 89",
    workingHours: "09:30 - 21:30",
    isOpen: true,
    deliveryTime: "60-90 min",
    minOrder: 150000,
    deliveryFee: 30000,
    tags: ["Premium", "Professional", "Sound Test"],
    products: [
      {
        id: "p6",
        name: "Sony WH-1000XM5",
        price: 4299000,
        image: "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?w=400&q=80",
        description: "Wireless Noise Cancelling",
        inStock: true
      },
      {
        id: "p7",
        name: "Bose QuietComfort",
        price: 3799000,
        image: "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=400&q=80",
        description: "Ultra Premium Headphones",
        inStock: false
      }
    ]
  },
  {
    id: "store-4",
    name: "GameZone",
    description: "Gaming konsol va aksessuarlar. PlayStation, Xbox, Nintendo mahsulotlari",
    image: "https://images.unsplash.com/photo-1560419450-047f5f54d6fb?w=1200&q=80",
    logo: "https://images.unsplash.com/photo-1511512578047-dfb367046420?w=200&q=80",
    rating: 4.7,
    reviews: 923,
    category: "Gaming",
    address: "Toshkent, Shota Rustaveli 23",
    phone: "+998 90 456 78 90",
    workingHours: "11:00 - 23:00",
    isOpen: true,
    deliveryTime: "40-60 min",
    minOrder: 200000,
    deliveryFee: 35000,
    tags: ["Gaming", "Trade-in", "Pre-order"],
    products: [
      {
        id: "p8",
        name: "PlayStation 5",
        price: 6499000,
        image: "https://images.unsplash.com/photo-1695028644151-1ec92bae9fb0?w=400&q=80",
        description: "Digital Edition + Controller",
        inStock: true
      },
      {
        id: "p9",
        name: "Xbox Series X",
        price: 5999000,
        image: "https://images.unsplash.com/photo-1621259182978-fbf93132d53d?w=400&q=80",
        description: "1TB SSD",
        inStock: true
      }
    ]
  },
  {
    id: "store-5",
    name: "Smart Home Center",
    description: "Aqlli uy qurilmalari. Xiaomi Smart Home, Yandex, Apple HomeKit",
    image: "https://images.unsplash.com/photo-1558002038-1055907df827?w=1200&q=80",
    logo: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=200&q=80",
    rating: 4.5,
    reviews: 678,
    category: "Smart Home",
    address: "Toshkent, Chilonzor 12",
    phone: "+998 90 567 89 01",
    workingHours: "10:00 - 22:00",
    isOpen: false,
    deliveryTime: "90-120 min",
    minOrder: 100000,
    deliveryFee: 25000,
    tags: ["Smart Home", "O'rnatish", "Konsultatsiya"],
    products: [
      {
        id: "p10",
        name: "Xiaomi Robot Vacuum",
        price: 2999000,
        image: "https://images.unsplash.com/photo-1625945930092-ea31e6f0ed24?w=400&q=80",
        description: "S10 Ultra, Mop va Vacuum",
        inStock: true
      }
    ]
  },
  {
    id: "store-6",
    name: "Camera World",
    description: "Professional fotografiya va videografiya uchun qurilmalar. Canon, Sony, Nikon",
    image: "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=1200&q=80",
    logo: "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=200&q=80",
    rating: 4.9,
    reviews: 345,
    category: "Photo & Video",
    address: "Toshkent, Yunusabad 34",
    phone: "+998 90 678 90 12",
    workingHours: "09:00 - 20:00",
    isOpen: true,
    deliveryTime: "60-75 min",
    minOrder: 500000,
    deliveryFee: 40000,
    tags: ["Professional", "Rent", "Repair"],
    products: [
      {
        id: "p11",
        name: "Sony A7 IV",
        price: 28999000,
        image: "https://images.unsplash.com/photo-1729655669048-a667a0b01148?w=400&q=80",
        description: "Full Frame Mirrorless",
        inStock: true
      }
    ]
  }
];
