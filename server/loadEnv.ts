import { existsSync } from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Load backend/.env by its own location, not the current directory. `import 'dotenv/config'`
// only looks in process.cwd(), so starting pm2 from any other folder silently ran the API with
// no settings at all: no MySQL, no CORS origin, and the built-in default admin password.
// __dirname is backend/dist when bundled (dist/index.cjs) and backend/server under tsx.
const here = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
const candidates = [path.resolve(here, '..', '.env'), path.resolve(process.cwd(), '.env')];

export const loadedEnvFile: string | null = candidates.find((file) => existsSync(file)) ?? null;
if (loadedEnvFile) {
  config({ path: loadedEnvFile, quiet: true });
}
