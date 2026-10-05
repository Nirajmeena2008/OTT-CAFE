# Out of the Town (OTT) — Restro & Bakery website

Live site: https://ottcafe.in · API: https://api.ottcafe.in

Online menu, food ordering, table reservations, custom-cake orders, an admin dashboard
(orders, menu, staff, revenue) and a delivery-rider portal.

## What's where

| Folder | What it is |
|--------|------------|
| `src/` | **Frontend** — React + Vite + Tailwind (customer site, admin dashboard, rider portal) |
| `server/` | **Backend** — Express API, MySQL persistence, auth/roles, rate limiting, tests |
| `database/` | **Database** — full MySQL table layout (`schema.sql`) and backup notes |
| `scripts/` | Deployment: builds the separate `frontend/` and `backend/` packages the server runs |
| `server.ts` | Local development entry (frontend + API together on one port) |
| `api/`, `vercel.json` | Old Vercel deployment entry (no longer used; production runs on AWS) |

## Run locally

```bash
npm install
npm run dev          # http://localhost:3000 — site + API with an in-memory store
npm test             # backend test suite
npx tsc --noEmit     # type check
```

Without MySQL settings the API runs on built-in data (lost on restart). To use MySQL locally,
set `MYSQL_HOST`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE` (see `.env.example`).

## Deploying to the server

```bash
node scripts/build-split.mjs      # writes deploy/frontend and deploy/backend
cd deploy/backend  && npm install && npm run build && npm test
cd ../frontend     && npm install && npm run build
```

Then upload `deploy/backend`, `deploy/frontend` (without `node_modules`), `deploy/README.md` and
`deploy/setup-backend.sh` to `/ott/` on the server. `deploy/README.md` (from
`scripts/DEPLOY_README.md`) is the full server guide; `setup-backend.sh` creates the backend
settings file and (re)starts the API.

- Frontend: `serve.mjs` serves `dist/` on port 1350 (ottcafe.in).
- Backend: `dist/index.cjs` on port 1351 (api.ottcafe.in), settings in `backend/.env`
  (never committed — see `.env.example`).

## Secrets

No passwords or keys are stored in this repository. Production settings live only in
`backend/.env` on the server.
