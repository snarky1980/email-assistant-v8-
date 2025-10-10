import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Use GitHub Pages base only in production build; use root in dev to avoid nested path issues.
  const base = mode === 'production' ? '/email-assistant-v6/' : '/';
  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5280,
      strictPort: true,
      allowedHosts: ['all'],
    },
    preview: {
      port: 5281,
    },
  };
});