export interface Restaurant {
  id: string;
  name: string;
  description: string;
  image: string;
  logo: string;
  rating: number;
  reviews: number;
  category: string;
  cuisine: string[];
  address: string;
  phone: string;
  workingHours: string;
  isOpen: boolean;
  deliveryTime: string;
  minOrder: number;
  deliveryFee: number;
  tags: string[];
  foods: Food[];
}

export interface Food {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  rating: number;
  weight: string;
  calories: number;
  isPopular: boolean;
  isVegetarian: boolean;
  isSpicy: boolean;
  addons: Addon[];
}

export interface Addon {
  id: string;
  name: string;
  price: number;
}

export const restaurants: Restaurant[] = [
  {
    id: "rest-1",
    name: "Bellissimo Pizza",
    description: "O'zbekistondagi eng yaxshi italyan pizza. Napoli uslubida tayyorlangan original pizza va pasta",
    image: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200&q=80",
    logo: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200&q=80",
    rating: 4.9,
    reviews: 2547,
    category: "Pizza",
    cuisine: ["Italyan", "Pizza", "Pasta"],
    address: "Toshkent, Amir Temur ko'chasi 42",
    phone: "+998 90 111 22 33",
    workingHours: "10:00 - 23:00",
    isOpen: true,
    deliveryTime: "25-35 min",
    minOrder: 50000,
    deliveryFee: 15000,
    tags: ["Tez yetkazish", "Halol", "Premium"],
    foods: [
      {
        id: "food-1",
        name: "Margarita Pizza",
        description: "Klassik italyan pizza - mozzarella, pomidor sousi, rayhan",
        price: 65000,
        image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80",
        category: "Pizza",
        rating: 4.9,
        weight: "450g",
        calories: 820,
        isPopular: true,
        isVegetarian: true,
        isSpicy: false,
        addons: [
          { id: "addon-1", name: "Qo'shimcha pishloq", price: 10000 },
          { id: "addon-2", name: "Zaytun", price: 8000 },
          { id: "addon-3", name: "Qo'ziqorin", price: 12000 },
          { id: "addon-4", name: "Pomidor", price: 7000 }
        ]
      },
      {
        id: "food-2",
        name: "Pepperoni Pizza",
        description: "Pepperoni kolbasa, mozzarella, pomidor sousi",
        price: 85000,
        image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?w=600&q=80",
        category: "Pizza",
        rating: 4.8,
        weight: "500g",
        calories: 980,
        isPopular: true,
        isVegetarian: false,
        isSpicy: true,
        addons: [
          { id: "addon-5", name: "Ko'proq pepperoni", price: 15000 },
          { id: "addon-6", name: "Achchiq sous", price: 5000 },
          { id: "addon-7", name: "Ranch sous", price: 8000 }
        ]
      },
      {
        id: "food-3",
        name: "Pasta Carbonara",
        description: "Klassik italyan pasta - tuxum, parmesan, pancetta",
        price: 55000,
        image: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600&q=80",
        category: "Pasta",
        rating: 4.7,
        weight: "350g",
        calories: 650,
        isPopular: false,
        isVegetarian: false,
        isSpicy: false,
        addons: [
          { id: "addon-8", name: "Parmesan", price: 12000 },
          { id: "addon-9", name: "Qora murch", price: 5000 }
        ]
      }
    ]
  },
  {
    id: "rest-2",
    name: "Sushi Master",
    description: "Yaponiya taomlarining professional ustalari. Fresh sushi, rollar va wok",
    image: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=1200&q=80",
    logo: "https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=200&q=80",
    rating: 4.8,
    reviews: 1876,
    category: "Sushi",
    cuisine: ["Yaponiya", "Sushi", "Wok"],
    address: "Toshkent, Buyuk Ipak Yo'li 156",
    phone: "+998 90 222 33 44",
    workingHours: "11:00 - 01:00",
    isOpen: true,
    deliveryTime: "35-45 min",
    minOrder: 70000,
    deliveryFee: 20000,
    tags: ["Fresh", "Premium", "Halol"],
    foods: [
      {
        id: "food-4",
        name: "Kaliforniya Roll",
        description: "Klassik roll - qisqichbaqa go'shti, avokado, bodring",
        price: 45000,
        image: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=600&q=80",
        category: "Roll",
        rating: 4.9,
        weight: "240g",
        calories: 420,
        isPopular: true,
        isVegetarian: false,
        isSpicy: false,
        addons: [
          { id: "addon-10", name: "Imbir", price: 5000 },
          { id: "addon-11", name: "Wasabi", price: 5000 },
          { id: "addon-12", name: "Soya sousi", price: 3000 }
        ]
      },
      {
        id: "food-5",
        name: "Philadelphia Roll",
        description: "Premium roll - losos, krem pishloq, bodring",
        price: 65000,
        image: "https://images.unsplash.com/photo-1617196035796-b6e6c0a4e909?w=600&q=80",
        category: "Roll",
        rating: 4.9,
        weight: "280g",
        calories: 520,
        isPopular: true,
        isVegetarian: false,
        isSpicy: false,
        addons: [
          { id: "addon-13", name: "Ko'proq losos", price: 20000 },
          { id: "addon-14", name: "Tobiko", price: 15000 }
        ]
      }
    ]
  },
  {
    id: "rest-3",
    name: "Burger House",
    description: "Premium burgerlar va qarsildoq kartoshka fri. 100% halol go'sht",
    image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=1200&q=80",
    logo: "https://images.unsplash.com/photo-1550547660-d9450f859349?w=200&q=80",
    rating: 4.7,
    reviews: 3421,
    category: "Burger",
    cuisine: ["Amerikan", "Burger", "Fast Food"],
    address: "Toshkent, Mustaqillik 78",
    phone: "+998 90 333 44 55",
    workingHours: "09:00 - 02:00",
    isOpen: true,
    deliveryTime: "20-30 min",
    minOrder: 40000,
    deliveryFee: 12000,
    tags: ["Tez", "Halol", "Katta porsiya"],
    foods: [
      {
        id: "food-6",
        name: "Classic Cheeseburger",
        description: "Mol go'shti, cheddar, pomidor, salat, sous",
        price: 42000,
        image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80",
        category: "Burger",
        rating: 4.8,
        weight: "320g",
        calories: 720,
        isPopular: true,
        isVegetarian: false,
        isSpicy: false,
        addons: [
          { id: "addon-15", name: "Qo'shimcha go'sht", price: 18000 },
          { id: "addon-16", name: "Bacon", price: 15000 },
          { id: "addon-17", name: "BBQ sous", price: 5000 }
        ]
      },
      {
        id: "food-7",
        name: "Spicy Chicken Burger",
        description: "Achchiq tovuq, jalapeno, achchiq sous, salat",
        price: 38000,
        image: "https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=600&q=80",
        category: "Burger",
        rating: 4.6,
        weight: "280g",
        calories: 650,
        isPopular: false,
        isVegetarian: false,
        isSpicy: true,
        addons: [
          { id: "addon-18", name: "Extra achchiq", price: 8000 },
          { id: "addon-19", name: "Cheese sauce", price: 7000 }
        ]
      }
    ]
  },
  {
    id: "rest-4",
    name: "Osh Markazi",
    description: "O'zbek milliy taomlar - osh, lagman, manti va boshqalar",
    image: "https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=1200&q=80",
    logo: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?w=200&q=80",
    rating: 4.9,
    reviews: 4523,
    category: "O'zbek",
    cuisine: ["O'zbek", "Milliy", "Osh"],
    address: "Toshkent, Chilonzor 23",
    phone: "+998 90 444 55 66",
    workingHours: "07:00 - 22:00",
    isOpen: true,
    deliveryTime: "30-40 min",
    minOrder: 30000,
    deliveryFee: 10000,
    tags: ["Milliy", "Katta porsiya", "Uy taomi"],
    foods: [
      {
        id: "food-8",
        name: "Toshkent Oshi",
        description: "Klassik toshkent oshi - qo'y go'shti, sabzi, guruch",
        price: 32000,
        image: "https://images.unsplash.com/photo-1617093727343-374698b1b08d?w=600&q=80",
        category: "Osh",
        rating: 5.0,
        weight: "500g",
        calories: 850,
        isPopular: true,
        isVegetarian: false,
        isSpicy: false,
        addons: [
          { id: "addon-20", name: "Qo'shimcha go'sht", price: 15000 },
          { id: "addon-21", name: "Salat", price: 8000 },
          { id: "addon-22", name: "Achichuk", price: 7000 }
        ]
      },
      {
        id: "food-9",
        name: "Lag'mon",
        description: "Uyda tayyorlangan gamon, mol go'shti, sabzavotlar",
        price: 28000,
        image: "https://images.unsplash.com/photo-1612927601601-6638404737ce?w=600&q=80",
        category: "Suyuq taom",
        rating: 4.8,
        weight: "450g",
        calories: 680,
        isPopular: true,
        isVegetarian: false,
        isSpicy: false,
        addons: [
          { id: "addon-23", name: "Qo'shimcha gamon", price: 10000 },
          { id: "addon-24", name: "Sirka", price: 3000 }
        ]
      }
    ]
  },
  {
    id: "rest-5",
    name: "Asian Kitchen",
    description: "Osiyolik taomlar - Xitoy, Tailand, Vetnam oshxonasi",
    image: "https://images.unsplash.com/photo-1559311047-8b0c4f53324a?w=1200&q=80",
    logo: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=200&q=80",
    rating: 4.6,
    reviews: 1234,
    category: "Osiyo",
    cuisine: ["Xitoy", "Tailand", "Wok"],
    address: "Toshkent, Yunusabad 45",
    phone: "+998 90 555 66 77",
    workingHours: "10:00 - 23:00",
    isOpen: true,
    deliveryTime: "30-40 min",
    minOrder: 45000,
    deliveryFee: 15000,
    tags: ["Ekzotik", "Achchiq", "Wok"],
    foods: [
      {
        id: "food-10",
        name: "Pad Thai",
        description: "Tailandlik noodles - tovuq, yeryong'oq, limon",
        price: 48000,
        image: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=600&q=80",
        category: "Noodles",
        rating: 4.7,
        weight: "380g",
        calories: 620,
        isPopular: true,
        isVegetarian: false,
        isSpicy: true,
        addons: [
          { id: "addon-25", name: "Ko'proq tovuq", price: 12000 },
          { id: "addon-26", name: "Achchiq sous", price: 6000 }
        ]
      }
    ]
  },
  {
    id: "rest-6",
    name: "Kebab King",
    description: "Shashliq va kaboblar mutaxassisi. Eng mazali kebablar",
    image: "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=1200&q=80",
    logo: "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=200&q=80",
    rating: 4.8,
    reviews: 2876,
    category: "Kebab",
    cuisine: ["Turk", "Kebab", "Gril"],
    address: "Toshkent, Shota Rustaveli 67",
    phone: "+998 90 666 77 88",
    workingHours: "11:00 - 01:00",
    isOpen: true,
    deliveryTime: "35-50 min",
    minOrder: 60000,
    deliveryFee: 18000,
    tags: ["Halol", "Gril", "Premium go'sht"],
    foods: [
      {
        id: "food-11",
        name: "Qo'y Kabob",
        description: "Qo'y go'shtidan tayyorlangan an'anaviy kabob",
        price: 45000,
        image: "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=600&q=80",
        category: "Kabob",
        rating: 4.9,
        weight: "300g",
        calories: 580,
        isPopular: true,
        isVegetarian: false,
        isSpicy: false,
        addons: [
          { id: "addon-27", name: "Lavash", price: 5000 },
          { id: "addon-28", name: "Piyoz", price: 4000 },
          { id: "addon-29", name: "Achichuk", price: 7000 }
        ]
      }
    ]
  }
];
