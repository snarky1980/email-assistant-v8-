import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Use GitHub Pages base only in production build; use root in dev to avoid nested path issues.
  const base = mode === 'production' ? '/email-assistant-v6/' : '/';
  const writeTemplatesPlugin = {
    name: 'write-templates-plugin',
    apply: 'serve', // dev only
    configureServer(server) {
      const fs = require('fs');
      const path = require('path');
      server.middlewares.use('/__replace_templates', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const json = JSON.parse(body || '{}');
              if (!json || typeof json !== 'object' || !json.templates) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: 'Invalid payload. Expected { metadata, variables, templates }.' }));
                return;
              }
              const outPath = path.resolve(__dirname, 'complete_email_templates.json');
              fs.writeFileSync(outPath, JSON.stringify(json, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, path: outPath }));
            } catch (e) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
            }
          });
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: String(err && err.message || err) }));
        }
      });
    }
  };
  return {
    base,
    plugins: [react(), tailwindcss(), ...(mode !== 'production' ? [writeTemplatesPlugin] : [])],
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