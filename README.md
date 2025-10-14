# Email Assistant v8 (imported from v6)

This repository starts from the email-assistant v6 codebase and is ready for you to continue work toward v8.

Two ways to run locally:

- Static server (simple, no build step): serves the current folder and the JSON data file.
- Vite dev server (HMR): for active React development in `src/`.

## Quick start: static server

Serve the project root with any static server. Examples (Linux/macOS):

```bash
# from the project root
npx http-server -p 5173 .
# then open in your browser
# http://localhost:5173/
```

The app will load the pill UI and fetch `public/complete_email_templates.json` (served at `/complete_email_templates.json`).

One-command option using the provided script:

```bash
npm run serve:static
```

## React dev workflow (Vite)

```bash
npm install
npm run dev
# open http://localhost:5173/
```

This runs the Vite dev server with HMR using `index.html` and the React entry in `src/main.jsx`.

## Production preview (optional)

```bash
npm run build
npm run preview -- --port 5175
# open http://localhost:5175/
```

Notes:
- If `index.html` uses classic scripts, Vite won’t bundle them, but the React SPA still builds fine. The static server path remains supported.

## Admin Console

A static Admin Console helps edit templates/variables without coding.

- Open: http://localhost:5173/admin.html (same static server)
- Import: Load any existing `complete_email_templates.json` (auto-loads from project root if present)
- Edit: templates, variables, and metadata (FR/EN supported)
- Export: downloads a validated `complete_email_templates.json`; replace the one in the repo and commit

Validation warns about duplicate IDs, unknown categories, missing variables, and unlisted placeholders `<<Var>>`. Warnings don’t block export.

Tip: Keep the main app open at `/` while editing in `/admin.html` to preview changes after updating the JSON file and reloading.
