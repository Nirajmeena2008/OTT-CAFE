// Generates two standalone, independently-installable apps from this single source tree:
//   deploy/frontend  -> static React build + zero-dependency static server (port 1350)
//   deploy/backend   -> Express API only (port 1351)
// The monorepo stays the source of truth; re-run this before every server deploy.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'deploy');

// Pin each dependency to the exact version already installed and tested here. Read from disk
// rather than require(): some packages' "exports" maps don't expose their package.json.
const v = (pkg) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', pkg, 'package.json'), 'utf8')).version;
const pin = (pkgs) => Object.fromEntries(pkgs.sort().map((p) => [p, v(p)]));

const copy = (rel, destRoot, destRel = rel) =>
  fs.cpSync(path.join(ROOT, rel), path.join(destRoot, destRel), { recursive: true });
const write = (file, content) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content, null, 2) + '\n');
};

fs.rmSync(OUT, { recursive: true, force: true });

// ---------------------------------------------------------------- frontend
const FE = path.join(OUT, 'frontend');
['index.html', 'src', 'public', 'vite.config.ts', 'tsconfig.json'].forEach((f) => copy(f, FE));

write(path.join(FE, 'package.json'), {
  name: 'ott-frontend',
  private: true,
  version: '1.0.0',
  type: 'module',
  engines: { node: '>=20' },
  scripts: {
    dev: 'vite --port 1350 --host',
    build: 'vite build',
    start: 'node serve.mjs',
    typecheck: 'tsc --noEmit',
  },
  dependencies: pin(['jspdf', 'lucide-react', 'motion', 'react', 'react-dom']),
  devDependencies: pin([
    '@tailwindcss/vite', '@types/node', '@types/react', '@types/react-dom',
    '@vitejs/plugin-react', 'tailwindcss', 'typescript', 'vite',
  ]),
});

write(path.join(FE, '.env.production'), 'VITE_API_BASE_URL=https://api.ottcafe.in/api\n');
write(path.join(FE, '.env.development'), 'VITE_API_BASE_URL=http://localhost:1351/api\n');
write(path.join(FE, '.env.example'), [
  '# Baked into the JS bundle at `npm run build` time (not read at runtime).',
  '# .env.production already points at the live API; only change it if the API moves.',
  'VITE_API_BASE_URL=https://api.ottcafe.in/api',
  '',
  '# Port for `npm start` (serve.mjs). Can also be passed as PORT=... on the command line.',
  'PORT=1350',
  '',
].join('\n'));
fs.copyFileSync(path.join(ROOT, 'scripts', 'serve.mjs'), path.join(FE, 'serve.mjs'));

// ---------------------------------------------------------------- backend
const BE = path.join(OUT, 'backend');
copy('server', BE);
// The API imports shared types + seed menu data from src/ — ship just those, same relative paths.
['src/types.ts', 'src/data'].forEach((f) => copy(f, BE));
copy('vitest.config.ts', BE);
fs.copyFileSync(path.join(ROOT, 'scripts', 'backend-index.ts'), path.join(BE, 'index.ts'));

write(path.join(BE, 'package.json'), {
  name: 'ott-backend',
  private: true,
  version: '1.0.0',
  type: 'module',
  engines: { node: '>=20' },
  scripts: {
    dev: 'tsx watch index.ts',
    build:
      'esbuild index.ts --bundle --platform=node --target=node20 --format=cjs --packages=external --sourcemap --outfile=dist/index.cjs',
    start: 'node dist/index.cjs',
    test: 'vitest run',
    typecheck: 'tsc --noEmit',
  },
  dependencies: pin(['dotenv', 'express', 'express-rate-limit', 'mysql2', 'zod']),
  devDependencies: pin([
    '@types/express', '@types/node', '@types/supertest', 'esbuild',
    'supertest', 'tsx', 'typescript', 'vitest',
  ]),
});

write(path.join(BE, 'tsconfig.json'), {
  compilerOptions: {
    target: 'ES2022',
    // Mirrors the root tsconfig — esbuild reads these two, so they keep class-field
    // semantics identical to the previously tested build.
    experimentalDecorators: true,
    useDefineForClassFields: false,
    module: 'ESNext',
    lib: ['ES2022', 'DOM', 'DOM.Iterable'],
    types: ['node'],
    skipLibCheck: true,
    moduleResolution: 'bundler',
    isolatedModules: true,
    esModuleInterop: true,
    allowImportingTsExtensions: true,
    noEmit: true,
  },
  include: ['index.ts', 'server', 'src'],
});

write(path.join(BE, '.env.example'), [
  '# Copy to .env and fill in. `npm start` loads it automatically from this folder.',
  '',
  '# Port this API listens on — map api.ottcafe.in to it in nginx.',
  'PORT=1351',
  'NODE_ENV=production',
  '',
  '# The website origin allowed to call this API from the browser (CORS).',
  'ALLOWED_ORIGIN=https://ottcafe.in',
  '',
  '# REQUIRED in production — the server refuses to start without both.',
  '# Admin dashboard master password, and the owner account passcode.',
  'ADMIN_PASSWORD=',
  'OWNER_PASSCODE=',
  '',
  '# MySQL (the app creates its tables and seeds the menu on first connect).',
  'MYSQL_HOST=localhost',
  'MYSQL_PORT=3306',
  'MYSQL_USER=',
  'MYSQL_PASSWORD=',
  'MYSQL_DATABASE=',
  'MYSQL_SSL=false',
  '',
  '# Until a real SMS provider sends OTP codes, the code is shown on screen.',
  '# Set to true once SMS delivery is wired up.',
  'DISABLE_OTP_PREVIEW=false',
  '',
  '# Optional — address lookup on the map.',
  'GOOGLE_MAPS_API_KEY=',
  '',
].join('\n'));

fs.copyFileSync(path.join(ROOT, 'scripts', 'DEPLOY_README.md'), path.join(OUT, 'README.md'));
fs.copyFileSync(path.join(ROOT, 'scripts', 'setup-backend.sh'), path.join(OUT, 'setup-backend.sh'));
fs.chmodSync(path.join(OUT, 'setup-backend.sh'), 0o755);

console.log(`Split written to ${path.relative(ROOT, OUT)}/ (frontend, backend)`);
