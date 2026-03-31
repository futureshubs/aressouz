# To'lov Tizimlari Integratsiyasi Qo'llanmasi

## Umumiy Ma'lumot

Ushbu tizim quyidagi to'lov provayderlarini qo'llab-quvvatlaydi:
- ✅ **Payme** - Bank kartalari, Payme Wallet, Click
- ✅ **Click** - Bank kartalari
- ✅ **OpenBudget** - Davlat xizmatlari to'lovlari
- ✅ **Uzum Nasiya** - Bo'lib to'lash xizmati
- ✅ **Uzum Bank** - Bank kartalari
- ✅ **Atmos** - Bank kartalari (Uzcard, Humo)

---

## Xavfsizlik

### ⚠️ Muhim:
1. **Hech qachon** Secret Key, API Key yoki parollarni Git'ga commit qilmang
2. Barcha ma'lumotlar Supabase KV store'da shifrlangan holda saqlanadi
3. Test rejimda haqiqiy to'lovlar amalga oshirilmaydi
4. Production'ga o'tishdan oldin barcha sozlamalarni tekshiring

### 🔐 Shifrlash:
Tizim avtomatik ravishda barcha maxfiy ma'lumotlarni shifrlaydi va xavfsiz saqlaydi.

---

## 1. Payme Integratsiyasi

### Kerakli Ma'lumotlar:
- **Merchant ID** - Sizning Payme merchant identifikatoringiz
- **Secret Key** - Payme tomonidan berilgan maxfiy kalit
- **Callback URL** (optional) - To'lov holatini qabul qilish uchun URL

### Sozlash Bosqichlari:

