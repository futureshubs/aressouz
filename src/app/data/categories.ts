export interface Category {
  id: string;
  name: string;
  catalog: string;
  image: string;
}

export interface Catalog {
  id: string;
  name: string;
  image: string;
  categories: Category[];
}

export const catalogs: Catalog[] = [
  {
    id: 'groceries',
    name: 'Oziq-ovqat',
    image: 'https://images.unsplash.com/photo-1543168256-418811576931?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncm9jZXJ5JTIwZm9vZCUyMGluZ3JlZGllbnRzfGVufDF8fHx8MTc3MzE2NjU3M3ww&ixlib=rb-4.1.0&q=80&w=1080',
    categories: [
      { id: 'pasta-cereals', name: 'Makaron va donli mahsulotlar', catalog: 'groceries', image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=800' },
      { id: 'rice', name: 'Guruch', catalog: 'groceries', image: 'https://images.unsplash.com/photo-1536304993881-ff6e9eefa2a6?w=800' },
      { id: 'flour', name: 'Un va undan mahsulotlar', catalog: 'groceries', image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?w=800' },
      { id: 'oil', name: 'Yog\'lar', catalog: 'groceries', image: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=800' },
      { id: 'sugar-salt', name: 'Shakar va tuz', catalog: 'groceries', image: 'https://images.unsplash.com/photo-1587735243615-c03f25aaff15?w=800' },
      { id: 'canned', name: 'Konserva mahsulotlari', catalog: 'groceries', image: 'https://images.unsplash.com/photo-1615485736894-c32045e69ca0?w=800' },
    ]
  },
  {
    id: 'fruits',
    name: 'Mevalar',
    image: 'https://images.unsplash.com/photo-1607130813443-243737c21f7d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMGZydWl0cyUyMGNvbG9yZnVsfGVufDF8fHx8MTc3MzE0OTgzMnww&ixlib=rb-4.1.0&q=80&w=1080',
    categories: [
      { id: 'citrus', name: 'Sitrus mevalar', catalog: 'fruits', image: 'https://images.unsplash.com/photo-1582979512210-99b6a53386f9?w=800' },
      { id: 'stone-fruits', name: 'Shaftoli va o\'rik', catalog: 'fruits', image: 'https://images.unsplash.com/photo-1629828874514-944d8c58a8d6?w=800' },
      { id: 'berries', name: 'Rezavorlar', catalog: 'fruits', image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=800' },
      { id: 'apples-pears', name: 'Olma va nok', catalog: 'fruits', image: 'https://images.unsplash.com/photo-1568702846914-96b305d2aaeb?w=800' },
      { id: 'grapes', name: 'Uzum', catalog: 'fruits', image: 'https://images.unsplash.com/photo-1537640538966-79f369143f8f?w=800' },
      { id: 'bananas', name: 'Banan', catalog: 'fruits', image: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224?w=800' },
      { id: 'melons', name: 'Qovun va tarvuz', catalog: 'fruits', image: 'https://images.unsplash.com/photo-1587049352846-4a222e784eaf?w=800' },
      { id: 'exotic-fruits', name: 'Ekzotik mevalar', catalog: 'fruits', image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800' },
    ]
  },
  {
    id: 'vegetables',
    name: 'Sabzavotlar',
    image: 'https://images.unsplash.com/photo-1748342319942-223b99937d4e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHZlZ2V0YWJsZXMlMjBtYXJrZXR8ZW58MXx8fHwxNzczMTQzODM0fDA&ixlib=rb-4.1.0&q=80&w=1080',
    categories: [
      { id: 'tomatoes', name: 'Pomidor', catalog: 'vegetables', image: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=800' },
      { id: 'cucumbers', name: 'Bodring', catalog: 'vegetables', image: 'https://images.unsplash.com/photo-1604977042946-1eecc30f269e?w=800' },
      { id: 'peppers', name: 'Qalampir', catalog: 'vegetables', image: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=800' },
      { id: 'potatoes', name: 'Kartoshka', catalog: 'vegetables', image: 'https://images.unsplash.com/photo-1518977676601-b53f82aba655?w=800' },
      { id: 'onions-garlic', name: 'Piyoz va sarimsoq', catalog: 'vegetables', image: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800' },
      { id: 'carrots', name: 'Sabzi', catalog: 'vegetables', image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800' },
      { id: 'cabbage', name: 'Karam', catalog: 'vegetables', image: 'https://images.unsplash.com/photo-1594492963122-9e1c1c6e4d2f?w=800' },
      { id: 'greens', name: 'Ko\'katlar', catalog: 'vegetables', image: 'https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1?w=800' },
      { id: 'eggplants', name: 'Baqlajon', catalog: 'vegetables', image: 'https://images.unsplash.com/photo-1659261200833-ec993c441f85?w=800' },
    ]
  },
  {
    id: 'dairy',
    name: 'Poliz mahsulotlari',
    image: 'https://images.unsplash.com/photo-1635714293982-65445548ac42?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkYWlyeSUyMG1pbGslMjBwcm9kdWN0c3xlbnwxfHx8fDE3NzMwNjc0ODl8MA&ixlib=rb-4.1.0&q=80&w=1080',
    categories: [
      { id: 'milk', name: 'Sut', catalog: 'dairy', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=800' },
      { id: 'yogurt', name: 'Qatiq va yogurt', catalog: 'dairy', image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800' },
      { id: 'cottage-cheese', name: 'Tvorog', catalog: 'dairy', image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da?w=800' },
      { id: 'cheese', name: 'Pishloq', catalog: 'dairy', image: 'https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=800' },
      { id: 'butter', name: 'Sariyog\'', catalog: 'dairy', image: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=800' },
      { id: 'sour-cream', name: 'Smetana', catalog: 'dairy', image: 'https://images.unsplash.com/photo-1628012209120-f91745c093a8?w=800' },
      { id: 'cream', name: 'Qaymoq', catalog: 'dairy', image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?w=800' },
    ]
  },
  {
    id: 'meat-poultry',
    name: 'Go\'sht va tovuq',
    image: 'https://images.unsplash.com/photo-1740586222627-48338edac67d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZWF0JTIwYnV0Y2hlciUyMHNob3B8ZW58MXx8fHwxNzczMTAyNjQ2fDA&ixlib=rb-4.1.0&q=80&w=1080',
    categories: [
      { id: 'beef', name: 'Mol go\'shti', catalog: 'meat-poultry', image: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=800' },
      { id: 'lamb', name: 'Qo\'y go\'shti', catalog: 'meat-poultry', image: 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=800' },
      { id: 'chicken', name: 'Tovuq go\'shti', catalog: 'meat-poultry', image: 'https://images.unsplash.com/photo-1604503468506-a8da13d82791?w=800' },
      { id: 'turkey', name: 'Kurka go\'shti', catalog: 'meat-poultry', image: 'https://images.unsplash.com/photo-1626200419199-391ae4be7a41?w=800' },
      { id: 'sausages', name: 'Kolbasa mahsulotlari', catalog: 'meat-poultry', image: 'https://images.unsplash.com/photo-1607623488550-c0f0309ba1ce?w=800' },
      { id: 'frozen-meat', name: 'Muzlatilgan go\'sht', catalog: 'meat-poultry', image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800' },
    ]
  },
  {
    id: 'fish-seafood',
    name: 'Baliq va dengiz mahsulotlari',
    image: 'https://images.unsplash.com/photo-1678976038112-603f4f5374fe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaXNoJTIwc2VhZm9vZCUyMG1hcmtldHxlbnwxfHx8fDE3NzMxNjY1NzV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    categories: [
      { id: 'fresh-fish', name: 'Yangi baliq', catalog: 'fish-seafood', image: 'https://images.unsplash.com/photo-1534943441045-1ec4e50346f8?w=800' },
      { id: 'frozen-fish', name: 'Muzlatilgan baliq', catalog: 'fish-seafood', image: 'https://images.unsplash.com/photo-1599084993091-1cb5c0721cc6?w=800' },
      { id: 'seafood', name: 'Dengiz mahsulotlari', catalog: 'fish-seafood', image: 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=800' },
      { id: 'fish-preserves', name: 'Baliq konservalari', catalog: 'fish-seafood', image: 'https://images.unsplash.com/photo-1580476262798-bddd9f4b7369?w=800' },
      { id: 'caviar', name: 'Ikra', catalog: 'fish-seafood', image: 'https://images.unsplash.com/photo-1630409346138-a7c8f5d5f6df?w=800' },
    ]
  },
  {
    id: 'bakery',
    name: 'Non va non mahsulotlari',
    image: 'https://images.unsplash.com/photo-1674770067314-296af21ad811?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYWtlcnklMjBicmVhZHxlbnwxfHx8fDE3NzMwMzkwNjV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    categories: [
      { id: 'bread', name: 'Non', catalog: 'bakery', image: 'https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=800' },
      { id: 'buns', name: 'Bulka va kulcha', catalog: 'bakery', image: 'https://images.unsplash.com/photo-1551024506-0bccd828d307?w=800' },
      { id: 'pies', name: 'Pirog', catalog: 'bakery', image: 'https://images.unsplash.com/photo-1603532648955-039310d9ed75?w=800' },
      { id: 'lavash', name: 'Lavash va tortilla', catalog: 'bakery', image: 'https://images.unsplash.com/photo-1609501676725-7186f017a4b7?w=800' },
      { id: 'crackers', name: 'Suxariklar', catalog: 'bakery', image: 'https://images.unsplash.com/photo-1597840053361-f30c8d881f75?w=800' },
    ]
  },
  {
    id: 'sweets',
    name: 'Shirinliklar',
    image: 'https://images.unsplash.com/photo-1717095859889-aadb894e8e03?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZXNzZXJ0cyUyMGNha2VzJTIwc3dlZXRzfGVufDF8fHx8MTc3MzE2NjU3Nnww&ixlib=rb-4.1.0&q=80&w=1080',
    categories: [
      { id: 'cakes', name: 'Tortlar', catalog: 'sweets', image: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800' },
      { id: 'cookies', name: 'Pechene', catalog: 'sweets', image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800' },
      { id: 'chocolate', name: 'Shokolad', catalog: 'sweets', image: 'https://images.unsplash.com/photo-1511381939415-e44015466834?w=800' },
      { id: 'candies', name: 'Konfetlar', catalog: 'sweets', image: 'https://images.unsplash.com/photo-1582058091505-f87a2e55a40f?w=800' },
      { id: 'wafers', name: 'Vaflalar', catalog: 'sweets', image: 'https://images.unsplash.com/photo-1606312619070-d48b4a1e6383?w=800' },
      { id: 'halva', name: 'Halva', catalog: 'sweets', image: 'https://images.unsplash.com/photo-1643820424602-34d2d49f8f11?w=800' },
      { id: 'oriental-sweets', name: 'Sharqona shirinliklar', catalog: 'sweets', image: 'https://images.unsplash.com/photo-1610212570907-dc0b2a8a8b7e?w=800' },
    ]
  },
  {
    id: 'drinks',
    name: 'Ichimliklar',
    image: 'https://images.unsplash.com/photo-1650201920760-e5b2abd5e156?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZXZlcmFnZXMlMjBkcmlua3MlMjBib3R0bGVzfGVufDF8fHx8MTc3MzEwMjY0N3ww&ixlib=rb-4.1.0&q=80&w=1080',
    categories: [
      { id: 'water', name: 'Suv', catalog: 'drinks', image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800' },
      { id: 'juice', name: 'Sharbat', catalog: 'drinks', image: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=800' },
      { id: 'soda', name: 'Gazlangan ichimliklar', catalog: 'drinks', image: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=800' },
      { id: 'tea', name: 'Choy', catalog: 'drinks', image: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=800' },
      { id: 'coffee', name: 'Qahva', catalog: 'drinks', image: 'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800' },
      { id: 'energy-drinks', name: 'Energetik ichimliklar', catalog: 'drinks', image: 'https://images.unsplash.com/photo-1622543925917-763c34f6dc50?w=800' },
      { id: 'kvass', name: 'Kvas', catalog: 'drinks', image: 'https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=800' },
    ]
  },
  {
    id: 'ice-cream',
    name: 'Muzqaymoq',
    image: 'https://images.unsplash.com/photo-1606237497150-8c495d2666de?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpY2UlMjBjcmVhbSUyMGNvbG9yZnVsfGVufDF8fHx8MTc3MzE2NjU3N3ww&ixlib=rb-4.1.0&q=80&w=1080',
    categories: [
      { id: 'ice-cream-cone', name: 'Stakanchali muzqaymoq', catalog: 'ice-cream', image: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=800' },
      { id: 'ice-cream-bar', name: 'Eskimo muzqaymoq', catalog: 'ice-cream', image: 'https://images.unsplash.com/photo-1501443762994-82bd5dace89a?w=800' },
      { id: 'ice-cream-pack', name: 'Qadoqli muzqaymoq', catalog: 'ice-cream', image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=800' },
      { id: 'fruit-ice', name: 'Meva muzi', catalog: 'ice-cream', image: 'https://images.unsplash.com/photo-1567206563064-6f60f40a2b57?w=800' },
    ]
  },
  {
    id: 'dried-fruits',
    name: 'Quruq mevalar va yong\'oqlar',
    image: 'https://images.unsplash.com/photo-1702506183897-e4869f155209?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkcmllZCUyMGZydWl0cyUyMG51dHN8ZW58MXx8fHwxNzczMTY2NTc3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    categories: [
      { id: 'dried-fruits', name: 'Quritilgan mevalar', catalog: 'dried-fruits', image: 'https://images.unsplash.com/photo-1607623488445-1e56c49a91dd?w=800' },
      { id: 'nuts', name: 'Yong\'oqlar', catalog: 'dried-fruits', image: 'https://images.unsplash.com/photo-1508747703725-719777637510?w=800' },
      { id: 'seeds', name: 'Urug\'lar', catalog: 'dried-fruits', image: 'https://images.unsplash.com/photo-1594734939896-e4b48ad9726b?w=800' },
      { id: 'dried-berries', name: 'Quritilgan rezavorlar', catalog: 'dried-fruits', image: 'https://images.unsplash.com/photo-1606787366850-de6330128bfc?w=800' },
    ]
  },
  {
    id: 'herbs-spices',
    name: 'Dorivor o\'simliklar va ziravorlar',
    image: 'https://images.unsplash.com/photo-1704597435594-6688c953892a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoZXJicyUyMHNwaWNlcyUyMGluZ3JlZGllbnRzfGVufDF8fHx8MTc3MzE2NjU3N3ww&ixlib=rb-4.1.0&q=80&w=1080',
    categories: [
      { id: 'fresh-herbs', name: 'Yangi ko\'katlar', catalog: 'herbs-spices', image: 'https://images.unsplash.com/photo-1509563607142-2a69c71423bc?w=800' },
      { id: 'dried-herbs', name: 'Quritilgan dorivor o\'simliklar', catalog: 'herbs-spices', image: 'https://images.unsplash.com/photo-1598030413039-64f286c2388c?w=800' },
      { id: 'spices', name: 'Ziravorlar', catalog: 'herbs-spices', image: 'https://images.unsplash.com/photo-1596040033229-a0b3b83738f0?w=800' },
      { id: 'seasoning', name: 'Ziravorlar aralashmasi', catalog: 'herbs-spices', image: 'https://images.unsplash.com/photo-1599909533510-c5c0e9d30435?w=800' },
    ]
  },
  {
    id: 'ready-meals',
    name: 'Tayyor taomlar',
    image: 'https://images.unsplash.com/photo-1769477124202-4b62391da341?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZWFkeSUyMG1lYWxzJTIwcmVzdGF1cmFudHxlbnwxfHx8fDE3NzMxNjY1Nzh8MA&ixlib=rb-4.1.0&q=80&w=1080',
    categories: [
      { id: 'salads', name: 'Salatlar', catalog: 'ready-meals', image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800' },
      { id: 'hot-meals', name: 'Issiq taomlar', catalog: 'ready-meals', image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800' },
      { id: 'side-dishes', name: 'Garnirlar', catalog: 'ready-meals', image: 'https://images.unsplash.com/photo-1608835291093-d2c0b7e41e70?w=800' },
      { id: 'soups', name: 'Sho\'rvalar', catalog: 'ready-meals', image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800' },
      { id: 'fast-food', name: 'Fast food', catalog: 'ready-meals', image: 'https://images.unsplash.com/photo-1561758033-d89a9ad46330?w=800' },
    ]
  },
  {
    id: 'household',
    name: 'Uy-ro\'zg\'or buyumlari',
    image: 'https://images.unsplash.com/photo-1758887262204-a49092d85f15?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxob3VzZWhvbGQlMjBjbGVhbmluZyUyMHByb2R1Y3RzfGVufDF8fHx8MTc3MzEzMjk2MHww&ixlib=rb-4.1.0&q=80&w=1080',
    categories: [
      { id: 'cleaning', name: 'Tozalash vositalari', catalog: 'household', image: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800' },
      { id: 'dishware', name: 'Idishlar', catalog: 'household', image: 'https://images.unsplash.com/photo-1584990347449-39b4aa82e6fc?w=800' },
      { id: 'laundry', name: 'Kir yuvish vositalari', catalog: 'household', image: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=800' },
      { id: 'air-fresheners', name: 'Xushbo\'y qiluvchilar', catalog: 'household', image: 'https://images.unsplash.com/photo-1594664020785-11f1e79a5b0e?w=800' },
      { id: 'trash-bags', name: 'Axlat qoplari', catalog: 'household', image: 'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?w=800' },
    ]
  },
  {
    id: 'hygiene',
    name: 'Shaxsiy gigiyena',
    image: 'https://images.unsplash.com/photo-1628235172251-6b87dab144b3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxoeWdpZW5lJTIwcGVyc29uYWwlMjBjYXJlfGVufDF8fHx8MTc3MzE2NjU3OHww&ixlib=rb-4.1.0&q=80&w=1080',
    categories: [
      { id: 'soap', name: 'Sovun', catalog: 'hygiene', image: 'https://images.unsplash.com/photo-1585128903994-2bd1996ee3c2?w=800' },
      { id: 'shampoo', name: 'Shampun', catalog: 'hygiene', image: 'https://images.unsplash.com/photo-1594293082092-7cf2b0d6b5bf?w=800' },
      { id: 'toothpaste', name: 'Tish pastasi', catalog: 'hygiene', image: 'https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=800' },
      { id: 'toilet-paper', name: 'Hojatxona qog\'ozi', catalog: 'hygiene', image: 'https://images.unsplash.com/photo-1584556326561-c8746083993b?w=800' },
      { id: 'wet-wipes', name: 'Ho\'l salfetka', catalog: 'hygiene', image: 'https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=800' },
      { id: 'diapers', name: 'Podguzniklar', catalog: 'hygiene', image: 'https://images.unsplash.com/photo-1590736969955-71cc94901144?w=800' },
      { id: 'sanitary-pads', name: 'Gigiyena vositalari', catalog: 'hygiene', image: 'https://images.unsplash.com/photo-1581451204624-e832db8e4d28?w=800' },
    ]
  },
];

export function getCatalogById(id: string): Catalog | undefined {
  return catalogs.find(c => c.id === id);
}

export function getCategoriesByCatalog(catalogId: string): Category[] {
  const catalog = getCatalogById(catalogId);
  return catalog?.categories || [];
}

export interface ProductVariant {
  id: string;
  name: string;
  image?: string;
  video?: string;
  price: number;
  oldPrice?: number;
  profitPrice?: number;
  stockQuantity: number;
  soldThisWeek?: number; // Sold this week count
  barcode?: string;
  sku?: string;
  attributes: { name: string; value: string }[];
}

export interface Product {
  id: string;
  name: string;
  catalogId: string;
  categoryId: string;
  description: string;
  recommendation?: string;
  variants: ProductVariant[];
  branchId: string;
  createdAt: string;
  updatedAt: string;
}