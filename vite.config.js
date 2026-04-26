import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    publicDir: 'public',
    server: {
        host: true,
        port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
        open: false,
        proxy: {
            // Proxy /api requests to the IBEX proxy server
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                secure: false,
            },
        },
    },
    build: {
        outDir: 'dist'
    }
});
