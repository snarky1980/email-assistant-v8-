# Email Assistant v6

This repo includes two ways to run the app locally:

- Static (recommended for the current index.html): serves the prebuilt assets in `assets/` and the JSON file. No code changes.
- Vite dev (HMR) path: only use if you change `index.html` to load `/src/main.jsx`. Not needed for the pill UI build you prefer.

## Quick start (static)

Use any static server to serve the project root. Examples below.

### Python (preinstalled on macOS)

```bash
# from any directory
python3 -m http.server 5173 -d /Users/jean-sebastienkennedy/email-assistant-v6/email-assistant-v6
# then open
open http://localhost:5173/
```

### Node: serve

```bash
npm i -g serve
serve -l 5173 /Users/jean-sebastienkennedy/email-assistant-v6/email-assistant-v6
```

### Node: http-server

```bash
npm i -g http-server
http-server -p 5173 /Users/jean-sebastienkennedy/email-assistant-v6/email-assistant-v6
```

The app will load the pill UI and fetch `complete_email_templates.json` from the project root.

## Production preview (optional)

```bash
npm run build
npm run preview -- --port 5175
open http://localhost:5175/
```

Note: Vite’s build will not bundle classic scripts in `index.html` (ai-helper.js, ai-optional.js, var-popup-integrated.js) because they aren’t modules, but the build still outputs your React bundle. Static serving works fine with your current index.

## One-command static run (optional)

Already added to `package.json`:

```bash
npm run serve:static
```

This serves the current folder on http://localhost:5173 and preserves the exact pill UI version.

## Admin Console (non‑coder friendly)

We added a standalone, static Admin Console to edit templates and variables without coding.

- Open: http://localhost:5173/admin.html (same static server as above)
- Import JSON: Load any existing `complete_email_templates.json` (optional; the console also auto-loads the file from the project root if available).
- Edit:
	- Templates tab: change id, category, localized title/description/subject/body, and pick variables via checkboxes.
	- Variables tab: add/edit variables with FR/EN descriptions, format (text/number/date/time), and example values.
	- Metadata tab: update version and categories (languages are fixed to fr/en by the app).
- Save draft: Keeps your changes locally in your browser (no server write). You can close and come back later.
- Export JSON: Downloads a validated `complete_email_templates.json` file. Replace the file at the repository root and commit.
- Reset: Clears the local draft and reloads the original JSON from the server.

Validation & guardrails:
- Warns on duplicate template IDs, unknown categories, missing variables, or placeholders like `<<Var>>` not listed in a template’s variable list.
- Warnings don’t block export, but they help maintain data quality.

Tip: Keep your current app open on `/` while editing in `/admin.html` to preview templates as you iterate (after replacing the JSON file and reloading).
