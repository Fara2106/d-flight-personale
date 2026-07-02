import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        localstorage: 'memory',
      },
    },
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
});
