import path from 'path';
import { defineConfig, loadEnv } from 'vite';
// React plugin removed — using esbuild's native JSX transform

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3001,
        host: '0.0.0.0',
        allowedHosts: ['page-unresisted-supersaintly.ngrok-free.dev'],
        proxy: {
          '/api/': {
            target: 'http://localhost:8000',
            changeOrigin: true,
          },
        },
      },
      plugins: [],
      esbuild: {
        jsx: 'automatic',
        jsxImportSource: 'react',
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        commonjsOptions: {
          include: [],
        },
      },
    };
});
