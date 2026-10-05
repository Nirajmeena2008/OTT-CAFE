// Must stay the first import: server/store.ts and server/routes.ts read ADMIN_PASSWORD /
// OWNER_PASSCODE / MYSQL_* at module load, so .env has to be applied before they evaluate.
import { loadedEnvFile } from '../server/loadEnv';
import { app } from '../server/app';

console.log(
  loadedEnvFile
    ? `[startup] Settings loaded from ${loadedEnvFile}`
    : "[startup] No .env file found in the backend folder."
);

// Required everywhere this entry point runs (it is only used for real deployments): without
// them the admin login falls back to 'admin123' and the owner passcode to '123'. Previously
// this was only enforced when NODE_ENV=production -- which itself comes from .env, so a
// missing .env skipped the check and the live API ran with the default passwords.
const missing = ['ADMIN_PASSWORD', 'OWNER_PASSCODE'].filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(
    `[startup] Refusing to start: ${missing.join(' and ')} not set. ` +
      `Create backend/.env from .env.example and fill ${missing.length > 1 ? 'them' : 'it'} in.`
  );
  process.exit(1);
}
if (!process.env.ALLOWED_ORIGIN) {
  console.warn('[startup] ALLOWED_ORIGIN is not set -- browsers on the live site will be blocked by CORS.');
}
if (!process.env.MYSQL_HOST && !process.env.MYSQL_URL && !process.env.DATABASE_URL) {
  console.warn('[startup] MySQL is not configured -- orders and bookings will be lost on restart.');
}

const PORT = Number(process.env.PORT) || 1351;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`OTT API listening on http://0.0.0.0:${PORT}`);
});
