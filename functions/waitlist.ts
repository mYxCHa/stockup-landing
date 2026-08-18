// /waitlist - receives a browser/desktop early-access signup from the
// "StockUp is coming to your browser" banner and stores the email in the
// public.waitlist table (see supabase/waitlist_schema.sql in ~/StockUp).
//
// It INSERTs over PostgREST with the PUBLIC anon key - the same pattern as
// functions/_lib/product.ts, keeping the key server-side. The table's RLS
// grants anon INSERT only (no read-back), and `Prefer: return=minimal` means
// PostgREST never reads the row back, so the write needs no SELECT policy.
//
// Two callers:
//   - The banner's JS handler POSTs JSON and reads the JSON response.
//   - With JS disabled, the <form action="/waitlist"> posts form-encoded and
//     the browser navigates here; we 303 back to the banner instead of showing
//     a raw JSON body.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './_lib/supabase';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Where a no-JS form submission lands afterwards (the banner has id="waitlist").
const BANNER_ANCHOR = '/#waitlist';

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

async function readEmail(request: Request): Promise<{ email: string | null; wantsJson: boolean }> {
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

export const onRequestPost: PagesFunction = async (context) => {
  const { email, wantsJson } = await readEmail(context.request);

  if (!email) {
    return wantsJson
      ? json({ ok: false, error: 'invalid_email' }, 400)
      : redirect();
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

  // 409 = unique conflict = already on the list. That is a success from the
  // visitor's point of view, not an error.
  if (upstream.ok || upstream.status === 409) {
    return wantsJson
      ? json({ ok: true, already: upstream.status === 409 })
      : redirect();
  }

  return wantsJson ? json({ ok: false, error: 'unavailable' }, 502) : redirect();
};
