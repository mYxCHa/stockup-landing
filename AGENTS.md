# stockup-landing - agent guide

Shared instruction file for every coding agent in this repo (Claude Code and Codex both read `AGENTS.md`).
This repo is small, so this file is self-contained: there is no `docs/` for shared detail here, because `docs/` is deliberately git-ignored (see the safety fences below).

## Overview

`stockup-landing` is the marketing website served at `https://stockup.au`.
It is a static site (`index.html`, `style.css`, legal pages, `robots.txt`, `sitemap.xml`, `llms.txt`) plus a Cloudflare Worker (`worker.ts`) and Pages Functions (`functions/`) that render dynamic product Open Graph cards (`/product/:id`, `/og/product/:id.png`).

## Commands

- `npm run dev` - `wrangler pages dev .` (local preview; serves the repo root locally).
- `npm run build` - `node build.mjs`; stages the deployable static site into `dist/`.

## Deploy model

`npm run build` copies every git-tracked file into `dist/` except an explicit exclude list (build tooling, `functions/`, `docs/`, and the agent instruction files) - see `build.mjs`.
Cloudflare serves `dist/` as static assets (`wrangler.jsonc` -> `assets.directory: ./dist`, binding `ASSETS`), and `worker.ts` handles the dynamic routes; `functions/` is compiled from the repo root separately by wrangler.
The Cloudflare dashboard build command is `npm run build`, so the deployed artifact is `dist/`.

## Safety fences (read before you touch anything)

- **The repo root is served publicly.** Any git-tracked file that `build.mjs` copies into `dist/` becomes reachable at `https://stockup.au/<path>`. Never commit an internal, planning, or instruction document to a served path.
- **`docs/` is git-ignored on purpose** - committing planning docs would publish the strategy, competitor analysis and pricing rationale at `stockup.au/docs/*.md`. Keep planning docs local, inside the ignored `docs/`.
- **`AGENTS.md` (and any future `CLAUDE.md`) is tracked but must never be deployed.** It is excluded two ways: `build.mjs` `EXCLUDE_EXACT` (never copied into `dist/`) and a generated `dist/.assetsignore` (Cloudflare skips it even if present). If you add another root-level instruction or internal file, add it to both.
- **`robots.txt` in this repo is the sole source of truth** - Cloudflare's managed robots.txt is disabled; do not re-enable it. Verify with `curl -s https://stockup.au/robots.txt | grep -c '^Disallow: /$'` (must be 0).
- Never use the em-dash character; use a plain dash. Never add an agent name as a commit co-author. Never hand-edit auto-generated files.

## Where things live

- Static pages: `index.html`, `get.html`, `delete-account.html`, `privacy-policy.html`, `terms-of-service.html`, `product-fallback.html`, `style.css`.
- Dynamic OG cards: `worker.ts` + `functions/`.
- Cloudflare config: `wrangler.jsonc`, `_headers`, `_redirects`, `.well-known/`, `app-ads.txt`.
- Crawler/AEO: `robots.txt`, `sitemap.xml`, `llms.txt`.
- Local-only planning docs (git-ignored, never deployed): `docs/website-v3.1-*.md` and similar.

## Related repos

These are independent sibling git repos; touch another one only when the task genuinely requires it.

- `../StockUp` - the React Native app (deep links target `stockup.au/product/...`).
- `../stockup-scraper` - the catalogue pipeline that produces the product data the OG cards read.
