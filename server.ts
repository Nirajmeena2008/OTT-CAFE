// Must be the very first import: loads .env into process.env before any other module
// (routes.ts, store.ts) reads ADMIN_PASSWORD, GOOGLE_CLIENT_ID, MYSQL_* etc.
import './server/loadEnv';
import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { app } from './server/app';


async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Vite middleware in development vs static bundle in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cafe application server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
