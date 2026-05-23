export type PlaceCategoryGroupId =
  | 'health'
  | 'finance'
  | 'gov'
  | 'food'
  | 'shopping'
  | 'services'
  | 'entertainment'
  | 'education'
  | 'transport'
  | 'public';

export type PlaceCategoryDef = {
  id: string;
  name: string;
  icon: string;
  image: string;
  groupId: PlaceCategoryGroupId;
};

const img = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=600&q=80`;

export const PLACE_CATEGORY_GROUPS: { id: PlaceCategoryGroupId; label: string }[] = [
  { id: 'health', label: "Shoshilinch & Sog'liq" },
  { id: 'finance', label: 'Moliya & Bank' },
  { id: 'gov', label: 'Xavfsizlik & Davlat' },
  { id: 'food', label: 'Ovqatlanish' },
  { id: 'shopping', label: "Xarid & Do'konlar" },
  { id: 'services', label: 'Xizmatlar' },
  { id: 'entertainment', label: "O'yin-kulgi & Sport" },
  { id: 'education', label: "Ta'lim" },
  { id: 'transport', label: 'Transport' },
  { id: 'public', label: 'Jamoat & Dam olish' },
];

/** To‘liq joy kategoriyalari katalogi */
export const PLACE_CATEGORY_CATALOG: PlaceCategoryDef[] = [
  // —— Sog'liq ——
  { id: 'pharmacy', name: 'Dorixona', icon: '💊', groupId: 'health', image: img('photo-1576602976047-174e57a47881') },
  { id: 'night', name: 'Kechagi dorixona', icon: '🌙', groupId: 'health', image: img('photo-1555992336-fb0d29498b13') },
  { id: 'hospital', name: 'Shifoxona', icon: '🏥', groupId: 'health', image: img('photo-1519494026892-80bbd2d6fd0d') },
  { id: 'clinic', name: 'Klinika', icon: '🩺', groupId: 'health', image: img('photo-1516549655169-ef392064422a') },
  { id: 'dental', name: 'Stomatologiya', icon: '🦷', groupId: 'health', image: img('photo-1606811848671-5bcf054f107b') },
  { id: 'lab', name: 'Laboratoriya', icon: '🧪', groupId: 'health', image: img('photo-1579154204601-01588f258e78') },
  { id: 'optometry', name: 'Ko‘z klinikasi', icon: '👓', groupId: 'health', image: img('photo-1574253457654-155139b587a8') },
  { id: 'veterinary', name: 'Veterinariya', icon: '🐾', groupId: 'health', image: img('photo-1628009360301-b1b645e0437b') },

  // —— Moliya ——
  { id: 'bank', name: 'Bank', icon: '🏦', groupId: 'finance', image: img('photo-1541354329998-f4d9a9f9297f') },
  { id: 'atm', name: 'Bankomat', icon: '💳', groupId: 'finance', image: img('photo-1556742049-0cfed4f6a45d') },
  { id: 'exchange', name: 'Valyuta ayirboshlash', icon: '💱', groupId: 'finance', image: img('photo-1611974789855-9c98a281a365') },
  { id: 'insurance', name: 'Sug‘urta', icon: '🛡️', groupId: 'finance', image: img('photo-1450101499163-c8848c66ca85') },
  { id: 'microfinance', name: 'Mikmoliya', icon: '💰', groupId: 'finance', image: img('photo-1554224155-6726b3ff858f') },

  // —— Davlat ——
  { id: 'police', name: 'Politsiya', icon: '👮', groupId: 'gov', image: img('photo-1520116468816-95b69f847357') },
  { id: 'fire', name: 'Yong‘in xavfsizligi', icon: '🚒', groupId: 'gov', image: img('photo-1541339907198-e08756dedf3d') },
  { id: 'govoffice', name: 'Davlat xizmati', icon: '🏛️', groupId: 'gov', image: img('photo-1449824913935-59a10b8d2000') },
  { id: 'notary', name: 'Notarius', icon: '📜', groupId: 'gov', image: img('photo-1450101499163-c8848c66ca85') },
  { id: 'post', name: 'Pochta', icon: '📮', groupId: 'gov', image: img('photo-1566576912321-d58ddd7a6088') },

  // —— Ovqat ——
  { id: 'restaurant', name: 'Restoran', icon: '🍕', groupId: 'food', image: img('photo-1756397481872-ed981ef72a51') },
  { id: 'cafe', name: 'Kafe', icon: '☕', groupId: 'food', image: img('photo-1758181560239-1e5ec8882781') },
  { id: 'fastfood', name: 'Fast Food', icon: '🍔', groupId: 'food', image: img('photo-1677825949038-9e2dea0620d0') },
  { id: 'bakery', name: 'Qandolatxona', icon: '🍰', groupId: 'food', image: img('photo-1737700089128-cbbb2dc71631') },
  { id: 'teahouse', name: 'Chaixona', icon: '🫖', groupId: 'food', image: img('photo-1556679343-c7306c1976bc') },
  { id: 'bar', name: 'Bar / Pub', icon: '🍸', groupId: 'food', image: img('photo-1514362545857-3bc16c4c7d1f') },
  { id: 'national', name: 'Milliy taom', icon: '🍲', groupId: 'food', image: img('photo-1556910103-1c02745aae4d') },

  // —— Xarid ——
  { id: 'supermarket', name: 'Supermarket', icon: '🏪', groupId: 'shopping', image: img('photo-1601599963565-b7ba29c8e3ff') },
  { id: 'grocery', name: 'Oziq-ovqat', icon: '🛒', groupId: 'shopping', image: img('photo-1610636996379-4d184e2ef20a') },
  { id: 'market', name: 'Bozor', icon: '🧺', groupId: 'shopping', image: img('photo-1488459716781-31db525ade86') },
  { id: 'clothing', name: 'Kiyim-kechak', icon: '👔', groupId: 'shopping', image: img('photo-1761090617068-f1b3257d27ad') },
  { id: 'shoes', name: 'Poyabzal', icon: '👟', groupId: 'shopping', image: img('photo-1542291026-7eec264c27ff') },
  { id: 'electronics', name: 'Elektronika', icon: '📱', groupId: 'shopping', image: img('photo-1556656793-08538706a9f0') },
  { id: 'mobile', name: 'Telefon do‘koni', icon: '📲', groupId: 'shopping', image: img('photo-1512941937699-90a1b58e7e9c') },
  { id: 'furniture', name: 'Mebel', icon: '🛋️', groupId: 'shopping', image: img('photo-1555041469-a586c61ea9bc') },
  { id: 'hardware', name: 'Qurilish materiallari', icon: '🧱', groupId: 'shopping', image: img('photo-1504307651254-35680f356dfd') },
  { id: 'autoparts', name: 'Avto ehtiyot qism', icon: '⚙️', groupId: 'shopping', image: img('photo-1486262715619-67b85e0b08d3') },
  { id: 'stationery', name: 'Kantselyariya', icon: '📝', groupId: 'shopping', image: img('photo-1515054458823-948dc294418d') },
  { id: 'butcher', name: 'Qassob xona', icon: '🥩', groupId: 'shopping', image: img('photo-1740586222627-48338edac67d') },
  { id: 'carpets', name: 'Gilamlar', icon: '🧶', groupId: 'shopping', image: img('photo-1646733704166-58c963521222') },
  { id: 'household', name: "Xo'jalik mollari", icon: '🧹', groupId: 'shopping', image: img('photo-1758887262204-a49092d85f15') },
  { id: 'curtains', name: 'Parda', icon: '🪟', groupId: 'shopping', image: img('photo-1616628188859-7a11abb6fcc9') },
  { id: 'jewelry', name: 'Zargarlik', icon: '💍', groupId: 'shopping', image: img('photo-1611591437281-460bfbe1220a') },
  { id: 'optics', name: 'Optika', icon: '👓', groupId: 'shopping', image: img('photo-1574253457654-155139b587a8') },
  { id: 'flowers', name: 'Gullar do‘koni', icon: '💐', groupId: 'shopping', image: img('photo-1487530811176-3780de880c2d') },
  { id: 'bookstore', name: 'Kitob do‘koni', icon: '📚', groupId: 'shopping', image: img('photo-1521587760476-6c122a7f2022') },
  { id: 'toys', name: 'O‘yinchoqlar', icon: '🧸', groupId: 'shopping', image: img('photo-1503676260728-1c00da094a0b') },
  { id: 'perfume', name: 'Parfyumeriya', icon: '🌸', groupId: 'shopping', image: img('photo-1541643600916-9414f309541d') },

  // —— Xizmatlar ——
  { id: 'hotel', name: 'Mehmonxona', icon: '🏨', groupId: 'services', image: img('photo-1590381105924-c72589b9ef3f') },
  { id: 'barbershop', name: 'Sartaroshxona', icon: '💈', groupId: 'services', image: img('photo-1768938896401-fe52fd18d3af') },
  { id: 'beauty', name: 'Go‘zallik saloni', icon: '💄', groupId: 'services', image: img('photo-1560066984-138dadb4c035') },
  { id: 'spa', name: 'SPA & massaj', icon: '💆', groupId: 'services', image: img('photo-1540555700478-4be289fbecef') },
  { id: 'laundry', name: 'Kiyim yuvish', icon: '👔', groupId: 'services', image: img('photo-1582735689369-4fe89db7114c') },
  { id: 'tailor', name: 'Tikuvchi / atelye', icon: '🧵', groupId: 'services', image: img('photo-1558176283-434a29104659') },
  { id: 'photo', name: 'Fotosalon', icon: '📷', groupId: 'services', image: img('photo-1452587925148-e6fb1147a369') },
  { id: 'print', name: 'Bosma & nusxa', icon: '🖨️', groupId: 'services', image: img('photo-1612815157943-7d4b6f4e4b4e') },
  { id: 'workshop', name: 'Ustaxona', icon: '🔨', groupId: 'services', image: img('photo-1584677191047-38f48d0db64e') },
  { id: 'carservice', name: 'Avtoservis', icon: '🔧', groupId: 'services', image: img('photo-1770656505709-fd97236989b9') },
  { id: 'carwash', name: 'Avtoyuvish', icon: '🚿', groupId: 'services', image: img('photo-1607860103655-71be3c9607d9') },
  { id: 'motoservice', name: 'Moto ustaxona', icon: '🏍️', groupId: 'services', image: img('photo-1650569664566-f0014dcf54e3') },
  { id: 'bikeservice', name: 'Velik ustaxona', icon: '🚴', groupId: 'services', image: img('photo-1765376260898-38e465a2cf6f') },
  { id: 'gasstation', name: "Yoqilg'i quyish", icon: '⛽', groupId: 'services', image: img('photo-1602853175733-5ad62dc6a2c8') },
  { id: 'tire', name: 'Shina xizmati', icon: '🛞', groupId: 'services', image: img('photo-1486262715619-67b85e0b08d3') },

  // —— O'yin-kulgi ——
  { id: 'cinema', name: 'Kino', icon: '🎬', groupId: 'entertainment', image: img('photo-1760170437237-a3654545ab4c') },
  { id: 'entertainment', name: "O'yin-kulgi markazi", icon: '🎪', groupId: 'entertainment', image: img('photo-1771389805025-fa04791d6aea') },
  { id: 'gym', name: 'Sport zali', icon: '🏋️', groupId: 'entertainment', image: img('photo-1637579674775-7f868ee3c92d') },
  { id: 'theater', name: 'Teatr', icon: '🎭', groupId: 'entertainment', image: img('photo-1722321974501-059dff03e970') },
  { id: 'pool', name: 'Basseyn', icon: '🏊', groupId: 'entertainment', image: img('photo-1575429198097-0414c4a4a4a4') },
  { id: 'karaoke', name: 'Karaoke', icon: '🎤', groupId: 'entertainment', image: img('photo-1511379938543-c1f69419868d') },
  { id: 'playground', name: 'Bolalar markazi', icon: '🎠', groupId: 'entertainment', image: img('photo-1503676260728-1c00da094a0b') },
  { id: 'stadium', name: 'Sport maydoni', icon: '⚽', groupId: 'entertainment', image: img('photo-1574629810360-7efbbe195018') },

  // —— Ta'lim ——
  { id: 'school', name: 'Maktab', icon: '🏫', groupId: 'education', image: img('photo-1731865745081-4aeb28e2bc57') },
  { id: 'university', name: 'Universitet', icon: '🎓', groupId: 'education', image: img('photo-1631599143468-b7d2d09820b6') },
  { id: 'library', name: 'Kutubxona', icon: '📚', groupId: 'education', image: img('photo-1709924168698-620ea32c3488') },
  { id: 'kindergarten', name: 'Bog‘cha', icon: '🧸', groupId: 'education', image: img('photo-1503676260728-1c00da094a0b') },
  { id: 'courses', name: "O'quv markazi", icon: '📖', groupId: 'education', image: img('photo-1524178232363-1fb2b7553ecd') },
  { id: 'autoschool', name: 'Avtomaktab', icon: '🚗', groupId: 'education', image: img('photo-1449965408869-eaa3f722e40d') },

  // —— Transport ——
  { id: 'metro', name: 'Metro', icon: '🚇', groupId: 'transport', image: img('photo-1627283699152-856a72b66471') },
  { id: 'bus', name: 'Avtobus bekati', icon: '🚌', groupId: 'transport', image: img('photo-1580585473178-bc95a653f652') },
  { id: 'taxi', name: 'Taksi stansiyasi', icon: '🚕', groupId: 'transport', image: img('photo-1664353655821-debedc55dda1') },
  { id: 'parking', name: 'Avtoturargoh', icon: '🅿️', groupId: 'transport', image: img('photo-1590674899484-d5640e854abe') },
  { id: 'train', name: 'Temir yo‘l vokzali', icon: '🚆', groupId: 'transport', image: img('photo-1474487548417-781cb5548fa5') },
  { id: 'airport', name: 'Aeroport', icon: '✈️', groupId: 'transport', image: img('photo-1436491865332-7a61a109cc05') },

  // —— Jamoat ——
  { id: 'park', name: "Bog'", icon: '🌳', groupId: 'public', image: img('photo-1519331379826-f10be5486c6f') },
  { id: 'mosque', name: 'Masjid', icon: '🕌', groupId: 'public', image: img('photo-1564769662533-597f5c6287cc') },
  { id: 'museum', name: 'Muzey', icon: '🏛️', groupId: 'public', image: img('photo-1564399579883-451a5d0ec870') },
  { id: 'landmark', name: 'Diqqatga sazovor joy', icon: '🗺️', groupId: 'public', image: img('photo-1469854523086-cc02fe5d8800') },
  { id: 'stadium_pub', name: 'Xiyobon / maydon', icon: '🌿', groupId: 'public', image: img('photo-1558904541-efa843a06112') },
];

export function filterPlaceCategories(query: string): PlaceCategoryDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return PLACE_CATEGORY_CATALOG;
  return PLACE_CATEGORY_CATALOG.filter(
    (c) => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q),
  );
}

export function getGroupedPlaceCategories(query = '') {
  const items = filterPlaceCategories(query);
  return PLACE_CATEGORY_GROUPS.map((group) => ({
    ...group,
    items: items.filter((c) => c.groupId === group.id),
  })).filter((group) => group.items.length > 0);
}

export function findPlaceCategory(id: string): PlaceCategoryDef | undefined {
  return PLACE_CATEGORY_CATALOG.find((c) => c.id === id);
}
