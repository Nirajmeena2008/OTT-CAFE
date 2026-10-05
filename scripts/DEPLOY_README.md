# Out of the Town (ottcafe.in) — Server Setup Guide

This folder contains the website split into **two independent apps**. Each one has its own
`package.json`, installs its own dependencies, and runs on its own port.

| Folder      | What it is                                   | Port | Domain            |
|-------------|----------------------------------------------|------|-------------------|
| `backend/`  | API server — Node.js + Express + MySQL       | 1351 | `api.ottcafe.in`  |
| `frontend/` | The website — built React app + tiny server  | 1350 | `ottcafe.in`      |

The browser loads the website from `ottcafe.in`; the website then calls the API at
`https://api.ottcafe.in/api/...`. Both `dist/` folders are **already built and tested**, so
you only need to install, configure, and start.

**Requirements:** Node.js **20 or newer**, npm, pm2, nginx, and a MySQL database.

---

## 1. What every file is

### `backend/`

| File / folder         | Purpose |
|-----------------------|---------|
| `index.ts`            | Entry point. Loads `.env`, checks required settings, starts the API on `PORT` (1351). |
| `server/app.ts`       | Express setup: CORS, security headers, rate limiting, mounts all `/api` routes. |
| `server/routes.ts`    | Every API endpoint: menu, orders, reservations, customer login (OTP), admin, delivery. |
| `server/store.ts`     | In-memory data store, default restaurant info, open/closed logic. |
| `server/mysql.ts`     | MySQL connection pool + table definitions. **Creates tables automatically.** |
| `server/mysqlService.ts` | Reads/writes data to MySQL; seeds the menu on first run; auto-syncs every 10 min. |
| `server/rbac.ts`      | Staff roles & permissions (owner, manager, chef, etc.). |
| `server/schemas.ts`   | Input validation for orders, reservations, etc. |
| `server/middleware/`  | Rate limiter (anti-spam) and input sanitiser. |
| `server/__tests__/`   | 89 automated tests (`npm test`). |
| `src/types.ts`, `src/data/` | Shared data types + the original menu, used to seed a fresh database. |
| `dist/index.cjs`      | **Pre-built, ready-to-run** API. This is what pm2 runs. |
| `.env.example`        | Template for the settings file. Copy to `.env` and fill in. |
| `package.json`        | Dependency list + scripts (`build`, `start`, `test`). |
| `tsconfig.json`, `vitest.config.ts` | TypeScript and test configuration. |

### `frontend/`

| File / folder         | Purpose |
|-----------------------|---------|
| `dist/`               | **Pre-built website** (HTML/CSS/JS). Already points at `https://api.ottcafe.in/api`. |
| `serve.mjs`           | Small static server (no dependencies) that serves `dist/` on port 1350. |
| `src/`, `index.html`, `public/` | Source code of the website (only needed if you rebuild). |
| `.env.production`     | Sets the API address used when rebuilding. Keep it. |
| `.env.development`    | API address for local development only. |
| `vite.config.ts`, `tsconfig.json` | Build configuration. |
| `package.json`        | Dependency list + scripts (`build`, `start`). |

---

## 2. Step-by-step setup over SSH

### Step 1 — Connect and find the files

```bash
ssh <user>@3.111.189.118
find / -type d -path "*private/ott/backend" 2>/dev/null
```

The `find` prints the full path of the uploaded folders (they were uploaded by FTP into
`private/ott/`). Use that path below; this guide calls it `$OTT`.

Note: `public_html/` already contains the same built website as `frontend/dist/`, so the site
is live even before step 5 — once nginx maps ottcafe.in to port 1350 (step 6), `public_html/`
is no longer used.

```bash
OTT=/the/path/printed/above/..        # the folder that contains backend/ and frontend/
cd $OTT && ls                          # should show: backend  frontend  README.md
```

### Step 2 — Check Node.js and pm2

```bash
node -v                                # must be v20 or newer
npm -v
pm2 -v || npm install -g pm2           # install pm2 if missing
```

### Quickest way: steps 3 and 4 in one command

```bash
bash $OTT/setup-backend.sh
```

It asks for the MySQL name/user/password and the two admin passwords, writes
`backend/.env` (readable only by you), installs, runs the tests, starts `ott-backend` with pm2
and confirms the MySQL connection. It ends with `SUCCESS` or tells you what to fix. The manual
equivalent is below.

### Step 3 — Backend: configure

```bash
cd $OTT/backend
cp .env.example .env
nano .env
```

Fill in `.env`:

