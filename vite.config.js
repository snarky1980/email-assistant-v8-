import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
// Read package.json without JSON import attributes to keep Node 20 CI happy
const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// ESM-safe __dirname for Node 20+
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig(({ mode }) => {
  // Use GitHub Pages base only in production build; use root in dev to avoid nested path issues.
  const base = mode === 'production' ? '/email-assistant-v8-/' : '/';
  const writeTemplatesPlugin = {
    name: 'write-templates-plugin',
    apply: 'serve', // dev only
    configureServer(server) {
      server.middlewares.use('/__replace_templates', async (req, res, next) => {
        // Allow detection via OPTIONS
        if (req.method === 'OPTIONS') {
          res.statusCode = 204; // No Content
          return res.end();
        }
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
              const root = process.cwd();
              const outPath = path.resolve(root, 'complete_email_templates.json');
              const publicDir = path.resolve(root, 'public');
              const outPublic = path.resolve(publicDir, 'complete_email_templates.json');
              // write to repo root (for consistency) and public/ (so dev server serves it at /complete_email_templates.json)
              fs.writeFileSync(outPath, JSON.stringify(json, null, 2), 'utf-8');
              try { fs.mkdirSync(publicDir, { recursive: true }); } catch {}
              fs.writeFileSync(outPublic, JSON.stringify(json, null, 2), 'utf-8');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, path: outPath, public: outPublic }));
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
  const copyAdminStaticPlugin = {
    name: 'copy-admin-static',
    apply: 'build',
    writeBundle(options) {
      const outDir = options.dir || 'dist';
      const root = process.cwd();
      const files = [
        { src: path.resolve(root, 'admin.html'), dst: path.resolve(outDir, 'admin.html') },
        { src: path.resolve(root, 'admin-excel.html'), dst: path.resolve(outDir, 'admin-excel.html') },
        { src: path.resolve(root, 'help.html'), dst: path.resolve(outDir, 'help.html') },
        { src: path.resolve(root, '404.html'), dst: path.resolve(outDir, '404.html') },
      ];
      const assets = [
        { src: path.resolve(root, 'assets', 'admin-console.js'), dst: path.resolve(outDir, 'assets', 'admin-console.js') },
        { src: path.resolve(root, 'assets', 'admin-excel.js'), dst: path.resolve(outDir, 'assets', 'admin-excel.js') },
      ];
      // ensure assets dir
      fs.mkdirSync(path.resolve(outDir, 'assets'), { recursive: true });
      for (const f of [...files, ...assets]) {
        try {
          if (fs.existsSync(f.src)) {
            fs.copyFileSync(f.src, f.dst);
          }
        } catch (e) {
          // non-fatal
          console.warn('[copy-admin-static] failed to copy', f.src, '->', f.dst, e?.message || e);
        }
      }
    }
  };
  return {
    base,
    plugins: [react(), tailwindcss(), ...(mode !== 'production' ? [writeTemplatesPlugin] : []), copyAdminStaticPlugin],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version || ''),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __COMMIT_SHA__: JSON.stringify(process.env.VITE_COMMIT_SHA || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), './src'),
      },
    },
    build: {
      rollupOptions: {
        input: (() => {
          const root = process.cwd();
          return {
            main: path.resolve(root, 'index.html'),
          };
        })(),
      },
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      allowedHosts: ['all'],
    },
    preview: {
      port: 5175,
    },
  };
});
