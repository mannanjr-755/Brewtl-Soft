# BON PANIER CRM — Windows Desktop

Desktop wrapper for the existing production CRM. Does **not** change CRM code, APIs, or database.

## Production URL

`https://frontend-bay-mu-50.vercel.app`

## Build installer (Windows)

```bash
cd desktop
npm install
npm run dist
```

Output:

- `desktop/dist/BON-PANIER-CRM-Setup-1.0.0.exe` — NSIS installer (Start Menu + Desktop shortcuts)

## Run without installing

```bash
cd desktop
npm start
```

## Notes

- Uses the live CRM deployment (same login, dashboard, printing, reports, etc.).
- App icon is restaurant-themed (not a React/default framework icon).
- Optional override: set `CRM_DESKTOP_URL` before launch to point at another environment.
