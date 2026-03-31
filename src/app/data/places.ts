export interface Place {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  image: string;
  images?: string[]; // Multiple images support
  rating: number;
  reviews: number;
  address: string;
  phone: string;
  coordinates: [number, number]; // [lat, lng]
  isOpen: boolean;
  openingHours?: string;
  description: string;
  services: string[];
  distance: string;
  location?: string;
  region?: string;
  district?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PlaceCategory {
  id: string;
  name: string;
  icon: string;
  image: string;
  count: number;
}

export const placeCategories: PlaceCategory[] = [
  {
    id: 'pharmacy',
    name: 'Dorixona',
    icon: '💊',
    image: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=600&q=80',
    count: 0,
  },
  {
    id: 'night',
    name: 'Kechagi',
    icon: '🌙',
    image: 'https://images.unsplash.com/photo-1555992336-fb0d29498b13?w=600&q=80',
    count: 0,
  },
  {
    id: 'hospital',
    name: 'Shifoxona',
    icon: '🏥',
    image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&q=80',
    count: 0,
  },
  {
    id: 'atm',
    name: 'Bankomat',
    icon: '💳',
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=80',
    count: 0,
  },
  {
    id: 'bank',
    name: 'Bank',
    icon: '🏦',
    image: 'https://images.unsplash.com/photo-1541354329998-f4d9a9f9297f?w=600&q=80',
    count: 0,
  },
  {
    id: 'police',
    name: 'Politsiya',
    icon: '👮',
    image: 'https://images.unsplash.com/photo-1520116468816-95b69f847357?w=600&q=80',
    count: 0,
  },
  {
    id: 'park',
    name: 'Bog\'',
    icon: '🌳',
    image: 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?w=600&q=80',
    count: 0,
  },
  {
    id: 'parking',
    name: 'Avtoturargoh',
    icon: '🅿️',
    image: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=600&q=80',
    count: 0,
  },
  // FOOD & DINING
  {
    id: 'restaurant',
    name: 'Restoran',
    icon: '🍕',
    image: 'https://images.unsplash.com/photo-1756397481872-ed981ef72a51?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50JTIwZGluaW5nJTIwaW50ZXJpb3IlMjBlbGVnYW50fGVufDF8fHx8MTc3MzA4OTgwMXww&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'cafe',
    name: 'Kafe',
    icon: '☕',
    image: 'https://images.unsplash.com/photo-1758181560239-1e5ec8882781?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb2ZmZWUlMjBjYWZlJTIwY296eSUyMGludGVyaW9yfGVufDF8fHx8MTc3MzA4OTgwMXww&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'fastfood',
    name: 'Fast Food',
    icon: '🍔',
    image: 'https://images.unsplash.com/photo-1677825949038-9e2dea0620d0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYXN0JTIwZm9vZCUyMGJ1cmdlciUyMHJlc3RhdXJhbnR8ZW58MXx8fHwxNzczMDI1ODg1fDA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'bakery',
    name: 'Qandolatxona',
    icon: '🍰',
    image: 'https://images.unsplash.com/photo-1737700089128-cbbb2dc71631?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWtlcnklMjBwYXN0cnklMjBjYWtlJTIwc2hvcHxlbnwxfHx8fDE3NzMwODk4MDJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  // SERVICES
  {
    id: 'hotel',
    name: 'Mehmonxona',
    icon: '🏨',
    image: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob3RlbCUyMGx1eHVyeSUyMGludGVyaW9yJTIwbG9iYnl8ZW58MXx8fHwxNzczMDg5ODAyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'supermarket',
    name: 'Supermarket',
    icon: '🏪',
    image: 'https://images.unsplash.com/photo-1601599963565-b7ba29c8e3ff?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdXBlcm1hcmtldCUyMGdyb2NlcnklMjBzdG9yZSUyMGFpc2xlfGVufDF8fHx8MTc3MzA4OTgwMnww&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'barbershop',
    name: 'Sartaroshxona',
    icon: '💈',
    image: 'https://images.unsplash.com/photo-1768938896401-fe52fd18d3af?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYXJiZXJzaG9wJTIwc2Fsb24lMjBpbnRlcmlvcnxlbnwxfHx8fDE3NzMwODEyMTh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'clothing',
    name: 'Kiyim-kechak',
    icon: '👔',
    image: 'https://images.unsplash.com/photo-1761090617068-f1b3257d27ad?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjbG90aGluZyUyMGZhc2hpb24lMjBib3V0aXF1ZSUyMHN0b3JlfGVufDF8fHx8MTc3MzEyMjUwMXww&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'grocery',
    name: 'Oziq-ovqat',
    icon: '🛒',
    image: 'https://images.unsplash.com/photo-1610636996379-4d184e2ef20a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncm9jZXJ5JTIwZm9vZCUyMG1hcmtldCUyMGZyZXNofGVufDF8fHx8MTc3MzEyMjUwMnww&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'stationery',
    name: 'Kantselyar',
    icon: '📝',
    image: 'https://images.unsplash.com/photo-1515054458823-948dc294418d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzdGF0aW9uZXJ5JTIwb2ZmaWNlJTIwc3VwcGxpZXMlMjBzaG9wfGVufDF8fHx8MTc3MzEyMjUwMnww&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'butcher',
    name: 'Qassob xona',
    icon: '🥩',
    image: 'https://images.unsplash.com/photo-1740586222627-48338edac67d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXRjaGVyJTIwbWVhdCUyMHNob3AlMjBtYXJrZXR8ZW58MXx8fHwxNzczMTIyNTAyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'carpets',
    name: 'Gilamlar',
    icon: '🧺',
    image: 'https://images.unsplash.com/photo-1646733704166-58c963521222?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXJwZXQlMjBydWclMjBzdG9yZSUyMHNob3B8ZW58MXx8fHwxNzczMzc5Njk2fDA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'household',
    name: 'Xo\'jalik mollari',
    icon: '🧹',
    image: 'https://images.unsplash.com/photo-1758887262204-a49092d85f15?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob3VzZWhvbGQlMjBnb29kcyUyMGNsZWFuaW5nJTIwc3VwcGxpZXN8ZW58MXx8fHwxNzczMzc5Njk3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'curtains',
    name: 'Parda',
    icon: '🪟',
    image: 'https://images.unsplash.com/photo-1616628188859-7a11abb6fcc9?w=600&q=80',
    count: 0,
  },
  {
    id: 'workshop',
    name: 'Ustaxona',
    icon: '🔨',
    image: 'https://images.unsplash.com/photo-1584677191047-38f48d0db64e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b3Jrc2hvcCUyMHRvb2xzJTIwcmVwYWlyJTIwY3JhZnRzbWFufGVufDF8fHx8MTc3MzEyMjUwM3ww&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'motoservice',
    name: 'Moto ustaxona',
    icon: '🏍️',
    image: 'https://images.unsplash.com/photo-1650569664566-f0014dcf54e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3RvcmN5Y2xlJTIwcmVwYWlyJTIwZ2FyYWdlJTIwbWVjaGFuaWN8ZW58MXx8fHwxNzczMTIyNTAzfDA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'bikeservice',
    name: 'Velik ustaxona',
    icon: '🚴',
    image: 'https://images.unsplash.com/photo-1765376260898-38e465a2cf6f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiaWN5Y2xlJTIwYmlrZSUyMHJlcGFpciUyMHNob3B8ZW58MXx8fHwxNzczMTIyNTA0fDA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'carservice',
    name: 'Avtoservis',
    icon: '🔧',
    image: 'https://images.unsplash.com/photo-1770656505709-fd97236989b9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXIlMjByZXBhaXIlMjBzZXJ2aWNlJTIwbWVjaGFuaWN8ZW58MXx8fHwxNzczMDg5ODAzfDA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'gasstation',
    name: 'Yoqilg\'i quyish',
    icon: '⛽',
    image: 'https://images.unsplash.com/photo-1602853175733-5ad62dc6a2c8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxnYXMlMjBzdGF0aW9uJTIwZnVlbCUyMHBldHJvbCUyMHB1bXB8ZW58MXx8fHwxNzczMDg5ODA2fDA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  // ENTERTAINMENT
  {
    id: 'cinema',
    name: 'Kino',
    icon: '🎬',
    image: 'https://images.unsplash.com/photo-1760170437237-a3654545ab4c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaW5lbWElMjBtb3ZpZSUyMHRoZWF0ZXIlMjBzZWF0c3xlbnwxfHx8fDE3NzI5OTM2NzJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'entertainment',
    name: 'O\'yin-kulgi',
    icon: '🎪',
    image: 'https://images.unsplash.com/photo-1771389805025-fa04791d6aea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbnRlcnRhaW5tZW50JTIwYXJjYWRlJTIwZ2FtaW5nJTIwY2VudGVyfGVufDF8fHx8MTc3MzA4OTgwM3ww&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'gym',
    name: 'Sport zali',
    icon: '🏋️',
    image: 'https://images.unsplash.com/photo-1637579674775-7f868ee3c92d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXRuZXNzJTIwZ3lmJTIwZXF1aXBtZW50JTIwd29ya291dHxlbnwxfHx8fDE3NzMwODk4MDR8MA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'theater',
    name: 'Teatr',
    icon: '🎭',
    image: 'https://images.unsplash.com/photo-1722321974501-059dff03e970?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0aGVhdGVyJTIwc3RhZ2UlMjBwZXJmb3JtYW5jZSUyMGhhbGx8ZW58MXx8fHwxNzczMDg5ODA0fDA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  // EDUCATION
  {
    id: 'school',
    name: 'Maktab',
    icon: '🏫',
    image: 'https://images.unsplash.com/photo-1731865745081-4aeb28e2bc57?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzY2hvb2wlMjBjbGFzc3Jvb20lMjBlZHVjYXRpb24lMjBidWlsZGluZ3xlbnwxfHx8fDE3NzMwMjA4OTh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'university',
    name: 'Universitet',
    icon: '🎓',
    image: 'https://images.unsplash.com/photo-1631599143468-b7d2d09820b6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx1bml2ZXJzaXR5JTIwY2FtcHVzJTIwYnVpbGRpbmclMjBzdHVkZW50c3xlbnwxfHx8fDE3NzMwMjkzOTh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'library',
    name: 'Kutubxona',
    icon: '📚',
    image: 'https://images.unsplash.com/photo-1709924168698-620ea32c3488?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsaWJyYXJ5JTIwYm9va3MlMjBzaGVsdmVzJTIwcmVhZGluZ3xlbnwxfHx8fDE3NzMwMzkwMDl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  // TRANSPORT
  {
    id: 'metro',
    name: 'Metro',
    icon: '🚇',
    image: 'https://images.unsplash.com/photo-1627283699152-856a72b66471?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZXRybyUyMHN1YndheSUyMHN0YXRpb24lMjB0cmFpbnxlbnwxfHx8fDE3NzMwODk4MDV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'bus',
    name: 'Avtobus',
    icon: '🚌',
    image: 'https://images.unsplash.com/photo-1580585473178-bc95a653f652?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxidXMlMjBzdGF0aW9uJTIwcHVibGljJTIwdHJhbnNwb3J0fGVufDF8fHx8MTc3MzA4OTgwNnww&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
  {
    id: 'taxi',
    name: 'Taksi',
    icon: '🚕',
    image: 'https://images.unsplash.com/photo-1664353655821-debedc55dda1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0YXhpJTIwY2FiJTIweYllbG93JTIwY2FyfGVufDF8fHx8MTc3MzA4OTgwNnww&ixlib=rb-4.1.0&q=80&w=1080',
    count: 0,
  },
];