#### 1. Merchant Akkaunt Ochish
1. [Payme.uz](https://payme.uz) saytiga kiring
2. "Biznes uchun" bo'limiga o'ting
3. Ro'yxatdan o'ting va hujjatlarni taqdim eting
4. Tasdiqlangandan keyin Merchant ID va Secret Key oling

#### 2. Test Rejimni Sozlash
1. Admin panelga kiring (Ali/Ali/0099)
2. "To'lovlar" → "To'lov sozlamalari" ga o'ting
3. Payme kartasini toping
4. "Sozlash" tugmasini bosing
5. Test rejim yoniq ekanligini tekshiring
6. Quyidagi ma'lumotlarni kiriting:
   - Merchant ID: `test_merchant_id` (test uchun)
   - Secret Key: `test_secret_key` (test uchun)
7. "Saqlash" tugmasini bosing
8. To'lov usulini faollashtiring

#### 3. Production Rejimga O'tish
1. Merchant akkountingizdan real Merchant ID va Secret Key ni oling
2. Admin panelda Payme sozlamalarini oching
3. "Test rejim" tugmasini bosing (O'chiq holatga o'tkazish)
4. Real ma'lumotlarni kiriting:
   - Merchant ID: `Sizning real merchant ID`
   - Secret Key: `Sizning real secret key`
   - Callback URL: `https://your-domain.com/api/payme/callback`
5. Saqlang

#### 4. Callback URL Sozlash
Payme Merchant kabinetida callback URL ni sozlang:
```
https://{project-id}.supabase.co/functions/v1/make-server-27d0d16c/payments/callback/payme
```

#### 5. Testlash
1. Ilovada mahsulot tanlang
2. Checkout'ga o'ting
3. Payme'ni tanlang
4. Test karta raqamini kiriting:
   - Karta: `8600 0000 0000 0000`
   - Amal qilish muddati: `12/25`
   - CVV: `123`

---

## 2. Click Integratsiyasi

### Kerakli Ma'lumotlar:
- **Merchant ID** - Click merchant identifikatori
- **Service ID** - Xizmat identifikatori
- **Secret Key** - Maxfiy kalit
- **Merchant User ID** (optional) - Merchant foydalanuvchi ID

### Sozlash Bosqichlari:

#### 1. Merchant Akkaunt Ochish
1. [Click.uz](https://click.uz) saytiga kiring
2. "Biznes" bo'limiga o'ting
3. "To'lov qabul qilish" xizmatiga yoziling
4. Hujjatlarni taqdim eting
5. Tasdiqlangandan keyin Merchant ID, Service ID va Secret Key oling

#### 2. Admin Panelda Sozlash
1. Admin panelga kiring
2. "To'lovlar" → "To'lov sozlamalari"
3. Click kartasini oching
4. Test rejimda:
   - Merchant ID: `test_merchant`
   - Service ID: `test_service`
   - Secret Key: `test_secret`
5. Faollashtiring

#### 3. Production Sozlamalari
1. Real ma'lumotlarni kiriting
2. Test rejimni o'chiring
3. Callback URL sozlang:
```
https://{project-id}.supabase.co/functions/v1/make-server-27d0d16c/payments/callback/click
```

#### 4. Click Merchant Kabinetda
1. [Merchant kabinet](https://my.click.uz/merchant)ga kiring
2. "Settings" → "Payment Settings"
3. Callback URL'ni qo'shing
4. "Test mode" dan "Production mode"ga o'ting

---

## 3. Uzum Nasiya Integratsiyasi

### Kerakli Ma'lumotlar:
- **Merchant ID** - Uzum Nasiya merchant ID
- **Secret Key** - API maxfiy kaliti

### Sozlash:

#### 1. Shartnoma Tuzish
1. Uzum kompaniyasi bilan bog'laning: +998 78 150 00 00
2. Uzum Nasiya xizmatiga ulanish uchun ariza bering
3. Shartnoma imzolang
4. API ma'lumotlarini oling

#### 2. Sozlash
1. Admin panelda Uzum Nasiya ni oching
2. Merchant ID va Secret Key ni kiriting
3. Test rejimda testlang
4. Production'ga o'ting

#### 3. Testlash
- Test telefon: `+998 90 123 45 67`
- Test SMS kod: `123456`

---

## 4. Boshqa To'lov Tizimlari

### OpenBudget
1. [OpenBudget.uz](https://openbudget.uz) orqali ro'yxatdan o'ting
2. API kalitlarini oling
3. Admin panelda sozlang

### Uzum Bank
1. Uzum Bank bilan shartnoma tuzish
2. API credentials olish
3. Sozlash va testlash

### Atmos
1. [Atmos.uz](https://atmos.uz) bilan integratsiya
2. Merchant akkaunt ochish
3. API sozlamalari
4. **Eslatma**: Atmos.uz - bu oddiy bank kartasi to'lov gateway (Uzcard, Humo)

---

## Umumiy Callback Tizimi

Barcha to'lov provayderlar uchun callback URL formati:
```
https://{project-id}.supabase.co/functions/v1/make-server-27d0d16c/payments/callback/{method}
```

Bu yerda `{method}` quyidagilardan biri:
- `payme`
- `click`
- `openbudget`
- `uzumnasiya`
- `uzumbank`
- `atmos`

---

## Test Ma'lumotlari

### Payme Test Kartalari:
```
Muvaffaqiyatli:
  Karta: 8600 0000 0000 0000
  Muddat: 12/25
  CVV: 123

Rad etilgan:
  Karta: 8600 1111 1111 1111
  Muddat: 12/25
  CVV: 456
```

### Click Test Ma'lumotlari:
```
Telefon: +998 90 123 45 67
SMS kod: 666666
```

---

## Xavfsizlik Tavsifalari

### ✅ Qilish Kerak:
1. ✅ Faqat HTTPS ishlatish
2. ✅ Barcha API kalitlarni shifrlash
3. ✅ Test rejimda testlash
4. ✅ Callback URL'ni to'g'ri sozlash
5. ✅ Transaction log'larni saqlash
6. ✅ IP whitelisting (agar mavjud bo'lsa)

### ❌ Qilmaslik Kerak:
1. ❌ Secret Key'larni frontend'da saqlash
2. ❌ Git'ga commit qilish
3. ❌ Public API'da foydalanish
4. ❌ Test ma'lumotlarni production'da ishlatish
5. ❌ SSL/TLS sertifikatisiz ishlash

---

## Muammolarni Hal Qilish

### To'lov ishlamayapti:
1. Merchant akkount faol ekanligini tekshiring
2. API kalitlar to'g'ri kiritilganligini tekshiring
3. Callback URL to'g'ri sozlanganligini tekshiring
4. Test rejimda yoki production rejimda ekanligini tekshiring
5. Console log'larni tekshiring (F12)

### Callback ishlamayapti:
1. URL to'g'ri formatda ekanligini tekshiring
2. HTTPS ishlatilayotganligini tekshiring
3. Server log'larni tekshiring
4. Provider kabinetida callback URL ni qayta kiriting

### Test karta ishlamayapti:
1. Test rejim yoniq ekanligini tekshiring
2. To'g'ri test karta ma'lumotlarini ishlating
3. Provider'ning test muhitida ishlayotganligini tasdiqlang

---

## Qo'shimcha Resurslar

### Rasmiy Dokumentatsiyalar:
- [Payme API Docs](https://developer.help.paycom.uz/)
- [Click API Docs](https://docs.click.uz/)
- [Uzum API Docs](https://uzum.uz/docs)

### Yordam:
- Telegram: @your_support_channel
- Email: support@yourdomain.uz
- Telefon: +998 XX XXX XX XX

---

## Lisenziya va Huquqlar

Ushbu integratsiya faqat o'z biznesingiz uchun. Qayta sotish yoki tarqatish taqiqlangan.

© 2026 Online Shop Platform