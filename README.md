# CRM — Restaurant Kitchen Dashboard

Staff dashboard moved out of `restaurantorder`. Customer home + digital menu stay in `restaurantorder`.

## Run

```bash
cd CRM
npm install
npm run dev
```

The app lives in `frontend/` (Next.js UI + API routes). There is no separate backend server.

Opens at **http://localhost:3001**

Login: `admin@bellacucina.com` / `password123`

## With customer site

1. `restaurantorder` → `npm run dev` (port **3000**) — home + menu  
2. `CRM` → `npm run dev` (port **3001**) — dashboard  

Both share the same SQLite DB (`restaurantorder/prisma/dev.db`).

Home “Staff login” / “Open dashboard” redirect to this CRM login.
