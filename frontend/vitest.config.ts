import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test-setup.ts'],
        include: ['src/**/*.test.{ts,tsx}'],
        // Inline heavy ESM-only packages so Vitest can transform them
        server: {
            deps: {
                inline: ['@btc-vision/bitcoin', '@btc-vision/transaction', 'opnet'],
            },
        },
    },
});
