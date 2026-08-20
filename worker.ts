// Cloudflare Worker entry for the stockup-landing site.
//
// This project deploys as a Worker + static assets (see wrangler.jsonc's
// `assets` + `main`), which does NOT run the Pages `functions/` directory. So
// the dynamic routes the site needs are wired here and delegate to the shared
// implementations under functions/_lib/ (imported, not duplicated - the same
// code the Pages Functions call, for a possible future Pages deploy):
//
//   POST /waitlist            - browser-version early-access signup
//   GET  /product/:id         - per-product share/interstitial page (OG tags)
//   GET  /og/product/:id.png  - per-product OG share-card image
//
// Everything else passes through to the static asset binding (env.ASSETS), so
// the marketing site is served exactly as before.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './functions/_lib/supabase';
import { renderProductPage } from './functions/_lib/productPage';
import { renderProductOgCard } from './functions/_lib/ogCard';

interface Env {
  ASSETS: { fetch: typeof fetch };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Where a no-JS form submission lands afterwards (the banner has id="waitlist").
const BANNER_ANCHOR = '/#waitlist';

// /product/:id and /product/:id/ - the id is a barcode-ish token.
const PRODUCT_RE = /^\/product\/([^/]+)\/?$/;
// /og/product/:id.png - the id keeps its .png here; renderProductOgCard strips it.
const OG_PRODUCT_RE = /^\/og\/product\/([^/]+)$/;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function redirect(): Response {
  // 303 so the browser re-fetches with GET rather than re-POSTing on refresh.
  return new Response(null, {
    status: 303,
    headers: { Location: BANNER_ANCHOR, 'Cache-Control': 'no-store' },
  });
}

async function readEmail(
  request: Request,
): Promise<{ email: string | null; wantsJson: boolean }> {
  const contentType = request.headers.get('Content-Type') ?? '';
  // The fetch() path sends JSON; the no-JS <form> sends urlencoded.
  const wantsJson = contentType.includes('application/json');
  let raw = '';
  try {
    if (wantsJson) {
      const body = (await request.json()) as { email?: unknown };
      raw = typeof body?.email === 'string' ? body.email : '';
    } else {
      const form = await request.formData();
      const value = form.get('email');
      raw = typeof value === 'string' ? value : '';
    }
  } catch {
    raw = '';
  }
  const email = raw.trim().toLowerCase();
  return { email: EMAIL_RE.test(email) && email.length <= 254 ? email : null, wantsJson };
}

async function handleWaitlist(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  const { email, wantsJson } = await readEmail(request);
  if (!email) {
    return wantsJson ? json({ ok: false, error: 'invalid_email' }, 400) : redirect();
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        // No row returned -> no SELECT policy needed, and nothing leaks back.
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ email, source: 'landing_browser_waitlist' }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    return wantsJson ? json({ ok: false, error: 'unavailable' }, 502) : redirect();
  }

  // 409 = unique conflict = already on the list, which is a success to the
  // visitor, not an error.
  if (upstream.ok || upstream.status === 409) {
    return wantsJson ? json({ ok: true, already: upstream.status === 409 }) : redirect();
  }

  return wantsJson ? json({ ok: false, error: 'unavailable' }, 502) : redirect();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/waitlist') {
      return handleWaitlist(request);
    }

    // The dynamic GET routes below are safe to match by prefix: no static
    // asset lives under /product/ or /og/product/ (the interstitial template
    // is /product-fallback, which these patterns do not match).
    if (request.method === 'GET' || request.method === 'HEAD') {
      const product = PRODUCT_RE.exec(url.pathname);
      if (product) {
        return renderProductPage(decodeURIComponent(product[1]), env, request.url);
      }
      const og = OG_PRODUCT_RE.exec(url.pathname);
      if (og) {
        return renderProductOgCard(decodeURIComponent(og[1]), env, request.url);
      }
    }

    // Everything else is a static asset (or its 404).
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
