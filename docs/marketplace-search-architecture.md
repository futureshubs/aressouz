# Marketplace qidiruv arxitekturasi

Bu hujjat `src/app/utils/marketplaceSearch/` dagi **production** client-ranking va PostgreSQL tomondagi indekslarni tasvirlaydi.

## Qatlamlar

1. **Normalize** (`textNormalize.ts`) — NFKD, apostrof, kirill-lotin aralashmasi, bo‘shliqlar.
2. **Sinonim / typo yaxlitlash** (`synonyms.ts`) — `ayfon→iphone`, `aipods→airpods`, `krasofka→krossovka`, `ijarasi→ijara` va token-aliaslar.
3. **Intent / atribut parse** (`queryIntel.ts`) — viloyat-tuman leksikon (`data/regions`), narx oralig‘i, `xona`, `gb/tb`, `i5/m1`, rang tokenlari.
4. **Fuzzy** (`fuzzy.ts`) — qisqa so‘zlarda cheklangan Levenshtein (butun so‘z sifatida).
5. **Skor + tier** (`rankingEngine.ts`) — `exact | strong | related | weak`, vertikal bo‘yicha qoidalar.
6. **UI** — `HeaderSearchContext`: `query` (input) + `effectiveQuery` (~140ms debounce) ro‘yxat filtri uchun.

## Vertikallar (`SearchRankVertical`)

| Vertikal   | Qisqa ma’nosi |
|-----------|----------------|
| `product` | Mahsulot: ko‘p so‘zda kamida bittasi **title**da; aksessuar jarimalari. |
| `rental`  | So‘rovdagi tuman nomi bo‘lsa, e’londa **shart**an shu joy ishtirok etishi. |
| `branch`  | Filial nomi / hudud. |
| `food`    | Taom / restoran. |
| `vehicle` | Avto. |
| `property`| Ko‘chmas mulk. |
| `place`   | Atrofda joylar. |
| `general` | Do‘kon nomi, katalog, xizmatlar. |

## Skor tushunchasi (qisqa formula)

Asosiy qismlar (yig‘indi):

- **Exact / phrase**: title da to‘liq ibora → katta bonus + tier `exact`.
- **Title tokenlari**: har bir head-token aliaslari title da → `strong` / `related`.
- **Joy** (`locationScore`): `rental` da eng yuqori, `property` / `place` / `product` da pastroq.
- **Atributlar** (`attributeScore`): `16gb`, `i5`, `2 xona` hintlari blobda.
- **Narx / rating / zaxira / yangilik** (`RankableItemMeta` orqali): mavjud bo‘lsa qo‘shiladi.
- **Aksessuar jarimasi** (`accessoryPenalty`): masalan, `gaming mouse` so‘ralganda title da `mouse` yo‘q, `keyboard` bor → jarima.

Tartib: `compareMarketplaceRank` — avvalo **tier**, keyin **score**, so‘ng `id` (barqarorlik).

## “Chiqmasin” (no trash)

- `product`: ≥2 ta head token bo‘lsa, kamida bittasi **title**da bo‘lishi shart.
- `rental`: parse qilingan tuman bo‘lsa, dokumentda shu tuman **bo‘lmasa** — chiqarilmaydi.
- Juda zaif `weak` + past `minAccept` — chiqarilmaydi.

## PostgreSQL

- Allaqachon mavjud: `products.search_vector`, `listings.search_vector` + **GIN** (`idx_products_search_vector`, …).
- Yangi migratsiya: `20260420120000_marketplace_search_trgm.sql` — `pg_trgm` **GIN** indekslar `lower(name)`, `lower(brand)`, `lower(title)` ustida (typo-tolerant server qidiruvi uchun).

### Server-side qidiruv namunasi (keyingi bosqich)

```sql
-- Oddiy full-text + tartib (variantlar: plainto_tsquery, websearch_to_tsquery)
select p.id,
       ts_rank_cd(p.search_vector, plainto_tsquery('simple', 'iphone & 13')) as rnk
from public.products p
where p.search_vector @@ plainto_tsquery('simple', 'iphone & 13')
  and p.status = 'active'
order by rnk desc, p.published_at desc nulls last
limit 24 offset 0;
```

**Cursor pagination**: `offset` o‘rniga `(published_at, id)` yoki `keyset` (`where (published_at, id) < ($1,$2)`) — katta offsetdan qoching.

## Edge (Supabase Functions)

Hozircha ranking **client**da (`scoreMarketplaceDocument`). Edge da mantiqiy qadam:

1. Foydalanuvchi `q` yuboradi.
2. Postgres: `tsvector` + `trgm` bilan tor ro‘yxat (masalan 200 ta id).
3. Ixtiyoriy: serverda xuddi shu `parseMarketplaceQuery` logikasini Deno/TS ga ko‘chirish yoki oddiy SQL vazn bilan tartiblash.

## Kengaytirish

- Sinonimlar: `synonyms.ts` ga faqat **kalit→qiymat** qo‘shish kifoya.
- Yangi vertikal: `types.ts` + `rankingEngine` da `minAccept` / `locationScore` tortishmasi.
- Embeddings (semantic): alohida servis + `pgvector` — hozirgi modul bilan parallel ishlatish mumkin.