| Setting           | Value |
|-------------------|-------|
| `PORT`            | `1351` |
| `NODE_ENV`        | `production` |
| `ALLOWED_ORIGIN`  | `https://ottcafe.in` (lets the website call the API; www.ottcafe.in is allowed automatically) |
| `ADMIN_PASSWORD`  | **Required.** Admin dashboard master password — pick a strong one. |
| `OWNER_PASSCODE`  | **Required.** Owner account passcode — pick a strong one. |
| `MYSQL_HOST`      | `localhost` (if MySQL is on this server) |
| `MYSQL_PORT`      | `3306` |
| `MYSQL_USER`      | database user |
| `MYSQL_PASSWORD`  | database password |
| `MYSQL_DATABASE`  | database name |

The API **refuses to start** in production if `ADMIN_PASSWORD` or `OWNER_PASSCODE` is empty,
so the admin panel can never go live with a default password. On first start it creates all
MySQL tables itself and loads the full menu — no manual SQL needed.

### Step 4 — Backend: install, test, start

```bash
cd $OTT/backend
npm install                            # installs backend dependencies only
npm test                               # optional: should show 89 passed
pm2 start dist/index.cjs --name ott-backend      # run from inside backend/ so .env is found
pm2 logs ott-backend --lines 20 --nostream
```

In the logs you should see:

```
[MySQL] Connection pool created for mysql://<user>@localhost:3306/<database>
OTT API listening on http://0.0.0.0:1351
[MySQL] Schema verified: 10 core table(s) checked/created.
```

Check it answers **and is connected to MySQL**:

```bash
curl -s http://127.0.0.1:1351/api/health       # {"status":"ok",...}
curl -s http://127.0.0.1:1351/api/mysql/status # must show "configured":true,"connected":true
```

If it shows `"configured":false`, the API did not read `backend/.env` — every order and
booking is then kept only in memory (lost on restart) and the admin password falls back to a
built-in default. Stop it (`pm2 delete ott-backend`), `cd` into `backend/`, and start it again
from there.

### Step 5 — Frontend: install and start

```bash
cd $OTT/frontend
npm install                            # installs frontend dependencies only
pm2 start serve.mjs --name ott-frontend          # serves dist/ on port 1350
# Do NOT use `npm run dev` on the server: that is development mode. It points the website
# at http://localhost:1351 (the visitor's own computer), so the menu, orders and bookings
# fail for every visitor, and it serves the raw source code instead of the built site.
curl -sI http://127.0.0.1:1350/        # expect: HTTP/1.1 200 OK
```

(`npm run build` is only needed if the source code changes — `dist/` is already built.)

### Step 6 — nginx: map the domains to the ports

SSL certificates for both domains already exist. In each domain's `server { ... }` block
(the one with `listen 443 ssl`), set the `location /` to proxy to its port:

```nginx
# api.ottcafe.in  ->  backend (1351)
location / {
    proxy_pass http://127.0.0.1:1351;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 10m;          # menu/banner photo uploads
}

# ottcafe.in  ->  frontend (1350)
location / {
    proxy_pass http://127.0.0.1:1350;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Then test and reload nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

(Alternative for the frontend: skip the Node process and serve files directly with
`root $OTT/frontend/dist;` and `try_files $uri /index.html;`.)

### Step 7 — Survive reboots

```bash
pm2 save
pm2 startup          # prints one more command — copy and run it
```

### Step 8 — Final check from outside

```bash
curl -s https://api.ottcafe.in/api/health      # {"status":"ok",...}
curl -sI https://ottcafe.in/                   # HTTP/2 200
```

Then open https://ottcafe.in in a browser — the menu should load.

---

## 3. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `Refusing to start in production: ADMIN_PASSWORD ... not set` | Fill both passwords in `backend/.env`, then `pm2 restart ott-backend`. |
| Log says `Environment variables ... are not set. Operating with local ... store` | `.env` not found — start pm2 **from inside** `backend/`, or check the MySQL values. |
| `Access denied for user` in logs | Wrong MySQL user/password/database name in `.env`. The site still runs on built-in data meanwhile. |
| Website loads but menu is empty / "connection error" | API not reachable: check `curl https://api.ottcafe.in/api/health`, nginx mapping, and `ALLOWED_ORIGIN=https://ottcafe.in`. |
| `EADDRINUSE` | Something already uses the port: `sudo lsof -i :1351` (or `:1350`). |
| `502 Bad Gateway` from nginx | The pm2 app isn't running: `pm2 status`, `pm2 logs ott-backend`. |

## 4. Updating later

When new files arrive, replace the changed folder(s), then:

```bash
cd $OTT/backend  && npm install && pm2 restart ott-backend
cd $OTT/frontend && npm install && pm2 restart ott-frontend
```

`.env` is never overwritten by an update — keep your copy.
