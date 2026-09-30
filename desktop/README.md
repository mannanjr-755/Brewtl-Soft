# Brewtl — Windows Desktop

Desktop wrapper for the existing production Brewtl dashboard. Does **not** change app code, APIs, or database.

Loads:

`https://brewtl-soft.vercel.app`

## Build

```bash
cd desktop
npm install
npm run icons
npm run dist
```

Output:

- `desktop/dist/Brewtl-CRM-Setup-1.0.0.exe` — NSIS installer (Start Menu + Desktop shortcuts)

## Notes

- Uses the live Brewtl deployment (same login, dashboard, printing, reports, notifications, Excel export, etc.).
- App icon is the Brewtl brand mark (not a React/default framework icon).
