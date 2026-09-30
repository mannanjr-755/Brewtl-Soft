# Brewtl — Restaurant Kitchen Dashboard

Staff dashboard for the **Brewtl** brand. Customer home + digital menu live in a
separate project; this app is the kitchen/staff side and talks to the same
PostgreSQL database so menu orders land on the dashboard.

## Stack

- **Next.js 16** (App Router) — UI + API routes, no separate backend
- **Auth.js v5** — credentials login with JWT sessions
- **Prisma 6** + **Neon PostgreSQL**
- **Tailwind CSS v4**

## Run locally

```bash
npm install
cp frontend/.env.example frontend/.env      # set DATABASE_URL
npm run dev                                 # http://localhost:3001
```

Database setup:

```bash
npm run db:push     # sync schema
npm run db:seed     # demo restaurant, admin user, tables, menu
```

## Admin login

| Email               | Password    |
| ------------------- | ----------- |
| `admin@brewtl.com`  | `password123` |

Production: **https://brewtl-soft.vercel.app**

## Environment

`frontend/.env` holds `DATABASE_URL` so both the Prisma CLI and Next.js resolve
the same value. `frontend/.env.local` holds the rest.

| Variable              | Purpose                                              |
| --------------------- | ---------------------------------------------------- |
| `DATABASE_URL`        | Neon PostgreSQL connection string                     |
| `AUTH_SECRET`         | Session JWT signing secret (`npx auth secret`)        |
| `AUTH_URL`            | Canonical app URL (Vercel sets this automatically)    |
| `AUTH_TRUST_HOST`     | Trust `X-Forwarded-Host` behind Vercel                |
| `REPORTS_PIN`         | PIN guarding the Reports page                         |
| `NEXT_PUBLIC_APP_URL` | Public URL of this app                                |
| `NEXT_PUBLIC_SITE_URL`| Deployed Digital Menu URL                              |

## Notes

- `DATABASE_URL` omits `channel_binding=require` — Prisma's Postgres connector
  does not implement channel binding and fails with `P1001`.
- `connect_timeout` / `pool_timeout` are raised above Prisma's 10s defaults
  because the TLS handshake through the Neon pooler regularly exceeds it.
- `src/lib/prisma.ts` retries transient connection errors
  (`P1001`, `P1002`, `P1008`, `P1017`, `P2024`, `P2028`) and
  `src/instrumentation.ts` opens the pool at boot, so serverless cold starts do
  not fail the first request.

## Desktop

`desktop/` packages the dashboard as a Windows Electron app.
`npm run icons` in `desktop/` regenerates the Windows icons from `frontend/public/logo.png`.
