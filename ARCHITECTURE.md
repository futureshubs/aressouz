# Online Store Architecture Foundation

This document defines a production-oriented architecture and migration direction for the current codebase.

## 1) Product Scope

- Multi-vertical commerce: `market`, `shop`, `food`, `rental`
- Role-based operational panels: admin, branch/cashier, restaurant, courier
- Payment verification flow: QR, receipt upload, confirmation
- Delivery dispatch flow: only eligible paid/accepted orders visible to couriers

## 2) System Design

### Frontend

- Framework: React + Vite + TypeScript
- Routing: React Router
- State strategy:
  - Server state: data-fetching screens should converge to a unified query layer
  - UI state: component-local state for modal/filter interactions
- UI feature boundaries:
  - `payments`
  - `restaurant-orders`
  - `courier`
  - `branch-dashboard`
  - `shared` (reusable UI, utils, auth helpers)

### Backend

- Runtime: Supabase Edge Functions, Hono
- Layering target:
  - `routes` (request/response only)
  - `services` (business rules, orchestration)
  - `repositories` (KV/Postgres access)
  - `middleware` (auth, CORS, parsing, error handling)
- Auth:
  - Branch, courier, admin, user pathways remain explicit
  - Route-level authorization remains mandatory

### Data

- Current: KV-first operational data with relational sync in selected flows
- Target: relational canonical model for orders/payments, KV as compatibility/cache where needed
- Index strategy (relational target):
  - orders: `(branch_id, created_at desc)`, `(restaurant_id, status, created_at desc)`
  - payments: `(branch_id, status, created_at desc)`, unique `(order_id)`

### Environment

- Frontend:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `DEV_API_BASE_URL`, `API_BASE_URL`
- Backend:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - Bot/storage secrets

## 3) Recommended Structure

```text
src/app/
  features/
    payments/
    restaurant-orders/
    courier/
    branch/
  shared/
    ui/
    auth/
    utils/
  routes.tsx

supabase/functions/make-server-27d0d16c/
  routes/
  services/
  repositories/
  middleware/
  index.ts
```

## 4) Migration Approach

1. Extract pure business logic from `index.ts` into `services/*`
2. Keep route contracts stable while moving logic
3. Add deterministic debug instrumentation for mismatch scenarios
4. Gradually move KV-heavy aggregation to a relational read model

## 5a) Edge engine layout (incremental, non-breaking)

The `make-server-27d0d16c` entrypoint remains `index.ts`. Cross-cutting concerns are extracted **without changing route paths or response bodies**:

- `middlewares/path-normalize.ts` — path rewrite to `/make-server-27d0d16c/...`
- `middlewares/auth-gate.ts` — global auth header gate + public prefix list
- `middlewares/cors-security.ts` — CORS allowlist, security headers, redacted HTTP logging, OPTIONS
- `middlewares/rate-limit-auth.ts` — optional (`EDGE_RATE_LIMIT_AUTH=1`) auth-path rate limit
- `routes/health.ts` — `/health`, `/make-server-27d0d16c/health`, `/test-deployment` handlers
- `routes/public-read.ts` — `/favorites`, `/public/branches`, `/public/branches/location` (KV o‘qish)

Further routes should move in small PRs: copy handlers verbatim, `registerXRoutes(app)`, remove duplicate from `index.ts`.

**DB (additive):** `20260413180000_engine_additive_products_branch_vertical.sql` — `products(branch_id, vertical_type, status)` partial index.

## 5) Quality Gates

- No duplicated business rules across UI/backend
- Deterministic status mapping for cashier vs restaurant consistency
- Explicit handling of edge cases:
  - missing `branchId`
  - missing timestamps
  - mixed legacy/new order id formats
- Every refactor step must keep API responses backward compatible

