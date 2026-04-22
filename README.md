# Aresso — Online Store + Edge API

This repo contains:

- **Frontend**: React + Vite + TypeScript (`src/`)
- **Backend**: Supabase Edge Functions (Deno) with Hono (`supabase/functions/`)
- **DB/Migrations**: Supabase migrations (`supabase/migrations/`)

Key product areas include multi-vertical commerce (`market`, `shop`, `food`, `rental`), role-based operational panels (admin/branch/courier/restaurant), and payment verification flows (Click/Payme/Atmos).

## Local development

### Frontend

```bash
npm ci
npm run dev
```

### Tests

```bash
npm run test
npm run typecheck
npm run test:e2e
```

## Supabase Edge Functions

Function entrypoints are configured in `supabase/config.toml`.

- **Main server**: `make-server-27d0d16c` (currently `verify_jwt = false` to support external webhooks)
- **Payment webhooks**: `payment-webhooks` (Click/Payme/Atmos routes)
- **API**: `api` (modular Hono API under `supabase/functions/api/`)

### Deploy

```bash
npm run deploy
```

## Configuration / secrets

- **Frontend env**: see `.env.example` (only `VITE_*` variables are exposed to the browser)
- **Edge secrets**: set in Supabase Dashboard → Edge Functions → Secrets

See `ARCHITECTURE.md` for the intended structure and migration approach.

