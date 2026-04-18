# ARESSO Marketplace — performance & architecture audit (2026-04)

Bu hujjat ushbu sessiyada qilingan tekshiruv va o‘zgarishlarni qisqacha yig‘adi. **“% tezlashdi”** raqami Lighthouse / WebPageTest / k6 bilan o‘lchamasdan iloji yo‘q; quyida kutilayotgan ta’sir **sifatiy** berilgan.

---

## 1. Eng katta muammolar (topilgan)

| Muammo | Ta’sir |
|--------|--------|
| `AppContent.tsx` barcha bo‘limlarni (taom, mashina, ijara, profil, checkout, …) **bir vaqtda** import qilgan | Birinchi JS yuklamasi va parse vaqti oshgan |
| `vendor` + `index` chunklari 500kB+ (minify keyin) | Mobil tarmoqda TTI sekinlashishi mumkin |
| `make-server-27d0d16c/index.ts` juda katta monolit | Deploy va xotira, so‘ng endpoint izlash qiyin |
| Ayrim KV yozuvlari (to‘lov) faqat bitta kalitda yangilanishi | Ro‘yxatlar noto‘g‘ri holat (oldingi sessiyada qisman tuzatilgan) |
| SEO: `robots.txt` / `sitemap.xml` yo‘q edi | Indeks va boshqaruv |
| `ProfileView` obyektida takroriy kalitlar | Build ogohlantirishi, noaniq runtime |

---

## 2. Nimalar tuzatildi / qo‘shildi

### Frontend

- **Lazy loading + code splitting:** `AppContent.tsx` ichida ikkinchi darajali tablar (`dokon`, `market-oziq`, `taomlar`, `atrof`, mashina/ijara/xizmatlar/xonalar/uy, bonus, community, auksion, moshina), **profil** va **checkout** `React.lazy` + `Suspense` orqali alohida chunklarga ko‘chirildi.
- **Keraksiz import olib tashlandi:** ishlatilmagan `ShopView` importi.
- **Vite `manualChunks` kengaytirildi:** `@mui`, `recharts`, `leaflet/react-leaflet`, `swiper`, `motion`, `@supabase`, `embla-carousel` alohida chunklar (keshlash va parallel yuklash yaxshilanadi).
- **`jspdf` alohida chunk** tsikl sabab qoldirildi — `vendor` ichida qoldi (circular chunk oldini olish).
- **SEO:** `index.html` — `canonical`, `referrer`, Open Graph, Twitter card meta; `public/robots.txt`, `public/sitemap.xml`.
- **Clean code:** `ProfileView.tsx` dagi takroriy `tax_amount` / `discount_amount` kalitlari olib tashlandi.

### Backend / KV (oldingi va shu oqimda muhim nuqtalar)

- To‘lov holati uchun **`isEffectivelyPaidOrder`**, kassa cheki navbati uchun **`merchantOrderNeedsCashierReceipt`** (payments-logic).
- **`markKvOrderPaidFromGateway`**: barcha tegishli KV kalitlariga sinxron yozish.
- Kassa `/payments` uchun tarix oynasi kengaytirilgan (masalan, 30 kun).

### Database

- Ushbu PR da yangi indeks qo‘shilmadi; allaqachon mavjud: `20260323121000_relational_marketplace_performance.sql`, `marketplace_search_trgm`, va boshqalar. Keyingi qadam: production `EXPLAIN ANALYZE` va eng ko‘p ishlatilgan so‘rovlar bo‘yicha indeks.

### Server (Node / PM2 / Nginx)

- Loyiha asosan **Supabase Edge Functions (Deno)** + statik **Vite** build. PM2/Nginx sozlamalari bu repoda emas — ularni hosting provayderingiz (CDN, `gzip`/`brotli`, rate limit) boshqaradi. Tavsiya: statik `dist` uchun CDN + HTTP/2/3.

### Security (qisqa)

- Filial sessiyasi: `X-Branch-Token` / JWT; admin marshrutlar `robots.txt` da `Disallow`.
- XSS/SQL: frontend Supabase client + parametrlangan so‘rovlar; to‘liq audit alohida pentest talab qiladi.
- **Iltimos:** `public/sitemap.xml` dagi `loc` ni haqiqiy prod domen bilan almashtiring.

---

## 3. Qancha % tezlashdi?

- **O‘lchab berilmadi** (Lighthouse CI / RUM yo‘q).
- **Kutilayotgan:** birinchi yuklashda foydalanuvchi faqat **Market** ishlatsa, yuzlab KB JS parse/execute **keyingi tab**ga kechiktiriladi — mobil TTI va FCP uchun ijobiy.
- Aniq foiz uchun: `npm run build` dan keyin Lighthouse (mobil) “before/after” shu commit atrofida oling.

---

## 4. O‘zgargan fayllar

| Fayl |
|------|
| `src/app/AppContent.tsx` |
| `vite.config.ts` |
| `index.html` |
| `public/robots.txt` (yangi) |
| `public/sitemap.xml` (yangi) |
| `src/app/components/ProfileView.tsx` |
| `docs/marketplace-performance-audit.md` (bu hujjat) |

*(Edge/backend o‘zgarishlari oldingi sessiyalarda deploy qilingan bo‘lishi mumkin; bu hujjat faqat ushbu audit doirasini qamrab oladi.)*

---

## 5. Keyingi upgrade rejasi (tavsiya)

1. **Lighthouse CI** (GitHub Action) — PR da regressiya ushlanadi.
2. **`AppContent.tsx` bo‘linishi** — kontekst va state alohida modullarga (uzoq muddat).
3. **Edge function modullashtirish** — `index.ts` ni `routes/*.ts` ga bo‘lish.
4. **Rasm:** `loading="lazy"`, `decoding="async"`, CDN `srcset`, imkon qadar WebP/AVIF (build pipeline yoki storage).
5. **PostgreSQL:** eng ko‘p chaqiriladigan RPC va `orders` / `products` so‘rovlariga `EXPLAIN ANALYZE`.
6. **SSR/prerender:** faqat SEO-kritik sahifalar uchun (masalan, marketing) — butun SPA emas.
7. **CourierDashboard** hali eager — `routes.tsx` izohi bilan; React nusxasi muammosidan keyin alohida lazy sinov.

---

## 6. Marketplace maxsus (qisqa holat)

- **Mahsulot ro‘yxati:** allaqachon progressive reveal / skeleton bor; endi boshqa tablar lazy — asosiy thread kamroq band.
- **Qidiruv:** alohida `marketplaceSearch` moduli; server tomonda trigram migratsiya bor — prod indekslar tekshirilsin.
- **Chat / buyurtma / to‘lov navbati:** KV + edge; murakkab joylarda kalitlar sinxroni muhim (yuqorida).

---

*Hujjat: avtomatik audit sessiyasi yakuni. Savollar uchun development jamoasi bilan prod metrikalar (Sentry, Supabase logs) ni birlashtiring.*
