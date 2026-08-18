// Cloudflare Worker entry for the stockup-landing site.
//
// This project deploys as a Worker + static assets (see wrangler.jsonc's
// `assets` + `main`), which does NOT run the Pages `functions/` directory. This
// Worker handles the one dynamic route the site needs server-side - POST
// /waitlist (the browser-version early-access signup) - and passes everything
// else through to the static asset binding (env.ASSETS), so the marketing site
// is served exactly as before.
//
// The pre-existing functions/get.ts, functions/product/[id].ts and the OG image
// functions are intentionally NOT wired here: they were already not deploying
// under this model (a separate follow-up). Only /waitlist is handled.

// Public Supabase URL + anon key. Also defined in functions/_lib/supabase.ts
// (imported by functions/product.ts); duplicated inline here to keep this
// Worker entry self-contained with no bundling of TS imports. Public by design
// - RLS is the boundary, and the waitlist table grants anon INSERT only.
const SUPABASE_URL = 'https://xnbswcbdqizmbqbhqlua.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuYnN3Y2JkcWl6bWJxYmhxbHVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NDc5MjMsImV4cCI6MjA4ODAyMzkyM30.OBXWTtPrKGaRMrgDu_UbTYxP3NG8VhDngDG_TYsL_Yw';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Where a no-JS form submission lands afterwards (the banner has id="waitlist").
const BANNER_ANCHOR = '/#waitlist';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function redirect() {
  // 303 so the browser re-fetches with GET rather than re-POSTing on refresh.
  return new Response(null, {
    status: 303,
    headers: { Location: BANNER_ANCHOR, 'Cache-Control': 'no-store' },
  });
}

async function readEmail(request) {
  const contentType = request.headers.get('Content-Type') ?? '';
  // The fetch() path sends JSON; the no-JS <form> sends urlencoded.
  const wantsJson = contentType.includes('application/json');
  let raw = '';
  try {
    if (wantsJson) {
      const body = await request.json();
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

async function handleWaitlist(request) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  const { email, wantsJson } = await readEmail(request);
  if (!email) {
    return wantsJson ? json({ ok: false, error: 'invalid_email' }, 400) : redirect();
  }

  let upstream;
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
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/waitlist') {
      return handleWaitlist(request);
    }
    // Everything else is a static asset (or its 404).
    return env.ASSETS.fetch(request);
  },
};
