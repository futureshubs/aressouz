# Click → Supabase Edge Function secret nomlari

Kod `click.tsx` faqat **quyidagi 4 ta nom**ni o‘qiydi (`Deno.env.get(...)`). Boshqa nom bilan saqlangan bo‘lsa, **ishlamaydi**.

| Kabinetdagi tushuncha | Supabase’da **aynan shunday** yozilishi kerak |
|----------------------|-----------------------------------------------|
| Service ID | `CLICK_SERVICE_ID` |
| Merchant ID | `CLICK_MERCHANT_ID` |
| Secret key (СК) | `CLICK_SECRET_KEY` |
| Merchant user ID | `CLICK_MERCHANT_USER_ID` |

**Noto‘g‘ri misollar** (kod ularni ko‘rmaydi): `SERVICE_ID`, `MERCHANT_ID`, `merchant user id`, `CLICK_USER_ID`, `SECRET_KEY` (prefiksiz).

## Qiymatlar

- **Oddiy matn** kiriting: masalan `97403`, `57532`, `79179`, va kabinetdagi to‘liq secret.
- Dashboard’da qiymat **uzun xash / nuqtalar** ko‘rinishi — bu normal (mask), saqlangan qiymat o‘zgarmagan.

## Kabinetdagi kalit

`CLICK_SECRET_KEY` **faqat** «Сервисы» → ko‘zcha bilan ochilgan **Секретный ключ** bilan **harfiy** bir xil bo‘lsin (katta/kichik harf, `I` / `l` farqlariga e’tibor).

## Bir yo‘la tekshirish (eng oson)

### Agar `401 Missing authorization header` chiqsa

Bu **normal**: Supabase Edge Function so‘rovda JWT kutadi; oddiy brauzer manzilida `Authorization` yuborilmaydi.

**Variant A — darhol tekshirish (tavsiya):** `anon` kalit bilan so‘rov (kalit: Dashboard → **Settings → API → Project API keys → anon public**).

PowerShell:

```powershell
$ref = "OZINGIZNING_PROJECT_REF"
$key = "OZINGIZNING_ANON_KALITI"
$url = "https://$ref.supabase.co/functions/v1/make-server-27d0d16c/click/ping"
Invoke-RestMethod -Uri $url -Headers @{ Authorization = "Bearer $key" }
```

**Variant B — brauzerda ochilsin + Click POST ishlasin:** funksiya uchun JWT tekshiruvini o‘chiring.

- Dashboard: **Edge Functions** → `make-server-27d0d16c` → sozlamalar → **Enforce JWT / Verify JWT** ni o‘chiring (nomi biroz farq qilishi mumkin), **yoki**
- Loyihada `supabase/config.toml` ichida `verify_jwt = false` bor — `supabase functions deploy make-server-27d0d16c` bilan qayta deploy qiling.

Click **PREPARE/COMPLETE** tashqi serverdan keladi; ularda sizning JWT ingiz bo‘lmaydi — shu funksiya uchun odatda JWT o‘chiriladi, himoya esa `index.ts` dagi route auth da.

**Project URL ni** Settings → General dan nusxa oling (`https://xxxxx.supabase.co` dagi `xxxxx` — ref); qo‘lda yozganda xato chiqishi oson (`g` / `h` harflarini adashtirmang).

### Ping ishlaganda

1. **Brauzer** (JWT o‘chirilgan bo‘lsa) yoki yuqoridagi PowerShell:

   `https://<PROJECT_REF>.supabase.co/functions/v1/make-server-27d0d16c/click/ping`

2. JSON da qarang:
   - `env.allSet: true` — to‘rt secret ham bor.
   - `deployed` — serverda qaysi **Service / Merchant / Merchant user ID** yuklangan (kabinet bilan solishtiring).
   - `deployed.secretKeyPrefix` — kalitning dastlabki belgilari (kabinetdagi kalit bilan boshlanishi kerak).
   - `urls.preparePost` / `urls.completePost` — Click kabinetiga **shu manzillar**ni qo‘yganingiz tekshiriladi (ular **POST**).

3. **Supabase** → Edge Functions → `make-server-27d0d16c` → **Logs**: cold start da ham xuddi shu ID lar va kalitning qisqacha ko‘rinishi chiqadi.

4. To‘liq sinov: saytdan haqiqiy Click to‘lovi; xato bo‘lsa **Invocations** da `POST .../click/prepare` javobini qidiring (Click serverdan keladi).

---

## Baribir xato (-1907, -2041, “ma’lumot yetarli emas”) bo‘lsa

### 1) PREPARE umuman serverga yetmayapti (eng ko‘p sabab)

Click o‘zi `Authorization` yubormaydi. **Supabase Edge Function** da `make-server-27d0d16c` uchun **JWT tekshiruvi yoqilgan** bo‘lsa, `POST .../click/prepare` **401** bilan qaytadi — Click esa sizda **-1907** ko‘rinadi.

- **Dashboard:** Edge Functions → `make-server-27d0d16c` → *Verify JWT / Enforce JWT* ni **o‘chiring**.
- Yoki `supabase/config.toml` da `[functions.make-server-27d0d16c] verify_jwt = false` va **qayta deploy**.

**Tekshiruv:** Supabase → Logs / Invocations → `prepare` qidiring: status **401** bo‘lsa — aynan shu.

### 2) Test va prod aralashgan

- Admin panelda Click **test rejimi** yoqilgan bo‘lsa, endi `create-invoice` ham `test.click.uz` ochadi (oldingi versiyada doim `my.click.uz` edi).
- Aksincha, kabinet **faqat prod** bo‘lsa, test rejimini **o‘chiring**.
- Yoki secret `CLICK_PAY_BASE_URL` bilan aniq yozing: `https://test.click.uz/services/pay` yoki `https://my.click.uz/services/pay`.

### 3) Kabinet URL

`.../click/prepare` va `.../click/complete` manzili **to‘g‘ri project ref** (`wnondmqmuvjugbomyolz`) va **POST** bo‘lishi kerak.

### 4) Imzo

Logda `CLICK PREPARE: imzo mos emas` bo‘lsa — `CLICK_SECRET_KEY` kabinetdagi kalit bilan **harfiy** mos emas.

**Aniq xato kodini** (ekran yoki Click xabari) yozib yuborsangiz, qadamni toraytirish osonroq.

### -2041 (to‘lov sahifasida «ошибка во время оплаты»)

Bu odatda **Click yoki bank** to‘lovni yakunlay olmaganda chiqadi; ba’zan sizning **COMPLETE** javobingiz noto‘g‘ri bo‘lsa ham.

1. **Supabase** → Edge Functions → `make-server-27d0d16c` → **Invocations** → filtr: `complete` — xato paytida **POST `/click/complete`** bormi, status **200**mi, yoki `error: -1 / -2 / -8` qaytganmi?
2. **Logs** da `CLICK COMPLETE` yoki `imzo mos emas` / `merchant_prepare_id mos emas` qidiring.
3. **Summa:** juda kichik summa (masalan 2 500 so‘m) ba’zi ulanishlarda muammo berishi mumkin — **50 000+** so‘m bilan sinab ko‘ring.
4. Boshqa kartadan / mobil ilova orqali / boshqa tarmoqdan sinov.
5. Aniq kod tushuntirishi uchun **Click qo‘llab-quvvatlash** (+998 71 231 08 80).
