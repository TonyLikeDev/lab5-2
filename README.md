# Acme Dashboard — Lab 5 Part 2

Next.js App Router dashboard from `nextjs.org/learn/dashboard-app`, adapted to use Supabase.

## Setup

1. **Create a Supabase project** at https://supabase.com → grab the URL, anon key, and service-role key from `Settings → API`.

2. **Copy env**:
   ```bash
   cp .env.example .env.local
   ```
   Fill in the four Supabase + AUTH variables. Generate `AUTH_SECRET` with `openssl rand -base64 32`.

3. **Create the schema**: open Supabase Dashboard → SQL Editor → paste the contents of `supabase/schema.sql` → run. This creates the `users`, `customers`, `invoices`, `revenue` tables and the RPC functions used by the aggregate queries.

4. **Install + run**:
   ```bash
   npm install
   npm run dev
   ```

5. **Seed the data**: visit http://localhost:3000/seed once. It hashes the demo user passwords with bcrypt and inserts the placeholder rows. The endpoint is idempotent for users/customers/revenue.

6. **Log in**: http://localhost:3000/login — use `user@nextmail.com` / `123456` (from `app/lib/placeholder-data.ts`).

## What's wired up

| Concern | Where |
| --- | --- |
| Supabase clients (anon + service role) | `app/lib/supabase.ts` |
| Data fetching | `app/lib/data.ts` (uses RPCs for aggregates) |
| Schema + RPC functions | `supabase/schema.sql` |
| Server Actions (CRUD + auth) | `app/lib/actions.ts` |
| Auth | `auth.ts`, `auth.config.ts`, `middleware.ts` |
| Streaming with Suspense | `app/dashboard/(overview)/page.tsx` |
| Search + pagination via URL params | `app/ui/search.tsx`, `app/ui/invoices/pagination.tsx`, `app/dashboard/invoices/page.tsx` |
| Error boundaries | `app/dashboard/invoices/error.tsx`, `app/dashboard/invoices/[id]/edit/not-found.tsx` |
| Metadata / SEO | root + per-page `metadata` exports |

## Partial Prerendering (PPR)

PPR is canary-only. To enable:

```bash
npm install next@canary
```

Then uncomment `experimental.ppr` in `next.config.ts` and `experimental_ppr` in `app/dashboard/layout.tsx`.
