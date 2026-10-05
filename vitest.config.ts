import { defineConfig } from 'vitest/config';

// Deliberately separate from vite.config.ts (which carries the React/Tailwind plugins for the
// frontend build): these are backend unit/integration tests, run under plain Node, with no
// browser/DOM environment needed.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/__tests__/**/*.test.ts'],
    globals: false,
  },
});
